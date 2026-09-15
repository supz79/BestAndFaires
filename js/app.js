/* Best&Faires Beta.7.16 - Ricalcolo sicuro delle classifiche */

let players = [];
let matches = [];
let currentMatch = null;
let lineup = [];
let localVoted = false;
let calendarDraft = [];
let currentMatchStats = {};
let statsRenderToken = 0;

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
function matchEndDate(m=currentMatch){
  if(!m) return null;
  if(m.finishedAt?.toDate) return m.finishedAt.toDate();
  if(m.finishedAt instanceof Date) return m.finishedAt;
  if(m.finishedAt) { const d=new Date(m.finishedAt); if(!Number.isNaN(d.getTime())) return d; }
  return parseDateTime(m);
}
function votingDeadlineDate(m=currentMatch){ const end=matchEndDate(m); return end ? new Date(end.getTime()+24*60*60*1000) : null; }
function votingWindowOpen(m=currentMatch){
  if(!m || !matchHasStarted(m)) return false;
  const blocked=['cancelled','postponed']; if(blocked.includes(String(m.status||''))) return false;
  const deadline=votingDeadlineDate(m);
  return !!deadline && Date.now() <= deadline.getTime();
}
function votingRemainingMs(m=currentMatch){ const d=votingDeadlineDate(m); return d ? Math.max(0,d.getTime()-Date.now()) : 0; }
function formatCountdown(ms){ const total=Math.floor(Math.max(0,ms)/1000); const days=Math.floor(total/86400); const h=Math.floor(total%86400/3600); const min=Math.floor(total%3600/60); const sec=total%60; return `${days}g ${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }
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

  // Per il Player la priorita e' la partita attualmente in corso
  // alla quale il giocatore appartiene. Solo se non esiste, mostriamo
  // la prossima partita futura. Questo evita di saltare una partita in
  // corso solo perche' esiste un'altra partita piu' avanti nel calendario.
  if(isPlayer()){
    const meId=window.currentUserData?.playerId;
    const activeNow=matches.filter(m=>{
      const d=parseDateTime(m);
      const eligible=!!meId && Array.isArray(m.lineup) && m.lineup.includes(meId);
      const blocked=['finished','cancelled','postponed'].includes(String(m.status||''));
      return !!d && Date.now()>=d.getTime() && eligible && !blocked;
    });
    activeNow.sort((a,b)=>{
      const rank=s=>s==='voting_open'?0:(s==='in_progress'?1:2);
      return rank(a.status)-rank(b.status) || (parseDateTime(b)?.getTime()||0)-(parseDateTime(a)?.getTime()||0);
    });
    const future=matches.filter(m=>{
      const d=parseDateTime(m);
      return !!d && d.getTime()>Date.now() && !['finished','cancelled','postponed'].includes(String(m.status||''));
    });
    currentMatch=activeNow[0] || future[0] || null;
  }else{
    // Anche l'Admin deve vedere prima una partita attualmente in corso,
    // non saltarla semplicemente perché nel calendario esiste una partita futura.
    // Priorità: votazione aperta -> in corso -> altra partita già iniziata -> futura.
    const activeNow = matches.filter(m=>{
      const d=parseDateTime(m);
      const status=String(m.status||'');
      const explicitlyInProgress=status==='in_progress' || status==='voting_open';
      const startedByTime=!!d && Date.now()>=d.getTime();
      return (explicitlyInProgress || startedByTime) && !['finished','cancelled','postponed'].includes(status);
    });
    activeNow.sort((a,b)=>{
      const rank=s=>s==='voting_open'?0:(s==='in_progress'?1:2);
      return rank(a.status)-rank(b.status) || (parseDateTime(b)?.getTime()||0)-(parseDateTime(a)?.getTime()||0);
    });
    const future=matches.filter(m=>{
      const d=parseDateTime(m);
      return !!d && d.getTime()>Date.now() && !['finished','cancelled','postponed'].includes(String(m.status||''));
    });
    currentMatch=activeNow[0] || future[0] || matches[0] || null;
  }
  lineup = currentMatch && Array.isArray(currentMatch.lineup) ? [...currentMatch.lineup] : [];
}

function renderDashboard(){
  const title=$('#matchTitle'), state=$('#voteState'), progress=$('#dashboardProgress'), eyebrow=$('#matchEyebrow');
  if(!title)return;
  if(!currentMatch){
    title.textContent='Nessuna partita disponibile';
    if(eyebrow) eyebrow.textContent='PARTITA';
    if(state){state.textContent='';state.className='pill';}
    if(progress)progress.textContent='';
    return;
  }
  const home=currentMatch.homeTeam||leagueTeam(), away=currentMatch.awayTeam||currentMatch.opponent||'Avversario';
  title.textContent=`${home} vs ${away}`;
  const started=matchHasStarted(currentMatch);
  if(eyebrow) eyebrow.textContent=started ? 'PARTITA IN CORSO' : 'PROSSIMA PARTITA';
  const meInLineup=isPlayer() && currentPlayerInLineup();
  let label='PROGRAMMATA';
  let cls='pill';
  if(started && meInLineup && votingWindowOpen(currentMatch)) { label='VOTA ORA'; cls='pill open'; }
  else if(started && meInLineup && !votingWindowOpen(currentMatch)) { label='VOTO SCADUTO'; cls='pill closed'; }
  else if(started && meInLineup) { label='IN CORSO'; cls='pill'; }
  else if(started) { label='IN CORSO'; cls='pill'; }
  else { label='PROSSIMA'; cls='pill'; }
  if(state){state.textContent=label;state.className=cls;}
  const dashboardCard=$('#dashboardMatchCard');
  if(dashboardCard){
    const clickable=!!currentMatch;
    dashboardCard.classList.toggle('is-clickable',clickable);
    dashboardCard.setAttribute('aria-disabled',clickable?'false':'true');
  }
  if(progress){
    const n=Array.isArray(currentMatch.lineup)?currentMatch.lineup.length:0;
    if(isPlayer() && votingWindowOpen(currentMatch)) progress.textContent=`Voto disponibile ancora per ${formatCountdown(votingRemainingMs(currentMatch))}`;
    else progress.textContent=started ? `${n} giocatori in distinta` : `Distinta disponibile prima dell'inizio della partita`;
  }
}
async function loadLeague(){
  const snap=await db.collection('leagues').doc(leagueId()).get();
  window.currentLeagueData=snap.exists?snap.data():{};
}
async function refresh(){
  try{
    await loadLeague(); await loadPlayers(); await loadMatches();
    renderLeague(); renderDashboard(); renderMatch(); renderPlayers(); renderCalendar(); renderAdminPlayers(); await loadPendingRegistrations();
    await syncPublicResultsForAdmin();
    await renderRanking(); await loadOwnVoteState(); renderMatch();
  }catch(e){ console.error(e); const msg=$('#voteMsg'); if(msg) msg.textContent='❌ Errore nel caricamento dei dati da Firebase.'; }
}
function renderLeague(){
  if(!window.currentLeagueData) return;
  $('#leagueName').textContent=window.currentLeagueData.name||leagueTeam()||'Best&Faires';
  $('#seasonName').textContent=`Stagione ${window.currentLeagueData.season||''}`;
}

async function loadMatchStats(matchId=currentMatch?.id){
  currentMatchStats={};
  if(!matchId) return;
  try{
    const snap=await db.collection('matches').doc(matchId).collection('stats').get();
    snap.forEach(d=>{ currentMatchStats[d.id]={id:d.id,...(d.data()||{})}; });
  }catch(e){ console.error('Caricamento statistiche partita:',e); }
}
function statNum(v){ const n=Number(v); return Number.isFinite(n)&&n>=0?Math.floor(n):0; }
function renderMatchStats(){
  const card=$('#matchStatsCard'), box=$('#matchStatsList');
  if(!card||!box||!currentMatch) return;
  const canEdit=isAdmin();
  const saveBtn=$('#saveMatchStatsBtn'), msg=$('#matchStatsMsg');
  if(saveBtn) saveBtn.closest('.modal-actions')?.classList.toggle('hidden',!canEdit);
  if(msg) msg.classList.toggle('hidden',!canEdit);
  const ids=Array.isArray(currentMatch.lineup)?currentMatch.lineup:[];
  if(!ids.length){ card.classList.toggle('hidden',!canEdit); box.innerHTML='<p class="muted">Nessun giocatore in distinta.</p>'; return; }
  const rows=ids.map(id=>{
    const p=players.find(x=>x.id===id); if(!p) return '';
    const st=currentMatchStats[id]||{};
    const played=st.appearance===1 || st.appearance===true;
    if(canEdit){
      return `<div class="stats-row" data-stat-player="${escapeHtml(id)}">
        <div><b>${escapeHtml(playerName(p))}</b><div class="stats-note">${played?'Presenza registrata':'Non ancora registrato come presente'}</div></div>
        <label title="Presenza">🏟️ <input class="stat-appearance" type="checkbox" ${played?'checked':''}></label>
        <label title="Gol">⚽ <input class="stat-goals" type="number" min="0" step="1" value="${statNum(st.goals)}"></label>
        <label title="Assist">🎯 <input class="stat-assists" type="number" min="0" step="1" value="${statNum(st.assists)}"></label>
        <label title="Gialli">🟨 <input class="stat-yellow" type="number" min="0" step="1" value="${statNum(st.yellow)}"></label>
        <label title="Rossi">🟥 <input class="stat-red" type="number" min="0" step="1" value="${statNum(st.red)}"></label>
      </div>`;
    }
    if(!played) return '';
    return `<div class="stats-row stats-readonly" data-stat-player="${escapeHtml(id)}"><div><b>${escapeHtml(playerName(p))}</b></div><span>⚽ ${statNum(st.goals)}</span><span>🎯 ${statNum(st.assists)}</span><span>🟨 ${statNum(st.yellow)}</span><span>🟥 ${statNum(st.red)}</span></div>`;
  }).join('');
  card.classList.toggle('hidden',!canEdit && !Object.keys(currentMatchStats).length);
  if(canEdit){
    box.innerHTML=`<div class="stats-grid stats-header"><span>Giocatore</span><span>Pres.</span><span>Gol</span><span>Assist</span><span>Gialli</span><span>Rossi</span></div>${rows||'<p class="muted">Nessun giocatore.</p>'}`;
  }else{
    box.innerHTML=`<div class="stats-row stats-header"><span>Giocatore</span><span>Gol</span><span>Assist</span><span>Gialli</span><span>Rossi</span></div>${rows||'<p class="muted">Nessuna statistica registrata.</p>'}`;
  }
}
async function saveMatchStats(){
  if(!isAdmin()||!currentMatch) return;
  const btn=$('#saveMatchStatsBtn'), rows=[...document.querySelectorAll('#matchStatsList .stats-row[data-stat-player]')];
  if(btn){btn.disabled=true;btn.textContent='⏳ Salvataggio...';}
  try{
    const batch=db.batch();
    rows.forEach(row=>{
      const playerId=row.dataset.statPlayer;
      const appearance=row.querySelector('.stat-appearance')?.checked;
      const ref=db.collection('matches').doc(currentMatch.id).collection('stats').doc(playerId);
      if(!appearance){ batch.delete(ref); return; }
      const data={appearance:1,goals:statNum(row.querySelector('.stat-goals')?.value),assists:statNum(row.querySelector('.stat-assists')?.value),yellow:statNum(row.querySelector('.stat-yellow')?.value),red:statNum(row.querySelector('.stat-red')?.value)};
      batch.set(ref,data,{merge:true});
    });
    await batch.commit();
    await loadMatchStats(currentMatch.id); renderMatchStats();
    const msg=$('#matchStatsMsg'); if(msg) msg.textContent='✅ Tabellino salvato.';
  }catch(e){
    console.error('Salvataggio statistiche:',e);
    alert(e.code==='permission-denied'?'❌ Firebase ha rifiutato il salvataggio del tabellino.':'❌ Impossibile salvare il tabellino.');
  }finally{ if(btn){btn.disabled=false;btn.textContent='💾 Salva tabellino';} }
}
async function loadSeasonStats(){
  const totals=Object.fromEntries(players.map(p=>[p.id,{...p,appearances:0,goals:0,assists:0,yellow:0,red:0}]));
  try{
    await Promise.all(matches.map(async m=>{
      const snap=await db.collection('matches').doc(m.id).collection('stats').get();
      snap.forEach(d=>{
        if(!totals[d.id]) return;
        const x=d.data()||{};
        if(x.appearance===1 || x.appearance===true) totals[d.id].appearances+=1;
        totals[d.id].goals+=statNum(x.goals); totals[d.id].assists+=statNum(x.assists); totals[d.id].yellow+=statNum(x.yellow); totals[d.id].red+=statNum(x.red);
      });
    }));
  }catch(e){console.error('Statistiche stagione:',e);}
  return Object.values(totals).sort((a,b)=>b.goals-a.goals||b.assists-a.assists||b.appearances-a.appearances||playerName(a).localeCompare(playerName(b),'it'));
}
async function renderSeasonStats(){
  const box=$('#seasonStatsTable'); if(!box) return;
  const rows=await loadSeasonStats();
  box.innerHTML=`<div class="card"><span class="eyebrow">STAGIONE</span><h3>Statistiche giocatori</h3><p class="muted">Riepilogo cumulativo delle partite disputate. I dati di ogni singola partita restano conservati nel relativo tabellino.</p><div class="stats-season"><div class="stats-header"><span>Giocatore</span><span>Pres.</span><span>Gol</span><span>Assist</span><span>Gialli</span><span>Rossi</span></div>${rows.map(p=>`<div class="stats-row"><div><b>${escapeHtml(playerName(p))}</b></div><span>${p.appearances}</span><span>${p.goals}</span><span>${p.assists}</span><span>${p.yellow}</span><span>${p.red}</span></div>`).join('')}</div></div>`;
}

function renderMatch(){
  if(!currentMatch){
    $('#matchTitle').textContent='Nessuna partita caricata'; $('#rosterList').innerHTML='<p class="muted">L’Admin deve inserire una partita nel calendario.</p>'; $('#votingCard')?.classList.add('hidden'); $('#matchStatsCard')?.classList.add('hidden'); $('#saveMatchStatsBtn')?.closest('.modal-actions')?.classList.add('hidden'); $('#matchStatsMsg')?.classList.add('hidden'); return;
  }
  const statsMatchId=currentMatch.id;
  if(renderMatch._loadedStatsFor!==statsMatchId){
    renderMatch._loadedStatsFor=statsMatchId;
    loadMatchStats(statsMatchId).then(()=>{ if(currentMatch?.id===statsMatchId){ renderMatchStats(); } });
  }
  renderMatchStats();
  const home=currentMatch.homeTeam||leagueTeam(), away=currentMatch.awayTeam||currentMatch.opponent||'Avversario';
  const title=`${home} vs ${away}`;
  $('#matchTitle').textContent=title; const mh=$('#match h2'); if(mh) mh.textContent=title;
  const d=parseDateTime(currentMatch); const meta=$('#match .match-meta'); if(meta) meta.innerHTML=`<span>Giornata ${escapeHtml(currentMatch.day||currentMatch.giornata||'')}</span><span>${formatDateTime(d)}</span>`;
  const dt=$('#match h3'); if(dt) dt.textContent=`Distinta ${escapeHtml(leagueTeam())}`;
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
  if(status){
    if(matchHasStarted()){
      const deadline=votingDeadlineDate(currentMatch);
      status.textContent=(currentMatch.adminOverrideOpen?'⚠️ Sblocco eccezionale Admin attivo. ':'🔒 Distinta bloccata automaticamente all’inizio della partita. ')+(deadline?`⏱️ Votazione disponibile fino al ${formatDateTime(deadline)}.`:'');
    } else status.textContent='🕒 Distinta modificabile fino all’inizio della partita.';
  }
  const canVote=isPlayer()&&votingWindowOpen(currentMatch)&&currentPlayerInLineup();
  if(canVote){ $('#votingCard').classList.remove('hidden'); populateVotes(); } else $('#votingCard').classList.add('hidden');
  const timer=$('#voteTimer');
  if(timer){
    if(isPlayer() && votingWindowOpen(currentMatch)) { timer.textContent=`⏱️ Tempo per votare: ${formatCountdown(votingRemainingMs(currentMatch))}`; timer.className='pill open'; }
    else if(isPlayer() && matchHasStarted()) { timer.textContent='⏱️ Finestra di voto scaduta'; timer.className='pill closed'; }
    else timer.textContent='⏱️ Il voto sarà disponibile dopo l’inizio della partita';
  }
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

  // Il timer aggiorna la schermata ogni secondo. Prima di ricostruire i
  // menu salviamo quindi le selezioni correnti, altrimenti il loro valore
  // verrebbe azzerato ad ogni aggiornamento.
  const selected={};
  [1,2,3].forEach(n=>{
    const current=$('#vote'+n);
    if(current) selected[n]=current.value;
  });

  [1,2,3].forEach(n=>{
    const s=$('#vote'+n);
    if(!s) return;
    s.innerHTML='<option value="">Seleziona...</option>'+eligible.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(playerName(p))}</option>`).join('');
    if(selected[n] && eligible.some(p=>p.id===selected[n])) s.value=selected[n];
    s.disabled=localVoted;
  });
  $('#submitVote').disabled=localVoted; $('#voteMsg').textContent=localVoted?'✅ Voto già registrato per questo account.':'';
}
$('#submitVote')?.addEventListener('click',async()=>{
  if(!isPlayer()||!currentMatch||!votingWindowOpen(currentMatch)||!currentPlayerInLineup()||localVoted) return;
  const ranking=[1,2,3].map(n=>$('#vote'+n).value), me=currentPlayer();
  if(ranking.some(x=>!x)||new Set(ranking).size!==3) return alert('Seleziona tre giocatori diversi.');
  if(ranking.some(x=>!lineup.includes(x))) return alert('Puoi votare solo giocatori presenti in distinta.');
  if(ranking.includes(me?.id)) return alert('Non puoi votare te stesso.');
  try{
    const matchRef=db.collection('matches').doc(currentMatch.id);
    const voteRef=matchRef.collection('votes').doc(uid());
    const resultRefs=ranking.map(id=>matchRef.collection('publicResults').doc(id));

    // Un'unica transazione: crea il voto segreto e aggiorna i tre risultati
    // pubblici. Le Security Rules verificano che gli incrementi corrispondano
    // esattamente al voto appena creato.
    await db.runTransaction(async tx=>{
      const snaps=await Promise.all(resultRefs.map(ref=>tx.get(ref)));
      snaps.forEach((snap,i)=>{
        const playerId=ranking[i];
        const old=snap.exists?snap.data():{points:0,first:0,second:0,third:0,votes:0};
        const inc={points:3-i,first:i===0?1:0,second:i===1?1:0,third:i===2?1:0,votes:1};
        tx.set(resultRefs[i],{
          points:(old.points||0)+inc.points,
          first:(old.first||0)+inc.first,
          second:(old.second||0)+inc.second,
          third:(old.third||0)+inc.third,
          votes:(old.votes||0)+inc.votes
        });
      });
      tx.set(voteRef,{ranking});
    });

    localVoted=true;
    renderMatch();
    alert('✅ Voto registrato. Grazie!');
  }
  catch(e){
    console.error('Errore registrazione voto:', e, {
      uid: uid(),
      playerId: window.currentUserData?.playerId,
      matchId: currentMatch?.id,
      matchStatus: currentMatch?.status,
      scheduledStart: currentMatch?.scheduledStart?.toDate ? currentMatch.scheduledStart.toDate().toISOString() : currentMatch?.scheduledStart,
      lineup: currentMatch?.lineup
    });
    if(e.code==='permission-denied'){
      alert('❌ Firebase ha rifiutato il voto. Controlla che il profilo Player abbia il campo playerId corretto e che quel giocatore sia nella distinta.');
    }else{
      alert(`❌ Impossibile registrare il voto.
${e.code||''} ${e.message||''}`.trim());
    }
  }
});

async function syncPublicResultsForAdmin(){
  if(!isAdmin()) return;
  try{
    for(const m of matches){
      const votesSnap=await db.collection('matches').doc(m.id).collection('votes').get();
      const totals={};
      votesSnap.forEach(doc=>{
        (doc.data().ranking||[]).forEach((id,i)=>{
          if(!totals[id]) totals[id]={points:0,first:0,second:0,third:0,votes:0};
          totals[id].points+=3-i;
          totals[id].votes++;
          totals[id][['first','second','third'][i]]++;
        });
      });
      const resultSnap=await db.collection('matches').doc(m.id).collection('publicResults').get();
      const batch=db.batch();
      let writes=0;
      Object.entries(totals).forEach(([id,t])=>{
        batch.set(db.collection('matches').doc(m.id).collection('publicResults').doc(id),t);
        writes++;
      });
      resultSnap.docs.forEach(d=>{
        if(!totals[d.id]){ batch.delete(d.ref); writes++; }
      });
      if(writes) await batch.commit();
    }
  }catch(e){ console.error('Sincronizzazione risultati pubblici:',e); }
}

async function calculateRanking(){
  // Per l'Admin riallineiamo sempre gli aggregati pubblici ai voti reali
  // prima di leggere la classifica. In questo modo eventuali cancellazioni
  // manuali di documenti /votes non possono lasciare risultati fantasma.
  if(isAdmin()) await syncPublicResultsForAdmin();
  const map=Object.fromEntries(players.map(p=>[p.id,{...p,points:0,votes:0,first:0,second:0,third:0}]));
  if(!currentMatch) return [];
  const activeTab=document.querySelector('.tab.active')?.dataset.tab || 'day';

  // Le classifiche sono pubbliche per Player e Admin. I Player leggono
  // esclusivamente gli aggregati pubblici, mai i documenti /votes/{uid}.
  if(activeTab==='day'){
    const snap=await db.collection('matches').doc(currentMatch.id).collection('publicResults').get();
    snap.forEach(doc=>{
      if(!map[doc.id]) return;
      const d=doc.data()||{};
      map[doc.id].points=Number(d.points||0);
      map[doc.id].votes=Number(d.votes||0);
      map[doc.id].first=Number(d.first||0);
      map[doc.id].second=Number(d.second||0);
      map[doc.id].third=Number(d.third||0);
    });
    return Object.values(map)
      .filter(p=>lineup.includes(p.id))
      .sort((a,b)=>b.points-a.points||b.first-a.first||b.second-a.second||playerName(a).localeCompare(playerName(b),'it'));
  }

  // Classifica generale: tutti i giocatori della rosa devono comparire,
  // compresi quelli che non sono mai entrati in distinta. I risultati
  // pubblici di ogni partita vengono sommati senza esporre i singoli voti.
  const results=await Promise.all(matches.map(async m=>{
    const snap=await db.collection('matches').doc(m.id).collection('publicResults').get();
    return snap.docs.map(d=>({id:d.id,...(d.data()||{})}));
  }));
  results.flat().forEach(d=>{
    if(!map[d.id]) return;
    map[d.id].points+=Number(d.points||0);
    map[d.id].votes+=Number(d.votes||0);
    map[d.id].first+=Number(d.first||0);
    map[d.id].second+=Number(d.second||0);
    map[d.id].third+=Number(d.third||0);
  });
  return Object.values(map)
    .sort((a,b)=>b.points-a.points||b.first-a.first||b.second-a.second||playerName(a).localeCompare(playerName(b),'it'));
}
async function recalculatePublicResults(){
  if(!isAdmin()) return;
  const btn=$('#recalculateResultsBtn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Ricalcolo in corso...'; }
  try{
    await syncPublicResultsForAdmin();
    await renderRanking();
    alert('✅ Classifiche riallineate ai voti presenti in Firebase.');
  }catch(e){
    console.error('Ricalcolo classifiche:',e);
    alert('❌ Impossibile ricalcolare le classifiche.');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='🔄 Ricalcola classifiche'; }
  }
}
$('#recalculateResultsBtn')?.addEventListener('click',recalculatePublicResults);

async function renderRanking(){
  const rows=await calculateRanking();
  const activeTab=document.querySelector('.tab.active')?.dataset.tab || 'day';
  const title=activeTab==='season' ? 'Classifica generale' : `Classifica G${escapeHtml(currentMatch?.giornata||currentMatch?.day||'')}`;
  const html=rows.map((p,i)=>`<div class="rank"><span class="pos">${i<3?['🥇','🥈','🥉'][i]:i+1}</span><div><b>${escapeHtml(playerName(p))}</b><span class="sub">${p.first}× 1° · ${p.second}× 2° · ${p.third}× 3°</span></div><span class="points">${p.points} pt</span></div>`).join('');
  $('#rankingTable').innerHTML=`<div class="sub" style="margin-bottom:14px">${title}</div>`+(html||'<p class="muted">Nessun risultato.</p>');
}
function renderPlayers(){
  $('#playersTable').innerHTML=players.map(p=>`<div class="rank"><span class="pos">⚽</span><div><b>${escapeHtml(playerName(p))}</b><span class="sub">${lineup.includes(p.id)?'In distinta':'Fuori distinta'}</span></div></div>`).join('')||'<p class="muted">Nessun giocatore.</p>';
  renderSeasonStats();
}
function updateProgress(){
  if(!currentMatch)return; const total=lineup.length;
  if(!isAdmin()){ $('#voteProgress').style.width='0%'; $('#voteCount').textContent=`${total} giocatori in distinta`; return; }
  db.collection('matches').doc(currentMatch.id).collection('votes').get().then(s=>{const voted=s.size;$('#voteProgress').style.width=(total?Math.min(100,voted/total*100):0)+'%';$('#voteCount').textContent=`${voted} / ${total} giocatori hanno votato`;}).catch(console.error);
}

// ---------- Registrazioni e rosa Admin ----------
async function loadPendingRegistrations(){
  const box=$('#pendingRegistrations'); if(!box||!isAdmin()) return;
  try{
    const snap=await db.collection('users').where('leagueId','==',leagueId()).get();
    const pending=snap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.role==='player' && u.active===false && u.registrationStatus==='pending');
    if(!pending.length){box.innerHTML='<p class="muted">Nessuna registrazione in attesa.</p>';return;}
    box.innerHTML=pending.map(u=>`<div class="rank pending-user"><span class="pos">👤</span><div><b>${escapeHtml([u.nome,u.cognome].filter(Boolean).join(' ')||'Nome non indicato')}</b><span class="sub">${escapeHtml(u.email||'Email non disponibile')}</span></div><button class="primary small-action" data-associate-user="${escapeHtml(u.id)}">Associa</button></div>`).join('');
    box.querySelectorAll('[data-associate-user]').forEach(btn=>btn.addEventListener('click',()=>associateRegistration(btn.dataset.associateUser)));
  }catch(e){console.error('Registrazioni in attesa:',e);box.innerHTML='<p class="muted">Impossibile caricare le registrazioni.</p>';}
}
async function associateRegistration(userId){
  if(!isAdmin()) return;
  const userSnap=await db.collection('users').doc(userId).get();
  if(!userSnap.exists){alert('Registrazione non trovata.');return;}
  const u=userSnap.data()||{};
  const available=players.filter(p=>!p.userId && !p.associatedUid);
  if(!available.length){alert('Nessun giocatore libero nella rosa. Aggiungi prima il giocatore.');return;}
  const labels=available.map((p,i)=>`${i+1}. ${playerName(p)}`).join('\n');
  const answer=prompt(`Associa ${[u.nome,u.cognome].filter(Boolean).join(' ')} (${u.email||'email non disponibile'}) a quale giocatore?\n\n${labels}\n\nInserisci il numero:`);
  if(answer===null)return;
  const idx=Number(answer)-1;
  if(!Number.isInteger(idx)||idx<0||idx>=available.length){alert('Scelta non valida.');return;}
  const p=available[idx];
  if(!confirm(`Confermi l'associazione di ${u.email||'questa utenza'} a ${playerName(p)}?`)) return;
  try{
    const batch=db.batch();
    batch.update(db.collection('users').doc(userId),{playerId:p.id,active:true,registrationStatus:'approved',associatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    batch.update(db.collection('players').doc(p.id),{userId:userId});
    await batch.commit();
    await refresh();
    alert(`✅ Utenza associata a ${playerName(p)}.`);
  }catch(e){console.error('Associazione:',e);alert('❌ Impossibile completare l’associazione.');}
}
async function addPlayerFromAdmin(e){
  e.preventDefault(); if(!isAdmin())return;
  const nome=$('#addPlayerNome').value.trim(), cognome=$('#addPlayerCognome').value.trim();
  if(!nome||!cognome)return;
  try{
    await db.collection('players').add({nome,cognome,displayName:`${nome} ${cognome}`.trim(),leagueId:leagueId(),active:true,userId:null,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    $('#addPlayerForm').reset(); await refresh(); alert(`✅ ${nome} ${cognome} aggiunto alla rosa.`);
  }catch(e){console.error('Aggiunta giocatore:',e);alert('❌ Impossibile aggiungere il giocatore.');}
}
function renderAdminPlayers(){
  const box=$('#adminPlayersList'); if(!box||!isAdmin())return;
  box.innerHTML=players.map(p=>`<div class="rank"><span class="pos">⚽</span><div><b>${escapeHtml(playerName(p))}</b><span class="sub">${p.userId?'🟢 Account associato':'🟠 Nessun account associato'}</span></div></div>`).join('')||'<p class="muted">Nessun giocatore.</p>';
}

document.querySelector('#addPlayerForm')?.addEventListener('submit',addPlayerFromAdmin);

// ---------- Calendario Admin ----------
function renderCalendar(){
  const box=$('#calendarList'); if(!box) return;
  if(!isAdmin()){box.innerHTML='<p class="muted">Solo gli Admin possono gestire il calendario.</p>';return;}
  const grouped={Andata:[],Ritorno:[]};
  matches.forEach(m=>{const phase=String(m.fase||'').toLowerCase()==='ritorno'?'Ritorno':'Andata';grouped[phase].push(m);});
  const section=(name,arr)=>`<div class="calendar-group"><h3>${name}</h3>${arr.sort((a,b)=>(Number(a.giornata||a.day)||0)-(Number(b.giornata||b.day)||0)).map(m=>{
    const d=parseDateTime(m), title=`${m.homeTeam||leagueTeam()} vs ${m.awayTeam||m.opponent||''}`;
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
  const scheduledStart=buildScheduledStart(date,time), selectedStatus=$('#matchEditStatus').value, data={giornata:String($('#matchEditRound').value).trim(),day:String($('#matchEditRound').value).trim(),fase:$('#matchEditPhase').value,homeTeam:home,awayTeam:away,opponent:leagueTeam()===home?away:home,isHome:isLocalTeamName(home),scheduledStart:firebase.firestore.Timestamp.fromDate(scheduledStart),date:formatDate(scheduledStart),time:time,status:selectedStatus};
  if(selectedStatus==='finished') data.finishedAt=firebase.firestore.FieldValue.serverTimestamp();
  else if(id) data.finishedAt=firebase.firestore.FieldValue.delete();
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

$('#calendarList')?.addEventListener('click',e=>{
  const statsBtn=e.target.closest('.stats-match');
  if(statsBtn&&isAdmin()){ const m=matches.find(x=>x.id===statsBtn.dataset.id); if(m){ currentMatch=m; lineup=Array.isArray(m.lineup)?[...m.lineup]:[]; renderMatch(); show('match'); } return; }
  const b=e.target.closest('.edit-match'); if(b){const m=matches.find(x=>x.id===b.dataset.id);openMatchEditor(m);}
});
$('#saveMatchStatsBtn')?.addEventListener('click',saveMatchStats);
$('#newMatchBtn')?.addEventListener('click',()=>openMatchEditor());
$('#cancelMatchEdit')?.addEventListener('click',closeMatchEditor); $('#closeMatchModal')?.addEventListener('click',closeMatchEditor);
$('#matchEditForm')?.addEventListener('submit',saveMatchEditor);
$('#excelInput')?.addEventListener('change',e=>handleExcel(e.target.files?.[0]));
$('#importCommit')?.addEventListener('click',commitImport);
$('#importCancel')?.addEventListener('click',()=>{$('#importPreviewCard').classList.add('hidden');calendarDraft=[];$('#excelInput').value='';});

function show(id){
  if(id==='admin'&&!isAdmin())return; if(id==='calendar'&&!isAdmin())return;
  $$('.screen').forEach(x=>x.classList.remove('active')); $('#'+id)?.classList.add('active');
  if(id==='ranking')renderRanking(); if(id==='players')renderPlayers(); if(id==='match')renderMatch(); if(id==='calendar')renderCalendar(); if(id==='dashboard')renderDashboard();
}
$$('[data-screen]').forEach(b=>b.onclick=()=>show(b.dataset.screen));
$('#dashboardMatchCard')?.addEventListener('click',()=>{ if(currentMatch) show('match'); });
$('#dashboardMatchCard')?.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&currentMatch){e.preventDefault();show('match');} });
$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');renderRanking();});
let voteTimer=null;
function startVoteTimer(){ if(voteTimer) clearInterval(voteTimer); voteTimer=setInterval(()=>{ if(currentMatch){ renderDashboard(); renderMatch(); } },1000); }
async function bootApp(){if(!window.currentUserData)return;await loadLeague();await refresh();startVoteTimer();console.log('Best&Faires Beta.19: tabellini partita e statistiche stagione.');}
window.applyRolePermissions=async userData=>{window.currentUserData=userData;document.querySelectorAll('.admin-only').forEach(b=>b.classList.toggle('hidden',userData?.role!=='admin'));await bootApp();};
