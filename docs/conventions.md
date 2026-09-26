# Code Conventions

Rules that apply across the codebase. Match the surrounding code for anything not listed here.

## Files

- UTF-8, LF line endings, final newline, no trailing whitespace. `.editorconfig` sets this for editors and `.gitattributes` makes Git store and check out LF on every OS.

## TypeScript

- **Indentation**: 4 spaces (also HTML, SCSS and JSON; YAML and SQL use 2).
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
- **Database errors propagate.** Data classes and controllers don't catch them. `OperationHandler` catches everything at the boundary: a unique or foreign-key violation becomes a 400 with a message from `DatabaseErrorUtil` (add an entry there when you add a constraint; `database-error-util.spec.ts` fails otherwise), and anything else is logged and returned as a generic 500. Never put a caught error's `message` in a response; it can contain SQL.
- **Request validation comes from the Drizzle tables** (drizzle-zod `createInsertSchema`). A callback refinement (`name: (s) => s.min(1).max(100)`) adds rules and keeps the column's nullability. A Zod schema (`categoryId: z.string().min(1)`) replaces the column's schema entirely, nullability included; use it when the API is stricter than the database. Use `z.enum(SharedEnum)` for enum-like columns.
- **Some shared enums are part of the schema.** `AccountCategory`, `AccountGroup`, `AccountType`, `CategoryClass`, `BudgetStreamType` and `CalendarPeriod` back `CHECK` constraints, so changing their values is a schema change: update `schema_*.sql` too (the parity spec fails otherwise).

## Client

- Components use separate `.html` and `.scss` files; no inline templates or styles.
- Get "today" from `DateProviderService`, never `new Date()`, so debug mode's fixed date applies everywhere.

## Tests

- Test files are `*.spec.ts`, next to the code they test.
- Name a test for new or changed behavior after its requirement ID: `it('AUTH-2.7 should reject registration once a user exists', …)`.

## Requirements

- Functional requirements live in [requirements/](requirements/README.md) with stable IDs (`TXN-3.2`). Reference them by ID in test names, commits, PRs, and `TODO.md` items where it helps.
