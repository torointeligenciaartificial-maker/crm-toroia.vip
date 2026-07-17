#!/usr/bin/env bash
# Importa n8n/toroia-seguimiento-crm.json en tu instancia n8n vía la API REST.
# Uso:
#   N8N_API_KEY="tu-api-key" ./import-workflow.sh
# Variables opcionales:
#   N8N_BASE_URL (por defecto https://n8n-n8n.juoo4o.easypanel.host)
set -euo pipefail

: "${N8N_BASE_URL:=https://n8n-n8n.juoo4o.easypanel.host}"
: "${N8N_API_KEY:?Falta N8N_API_KEY. Ejecuta: N8N_API_KEY=xxx ./import-workflow.sh}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOW_JSON="$SCRIPT_DIR/../toroia-seguimiento-crm.json"
OUT="/tmp/n8n-import-result.json"

echo "Importando workflow desde $WORKFLOW_JSON ..."
HTTP_CODE=$(curl -sS -o "$OUT" -w "%{http_code}" -X POST "$N8N_BASE_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @"$WORKFLOW_JSON")

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "Fallo al importar (HTTP $HTTP_CODE):"
  cat "$OUT"
  exit 1
fi

WORKFLOW_ID=$(grep -o '"id":[^,}]*' "$OUT" | head -1 | grep -o '[^: ]*$' | tr -d '"')
echo "Workflow importado correctamente. ID: $WORKFLOW_ID"
echo
echo "IMPORTANTE: los nodos Notion / Gmail / WhatsApp quedan SIN credencial asignada"
echo "(la API no puede completar el login OAuth de Google ni de Meta por ti)."
echo "Entra en n8n -> abre el workflow -> en cada nodo, selecciona/crea la credencial:"
echo "  - Notion - Leer Prioritarios          -> Notion API"
echo "  - Notion - Actualizar Fecha Seguimiento -> Notion API"
echo "  - Gmail - Enviar Follow-up             -> Gmail OAuth2 (Reconnect)"
echo "  - WhatsApp - Enviar Follow-up          -> WhatsApp Business Cloud API"
echo
echo "Para crear la credencial de Notion API automáticamente por API, usa:"
echo "  N8N_API_KEY=... NOTION_INTEGRATION_SECRET=... ./create-notion-credential.sh"
echo
echo "Cuando las credenciales estén asignadas, activa el workflow con:"
echo "  N8N_API_KEY=... WORKFLOW_ID=$WORKFLOW_ID ./activate-workflow.sh"
