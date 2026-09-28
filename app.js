const state={
  roster:[],
  grades:[],
  tasks:[],
  tests:[],
  weekOffset:0,
  rosterSource:"DEMO"
};

const demoRoster=[
  {date:isoDate(new Date()),start:"08:30",end:"09:20",title:"Nederlands",location:"Lokaal 102",kind:"roster"},
  {date:isoDate(new Date()),start:"09:30",end:"10:20",title:"Wiskunde",location:"Lokaal 205",kind:"roster"},
  {date:isoDate(addDays(new Date(),1)),start:"09:20",end:"10:10",title:"Engels",location:"Lokaal 103",kind:"roster"},
  {date:isoDate(addDays(new Date(),2)),start:"08:30",end:"09:20",title:"Latijn",location:"Lokaal 132",kind:"roster"},
  {date:isoDate(addDays(new Date(),2)),start:"09:20",end:"10:10",title:"Nederlands",location:"Lokaal 103",kind:"roster"},
  {date:isoDate(addDays(new Date(),3)),start:"09:20",end:"10:10",title:"Duits",location:"Lokaal 149",kind:"roster"},
  {date:isoDate(addDays(new Date(),4)),start:"09:20",end:"10:10",title:"Geschiedenis",location:"Lokaal 120",kind:"roster"}
];

function $(id){return document.getElementById(id)}
function pad(n){return String(n).padStart(2,"0")}
function isoDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);const day=x.getDay()||7;x.setDate(x.getDate()+1-day);return x}
function mondayAtOffset(o){return addDays(startOfWeek(new Date()),o*7)}
function minutes(t){const [h,m]=(t||"00:00").split(":").map(Number);return h*60+m}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dutch(d,opts){return new Intl.DateTimeFormat("nl-NL",opts).format(d)}

function setTodayFields(){
  const now=new Date();
  $("heroDate").textContent=dutch(now,{weekday:"long",day:"numeric",month:"long"});
  $("clock").textContent=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $("clockDate").textContent=dutch(now,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}

function weekNo(d){
  const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);
  const jan1=new Date(Date.UTC(x.getUTCFullYear(),0,1));
  return Math.ceil((((x-jan1)/86400000)+1)/7)
}

function renderCalendar(){
  const base=mondayAtOffset(state.weekOffset);
  $("weekLabel").textContent=`Week ${weekNo(base)}`;
  $("calendarMonth").textContent=dutch(base,{month:"long",year:"numeric"});
  $("calendarRange").textContent=`${dutch(base,{day:"numeric",month:"short"})} – ${dutch(addDays(base,4),{day:"numeric",month:"short"})}`;
  $("sourcePill").textContent=state.rosterSource;

  $("timeAxis").innerHTML=Array.from({length:9},(_,i)=>`<span>${6+i}:00</span>`).join("");
  const dayNames=["Ma","Di","Wo","Do","Vr"];
  $("days").innerHTML=dayNames.map((name,i)=>{
    const d=addDays(base,i), date=isoDate(d);
    const items=[
      ...state.roster.filter(x=>x.date===date).map(x=>({...x,kind:"roster"})),
      ...state.tasks.filter(x=>x.date===date).map(x=>({...x,kind:"task"})),
      ...state.tests.filter(x=>x.date===date).map(x=>({...x,kind:"test"}))
    ].sort((a,b)=>minutes(a.start)-minutes(b.start));
    const events=items.map(renderEvent).join("");
    return `<div class="day">
      <div class="day-header"><small>${name}</small><strong>${d.getDate()}</strong></div>
      <div class="day-body">${events}</div>
    </div>`
  }).join("");

  renderStats();
}

function renderEvent(e){
  const start=minutes(e.start||"08:00"),end=minutes(e.end||"09:00");
  const top=Math.max(0,(start-360)); // 1 minute == 1 px; 6:00 is origin
  const height=Math.max(42,end-start-5);
  let tag="";
  if(e.kind==="task") tag='<span class="tag">TAak</span>';
  if(e.kind==="test") tag='<span class="tag">TOETS</span>';
  return `<div class="event ${e.kind}" style="top:${top}px;height:${height}px">
    <div class="title">${escapeHtml(e.title||"Afspraak")}</div>
    <div class="time">${escapeHtml(e.start||"")}</div>
    ${e.location?`<div class="place">${escapeHtml(e.location)}</div>`:""}
    ${tag}
  </div>`;
}

function renderGrades(){
  const list=$("gradesList");
  if(!state.grades.length){
    list.innerHTML=`<div class="empty">Nog geen eigen cijfers. Klik op <b>+ Cijfer</b>.</div>`;
  }else{
    list.innerHTML=state.grades.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map((g,i)=>{
      const n=Number(g.value);
      const warn=n<5.5;
      const status=warn?"Aandacht":"Goed";
      return `<div class="grade-row">
        <div class="grade-icon">${escapeHtml((g.subject||"?")[0].toUpperCase())}</div>
        <div class="grade-copy"><strong>${escapeHtml(g.subject)}</strong><small>${escapeHtml(g.type)} · ${escapeHtml(g.date)}</small></div>
        <div class="grade-right"><div class="grade-value">${n.toFixed(1).replace(".",",")}</div><div class="grade-state ${warn?"warn":""}">${status}</div></div>
      </div>`;
    }).join("");
  }
  const avg=state.grades.length?state.grades.reduce((s,g)=>s+Number(g.value),0)/state.grades.length:NaN;
  $("avgGrade").textContent=Number.isFinite(avg)?avg.toFixed(2).replace(".",","):"—";
  $("gradeSummary").textContent=`${state.grades.length} ${state.grades.length===1?"cijfer":"cijfers"}`;
  $("gradesCount").textContent=state.grades.length;
}

function renderTasks(){
  if(!state.tasks.length) $("tasksList").innerHTML=`<div class="empty">Nog geen taken. Klik op <b>+ Taak</b>.</div>`;
  else $("tasksList").innerHTML=state.tasks.slice().sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)).map((t,i)=>`
    <div class="task-row ${t.done?"done":""} ${t.priority==="Hoog"?"priority-high":""}">
      <span class="task-check ${t.done?"done":""}" data-task="${i}"></span>
      <div class="task-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.subject||"Eigen taak")} · ${escapeHtml(t.date)}</small></div>
      <time>${escapeHtml(t.start||"")}</time>
    </div>`).join("");
  $("tasksCount").textContent=state.tasks.filter(t=>!t.done).length;
  document.querySelectorAll("[data-task]").forEach(el=>el.addEventListener("click",()=>{
    state.tasks[Number(el.dataset.task)].done=!state.tasks[Number(el.dataset.task)].done;
    renderTasks();renderCalendar();
  }));
}

function renderTests(){
  const upcoming=state.tests.slice().sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  const next=upcoming.find(t=>new Date(`${t.date}T${t.start||"00:00"}`)>=new Date());
  $("nextTest").innerHTML=next?`<small>VOLGENDE TOETS</small><strong>${escapeHtml(next.title)}</strong><span>${dutch(new Date(`${next.date}T12:00`),{weekday:"long",day:"numeric",month:"long"})} · ${escapeHtml(next.start||"")}</span>`:`<small>VOLGENDE TOETS</small><strong>Geen toetsen gepland</strong><span>Gebruik + Toets om er één toe te voegen.</span>`;
  $("testsList").innerHTML=upcoming.length?upcoming.map(t=>`<div class="test-row"><span class="grade-icon">★</span><div class="test-copy"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.date)} · ${escapeHtml(t.location||"Lokaal onbekend")}</small></div><time>${escapeHtml(t.start||"")}</time></div>`).join(""):`<div class="empty">Nog geen toetsen.</div>`;
  $("testsCount").textContent=state.tests.length;
}

function renderStats(){
  const today=isoDate(new Date());
  $("todayLessons").textContent=state.roster.filter(x=>x.date===today).length;
  $("todayTasks").textContent=state.tasks.filter(x=>x.date===today&&!x.done).length;
  $("todayTests").textContent=state.tests.filter(x=>x.date===today).length;
  const open=state.tasks.filter(x=>!x.done).length;
  const tests=state.tests.length;
  if(state.rosterSource==="DEMO") $("todayNotice").textContent="Dit zijn voorbeeldlessen. Gebruik je eigen iCalendar-token/URL om je echte rooster te laden.";
  else if(tests) $("todayNotice").textContent=`Je hebt ${open} openstaande ${open===1?"taak":"taken"} en ${tests} geplande ${tests===1?"toets":"toetsen"}.`;
  else $("todayNotice").textContent=`Rooster geladen. Je eigen taken en toetsen kun je hieronder toevoegen.`;
}

function renderAll(){renderCalendar();renderGrades();renderTasks();renderTests()}

function showStatus(text,kind="neutral"){
  $("rosterStatus").textContent=text;
  $("rosterStatus").className=`connect-status ${kind}`;
}

function parseICSDate(v){
  if(!v)return null;
  const raw=v.replace(/^.*:/,"").replace(/Z$/,"");
  if(/^\d{8}$/.test(raw)) return new Date(Number(raw.slice(0,4)),Number(raw.slice(4,6))-1,Number(raw.slice(6,8)),0,0);
  if(/^\d{8}T\d{6}$/.test(raw)) return new Date(Number(raw.slice(0,4)),Number(raw.slice(4,6))-1,Number(raw.slice(6,8)),Number(raw.slice(9,11)),Number(raw.slice(11,13)),Number(raw.slice(13,15)));
  const d=new Date(raw);return Number.isNaN(d.getTime())?null:d;
}

function parseICS(text){
  const lines=text.replace(/\r?\n[ \t]/g,"").split(/\r?\n/);
  const out=[];let v=null;
  for(const line of lines){
    if(line==="BEGIN:VEVENT"){v={};continue}
    if(line==="END:VEVENT"){if(v)out.push(v);v=null;continue}
    if(!v)continue;
    const idx=line.indexOf(":");if(idx<0)continue;
    const key=line.slice(0,idx).split(";")[0].toUpperCase(),val=line.slice(idx+1);
    if(key==="SUMMARY")v.title=val;
    if(key==="LOCATION")v.location=val;
    if(key==="DTSTART")v.startDate=val;
    if(key==="DTEND")v.endDate=val;
  }
  return out.map(e=>{
    const s=parseICSDate(e.startDate),en=parseICSDate(e.endDate);
    if(!s)return null;
    return {date:isoDate(s),start:`${pad(s.getHours())}:${pad(s.getMinutes())}`,end:en?`${pad(en.getHours())}:${pad(en.getMinutes())}`:"",title:e.title||"Afspraak",location:e.location||"",kind:"roster"};
  }).filter(Boolean);
}

async function loadRoster(){
  const url=$("icalUrl").value.trim();
  if(!url){showStatus("Vul de iCalendar-token/URL in.","error");return}
  showStatus("Rooster wordt opgehaald…");
  try{
    const res=await fetch(url,{mode:"cors",cache:"no-store"});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const text=await res.text();
    const events=parseICS(text);
    state.roster=events;state.rosterSource="LIVE";
    renderCalendar();showStatus(`${events.length} roosterafspraken geladen.`,"ok");
  }catch(err){
    showStatus("Direct ophalen werd door CORS/netwerk geblokkeerd. Open je .ics-bestand in plaats daarvan.","error");
  }
}

function loadICSFile(file){
  if(!file)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const events=parseICS(r.result);
      state.roster=events;state.rosterSource="ICS";
      renderCalendar();showStatus(`${events.length} roosterafspraken uit .ics geladen.`,"ok");
    }catch(e){showStatus("Het .ics-bestand kon niet worden gelezen.","error")}
  };
  r.readAsText(file);
}

function openDialog(id){$(id).showModal()}

function resetGradeForm(){
  $("gradeSubject").value="";$("gradeValue").value="";$("gradeDate").value=isoDate(new Date());$("gradeType").value="Toets";
}
function resetTaskForm(){
  $("taskTitle").value="";$("taskSubject").value="";$("taskDate").value=isoDate(new Date());$("taskTime").value="16:00";$("taskPriority").value="Normaal";
}
function resetTestForm(){
  $("testTitle").value="";$("testDate").value=isoDate(new Date());$("testTime").value="09:00";$("testLocation").value="";
}

document.addEventListener("DOMContentLoaded",()=>{
  state.roster=demoRoster;

  renderAll();
  setTodayFields();
  setInterval(setTodayFields,1000);

  $("loadRoster").addEventListener("click",loadRoster);
  $("icsFile").addEventListener("change",e=>loadICSFile(e.target.files[0]));
  $("refreshRoster").addEventListener("click",loadRoster);
  $("prevWeek").addEventListener("click",()=>{state.weekOffset--;renderCalendar()});
  $("nextWeek").addEventListener("click",()=>{state.weekOffset++;renderCalendar()});

  $("addGrade").addEventListener("click",()=>{resetGradeForm();openDialog("gradeDialog")});
  $("saveGrade").addEventListener("click",e=>{
    e.preventDefault();
    const subject=$("gradeSubject").value.trim(),value=Number($("gradeValue").value),date=$("gradeDate").value,type=$("gradeType").value;
    if(!subject||!Number.isFinite(value)||!date)return;
    state.grades.push({subject,value,date,type});$("gradeDialog").close();renderGrades();renderStats();
  });

  $("addTask").addEventListener("click",()=>{resetTaskForm();openDialog("taskDialog")});
  $("saveTask").addEventListener("click",e=>{
    e.preventDefault();
    const title=$("taskTitle").value.trim(),subject=$("taskSubject").value.trim(),date=$("taskDate").value,start=$("taskTime").value,priority=$("taskPriority").value;
    if(!title||!date)return;
    state.tasks.push({title,subject,date,start,priority,done:false});$("taskDialog").close();renderTasks();renderCalendar();
  });

  $("addTest").addEventListener("click",()=>{resetTestForm();openDialog("testDialog")});
  $("saveTest").addEventListener("click",e=>{
    e.preventDefault();
    const title=$("testTitle").value.trim(),date=$("testDate").value,start=$("testTime").value,location=$("testLocation").value.trim();
    if(!title||!date)return;
    state.tests.push({title,date,start,end:start,location});$("testDialog").close();renderTests();renderCalendar();
  });

  $("settingsOpen").addEventListener("click",()=>openDialog("settingsDialog"));
  $("profileOpen").addEventListener("click",()=>openDialog("settingsDialog"));
  $("saveSettings").addEventListener("click",e=>{
    e.preventDefault();
    const name=$("nameInput").value.trim()||"Jouw Naam",accent=$("accentInput").value;
    $("nameDisplay").textContent=name;$("nameTop").textContent=name;$("heroName").textContent=name;
    const initials=name.split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"JD";
    $("avatar").textContent=initials;$("avatarTiny").textContent=initials;
    document.body.classList.remove("accent-cyan","accent-pink","accent-green");
    if(accent!=="violet")document.body.classList.add(`accent-${accent}`);
    $("settingsDialog").close();
  });

  $("aboutButton").addEventListener("click",()=>openDialog("aboutDialog"));
  $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));

  document.querySelectorAll(".nav").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    const el=$(btn.dataset.target);
    if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
    $("sidebar").classList.remove("open");
  }));

  $("searchInput").addEventListener("input",e=>{
    const q=e.target.value.trim().toLowerCase();
    document.querySelectorAll(".grade-row,.task-row,.test-row,.message-row,.event").forEach(el=>{
      el.style.display=!q||el.textContent.toLowerCase().includes(q)?"":"none";
    });
  });
});
