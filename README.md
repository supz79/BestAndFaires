# Best&Faires Beta 7.20.4 - A-05

## Fix ricaricamento tabellino
- La lettura delle statistiche della partita non usa più la LIST della sottocollezione `stats`.
- Vengono letti i singoli documenti `stats/{playerId}` usando gli ID già presenti nella distinta.
- Nessuna modifica alle Firestore Rules.
- Nessuna modifica al salvataggio del tabellino, ai voti o al calendario.
- Mantiene il reset della cache introdotto in A-04.

A-11: rifinitura finestra voto 6 ore. Il countdown del tabellino si aggiorna in tempo reale, allo scadere viene mostrato un messaggio esplicito e la partita corrente viene ricalcolata una sola volta per consentire il passaggio alla prossima partita senza query ripetute.
