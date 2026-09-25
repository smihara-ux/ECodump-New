# DGX dedicated staging

This configuration owns only the `ecodump-staging` project, its volume, localhost:8111 and tailnet HTTPS:9462. Existing private/demo stacks are separate.

Releases: `/home/life-id/apps/eco-dump-staging/releases/<YYYYMMDD-HHMMSS>/app`.
Confirm the active Web bind mount with `docker inspect ecodump-staging-web-1`; do not infer it from an older report.
Environment file: `/home/life-id/apps/eco-dump-staging/.env` (0600).
State/credentials: `/home/life-id/apps/eco-dump-staging/private` (0700).

Create each new release from a fixed source snapshot. Build the frontend, copy `staging.html` into `dist/client`, and add the staging label to the generated HTML. Exclude local credentials and node_modules from the transfer. Preserve source SHA and test evidence.

Use `docker compose --env-file <environment-file> -f <release>/deploy/staging/compose.yml` with:
1. `config --quiet`
2. `up -d db`
3. `build api bootstrap`
4. `run --rm bootstrap`
5. `up -d api web`

Bootstrap requires dedicated-staging guard and 3 independent random hex(32-byte) secrets. It migrates only its dedicated database and records checksums. Do not change existing migration contents. Take a DB backup before updating an existing populated environment. Never use `down -v` as a routine reset.

HTTPS route: `tailscale serve --bg --https=9462 http://127.0.0.1:8111`. Do not use Funnel or reset existing Serve routes.

To stop this route only: `tailscale serve --https=9462 off`. To stop this stack, use the same Compose file and `stop`; retain the volume for recovery.

Health: `/api/direct/health`. UI test entry: `/staging`. Details and current limitations: repository `docs/narita-validation/STAGING_RESULT.md`.
