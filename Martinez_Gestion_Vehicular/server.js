const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const JSON_FILE = path.join(DATA_DIR, 'database.json');
app.use((req,res,next)=>{res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');if(req.method==='OPTIONS')return res.sendStatus(204);next();});
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const seedVehicles = [
  ['Carroza Blanca','AZU071',168044,'2026-04-27',5000,173044,172903],
  ['Carroza Blanca H1','',294558,'2026-04-23',5000,299558,295231],
  ['Carroza Negra','BQA554',148246,'2026-04-27',5000,153246,151057],
  ['Crafter Blanca','BJQ848',174516,'2026-04-23',7500,182016,180156],
  ['Crafter Negra 1','BBK904',229982,'2026-04-23',7500,237482,235489],
  ['Crafter Negra 2','BBK870',168262,'2026-04-23',7500,175762,169265],
  ['Avanza','BZN303',197549,'2026-04-23',5000,202549,202060],
  ['Yaris Blanco','BZI116',81700,'2026-04-23',5000,86700,82935],
  ['Yocho','BSU619',0,null,5000,0,0],
  ['Kia 2','AZE247',146921,'2026-04-23',5000,151921,148221],
  ['Versa 1','CBW526',94898,'2026-04-23',5000,99898,96288],
  ['Versa 2','CBW636',89710,'2026-04-23',5000,94710,94140]
].map((v,i)=>({id:i+1,name:v[0],plate:v[1],currentKm:v[6],oilLastDate:v[3],oilInterval:v[4],oilIntervalMonths:6,oilLastKm:v[2],oilNextKm:v[5],preventiveKm:0,preventiveLastKm:null,preventiveInterval:5000,active:true,notes:''}));

let pool = null;
let local = null;

function initialData() {
  // Datos demostrativos editables para visualizar el funcionamiento. Se pueden modificar/eliminar.
  const vehicles = [
    {id:'v-demo-1',name:'Crafter Blanca',plate:'BJQ-848',currentKm:11500,oilLastKm:10000,oilLastDate:'2026-10-20',oilInterval:5000,oilIntervalMonths:6,oilNextKm:15000,preventiveLastKm:10000,preventiveInterval:5000,active:true,notes:'Unidad de traslado principal.'},
    {id:'v-demo-2',name:'Crafter Negra',plate:'BBK-904',currentKm:13800,oilLastKm:10000,oilLastDate:'2026-10-12',oilInterval:5000,oilIntervalMonths:6,oilNextKm:15000,preventiveLastKm:10000,preventiveInterval:5000,active:true,notes:'Ejemplo en vigilancia.'},
    {id:'v-demo-3',name:'Carroza Blanca',plate:'AZU-071',currentKm:14700,oilLastKm:10000,oilLastDate:'2026-09-30',oilInterval:5000,oilIntervalMonths:6,oilNextKm:15000,preventiveLastKm:10000,preventiveInterval:5000,active:true,notes:'Ejemplo próximo a cambio.'},
    {id:'v-demo-4',name:'Carroza Negra',plate:'BQA-554',currentKm:15100,oilLastKm:10000,oilLastDate:'2026-09-15',oilInterval:5000,oilIntervalMonths:6,oilNextKm:15000,preventiveLastKm:10000,preventiveInterval:5000,active:true,notes:'Ejemplo con cambio vencido.'},
    {id:'v-demo-5',name:'Yaris Blanco',plate:'BZI-116',currentKm:82935,oilLastKm:81700,oilLastDate:'2026-10-02',oilInterval:5000,oilIntervalMonths:6,oilNextKm:86700,preventiveLastKm:77935,preventiveInterval:5000,active:true,notes:'Vehículo administrativo.'},
    {id:'v-demo-6',name:'Avanza',plate:'BZN-303',currentKm:202060,oilLastKm:197549,oilLastDate:'2026-08-20',oilInterval:5000,oilIntervalMonths:6,oilNextKm:202549,preventiveLastKm:199060,preventiveInterval:5000,active:true,notes:''}
  ];
  return {
    vehicles,
    maintenances:[
      {id:'m-demo-1',vehicleId:'v-demo-1',type:'Cambio de aceite',date:'2026-10-20',km:10000,description:'Cambio de aceite y filtros',provider:'Taller Central',cost:680,parts:'Aceite y filtro',nextKm:15000},
      {id:'m-demo-2',vehicleId:'v-demo-3',type:'Preventivo',date:'2026-09-30',km:10000,description:'Chequeo preventivo general',provider:'Servicio Automotriz',cost:420,parts:'Revisión general',nextKm:15000}
    ],
    documents:[
      {id:'d-demo-1',vehicleId:'v-demo-1',type:'SOAT',number:'SOAT-EJEMPLO-001',issueDate:'2026-01-15',expiryDate:'2027-01-15',notes:''},
      {id:'d-demo-2',vehicleId:'v-demo-3',type:'Revisión técnica',number:'RT-EJEMPLO-002',issueDate:'2026-06-10',expiryDate:'2026-12-10',notes:'Programar renovación.'}
    ],
    observations:[{id:'o-demo-1',vehicleId:'v-demo-2',date:'2026-11-02',text:'Verificar desgaste de neumático delantero derecho.',priority:'Alta',status:'Pendiente'}],
    weeklyReviews:[
      {id:'w-demo-1',vehicleId:'v-demo-1',date:'2026-11-02',km:11500,tires:'Correcto',brakes:'Correcto',lights:'Correcto',fluids:'Correcto',cleaning:'Correcto',documents:'Correcto',notes:'Unidad operativa.',result:'Conforme'},
      {id:'w-demo-2',vehicleId:'v-demo-2',date:'2026-11-02',km:13800,tires:'Deficiente',brakes:'Correcto',lights:'Correcto',fluids:'Correcto',cleaning:'Correcto',documents:'Correcto',notes:'Revisar neumático delantero derecho.',result:'Requiere atención'}
    ],
    settings:{alertDays:30,kmWarning:500}, demoData:true
  };
}
function loadLocal() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(JSON_FILE)) fs.writeFileSync(JSON_FILE, JSON.stringify(initialData(), null, 2));
  try { local = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')); } catch { local = initialData(); }
}
function saveLocal() { fs.writeFileSync(JSON_FILE, JSON.stringify(local, null, 2)); }
async function initDb() {
  if (!process.env.DATABASE_URL) { loadLocal(); local.vehicles.forEach(v=>syncOilForVehicle(local,v.id)); saveLocal(); console.log('Usando almacenamiento local JSON'); return; }
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  const result = await pool.query('SELECT payload FROM app_state WHERE id=1');
  if (!result.rows.length) {
    await pool.query('INSERT INTO app_state(id,payload) VALUES(1,$1)', [JSON.stringify(initialData())]);
  } else { const data=result.rows[0].payload; (data.vehicles||[]).forEach(v=>syncOilForVehicle(data,v.id)); await writeData(data); }
}
async function readData() {
  if (!pool) return local;
  const r = await pool.query('SELECT payload FROM app_state WHERE id=1');
  return r.rows[0].payload;
}
async function writeData(data) {
  if (!pool) { local = data; saveLocal(); return; }
  await pool.query(`INSERT INTO app_state(id,payload,updated_at) VALUES(1,$1,NOW())
    ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=NOW()`, [JSON.stringify(data)]);
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const clean = s => String(s ?? '').trim();
function syncOilForVehicle(data, vehicleId) {
  const v=data.vehicles.find(x=>String(x.id)===String(vehicleId)); if(!v)return;
  const history=(data.maintenances||[]).filter(m=>String(m.vehicleId)===String(vehicleId)&&String(m.type||'').toLowerCase().includes('aceite')).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')) || num(b.km)-num(a.km));
  const latest=history[0];
  if(latest){v.oilLastKm=num(latest.km);v.oilLastDate=latest.date||v.oilLastDate;v.oilInterval=num(v.oilInterval)||5000;v.oilNextKm=v.oilLastKm+v.oilInterval;}
  else {v.oilInterval=num(v.oilInterval)||5000;v.oilLastKm=num(v.oilLastKm);v.oilNextKm=v.oilLastKm+v.oilInterval;}
}

app.get('/api/health', (req,res)=>res.json({ok:true,service:'Martinez Gestion Vehicular'}));
app.get('/api/data', async (req,res)=>{
  try { res.json(await readData()); } catch(e) { res.status(500).json({error:e.message}); }
});
app.put('/api/settings', async (req,res)=>{
  try { const d=await readData(); d.settings={...d.settings,...req.body}; await writeData(d); res.json(d.settings); } catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/vehicles', async (req,res)=>{
  try {
    const d=await readData(), b=req.body;
    if(!clean(b.name)) return res.status(400).json({error:'El nombre del vehículo es obligatorio.'});
    const interval=num(b.oilInterval)||5000; const lastKm=num(b.oilLastKm); const v={id:uid(),name:clean(b.name),plate:clean(b.plate).toUpperCase(),currentKm:num(b.currentKm),oilLastKm:lastKm,oilLastDate:b.oilLastDate||null,oilInterval:interval,oilIntervalMonths:num(b.oilIntervalMonths)||6,oilNextKm:lastKm+interval,preventiveKm:num(b.preventiveKm),preventiveLastKm:b.preventiveLastKm===''||b.preventiveLastKm==null?null:num(b.preventiveLastKm),preventiveInterval:num(b.preventiveInterval)||5000,active:b.active!==false,notes:clean(b.notes)};
    d.vehicles.push(v); await writeData(d); res.status(201).json(v);
  } catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/vehicles/:id', async (req,res)=>{
  try { const d=await readData(), i=d.vehicles.findIndex(v=>String(v.id)===req.params.id); if(i<0)return res.status(404).json({error:'Vehículo no encontrado'});
    const b=req.body, old=d.vehicles[i];
    d.vehicles[i]={...old,...b,name:clean(b.name??old.name),plate:clean(b.plate??old.plate).toUpperCase(),currentKm:num(b.currentKm??old.currentKm),oilInterval:num(b.oilInterval??old.oilInterval)||5000,oilNextKm:num(b.oilLastKm??old.oilLastKm)+(num(b.oilInterval??old.oilInterval)||5000),oilIntervalMonths:num(b.oilIntervalMonths??old.oilIntervalMonths??6),active:b.active===undefined?old.active:!!b.active};
    await writeData(d); res.json(d.vehicles[i]);
  } catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/vehicles/:id', async(req,res)=>{
  try {const d=await readData(); const id=req.params.id; const v=d.vehicles.find(x=>String(x.id)===id); if(!v)return res.status(404).json({error:'No encontrado'}); d.vehicles=d.vehicles.filter(x=>String(x.id)!==id); for(const k of ['maintenances','documents','observations','weeklyReviews']) d[k]=(d[k]||[]).filter(x=>String(x.vehicleId)!==id); await writeData(d); res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/maintenances', async(req,res)=>{
  try {const d=await readData(), b=req.body; if(!b.vehicleId||!clean(b.type)||!b.date)return res.status(400).json({error:'Completa vehículo, tipo y fecha.'});
    const m={id:uid(),vehicleId:b.vehicleId,type:clean(b.type),date:b.date,km:num(b.km),description:clean(b.description),provider:clean(b.provider),cost:num(b.cost),parts:clean(b.parts),nextDate:b.nextDate||null,nextKm:num(b.nextKm),createdAt:new Date().toISOString()};
    d.maintenances.unshift(m);
    const v=d.vehicles.find(x=>String(x.id)===String(m.vehicleId));
    if(v){v.currentKm=Math.max(num(v.currentKm),m.km); if(m.type.toLowerCase().includes('aceite')){v.oilLastKm=m.km;v.oilLastDate=m.date;v.oilInterval=num(v.oilInterval)||5000;v.oilNextKm=m.km+v.oilInterval;} if(m.type.toLowerCase().includes('preventivo')){v.preventiveLastKm=m.km;v.preventiveInterval=num(v.preventiveInterval)||5000;v.preventiveKm=m.km+v.preventiveInterval;}}
    await writeData(d); res.status(201).json(m);
  }catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/maintenances/:id', async(req,res)=>{try{const d=await readData(),i=d.maintenances.findIndex(x=>String(x.id)===req.params.id);if(i<0)return res.status(404).json({error:'Registro no encontrado'});const previous=d.maintenances[i],b=req.body;d.maintenances[i]={...previous,...b,vehicleId:b.vehicleId||previous.vehicleId,type:clean(b.type),date:b.date,km:num(b.km),cost:num(b.cost),nextKm:num(b.nextKm),description:clean(b.description),provider:clean(b.provider),parts:clean(b.parts)};const m=d.maintenances[i];if(String(previous.vehicleId)!==String(m.vehicleId))syncOilForVehicle(d,previous.vehicleId);syncOilForVehicle(d,m.vehicleId);if(m.type.toLowerCase().includes('preventivo')){const v=d.vehicles.find(x=>String(x.id)===String(m.vehicleId));if(v){v.preventiveLastKm=m.km;v.preventiveInterval=num(v.preventiveInterval)||5000;v.preventiveKm=m.km+v.preventiveInterval;v.currentKm=Math.max(num(v.currentKm),m.km);}}await writeData(d);res.json(m);}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/maintenances/:id', async(req,res)=>{
  try{const d=await readData(),old=d.maintenances.find(x=>String(x.id)===req.params.id);d.maintenances=d.maintenances.filter(x=>String(x.id)!==req.params.id);if(old)syncOilForVehicle(d,old.vehicleId);await writeData(d);res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/documents', async(req,res)=>{
  try{const d=await readData(),b=req.body;if(!b.vehicleId||!clean(b.type)||!b.expiryDate)return res.status(400).json({error:'Completa vehículo, documento y vencimiento.'});
    const doc={id:uid(),vehicleId:b.vehicleId,type:clean(b.type),number:clean(b.number),issueDate:b.issueDate||null,expiryDate:b.expiryDate,notes:clean(b.notes),createdAt:new Date().toISOString()};
    d.documents.unshift(doc);await writeData(d);res.status(201).json(doc);
  }catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/documents/:id',async(req,res)=>{try{const d=await readData(),i=d.documents.findIndex(x=>String(x.id)===req.params.id);if(i<0)return res.status(404).json({error:'Documento no encontrado'});d.documents[i]={...d.documents[i],...req.body,number:clean(req.body.number),notes:clean(req.body.notes)};await writeData(d);res.json(d.documents[i]);}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/documents/:id', async(req,res)=>{
  try{const d=await readData();d.documents=d.documents.filter(x=>String(x.id)!==req.params.id);await writeData(d);res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/observations', async(req,res)=>{
  try{const d=await readData(),b=req.body;if(!b.vehicleId||!clean(b.text))return res.status(400).json({error:'Escribe la observación.'});
    const o={id:uid(),vehicleId:b.vehicleId,date:b.date||new Date().toISOString().slice(0,10),text:clean(b.text),priority:b.priority||'Media',status:'Pendiente',createdAt:new Date().toISOString()};
    d.observations.unshift(o);await writeData(d);res.status(201).json(o);
  }catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/observations/:id',async(req,res)=>{try{const d=await readData(),o=d.observations.find(x=>String(x.id)===req.params.id);if(!o)return res.status(404).json({error:'Observación no encontrada'});Object.assign(o,req.body,{text:clean(req.body.text)});await writeData(d);res.json(o);}catch(e){res.status(500).json({error:e.message});}});
app.patch('/api/observations/:id', async(req,res)=>{
  try{const d=await readData(),o=d.observations.find(x=>String(x.id)===req.params.id);if(!o)return res.status(404).json({error:'No encontrada'});o.status=req.body.status||o.status;await writeData(d);res.json(o);}catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/observations/:id', async(req,res)=>{
  try{const d=await readData();d.observations=d.observations.filter(x=>String(x.id)!==req.params.id);await writeData(d);res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/weekly-reviews', async(req,res)=>{
  try{const d=await readData(),b=req.body;if(!b.vehicleId||!b.date)return res.status(400).json({error:'Selecciona vehículo y fecha.'});
    const review={id:uid(),vehicleId:b.vehicleId,date:b.date,km:num(b.km),tires:b.tires||'Pendiente',brakes:b.brakes||'Pendiente',lights:b.lights||'Pendiente',fluids:b.fluids||'Pendiente',cleaning:b.cleaning||'Pendiente',documents:b.documents||'Pendiente',notes:clean(b.notes),createdAt:new Date().toISOString()};
    review.result=[review.tires,review.brakes,review.lights,review.fluids,review.cleaning,review.documents].some(x=>x==='Deficiente')?'Requiere atención':[review.tires,review.brakes,review.lights,review.fluids,review.cleaning,review.documents].every(x=>x==='Correcto')?'Conforme':'Observaciones';
    d.weeklyReviews=d.weeklyReviews||[];d.weeklyReviews.unshift(review);const v=d.vehicles.find(x=>String(x.id)===String(review.vehicleId));if(v&&review.km>num(v.currentKm))v.currentKm=review.km;
    await writeData(d);res.status(201).json(review);
  }catch(e){res.status(500).json({error:e.message});}
});
app.put('/api/weekly-reviews/:id',async(req,res)=>{try{const d=await readData(),i=(d.weeklyReviews||[]).findIndex(x=>String(x.id)===req.params.id);if(i<0)return res.status(404).json({error:'Revisión no encontrada'});const b=req.body,r={...d.weeklyReviews[i],...b,km:num(b.km)};r.result=[r.tires,r.brakes,r.lights,r.fluids,r.cleaning,r.documents].some(x=>x==='Deficiente')?'Requiere atención':[r.tires,r.brakes,r.lights,r.fluids,r.cleaning,r.documents].every(x=>x==='Correcto')?'Conforme':'Observaciones';d.weeklyReviews[i]=r;const v=d.vehicles.find(x=>String(x.id)===String(r.vehicleId));if(v)v.currentKm=Math.max(num(v.currentKm),num(r.km));await writeData(d);res.json(r);}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/weekly-reviews/:id',async(req,res)=>{try{const d=await readData();d.weeklyReviews=(d.weeklyReviews||[]).filter(x=>String(x.id)!==req.params.id);await writeData(d);res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}});

app.get('/api/export/excel', async(req,res)=>{
  try {
    const XLSX=require('xlsx'); const d=await readData();
    const oil=(d.vehicles||[]).filter(v=>v.active).map(v=>{const remaining=num(v.oilNextKm)-(num(v.currentKm));let state=remaining<=100?'CAMBIO URGENTE':remaining<=500?'PRONTO CAMBIO':remaining<=1500?'EN VIGILANCIA':'NO URGENTE';return {'VEHÍCULO':v.name,'PLACA':v.plate||'','ÚLTIMO CAMBIO':v.oilLastDate||'','KM ÚLTIMO CAMBIO':num(v.oilLastKm),'KM ACTUAL':num(v.currentKm),'INTERVALO (KM)':num(v.oilInterval)||5000,'PRÓXIMO CAMBIO':num(v.oilNextKm),'KM RESTANTES':remaining,'ESTADO':state};});
    const weekly=(d.weeklyReviews||[]).map(r=>({'FECHA':r.date,'VEHÍCULO':(d.vehicles||[]).find(v=>String(v.id)===String(r.vehicleId))?.name||'','PLACA':(d.vehicles||[]).find(v=>String(v.id)===String(r.vehicleId))?.plate||'','KILOMETRAJE':num(r.km),'NEUMÁTICOS':r.tires,'FRENOS':r.brakes,'LUCES':r.lights,'NIVELES':r.fluids,'LIMPIEZA':r.cleaning,'DOCUMENTOS':r.documents,'RESULTADO':r.result,'OBSERVACIONES':r.notes||''}));
    const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(oil);ws['!cols']=[{wch:22},{wch:14},{wch:15},{wch:18},{wch:14},{wch:15},{wch:17},{wch:15},{wch:20}];XLSX.utils.book_append_sheet(wb,ws,'Control de aceite');
    const summary=[['CONTROL DE CAMBIO DE ACEITE - FUNERARIA MARTÍNEZ'],['Fecha de reporte',new Date().toLocaleDateString('es-PE')],['Intervalo de referencia','5,000 km (configurable por vehículo)'],['Verde','Más de 1,500 km restantes'],['Amarillo','501 a 1,500 km restantes'],['Naranja','101 a 500 km restantes'],['Rojo','100 km o menos / vencido'],[],['ESTADO','CANTIDAD'],['NO URGENTE',oil.filter(x=>x.ESTADO==='NO URGENTE').length],['EN VIGILANCIA',oil.filter(x=>x.ESTADO==='EN VIGILANCIA').length],['PRONTO CAMBIO',oil.filter(x=>x.ESTADO==='PRONTO CAMBIO').length],['CAMBIO URGENTE',oil.filter(x=>x.ESTADO==='CAMBIO URGENTE').length]];const sm=XLSX.utils.aoa_to_sheet(summary);sm['!cols']=[{wch:42},{wch:28}];XLSX.utils.book_append_sheet(wb,sm,'Resumen y semáforo');
    const ww=XLSX.utils.json_to_sheet(weekly);XLSX.utils.book_append_sheet(wb,ww,'Revisión semanal');
    const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});res.setHeader('Content-Disposition','attachment; filename=Control_Flota_Martinez.xlsx');res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.send(buffer);
  } catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/export', async(req,res)=>{try{const d=await readData();res.setHeader('Content-Disposition','attachment; filename=martinez-gestion-vehicular.json');res.json(d);}catch(e){res.status(500).json({error:e.message});}});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
initDb().then(()=>app.listen(PORT,()=>console.log(`MARTÍNEZ Gestión Vehicular en puerto ${PORT}`))).catch(e=>{console.error(e);process.exit(1);});
