<#
Parchea EN VIVO el workflow "Toroia - Seguimiento CRM Automatico" ya importado en n8n:
lee su definicion actual (conserva credenciales/ajustes ya hechos en la UI), cambia las
conexiones de "Notion - Actualizar Fecha Seguimiento" para que cuelgue en paralelo del
Switch (no de Gmail/WhatsApp), y confirma que su pageId usa {{ $json.id }}.

Uso:
  .\fix-notion-update-connections.ps1 -N8nApiKey "tu-api-key"
#>
param(
    [Parameter(Mandatory = $true)][string]$N8nApiKey,
    [string]$N8nBaseUrl = "https://n8n-n8n.juoo4o.easypanel.host",
    [string]$WorkflowName = "Toroia - Seguimiento CRM Automatico"
)

$ErrorActionPreference = "Stop"
$headers = @{ "X-N8N-API-KEY" = $N8nApiKey }

Write-Host "Buscando el workflow '$WorkflowName' ..." -ForegroundColor Cyan
$list = Invoke-RestMethod -Uri "$N8nBaseUrl/api/v1/workflows?limit=250" -Method Get -Headers $headers
$match = $list.data | Where-Object { $_.name -like "*Seguimiento CRM Autom*" }
if (-not $match) {
    Write-Host "No encontre ningun workflow con ese nombre. Workflows disponibles:" -ForegroundColor Red
    $list.data | ForEach-Object { Write-Host " - $($_.name) (id: $($_.id))" }
    exit 1
}
if ($match -is [array] -and $match.Count -gt 1) {
    Write-Host "Hay mas de un workflow que coincide, se usa el primero:" -ForegroundColor Yellow
    $match | ForEach-Object { Write-Host " - $($_.name) (id: $($_.id))" }
    $match = $match[0]
}
$workflowId = $match.id
Write-Host "Workflow encontrado: '$($match.name)' (id: $workflowId)" -ForegroundColor Green

$full = Invoke-RestMethod -Uri "$N8nBaseUrl/api/v1/workflows/$workflowId" -Method Get -Headers $headers

$switchNode = $full.nodes | Where-Object { $_.name -eq "Switch - Por Canal" }
$notionUpdateNode = $full.nodes | Where-Object { $_.name -eq "Notion - Actualizar Fecha Seguimiento" }

if (-not $switchNode -or -not $notionUpdateNode) {
    Write-Host "No encontre los nodos esperados por nombre exacto. Nodos presentes en el workflow:" -ForegroundColor Red
    $full.nodes | ForEach-Object { Write-Host " - $($_.name)" }
    exit 1
}

# 1) Confirma/fuerza pageId = {{ $json.id }}
if ($notionUpdateNode.parameters.pageId) {
    $notionUpdateNode.parameters.pageId.value = '={{ $json.id }}'
    Write-Host "pageId confirmado como {{ `$json.id }} en 'Notion - Actualizar Fecha Seguimiento'." -ForegroundColor Green
} else {
    Write-Host "Aviso: no encontre parameters.pageId en ese nodo con la forma esperada; revisalo a mano en la UI." -ForegroundColor Yellow
}

# 2) Quita las conexiones viejas Gmail -> Notion-Update y WhatsApp -> Notion-Update, si existen
foreach ($senderName in @("Gmail - Enviar Follow-up", "WhatsApp - Enviar Follow-up")) {
    if ($full.connections.PSObject.Properties.Name -contains $senderName) {
        $senderConn = $full.connections.$senderName
        if ($senderConn.main) {
            for ($i = 0; $i -lt $senderConn.main.Count; $i++) {
                $senderConn.main[$i] = @($senderConn.main[$i] | Where-Object { $_.node -ne "Notion - Actualizar Fecha Seguimiento" })
            }
        }
    }
}

# 3) Asegura que cada salida del Switch tambien apunte a Notion-Actualizar, ademas de a su nodo de envio
$switchConn = $full.connections.'Switch - Por Canal'.main
for ($i = 0; $i -lt $switchConn.Count; $i++) {
    $targets = @($switchConn[$i])
    $already = $targets | Where-Object { $_.node -eq "Notion - Actualizar Fecha Seguimiento" }
    if (-not $already) {
        $targets += [PSCustomObject]@{ node = "Notion - Actualizar Fecha Seguimiento"; type = "main"; index = 0 }
    }
    $switchConn[$i] = $targets
}
$full.connections.'Switch - Por Canal'.main = $switchConn

Write-Host "Guardando el workflow actualizado ..." -ForegroundColor Cyan
$updatePayload = @{
    name        = $full.name
    nodes       = $full.nodes
    connections = $full.connections
    settings    = $full.settings
} | ConvertTo-Json -Depth 50

$putHeaders = $headers.Clone()
$putHeaders["Content-Type"] = "application/json; charset=utf-8"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($updatePayload)

try {
    $updated = Invoke-RestMethod -Uri "$N8nBaseUrl/api/v1/workflows/$workflowId" -Method Put -Headers $putHeaders -Body $bytes
} catch {
    Write-Host "Fallo al guardar:" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message }
    exit 1
}

Write-Host ""
Write-Host "LISTO. Conexiones actualizadas en el workflow real (id $workflowId)." -ForegroundColor Green
Write-Host "'Notion - Actualizar Fecha Seguimiento' ahora cuelga en paralelo del Switch, no de Gmail/WhatsApp."
Write-Host ""
Write-Host "La API publica de n8n no tiene un endpoint para 'ejecutar ahora' - como el Schedule Trigger"
Write-Host "ya esta activo cada 15 min, no hace falta forzarlo: espera al proximo tick, o pulsa tu mismo"
Write-Host "'Execute workflow' en el editor de n8n si quieres verlo al instante."
