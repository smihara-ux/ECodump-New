# life-id deployment

ECO DUMP New is served privately over Tailscale from `100.83.235.95:8096`.

- Static build: `app/dist/client`
- Server release path: `/home/life-id/apps/eco-dump-new/current`
- Source backup path: `/home/life-id/apps/eco-dump-new/source`
- Container: `eco-dump-new`
- SPA fallback: handled by `nginx.conf`

## Immutable third-party demo

- Public URL path: `/ecodump-demo-v1/`
- Release directory: `/home/life-id/apps/eco-dump-new/releases/v1`
- Container: `eco-dump-demo-v1`
- Local proxy target: `127.0.0.1:8097`

The `v1` release directory is immutable. Normal updates only replace `current`,
so the shared demo never changes when development continues.
