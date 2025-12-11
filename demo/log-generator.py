#!/usr/bin/env python3
"""
Demo Log Generator for Self-Healing DevOps Orchestrator

Generates realistic infrastructure logs for demo purposes.
Can simulate various incident scenarios to showcase the system's capabilities.
"""

import json
import random
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List

class DemoLogGenerator:
    """Generates realistic demo logs for infrastructure incidents"""

    def __init__(self):
        # Template for different types of logs
        self.templates = {
            'database_connection_pool': {
                'critical': [
                    'FATAL: Connection pool exhausted - max_connections=100 exceeded in database.yml',
                    'CRITICAL: Connection pool fully utilized, application unable to acquire new connections',
                    'FATAL: org.postgresql.util.PSQLException: FATAL: remaining connection slots are reserved for non-replication superuser connections'
                ],
                'high': [
                    'ERROR: Connection pool 95% utilized, high risk of exhaustion',
                    'WARNING: Database connection pool nearing capacity (95/100 connections used)',
                    'ERROR: ConnectionPoolExhaustedException: Unable to get database connection within 30 seconds'
                ],
                'medium': [
                    'WARNING: Connection pool at 75% capacity',
                    'INFO: Database connection pool utilization increased to 80%'
                ]
            },
            'memory_exhaustion': {
                'critical': [
                    'FATAL: Out of memory error - application crashed',
                    'CRITICAL: JVM heap space exhausted (4GB allocated, 4GB used)',
                    'FATAL: Kernel OOM killer terminated process (PID: 12345) due to memory pressure'
                ],
                'high': [
                    'ERROR: Memory usage exceeded 95% threshold on node-3',
                    'WARNING: Container memory usage at 95%, risk of OOM kill',
                    'ERROR: java.lang.OutOfMemoryError: GC overhead limit exceeded'
                ],
                'medium': [
                    'WARNING: Memory utilization at 85%',
                    'INFO: Container memory usage trending upward (80%->85%)'
                ]
            },
            'disk_space': {
                'critical': [],
                'high': [
                    'ERROR: Disk usage at 98% on /var/log partition',
                    'CRITICAL: No space left on device /var/log',
                    'FATAL: Unable to write log files - disk full'
                ],
                'medium': [
                    'WARNING: Disk usage at 85% on /var/log partition',
                    'INFO: Log partition nearing capacity (80% used)',
                    'WARNING: Only 15GB remaining on log volume'
                ]
            },
            'auth_failures': {
                'critical': [
                    'CRITICAL: Auth service returning 503 - unable to validate tokens',
                    'FATAL: Authentication service completely unavailable',
                    'ERROR: All authentication requests failing with connection timeout'
                ],
                'high': [
                    'ERROR: High rate of authentication failures (80% of requests)',
                    'WARNING: JWT token validation failing across multiple services',
                    'ERROR: Auth service response time > 30s for 90% of requests'
                ],
                'medium': [
                    'WARNING: Increased authentication failure rate (+50%)',
                    'INFO: Auth service experiencing elevated error rates'
                ]
            },
            'network_timeout': {
                'high': [
                    'ERROR: Network timeout connecting to redis-cluster:6379',
                    'WARNING: High latency to database endpoints (avg 5000ms)',
                    'ERROR: Service mesh circuit breaker tripped for service-discovery'
                ],
                'medium': [
                    'WARNING: Intermittent network connectivity issues',
                    'INFO: Service response times increased by 200%'
                ]
            },
            'ssl_certificate': {
                'high': [
                    'ERROR: SSL certificate expired for api.example.com',
                    'WARNING: Certificate expires in 24 hours',
                    'CRITICAL: HTTPS handshake failed due to expired certificate'
                ],
                'medium': [
                    'WARNING: Certificate expires in 7 days',
                    'INFO: SSL certificate renewal required within 1 week'
                ]
            }
        }

        # Service and component names for realistic logs
        self.services = [
            'web-api', 'auth-service', 'payment-gateway', 'user-db',
            'order-service', 'notification-service', 'cache-cluster',
            'log-aggregator', 'monitoring-stack', 'load-balancer'
        ]

        self.hosts = [
            'web-01', 'web-02', 'api-01', 'api-02', 'db-01', 'db-02',
            'cache-01', 'cache-02', 'worker-01', 'worker-02'
        ]

    def generate_single_log(self, incident_type: str = 'random',
                           severity: str = 'random') -> Dict[str, Any]:
        """Generate a single demo log entry"""

        if incident_type == 'random':
            incident_type = random.choice(list(self.templates.keys()))

        if severity == 'random':
            severity = random.choice(list(self.templates[incident_type].keys()))

        templates = self.templates[incident_type][severity]
        if not templates:
            # Fallback to another severity if current has no templates
            severity = random.choice(['high', 'medium', 'critical'])
            templates = self.templates[incident_type][severity]

        message = random.choice(templates)
        host = random.choice(self.hosts)
        service = random.choice(self.services)

        # Add service context to message if not present
        if f'[{service}]' not in message:
            message = f'[{service}] {message}'

        # Add host context if relevant
        if 'node-' not in message and 'container' not in message:
            message = f'{message} on {host}'

        # Generate timestamp within last hour
        timestamp = datetime.now() - timedelta(minutes=random.randint(0, 60))

        return {
            'timestamp': timestamp.isoformat(),
            'level': severity.upper(),
            'service': service,
            'host': host,
            'message': message,
            'incident_type': incident_type,
            'severity': severity,
            'source': 'demo-log-generator'
        }

    def generate_scenario_logs(self, scenario: str, count: int = 10) -> List[Dict[str, Any]]:
        """Generate a sequence of logs for a specific incident scenario"""
        scenarios = {
            'database_crash': ('database_connection_pool', 'critical'),
            'memory_leak': ('memory_exhaustion', 'high'),
            'disk_full': ('disk_space', 'high'),
            'auth_outage': ('auth_failures', 'critical'),
            'network_issue': ('network_timeout', 'high'),
            'ssl_expiry': ('ssl_certificate', 'high'),
        }

        incident_type, severity = scenarios.get(scenario, ('database_connection_pool', 'critical'))

        logs = []
        base_time = datetime.now() - timedelta(minutes=count)

        for i in range(count):
            log = self.generate_single_log(incident_type, severity)
            # Override timestamp to create a sequence
            log['timestamp'] = (base_time + timedelta(minutes=i)).isoformat()
            logs.append(log)

        return logs

    def generate_jsonl_file(self, filename: str, count: int = 20, scenario: str = 'random'):
        """Generate a JSONL file with demo logs"""
        if scenario == 'random':
            logs = [self.generate_single_log() for _ in range(count)]
        else:
            logs = self.generate_scenario_logs(scenario, count)

        with open(filename, 'w') as f:
            for log in logs:
                f.write(json.dumps(log) + '\n')

        print(f"Generated {count} demo logs in {filename}")

def main():
    """CLI interface for the log generator"""
    import argparse

    parser = argparse.ArgumentParser(description='Generate demo infrastructure logs')
    parser.add_argument('--count', type=int, default=10, help='Number of logs to generate')
    parser.add_argument('--output', '-o', default='demo-logs.jsonl', help='Output file')
    parser.add_argument('--scenario', choices=[
        'random', 'database_crash', 'memory_leak', 'disk_full',
        'auth_outage', 'network_issue', 'ssl_expiry'
    ], default='random', help='Specific incident scenario')

    args = parser.parse_args()

    generator = DemoLogGenerator()

    if args.scenario == 'random':
        logs = [generator.generate_single_log() for _ in range(args.count)]
    else:
        logs = generator.generate_scenario_logs(args.scenario, args.count)

    # Save to file
    with open(args.output, 'w') as f:
        for log in logs:
            f.write(json.dumps(log) + '\n')

    print(f"Generated {args.count} demo logs in {args.output} for scenario: {args.scenario}")

    # Print sample logs
    print("\nSample logs:")
    for log in logs[:3]:
        print(f"[{log['timestamp']}] {log['level']}: {log['message']}")

if __name__ == '__main__':
    main()
</parameter>
</write_to_file>
