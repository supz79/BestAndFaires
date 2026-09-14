# Best&Faires Beta.6

Questa versione sostituisce la logica applicativa locale con Firebase Firestore.

## Firebase
- Authentication: Email/Password
- Firestore: `bestandfaires`
- Frontend: GitHub Pages

## Dati letti
- `leagues/{leagueId}`
- `players` filtrati per `leagueId`
- `matches` filtrati per `leagueId`

## Voti
I voti vengono salvati in:
`matches/{matchId}/votes/{voterUid}`

Il documento del voto contiene esclusivamente:
`{ ranking: [playerId1, playerId2, playerId3] }`

Le Security Rules impediscono modifica/cancellazione e impediscono all'utente Player di leggere i voti.

## Distinta
La distinta è letta dal campo `lineup` della partita. Se esiste `scheduledStart`, il blocco automatico è determinato dall'orario della partita. Per le partite del calendario definitivo usare sempre un campo Firestore Timestamp `scheduledStart`.

## Beta.6
Questa beta è il primo passaggio reale verso il backend Firestore. Il prossimo modulo sarà il Calendario Admin con importazione Excel, modifica delle partite e generazione/aggiornamento di `scheduledStart`.
