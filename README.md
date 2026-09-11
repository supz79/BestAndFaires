# Best&Faires ⚽
## Beta.1

Prima versione funzionante/prototipo della PWA.

### Regole implementate
- Una sola squadra gestita dalla lega.
- La squadra ha una rosa completa.
- L'Admin seleziona la distinta della partita.
- Solo i giocatori in distinta possono votare.
- Solo i giocatori in distinta possono ricevere voti.
- Non è possibile votare sé stessi.
- Ogni voto assegna 3, 2 e 1 punto.
- Voti non mostrati ai partecipanti.
- Classifica della giornata.
- Struttura predisposta per la classifica stagionale.

### Stato tecnico
Questa Beta.1 è un prototipo client-side e usa `localStorage`.
Per la versione reale occorreranno:
1. autenticazione utenti;
2. database cloud;
3. ruoli Admin/Player;
4. regole server-side per garantire realmente la segretezza;
5. gestione multi-lega e multi-giornata;
6. backend per impedire manipolazioni del browser.

### Avvio
Aprire `index.html` in un browser moderno.

Per pubblicare su GitHub Pages:
- creare un repository;
- caricare i file;
- Settings → Pages → Deploy from branch.
