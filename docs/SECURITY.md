# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub:
[Security > Report a vulnerability](https://github.com/Nukaze/thai-open-transit/security/advisories/new).

Include what you found, how to reproduce it, and what an attacker could do
with it. Expect a first reply within 7 days. This is a volunteer project, so
fixes may take longer; you will be kept updated and credited unless you ask
not to be.

## Scope

| In scope                                                     | Out of scope                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| The public site and its build (`apps/web`, `scripts/`)       | Wrong or outdated data: open a data-correction issue instead |
| The view counter's stats store (ADR 0002)                    | Third-party services (GitHub, Vercel, OpenStreetMap)         |
| CI workflows in `.github/workflows`                          | Denial of service against the hosting provider               |
| Leaked credentials anywhere in the repository or its history | Findings from automated scanners with no demonstrated impact |

## How the project limits risk

- The public site is a static export. It has no server code and never talks
  to the project database.
- The only runtime dependency is an optional, isolated view counter. The map
  works without it.
- Secret keys are never committed. Anything shipped to the browser is public
  by design.
