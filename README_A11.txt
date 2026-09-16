Best&Faires Beta 7.20.4 - A-11

Punto 7: rifinitura finestra di voto 6 ore.

Modifiche:
- il countdown della finestra di voto si aggiorna anche nella schermata Tabellino;
- allo scadere delle 6 ore compare esplicitamente "Finestra di voto terminata";
- allo scadere della finestra di una partita TERMINATA viene ricalcolata una sola volta la partita corrente, consentendo alla Home di passare alla prossima senza query continue;
- non vengono effettuate scritture automatiche su Firebase;
- il timer continua a evitare richiami di renderMatch() ogni secondo;
- cache-buster app.js aggiornato a v7.22.

Non modifica la logica della finalizzazione del tabellino né le Rules.
