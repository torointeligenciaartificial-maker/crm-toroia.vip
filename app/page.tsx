import { 
  getClientsCount, 
  getDeals, 
  getClients, 
  createClient, 
  createDeal, 
  updateDealStage, 
  deleteDeal, 
  deleteClient,
  getTasksForDeal,
  toggleTask,
  initializeOnboardingTasks,
  updateClient,
  updateDeal,
  getSetting,
  saveSetting,
  getInteractions,
  createInteraction,
  deleteInteraction,
  createTask,
  deleteTask
} from './lib/db';
import { generateEmail } from './lib/emails';
import CopyButton from './components/CopyButton';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{ 
    tab?: string; 
    emailClient?: string; 
    emailType?: string; 
    emailTone?: string;
    emailBullets?: string;
    dealClosed?: string;
    search?: string;
    editClient?: string;
    editDeal?: string;
    interactionClient?: string;
    dealDetail?: string;
  }>;
}

const n8nWorkflowJSON = JSON.stringify({
  "name": "Toroia CRM - Onboarding Automático",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "toroia-crm-deal-won",
        "responseMode": "lastNode",
        "options": {}
      },
      "id": "webhook-crm",
      "name": "Webhook CRM Toroia",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "channel": "#general",
        "text": "=🎉 *¡Trato ganado con éxito!*\\n\\n*Cliente:* {{ $json[\"clientName\"] }} ({{ $json[\"clientCompany\"] }})\\n*Proyecto:* {{ $json[\"title\"] }}\\n*Presupuesto:* €{{ $json[\"value\"] }}\\n\\nIniciando secuencia de onboarding automatizada... 🚀",
        "options": {}
      },
      "id": "slack-notify",
      "name": "Notificación Slack",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 2,
      "position": [480, 200]
    },
    {
      "parameters": {
        "resource": "folder",
        "name": "=Cliente - {{ $json[\"clientCompany\"] || $json[\"clientName\"] }} - {{ $json[\"title\"] }}",
        "options": {}
      },
      "id": "drive-folder",
      "name": "Crear Carpeta Drive",
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [480, 400]
    }
  ],
  "connections": {
    "Webhook CRM Toroia": {
      "main": [
        [
          {
            "node": "Notificación Slack",
            "type": "main",
            "index": 0
          },
          {
            "node": "Crear Carpeta Drive",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": true
}, null, 2);

export default async function Dashboard({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeTab = params.tab || 'dashboard';
  const emailClientId = params.emailClient;
  const emailType = params.emailType || 'bienvenida';
  const emailTone = params.emailTone || 'cercano';
  const emailBullets = params.emailBullets || '';
  const closedDealId = params.dealClosed;
  const searchQuery = params.search || '';
  const editClientId = params.editClient;
  const editDealId = params.editDeal;
  const interactionClientId = params.interactionClient;
  const dealDetailId = params.dealDetail;

  // Obtener datos de la DB local
  const clientsCount = getClientsCount();
  const deals = getDeals();
  const clients = getClients();

  const pipelineValue = deals.reduce((acc, deal) => acc + (deal.value || 0), 0);

  // Filtrar clientes si hay búsqueda
  const filteredClients = clients.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.services && c.services.toLowerCase().includes(q))
    );
  });

  const emailClient = emailClientId ? clients.find(c => c.id === emailClientId) : null;
  const generatedEmail = emailClient ? generateEmail(emailClient, emailType, emailTone, emailBullets) : null;
  
  // Trato cerrado y sus tareas de onboarding
  const closedDeal = closedDealId ? deals.find(d => d.id === closedDealId) : null;
  const onboardingTasks = closedDeal ? getTasksForDeal(closedDeal.id) : [];

  // Fichas a editar
  const editClientObj = editClientId ? clients.find(c => c.id === editClientId) : null;
  const editDealObj = editDealId ? deals.find(d => d.id === editDealId) : null;

  // Interacciones del cliente seleccionado
  const interactionClientObj = interactionClientId ? clients.find(c => c.id === interactionClientId) : null;
  const clientInteractions = interactionClientId ? getInteractions(interactionClientId) : [];

  // Detalle del trato y tareas
  const dealDetailObj = dealDetailId ? deals.find(d => d.id === dealDetailId) : null;
  const dealTasks = dealDetailId ? getTasksForDeal(dealDetailId) : [];

  // Configuraciones de Webhooks
  const makeWebhook = getSetting('make_webhook') || '';
  const slackWebhook = getSetting('slack_webhook') || '';
  const n8nWebhook = getSetting('n8n_webhook') || '';
  const makeLastTest = getSetting('make_last_test') || '';
  const slackLastTest = getSetting('slack_last_test') || '';
  const n8nLastTest = getSetting('n8n_last_test') || '';

  // KPIs
  const wonDealsCount = deals.filter(d => d.stage === 'Ganado').length;
  const totalDealsCount = deals.length;
  const winRate = totalDealsCount > 0 ? Math.round((wonDealsCount / totalDealsCount) * 100) : 0;
  
  // Servicio estrella
  const serviceCounts: { [key: string]: number } = {};
  clients.forEach(c => {
    if (c.services) {
      const s = c.services.trim();
      serviceCounts[s] = (serviceCounts[s] || 0) + 1;
    }
  });
  let starService = '—';
  let maxCount = 0;
  Object.entries(serviceCounts).forEach(([svc, count]) => {
    if (count > maxCount) {
      maxCount = count;
      starService = svc;
    }
  });

  // Acciones de Servidor
  async function addDummyClient() {
    'use server';
    const newClient = createClient({
      name: 'Cliente Demo ' + Math.floor(Math.random() * 100),
      company: 'Empresa Test ' + Math.floor(Math.random() * 10),
      email: 'test@toroia.vip',
      services: 'Consultoría Digital y Automatización',
      budget: 1500 + Math.floor(Math.random() * 2000),
    });

    createDeal({
      title: 'Auditoría de Procesos ' + Math.floor(Math.random() * 10),
      value: newClient.budget || 1500,
      stage: 'Leads Nuevos',
      priority: 'Alta',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      clientId: newClient.id
    });

    revalidatePath('/');
  }

  async function addClientAction(formData: FormData) {
    'use server';
    const name = formData.get('name') as string;
    const company = formData.get('company') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const services = formData.get('services') as string;
    const budget = parseFloat(formData.get('budget') as string) || null;
    const nif = formData.get('nif') as string;
    const notes = formData.get('notes') as string;

    if (!name) return;

    createClient({
      name,
      company,
      email,
      phone,
      services,
      budget,
      nif,
      notes,
    });

    revalidatePath('/');
  }

  async function editClientAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const company = formData.get('company') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const services = formData.get('services') as string;
    const budget = parseFloat(formData.get('budget') as string) || null;
    const nif = formData.get('nif') as string;
    const notes = formData.get('notes') as string;

    if (!id || !name) return;

    updateClient(id, {
      name,
      company,
      email,
      phone,
      services,
      budget,
      nif,
      notes,
    });

    redirect('/?tab=clientes');
  }

  async function addDealAction(formData: FormData) {
    'use server';
    const title = formData.get('title') as string;
    const value = parseFloat(formData.get('value') as string) || null;
    const stage = formData.get('stage') as string || 'Leads Nuevos';
    const priority = formData.get('priority') as string || 'Media';
    const dueDate = formData.get('dueDate') as string || null;
    const clientId = formData.get('clientId') as string;

    if (!title || !clientId) return;

    createDeal({
      title,
      value,
      stage,
      priority,
      dueDate,
      clientId,
    });

    revalidatePath('/');
  }

  async function editDealAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const value = parseFloat(formData.get('value') as string) || null;
    const stage = formData.get('stage') as string || 'Leads Nuevos';
    const priority = formData.get('priority') as string || 'Media';
    const dueDate = formData.get('dueDate') as string || null;
    const clientId = formData.get('clientId') as string;

    if (!id || !title || !clientId) return;

    updateDeal(id, {
      title,
      value,
      stage,
      priority,
      dueDate,
      clientId,
    });

    redirect('/?tab=pipeline');
  }

  async function updateDealStageAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const stage = formData.get('stage') as string;
    if (!id || !stage) return;

    updateDealStage(id, stage);
    
    if (stage === 'Ganado') {
      initializeOnboardingTasks(id);

      // Desencadenar automatización de webhooks
      const deal = getDeals().find(d => d.id === id);
      if (deal) {
        const makeUrl = getSetting('make_webhook');
        const slackUrl = getSetting('slack_webhook');
        const n8nUrl = getSetting('n8n_webhook');
        const payload = {
          event: 'deal_won',
          dealId: deal.id,
          title: deal.title,
          value: deal.value,
          clientName: deal.client?.name,
          clientCompany: deal.client?.company,
          clientEmail: deal.client?.email,
          timestamp: new Date().toISOString()
        };

        if (makeUrl && (makeUrl.startsWith('http://') || makeUrl.startsWith('https://'))) {
          try {
            await fetch(makeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } catch (e) {
            console.error('Make webhook error:', e);
          }
        }

        if (slackUrl && (slackUrl.startsWith('http://') || slackUrl.startsWith('https://'))) {
          try {
            await fetch(slackUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: `🎉 *¡Trato Ganado!* \n*Proyecto:* ${deal.title}\n*Cliente:* ${deal.client?.name} (${deal.client?.company || 'Sin Empresa'})\n*Valor:* €${deal.value?.toLocaleString()}`
              })
            });
          } catch (e) {
            console.error('Slack webhook error:', e);
          }
        }

        if (n8nUrl && (n8nUrl.startsWith('http://') || n8nUrl.startsWith('https://'))) {
          try {
            await fetch(n8nUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } catch (e) {
            console.error('n8n webhook error:', e);
          }
        }
      }

      redirect(`/?tab=pipeline&dealClosed=${id}`);
    } else {
      revalidatePath('/');
    }
  }

  async function toggleTaskAction(formData: FormData) {
    'use server';
    const taskId = formData.get('taskId') as string;
    const completed = parseInt(formData.get('completed') as string) || 0;
    const dealId = formData.get('dealId') as string;

    if (!taskId || !dealId) return;

    toggleTask(taskId, completed);
    redirect(`/?tab=pipeline&dealClosed=${dealId}`);
  }

  async function deleteDealAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (!id) return;

    deleteDeal(id);
    revalidatePath('/');
  }

  async function deleteClientAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (!id) return;

    deleteClient(id);
    revalidatePath('/');
  }

  async function saveSettingsAction(formData: FormData) {
    'use server';
    const make_webhook = formData.get('make_webhook') as string;
    const slack_webhook = formData.get('slack_webhook') as string;
    const n8n_webhook = formData.get('n8n_webhook') as string;
    saveSetting('make_webhook', make_webhook || '');
    saveSetting('slack_webhook', slack_webhook || '');
    saveSetting('n8n_webhook', n8n_webhook || '');
    redirect('/?tab=ajustes');
  }

  async function testWebhookAction(formData: FormData) {
    'use server';
    const type = formData.get('type') as string;
    const url = formData.get('url') as string;
    if (!url) return;

    try {
      const payload = {
        event: 'test_connection',
        source: 'toroia.vip CRM test console',
        timestamp: new Date().toISOString(),
        testData: {
          msg: "Hola desde tu CRM de Automatizaciones. ¡La conexión funciona!",
          platform: type
        }
      };
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(type === 'slack' ? { text: `⚡ *Prueba de conexión exitosa* desde tu CRM de toroia.vip.` } : payload)
      });
      
      saveSetting(type + '_last_test', `Última prueba: ${new Date().toLocaleTimeString()} - Status ${res.status}`);
    } catch (err: any) {
      saveSetting(type + '_last_test', `Error: ${err.message || err}`);
    }
    redirect('/?tab=ajustes');
  }

  async function createInteractionAction(formData: FormData) {
    'use server';
    const clientId = formData.get('clientId') as string;
    const type = formData.get('type') as string;
    const content = formData.get('content') as string;
    if (!clientId || !type || !content) return;
    createInteraction(clientId, type, content);
    redirect(`/?tab=clientes&interactionClient=${clientId}`);
  }

  async function deleteInteractionAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const clientId = formData.get('clientId') as string;
    if (!id || !clientId) return;
    deleteInteraction(id);
    redirect(`/?tab=clientes&interactionClient=${clientId}`);
  }

  async function createTaskAction(formData: FormData) {
    'use server';
    const dealId = formData.get('dealId') as string;
    const description = formData.get('description') as string;
    if (!dealId || !description) return;
    createTask(dealId, description);
    redirect(`/?tab=pipeline&dealDetail=${dealId}`);
  }

  async function deleteTaskAction(formData: FormData) {
    'use server';
    const taskId = formData.get('taskId') as string;
    const dealId = formData.get('dealId') as string;
    if (!taskId || !dealId) return;
    deleteTask(taskId);
    redirect(`/?tab=pipeline&dealDetail=${dealId}`);
  }

  async function toggleTaskDetailAction(formData: FormData) {
    'use server';
    const taskId = formData.get('taskId') as string;
    const completed = parseInt(formData.get('completed') as string) || 0;
    const dealId = formData.get('dealId') as string;
    if (!taskId || !dealId) return;
    toggleTask(taskId, completed);
    redirect(`/?tab=pipeline&dealDetail=${dealId}`);
  }

  // Fases del Pipeline
  const stages = ['Leads Nuevos', 'En Contacto', 'Propuesta Enviada', 'Ganado'];

  // Estadísticas del embudo
  const stageStats = stages.map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage);
    const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    return {
      stage,
      count: stageDeals.length,
      value: totalValue
    };
  });

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans relative">
      
      {/* MODAL EDITAR CLIENTE */}
      {editClientObj && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4">✏️ Editar Ficha Cliente</h2>
            
            <form action={editClientAction} className="space-y-4">
              <input type="hidden" name="id" value={editClientObj.id} />
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre Completo *</label>
                <input required name="name" defaultValue={editClientObj.name} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Empresa</label>
                <input name="company" defaultValue={editClientObj.company || ''} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">NIF / CIF</label>
                  <input name="nif" defaultValue={editClientObj.nif || ''} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Presupuesto (€)</label>
                  <input name="budget" type="number" defaultValue={editClientObj.budget || ''} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
                  <input name="email" type="email" defaultValue={editClientObj.email || ''} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Teléfono</label>
                  <input name="phone" defaultValue={editClientObj.phone || ''} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Servicios Contratados</label>
                <input name="services" defaultValue={editClientObj.services || ''} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notas Internas</label>
                <textarea name="notes" defaultValue={editClientObj.notes || ''} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"></textarea>
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <a href="?tab=clientes" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors">
                  Cancelar
                </a>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR TRATO */}
      {editDealObj && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4">✏️ Editar Oportunidad</h2>
            
            <form action={editDealAction} className="space-y-4">
              <input type="hidden" name="id" value={editDealObj.id} />
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Título del trato *</label>
                <input required name="title" defaultValue={editDealObj.title} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Valor Comercial (€)</label>
                  <input name="value" type="number" defaultValue={editDealObj.value || ''} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Prioridad</label>
                  <select name="priority" defaultValue={editDealObj.priority} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    <option value="Alta">🔴 Alta</option>
                    <option value="Media">🟡 Media</option>
                    <option value="Baja">🟢 Baja</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Fase Comercial</label>
                  <select name="stage" defaultValue={editDealObj.stage} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    {stages.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha Límite</label>
                  <input name="dueDate" type="date" defaultValue={editDealObj.dueDate || ''} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Asociar Cliente *</label>
                <select name="clientId" defaultValue={editDealObj.clientId} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <a href="?tab=pipeline" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors">
                  Cancelar
                </a>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TIMELINE INTERACCIONES */}
      {interactionClientObj && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-end z-50 animate-fadeIn">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-lg h-full shadow-2xl flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">LÍNEA DE TIEMPO</span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">👥 {interactionClientObj.name}</h2>
                <p className="text-xs text-slate-400">{interactionClientObj.company || 'Sin Empresa'}</p>
              </div>
              <a href="?tab=clientes" className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all">
                Cerrar ×
              </a>
            </div>

            {/* Formulario Nueva Interacción */}
            <div className="py-4 border-b border-slate-800/60">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Registrar Nueva Interacción</h3>
              <form action={createInteractionAction} className="space-y-3">
                <input type="hidden" name="clientId" value={interactionClientObj.id} />
                <div className="grid grid-cols-4 gap-2">
                  {['📞 Llamada', '📅 Reunión', '📧 Email', '📝 Nota'].map(type => (
                    <label key={type} className="flex flex-col items-center justify-center p-2 border border-slate-800 hover:border-indigo-500/50 bg-slate-950/50 rounded-xl cursor-pointer text-[10px] font-bold text-slate-400 hover:text-white transition-all [&:has(input:checked)]:bg-indigo-600/10 [&:has(input:checked)]:border-indigo-500 [&:has(input:checked)]:text-indigo-300">
                      <input type="radio" name="type" value={type.split(' ')[1]} defaultChecked={type.includes('Nota')} className="sr-only" />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <textarea 
                    name="content" 
                    required 
                    rows={2} 
                    placeholder="Detalles de la interacción..." 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  ></textarea>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer">
                    Añadir al Timeline
                  </button>
                </div>
              </form>
            </div>

            {/* Timeline Scrollable */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Historial de Contacto</h3>
              {clientInteractions.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-600 italic">
                  No hay interacciones registradas.
                </div>
              ) : (
                <div className="relative border-l border-slate-800 ml-3.5 space-y-5">
                  {clientInteractions.map(interaction => (
                    <div key={interaction.id} className="relative pl-6 group">
                      {/* Timeline Dot */}
                      <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500 border border-slate-900 shadow-md"></span>
                      
                      <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5 hover:border-slate-800 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            interaction.type === 'Llamada' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30' :
                            interaction.type === 'Reunión' ? 'bg-amber-950 text-amber-400 border border-amber-800/30' :
                            interaction.type === 'Email' ? 'bg-blue-950 text-blue-400 border border-blue-800/30' :
                            'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}>
                            {interaction.type === 'Llamada' && '📞'} {interaction.type === 'Reunión' && '📅'} {interaction.type === 'Email' && '📧'} {interaction.type === 'Nota' && '📝'} {interaction.type}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500">
                              {new Date(interaction.createdAt).toLocaleDateString('es-ES')} {new Date(interaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <form action={deleteInteractionAction}>
                              <input type="hidden" name="id" value={interaction.id} />
                              <input type="hidden" name="clientId" value={interaction.clientId} />
                              <button type="submit" className="text-slate-600 hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar registro">
                                🗑️
                              </button>
                            </form>
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{interaction.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE TRATO / TAREAS */}
      {dealDetailObj && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="flex justify-between items-start pb-4 border-b border-slate-800">
              <div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border mb-1.5 inline-block ${
                  dealDetailObj.priority === 'Alta' ? 'bg-rose-950/60 text-rose-400 border-rose-800/50' : 
                  dealDetailObj.priority === 'Baja' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50' : 
                  'bg-amber-950/60 text-amber-400 border-amber-800/50'
                }`}>
                  Prioridad: {dealDetailObj.priority}
                </span>
                <h2 className="text-xl font-extrabold text-white">{dealDetailObj.title}</h2>
                <p className="text-xs text-slate-400 mt-1">Cliente: <strong className="text-indigo-400">{dealDetailObj.client?.name || 'Cliente Desconocido'}</strong> {dealDetailObj.client?.company ? `(${dealDetailObj.client.company})` : ''}</p>
                {dealDetailObj.value && (
                  <p className="text-sm font-black text-emerald-400 mt-0.5">Valor estimado: €{dealDetailObj.value.toLocaleString()}</p>
                )}
              </div>
              <a href="?tab=pipeline" className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all">
                Cerrar ×
              </a>
            </div>

            {/* Checklist Section */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Tareas y Lista de Seguimiento</h3>
                <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">
                  {dealTasks.filter(t => t.completed).length}/{dealTasks.length} completadas
                </span>
              </div>

              {/* Tasks List */}
              <div className="space-y-2">
                {dealTasks.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-600 italic border border-dashed border-slate-800 rounded-xl">
                    No hay tareas creadas para esta oportunidad. Añade una debajo.
                  </div>
                ) : (
                  dealTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl hover:border-slate-800 transition-colors group">
                      <form action={toggleTaskDetailAction} className="flex items-center gap-3 flex-1">
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="dealId" value={dealDetailObj.id} />
                        <input type="hidden" name="completed" value={task.completed ? '0' : '1'} />
                        <button type="submit" className="flex items-center gap-3 text-left w-full cursor-pointer">
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                            task.completed 
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                              : 'border-slate-700 bg-slate-950 text-transparent'
                          }`}>
                            ✓
                          </div>
                          <span className={`text-xs ${task.completed ? 'line-through text-slate-500 font-normal' : 'text-slate-200 font-medium'}`}>
                            {task.description}
                          </span>
                        </button>
                      </form>

                      <form action={deleteTaskAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="dealId" value={dealDetailObj.id} />
                        <button type="submit" className="text-slate-600 hover:text-red-400 p-1 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar tarea">
                          🗑️
                        </button>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add Task Form */}
            <div className="pt-4 border-t border-slate-800">
              <form action={createTaskAction} className="flex gap-2">
                <input type="hidden" name="dealId" value={dealDetailObj.id} />
                <input 
                  name="description" 
                  required 
                  placeholder="Ej: Enviar primera propuesta..." 
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white flex-1 focus:outline-none focus:border-indigo-500 transition-colors" 
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer">
                  Añadir Tarea
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900/50 border-r border-slate-800 backdrop-blur-md flex flex-col p-6 shrink-0 z-10">
        <div className="flex items-center gap-3 text-xl font-bold mb-10 text-indigo-400">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <span className="text-indigo-400 font-extrabold">T</span>
          </div>
          toroia.vip
        </div>
        
        <nav className="flex flex-col gap-1.5 flex-1">
          <a 
            href="?tab=dashboard" 
            className={`px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-3 ${
              activeTab === 'dashboard' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            📊 Dashboard
          </a>
          <a 
            href="?tab=clientes" 
            className={`px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-3 ${
              activeTab === 'clientes' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            👥 Clientes
          </a>
          <a 
            href="?tab=pipeline" 
            className={`px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-3 ${
              activeTab === 'pipeline' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            🚀 Pipeline
          </a>
          <a 
            href="?tab=ajustes" 
            className={`px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-3 ${
              activeTab === 'ajustes' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            ⚙️ Ajustes
          </a>
        </nav>

        <div className="mt-auto border-t border-slate-800/80 pt-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
              CD
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300">Consultoría Digital</p>
              <p className="text-[10px] text-slate-500">toroia.vip © 2026</p>
            </div>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-10 overflow-y-auto max-w-7xl mx-auto w-full z-10">
        
        {/* CABECERA */}
        <header className="flex justify-between items-start mb-8">
          <div>
            <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase">CRM INTERNO</span>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mt-1">
              {activeTab === 'dashboard' && 'Panel Principal'}
              {activeTab === 'clientes' && 'Gestión de Clientes'}
              {activeTab === 'pipeline' && 'Embudo de Ventas'}
              {activeTab === 'ajustes' && 'Configuración de Automatizaciones'}
            </h1>
            <p className="text-slate-400 mt-1">
              {activeTab === 'dashboard' && 'Resumen de tu consultoría y automatizaciones.'}
              {activeTab === 'clientes' && 'Fichas detalladas y servicios contratados.'}
              {activeTab === 'pipeline' && 'Controla el estado de tus oportunidades comerciales.'}
              {activeTab === 'ajustes' && 'Gestión de webhooks e integraciones con Make.com, Zapier y Slack.'}
            </p>
          </div>

          <div className="flex gap-3">
            <form action={addDummyClient}>
              <button 
                type="submit" 
                className="px-4 py-2 bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 transition-all rounded-xl font-medium text-sm flex items-center gap-2 cursor-pointer"
              >
                ✨ Rellenar Demo Fast
              </button>
            </form>
          </div>
        </header>

        {/* METRICAS GLOBALES */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 animate-fadeIn">
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full filter blur-xl"></div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">👥 Total Clientes</h3>
            <p className="text-4xl font-black text-white">{clientsCount}</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full filter blur-xl"></div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">💰 Valor Pipeline</h3>
            <p className="text-4xl font-black text-emerald-400">€{pipelineValue.toLocaleString()}</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full filter blur-xl"></div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">📈 Conversión</h3>
            <p className="text-4xl font-black text-amber-400">{winRate}%</p>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full filter blur-xl"></div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">🚀 Servicio Estrella</h3>
            <p className="text-lg font-black text-white mt-2 truncate" title={starService}>{starService}</p>
          </div>
        </div>

        {/* VISTAS DINÁMICAS */}

        {/* 1. DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start animate-fadeIn">
            
            {/* FUNNEL DE VENTAS */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-6 md:col-span-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">📊 Embudo Comercial (Funnel)</h3>
              <div className="space-y-4">
                {stageStats.map(stat => {
                  const percentage = pipelineValue > 0 ? (stat.value / pipelineValue) * 100 : 0;
                  return (
                    <div key={stat.stage} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-300">{stat.stage} ({stat.count})</span>
                        <span className="font-bold text-slate-400">€{stat.value.toLocaleString()} ({Math.round(percentage)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800/50 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            stat.stage === 'Ganado' 
                              ? 'bg-emerald-500 shadow-md shadow-emerald-500/20' 
                              : stat.stage === 'Propuesta Enviada'
                              ? 'bg-indigo-500 shadow-md shadow-indigo-500/20'
                              : stat.stage === 'En Contacto'
                              ? 'bg-amber-500 shadow-md shadow-amber-500/20'
                              : 'bg-slate-600'
                          }`}
                          style={{ width: `${Math.max(percentage, 2)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TABLA DE TRATOS RECIENTES */}
            <div className="md:col-span-2 space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">📈 Actividad Comercial Reciente</h2>
              
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
                {deals.length === 0 ? (
                  <div className="p-16 text-center text-slate-500">
                    No hay tratos en el pipeline todavía. Pulsa en <strong className="text-indigo-400">Rellenar Demo Fast</strong> para poblar la base de datos o ve a la pestaña de Clientes para añadirlos manualmente.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800/80">
                        <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Trato</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {deals.slice(0, 5).map(deal => (
                        <tr key={deal.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-semibold text-white">{deal.title}</td>
                          <td className="px-6 py-4 text-slate-300">{deal.client?.name || 'Cliente Desconocido'}</td>
                          <td className="px-6 py-4 font-bold text-emerald-400">€{deal.value?.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              deal.stage === 'Ganado' 
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50' 
                                : deal.stage === 'Propuesta Enviada'
                                ? 'bg-blue-950/60 text-blue-400 border-blue-800/50'
                                : deal.stage === 'En Contacto'
                                ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                                : 'bg-slate-900/60 text-slate-400 border-slate-700/50'
                            }`}>
                              {deal.stage}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        )}

        {/* 2. CLIENTES */}
        {activeTab === 'clientes' && (
          <div className="grid grid-cols-3 gap-8 items-start animate-fadeIn">
            
            {/* Formulario de Alta */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-lg font-bold text-white mb-2">➕ Nuevo Cliente</h2>
              <form action={addClientAction} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre Completo *</label>
                  <input required name="name" placeholder="Ej: Juan Pérez" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/80 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Empresa</label>
                  <input name="company" placeholder="Ej: Toroia Tech" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/80 transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">NIF / CIF</label>
                    <input name="nif" placeholder="B12345678" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/80 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Presupuesto (€)</label>
                    <input name="budget" type="number" placeholder="2500" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/80 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
                  <input name="email" type="email" placeholder="contacto@cliente.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/80 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Teléfono</label>
                  <input name="phone" placeholder="+34 600 000 000" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/80 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Servicios Contratados</label>
                  <input name="services" placeholder="Ej: Consultoría IA, Automatización" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/80 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Notas Internas</label>
                  <textarea name="notes" rows={2} placeholder="Contexto, requerimientos..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/80 transition-colors resize-none"></textarea>
                </div>
                <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white rounded-xl font-semibold text-sm cursor-pointer shadow-lg shadow-indigo-600/10">
                  Crear Ficha Cliente
                </button>
              </form>
            </div>

            {/* Listado de Clientes */}
            <div className="col-span-2 space-y-6">
              
              {/* Buscador de Clientes */}
              <form action="" method="GET" className="bg-slate-900/30 border border-slate-800/80 p-4 rounded-2xl flex gap-3 shadow-md">
                <input type="hidden" name="tab" value="clientes" />
                <input 
                  name="search" 
                  defaultValue={searchQuery}
                  placeholder="Buscar por nombre, empresa o servicio contratado..." 
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white flex-1 focus:outline-none focus:border-indigo-500 transition-colors" 
                />
                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer">
                  Buscar
                </button>
                {searchQuery && (
                  <a href="?tab=clientes" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center transition-all">
                    Limpiar
                  </a>
                )}
              </form>

              {/* Vista previa de Email Generado */}
              {generatedEmail && emailClient && (
                <div className="bg-slate-900/60 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl space-y-4 relative overflow-hidden animate-fadeIn">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full filter blur-2xl"></div>
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">EMAIL AUTOGENERADO</span>
                      <h3 className="text-lg font-bold text-white mt-0.5">Seguimiento: {emailClient.name}</h3>
                      <p className="text-xs text-slate-400">{emailClient.company || 'Sin Empresa'}</p>
                    </div>
                    
                    <a 
                      href="?tab=clientes" 
                      className="text-slate-400 hover:text-white transition-colors text-sm font-bold bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg"
                    >
                      Cerrar ×
                    </a>
                  </div>

                  {/* Selector de plantilla y personalización */}
                  <div className="flex flex-col gap-4">
                    <div className="flex gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 w-max">
                      <a 
                        href={`?tab=clientes&emailClient=${emailClient.id}&emailType=bienvenida&emailTone=${emailTone}&emailBullets=${encodeURIComponent(emailBullets)}`}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          emailType === 'bienvenida' 
                            ? 'bg-indigo-600 text-white' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        👋 Bienvenida
                      </a>
                      <a 
                        href={`?tab=clientes&emailClient=${emailClient.id}&emailType=seguimiento&emailTone=${emailTone}&emailBullets=${encodeURIComponent(emailBullets)}`}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          emailType === 'seguimiento' 
                            ? 'bg-indigo-600 text-white' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        📅 Seguimiento
                      </a>
                      <a 
                        href={`?tab=clientes&emailClient=${emailClient.id}&emailType=upsell&emailTone=${emailTone}&emailBullets=${encodeURIComponent(emailBullets)}`}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          emailType === 'upsell' 
                            ? 'bg-indigo-600 text-white' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🚀 Automatización IA
                      </a>
                    </div>

                    {/* Personalización por IA */}
                    <form action="" method="GET" className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                      <input type="hidden" name="tab" value="clientes" />
                      <input type="hidden" name="emailClient" value={emailClient.id} />
                      <input type="hidden" name="emailType" value={emailType} />
                      
                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-slate-500 font-bold uppercase">Tono del Mensaje</label>
                        <select 
                          name="emailTone" 
                          defaultValue={emailTone}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        >
                          <option value="cercano">😊 Cercano / Amigable</option>
                          <option value="formal">💼 Formal / Corporativo</option>
                          <option value="persuasivo">⚡ Persuasivo / Enfocado en ROI</option>
                          <option value="tecnico">🛠️ Técnico / Arquitectura API</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-slate-500 font-bold uppercase">Puntos clave a inyectar (uno por línea)</label>
                        <textarea 
                          name="emailBullets" 
                          defaultValue={emailBullets}
                          placeholder="Ej: - Lanzamiento en 10 días&#10;- Integraciones de Make.com"
                          rows={2}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                        ></textarea>
                      </div>

                      <div className="md:col-span-2 flex justify-end">
                        <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer">
                          🪄 Aplicar Refinamiento IA
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Caja de texto del email */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
                    <div className="border-b border-slate-800/60 pb-2.5">
                      <p className="text-xs text-slate-500 font-semibold uppercase">Asunto:</p>
                      <p className="text-sm font-bold text-white mt-0.5">{generatedEmail.subject}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Cuerpo del Mensaje:</p>
                      <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                        {generatedEmail.body}
                      </pre>
                    </div>
                  </div>

                  {/* Copiar */}
                  <div className="flex justify-end pt-1">
                    <CopyButton textToCopy={`Asunto: ${generatedEmail.subject}\n\n${generatedEmail.body}`} />
                  </div>

                </div>
              )}

              {/* Fichas de Clientes */}
              {filteredClients.length === 0 ? (
                <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-16 text-center text-slate-500">
                  {searchQuery ? 'No se encontraron clientes para esa búsqueda.' : 'No hay clientes registrados.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredClients.map(client => (
                    <div key={client.id} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 relative overflow-hidden shadow-lg hover:border-slate-700/80 transition-all flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-xl font-bold text-white">{client.name}</h3>
                            <a href={`?tab=clientes&editClient=${client.id}`} className="text-slate-500 hover:text-indigo-400 text-xs transition-colors" title="Editar Ficha">
                              ✏️
                            </a>
                          </div>
                          <p className="text-xs text-slate-400">{client.company || 'Sin Empresa'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {client.budget && (
                            <span className="bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">
                              €{client.budget.toLocaleString()}
                            </span>
                          )}
                          <form action={deleteClientAction}>
                            <input type="hidden" name="id" value={client.id} />
                            <button type="submit" className="text-slate-500 hover:text-red-400 transition-colors p-1 cursor-pointer" title="Eliminar Cliente">
                              🗑️
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs text-slate-300 mt-2 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
                        <div>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase">Email</p>
                          <p className="truncate">{client.email || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase">Teléfono</p>
                          <p>{client.phone || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase">Servicios</p>
                          <p className="truncate text-indigo-300 font-medium">{client.services || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase">NIF</p>
                          <p>{client.nif || '—'}</p>
                        </div>
                      </div>

                      {client.notes && (
                        <div className="mt-3 text-xs text-slate-400 bg-slate-950/30 p-3 rounded-lg border border-slate-800/40 italic">
                          "{client.notes}"
                        </div>
                      )}

                      {/* Botón para generar email y ver timeline */}
                      <div className="mt-4 pt-4 border-t border-slate-800/40 flex flex-wrap gap-2 justify-between items-center">
                        <div className="flex gap-2">
                          <a 
                            href={`?tab=clientes&emailClient=${client.id}&emailType=bienvenida`} 
                            className="px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Generar correo automatizado"
                          >
                            ✉️ Generar Email
                          </a>
                          <a 
                            href={`?tab=clientes&interactionClient=${client.id}`} 
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Ver línea de tiempo de contacto"
                          >
                            ⏳ Ver Historial
                          </a>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Actualizado: {new Date(client.updatedAt).toLocaleDateString('es-ES')}
                        </span>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* 3. PIPELINE (KANBAN BOARD) */}
        {activeTab === 'pipeline' && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Mensaje de Celebración / Cierre de Trato */}
            {closedDeal && (
              <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden animate-fadeIn">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-2xl"></div>
                
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🎉</span>
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">¡TRATO CERRADO CON ÉXITO!</span>
                      <h3 className="text-xl font-bold text-white mt-0.5">Felicidades, has ganado el trato: "{closedDeal.title}"</h3>
                      <p className="text-xs text-slate-400">Cliente: {closedDeal.client?.name} | Valor: <strong className="text-emerald-400">€{closedDeal.value?.toLocaleString()}</strong></p>
                    </div>
                  </div>
                  
                  <a 
                    href="?tab=pipeline" 
                    className="text-slate-400 hover:text-white transition-colors text-sm font-bold bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg"
                  >
                    Entendido ×
                  </a>
                </div>

                {/* Checklist de Onboarding */}
                <div className="bg-slate-950 border border-indigo-500/20 rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-bold tracking-wider text-indigo-400 uppercase flex items-center gap-2">
                    🛠️ Tareas de Onboarding y Automatización del Proyecto
                  </h4>
                  <p className="text-xs text-slate-400">Haz clic sobre las tareas para marcarlas como completadas y coordinar el lanzamiento:</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3">
                    {onboardingTasks.map(task => (
                      <form key={task.id} action={toggleTaskAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="dealId" value={closedDeal.id} />
                        <input type="hidden" name="completed" value={task.completed ? '0' : '1'} />
                        <button 
                          type="submit" 
                          className="flex items-center gap-3 text-left hover:bg-slate-900/40 p-2.5 rounded-xl border border-slate-900 bg-slate-900/10 hover:border-slate-800 transition-all w-full cursor-pointer"
                        >
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                            task.completed 
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                              : 'border-slate-700 bg-slate-950 text-transparent'
                          }`}>
                            ✓
                          </div>
                          <span className={`text-xs ${task.completed ? 'line-through text-slate-500 font-normal' : 'text-slate-200 font-semibold'}`}>
                            {task.description}
                          </span>
                        </button>
                      </form>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  {/* WhatsApp/Slack Card */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold uppercase flex items-center gap-1.5">
                        💬 Mensaje Rápido (WhatsApp / Slack)
                      </p>
                      <p className="text-sm text-slate-300 font-sans mt-2 italic bg-slate-900/40 p-3 rounded-lg border border-slate-800/40">
                        "¡Hola {closedDeal.client?.name}! Te confirmo que hemos cerrado con éxito el trato para el proyecto de '{closedDeal.title}'. ¡Estamos encantados de empezar a trabajar con vosotros y automatizar vuestros procesos! 🚀"
                      </p>
                    </div>
                    <div className="pt-2 flex justify-end">
                      <CopyButton textToCopy={`¡Hola ${closedDeal.client?.name}! Te confirmo que hemos cerrado con éxito el trato para el proyecto de '${closedDeal.title}'. ¡Estamos encantados de empezar a trabajar con vosotros y automatizar vuestros procesos! 🚀`} />
                    </div>
                  </div>

                  {/* Email Card */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold uppercase flex items-center gap-1.5">
                        📧 Confirmación Formal (Email)
                      </p>
                      <div className="text-xs text-slate-300 font-mono mt-2 bg-slate-900/40 p-3 rounded-lg border border-slate-800/40 space-y-1">
                        <p><strong className="text-slate-500">Asunto:</strong> Trato Cerrado – Inicio de proyecto de {closedDeal.title}</p>
                        <p className="mt-2 text-slate-400">
                          Hola {closedDeal.client?.name},<br/><br/>
                          Te confirmo formalmente que hemos cerrado con éxito el trato comercial para vuestro proyecto. Estamos muy ilusionados y ya preparando todo el material técnico para el kickoff.<br/><br/>
                          Un saludo cordial,<br/>
                          toroia.vip
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 flex justify-end">
                      <CopyButton textToCopy={`Asunto: Trato Cerrado – Inicio de proyecto de ${closedDeal.title}\n\nHola ${closedDeal.client?.name},\n\nTe confirmo formalmente que hemos cerrado con éxito el trato comercial para vuestro proyecto. Estamos muy ilusionados y ya preparando todo el material técnico para el kickoff.\n\nUn saludo cordial,\ntoroia.vip`} />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Formulario rápido para añadir trato */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h2 className="text-base font-bold text-white">🚀 Añadir Nueva Oportunidad</h2>
              <form action={addDealAction} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Título del trato *</label>
                  <input required name="title" placeholder="Ej: Integración CRM..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Valor Comercial (€)</label>
                  <input name="value" type="number" placeholder="Ej: 2000" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Prioridad</label>
                  <select name="priority" defaultValue="Media" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    <option value="Alta">🔴 Alta</option>
                    <option value="Media">🟡 Media</option>
                    <option value="Baja">🟢 Baja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Asociar Cliente *</label>
                  <select required name="clientId" defaultValue="" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    <option value="" disabled>Asociar Cliente...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-5 flex justify-between items-center pt-2 border-t border-slate-800/40">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase mr-2">Fecha Estimada de Cierre:</label>
                    <input name="dueDate" type="date" className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                  <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white rounded-xl font-bold text-sm cursor-pointer shadow-lg shadow-indigo-600/10">
                    Añadir Trato
                  </button>
                </div>
              </form>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-4 gap-4 items-start">
              {stages.map(stage => {
                const stageDeals = deals.filter(d => d.stage === stage);
                return (
                  <div key={stage} className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-[500px]">
                    
                    {/* Cabecera Columna */}
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800/50">
                      <h3 className="font-bold text-slate-200 text-sm tracking-wide flex items-center gap-2">
                        {stage}
                      </h3>
                      <span className="bg-slate-800/80 border border-slate-700/50 text-slate-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        {stageDeals.length}
                      </span>
                    </div>

                    {/* Tarjetas de Tratos */}
                    <div className="space-y-3 flex-1 overflow-y-auto">
                      {stageDeals.map(deal => {
                        const currentStageIndex = stages.indexOf(deal.stage);
                        return (
                          <div key={deal.id} className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-4 shadow-md hover:border-slate-700/80 transition-all space-y-3 relative group">
                            
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <a 
                                    href={`?tab=pipeline&dealDetail=${deal.id}`} 
                                    className="font-semibold text-white text-sm leading-snug hover:text-indigo-400 transition-colors cursor-pointer" 
                                    title="Ver checklist y detalles"
                                  >
                                    {deal.title}
                                  </a>
                                  <a href={`?tab=pipeline&editDeal=${deal.id}`} className="text-slate-500 hover:text-indigo-400 text-[10px] transition-colors" title="Editar Oportunidad">
                                    ✏️
                                  </a>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">{deal.client?.name || 'Cliente Desconocido'}</p>
                              </div>
                              
                              <form action={deleteDealAction}>
                                <input type="hidden" name="id" value={deal.id} />
                                <button type="submit" className="text-slate-600 hover:text-red-400 transition-colors text-xs cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar Trato">
                                  🗑️
                                </button>
                              </form>
                            </div>

                            {/* Prioridad y Fecha Límite */}
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                deal.priority === 'Alta' 
                                  ? 'bg-rose-950/60 text-rose-400 border-rose-800/50' 
                                  : deal.priority === 'Baja'
                                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                                  : 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                              }`}>
                                {deal.priority === 'Alta' && '🔴'} {deal.priority === 'Media' && '🟡'} {deal.priority === 'Baja' && '🟢'} Prioridad: {deal.priority}
                              </span>
                              {deal.dueDate && (
                                <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                  📅 {new Date(deal.dueDate).toLocaleDateString('es-ES')}
                                </span>
                              )}
                            </div>

                            <div className="flex justify-between items-center pt-1 border-t border-slate-800/30">
                              <span className="text-sm font-black text-emerald-400">
                                €{deal.value ? deal.value.toLocaleString() : '0'}
                              </span>

                              {/* Controles de Estado de Trato */}
                              <div className="flex gap-1.5">
                                {currentStageIndex > 0 && (
                                  <form action={updateDealStageAction}>
                                    <input type="hidden" name="id" value={deal.id} />
                                    <input type="hidden" name="stage" value={stages[currentStageIndex - 1]} />
                                    <button type="submit" className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs cursor-pointer" title="Mover atrás">
                                      ←
                                    </button>
                                  </form>
                                )}

                                {currentStageIndex < stages.length - 1 && (
                                  <form action={updateDealStageAction}>
                                    <input type="hidden" name="id" value={deal.id} />
                                    <input type="hidden" name="stage" value={stages[currentStageIndex + 1]} />
                                    <button type="submit" className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs cursor-pointer" title="Mover adelante">
                                      →
                                    </button>
                                  </form>
                                )}
                              </div>
                            </div>

                          </div>
                        );
                      })}

                      {stageDeals.length === 0 && (
                        <div className="border border-dashed border-slate-800/80 rounded-xl p-8 text-center text-xs text-slate-600 italic">
                          Vacío
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* 4. AJUSTES / AUTOMATIZACIONES */}
        {activeTab === 'ajustes' && (
          <div className="space-y-8 animate-fadeIn">
              
              {/* Webhook Configuration form */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">⚙️ Centro de Automatizaciones e Integraciones</h2>
                  <p className="text-sm text-slate-400 mt-1">Conecta tu CRM local de toroia.vip con plataformas externas de automatización en tiempo real.</p>
                </div>

                <form action={saveSettingsAction} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Make.com / Zapier Webhook URL</label>
                      <input 
                        name="make_webhook" 
                        defaultValue={makeWebhook}
                        placeholder="https://hook.eu1.make.com/..." 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" 
                      />
                      <p className="text-[10px] text-slate-500">Se disparará un POST de tipo JSON con la información completa del cliente y el trato al ganar la oportunidad.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">n8n Webhook URL</label>
                      <input 
                        name="n8n_webhook" 
                        defaultValue={n8nWebhook}
                        placeholder="http://localhost:5678/webhook/..." 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" 
                      />
                      <p className="text-[10px] text-slate-500">Se disparará un POST de tipo JSON al webhook configurado en tu servidor local o en la nube de n8n.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Slack Webhook URL</label>
                      <input 
                        name="slack_webhook" 
                        defaultValue={slackWebhook}
                        placeholder="https://hooks.slack.com/services/..." 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" 
                      />
                      <p className="text-[10px] text-slate-500">Publicará una felicitación y resumen del nuevo cliente ganado directamente en tu canal de Slack.</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer">
                      Guardar Configuración
                    </button>
                  </div>
                </form>
              </div>

              {/* Webhook Testing Console */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">🔌 Consola de Pruebas de Conexión</h3>
                <p className="text-xs text-slate-400">Verifica que tus webhooks de Make.com, n8n y Slack responden correctamente enviando un payload de prueba.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Test Make */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Simulador Make / Zapier</h4>
                      <p className="text-xs text-slate-400">Envía un evento de prueba `test_connection` para validar la respuesta del webhook receptor.</p>
                      {makeLastTest && (
                        <div className="mt-3 p-2 bg-slate-900 rounded border border-slate-800 text-[10px] font-mono text-slate-300 break-all">
                          {makeLastTest}
                        </div>
                      )}
                    </div>
                    <form action={testWebhookAction}>
                      <input type="hidden" name="type" value="make" />
                      <input type="hidden" name="url" value={makeWebhook} />
                      <button 
                        type="submit" 
                        disabled={!makeWebhook}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Probar Make.com
                      </button>
                    </form>
                  </div>

                  {/* Test n8n */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Simulador n8n Webhook</h4>
                      <p className="text-xs text-slate-400">Envía un evento de prueba `test_connection` al nodo Webhook en tu lienzo de n8n.</p>
                      {n8nLastTest && (
                        <div className="mt-3 p-2 bg-slate-900 rounded border border-slate-800 text-[10px] font-mono text-slate-300 break-all">
                          {n8nLastTest}
                        </div>
                      )}
                    </div>
                    <form action={testWebhookAction}>
                      <input type="hidden" name="type" value="n8n" />
                      <input type="hidden" name="url" value={n8nWebhook} />
                      <button 
                        type="submit" 
                        disabled={!n8nWebhook}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Probar n8n Webhook
                      </button>
                    </form>
                  </div>

                  {/* Test Slack */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Simulador Slack Webhook</h4>
                      <p className="text-xs text-slate-400">Envía un mensaje formateado al canal para corroborar el token de acceso.</p>
                      {slackLastTest && (
                        <div className="mt-3 p-2 bg-slate-900 rounded border border-slate-800 text-[10px] font-mono text-slate-300 break-all">
                          {slackLastTest}
                        </div>
                      )}
                    </div>
                    <form action={testWebhookAction}>
                      <input type="hidden" name="type" value="slack" />
                      <input type="hidden" name="url" value={slackWebhook} />
                      <button 
                        type="submit" 
                        disabled={!slackWebhook}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Probar Slack
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* Plantilla n8n */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">📦 Plantilla de Flujo para n8n</h3>
                  <p className="text-xs text-slate-400 mt-1">Copia este JSON e impórtalo directamente en tu lienzo de n8n (Ctrl+V en el editor) para automatizar Slack y Google Drive de forma instantánea al ganar un trato.</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 relative font-mono text-[10px] text-slate-300 overflow-x-auto max-h-64 whitespace-pre leading-relaxed">
                  {n8nWorkflowJSON}
                </div>

                <div className="flex justify-end">
                  <CopyButton textToCopy={n8nWorkflowJSON} />
                </div>
              </div>

            </div>
        )}
      </main>
    </div>
  );
}
