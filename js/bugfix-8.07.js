/* Best&Fairest A-08.07 emergency bug fix
 * Fixes: pending league registrations + player voting eligibility.
 */
(function(){
  'use strict';

  function league(){ return typeof leagueId==='function' ? leagueId() : (window.currentUserData?.leagueId || 'demo'); }
  function isAdminRole(){ return typeof isAdmin==='function' && isAdmin(); }
  function isPlayerRole(){ return typeof isPlayer==='function' && isPlayer(); }
  function activeMatch(){ return window.currentMatch || null; }

  window.bfFixLoadPendingRegistrations = async function(){
    const box=document.querySelector('#pendingRegistrations');
    if(!box || !isAdminRole() || typeof db==='undefined') return;
    try{
      const snap=await db.collection('users').where('leagueId','==',league()).get();
      const pending=snap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(u=>u.role==='player' && (u.registrationStatus==='pending' || u.playerId==null || u.active!==true));
      if(!pending.length){ box.innerHTML='<p class="muted">Nessuna registrazione in attesa.</p>'; return; }
      box.innerHTML=pending.map(u=>{
        const name=[u.nome,u.cognome].filter(Boolean).join(' ')||'Nome non indicato';
        const parts=name.trim().split(/\s+/).filter(Boolean);
        const initials=((parts[0]?.[0]||'')+(parts.length>1?(parts[parts.length-1]?.[0]||''):'')).toUpperCase();
        return `<div class="admin-user-row pending-user"><span class="admin-avatar">${escapeHtml(initials)}</span><div class="admin-user-main"><b>${escapeHtml(name)}</b><span class="sub">${escapeHtml(u.email||'Email non disponibile')}</span></div><button class="primary small-action" data-associate-user="${escapeHtml(u.id)}">Associa</button></div>`;
      }).join('');
      box.querySelectorAll('[data-associate-user]').forEach(btn=>btn.addEventListener('click',()=>associateRegistration(btn.dataset.associateUser)));
    }catch(e){ console.error('BF Fix registrazioni in attesa:',e); box.innerHTML='<p class="muted">Impossibile caricare le registrazioni.</p>'; }
  };

  let loadedKey=null;
  let loadingPromise=null;
  async function ensureVotingStats(){
    const m=activeMatch();
    if(!isPlayerRole() || !m || typeof votingWindowOpen!=='function' || !votingWindowOpen(m)) return;
    if(typeof currentPlayerInLineup!=='function' || !currentPlayerInLineup()) return;
    const ids=Array.isArray(m.lineup)?m.lineup.map(String):[];
    const key=`${m.id}|${ids.join(',')}`;
    if(loadedKey===key) return;
    if(loadingPromise) return loadingPromise;
    loadingPromise=(async()=>{
      try{
        const next={};
        const refs=ids.map(id=>db.collection('matches').doc(m.id).collection('stats').doc(id));
        const snaps=await Promise.all(refs.map(ref=>ref.get()));
        snaps.forEach((snap,i)=>{ if(snap.exists) next[ids[i]]={id:ids[i],...(snap.data()||{})}; });
        window.currentMatchStats=next;
        loadedKey=key;
        if(typeof populateVotes==='function') await populateVotes();
      }catch(e){ console.error('BF Fix caricamento statistiche votazione:',e); }
      finally{ loadingPromise=null; }
    })();
    return loadingPromise;
  }

  window.bfFixRefreshVoting=async function(){ if(isPlayerRole()) await ensureVotingStats(); };

  function resetIfMatchChanged(){
    const m=activeMatch();
    const key=m ? `${m.id}|${(m.lineup||[]).join(',')}` : '';
    if(key && loadedKey && key!==loadedKey) loadedKey=null;
    if(!key) loadedKey=null;
  }

  setTimeout(()=>{ if(isAdminRole()) window.bfFixLoadPendingRegistrations(); },700);

  setInterval(async()=>{
    try{
      resetIfMatchChanged();
      if(isAdminRole()) await window.bfFixLoadPendingRegistrations();
      const card=document.querySelector('#votingCard');
      if(card && !card.classList.contains('hidden')) await ensureVotingStats();
    }catch(e){ console.error('BF Fix periodic refresh:',e); }
  },1500);
})();
