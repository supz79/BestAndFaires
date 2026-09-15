# Best&Faires Beta 7.19

## Novità
- Tabellino statistiche per ogni partita.
- L'Admin può registrare per i giocatori in distinta: Presenza, Gol, Assist, Cartellini gialli e rossi.
- Le statistiche vengono salvate in `matches/{matchId}/stats/{playerId}` e restano storiche per ogni partita.
- La pagina Giocatori mostra il riepilogo cumulativo della stagione.
- I Player possono leggere le statistiche ma non modificarle.
- La votazione, le classifiche, la registrazione e la verifica email della Beta 7.18 restano invariate.

## Nuova regola Firebase
Pubblicare anche il file `firestore.rules`. La raccolta `stats` consente lettura ai membri della lega e scrittura esclusivamente all'Admin, con dati limitati ai giocatori presenti nella distinta.

## Uso Admin
1. Aprire **Calendario**.
2. Sulla partita disputata scegliere **📊 Tabellino**.
3. Selezionare la **Presenza** per i giocatori che hanno effettivamente disputato il match.
4. Inserire Gol, Assist, Gialli e Rossi.
5. Premere **💾 Salva tabellino**.
6. In **Rosa squadra** è disponibile il riepilogo cumulativo della stagione.
