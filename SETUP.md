# 🚀 Self-Healing DevOps Orchestrator - Setup Guide

This guide will walk you through setting up the complete Self-Healing DevOps Orchestrator system for development and demonstration.

## 📋 Prerequisites

### System Requirements
- **Windows/Linux/Mac** with modern terminal
- **Docker & Docker Compose** - for running infrastructure
- **Node.js 18+** - for dashboard and MCP server
- **Python 3.10+** - for Oumi training and utilities
- **Git** - for version control
- **GitHub Account** - for PR creation and CodeRabbit

### Environment Variables
```bash
# Create .env file from template
cp .env.example .env

# Edit with your actual values
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_github_username
GITHUB_REPO=self-healing-demo-target
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## 🛠️ Installation Steps

### Step 1: Clone and Setup Repository
```bash
# Clone the repository
git clone <your-repo-url>
cd DevOps\ Orches

# Install root dependencies if any
npm install
```

### Step 2: Start Infrastructure (Kestra, PostgreSQL, MCP Server, Dashboard)
```bash
# Start all Docker services
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs if needed
docker-compose logs kestra
docker-compose logs mcp-server
docker-compose logs dashboard
```

### Step 3: Setup Dashboard (Next.js)
```bash
cd dashboard

# Install dependencies
npm install

# Start development server
npm run dev

# Verify dashboard at http://localhost:3000
```

### Step 4: Setup MCP Server
```bash
cd ../mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Test server (should already be running via Docker)
curl http://localhost:3001/health
```

### Step 5: Optional - Train Oumi Model
```bash
cd ../oumi

# Create Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Oumi and dependencies
pip install -r requirements.txt

# Train the model (this takes time, can skip for demo)
python train.py --config config.yaml --hf-token YOUR_HF_TOKEN

# Deactivate virtual environment
deactivate
```

### Step 6: Configure Cline MCP Integration
```bash
# Edit your Cline MCP settings file
code ~/.config/cline/mcp_settings.json

# Add the devops-healer MCP server:
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

### Step 7: Setup Target Repository for CodeRabbit
```bash
# Create a target repository on GitHub for testing fixes
# Name it "self-healing-demo-target"

# Copy the CodeRabbit configuration
cp .coderabbit.yaml /path/to/your/target-repo/.coderabbit.yaml

# Install CodeRabbit on the target repository via GitHub Marketplace
# Configure the webhook URL to point to your CodeRabbit instance
```

## 🧪 Testing Setup

### Quick Service Check
```bash
# Run basic service tests
./scripts/test-end-to-end.sh services
```

### Full End-to-End Test
```bash
# Run complete test suite
./scripts/test-end-to-end.sh full
```

### Generate Demo Data
```bash
# Generate test logs
cd demo
python log-generator.py --scenario database_crash --count 5 --output test-incidents.jsonl
```

## 🎯 Demo Execution

### 1. Start All Services
```bash
# Make sure everything is running
docker-compose up -d
cd dashboard && npm run dev
```

### 2. Open Dashboard
- Visit http://localhost:3000
- Check that all systems are healthy
- Review the live activity stream

### 3. Trigger Demo Incident
- Click "Trigger Demo Incident" button on dashboard
- Or use API directly:
```bash
curl -X POST http://localhost:3000/api/trigger-demo \
  -H "Content-Type: application/json" \
  -d '{"log": "CRITICAL: Connection pool exhausted - max_connections=100 exceeded", "source": "postgresql"}'
```

### 4. Monitor the Flow
1. **Kestra Analysis**: Check http://localhost:8080 for workflow execution
2. **Dashboard Updates**: Watch live incident details and status
3. **Cline Notification**: (In real demo) Cline will notify about pending incidents
4. **PR Creation**: (In real demo) Watch GitHub for automated PR creation
5. **CodeRabbit Review**: (In real demo) AI reviews the AI-generated fixes

### 5. Manual Cline Interaction (for full demo)
1. Open your IDE with Cline
2. Ask Cline: "Check for pending DevOps incidents and fix them"
3. Cline will use MCP tools to:
   - `get_pending_incidents()` - Find active incidents
   - `get_incident_details(incident_id)` - Get full context
   - `get_repository_context()` - Understand codebase
   - Generate and apply fixes
   - `report_fix_status()` - Report completion
4. Watch the dashboard update with fix status

## 🔧 Troubleshooting

### Common Issues

**Kestra not starting:**
```bash
docker-compose logs kestra
# Check PostgreSQL connection and configuration
```

**MCP Server connection issues:**
```bash
docker-compose logs mcp-server
curl http://localhost:3001/health
```

**Dashboard not loading:**
```bash
cd dashboard
npm install  # Ensure dependencies
npm run dev
```

**Oumi training fails:**
```bash
# Check HF token availability
echo $HF_TOKEN
# Verify CUDA availability if using GPU
nvidia-smi
```

**CodeRabbit not reviewing:**
- Ensure webhook is configured in target repository
- Check CodeRabbit dashboard for webhook events
- Verify PR is created (not just draft)

### Log Files to Check
- `docker-compose logs` - Container logs
- MCP server logs in terminal
- Kestra execution logs at http://localhost:8080
- Dashboard network tab in browser developer tools

### Service URLs
- **Dashboard**: http://localhost:3000
- **Kestra**: http://localhost:8080
- **MCP Server**: http://localhost:3001
- **PostgreSQL**: localhost:5432

## 🎊 Success Criteria

Your system is ready when:
- ✅ All Docker containers are running (`docker-compose ps`)
- ✅ Dashboard loads at http://localhost:3000
- ✅ Kestra responds at http://localhost:8080
- ✅ MCP health check passes (`curl http://localhost:3001/health`)
- ✅ Demo incident creation works
- ✅ Live activity stream shows real-time updates

## 🚀 Production Deployment

### Vercel Deployment (Dashboard)
```bash
cd dashboard
npm install -g vercel
vercel --prod
# Follow Vercel prompts to configure environment variables
```

### Infrastructure Scaling
- Use managed PostgreSQL (AWS RDS, Google Cloud SQL)
- Deploy Kestra to Kubernetes
- Configure monitoring and alerting
- Set up load balancers and auto-scaling

## 📚 Additional Resources

- [Self-Healing DevOps Architecture](./self-healing-devops-architecture.md)
- [API Documentation](./docs/api.md)
- [Demo Scripts](./demo/README.md)
- [Kestra Documentation](https://kestra.io/docs)
- [Oumi Documentation](https://oumi.ai/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

🎯 **Ready to demonstrate autonomous DevOps? Trigger your first incident and watch the system heal itself!**
