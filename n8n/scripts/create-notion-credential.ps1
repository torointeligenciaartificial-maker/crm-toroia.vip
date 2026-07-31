# Crea la credencial "Notion API" en n8n a partir de un Internal Integration Secret de Notion.
# Consíguelo en notion.so -> Settings -> Connections -> Develop or manage integrations
# -> tu integración -> "Internal Integration Secret". Recuerda compartir tu base de datos
# CRM con esa integración (··· -> Connections -> añadir integración) o dará error 403/objeto
# no encontrado aunque el secret sea correcto.
#
# Uso:
#   .\create-notion-credential.ps1 -N8nApiKey "tu-api-key" -NotionIntegrationSecret "secret_xxx"
param(
    [Parameter(Mandatory = $true)][string]$N8nApiKey,
    [Parameter(Mandatory = $true)][string]$NotionIntegrationSecret,
    [string]$N8nBaseUrl = "https://n8n-n8n.juoo4o.easypanel.host"
)

$ErrorActionPreference = "Stop"

$headers = @{
    "X-N8N-API-KEY" = $N8nApiKey
    "Content-Type"  = "application/json"
}

$payload = @{
    name = "Notion - Toroia CRM"
    type = "notionApi"
    data = @{ apiKey = $NotionIntegrationSecret }
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Uri "$N8nBaseUrl/api/v1/credentials" -Method Post -Headers $headers -Body $payload
} catch {
    Write-Host "Fallo al crear la credencial:" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message }
    exit 1
}

Write-Host "Credencial 'Notion - Toroia CRM' creada. ID: $($response.id)" -ForegroundColor Green
Write-Host "Ahora entra en n8n, abre 'Toroia - Seguimiento CRM Automático' y en los dos nodos"
Write-Host "Notion selecciona esta credencial en el desplegable (la API no puede asignarla"
Write-Host "dentro del workflow por ti, solo crearla)."

# Alternativa con curl.exe:
#   curl.exe -sS -X POST "$N8nBaseUrl/api/v1/credentials" `
#     -H "X-N8N-API-KEY: $N8nApiKey" `
#     -H "Content-Type: application/json" `
#     -d '{\"name\":\"Notion - Toroia CRM\",\"type\":\"notionApi\",\"data\":{\"apiKey\":\"secret_xxx\"}}'
