/* Best&Faires Beta.7.4 - Firestore + Calendario Admin */

let players = [];
let matches = [];
let currentMatch = null;
let lineup = [];
let localVoted = false;
let calendarDraft = [];

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function isAdmin(){ return window.currentUserData?.role === 'admin'; }
function isPlayer(){ return window.currentUserData?.role === 'player'; }
function uid(){ return firebase.auth().currentUser?.uid || ''; }
function leagueId(){ return window.currentUserData?.leagueId || 'demo'; }
function leagueTeam(){ return window.currentLeagueData?.teamName || 'Squadra'; }

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function playerName(p){ return p.displayName || [p.nome,p.cognome].filter(Boolean).join(' ') || 'Giocatore'; }
function normalizeName(v='') { return String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
function isLocalTeamName(name='') {
  const a = normalizeName(name), b = normalizeName(leagueTeam());
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  // Il calendario può usare una denominazione sportiva abbreviata rispetto alla lega.
  const aliases = ['juvenilia','polisportiva juvenilia'];
  return aliases.some(x => a.includes(x)) && b.includes('juvenilia');
}
function canonicalPair(a,b){ return [normalizeName(a),normalizeName(b)].sort().join('|'); }
function calendarKey(row){ return `${normalizeName(row.fase || 'andata')}|${String(row.giornata)}|${canonicalPair(row.casa,row.trasferta)}`; }

function parseDateTime(match){
  if (match?.scheduledStart?.toDate) return match.scheduledStart.toDate();
  if (match?.scheduledStart instanceof Date) return match.scheduledStart;
  if (match?.date && match?.time) {
    const parts = String(match.date).split('/');
    if (parts.length === 3) {
      const iso = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T${String(match.time).padStart(5,'0')}:00+02:00`;
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}
function matchHasStarted(m=currentMatch){ const d = parseDateTime(m); return !!d && Date.now() >= d.getTime(); }
function isLineupLocked(){
  if (!currentMatch) return true;
  if (currentMatch.adminOverrideOpen === true) return false;
  if (matchHasStarted()) return true;
  return currentMatch.lineupLocked === true;
}
function currentPlayer(){
  if (!isPlayer()) return null;
  const id = window.currentUserData?.playerId;
  return players.find(p => p.id === id) || players.find(p => p.userId === uid()) || null;
}
function currentPlayerInLineup(){ const p=currentPlayer(); return !!p && lineup.includes(p.id); }
function formatDate(d){ return d ? d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'}) : ''; }
function formatDateTime(d){ return d ? d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''; }
function statusLabel(s){ return ({scheduled:'PROGRAMMATA',voting_open:'VOTAZIONE APERTA',in_progress:'IN CORSO',finished:'TERMINATA',postponed:'RINVIATA',cancelled:'ANNULLATA'}[s] || String(s||'PROGRAMMATA').toUpperCase()); }
function statusClass(s){ return s==='voting_open'?'open':(s==='postponed'?'warn':(s==='cancelled'?'closed':'')); }

async function loadPlayers(){
  const snap = await db.collection('players').where('leagueId','==',leagueId()).get();
  players = snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.active!==false);
  players.sort((a,b)=>playerName(a).localeCompare(playerName(b),'it'));
}
async function loadMatches(){
  const snap = await db.collection('matches').where('leagueId','==',leagueId()).get();
  matches = snap.docs.map(d=>({id:d.id,...d.data()}));
  matches.sort((a,b)=>(parseDateTime(a)?.getTime()||0)-(parseDateTime(b)?.getTime()||0));
  currentMatch = matches.find(m=>m.status==='voting_open') || matches.find(m=>parseDateTime(m)>=new Date()) || matches[0] || null;
  lineup = currentMatch && Array.isArray(currentMatch.lineup) ? [...currentMatch.lineup] : [];
}
async function loadLeague(){
  const snap=await db.collection('leagues').doc(leagueId()).get();
  window.currentLeagueData=snap.exists?snap.data():{};
}
async function refresh(){
  try{
    await loadLeague(); await loadPlayers(); await loadMatches();
    renderLeague(); renderMatch(); renderPlayers(); renderCalendar();
    await renderRanking(); await loadOwnVoteState(); renderMatch();
  }catch(e){ console.error(e); const msg=$('#voteMsg'); if(msg) msg.textContent='❌ Errore nel caricamento dei dati da Firebase.'; }
}
function renderLeague(){
  if(!window.currentLeagueData) return;
  $('#leagueName').textContent=window.currentLeagueData.name||leagueTeam()||'Best&Faires';
  $('#seasonName').textContent=`Stagione ${window.currentLeagueData.season||''}`;
}
function renderMatch(){
  if(!currentMatch){
    $('#matchTitle').textContent='Nessuna partita caricata'; $('#rosterList').innerHTML='<p class="muted">L’Admin deve inserire una partita nel calendario.</p>'; $('#votingCard')?.classList.add('hidden'); return;
  }
  const team=currentMatch.homeTeam||leagueTeam(), opponent=currentMatch.opponent||currentMatch.awayTeam||'Avversario';
  const title=`${team} vs ${opponent}`;
  $('#matchTitle').textContent=title; const mh=$('#match h2'); if(mh) mh.textContent=title;
  const d=parseDateTime(currentMatch); const meta=$('#match .match-meta'); if(meta) meta.innerHTML=`<span>Giornata ${escapeHtml(currentMatch.day||currentMatch.giornata||'')}</span><span>${formatDateTime(d)}</span>`;
  const dt=$('#match h3'); if(dt) dt.textContent=`Distinta ${escapeHtml(team)}`;
  const box=$('#rosterList'), locked=isLineupLocked(), me=currentPlayer();
  box.innerHTML=players.map(p=>{
    const checked=lineup.includes(p.id), mine=me?.id===p.id;
    return `<label class="check ${locked||!isAdmin()?'locked':''}"><input type="checkbox" data-player="${escapeHtml(p.id)}" ${checked?'checked':''} ${(locked||!isAdmin())?'disabled':''}><span>${escapeHtml(playerName(p))}</span>${mine?'<small class="sub">Tu</small>':''}</label>`;
  }).join('');
  const lockBtn=$('#lockBtn');
  if(isAdmin()){
    lockBtn.style.display='';
    if(matchHasStarted()) lockBtn.textContent=currentMatch.adminOverrideOpen?'🔒 Chiudi modifica eccezionale':'🔓 Sblocca distinta (eccezione Admin)';
    else lockBtn.textContent=currentMatch.lineupLocked?'🔓 Sblocca distinta':'🔒 Blocca distinta';
  }else lockBtn.style.display='none';
  const status=$('#matchLockStatus');
  if(status) status.textContent=matchHasStarted()?(currentMatch.adminOverrideOpen?'⚠️ Sblocco eccezionale Admin attivo.':'🔒 Distinta bloccata automaticamente all’inizio della partita.'):'🕒 Distinta modificabile fino all’inizio della partita.';
  const canVote=isPlayer()&&matchHasStarted()&&currentMatch.status==='voting_open'&&currentPlayerInLineup();
  if(canVote){ $('#votingCard').classList.remove('hidden'); populateVotes(); } else $('#votingCard').classList.add('hidden');
  updateProgress();
}

$('#rosterList')?.addEventListener('change',async e=>{
  if(!isAdmin()||!e.target.matches('input')||isLineupLocked()) return;
  const id=e.target.dataset.player;
  if(e.target.checked&&!lineup.includes(id)) lineup.push(id);
  if(!e.target.checked) lineup=lineup.filter(x=>x!==id);
  try{ await db.collection('matches').doc(currentMatch.id).update({lineup}); currentMatch.lineup=[...lineup]; renderMatch(); }
  catch(err){ console.error(err); alert('Impossibile aggiornare la distinta.'); }
});
$('#lockBtn')?.addEventListener('click',async()=>{
  if(!isAdmin()||!currentMatch) return;
  const next=matchHasStarted()?!currentMatch.adminOverrideOpen:!currentMatch.lineupLocked;
  const data=matchHasStarted()?{adminOverrideOpen:next}:{lineupLocked:next};
  try{ await db.collection('matches').doc(currentMatch.id).update(data); Object.assign(currentMatch,data); renderMatch(); }
  catch(e){ console.error(e); alert('Firebase ha rifiutato la modifica della distinta.'); }
});
async function loadOwnVoteState(){
  localVoted=false; if(!isPlayer()||!currentMatch) return;
  try{ const snap=await db.collection('matches').doc(currentMatch.id).collection('votes').doc(uid()).get(); localVoted=snap.exists; }catch(e){console.error(e);}
}
function populateVotes(){
  const me=currentPlayer(), eligible=players.filter(p=>lineup.includes(p.id)&&p.id!==me?.id);
  [1,2,3].forEach(n=>{const s=$('#vote'+n); s.innerHTML='<option value="">Seleziona...</option>'+eligible.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(playerName(p))}</option>`).join(''); s.disabled=localVoted;});
  $('#submitVote').disabled=localVoted; $('#voteMsg').textContent=localVoted?'✅ Voto già registrato per questo account.':'';
}
$('#submitVote')?.addEventListener('click',async()=>{
  if(!isPlayer()||!currentMatch||!matchHasStarted()||currentMatch.status!=='voting_open'||!currentPlayerInLineup()||localVoted) return;
  const ranking=[1,2,3].map(n=>$('#vote'+n).value), me=currentPlayer();
  if(ranking.some(x=>!x)||new Set(ranking).size!==3) return alert('Seleziona tre giocatori diversi.');
  if(ranking.some(x=>!lineup.includes(x))) return alert('Puoi votare solo giocatori presenti in distinta.');
  if(ranking.includes(me?.id)) return alert('Non puoi votare te stesso.');
  try{ await db.collection('matches').doc(currentMatch.id).collection('votes').doc(uid()).create({ranking}); localVoted=true; renderMatch(); alert('✅ Voto registrato. Grazie!'); }
  catch(e){console.error(e); alert(e.code==='permission-denied'?'❌ Voto rifiutato dalle regole di sicurezza.':'❌ Impossibile registrare il voto.');}
});

async function calculateRanking(){
  const map=Object.fromEntries(players.map(p=>[p.id,{...p,points:0,votes:0,first:0,second:0,third:0}]));
  if(!currentMatch) return [];
  if(!isAdmin()) return Object.values(map).filter(p=>lineup.includes(p.id));
  const snap=await db.collection('matches').doc(currentMatch.id).collection('votes').get();
  snap.forEach(doc=>{(doc.data().ranking||[]).forEach((id,i)=>{if(!map[id])return;map[id].points+=3-i;map[id].votes++;map[id][['first','second','third'][i]]++;});});
  return Object.values(map).filter(p=>lineup.includes(p.id)).sort((a,b)=>b.points-a.points||b.first-a.first||b.second-a.second||playerName(a).localeCompare(playerName(b),'it'));
}
async function renderRanking(){
  const rows=await calculateRanking();
  $('#rankingTable').innerHTML=rows.map((p,i)=>`<div class="rank"><span class="pos">${i<3?['🥇','🥈','🥉'][i]:i+1}</span><div><b>${escapeHtml(playerName(p))}</b><span class="sub">${p.first}× 1° · ${p.second}× 2° · ${p.third}× 3°</span></div><span class="points">${p.points} pt</span></div>`).join('')||'<p class="muted">Nessun risultato.</p>';
}
function renderPlayers(){
  $('#playersTable').innerHTML=players.map(p=>`<div class="rank"><span class="pos">⚽</span><div><b>${escapeHtml(playerName(p))}</b><span class="sub">${lineup.includes(p.id)?'In distinta':'Fuori distinta'}</span></div></div>`).join('')||'<p class="muted">Nessun giocatore.</p>';
}
function updateProgress(){
  if(!currentMatch)return; const total=lineup.length;
  if(!isAdmin()){ $('#voteProgress').style.width='0%'; $('#voteCount').textContent=`${total} giocatori in distinta`; return; }
  db.collection('matches').doc(currentMatch.id).collection('votes').get().then(s=>{const voted=s.size;$('#voteProgress').style.width=(total?Math.min(100,voted/total*100):0)+'%';$('#voteCount').textContent=`${voted} / ${total} giocatori hanno votato`;}).catch(console.error);
}

// ---------- Calendario Admin ----------
function renderCalendar(){
  const box=$('#calendarList'); if(!box) return;
  if(!isAdmin()){box.innerHTML='<p class="muted">Solo gli Admin possono gestire il calendario.</p>';return;}
  const grouped={Andata:[],Ritorno:[]};
  matches.forEach(m=>{const phase=String(m.fase||'').toLowerCase()==='ritorno'?'Ritorno':'Andata';grouped[phase].push(m);});
  const section=(name,arr)=>`<div class="calendar-group"><h3>${name}</h3>${arr.sort((a,b)=>(Number(a.giornata||a.day)||0)-(Number(b.giornata||b.day)||0)).map(m=>{
    const d=parseDateTime(m), title=`${m.homeTeam||leagueTeam()} vs ${m.opponent||m.awayTeam||''}`;
    return `<div class="calendar-row"><div><b>G${escapeHtml(m.giornata||m.day||'')}</b><span>${escapeHtml(title)}</span><small>${formatDateTime(d)}</small></div><span class="pill ${statusClass(m.status)}">${statusLabel(m.status)}</span><button class="small-btn edit-match" data-id="${escapeHtml(m.id)}">✏️ Modifica</button></div>`;
  }).join('')||'<p class="muted">Nessuna partita.</p>'}</div>`;
  box.innerHTML=section('Andata',grouped.Andata)+section('Ritorno',grouped.Ritorno);
}
function setCalendarMessage(text,good=false){const el=$('#calendarMsg');if(el){el.textContent=text;el.className=good?'success':'muted';}}
function openMatchEditor(match=null){
  if(!isAdmin())return;
  $('#matchEditId').value=match?.id||'';
  $('#matchEditRound').value=match?.giornata||match?.day||'';
  $('#matchEditPhase').value=String(match?.fase||'Andata').toLowerCase()==='ritorno'?'Ritorno':'Andata';
  const d=parseDateTime(match); $('#matchEditDate').value=d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:'';
  $('#matchEditTime').value=d?`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:'';
  $('#matchEditHome').value=match?.homeTeam||leagueTeam(); $('#matchEditAway').value=match?.opponent||match?.awayTeam||'';
  $('#matchEditStatus').value=match?.status||'scheduled'; $('#matchModal').classList.remove('hidden');
}
function closeMatchEditor(){ $('#matchModal').classList.add('hidden'); }
function buildScheduledStart(date,time){ return new Date(`${date}T${time}:00`); }
async function saveMatchEditor(e){
  e.preventDefault(); if(!isAdmin())return;
  const id=$('#matchEditId').value, date=$('#matchEditDate').value, time=$('#matchEditTime').value, home=$('#matchEditHome').value.trim(), away=$('#matchEditAway').value.trim();
  if(!date||!time||!home||!away)return alert('Compila casa, trasferta, data e ora.');
  const scheduledStart=buildScheduledStart(date,time), data={giornata:String($('#matchEditRound').value).trim(),day:String($('#matchEditRound').value).trim(),fase:$('#matchEditPhase').value,homeTeam:home,awayTeam:away,opponent:leagueTeam()===home?away:home,isHome:isLocalTeamName(home),scheduledStart:firebase.firestore.Timestamp.fromDate(scheduledStart),date:formatDate(scheduledStart),time:time,status:$('#matchEditStatus').value};
  try{
    if(id){
      const old=matches.find(m=>m.id===id); if(old&&matchHasStarted(old)&&old.status==='voting_open'&&old.scheduledStart){
        const confirmed=confirm('La partita è già iniziata. La modifica di data/ora richiede una conferma eccezionale. Continuare?'); if(!confirmed)return;
        data.adminOverrideOpen=true;
      }
      await db.collection('matches').doc(id).update(data);
    }else{
      data.leagueId=leagueId(); data.lineup=[]; data.lineupLocked=false; data.adminOverrideOpen=false; data.calendarKey=calendarKey({fase:data.fase,giornata:data.giornata,casa:home,trasferta:away});
      await db.collection('matches').add(data);
    }
    closeMatchEditor(); setCalendarMessage('✅ Partita salvata.',true); await loadMatches(); renderCalendar(); renderMatch();
  }catch(err){console.error(err);alert(err.code==='permission-denied'?'❌ Firebase ha rifiutato la modifica. La partita potrebbe essere già iniziata.':'❌ Impossibile salvare la partita.');}
}

function excelSerialToDate(value){
  if (value instanceof Date) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = new Date(Date.UTC(1899,11,30));
    const d = new Date(epoch.getTime() + value * 86400000);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
  }
  if (typeof value === 'string') {
    const text=value.trim();
    const m=text.match(/^(\d{1,2})[\\/.](\d{1,2})[\\/.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if(m) return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]||0),Number(m[5]||0),0);
  }
  return null;
}
function parseExcelRows(workbook){
  const rows=[]; let phase='Andata';
  workbook.SheetNames.forEach(name=>{
    const sheet=workbook.Sheets[name];
    const data=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:null});
    data.forEach(r=>{
      const first=String(r?.[0]??'').trim().toUpperCase();
      if(first==='ANDATA'){phase='Andata';return;}
      if(first==='RITORNO'){phase='Ritorno';return;}
      if(first==='GIORNATA')return;
      const giornata=String(r?.[0]??'').trim();
      const casa=String(r?.[1]??'').trim();
      const trasferta=String(r?.[2]??'').trim();
      const d=excelSerialToDate(r?.[3]);
      if(!/^\d+$/.test(giornata)||!casa||!trasferta||!d||Number.isNaN(d.getTime()))return;
      rows.push({fase:phase,giornata,casa,trasferta,date:d});
    });
  });
  return rows;
}
function localAndOpponent(row){
  // Manteniamo l'ordine reale della partita del calendario.
  // isHome indica invece se la squadra della lega è la squadra di casa.
  if(isLocalTeamName(row.casa)) return {isHome:true,home:row.casa,away:row.trasferta,opponent:row.trasferta};
  if(isLocalTeamName(row.trasferta)) return {isHome:false,home:row.casa,away:row.trasferta,opponent:row.casa};
  return {isHome:null,home:row.casa,away:row.trasferta,opponent:row.trasferta};
}
function renderImportPreview(rows){
  const box=$('#importPreview'); if(!box)return;
  const existing=new Map(matches.map(m=>[m.calendarKey,m]));
  calendarDraft=rows.map(r=>{
    const k=calendarKey(r), found=existing.get(k); const loc=localAndOpponent(r);
    let type=found?'MODIFICA':'NUOVA', warning='';
    if(loc.isHome===null) warning=`La squadra della lega "${leagueTeam()}" non è riconosciuta in questa partita`;
    return {...r,calendarKey:k,found,loc,type,warning};
  });
  box.innerHTML=calendarDraft.map(r=>`<div class="import-row"><div><b>${escapeHtml(r.fase)} G${escapeHtml(r.giornata)}</b><span>${escapeHtml(r.casa)} vs ${escapeHtml(r.trasferta)}</span><small>${formatDateTime(r.date)}</small></div><span class="import-badge ${r.type==='NUOVA'?'new':'change'}">${r.type}</span>${r.warning?`<span class="warning">⚠️ ${escapeHtml(r.warning)}</span>`:''}</div>`).join('')||'<p class="muted">Nessuna riga valida trovata.</p>';
  $('#importCommit').disabled=!calendarDraft.length||calendarDraft.some(x=>x.warning);
  $('#importPreviewCard').classList.remove('hidden');
}
async function handleExcel(file){
  if(!file||!isAdmin())return;
  setCalendarMessage(`📖 Lettura di ${file.name}...`);
  try{
    const buffer=await file.arrayBuffer();
    const wb=XLSX.read(buffer,{type:'array',cellDates:true});
    const rows=parseExcelRows(wb);
    if(!rows.length) throw new Error('Nessuna riga partita riconosciuta. Attese colonne: GIORNATA, CASA, TRASFERTA, DATA.');
    renderImportPreview(rows);
    setCalendarMessage(`✅ ${rows.length} partite trovate. Controlla l'anteprima prima di confermare.`);
  }catch(e){
    console.error('Import Excel:',e);
    setCalendarMessage(`❌ ${e.message||'File Excel non valido o struttura non riconosciuta.'}`);
  }
}
async function commitImport(){
  if(!isAdmin()||!calendarDraft.length)return;
  const existingMap=new Map(matches.map(m=>[m.calendarKey,m]));
  try{
    let created=0,updated=0;
    for(const r of calendarDraft){
      const loc=r.loc; const d=r.date; const data={calendarKey:r.calendarKey,leagueId:leagueId(),giornata:String(r.giornata),day:String(r.giornata),fase:r.fase,homeTeam:loc.home,awayTeam:loc.away,opponent:loc.opponent,isHome:loc.isHome,scheduledStart:firebase.firestore.Timestamp.fromDate(d),date:formatDate(d),time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
      const old=existingMap.get(r.calendarKey);
      if(old){
        const oldDate=parseDateTime(old); const changed=!oldDate||oldDate.getTime()!==d.getTime();
        if(changed&&matchHasStarted(old)) throw new Error(`La partita G${r.giornata} ${r.fase} è già iniziata e non può essere rischedulata tramite import.`);
        await db.collection('matches').doc(old.id).update(data); updated++;
      }else{
        await db.collection('matches').add({...data,lineup:[],lineupLocked:false,adminOverrideOpen:false,status:'scheduled'}); created++;
      }
    }
    $('#importPreviewCard').classList.add('hidden'); $('#excelInput').value=''; await loadMatches(); renderCalendar(); renderMatch(); setCalendarMessage(`✅ Importazione completata: ${created} nuove, ${updated} aggiornate.`,true);
  }catch(e){console.error(e);alert(e.message.startsWith('La partita')?`❌ ${e.message}`:'❌ Importazione non completata. Nessuna garanzia di rollback automatico.');}
}

$('#calendarList')?.addEventListener('click',e=>{const b=e.target.closest('.edit-match');if(b){const m=matches.find(x=>x.id===b.dataset.id);openMatchEditor(m);}});
$('#newMatchBtn')?.addEventListener('click',()=>openMatchEditor());
$('#cancelMatchEdit')?.addEventListener('click',closeMatchEditor); $('#closeMatchModal')?.addEventListener('click',closeMatchEditor);
$('#matchEditForm')?.addEventListener('submit',saveMatchEditor);
$('#excelInput')?.addEventListener('change',e=>handleExcel(e.target.files?.[0]));
$('#importCommit')?.addEventListener('click',commitImport);
$('#importCancel')?.addEventListener('click',()=>{$('#importPreviewCard').classList.add('hidden');calendarDraft=[];$('#excelInput').value='';});

function show(id){
  if(id==='admin'&&!isAdmin())return; if(id==='calendar'&&!isAdmin())return;
  $$('.screen').forEach(x=>x.classList.remove('active')); $('#'+id)?.classList.add('active');
  if(id==='ranking')renderRanking(); if(id==='players')renderPlayers(); if(id==='match')renderMatch(); if(id==='calendar')renderCalendar();
}
$$('[data-screen]').forEach(b=>b.onclick=()=>show(b.dataset.screen));
$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');renderRanking();});
async function bootApp(){if(!window.currentUserData)return;await loadLeague();await refresh();console.log('Best&Faires Beta.7.5: Firestore + calendario caricati.');}
window.applyRolePermissions=async userData=>{window.currentUserData=userData;document.querySelectorAll('.admin-only').forEach(b=>b.classList.toggle('hidden',userData?.role!=='admin'));await bootApp();};
