#!/usr/bin/env bash
# Crea la credencial "Notion API" en n8n a partir de un Internal Integration Secret de Notion.
# Consíguelo en notion.so -> Settings -> Connections -> Develop or manage integrations
# -> tu integración -> "Internal Integration Secret". Recuerda compartir tu base de datos
# CRM con esa integración (··· -> Connections -> añadir integración) o dará error 403/objeto
# no encontrado aunque el secret sea correcto.
#
# Uso:
#   N8N_API_KEY="tu-api-key" NOTION_INTEGRATION_SECRET="secret_xxx" ./create-notion-credential.sh
set -euo pipefail

: "${N8N_BASE_URL:=https://n8n-n8n.juoo4o.easypanel.host}"
: "${N8N_API_KEY:?Falta N8N_API_KEY}"
: "${NOTION_INTEGRATION_SECRET:?Falta NOTION_INTEGRATION_SECRET}"

OUT="/tmp/n8n-notion-credential-result.json"

HTTP_CODE=$(curl -sS -o "$OUT" -w "%{http_code}" -X POST "$N8N_BASE_URL/api/v1/credentials" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Notion - Toroia CRM\",\"type\":\"notionApi\",\"data\":{\"apiKey\":\"$NOTION_INTEGRATION_SECRET\"}}")

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "Fallo al crear la credencial (HTTP $HTTP_CODE):"
  cat "$OUT"
  exit 1
fi

echo "Credencial 'Notion - Toroia CRM' creada:"
cat "$OUT"
echo
echo "Ahora entra en n8n, abre 'Toroia - Seguimiento CRM Automático' y en los dos nodos"
echo "Notion selecciona esta credencial en el desplegable (la API no puede asignarla"
echo "dentro del workflow por ti, solo crearla)."
