# Real-World Log Monitoring

This module provides real-world log monitoring capabilities for the Self-Healing DevOps Orchestrator.

## Installation

```bash
cd monitoring
pip install -r requirements.txt
```

## Usage

### Watch a single log file

```bash
python log-watcher.py --mode file --path /var/log/syslog
python log-watcher.py --mode file --path /var/log/nginx/error.log
```

### Watch all logs in a directory

```bash
python log-watcher.py --mode directory --path /var/log/myapp --pattern "*.log"
python log-watcher.py --mode directory --path /var/log --pattern "*.err"
```

### Watch Docker containers

```bash
python log-watcher.py --mode docker --containers my-app,my-api,postgres
```

### Watch Windows Event Log

```bash
python log-watcher.py --mode windows
```

### Watch systemd journal (Linux)

```bash
# Watch all units
python log-watcher.py --mode systemd

# Watch specific units
python log-watcher.py --mode systemd --units nginx,postgresql,docker
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KESTRA_WEBHOOK_URL` | `http://localhost:8080/api/v1/webhooks/incident-webhook` | Kestra webhook endpoint |
| `MCP_SERVER_URL` | `http://localhost:3001` | MCP server URL |
| `API_KEY` | (empty) | API key for authentication |
| `MONITOR_INTERVAL` | `5` | Polling interval in seconds |

### Command Line Options

| Option | Description |
|--------|-------------|
| `--mode` | Watching mode: file, directory, docker, windows, systemd |
| `--path` | File or directory path (for file/directory modes) |
| `--pattern` | Glob pattern for directory mode (default: *.log) |
| `--containers` | Comma-separated container names (for docker mode) |
| `--units` | Comma-separated systemd units (for systemd mode) |
| `--kestra-url` | Override Kestra webhook URL |
| `--mcp-url` | Override MCP server URL |
| `--interval` | Polling interval in seconds |

## Detected Patterns

The watcher includes built-in patterns for common infrastructure issues:

### Database
- PostgreSQL connection pool exhausted
- MySQL connection errors
- Database timeouts

### Memory
- Out of memory (OOM) errors
- High memory usage warnings

### Disk
- Disk full errors
- Low disk space warnings

### Network
- Connection refused
- Network timeouts
- DNS failures
- SSL certificate issues

### Authentication
- Authentication failures
- Permission denied errors

### Application
- Uncaught exceptions
- Container crashes (Kubernetes)
- Service unavailability

## Adding Custom Patterns

Edit `log-watcher.py` and add patterns to `DEFAULT_PATTERNS`:

```python
LogPattern(
    name="custom_error",
    pattern=r"your-regex-pattern",
    severity="critical",  # critical, high, medium, low
    category="application",  # database, network, memory, disk, auth, application
    suggested_fix="How to fix this issue"
)
```

## Example: Production Setup

```bash
# Create a systemd service file
sudo tee /etc/systemd/system/log-watcher.service << EOF
[Unit]
Description=Self-Healing DevOps Log Watcher
After=network.target

[Service]
Type=simple
User=devops
Environment=KESTRA_WEBHOOK_URL=http://kestra:8080/api/v1/webhooks/incident-webhook
Environment=MCP_SERVER_URL=http://mcp-server:3001
Environment=API_KEY=your-api-key
ExecStart=/usr/bin/python3 /opt/self-healing/monitoring/log-watcher.py --mode directory --path /var/log/myapp
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl enable log-watcher
sudo systemctl start log-watcher
```
