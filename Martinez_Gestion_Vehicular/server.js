const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const JSON_FILE = path.join(DATA_DIR, 'database.json');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const seedVehicles = [
  ['Carroza Blanca', 'AZU071', 168044, '2026-04-27', 5000, 173044, 172903],
  ['Carroza Blanca H1', '', 294558, '2026-04-23', 5000, 299558, 295231],
  ['Carroza Negra', 'BQA554', 148246, '2026-04-27', 5000, 153246, 151057],
  ['Crafter Blanca', 'BJQ848', 174516, '2026-04-23', 7500, 182016, 180156],
  ['Crafter Negra 1', 'BBK904', 229982, '2026-04-23', 7500, 237482, 235489],
  ['Crafter Negra 2', 'BBK870', 168262, '2026-04-23', 7500, 175762, 169265],
  ['Avanza', 'BZN303', 197549, '2026-04-23', 5000, 202549, 202060],
  ['Yaris Blanco', 'BZI116', 81700, '2026-04-23', 5000, 86700, 82935],
  ['Yocho', 'BSU619', 0, null, 5000, 0, 0],
  ['Kia 2', 'AZE247', 146921, '2026-04-23', 5000, 151921, 148221],
  ['Versa 1', 'CBW526', 94898, '2026-04-23', 5000, 99898, 96288],
  ['Versa 2', 'CBW636', 89710, '2026-04-23', 5000, 94710, 94140]
].map((v, i) => ({
  id: i + 1,
  name: v[0],
  plate: v[1],
  currentKm: v[6],
  oilLastDate: v[3],
  oilInterval: v[4],
  oilIntervalMonths: 6,
  oilLastKm: v[2],
  oilNextKm: v[5],
  preventiveKm: 0,
  preventiveLastKm: null,
  preventiveInterval: 5000,
  active: true,
  notes: ''
}));

let pool = null;
let local = null;

function initialData() {
  const vehicles = [
    { id: 'v-demo-1', name: 'Crafter Blanca', plate: 'BJQ-848', currentKm: 11500, oilLastKm: 10000, oilLastDate: '2026-10-20', oilInterval: 5000, oilIntervalMonths: 6, oilNextKm: 15000, preventiveLastKm: 10000, preventiveInterval: 5000, active: true, notes: 'Unidad de traslado principal.' },
    { id: 'v-demo-2', name: 'Crafter Negra', plate: 'BBK-904', currentKm: 13800, oilLastKm: 10000, oilLastDate: '2026-10-12', oilInterval: 5000, oilIntervalMonths: 6, oilNextKm: 15000, preventiveLastKm: 10000, preventiveInterval: 5000, active: true, notes: 'Ejemplo en vigilancia.' },
    { id: 'v-demo-3', name: 'Carroza Blanca', plate: 'AZU-071', currentKm: 14700, oilLastKm: 10000, oilLastDate: '2026-09-30', oilInterval: 5000, oilIntervalMonths: 6, oilNextKm: 15000, preventiveLastKm: 10000, preventiveInterval: 5000, active: true, notes: 'Ejemplo próximo a cambio.' },
    { id: 'v-demo-4', name: 'Carroza Negra', plate: 'BQA-554', currentKm: 15100, oilLastKm: 10000, oilLastDate: '2026-09-15', oilInterval: 5000, oilIntervalMonths: 6, oilNextKm: 15000, preventiveLastKm: 10000, preventiveInterval: 5000, active: true, notes: 'Ejemplo con cambio vencido.' },
    { id: 'v-demo-5', name: 'Yaris Blanco', plate: 'BZI-116', currentKm: 82935, oilLastKm: 81700, oilLastDate: '2026-10-02', oilInterval: 5000, oilIntervalMonths: 6, oilNextKm: 86700, preventiveLastKm: 77935, preventiveInterval: 5000, active: true, notes: 'Vehículo administrativo.' },
    { id: 'v-demo-6', name: 'Avanza', plate: 'BZN-303', currentKm: 202060, oilLastKm: 197549, oilLastDate: '2026-08-20', oilInterval: 5000, oilIntervalMonths: 6, oilNextKm: 202549, preventiveLastKm: 199060, preventiveInterval: 5000, active: true, notes: '' }
  ];

  return {
    vehicles,
    maintenances: [
      { id: 'm-demo-1', vehicleId: 'v-demo-1', type: 'Cambio de aceite', date: '2026-10-20', km: 10000, description: 'Cambio de aceite y filtros', provider: 'Taller Central', cost: 680, parts: 'Aceite y filtro', nextKm: 15000 },
      { id: 'm-demo-2', vehicleId: 'v-demo-3', type: 'Preventivo', date: '2026-09-30', km: 10000, description: 'Chequeo preventivo general', provider: 'Servicio Automotriz', cost: 420, parts: 'Revisión general', nextKm: 15000 }
    ],
    documents: [
      { id: 'd-demo-1', vehicleId: 'v-demo-1', type: 'SOAT', number: 'SOAT-EJEMPLO-001', issueDate: '2026-01-15', expiryDate: '2027-01-15', notes: '' },
      { id: 'd-demo-2', vehicleId: 'v-demo-3', type: 'Revisión técnica', number: 'RT-EJEMPLO-002', issueDate: '2026-06-10', expiryDate: '2026-12-10', notes: 'Programar renovación.' }
    ],
    observations: [
      { id: 'o-demo-1', vehicleId: 'v-demo-2', date: '2026-11-02', text: 'Verificar desgaste de neumático delantero derecho.', priority: 'Alta', status: 'Pendiente' }
    ],
    weeklyReviews: [
      { id: 'w-demo-1', vehicleId: 'v-demo-1', date: '2026-11-02', km: 11500, tires: 'Correcto', brakes: 'Correcto', lights: 'Correcto', fluids: 'Correcto', cleaning: 'Correcto', documents: 'Correcto', notes: 'Unidad operativa.', result: 'Conforme' },
      { id: 'w-demo-2', vehicleId: 'v-demo-2', date: '2026-11-02', km: 13800, tires: 'Deficiente', brakes: 'Correcto', lights: 'Correcto', fluids: 'Correcto', cleaning: 'Correcto', documents: 'Correcto', notes: 'Revisar neumático delantero derecho.', result: 'Requiere atención' }
    ],
    settings: { alertDays: 30, kmWarning: 500, oilIntervalKm: 5000, greenMinKm: 1500, yellowMinKm: 500, orangeMinKm: 100, earlyOilChangeRestartsCycle: false },
    demoData: true
  };
}

function loadLocal() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(JSON_FILE)) fs.writeFileSync(JSON_FILE, JSON.stringify(initialData(), null, 2));
  try {
    local = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  } catch {
    local = initialData();
  }
}

function saveLocal() {
  fs.writeFileSync(JSON_FILE, JSON.stringify(local, null, 2));
}

async function initDb() {
  if (!process.env.DATABASE_URL) {
    loadLocal();
    local.vehicles.forEach(v => syncOilForVehicle(local, v.id));
    ensureOilCycles(local);
    saveLocal();
    console.log('Usando almacenamiento local JSON');
    return;
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      subscription JSONB NOT NULL,
      responsible_name TEXT DEFAULT '',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_alert_log (
      id BIGSERIAL PRIMARY KEY,
      alert_key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const result = await pool.query('SELECT payload FROM app_state WHERE id=1');

  if (!result.rows.length) {
    const data = initialData();
    ensureOilCycles(data);
    await pool.query('INSERT INTO app_state(id,payload) VALUES(1,$1)', [JSON.stringify(data)]);
  } else {
    const data = result.rows[0].payload;
    (data.vehicles || []).forEach(v => syncOilForVehicle(data, v.id));
    ensureOilCycles(data);
    await writeData(data);
  }
}

async function readData() {
  let data;
  if (!pool) data = local;
  else { const r = await pool.query('SELECT payload FROM app_state WHERE id=1'); data = r.rows[0].payload; }
  data.maintenanceAudit = data.maintenanceAudit || [];
  data.maintenances = data.maintenances || [];
  ensureOilCycles(data);
  return data;
}

async function writeData(data) {
  if (!pool) {
    local = data;
    saveLocal();
    return;
  }

  await pool.query(`
    INSERT INTO app_state(id,payload,updated_at) VALUES(1,$1,NOW())
    ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=NOW()
  `, [JSON.stringify(data)]);
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const clean = s => String(s ?? '').trim();
function auditMaintenance(data, action, record, detail='') {
  const isOil = String(record.type || '').toLowerCase().includes('aceite');
  logActivity(data, action, record.vehicleId, detail || `${record.type || ''} · Chofer: ${record.driverName || 'No indicado'} · Taller: ${record.provider || 'No indicado'}`, isOil ? 'Aceite' : 'Mantenimiento');
}

// Bitácora única de TODO lo que se hace en el sistema (se guarda dentro de data.maintenanceAudit).
function logActivity(data, action, vehicleId, detail, area = 'General') {
  data.maintenanceAudit = data.maintenanceAudit || [];
  const v = (data.vehicles || []).find(x => String(x.id) === String(vehicleId));
  data.maintenanceAudit.unshift({
    id: uid(), at: new Date().toISOString(), action, area,
    vehicleId: vehicleId ?? null,
    vehicleName: v ? `${v.name}${v.plate ? ' · ' + v.plate : ''}` : 'General',
    detail: detail || ''
  });
  data.maintenanceAudit = data.maintenanceAudit.slice(0, 3000);
}

function syncOilForVehicle(data, vehicleId) {
  const v = data.vehicles.find(x => String(x.id) === String(vehicleId));
  if (!v) return;

  const history = (data.maintenances || [])
    .filter(m => String(m.vehicleId) === String(vehicleId) && String(m.type || '').toLowerCase().includes('aceite') && (m.status || 'Realizado') !== 'Anulado')
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || num(b.km) - num(a.km));

  const latest = history[0];

  // El kilometraje base del control pertenece al ciclo activo, no al último
  // servicio registrado (un cambio anticipado no reinicia el intervalo).
  const activeCycle = (data.oilCycles || []).find(c => String(c.vehicleId) === String(vehicleId) && c.status === 'En curso');
  v.oilInterval = num(activeCycle?.intervalKm) || num(v.oilInterval) || 5000;
  if (activeCycle) {
    v.oilLastKm = num(activeCycle.startKm);
    v.oilLastDate = activeCycle.startDate || v.oilLastDate;
    v.oilNextKm = num(activeCycle.plannedKm);
  } else if (latest) {
    v.oilLastKm = num(latest.km);
    v.oilLastDate = latest.date || v.oilLastDate;
    v.oilNextKm = v.oilLastKm + v.oilInterval;
  } else {
    v.oilLastKm = num(v.oilLastKm);
    v.oilNextKm = v.oilLastKm + v.oilInterval;
  }
}

// Mantiene un ciclo abierto por vehículo y conserva cada ciclo finalizado.
function ensureOilCycles(data) {
  data.oilCycles = data.oilCycles || [];
  data.weeklyReviews = data.weeklyReviews || [];
  for (const v of (data.vehicles || [])) {
    const vehicleCycles = data.oilCycles.filter(c => String(c.vehicleId) === String(v.id));
    if (!vehicleCycles.length) {
      const interval = num(v.oilInterval) || num(data.settings?.oilIntervalKm) || 5000;
      const oilHistory = (data.maintenances || [])
        .filter(m => String(m.vehicleId) === String(v.id) && String(m.type || '').toLowerCase().includes('aceite') && (m.status || 'Realizado') !== 'Anulado')
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || num(a.km) - num(b.km));
      let cycle = null;
      for (const m of oilHistory) {
        if (!cycle) {
          const startKm = Math.max(0, num(m.km) - interval);
          cycle = { id: uid(), vehicleId: v.id, number: 1, startDate: null, startKm,
            plannedKm: startKm + interval, endDate: null, endKm: null, intervalKm: interval,
            distanceKm: null, status: 'En curso', maintenanceId: null, provider: '', cost: 0,
            parts: '', notes: '', createdAt: new Date().toISOString() };
          data.oilCycles.push(cycle);
        }
        m.oilCycleId = cycle.id;
        m.nextKm = num(cycle.plannedKm);
        if (num(m.km) >= num(cycle.plannedKm)) {
          cycle.status = 'Cerrado'; cycle.endDate = m.date; cycle.endKm = num(m.km);
          cycle.distanceKm = num(m.km) - num(cycle.startKm); cycle.maintenanceId = m.id;
          cycle.provider = m.provider || ''; cycle.cost = num(m.totalCost ?? m.cost);
          cycle.parts = m.parts || ''; cycle.notes = m.description || '';
          cycle.closeReason = num(m.km) > num(cycle.plannedKm) ? 'Servicio realizado después del límite' : 'Límite alcanzado';
          const nextStart = num(m.km);
          cycle = { id: uid(), vehicleId: v.id, number: num(cycle.number) + 1, startDate: m.date,
            startKm: nextStart, plannedKm: nextStart + interval, endDate: null, endKm: null,
            intervalKm: interval, distanceKm: null, status: 'En curso', maintenanceId: null,
            provider: '', cost: 0, parts: '', notes: '', createdAt: new Date().toISOString() };
          data.oilCycles.push(cycle);
        } else {
          m.oilCycleAction = 'Servicio anticipado · ciclo continúa';
        }
      }
    }
    const open = data.oilCycles.find(c => String(c.vehicleId) === String(v.id) && c.status === 'En curso');
    if (!open) {
      const closed = data.oilCycles.filter(c => String(c.vehicleId) === String(v.id) && c.status === 'Cerrado').sort((a,b) => num(b.number)-num(a.number))[0];
      const startKm = closed ? num(closed.endKm) : num(v.oilLastKm);
      const startDate = closed?.endDate || v.oilLastDate || null;
      const intervalKm = num(v.oilInterval) || num(data.settings?.oilIntervalKm) || 5000;
      data.oilCycles.push({ id: uid(), vehicleId: v.id, number: (closed?.number || 0) + 1, startDate, startKm,
        plannedKm: startKm + intervalKm, endDate: null, endKm: null, intervalKm, distanceKm: null,
        status: 'En curso', maintenanceId: null, provider: '', cost: 0, parts: '', notes: '', createdAt: new Date().toISOString() });
    }
  }
  // Vincula revisiones antiguas a su ciclo por vehículo, fecha y kilometraje.
  for (const review of data.weeklyReviews) {
    if (review.oilCycleId) continue;
    const candidates = data.oilCycles.filter(c => String(c.vehicleId) === String(review.vehicleId));
    const match = candidates.find(c => num(review.km) >= num(c.startKm) &&
      (c.endKm == null || num(review.km) <= num(c.endKm)) &&
      (!c.startDate || !review.date || review.date >= c.startDate) &&
      (!c.endDate || !review.date || review.date <= c.endDate));
    if (match) review.oilCycleId = match.id;
  }
}


// Aplica la configuración de aceite de un vehículo AL CICLO ACTIVO (que es lo que
// lee el semáforo, las alertas y el Excel). Antes solo se tocaba el vehículo y el
// ciclo seguía con los valores viejos, por eso "Configurar" no se reflejaba.
function applyOilConfig(data, v, b) {
  ensureOilCycles(data);
  const cycle = data.oilCycles.find(c => String(c.vehicleId) === String(v.id) && c.status === 'En curso');
  const has = k => b[k] !== undefined && b[k] !== null && b[k] !== '';
  const interval = (has('oilInterval') ? num(b.oilInterval) : 0) || num(cycle?.intervalKm) || num(v.oilInterval) || num(data.settings?.oilIntervalKm) || 5000;
  const lastKm = has('oilLastKm') ? num(b.oilLastKm) : (cycle ? num(cycle.startKm) : num(v.oilLastKm));
  const lastDate = has('oilLastDate') ? b.oilLastDate : null;
  if (cycle) {
    cycle.startKm = lastKm;
    cycle.intervalKm = interval;
    cycle.plannedKm = lastKm + interval;
    if (lastDate) cycle.startDate = lastDate;
    cycle.editedAt = new Date().toISOString();
    (data.maintenances || []).forEach(m => { if (m.oilCycleId === cycle.id) m.nextKm = cycle.plannedKm; });
  }
  const before = { km: num(v.oilLastKm), interval: num(v.oilInterval) };
  v.oilInterval = interval;
  v.oilLastKm = lastKm;
  v.oilNextKm = lastKm + interval;
  if (lastDate) v.oilLastDate = lastDate;

  // El último cambio configurado también queda en el historial de cambios de aceite.
  if (cycle && lastKm > 0 && (lastDate || cycle.startDate)) {
    const date = lastDate || cycle.startDate;
    let rec = (data.maintenances || []).find(m => m.oilCycleId === cycle.id && m.initialRecord && m.status !== 'Anulado');
    if (rec) { rec.date = date; rec.km = lastKm; rec.nextKm = cycle.plannedKm; }
    else {
      rec = { id: uid(), vehicleId: v.id, type: 'Cambio de aceite', date, km: lastKm,
        description: 'Cambio que inicia el ciclo (registrado al configurar el control de aceite)', provider: '', cost: 0, parts: '',
        workKind: 'Mantenimiento', driverName: '', technician: '', laborCost: 0, partsCost: 0, totalCost: 0,
        status: 'Realizado', nextDate: null, nextKm: cycle.plannedKm, oilCycleId: cycle.id, initialRecord: true,
        oilCycleAction: 'Inicio de ciclo', createdAt: new Date().toISOString() };
      data.maintenances = data.maintenances || [];
      data.maintenances.unshift(rec);
    }
  }
  logActivity(data, 'CONFIGURACIÓN ACEITE', v.id, `Último cambio: ${before.km} → ${lastKm} km · Intervalo: ${before.interval} → ${interval} km · Próximo cambio: ${lastKm + interval} km${lastDate ? ' · Fecha: ' + lastDate : ''}`, 'Aceite');
}

// Si el servicio anulado había cerrado un ciclo, se reabre ese ciclo y se descarta el siguiente.
function reopenCycleIfClosedBy(data, m) {
  const closed = (data.oilCycles || []).find(c => c.maintenanceId === m.id && c.status === 'Cerrado');
  if (!closed) return;
  const next = data.oilCycles.find(c => String(c.vehicleId) === String(closed.vehicleId) && num(c.number) === num(closed.number) + 1);
  if (next && next.status === 'En curso') data.oilCycles = data.oilCycles.filter(c => c.id !== next.id);
  Object.assign(closed, { status: 'En curso', endDate: null, endKm: null, distanceKm: null, maintenanceId: null, closeReason: null, closedAt: null, provider: '', cost: 0, parts: '', notes: '' });
  const v = data.vehicles.find(x => String(x.id) === String(closed.vehicleId));
  if (v) syncOilForVehicle(data, v.id);
}

/* =========================
   NOTIFICACIONES PUSH
========================= */

function pushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
}

async function sendPushNotification(title, body, url = '/') {
  if (!pool || !pushConfigured()) {
    console.log('Push no enviado: faltan base de datos o claves VAPID.');
    return { sent: 0, failed: 0 };
  }

  const result = await pool.query(`
    SELECT id, subscription
    FROM push_subscriptions
    WHERE active = TRUE
  `);

  let sent = 0;
  let failed = 0;

  for (const item of result.rows) {
    try {
      await webpush.sendNotification(
        item.subscription,
        JSON.stringify({ title, body, url })
      );
      sent++;
    } catch (error) {
      failed++;
      console.error('Error enviando push:', error.statusCode || error.message);

      if (error.statusCode === 404 || error.statusCode === 410) {
        await pool.query(
          'UPDATE push_subscriptions SET active = FALSE WHERE id = $1',
          [item.id]
        );
      }
    }
  }

  return { sent, failed };
}

async function sendUniqueAlert(alertKey, title, body, url = '/') {
  if (!pool || !pushConfigured()) return;

  // El índice UNIQUE evita que el mismo aviso se envíe repetidamente.
  const inserted = await pool.query(`
    INSERT INTO push_alert_log(alert_key, title, body)
    VALUES($1, $2, $3)
    ON CONFLICT(alert_key) DO NOTHING
    RETURNING id
  `, [alertKey, title, body]);

  if (!inserted.rows.length) return;

  const result = await sendPushNotification(title, body, url);

  if (result.sent === 0) {
    // Si no había dispositivos disponibles, permite volver a intentar más adelante.
    await pool.query('DELETE FROM push_alert_log WHERE alert_key = $1', [alertKey]);
  }
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

async function checkAutomaticAlerts() {
  if (!pool || !pushConfigured()) return;

  try {
    const data = await readData();
    const vehicles = (data.vehicles || []).filter(v => v.active !== false);
    const kmWarning = Math.max(0, num(data.settings?.yellowMinKm) || num(data.settings?.kmWarning) || 500);
    const alertDays = Math.max(0, num(data.settings?.alertDays) || 30);

    for (const vehicle of vehicles) {
      const currentKm = num(vehicle.currentKm);
      const oilCycle = (data.oilCycles || []).find(c => String(c.vehicleId) === String(vehicle.id) && c.status === 'En curso');
      const oilNextKm = oilCycle ? num(oilCycle.plannedKm) : num(vehicle.oilNextKm);
      const oilRemaining = oilNextKm - currentKm;

      if (oilNextKm > 0 && oilRemaining <= kmWarning) {
        const state = oilRemaining <= 0 ? 'VENCIDO' : 'PRÓXIMO';
        const key = `oil:${vehicle.id}:${oilNextKm}:${state}`;
        await sendUniqueAlert(
          key,
          state === 'VENCIDO' ? 'Cambio de aceite vencido' : 'Próximo cambio de aceite',
          `${vehicle.name} (${vehicle.plate || 'Sin placa'}): ${oilRemaining <= 0 ? 'superó' : 'le quedan'} ${Math.abs(oilRemaining)} km para el cambio de aceite.`,
          '/'
        );
      }

      const preventiveNextKm = num(vehicle.preventiveKm) ||
        (vehicle.preventiveLastKm != null
          ? num(vehicle.preventiveLastKm) + (num(vehicle.preventiveInterval) || 5000)
          : 0);

      const preventiveRemaining = preventiveNextKm - currentKm;

      if (preventiveNextKm > 0 && preventiveRemaining <= kmWarning) {
        const state = preventiveRemaining <= 0 ? 'VENCIDO' : 'PRÓXIMO';
        const key = `preventive:${vehicle.id}:${preventiveNextKm}:${state}`;
        await sendUniqueAlert(
          key,
          state === 'VENCIDO' ? 'Mantenimiento preventivo vencido' : 'Mantenimiento preventivo próximo',
          `${vehicle.name} (${vehicle.plate || 'Sin placa'}): ${preventiveRemaining <= 0 ? 'superó' : 'le quedan'} ${Math.abs(preventiveRemaining)} km para el mantenimiento preventivo.`,
          '/'
        );
      }
    }

    for (const document of (data.documents || [])) {
      const days = daysUntil(document.expiryDate);
      if (days === null || days > alertDays) continue;

      const vehicle = vehicles.find(v => String(v.id) === String(document.vehicleId));
      const vehicleName = vehicle?.name || 'Vehículo';
      const state = days < 0 ? 'VENCIDO' : days === 0 ? 'VENCE HOY' : `vence en ${days} días`;
      const key = `document:${document.id}:${document.expiryDate}:${state}`;

      await sendUniqueAlert(
        key,
        `Vencimiento de ${document.type || 'documento'}`,
        `${vehicleName}: ${document.type || 'Documento'} ${state}.`,
        '/'
      );
    }
  } catch (error) {
    console.error('Error revisando alertas automáticas:', error);
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Martinez Gestion Vehicular' });
});

app.get('/api/push/public-key', (req, res) => {
  if (!pushConfigured()) {
    return res.status(503).json({ error: 'Las notificaciones no están configuradas en el servidor.' });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: 'La base de datos no está disponible.' });
    }

    if (!pushConfigured()) {
      return res.status(503).json({ error: 'Las notificaciones no están configuradas.' });
    }

    const { subscription, responsibleName } = req.body || {};

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return res.status(400).json({ error: 'Los datos de suscripción no son válidos.' });
    }

    await pool.query(`
      INSERT INTO push_subscriptions(endpoint, subscription, responsible_name, active)
      VALUES($1, $2, $3, TRUE)
      ON CONFLICT(endpoint)
      DO UPDATE SET
        subscription = EXCLUDED.subscription,
        responsible_name = EXCLUDED.responsible_name,
        active = TRUE
    `, [
      subscription.endpoint,
      JSON.stringify(subscription),
      clean(responsibleName)
    ]);

    res.status(201).json({
      ok: true,
      message: 'Este dispositivo quedó registrado para recibir alertas.'
    });
  } catch (error) {
    console.error('Error registrando dispositivo:', error);
    res.status(500).json({ error: 'No se pudo registrar el dispositivo.' });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: 'Base de datos no disponible.' });

    const endpoint = clean(req.body?.endpoint);
    if (!endpoint) return res.status(400).json({ error: 'Falta el endpoint del dispositivo.' });

    await pool.query(
      'UPDATE push_subscriptions SET active = FALSE WHERE endpoint = $1',
      [endpoint]
    );

    res.json({ ok: true, message: 'Dispositivo desactivado.' });
  } catch (error) {
    console.error('Error desactivando dispositivo:', error);
    res.status(500).json({ error: 'No se pudo desactivar el dispositivo.' });
  }
});

/* =========================
   API DEL SISTEMA
========================= */

app.get('/api/data', async (req, res) => {
  try {
    res.json(await readData());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const d = await readData();
    const b = req.body || {};
    const next = { ...d.settings };
    for (const k of ['alertDays', 'kmWarning', 'oilIntervalKm', 'greenMinKm', 'yellowMinKm', 'orangeMinKm']) {
      if (b[k] !== undefined && b[k] !== '') next[k] = num(b[k]);
    }
    if (b.earlyOilChangeRestartsCycle !== undefined) next.earlyOilChangeRestartsCycle = !!b.earlyOilChangeRestartsCycle;
    if (!(num(next.greenMinKm) > num(next.yellowMinKm) && num(next.yellowMinKm) > num(next.orangeMinKm) && num(next.orangeMinKm) >= 0)) {
      return res.status(400).json({ error: 'Los rangos deben cumplir: verde > amarillo > naranja ≥ 0.' });
    }
    if (!(num(next.oilIntervalKm) > 0)) return res.status(400).json({ error: 'El intervalo debe ser mayor que 0.' });
    d.settings = next;
    logActivity(d, 'CONFIGURACIÓN', null, `Reglas de aceite: intervalo ${next.oilIntervalKm} km · verde > ${next.greenMinKm} · amarillo > ${next.yellowMinKm} · naranja > ${next.orangeMinKm}${next.earlyOilChangeRestartsCycle ? ' · cambio anticipado reinicia contador' : ''}.`, 'Aceite');
    await writeData(d);
    res.json(d.settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/vehicles', async (req, res) => {
  try {
    const d = await readData();
    const b = req.body;
    if (!clean(b.name)) return res.status(400).json({ error: 'El nombre del vehículo es obligatorio.' });

    const interval = num(b.oilInterval) || num(d.settings?.oilIntervalKm) || 5000;
    const lastKm = num(b.oilLastKm);
    const v = {
      id: uid(),
      name: clean(b.name),
      plate: clean(b.plate).toUpperCase(),
      currentKm: num(b.currentKm),
      oilLastKm: lastKm,
      oilLastDate: b.oilLastDate || null,
      oilInterval: interval,
      oilIntervalMonths: num(b.oilIntervalMonths) || 6,
      oilNextKm: lastKm + interval,
      preventiveKm: num(b.preventiveKm),
      preventiveLastKm: b.preventiveLastKm === '' || b.preventiveLastKm == null ? null : num(b.preventiveLastKm),
      preventiveInterval: num(b.preventiveInterval) || 5000,
      active: b.active !== false,
      notes: clean(b.notes)
    };

    d.vehicles.push(v);
    ensureOilCycles(d);
    logActivity(d, 'CREACIÓN', v.id, `Vehículo registrado con ${v.currentKm} km.`, 'Vehículo');
    await writeData(d);
    res.status(201).json(v);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const d = await readData();
    const i = d.vehicles.findIndex(v => String(v.id) === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const b = req.body;
    const old = d.vehicles[i];

    d.vehicles[i] = {
      ...old,
      ...b,
      name: clean(b.name ?? old.name),
      plate: clean(b.plate ?? old.plate).toUpperCase(),
      currentKm: num(b.currentKm ?? old.currentKm),
      oilIntervalMonths: num(b.oilIntervalMonths ?? old.oilIntervalMonths ?? 6),
      active: b.active === undefined ? old.active : !!b.active
    };

    const nv = d.vehicles[i];
    const hasOilData = ['oilLastKm', 'oilInterval', 'oilLastDate'].some(k => b[k] !== undefined && b[k] !== '');
    if (hasOilData) {
      if (b.oilLastKm !== undefined && b.oilLastKm !== '' && num(nv.currentKm) < num(b.oilLastKm)) {
        d.vehicles[i] = old;
        return res.status(400).json({ error: 'El kilometraje actual no puede ser menor al del último cambio de aceite.' });
      }
      applyOilConfig(d, nv, b);
    }
    if (old.active !== nv.active) logActivity(d, nv.active ? 'ACTIVACIÓN' : 'DESACTIVACIÓN', nv.id, `El vehículo fue ${nv.active ? 'activado' : 'desactivado'}.`, 'Vehículo');
    else if (num(old.currentKm) !== num(nv.currentKm) || old.name !== nv.name || old.plate !== nv.plate) logActivity(d, 'EDICIÓN', nv.id, `Datos del vehículo actualizados. Km: ${num(old.currentKm)} → ${num(nv.currentKm)}.`, 'Vehículo');

    await writeData(d);
    res.json(d.vehicles[i]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    const d = await readData();
    const id = req.params.id;
    const v = d.vehicles.find(x => String(x.id) === id);
    if (!v) return res.status(404).json({ error: 'No encontrado' });

    // Se conserva una copia del vehículo y de todos sus registros antes de eliminarlo.
    d.archivedVehicles = d.archivedVehicles || [];
    d.archivedVehicles.unshift({ archivedAt: new Date().toISOString(), vehicle: v,
      maintenances: (d.maintenances || []).filter(x => String(x.vehicleId) === id),
      weeklyReviews: (d.weeklyReviews || []).filter(x => String(x.vehicleId) === id),
      observations: (d.observations || []).filter(x => String(x.vehicleId) === id),
      documents: (d.documents || []).filter(x => String(x.vehicleId) === id),
      oilCycles: (d.oilCycles || []).filter(x => String(x.vehicleId) === id) });
    logActivity(d, 'ELIMINACIÓN', null, `Se eliminó el vehículo ${v.name}${v.plate ? ' · ' + v.plate : ''}. Sus registros se archivaron.`, 'Vehículo');
    d.vehicles = d.vehicles.filter(x => String(x.id) !== id);
    d.oilCycles = (d.oilCycles || []).filter(x => String(x.vehicleId) !== id);
    for (const k of ['maintenances', 'documents', 'observations', 'weeklyReviews']) {
      d[k] = (d[k] || []).filter(x => String(x.vehicleId) !== id);
    }

    await writeData(d);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/maintenances', async (req, res) => {
  try {
    const d = await readData();
    const b = req.body;
    if (!b.vehicleId || !clean(b.type) || !b.date) {
      return res.status(400).json({ error: 'Completa vehículo, tipo y fecha.' });
    }

    const m = {
      id: uid(),
      vehicleId: b.vehicleId,
      type: clean(b.type),
      date: b.date,
      km: num(b.km),
      description: clean(b.description),
      provider: clean(b.provider),
      cost: num(b.cost),
      parts: clean(b.parts),
      workKind: clean(b.workKind) || (clean(b.type).toLowerCase() === 'reparación' ? 'Reparación' : 'Mantenimiento'),
      driverName: clean(b.driverName), technician: clean(b.technician),
      laborCost: num(b.laborCost), partsCost: num(b.partsCost), totalCost: num(b.totalCost ?? b.cost),
      status: clean(b.status) || 'Realizado',
      nextDate: b.nextDate || null,
      nextKm: num(b.nextKm),
      createdAt: new Date().toISOString()
    };

    const v = d.vehicles.find(x => String(x.id) === String(m.vehicleId));
    const isOilService = m.type.toLowerCase().includes('aceite') && m.status === 'Realizado';
    if (isOilService && v) {
      ensureOilCycles(d);
      const openCycle = d.oilCycles.find(c => String(c.vehicleId) === String(v.id) && c.status === 'En curso');
      const intervalKm = num(v.oilInterval) || num(d.settings?.oilIntervalKm) || 5000;
      if (openCycle) {
        if (m.km < num(openCycle.startKm)) return res.status(400).json({ error: 'El kilometraje del cambio no puede ser menor al inicio del ciclo activo.' });
        m.oilCycleId = openCycle.id;
        m.nextKm = num(openCycle.plannedKm);
        // Un servicio anticipado queda en el historial, pero NO reinicia el ciclo.
        if (m.km < num(openCycle.plannedKm) && !d.settings?.earlyOilChangeRestartsCycle) {
          m.oilCycleAction = 'Servicio anticipado · ciclo continúa';
        } else {
          // El ciclo solo se cierra cuando el servicio alcanza o supera el límite.
          openCycle.status = 'Cerrado';
          openCycle.endDate = m.date;
          openCycle.endKm = m.km;
          openCycle.distanceKm = m.km - num(openCycle.startKm);
          openCycle.maintenanceId = m.id;
          openCycle.provider = m.provider;
          openCycle.cost = m.totalCost;
          openCycle.parts = m.parts;
          openCycle.notes = m.description;
          openCycle.closedAt = new Date().toISOString();
          openCycle.closeReason = m.km > num(openCycle.plannedKm) ? 'Servicio realizado después del límite' : m.km < num(openCycle.plannedKm) ? 'Cambio anticipado (reinicia el ciclo)' : 'Límite alcanzado';

          const nextCycle = { id: uid(), vehicleId: v.id, number: num(openCycle.number) + 1,
            startDate: m.date, startKm: m.km, plannedKm: m.km + intervalKm, endDate: null, endKm: null,
            intervalKm, distanceKm: null, status: 'En curso', maintenanceId: null, provider: '', cost: 0,
            parts: '', notes: '', createdAt: new Date().toISOString() };
          d.oilCycles.push(nextCycle);
          m.oilCycleAction = 'Ciclo anterior cerrado · nuevo ciclo iniciado';
          m.nextKm = nextCycle.plannedKm;
        }
      }
    }

    d.maintenances.unshift(m);
    auditMaintenance(d, 'CREACIÓN', m, isOilService ? `Cambio de aceite a ${m.km} km · ${m.oilCycleAction || 'Registrado'} · Próximo: ${m.nextKm} km · Taller: ${m.provider || 'No indicado'}` : '');

    if (v) {
      v.currentKm = Math.max(num(v.currentKm), m.km);

      if (isOilService) {
        // Mantener como referencia el inicio del ciclo activo. El registro del
        // servicio siempre se conserva en maintenances, aunque sea anticipado.
        const activeCycle = d.oilCycles.find(c => String(c.vehicleId) === String(v.id) && c.status === 'En curso');
        v.oilInterval = num(activeCycle?.intervalKm) || num(v.oilInterval) || 5000;
        if (activeCycle) {
          v.oilLastKm = num(activeCycle.startKm);
          v.oilLastDate = activeCycle.startDate || v.oilLastDate;
          v.oilNextKm = num(activeCycle.plannedKm);
        }
      }

      if (m.type.toLowerCase().includes('preventivo')) {
        v.preventiveLastKm = m.km;
        v.preventiveInterval = num(v.preventiveInterval) || 5000;
        v.preventiveKm = m.km + v.preventiveInterval;
      }
    }

    await writeData(d);
    res.status(201).json(m);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/maintenances/:id', async (req, res) => {
  try {
    const d = await readData();
    const i = d.maintenances.findIndex(x => String(x.id) === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Registro no encontrado' });

    const previous = d.maintenances[i];
    const b = req.body;

    d.maintenances[i] = {
      ...previous,
      ...b,
      vehicleId: b.vehicleId || previous.vehicleId,
      type: clean(b.type),
      date: b.date,
      km: num(b.km),
      cost: num(b.cost),
      nextKm: num(b.nextKm),
      description: clean(b.description),
      provider: clean(b.provider),
      parts: clean(b.parts),
      workKind: clean(b.workKind ?? previous.workKind) || 'Mantenimiento',
      driverName: clean(b.driverName ?? previous.driverName),
      technician: clean(b.technician ?? previous.technician),
      laborCost: num(b.laborCost ?? previous.laborCost),
      partsCost: num(b.partsCost ?? previous.partsCost),
      totalCost: num(b.totalCost ?? b.cost ?? previous.totalCost ?? previous.cost),
      status: clean(b.status ?? previous.status) || 'Realizado'
    };

    const m = d.maintenances[i];
    auditMaintenance(d, 'EDICIÓN', m, `Se actualizaron los datos de ${m.type}. Chofer: ${m.driverName || 'No indicado'}.`);

    if (String(previous.vehicleId) !== String(m.vehicleId)) {
      syncOilForVehicle(d, previous.vehicleId);
    }

    syncOilForVehicle(d, m.vehicleId);

    if (m.type.toLowerCase().includes('preventivo')) {
      const v = d.vehicles.find(x => String(x.id) === String(m.vehicleId));
      if (v) {
        v.preventiveLastKm = m.km;
        v.preventiveInterval = num(v.preventiveInterval) || 5000;
        v.preventiveKm = m.km + v.preventiveInterval;
        v.currentKm = Math.max(num(v.currentKm), m.km);
      }
    }

    await writeData(d);
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/maintenances/:id', async (req, res) => {
  try {
    const d = await readData();
    const old = d.maintenances.find(x => String(x.id) === req.params.id);
    if (!old) return res.status(404).json({ error: 'Registro no encontrado' });
    old.status = 'Anulado';
    old.annulledAt = new Date().toISOString();
    reopenCycleIfClosedBy(d, old);
    auditMaintenance(d, 'ANULACIÓN', old, `Se anuló la intervención: ${old.type || ''}. El registro se conserva.`);
    await writeData(d);
    res.json({ ok: true, preserved: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/documents', async (req, res) => {
  try {
    const d = await readData();
    const b = req.body;
    if (!b.vehicleId || !clean(b.type) || !b.expiryDate) {
      return res.status(400).json({ error: 'Completa vehículo, documento y vencimiento.' });
    }

    const doc = {
      id: uid(),
      vehicleId: b.vehicleId,
      type: clean(b.type),
      number: clean(b.number),
      issueDate: b.issueDate || null,
      expiryDate: b.expiryDate,
      notes: clean(b.notes),
      createdAt: new Date().toISOString()
    };

    d.documents.unshift(doc);
    logActivity(d, 'CREACIÓN', doc.vehicleId, `Documento ${doc.type}${doc.number ? ' ' + doc.number : ''} · vence ${doc.expiryDate}`, 'Documento');
    await writeData(d);
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/documents/:id', async (req, res) => {
  try {
    const d = await readData();
    const i = d.documents.findIndex(x => String(x.id) === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Documento no encontrado' });

    d.documents[i] = {
      ...d.documents[i],
      ...req.body,
      number: clean(req.body.number),
      notes: clean(req.body.notes)
    };
    logActivity(d, 'EDICIÓN', d.documents[i].vehicleId, `Documento ${d.documents[i].type} actualizado · vence ${d.documents[i].expiryDate}`, 'Documento');

    await writeData(d);
    res.json(d.documents[i]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const d = await readData();
    const delDoc = d.documents.find(x => String(x.id) === req.params.id);
    if (delDoc) logActivity(d, 'ELIMINACIÓN', delDoc.vehicleId, `Documento ${delDoc.type}${delDoc.number ? ' ' + delDoc.number : ''} eliminado (vencía ${delDoc.expiryDate}).`, 'Documento');
    d.documents = d.documents.filter(x => String(x.id) !== req.params.id);
    await writeData(d);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/observations', async (req, res) => {
  try {
    const d = await readData();
    const b = req.body;
    if (!b.vehicleId || !clean(b.text)) return res.status(400).json({ error: 'Escribe la observación.' });

    const o = {
      id: uid(),
      vehicleId: b.vehicleId,
      date: b.date || new Date().toISOString().slice(0, 10),
      text: clean(b.text),
      priority: b.priority || 'Media',
      status: 'Pendiente',
      createdAt: new Date().toISOString()
    };

    d.observations.unshift(o);
    logActivity(d, 'CREACIÓN', o.vehicleId, `Observación (${o.priority}): ${o.text}`, 'Observación');
    await writeData(d);
    res.status(201).json(o);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/observations/:id', async (req, res) => {
  try {
    const d = await readData();
    const o = d.observations.find(x => String(x.id) === req.params.id);
    if (!o) return res.status(404).json({ error: 'Observación no encontrada' });

    Object.assign(o, req.body, { text: clean(req.body.text) });
    logActivity(d, 'EDICIÓN', o.vehicleId, `Observación actualizada (${o.priority} · ${o.status}): ${o.text}`, 'Observación');
    await writeData(d);
    res.json(o);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/observations/:id', async (req, res) => {
  try {
    const d = await readData();
    const o = d.observations.find(x => String(x.id) === req.params.id);
    if (!o) return res.status(404).json({ error: 'No encontrada' });

    o.status = req.body.status || o.status;
    logActivity(d, 'ESTADO', o.vehicleId, `Observación marcada como ${o.status}: ${o.text}`, 'Observación');
    await writeData(d);
    res.json(o);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/observations/:id', async (req, res) => {
  try {
    const d = await readData();
    const delObs = d.observations.find(x => String(x.id) === req.params.id);
    if (delObs) logActivity(d, 'ELIMINACIÓN', delObs.vehicleId, `Observación eliminada: ${delObs.text}`, 'Observación');
    d.observations = d.observations.filter(x => String(x.id) !== req.params.id);
    await writeData(d);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/weekly-reviews', async (req, res) => {
  try {
    const d = await readData();
    const b = req.body;
    if (!b.vehicleId || !b.date) return res.status(400).json({ error: 'Selecciona vehículo y fecha.' });

    const review = {
      id: uid(),
      vehicleId: b.vehicleId,
      date: b.date,
      km: num(b.km),
      tires: b.tires || 'Pendiente',
      brakes: b.brakes || 'Pendiente',
      lights: b.lights || 'Pendiente',
      fluids: b.fluids || 'Pendiente',
      cleaning: b.cleaning || 'Pendiente',
      documents: b.documents || 'Pendiente',
      notes: clean(b.notes),
      createdAt: new Date().toISOString()
    };

    const activeOilCycle = (d.oilCycles || []).find(c => String(c.vehicleId) === String(review.vehicleId) && c.status === 'En curso');
    if (activeOilCycle) review.oilCycleId = activeOilCycle.id;

    review.result = [review.tires, review.brakes, review.lights, review.fluids, review.cleaning, review.documents].some(x => x === 'Deficiente')
      ? 'Requiere atención'
      : [review.tires, review.brakes, review.lights, review.fluids, review.cleaning, review.documents].every(x => x === 'Correcto')
        ? 'Conforme'
        : 'Observaciones';

    d.weeklyReviews = d.weeklyReviews || [];
    d.weeklyReviews.unshift(review);
    logActivity(d, 'CREACIÓN', review.vehicleId, `Revisión semanal: ${review.result} · ${review.km} km${review.notes ? ' · ' + review.notes : ''}`, 'Revisión semanal');

    const v = d.vehicles.find(x => String(x.id) === String(review.vehicleId));
    if (v && review.km > num(v.currentKm)) v.currentKm = review.km;

    await writeData(d);
    res.status(201).json(review);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/weekly-reviews/:id', async (req, res) => {
  try {
    const d = await readData();
    const i = (d.weeklyReviews || []).findIndex(x => String(x.id) === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Revisión no encontrada' });

    const b = req.body;
    const r = { ...d.weeklyReviews[i], ...b, km: num(b.km) };

    r.result = [r.tires, r.brakes, r.lights, r.fluids, r.cleaning, r.documents].some(x => x === 'Deficiente')
      ? 'Requiere atención'
      : [r.tires, r.brakes, r.lights, r.fluids, r.cleaning, r.documents].every(x => x === 'Correcto')
        ? 'Conforme'
        : 'Observaciones';

    d.weeklyReviews[i] = r;
    logActivity(d, 'EDICIÓN', r.vehicleId, `Revisión semanal actualizada: ${r.result} · ${num(r.km)} km`, 'Revisión semanal');

    const v = d.vehicles.find(x => String(x.id) === String(r.vehicleId));
    if (v) v.currentKm = Math.max(num(v.currentKm), num(r.km));

    await writeData(d);
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/weekly-reviews/:id', async (req, res) => {
  try {
    const d = await readData();
    const delRev = (d.weeklyReviews || []).find(x => String(x.id) === req.params.id);
    if (delRev) logActivity(d, 'ELIMINACIÓN', delRev.vehicleId, `Revisión semanal del ${delRev.date} eliminada (${delRev.result}, ${num(delRev.km)} km).`, 'Revisión semanal');
    d.weeklyReviews = (d.weeklyReviews || []).filter(x => String(x.id) !== req.params.id);
    await writeData(d);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/export/excel', async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const d = await readData();

    const oil = (d.vehicles || []).filter(v => v.active).map(v => {
      const remaining = num(v.oilNextKm) - num(v.currentKm);
      const state = remaining <= 100 ? 'CAMBIO URGENTE' : remaining <= 500 ? 'PRONTO CAMBIO' : remaining <= 1500 ? 'EN VIGILANCIA' : 'NO URGENTE';

      return {
        'VEHÍCULO': v.name,
        'PLACA': v.plate || '',
        'ÚLTIMO CAMBIO': v.oilLastDate || '',
        'KM ÚLTIMO CAMBIO': num(v.oilLastKm),
        'KM ACTUAL': num(v.currentKm),
        'INTERVALO (KM)': num(v.oilInterval) || 5000,
        'PRÓXIMO CAMBIO': num(v.oilNextKm),
        'KM RESTANTES': remaining,
        'ESTADO': state
      };
    });

    const weekly = (d.weeklyReviews || []).map(r => ({
      'FECHA': r.date,
      'VEHÍCULO': (d.vehicles || []).find(v => String(v.id) === String(r.vehicleId))?.name || '',
      'PLACA': (d.vehicles || []).find(v => String(v.id) === String(r.vehicleId))?.plate || '',
      'KILOMETRAJE': num(r.km),
      'NEUMÁTICOS': r.tires,
      'FRENOS': r.brakes,
      'LUCES': r.lights,
      'NIVELES': r.fluids,
      'LIMPIEZA': r.cleaning,
      'DOCUMENTOS': r.documents,
      'RESULTADO': r.result,
      'OBSERVACIONES': r.notes || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(oil);
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 15 }, { wch: 17 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Control de aceite');

    const summary = [
      ['CONTROL DE CAMBIO DE ACEITE - FUNERARIA MARTÍNEZ'],
      ['Fecha de reporte', new Date().toLocaleDateString('es-PE')],
      ['Intervalo de referencia', '5,000 km (configurable por vehículo)'],
      ['Verde', 'Más de 1,500 km restantes'],
      ['Amarillo', '501 a 1,500 km restantes'],
      ['Naranja', '101 a 500 km restantes'],
      ['Rojo', '100 km o menos / vencido'],
      [],
      ['ESTADO', 'CANTIDAD'],
      ['NO URGENTE', oil.filter(x => x.ESTADO === 'NO URGENTE').length],
      ['EN VIGILANCIA', oil.filter(x => x.ESTADO === 'EN VIGILANCIA').length],
      ['PRONTO CAMBIO', oil.filter(x => x.ESTADO === 'PRONTO CAMBIO').length],
      ['CAMBIO URGENTE', oil.filter(x => x.ESTADO === 'CAMBIO URGENTE').length]
    ];

    const sm = XLSX.utils.aoa_to_sheet(summary);
    sm['!cols'] = [{ wch: 42 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, sm, 'Resumen y semáforo');

    const ww = XLSX.utils.json_to_sheet(weekly);
    XLSX.utils.book_append_sheet(wb, ww, 'Revisión semanal');

    const cycles = (d.oilCycles || []).map(c => {
      const v = (d.vehicles || []).find(x => String(x.id) === String(c.vehicleId)) || {};
      const cycleReviews = (d.weeklyReviews || []).filter(r => r.oilCycleId === c.id);
      return { 'CICLO': c.number, 'VEHÍCULO': v.name || '', 'PLACA': v.plate || '', 'ESTADO': c.status,
        'FECHA INICIO': c.startDate || '', 'KM INICIAL': num(c.startKm), 'KM PROGRAMADO': num(c.plannedKm),
        'FECHA CIERRE': c.endDate || '', 'KM FINAL': c.endKm === null ? '' : num(c.endKm),
        'KM RECORRIDOS': c.distanceKm === null ? '' : num(c.distanceKm), 'INTERVALO': num(c.intervalKm),
        'TALLER': c.provider || '', 'COSTO (S/)': num(c.cost), 'ACEITE / FILTROS': c.parts || '',
        'OBSERVACIONES': c.notes || '', 'REVISIONES SEMANALES': cycleReviews.length };
    });
    const cw = XLSX.utils.json_to_sheet(cycles);
    cw['!cols'] = Array.from({length:16}, (_,i)=>({wch:[10,22,14,14,15,15,17,15,15,16,13,22,14,28,35,22][i]}));
    XLSX.utils.book_append_sheet(wb, cw, 'Ciclos de aceite');

    const oilServices = (d.maintenances || []).filter(m => String(m.type || '').toLowerCase().includes('aceite')).map(m => {
      const v = (d.vehicles || []).find(x => String(x.id) === String(m.vehicleId)) || {};
      const cycle = (d.oilCycles || []).find(c => c.id === m.oilCycleId);
      return { 'FECHA': m.date || '', 'VEHÍCULO': v.name || '', 'PLACA': v.plate || '',
        'CICLO': cycle ? cycle.number : '', 'KILOMETRAJE': num(m.km), 'TALLER': m.provider || '',
        'COSTO (S/)': num(m.totalCost ?? m.cost), 'ACEITE / FILTROS': m.parts || '',
        'OBSERVACIONES': m.description || '', 'ESTADO': m.status || 'Realizado',
        'PRÓXIMO CAMBIO (KM)': num(m.nextKm), 'TRATAMIENTO DEL CICLO': m.oilCycleAction || 'Registro histórico' };
    });
    const os = XLSX.utils.json_to_sheet(oilServices);
    os['!cols'] = [{wch:14},{wch:22},{wch:14},{wch:10},{wch:16},{wch:22},{wch:14},{wch:28},{wch:35},{wch:14},{wch:20},{wch:38}];
    XLSX.utils.book_append_sheet(wb, os, 'Todos los cambios');

    const act = (d.maintenanceAudit || []).map(a => ({ 'FECHA Y HORA': a.at || '', 'ÁREA': a.area || '', 'ACCIÓN': a.action || '', 'VEHÍCULO': a.vehicleName || '', 'DETALLE': a.detail || '' }));
    const aw = XLSX.utils.json_to_sheet(act);
    aw['!cols'] = [{wch:24},{wch:18},{wch:22},{wch:26},{wch:80}];
    XLSX.utils.book_append_sheet(wb, aw, 'Actividad');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=Control_Flota_Martinez.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/export', async (req, res) => {
  try {
    const d = await readData();
    res.setHeader('Content-Disposition', 'attachment; filename=martinez-gestion-vehicular.json');
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`MARTÍNEZ Gestión Vehicular en puerto ${PORT}`);

      // Revisión automática cada 30 minutos. También se ejecuta al iniciar.
      checkAutomaticAlerts();
      setInterval(checkAutomaticAlerts, 30 * 60 * 1000);
    });
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
