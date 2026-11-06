let DB={vehicles:[],maintenances:[],documents:[],observations:[],weeklyReviews:[],settings:{alertDays:30,kmWarning:500}};
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
function kmState(rem){return rem<=100?['Cambio urgente','bad']:rem<=500?['Pronto cambio','orange']:rem<=1500?['En vigilancia','yellow']:['No urgente','ok']}
function oilDaysLeft(v){if(!v.oilLastDate)return null;const d=new Date(v.oilLastDate+'T12:00:00');d.setMonth(d.getMonth()+Number(v.oilIntervalMonths||6));return Math.ceil((new Date(d.toDateString())-new Date(new Date().toDateString()))/86400000)}
function oilStatus(v){const km=oilRemain(v);if(km<=100)return ['Cambio urgente','bad'];if(km<=500)return ['Pronto cambio','orange'];if(km<=1500)return ['En vigilancia','yellow'];return ['No urgente','ok']}
function docState(date){const days=Math.ceil((new Date(date+'T23:59:59')-new Date())/86400000);return days<0?['Vencido','bad']:days<=30?['Por vencer','warn']:['Vigente','ok']}
function oilRemain(v){return (Number(v.oilLastKm||0)+Number(v.oilInterval||5000))-Number(v.currentKm||0)}
function preventiveRemain(v){if(v.preventiveLastKm===undefined||v.preventiveLastKm===null||v.preventiveLastKm==='')return null;return Number(v.preventiveLastKm)+Number(v.preventiveInterval||5000)-Number(v.currentKm||0)}
function preventiveStatus(v){const r=preventiveRemain(v);if(r===null)return ['Sin chequeo','neutral'];return kmState(r)}
function vehicleLabel(v){return `${v.name}${v.plate?' · '+v.plate:''}`}
function showPage(name){$$('.page').forEach(p=>p.hidden=p.id!==`page-${name}`);$$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===name));const titles={dashboard:'Panel general',vehicles:'Vehículos',oil:'Cambios de aceite',weekly:'Revisión semanal',maintenance:'Mantenimientos',documents:'Documentos y SOAT',observations:'Observaciones'};$('#pageTitle').textContent=titles[name]||name;render();window.scrollTo(0,0)}
function go(name){showPage(name)}
$$('.nav').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
$('#today').textContent=new Date().toLocaleDateString('es-PE',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
$('#year').textContent=new Date().getFullYear();
$('#exportBtn').onclick=()=>{location.href='/api/export';toast('Preparando respaldo de datos')};
function allAlerts(){
 const a=[];
 DB.vehicles.filter(v=>v.active).forEach(v=>{const rem=oilRemain(v),days=oilDaysLeft(v),st=oilStatus(v);if(st[1]!=='ok')a.push({level:st[1],title:`Cambio de aceite: ${vehicleLabel(v)}`,desc:rem<=0?`Excedido por ${fmt(-rem)} km`:days!==null&&days<=0?`Intervalo de tiempo vencido hace ${fmt(-days)} días`:`Faltan ${fmt(rem)} km o ${days===null?'—':fmt(days)+' días'} para el servicio`});const pr=preventiveRemain(v),ps=preventiveStatus(v);if(pr!==null&&ps[1]!=='ok')a.push({level:ps[1]==='bad'?'bad':'warn',title:`Chequeo preventivo: ${vehicleLabel(v)}`,desc:pr<=0?`Chequeo vencido por ${fmt(-pr)} km`:`Faltan ${fmt(pr)} km para el chequeo de 5,000 km`})});
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
 const ok=active.filter(v=>oilRemain(v)>1500).length,soon=active.length-ok;
 $('#fleetStatus').innerHTML=`<div class="fleet-row"><span>Dentro del rango de mantenimiento</span><b>${ok}</b></div><div class="bar"><span style="width:${active.length?ok/active.length*100:0}%"></span></div><div class="fleet-row"><span>Requieren seguimiento</span><b>${soon}</b></div><div class="bar"><span style="width:${active.length?soon/active.length*100:0}%;background:#dfa13e"></span></div><div class="fleet-row"><span>Documentos vigentes</span><b>${DB.documents.filter(d=>docState(d.expiryDate)[1]==='ok').length}</b></div>`;
 const oil=[...active].sort((a,b)=>oilRemain(a)-oilRemain(b));
 $('#dashboardOil').innerHTML=oil.slice(0,6).map(v=>{let r=oilRemain(v),s=oilStatus(v);return `<tr><td class="vehicle-name">${esc(v.name)}</td><td>${esc(v.plate||'—')}</td><td>${fmt(v.currentKm)}</td><td>${fmt(Number(v.oilLastKm||0)+Number(v.oilInterval||5000))}</td><td>${fmt(r)} km</td><td><span class="pill ${s[1]}">${s[0]}</span></td></tr>`}).join('')||emptyRow(6);
 $('#vehiclesTable').innerHTML=filteredVehicles().map(v=>`<tr><td class="vehicle-name">${esc(v.name)}</td><td>${esc(v.plate||'—')}</td><td>${fmt(v.currentKm)} km</td><td>${fmt(Number(v.oilLastKm||0)+Number(v.oilInterval||5000))} km</td><td>${v.preventiveLastKm!=null?fmt(v.preventiveLastKm)+' km':'—'}</td><td><span class="pill ${preventiveStatus(v)[1]}">${preventiveStatus(v)[0]}${preventiveRemain(v)!==null?' · '+fmt(preventiveRemain(v))+' km':''}</span></td><td><span class="pill ${v.active?'ok':'neutral'}">${v.active?'Activo':'Inactivo'}</span></td><td><button class="action-btn" onclick="editVehicle('${v.id}')">Editar</button> <button class="action-btn" onclick="toggleVehicle('${v.id}')">${v.active?'Desactivar':'Activar'}</button> <button class="action-btn danger" onclick="deleteVehicle('${v.id}')">Eliminar</button></td></tr>`).join('')||emptyRow(7);
 $('#oilTable').innerHTML=oil.map(v=>{let r=oilRemain(v),s=oilStatus(v);return `<tr><td class="vehicle-name">${esc(v.name)}<span class="sub">${esc(v.plate||'Sin placa')}</span></td><td>${dateFmt(v.oilLastDate)}</td><td>${fmt(v.oilLastKm)}</td><td>${fmt(v.currentKm)}</td><td>${fmt(Number(v.oilLastKm||0)+Number(v.oilInterval||5000))}</td><td>${fmt(r)} km</td><td><span class="pill ${s[1]}">${s[0]}</span></td><td><button class="action-btn" onclick="registerOil('${v.id}')">Registrar cambio</button> <button class="action-btn" onclick="editVehicle('${v.id}')">Editar</button></td></tr>`}).join('')||emptyRow(8);
 const ms=DB.maintenances.filter(m=>{let v=vehicle(m.vehicleId);return (!$('#maintenanceSearch')?.value||`${v?.name} ${v?.plate} ${m.type} ${m.description}`.toLowerCase().includes($('#maintenanceSearch').value.toLowerCase()))&&($('#maintenanceType')?.value==='all'||m.type===$('#maintenanceType')?.value)});
 $('#maintenanceTable').innerHTML=ms.map(m=>`<tr><td>${dateFmt(m.date)}</td><td class="vehicle-name">${esc(vehicleLabel(vehicle(m.vehicleId)||{name:'Eliminado'}))}</td><td>${esc(m.type)}<span class="sub">${esc(m.description)}</span></td><td>${fmt(m.km)} km</td><td>${esc(m.provider||'—')}</td><td>${money(m.cost)}</td><td><button class="action-btn" onclick="editMaintenance('${m.id}')">Editar</button> <button class="action-btn danger" onclick="deleteItem('maintenances','${m.id}')">Eliminar</button></td></tr>`).join('')||emptyRow(7);
 $('#documentsTable').innerHTML=DB.documents.map(d=>{let s=docState(d.expiryDate);return `<tr><td class="vehicle-name">${esc(vehicleLabel(vehicle(d.vehicleId)||{name:'Eliminado'}))}</td><td>${esc(d.type)}</td><td>${esc(d.number||'—')}</td><td>${dateFmt(d.issueDate)}</td><td>${dateFmt(d.expiryDate)}</td><td><span class="pill ${s[1]}">${s[0]}</span></td><td><button class="action-btn" onclick="editDocument('${d.id}')">Editar</button> <button class="action-btn danger" onclick="deleteItem('documents','${d.id}')">Eliminar</button></td></tr>`}).join('')||emptyRow(7);
 const wr=DB.weeklyReviews||[];const weekStart=new Date();weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));weekStart.setHours(0,0,0,0);const weekEnd=new Date(weekStart);weekEnd.setDate(weekEnd.getDate()+7);const thisWeek=wr.filter(x=>{const d=new Date(x.date+'T12:00:00');return d>=weekStart&&d<weekEnd});
 $('#weeklyStats').innerHTML=[['Revisiones esta semana',thisWeek.length,'Inspecciones registradas'],['Conformes',thisWeek.filter(x=>x.result==='Conforme').length,'Sin observaciones'],['Requieren atención',thisWeek.filter(x=>x.result==='Requiere atención').length,'Revisar incidencias'],['Vehículos activos',active.length,'Unidades en flota']].map(x=>`<div class="stat"><div class="stat-top"><span>${x[0]}</span></div><strong>${fmt(x[1])}</strong><small>${x[2]}</small></div>`).join('');
 $('#weeklyTable').innerHTML=wr.map(r=>`<tr><td>${dateFmt(r.date)}</td><td class="vehicle-name">${esc(vehicleLabel(vehicle(r.vehicleId)||{name:'Eliminado'}))}</td><td>${fmt(r.km)} km</td><td>${esc(r.tires)}</td><td>${esc(r.brakes)}</td><td>${esc(r.lights)}</td><td>${esc(r.fluids)}</td><td><span class="pill ${r.result==='Conforme'?'ok':r.result==='Requiere atención'?'bad':'warn'}">${esc(r.result)}</span></td><td><button class="action-btn" onclick="editWeekly('${r.id}')">Editar</button> <button class="action-btn danger" onclick="deleteWeekly('${r.id}')">Eliminar</button></td></tr>`).join('')||emptyRow(9);
 $('#observationsList').innerHTML=DB.observations.map(o=>`<article class="obs-card"><div class="obs-meta"><span>${esc(vehicleLabel(vehicle(o.vehicleId)||{name:'Eliminado'}))}</span><span>${dateFmt(o.date)}</span></div><p>${esc(o.text)}</p><div class="obs-meta"><span class="pill ${o.priority==='Alta'?'bad':o.priority==='Baja'?'neutral':'warn'}">${esc(o.priority)}</span><div class="obs-actions"><select aria-label="Estado" onchange="setObservation('${o.id}',this.value)"><option ${o.status==='Pendiente'?'selected':''}>Pendiente</option><option ${o.status==='En proceso'?'selected':''}>En proceso</option><option ${o.status==='Resuelto'?'selected':''}>Resuelto</option></select><button class="action-btn" onclick="editObservation('${o.id}')">Editar</button> <button class="action-btn danger" onclick="deleteObservation('${o.id}')">Eliminar</button></div></div></article>`).join('')||'<div class="panel empty">Todavía no hay observaciones registradas.</div>';
}
function emptyRow(n){return `<tr><td colspan="${n}" class="empty">No hay registros para mostrar.</td></tr>`}
function filteredVehicles(){let q=$('#vehicleSearch')?.value.toLowerCase()||'',f=$('#vehicleFilter')?.value||'all';return DB.vehicles.filter(v=>(f==='all'||(f==='active'?v.active:!v.active))&&`${v.name} ${v.plate}`.toLowerCase().includes(q))}
['vehicleSearch','vehicleFilter','maintenanceSearch','maintenanceType'].forEach(id=>$('#'+id)?.addEventListener('input',render));
function fields(items){return items.map(f=>`<div class="field ${f.full?'full':''}"><label>${f.label}${f.required?' *':''}</label>${f.type==='select'?`<select name="${f.name}" ${f.required?'required':''}>${f.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(f.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea name="${f.name}" placeholder="${esc(f.placeholder||'')}"></textarea>`:`<input name="${f.name}" type="${f.type||'text'}" value="${esc(f.value??'')}" placeholder="${esc(f.placeholder||'')}" ${f.required?'required':''} ${f.min!==undefined?`min="${f.min}"`:''} ${f.step?`step="${f.step}"`:''}>`}</div>`).join('')}
function vehicleOptions(){return DB.vehicles.map(v=>({value:v.id,label:vehicleLabel(v)}))}
function openModal(title,formFields,submit){$('#modalTitle').textContent=title;$('#modalFields').innerHTML=fields(formFields);$('#modal').hidden=false;$('#modalForm').onsubmit=async e=>{e.preventDefault();let data=Object.fromEntries(new FormData(e.target).entries());try{await submit(data);$('#modal').hidden=true;e.target.reset();await refresh();toast('Registro guardado correctamente')}catch(err){toast(err.message)}}}
function closeModal(){$('#modal').hidden=true}
$$('[data-close]').forEach(x=>x.addEventListener('click',closeModal));
$('#addVehicle').onclick=()=>openModal('Registrar vehículo',[
 {name:'name',label:'Nombre del vehículo',required:true},{name:'plate',label:'Placa'},
 {name:'currentKm',label:'Kilometraje actual',type:'number',min:0,required:true},
 {name:'oilLastKm',label:'KM del último cambio de aceite',type:'number',min:0},
 {name:'oilLastDate',label:'Fecha del último cambio',type:'date'},
 {name:'oilInterval',label:'Intervalo de aceite (km)',type:'number',value:5000,min:1,required:true},
 {name:'oilIntervalMonths',label:'Intervalo de aceite (meses)',type:'number',value:6,min:1,required:true},
 {name:'preventiveLastKm',label:'KM del último chequeo preventivo',type:'number',min:0},
 {name:'preventiveInterval',label:'Intervalo de chequeo preventivo (km)',type:'number',value:5000,min:1,required:true},
 {name:'notes',label:'Notas',type:'textarea',full:true}
],d=>api('/vehicles',{method:'POST',body:JSON.stringify(d)}));
window.editVehicle=id=>{let v=vehicle(id);openModal('Actualizar vehículo',[
 {name:'name',label:'Nombre',value:v.name,required:true},{name:'plate',label:'Placa',value:v.plate},
 {name:'currentKm',label:'Kilometraje actual',type:'number',value:v.currentKm,min:0},
 {name:'oilLastKm',label:'KM último aceite',type:'number',value:v.oilLastKm,min:0},
 {name:'oilLastDate',label:'Fecha último aceite',type:'date',value:v.oilLastDate||''},
 {name:'oilInterval',label:'Intervalo aceite (km)',type:'number',value:v.oilInterval,min:1},
 {name:'oilIntervalMonths',label:'Intervalo aceite (meses)',type:'number',value:v.oilIntervalMonths||6,min:1},
 {name:'preventiveLastKm',label:'KM del último chequeo preventivo',type:'number',value:v.preventiveLastKm,min:0},
 {name:'preventiveInterval',label:'Intervalo de chequeo preventivo (km)',type:'number',value:v.preventiveInterval||5000,min:1},
 {name:'notes',label:'Notas',type:'textarea',value:v.notes,full:true}
],d=>api('/vehicles/'+id,{method:'PUT',body:JSON.stringify({...d,active:v.active})}))};
window.deleteVehicle=async id=>{const v=vehicle(id);if(!confirm(`¿Eliminar definitivamente ${v.name} y sus registros asociados?`))return;await api('/vehicles/'+id,{method:'DELETE'});await refresh();toast('Vehículo y registros asociados eliminados')};
window.toggleVehicle=async id=>{let v=vehicle(id);if(!confirm(`${v.active?'¿Desactivar':'¿Activar'} ${v.name}?`))return;await api('/vehicles/'+id,{method:'PUT',body:JSON.stringify({...v,active:!v.active})});await refresh();toast('Estado actualizado')};
window.registerOil=id=>{const v=vehicle(id);openModal('Registrar cambio de aceite · '+v.name,[{name:'date',label:'Fecha del cambio',type:'date',value:today(),required:true},{name:'km',label:'Kilometraje al realizar el cambio',type:'number',min:0,value:v.currentKm,required:true},{name:'provider',label:'Taller / proveedor'},{name:'cost',label:'Costo (S/)',type:'number',min:0,step:'0.01'},{name:'parts',label:'Aceite y filtros utilizados'},{name:'description',label:'Observaciones',type:'textarea',full:true}],d=>api('/maintenances',{method:'POST',body:JSON.stringify({...d,vehicleId:id,type:'Cambio de aceite',nextKm:Number(d.km)+(Number(v.oilInterval)||5000)})}))};
$('#oilReportBtn')?.addEventListener('click',()=>{window.location.href=API_BASE+'/api/export/excel'});
$('#addMaintenance').onclick=()=>openModal('Registrar mantenimiento',[
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true},
 {name:'type',label:'Tipo de servicio',type:'select',required:true,options:['Preventivo','Correctivo','Cambio de aceite','Reparación','Neumáticos','Otro'].map(x=>({value:x,label:x}))},
 {name:'date',label:'Fecha del servicio',type:'date',value:today(),required:true},
 {name:'km',label:'Kilometraje al servicio',type:'number',min:0,required:true},
 {name:'nextKm',label:'Próximo servicio (km)',type:'number',min:0},
 {name:'nextDate',label:'Próxima fecha (opcional)',type:'date'},
 {name:'provider',label:'Taller / proveedor'},
 {name:'cost',label:'Costo (S/)',type:'number',min:0,step:'0.01'},
 {name:'parts',label:'Repuestos utilizados'},
 {name:'description',label:'Detalle y observaciones',type:'textarea',full:true}
],d=>api('/maintenances',{method:'POST',body:JSON.stringify(d)}));
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
$('#addWeekly').onclick=()=>openModal('Registrar revisión semanal',[
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true},
 {name:'date',label:'Fecha de revisión',type:'date',value:today(),required:true},
 {name:'km',label:'Kilometraje actual',type:'number',min:0,required:true},
 ...['tires','brakes','lights','fluids','cleaning','documents'].map((name,i)=>({name,label:['Neumáticos','Frenos','Luces','Niveles de aceite/agua','Limpieza general','Documentos'][i],type:'select',options:['Correcto','Deficiente','Pendiente'].map(x=>({value:x,label:x}))})),
 {name:'notes',label:'Observaciones / trabajos pendientes',type:'textarea',full:true}
],d=>api('/weekly-reviews',{method:'POST',body:JSON.stringify(d)}));
window.deleteWeekly=async id=>{if(!confirm('¿Eliminar esta revisión semanal?'))return;await api('/weekly-reviews/'+id,{method:'DELETE'});await refresh();toast('Revisión eliminada')};
window.deleteItem=async(type,id)=>{if(!confirm('¿Eliminar este registro?'))return;await api('/'+type+'/'+id,{method:'DELETE'});await refresh();toast('Registro eliminado')};
window.deleteObservation=async id=>{if(!confirm('¿Eliminar esta observación?'))return;await api('/observations/'+id,{method:'DELETE'});await refresh();toast('Observación eliminada')};
window.setObservation=async(id,status)=>{await api('/observations/'+id,{method:'PATCH',body:JSON.stringify({status})});await refresh();toast('Estado actualizado')};
function commonMaintenanceFields(m={}){return [
 {name:'vehicleId',label:'Vehículo',type:'select',options:vehicleOptions(),required:true,value:m.vehicleId},
 {name:'type',label:'Tipo de servicio',type:'select',required:true,options:['Preventivo','Correctivo','Cambio de aceite','Reparación','Neumáticos','Otro'].map(x=>({value:x,label:x})),value:m.type},
 {name:'date',label:'Fecha del servicio',type:'date',value:m.date||today(),required:true},{name:'km',label:'Kilometraje',type:'number',min:0,value:m.km,required:true},
 {name:'nextKm',label:'Próximo servicio (km)',type:'number',min:0,value:m.nextKm},{name:'nextDate',label:'Próxima fecha',type:'date',value:m.nextDate||''},
 {name:'provider',label:'Taller / proveedor',value:m.provider},{name:'cost',label:'Costo (S/)',type:'number',min:0,step:'0.01',value:m.cost},{name:'parts',label:'Repuestos',value:m.parts},{name:'description',label:'Detalle',type:'textarea',value:m.description,full:true}
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
async function refresh(){DB=await api('/data');DB.weeklyReviews=DB.weeklyReviews||[];render()}
refresh().catch(e=>toast(e.message));
// Sincronización entre usuarios: consulta cambios compartidos cada 15 segundos.
setInterval(()=>{if(!document.hidden)refresh().catch(()=>{});},15000);
