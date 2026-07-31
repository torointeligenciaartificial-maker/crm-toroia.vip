# Importa n8n/toroia-seguimiento-crm.json en tu instancia n8n vía la API REST.
# Uso:
#   .\import-workflow.ps1 -N8nApiKey "tu-api-key"
param(
    [Parameter(Mandatory = $true)][string]$N8nApiKey,
    [string]$N8nBaseUrl = "https://n8n-n8n.juoo4o.easypanel.host"
)

$ErrorActionPreference = "Stop"

$workflowPath = Join-Path $PSScriptRoot "..\toroia-seguimiento-crm.json"
$body = Get-Content -Raw -Path $workflowPath

$headers = @{
    "X-N8N-API-KEY" = $N8nApiKey
    "Content-Type"  = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "$N8nBaseUrl/api/v1/workflows" -Method Post -Headers $headers -Body $body
} catch {
    Write-Host "Fallo al importar:" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message }
    exit 1
}

Write-Host "Workflow importado correctamente. ID: $($response.id)" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE: los nodos Notion / Gmail / WhatsApp quedan SIN credencial asignada"
Write-Host "(la API no puede completar el login OAuth de Google ni de Meta por ti)."
Write-Host "Entra en n8n -> abre el workflow -> en cada nodo, selecciona/crea la credencial:"
Write-Host "  - Notion - Leer Prioritarios            -> Notion API"
Write-Host "  - Notion - Actualizar Fecha Seguimiento  -> Notion API"
Write-Host "  - Gmail - Enviar Follow-up               -> Gmail OAuth2 (Reconnect)"
Write-Host "  - WhatsApp - Enviar Follow-up            -> WhatsApp Business Cloud API"
Write-Host ""
Write-Host "Para crear la credencial de Notion API automáticamente por API, usa:"
Write-Host "  .\create-notion-credential.ps1 -N8nApiKey ... -NotionIntegrationSecret ..."
Write-Host ""
Write-Host "Cuando las credenciales estén asignadas, activa el workflow con:"
Write-Host "  .\activate-workflow.ps1 -N8nApiKey ... -WorkflowId $($response.id)"

# Alternativa con curl.exe (curl real de Windows, no el alias de Invoke-WebRequest):
#   curl.exe -sS -X POST "$N8nBaseUrl/api/v1/workflows" `
#     -H "X-N8N-API-KEY: $N8nApiKey" `
#     -H "Content-Type: application/json" `
#     --data-binary "@$workflowPath"
