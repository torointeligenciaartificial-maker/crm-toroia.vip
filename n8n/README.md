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

### Historial: cómo se llegó a la conexión actual del nodo "Notion - Actualizar Fecha Seguimiento"

Este workflow tuvo un bug real en producción (documentado en el traspaso de campaña, sección 5):
el nodo final actualizaba siempre la misma página de Notion ("GES-On Asesoría") sin importar qué
lead se estuviera procesando. Dos intentos de arreglo y por qué el segundo tampoco bastaba:

1. **`{{ $('Notion - Leer Prioritarios').item.json.id }}`** (referencia hacia atrás por nombre de
   nodo): depende de que n8n mantenga la cadena de `pairedItem` a través de todos los nodos
   intermedios. El nodo **IF** de este flujo no la propaga de forma fiable, así que la expresión
   caía en el fallback silencioso de n8n al **índice 0** del array de salida de "Notion - Leer
   Prioritarios" — de ahí que siempre resolviera al mismo registro fijo, sin lanzar ningún error.
2. **`{{ $json.id }}`** justo después de Gmail/WhatsApp: tampoco funciona, porque esos nodos
   sustituyen el JSON del item por su propia respuesta (id de mensaje/thread de Gmail, no la
   página de Notion) — el campo `id` en ese punto ya no es el de Notion.

**Fix aplicado:** en vez de depender de cualquier referencia hacia atrás, "Notion - Actualizar
Fecha Seguimiento" cuelga **en paralelo, directamente del nodo Switch** (no de Gmail/WhatsApp):

```
Switch ─┬─→ WhatsApp - Enviar Follow-up
        ├─→ Gmail - Enviar Follow-up
        ├─→ Notion - Actualizar Fecha Seguimiento   (rama WhatsApp)
        └─→ Notion - Actualizar Fecha Seguimiento   (rama Email/Otro)
```

Así, `$json` en el nodo de actualización es siempre el item que salió del Switch — el lead de
Notion sin tocar, con su `id` propio — y `pageId = {{ $json.id }}` es correcto sin depender de
`pairedItem` ni de índices. Trade-off aceptado: la actualización de `Fecha Seguimiento` ocurre en
paralelo al envío, no "solo si el envío tuvo éxito"; para eso haría falta un nodo Merge, pendiente
como mejora futura, no bloqueante para esta campaña.

**Para aplicar este arreglo sobre un workflow que ya está importado y activo en n8n** (en vez de
reimportarlo entero, lo que pisaría las credenciales que ya hayas asignado a mano en la UI), usa
`n8n/scripts/fix-notion-update-connections.ps1`: lee la definición real del workflow por su
nombre, parchea solo las conexiones de "Notion - Actualizar Fecha Seguimiento" y confirma el
`pageId`, y guarda de vuelta sin tocar nada más.

```powershell
cd n8n\scripts
.\fix-notion-update-connections.ps1 -N8nApiKey "tu-api-key"
```

No hace falta "ejecutar ahora" por API — la API pública de n8n no expone ese endpoint. Como el
Schedule Trigger ya está activo cada 15 min, basta con esperar al próximo tick (o pulsar tú mismo
**Execute workflow** en el editor para verlo al instante).

### Validado en producción (workflow id `kCduUVOpq2bBI5cD`)

Confirmado con datos reales el 31/07/2026: tras aplicar el patch de arriba, con un lead de
prueba (`Fecha Contacto` forzada a >48h), `Fecha Seguimiento` se actualizó en el registro correcto
y el email de seguimiento llegó a la bandeja. También se comparó el `connections` real del
workflow (vía `GET /api/v1/workflows/{id}`) contra este repo: coincide exactamente en el nodo
`Notion - Actualizar Fecha Seguimiento` (en paralelo del Switch, ambas salidas) y en `pageId`.

Única diferencia, intencional: en producción, la salida `WhatsApp` del Switch apunta a un nodo
`If` inerte en vez de a `WhatsApp - Enviar Follow-up`, como workaround temporal mientras no exista
credencial de WhatsApp Business (ver sección de credenciales más abajo). El JSON de este repo
mantiene el nodo `WhatsApp - Enviar Follow-up` real como diseño objetivo para cuando esa
credencial exista; si reimportas desde el repo, recuerda repetir ese desvío en producción (o
simplemente no activar esa rama) hasta entonces.

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

**Windows sin Git Bash/WSL:** usa los mismos scripts en versión PowerShell
(`import-workflow.ps1`, `create-notion-credential.ps1`, `activate-workflow.ps1`):

```powershell
cd n8n\scripts
.\import-workflow.ps1 -N8nApiKey "tu-api-key"
.\create-notion-credential.ps1 -N8nApiKey "tu-api-key" -NotionIntegrationSecret "secret_xxx"
.\activate-workflow.ps1 -N8nApiKey "tu-api-key" -WorkflowId "<id devuelto por import-workflow.ps1>"
```

Si PowerShell bloquea la ejecución de scripts locales, ejecuta antes (en esa misma sesión):
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.

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
