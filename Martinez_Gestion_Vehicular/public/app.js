let DB={vehicles:[],maintenances:[],documents:[],observations:[],weeklyReviews:[],oilCycles:[],settings:{alertDays:30,kmWarning:500}};
const API_BASE=(window.API_BASE_URL||'').replace(/\/$/,'');
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=n=>Number(n||0).toLocaleString('es-PE');
const money=n=>'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
const today=()=>new Date().toISOString().slice(0,10);
const dateFmt=s=>s?new Date(s+'T12:00:00').toLocaleDateString('es-PE'):'—';
const vehicle=id=>DB.vehicles.find(v=>String(v.id)===String(id));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,opts={}){const r=await fetch(API_BASE+'/api'+url,{headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});let data={};try{data=await r.json()}catch{}if(!r.ok)throw Error(data.error||'No se pudo completar la operación');return data}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function kmState(rem){const c=DB.settings||{};const orange=Math.max(0,Number(c.orangeMinKm??100));const yellow=Math.max(orange,Number(c.yellowMinKm??500));const green=Math.max(yellow,Number(c.greenMinKm??1500));return rem<=orange?['Cambio urgente','bad']:rem<=yellow?['Pronto cambio','orange']:rem<=green?['En vigilancia','yellow']:['No urgente','ok']}
function oilDaysLeft(v){const cycle=activeOilCycle(v);const baseDate=cycle?.startDate||v.oilLastDate;if(!baseDate)return null;const d=new Date(baseDate+'T12:00:00');d.setMonth(d.getMonth()+Number(v.oilIntervalMonths||6));return Math.ceil((new Date(d.toDateString())-new Date(new Date().toDateString()))/86400000)}
function oilStatus(v){return kmState(oilRemain(v))}
function docState(date){const days=Math.ceil((new Date(date+'T23:59:59')-new Date())/86400000);return days<0?['Vencido','bad']:days<=30?['Por vencer','warn']:['Vigente','ok']}
function activeOilCycle(v){return (DB.oilCycles||[]).find(c=>String(c.vehicleId)===String(v.id)&&c.status==='En curso')}
function oilRemain(v){const c=activeOilCycle(v);const limit=c?Number(c.plannedKm):Number(v.oilNextKm||Number(v.oilLastKm||0)+Number(v.oilInterval||DB.settings?.oilIntervalKm||5000));return limit-Number(v.currentKm||0)}
function preventiveNextDate(v){if(!v.preventiveLastDate)return null;const d=new Date(v.preventiveLastDate+'T12:00:00');const n=Math.max(1,Number(v.preventiveIntervalValue||1));const u=v.preventiveIntervalUnit||'months';if(u==='days')d.setDate(d.getDate()+n);else if(u==='weeks')d.setDate(d.getDate()+7*n);else if(u==='years')d.setFullYear(d.getFullYear()+n);else d.setMonth(d.getMonth()+n);return d}
function preventiveStatus(v){const d=preventiveNextDate(v);if(!d)return ['Sin programar','neutral'];const days=Math.ceil((d-new Date())/86400000);return days<0?['Vencido','bad']:days<=7?['Próximo','warn']:['Al día','ok']}
function preventiveFrequency(v){return v.preventiveIntervalValue?`${v.preventiveIntervalValue} ${({days:'día(s)',weeks:'semana(s)',months:'mes(es)',years:'año(s)'})[v.preventiveIntervalUnit||'months']}`:'—'}
function vehicleLabel(v){return `${v.name}${v.plate?' · '+v.plate:''}`}
function showPage(name){$$('.page').forEach(p=>p.hidden=p.id!==`page-${name}`);$$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===name));const titles={dashboard:'Panel general',vehicles:'Vehículos',oil:'Cambios de aceite',weekly:'Revisión semanal',maintenance:'Mantenimientos',documents:'Documentos y SOAT',observations:'Observaciones',history:'Historial técnico',settings:'Configuración'};$('#pageTitle').textContent=titles[name]||name;render();window.scrollTo(0,0)}
function go(name){showPage(name)}
$$('.nav').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
$('#today').textContent=new Date().toLocaleDateString('es-PE',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
$('#year').textContent=new Date().getFullYear();
$('#exportBtn').onclick=()=>{location.href='/api/export';toast('Preparando respaldo de datos')};
function allAlerts(){
 const a=[];
 DB.vehicles.filter(v=>v.active).forEach(v=>{const rem=oilRemain(v),days=oilDaysLeft(v),st=oilStatus(v);if(st[1]!=='ok')a.push({level:st[1],title:`Cambio de aceite: ${vehicleLabel(v)}`,desc:rem<=0?`Excedido por ${fmt(-rem)} km`:days!==null&&days<=0?`Intervalo de tiempo vencido hace ${fmt(-days)} días`:`Faltan ${fmt(rem)} km o ${days===null?'—':fmt(days)+' días'} para el servicio`});const pd=preventiveNextDate(v),ps=preventiveStatus(v);if(pd&&ps[1]!=='ok')a.push({level:ps[1]==='bad'?'bad':'warn',title:`Chequeo preventivo: ${vehicleLabel(v)}`,desc:`${ps[0]} · fecha programada ${pd.toLocaleDateString('es-PE')}`})});
 DB.documents.forEach(d=>{const st=docState(d.expiryDate);if(st[1]!=='ok')a.push({level:st[1],title:`${d.type}: ${vehicleLabel(vehicle(d.vehicleId)||{name:'Vehículo'})}`,desc:st[1]==='bad'?`Venció el ${dateFmt(d.expiryDate)}`:`Vence el ${dateFmt(d.expiryDate)}`})});
 return a;
}
function render(){
 const active=DB.vehicles.filter(v=>v.active), alerts=allAlerts(), expired=alerts.filter(a=>a.level==='bad').length;
 $('#alertStrip').hidden=!alerts.length;$('#alertStrip').textContent=alerts.length?`⚠ ${alerts.length} alerta(s): ${expired} vencida(s) y ${alerts.length-expired} próxima(s). Revisa el panel de alertas.`:'';
 $('#stats').innerHTML=[
  ['Vehículos activos',active.length,'Unidades registradas','▣'],
  ['Alertas pendientes',alerts.length,`${expired} requieren atención inmediata`,'⚑'],
  ['Servicios registrados',DB.maintenances.length,'Historial acumulado','⚙'],
  ['Documentos por vencer',DB.documents.filter(d=>docState(d.expiryDate)[1]!=='ok').length,'SOAT y otros documentos','▤']
 ].map(x=>`<div class="stat"><div class="stat-top"><span>${x[0]}</span><span class="stat-icon">${x[3]}</span></div><strong>${fmt(x[1])}</strong><small>${x[2]}</small></div>`).join('');
 $('#alertsList').innerHTML=alerts.length?alerts.slice(0,7).map(a=>`<div class="alert-item"><div class="alert-symbol ${a.level==='bad'?'red':''}">${a.level==='bad'?'!':'◷'}</div><div><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></div></div>`).join(''):'<div class="empty">No hay alertas pendientes. La flota está al día.</div>';
 const ok=active.filter(v=>oilRemain(v)>Number(DB.settings?.greenMinKm??1500)).length,soon=active.length-ok;
 $('#fleetStatus').innerHTML=`<div class="fleet-row"><span>Dentro del rango de mantenimiento</span><b>${ok}</b></div><div class="bar"><span style="width:${active.length?ok/active.length*100:0}%"></span></div><div class="fleet-row"><span>Requieren seguimiento</span><b>${soon}</b></div><div class="bar"><span style="width:${active.length?soon/active.length*100:0}%;background:#dfa13e"></span></div><div class="fleet-row"><span>Documentos vigentes</span><b>${DB.documents.filter(d=>docState(d.expiryDate)[1]==='ok').length}</b></div>`;
 const oil=[...active].sort((a,b)=>oilRemain(a)-oilRemain(b));
 $('#dashboardOil').innerHTML=oil.slice(0,6).map(v=>{let r=oilRemain(v),s=oilStatus(v);return `<tr><td class="vehicle-name">${esc(v.name)}</td><td>${esc(v.plate||'—')}</td><td>${fmt(v.currentKm)}</td><td>${fmt(activeOilCycle(v)?.plannedKm??v.oilNextKm??(Number(v.oilLastKm||0)+Number(v.oilInterval||5000)))}</td><td>${fmt(r)} km</td><td><span class="pill ${s[1]}">${s[0]}</span></td></tr>`}).join('')||emptyRow(6);
 $('#vehiclesTable').innerHTML=filteredVehicles().map(v=>`<tr><td class="vehicle-name">${esc(v.name)}</td><td>${esc(v.plate||'—')}</td><td>${fmt(v.currentKm)} km</td><td><span class="pill ${v.active?'ok':'neutral'}">${v.active?'Activo':'Inactivo'}</span></td><td><button class="action-btn" onclick="editVehicle('${v.id}')">Editar</button> <button class="action-btn" onclick="toggleVehicle('${v.id}')">${v.active?'Desactivar':'Activar'}</button> <button class="action-btn danger" onclick="deleteVehicle('${v.id}')">Eliminar</button></td></tr>`).join('')||emptyRow(5);
 $('#oilTable').innerHTML=oil.map(v=>{let r=oilRemain(v),s=oilStatus(v);return `<tr><td class="vehicle-name">${esc(v.name)}<span class="sub">${esc(v.plate||'Sin placa')}</span></td><td>${dateFmt(lastOilService(v)?.date||activeOilCycle(v)?.startDate||v.oilLastDate)}</td><td>${fmt(lastOilService(v)?.km??activeOilCycle(v)?.startKm??v.oilLastKm)}</td><td>${fmt(activeOilCycle(v)?.startKm??v.oilLastKm)}</td><td>${fmt(v.currentKm)}</td><td>${fmt(activeOilCycle(v)?.plannedKm??v.oilNextKm??(Number(v.oilLastKm||0)+Number(v.oilInterval||5000)))}</td><td>${fmt(r)} km</td><td><span class="pill ${s[1]}">${s[0]}</span></td><td><button class="action-btn" onclick="registerOil('${v.id}')">Registrar cambio</button> <button class="action-btn" onclick="editVehicle('${v.id}')">Editar</button></td></tr>`}).join('')||emptyRow(9);
 const cycles=(DB.oilCycles||[]).slice().sort((a,b)=>String(b.startDate||'').localeCompare(String(a.startDate||''))||Number(b.number||0)-Number(a.number||0));
 const cycleRows=$('#oilCyclesTable'); if(cycleRows) cycleRows.innerHTML=cycles.map(c=>{const v=vehicle(c.vehicleId)||{name:'Vehículo eliminado'};const reviews=(DB.weeklyReviews||[]).filter(r=>r.oilCycleId===c.id).length;const period=`${dateFmt(c.startDate)} – ${c.endDate?dateFmt(c.endDate):'En curso'}`;return `<tr><td><b>#${String(c.number||1).padStart(3,'0')}</b></td><td class="vehicle-name">${esc(vehicleLabel(v))}</td><td>${period}</td><td>${fmt(c.startKm)} km</td><td>${fmt(c.plannedKm)} km</td><td>${c.endKm===null||c.endKm===undefined?fmt(v.currentKm)+' km':fmt(c.endKm)+' km'}</td><td>${c.distanceKm===null||c.distanceKm===undefined?fmt(Math.max(0,Number(v.currentKm||0)-Number(c.startKm||0)))+' km':fmt(c.distanceKm)+' km'}</td><td>${reviews}</td><td><span class="pill ${c.status==='Cerrado'?'ok':'warn'}">${esc(c.status)}</span></td></tr>`}).join('')||emptyRow(9);
 const cfgBody=$('#oilVehicleSettings'); if(cfgBody) cfgBody.innerHTML=DB.vehicles.map(v=>`<tr><td class="vehicle-name">${esc(vehicleLabel(v))}</td><td>${fmt(v.currentKm)} km</td><td>${fmt(v.oilLastKm)} km</td><td>${fmt(v.oilInterval||DB.settings?.oilIntervalKm||5000)} km</td><td>${fmt(activeOilCycle(v)?.plannedKm??v.oilNextKm??(Number(v.oilLastKm||0)+Number(v.oilInterval||DB.settings?.oilIntervalKm||5000)))} km</td><td><button class="action-btn" onclick="configureOilVehicle('${v.id}')">Configurar</button></td></tr>`).join('')||emptyRow(6);
 const sf=$('#oilSettingsForm'); if(sf&&!sf.dataset.loaded){const c=DB.settings||{};sf.elements.oilIntervalKm.value=c.oilIntervalKm??5000;sf.elements.greenMinKm.value=c.greenMinKm??1500;sf.elements.yellowMinKm.value=c.yellowMinKm??500;sf.elements.orangeMinKm.value=c.orangeMinKm??100;if(sf.elements.earlyOilChangeRestartsCycle)sf.elements.earlyOilChangeRestartsCycle.checked=!!c.earlyOilChangeRestartsCycle;sf.dataset.loaded='1';}
 const rule=$('#oilRulesNotice'); if(rule){const c=DB.settings||{};rule.textContent=`Semáforo configurable: verde más de ${fmt(c.greenMinKm??1500)} km · amarillo ${fmt(c.yellowMinKm??500)}–${fmt(c.greenMinKm??1500)} km · naranja ${fmt(c.orangeMinKm??100)}–${fmt(c.yellowMinKm??500)} km · rojo ${fmt(c.orangeMinKm??100)} km o menos. El intervalo actual es ${fmt(c.oilIntervalKm??5000)} km.`;}
 const c=DB.settings||{};const lg=$('#legendGreen');if(lg)lg.textContent=`Más de ${fmt(c.greenMinKm??1500)} km`;const ly=$('#legendYellow');if(ly)ly.textContent=`${fmt(c.yellowMinKm??500)}–${fmt(c.greenMinKm??1500)} km`;const lo=$('#legendOrange');if(lo)lo.textContent=`${fmt(c.orangeMinKm??100)}–${fmt(c.yellowMinKm??500)} km`;const lr=$('#legendRed');if(lr)lr.textContent=`${fmt(c.orangeMinKm??100)} km o menos`;
 const ms=DB.maintenances.filter(m=>{if(String(m.type||'').trim().toLowerCase()==='cambio de aceite')return false;let v=vehicle(m.vehicleId);return (!$('#maintenanceSearch')?.value||`${v?.name} ${v?.plate} ${m.type} ${m.description}`.toLowerCase().includes($('#maintenanceSearch').value.toLowerCase()))&&($('#maintenanceType')?.value==='all'||m.type===$('#maintenanceType')?.value)});
 $('#maintenanceTable').innerHTML=ms.map(m=>`<tr><td>${dateFmt(m.date)}</td><td class="vehicle-name">${esc(vehicleLabel(vehicle(m.vehicleId)||{name:'Eliminado'}))}</td><td>${esc(m.type)}<span class="sub">${esc(m.description)}</span></td><td>${fmt(m.km)} km</td><td>${esc(m.provider||'—')}</td><td>${money(m.cost)}</td><td><button class="action-btn" onclick="editMaintenance('${m.id}')">Editar</button> <button class="action-btn danger" onclick="deleteItem('maintenances','${m.id}')">Eliminar</button></td></tr>`).join('')||emptyRow(7);
 $('#documentsTable').innerHTML=DB.documents.map(d=>{let s=docState(d.expiryDate);return `<tr><td class="vehicle-name">${esc(vehicleLabel(vehicle(d.vehicleId)||{name:'Eliminado'}))}</td><td>${esc(d.type)}</td><td>${esc(d.number||'—')}</td><td>${dateFmt(d.issueDate)}</td><td>${dateFmt(d.expiryDate)}</td><td><span class="pill ${s[1]}">${s[0]}</span></td><td><button class="action-btn" onclick="editDocument('${d.id}')">Editar</button> <button class="action-btn danger" onclick="deleteItem('documents','${d.id}')">Eliminar</button></td></tr>`}).join('')||emptyRow(7);
 const schedule=$('#preventiveScheduleTable'); if(schedule) schedule.innerHTML=active.map(v=>{const next=preventiveNextDate(v),st=preventiveStatus(v);return `<tr><td class="vehicle-name">${esc(vehicleLabel(v))}</td><td>${dateFmt(v.preventiveLastDate)}</td><td>${esc(preventiveFrequency(v))}</td><td>${next?next.toLocaleDateString('es-PE'):'—'}</td><td><span class="pill ${st[1]}">${st[0]}</span></td><td><button class="action-btn" onclick="configurePreventive('${v.id}')">Configurar</button></td></tr>`}).join('')||emptyRow(6);
 const wr=DB.weeklyReviews||[];const weekStart=new Date();weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));weekStart.setHours(0,0,0,0);const weekEnd=new Date(weekStart);weekEnd.setDate(weekEnd.getDate()+7);const thisWeek=wr.filter(x=>{const d=new Date(x.date+'T12:00:00');return d>=weekStart&&d<weekEnd});
 $('#weeklyStats').innerHTML=[['Revisiones esta semana',thisWeek.length,'Inspecciones registradas'],['Conformes',thisWeek.filter(x=>x.result==='Conforme').length,'Sin observaciones'],['Requieren atención',thisWeek.filter(x=>x.result==='Requiere atención').length,'Revisar incidencias'],['Vehículos activos',active.length,'Unidades en flota']].map(x=>`<div class="stat"><div class="stat-top"><span>${x[0]}</span></div><strong>${fmt(x[1])}</strong><small>${x[2]}</small></div>`).join('');
 $('#weeklyTable').innerHTML=wr.map(r=>`<tr><td>${dateFmt(r.date)}</td><td class="vehicle-name">${esc(vehicleLabel(vehicle(r.vehicleId)||{name:'Eliminado'}))}</td><td>${fmt(r.km)} km</td><td>${esc(r.tires)}</td><td>${esc(r.brakes)}</td><td>${esc(r.lights)}</td><td>${esc(r.fluids)}</td><td><span class="pill ${r.result==='Conforme'?'ok':r.result==='Requiere atención'?'bad':'warn'}">${esc(r.result)}</span></td><td><button class="action-btn" onclick="editWeekly('${r.id}')">Editar</button> <button class="action-btn danger" onclick="deleteWeekly('${r.id}')">Eliminar</button></td></tr>`).join('')||emptyRow(9);
 $('#observationsList').innerHTML=DB.observations.map(o=>`<article class="obs-card"><div class="obs-meta"><span>${esc(vehicleLabel(vehicle(o.vehicleId)||{name:'Eliminado'}))}</span><span>${dateFmt(o.date)}</span></div><p>${esc(o.text)}</p><div class="obs-meta"><span class="pill ${o.priority==='Alta'?'bad':o.priority==='Baja'?'neutral':'warn'}">${esc(o.priority)}</span><div class="obs-actions"><select aria-label="Estado" onchange="setObservation('${o.id}',this.value)"><option ${o.status==='Pendiente'?'selected':''}>Pendiente</option><option ${o.status==='En proceso'?'selected':''}>En proceso</option><option ${o.status==='Resuelto'?'selected':''}>Resuelto</option></select><button class="action-btn" onclick="editObservation('${o.id}')">Editar</button> <button class="action-btn danger" onclick="deleteObservation('${o.id}')">Eliminar</button></div></div></article>`).join('')||'<div class="panel empty">Todavía no hay observaciones registradas.</div>';

 const hq=($('#historySearch')?.value||'').toLowerCase();
 const hv=$('#historyVehicle')?.value||'all', hk=$('#historyKind')?.value||'all', hs=$('#historyStatus')?.value||'all';
 const history=(DB.maintenances||[]).filter(m=>{
   const v=vehicle(m.vehicleId)||{name:'Vehículo eliminado',plate:''};
   const kind=m.workKind||(String(m.type||'').toLowerCase()==='reparación'?'Reparación':'Mantenimiento');
   const status=m.status||'Realizado';
   const hay=[v.name,v.plate,m.driverName,m.type,m.description,m.provider,m.technician,m.parts].join(' ').toLowerCase();
   return (!hq||hay.includes(hq))&&(hv==='all'||String(m.vehicleId)===hv)&&(hk==='all'||kind===hk)&&(hs==='all'||status===hs);
 }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const histBody=$('#historyTable');
 if(histBody) histBody.innerHTML=history.map(m=>{const v=vehicle(m.vehicleId)||{name:'Vehículo eliminado'};const total=Number(m.totalCost??m.cost??0);const st=m.status||'Realizado';return `<tr><td>${dateFmt(m.date)}</td><td class="vehicle-name">${esc(vehicleLabel(v))}</td><td>${esc(m.driverName||'—')}</td><td>${esc(m.workKind|| (String(m.type).toLowerCase()==='reparación'?'Reparación':'Mantenimiento'))}<span class="sub">${esc(m.type||'')} · ${esc(m.description||'')}</span></td><td>${esc(m.provider||'—')}<span class="sub">${esc(m.technician||'')}</span></td><td>${fmt(m.km)} km</td><td>${money(total)}</td><td><span class="pill ${st==='Realizado'?'ok':st==='Anulado'?'neutral':'warn'}">${esc(st)}</span></td><td><button class="action-btn" onclick="editMaintenance('${m.id}')">Editar</button> ${st!=='Anulado'?`<button class="action-btn danger" onclick="annulHistory('${m.id}')">Anular</button>`:''}</td></tr>`}).join('')||emptyRow(9);
 const audit=$('#historyAuditTable'); if(audit) audit.innerHTML=(DB.maintenanceAudit||[]).filter(a=>hv==='all'||String(a.vehicleId)===hv).slice(0,100).map(a=>`<tr><td>${a.at?new Date(a.at).toLocaleString('es-PE'):'—'}</td><td>${a.area?esc(a.area)+' · ':''}${esc(a.action)}</td><td>${esc(a.vehicleName||'—')}</td><td>${esc(a.detail||'')}</td></tr>`).join('')||emptyRow(4);
 const tl=$('#timelineTable'); if(tl) tl.innerHTML=timelineItems(hv).slice(0,300).map(i=>`<tr><td>${dateFmt(i.date)}</td><td class="vehicle-name">${esc(i.vehicle)}</td><td><span class="pill ${i.tone}">${esc(i.src)}</span></td><td>${esc(i.detail)}</td><td>${i.km!=null&&i.km!==''?fmt(i.km)+' km':'—'}</td><td>${esc(i.status||'')}</td></tr>`).join('')||emptyRow(6);
 const ohv=$('#oilHistoryVehicle'); if(ohv){const old=ohv.value;ohv.innerHTML='<option value="all">Todos los vehículos</option>'+DB.vehicles.map(v=>`<option value="${esc(v.id)}">${esc(vehicleLabel(v))}</option>`).join('');ohv.value=[...ohv.options].some(o=>o.value===old)?old:'all';}
 const osv=$('#oilHistoryVehicle')?.value||'all';
 const osb=$('#oilServicesTable'); if(osb) osb.innerHTML=(DB.maintenances||[]).filter(m=>/aceite/i.test(m.type||'')&&(osv==='all'||String(m.vehicleId)===osv)).sort((x,y)=>String(y.date||'').localeCompare(String(x.date||''))||String(y.createdAt||'').localeCompare(String(x.createdAt||''))).map(m=>{const v=vehicle(m.vehicleId)||{name:'Vehículo eliminado'};const cy=(DB.oilCycles||[]).find(c=>c.id===m.oilCycleId);const st=m.status||'Realizado';return `<tr><td>${dateFmt(m.date)}</td><td class="vehicle-name">${esc(vehicleLabel(v))}</td><td>${fmt(m.km)} km</td><td>${cy?'#'+String(cy.number||1).padStart(3,'0'):'—'}</td><td>${esc(m.oilCycleAction||'Registro histórico')}</td><td>${m.nextKm?fmt(m.nextKm)+' km':'—'}</td><td>${esc(m.provider||'—')}<span class="sub">${esc(m.parts||'')}</span></td><td>${money(m.totalCost??m.cost)}</td><td><span class="pill ${st==='Realizado'?'ok':st==='Anulado'?'neutral':'warn'}">${esc(st)}</span></td></tr>`}).join('')||emptyRow(9);
 const vehicleFilter=$('#historyVehicle'); if(vehicleFilter){const old=vehicleFilter.value;vehicleFilter.innerHTML='<option value="all">Todos los vehículos</option>'+DB.vehicles.map(v=>`<option value="${esc(v.id)}">${esc(vehicleLabel(v))}</option>`).join('');vehicleFilter.value=[...vehicleFilter.options].some(o=>o.value===old)?old:'all';}
}
function timelineItems(vid){
 const ok=x=>vid==='all'||String(x.vehicleId)===String(vid);const name=id=>vehicleLabel(vehicle(id)||{name:'Vehículo eliminado'});const items=[];
 (DB.maintenances||[]).filter(ok).forEach(m=>{const oil=/aceite/i.test(m.type||'');items.push({date:m.date,sort:m.createdAt||'',vehicle:name(m.vehicleId),src:oil?'Cambio de aceite':(m.workKind||'Mantenimiento'),tone:oil?'orange':'ok',detail:`${m.type||''}${m.description?' · '+m.description:''}${m.provider?' · '+m.provider:''}${m.oilCycleAction?' · '+m.oilCycleAction:''}`,km:m.km,status:m.status||'Realizado'})});
 (DB.weeklyReviews||[]).filter(ok).forEach(r=>items.push({date:r.date,sort:r.createdAt||'',vehicle:name(r.vehicleId),src:'Revisión semanal',tone:r.result==='Conforme'?'ok':r.result==='Requiere atención'?'bad':'warn',detail:`Resultado: ${r.result||'—'}${r.notes?' · '+r.notes:''}`,km:r.km,status:r.result}));
 (DB.observations||[]).filter(ok).forEach(o=>items.push({date:o.date,sort:o.createdAt||'',vehicle:name(o.vehicleId),src:'Observación',tone:o.priority==='Alta'?'bad':'warn',detail:`${o.priority||''} · ${o.text||''}`,km:null,status:o.status}));
 (DB.documents||[]).filter(ok).forEach(d=>items.push({date:d.issueDate||(d.createdAt||'').slice(0,10),sort:d.createdAt||'',vehicle:name(d.vehicleId),src:'Documento',tone:'neutral',detail:`${d.type||''}${d.number?' '+d.number:''} · vence ${dateFmt(d.expiryDate)}`,km:null,status:''}));
 (DB.maintenanceAudit||[]).filter(a=>ok(a)&&(a.area==='Vehículo'||a.action==='CONFIGURACIÓN ACEITE')).forEach(a=>items.push({date:(a.at||'').slice(0,10),sort:a.at||'',vehicle:a.vehicleName||'—',src:a.area==='Vehículo'?'Vehículo':'Config. aceite',tone:'neutral',detail:`${a.action}: ${a.detail||''}`,km:null,status:''}));
 return items.sort((x,y)=>String(y.date||'').localeCompare(String(x.date||''))||String(y.sort).localeCompare(String(x.sort)));
}
function lastOilService(v){return (DB.maintenances||[]).filter(m=>String(m.vehicleId)===String(v.id)&&/aceite/i.test(m.type||'')&&(m.status||'Realizado')!=='Anulado').sort((x,y)=>String(y.date||'').localeCompare(String(x.date||''))||Number(y.km||0)-Number(x.km||0))[0]}
async function submitOil(v,d){
 const c=activeOilCycle(v);
 if(c){const km=Number(d.km),planned=Number(c.plannedKm),interval=Number(c.intervalKm)||Number(v.oilInterval)||5000,flag=!!DB.settings?.earlyOilChangeRestartsCycle;
  const msg=km<planned&&!flag
   ?`CAMBIO ANTICIPADO a ${fmt(km)} km.\n\nEl ciclo actual (${fmt(c.startKm)} → ${fmt(planned)} km) NO se reinicia: el próximo cambio sigue en ${fmt(planned)} km.\nEl cambio queda guardado en el historial de aceite.\n\n¿Registrar?`
   :km<planned
   ?`CAMBIO ANTICIPADO a ${fmt(km)} km.\n\nSegún tu configuración, este cambio REINICIA el contador: el próximo cambio será a ${fmt(km+interval)} km.\n\n¿Registrar?`
   :`Este cambio (${fmt(km)} km) alcanza o supera el límite de ${fmt(planned)} km.\n\nSe cerrará el ciclo actual y el próximo cambio será a ${fmt(km+interval)} km.\n\n¿Registrar?`;
  if(!confirm(msg))throw Error('Registro cancelado');}
 const nextKm=Number(c?.plannedKm??v.oilNextKm??(Number(v.oilLastKm||0)+(Number(v.oilInterval)||5000)));
 return api('/maintenances',{method:'POST',body:JSON.stringify({...d,type:'Cambio de aceite',workKind:'Mantenimiento',nextKm})});
}
function emptyRow(n){return `<tr><td colspan="${n}" class="empty">No hay registros para mostrar.</td></tr>`}
function filteredVehicles(){let q=$('#vehicleSearch')?.value.toLowerCase()||'',f=$('#vehicleFilter')?.value||'all';return DB.vehicles.filter(v=>(f==='all'||(f==='active'?v.active:!v.active))&&`${v.name} ${v.plate}`.toLowerCase().includes(q))}
['vehicleSearch','vehicleFilter','maintenanceSearch','maintenanceType','historySearch','historyVehicle','historyKind','historyStatus','oilHistoryVehicle'].forEach(id=>$('#'+id)?.addEventListener('input',render));
function fields(items){return items.map(f=>`<div class="field ${f.full?'full':''}"><label>${f.label}${f.required?' *':''}</label>${f.type==='select'?`<select name="${f.name}" ${f.required?'required':''}>${f.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(f.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea name="${f.name}" placeholder="${esc(f.placeholder||'')}"></textarea>`:`<input name="${f.name}" type="${f.type||'text'}" value="${esc(f.value??'')}" placeholder="${esc(f.placeholder||'')}" ${f.required?'required':''} ${f.min!==undefined?`min="${f.min}"`:''} ${f.step?`step="${f.step}"`:''}>`}</div>`).join('')}
function vehicleOptions(){return DB.vehicles.map(v=>({value:v.id,label:vehicleLabel(v)}))}
function openModal(title,formFields,submit){$('#modalTitle').textContent=title;$('#modalFields').innerHTML=fields(formFields);$('#modal').hidden=false;$('#modalForm').onsubmit=async e=>{e.preventDefault();let data=Object.fromEntries(new FormData(e.target).entries());try{await submit(data);$('#modal').hidden=true;e.target.reset();await refresh();toast('Registro guardado correctamente')}catch(err){toast(err.message)}}}
function closeModal(){$('#modal').hidden=true}
$$('[data-close]').forEach(x=>x.addEventListener('click',closeModal));
$('#addVehicle').onclick=()=>openModal('Registrar vehículo',[
 {name:'name',label:'Nombre del vehículo',required:true},{name:'plate',label:'Placa'},
 {name:'currentKm',label:'Kilometraje actual',type:'number',min:0,required:true},
 {name:'oilLastKm',label:'Último cambio de aceite (km)',type:'number',min:0,value:0},
 {name:'oilInterval',label:'Intervalo de aceite (km)',type:'number',min:1,value:DB.settings?.oilIntervalKm||5000},
 {name:'notes',label:'Notas generales',type:'textarea',full:true}
],d=>api('/vehicles',{method:'POST',body:JSON.stringify(d)}));
window.editVehicle=id=>{let v=vehicle(id);openModal('Actualizar datos del vehículo',[
 {name:'name',label:'Nombre',value:v.name,required:true},{name:'plate',label:'Placa',value:v.plate},
 {name:'currentKm',label:'Kilometraje actual',type:'number',value:v.currentKm,min:0},
 {name:'oilLastKm',label:'Último cambio de aceite (km)',type:'number',value:v.oilLastKm,min:0},
 {name:'oilInterval',label:'Intervalo de aceite (km)',type:'number',value:v.oilInterval||DB.settings?.oilIntervalKm||5000,min:1},
 {name:'notes',label:'Notas generales',type:'textarea',value:v.notes,full:true}
],d=>api('/vehicles/'+id,{method:'PUT',body:JSON.stringify({...d,active:v.active})}))};
window.configurePreventive=id=>{const v=vehicle(id);openModal('Programar chequeo preventivo · '+v.name,[
 {name:'preventiveLastDate',label:'Fecha de última revisión',type:'date',value:v.preventiveLastDate||today(),required:true},
 {name:'preventiveIntervalValue',label:'Frecuencia cada',type:'number',min:1,value:v.preventiveIntervalValue||1,required:true},
 {name:'preventiveIntervalUnit',label:'Unidad de tiempo',type:'select',value:v.preventiveIntervalUnit||'months',options:[['days','Días'],['weeks','Semanas'],['months','Meses'],['years','Años']].map(([value,label])=>({value,label}))}
],d=>api('/vehicles/'+id,{method:'PUT',body:JSON.stringify({...v,...d})}))};
$('#configurePreventive')?.addEventListener('click',()=>{const active=DB.vehicles.filter(v=>v.active);if(!active.length)return toast('Primero registra un vehículo');openModal('Configurar chequeo preventivo',[{name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true},{name:'preventiveLastDate',label:'Fecha de última revisión',type:'date',value:today(),required:true},{name:'preventiveIntervalValue',label:'Frecuencia cada',type:'number',min:1,value:1,required:true},{name:'preventiveIntervalUnit',label:'Unidad de tiempo',type:'select',value:'months',options:[['days','Días'],['weeks','Semanas'],['months','Meses'],['years','Años']].map(([value,label])=>({value,label}))}],async d=>{const v=vehicle(d.vehicleId);await api('/vehicles/'+v.id,{method:'PUT',body:JSON.stringify({...v,preventiveLastDate:d.preventiveLastDate,preventiveIntervalValue:d.preventiveIntervalValue,preventiveIntervalUnit:d.preventiveIntervalUnit})})})});
window.deleteVehicle=async id=>{const v=vehicle(id);if(!confirm(`¿Eliminar definitivamente ${v.name} y sus registros asociados?`))return;await api('/vehicles/'+id,{method:'DELETE'});await refresh();toast('Vehículo y registros asociados eliminados')};
window.toggleVehicle=async id=>{let v=vehicle(id);if(!confirm(`${v.active?'¿Desactivar':'¿Activar'} ${v.name}?`))return;await api('/vehicles/'+id,{method:'PUT',body:JSON.stringify({...v,active:!v.active})});await refresh();toast('Estado actualizado')};
window.registerOil=id=>{const v=vehicle(id);if(!v)return toast('Selecciona un vehículo registrado');openModal('Registrar cambio de aceite · '+v.name,[{name:'date',label:'Fecha del cambio',type:'date',value:today(),required:true},{name:'km',label:'Kilometraje al realizar el cambio',type:'number',min:0,value:v.currentKm,required:true},{name:'provider',label:'Taller / proveedor'},{name:'cost',label:'Costo (S/)',type:'number',min:0,step:'0.01'},{name:'parts',label:'Aceite y filtros utilizados'},{name:'description',label:'Observaciones',type:'textarea',full:true}],d=>submitOil(v,{...d,vehicleId:id}))};
$('#quickOilBtn')?.addEventListener('click',()=>{const active=DB.vehicles.filter(v=>v.active);if(!active.length)return toast('Primero registra un vehículo en el módulo Vehículos');openModal('Registrar cambio de aceite',[{name:'vehicleId',label:'Vehículo',type:'select',options:active.map(v=>({value:v.id,label:vehicleLabel(v)})),required:true},{name:'date',label:'Fecha del cambio',type:'date',value:today(),required:true},{name:'km',label:'Kilometraje al realizar el cambio',type:'number',min:0,required:true},{name:'provider',label:'Taller / proveedor'},{name:'cost',label:'Costo (S/)',type:'number',min:0,step:'0.01'},{name:'parts',label:'Aceite y filtros utilizados'},{name:'description',label:'Observaciones',type:'textarea',full:true}],d=>{const v=vehicle(d.vehicleId);if(!v)throw Error('No se encontró el vehículo seleccionado');return submitOil(v,{...d,vehicleId:v.id})})});
$('#oilReportBtn')?.addEventListener('click',()=>{window.location.href=API_BASE+'/api/export/excel'});
$('#addMaintenance').onclick=()=>openModal('Registrar mantenimiento',[
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true},
 {name:'type',label:'Tipo de servicio',type:'select',required:true,options:['Preventivo','Correctivo','Reparación','Neumáticos','Otro'].map(x=>({value:x,label:x}))},
 {name:'date',label:'Fecha del servicio',type:'date',value:today(),required:true},
 {name:'km',label:'Kilometraje al servicio',type:'number',min:0,required:true},
 {name:'workKind',label:'Clase de intervención',type:'select',options:['Mantenimiento','Reparación'].map(x=>({value:x,label:x}))},
 {name:'driverName',label:'Nombre del chofer'},
 {name:'provider',label:'Taller / proveedor'},
 {name:'technician',label:'Mecánico / técnico responsable'},
 {name:'laborCost',label:'Costo de mano de obra (S/)',type:'number',min:0,step:'0.01'},
 {name:'partsCost',label:'Costo de repuestos (S/)',type:'number',min:0,step:'0.01'},
 {name:'cost',label:'Costo total (S/)',type:'number',min:0,step:'0.01'},
 {name:'parts',label:'Repuestos utilizados'},
 {name:'status',label:'Estado',type:'select',options:['Realizado','Pendiente'].map(x=>({value:x,label:x}))},
 {name:'description',label:'Detalle y observaciones',type:'textarea',full:true}
],d=>api('/maintenances',{method:'POST',body:JSON.stringify(d)}));
$('#addHistory')?.addEventListener('click',()=>{go('maintenance');$('#addMaintenance').click()});
window.annulHistory=async id=>{if(!confirm('¿Anular esta intervención? El registro permanecerá en el historial.'))return;await api('/maintenances/'+id,{method:'DELETE'});await refresh();toast('Intervención anulada; se conservó en el historial')};
$('#addDocument').onclick=()=>openModal('Registrar documento',[
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true},
 {name:'type',label:'Tipo de documento',type:'select',required:true,options:['SOAT','Revisión técnica','Seguro vehicular','Tarjeta de propiedad','Permiso de circulación','Otro'].map(x=>({value:x,label:x}))},
 {name:'number',label:'Número / póliza'},
 {name:'issueDate',label:'Fecha de emisión',type:'date'},
 {name:'expiryDate',label:'Fecha de vencimiento',type:'date',required:true},
 {name:'notes',label:'Observaciones',type:'textarea',full:true}
],d=>api('/documents',{method:'POST',body:JSON.stringify(d)}));
$('#addObservation').onclick=()=>openModal('Nueva observación',[
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true},
 {name:'date',label:'Fecha',type:'date',value:today(),required:true},
 {name:'priority',label:'Prioridad',type:'select',options:['Baja','Media','Alta'].map(x=>({value:x,label:x}))},
 {name:'text',label:'Observación / incidencia',type:'textarea',full:true,required:true}
],d=>api('/observations',{method:'POST',body:JSON.stringify(d)}));
window.configureOilVehicle=id=>{const v=vehicle(id);if(!v)return;openModal('Configurar control de aceite · '+v.name,[
 {name:'currentKm',label:'Kilometraje actual del odómetro',type:'number',min:0,value:v.currentKm,required:true},
 {name:'oilLastKm',label:'Kilometraje del último cambio realizado',type:'number',min:0,value:activeOilCycle(v)?.startKm??v.oilLastKm??0,required:true},
 {name:'oilLastDate',label:'Fecha del último cambio',type:'date',value:activeOilCycle(v)?.startDate||v.oilLastDate||''},
 {name:'oilInterval',label:'Intervalo entre cambios (km)',type:'number',min:1,value:v.oilInterval||DB.settings?.oilIntervalKm||5000,required:true}
 ],d=>api('/vehicles/'+id,{method:'PUT',body:JSON.stringify({...v,...d})}))};
$('#oilSettingsForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const d=Object.fromEntries(new FormData(f).entries());const settings={earlyOilChangeRestartsCycle:!!f.elements.earlyOilChangeRestartsCycle?.checked,oilIntervalKm:Number(d.oilIntervalKm),greenMinKm:Number(d.greenMinKm),yellowMinKm:Number(d.yellowMinKm),orangeMinKm:Number(d.orangeMinKm)};if(!(settings.greenMinKm>settings.yellowMinKm&&settings.yellowMinKm>settings.orangeMinKm&&settings.orangeMinKm>=0)){toast('Los rangos deben cumplir: verde > amarillo > naranja ≥ 0');return}try{await api('/settings',{method:'PUT',body:JSON.stringify(settings)});f.dataset.loaded='';await refresh();toast('Configuración de aceite guardada')}catch(err){toast(err.message)}});
$('#addWeekly').onclick=()=>openModal('Registrar revisión semanal',[
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true},
 {name:'date',label:'Fecha de revisión',type:'date',value:today(),required:true},
 {name:'km',label:'Kilometraje actual',type:'number',min:0,required:true},
 ...['tires','brakes','lights','fluids','cleaning','documents'].map((name,i)=>({name,label:['Neumáticos','Frenos','Luces','Niveles de aceite/agua','Limpieza general','Documentos'][i],type:'select',options:['Correcto','Deficiente','Pendiente'].map(x=>({value:x,label:x}))})),
 {name:'notes',label:'Observaciones / trabajos pendientes',type:'textarea',full:true}
],d=>api('/weekly-reviews',{method:'POST',body:JSON.stringify(d)}));
window.deleteWeekly=async id=>{if(!confirm('¿Eliminar esta revisión semanal?'))return;await api('/weekly-reviews/'+id,{method:'DELETE'});await refresh();toast('Revisión eliminada')};
window.deleteItem=async(type,id)=>{if(!confirm(type==='maintenances'?'¿Anular esta intervención? El registro se conservará en el historial.':'¿Eliminar este registro?'))return;await api('/'+type+'/'+id,{method:'DELETE'});await refresh();toast(type==='maintenances'?'Intervención anulada y conservada':'Registro eliminado')};
window.deleteObservation=async id=>{if(!confirm('¿Eliminar esta observación?'))return;await api('/observations/'+id,{method:'DELETE'});await refresh();toast('Observación eliminada')};
window.setObservation=async(id,status)=>{await api('/observations/'+id,{method:'PATCH',body:JSON.stringify({status})});await refresh();toast('Estado actualizado')};
function commonMaintenanceFields(m={}){return [
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true,value:m.vehicleId},
 {name:'type',label:'Tipo de servicio',type:'select',required:true,options:['Preventivo','Correctivo','Reparación','Neumáticos','Otro'].map(x=>({value:x,label:x})),value:m.type},
 {name:'date',label:'Fecha del servicio',type:'date',value:m.date||today(),required:true},{name:'km',label:'Kilometraje',type:'number',min:0,value:m.km,required:true},
 {name:'workKind',label:'Clase de intervención',type:'select',options:['Mantenimiento','Reparación'].map(x=>({value:x,label:x})),value:m.workKind||(String(m.type).toLowerCase()==='reparación'?'Reparación':'Mantenimiento')},{name:'driverName',label:'Nombre del chofer',value:m.driverName},{name:'provider',label:'Taller / proveedor',value:m.provider},{name:'technician',label:'Mecánico / técnico responsable',value:m.technician},{name:'laborCost',label:'Mano de obra (S/)',type:'number',min:0,step:'0.01',value:m.laborCost},{name:'partsCost',label:'Repuestos (S/)',type:'number',min:0,step:'0.01',value:m.partsCost},{name:'cost',label:'Costo total (S/)',type:'number',min:0,step:'0.01',value:m.totalCost??m.cost},{name:'parts',label:'Repuestos',value:m.parts},{name:'status',label:'Estado',type:'select',options:['Realizado','Pendiente','Anulado'].map(x=>({value:x,label:x})),value:m.status||'Realizado'},{name:'description',label:'Detalle del trabajo / observaciones',type:'textarea',value:m.description,full:true}
]}
window.editMaintenance=id=>{const m=DB.maintenances.find(x=>String(x.id)===String(id));openModal('Editar mantenimiento',commonMaintenanceFields(m),d=>api('/maintenances/'+id,{method:'PUT',body:JSON.stringify(d)}))};
window.editDocument=id=>{const d=DB.documents.find(x=>String(x.id)===String(id));openModal('Editar documento',[
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true,value:d.vehicleId},
 {name:'type',label:'Tipo',type:'select',required:true,options:['SOAT','Revisión técnica','Seguro vehicular','Tarjeta de propiedad','Permiso de circulación','Otro'].map(x=>({value:x,label:x})),value:d.type},
 {name:'number',label:'Número / póliza',value:d.number},{name:'issueDate',label:'Emisión',type:'date',value:d.issueDate||''},{name:'expiryDate',label:'Vencimiento',type:'date',value:d.expiryDate,required:true},{name:'notes',label:'Observaciones',type:'textarea',value:d.notes,full:true}
],data=>api('/documents/'+id,{method:'PUT',body:JSON.stringify(data)}))};
window.editObservation=id=>{const o=DB.observations.find(x=>String(x.id)===String(id));openModal('Editar observación',[
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true,value:o.vehicleId},{name:'date',label:'Fecha',type:'date',value:o.date,required:true},
 {name:'priority',label:'Prioridad',type:'select',options:['Baja','Media','Alta'].map(x=>({value:x,label:x})),value:o.priority},{name:'text',label:'Observación',type:'textarea',value:o.text,full:true,required:true}
],data=>api('/observations/'+id,{method:'PUT',body:JSON.stringify({...data,status:o.status})}))};
window.editWeekly=id=>{const r=DB.weeklyReviews.find(x=>String(x.id)===String(id));openModal('Editar revisión semanal',[
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true,value:r.vehicleId},{name:'date',label:'Fecha',type:'date',value:r.date,required:true},{name:'km',label:'Kilometraje',type:'number',min:0,value:r.km,required:true},
 ...['tires','brakes','lights','fluids','cleaning','documents'].map((name,i)=>({name,label:['Neumáticos','Frenos','Luces','Niveles de aceite/agua','Limpieza general','Documentos'][i],type:'select',value:r[name],options:['Correcto','Deficiente','Pendiente'].map(x=>({value:x,label:x}))})),
 {name:'notes',label:'Observaciones',type:'textarea',value:r.notes,full:true}
],data=>api('/weekly-reviews/'+id,{method:'PUT',body:JSON.stringify(data)}))};
async function refresh(){DB=await api('/data');DB.weeklyReviews=DB.weeklyReviews||[];DB.oilCycles=DB.oilCycles||[];DB.maintenanceAudit=DB.maintenanceAudit||[];render()}
refresh().catch(e=>toast(e.message));
// Sincronización entre usuarios: consulta cambios compartidos cada 15 segundos.
setInterval(()=>{if(!document.hidden)refresh().catch(()=>{});},15000);
// ==========================================
// NOTIFICACIONES PUSH - MARTÍNEZ VEHICULAR
// ==========================================

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  return Uint8Array.from(
    [...rawData].map(char => char.charCodeAt(0))
  );
}

async function activarNotificaciones() {
  const button = document.getElementById('enableNotifications');

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Activando...';
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Tu navegador no admite notificaciones push.');
    }

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      throw new Error('Debes permitir las notificaciones en el navegador.');
    }

    const keyResponse = await fetch(`${API_BASE}/api/push/public-key`);
    const keyData = await keyResponse.json();

    if (!keyResponse.ok || !keyData.publicKey) {
      throw new Error(keyData.error || 'No se pudo obtener la clave pública.');
    }

    const registration = await navigator.serviceWorker.register('/service-worker.js');

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });
    }

    const response = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        responsibleName: 'Administrador'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'No se pudo registrar este dispositivo.');
    }

    if (button) {
      button.textContent = '🔔 Notificaciones activadas';
    }

    alert(result.message || '¡Notificaciones activadas correctamente!');

  } catch (error) {
    console.error('Error al activar notificaciones:', error);
    alert(error.message || 'Ocurrió un error al activar las notificaciones.');

    if (button) {
      button.textContent = '🔔 Activar notificaciones';
    }

  } finally {
    if (button) button.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('enableNotifications');

  if (button) {
    button.addEventListener('click', activarNotificaciones);
  }
});

// Muestra las versiones de pantalla y servidor para comprobar que el despliegue quedó actualizado.
document.addEventListener('DOMContentLoaded', async () => {
  const el = document.getElementById('versionInfo');
  if (!el) return;
  try {
    const r = await fetch((window.API_BASE_URL || '').replace(/\/$/, '') + '/api/health');
    const j = await r.json();
    el.textContent = `Versión pantalla: 1.3.2 · Servidor: ${j.version || 'ANTERIOR (sin actualizar)'}`;
  } catch {
    el.textContent = 'Versión pantalla: 1.3.2 · Servidor: no responde';
  }
});
