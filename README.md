# Andy's Man Club 100-Square Fundraiser

A small full-stack Node.js and Express app for running a charity 100-square fundraiser. Visitors reserve a square, then donate through your official fundraiser page. The app does not take card payments and does not use Stripe.

## Features

- Public 10x10 square grid from 1 to 100.
- Server-side reservation transaction to prevent duplicate square claims.
- PostgreSQL persistence through `DATABASE_URL`.
- Automatic table creation and first-start seed for all 100 squares.
- Admin page at `/admin` protected by `ADMIN_PASSWORD`.
- Admin filters, totals, mark-as-paid, and release actions.
- Optional Resend email support, with console logging fallback.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local PostgreSQL database.

3. Copy `.env.example` to `.env` and fill in:

   ```bash
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/hundred_square
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

If `RESEND_API_KEY` and `FROM_EMAIL` are present, reservation emails are sent through Resend. If either value is missing, the app still works and logs the email content to the server console.

## Render Deployment

1. Create a Render Postgres database.
2. Create a Render web service from this repository.
3. Set the build command:

   ```bash
   npm install && npm run build
   ```

4. Set the start command:

   ```bash
   npm start
   ```

5. Add these environment variables to the Render web service:

   ```bash
   DATABASE_URL=<your Render Postgres connection string>
   ADMIN_PASSWORD=<a strong admin password>
   FUNDRAISER_URL=<your official Andy's Man Club fundraiser URL>
   ```

6. Optional email variables:

   ```bash
   RESEND_API_KEY=<your Resend API key>
   FROM_EMAIL=<verified sender email>
   ```

On first startup, the app creates the `squares` table if needed and seeds square records 1-100 without overwriting existing rows.

## Verification

Run:

```bash
npm run build
npm test
git diff --check
```
