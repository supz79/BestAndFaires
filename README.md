# Best&Faires ⚽
## Beta.1

Prima versione funzionante/prototipo della PWA.

### Regole implementate
- Una sola squadra gestita dalla lega.
- La squadra ha una rosa completa.
- L'Admin seleziona la distinta della partita.
- Solo i giocatori in distinta possono votare.
- Solo i giocatori in distinta possono ricevere voti.
- Non è possibile votare sé stessi.
- Ogni voto assegna 3, 2 e 1 punto.
- Voti non mostrati ai partecipanti.
- Classifica della giornata.
- Struttura predisposta per la classifica stagionale.

### Stato tecnico
Questa Beta.1 è un prototipo client-side e usa `localStorage`.
Per la versione reale occorreranno:
1. autenticazione utenti;
2. database cloud;
3. ruoli Admin/Player;
4. regole server-side per garantire realmente la segretezza;
5. gestione multi-lega e multi-giornata;
6. backend per impedire manipolazioni del browser.

### Avvio
Aprire `index.html` in un browser moderno.

Per pubblicare su GitHub Pages:
- creare un repository;
- caricare i file;
- Settings → Pages → Deploy from branch.


## Beta.2 - Collegamento Firebase

Beta.2 mantiene invariata la logica della Beta.1 e il salvataggio locale in localStorage.
È stato aggiunto il collegamento al progetto Firebase `bestandfaires` tramite Firebase Web SDK
(Auth e Firestore inclusi nel caricamento del client).

Prima di pubblicare/testare Beta.2, aprire `js/firebase.js` e sostituire:

`YOUR_API_KEY`

con la Web API Key presente nelle impostazioni del progetto Firebase.

In questa fase non vengono ancora letti o scritti dati su Firestore e non viene modificata
l'autenticazione della Beta.1. Il passaggio successivo sarà collegare l'accesso utente reale.


## Beta.3 - Firebase Authentication

Beta.3 aggiunge l'accesso reale tramite Firebase Authentication con email e password.
Dopo l'accesso, il client legge il documento dell'utente in `users/{uid}` e verifica `active`.
Il ruolo (`admin` o `player`) e la lega associata vengono letti da Firestore.
La protezione reale continua a essere affidata alle Security Rules Firebase.
La logica delle partite e dei voti non è ancora migrata da localStorage.


## Beta.3 Auth READY
Questa versione carica Firebase App, Authentication e Firestore prima dei moduli
`firebase.js`, `auth.js` e `app.js`. Il login utilizza Firebase Authentication
(email/password) e verifica il profilo `users/{UID}`.
