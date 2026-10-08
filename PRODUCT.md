# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Confirmed by the owner in the plan: PWA on Vite 8 + Preact 10 + TypeScript, installed to the iPhone home screen from Safari and as an app from Edge/Chrome on Windows. Supabase (shared project with the owner's "Планер" app) for login, data and photos; Dexie (IndexedDB) local copy; GitHub Pages hosting. Skeleton reused from `../life-planner`.

## Users
- **Owner** — a Russian-speaking traveller planning a trip to Japan in 2027. Collects places for months at home (Windows PC) and uses the app equally on the phone during the trip — on the street, often one-handed, between trains.
- **Companions** (optional, invited by the owner): an *administrator* can add and edit; a *viewer* only looks.

## Product Purpose
One place for everything the owner has gathered about Japan: restaurants, sights and entertainment, shops, hotels, and practical guides (rail passes, money and exchange, connectivity, documents, etiquette). Today it is scattered across Plotline, Instagram/TikTok saves, Google Maps lists, Notion, Telegram, notes and files; Plotline in particular became a jumble with no own categories.

Success: in a few taps find "a tonkatsu place in Osaka" or "how the Suica works", show the Japanese name to a taxi driver or staff, open the place in Google Maps; and keep adding new finds easily.

## Positioning
Not a discovery feed and not someone else's ranking (Tabelog, Plotline, Mapstr): it is the owner's own curated collection, organized by the owner's own categories inside each section, with practical guides living next to the places — and Claude as a helper that fills in Japanese names, nearest stations, map links and photos.

## Operating Context
- Internet is expected in Japan (eSIM/roaming); the app works online. Offline is a safety net for dead zones and the subway: data is stored on the device, and a "download everything" action caches all photos ahead of time.
- Typical in-trip actions: pick section → category chip → city → open a place → "Show in Japanese" / "Open in Google Maps".
- Typical at-home actions: add a place with a photo, sort into categories, edit guides, triage the inbox of raw links; bulk imports done by Claude via CLI.
- Expected volume: 100–300 places across sections (owner's estimate), a dozen or two guides.

## Capabilities and Constraints
- Sections: Еда (food), Места (sights and fun), Шопинг (shopping), Отели (hotels), Гайды (guides); plus Входящие (inbox) and Настройки (settings, members, offline download).
- Category chips per section, editable list. No chip selected = all places of the section. Extra filters: city; want / been / favorite. Search across everything.
- Place card: photo, name, nearest station (+ city, price). Place screen: Japanese name, station, address, hours, price, note, source links (reels), Google Maps.
- Roles: owner / administrator / viewer; viewers see no editing controls.
- Map view is deferred to a later stage (for now: "Open in Google Maps").
- UI language: Russian. Japanese text (place and station names) must render well.
- Owner is in Russia: no Cloudflare, no Firebase. No flag emoji (Windows does not render them).
- Public repository: no personal data in code or demo content.

## Evidence on Hand
- No real place data in the repo; the owner's places live in Supabase and are imported later by Claude. Demo/screenshots use synthetic places labeled as demo.
- No logo or brand assets exist yet.

## Product Principles
1. The owner's own structure first: sections and categories the owner defines, not a feed.
2. Fast on the street: the answer is two taps away, one-handed, legible in daylight.
3. Japanese is a tool: the Japanese name and station are always one tap from being shown to someone.
4. Capture is cheap: a link dropped into the inbox now, sorted later.
5. Never lose it: works through dead zones; nothing depends on a single online moment.
