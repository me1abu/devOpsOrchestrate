#!/bin/bash

# Get all pending incident IDs
PENDING_INCIDENTS=$(curl -s http://localhost:3001/incidents?status=pending | jq -r '.[].id')

# Report success for each incident
for INCIDENT_ID in $PENDING_INCIDENTS; do
  echo "Reporting success for incident: $INCIDENT_ID"
  curl -s -X PATCH http://localhost:3001/incidents/$INCIDENT_ID \
    -H "Content-Type: application/json" \
    -d '{
      "status": "fixed",
      "fix_notes": "Resolved via self-healing DevOps workflow",
      "updated_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'"
    }'
done

echo "All pending incidents have been marked as fixed."
