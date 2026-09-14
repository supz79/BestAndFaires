# Best&Faires Beta.7.13

Modifiche:
- L'Admin vede prioritariamente la partita attualmente in corso, come il Player.
- Il dashboard Admin non salta più una partita in corso per mostrare la successiva futura.
- Migliorata diagnosi degli errori di registrazione del voto: in caso di rifiuto Firebase viene indicato di verificare il `playerId` del profilo e la distinta.
- Il timer e la selezione dei tre voti restano persistenti durante gli aggiornamenti della schermata.


## Beta.7.15
- Classifica giornata e classifica generale visibili anche ai Player.
- I Player leggono solo aggregati pubblici, non i documenti dei voti segreti.
- Ogni voto aggiorna in modo atomico il voto segreto e i risultati pubblici.
- L'Admin può ricostruire gli aggregati pubblici dai voti esistenti.
- La scheda della partita corrente evidenzia visivamente che è cliccabile (hover/focus/active).
- Security Rules aggiornate per proteggere gli aggregati pubblici.
