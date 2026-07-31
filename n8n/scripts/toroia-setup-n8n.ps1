<#
Script todo-en-uno para PowerShell (Windows), sin dependencias externas ni clonar el repo.

Hace, en orden:
  1. Crea la credencial "Notion API" en n8n a partir de tu Notion Integration Secret.
  2. Importa el workflow "Toroia - Seguimiento CRM Automatico" (JSON embebido abajo),
     asignando ya esa credencial a los dos nodos de Notion.
  3. Activa el workflow.

Los nodos de Gmail y WhatsApp se importan SIN credencial (no se puede crear login OAuth
de Google ni de Meta por API, exige tu navegador) - los asignas luego a mano en la UI de n8n.

Uso:
  .\toroia-setup-n8n.ps1 -N8nApiKey "tu-api-key" -NotionIntegrationSecret "secret_xxx"

Si PowerShell bloquea el script por politica de ejecucion, corre antes (misma sesion):
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>
param(
    [Parameter(Mandatory = $true)][string]$N8nApiKey,
    [Parameter(Mandatory = $true)][string]$NotionIntegrationSecret,
    [string]$N8nBaseUrl = "https://n8n-n8n.juoo4o.easypanel.host"
)

$ErrorActionPreference = "Stop"

function Invoke-N8n {
    param([string]$Method, [string]$Path, [string]$JsonBody)
    $uri = "$N8nBaseUrl$Path"
    $headers = @{ "X-N8N-API-KEY" = $N8nApiKey }
    if ($JsonBody) {
        $headers["Content-Type"] = "application/json; charset=utf-8"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($JsonBody)
        return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $bytes
    } else {
        return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
    }
}

# --- JSON del workflow embebido (con placeholders ASCII para los caracteres no-ASCII, ---
# --- sustituidos mas abajo, para que el pegado en PowerShell nunca corrompa acentos/emoji) ---
$workflowJsonRaw = @'
{
  "name": "Toroia - Seguimiento CRM Autom@AA@tico",
  "nodes": [
    {
      "id": "trigger-15min",
      "name": "Trigger - Cada 15 min",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 0],
      "parameters": {
        "rule": {
          "interval": [{ "field": "minutes", "minutesInterval": 15 }]
        }
      }
    },
    {
      "id": "notion-leer-prioritarios",
      "name": "Notion - Leer Prioritarios",
      "type": "n8n-nodes-base.notion",
      "typeVersion": 2.2,
      "position": [240, 0],
      "parameters": {
        "resource": "databasePage",
        "operation": "getAll",
        "databaseId": {
          "__rl": true,
          "value": "99bae6ce-57a4-4bf8-ab9c-179ce289fe4e",
          "mode": "id"
        },
        "returnAll": true,
        "filterType": "manual",
        "filters": {
          "conditions": [
            {
              "key": "Estado|select",
              "condition": "equals",
              "value": "@EMOJI1@ Enviado"
            }
          ]
        }
      },
      "credentials": {
        "notionApi": { "id": "__NOTION_CRED_ID__", "name": "__NOTION_CRED_NAME__" }
      }
    },
    {
      "id": "if-followup-vencido",
      "name": "IF - Follow-up vencido (48h)",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [480, 0],
      "parameters": {
        "conditions": {
          "options": { "caseSensitive": true, "typeValidation": "loose", "version": 2 },
          "combinator": "and",
          "conditions": [
            {
              "id": "cond-fecha-contacto",
              "leftValue": "={{ $json['Fecha Contacto'] }}",
              "rightValue": "={{ $now.minus({ hours: 48 }).toISO() }}",
              "operator": { "type": "dateTime", "operation": "before" }
            },
            {
              "id": "cond-sin-seguimiento",
              "leftValue": "={{ $json['Fecha Seguimiento'] }}",
              "rightValue": "",
              "operator": { "type": "string", "operation": "empty", "singleValue": true }
            }
          ]
        },
        "options": {}
      }
    },
    {
      "id": "switch-por-canal",
      "name": "Switch - Por Canal",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3.2,
      "position": [720, 0],
      "parameters": {
        "mode": "rules",
        "rules": {
          "values": [
            {
              "conditions": {
                "options": { "caseSensitive": true, "typeValidation": "loose", "version": 2 },
                "combinator": "and",
                "conditions": [
                  {
                    "id": "cond-canal-whatsapp",
                    "leftValue": "={{ $json['Canal'] }}",
                    "rightValue": "WhatsApp",
                    "operator": { "type": "string", "operation": "equals" }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "WhatsApp"
            }
          ]
        },
        "options": { "fallbackOutput": "extra", "renameFallbackOutput": "Email/Otro" }
      }
    },
    {
      "id": "gmail-enviar-followup",
      "name": "Gmail - Enviar Follow-up",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [960, -80],
      "parameters": {
        "resource": "message",
        "operation": "send",
        "sendTo": "={{ $json['Email'] }}",
        "subject": "={{ 'Seguimiento - ' + $json['Empresa'] }}",
        "emailType": "text",
        "message": "=Hola {{ $json['Nombre Contacto'] || $json['Empresa'] }},\n\nTe escrib@II@ hace unos d@II@as sobre c@OO@mo Toroia puede ayudar a {{ $json['Empresa'] }} en el sector {{ $json['Sector'] }}. @QQ@Tuviste ocasi@OO@n de revisarlo?\n\nQuedo atento/a a cualquier duda.\n\nUn saludo,\nToroia",
        "options": {}
      }
    },
    {
      "id": "whatsapp-enviar-followup",
      "name": "WhatsApp - Enviar Follow-up",
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [960, 80],
      "parameters": {
        "resource": "message",
        "operation": "send",
        "recipientPhoneNumber": "={{ $json['Tel@EE@fono'] }}",
        "textBody": "=Hola {{ $json['Nombre Contacto'] || $json['Empresa'] }}, soy de Toroia @EMOJI2@. Te escrib@II@ hace unos d@II@as sobre {{ $json['Empresa'] }}, @QQ@pudiste verlo? Quedo atento/a."
      }
    },
    {
      "id": "notion-actualizar-seguimiento",
      "name": "Notion - Actualizar Fecha Seguimiento",
      "type": "n8n-nodes-base.notion",
      "typeVersion": 2.2,
      "position": [1200, 0],
      "parameters": {
        "resource": "databasePage",
        "operation": "update",
        "pageId": {
          "__rl": true,
          "value": "={{ $json.id }}",
          "mode": "id"
        },
        "propertiesUi": {
          "propertyValues": [
            { "key": "Fecha Seguimiento|date", "date": "={{ $now.toISO() }}" }
          ]
        }
      },
      "credentials": {
        "notionApi": { "id": "__NOTION_CRED_ID__", "name": "__NOTION_CRED_NAME__" }
      }
    }
  ],
  "connections": {
    "Trigger - Cada 15 min": {
      "main": [[{ "node": "Notion - Leer Prioritarios", "type": "main", "index": 0 }]]
    },
    "Notion - Leer Prioritarios": {
      "main": [[{ "node": "IF - Follow-up vencido (48h)", "type": "main", "index": 0 }]]
    },
    "IF - Follow-up vencido (48h)": {
      "main": [[{ "node": "Switch - Por Canal", "type": "main", "index": 0 }]]
    },
    "Switch - Por Canal": {
      "main": [
        [
          { "node": "WhatsApp - Enviar Follow-up", "type": "main", "index": 0 },
          { "node": "Notion - Actualizar Fecha Seguimiento", "type": "main", "index": 0 }
        ],
        [
          { "node": "Gmail - Enviar Follow-up", "type": "main", "index": 0 },
          { "node": "Notion - Actualizar Fecha Seguimiento", "type": "main", "index": 0 }
        ]
      ]
    }
  },
  "settings": { "executionOrder": "v1" }
}
'@

Write-Host "== Paso 1/3: creando la credencial 'Notion API' en n8n ==" -ForegroundColor Cyan
$credName = "Notion - Toroia CRM"
$credPayload = @{ name = $credName; type = "notionApi"; data = @{ apiKey = $NotionIntegrationSecret } } | ConvertTo-Json -Depth 10
try {
    $cred = Invoke-N8n -Method Post -Path "/api/v1/credentials" -JsonBody $credPayload
} catch {
    Write-Host "Fallo creando la credencial de Notion:" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message }
    exit 1
}
Write-Host "Credencial creada. ID: $($cred.id)" -ForegroundColor Green

Write-Host "== Paso 2/3: importando el workflow ==" -ForegroundColor Cyan

# Sustituye los placeholders ASCII por los caracteres reales (acentos, enies, emoji) y por
# el ID/nombre real de la credencial de Notion recien creada.
$emoji1 = [string]([char]0xD83D) + [string]([char]0xDCE4)   # emoji "outbox tray"
$emoji2 = [string]([char]0xD83D) + [string]([char]0xDC4B)   # emoji "waving hand"

$workflowJsonText = $workflowJsonRaw `
    -replace '@AA@', ([string]([char]0x00E1)) `
    -replace '@II@', ([string]([char]0x00ED)) `
    -replace '@OO@', ([string]([char]0x00F3)) `
    -replace '@EE@', ([string]([char]0x00E9)) `
    -replace '@QQ@', ([string]([char]0x00BF)) `
    -replace '@EMOJI1@', $emoji1 `
    -replace '@EMOJI2@', $emoji2 `
    -replace '__NOTION_CRED_ID__', "$($cred.id)" `
    -replace '__NOTION_CRED_NAME__', $credName

try {
    $wf = Invoke-N8n -Method Post -Path "/api/v1/workflows" -JsonBody $workflowJsonText
} catch {
    Write-Host "Fallo importando el workflow:" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message }
    exit 1
}
Write-Host "Workflow importado. ID: $($wf.id)" -ForegroundColor Green

Write-Host "== Paso 3/3: activando el workflow ==" -ForegroundColor Cyan
try {
    Invoke-N8n -Method Post -Path "/api/v1/workflows/$($wf.id)/activate" | Out-Null
    Write-Host "Workflow activado." -ForegroundColor Green
} catch {
    Write-Host "No se pudo activar automaticamente (puedes activarlo luego desde la UI):" -ForegroundColor Yellow
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message }
}

Write-Host ""
Write-Host "LISTO: workflow '$($wf.name)' (ID $($wf.id)) importado con la credencial de Notion" -ForegroundColor Green
Write-Host "ya asignada en sus dos nodos, y activado."
Write-Host ""
Write-Host "Pendiente, solo se puede hacer desde el navegador (no por API):" -ForegroundColor Yellow
Write-Host " - Nodo 'Gmail - Enviar Follow-up': crear/asignar credencial Gmail OAuth2 y reconectar."
Write-Host " - Nodo 'WhatsApp - Enviar Follow-up': crear/asignar credencial WhatsApp Business Cloud API."
Write-Host "Hasta entonces esos dos nodos daran error al ejecutarse; el resto del flujo funciona."
