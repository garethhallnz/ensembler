# Security Policy

## Supported versions

Ensembler is a desktop application. Security fixes are made against the latest
release; please make sure you're on the newest version before reporting.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Instead, report privately via GitHub's
[private vulnerability reporting](https://github.com/garethhallnz/ensembler/security/advisories/new)
("Report a vulnerability" on the repository's **Security** tab). Include:

- what the issue is and its impact,
- steps to reproduce, and
- affected version and platform (macOS/Windows/Linux).

We'll acknowledge the report, investigate, and keep you updated on a fix.

## Scope & threat model

Ensembler runs on your own machine and orchestrates services in local Docker
containers. By design the backend binds to **loopback** (`127.0.0.1`) for
desktop use, and the app does not transmit your data to any external service.

Reports we're especially interested in:

- Ways a website you visit could drive the local backend (CSRF against mutating
  endpoints).
- Path-traversal or arbitrary-write issues in configuration/validation endpoints.
- Anything that could expose credentials or tokens the app handles.

Network-exposure concerns that assume the backend is reachable off-device
(remote access) relate to a separate, not-yet-shipped feature; note that context
in your report if relevant.
