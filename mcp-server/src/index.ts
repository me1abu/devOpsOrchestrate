#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Incident, RepositoryContext, DashboardNotification } from './types.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { Octokit } from 'octokit';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

dotenv.config();

// ============================================================
// Database Setup (SQLite for persistence)
// ============================================================

const dataDir = process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || './data/incidents.db';
const db = new sqlite3.Database(dbPath);

// Initialize database schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      severity TEXT NOT NULL DEFAULT 'medium',
      category TEXT NOT NULL DEFAULT 'application',
      summary TEXT NOT NULL,
      description TEXT,
      suggested_fix TEXT,
      affected_file TEXT,
      affected_service TEXT,
      raw_log TEXT,
      source TEXT,
      kestra_execution_id TEXT,
      confidence REAL,
      pr_url TEXT,
      pr_number INTEGER,
      fix_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      fixed_at TEXT
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at)`);
});

// Database helper functions
async function saveIncident(incident: Incident): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT OR REPLACE INTO incidents (
        id, status, severity, category, summary, description, suggested_fix,
        affected_file, affected_service, raw_log, source, kestra_execution_id,
        confidence, pr_url, pr_number, fix_notes, created_at, updated_at, fixed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      incident.id,
      incident.status,
      incident.severity,
      incident.category,
      incident.summary,
      incident.description || null,
      incident.suggested_fix || null,
      incident.affected_file || null,
      incident.affected_service || null,
      incident.raw_log || null,
      incident.source || null,
      incident.kestra_execution_id || null,
      incident.confidence || null,
      incident.pr_url || null,
      incident.pr_number || null,
      incident.fix_notes || null,
      incident.created_at,
      incident.updated_at || null,
      incident.fixed_at || null,
    ];

    db.run(sql, params, function(err: Error | null) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function getIncident(id: string): Promise<Incident | undefined> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM incidents WHERE id = ?', [id], (err: Error | null, row: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as Incident | undefined);
      }
    });
  });
}

async function getAllIncidents(filters?: { status?: string; severity?: string }): Promise<Incident[]> {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM incidents';
    const conditions: string[] = [];
    const params: string[] = [];

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.severity) {
      conditions.push('severity = ?');
      params.push(filters.severity);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err: Error | null, rows: any[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as Incident[]);
      }
    });
  });
}

async function getPendingIncidents(severity?: string): Promise<Incident[]> {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM incidents WHERE status = ?';
    const params: string[] = ['pending'];

    if (severity) {
      query += ' AND severity = ?';
      params.push(severity);
    }
    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err: Error | null, rows: any[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as Incident[]);
      }
    });
  });
}

// ============================================================
// SSE (Server-Sent Events) for real-time updates
// ============================================================

interface SSEClient {
  id: string;
  res: Response;
}

const sseClients: SSEClient[] = [];

function broadcastSSE(event: { type: string; data: unknown }): void {
  const message = `data: ${JSON.stringify({ type: event.type, ...(event.data as object) })}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(message);
    } catch (error) {
      console.error(`Failed to send to client ${client.id}:`, error);
    }
  });
}

// ============================================================
// GitHub client
// ============================================================

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// ============================================================
// API Authentication Middleware
// ============================================================

const API_KEY = process.env.API_KEY;

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health check and SSE events
  if (req.path === '/health' || req.path === '/events') {
    return next();
  }

  // Skip auth if no API key is configured (development mode)
  if (!API_KEY) {
    return next();
  }

  const providedKey = req.headers['x-api-key'] || req.query.api_key;

  if (providedKey !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API key' });
    return;
  }

  next();
}

// ============================================================
// Notify dashboard via webhook + SSE
// ============================================================

async function notifyDashboard(notification: DashboardNotification): Promise<void> {
  // Broadcast via SSE to connected clients
  broadcastSSE({
    type: notification.type,
    data: { incident: notification.incident, timestamp: notification.timestamp },
  });

  // Also try webhook (for backward compatibility)
  try {
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    await axios.post(`${dashboardUrl}/api/notifications`, notification, {
      timeout: 5000,
    });
  } catch (error) {
    // Dashboard webhook is optional, don't log errors in production
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to notify dashboard via webhook:', error);
    }
  }
}

// ============================================================
// MCP Server Setup
// ============================================================

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
        const pendingIncidents = await getPendingIncidents(severity);

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
        const incident = await getIncident(incidentId);

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

        const incident = await getIncident(incidentId);
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

        await saveIncident(incident);

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

// ============================================================
// Express REST API for Kestra integration
// ============================================================

const app: Express = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
}));
app.use(express.json());
app.use(authMiddleware);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'DevOps Healer MCP Server API',
    version: '1.0.0',
    description: 'Self-Healing DevOps Orchestrator API for incident management and AI-assisted fixes',
    endpoints: {
      'GET /': 'API documentation',
      'GET /health': 'Health check',
      'GET /events': 'Server-sent events for real-time updates',
      'GET /incidents': 'List incidents',
      'POST /incidents': 'Create new incident',
      'GET /incidents/:id': 'Get incident by ID',
      'PATCH /incidents/:id': 'Update incident',
      'DELETE /incidents/:id': 'Delete incident',
      'GET /stats': 'Get statistics'
    },
    documentation: 'See README.md for full usage details',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const incidentCount = await new Promise<number>((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM incidents', (err: Error | null, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });

    res.json({
      status: 'healthy',
      incidents: incidentCount,
      sseClients: sseClients.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Database error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// SSE endpoint for real-time updates
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = uuidv4();
  const client: SSEClient = { id: clientId, res };
  sseClients.push(client);

  console.error(`SSE client connected: ${clientId}. Total clients: ${sseClients.length}`);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const index = sseClients.findIndex((c) => c.id === clientId);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
    console.error(`SSE client disconnected: ${clientId}. Total clients: ${sseClients.length}`);
  });
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

    await saveIncident(incident);

    // Notify dashboard (SSE + webhook)
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
app.get('/incidents/:id', async (req, res) => {
  try {
    const incident = await getIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json(incident);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get incident',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// List all incidents
app.get('/incidents', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const severity = req.query.severity as string | undefined;

    const filteredIncidents = await getAllIncidents({ status, severity });

    res.json({
      incidents: filteredIncidents,
      total: filteredIncidents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get incidents',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update incident status (alternative to MCP tool)
app.patch('/incidents/:id', async (req, res) => {
  try {
    const incident = await getIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }

    // Update fields
    const updatableFields = [
      'status', 'severity', 'category', 'summary', 'description',
      'suggested_fix', 'affected_file', 'pr_url', 'pr_number', 'fix_notes'
    ];

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        (incident as unknown as Record<string, unknown>)[field] = req.body[field];
      }
    }

    incident.updated_at = new Date().toISOString();
    if (req.body.status === 'fixed') {
      incident.fixed_at = new Date().toISOString();
    }

    await saveIncident(incident);

    await notifyDashboard({
      type: 'incident_updated',
      incident,
      timestamp: new Date().toISOString(),
    });

    res.json(incident);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update incident',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete incident
app.delete('/incidents/:id', async (req, res) => {
  try {
    const incident = await getIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM incidents WHERE id = ?', [req.params.id], function(err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    res.json({ message: 'Incident deleted', id: req.params.id });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete incident',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get statistics
app.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [total, todayCount, fixedCount, pendingCount, bySeverityRows] = await Promise.all([
      new Promise<number>((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM incidents', (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      }),
      new Promise<number>((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM incidents WHERE created_at >= ?', [today], (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      }),
      new Promise<number>((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM incidents WHERE status = ?', ['fixed'], (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      }),
      new Promise<number>((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM incidents WHERE status = ?', ['pending'], (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      }),
      new Promise<Array<{ severity: string; count: number }>>((resolve, reject) => {
        db.all(`
          SELECT severity, COUNT(*) as count
          FROM incidents
          GROUP BY severity
        `, [], (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows as Array<{ severity: string; count: number }>);
        });
      }),
    ]);

    res.json({
      total,
      today: todayCount,
      fixed: fixedCount,
      pending: pendingCount,
      autoFixRate: total > 0 ? Math.round((fixedCount / total) * 100) : 100,
      bySeverity: Object.fromEntries(bySeverityRows.map((s) => [s.severity, s.count])),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================
// Start servers
// ============================================================

async function main() {
  const mode = process.env.MCP_MODE || 'both';

  console.error(`Starting DevOps Healer MCP Server in mode: ${mode}`);
  console.error(`Database: ${dbPath}`);
  console.error(`API Key configured: ${API_KEY ? 'Yes' : 'No (open access)'}`);

  if (mode === 'mcp' || mode === 'both') {
    // Start MCP server over stdio for Cline
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error('MCP Server running on stdio');
  }

  if (mode === 'api' || mode === 'both') {
    // Start REST API for Kestra
    const port = process.env.MCP_PORT || process.env.MCP_SERVER_PORT || 3001;
    app.listen(port, () => {
      console.error(`REST API listening on port ${port}`);
      console.error(`SSE endpoint: http://localhost:${port}/events`);
      console.error(`Health check: http://localhost:${port}/health`);
    });
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
