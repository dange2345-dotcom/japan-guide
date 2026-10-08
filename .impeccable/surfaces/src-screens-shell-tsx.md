---
version: 1
slug: "src-screens-shell-tsx"
primary_target: "src/screens/shell.tsx"
related_targets: ["src/screens/section.tsx","src/screens/place.tsx","src/screens/guides.tsx","src/styles.css"]
---

# Surface: app shell — sections, place cards, place screen, guides

Mode: Operate. Owner plans at home (Windows) and uses it equally on the phone in Japan, on the street, one-handed, daylight. 100–300 places. Task: section → category chip → city → place → "show in Japanese" / "open in Google Maps".

## Direction contract

THESIS: The guide reads like Tokyo station signage, not a travel feed: sections are lines, places are stations with real station-number badges, and the way out is always the yellow exit sign. Refuses the category default of big rounded photo cards on white with a blue accent.

OWN-WORLD: Station-wall grey ground, white sign boards, navy-black ink #1a1f36, exit-yellow #ffd400 reserved for the primary action, line colours only as rings, strips and badges (food Ginza orange, places Marunouchi red, shopping Hanzomon purple, hotels Chiyoda green, guides Tozai sky). Ring badges with kanji for sections, real line-coloured station-code badges (G01, JY20) on places. Humanist sans (Fira Sans) like Frutiger signage; Japanese set large in the system gothic. Small radii, hairline rules, almost no shadow.

STORY: The traveller sees which line they are on, picks a category, scans stations by badge and name, opens one, shows the Japanese board to staff, takes the yellow exit to Google Maps, and walks the line to the next station.

FIRST VIEWPORT: Phone: platform-sign header — kanji ring badge, section name large, Japanese reading and count, a 6px line-colour strip across the full width; under it a horizontal category chip rail, then city + status controls; then a two-column grid of station cards (photo, name, station badge + station name, price right). Bottom: the five line badges threaded on one thin line. Yellow "+" above the bar for editors. Desktop: the line badges become a vertical route diagram in the left rail; grid widens to 3–4 columns.

FORM: Tokyo rail wayfinding signage — own grounded list position 1 (IMPECCABLE'S PICK, chosen by the user over the roll), seed key 49f3bca7. Signature interaction: the place screen ends in a platform name board — ← previous station · next station → through the current filtered list, with swipe on phone.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
