#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Incident, RepositoryContext, FixResult, DashboardNotification } from './types.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { Octokit } from 'octokit';

dotenv.config();

// In-memory incident store (use Redis in production)
const incidents = new Map<string, Incident>();

// GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Notify dashboard via webhook
async function notifyDashboard(notification: DashboardNotification): Promise<void> {
  try {
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    await axios.post(`${dashboardUrl}/api/notifications`, notification, {
      timeout: 5000,
    });
  } catch (error) {
    console.error('Failed to notify dashboard:', error);
  }
}

// MCP Server Setup
const mcpServer = new Server(
  {
    name: 'devops-healer',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_pending_incidents',
        description: 'Get list of infrastructure incidents awaiting auto-fix. Returns incidents with status "pending" that need to be resolved.',
        inputSchema: {
          type: 'object',
          properties: {
            severity: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low'],
              description: 'Filter by severity level (optional)',
            },
          },
        },
      },
      {
        name: 'get_incident_details',
        description: 'Get full context and details for a specific incident by ID. Includes error logs, suggested fixes, and affected files.',
        inputSchema: {
          type: 'object',
          properties: {
            incident_id: {
              type: 'string',
              description: 'The unique identifier of the incident',
            },
          },
          required: ['incident_id'],
        },
      },
      {
        name: 'report_fix_status',
        description: 'Report the result of a fix attempt back to the system. Updates incident status and notifies dashboard.',
        inputSchema: {
          type: 'object',
          properties: {
            incident_id: {
              type: 'string',
              description: 'The incident ID that was fixed',
            },
            status: {
              type: 'string',
              enum: ['success', 'failed', 'needs_review'],
              description: 'The outcome of the fix attempt',
            },
            pr_url: {
              type: 'string',
              description: 'GitHub Pull Request URL (if PR was created)',
            },
            pr_number: {
              type: 'number',
              description: 'GitHub Pull Request number',
            },
            notes: {
              type: 'string',
              description: 'Additional notes about the fix',
            },
            files_changed: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of files that were modified',
            },
          },
          required: ['incident_id', 'status'],
        },
      },
      {
        name: 'get_repository_context',
        description: 'Get relevant context from the target repository including recent commits, related files, and dependencies to help with fixing.',
        inputSchema: {
          type: 'object',
          properties: {
            repo: {
              type: 'string',
              description: 'Repository name (e.g., "self-healing-demo-target")',
            },
            owner: {
              type: 'string',
              description: 'Repository owner/organization',
            },
            file_path: {
              type: 'string',
              description: 'Specific file path to get context for (optional)',
            },
          },
          required: ['repo', 'owner'],
        },
      },
    ],
  };
});

// Handle tool calls
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_pending_incidents': {
        const severity = args?.severity as string | undefined;
        const pendingIncidents = Array.from(incidents.values()).filter(
          (incident) =>
            incident.status === 'pending' &&
            (!severity || incident.severity === severity)
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(pendingIncidents, null, 2),
            },
          ],
        };
      }

      case 'get_incident_details': {
        const incidentId = args?.incident_id as string;
        const incident = incidents.get(incidentId);

        if (!incident) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Incident not found' }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(incident, null, 2),
            },
          ],
        };
      }

      case 'report_fix_status': {
        const incidentId = args?.incident_id as string;
        const status = args?.status as 'success' | 'failed' | 'needs_review';
        const prUrl = args?.pr_url as string | undefined;
        const prNumber = args?.pr_number as number | undefined;
        const notes = args?.notes as string | undefined;
        const filesChanged = args?.files_changed as string[] | undefined;

        const incident = incidents.get(incidentId);
        if (!incident) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Incident not found' }),
              },
            ],
            isError: true,
          };
        }

        // Update incident
        incident.status = status === 'success' ? 'fixed' : status === 'failed' ? 'failed' : 'needs_review';
        incident.pr_url = prUrl;
        incident.pr_number = prNumber;
        incident.fix_notes = notes;
        incident.updated_at = new Date().toISOString();
        if (status === 'success') {
          incident.fixed_at = new Date().toISOString();
        }

        incidents.set(incidentId, incident);

        // Notify dashboard
        await notifyDashboard({
          type: status === 'success' ? 'fix_completed' : 'fix_failed',
          incident,
          timestamp: new Date().toISOString(),
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                incident_id: incidentId,
                status: incident.status,
                message: 'Incident status updated successfully',
              }),
            },
          ],
        };
      }

      case 'get_repository_context': {
        const repo = args?.repo as string;
        const owner = args?.owner as string;
        const filePath = args?.file_path as string | undefined;

        try {
          // Get recent commits
          const { data: commits } = await octokit.rest.repos.listCommits({
            owner,
            repo,
            per_page: 5,
          });

          const recentCommits = commits.map((commit) => ({
            sha: commit.sha,
            message: commit.commit.message,
            author: commit.commit.author?.name || 'Unknown',
            date: commit.commit.author?.date || '',
          }));

          // Get repository tree (file structure)
          const { data: tree } = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: 'HEAD',
            recursive: 'true',
          });

          const relatedFiles = tree.tree
            .filter((item) => item.type === 'blob')
            .map((item) => item.path || '')
            .filter((path) => {
              if (!filePath) return true;
              const dir = filePath.split('/').slice(0, -1).join('/');
              return path.startsWith(dir);
            })
            .slice(0, 20);

          const context: RepositoryContext = {
            repo,
            owner,
            file_path: filePath,
            recent_commits: recentCommits,
            related_files: relatedFiles,
            branch: 'main',
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(context, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Failed to fetch repository context',
                  details: error instanceof Error ? error.message : 'Unknown error',
                }),
              },
            ],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Unknown tool' }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'Tool execution failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
      isError: true,
    };
  }
});

// Express REST API for Kestra integration
const app: Express = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', incidents: incidents.size });
});

// Create new incident (called by Kestra)
app.post('/incidents', async (req, res) => {
  try {
    const incident: Incident = {
      id: `inc-${uuidv4()}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      severity: req.body.severity || 'medium',
      category: req.body.category || 'application',
      summary: req.body.summary || 'Unknown incident',
      description: req.body.description || '',
      suggested_fix: req.body.suggested_fix,
      affected_file: req.body.affected_file,
      affected_service: req.body.affected_service,
      raw_log: req.body.raw_log,
      source: req.body.source,
      kestra_execution_id: req.body.kestra_execution_id,
      confidence: req.body.confidence,
    };

    incidents.set(incident.id, incident);

    // Notify dashboard
    await notifyDashboard({
      type: 'incident_created',
      incident,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      id: incident.id,
      status: 'queued',
      message: 'Incident created successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create incident',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get incident by ID
app.get('/incidents/:id', (req, res) => {
  const incident = incidents.get(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  res.json(incident);
});

// List all incidents
app.get('/incidents', (req, res) => {
  const status = req.query.status as string | undefined;
  const severity = req.query.severity as string | undefined;

  let filteredIncidents = Array.from(incidents.values());

  if (status) {
    filteredIncidents = filteredIncidents.filter((inc) => inc.status === status);
  }
  if (severity) {
    filteredIncidents = filteredIncidents.filter((inc) => inc.severity === severity);
  }

  res.json(filteredIncidents);
});

// Update incident status (alternative to MCP tool)
app.patch('/incidents/:id', async (req, res) => {
  const incident = incidents.get(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  Object.assign(incident, req.body);
  incident.updated_at = new Date().toISOString();
  incidents.set(incident.id, incident);

  await notifyDashboard({
    type: 'incident_updated',
    incident,
    timestamp: new Date().toISOString(),
  });

  res.json(incident);
});

// Start servers
async function main() {
  const mode = process.env.MCP_MODE || 'both';

  if (mode === 'mcp' || mode === 'both') {
    // Start MCP server over stdio for Cline
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error('MCP Server running on stdio');
  }

  if (mode === 'api' || mode === 'both') {
    // Start REST API for Kestra
    const port = process.env.MCP_SERVER_PORT || 3001;
    app.listen(port, () => {
      console.error(`REST API listening on port ${port}`);
    });
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
