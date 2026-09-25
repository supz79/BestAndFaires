/* Best&Fairest 8.06 - HOTFIX CRITICO
 *
 * Corregge due regressioni:
 * 1) i Player non venivano riconosciuti come presenti nel tabellino;
 * 2) alcune registrazioni Player pending non venivano mostrate all'Admin.
 *
 * Il fix viene caricato dopo app.js e sostituisce solo le funzioni coinvolte.
 */
(function(){
  'use strict';

  const asId = value => String(value ?? '');
  const isPresentStat = st => {
    if(!st) return false;
    return Number(st.appearance) === 1 || st.appearance === true;
  };

  async function fixedLoadMatchStats(matchId=currentMatch?.id){
    currentMatchStats = {};
    if(!matchId) return currentMatchStats;

    try{
      if(typeof waitForAuthReady === 'function') await waitForAuthReady();

      // FIX: non dipendere dal currentMatch globale durante una richiesta async.
      // Leggiamo la distinta direttamente dalla partita richiesta.
      let matchData = (currentMatch && currentMatch.id === matchId) ? currentMatch : null;
      if(!matchData){
        const matchSnap = await db.collection('matches').doc(matchId).get();
        if(!matchSnap.exists) return currentMatchStats;
        matchData = {id:matchSnap.id,...(matchSnap.data()||{})};
      }

      const ids = Array.isArray(matchData.lineup)
        ? [...new Set(matchData.lineup.map(asId).filter(Boolean))]
        : [];
      if(!ids.length) return currentMatchStats;

      // Leggiamo esattamente i documenti dei giocatori in distinta.
      // Questo evita qualsiasi dipendenza dall'ordine o dalla query della collection.
      const snaps = await Promise.all(ids.map(id =>
        db.collection('matches').doc(matchId).collection('stats').doc(id).get()
      ));

      snaps.forEach((snap,i)=>{
        if(snap.exists){
          currentMatchStats[ids[i]] = {id:ids[i],...(snap.data()||{})};
        }
      });

      console.info('[BF 8.06] stats caricati', {
        matchId,
        lineup: ids.length,
        stats: Object.keys(currentMatchStats).length,
        presenti: Object.values(currentMatchStats).filter(isPresentStat).length
      });
    }catch(error){
      console.error('[BF 8.06] errore caricamento stats:',error);
    }

    return currentMatchStats;
  }

  function fixedPlayerHasMatchPresence(playerId){
    const st = currentMatchStats?.[asId(playerId)];
    return isPresentStat(st);
  }

  function fixedPopulateVotes(){
    const me = currentPlayer();
    const eligible = players.filter(p =>
      lineup.some(id => asId(id) === asId(p.id)) &&
      fixedPlayerHasMatchPresence(p.id) &&
      asId(p.id) !== asId(me?.id)
    );

    const selected={};
    [1,2,3].forEach(n=>{
      const current=$('#vote'+n);
      if(current) selected[n]=current.value;
    });

    [1,2,3].forEach(n=>{
      const s=$('#vote'+n);
      if(!s) return;
      s.innerHTML='<option value="">Seleziona...</option>'+
        eligible.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(playerName(p))}</option>`).join('');
      const persisted=(localVoted && localVoteMatchId===currentMatch?.id)
        ? localVoteRanking[n-1]
        : '';
      const wanted=persisted || selected[n] || '';
      if(wanted && eligible.some(p=>asId(p.id)===asId(wanted))) s.value=wanted;
      s.disabled=localVoted;
    });

    $('#submitVote').disabled = localVoted || eligible.length < 3;
    if(localVoted){
      $('#voteMsg').textContent='✅ Voto già registrato per questo account.';
    }else if(eligible.length<3){
      $('#voteMsg').textContent='⚠️ Servono almeno 3 giocatori con Presenza registrata per poter votare.';
    }else{
      $('#voteMsg').textContent='';
    }

    console.info('[BF 8.06] candidati voto', {
      matchId:currentMatch?.id,
      lineup:lineup.length,
      presenti:Object.keys(currentMatchStats||{}).filter(id=>isPresentStat(currentMatchStats[id])).length,
      eleggibili:eligible.length,
      ids:eligible.map(p=>p.id)
    });
  }

  async function fixedLoadPendingRegistrations(){
    const box=$('#pendingRegistrations');
    if(!box || !isAdmin()) return;

    const currentLeague = String(leagueId() || '').trim();
    if(!currentLeague){
      box.innerHTML='<p class="muted">Impossibile determinare la lega dell’Admin.</p>';
      return;
    }

    try{
      // Primo tentativo: query precisa sulla lega.
      let docs=[];
      try{
        const snap=await db.collection('users').where('leagueId','==',currentLeague).get();
        docs=snap.docs;
      }catch(error){
        console.warn('[BF 8.06] query utenti per lega fallita, provo fallback:',error);
      }

      // Fallback: recupera i pending e filtra la lega lato client.
      // È utile se nella collection esistono profili legacy con campi incompleti.
      if(!docs.length){
        try{
          const snap=await db.collection('users').where('registrationStatus','==','pending').get();
          docs=snap.docs;
        }catch(error){
          console.warn('[BF 8.06] fallback pending fallito:',error);
        }
      }

      const pending=docs
        .map(d=>({id:d.id,...(d.data()||{})}))
        .filter(u=>
          u.role==='player' &&
          String(u.leagueId||'').trim()===currentLeague &&
          u.active!==true &&
          (u.registrationStatus==='pending' || !u.playerId)
        );

      if(!pending.length){
        box.innerHTML='<p class="muted">Nessuna registrazione in attesa.</p>';
        console.info('[BF 8.06] nessun pending per lega',currentLeague);
        return;
      }

      box.innerHTML=pending.map(u=>{
        const name=[u.nome,u.cognome].filter(Boolean).join(' ')||u.displayName||'Nome non indicato';
        const parts=name.trim().split(/\s+/).filter(Boolean);
        const initials=((parts[0]?.[0]||'')+(parts.length>1?(parts[parts.length-1]?.[0]||''):'' )).toUpperCase();
        return `<div class="admin-user-row pending-user"><span class="admin-avatar">${escapeHtml(initials)}</span><div class="admin-user-main"><b>${escapeHtml(name)}</b><span class="sub">${escapeHtml(u.email||'Email non disponibile')}</span></div><button class="primary small-action" data-associate-user="${escapeHtml(u.id)}">Associa</button></div>`;
      }).join('');

      box.querySelectorAll('[data-associate-user]').forEach(btn=>
        btn.addEventListener('click',()=>associateRegistration(btn.dataset.associateUser))
      );

      console.info('[BF 8.06] pending visualizzati',{
        leagueId:currentLeague,
        count:pending.length,
        users:pending.map(u=>({id:u.id,email:u.email,playerId:u.playerId,status:u.registrationStatus,active:u.active}))
      });
    }catch(error){
      console.error('[BF 8.06] errore registrazioni pending:',error);
      box.innerHTML='<p class="muted">Impossibile caricare le registrazioni.</p>';
    }
  }

  // Sostituzioni globali. Le funzioni originali sono dichiarazioni globali
  // in app.js, quindi i riferimenti successivi usano queste versioni.
  window.loadMatchStats = fixedLoadMatchStats;
  window.playerHasMatchPresence = fixedPlayerHasMatchPresence;
  window.populateVotes = fixedPopulateVotes;
  window.loadPendingRegistrations = fixedLoadPendingRegistrations;

  async function recheckAfterPatch(){
    try{
      if(!window.currentUserData || !firebase.auth().currentUser) return;
      console.info('[BF 8.06] hotfix attivo, ricarico i dati della sessione');
      if(typeof refresh==='function') await refresh();
    }catch(error){
      console.error('[BF 8.06] refresh post-hotfix fallito:',error);
    }
  }

  window.addEventListener('load',()=>setTimeout(recheckAfterPatch,250));
})();
