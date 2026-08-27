# ECO DUMP DGX runner setup

The repository includes `.github/workflows/dgx.yml`. It runs only on a
self-hosted Linux runner carrying the `dgx` label.

## Register the DGX host

1. Connect to the DGX through Tailscale SSH.
2. Copy `scripts/register-dgx-runner.sh` to the DGX.
3. Generate a short-lived repository runner token.
4. Run the installer on the DGX:

```bash
chmod +x register-dgx-runner.sh
GITHUB_RUNNER_TOKEN='<short-lived-token>' ./register-dgx-runner.sh
```

The runner registers with these labels:

- `self-hosted`
- `linux`
- `x64`
- `dgx`

After the runner reports `online`, run **Validate prototype on DGX Linux** from
the repository Actions page. The workflow builds the application, runs the
hosting tests, and uploads the browser build as an artifact.

Keep the workflow limited to `workflow_dispatch`. Do not add
`pull_request` execution while the runner is attached to the DGX.
