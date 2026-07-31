# Activa un workflow de n8n una vez las credenciales están asignadas en sus nodos.
# Uso:
#   .\activate-workflow.ps1 -N8nApiKey "tu-api-key" -WorkflowId "123"
param(
    [Parameter(Mandatory = $true)][string]$N8nApiKey,
    [Parameter(Mandatory = $true)][string]$WorkflowId,
    [string]$N8nBaseUrl = "https://n8n-n8n.juoo4o.easypanel.host"
)

$ErrorActionPreference = "Stop"

$headers = @{ "X-N8N-API-KEY" = $N8nApiKey }

try {
    $response = Invoke-RestMethod -Uri "$N8nBaseUrl/api/v1/workflows/$WorkflowId/activate" -Method Post -Headers $headers
} catch {
    Write-Host "Fallo al activar:" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message }
    exit 1
}

Write-Host "Workflow $WorkflowId activado." -ForegroundColor Green

# Alternativa con curl.exe:
#   curl.exe -sS -X POST "$N8nBaseUrl/api/v1/workflows/$WorkflowId/activate" -H "X-N8N-API-KEY: $N8nApiKey"
