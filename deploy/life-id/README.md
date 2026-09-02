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

## Immutable dual-theme demo

- Public URL path: `/ecodump-demo-v2/`
- Release directory: `/home/life-id/apps/eco-dump-new/releases/v2`
- Container: `eco-dump-demo-v2`
- Local proxy target: `127.0.0.1:8098`

The `v2` release contains the approved lime primary/utility button system,
persistent light/dark themes, and the responsive desktop/tablet/mobile layouts.
Like `v1`, it is not replaced by normal development updates.

## Immutable E2E-audited demo

- Public URL path: `/ecodump-demo-v3/`
- Release directory: `/home/life-id/apps/eco-dump-new/releases/v3`
- Container: `eco-dump-demo-v3`
- Local proxy target: `127.0.0.1:8099`

The `v3` release adds the full-route light/dark contrast corrections verified by
the 2026-08-28 E2E audit. It is a separate read-only release, so later work on
`current` or a future release cannot change the third-party review screen.

## Immutable labor-safety theme demo

- Public URL path: `/ecodump-demo-v4/`
- Release directory: `/home/life-id/apps/eco-dump-new/releases/v4`
- Container: `eco-dump-demo-v4`
- Local proxy target: `127.0.0.1:8100`

The `v4` release applies the dedicated labor-safety contrast system to all 11
inner pages in both light and dark themes. It remains independent from `current`
and from the earlier immutable review releases.
