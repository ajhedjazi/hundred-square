# Andy's Man Club 100-Square Fundraiser

A small full-stack Node.js and Express app for running a charity 100-square fundraiser. Visitors reserve a square, then donate through your official fundraiser page. The app does not take card payments and does not use Stripe.

## Features

- Public 10x10 square grid from 1 to 100.
- Server-side reservation transaction to prevent duplicate square claims.
- PostgreSQL persistence through `DATABASE_URL`.
- Automatic table creation and first-start seed for all 100 squares.
- Admin page at `/admin` protected by `ADMIN_PASSWORD`.
- Admin filters, totals, mark-as-paid, and release actions.
- CSV export for all square entries from the admin page.
- Optional Resend email support, with console logging fallback.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Optional: create a local PostgreSQL database. If PostgreSQL is unavailable in development, the app falls back to `.data/reservations.json`, which is ignored by Git.

3. Copy `.env.example` to `.env` and fill in:

   ```bash
   DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
   ADMIN_PASSWORD=your-local-admin-password
   FUNDRAISER_URL=https://your-official-fundraiser-link
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000`.

The admin page is available at `http://localhost:3000/admin`.

## Email

If `RESEND_API_KEY` and `FROM_EMAIL` are present, reservation emails are sent through Resend from the server. Supporters receive a short confirmation email. If `ADMIN_NOTIFY_EMAIL` is also present, the organiser receives a detailed reservation email with the supporter details, selected squares, expected donation, and payment status reminder. If email is not configured or sending fails, the reservation still saves.

## Netlify Deployment

The repository includes `netlify.toml` with the required static publish and function redirects.

1. Create a production PostgreSQL database with a hosted provider such as Neon, Supabase, or Render Postgres. Netlify does not provide persistent local filesystem storage for production, so do not rely on `.data/reservations.json`.

2. Create a Netlify site from this GitHub repository.

3. Use these Netlify build settings:

   ```bash
   Build command: npm run build
   Publish directory: public
   Functions directory: netlify/functions
   ```

4. Add these environment variables in the Netlify dashboard. Do not commit these values to GitHub:

   ```bash
   DATABASE_URL=<your production PostgreSQL connection string>
   ADMIN_PASSWORD=<a strong private admin password>
   FUNDRAISER_URL=https://bit.ly/amir-gnr-amc
   NODE_ENV=production
   ADMIN_NOTIFY_EMAIL=<organiser notification email>
   RESEND_API_KEY=<your Resend API key>
   FROM_EMAIL=<verified Resend sender email>
   ```

5. Deploy the site. The public files are served statically from `public`, and `/api/*` requests are routed to `netlify/functions/api.js`.

6. Confirm these routes after deployment:

   ```bash
   /
   /admin
   /admin.html
   /api/health
   /api/reservations
   ```

Production requires `DATABASE_URL`, `ADMIN_PASSWORD`, and `FUNDRAISER_URL`. If `DATABASE_URL` is missing or cannot connect with `NODE_ENV=production`, startup fails instead of using local JSON storage.

On first startup against a production PostgreSQL database, the app creates the `squares` table if needed and seeds square records 1-100 without overwriting existing rows.

## Netlify Routes

- `/` is served from `public/index.html`.
- `/admin` redirects to `/admin.html`.
- `/api/health`, `/api/reservations`, `/api/squares`, and `/api/admin/*` are served by the Netlify Function at `netlify/functions/api.js`.
- API routes return JSON. They should not fall back to `index.html`.

## Verification

Run:

```bash
npm run build
npm test
git diff --check
```
