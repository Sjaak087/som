# Aurora Student Dashboard + Firebase

Deze GitHub Pages-site gebruikt Firebase Authentication + Realtime Database.

## Wat wordt opgeslagen

Per Firebase-gebruiker, onder `users/<uid>/`:

```text
profile/
  name
  accent

connection/
  calendarId
  calendarUrl
  lastSync

rosterCache/
  [roosterafspraken]

grades/
  [eigen cijfers]

tasks/
  [eigen taken]

tests/
  [eigen toetsen]
```

Dus ook de **agenda-ID/URL**, rooster-cache, naam, accentkleur, cijfers, taken en
toetsen worden opgeslagen.

## Somtoday: alleen rooster

De Somtoday-koppeling wordt alleen gebruikt voor de iCalendar-roosterfeed.
De site haalt geen Somtoday-wachtwoord, Somtoday-cijfers, Somtoday-taken of
Somtoday-berichten op.

De app accepteert:
- volledige iCalendar URL
- losse agenda/token-ID, waarna de Somtoday iCalendar stream-vorm wordt geprobeerd
- lokaal `.ics` bestand als de browser de live feed door CORS blokkeert

## Firebase instellen

### 1. Authentication

Firebase Console → Authentication → Sign-in method → **Email/Password** → Enable.

De website heeft daarmee een eigen login/account per gebruiker.

### 2. Realtime Database rules

Gebruik de regels uit `database.rules.json`:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

Hiermee kan een gebruiker alleen zijn eigen `users/<uid>` node lezen/schrijven.

### 3. GitHub Pages

Upload `index.html`, `styles.css`, `app.js`, `firebase.json` en
`database.rules.json` naar een GitHub repository.

Voor GitHub Pages heb je geen eigen server nodig. De site is static.

### 4. Firebase rules deployen

Met Firebase CLI:

```bash
firebase login
firebase use somtoday-auto-planner
firebase deploy --only database
```

Je kunt de regels ook direct in Firebase Console → Realtime Database → Rules
plakken.

## Opslaggedrag

De dashboarddata wordt niet in `localStorage` bewaard. Wijzigingen worden
direct naar Firebase Realtime Database geschreven.

De rooster-cache wordt ook opgeslagen, zodat de laatste ingeladen afspraken
na opnieuw inloggen beschikbaar zijn. De live Somtoday-feed kan daarna opnieuw
worden verversd.

## CORS

Browsers kunnen een iCalendar feed blokkeren wanneer de server geen passende
CORS headers teruggeeft. Daarom zit er een `.ics` import in.

## Firebase config

De ingevulde Firebase Web App-config staat in `app.js`, zoals je hem hierboven
hebt aangeleverd.

## Onafhankelijk

Deze UI is een zelfstandige dashboard-implementatie en is niet een officiële
Somtoday-app.

## Firebase-config

De meegeleverde `app.js` bevat jouw Firebase Web App-config. Een Firebase web
API-key is client-side configuration; de echte toegangsbeveiliging voor de
Realtime Database hoort in Authentication + Security Rules te zitten.

## Wat exact blijft staan

Onder jouw eigen UID wordt bewaard:
- profielnaam + accent
- agenda-ID
- agenda-URL
- laatste sync-tijd
- laatste rooster-cache
- alle zelf ingevoerde cijfers
- alle zelf ingevoerde taken inclusief afvinkstatus
- alle zelf ingevoerde toetsen
- laatst bekeken week

Er wordt geen server-side opslag buiten Firebase gebruikt.
