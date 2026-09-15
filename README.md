# Best&Faires Beta 7.17.2

Aggiornamento grafico della Beta 7.17.1: sostituito il riferimento al pallone da calcio con il nuovo logo multisport, presente sia nella barra superiore sia nella schermata di login. Funzionalità Firebase, registrazione, associazione, votazione e classifiche invariate.


## Beta 7.18
- Verifica email obbligatoria per i Player prima dell'accesso.
- Invio automatico del link di verifica alla registrazione.
- Pulsanti per controllare la verifica e reinviare l'email.
- Security Rules: le operazioni Player richiedono `request.auth.token.email_verified == true`.
