#!/usr/bin/env python3
"""
Real-World Log Watcher for Self-Healing DevOps Orchestrator

This script monitors various log sources and sends detected incidents
to the Kestra orchestration pipeline or directly to the MCP server.

Supported sources:
- System logs (syslog, Windows Event Log)
- Application logs (file-based)
- Docker container logs
- Nginx/Apache access/error logs
- Custom log files

Usage:
    python log-watcher.py --mode file --path /var/log/syslog
    python log-watcher.py --mode docker --containers my-app,my-api
    python log-watcher.py --mode directory --path /var/log/myapp --pattern "*.log"
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, asdict
import subprocess
import platform

# Try to import optional dependencies
try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False
    print("Warning: aiohttp not installed. Using synchronous requests.")

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False


# Configuration from environment
KESTRA_WEBHOOK_URL = os.getenv("KESTRA_WEBHOOK_URL", "http://localhost:8080/api/v1/webhooks/incident-webhook")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:3001")
API_KEY = os.getenv("API_KEY", "")
MONITOR_INTERVAL = int(os.getenv("MONITOR_INTERVAL", "5"))


@dataclass
class LogPattern:
    """Pattern definition for log analysis"""
    name: str
    pattern: str
    severity: str
    category: str
    suggested_fix: Optional[str] = None


# Built-in patterns for common infrastructure issues
DEFAULT_PATTERNS: List[LogPattern] = [
    # Database issues
    LogPattern(
        name="postgres_connection_exhausted",
        pattern=r"(FATAL|ERROR).*connection.*pool.*exhausted|too many connections|max_connections",
        severity="critical",
        category="database",
        suggested_fix="Increase max_connections in postgresql.conf or optimize connection pooling"
    ),
    LogPattern(
        name="mysql_connection_error",
        pattern=r"(ERROR|FATAL).*Can't connect to MySQL|Too many connections|Connection refused.*mysql",
        severity="critical",
        category="database",
        suggested_fix="Check MySQL service status and connection limits"
    ),
    LogPattern(
        name="database_timeout",
        pattern=r"(ERROR|WARN).*database.*timeout|query.*timeout|connection.*timed out",
        severity="high",
        category="database",
        suggested_fix="Optimize slow queries or increase timeout thresholds"
    ),

    # Memory issues
    LogPattern(
        name="oom_killer",
        pattern=r"Out of memory|OOM.*killer|Cannot allocate memory|oom-kill",
        severity="critical",
        category="memory",
        suggested_fix="Increase memory limits or optimize application memory usage"
    ),
    LogPattern(
        name="memory_high",
        pattern=r"memory.*usage.*(9[0-9]|100)%|heap.*overflow|memory.*pressure",
        severity="high",
        category="memory",
        suggested_fix="Scale up memory resources or identify memory leaks"
    ),

    # Disk issues
    LogPattern(
        name="disk_full",
        pattern=r"No space left on device|disk.*full|filesystem.*full|out of disk space",
        severity="critical",
        category="disk",
        suggested_fix="Clean up disk space or expand storage volume"
    ),
    LogPattern(
        name="disk_warning",
        pattern=r"disk.*usage.*(8[5-9]|9[0-9])%|low disk space|disk.*nearly full",
        severity="high",
        category="disk",
        suggested_fix="Monitor disk usage and plan cleanup or expansion"
    ),

    # Network issues
    LogPattern(
        name="connection_refused",
        pattern=r"Connection refused|ECONNREFUSED|connection.*reset.*peer",
        severity="high",
        category="network",
        suggested_fix="Check if target service is running and firewall rules"
    ),
    LogPattern(
        name="network_timeout",
        pattern=r"(connection|read|write).*timeout|ETIMEDOUT|network.*unreachable",
        severity="high",
        category="network",
        suggested_fix="Check network connectivity and increase timeout if needed"
    ),
    LogPattern(
        name="dns_failure",
        pattern=r"DNS.*resolution.*failed|could not resolve|ENOTFOUND|name or service not known",
        severity="high",
        category="network",
        suggested_fix="Check DNS configuration and resolver settings"
    ),

    # Authentication issues
    LogPattern(
        name="auth_failure",
        pattern=r"authentication.*failed|invalid.*credentials|access.*denied|unauthorized|401.*Unauthorized",
        severity="high",
        category="auth",
        suggested_fix="Check credentials and authentication configuration"
    ),
    LogPattern(
        name="permission_denied",
        pattern=r"permission denied|EACCES|403.*Forbidden|access.*forbidden",
        severity="medium",
        category="auth",
        suggested_fix="Check file/resource permissions and ownership"
    ),

    # SSL/TLS issues
    LogPattern(
        name="ssl_certificate_expired",
        pattern=r"certificate.*expired|SSL.*certificate.*not valid|certificate.*verify.*failed",
        severity="critical",
        category="network",
        suggested_fix="Renew SSL certificate immediately"
    ),
    LogPattern(
        name="ssl_certificate_expiring",
        pattern=r"certificate.*expir(ing|es)|SSL.*expir",
        severity="high",
        category="network",
        suggested_fix="Schedule SSL certificate renewal"
    ),

    # Application errors
    LogPattern(
        name="uncaught_exception",
        pattern=r"uncaught.*exception|unhandled.*rejection|FATAL.*error|panic:|segmentation fault",
        severity="critical",
        category="application",
        suggested_fix="Review application logs and fix the root cause"
    ),
    LogPattern(
        name="application_error",
        pattern=r"ERROR.*Exception|error.*stack.*trace|failed to (start|initialize|connect)",
        severity="high",
        category="application",
        suggested_fix="Check application logs for detailed error information"
    ),

    # Container/Kubernetes issues
    LogPattern(
        name="container_crash",
        pattern=r"container.*crash|CrashLoopBackOff|OOMKilled|container.*died",
        severity="critical",
        category="application",
        suggested_fix="Check container logs and resource limits"
    ),
    LogPattern(
        name="pod_failure",
        pattern=r"pod.*failed|ImagePullBackOff|ErrImagePull|pod.*evicted",
        severity="high",
        category="application",
        suggested_fix="Check Kubernetes pod status and events"
    ),

    # Service availability
    LogPattern(
        name="service_unavailable",
        pattern=r"503.*Service.*Unavailable|service.*down|health.*check.*failed",
        severity="critical",
        category="application",
        suggested_fix="Check service status and restart if necessary"
    ),
    LogPattern(
        name="high_latency",
        pattern=r"(request|response).*latency.*(high|exceeded)|slow.*query|timeout.*exceeded",
        severity="medium",
        category="application",
        suggested_fix="Investigate performance bottlenecks"
    ),
]


class LogWatcher:
    """Base class for log watching"""

    def __init__(self, patterns: List[LogPattern] = None):
        self.patterns = patterns or DEFAULT_PATTERNS
        self.seen_lines: Set[str] = set()
        self.compiled_patterns = [
            (p, re.compile(p.pattern, re.IGNORECASE))
            for p in self.patterns
        ]

    def analyze_line(self, line: str, source: str) -> Optional[Dict]:
        """Analyze a log line for known patterns"""
        # Skip if we've seen this exact line recently
        line_hash = hash(line)
        if line_hash in self.seen_lines:
            return None

        # Keep seen_lines bounded
        if len(self.seen_lines) > 10000:
            self.seen_lines.clear()
        self.seen_lines.add(line_hash)

        for pattern, compiled in self.compiled_patterns:
            if compiled.search(line):
                return {
                    "log": line.strip(),
                    "source": source,
                    "severity": pattern.severity,
                    "category": pattern.category,
                    "summary": f"{pattern.name.replace('_', ' ').title()} detected",
                    "suggested_fix": pattern.suggested_fix,
                    "timestamp": datetime.now().isoformat(),
                    "pattern_name": pattern.name,
                }

        return None

    async def send_incident(self, incident: Dict) -> bool:
        """Send incident to Kestra or MCP server"""
        headers = {"Content-Type": "application/json"}
        if API_KEY:
            headers["x-api-key"] = API_KEY

        # Try Kestra first
        try:
            if AIOHTTP_AVAILABLE:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        KESTRA_WEBHOOK_URL,
                        json=incident,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as response:
                        if response.status == 200:
                            print(f"[+] Incident sent to Kestra: {incident['summary']}")
                            return True
            elif REQUESTS_AVAILABLE:
                response = requests.post(
                    KESTRA_WEBHOOK_URL,
                    json=incident,
                    headers=headers,
                    timeout=10
                )
                if response.status_code == 200:
                    print(f"[+] Incident sent to Kestra: {incident['summary']}")
                    return True
        except Exception as e:
            print(f"[-] Failed to send to Kestra: {e}")

        # Fallback to MCP server
        try:
            mcp_incident = {
                "severity": incident["severity"],
                "category": incident["category"],
                "summary": incident["summary"],
                "description": incident["log"],
                "suggested_fix": incident.get("suggested_fix"),
                "source": incident["source"],
                "raw_log": incident["log"],
            }

            if AIOHTTP_AVAILABLE:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{MCP_SERVER_URL}/incidents",
                        json=mcp_incident,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as response:
                        if response.status == 201:
                            print(f"[+] Incident sent to MCP server: {incident['summary']}")
                            return True
            elif REQUESTS_AVAILABLE:
                response = requests.post(
                    f"{MCP_SERVER_URL}/incidents",
                    json=mcp_incident,
                    headers=headers,
                    timeout=10
                )
                if response.status_code == 201:
                    print(f"[+] Incident sent to MCP server: {incident['summary']}")
                    return True
        except Exception as e:
            print(f"[-] Failed to send to MCP server: {e}")

        return False


class FileLogWatcher(LogWatcher):
    """Watch a single log file"""

    def __init__(self, file_path: str, **kwargs):
        super().__init__(**kwargs)
        self.file_path = Path(file_path)
        self.position = 0

    async def watch(self):
        """Watch the file for new lines"""
        print(f"[*] Watching file: {self.file_path}")

        # Start from end of file
        if self.file_path.exists():
            self.position = self.file_path.stat().st_size

        while True:
            try:
                if not self.file_path.exists():
                    await asyncio.sleep(MONITOR_INTERVAL)
                    continue

                current_size = self.file_path.stat().st_size

                # File was truncated (rotated)
                if current_size < self.position:
                    self.position = 0

                if current_size > self.position:
                    with open(self.file_path, 'r', errors='ignore') as f:
                        f.seek(self.position)
                        for line in f:
                            incident = self.analyze_line(line, str(self.file_path))
                            if incident:
                                await self.send_incident(incident)
                        self.position = f.tell()

                await asyncio.sleep(MONITOR_INTERVAL)

            except Exception as e:
                print(f"[-] Error watching {self.file_path}: {e}")
                await asyncio.sleep(MONITOR_INTERVAL)


class DirectoryLogWatcher(LogWatcher):
    """Watch all log files in a directory"""

    def __init__(self, directory: str, pattern: str = "*.log", **kwargs):
        super().__init__(**kwargs)
        self.directory = Path(directory)
        self.pattern = pattern
        self.file_positions: Dict[str, int] = {}

    async def watch(self):
        """Watch all matching files in directory"""
        print(f"[*] Watching directory: {self.directory} (pattern: {self.pattern})")

        while True:
            try:
                for file_path in self.directory.glob(self.pattern):
                    await self._process_file(file_path)

                await asyncio.sleep(MONITOR_INTERVAL)

            except Exception as e:
                print(f"[-] Error watching directory: {e}")
                await asyncio.sleep(MONITOR_INTERVAL)

    async def _process_file(self, file_path: Path):
        """Process a single file"""
        str_path = str(file_path)

        if str_path not in self.file_positions:
            # Start from end of file for new files
            self.file_positions[str_path] = file_path.stat().st_size
            return

        current_size = file_path.stat().st_size
        position = self.file_positions[str_path]

        # File was truncated
        if current_size < position:
            position = 0

        if current_size > position:
            with open(file_path, 'r', errors='ignore') as f:
                f.seek(position)
                for line in f:
                    incident = self.analyze_line(line, str_path)
                    if incident:
                        await self.send_incident(incident)
                self.file_positions[str_path] = f.tell()


class DockerLogWatcher(LogWatcher):
    """Watch Docker container logs"""

    def __init__(self, containers: List[str], **kwargs):
        super().__init__(**kwargs)
        self.containers = containers
        if not DOCKER_AVAILABLE:
            raise ImportError("docker package required: pip install docker")
        self.client = docker.from_env()

    async def watch(self):
        """Watch all specified containers"""
        print(f"[*] Watching Docker containers: {', '.join(self.containers)}")

        tasks = [self._watch_container(name) for name in self.containers]
        await asyncio.gather(*tasks)

    async def _watch_container(self, container_name: str):
        """Watch a single container"""
        try:
            container = self.client.containers.get(container_name)

            # Stream logs from current time
            for log in container.logs(stream=True, follow=True, since=int(time.time())):
                line = log.decode('utf-8', errors='ignore')
                incident = self.analyze_line(line, f"docker:{container_name}")
                if incident:
                    await self.send_incident(incident)

        except docker.errors.NotFound:
            print(f"[-] Container not found: {container_name}")
        except Exception as e:
            print(f"[-] Error watching container {container_name}: {e}")


class WindowsEventLogWatcher(LogWatcher):
    """Watch Windows Event Log"""

    def __init__(self, log_names: List[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.log_names = log_names or ["System", "Application"]
        if platform.system() != "Windows":
            raise OSError("Windows Event Log watcher only works on Windows")

    async def watch(self):
        """Watch Windows Event Logs"""
        print(f"[*] Watching Windows Event Logs: {', '.join(self.log_names)}")

        # Use PowerShell to get events
        while True:
            for log_name in self.log_names:
                await self._check_log(log_name)
            await asyncio.sleep(MONITOR_INTERVAL)

    async def _check_log(self, log_name: str):
        """Check a specific Windows event log"""
        try:
            # Get recent error/warning events
            cmd = [
                "powershell", "-Command",
                f"Get-EventLog -LogName {log_name} -Newest 10 -EntryType Error,Warning | "
                "Select-Object TimeGenerated,EntryType,Source,Message | ConvertTo-Json"
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode == 0 and result.stdout:
                events = json.loads(result.stdout)
                if not isinstance(events, list):
                    events = [events]

                for event in events:
                    message = event.get("Message", "")
                    incident = self.analyze_line(message, f"windows:{log_name}")
                    if incident:
                        await self.send_incident(incident)

        except Exception as e:
            print(f"[-] Error checking Windows Event Log {log_name}: {e}")


class SystemdJournalWatcher(LogWatcher):
    """Watch systemd journal (journalctl)"""

    def __init__(self, units: List[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.units = units or []

    async def watch(self):
        """Watch systemd journal"""
        unit_str = " ".join([f"-u {u}" for u in self.units]) if self.units else ""
        print(f"[*] Watching systemd journal {unit_str or '(all units)'}")

        cmd = ["journalctl", "-f", "-n", "0", "-o", "json"]
        if self.units:
            for unit in self.units:
                cmd.extend(["-u", unit])

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            async for line in process.stdout:
                try:
                    entry = json.loads(line.decode('utf-8', errors='ignore'))
                    message = entry.get("MESSAGE", "")
                    unit = entry.get("_SYSTEMD_UNIT", "unknown")

                    incident = self.analyze_line(message, f"systemd:{unit}")
                    if incident:
                        await self.send_incident(incident)
                except json.JSONDecodeError:
                    pass

        except Exception as e:
            print(f"[-] Error watching systemd journal: {e}")


async def main():
    # Declare global variables before using them
    global KESTRA_WEBHOOK_URL, MCP_SERVER_URL, MONITOR_INTERVAL

    parser = argparse.ArgumentParser(
        description="Real-world log watcher for Self-Healing DevOps Orchestrator"
    )
    parser.add_argument(
        "--mode",
        choices=["file", "directory", "docker", "windows", "systemd"],
        required=True,
        help="Watching mode"
    )
    parser.add_argument(
        "--path",
        help="File or directory path to watch"
    )
    parser.add_argument(
        "--pattern",
        default="*.log",
        help="Glob pattern for directory mode (default: *.log)"
    )
    parser.add_argument(
        "--containers",
        help="Comma-separated container names for docker mode"
    )
    parser.add_argument(
        "--units",
        help="Comma-separated systemd unit names"
    )
    parser.add_argument(
        "--kestra-url",
        default=KESTRA_WEBHOOK_URL,
        help="Kestra webhook URL"
    )
    parser.add_argument(
        "--mcp-url",
        default=MCP_SERVER_URL,
        help="MCP server URL"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=MONITOR_INTERVAL,
        help="Polling interval in seconds (default: 5)"
    )

    args = parser.parse_args()

    # Update global config
    KESTRA_WEBHOOK_URL = args.kestra_url
    MCP_SERVER_URL = args.mcp_url
    MONITOR_INTERVAL = args.interval

    print("=" * 60)
    print("Self-Healing DevOps Orchestrator - Log Watcher")
    print("=" * 60)
    print(f"Kestra URL: {KESTRA_WEBHOOK_URL}")
    print(f"MCP Server URL: {MCP_SERVER_URL}")
    print(f"Poll Interval: {MONITOR_INTERVAL}s")
    print("=" * 60)

    # Create appropriate watcher
    watcher = None

    if args.mode == "file":
        if not args.path:
            print("Error: --path required for file mode")
            sys.exit(1)
        watcher = FileLogWatcher(args.path)

    elif args.mode == "directory":
        if not args.path:
            print("Error: --path required for directory mode")
            sys.exit(1)
        watcher = DirectoryLogWatcher(args.path, args.pattern)

    elif args.mode == "docker":
        if not args.containers:
            print("Error: --containers required for docker mode")
            sys.exit(1)
        containers = [c.strip() for c in args.containers.split(",")]
        watcher = DockerLogWatcher(containers)

    elif args.mode == "windows":
        watcher = WindowsEventLogWatcher()

    elif args.mode == "systemd":
        units = [u.strip() for u in args.units.split(",")] if args.units else None
        watcher = SystemdJournalWatcher(units)

    if watcher:
        try:
            await watcher.watch()
        except KeyboardInterrupt:
            print("\n[*] Shutting down...")


if __name__ == "__main__":
    asyncio.run(main())
