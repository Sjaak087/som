# Aurora Student Dashboard — Firebase FIXED

Deze versie is gericht op de twee problemen:
1. Firebase start automatisch met **Anonymous Authentication**.
2. iCalendar tijden worden timezone-bewust geparsed.

## ÉÉN verplichte Firebase instelling

Ga naar:

**Firebase Console → Authentication → Sign-in method → Anonymous → Enable**

Firebase Authentication ondersteunt anonieme accounts; het account krijgt een
UID, waardoor de database onder `users/<uid>/` kan worden opgeslagen.

Daarna kan de site zonder loginformulier meteen starten.

## Realtime Database Rules

Gebruik de meegeleverde `database.rules.json`:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren() || newData.val() == null"
      }
    }
  }
}
```

## Wat wordt opgeslagen

```text
users/<uid>/
  profile/
  connection/
    calendarId
    calendarUrl
    lastSync
  rosterCache/
  grades/
  tasks/
  tests/
  preferences/
    weekOffset
```

Daarmee blijven agenda-ID/URL, rooster-cache, cijfers, taken, toetsen, naam,
accent en de laatste week gekoppeld aan dezelfde Firebase-user.

## Tijden FIXED

De parser ondersteunt:
- `DTSTART;TZID=Europe/Amsterdam:20260928T083000`
- `DTEND;TZID=Europe/Amsterdam:20260928T092000`
- `DTSTART:20260928T083000`
- `DTSTART:20260928T083000Z`
- `VALUE=DATE`/hele-dag afspraken
- `X-WR-TIMEZONE` uit het kalenderbestand

Voor Nederland wordt de timezone `Europe/Amsterdam` gebruikt als een event geen
TZID bevat. UTC-events met `Z` worden als UTC geïnterpreteerd en daarna correct
naar Nederland omgezet.

## Live rooster

De ingevoerde waarde kan:
- een volledige iCalendar URL zijn
- een losse Somtoday iCalendar stream-token/ID zijn

Bij een losse ID gebruikt de app:

`https://api.somtoday.nl/rest/v1/icalendar/stream/<ID>`

Wanneer de browser de live feed door CORS niet mag ophalen, kun je met `.ics
openen` het agenda-bestand lokaal laden.

## GitHub Pages

Upload deze bestanden:

- `index.html`
- `styles.css`
- `app.js`
- `database.rules.json`
- `firebase.json`

De site heeft geen eigen server nodig.

## Firebase config

De Firebase webconfig die je hebt gegeven zit al in `app.js`.
Er staat bewust geen service-account/private key in de client.

## Privacy/veiligheid

De database rules beperken iedere gebruiker tot zijn eigen UID-node.
Gebruik geen publieke `".read": true` / `".write": true` regels voor de echte site.

## Belangrijk

Dit project is een onafhankelijke dashboardinterface. Het haalt alleen de
iCalendar-roosterfeed op en gebruikt geen Somtoday-wachtwoord of andere
Somtoday-accountgegevens.
