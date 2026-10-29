# Contributing to Thai Open Transit

Thanks for helping. The dataset is the product here, so the most valuable
contribution is a correct fact with a source.

## Ways to help

| You want to                  | Do this                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Report wrong or missing data | "Report an error" on any station in the map, or open a **Data correction** issue |
| Report a bug in the site     | Open a **Bug report** issue                                                      |
| Suggest a feature            | Open an **Idea** issue                                                           |
| Fix data yourself            | Pull request, see [Data changes](#data-changes)                                  |
| Fix code                     | Pull request, see [Code changes](#code-changes)                                  |
| Report a security problem    | Privately, see [SECURITY.md](./docs/SECURITY.md). Not in a public issue          |

## Data changes

- **Every fact needs a source.** Add it to `source_refs`. A change without a
  source fails validation.
- **Acceptable sources:** OpenStreetMap, MRTA / DRT / SRT / BMA published
  documents, operator announcements, reputable news, or your own survey.
  Never copy, trace or adapt a copyrighted transit map.
- **Where to edit:** corrections go in `data/overrides/`. `data/source/` is
  imported data; do not hand-edit it.
- **Dates are AD**, `YYYY-MM-DD`: `2026-10-06`, not `2569-10-06`. Give each
  date a `date_precision` (`exact`, `month`, `year`, `disputed`); a `disputed`
  date needs more than one source.
- **Bump `last_verified_at`** to the day you checked the record.
- **IDs never change.** A station code can be renumbered; the ID stays. Record
  the new code in `code_history`.
- Use the `data:` commit type, and keep data changes out of code PRs.

Run the checks before you push:

```sh
bun run data:validate
```

## Code changes

1. Read [CLAUDE.md](./CLAUDE.md) first. Its architectural rules are decisions
   already made: dataset first, static public site, bitemporal schema.
2. Branch from `main`, one topic per pull request.
3. Use [Conventional Commits](https://www.conventionalcommits.org/):
   `feat:`, `fix:`, `docs:`, `data:`, `chore:`.
4. Run the checks:

   ```sh
   bun install
   bun run typecheck
   bun run test
   bun run lint
   ```

5. Shipping a user-visible feature? Update
   [docs/FEATURES.md](./docs/FEATURES.md) in the same pull request.

Tests are required for temporal and graph logic; UI tests are optional.

`main` is protected: changes land through pull requests, and CI must pass.

## Licensing of contributions

By contributing you agree that your code is released under AGPL-3.0
([LICENSE-CODE](./LICENSE-CODE)) and your data under ODbL-1.0
([LICENSE-DATA](./LICENSE-DATA)).
