# Home Dashboard

A personal, self-hosted household dashboard for two people. Covers a shared income/expense
tracker, household to-do list, bills tracker (including auto-generating fixed monthly bills),
shopping list, a color-coded shared calendar for work schedules and appointments, a photo
slideshow, and a travel countdown.

## Tech stack

- **[SvelteKit](https://svelte.dev/docs/kit)** — full-stack framework, server routes + UI in one app.
- **Postgres** (via `pg`) — local dev runs it in Docker; production (Render) uses a managed instance.
- **bcryptjs** — password hashing.
- **Tailwind CSS v4** — styling.
- Session-cookie auth (random token, session stored server-side in Postgres) — no third-party auth
  service, works fine offline on a home network.

## Deploy to Render

The whole app (web service + database) is defined in `render.yaml`, so deploying is mostly one
click. Only three things can't be automated:

1. **Create a [Render](https://render.com) account, connect this GitHub repo, and deploy the
   blueprint.** In the Render dashboard: **New +** → **Blueprint** → select this repo → **Apply**.
   Render creates the web service and Postgres database together, and generates the two household
   account passwords automatically (find them later under your service's **Environment** tab, as
   `SEED_USER1_PASSWORD` / `SEED_USER2_PASSWORD`).

2. **Add your Spotify credentials.** On your new web service, open the **Environment** tab and
   paste your existing Spotify Client ID and Client Secret into `SPOTIFY_CLIENT_ID` and
   `SPOTIFY_CLIENT_SECRET`. (Skip this if you don't use the Spotify integration.)

3. **Point Spotify at your production URL.** Spotify requires an exact match, so this has to be
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
`render.yaml`) and the generated password from step 1. Go to `/spotify` to connect Spotify.

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
- **Shopping list** — quick add/check-off/clear grocery list.
- **Calendar** (`/calendar`) — three tabs on one page:
  - *Calendar* — month view of work shifts and appointments, color-coded per person (or gray for
    events that apply to both), plus recurring weekly work-schedule generation.
  - *Recycling* — weekly/biweekly collection reminders, surfaced on the home page and living room
    display when collection is today or tomorrow.
  - *Travel* — upcoming/past trips with a large animated countdown (icon, milestone track) to the
    next one.
- **Photos** — upload photos; the home page shows them as an auto-cycling slideshow. Manage
  (upload/delete) at `/photos`.
- **Spotify** (`/spotify`, optional) — connect a Spotify account and pick a playlist to control
  (play/pause/skip/volume) from the dashboard and the living room display. See
  [Spotify setup](#spotify-setup).
- **Home page** — today's schedule, bills due soon, open to-dos, running balance, travel
  countdown, weather, and the photo slideshow at a glance.
- **Living room display** (`/display`) — a kiosk-style view for a shared tablet/screen: today's
  weather + forecast, schedule, bills, meal plan, to-dos, shopping list, travel countdown, notes,
  and Spotify controls, with a screensaver photo slideshow after a few idle minutes.

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

## Data & backups

Data lives in the Postgres database (`DATABASE_URL`) and, for uploaded photos, in `PHOTOS_DIR`
(a Render Persistent Disk in production; `./data/uploads/photos` locally). Back up the database
with `pg_dump`, and copy the photos directory/disk separately.
