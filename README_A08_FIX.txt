Best&Faires Beta 7.20.4 - A-08

Fix login/logout tabellino:
- il tabellino non viene piu ricaricato ogni secondo dal timer;
- il caricamento stats/summary avviene dopo la sessione Firebase Auth;
- 3 tentativi controllati in caso di timing transitorio delle Rules;
- logout azzera stato temporaneo e timer;
- cache-buster app.js?v=7.21.

Non modificare Firestore Rules o cancellare gli stats esistenti.
