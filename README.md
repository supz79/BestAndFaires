# Best&Faires Beta.7

Beta.7 aggiunge al backend Firestore il primo modulo operativo di calendario.

## Funzioni
- Firebase Authentication Email/Password
- Lega, rosa, partite e voti su Firestore
- Distinta bloccata automaticamente all'orario `scheduledStart`
- Sblocco eccezionale Admin dopo l'inizio
- Voto Player salvato in `matches/{matchId}/votes/{uid}`
- Calendario Admin con importazione `.xlsx`, `.xls` o `.csv`
- Anteprima prima della conferma
- Riconoscimento automatico casa/trasferta rispetto alla squadra della lega
- Chiave stabile `calendarKey` per aggiornare una partita rinviata senza crearne una duplicata
- Le partite assenti da un nuovo import non vengono cancellate
- Modifica manuale di giornata, fase, squadre, data, ora e stato

## File Excel supportato
Struttura prevista:
- riga `ANDATA`
- intestazioni `GIORNATA | CASA | TRASFERTA | DATA`
- righe partita
- riga `RITORNO`
- stesse intestazioni e righe

Il file viene validato nell'anteprima prima della scrittura su Firestore.
