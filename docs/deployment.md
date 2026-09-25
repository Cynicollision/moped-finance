# Deployment

> **Status: not deployed, and the production path doesn't work yet.** The production image builds but doesn't start, and the client points at `localhost`. See **Production build** in `TODO.md`. This page describes the intended setup; fill in the steps once it's been run end to end.

## Target

A Docker host on a private network (a NAS, home server or similar), reachable from the LAN only. No inbound internet access is assumed, so nothing may rely on webhooks.

## Intended setup

- **Image:** the root `Dockerfile` builds the client and server and produces one image. The API serves the built client, so there's one port (3000).
- **Delivery:** either GitHub Actions builds and pushes `ghcr.io/cynicollision/moped-finance` (the commented-out job in `.github/workflows/ci.yml`) and the host pulls it, or you build the image on the host.
- **Run:** `docker-compose.prod.yml` next to a `.env` on the host. It runs the `moped-finance-api` and `moped-finance-db` containers, with Postgres data in the `moped-finance_db_data` volume. Set the image with `DOCKER_IMAGE`.
- **Config:** the same variables as `.env.example`. In production, use a strong `SESSION_SECRET`. Set `COOKIE_SECURE=true` only if the app is served over HTTPS.

## Still to decide

These are tracked in `TODO.md` under "Next":

- How the database schema is created and upgraded in production (migrations).
- How the first user is created.
- Backup and restore for the database volume.
