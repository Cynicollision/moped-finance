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
- **Routes read requests only through `execute`'s schemas.** Pass the schemas to `handler.execute(req, res, op, { params, query, body }, (context, { params, query, body }) => ...)` and use the parsed, typed values it hands back. Don't read `req.body`, `req.query` or `req.params` directly or cast them (`req.file` from `singleFileUpload` is the exception). Use `idParamsSchema` for `/:id`, and `QueryField.boolean()` / `QueryField.date()` for query strings.
- **Request validation comes from the Drizzle tables** (drizzle-zod `createInsertSchema`). A callback refinement (`name: (s) => s.min(1).max(100)`) adds rules and keeps the column's nullability. A Zod schema (`categoryId: z.string().min(1)`) replaces the column's schema entirely, nullability included; use it when the API is stricter than the database. Use `z.enum(SharedEnum)` for enum-like columns, and `SchemaUtil.money()`, `SchemaUtil.date()` and `SchemaUtil.optionalText()` for money, `date` and optional text columns, so bad values are a 400 rather than a database error. Export `z.output<>` request types from the `*-schema.ts` file for controllers to accept.
- **Updates are partial.** An update schema is its create schema's `.partial()`, and the controller merges the change into the current record (`{ ...current, ...changes }`), so a field that isn't sent keeps its value. Don't put `.default()` in a schema that's made partial: Zod 4 still applies defaults to missing fields, which would overwrite stored values. Apply create-time defaults in the controller (`isHidden: input.isHidden ?? false`).
- **Let foreign keys check referenced IDs.** Don't look up a referenced record (an account ID in a transaction body) before inserting; the foreign-key violation becomes a 400 with `DatabaseErrorUtil`'s message. Look it up first only when nothing will be written to trip the key (an import dry run), and reuse the same message. The record named in the URL is different: look it up and return 404. A delete calls the data class's `delete` and returns 404 when it reports nothing deleted.
- **Multi-row writes are atomic.** A data method that writes several rows (`insertBulk`, `replaceRange`) wraps them in `this.db.transaction(...)` and inserts in chunks of 1,000 rows, which stays under Postgres's bind-parameter limit.
- **CSV import and export go through `@server/csv`.** `CsvFile` reads (with row numbers and file-level errors) and writes, and `CsvValue` parses dates, amounts and booleans. Each format lives in its domain (`transaction-csv.ts`, `balance-history-csv.ts`). Imports are all-or-nothing. A file-level problem is a 400. A dry run returns 200 with every row's errors. A real import with any bad row saves nothing and returns 400 `INVALID_IMPORT`, with the report in `details`.
- **Some shared enums are part of the schema.** `AccountCategory`, `AccountGroup`, `AccountType`, `CategoryClass`, `BudgetStreamType`, `CalendarPeriod` and `ApiTokenAccess` back `CHECK` constraints, so changing their values is a schema change: generate a migration (`npm run db:generate`; CI fails otherwise).

## Client

- Components use separate `.html` and `.scss` files; no inline templates or styles.
- Get "today" from `DateProviderService`, never `new Date()`, so debug mode's fixed date applies everywhere.
- **Breakpoints** are Material 3's window size classes (compact below 600px, medium, expanded from 840px, large from 1200px), defined once in `src/styles/_breakpoints.scss` and `LayoutService` (`core/layout/layout.service.ts`). Lay out a screen's content with `@use 'breakpoints' as bp;` and the `bp.content-below(...)` / `bp.content-from(...)` mixins, which query the width of the page area rather than the window, so the side navigation can't make a screen overflow. Use `LayoutService` only for decisions that need TypeScript; don't write raw `@media` widths or use `BreakpointObserver` directly.
- **Colours** come from the tokens in `src/styles.scss` (`--bg-card`, `--text-muted`, `--color-positive`, ...) or Material's `--mat-sys-*` variables, never literal values, so a light theme only has to change the theme. `color="warn"` does nothing under Material 3; a destructive button uses the `danger-button` class.
- `npx ng lint` (angular-eslint) checks these conventions where a rule exists. `client/eslint.config.js` lists the rules that only warn until existing code is migrated.

## Tests

- Test files are `*.spec.ts`, next to the code they test.
- Name a test for new or changed behavior after its requirement ID: `it('AUTH-2.7 should reject registration once a user exists', …)`.

## Requirements

- Requirements live in [requirements/](requirements/README.md) with stable IDs (`TXN-3.2`). Reference them by ID in test names, commits, PRs, and `TODO.md` items where it helps.
