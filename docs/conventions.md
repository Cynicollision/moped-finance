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

## Dates

- **Calendar dates are `YYYY-MM-DD` strings** (`CalendarDate`): transaction and balance dates, as-of dates, filter and period bounds. They mean the same day in every time zone, so they cross the API as strings and never go through a UTC `Date` (`toISOString()`, `new Date('2026-05-01')`), which lands on the previous day on one side of UTC or the other. `CalendarDateUtil` (`shared/core/util`) validates them, does the arithmetic, works out periods and timeframes, and converts to and from a local `Date` for date pickers and formatting. The request schemas refuse anything else with a 400.
- **Timestamps** (`createdAt`, token expiry) are `Date`s, sent as ISO strings by JSON.

## Server

- Generate IDs with `EntityId` (`server/src/data/entity-id.ts`); don't use `short-unique-id` directly.
- Use `DateTimeUtil` (`server/src/utility/date-time-util.ts`) for "now", "today" and timestamps, rather than constructing `Date` directly.
- **Database errors propagate.** Data classes and controllers don't catch them. `OperationHandler` catches everything at the boundary: a unique or foreign-key violation becomes a 400 with a message from `DatabaseErrorUtil` (add an entry there when you add a constraint; `database-error-util.spec.ts` fails otherwise), and anything else is logged and returned as a generic 500. Never put a caught error's `message` in a response; it can contain SQL.
- **Routes read requests only through `execute`'s schemas.** Pass the schemas to `handler.execute(req, res, op, { params, query, body }, (context, { params, query, body }) => ...)` and use the parsed, typed values it hands back. Don't read `req.body`, `req.query` or `req.params` directly or cast them (`req.file` from `singleFileUpload` is the exception). Use `idParamsSchema` for `/:id`, and `QueryField.boolean()` / `QueryField.date()` for query strings.
- **Request validation comes from the Drizzle tables** (drizzle-zod `createInsertSchema`). A callback refinement (`name: (s) => s.min(1).max(100)`) adds rules and keeps the column's nullability. A Zod schema (`categoryId: z.string().min(1)`) replaces the column's schema entirely, nullability included; use it when the API is stricter than the database. Use `z.enum(SharedEnum)` for enum-like columns, and `SchemaUtil.money()`, `SchemaUtil.date()` and `SchemaUtil.optionalText()` for money, `date` and optional text columns, so bad values are a 400 rather than a database error. Export `z.output<>` request types from the `*-schema.ts` file for controllers to accept.
- **Updates are partial.** An update schema is its create schema's `.partial()`, and the controller merges the change into the current record (`{ ...current, ...changes }`), so a field that isn't sent keeps its value. Don't put `.default()` in a schema that's made partial: Zod 4 still applies defaults to missing fields, which would overwrite stored values. Apply create-time defaults in the controller (`isHidden: input.isHidden ?? false`).
- **Let foreign keys check referenced IDs.** Don't look up a referenced record (an account ID in a transaction body) before inserting; the foreign-key violation becomes a 400 with `DatabaseErrorUtil`'s message. Look it up first only when nothing will be written to trip the key (an import dry run), and reuse the same message. The record named in the URL is different: look it up and return 404. A delete calls the data class's `delete` and returns 404 when it reports nothing deleted.
- **Multi-row writes are atomic.** A data method that writes several rows (`insertBulk`, `replaceRange`) wraps them in `this.db.transaction(...)` and inserts in chunks of 1,000 rows, which stays under Postgres's bind-parameter limit.
- **CSV import and export go through `@server/csv`.** `CsvFile` reads (with row numbers and file-level errors) and writes, and `CsvValue` parses dates, amounts and booleans. Each format lives in its domain (`transaction-csv.ts`, `balance-history-csv.ts`). Imports are all-or-nothing. A file-level problem is a 400. A dry run returns 200 with every row's errors. A real import with any bad row saves nothing and returns 400 `INVALID_IMPORT`, with the report in `details`.
- **Some shared enums are part of the schema.** `AccountCategory`, `AccountGroup`, `AccountType`, `CategoryType`, `CalendarPeriod` and `ApiTokenAccess` back `CHECK` constraints, so changing their values is a schema change: generate a migration (`npm run db:generate`; CI fails otherwise).

## Client

- Components use separate `.html` and `.scss` files; no inline templates or styles (specs may declare stand-in components inline).
- **Every screen starts with `<app-page-header>`**: its `title`, the `crumbs` it sits below, and its actions as content. Secondary and occasional actions go in an overflow menu (`more_vert`); a screen gets a primary button (`mat-flat-button class="page-action"` with an icon, a `page-action-label` span and a matching `aria-label`) only for its main job. Don't add titles or breadcrumbs by hand.
- **Create and edit** (APP-2.6): small records use a dialog opened with `ModalService.open`, framed by `<app-modal-layout>` (`{ size: 'panel' }` makes it a side panel on larger screens, for a form that edits part of the screen behind it, as Budget's does); records with many fields or their own URL use a full page. A dialog saves and deletes through `FinanceService` itself, stays open if the server refuses, and closes with `true` once something changed so the screen reloads. Its buttons go in `modal-actions` (Cancel with `appModalCancel`, then the main action as `mat-flat-button` with `form="<form id>"`) and a Delete in `modal-actions-start` (`mat-button class="danger-button"`). A record's Delete on a page goes at the end of its ⋮ menu with `class="danger-item"`, and always asks first with `ModalService.confirm`.
- **Loading** (APP-2.1, APP-2.9): a screen loads what it shows with `viewResource` (`core/loading/view-resource.ts`) over `FinanceService.fetch*`, never in `ngOnInit` into signals. Its template shows `<app-load-error>` for `error()`, the content once `value()` is defined, and `<app-skeleton>` / `<app-card-skeleton>` placeholders before that; pass `isRefreshing()` to the page header's `refreshing`. Reload after a change with `reload()`. A button whose action is running is disabled and shows `<mat-progress-spinner class="button-spinner">`.
- **Lists** (APP-7): show records with `<app-list>` (`core/list/list.component.ts`), not `mat-table`. Declare the columns once, with each one's place on narrow screens (`compact`) and whether it sorts; mark rows with `appListRow` (an `<a>` with a `routerLink` when selecting one opens it) and cells with `appListCell="<key>"`.
- **Amounts** (APP-6): show money with `<app-money>` (`finance/common/money.component.ts`) rather than the `currency` pipe and colour classes: `tone="transaction"` for transaction amounts, `favourable` for income and savings, and the default `plain` for everything else.
- **Charts**: draw them with `<app-chart>` (`core/chart/`), which fills its host (give it a height), follows its size, and updates in place when its `config` changes. It sets Chart.js's defaults from the theme; colour datasets from `ChartThemeService.colors()` rather than literal colours, and label money axes with `ChartFormat.moneyTick` so neighbouring ticks never read the same (ACCT-2.12).
- **Unsaved changes** (APP-2.7): a dialog or full-page form implements `HasUnsavedChanges` (`form.dirty`, and not once saved); give a full-page form's route `canDeactivate: [unsavedChangesGuard]`.
- **Success messages** (APP-2.8): after a create, save or delete, call `NotificationService.success` with the record and what happened ("Account saved"). `ApiService` already reports failures.
- **Components are `OnPush`, and their state is signals**: `signal()` and `computed()` for state, `input()`, `output()` and `viewChild()` for the component API, and `inject()` for dependencies. The app is zoneless, so a plain field set after an `await` never shows. Templates use built-in control flow (`@if`, `@for` tracking an ID) and `[class.x]` bindings, and components import the pipes they use (`CurrencyPipe`) rather than `CommonModule`.
- Get "today" from `DateProviderService` (`today()` for a calendar date, `now()` for a date picker's `Date`), never `new Date()`, so debug mode's fixed date applies everywhere. Angular's `date` pipe reads a `YYYY-MM-DD` string as that local day, so pass calendar dates to it as they are.
- **Breakpoints** are Material 3's window size classes (compact below 600px, medium, expanded from 840px, large from 1200px), defined once in `src/styles/_breakpoints.scss` and `LayoutService` (`core/layout/layout.service.ts`). Lay out a screen's content with `@use 'breakpoints' as bp;` and the `bp.content-below(...)` / `bp.content-from(...)` mixins, which query the width of the page area rather than the window, so the side navigation can't make a screen overflow. Use `LayoutService` only for decisions that need TypeScript; don't write raw `@media` widths or use `BreakpointObserver` directly.
- **Colours** come from the tokens in `src/styles.scss` (`--bg-card`, `--text-muted`, `--color-positive`, ...) or Material's `--mat-sys-*` variables, never literal values, so a light theme only has to change the theme. `color="warn"` does nothing under Material 3; a destructive button uses the `danger-button` class.
- `npx ng lint` (angular-eslint) checks these conventions where a rule exists, including TypeScript indentation and `else`/`catch` placement.

## Tests

- Test files are `*.spec.ts`, next to the code they test.
- Name a test for new or changed behavior after its requirement ID: `it('AUTH-2.7 should reject registration once a user exists', …)`.

## Requirements

- Requirements live in [requirements/](requirements/README.md) with stable IDs (`TXN-3.2`). Reference them by ID in test names, commits, PRs, and `TODO.md` items where it helps.
