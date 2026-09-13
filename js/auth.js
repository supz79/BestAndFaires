/* Best&Faires Beta.3 - Firebase Authentication */

const loginScreen = document.querySelector('#login');
const dashboardScreen = document.querySelector('#dashboard');
const loginForm = document.querySelector('#loginForm');
const loginMsg = document.querySelector('#loginMsg');
const roleBtn = document.querySelector('#roleBtn');

function showAuthenticatedArea(userData) {
  window.currentUserData = userData;
  if (typeof window.applyRolePermissions === 'function') window.applyRolePermissions(userData);
  loginScreen.classList.remove('active');
  dashboardScreen.classList.add('active');
  const name = userData?.nome || userData?.displayName || firebase.auth().currentUser?.email || 'Utente';
  roleBtn.textContent = userData?.role === 'admin' ? 'Admin · Esci' : `${name} · Esci`;
}

function showLogin(message='') {
  document.querySelectorAll('.screen').forEach(x => x.classList.remove('active'));
  loginScreen.classList.add('active');
  roleBtn.textContent = 'Accedi';
  if (loginMsg) loginMsg.textContent = message;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMsg.textContent = 'Accesso in corso...';
  try {
    await auth.signInWithEmailAndPassword(
      document.querySelector('#loginEmail').value.trim(),
      document.querySelector('#loginPassword').value
    );
  } catch (error) {
    console.error(error);
    loginMsg.textContent = '❌ Accesso non riuscito. Controlla email e password.';
  }
});

roleBtn.addEventListener('click', async () => {
  if (auth.currentUser) {
    await auth.signOut();
    showLogin();
  } else {
    showLogin();
  }
});

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  try {
    const snap = await db.collection('users').doc(user.uid).get();
    if (!snap.exists) {
      await auth.signOut();
      showLogin('❌ Account autenticato, ma non ancora associato a un profilo Best&Faires.');
      return;
    }

    const userData = snap.data();
    if (userData.active !== true) {
      await auth.signOut();
      showLogin('❌ Account disattivato.');
      return;
    }

    console.log('Best&Faires Beta.3: utente autenticato.', {
      uid: user.uid,
      role: userData.role,
      leagueId: userData.leagueId
    });
    showAuthenticatedArea(userData);
  } catch (error) {
    console.error('Errore lettura profilo utente:', error);
    await auth.signOut();
    showLogin('❌ Impossibile leggere il profilo utente da Firebase.');
  }
});
