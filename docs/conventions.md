# Code Conventions

Rules that apply across the codebase. Match the surrounding code for anything not listed here.

## TypeScript

- **Indentation**: 4 spaces.
- **Import order**: external packages, then `@shared/*`, then `@server/*` (server only), then relative imports.
- **Parent-folder imports** start with `./`: write `./../transactions/transaction-data`, not `../transactions/transaction-data`.
- **`else` and `catch`** go on a new line, not on the closing-brace line:

  ```typescript
  if (condition) {
      // ...
  }
  else {
      // ...
  }
  ```

## Server

- Generate IDs with `EntityId` (`server/src/data/entity-id.ts`); don't use `short-unique-id` directly.
- Use `DateTimeUtil` (`server/src/utility/date-time-util.ts`) for "now", parsing and formatting dates, rather than constructing `Date` directly.

## Client

- Components use separate `.html` and `.scss` files; no inline templates or styles.
- Get "today" from `DateProviderService`, never `new Date()`, so debug mode's fixed date applies everywhere.

## Tests

- Test files are `*.spec.ts`, next to the code they test.

## Requirements

- Functional requirements live in [requirements/](requirements/README.md) with stable IDs (`TXN-3.2`). Reference them by ID in test names, commits, PRs, and `TODO.md` items where it helps.
