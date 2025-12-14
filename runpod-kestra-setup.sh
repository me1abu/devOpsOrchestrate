#!/bin/bash
# RunPod Kestra Deployment Script
# Run this after SSH-ing into your RunPod instance

set -e

echo "=== Installing Docker ==="
apt-get update
apt-get install -y docker.io docker-compose curl git

echo "=== Starting Docker ==="
systemctl start docker || service docker start

echo "=== Creating Kestra Directory ==="
mkdir -p /workspace/kestra
cd /workspace/kestra

echo "=== Creating docker-compose.yml ==="
cat > docker-compose.yml << 'EOF'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kestra
      POSTGRES_USER: kestra
      POSTGRES_PASSWORD: k3str4
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kestra"]
      interval: 10s
      timeout: 5s
      retries: 5

  kestra:
    image: kestra/kestra:latest
    pull_policy: always
    entrypoint: /bin/bash
    command:
      - -c
      - /app/kestra server standalone --worker-thread=64
    volumes:
      - kestra-data:/app/storage
      - ./flows:/app/flows
      - /var/run/docker.sock:/var/run/docker.sock
      - /tmp/kestra-wd:/tmp/kestra-wd
    environment:
      # Reduced memory settings for RunPod
      JAVA_OPTS: "-Xms512m -Xmx2g -XX:+UseG1GC"
      KESTRA_CONFIGURATION: |
        datasources:
          postgres:
            url: jdbc:postgresql://postgres:5432/kestra
            driverClassName: org.postgresql.Driver
            username: kestra
            password: k3str4
        kestra:
          server:
            basic-auth:
              enabled: true
              username: admin@kestra.io
              password: Kestra123
          repository:
            type: postgres
          storage:
            type: local
            local:
              base-path: "/app/storage"
          queue:
            type: postgres
          tasks:
            tmp-dir:
              path: /tmp/kestra-wd/tmp
          url: http://0.0.0.0:8080/
    ports:
      - "8080:8080"
      - "8081:8081"
    depends_on:
      postgres:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 3G

volumes:
  kestra-data:
  postgres-data:
EOF

echo "=== Creating flows directory ==="
mkdir -p flows

echo "=== Creating main-orchestrator.yml ==="
cat > flows/main-orchestrator.yml << 'EOF'
id: self-healing-orchestrator
namespace: devops.healing
description: Main orchestration flow for incident detection and auto-fix

variables:
  mcp_server_url: "https://mcp-server-deploy.up.railway.app"
  dashboard_url: "https://autosre.vercel.app"

triggers:
  - id: webhook-trigger
    type: io.kestra.plugin.core.trigger.Webhook
    key: "incident-webhook"

inputs:
  - id: log_source
    type: STRING
    defaults: "demo"
  - id: raw_log
    type: STRING
    defaults: ""
  - id: severity
    type: STRING
    defaults: ""
  - id: category
    type: STRING
    defaults: ""
  - id: summary
    type: STRING
    defaults: ""
  - id: suggested_fix
    type: STRING
    defaults: ""

tasks:
  - id: normalize-input
    type: io.kestra.plugin.scripts.python.Script
    containerImage: python:3.11-slim
    script: |
      import json
      import random
      from datetime import datetime

      raw_log = """{{ inputs.raw_log }}""".strip()
      log_source = """{{ inputs.log_source }}""".strip()

      demo_logs = [
        {"message": "FATAL: Connection pool exhausted - max_connections=100 exceeded", "source": "postgresql"},
        {"message": "ERROR: Memory usage exceeded 95% threshold on node-3", "source": "prometheus"},
        {"message": "CRITICAL: Auth service returning 503 - unable to validate tokens", "source": "auth-service"}
      ]

      if not raw_log:
        selected_log = random.choice(demo_logs)
        raw_log = selected_log["message"]
        log_source = selected_log["source"]

      normalized = {
        "timestamp": datetime.now().isoformat(),
        "source": log_source or "unknown",
        "message": raw_log,
        "raw": raw_log
      }
      print(json.dumps(normalized))

  - id: analyze-incident
    type: io.kestra.plugin.scripts.python.Script
    containerImage: python:3.11-slim
    script: |
      import json

      provided_severity = """{{ inputs.severity }}""".strip()
      provided_category = """{{ inputs.category }}""".strip()
      provided_summary = """{{ inputs.summary }}""".strip()
      provided_fix = """{{ inputs.suggested_fix }}""".strip()

      if provided_severity and provided_category:
        analysis = {
          "severity": provided_severity,
          "category": provided_category,
          "summary": provided_summary or "Incident detected",
          "suggested_fix": provided_fix or "Manual investigation required",
          "confidence": 0.9
        }
      else:
        log_data = json.loads("""{{ outputs['normalize-input'].vars.stdout }}""")
        message = log_data.get("message", "").lower()

        if "fatal" in message or "critical" in message:
          severity = "critical"
        elif "error" in message:
          severity = "high"
        elif "warn" in message:
          severity = "medium"
        else:
          severity = "low"

        if any(w in message for w in ["database", "postgres", "connection pool"]):
          category = "database"
        elif any(w in message for w in ["memory", "oom"]):
          category = "memory"
        elif any(w in message for w in ["auth", "503"]):
          category = "auth"
        else:
          category = "application"

        analysis = {
          "severity": severity,
          "category": category,
          "summary": log_data.get("message", "")[:100],
          "suggested_fix": "Auto-remediation in progress",
          "confidence": 0.7
        }
      print(json.dumps(analysis))

  - id: create-incident
    type: io.kestra.plugin.core.http.Request
    uri: "{{ vars.mcp_server_url }}/incidents"
    method: POST
    contentType: application/json
    body: |
      {
        "severity": "{{ json(outputs['analyze-incident'].vars.stdout).severity }}",
        "category": "{{ json(outputs['analyze-incident'].vars.stdout).category }}",
        "summary": "{{ json(outputs['analyze-incident'].vars.stdout).summary }}",
        "description": "{{ json(outputs['normalize-input'].vars.stdout).message }}",
        "suggested_fix": "{{ json(outputs['analyze-incident'].vars.stdout).suggested_fix }}",
        "source": "{{ json(outputs['normalize-input'].vars.stdout).source }}",
        "kestra_execution_id": "{{ execution.id }}"
      }

  - id: log-result
    type: io.kestra.plugin.core.log.Log
    message: |
      ✅ Incident created successfully!
      ID: {{ outputs['create-incident'].body }}
      Severity: {{ json(outputs['analyze-incident'].vars.stdout).severity }}

  - id: check-severity
    type: io.kestra.plugin.core.flow.If
    condition: "{{ json(outputs['analyze-incident'].vars.stdout).severity == 'critical' or json(outputs['analyze-incident'].vars.stdout).severity == 'high' }}"
    then:
      - id: trigger-autofix
        type: io.kestra.plugin.core.flow.Subflow
        namespace: devops.healing
        flowId: auto-fix-workflow
        wait: false
        inputs:
          incident_id: "{{ json(outputs['create-incident'].body).id }}"
          severity: "{{ json(outputs['analyze-incident'].vars.stdout).severity }}"
          summary: "{{ json(outputs['analyze-incident'].vars.stdout).summary }}"

errors:
  - id: error-handler
    type: io.kestra.plugin.core.log.Log
    message: "Error in orchestrator: {{ error.message }}"
EOF

echo "=== Creating auto-fix-workflow.yml ==="
cat > flows/auto-fix-workflow.yml << 'EOF'
id: auto-fix-workflow
namespace: devops.healing
description: Autonomous fix workflow triggered for critical/high severity incidents

variables:
  mcp_server_url: "https://mcp-server-deploy.up.railway.app"
  dashboard_url: "https://autosre.vercel.app"

inputs:
  - id: incident_id
    type: STRING
  - id: severity
    type: STRING
  - id: summary
    type: STRING

tasks:
  - id: update-status-processing
    type: io.kestra.plugin.core.http.Request
    uri: "{{ vars.mcp_server_url }}/incidents/{{ inputs.incident_id }}"
    method: PATCH
    contentType: application/json
    body: |
      {"status": "processing"}

  - id: log-cline-trigger
    type: io.kestra.plugin.core.log.Log
    message: |
      🔧 AUTO-FIX TRIGGERED
      Incident: {{ inputs.incident_id }}
      Severity: {{ inputs.severity }}
      Summary: {{ inputs.summary }}
      
      Cline MCP Integration Active - Awaiting fix...

  - id: simulate-fix-delay
    type: io.kestra.plugin.core.flow.Pause
    delay: PT30S

  - id: mark-fixed
    type: io.kestra.plugin.core.http.Request
    uri: "{{ vars.mcp_server_url }}/incidents/{{ inputs.incident_id }}"
    method: PATCH
    contentType: application/json
    body: |
      {
        "status": "fixed",
        "fix_notes": "Auto-remediation completed by Kestra workflow",
        "pr_url": "https://github.com/me1abu/self-healing-demo-target/pull/demo"
      }

  - id: final-log
    type: io.kestra.plugin.core.log.Log
    message: "✅ Auto-fix completed for incident {{ inputs.incident_id }}"

errors:
  - id: error-handler
    type: io.kestra.plugin.core.http.Request
    uri: "{{ vars.mcp_server_url }}/incidents/{{ inputs.incident_id }}"
    method: PATCH
    contentType: application/json
    body: |
      {"status": "failed", "fix_notes": "Auto-fix workflow failed"}
EOF

echo "=== Starting Kestra ==="
docker-compose up -d

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Kestra will be available at: http://<YOUR_RUNPOD_IP>:8080"
echo "Login: admin@kestra.io / Kestra123"
echo ""
echo "To check status: docker-compose logs -f kestra"
echo "To get your public IP: curl ifconfig.me"
