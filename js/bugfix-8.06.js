/* Best&Fairest 8.06 - HOTFIX CRITICO */
(function(){
  'use strict';

  const asId=v=>String(v??'');
  const isPresent=st=>!!st&&(Number(st.appearance)===1||st.appearance===true);

  async function loadStatsDirect(matchId){
    if(!matchId) return 0;
    try{
      const matchSnap=await db.collection('matches').doc(matchId).get();
      if(!matchSnap.exists) return 0;
      const m=matchSnap.data()||{};
      const ids=Array.isArray(m.lineup)?[...new Set(m.lineup.map(asId).filter(Boolean))]:[];
      currentMatchStats={};
      if(!ids.length) return 0;
      const snaps=await Promise.all(ids.map(id=>db.collection('matches').doc(matchId).collection('stats').doc(id).get()));
      snaps.forEach((s,i)=>{if(s.exists) currentMatchStats[ids[i]]={id:ids[i],...(s.data()||{})};});
      const present=Object.values(currentMatchStats).filter(isPresent).length;
      console.info('[BF 8.06] TABELLINO:',{matchId,lineup:ids.length,stats:Object.keys(currentMatchStats).length,present});
      return present;
    }catch(e){console.error('[BF 8.06] load stats:',e);return 0;}
  }

  function rebuildVotingCard(){
    if(!currentMatch||!isPlayer()||!votingWindowOpen(currentMatch)||!currentPlayerInLineup()) return;
    const me=currentPlayer();
    const eligible=players.filter(p=>
      lineup.some(id=>asId(id)===asId(p.id)) &&
      isPresent(currentMatchStats?.[p.id]) &&
      asId(p.id)!==asId(me?.id)
    );
    [1,2,3].forEach(n=>{
      const s=$('#vote'+n); if(!s)return;
      const old=s.value;
      s.innerHTML='<option value="">Seleziona...</option>'+eligible.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(playerName(p))}</option>`).join('');
      if(eligible.some(p=>asId(p.id)===asId(old))) s.value=old;
      else if(localVoted&&localVoteMatchId===currentMatch.id&&localVoteRanking[n-1]&&eligible.some(p=>asId(p.id)===asId(localVoteRanking[n-1]))) s.value=localVoteRanking[n-1];
      s.disabled=localVoted;
    });
    $('#submitVote').disabled=localVoted||eligible.length<3;
    const msg=$('#voteMsg');
    if(msg) msg.textContent=localVoted?'✅ Voto già registrato per questo account.':eligible.length<3?'⚠️ Servono almeno 3 giocatori con Presenza registrata per poter votare.':'';
    $('#votingCard')?.classList.remove('hidden');
    console.info('[BF 8.06] VOTAZIONE:',{matchId:currentMatch.id,lineup:lineup.length,present:Object.values(currentMatchStats||{}).filter(isPresent).length,eligible:eligible.map(p=>playerName(p))});
  }

  async function loadPendingDirect(){
    const box=$('#pendingRegistrations'); if(!box||!isAdmin())return;
    const lid=String(leagueId()||'').trim();
    if(!lid)return;
    try{
      const snap=await db.collection('users').where('leagueId','==',lid).get();
      const pending=snap.docs.map(d=>({id:d.id,...(d.data()||{})})).filter(u=>u.role==='player'&&u.active!==true&&(u.registrationStatus==='pending'||!u.playerId));
      if(!pending.length){box.innerHTML='<p class="muted">Nessuna registrazione in attesa.</p>';return;}
      box.innerHTML=pending.map(u=>{
        const name=[u.nome,u.cognome].filter(Boolean).join(' ')||u.displayName||'Nome non indicato';
        const parts=name.trim().split(/\s+/).filter(Boolean);
        const initials=((parts[0]?.[0]||'')+(parts.length>1?(parts.at(-1)?.[0]||''):'')).toUpperCase();
        return `<div class="admin-user-row pending-user"><span class="admin-avatar">${escapeHtml(initials)}</span><div class="admin-user-main"><b>${escapeHtml(name)}</b><span class="sub">${escapeHtml(u.email||'Email non disponibile')}</span></div><button class="primary small-action" data-associate-user="${escapeHtml(u.id)}">Associa</button></div>`;
      }).join('');
      box.querySelectorAll('[data-associate-user]').forEach(btn=>btn.addEventListener('click',()=>associateRegistration(btn.dataset.associateUser)));
      console.info('[BF 8.06] PENDING:',{leagueId:lid,count:pending.length,ids:pending.map(u=>u.id)});
    }catch(e){console.error('[BF 8.06] load pending:',e);box.innerHTML='<p class="muted">Impossibile caricare le registrazioni.</p>';}
  }

  async function apply(){
    if(!window.currentUserData||!firebase.auth().currentUser)return;
    if(typeof waitForAuthReady==='function')await waitForAuthReady();
    if(typeof loadPendingDirect==='function'&&isAdmin())await loadPendingDirect();
    if(isPlayer()&&currentMatch){
      const n=await loadStatsDirect(currentMatch.id);
      if(n>=0){
        lineup=Array.isArray(currentMatch.lineup)?[...currentMatch.lineup]:[];
        rebuildVotingCard();
        if(typeof renderMatch==='function')renderMatch();
        rebuildVotingCard();
      }
    }
  }

  // Il file è caricato dopo app.js tramite firebase.js, quindi qui possiamo
  // lavorare direttamente sulle variabili globali lexicali dell'app.
  window.BF806={apply,loadStatsDirect,rebuildVotingCard,loadPendingDirect};
  window.addEventListener('load',()=>{
    let tries=0;
    const timer=setInterval(async()=>{
      tries++;
      if(window.currentUserData&&firebase.auth().currentUser){
        clearInterval(timer);
        await apply();
      }else if(tries>=40) clearInterval(timer);
    },500);
  });
})();
