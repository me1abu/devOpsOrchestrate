# Demo Scripts for Self-Healing DevOps Orchestrator

This directory contains all the demo materials and scripts needed to showcase the Self-Healing DevOps Orchestrator system.

## Files

- `log-generator.py` - Generates realistic infrastructure logs for demo scenarios
- `target-repo/` - Sample repository that will be automatically fixed during demos
- `README.md` - This file

## Usage

### Generate Demo Logs

Generate random logs:
```bash
python3 log-generator.py --count 20 --output demo-logs.jsonl
```

Generate specific incident scenario:
```bash
python3 log-generator.py --scenario database_crash --count 10 --output database-crash.jsonl
python3 log-generator.py --scenario memory_leak --count 10 --output memory-leak.jsonl
python3 log-generator.py --scenario auth_outage --count 10 --output auth-outage.jsonl
```

### Available Scenarios

- `database_crash` - Connection pool exhaustion issues
- `memory_leak` - High memory usage problems
- `disk_full` - Disk space exhaustion
- `auth_outage` - Authentication service failures
- `network_issue` - Network connectivity problems
- `ssl_expiry` - SSL certificate expiration warnings

### Demo Flow

1. **Setup System**
   ```bash
   # Start all services
   docker-compose up -d

   # Start dashboard
   cd dashboard && npm run dev
   ```

2. **Generate Incident**
   ```bash
   # Generate a critical database incident
   python3 log-generator.py --scenario database_crash --output incident.jsonl

   # Extract one log line for demo
   head -n 1 incident.jsonl | jq -r .message
   ```

3. **Trigger Demo Incident**
   - Open dashboard at http://localhost:3000
   - Click "Trigger Demo" button
   - Or use API:
   ```bash
   curl -X POST http://localhost:3000/api/trigger-demo \
     -H "Content-Type: application/json" \
     -d '{"log": "FATAL: Connection pool exhausted - max_connections=100 exceeded", "source": "postgresql"}'
   ```

4. **Watch the System Work**
   - Kestra will analyze the log
   - Dashboard updates with incident details
   - Cline gets notified (in real demo)
   - CodeRabbit reviews generated PR (in real demo)

### Expected Demo Sequence

1. Log ingestion → Kestra workflow triggered
2. AI analysis (Claude/Oumi) → Classified as critical database issue
3. Decision router → Auto-fix workflow triggered
4. Cline notification → (Human) open IDE and ask Cline to check incidents
5. Cline fixes config → Updates database.yml max_connections from 100 to 200
6. GitHub PR created → Submitted with fix description
7. CodeRabbit review → AI checks the AI-generated fix
8. Dashboard updates → Shows completed fix and PR link

## Target Repository

The `target-repo/` directory contains a sample application that demonstrates the fixes:

- `config/database.yml` - Database configuration that gets modified
- Initially has `max_connections: 100`
- Auto-fix changes it to `max_connections: 200`

## Customization

Edit the log templates in `log-generator.py` to create custom scenarios for your demo.

## Troubleshooting

- If Kestra is not running: `docker-compose logs kestra`
- If MCP server issues: `docker-compose logs mcp-server`
- Dashboard not loading: Check Node.js version and dependencies
- Demo incidents not triggering: Verify webhook URLs in configuration
