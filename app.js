import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getDatabase, ref, onValue, set, update, push, remove
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

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getDatabase(app);

const state={
  uid:null, user:null,
  profile:{name:"Jouw Naam",accent:"violet"},
  connection:{calendarId:"",calendarUrl:"",lastSync:""},
  roster:[], rosterSource:"DEMO", rosterCache:[],
  grades:[], tasks:[], tests:[],
  weekOffset:0, unsubscribers:[]
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

function isoDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function pad(n){return String(n).padStart(2,"0")}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);const day=x.getDay()||7;x.setDate(x.getDate()+1-day);return x}
function mondayAtOffset(o){return addDays(startOfWeek(new Date()),o*7)}
function minutes(t){const [h,m]=(t||"00:00").split(":").map(Number);return h*60+m}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dutch(d,opts){return new Intl.DateTimeFormat("nl-NL",opts).format(d)}
function weekNo(d){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const jan1=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-jan1)/86400000)+1)/7)}
function show(id){$(id).classList.remove("hidden")}
function hide(id){$(id).classList.add("hidden")}

function setSyncState(name,good=true){
  const el=$(`saveState${name}`);
  if(el)el.textContent=good?"✓":"!";
}

async function dbSet(path,value){
  try{await set(ref(db,`${userPath()}/${path}`),value);return true}catch(e){console.error(e);setSyncState(path.split("/")[0],false);return false}
}
async function dbUpdate(path,value){
  try{await update(ref(db,`${userPath()}/${path}`),value);return true}catch(e){console.error(e);return false}
}

function renderProfile(){
  const n=state.profile.name||"Jouw Naam";
  $("nameDisplay").textContent=n;$("nameTop").textContent=n;$("heroName").textContent=n;
  const init=n.split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"JD";
  $("avatar").textContent=init;$("avatarTiny").textContent=init;$("userEmail").textContent=state.user?.email||"";
  document.body.classList.remove("accent-cyan","accent-pink","accent-green");
  if(state.profile.accent!=="violet")document.body.classList.add(`accent-${state.profile.accent}`);
}

function setClock(){
  const now=new Date();
  $("clock").textContent=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $("clockDate").textContent=dutch(now,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  $("heroDate").textContent=dutch(now,{weekday:"long",day:"numeric",month:"long"});
}

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
      ...state.tests.filter(x=>x.date===date).map(x=>({...x,kind:"test"}))
    ].sort((a,b)=>minutes(a.start)-minutes(b.start));
    return `<div class="day">
      <div class="day-header"><small>${name}</small><strong>${d.getDate()}</strong></div>
      <div class="day-body">${items.map(renderEvent).join("")}</div>
    </div>`
  }).join("");
  renderStats();
}

function renderEvent(e){
  const top=Math.max(0,minutes(e.start)-360), height=Math.max(42,(minutes(e.end||e.start)-minutes(e.start))-5);
  return `<div class="event ${escapeHtml(e.kind||"")}" style="top:${top}px;height:${height}px">
    <div class="title">${escapeHtml(e.title||"Afspraak")}</div>
    <div class="time">${escapeHtml(e.start||"")}</div>
    ${e.location?`<div class="place">${escapeHtml(e.location)}</div>`:""}
    ${e.kind==="task"?'<span class="tag">TAAK</span>':""}
    ${e.kind==="test"?'<span class="tag">TOETS</span>':""}
  </div>`
}

function renderGrades(){
  $("gradesList").innerHTML=state.grades.length?state.grades.slice().sort((a,b)=>`${b.date}`.localeCompare(`${a.date}`)).map((g,i)=>{
    const value=Number(g.value),warn=value<5.5;
    return `<div class="grade-row">
      <div class="grade-icon">${escapeHtml((g.subject||"?")[0].toUpperCase())}</div>
      <div class="grade-copy"><strong>${escapeHtml(g.subject)}</strong><small>${escapeHtml(g.type)} · ${escapeHtml(g.date)}</small></div>
      <div class="grade-right"><div class="grade-value">${value.toFixed(1).replace(".",",")}</div><div class="grade-state ${warn?"warn":""}">${warn?"Aandacht":"Goed"}</div></div>
    </div>`;
  }).join(""):`<div class="empty">Nog geen cijfers. Klik op <b>+ Cijfer</b>.</div>`;
  const avg=state.grades.length?state.grades.reduce((s,g)=>s+Number(g.value),0)/state.grades.length:NaN;
  $("avgGrade").textContent=Number.isFinite(avg)?avg.toFixed(2).replace(".",","):"—";
  $("gradeSummary").textContent=`${state.grades.length} ${state.grades.length===1?"cijfer":"cijfers"}`;
  $("gradesCount").textContent=state.grades.length;
}

function renderTasks(){
  $("tasksList").innerHTML=state.tasks.length?state.tasks.slice().sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)).map((t,i)=>`
    <div class="task-row ${t.done?"done":""} ${t.priority==="Hoog"?"priority-high":""}">
      <span class="task-check ${t.done?"done":""}" data-index="${i}"></span>
      <div class="task-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.subject||"Eigen taak")} · ${escapeHtml(t.date)}</small></div>
      <time>${escapeHtml(t.start||"")}</time>
    </div>`).join(""):`<div class="empty">Nog geen taken. Klik op <b>+ Taak</b>.</div>`;
  $("tasksCount").textContent=state.tasks.filter(x=>!x.done).length;
  document.querySelectorAll(".task-check").forEach(el=>el.addEventListener("click",async()=>{
    const i=Number(el.dataset.index), key=state.tasks[i]?.id;
    if(!key)return;
    const done=!state.tasks[i].done;
    state.tasks[i].done=done;renderTasks();renderCalendar();
    await dbSet(`tasks/${key}/done`,done);setSyncState("Tasks",true);
  }));
}

function renderTests(){
  const tests=state.tests.slice().sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  const next=tests.find(t=>new Date(`${t.date}T${t.start||"00:00"}`)>=new Date());
  $("nextTest").innerHTML=next?`<small>VOLGENDE TOETS</small><strong>${escapeHtml(next.title)}</strong><span>${dutch(new Date(`${next.date}T12:00`),{weekday:"long",day:"numeric",month:"long"})} · ${escapeHtml(next.start||"")}</span>`:`<small>VOLGENDE TOETS</small><strong>Geen toetsen gepland</strong><span>Gebruik + Toets.</span>`;
  $("testsList").innerHTML=tests.length?tests.map(t=>`<div class="test-row"><span class="grade-icon">★</span><div class="test-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.date)} · ${escapeHtml(t.location||"Lokaal onbekend")}</small></div><time>${escapeHtml(t.start||"")}</time></div>`).join(""):`<div class="empty">Nog geen toetsen.</div>`;
  $("testsCount").textContent=state.tests.length;
}

function renderStats(){
  const today=isoDate(new Date());
  $("todayLessons").textContent=state.roster.filter(x=>x.date===today).length;
  $("todayTasks").textContent=state.tasks.filter(x=>x.date===today&&!x.done).length;
  $("todayTests").textContent=state.tests.filter(x=>x.date===today).length;
  $("todayNotice").textContent=state.rosterSource==="DEMO"?"Gebruik je Somtoday iCalendar-koppeling om je echte rooster te laden.":`Rooster gekoppeld. ${state.roster.length} afspraken in de huidige cache.`;
}

function renderAll(){renderProfile();renderCalendar();renderGrades();renderTasks();renderTests();}

function setRosterStatus(t,k="neutral"){$("rosterStatus").textContent=t;$("rosterStatus").className=`connect-status ${k}`}

function normalizeCalendarInput(raw){
  if(/^https?:\/\//i.test(raw))return {url:raw,id:""};
  return {url:`https://api.somtoday.nl/rest/v1/icalendar/stream/${encodeURIComponent(raw)}`,id:raw};
}

function parseICSDate(v){
  if(!v)return null;
  const raw=String(v).replace(/^.*:/,"").replace(/Z$/,"");
  if(/^\d{8}$/.test(raw))return new Date(Number(raw.slice(0,4)),Number(raw.slice(4,6))-1,Number(raw.slice(6,8)),0,0);
  if(/^\d{8}T\d{6}$/.test(raw))return new Date(Number(raw.slice(0,4)),Number(raw.slice(4,6))-1,Number(raw.slice(6,8)),Number(raw.slice(9,11)),Number(raw.slice(11,13)),Number(raw.slice(13,15)));
  const d=new Date(raw);return Number.isNaN(d.getTime())?null:d;
}

function parseICS(text){
  const lines=text.replace(/\r?\n[ \t]/g,"").split(/\r?\n"),out=[];let v=null;
  for(const line of lines){
    if(line==="BEGIN:VEVENT"){v={};continue}
    if(line==="END:VEVENT"){if(v)out.push(v);v=null;continue}
    if(!v)continue;
    const i=line.indexOf(":");if(i<0)continue;
    const k=line.slice(0,i).split(";")[0].toUpperCase(),val=line.slice(i+1);
    if(k==="SUMMARY")v.title=val;if(k==="LOCATION")v.location=val;if(k==="DTSTART")v.startDate=val;if(k==="DTEND")v.endDate=val;
  }
  return out.map(e=>{const s=parseICSDate(e.startDate),en=parseICSDate(e.endDate);if(!s)return null;return{date:isoDate(s),start:`${pad(s.getHours())}:${pad(s.getMinutes())}`,end:en?`${pad(en.getHours())}:${pad(en.getMinutes())}`:"",title:e.title||"Afspraak",location:e.location||""}}).filter(Boolean);
}

async function saveConnection(raw){
  const {url,id}=normalizeCalendarInput(raw);
  state.connection.calendarId=id||raw;state.connection.calendarUrl=url;state.connection.lastSync=new Date().toISOString();
  await dbUpdate("connection",state.connection);
  $("icalUrl").value=raw;setSyncState("Agenda",true);
}

async function loadRoster(){
  const raw=$("icalUrl").value.trim();
  if(!raw){setRosterStatus("Vul een agenda-ID of iCalendar-URL in.","error");return}
  setRosterStatus("Rooster ophalen…");
  await saveConnection(raw);
  const url=normalizeCalendarInput(raw).url;
  try{
    const res=await fetch(url,{mode:"cors",cache:"no-store"});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const text=await res.text(),events=parseICS(text);
    state.roster=events;state.rosterCache=events;state.rosterSource="LIVE";
    await dbSet("rosterCache",events);await dbSet("connection/lastSync",new Date().toISOString());
    renderCalendar();setRosterStatus(`${events.length} roosterafspraken geladen.`,"ok");setSyncState("Roster",true);
  }catch(e){
    setRosterStatus("Live ophalen is door CORS/netwerk geblokkeerd. Open je .ics-bestand.","error");
  }
}

function loadICSFile(file){
  if(!file)return;const r=new FileReader();
  r.onload=async()=>{try{
    const events=parseICS(r.result);state.roster=events;state.rosterCache=events;state.rosterSource="ICS";
    await dbSet("rosterCache",events);await dbUpdate("connection",{calendarUrl:state.connection.calendarUrl||"",calendarId:state.connection.calendarId||"",lastSync:new Date().toISOString()});
    renderCalendar();setRosterStatus(`${events.length} afspraken uit .ics geladen.`,"ok");setSyncState("Roster",true);
  }catch(e){setRosterStatus("Het .ics-bestand kon niet worden gelezen.","error")}};
  r.readAsText(file);
}

async function loadUserData(){
  clearDataListeners();
  const nodes=["profile","connection","rosterCache","grades","tasks","tests","preferences"];
  for(const node of nodes){
    const fn=onValue(ref(db,`${userPath()}/${node}`),snap=>{
      const v=snap.val();
      if(node==="profile"&&v)state.profile={...state.profile,...v};
      if(node==="connection"&&v){state.connection={...state.connection,...v};$("icalUrl").value=v.calendarId||v.calendarUrl||""}
      if(node==="rosterCache"&&v){state.rosterCache=Object.values(v);if(!state.roster.length)state.roster=state.rosterCache;state.rosterSource=state.rosterSource==="DEMO"?"CACHE":state.rosterSource}
      if(node==="grades")state.grades=v?Object.entries(v).map(([id,x])=>({...x,id})):[]; 
      if(node==="tasks")state.tasks=v?Object.entries(v).map(([id,x])=>({...x,id})):[]; 
      if(node==="tests")state.tests=v?Object.entries(v).map(([id,x])=>({...x,id})):[]; 
      if(node==="preferences"&&v&&Number.isFinite(Number(v.weekOffset)))state.weekOffset=Number(v.weekOffset);
      renderAll();setSyncState(node==="rosterCache"?"Roster":node==="preferences"?"Settings":node[0].toUpperCase()+node.slice(1),true);
    },err=>console.error(`${node} listener`,err));
    state.unsubscribers.push(fn);
  }
}

async function addGrade(){
  const subject=$("gradeSubject").value.trim(),value=Number($("gradeValue").value),date=$("gradeDate").value,type=$("gradeType").value;
  if(!subject||!Number.isFinite(value)||!date)return;
  const id=push(ref(db,`${userPath()}/grades`)).key;
  await dbSet(`grades/${id}`,{subject,value,date,type,createdAt:Date.now()});
  $("gradeDialog").close();setSyncState("Grades",true);
}

async function addTask(){
  const title=$("taskTitle").value.trim(),subject=$("taskSubject").value.trim(),date=$("taskDate").value,start=$("taskTime").value,priority=$("taskPriority").value;
  if(!title||!date)return;
  const id=push(ref(db,`${userPath()}/tasks`)).key;
  await dbSet(`tasks/${id}`,{title,subject,date,start,priority,done:false,createdAt:Date.now()});
  $("taskDialog").close();setSyncState("Tasks",true);
}

async function addTest(){
  const title=$("testTitle").value.trim(),date=$("testDate").value,start=$("testTime").value,location=$("testLocation").value.trim();
  if(!title||!date)return;
  const id=push(ref(db,`${userPath()}/tests`)).key;
  await dbSet(`tests/${id}`,{title,date,start,location,createdAt:Date.now()});
  $("testDialog").close();setSyncState("Tests",true);
}

async function saveSettings(){
  const name=$("nameInput").value.trim()||"Jouw Naam",accent=$("accentInput").value;
  state.profile={name,accent};await dbSet("profile",state.profile);renderProfile();$("settingsDialog").close();setSyncState("Settings",true);
}

function openDialog(id){$(id).showModal()}
function dateDefault(id){$(id).value=isoDate(new Date())}

function setupAppEvents(){
  $("loadRoster").addEventListener("click",loadRoster);
  $("icsFile").addEventListener("change",e=>loadICSFile(e.target.files[0]));
  $("refreshRoster").addEventListener("click",loadRoster);
  $("prevWeek").addEventListener("click",async()=>{
    state.weekOffset--;
    renderCalendar();
    await dbSet("preferences/weekOffset",state.weekOffset);
  });
  $("nextWeek").addEventListener("click",async()=>{
    state.weekOffset++;
    renderCalendar();
    await dbSet("preferences/weekOffset",state.weekOffset);
  });
  $("addGrade").addEventListener("click",()=>{dateDefault("gradeDate");openDialog("gradeDialog")});
  $("saveGrade").addEventListener("click",e=>{e.preventDefault();addGrade()});
  $("addTask").addEventListener("click",()=>{dateDefault("taskDate");openDialog("taskDialog")});
  $("saveTask").addEventListener("click",e=>{e.preventDefault();addTask()});
  $("addTest").addEventListener("click",()=>{dateDefault("testDate");openDialog("testDialog")});
  $("saveTest").addEventListener("click",e=>{e.preventDefault();addTest()});
  $("settingsOpen").addEventListener("click",()=>{ $("nameInput").value=state.profile.name; $("accentInput").value=state.profile.accent;openDialog("settingsDialog")});
  $("profileOpen").addEventListener("click",()=>{ $("nameInput").value=state.profile.name; $("accentInput").value=state.profile.accent;openDialog("settingsDialog")});
  $("saveSettings").addEventListener("click",e=>{e.preventDefault();saveSettings()});
  $("aboutButton").addEventListener("click",()=>openDialog("aboutDialog"));
  $("logoutButton").addEventListener("click",()=>signOut(auth));
  $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
    $(btn.dataset.target)?.scrollIntoView({behavior:"smooth",block:"start"});$("sidebar").classList.remove("open");
  }));
  $("searchInput").addEventListener("input",e=>{
    const q=e.target.value.trim().toLowerCase();
    document.querySelectorAll(".grade-row,.task-row,.test-row,.event").forEach(el=>el.style.display=!q||el.textContent.toLowerCase().includes(q)?"":"none");
  });
}

let registerMode=false;
function setupAuth(){
  $("authSwitch").addEventListener("click",()=>{
    registerMode=!registerMode;
    $("authTitle").textContent=registerMode?"Account maken":"Inloggen";
    $("authSubtitle").textContent=registerMode?"Maak een account om je gegevens veilig op te slaan.":"Log in om je rooster, cijfers, taken en toetsen te laden.";
    $("authSubmit").textContent=registerMode?"Account maken":"Inloggen";
    $("authSwitch").textContent=registerMode?"Al een account? Inloggen":"Nog geen account? Aanmelden";
    $("authError").textContent="";
  });
  $("authForm").addEventListener("submit",async e=>{
    e.preventDefault();$("authError").textContent="";
    const email=$("authEmail").value.trim(),pass=$("authPassword").value;
    try{
      if(registerMode)await createUserWithEmailAndPassword(auth,email,pass);
      else await signInWithEmailAndPassword(auth,email,pass);
    }catch(err){
      const map={
        "auth/invalid-credential":"E-mail of wachtwoord klopt niet.",
        "auth/email-already-in-use":"Dit e-mailadres bestaat al.",
        "auth/weak-password":"Gebruik een sterker wachtwoord.",
        "auth/invalid-email":"Vul een geldig e-mailadres in.",
        "auth/operation-not-allowed":"Email/wachtwoord moet in Firebase Authentication worden aangezet."
      };
      $("authError").textContent=map[err.code]||err.message;
    }
  });
}

let appEventsReady=false;

function clearDataListeners(){
  state.unsubscribers.forEach(fn=>fn&&fn());
  state.unsubscribers=[];
}

onAuthStateChanged(auth,async user=>{
  $("loadingScreen").classList.add("hidden");
  if(!user){
    clearDataListeners();
    state.user=null;state.uid=null;
    hide("appShell");show("authScreen");return;
  }
  state.user=user;state.uid=user.uid;
  hide("authScreen");show("appShell");
  if(!appEventsReady){
    setupAppEvents();
    appEventsReady=true;
  }
  await loadUserData();
  renderAll();setSyncState("Settings",true);
});

document.addEventListener("DOMContentLoaded",()=>{
  setupAuth();
  setClock();setInterval(setClock,1000);
});
