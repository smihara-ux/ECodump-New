# DGX private validation deployment

This deployment keeps ECO DUMP on the `life-id` Tailscale host. PostgreSQL and
the API have no host ports. Nginx exposes the UI and same-origin `/api/` only on
the host's Tailscale address at port 8101.

The database name remains `ecodump_direct_validation`, authentication remains
validation-only, and every migrated record is anonymous test data. This is not
a production Auth or production-data environment.

Create `.env` on the server with independent random passwords for the owner,
API, and auth roles. Never commit or transfer that file back into the repository.
