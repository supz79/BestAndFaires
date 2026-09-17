Best&Faires Beta 7.20.4 - A-15

Base: A-12 stabile. Non include A-13/A-14 (modifiche voto sospese).

Fix Home dopo apertura di una partita dal Calendario:
- introdotta selezione separata della partita principale Home con selectHomeMatch();
- la Home privilegia solo partita in corso / voto aperto / prossima futura secondo le regole correnti;
- una partita TERMINATA con finestra voto scaduta non puo' tornare protagonista della Home;
- aprire "Tabellino" dal Calendario continua a mostrare la partita selezionata senza cambiare la selezione logica della Home;
- tornando alla Home, la partita principale viene ricalcolata.

Cache-buster JS aggiornato a 7.23.
Nessuna modifica alle Firestore Rules.
