# Aurora Student Dashboard v2

GitHub-ready, static dashboard geïnspireerd op de aangeleverde preview.

## Wat deze versie doet

### 1. Somtoday → alleen rooster
De import accepteert een volledige iCalendar-token/URL uit Somtoday of een `.ics`
bestand.

De site leest uitsluitend `VEVENT` agenda-items uit de feed. Cijfers, taken,
toetsen en berichten worden niet uit de Somtoday-feed gehaald.

Somtoday beschrijft dat de iCalendar-koppeling alleen roosterafspraken
synchroniseert. Huiswerk en toetsen uit Somtoday worden niet meegenomen in die
externe agenda-koppeling.

### 2. Zelf cijfers invoeren
Met **+ Cijfer** kun je vak, cijfer, datum en type invoeren.

Het dashboard toont:
- gemiddelde
- aantal cijfers
- per cijfer een status "Goed" of "Aandacht"
- laatste cijfers

### 3. Zelf taken plannen
Met **+ Taak** kun je titel, vak, datum, tijd en prioriteit instellen.
Taken verschijnen:
- in het takenpaneel
- op de agenda
- in de dagteller

Taken kunnen worden afgevinkt.

### 4. Zelf toetsen plannen
Met **+ Toets** kun je vak/titel, datum, tijd en lokaal instellen.
Toetsen verschijnen:
- in het toets-paneel
- als volgende toets
- in de agenda

### 5. Geen backend / geen database
Alles is een gewone GitHub Pages-site:
- geen server
- geen database
- geen API-server
- geen localStorage
- geen cookies voor opslag

De handmatig ingevoerde cijfers/taken/toetsen bestaan alleen zolang de pagina
open blijft. Na Ctrl+F5 zijn ze weer weg.

## GitHub Pages

Upload deze bestanden naar de root van een GitHub repository:

- `index.html`
- `styles.css`
- `app.js`
- `.github/workflows/pages.yml`

Ga daarna naar **Settings → Pages** en activeer GitHub Pages.

## CORS

Een browser kan een iCalendar URL blokkeren wanneer die server geen CORS-header
voor browser requests terugstuurt. Dat is een beveiligingsmechanisme van de
browser en niet iets dat met CSS/HTML kan worden omzeild.

Gebruik dan de `.ics openen` knop.

## Onafhankelijk project

Deze interface is een zelfstandige dashboard-implementatie en is niet verbonden
aan of gesponsord door Somtoday/Topicus.
