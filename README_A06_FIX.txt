Best&Faires Beta 7.20.4 - A-06 FIX

Correzioni:
1. Il caricamento di stats/summary usa una Promise condivisa per la partita corrente,
   evitando richieste duplicate durante il refresh del timer e ridisegnando il tabellino
   quando il caricamento asincrono termina.
2. updateProgress() non viene più eseguita ad ogni renderMatch() (ogni secondo).
   Viene eseguita una volta al termine del refresh iniziale/login.
3. Nessuna modifica a Firebase Rules, modello Firestore o dati esistenti.
4. Base: A-05 Tabellino Reload.

Installazione: sostituire i file del repository con il contenuto dello ZIP.
