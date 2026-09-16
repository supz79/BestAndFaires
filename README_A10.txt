Best&Faires Beta 7.20.4 - A-10

Punto 6 completato lato applicazione e Rules:
- Tutti i convocati in distinta possono votare, se sono aventi diritto al voto e la finestra e' aperta.
- Solo i giocatori con Presenza=SI nel tabellino sono selezionabili come destinatari.
- Il controllo e' presente nel frontend e viene verificato anche dalle Firestore Rules.
- I risultati pubblici vengono calcolati ignorando eventuali voti storici verso giocatori senza presenza.
- Nessuna modifica al caricamento A-08 ne' alla finalizzazione A-09.

Prima del test pubblicare anche firestore.rules.
