# Best&Faires Beta 7.20.4 - A-05

## Fix ricaricamento tabellino
- La lettura delle statistiche della partita non usa più la LIST della sottocollezione `stats`.
- Vengono letti i singoli documenti `stats/{playerId}` usando gli ID già presenti nella distinta.
- Nessuna modifica alle Firestore Rules.
- Nessuna modifica al salvataggio del tabellino, ai voti o al calendario.
- Mantiene il reset della cache introdotto in A-04.
