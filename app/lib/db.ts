import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

// Definición de Interfaces
export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  nif: string | null;
  services: string | null;
  budget: number | null;
  renewalDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number | null;
  stage: string;
  priority: string;
  dueDate: string | null;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  client?: Client;
}

export interface Task {
  id: string;
  description: string;
  completed: number; // 0 o 1
  dealId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Interaction {
  id: string;
  clientId: string;
  type: string; // 'Llamada' | 'Reunión' | 'Email' | 'Nota'
  content: string;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: string;
}

// Inicialización de la base de datos local
const db = new DatabaseSync('dev.db');

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS Client (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    address TEXT,
    nif TEXT,
    services TEXT,
    budget REAL,
    renewalDate TEXT,
    notes TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS Deal (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    value REAL,
    stage TEXT NOT NULL DEFAULT 'Leads Nuevos',
    priority TEXT NOT NULL DEFAULT 'Media',
    dueDate TEXT,
    clientId TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clientId) REFERENCES Client(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS Task (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    dealId TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(dealId) REFERENCES Deal(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS Interaction (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clientId) REFERENCES Client(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS Setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Ejecutar ALTER TABLE de forma segura por si la tabla Deal ya existía y le faltan estas columnas
try {
  db.exec('ALTER TABLE Deal ADD COLUMN priority TEXT NOT NULL DEFAULT "Media"');
} catch (e) {
  // Columna ya existe, ignorar
}

try {
  db.exec('ALTER TABLE Deal ADD COLUMN dueDate TEXT');
} catch (e) {
  // Columna ya existe, ignorar
}

// Funciones Auxiliares para Clientes
export function getClientsCount(): number {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM Client');
  const result = stmt.get() as { count: number };
  return result ? result.count : 0;
}

export function getClients(): Client[] {
  const stmt = db.prepare('SELECT * FROM Client ORDER BY createdAt DESC');
  return stmt.all() as Client[];
}

export function createClient(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  nif?: string | null;
  services?: string | null;
  budget?: number | null;
  renewalDate?: string | null;
  notes?: string | null;
}): Client {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO Client (id, name, email, phone, company, address, nif, services, budget, renewalDate, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.name,
    data.email ?? null,
    data.phone ?? null,
    data.company ?? null,
    data.address ?? null,
    data.nif ?? null,
    data.services ?? null,
    data.budget ?? null,
    data.renewalDate ?? null,
    data.notes ?? null,
    now,
    now
  );

  const selectStmt = db.prepare('SELECT * FROM Client WHERE id = ?');
  return selectStmt.get(id) as Client;
}

export function updateClient(id: string, data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  nif?: string | null;
  services?: string | null;
  budget?: number | null;
  renewalDate?: string | null;
  notes?: string | null;
}): void {
  const stmt = db.prepare(`
    UPDATE Client SET 
      name = ?, email = ?, phone = ?, company = ?, address = ?, 
      nif = ?, services = ?, budget = ?, renewalDate = ?, notes = ?, 
      updatedAt = ?
    WHERE id = ?
  `);
  stmt.run(
    data.name,
    data.email ?? null,
    data.phone ?? null,
    data.company ?? null,
    data.address ?? null,
    data.nif ?? null,
    data.services ?? null,
    data.budget ?? null,
    data.renewalDate ?? null,
    data.notes ?? null,
    new Date().toISOString(),
    id
  );
}

// Funciones Auxiliares para Tratos (Deals)
export function getDeals(): Deal[] {
  const stmt = db.prepare(`
    SELECT 
      d.id, d.title, d.value, d.stage, d.priority, d.dueDate, d.clientId, d.createdAt, d.updatedAt,
      c.name as clientName, c.company as clientCompany, c.email as clientEmail
    FROM Deal d
    INNER JOIN Client c ON d.clientId = c.id
    ORDER BY d.createdAt DESC
  `);
  
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    value: row.value,
    stage: row.stage,
    priority: row.priority || 'Media',
    dueDate: row.dueDate,
    clientId: row.clientId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    client: {
      id: row.clientId,
      name: row.clientName,
      company: row.clientCompany,
      email: row.clientEmail,
      phone: null,
      address: null,
      nif: null,
      services: null,
      budget: null,
      renewalDate: null,
      notes: null,
      createdAt: '',
      updatedAt: ''
    }
  }));
}

export function createDeal(data: {
  title: string;
  value?: number | null;
  stage?: string;
  priority?: string;
  dueDate?: string | null;
  clientId: string;
}): Deal {
  const id = crypto.randomUUID();
  const stage = data.stage ?? 'Leads Nuevos';
  const priority = data.priority ?? 'Media';
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO Deal (id, title, value, stage, priority, dueDate, clientId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.title, data.value ?? null, stage, priority, data.dueDate ?? null, data.clientId, now, now);

  const selectStmt = db.prepare('SELECT * FROM Deal WHERE id = ?');
  return selectStmt.get(id) as Deal;
}

export function updateDeal(id: string, data: {
  title: string;
  value?: number | null;
  stage?: string;
  priority?: string;
  dueDate?: string | null;
  clientId: string;
}): void {
  const stmt = db.prepare(`
    UPDATE Deal SET 
      title = ?, value = ?, stage = ?, priority = ?, dueDate = ?, clientId = ?, updatedAt = ?
    WHERE id = ?
  `);
  stmt.run(
    data.title,
    data.value ?? null,
    data.stage ?? 'Leads Nuevos',
    data.priority ?? 'Media',
    data.dueDate ?? null,
    data.clientId,
    new Date().toISOString(),
    id
  );
}

export function updateDealStage(id: string, stage: string): void {
  const stmt = db.prepare('UPDATE Deal SET stage = ?, updatedAt = ? WHERE id = ?');
  stmt.run(stage, new Date().toISOString(), id);
}

export function deleteDeal(id: string): void {
  const stmt = db.prepare('DELETE FROM Deal WHERE id = ?');
  stmt.run(id);
}

export function deleteClient(id: string): void {
  const stmt = db.prepare('DELETE FROM Client WHERE id = ?');
  stmt.run(id);
}

// Funciones Auxiliares para Tareas (Tasks)
export function getTasksForDeal(dealId: string): Task[] {
  const stmt = db.prepare('SELECT * FROM Task WHERE dealId = ? ORDER BY createdAt ASC');
  return stmt.all(dealId) as Task[];
}

export function toggleTask(taskId: string, completed: number): void {
  const stmt = db.prepare('UPDATE Task SET completed = ?, updatedAt = ? WHERE id = ?');
  stmt.run(completed, new Date().toISOString(), taskId);
}

export function initializeOnboardingTasks(dealId: string): void {
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM Task WHERE dealId = ?');
  const check = checkStmt.get(dealId) as { count: number };
  if (check && check.count > 0) return;

  const defaultTasks = [
    'Crear canal de Slack privado con el cliente',
    'Crear carpeta compartida en Google Drive para documentación',
    'Enviar correo formal de bienvenida y propuesta de kickoff',
    'Configurar tablero del proyecto en Trello/Jira',
    'Emitir factura del primer hito / adelanto del proyecto'
  ];

  const insertStmt = db.prepare(`
    INSERT INTO Task (id, description, completed, dealId)
    VALUES (?, ?, 0, ?)
  `);

  for (const desc of defaultTasks) {
    insertStmt.run(crypto.randomUUID(), desc, dealId);
  }
}

// Funciones Auxiliares para Ajustes y Webhooks
export function getSetting(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM Setting WHERE key = ?');
  const result = stmt.get(key) as { value: string } | undefined;
  return result ? result.value : null;
}

export function saveSetting(key: string, value: string): void {
  const stmt = db.prepare(`
    INSERT INTO Setting (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  stmt.run(key, value);
}

// Funciones Auxiliares para Interacciones
export function getInteractions(clientId: string): Interaction[] {
  const stmt = db.prepare('SELECT * FROM Interaction WHERE clientId = ? ORDER BY createdAt DESC');
  return stmt.all(clientId) as Interaction[];
}

export function createInteraction(clientId: string, type: string, content: string): Interaction {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO Interaction (id, clientId, type, content, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, clientId, type, content, now);
  const selectStmt = db.prepare('SELECT * FROM Interaction WHERE id = ?');
  return selectStmt.get(id) as Interaction;
}

export function deleteInteraction(id: string): void {
  const stmt = db.prepare('DELETE FROM Interaction WHERE id = ?');
  stmt.run(id);
}

// Crear Tareas Personalizadas
export function createTask(dealId: string, description: string): Task {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO Task (id, description, completed, dealId, createdAt, updatedAt)
    VALUES (?, ?, 0, ?, ?, ?)
  `);
  stmt.run(id, description, dealId, now, now);
  const selectStmt = db.prepare('SELECT * FROM Task WHERE id = ?');
  return selectStmt.get(id) as Task;
}

export function deleteTask(taskId: string): void {
  const stmt = db.prepare('DELETE FROM Task WHERE id = ?');
  stmt.run(taskId);
}
