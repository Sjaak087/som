const state = {
  weekOffset: 0,
  events: [],
  loaded: false
};

const demoEvents = [
  {day:0,start:"08:30",end:"09:20",title:"Nederlands",location:"Lokaal 102",type:""},
  {day:0,start:"09:30",end:"10:20",title:"Wiskunde",location:"Lokaal 205",type:""},
  {day:1,start:"09:20",end:"10:10",title:"Engels",location:"Lokaal 103",type:""},
  {day:1,start:"11:20",end:"12:10",title:"Biologie",location:"Lokaal 302",type:"practice"},
  {day:2,start:"08:30",end:"09:20",title:"Latijn",location:"Lokaal 132",type:""},
  {day:2,start:"09:20",end:"10:10",title:"Nederlands",location:"Lokaal 103",type:"test"},
  {day:3,start:"09:20",end:"10:10",title:"Duits",location:"Lokaal 149",type:""},
  {day:3,start:"10:10",end:"11:00",title:"Engels",location:"Lokaal 204",type:""},
  {day:4,start:"09:20",end:"10:10",title:"Geschiedenis",location:"Lokaal 120",type:""},
  {day:4,start:"10:10",end:"11:00",title:"Grieks",location:"Lokaal 131",type:""}
];

const grades = [
  ["Nederlands","7,8","+0,2"],["Wiskunde","6,9","+0,3"],
  ["Engels","8,5","+0,1"],["Biologie","7,2","0,0"],["Geschiedenis","8,0","+0,4"]
];

function $(id){ return document.getElementById(id); }

function monday(d){
  const x = new Date(d); x.setHours(0,0,0,0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate()+diff);
  return x;
}

function addDays(d,n){
  const x = new Date(d); x.setDate(x.getDate()+n); return x;
}

function pad(n){ return String(n).padStart(2,"0"); }

function formatDutchDate(d, opts={day:"numeric",month:"long"}){
  return new Intl.DateTimeFormat("nl-NL",opts).format(d);
}

function weekNumber(d){
  const x = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate()+4-day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(),0,1));
  return Math.ceil((((x-yearStart)/86400000)+1)/7);
}

function timeToMinutes(t){
  const [h,m] = (t||"00:00").split(":").map(Number);
  return h*60+m;
}

function renderClock(){
  const now = new Date();
  $("digitalClock").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  $("clockDate").textContent = formatDutchDate(now,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  $("heroDate").textContent = formatDutchDate(now,{weekday:"long",day:"numeric",month:"long"});
}

function renderGrades(){
  $("gradesList").innerHTML = grades.map((g,i)=>`
    <div class="grade-row">
      <div class="subject-icon">${["N","W","E","B","G"][i]}</div>
      <div class="grade-copy"><strong>${g[0]}</strong><span>Laatste resultaat</span></div>
      <div style="text-align:right"><div class="grade-value">${g[1]}</div><div class="grade-delta">${g[2]}</div></div>
    </div>`).join("");
}

function renderCalendar(){
  const base = monday(addDays(new Date(), state.weekOffset*7));
  const names = ["Ma","Di","Wo","Do","Vr"];
  const longNames = ["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag"];
  $("weekLabel").textContent = `Week ${weekNumber(base)}`;
  $("monthLabel").textContent = formatDutchDate(base,{month:"long",year:"numeric"});
  $("rangeLabel").textContent = `${formatDutchDate(base,{day:"numeric",month:"short"})} – ${formatDutchDate(addDays(base,4),{day:"numeric",month:"short"})}`;

  const axis = [];
  for(let h=6; h<=13; h++){
    axis.push(`<span>${h}:00</span>`);
  }
  $("timeAxis").innerHTML = axis.join("");

  const now = new Date();
  const cols = [];
  for(let day=0; day<5; day++){
    const d = addDays(base,day);
    const iso = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const events = state.events.filter(e=>e.date===iso || (typeof e.day==="number" && e.day===day));
    const today = d.toDateString() === now.toDateString();
    const eventsHtml = events.map(e=>{
      const start = timeToMinutes(e.start || "08:00");
      const end = timeToMinutes(e.end || "09:00");
      const top = Math.max(0,(start-360)/60*60);
      const height = Math.max(42,((end-start)/60)*60-4);
      return `<div class="event ${e.type||""}" style="top:${top}px;height:${height}px">
        <div class="event-title">${escapeHtml(e.title||"Afspraak")}</div>
        <div class="event-time">${escapeHtml(e.start||"")} ${e.type==="test"?"• Toets":""}</div>
        ${e.location?`<div class="event-location">${escapeHtml(e.location)}</div>`:""}
      </div>`;
    }).join("");
    cols.push(`<div class="day-column">
      <div class="day-head ${today?"today":""}"><span class="day-name">${names[day]} · ${longNames[day]}</span><strong>${d.getDate()}</strong></div>
      <div class="day-column-body">${eventsHtml}</div>
    </div>`);
  }
  $("daysGrid").innerHTML = cols.join("");
}

function escapeHtml(v){
  return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function parseICS(text){
  const unfolded = text.replace(/\r?\n[ \t]/g,"").split(/\r?\n/);
  const items = [];
  let current = null;
  for(const raw of unfolded){
    if(raw === "BEGIN:VEVENT"){ current={}; continue; }
    if(raw === "END:VEVENT"){ if(current) items.push(current); current=null; continue; }
    if(!current) continue;
    const idx = raw.indexOf(":");
    if(idx < 0) continue;
    const key = raw.slice(0,idx);
    const value = raw.slice(idx+1);
    const mainKey = key.split(";")[0].toUpperCase();
    if(mainKey==="SUMMARY") current.title=value;
    if(mainKey==="LOCATION") current.location=value;
    if(mainKey==="DESCRIPTION") current.description=value;
    if(mainKey==="UID") current.uid=value;
    if(mainKey==="DTSTART") current.dtstart=value;
    if(mainKey==="DTEND") current.dtend=value;
  }

  return items.map(v=>{
    const parsed = parseICSDate(v.dtstart);
    const end = parseICSDate(v.dtend);
    if(!parsed) return null;
    return {
      date:`${parsed.getFullYear()}-${pad(parsed.getMonth()+1)}-${pad(parsed.getDate())}`,
      start:`${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
      end:end?`${pad(end.getHours())}:${pad(end.getMinutes())}`:"",
      title:v.title || "Afspraak",
      location:v.location || "",
      type:(v.title||"").toLowerCase().includes("toets") ? "test" : ""
    };
  }).filter(Boolean);
}

function parseICSDate(v){
  if(!v) return null;
  const cleaned=v.replace(/Z$/,"");
  if(/^\d{8}$/.test(cleaned)){
    return new Date(Number(cleaned.slice(0,4)),Number(cleaned.slice(4,6))-1,Number(cleaned.slice(6,8)),0,0);
  }
  if(/^\d{8}T\d{6}$/.test(cleaned)){
    return new Date(
      Number(cleaned.slice(0,4)),Number(cleaned.slice(4,6))-1,Number(cleaned.slice(6,8)),
      Number(cleaned.slice(9,11)),Number(cleaned.slice(11,13)),Number(cleaned.slice(13,15))
    );
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function setStatus(message,kind="neutral"){
  const el=$("connectionStatus");
  el.textContent=message;
  el.className=`status ${kind}`;
}

async function loadAgenda(){
  const raw=$("agendaInput").value.trim();
  if(!raw){ setStatus("Vul een agenda-ID of iCalendar-URL in.","error"); return; }

  setStatus("Agenda wordt geladen…","neutral");

  // A full iCalendar URL is the most reliable client-side input.
  // For a bare token/id, try the Somtoday stream pattern described in the API docs.
  let url=raw;
  if(!/^https?:\/\//i.test(raw)){
    url=`https://api.somtoday.nl/rest/v1/icalendar/stream/${encodeURIComponent(raw)}`;
  }

  try{
    const response=await fetch(url,{mode:"cors"});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const text=await response.text();
    const events=parseICS(text);
    state.events=events;
    state.loaded=true;
    state.weekOffset=0;
    renderCalendar();
    setStatus(`${events.length} afspraken geladen. Alleen in deze browser verwerkt.`,"ok");
  }catch(error){
    state.events=demoEvents;
    renderCalendar();
    setStatus("Directe agenda-fetch is door CORS/netwerk geblokkeerd. Gebruik hieronder een .ics-bestand.","error");
  }
}

function loadFile(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const events=parseICS(reader.result);
      state.events=events;
      state.loaded=true;
      renderCalendar();
      setStatus(`${events.length} afspraken uit .ics geladen. Geen opslag gebruikt.`,"ok");
    }catch(e){
      setStatus("Dit .ics-bestand kon niet worden gelezen.","error");
    }
  };
  reader.readAsText(file);
}

function openSettings(){
  $("settingsDialog").showModal();
}

function applySettings(){
  const name=($("nameInput").value.trim()||"Jouw Naam");
  $("profileName").textContent=name;
  document.querySelector(".hero h1 span").textContent=name;
  document.querySelector(".user-chip span:not(.avatar)").textContent=name;
  const accent=$("accentInput").value;
  document.body.classList.remove("accent-cyan","accent-pink","accent-green");
  if(accent!=="violet") document.body.classList.add(`accent-${accent}`);
}

document.addEventListener("DOMContentLoaded",()=>{
  renderClock();
  renderGrades();
  state.events=demoEvents;
  renderCalendar();
  setInterval(renderClock,1000);

  $("loadAgenda").addEventListener("click",loadAgenda);
  $("icsFile").addEventListener("change",e=>loadFile(e.target.files[0]));
  $("prevWeek").addEventListener("click",()=>{state.weekOffset--;renderCalendar()});
  $("nextWeek").addEventListener("click",()=>{state.weekOffset++;renderCalendar()});
  $("settingsBtn").addEventListener("click",openSettings);
  $("applySettings").addEventListener("click",e=>{e.preventDefault();applySettings();$("settingsDialog").close()});

  $("mobileMenu").addEventListener("click",()=>document.querySelector(".sidebar").classList.toggle("open"));

  document.querySelectorAll(".nav-item,.link-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const section=btn.dataset.section;
      if(!section) return;
      document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.section===section));
      const target=document.getElementById(section==="home"?"homeSection":`${section}Panel`);
      if(target) target.scrollIntoView({behavior:"smooth",block:"start"});
      document.querySelector(".sidebar").classList.remove("open");
    });
  });

  $("globalSearch").addEventListener("input",e=>{
    const q=e.target.value.trim().toLowerCase();
    document.querySelectorAll(".task-row,.message-row,.grade-row,.news-card,.event").forEach(el=>{
      el.style.display=!q || el.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
});
