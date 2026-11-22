# ConnectX hosted deployment

ConnectX uses Render for the Express + Socket.IO API and Neon for PostgreSQL.

## 1. Create the Neon database

1. Create a PostgreSQL project in Neon.
2. Open **Connect** in the Neon console.
3. Copy both connection strings:
   - **Pooled** connection string (hostname contains `-pooler`) → Render's `DATABASE_URL`.
   - **Direct** connection string (hostname does not contain `-pooler`) → Render's `DIRECT_URL`.
4. Keep the credentials private. Do not commit either connection string to GitHub or share them in chat.

Both strings should include `sslmode=require`. Prisma uses the pooled URL for normal application traffic and the direct URL for schema migrations.

## 2. Deploy the API to Render

1. In Render, choose **New → Blueprint** and connect the `carjam120443-netizen/connectX` GitHub repository.
2. Select the `main` branch. Render detects this `render.yaml` file and proposes the `connectx-api` web service.
3. When prompted, enter the Neon pooled URL for `DATABASE_URL` and the Neon direct URL for `DIRECT_URL`.
4. Render generates `JWT_SECRET` automatically from the Blueprint configuration.
5. Create the Blueprint and wait for the first deploy to finish.

The service runs Prisma migrations, creates the starter space if needed, and starts the API. The health endpoint is `https://YOUR-RENDER-SERVICE.onrender.com/api/health`.

## 3. Point desktop builds at the hosted API

After Render gives the service its public URL:

1. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables**.
2. Create a repository variable named `VITE_API_URL`.
3. Set its value to the Render service's HTTPS origin, for example `https://connectx-api.onrender.com` (no trailing slash).
4. Run the **Build and release desktop installers** workflow on `main`.

Both Windows and Linux builds read this variable at build time. New installers will default to the hosted API. Packaged builds also ignore an old saved localhost address and use the hosted default instead; users can still enter a different HTTPS server address.

## Notes

- The API needs the Render environment variables `DATABASE_URL`, `DIRECT_URL`, and `JWT_SECRET`. Never put database credentials or JWT secrets in the desktop app or GitHub source.
- The API listens on Render's `PORT` and binds to `0.0.0.0`.
- Render checks `/api/health` after deployment.
- The current account system does not yet include email verification or password recovery.
- Free hosting plans may sleep or scale the database to zero after inactivity, so the first request after a quiet period can take longer.
