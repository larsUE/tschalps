# Tschalps – Architecture

Archive and community hub for Tschalps (Kantonsschule Küsnacht, René Tschanz): one-week alpine traverses, no villages, all food carried, nights in barns and stables.

## Goals

- **Archive**: every past Tschalps with route (GPX per day), reports and a small photo selection.
- **Explore**: a shared map of places to sleep (stables, barns, huts, water sources) with recommendations.
- **Map-first**: the map is the main navigation; GPX download everywhere.
- **Members only**: no public content. Admins invite by e-mail.

### Out of scope (for now)

Offline/PWA use, route planning, multiple languages, SSO.

## Key facts that shape the design

| Fact                                                 | Consequence                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| ~40–50 tours, ~1 GPX per day                         | ~300 stages in total, tiny dataset                                            |
| ~100 members                                         | No scaling concerns; a single server is plenty                                |
| 5–10 photos per tour + photos on places              | ~1–2 GB of images in total; local disk is fine                                |
| Hosted on the maintainer's Infomaniak server (Swiss) | Self-hosted Node app, local storage, Swiss SMTP                               |
| UI in Swiss Standard German                          | German strings directly, `ss` instead of `ß`, `de-CH` date and number formats |
| Single maintainer                                    | Keep the number of moving parts minimal                                       |

## Stack

| Layer             | Choice                                                                                                   | Notes                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Framework         | **SvelteKit** (Svelte 5, TypeScript), `@sveltejs/adapter-node`                                           | Runs as one Node process                                                                                                              |
| Database          | **SQLite** (WAL mode) via **Drizzle ORM** + `better-sqlite3`                                             | No database server to run. Backup is a single file. Drizzle can migrate to Postgres later if needed                                   |
| Spatial data      | Stored as GeoJSON + bounding-box columns, processed with **turf**                                        | At ~300 routes and a few thousand places, PostGIS isn't needed. All places can go to the client in one request and be clustered there |
| Auth              | **Better Auth**: `emailOTP` plugin (6-digit code), sign-up disabled, `admin` plugin for user management  | A code works when the e-mail is read on a phone but the site is open on a laptop, and e-mail link scanners can't use it up            |
| E-mail            | **Nodemailer** via Infomaniak SMTP                                                                       | Keeps everything in Switzerland                                                                                                       |
| Map               | **MapLibre GL JS** via `svelte-maplibre-gl`                                                              |                                                                                                                                       |
| Base maps         | **swisstopo** (geo.admin.ch): national map (colour), light basemap, aerial imagery; hiking-trail overlay | Free with attribution. Switchable fallback outside CH: OpenTopoMap                                                                    |
| GPX parsing       | `@tmcw/togeojson` + `@xmldom/xmldom` (server-side)                                                       | Original file kept for download; simplified line used for display                                                                     |
| Route stats       | `@turf/length`, `@turf/simplify`, `@turf/bbox` + own ascent/descent calculation with smoothing           |                                                                                                                                       |
| Elevation profile | Own SVG component (`d3-scale`, `d3-shape`)                                                               | Hovering the profile moves a marker on the map                                                                                        |
| Place elevation   | swisstopo height service (`api3.geo.admin.ch`, LV95 coordinates converted locally)                       | Filled in when a place is saved without a height; only the coordinates are sent                                                       |
| Images            | **sharp** (resize to 2 sizes, convert to WebP, strip metadata) + **exifr** (GPS and time read on upload) | Originals not kept, to save space                                                                                                     |
| File storage      | Local directory **outside** the web root, served only through an authenticated endpoint                  | Never put uploads in `static/`                                                                                                        |
| Reports           | Markdown (textarea + preview), rendered with `marked` + `sanitize-html`                                  |                                                                                                                                       |
| Styling           | Tailwind CSS v4 (optional)                                                                               |                                                                                                                                       |
| Testing           | Vitest (GPX parsing, permissions) + Playwright (login flow, smoke tests)                                 |                                                                                                                                       |
| Process           | systemd behind Caddy or nginx on the Infomaniak VPS Cloud                                                |                                                                                                                                       |
| Backups           | Nightly `sqlite3 .backup` + rsync of the uploads dir to Infomaniak Swiss Backup                          | Essential, because this is self-hosted                                                                                                |

## Roles & permissions

| Action                                                | Member                        | Admin |
| ----------------------------------------------------- | ----------------------------- | ----- |
| View everything                                       | ✓                             | ✓     |
| Create a Tschalps, upload GPX, reports, photos        | ✓                             | ✓     |
| Edit or delete a Tschalps                             | creator + linked participants | ✓     |
| Create or edit places, mark as "existiert nicht mehr" | ✓                             | ✓     |
| Remove a place (soft delete, visible in history)      | ✓                             | ✓     |
| Restore or hard-delete places, revert edits           |                               | ✓     |
| Comment, add place photos                             | ✓                             | ✓     |
| Invite and remove members                             |                               | ✓     |

_Decided: any member can create a tour entry._

Because anyone can edit or remove places without approval, every change is written to a **revision log** so that mistakes and vandalism can be reverted.

## Data model

```
user                 id, email, name, role(admin|user), createdAt      (+ Better Auth: session, verification)

tour                 id, slug, title, year, season, startDate, endDate,
                     summaryMd, createdBy, createdAt, updatedAt
tour_participant     tourId, userId, isLeader
stage                id, tourId, dayIndex, date, title, reportMd,
                     gpxPath, geojson (simplified LineString), bbox[4],
                     distanceM, ascentM, descentM, minEle, maxEle,
                     nightPlaceId → place                 ← links archive to explore
tour_photo           id, tourId, stageId?, path, caption, lat?, lng?, takenAt?, uploadedBy
                     (max 10 per tour, enforced server-side)

place                id, name, type(stall|scheune|huette|biwak|wasser|anderes),
                     lat, lng, ele, description, access,
                     status(aktiv|existiert_nicht_mehr|unbekannt),
                     createdBy, updatedBy, createdAt, updatedAt, deletedAt
place_revision       id, placeId, userId, at, action(create|update|status|delete|restore), snapshot(JSON)
place_comment        id, placeId, userId, visitedOn?, body, createdAt
place_photo          id, placeId, path, caption, takenAt?, uploadedBy
```

Each place shows "Hier übernachtet" automatically: the stages whose `nightPlaceId` points to it.

## Pages (German URLs)

| Route                                                                | Content                                                                                                          |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/login`                                                             | E-mail, then a 6-digit code                                                                                      |
| `/karte`                                                             | Main map: all tours (coloured by year), places (clustered), filters by year and place type, sidebar with details |
| `/tschalps`                                                          | List of tours by year                                                                                            |
| `/tschalps/[slug]`                                                   | Tour map with stages, elevation profile, daily reports, photos, downloads                                        |
| `/tschalps/neu`, `/tschalps/[slug]/bearbeiten`                       | Create or edit, upload GPX per day                                                                               |
| `/orte/[id]`                                                         | Place detail: info, status, comments, photos, nights, history                                                    |
| `/admin/mitglieder`                                                  | Invite, remove, change role                                                                                      |
| `/api/files/[...path]`                                               | Authenticated image delivery                                                                                     |
| `/api/gpx/stage/[id]`, `/api/gpx/tour/[slug]`, `/api/gpx/orte?bbox=` | Downloads: original stage GPX, merged tour GPX, places as GPX waypoints                                          |

All routes except `/login` and `/api/auth/*` are protected in `hooks.server.ts`.

## Project structure

```
src/
  hooks.server.ts               auth guard
  lib/server/
    db/schema.ts, db/index.ts   Drizzle + SQLite
    auth.ts                     Better Auth config
    mail.ts                     Nodemailer / Infomaniak SMTP
    gpx.ts                      parse, stats, simplify, merge, waypoint export
    images.ts                   sharp + exifr
    storage.ts                  paths outside web root
    permissions.ts
  lib/map/                      Map.svelte, layers (swisstopo/OpenTopoMap), TourLayer, PlaceLayer, ElevationProfile
  routes/                       see "Pages" above
scripts/
  import-archive.ts             bulk import of historic tours
drizzle/                        migrations
```

## Importing the archive

There are 40–50 historic tours, so they come in through a CLI script rather than the UI:

```
import/
  2019-sommer-gotthard/
    meta.yaml        title, year, season, dates, participants (e-mails), summary
    tag1.gpx  tag2.gpx  …
    tag1.md   …      optional reports
    fotos/           optional, max 10
```

`pnpm import ./import` creates the tours and stages, computes stats, and reports anything that couldn't be parsed.

## Build order

1. **Setup & deploy**: SvelteKit + Drizzle + SQLite, deployed early to Infomaniak (an empty page behind login).
2. **Auth & members**: Better Auth e-mail OTP, sign-up disabled, admin invite page, route guard.
3. **Map shell**: MapLibre with the swisstopo layers and a layer switcher.
4. **Tours & GPX**: create a tour, upload a GPX per day, stats, map display, elevation profile, downloads.
5. **Archive import script**.
6. **Places**: add by map click, edit, status, soft delete, revision log, comments, link nights to stages, waypoint export.
7. **Photos**: tour photos (max 10) and place photos, resizing, positions from EXIF, protected delivery.
8. **Reports & polish**: Markdown per stage, search and filters, mobile layout, backups.
