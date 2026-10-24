# Deployment

> **Status: not deployed yet.** The production image builds, creates its schema on an empty database, serves the client and answers `/health`, and its host commands work; CI checks this on every PR (the smoke test in `.github/workflows/ci.yml`) and publishes the image from `main`. It hasn't been run on the target host yet. This page describes the intended setup; fill in the exact steps once it has.

## Target

A Docker host on a private network (a NAS, home server or similar), reachable from the LAN only. No inbound internet access is assumed, so nothing may rely on webhooks.

## Intended setup

- **Image:** the root `Dockerfile` builds the client and server and produces one image. The API serves the built client, so there's one port (3000).
- **Delivery:** CI's publish job pushes `ghcr.io/cynicollision/moped-finance` (public, `linux/amd64`) once the other jobs pass: `latest` and `sha-<commit>` for every push to `main`, and `0.1.0` and `0.1` for a release tag `v0.1.0`. The host pulls it; no sign-in is needed. To run something else, such as a release or an image built on the host (`docker build -t moped-finance .`), set `DOCKER_IMAGE`.
- **Run:** `docker-compose.prod.yml` next to a `.env` on the host. It runs the `moped-finance-api` and `moped-finance-db` containers, with Postgres data in the `moped-finance_db_data` volume. The app is on port 3000 of the host; set `APP_PORT` to use another.
- **Config:** the same variables as `.env.example`. `SESSION_SECRET` is optional: without it, the server generates a random one on first start and keeps it in the database (`core.secrets`), so sessions survive restarts (AUTH-3.6, AUTH-3.7). If you set it, use a long random value. Sessions are stored in `core.sessions`.
- **Sign-in protection:** after 5 failed sign-ins from one address within 15 minutes, that address is refused for 15 minutes (AUTH-10). `SIGN_IN_MAX_FAILED_ATTEMPTS`, `SIGN_IN_WINDOW_MINUTES` and `SIGN_IN_LOCKOUT_MINUTES` change those numbers (see `.env.example` for the ranges); a value out of range stops the container from starting, with the reason in `docker logs moped-finance-api`. Lockouts are logged as warnings and kept in memory, so restarting the container (`docker restart moped-finance-api`) clears them.
- **Forgotten password:** run `docker exec -it moped-finance-api npm run reset-password` on the host (AUTH-12). It shows the username, asks for a new password twice without showing it, and signs out every device; API tokens keep working. To script it, pipe in the password and its confirmation on two lines (`-i` instead of `-it`). The Login screen's **Forgot password?** shows the same command.
- **Time zone:** set `TZ` in `.env` to your IANA zone (for example `America/New_York`); the compose files pass it to both containers and default to UTC. The server works out "today" and Spending period boundaries in this zone (APP-5.6). Postgres only stores calendar dates and `TIMESTAMPTZ`, so its zone affects log output, and it only reads `TZ` when the data volume is first initialized.
- **Database schema:** nothing to run by hand. On every start the server applies any migrations the image has that the database hasn't run yet, then starts listening (APP-5.8). On an empty database that creates everything. If a migration fails, it's rolled back, the error is in `docker logs moped-finance-api`, and the container exits; `restart: always` retries, so it shows as restarting until fixed. The same happens if Postgres isn't accepting connections yet, for example while the host boots, and clears up once it is.
- **First user:** the first person to register owns the instance, and registration closes after that (AUTH-2.7, AUTH-7.2). Register right after the first start, before anyone else on the network can reach the app. There's no seeded or default user in production; `SEED_USER_*` and `db:seed` are for development only.
- **Starting over and sample data:** `docker exec -it moped-finance-api npm run wipe-database` deletes everything, the user included, after you type `wipe`, and leaves the instance as on first start (APP-10.1). Restart the app afterwards. `docker exec moped-finance-api npm run load-sample-data` fills an empty instance with the synthetic data in `server/seed-data/`, its dates moved up to this month (APP-10.3, APP-10.4), to try the app out before entering real data; run it before or after registering, and wipe before starting for real.
- **Logs:** errors go to `docker logs moped-finance-api` and to the `core.logs` table, which keeps the last 90 days; the server deletes older entries when it starts and once a day (APP-5.10). `LOG_RETENTION_DAYS` (7 to 3650) changes the period, and a value out of range stops the container from starting.
- **Health:** `GET /health` returns 200 when the API can reach the database and 503 otherwise (APP-5.3). `docker-compose.prod.yml` uses it as the `api` health check, so `docker ps` shows `unhealthy` when the database is unreachable.
- **Stopping and updating:** on `docker stop` the API finishes in-flight requests for up to 25 seconds before exiting (APP-5.2); `stop_grace_period: 30s` gives it room before Docker kills it. To update, pull or build the new image and `docker compose -f docker-compose.prod.yml up -d`; the new container migrates the database as it starts. Migrations only go forward, so [back up](#backup-and-restore) before every update: if an update's migration fails or the new version misbehaves, restoring that backup is the only way back to the old image.

## Backup and restore

Everything the app stores is in the Postgres database, so a backup is a dump of it, made with `pg_dump` inside the `moped-finance-db` container. That container already knows the user and database names (`POSTGRES_USER`, `POSTGRES_DB`), so the commands below work as they are, from any folder on the host. Back up the dump files, not the `moped-finance_db_data` volume: a copy of a running database's files may not restore.

**Back up:**

```sh
docker exec moped-finance-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > moped-finance-$(date +%F).dump
```

`-Fc` is Postgres's compressed custom format, which `pg_restore` reads. The app can keep running while it dumps; the dump is a consistent snapshot.

**Restore** (this replaces everything in the database with the dump):

1. Stop the app: `docker stop moped-finance-api`.
2. To go back to an older version after an update, set `DOCKER_IMAGE` in `.env` to that version's image (for example `ghcr.io/cynicollision/moped-finance:0.1`), since a newer image would apply its migrations again. Use the dump made before the update.
3. Recreate the database empty and load the dump:

   ```sh
   docker exec moped-finance-db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
   docker exec -i moped-finance-db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < moped-finance-2026-10-24.dump
   ```

4. Start the app: `docker compose -f docker-compose.prod.yml up -d`. It applies any migrations the image has that the dump doesn't (APP-5.8), so a dump from an older version restores into a newer one too.

Sessions and the generated session secret are in the database, so after a restore devices are signed in as they were when the dump was made.

**On a schedule:** keep dumps somewhere other than the database volume, ideally copied off the host. A script like this, run daily by the host's scheduler (cron, or Task Scheduler on a Synology NAS), keeps 30 days of them:

```sh
#!/bin/sh
set -e
cd /path/to/moped-finance/backups
file="moped-finance-$(date +%F).dump"
docker exec moped-finance-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$file.partial"
mv "$file.partial" "$file"
find . -name 'moped-finance-*.dump' -mtime +30 -delete
```

The `.partial` name means a failed dump never replaces a good one or counts toward the 30 days. Point the NAS's backup tool (Hyper Backup, for example) at the backups folder to copy the dumps elsewhere. Now and then, restore a dump into a scratch database to check it, as in step 3 with another database name.

## HTTP or HTTPS

The app itself only speaks plain HTTP. Choose one of these:

| | Plain HTTP on the LAN (default) | HTTPS through a reverse proxy |
|---|---|---|
| Reach it at | `http://<host>:3000` | `https://<name>` served by the proxy (the NAS's built-in reverse proxy, Caddy, Nginx Proxy Manager, …), which forwards to port 3000 |
| `USE_HTTPS` | `false` | `true` |
| `TRUST_FIRST_PROXY` | `false` | `true` |

- **`USE_HTTPS=true`** makes the session cookie HTTPS-only and turns on the security headers that only make sense with HTTPS: HSTS, `upgrade-insecure-requests` and Cross-Origin-Opener-Policy (APP-5.9). With it set, the app no longer works over plain HTTP: the browser won't send the cookie, so signing in appears to work and then doesn't stick. Once a browser has seen HSTS for a host name, it refuses plain HTTP to that name for a year.
- **`TRUST_FIRST_PROXY=true`** makes the server believe the proxy's `X-Forwarded-Proto` and `X-Forwarded-For`. Express needs the first to know the request came in over HTTPS, or it won't send the secure cookie at all, and sign-in protection needs the second to count each client's failed sign-ins separately (AUTH-10.6); without it, every request seems to come from the proxy, so one person's failed sign-ins lock everyone out. Leave it `false` without a proxy, since any client could then fake those headers.
- **Plain HTTP:** everything on the network path can read the traffic, including the password when signing in and the session cookie on every request. That's the accepted trade-off for a home LAN. The rest of the security headers (Content-Security-Policy, frame and sniffing protection) still apply.
- **Certificates:** the browser has to trust the proxy's certificate. On a LAN that means either a real domain name with a DNS-challenge certificate (for example Let's Encrypt through the proxy), or your own certificate authority installed on each device.
