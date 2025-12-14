# 🔧 Self-Healing DevOps Orchestrator

<div align="center">

![Self-Healing DevOps](https://img.shields.io/badge/DevOps-Self--Healing-blueviolet?style=for-the-badge&logo=kubernetes)
![AI Powered](https://img.shields.io/badge/AI-Powered-orange?style=for-the-badge&logo=openai)
![Hackathon](https://img.shields.io/badge/Hackathon-2025-success?style=for-the-badge)

**Autonomous incident detection, AI-powered analysis, and self-healing code generation.**

*Zero human intervention from alert to pull request.*

[Live Dashboard](https://autosre.vercel.app) • [Demo Video](#-demo) • [Architecture](#-architecture) • [Quick Start](#-quick-start)

</div>

---

## 🎯 The Problem

DevOps teams are drowning:

- **500+ alerts daily** - Most are noise, but critical ones hide in the chaos
- **Hours spent diagnosing** - Manually correlating logs, metrics, and traces
- **Repetitive fixes** - The same issues require the same solutions
- **Human bottleneck** - Engineers are the single point of failure at 3 AM

**What if infrastructure could heal itself?**

---

## 💡 The Solution

An **autonomous agent** that:

1. 🔍 **Detects** infrastructure incidents in real-time
2. 🧠 **Analyzes** root causes using AI-powered log analysis
3. 🔧 **Generates** code fixes automatically via agentic workflows
4. 📝 **Submits** pull requests for review
5. ✅ **Validates** changes with AI-powered code review

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Incident  │────▶│   Kestra    │────▶│  Cline MCP  │────▶│  GitHub PR  │
│  Detection  │     │ Orchestrator│     │  Auto-Fix   │     │  + Review   │
└─────────────┘     └──────┬──────┘     └─────────────┘     └─────────────┘
                          │
                    ┌─────▼─────┐
                    │    AI     │
                    │ Analysis  │
                    └───────────┘
```

---

## 🏆 Hackathon Prize Tracks

This project targets **$15,000** across 5 sponsor tracks:

| Sponsor | Prize | Integration |
|---------|-------|-------------|
| **Kestra** | $4,000 | Workflow orchestration with AI Agent plugin |
| **Cline** | $5,000 | Custom MCP Server for autonomous code generation |
| **Oumi** | $3,000 | Fine-tuned SRE-LLM for log analysis |
| **Vercel** | $2,000 | Real-time mission control dashboard |
| **CodeRabbit** | $1,000 | AI-powered PR reviews of generated fixes |

---

## 🏗️ Architecture

```
                            ┌──────────────────────────────────────────┐
                            │           SELF-HEALING PIPELINE          │
                            └──────────────────────────────────────────┘

    ┌─────────────┐         ┌─────────────────────────────────────────────────────┐
    │             │         │                                                     │
    │  Log Source │────────▶│  ┌─────────┐    ┌─────────┐    ┌──────────────┐   │
    │  (Webhook)  │         │  │ Kestra  │───▶│   AI    │───▶│  Severity    │   │
    │             │         │  │ Trigger │    │ Analysis│    │  Router      │   │
    └─────────────┘         │  └─────────┘    └─────────┘    └──────┬───────┘   │
                            │                                       │           │
                            │            ┌──────────────────────────┴───┐       │
                            │            ▼                              ▼       │
                            │  ┌─────────────────┐          ┌────────────────┐  │
                            │  │  HIGH/CRITICAL  │          │   LOW/MEDIUM   │  │
                            │  │  ┌───────────┐  │          │                │  │
                            │  │  │ MCP Server│  │          │  Log & Alert   │  │
                            │  │  │  (Cline)  │  │          │                │  │
                            │  │  └─────┬─────┘  │          └────────────────┘  │
                            │  │        │        │                              │
                            │  │  ┌─────▼─────┐  │                              │
                            │  │  │ Generate  │  │                              │
                            │  │  │   Fix     │  │                              │
                            │  │  └─────┬─────┘  │                              │
                            │  │        │        │                              │
                            │  │  ┌─────▼─────┐  │                              │
                            │  │  │ Create PR │  │                              │
                            │  │  └─────┬─────┘  │                              │
                            │  └────────┼────────┘                              │
                            │           │                                       │
                            └───────────┼───────────────────────────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │      CodeRabbit       │
                            │    AI Code Review     │
                            └───────────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │    ✅ Merge Ready     │
                            └───────────────────────┘


    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         REAL-TIME DASHBOARD                             │
    │                         (Vercel - Next.js)                              │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
    │  │System Health │  │  Incidents   │  │ Activity Feed│  │   Metrics   │ │
    │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
    └─────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🤖 Autonomous Incident Detection
- Webhook-based ingestion from any monitoring tool
- Real-time log analysis and classification
- Severity-based routing (Critical → Auto-fix, Low → Log only)

### 🧠 AI-Powered Analysis
- Custom SRE-LLM trained on infrastructure patterns
- Root cause identification
- Suggested remediation with confidence scores

### 🔧 Automatic Code Generation
- Cline MCP Server integration for autonomous coding
- Context-aware fixes based on repository structure
- Automatic PR creation with detailed descriptions

### 📊 Real-Time Dashboard
- Live incident tracking
- Activity stream with SSE updates
- System health monitoring
- Demo controls for testing

### ✅ AI Code Review
- CodeRabbit integration for automated PR reviews
- AI reviewing AI-generated code
- Quality gates before merge

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git
- GitHub Account + Personal Access Token
- OpenAI API Key

### Installation

```bash
# Clone the repository
git clone https://github.com/me1abu/devOpsOrchestrate.git
cd devOpsOrchestrate

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Start the infrastructure
docker-compose up -d

# Start the dashboard (development)
cd dashboard
npm install
npm run dev
```

### Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Dashboard | http://localhost:3000 | - |
| Kestra UI | http://localhost:8080 | admin@kestra.io / Kestra123 |
| MCP Server | http://localhost:3001 | - |

---

## 📦 Project Structure

```
devOpsOrchestrate/
├── 📂 dashboard/              # Next.js real-time dashboard
│   ├── app/                   # App router pages
│   ├── components/            # React components
│   └── Dockerfile
│
├── 📂 kestra/flows/           # Kestra workflow definitions
│   ├── main-orchestrator.yml  # Main incident processing flow
│   └── auto-fix-workflow.yml  # Autonomous remediation flow
│
├── 📂 mcp-server/             # Cline MCP Server
│   ├── src/
│   │   ├── index.ts           # Express server + SSE
│   │   └── tools.ts           # MCP tool definitions
│   └── Dockerfile
│
├── 📂 oumi/                   # Oumi model training
│   ├── data/                  # Training data (JSONL)
│   ├── train.py               # Training script
│   └── config.yaml            # Model configuration
│
├── 📂 monitoring/             # Demo monitoring setup
├── 📂 scripts/                # Utility scripts
├── 🐳 docker-compose.yml      # Full stack deployment
└── 📄 README.md
```

---

## 🔌 MCP Server Tools

The MCP Server exposes these tools for Cline integration:

| Tool | Description |
|------|-------------|
| `get_pending_incidents()` | Fetch unresolved incidents |
| `get_incident_details(id)` | Get full incident context |
| `get_repository_context()` | Understand codebase structure |
| `apply_fix(incident_id, fix)` | Apply generated fix |
| `create_pull_request(...)` | Create GitHub PR |
| `report_fix_status(...)` | Update incident status |

### API Endpoints

```
GET  /              # API documentation
GET  /health        # Health check
GET  /events        # SSE stream for real-time updates
GET  /incidents     # List all incidents
POST /incidents     # Create new incident
GET  /incidents/:id # Get incident details
PATCH /incidents/:id # Update incident
GET  /stats         # Get statistics
```

---

## 🎬 Demo

### Live Deployment

- **Dashboard**: [autosre.vercel.app](https://autosre.vercel.app)
- **MCP Server**: [mcp-server-deploy.up.railway.app](https://mcp-server-deploy.up.railway.app)

### Demo Video

[📺 Watch the 3-minute demo](#) *(Coming soon)*

### Trigger a Demo Incident

```bash
curl -X POST https://mcp-server-deploy.up.railway.app/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "critical",
    "category": "database",
    "summary": "Connection pool exhausted",
    "description": "FATAL: max_connections=100 exceeded",
    "source": "postgresql"
  }'
```

---

## 🛠️ Sponsor Technology Deep Dive

### Kestra - Workflow Orchestration

```yaml
# Example: Main orchestrator flow
id: self-healing-orchestrator
namespace: devops.healing

tasks:
  - id: analyze-incident
    type: io.kestra.plugin.scripts.python.Script
    script: |
      # AI-powered log analysis
      # Severity classification
      # Root cause identification

  - id: trigger-autofix
    type: io.kestra.plugin.core.flow.If
    condition: "{{ severity == 'critical' }}"
    then:
      - id: call-mcp-server
        type: io.kestra.plugin.core.http.Request
        uri: "{{ mcp_server_url }}/fix"
```

### Cline - MCP Server Integration

```typescript
// MCP tools for autonomous code generation
const tools = [
  {
    name: "get_pending_incidents",
    description: "Fetch incidents awaiting fixes",
    handler: async () => await db.getIncidents({ status: "pending" })
  },
  {
    name: "create_pull_request",
    description: "Create a GitHub PR with the fix",
    handler: async ({ title, body, branch }) => {
      return await github.createPR({ title, body, branch });
    }
  }
];
```

### Oumi - Custom SRE Model

```python
# Training data format
{
  "input": "FATAL: Connection pool exhausted - max_connections=100 exceeded",
  "output": {
    "severity": "critical",
    "category": "database",
    "root_cause": "Connection pool limit reached",
    "suggested_fix": "Increase max_connections or implement connection pooling"
  }
}
```

### Vercel - Dashboard Deployment

- Next.js 14 with App Router
- Real-time updates via Server-Sent Events
- Responsive design with Tailwind CSS

### CodeRabbit - AI Code Review

```yaml
# .coderabbit.yaml
reviews:
  auto_review:
    enabled: true
  path_filters:
    - "!**/*.md"
  tools:
    github-checks:
      enabled: true
```

---

## 🔮 Future Roadmap

- [ ] **Multi-cloud support** - AWS, GCP, Azure integrations
- [ ] **Slack/PagerDuty integration** - Alert routing
- [ ] **Learning from feedback** - Improve fixes based on PR reviews
- [ ] **Rollback automation** - Auto-revert failed deployments
- [ ] **Cost optimization** - Infrastructure right-sizing recommendations

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

```bash
# Fork the repo
# Create your feature branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m 'Add amazing feature'

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 👤 Author

**Abu**

- GitHub: [@me1abu](https://github.com/me1abu)

---

<div align="center">

### ⭐ Star this repo if you find it useful!

**Built with ❤️ for the AI Hackathon 2025**

*"The best incident is the one that fixes itself."*

</div>