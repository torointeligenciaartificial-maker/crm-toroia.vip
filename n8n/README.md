# Automatizaciones n8n — Toroia

Este directorio versiona (pero no despliega) los workflows de n8n usados junto al CRM.
**No hay ninguna integración automática entre este repo y la instancia n8n de EasyPanel** —
los JSON de aquí se importan manualmente desde la UI de n8n (`Workflows → Import from File/URL`).

## 1. Arreglar "Connection lost" en "Facturas - Gmail a Drive y Sheets"

Ese error en nodos de Google Drive/Sheets casi siempre es un token OAuth2 caducado o revocado.
Pasos en la UI de n8n (`n8n-n8n.juoo4o.easypanel.host`):

1. Ve a **Credentials** → abre la credencial de Google usada por esos nodos (revisa si Drive y
   Sheets comparten la misma credencial o son distintas — a veces solo una está rota).
2. Pulsa **Reconnect** / **Sign in with Google** y completa el consentimiento OAuth de nuevo.
   Esto solo lo puedes hacer tú, ya que exige tu sesión de Google.
3. Si el botón de reconexión falla o no aparece, causas típicas:
   - El **OAuth Consent Screen** en Google Cloud Console está en modo **Testing**: los refresh
     tokens caducan a los 7 días. Solución: publicar la app (External → In production) o, si es
     interno, añadir tu cuenta como *test user* de nuevo y reconectar.
   - Cambió la **URL pública** de la instancia (redeploy en EasyPanel) y el *Authorized redirect
     URI* configurado en Google Cloud Console (`https://n8n-n8n.juoo4o.easypanel.host/rest/oauth2-credential/callback`)
     ya no coincide. Revísalo en el proyecto de Google Cloud.
   - Reloj del contenedor desincronizado (poco común en EasyPanel, pero rompe la validación del token).
4. Tras reconectar, abre el workflow y pulsa **Execute workflow** (o reintenta la última ejecución
   fallida desde **Executions**) para confirmar que Drive y Sheets ya responden.

## 2. Workflow nuevo: `toroia-seguimiento-crm.json`

Corrige varios problemas del JSON base que se compartió (no era importable tal cual):
faltaba el bloque `connections`, faltaban `id`/`typeVersion`/`position` en los nodos, el IF usaba
sintaxis de condiciones obsoleta, `$now.minus(48,'hours')` no es una expresión válida de n8n, el
Switch no tenía reglas, y no existía ningún nodo para enviar por WhatsApp.

También añade una condición que el JSON original no tenía: sin ella, cada lead con más de 48h
seguiría dentro del filtro y **reenviaría el follow-up cada 15 minutos para siempre**. Por eso el
nodo IF comprueba también que `Fecha Seguimiento` esté vacía (además de `Fecha Contacto` > 48h).

### Importar

**Opción A — manual:** `n8n → Workflows → ⋯ → Import from File` y selecciona `toroia-seguimiento-crm.json`.

**Opción B — por API**, usando los scripts en `n8n/scripts/` (útil si nadie va a abrir la UI
todavía). Requieren una API key de n8n (`Settings → n8n API → Create an API key`) y que ejecutes
los comandos desde una máquina que sí tenga salida de red hacia tu instancia:

```bash
cd n8n/scripts
N8N_API_KEY="tu-api-key" ./import-workflow.sh
# crea la credencial de Notion (API key estática, no requiere OAuth):
N8N_API_KEY="tu-api-key" NOTION_INTEGRATION_SECRET="secret_xxx" ./create-notion-credential.sh
# tras asignar credenciales en la UI a Gmail/WhatsApp, activa el workflow:
N8N_API_KEY="tu-api-key" WORKFLOW_ID="<id devuelto por import-workflow.sh>" ./activate-workflow.sh
```

La API de n8n puede importar el workflow y crear la credencial de Notion (usa una API key
estática), pero **no puede completar el login OAuth2 de Gmail ni el alta de WhatsApp Business** —
eso exige el consentimiento interactivo en el navegador, así que esos dos siguen siendo manuales
en la UI tras la importación.

### Credenciales a configurar en n8n (no puedo crearlas yo — necesito acceso a tu instancia)

- **Notion API** (nodos "Notion - Leer Prioritarios" y "Notion - Actualizar Fecha Seguimiento"):
  1. En notion.so → Settings → Connections → **Develop or manage integrations** → crea una
     integración interna, copia el *Internal Integration Secret*.
  2. En la base de datos "📋 CRM — Prospectos y Pipeline" en Notion, pulsa **···** → **Connections**
     → añade esa integración (si no la compartes con la integración, n8n dará 403/objeto no
     encontrado aunque el token sea correcto).
  3. En n8n, crea credential tipo **Notion API** y pega el secret.
  4. Asigna esa credential en ambos nodos Notion del workflow importado (el JSON trae el nombre
     `Notion - Toroia CRM` como referencia, pero tendrás que reseleccionarla del desplegable).

- **Gmail OAuth2** (nodo "Gmail - Enviar Follow-up"): una vez arreglada la reconexión de Google del
  punto 1, puedes reutilizar la misma credencial OAuth2 (si incluye el scope de Gmail) o crear una
  nueva credential **Gmail OAuth2** y reconectar con la cuenta que debe enviar los follow-ups.

- **WhatsApp Business Cloud API** (nodo "WhatsApp - Enviar Follow-up"): requiere una app de Meta
  for Developers con el producto WhatsApp Business habilitado, un número verificado y un token de
  acceso permanente. Esto es una integración externa nueva que no existía antes — si no la tienes
  montada, dímelo y dejamos esa rama en pausa (puedes desactivar el nodo o dejar el fallback del
  Switch para que todo vaya por Gmail mientras tanto).

### Notas del mapeo de campos (verificado contra el data source real de Notion)

Todos estos son campos tipo *select* de una sola opción: `Estado`, `Canal`, `Sector`, `Prioridad`,
`Zona`, `Objeción Principal`. `Empresa` es el *title*. `Fecha Contacto` / `Fecha Seguimiento` son
*date*. `Inversión Estimada` es *number* (formato euro). El envío usa además `Email` y `Teléfono`
(no estaban en el JSON base, pero sin ellos no hay a quién escribir).

### Comprobación en vivo (17 jul 2026)

Consulté el data source `99bae6ce-57a4-4bf8-ab9c-179ce289fe4e` directamente: **no hay ningún lead
con `Estado = "📤 Enviado"` ahora mismo** (160 en "🔵 No contactado", 1 en "⏸ En pausa", 34 sin
Estado). Para probar con un lead real:

1. En Notion, coge un lead de prueba, rellena `Email` (y `Teléfono` si vas a probar la rama
   WhatsApp), pon `Estado = 📤 Enviado`, `Fecha Contacto` a una fecha/hora hace más de 48h, y deja
   `Fecha Seguimiento` vacía.
2. En n8n, abre el workflow importado y pulsa **Execute workflow** manualmente (o espera al
   trigger de 15 min si ya está activo).
3. Verifica: llega el email (o WhatsApp), y `Fecha Seguimiento` en Notion se actualiza a la hora
   actual — con eso, esa ejecución ya no debería reenviar el follow-up.

Puedo ayudarte a preparar ese lead de prueba en Notion si me confirmas cuál usar; no lo he tocado
porque son datos reales de tu pipeline.
