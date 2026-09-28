# Aurora Student Dashboard — GitHub-ready

Een zelfstandige, statische student-dashboard UI met een preview-achtige donkere
glassmorphism indeling.

## Belangrijk over je "agenda ID"

Somtoday gebruikt voor de iCalendar-koppeling een iCalendar-token/URL. De officiële
Somtoday-help beschrijft dat leerlingen vanuit **Instellingen → Agenda** een
agenda-koppeling kunnen activeren. De API-documentatie beschrijft daarnaast een
`GET /rest/v1/icalendar` endpoint dat een `leerlingICalendarLink` teruggeeft en een
stream onder `/rest/v1/icalendar/stream/...`.

Daarom accepteert deze site:
- een volledige `https://...` iCalendar-URL/token
- een losse token/ID, waarna de app de Somtoday-streamvorm probeert

### Browser-only / geen opslag

Er is:
- geen database
- geen backend
- geen localStorage
- geen cookie-opslag voor de agenda
- geen server-side proxy

De agenda wordt alleen in JavaScript-geheugen verwerkt. Een browser kan een
Somtoday-stream echter blokkeren door CORS. Wanneer dat gebeurt, kun je in
Somtoday/een externe agenda een `.ics` bestand verkrijgen en dat lokaal met
`.ics openen` in de site laden.

## GitHub Pages

1. Maak een nieuwe GitHub repository.
2. Zet `index.html`, `styles.css` en `app.js` in de root.
3. Push naar GitHub.
4. Open **Settings → Pages**.
5. Kies de branch met de root als bron.

Omdat het project alleen HTML/CSS/JS bevat, werkt het rechtstreeks op GitHub Pages.

## Wat de site doet

- preview-achtige glass sidebar
- donker neon topbar
- hero met datum
- 12-koloms dashboard
- agenda in een grote werkruimte
- cijfers, taken, nieuws, berichten en klok
- week vooruit/achteruit
- zoeken binnen de dashboardkaarten
- lokale `.ics` import
- agenda URL/token import
- instellingen voor naam en accentkleur

## Data

De demo toont fictieve/voorbeeldgegevens totdat je een agenda importeert.
De `.ics` import bevat alleen agenda-items die in het bestand/feed staan.
