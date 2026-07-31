#!/usr/bin/env bash
# Activa un workflow de n8n una vez las credenciales están asignadas en sus nodos.
# Uso:
#   N8N_API_KEY="tu-api-key" WORKFLOW_ID="123" ./activate-workflow.sh
set -euo pipefail

: "${N8N_BASE_URL:=https://n8n-n8n.juoo4o.easypanel.host}"
: "${N8N_API_KEY:?Falta N8N_API_KEY}"
: "${WORKFLOW_ID:?Falta WORKFLOW_ID (te lo dio import-workflow.sh)}"

HTTP_CODE=$(curl -sS -o /tmp/n8n-activate-result.json -w "%{http_code}" \
  -X POST "$N8N_BASE_URL/api/v1/workflows/$WORKFLOW_ID/activate" \
  -H "X-N8N-API-KEY: $N8N_API_KEY")

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "Fallo al activar (HTTP $HTTP_CODE):"
  cat /tmp/n8n-activate-result.json
  exit 1
fi

echo "Workflow $WORKFLOW_ID activado."
