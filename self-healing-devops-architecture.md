# Self-Healing DevOps Orchestrator: Complete System Architecture

## Executive Summary

This architecture delivers a working hackathon project in 4 days by prioritizing **demonstrable integration** over depth. The key insight: judges evaluate whether you've *used* each sponsor's tool meaningfully, not whether you've built production-grade infrastructure.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MISSION CONTROL DASHBOARD                              │
│                         (Next.js + Vercel Deployment)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Live Logs    │  │ Incident     │  │ Fix History  │  │ System       │         │
│  │ Stream       │  │ Timeline     │  │ & PRs        │  │ Health       │         │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ▲
                                        │ WebSocket / SSE
                                        │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              KESTRA ORCHESTRATION                                │
│                            (The Nervous System)                                  │
│                                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │   INGEST    │───▶│   ANALYZE   │───▶│   DECIDE    │───▶│   EXECUTE   │       │
│  │             │    │             │    │             │    │             │       │
│  │ • Log Watch │    │ • Oumi LLM  │    │ • Severity  │    │ • Cline MCP │       │
│  │ • Webhooks  │    │ • Classify  │    │ • Route     │    │ • Alert     │       │
│  │ • Polling   │    │ • Summarize │    │             │    │ • Log       │       │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │
│                            │                                    │               │
│                            ▼                                    ▼               │
│                     ┌─────────────┐                      ┌─────────────┐        │
│                     │  OUMI SRE   │                      │ CLINE MCP   │        │
│                     │    MODEL    │                      │   SERVER    │        │
│                     └─────────────┘                      └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                                                  │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CODE GENERATION                                     │
│                              (The Hands)                                         │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         CLINE + MCP SERVER                               │    │
│  │  • Receives incident context from Kestra                                │    │
│  │  • Opens target repository                                              │    │
│  │  • Analyzes error location                                              │    │
│  │  • Generates fix                                                        │    │
│  │  • Creates PR                                                           │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                         │
│                                        ▼                                         │
│                               ┌─────────────┐                                   │
│                               │   GITHUB    │                                   │
│                               │     PR      │──────▶ CodeRabbit Review          │
│                               └─────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Deep Dives

### 1. Oumi SRE-LLM (The Brain)

**Purpose:** Fine-tuned model that classifies and understands infrastructure errors.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    OUMI TRAINING PIPELINE                    │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   DATASET    │───▶│    OUMI      │───▶│   SRE-LLM    │   │
│  │              │    │   TRAINER    │    │              │   │
│  │ • syslog     │    │              │    │ Llama-3-8B   │   │
│  │ • nginx logs │    │ • LoRA       │    │ + LoRA       │   │
│  │ • k8s events │    │ • 4-bit      │    │              │   │
│  │ • labeled    │    │ • <1hr train │    │              │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                              │
│  OUTPUT FORMAT:                                              │
│  {                                                           │
│    "severity": "critical|high|medium|low",                   │
│    "category": "database|network|memory|disk|auth",          │
│    "summary": "Connection pool exhausted in PostgreSQL",     │
│    "suggested_fix": "Increase max_connections parameter",    │
│    "affected_file": "config/database.yml"                    │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

**Training Data Strategy (Realistic for 4 days):**

| Source | Records | How to Get |
|--------|---------|------------|
| Synthetic logs | 500 | Generate with templates |
| Public datasets | 300 | LogHub, Loghub-2.0 |
| Your own projects | 100 | Past error logs |
| Manual labeling | 100 | You label severity + category |

**Oumi Configuration:**

```yaml
# oumi_config.yaml
model:
  base: "meta-llama/Llama-3-8B-Instruct"
  quantization: "4bit"
  
training:
  method: "lora"
  lora_rank: 16
  lora_alpha: 32
  epochs: 3
  batch_size: 4
  learning_rate: 2e-4
  
dataset:
  format: "instruction"
  train_path: "./data/sre_train.jsonl"
  eval_path: "./data/sre_eval.jsonl"
```

---

### 2. Kestra Orchestration (The Nervous System)

**Purpose:** Event-driven workflow that ties all components together.

**Flow Architecture:**

```yaml
# Main Orchestration Flow
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  TRIGGER                                                         │
│  ├── Webhook (GitHub, AlertManager)                              │
│  ├── Schedule (every 30s poll logs)                              │
│  └── Manual (demo button)                                        │
│                                                                  │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ TASK 1: Normalize Input                                  │    │
│  │ Transform various log formats → unified schema           │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ TASK 2: AI Analysis (Kestra AI Agent - REQUIRED)         │    │
│  │ Uses Oumi model OR Claude as fallback                    │    │
│  │ Output: severity, category, summary, suggested_fix       │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ TASK 3: Decision Router                                  │    │
│  │ IF severity == "critical" OR "high":                     │    │
│  │   → Trigger auto-fix workflow                            │    │
│  │ ELSE:                                                    │    │
│  │   → Log and notify only                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ├──────────────────┐                                       │
│       ▼                  ▼                                       │
│  ┌──────────┐      ┌──────────┐                                 │
│  │ AUTO-FIX │      │   LOG    │                                 │
│  │ WORKFLOW │      │  ONLY    │                                 │
│  └──────────┘      └──────────┘                                 │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ TASK 4: Invoke Cline MCP Server                          │    │
│  │ POST /fix with incident context                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ TASK 5: Notify Dashboard                                 │    │
│  │ WebSocket push to Mission Control                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Kestra Flow Definition:**

```yaml
id: self-healing-orchestrator
namespace: devops.healing
description: Main orchestration flow for incident detection and auto-fix

triggers:
  - id: webhook-trigger
    type: io.kestra.plugin.core.trigger.Webhook
    key: incident-webhook
    
  - id: schedule-poll
    type: io.kestra.plugin.core.trigger.Schedule
    cron: "*/30 * * * * *"  # Every 30 seconds for demo

inputs:
  - id: log_source
    type: STRING
    defaults: "demo"
  - id: raw_log
    type: STRING
    required: false

tasks:
  - id: normalize-input
    type: io.kestra.plugin.scripts.python.Script
    script: |
      import json
      log_data = '{{ inputs.raw_log }}' or generate_demo_log()
      normalized = {
        "timestamp": extract_timestamp(log_data),
        "source": '{{ inputs.log_source }}',
        "message": log_data,
        "raw": log_data
      }
      print(json.dumps(normalized))

  - id: ai-analysis
    type: io.kestra.plugin.ai.Agent
    model: "{{ vars.oumi_endpoint | default('claude-sonnet-4-20250514') }}"
    prompt: |
      Analyze this infrastructure log and respond in JSON:
      
      LOG: {{ outputs.normalize-input.value }}
      
      Respond with:
      {
        "severity": "critical|high|medium|low",
        "category": "database|network|memory|disk|auth|application",
        "summary": "One line description",
        "suggested_fix": "Specific fix action",
        "affected_file": "path/to/file if applicable",
        "confidence": 0.0-1.0
      }

  - id: decision-router
    type: io.kestra.plugin.core.flow.Switch
    value: "{{ outputs.ai-analysis.severity }}"
    cases:
      critical:
        - id: trigger-autofix-critical
          type: io.kestra.plugin.core.flow.Subflow
          flowId: auto-fix-workflow
          inputs:
            incident: "{{ outputs.ai-analysis }}"
            priority: "immediate"
      high:
        - id: trigger-autofix-high
          type: io.kestra.plugin.core.flow.Subflow
          flowId: auto-fix-workflow
          inputs:
            incident: "{{ outputs.ai-analysis }}"
            priority: "standard"
    defaults:
      - id: log-only
        type: io.kestra.plugin.core.log.Log
        message: "Low severity incident logged: {{ outputs.ai-analysis.summary }}"

  - id: notify-dashboard
    type: io.kestra.plugin.core.http.Request
    uri: "{{ vars.dashboard_url }}/api/events"
    method: POST
    body: |
      {
        "type": "incident_processed",
        "data": {{ outputs.ai-analysis | json }},
        "flow_execution_id": "{{ execution.id }}"
      }
```

---

### 3. Cline MCP Server (The Hands)

**Purpose:** Bridge between Kestra and Cline to enable autonomous code fixes.

**MCP Server Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLINE MCP SERVER                             │
│                   (Node.js + Express)                            │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    MCP PROTOCOL LAYER                      │  │
│  │                                                            │  │
│  │  Tools Exposed to Cline:                                   │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ get_pending_incidents()                              │  │  │
│  │  │ Returns: List of incidents awaiting fix              │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ get_incident_details(incident_id)                    │  │  │
│  │  │ Returns: Full context, affected files, suggested fix │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ report_fix_status(incident_id, status, pr_url)       │  │  │
│  │  │ Updates: Kestra + Dashboard with fix result          │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ get_repository_context(repo, file_path)              │  │  │
│  │  │ Returns: Related files, recent changes, dependencies │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    REST API LAYER                          │  │
│  │                 (For Kestra Integration)                   │  │
│  │                                                            │  │
│  │  POST /incidents          - Receive new incident from      │  │
│  │                             Kestra                         │  │
│  │  GET  /incidents/:id      - Get incident status            │  │
│  │  POST /incidents/:id/fix  - Trigger Cline fix workflow     │  │
│  │  GET  /health             - Health check                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    INCIDENT QUEUE                          │  │
│  │                   (In-memory for hackathon)                │  │
│  │                                                            │  │
│  │  [ {id, status, severity, context, pr_url, timestamps} ]  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**MCP Server Implementation:**

```typescript
// mcp-server/src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";

// In-memory incident store
const incidents: Map<string, Incident> = new Map();

// MCP Server for Cline
const mcpServer = new Server(
  { name: "devops-healer", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Tool: Get pending incidents
mcpServer.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "get_pending_incidents",
      description: "Get list of infrastructure incidents awaiting auto-fix",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "get_incident_details", 
      description: "Get full context for a specific incident",
      inputSchema: {
        type: "object",
        properties: {
          incident_id: { type: "string" }
        },
        required: ["incident_id"]
      }
    },
    {
      name: "report_fix_status",
      description: "Report the result of a fix attempt",
      inputSchema: {
        type: "object", 
        properties: {
          incident_id: { type: "string" },
          status: { type: "string", enum: ["success", "failed", "needs_review"] },
          pr_url: { type: "string" },
          notes: { type: "string" }
        },
        required: ["incident_id", "status"]
      }
    },
    {
      name: "get_repository_context",
      description: "Get relevant context from the repository for fixing",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string" },
          file_path: { type: "string" }
        },
        required: ["repo"]
      }
    }
  ]
}));

mcpServer.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case "get_pending_incidents":
      return {
        content: [{
          type: "text",
          text: JSON.stringify(
            Array.from(incidents.values())
              .filter(i => i.status === "pending")
          )
        }]
      };
      
    case "get_incident_details":
      const incident = incidents.get(args.incident_id);
      return {
        content: [{
          type: "text", 
          text: JSON.stringify(incident || { error: "Not found" })
        }]
      };
      
    case "report_fix_status":
      const inc = incidents.get(args.incident_id);
      if (inc) {
        inc.status = args.status;
        inc.pr_url = args.pr_url;
        inc.fixed_at = new Date().toISOString();
        // Notify dashboard via webhook
        await notifyDashboard(inc);
      }
      return { content: [{ type: "text", text: "Status updated" }] };
      
    case "get_repository_context":
      // In real implementation, fetch from GitHub API
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            recent_commits: [],
            related_files: [],
            dependencies: []
          })
        }]
      };
  }
});

// Express API for Kestra integration
const app = express();
app.use(express.json());

app.post("/incidents", (req, res) => {
  const incident: Incident = {
    id: `inc-${Date.now()}`,
    status: "pending",
    created_at: new Date().toISOString(),
    ...req.body
  };
  incidents.set(incident.id, incident);
  res.json({ id: incident.id, status: "queued" });
});

app.get("/incidents/:id", (req, res) => {
  const incident = incidents.get(req.params.id);
  res.json(incident || { error: "Not found" });
});

// Start both servers
async function main() {
  // MCP over stdio for Cline
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  
  // REST API for Kestra
  app.listen(3001, () => console.log("API on :3001"));
}

main();
```

**Cline MCP Configuration:**

```json
// ~/.config/cline/mcp_settings.json
{
  "mcpServers": {
    "devops-healer": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "DASHBOARD_URL": "http://localhost:3000"
      }
    }
  }
}
```

---

### 4. Mission Control Dashboard (The Face)

**Purpose:** Real-time visualization of the self-healing system in action.

**Component Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APPLICATION                           │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      PAGES                                 │  │
│  │                                                            │  │
│  │  /                    - Dashboard home                     │  │
│  │  /incidents           - Incident list + details            │  │
│  │  /timeline            - Visual timeline of events          │  │
│  │  /demo                - Demo trigger panel                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    COMPONENTS                              │  │
│  │                                                            │  │
│  │  <LiveLogStream />     - WebSocket-powered log viewer      │  │
│  │  <IncidentCard />      - Individual incident display       │  │
│  │  <SystemHealth />      - Health indicators                 │  │
│  │  <FixTimeline />       - Animated fix progress             │  │
│  │  <PRPreview />         - GitHub PR embed                   │  │
│  │  <DemoTrigger />       - Button to inject test incidents   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    API ROUTES                              │  │
│  │                                                            │  │
│  │  /api/events          - SSE endpoint for real-time         │  │
│  │  /api/incidents       - CRUD for incidents                 │  │
│  │  /api/trigger-demo    - Inject demo incident               │  │
│  │  /api/kestra-webhook  - Receive Kestra notifications       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    STATE (Zustand)                         │  │
│  │                                                            │  │
│  │  incidents: Incident[]                                     │  │
│  │  logs: LogEntry[]                                          │  │
│  │  systemStatus: 'healthy' | 'degraded' | 'critical'         │  │
│  │  activeFlows: FlowExecution[]                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Dashboard Features:**

```tsx
// app/page.tsx - Main Dashboard
export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      
      <main className="container mx-auto p-6 grid grid-cols-12 gap-6">
        {/* System Status Banner */}
        <div className="col-span-12">
          <SystemHealthBanner />
        </div>
        
        {/* Live Activity Feed */}
        <div className="col-span-8">
          <Card title="Live Activity">
            <LiveLogStream />
          </Card>
        </div>
        
        {/* Quick Stats */}
        <div className="col-span-4 space-y-4">
          <StatsCard 
            title="Incidents Today" 
            value={stats.incidentsToday}
            trend={stats.trend}
          />
          <StatsCard 
            title="Auto-Fixed" 
            value={stats.autoFixed}
            subtitle="Without human intervention"
          />
          <StatsCard 
            title="Avg Fix Time" 
            value={`${stats.avgFixTime}s`}
          />
        </div>
        
        {/* Active Incidents */}
        <div className="col-span-12">
          <Card title="Active Incidents">
            <IncidentTimeline incidents={activeIncidents} />
          </Card>
        </div>
        
        {/* Recent PRs */}
        <div className="col-span-6">
          <Card title="Generated PRs">
            <PRList prs={recentPRs} />
          </Card>
        </div>
        
        {/* Demo Controls */}
        <div className="col-span-6">
          <Card title="Demo Controls">
            <DemoTriggerPanel />
          </Card>
        </div>
      </main>
    </div>
  );
}
```

---

### 5. CodeRabbit Integration

**Purpose:** AI review of AI-generated PRs (compelling narrative).

**Setup:**

```yaml
# .coderabbit.yaml in target repository
reviews:
  auto_review:
    enabled: true
    drafts: true  # Review even draft PRs
    
  path_filters:
    - "!*.md"  # Skip markdown
    
  tools:
    shellcheck:
      enabled: true
    ruff:
      enabled: true
      
chat:
  auto_reply: true
```

**Integration Flow:**

```
Cline generates fix
        │
        ▼
Creates PR on GitHub
        │
        ▼
CodeRabbit webhook triggers ◄─── Automatic
        │
        ▼
CodeRabbit reviews PR
        │
        ▼
Posts review comments
        │
        ├── If issues found ──► Dashboard shows "AI caught AI bug"
        │                        (Great demo moment!)
        │
        └── If approved ──► Auto-merge or notify
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE DATA FLOW                                  │
│                                                                               │
│   [1] INCIDENT SOURCE                                                         │
│   ┌─────────────┐                                                            │
│   │ Demo Button │──┐                                                         │
│   │ or Webhook  │  │                                                         │
│   │ or Poll     │  │                                                         │
│   └─────────────┘  │                                                         │
│                    │                                                         │
│   [2] KESTRA       ▼                                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │   Normalize ──► AI Analyze ──► Route ──► Execute                    │   │
│   │       │             │            │           │                       │   │
│   │       │             │            │           │                       │   │
│   └───────│─────────────│────────────│───────────│───────────────────────┘   │
│           │             │            │           │                           │
│   [3]     │     [4]     ▼            │   [6]     ▼                           │
│           │   ┌──────────────┐       │   ┌──────────────┐                    │
│           │   │  OUMI MODEL  │       │   │  MCP SERVER  │                    │
│           │   │              │       │   │              │                    │
│           │   │ Classify &   │       │   │ Queue        │                    │
│           │   │ Summarize    │       │   │ Incident     │                    │
│           │   └──────────────┘       │   └──────┬───────┘                    │
│           │                          │          │                            │
│   [5]     │                          │   [7]    ▼                            │
│           │                          │   ┌──────────────┐                    │
│           │                          │   │    CLINE     │                    │
│           │                          │   │              │                    │
│           │                          │   │ Read context │                    │
│           │                          │   │ Generate fix │                    │
│           │                          │   │ Create PR    │                    │
│           │                          │   └──────┬───────┘                    │
│           │                          │          │                            │
│           │                          │   [8]    ▼                            │
│           │                          │   ┌──────────────┐                    │
│           │                          │   │   GITHUB     │                    │
│           │                          │   │              │                    │
│           │                          │   │ PR Created   │──► CodeRabbit     │
│           │                          │   └──────┬───────┘    Reviews         │
│           │                          │          │                            │
│           │                          │   [9]    ▼                            │
│   ┌───────▼──────────────────────────▼──────────▼────────────────────────┐   │
│   │                         DASHBOARD                                     │   │
│   │                                                                       │   │
│   │   • Real-time log stream                                             │   │
│   │   • Incident timeline                                                │   │
│   │   • PR status                                                        │   │
│   │   • CodeRabbit review results                                        │   │
│   └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4-Day Implementation Schedule

### Day 1: Foundation (Core Loop)

**Goal:** Working demo of log → analysis → notification

| Time | Task | Deliverable |
|------|------|-------------|
| Morning | Set up development environment | Docker, Node.js, Python, Kestra running |
| Morning | Create demo log generator | Python script with 10 log templates |
| Afternoon | Basic Kestra flow | Ingest → Log → Notify working |
| Afternoon | Scaffold Next.js dashboard | Basic page with hardcoded data |
| Evening | Connect Kestra → Dashboard | WebSocket/SSE events flowing |

**Day 1 Checkpoint:** Can trigger demo log → see it appear in dashboard

### Day 2: Intelligence (Oumi + Kestra AI)

**Goal:** AI classification working end-to-end

| Time | Task | Deliverable |
|------|------|-------------|
| Morning | Prepare training dataset | 500+ labeled log examples |
| Morning | Configure Oumi, start training | LoRA fine-tune on Llama-3-8B |
| Afternoon | Deploy Oumi model | API endpoint for inference |
| Afternoon | Integrate Kestra AI Agent | Flow uses Oumi for analysis |
| Evening | Dashboard shows AI analysis | Severity, category, summary displayed |

**Day 2 Checkpoint:** Log → AI classifies → Dashboard shows analysis

### Day 3: Automation (Cline MCP + GitHub)

**Goal:** Autonomous PR generation working

| Time | Task | Deliverable |
|------|------|-------------|
| Morning | Build MCP Server | 4 tools implemented |
| Morning | Configure Cline MCP | Cline can call your tools |
| Afternoon | GitHub integration | PR creation from Cline |
| Afternoon | CodeRabbit setup | Auto-review on PRs |
| Evening | End-to-end test | Incident → PR → Review |

**Day 3 Checkpoint:** Incident → Cline generates PR → CodeRabbit reviews

### Day 4: Polish (Demo Ready)

**Goal:** Impressive demo, deployed, documented

| Time | Task | Deliverable |
|------|------|-------------|
| Morning | Dashboard polish | Animations, responsive, dark mode |
| Morning | Deploy to Vercel | Production URL |
| Afternoon | Demo script | 5 scenarios that work perfectly |
| Afternoon | Record video backup | In case live demo fails |
| Evening | README + submission | Clear docs, screenshots, video |

**Day 4 Checkpoint:** Can run 5-minute demo flawlessly

---

## Risk Mitigation

### Critical Risks and Fallbacks

| Risk | Probability | Fallback |
|------|-------------|----------|
| Oumi training fails | Medium | Use Claude API with SRE prompt |
| Cline MCP integration broken | Medium | Manual CLI trigger, show architecture |
| Kestra AI Agent issues | Low | Direct API call in Python task |
| GitHub API rate limits | Low | Pre-created PRs for demo |
| Live demo fails | Medium | Pre-recorded video ready |

### "Demo Mode" Architecture

Build a parallel demo mode that doesn't depend on real integrations:

```typescript
// Enable with ?demo=true query param
const DEMO_MODE = process.env.DEMO_MODE === 'true';

if (DEMO_MODE) {
  // Use pre-scripted responses
  // Fake delays for realism
  // Show "real" PR that was pre-created
}
```

---

## Prize-Winning Narrative

### Pitch Structure (2 minutes)

1. **Problem** (15s): "Infrastructure incidents at 3 AM cost companies $X/hour. Manual response is slow and error-prone."

2. **Solution** (30s): "We built an autonomous SRE agent. It watches your infrastructure, understands errors using a custom-trained model, and fixes them before you wake up."

3. **Demo** (60s): Trigger incident → Show AI classification → Watch PR get created → CodeRabbit review → Dashboard updates

4. **Tech Stack** (15s): "Oumi for specialized model training, Kestra for orchestration, Cline with custom MCP for code generation, all visualized on Vercel."

### Key Demo Moments

- **"AI training AI"**: Show Oumi dashboard with training metrics
- **"AI orchestrating AI"**: Kestra flow visualization
- **"AI coding autonomously"**: Cline generating a PR in real-time
- **"AI checking AI"**: CodeRabbit catching an issue

---

## File Structure

```
self-healing-devops/
├── README.md
├── docker-compose.yml
│
├── oumi/
│   ├── config.yaml
│   ├── train.py
│   └── data/
│       ├── sre_train.jsonl
│       └── sre_eval.jsonl
│
├── kestra/
│   ├── docker-compose.yml
│   └── flows/
│       ├── main-orchestrator.yml
│       └── auto-fix-workflow.yml
│
├── mcp-server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── tools/
│       │   ├── incidents.ts
│       │   └── repository.ts
│       └── types.ts
│
├── dashboard/
│   ├── package.json
│   ├── next.config.js
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── incidents/
│   │   └── api/
│   │       ├── events/route.ts
│   │       └── trigger-demo/route.ts
│   └── components/
│       ├── LiveLogStream.tsx
│       ├── IncidentCard.tsx
│       └── DemoTrigger.tsx
│
├── demo/
│   ├── log-generator.py
│   ├── scenarios/
│   │   ├── database-crash.json
│   │   ├── memory-leak.json
│   │   └── auth-failure.json
│   └── target-repo/           # Repo where PRs get created
│       ├── config/
│       └── src/
│
└── docs/
    ├── architecture.md
    ├── setup.md
    └── demo-script.md
```

---

## Quick Start Commands

```bash
# Day 1: Start infrastructure
docker-compose up -d kestra postgres

# Day 2: Train model
cd oumi && python train.py --config config.yaml

# Day 3: Start MCP server
cd mcp-server && npm run dev

# Day 4: Deploy dashboard
cd dashboard && vercel --prod

# Demo: Trigger test incident
curl -X POST http://localhost:8080/api/v1/webhooks/incident-webhook \
  -H "Content-Type: application/json" \
  -d '{"log": "ERROR: Connection pool exhausted", "source": "postgresql"}'
```

---

This architecture gives you a compelling, demonstrable system that touches all sponsor technologies meaningfully while being achievable solo in 4 days. The key is having fallbacks ready and a polished demo script.
