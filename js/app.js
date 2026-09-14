/* Best&Faires Beta.6 - Firestore application layer */

let players = [];
let matches = [];
let currentMatch = null;
let lineup = [];
let localVoted = false;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function isAdmin(){ return window.currentUserData?.role === 'admin'; }
function isPlayer(){ return window.currentUserData?.role === 'player'; }
function uid(){ return firebase.auth().currentUser?.uid || ''; }
function leagueId(){ return window.currentUserData?.leagueId || 'demo'; }

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function playerName(p){ return p.displayName || [p.nome,p.cognome].filter(Boolean).join(' ') || 'Giocatore'; }

function parseDateTime(match){
  if (match.scheduledStart?.toDate) return match.scheduledStart.toDate();
  if (match.date && match.time) {
    const parts = String(match.date).split('/');
    if (parts.length === 3) {
      const iso = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T${String(match.time).padStart(5,'0')}:00+02:00`;
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function matchHasStarted(){
  const d = currentMatch && parseDateTime(currentMatch);
  return !!d && Date.now() >= d.getTime();
}

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

function currentPlayerInLineup(){
  const p = currentPlayer();
  return !!p && lineup.includes(p.id);
}

async function loadPlayers(){
  const snap = await db.collection('players').where('leagueId','==',leagueId()).get();
  players = snap.docs.map(d => ({id:d.id, ...d.data()})).filter(p => p.active !== false);
  players.sort((a,b) => playerName(a).localeCompare(playerName(b),'it'));
}

async function loadMatches(){
  const snap = await db.collection('matches').where('leagueId','==',leagueId()).get();
  matches = snap.docs.map(d => ({id:d.id, ...d.data()}));
  matches.sort((a,b) => (parseDateTime(a)?.getTime() || 0) - (parseDateTime(b)?.getTime() || 0));
  currentMatch = matches.find(m => m.status === 'voting_open') || matches.find(m => parseDateTime(m) >= new Date()) || matches[0] || null;
  if (currentMatch) lineup = Array.isArray(currentMatch.lineup) ? [...currentMatch.lineup] : [];
}

async function refresh(){
  try {
    await loadPlayers();
    await loadMatches();
    renderLeague();
    renderMatch();
    renderPlayers();
    await renderRanking();
    await loadOwnVoteState();
    renderMatch();
  } catch (e) {
    console.error(e);
    const msg = $('#voteMsg');
    if (msg) msg.textContent = '❌ Errore nel caricamento dei dati da Firebase.';
  }
}

function renderLeague(){
  const leagueName = $('#leagueName');
  const seasonName = $('#seasonName');
  if (!leagueName || !window.currentLeagueData) return;
  leagueName.textContent = window.currentLeagueData.name || window.currentLeagueData.teamName || 'Best&Faires';
  seasonName.textContent = `Stagione ${window.currentLeagueData.season || ''}`;
}

async function loadLeague(){
  const snap = await db.collection('leagues').doc(leagueId()).get();
  window.currentLeagueData = snap.exists ? snap.data() : {};
}

function formatMatch(m){
  if (!m) return 'Nessuna partita';
  const home = m.homeTeam || window.currentLeagueData?.teamName || '';
  const away = m.opponent || m.awayTeam || '';
  const d = parseDateTime(m);
  const dt = d ? d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  return `${home} vs ${away}${dt ? ` · ${dt}` : ''}`;
}

function renderMatch(){
  if (!currentMatch) {
    $('#matchTitle').textContent = 'Nessuna partita caricata';
    $('#rosterList').innerHTML = '<p class="muted">L’Admin deve inserire una partita nel calendario.</p>';
    $('#votingCard')?.classList.add('hidden');
    return;
  }

  const team = currentMatch.homeTeam || window.currentLeagueData?.teamName || 'Squadra';
  const title = `${team} vs ${currentMatch.opponent || currentMatch.awayTeam || 'Avversario'}`;
  $('#matchTitle').textContent = title;
  const matchHead = $('#match h2'); if (matchHead) matchHead.textContent = title;
  const meta = $('#match .match-meta');
  const d = parseDateTime(currentMatch);
  if (meta) meta.innerHTML = `<span>Giornata ${escapeHtml(currentMatch.day || currentMatch.giornata || '')}</span><span>${d ? d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}</span>`;
  const distTitle = $('#match h3'); if (distTitle) distTitle.textContent = `Distinta ${escapeHtml(team)}`;

  const box = $('#rosterList');
  if (!box) return;
  const locked = isLineupLocked();
  const me = currentPlayer();
  box.innerHTML = players.map(p => {
    const checked = lineup.includes(p.id);
    const mine = me?.id === p.id;
    return `<label class="check ${locked || !isAdmin() ? 'locked' : ''}">
      <input type="checkbox" data-player="${escapeHtml(p.id)}" ${checked?'checked':''} ${(locked || !isAdmin())?'disabled':''}>
      <span>${escapeHtml(playerName(p))}</span>${mine?'<small class="sub">Tu</small>':''}
    </label>`;
  }).join('');

  const lockBtn = $('#lockBtn');
  if (isAdmin()) {
    lockBtn.style.display = '';
    if (matchHasStarted()) {
      lockBtn.textContent = currentMatch.adminOverrideOpen ? '🔒 Chiudi modifica eccezionale' : '🔓 Sblocca distinta (eccezione Admin)';
    } else {
      lockBtn.textContent = currentMatch.lineupLocked ? '🔓 Sblocca distinta' : '🔒 Blocca distinta';
    }
  } else lockBtn.style.display = 'none';

  const status = $('#matchLockStatus');
  if (status) {
    status.textContent = matchHasStarted()
      ? (currentMatch.adminOverrideOpen ? '⚠️ Sblocco eccezionale Admin attivo.' : '🔒 Distinta bloccata automaticamente all’inizio della partita.')
      : '🕒 Distinta modificabile fino all’inizio della partita.';
  }

  const canVote = isPlayer() && locked && currentPlayerInLineup();
  if (canVote) { $('#votingCard').classList.remove('hidden'); populateVotes(); }
  else $('#votingCard').classList.add('hidden');

  updateProgress();
}

$('#rosterList')?.addEventListener('change', async e => {
  if (!isAdmin() || !e.target.matches('input') || isLineupLocked()) return;
  const id = e.target.dataset.player;
  if (e.target.checked && !lineup.includes(id)) lineup.push(id);
  if (!e.target.checked) lineup = lineup.filter(x => x !== id);
  try {
    await db.collection('matches').doc(currentMatch.id).update({lineup});
    currentMatch.lineup = [...lineup];
    renderMatch();
  } catch (err) { console.error(err); alert('Impossibile aggiornare la distinta.'); }
});

$('#lockBtn')?.addEventListener('click', async () => {
  if (!isAdmin() || !currentMatch) return;
  const next = matchHasStarted() ? !currentMatch.adminOverrideOpen : !currentMatch.lineupLocked;
  const data = matchHasStarted() ? {adminOverrideOpen: next} : {lineupLocked: next};
  try {
    await db.collection('matches').doc(currentMatch.id).update(data);
    Object.assign(currentMatch,data);
    renderMatch();
  } catch (e) { console.error(e); alert('Firebase ha rifiutato la modifica della distinta.'); }
});

async function loadOwnVoteState(){
  localVoted = false;
  if (!isPlayer() || !currentMatch) return;
  try {
    const snap = await db.collection('matches').doc(currentMatch.id).collection('votes').doc(uid()).get();
    localVoted = snap.exists;
  } catch(e) { console.error(e); }
}

function populateVotes(){
  const me = currentPlayer();
  const eligible = players.filter(p => lineup.includes(p.id) && p.id !== me?.id);
  [1,2,3].forEach(n => {
    const s = $('#vote'+n);
    s.innerHTML = '<option value="">Seleziona...</option>' + eligible.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(playerName(p))}</option>`).join('');
    s.disabled = localVoted;
  });
  $('#submitVote').disabled = localVoted;
  $('#voteMsg').textContent = localVoted ? '✅ Voto già registrato per questo account.' : '';
}

$('#submitVote')?.addEventListener('click', async () => {
  if (!isPlayer() || !currentMatch || !isLineupLocked() || !currentPlayerInLineup()) return;
  if (localVoted) return alert('Hai già espresso il tuo voto per questa partita.');
  const ranking = [1,2,3].map(n => $('#vote'+n).value);
  const me = currentPlayer();
  if (ranking.some(x => !x) || new Set(ranking).size !== 3) return alert('Seleziona tre giocatori diversi.');
  if (ranking.some(x => !lineup.includes(x))) return alert('Puoi votare solo giocatori presenti in distinta.');
  if (ranking.includes(me?.id)) return alert('Non puoi votare te stesso.');
  try {
    await db.collection('matches').doc(currentMatch.id).collection('votes').doc(uid()).create({ranking});
    localVoted = true;
    renderMatch();
    alert('✅ Voto registrato. Grazie!');
  } catch(e) {
    console.error(e);
    alert(e.code === 'permission-denied' ? '❌ Voto rifiutato dalle regole di sicurezza.' : '❌ Impossibile registrare il voto.');
  }
});

async function calculateRanking(){
  const map = Object.fromEntries(players.map(p => [p.id,{...p,points:0,votes:0,first:0,second:0,third:0}]));
  if (!currentMatch) return [];
  if (!isAdmin()) return Object.values(map).filter(p => lineup.includes(p.id));
  const snap = await db.collection('matches').doc(currentMatch.id).collection('votes').get();
  snap.forEach(doc => {
    const ranking = doc.data().ranking || [];
    ranking.forEach((id,i) => {
      if (!map[id]) return;
      map[id].points += 3-i;
      map[id].votes++;
      map[id][['first','second','third'][i]]++;
    });
  });
  return Object.values(map).filter(p => lineup.includes(p.id)).sort((a,b) => b.points-a.points || b.first-a.first || b.second-a.second || playerName(a).localeCompare(playerName(b),'it'));
}

async function renderRanking(){
  const rows = await calculateRanking();
  $('#rankingTable').innerHTML = rows.map((p,i) => `<div class="rank"><span class="pos">${i<3?['🥇','🥈','🥉'][i]:i+1}</span><div><b>${escapeHtml(playerName(p))}</b><span class="sub">${p.first}× 1° · ${p.second}× 2° · ${p.third}× 3°</span></div><span class="points">${p.points} pt</span></div>`).join('') || '<p class="muted">Nessun risultato.</p>';
}

function renderPlayers(){
  $('#playersTable').innerHTML = players.map(p => `<div class="rank"><span class="pos">⚽</span><div><b>${escapeHtml(playerName(p))}</b><span class="sub">${lineup.includes(p.id)?'In distinta':'Fuori distinta'}</span></div></div>`).join('') || '<p class="muted">Nessun giocatore.</p>';
}

function updateProgress(){
  if (!currentMatch) return;
  const total = lineup.length;
  if (!isAdmin()) { $('#voteProgress').style.width = '0%'; $('#voteCount').textContent = `${total} giocatori in distinta`; return; }
  db.collection('matches').doc(currentMatch.id).collection('votes').get().then(s => {
    const voted = s.size;
    $('#voteProgress').style.width = (total ? Math.min(100,voted/total*100) : 0) + '%';
    $('#voteCount').textContent = `${voted} / ${total} giocatori hanno votato`;
  }).catch(console.error);
}

function show(id){
  if (id==='admin' && !isAdmin()) return;
  $$('.screen').forEach(x => x.classList.remove('active'));
  $('#'+id)?.classList.add('active');
  if(id==='ranking') renderRanking();
  if(id==='players') renderPlayers();
  if(id==='match') renderMatch();
}
$$('[data-screen]').forEach(b => b.onclick = () => show(b.dataset.screen));
$$('.tab').forEach(t => t.onclick = () => { $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); renderRanking(); });

async function bootApp(){
  if (!window.currentUserData) return;
  await loadLeague();
  await refresh();
  console.log('Best&Faires Beta.6: Firestore applicativo caricato.');
}
window.applyRolePermissions = async userData => {
  window.currentUserData = userData;
  const adminButton = document.querySelector('[data-screen="admin"]');
  if (adminButton) adminButton.style.display = userData?.role === 'admin' ? '' : 'none';
  await bootApp();
};
