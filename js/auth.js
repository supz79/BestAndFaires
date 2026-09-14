/* Best&Faires Beta.7.17 - registrazione Player e associazione Admin */

const loginScreen = document.querySelector('#login');
const dashboardScreen = document.querySelector('#dashboard');
const registerScreen = document.querySelector('#register');
const loginForm = document.querySelector('#loginForm');
const loginMsg = document.querySelector('#loginMsg');
const registerForm = document.querySelector('#registerForm');
const registerMsg = document.querySelector('#registerMsg');
const roleBtn = document.querySelector('#roleBtn');

function showAuthenticatedArea(userData) {
  window.currentUserData = userData;
  if (typeof window.applyRolePermissions === 'function') window.applyRolePermissions(userData);
  loginScreen.classList.remove('active');
  registerScreen?.classList.remove('active');
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

function showRegister() {
  document.querySelectorAll('.screen').forEach(x => x.classList.remove('active'));
  registerScreen?.classList.add('active');
  if(registerMsg) registerMsg.textContent='';
}

document.querySelector('#showRegisterBtn')?.addEventListener('click', showRegister);
document.querySelector('#cancelRegisterBtn')?.addEventListener('click', ()=>showLogin());

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

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const nome=document.querySelector('#registerNome').value.trim();
  const cognome=document.querySelector('#registerCognome').value.trim();
  const email=document.querySelector('#registerEmail').value.trim();
  const password=document.querySelector('#registerPassword').value;
  const password2=document.querySelector('#registerPassword2').value;
  if(password!==password2){ registerMsg.textContent='❌ Le password non coincidono.'; return; }
  registerMsg.textContent='Registrazione in corso...';
  window.isRegistering=true;
  try{
    const cred=await auth.createUserWithEmailAndPassword(email,password);
    await db.collection('users').doc(cred.user.uid).set({
      nome, cognome, email, role:'player', leagueId:'demo', active:false, playerId:null,
      registrationStatus:'pending', registeredAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    await auth.signOut();
    window.isRegistering=false;
    showLogin('✅ Registrazione inviata. Attendi che l’Admin associ il tuo account alla rosa.');
    registerForm.reset();
  }catch(error){
    console.error('Registrazione:',error);
    window.isRegistering=false;
    if(error.code==='auth/email-already-in-use') registerMsg.textContent='❌ Questa email è già registrata.';
    else registerMsg.textContent='❌ Registrazione non riuscita. Riprova.';
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
    if(!window.isRegistering) showLogin();
    return;
  }
  if(window.isRegistering) return;
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
      showLogin('⏳ Registrazione ricevuta. L’Admin deve ancora associarti alla rosa.');
      return;
    }
    console.log('Best&Faires Beta.7.17: utente autenticato.', {uid:user.uid,role:userData.role,leagueId:userData.leagueId});
    showAuthenticatedArea(userData);
  } catch (error) {
    console.error('Errore lettura profilo utente:', error);
    await auth.signOut();
    showLogin('❌ Impossibile leggere il profilo utente da Firebase.');
  }
});
