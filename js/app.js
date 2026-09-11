const players=[
 {id:1,name:"Rossi",votes:0,points:0},{id:2,name:"Bianchi",votes:0,points:0},
 {id:3,name:"Verdi",votes:0,points:0},{id:4,name:"Carta",votes:0,points:0},
 {id:5,name:"Serra",votes:0,points:0},{id:6,name:"Piras",votes:0,points:0},
 {id:7,name:"Manca",votes:0,points:0},{id:8,name:"Melis",votes:0,points:0},
 {id:9,name:"Sanna",votes:0,points:0},{id:10,name:"Atzori",votes:0,points:0},
 {id:11,name:"Fadda",votes:0,points:0}
];
const state=JSON.parse(localStorage.getItem("bf_beta1"))||{lineup:[1,2,3,4,5,6,7,8,9,10,11],locked:false,voted:false,currentUser:1,votes:[]};
const save=()=>localStorage.setItem("bf_beta1",JSON.stringify(state));
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
function show(id){$$(".screen").forEach(x=>x.classList.remove("active"));$("#"+id).classList.add("active"); if(id==="ranking")renderRanking(); if(id==="players")renderPlayers(); if(id==="match")renderMatch();}
$$("[data-screen]").forEach(b=>b.onclick=()=>show(b.dataset.screen));

function renderMatch(){
 const box=$("#rosterList"); box.innerHTML="";
 players.forEach(p=>{
   const checked=state.lineup.includes(p.id);
   box.insertAdjacentHTML("beforeend",`<label class="check ${state.locked?"locked":""}"><input type="checkbox" data-player="${p.id}" ${checked?"checked":""} ${state.locked?"disabled":""}><span>${p.name}</span>${p.id===state.currentUser?'<small class="sub">Tu</small>':''}</label>`);
 });
 $("#lockBtn").textContent=state.locked?"🔓 Distinta bloccata":"🔒 Blocca distinta";
 $("#lockBtn").disabled=state.locked;
 if(state.locked){$("#votingCard").classList.remove("hidden");populateVotes();}else $("#votingCard").classList.add("hidden");
 updateProgress();
}
$("#rosterList").addEventListener("change",e=>{if(!e.target.matches("input"))return; const id=+e.target.dataset.player;if(e.target.checked&&!state.lineup.includes(id))state.lineup.push(id);if(!e.target.checked)state.lineup=state.lineup.filter(x=>x!==id);save();});
$("#lockBtn").onclick=()=>{if(state.lineup.length<4){alert("Servono almeno 4 giocatori in distinta per votare i migliori 3.");return}state.locked=true;save();renderMatch();};

function populateVotes(){
 const eligible=players.filter(p=>state.lineup.includes(p.id)&&p.id!==state.currentUser);
 [1,2,3].forEach(n=>{const s=$("#vote"+n);s.innerHTML='<option value="">Seleziona...</option>'+eligible.map(p=>`<option value="${p.id}">${p.name}</option>`).join("");});
 if(state.voted){["vote1","vote2","vote3"].forEach(x=>$("#"+x).disabled=true);$("#submitVote").disabled=true;$("#voteMsg").textContent="✅ Voto registrato correttamente."; }
}
$("#submitVote").onclick=()=>{
 const ids=[1,2,3].map(n=>+$("#vote"+n).value);
 if(ids.some(x=>!x)||new Set(ids).size!==3){alert("Seleziona tre giocatori diversi.");return}
 state.votes.push({voter:state.currentUser,choices:ids});state.voted=true;save();renderMatch();
};
function calculate(){
 const map=Object.fromEntries(players.map(p=>[p.id,{...p,points:0,votes:0,first:0,second:0,third:0}]));
 state.votes.forEach(v=>v.choices.forEach((id,i)=>{const pts=3-i;map[id].points+=pts;map[id].votes++;map[id][["first","second","third"][i]]++;}));
 return Object.values(map).filter(p=>state.lineup.includes(p.id)).sort((a,b)=>b.points-a.points||b.first-a.first||b.second-a.second);
}
function renderRanking(){
 const rows=calculate();$("#rankingTable").innerHTML=rows.map((p,i)=>`<div class="rank"><span class="pos">${i<3?["🥇","🥈","🥉"][i]:i+1}</span><div><b>${p.name}</b><span class="sub">${p.first}× 1° · ${p.second}× 2° · ${p.third}× 3°</span></div><span class="points">${p.points} pt</span></div>`).join("")||"<p class='muted'>Nessun risultato.</p>";
}
$$(".tab").forEach(t=>t.onclick=()=>{$$(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");renderRanking();});
function renderPlayers(){$("#playersTable").innerHTML=players.map(p=>`<div class="rank"><span class="pos">⚽</span><div><b>${p.name}</b><span class="sub">${state.lineup.includes(p.id)?"In distinta":"Fuori distinta"}</span></div><span class="points">${calculate().find(x=>x.id===p.id)?.points||0} pt</span></div>`).join("")}
function updateProgress(){const n=state.lineup.length;$("#voteProgress").style.width=(state.voted?100:0)+"%";$("#voteCount").textContent=(state.voted?"1":"0")+" / "+n+" giocatori hanno votato";}
$("#resetBtn").onclick=()=>{localStorage.removeItem("bf_beta1");location.reload()};
renderMatch();
