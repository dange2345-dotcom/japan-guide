---
name: Япония
description: Личный путеводитель по Японии, оформленный как указатели токийских станций
colors:
  station-wall: "#eceef1"
  sign-white: "#ffffff"
  sign-white-sunken: "#f5f6f8"
  metro-navy: "#1a1f36"
  navy-secondary: "#474d65"
  navy-tertiary: "#636981"
  rule: "#dadde4"
  rule-strong: "#b8bdca"
  exit-yellow: "#ffd400"
  exit-yellow-hover: "#f2c600"
  line-food-ginza: "#f39700"
  line-places-marunouchi: "#e60012"
  line-shopping-hanzomon: "#9b7cb6"
  line-hotels-chiyoda: "#009944"
  line-guides-tozai: "#00a7db"
  ok: "#1d7f47"
  error: "#c3261f"
  night-wall: "#0d1020"
  night-sign: "#171b2d"
  night-ink: "#eef0f7"
typography:
  display:
    fontFamily: "Fira Sans, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Fira Sans, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "Fira Sans, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Fira Sans, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Fira Sans, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.3
  japanese:
    fontFamily: "Hiragino Sans, Hiragino Kaku Gothic ProN, Yu Gothic UI, Yu Gothic, Meiryo, Noto Sans JP, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  badge: "50%"
  sm: "7px"
  control: "8px"
  md: "10px"
  sheet: "14px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
components:
  button-exit:
    backgroundColor: "{colors.exit-yellow}"
    textColor: "{colors.metro-navy}"
    rounded: "{rounded.control}"
    height: "54px"
    padding: "0 18px"
  button-exit-hover:
    backgroundColor: "{colors.exit-yellow-hover}"
  button-primary:
    backgroundColor: "{colors.metro-navy}"
    textColor: "{colors.sign-white}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 16px"
  button-default:
    backgroundColor: "{colors.sign-white}"
    textColor: "{colors.metro-navy}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 16px"
  chip:
    backgroundColor: "{colors.sign-white}"
    textColor: "{colors.metro-navy}"
    rounded: "{rounded.control}"
    height: "38px"
    padding: "0 13px"
  chip-selected:
    backgroundColor: "{colors.metro-navy}"
    textColor: "{colors.sign-white}"
  card:
    backgroundColor: "{colors.sign-white}"
    textColor: "{colors.metro-navy}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.sign-white}"
    textColor: "{colors.metro-navy}"
    rounded: "{rounded.control}"
    height: "46px"
    padding: "0 12px"
  fab:
    backgroundColor: "{colors.exit-yellow}"
    textColor: "{colors.metro-navy}"
    rounded: "16px"
    size: "58px"
---

# Design System: Япония

## Overview

**Creative North Star: "The Station Signboard"**

The guide reads like the wayfinding of a Tokyo station, not like a travel feed. Sections are metro lines, each with its own line colour and a ring badge carrying a kanji (食 food, 遊 places, 買 shopping, 泊 hotels, 案 guides). Places are stations: a white sign board, a band of line colour, a real station-number badge (G01, JY20, M20) drawn in the official colour of that line. The one loud colour is the yellow of the exit signs, and it is reserved for the way out: "Open in Google Maps", the add button, favourites.

Density is moderate and practical: two columns of station cards on a phone, three to four on a desktop, everything readable one-handed in daylight. Colour lives in rings, strips and badges, never in large fills. Surfaces are flat white boards on a cool grey wall; depth is a hairline and a faint shadow.

Chosen by the owner over the rolled "JR ticket" direction and the generic travel-app canon (Airbnb-style big rounded photo cards with a blue accent), which this system explicitly refuses.

**Key Characteristics:**
- Platform-sign header: line badge, section name, Japanese reading, a full-width 7px line-colour strip.
- Station cards: photo, 4px line-colour band, name, station badge + station name, category and price.
- Exit yellow for the single primary action on a screen.
- Bilingual by construction: Japanese is always set large in a Japanese gothic, never as decoration-only.
- Light theme for daylight, a night-platform dark theme via the system setting.

## Colors

Station-wall greys and white sign boards in navy ink; line colours as signals, exit yellow as the action.

### Primary
- **Exit Yellow** (#ffd400): the single primary action per screen (Open in Google Maps, add/FAB, empty-state "Add"), favourite marks, unread counts, the focus halo on inputs. Text on it is always Metro Navy.

### Secondary (line colours)
- **Ginza Orange** (#f39700): Еда.
- **Marunouchi Red** (#e60012): Места; also the app icon ring.
- **Hanzomon Purple** (#9b7cb6): Шопинг.
- **Chiyoda Green** (#009944): Отели.
- **Tozai Sky** (#00a7db): Гайды.
- Station badges use the official colours of Tokyo Metro, Toei, JR East and Osaka Metro lines (`src/domain/lines.ts`); an unknown line falls back to Navy Tertiary.

### Neutral
- **Metro Navy** (#1a1f36): all primary text, selected chips, primary buttons, the "Был" tag.
- **Navy Secondary** (#474d65): secondary text on the wall and on boards.
- **Navy Tertiary** (#636981): metadata on white boards only (contrast on the grey wall is too low).
- **Station Wall** (#eceef1): page background.
- **Sign White** (#ffffff) / **Sign White Sunken** (#f5f6f8): boards, cards, inputs; segmented tracks and placeholders.
- **Rule** (#dadde4) / **Rule Strong** (#b8bdca): hairlines; control borders.
- Night: wall #0d1020, sign #171b2d, ink #eef0f7. Station and line badges keep a white face in both themes, as real signs do.

### Named Rules
**The Exit Rule.** Exit Yellow marks the way out and nothing else: one yellow action per screen, plus favourites and counts. Never a background field, never decoration.

**The Line Rule.** Line colour appears only as rings, strips, bands and badges, at most a few pixels thick or inside a badge. Text never sits on a line colour except white kanji in an active line badge.

## Typography

**Body and Display Font:** Fira Sans (self-hosted, latin + cyrillic, weights 400/500/700/800) with -apple-system, Segoe UI fallback.
**Japanese:** Hiragino Sans / Yu Gothic UI / Meiryo, applied to every `lang="ja"` element.
**Character:** a humanist signage sans in the spirit of Frutiger on station boards, paired with the platform's own Japanese gothic.

### Hierarchy
- **Display** (800, 1.75rem phone / 2.1–2.2rem desktop, 1.15): section names on the platform sign, place names on the board.
- **Headline** (800, 1.45rem, 1.15): secondary screen titles.
- **Title** (700, 15.5–17px, 1.25): card names, panel titles, guide rows.
- **Body** (400, 16px, 1.45; guide prose 16.5px/1.6 at ≤76ch): reading text.
- **Label** (600, 13.5px): field labels; metadata 12.5–13.5px at 500.
- **Japanese** (600, 1.45rem on the board; up to 6rem on the "show in Japanese" board).

### Named Rules
**The Tabular Rule.** Prices, counts, times and positions use tabular numerals (`.num`).

## Layout

Phone-first single column, 16px gutters plus safe-area insets. Section screens: platform sign (full-bleed), a horizontally scrolling category rail (full-bleed), a filter row (city select + status segmented control), then a 2-column card grid (12px gap). From 600px the grid becomes `auto-fill, minmax(210px, 1fr)` with 16px gaps. From 900px the bottom line bar becomes a 252px left rail drawn as a vertical route diagram, the category rail wraps, content max-width is 1220px (place screen 860px). The place screen ends in a full-width "next station" board. Spacing steps: 6 / 8 / 12 / 16 / 22px.

## Elevation & Depth

Flat boards on a wall. Depth is a 1px rule plus one soft ambient shadow (`0 1px 2px rgb(26 31 54 / .06), 0 8px 22px rgb(26 31 54 / .07)`); dark theme drops to a near-invisible 1px shadow. Hover on desktop lifts cards 2px with a deeper shadow. The only floating elements are the yellow FAB and the round controls over a place photo (translucent white with blur, because they sit on photography).

## Shapes

Small, sign-like radii: 7–8px for controls and chips, 10px for boards and cards, 14px for sheets. Circles are reserved for line badges, station badges (Tokyo Metro, Toei, Osaka) and icon buttons; JR station numbers are rounded squares. Colour bands on rounded boards are drawn as inset shadows so they follow the curve.

## Components

### Buttons
- **Shape:** rounded rectangle (8px), 44px tall (54px for block actions).
- **Exit:** Exit Yellow fill, navy 700 text, leading icon and a trailing ↗ for external links.
- **Primary:** navy fill, white text. **Default:** white with a 1.5px strong rule. **Ghost:** transparent.
- **Hover / Focus:** darker yellow or navy-mix on hover (pointer devices only); 2.5px navy focus outline.

### Chips (category rail)
- **Style:** white sign plate, 1.5px strong rule, emoji mark, name, count in tertiary.
- **Selected:** navy plate with white text and a 4px line-colour bar inside its bottom edge. Empty categories fade to tertiary.

### Cards (station cards)
- **Corner Style:** 10px; photo 4:3 with `object-fit: cover`; a 4px line-colour band under the photo.
- **Content:** name (2 lines max), station badge + station name, category · price.
- **States:** favourite = yellow star disc on the photo; "Был" = navy tag and desaturated photo.

### Inputs / Fields
- **Style:** white, 1.5px strong rule, 8px radius, 46px tall, 16px text.
- **Focus:** navy border plus a yellow 3px halo.

### Navigation
- **Phone:** five line badges threaded on one 3px grey track at the bottom; active badge is filled with its line colour, label bolds.
- **Desktop:** the same badges as a vertical route diagram in the left rail, active row on a sunken plate; search, inbox (yellow count) and settings below.

### Station Badge (signature)
Ring (or JR square) in the line's official colour on a white face, line letters over the two-digit number, 25/34/44px. Without a code: a tertiary train pictogram.

### Platform & Next-Station Boards (signature)
Section header as a platform name sign with a full-width line strip; place screen ends with "← previous · n/N · next →" through the current filtered list, with swipe and arrow keys.

## Do's and Don'ts

### Do:
- **Do** keep exactly one Exit Yellow action per screen.
- **Do** show line colour as rings, strips and badges only (4–9px bands, 2.5–3.5px rings).
- **Do** set Japanese text with `lang="ja"` so it gets the Japanese gothic.
- **Do** give every place a station badge when the station number is known.

### Don't:
- **Don't** fill large areas with line colours or put body text on them.
- **Don't** use big rounded photo cards with a blue accent (the generic travel-app look the owner turned down).
- **Don't** draw thick coloured side borders on cards; bands go top or bottom as part of a sign, drawn as inset shadows on rounded boards.
- **Don't** use flag emoji (Windows renders them as letters).
