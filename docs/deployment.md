# Deployment

> **Status: not deployed yet.** The production image builds, creates its schema on an empty database, serves the client and answers `/health`; CI checks this on every PR (the smoke test in `.github/workflows/ci.yml`). It hasn't been run on the target host yet. This page describes the intended setup; fill in the exact steps once it has.

## Target

A Docker host on a private network (a NAS, home server or similar), reachable from the LAN only. No inbound internet access is assumed, so nothing may rely on webhooks.

## Intended setup

- **Image:** the root `Dockerfile` builds the client and server and produces one image. The API serves the built client, so there's one port (3000).
- **Delivery:** either GitHub Actions builds and pushes `ghcr.io/cynicollision/moped-finance` (the commented-out job in `.github/workflows/ci.yml`) and the host pulls it, or you build the image on the host.
- **Run:** `docker-compose.prod.yml` next to a `.env` on the host. It runs the `moped-finance-api` and `moped-finance-db` containers, with Postgres data in the `moped-finance_db_data` volume. Set the image with `DOCKER_IMAGE`.
- **Config:** the same variables as `.env.example`. In production, use a strong `SESSION_SECRET`. Set `COOKIE_SECURE=true` only if the app is served over HTTPS.
- **Time zone:** set `TZ` in `.env` to your IANA zone (for example `America/New_York`); the compose files pass it to both containers and default to UTC. The server works out "today" and Cashflow period boundaries in this zone (APP-5.6). Postgres only stores calendar dates and `TIMESTAMPTZ`, so its zone affects log output, and it only reads `TZ` when the data volume is first initialized.
- **Database schema:** nothing to run by hand. On every start the server applies any migrations the image has that the database hasn't run yet, then starts listening (APP-5.8). On an empty database that creates everything. If a migration fails, it's rolled back, the error is in `docker logs moped-finance-api`, and the container exits; `restart: always` retries, so it shows as restarting until fixed. The same happens if Postgres isn't accepting connections yet, for example while the host boots, and clears up once it is.
- **First user:** the first person to register owns the instance, and registration closes after that (AUTH-2.7, AUTH-7.2). Register right after the first start, before anyone else on the network can reach the app. There's no seeded or default user in production; `SEED_USER_*` and `db:seed` are for development only.
- **Health:** `GET /health` returns 200 when the API can reach the database and 503 otherwise (APP-5.3). `docker-compose.prod.yml` uses it as the `api` health check, so `docker ps` shows `unhealthy` when the database is unreachable.
- **Stopping and updating:** on `docker stop` the API finishes in-flight requests for up to 25 seconds before exiting (APP-5.2); `stop_grace_period: 30s` gives it room before Docker kills it. To update, pull or build the new image and `docker compose -f docker-compose.prod.yml up -d`; the new container migrates the database as it starts. Migrations only go forward, so back up the database before an update that includes one, in case you need to return to the old image.

## Still to decide

These are tracked in `TODO.md` under "Next":

- Backup and restore for the database volume.
- How images are delivered (GHCR from CI, or built on the host).
