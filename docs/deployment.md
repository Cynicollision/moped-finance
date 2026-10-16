# Deployment

> **Status: not deployed yet.** The production image builds, creates its schema on an empty database, serves the client and answers `/health`; CI checks this on every PR (the smoke test in `.github/workflows/ci.yml`). It hasn't been run on the target host yet. This page describes the intended setup; fill in the exact steps once it has.

## Target

A Docker host on a private network (a NAS, home server or similar), reachable from the LAN only. No inbound internet access is assumed, so nothing may rely on webhooks.

## Intended setup

- **Image:** the root `Dockerfile` builds the client and server and produces one image. The API serves the built client, so there's one port (3000).
- **Delivery:** either GitHub Actions builds and pushes `ghcr.io/cynicollision/moped-finance` (the commented-out job in `.github/workflows/ci.yml`) and the host pulls it, or you build the image on the host.
- **Run:** `docker-compose.prod.yml` next to a `.env` on the host. It runs the `moped-finance-api` and `moped-finance-db` containers, with Postgres data in the `moped-finance_db_data` volume. Set the image with `DOCKER_IMAGE`.
- **Config:** the same variables as `.env.example`. `SESSION_SECRET` is optional: without it, the server generates a random one on first start and keeps it in the database (`core.secrets`), so sessions survive restarts (AUTH-3.6, AUTH-3.7). If you set it, use a long random value. Sessions are stored in `core.sessions`.
- **Sign-in protection:** after 5 failed sign-ins from one address within 15 minutes, that address is refused for 15 minutes (AUTH-10). `SIGN_IN_MAX_FAILED_ATTEMPTS`, `SIGN_IN_WINDOW_MINUTES` and `SIGN_IN_LOCKOUT_MINUTES` change those numbers (see `.env.example` for the ranges); a value out of range stops the container from starting, with the reason in `docker logs moped-finance-api`. Lockouts are logged as warnings and kept in memory, so restarting the container (`docker restart moped-finance-api`) clears them.
- **Time zone:** set `TZ` in `.env` to your IANA zone (for example `America/New_York`); the compose files pass it to both containers and default to UTC. The server works out "today" and Spending period boundaries in this zone (APP-5.6). Postgres only stores calendar dates and `TIMESTAMPTZ`, so its zone affects log output, and it only reads `TZ` when the data volume is first initialized.
- **Database schema:** nothing to run by hand. On every start the server applies any migrations the image has that the database hasn't run yet, then starts listening (APP-5.8). On an empty database that creates everything. If a migration fails, it's rolled back, the error is in `docker logs moped-finance-api`, and the container exits; `restart: always` retries, so it shows as restarting until fixed. The same happens if Postgres isn't accepting connections yet, for example while the host boots, and clears up once it is.
- **First user:** the first person to register owns the instance, and registration closes after that (AUTH-2.7, AUTH-7.2). Register right after the first start, before anyone else on the network can reach the app. There's no seeded or default user in production; `SEED_USER_*` and `db:seed` are for development only.
- **Health:** `GET /health` returns 200 when the API can reach the database and 503 otherwise (APP-5.3). `docker-compose.prod.yml` uses it as the `api` health check, so `docker ps` shows `unhealthy` when the database is unreachable.
- **Stopping and updating:** on `docker stop` the API finishes in-flight requests for up to 25 seconds before exiting (APP-5.2); `stop_grace_period: 30s` gives it room before Docker kills it. To update, pull or build the new image and `docker compose -f docker-compose.prod.yml up -d`; the new container migrates the database as it starts. Migrations only go forward, so back up the database before an update that includes one, in case you need to return to the old image.

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

## Still to decide

These are tracked in `TODO.md` under "Now":

- Backup and restore for the database volume.
- How images are delivered (GHCR from CI, or built on the host).
