/* Best&Faires Beta.7.16 - Ricalcolo sicuro delle classifiche */

let players = [];
let matches = [];
let currentMatch = null;
let lineup = [];
let localVoted = false;
let calendarDraft = [];
let currentMatchStats = {};
let currentMatchSummary = {};
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
function votingDeadlineDate(m=currentMatch){ const end=matchEndDate(m); return end ? new Date(end.getTime()+6*60*60*1000) : null; }
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
  if(isPlayer()){
    const meId=window.currentUserData?.playerId;
    const activeNow=matches.filter(m=>{
      const d=parseDateTime(m);
      const eligible=!!meId && Array.isArray(m.lineup) && m.lineup.includes(meId);
      const blocked=['cancelled','postponed'].includes(String(m.status||''));
      return !!d && Date.now()>=d.getTime() && eligible && !blocked && votingWindowOpen(m);
    });
    activeNow.sort((a,b)=>{
      const rank=s=>s==='voting_open'?0:(s==='in_progress'?1:(s==='finished'?0:2));
      return rank(a.status)-rank(b.status) || (parseDateTime(b)?.getTime()||0)-(parseDateTime(a)?.getTime()||0);
    });
    const future=matches.filter(m=>{
      const d=parseDateTime(m);
      return !!d && d.getTime()>Date.now() && !['finished','cancelled','postponed'].includes(String(m.status||''));
    });
    currentMatch=activeNow[0] || future[0] || null;
  }else{
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
  if(eyebrow) eyebrow.textContent=started ? (String(currentMatch.status||'')==='finished' ? 'VOTAZIONE POST-PARTITA' : 'PARTITA IN CORSO') : 'PROSSIMA PARTITA';
  const meInLineup=isPlayer() && currentPlayerInLineup();
  let label='PROGRAMMATA'; let cls='pill';
  if(started && meInLineup && votingWindowOpen(currentMatch)) { label='VOTA ORA'; cls='pill open'; }
  else if(started && meInLineup && !votingWindowOpen(currentMatch)) { label='VOTO SCADUTO'; cls='pill closed'; }
  else if(started && meInLineup) { label='IN CORSO'; cls='pill'; }
  else if(started) { label='IN CORSO'; cls='pill'; }
  else { label='PROSSIMA'; cls='pill'; }
  if(state){state.textContent=label;state.className=cls;}
  const dashboardCard=$('#dashboardMatchCard');
  if(dashboardCard){ dashboardCard.classList.toggle('is-clickable',!!currentMatch); dashboardCard.setAttribute('aria-disabled',currentMatch?'false':'true'); }
  if(progress){ const n=Array.isArray(currentMatch.lineup)?currentMatch.lineup.length:0; progress.textContent=(isPlayer()&&votingWindowOpen(currentMatch))?`Voto disponibile ancora per ${formatCountdown(votingRemainingMs(currentMatch))}`:(started?`${n} giocatori in distinta`:`Distinta disponibile prima dell'inizio della partita`); }
}
async function loadLeague(){
  const snap=await db.collection('leagues').doc(leagueId()).get();
  window.currentLeagueData=snap.exists?snap.data():{};
}
async function refresh(){
  try{
    await loadLeague(); await loadPlayers(); await loadMatches();
    renderLeague(); renderDashboard(); renderMatch(); renderPlayers(); renderCalendar(); await renderAdminPlayers(); await loadPendingRegistrations();
    await syncPublicResultsForAdmin();
    await renderRanking(); await loadOwnVoteState(); renderMatch();
  }catch(e){ console.error(e); const msg=$('#voteMsg'); if(msg) msg.textContent='❌ Errore nel caricamento dei dati da Firebase.'; }
}
function renderLeague(){
  if(!window.currentLeagueData) return;
  $('#leagueName').textContent=window.currentLeagueData.name||leagueTeam()||'Best&Faires';
  $('#seasonName').textContent=`Stagione ${window.currentLeagueData.season||''}`;
}

async function loadMatchSummary(matchId=currentMatch?.id){
  currentMatchSummary={};
  if(!matchId) return;
  try{
    const snap=await db.collection('matches').doc(matchId).collection('summary').doc('main').get();
    currentMatchSummary=snap.exists?({id:snap.id,...(snap.data()||{})}):{};
  }catch(e){ console.error('Caricamento riepilogo partita:',e); }
}
function matchScoreText(m, summary){
  const home=m?.homeTeam||leagueTeam(), away=m?.awayTeam||m?.opponent||'Avversario';
  const has=Number.isInteger(Number(summary?.homeScore)) && Number.isInteger(Number(summary?.awayScore));
  return has ? `${escapeHtml(home)} <b>${Number(summary.homeScore)} - ${Number(summary.awayScore)}</b> ${escapeHtml(away)}` : `${escapeHtml(home)} <b>–</b> ${escapeHtml(away)}`;
}
async function loadPublicMatchResults(matchId){
  const totals={};
  try{ const snap=await db.collection('matches').doc(matchId).collection('publicResults').get(); snap.forEach(d=>{totals[d.id]={id:d.id,...(d.data()||{})};}); }catch(e){ console.error('Risultati pubblici partita:',e); }
  return totals;
}

// ... existing code omitted intentionally ...
