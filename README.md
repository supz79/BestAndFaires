# Best&Faires Beta 7.20.4

## Novità
- In **Amministrazione → Gestione rosa**, accanto a ogni Player con account associato compare **✉️ Modifica mail utente**.
- L'Admin può sostituire l'indirizzo email mantenendo lo stesso UID Firebase.
- Restano invariati associazione al giocatore, voti, statistiche e storico.
- Dopo la modifica la nuova email viene marcata come **non verificata**: il Player dovrà accedere con il nuovo indirizzo e completare nuovamente la verifica email.
- La modifica è eseguita tramite una **Firebase Cloud Function** con privilegi Admin, quindi la chiave Firebase pubblica del frontend non viene usata per modificare account di altri utenti.
- La Function verifica che chi effettua l'operazione sia Admin attivo e che il Player appartenga alla stessa lega.

## Pubblicazione Cloud Function

Dalla cartella principale del progetto:

```bash
firebase login
firebase use bestandfaires
firebase deploy --only functions:updatePlayerEmail
```

La Function viene pubblicata nella regione `europe-west8`.

> Nota: le Cloud Functions richiedono un progetto Firebase con fatturazione abilitata (piano Blaze). L'app continua comunque a essere ospitata su GitHub Pages: non viene configurato Firebase Hosting.

## Frontend

Dopo la pubblicazione della Function, caricare su GitHub Pages i file della Beta 7.20.4.
