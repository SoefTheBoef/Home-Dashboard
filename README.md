# Home Dashboard

A personal, self-hosted household dashboard for two people. Covers a shared income/expense
tracker, household to-do list, bills tracker (including auto-generating fixed monthly bills),
shopping list, food inventory, a color-coded shared calendar for work schedules and appointments,
a recycling collection calendar, Islamic prayer times, a photo slideshow, a live travel countdown,
and an AI assistant grounded in the household's own data.

## Tech stack

- **[SvelteKit](https://svelte.dev/docs/kit)** — full-stack framework, server routes + UI in one app.
- **Postgres** (via `pg`) — local dev runs it in Docker; production uses a free external
  [Neon](https://neon.tech) instance (Render's own Postgres is no longer free long-term).
- **bcryptjs** — password hashing.
- **Tailwind CSS v4** — styling.
- **[Claude API](https://console.anthropic.com)** (`@anthropic-ai/sdk`) — powers the chat assistant
  and "what can we cook" dish suggestions; optional (see [AI assistant setup](#ai-assistant-setup)).
- **[adhan](https://github.com/batoulapps/adhan-js)** — Islamic prayer time calculation.
- **pdf-parse** — text extraction for re-importing the recycling collection calendar PDF.
- Session-cookie auth (random token, session stored server-side in Postgres) — no third-party auth
  service, works fine offline on a home network.

## Deploy to Render

The web service is defined in `render.yaml`, so deploying is mostly one click. The database is
**not** included in the blueprint — Render no longer offers a genuinely free long-term Postgres,
so this app connects to a free external [Neon](https://neon.tech) database instead. A handful of
things can't be automated:

1. **Create a free Neon Postgres database.** Sign up at [neon.tech](https://neon.tech) (no credit
   card required for the free tier), create a project (this creates a database for you too), and
   from the project dashboard copy the **connection string** (looks like
   `postgres://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require`). Keep it handy
   for step 3.

2. **Create a [Render](https://render.com) account, connect this GitHub repo, and deploy the
   blueprint.** In the Render dashboard: **New +** → **Blueprint** → select this repo → **Apply**.
   Render creates the web service and generates the two household account passwords automatically
   (find them later under your service's **Environment** tab, as `SEED_USER1_PASSWORD` /
   `SEED_USER2_PASSWORD`).

3. **Add your Neon connection string.** On your new web service, open the **Environment** tab and
   paste the connection string from step 1 into `DATABASE_URL`, then click **Save Changes** (this
   triggers a redeploy automatically).

4. **Add your Spotify credentials.** On the same **Environment** tab, paste your existing Spotify
   Client ID and Client Secret into `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. (Skip this if
   you don't use the Spotify integration.)

5. **Add your Anthropic API key.** On the same **Environment** tab, paste a Claude API key from
   [console.anthropic.com](https://console.anthropic.com) into `ANTHROPIC_API_KEY`. (Skip this if
   you don't want the AI assistant / dish-suggestion features — the rest of the app works fine
   without it.)

6. **Point Spotify at your production URL.** Spotify requires an exact match, so this has to be
   done manually:
   1. On your Render service's page, copy the URL shown at the top (looks like
      `https://home-dashboard-xxxx.onrender.com`).
   2. Still in the **Environment** tab, set `SPOTIFY_REDIRECT_URI` to that URL with
      `/spotify/callback` appended — e.g. `https://home-dashboard-xxxx.onrender.com/spotify/callback`
      — and click **Save Changes** (this triggers a redeploy automatically).
   3. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → your app
      → **Settings**.
   4. Under **Redirect URIs**, click **Add**, paste the *exact same URL* from step 2, then click
      **Add** again to confirm it.
   5. Click **Save** at the bottom of the Spotify settings page.

Once the deploy finishes, visit your Render URL and log in with `alice` or `bob` (usernames from
`render.yaml`) and the generated password from step 2. Go to `/spotify` to connect Spotify.



## Requirements (local development)

- Node.js **22.5+**.
- Docker, to run Postgres locally (`docker compose up -d`).

## Setup

1. Start local Postgres:

   ```bash
   docker compose up -d
   ```

2. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Fill in `SEED_USER1_PASSWORD` and `SEED_USER2_PASSWORD` — the two household accounts are
   created automatically the first time the app starts, using the `SEED_USER1_*`/`SEED_USER2_*`
   values in `.env`.

   (Optional) To let either of you play a shared playlist from the dashboard, also fill in the
   Spotify variables — see [Spotify setup](#spotify-setup) below.

3. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

   This starts the dev server on [http://localhost:5173](http://localhost:5173). Sign in with
   either of the two accounts from step 2.

   To change a password (or add/rename an account) later without touching env vars, run
   `npm run setup:users` for an interactive prompt.

## Features

- **Finances** (`/finances`) — three tabs on one page:
  - *Income & Expenses* — log transactions (amount, category, date, description, who logged it),
    filter by date range/category/type, view running balance and this month's category breakdown,
    export to CSV.
  - *Bills* — one-off bills with due date and paid status; overdue and due-soon bills are
    highlighted, and marking a bill paid logs a matching expense automatically. Bills can also be
    set up as **fixed monthly** (name, amount, due day of month) — a new unpaid entry is generated
    each month automatically.
  - *Subscriptions* — separate recurring-subscription tracker (name, amount, billing cycle, next
    charge date) with a renewing-soon highlight; not linked to the expense tracker.
- **To-dos** — shared household task list with optional notes, due date, and assignee
  (either person, or unassigned = "either").
- **Shopping list** — quick add/check-off/clear grocery list; seeded from the household's original
  spreadsheet.
- **Food Inventory** (`/food`) — pantry/freezer inventory by category with quantity steppers and a
  low-stock flag; seeded from the household's original spreadsheet. Includes a "What can we cook?"
  button (needs the AI assistant configured) that suggests dishes prioritizing low-stock and
  perishable items — plan a suggestion on the meal planner, then use its **Confirm cooked** /
  **Add missing to shopping** buttons to decrement inventory or fill gaps.
- **Calendar** (`/calendar`) — four tabs on one page:
  - *Calendar* — month view of work shifts and appointments, color-coded per person (or gray for
    events that apply to both), plus recurring weekly work-schedule generation.
  - *Recycling* — a full dated IGEAN collection calendar (not just a weekly pattern), with a
    prominent "next collection" banner on the home page and living room display, inline
    add/edit/delete per date, and a PDF re-import flow (the AI assistant parses next year's
    calendar PDF into a schedule you review before it replaces anything).
  - *Travel* — upcoming/past trips with a live ticking countdown (days/hours/minutes/seconds) and
    milestone track to the next one.
  - *Prayer Times* — today's six prayer times for Aartselaar (Muslim World League method, Hanafi
    madhab for Asr, via `adhan`) with a live countdown to the next prayer.
- **Photos** — upload photos; the home page shows them as an auto-cycling slideshow. Manage
  (upload/delete) at `/photos`.
- **Spotify** (`/spotify`, optional) — connect a Spotify account and pick a playlist to control
  (play/pause/skip/volume) from the dashboard and the living room display. See
  [Spotify setup](#spotify-setup).
- **Assistant** (`/assistant`, optional) — a chat interface grounded in the household's own food
  inventory, shopping list, calendar, bills, and to-dos, with a visible "can see" panel for
  transparency. See [AI assistant setup](#ai-assistant-setup).
- **Home page** — today's schedule, bills due soon, open to-dos, running balance, next recycling
  collection, live travel countdown, prayer-time countdown, weather, and the photo slideshow at a
  glance.
- **Living room display** (`/display`) — a kiosk-style view for a shared tablet/screen: today's
  weather + forecast, schedule, bills, meal plan, to-dos, shopping list, next recycling collection,
  travel and prayer-time countdowns, notes, and Spotify controls, with a screensaver photo
  slideshow after a few idle minutes.

All currency is shown in euros (Belgian formatting, e.g. `1.234,56 €`) and all dates/times use the
Belgian `DD/MM/YYYY`, 24-hour format, computed in the `Europe/Brussels` timezone regardless of
where the server itself is hosted.

## Spotify setup

Optional — the rest of the app works fine without it. For local development:

1. Create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add `http://127.0.0.1:5173/spotify/callback` as a Redirect URI on that app (Spotify requires
   the literal loopback IP, not `localhost`, for local redirect URIs — access the app at that same
   address in your browser so cookies match during the OAuth flow).
3. Copy the Client ID and Client Secret into `.env`:

   ```bash
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/spotify/callback
   ```

4. Restart the app, go to `/spotify`, and click **Connect Spotify**.
5. Pick a playlist — it's now controllable from the home page and living room display.

Playback controls act on whatever device is currently active in Spotify Connect (phone, speaker,
computer), not the browser itself — open Spotify on a device first if the controls report "no
active device."

For the production (Render) setup, see [Deploy to Render](#deploy-to-render) above.

## AI assistant setup

Optional — powers both the `/assistant` chat page and the food inventory's "What can we cook?"
button through one shared service (`src/lib/server/ai.ts`); the rest of the app works fine without
it.

1. Create an API key at [console.anthropic.com](https://console.anthropic.com).
2. Add it to `.env`:

   ```bash
   ANTHROPIC_API_KEY=...
   ```

3. Restart the app. The assistant only ever reads food inventory, the shopping list, upcoming
   calendar events, unpaid bills, and open to-dos — never writes — and the chat page shows exactly
   which of those it can see.

For the production (Render) setup, see [Deploy to Render](#deploy-to-render) above.

## Data & backups

Data lives in the Postgres database (`DATABASE_URL`) and, for uploaded photos, in `PHOTOS_DIR`
(a Render Persistent Disk in production; `./data/uploads/photos` locally). Back up the database
with `pg_dump`, and copy the photos directory/disk separately.
