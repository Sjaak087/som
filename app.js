import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getDatabase, ref, onValue, set, update, push
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig={
  apiKey:"AIzaSyCLIitv_qfqA5XnSRI_UEwZfJotyiOo2K0",
  authDomain:"somtoday-auto-planner.firebaseapp.com",
  databaseURL:"https://somtoday-auto-planner-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:"somtoday-auto-planner",
  storageBucket:"somtoday-auto-planner.firebasestorage.app",
  messagingSenderId:"268264096258",
  appId:"1:268264096258:web:f69f5d73c1b96393249d1b",
  measurementId:"G-EJWG9XSXWY"
};

const state={
  user:null,uid:null,
  profile:{name:"Jouw Naam",accent:"violet"},
  connection:{calendarId:"",calendarUrl:"",lastSync:""},
  roster:[],rosterCache:[],rosterSource:"DEMO",
  grades:[],tasks:[],tests:[],
  weekOffset:0,
  dataListeners:[],
  appReady:false,
  anonymous:true
};

const demoRoster=[
  {date:isoDate(new Date()),start:"08:30",end:"09:20",title:"Nederlands",location:"Lokaal 102"},
  {date:isoDate(new Date()),start:"09:30",end:"10:20",title:"Wiskunde",location:"Lokaal 205"},
  {date:isoDate(addDays(new Date(),1)),start:"09:20",end:"10:10",title:"Engels",location:"Lokaal 103"},
  {date:isoDate(addDays(new Date(),2)),start:"08:30",end:"09:20",title:"Latijn",location:"Lokaal 132"},
  {date:isoDate(addDays(new Date(),2)),start:"09:20",end:"10:10",title:"Biologie",location:"Lokaal 302"}
];

const $=id=>document.getElementById(id);
const userPath=()=>`users/${state.uid}`;

function pad(n){return String(n).padStart(2,"0")}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function isoDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);const day=x.getDay()||7;x.setDate(x.getDate()+1-day);return x}
function mondayAtOffset(o){return addDays(startOfWeek(new Date()),o*7)}
function mins(t){const [h,m]=(t||"00:00").split(":").map(Number);return h*60+(m||0)}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dutch(d,opts){return new Intl.DateTimeFormat("nl-NL",opts).format(d)}
function weekNo(d){
  const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);
  const y=new Date(Date.UTC(x.getUTCFullYear(),0,1));
  return Math.ceil((((x-y)/86400000)+1)/7)
}

function show(id){$(id)?.classList.remove("hidden")}
function hide(id){$(id)?.classList.add("hidden")}

function showFatal(message,details=""){
  const screen=$("loadingScreen");
  if(!screen)return;
  screen.innerHTML=`<div style="max-width:560px;padding:26px;text-align:center">
    <div style="font-size:38px;margin-bottom:10px">⚠</div>
    <h2 style="margin:0 0 8px;color:#fff">Firebase kon niet starten</h2>
    <p style="color:#cdd7f0">${escapeHtml(message)}</p>
    <p style="font-size:11px;color:#8d99b8">${escapeHtml(details)}</p>
    <button id="retryFirebase" class="primary" style="margin-top:10px">Opnieuw proberen</button>
  </div>`;
  screen.classList.remove("hidden");
  $("retryFirebase")?.addEventListener("click",()=>location.reload());
}

function syncMark(name,ok=true){
  const el=$(`saveState${name}`);
  if(el)el.textContent=ok?"✓":"!";
  const dot=$("syncDot");
  if(dot){dot.style.background=ok?"#34d399":"#fb7185";dot.style.boxShadow=ok?"0 0 12px rgba(52,211,153,.45)":"0 0 12px rgba(251,113,133,.45)"}
}

async function dbWrite(path,value){
  try{await set(ref(db,`${userPath()}/${path}`),value);return true}
  catch(e){console.error("Firebase write",path,e);syncMark(path.split("/")[0],false);$("syncText").textContent="Firebase write mislukt";return false}
}

async function dbPatch(path,value){
  try{await update(ref(db,`${userPath()}/${path}`),value);return true}
  catch(e){console.error("Firebase update",path,e);return false}
}

/* ---------- PROFILE ---------- */
function renderProfile(){
  const name=state.profile.name||"Jouw Naam";
  $("nameDisplay").textContent=name;$("nameTop").textContent=name;$("heroName").textContent=name;
  const initials=name.split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"JD";
  $("avatar").textContent=initials;$("avatarTiny").textContent=initials;
  $("userEmail").textContent=state.user?.isAnonymous?"Anonieme sessie":(state.user?.email||"");
  document.body.classList.remove("accent-cyan","accent-pink","accent-green");
  if(state.profile.accent!=="violet")document.body.classList.add(`accent-${state.profile.accent}`);
}

/* ---------- CLOCK ---------- */
function renderClock(){
  const now=new Date();
  $("clock").textContent=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $("clockDate").textContent=dutch(now,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  $("heroDate").textContent=dutch(now,{weekday:"long",day:"numeric",month:"long"});
}

/* ---------- CALENDAR ---------- */
function renderCalendar(){
  const base=mondayAtOffset(state.weekOffset);
  $("weekLabel").textContent=`Week ${weekNo(base)}`;
  $("calendarMonth").textContent=dutch(base,{month:"long",year:"numeric"});
  $("calendarRange").textContent=`${dutch(base,{day:"numeric",month:"short"})} – ${dutch(addDays(base,4),{day:"numeric",month:"short"})}`;
  $("sourcePill").textContent=state.rosterSource;

  $("timeAxis").innerHTML=Array.from({length:9},(_,i)=>`<span>${6+i}:00</span>`).join("");
  const names=["Ma","Di","Wo","Do","Vr"];
  $("days").innerHTML=names.map((name,i)=>{
    const d=addDays(base,i),date=isoDate(d);
    const items=[
      ...state.roster.filter(x=>x.date===date).map(x=>({...x,kind:"roster"})),
      ...state.tasks.filter(x=>x.date===date).map(x=>({...x,kind:"task"})),
      ...state.tests.filter(x=>x.date===date).map(x=>({...x,kind:"test",end:x.end||addMinutesToTime(x.start,50)}))
    ].sort((a,b)=>mins(a.start)-mins(b.start));
    return `<div class="day">
      <div class="day-header"><small>${name}</small><strong>${d.getDate()}</strong></div>
      <div class="day-body">${items.map(renderEvent).join("")}</div>
    </div>`;
  }).join("");
  renderStats();
}

function addMinutesToTime(t,add){
  const base=mins(t||"00:00")+add;
  return `${pad(Math.floor(base/60)%24)}:${pad(base%60)}`;
}

function renderEvent(e){
  let top=mins(e.start||"08:00")-360;
  top=Math.max(0,top);
  const endM=mins(e.end||addMinutesToTime(e.start,50));
  let height=Math.max(42,endM-mins(e.start||"08:00")-5);
  if(e.allDay){top=5;height=44}
  return `<div class="event ${escapeHtml(e.kind||"")}" style="top:${top}px;height:${height}px">
    <div class="title">${escapeHtml(e.title||"Afspraak")}</div>
    ${e.allDay?'<div class="time">HELE DAG</div>':`<div class="time">${escapeHtml(e.start||"")} – ${escapeHtml(e.end||"")}</div>`}
    ${e.location?`<div class="place">${escapeHtml(e.location)}</div>`:""}
    ${e.kind==="task"?'<span class="tag">TAAK</span>':""}
    ${e.kind==="test"?'<span class="tag">TOETS</span>':""}
  </div>`;
}

/* ---------- USER DATA VIEWS ---------- */
function renderGrades(){
  const grades=state.grades.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $("gradesList").innerHTML=grades.length?grades.map(g=>{
    const value=Number(g.value),warn=value<5.5;
    return `<div class="grade-row">
      <div class="grade-icon">${escapeHtml((g.subject||"?")[0].toUpperCase())}</div>
      <div class="grade-copy"><strong>${escapeHtml(g.subject)}</strong><small>${escapeHtml(g.type||"")}${g.date?` · ${escapeHtml(g.date)}`:""}</small></div>
      <div class="grade-right"><div class="grade-value">${value.toFixed(1).replace(".",",")}</div><div class="grade-state ${warn?"warn":""}">${warn?"Aandacht":"Goed"}</div></div>
    </div>`;
  }).join(""):`<div class="empty">Nog geen cijfers. Klik op <b>+ Cijfer</b>.</div>`;
  const avg=state.grades.length?state.grades.reduce((sum,g)=>sum+Number(g.value),0)/state.grades.length:NaN;
  $("avgGrade").textContent=Number.isFinite(avg)?avg.toFixed(2).replace(".",","):"—";
  $("gradeSummary").textContent=`${state.grades.length} ${state.grades.length===1?"cijfer":"cijfers"}`;
  $("gradesCount").textContent=state.grades.length;
}

function renderTasks(){
  const tasks=state.tasks.slice().sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  $("tasksList").innerHTML=tasks.length?tasks.map(t=>`
    <div class="task-row ${t.done?"done":""} ${t.priority==="Hoog"?"priority-high":""}">
      <span class="task-check ${t.done?"done":""}" data-id="${escapeHtml(t.id)}"></span>
      <div class="task-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.subject||"Eigen taak")} · ${escapeHtml(t.date)}</small></div>
      <time>${escapeHtml(t.start||"")}</time>
    </div>`).join(""):`<div class="empty">Nog geen taken. Klik op <b>+ Taak</b>.</div>`;
  $("tasksCount").textContent=state.tasks.filter(x=>!x.done).length;
  document.querySelectorAll(".task-check").forEach(el=>el.addEventListener("click",async()=>{
    const t=state.tasks.find(x=>x.id===el.dataset.id);if(!t)return;
    t.done=!t.done;renderTasks();renderCalendar();
    await dbWrite(`tasks/${t.id}/done`,t.done);syncMark("Tasks",true);
  }));
}

function renderTests(){
  const tests=state.tests.slice().sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  const next=tests.find(t=>new Date(`${t.date}T${t.start||"00:00"}`)>=new Date());
  $("nextTest").innerHTML=next?
    `<small>VOLGENDE TOETS</small><strong>${escapeHtml(next.title)}</strong><span>${dutch(new Date(`${next.date}T12:00`),{weekday:"long",day:"numeric",month:"long"})} · ${escapeHtml(next.start||"")}</span>`:
    `<small>VOLGENDE TOETS</small><strong>Geen toetsen gepland</strong><span>Gebruik + Toets.</span>`;
  $("testsList").innerHTML=tests.length?tests.map(t=>`
    <div class="test-row"><span class="grade-icon">★</span><div class="test-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.date)} · ${escapeHtml(t.location||"Lokaal onbekend")}</small></div><time>${escapeHtml(t.start||"")}</time></div>`).join(""):`<div class="empty">Nog geen toetsen.</div>`;
  $("testsCount").textContent=state.tests.length;
}

function renderStats(){
  const today=isoDate(new Date());
  $("todayLessons").textContent=state.roster.filter(x=>x.date===today).length;
  $("todayTasks").textContent=state.tasks.filter(x=>x.date===today&&!x.done).length;
  $("todayTests").textContent=state.tests.filter(x=>x.date===today).length;
  $("todayNotice").textContent=state.rosterSource==="DEMO"?"Gebruik je Somtoday iCalendar-koppeling om je echte rooster te laden.":`Rooster geladen. ${state.roster.length} afspraken in de cache.`;
}

function renderAll(){renderProfile();renderCalendar();renderGrades();renderTasks();renderTests()}

/* ---------- ROBUST ICS PARSER ---------- */
function parseProperty(line){
  const i=line.indexOf(":");
  if(i<0)return null;
  const left=line.slice(0,i),value=line.slice(i+1);
  const parts=left.split(";");
  const name=parts.shift().toUpperCase();
  const params={};
  for(const p of parts){
    const eq=p.indexOf("=");
    if(eq<0)continue;
    params[p.slice(0,eq).toUpperCase()]=p.slice(eq+1).replace(/^"|"$/g,"");
  }
  return {name,value,params};
}

function getTzOffsetMs(date,tz){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
  }).formatToParts(date);
  const obj={};
  for(const p of parts)if(p.type!=="literal")obj[p.type]=p.value;
  const asUTC=Date.UTC(Number(obj.year),Number(obj.month)-1,Number(obj.day),Number(obj.hour),Number(obj.minute),Number(obj.second));
  return asUTC-date.getTime();
}

function parseICSTime(value,tzid="Europe/Amsterdam"){
  if(!value)return null;
  const raw=value.trim();
  const match=/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/.exec(raw);
  if(!match)return null;
  const y=Number(match[1]),mo=Number(match[2])-1,d=Number(match[3]);
  const hh=Number(match[4]||0),mm=Number(match[5]||0),ss=Number(match[6]||0);
  if(!match[4])return {date:`${y}-${pad(mo+1)}-${pad(d)}`,allDay:true,dateObj:new Date(y,mo,d),start:"00:00",end:"23:59"};

  if(match[7]==="Z"){
    const dateObj=new Date(Date.UTC(y,mo,d,hh,mm,ss));
    return {date:dateObj.toISOString().slice(0,10),start:`${pad(dateObj.getUTCHours())}:${pad(dateObj.getUTCMinutes())}`,dateObj,utc:true,tzid:"UTC"};
  }

  const targetTz=tzid||"Europe/Amsterdam";
  const rough=new Date(Date.UTC(y,mo,d,hh,mm,ss));
  const offset1=getTzOffsetMs(rough,targetTz);
  const corrected=new Date(rough.getTime()-offset1);
  const offset2=getTzOffsetMs(corrected,targetTz);
  const finalDate=new Date(rough.getTime()-offset2);

  // Preserve local wall-clock date in the target timezone.
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:targetTz,year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(finalDate);
  const o={};for(const p of parts)if(p.type!=="literal")o[p.type]=p.value;
  return {
    date:`${o.year}-${o.month}-${o.day}`,
    start:`${o.hour}:${o.minute}`,
    dateObj:finalDate,
    tzid:targetTz
  };
}

function parseICS(text){
  const lines=text.replace(/^\uFEFF/,"").replace(/\r?\n[ \t]/g,"").split(/\r?\n/);
  const events=[];let cur=null,calendarTz="Europe/Amsterdam";

  for(const line of lines){
    if(line==="BEGIN:VEVENT"){cur={};continue}
    if(line==="END:VEVENT"){
      if(cur){
        const s=parseICSTime(cur.dtstart?.value,cur.dtstart?.params?.TZID||calendarTz);
        const e=parseICSTime(cur.dtend?.value,cur.dtend?.params?.TZID||cur.dtstart?.params?.TZID||calendarTz);
        if(s){
          let end=e;
          if(!end&&!s.allDay){
            const fallback=new Date(s.dateObj.getTime()+50*60000);
            const pp=new Intl.DateTimeFormat("en-GB",{timeZone:s.tzid||"Europe/Amsterdam",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(fallback);
            const oo={};for(const p of pp)if(p.type!=="literal")oo[p.type]=p.value;
            end={start:`${oo.hour}:${oo.minute}`};
          }
          cur._parsed={
            date:s.date,start:s.start,
            end:s.allDay?"23:59":end?.start||"",
            title:cur.summary?.value||"Afspraak",
            location:cur.location?.value||"",
            allDay:!!s.allDay
          };
          events.push(cur._parsed);
        }
      }
      cur=null;continue;
    }
    const prop=parseProperty(line);
    if(!prop)continue;

    if(!cur){
      if(prop.name==="X-WR-TIMEZONE"||prop.name==="TZID")calendarTz=prop.value||calendarTz;
      continue;
    }

    if(["SUMMARY","LOCATION","DTSTART","DTEND","UID"].includes(prop.name))cur[prop.name.toLowerCase()]={value:prop.value,params:prop.params};
  }
  return events;
}

/* ---------- SOMTODAY CONNECTION ---------- */
function normalizeCalendarInput(raw){
  if(/^https?:\/\//i.test(raw))return {url:raw,id:""};
  const id=raw.trim();
  return {url:`https://api.somtoday.nl/rest/v1/icalendar/stream/${encodeURIComponent(id)}`,id};
}

async function saveConnection(raw){
  const normalized=normalizeCalendarInput(raw);
  state.connection={...state.connection,calendarId:normalized.id||raw,calendarUrl:normalized.url,lastSync:new Date().toISOString()};
  await dbWrite("connection",state.connection);
  syncMark("Agenda",true);
}

async function loadRoster(){
  const raw=$("icalUrl").value.trim();
  if(!raw){setRosterStatus("Vul je agenda-ID of iCalendar-URL in.","error");return}
  setRosterStatus("Rooster ophalen…");
  await saveConnection(raw);

  try{
    const url=normalizeCalendarInput(raw).url;
    const res=await fetch(url,{method:"GET",mode:"cors",cache:"no-store"});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const text=await res.text();
    if(!/BEGIN:VCALENDAR/i.test(text))throw new Error("Geen geldig iCalendar-bestand");
    const events=parseICS(text);
    state.roster=events;state.rosterCache=events;state.rosterSource="LIVE";
    await dbWrite("rosterCache",events);
    state.connection.lastSync=new Date().toISOString();
    await dbWrite("connection/lastSync",state.connection.lastSync);
    renderCalendar();setRosterStatus(`${events.length} roosterafspraken geladen.`,"ok");syncMark("Roster",true);
  }catch(e){
    console.error("Roster fetch",e);
    setRosterStatus("Live ophalen lukt niet in deze browser. Gebruik de .ics-knop als fallback.","error");
  }
}

function loadICSFile(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=async()=>{
    try{
      const events=parseICS(reader.result);
      if(!events.length)throw new Error("Geen VEVENTs");
      state.roster=events;state.rosterCache=events;state.rosterSource="ICS";
      await dbWrite("rosterCache",events);
      await dbPatch("connection",{lastSync:new Date().toISOString()});
      renderCalendar();setRosterStatus(`${events.length} afspraken uit .ics geladen.`,"ok");syncMark("Roster",true);
    }catch(e){console.error(e);setRosterStatus("Het .ics-bestand kon niet worden gelezen.","error")}
  };
  reader.readAsText(file);
}

function clearListeners(){state.dataListeners.forEach(fn=>fn?.());state.dataListeners=[]}

/* ---------- FIREBASE DATA ---------- */
function loadUserData(){
  clearListeners();
  const nodes=["profile","connection","rosterCache","grades","tasks","tests","preferences"];
  for(const node of nodes){
    const unsubscribe=onValue(ref(db,`${userPath()}/${node}`),snap=>{
      const v=snap.val();
      if(node==="profile"&&v)state.profile={...state.profile,...v};
      if(node==="connection"&&v){
        state.connection={...state.connection,...v};
        $("icalUrl").value=v.calendarId||v.calendarUrl||"";
      }
      if(node==="rosterCache"&&v){
        state.rosterCache=Array.isArray(v)?v:Object.values(v);
        if(!state.roster.length)state.roster=state.rosterCache;
        if(state.roster.length)state.rosterSource=state.rosterSource==="DEMO"?"CACHE":state.rosterSource;
      }
      if(node==="grades")state.grades=v?Object.entries(v).map(([id,x])=>({...x,id})):[];
      if(node==="tasks")state.tasks=v?Object.entries(v).map(([id,x])=>({...x,id})):[];
      if(node==="tests")state.tests=v?Object.entries(v).map(([id,x])=>({...x,id})):[];
      if(node==="preferences"&&v&&Number.isFinite(Number(v.weekOffset)))state.weekOffset=Number(v.weekOffset);
      renderAll();
      const map={connection:"Agenda",rosterCache:"Roster",grades:"Grades",tasks:"Tasks",tests:"Tests",profile:"Settings",preferences:"Settings"};
      syncMark(map[node]||"Settings",true);
    },err=>{
      console.error(`Realtime listener ${node}`,err);
      $("syncText").textContent="Firebase: toegang geweigerd";
      if(node==="profile")return;
    });
    state.dataListeners.push(unsubscribe);
  }
}

async function saveInitialProfile(){
  const snapValue={...state.profile,createdAt:Date.now()};
  await dbWrite("profile",snapValue);
}

/* ---------- CRUD ---------- */
async function addGrade(){
  const subject=$("gradeSubject").value.trim(),value=Number($("gradeValue").value),date=$("gradeDate").value,type=$("gradeType").value;
  if(!subject||!Number.isFinite(value)||!date)return;
  const id=push(ref(db,`${userPath()}/grades`)).key;
  await dbWrite(`grades/${id}`,{subject,value,date,type,createdAt:Date.now()});
  $("gradeDialog").close();
}

async function addTask(){
  const title=$("taskTitle").value.trim(),subject=$("taskSubject").value.trim(),date=$("taskDate").value,start=$("taskTime").value,priority=$("taskPriority").value;
  if(!title||!date)return;
  const id=push(ref(db,`${userPath()}/tasks`)).key;
  await dbWrite(`tasks/${id}`,{title,subject,date,start,priority,done:false,createdAt:Date.now()});
  $("taskDialog").close();
}

async function addTest(){
  const title=$("testTitle").value.trim(),date=$("testDate").value,start=$("testTime").value,location=$("testLocation").value.trim();
  if(!title||!date)return;
  const id=push(ref(db,`${userPath()}/tests`)).key;
  await dbWrite(`tests/${id}`,{title,date,start,location,createdAt:Date.now()});
  $("testDialog").close();
}

/* ---------- UI EVENTS ---------- */
function dateDefault(id){$(id).value=isoDate(new Date())}
function openDialog(id){$(id).showModal()}

function setupEvents(){
  if(state.appReady)return;state.appReady=true;

  $("loadRoster").addEventListener("click",loadRoster);
  $("icsFile").addEventListener("change",e=>loadICSFile(e.target.files[0]));
  $("refreshRoster").addEventListener("click",loadRoster);

  $("prevWeek").addEventListener("click",async()=>{state.weekOffset--;renderCalendar();await dbWrite("preferences/weekOffset",state.weekOffset)});
  $("nextWeek").addEventListener("click",async()=>{state.weekOffset++;renderCalendar();await dbWrite("preferences/weekOffset",state.weekOffset)});

  $("addGrade").addEventListener("click",()=>{dateDefault("gradeDate");openDialog("gradeDialog")});
  $("saveGrade").addEventListener("click",e=>{e.preventDefault();addGrade()});
  $("addTask").addEventListener("click",()=>{dateDefault("taskDate");openDialog("taskDialog")});
  $("saveTask").addEventListener("click",e=>{e.preventDefault();addTask()});
  $("addTest").addEventListener("click",()=>{dateDefault("testDate");openDialog("testDialog")});
  $("saveTest").addEventListener("click",e=>{e.preventDefault();addTest()});

  $("settingsOpen").addEventListener("click",()=>{$("nameInput").value=state.profile.name;$("accentInput").value=state.profile.accent;openDialog("settingsDialog")});
  $("profileOpen").addEventListener("click",()=>{$("nameInput").value=state.profile.name;$("accentInput").value=state.profile.accent;openDialog("settingsDialog")});
  $("saveSettings").addEventListener("click",async e=>{
    e.preventDefault();
    state.profile={name:$("nameInput").value.trim()||"Jouw Naam",accent:$("accentInput").value};
    await dbWrite("profile",state.profile);renderProfile();$("settingsDialog").close();
  });

  $("aboutButton").addEventListener("click",()=>openDialog("aboutDialog"));
  $("logoutButton").addEventListener("click",async()=>{await signOut(auth);location.reload()});
  $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));

  document.querySelectorAll(".nav").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
    $(btn.dataset.target)?.scrollIntoView({behavior:"smooth",block:"start"});
    $("sidebar").classList.remove("open");
  }));

  $("searchInput").addEventListener("input",e=>{
    const q=e.target.value.trim().toLowerCase();
    document.querySelectorAll(".grade-row,.task-row,.test-row,.event").forEach(el=>{
      el.style.display=!q||el.textContent.toLowerCase().includes(q)?"":"none";
    });
  });

  $("authSwitch").addEventListener("click",async()=>{
    // Optional email login: show fields already present and let the user decide.
    const email=$("authEmail").value.trim(),pass=$("authPassword").value;
    if(!email||!pass){
      $("authTitle").textContent="E-mailaccount";
      $("authSubtitle").textContent="Vul e-mail en wachtwoord in en druk op de knop.";
      $("authSubmit").textContent="Account gebruiken";
      return;
    }
    try{
      await signInWithEmailAndPassword(auth,email,pass);
    }catch{
      try{await createUserWithEmailAndPassword(auth,email,pass)}
      catch(e){$("authError").textContent=e.message}
    }
  });
}

/* ---------- AUTH: ANONYMOUS FIRST ---------- */
async function ensureFirebaseAuth(){
  try{
    const current=auth.currentUser;
    if(current)return current;
    const result=await signInAnonymously(auth);
    return result.user;
  }catch(e){
    console.error("Anonymous auth failed",e);
    throw new Error(
      "Anonieme Firebase Authentication staat waarschijnlijk nog uit. Zet in Firebase Console → Authentication → Sign-in method → Anonymous aan."
    );
  }
}

onAuthStateChanged(auth,async user=>{
  if(!user)return;
  state.user=user;state.uid=user.uid;state.anonymous=!!user.isAnonymous;
  try{
    hide("loadingScreen");show("appShell");hide("authScreen");
    setupEvents();
    await loadUserData();
    if(!$("icalUrl").value)renderAll();
  }catch(e){
    console.error(e);
    showFatal("Firebase-account is actief, maar de database kon niet worden gelezen.",String(e?.message||e));
  }
});

document.addEventListener("DOMContentLoaded",async()=>{
  setClock();setInterval(setClock,1000);
  try{
    // Warm up Firebase connection immediately.
    const user=await ensureFirebaseAuth();
    if(!user)throw new Error("Geen Firebase-user");
  }catch(e){
    showFatal(e.message||"Firebase Authentication kon niet worden gestart.");
  }
});

function setRosterStatus(text,kind="neutral"){
  $("rosterStatus").textContent=text;$("rosterStatus").className=`connect-status ${kind}`;
}
