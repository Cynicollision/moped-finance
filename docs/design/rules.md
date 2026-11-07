# Rules and learning design

How automatic categorization (requirements: CAT-8, CAT-9) is built. Written 2026-11-07, before any code.

## Data model

In `server/src/api/rules/`:

| Table | What |
|---|---|
| `finance.rules` | `id`, `name` (unique ignoring case), `position` (list order, CAT-8.3). |
| `finance.rule_conditions` | `rule_id` (FK, cascade), `field` (`original_statement`, `merchant`, `amount`, `account`), `operator` (`contains`, `equals`, `greater_than`, `less_than`), `text_value`, `amount_value` (positive), `direction` (`in`, `out`), `account_id` (FK to `accounts`, `ON DELETE RESTRICT`). |
| `finance.rule_actions` | `rule_id` (FK, cascade), `type` (`set_category`, `set_merchant`), `category_id` (FK to `categories`, `ON DELETE RESTRICT`), `text_value`. |

Conditions and actions are child rows rather than JSON so the categories and accounts they name keep foreign keys. `field`, `operator` and `type` are shared enums behind `CHECK` constraints, so a new action (tags, hiding, notes) is a new enum value, a migration and a branch in the engine, without reshaping the tables. `DatabaseErrorUtil` gets messages for deleting a category or account a rule uses ("This category is used by a rule. Edit or delete the rule first."); CAT-4.4 and ACCT-1.6's dialogs should say so before the server refuses.

`transactions` gains `category_rule_id` and `merchant_rule_id` (FK to `rules`, `ON DELETE SET NULL`) and `category_source` (`user`, `rule`, `learning`, null for Uncategorized), for CAT-8.6's note and CAT-9.2's "categorized by the user". Editing the category in the form sets `category_source` to `user` and clears `category_rule_id`; editing the merchant clears `merchant_rule_id`. Existing categorized transactions migrate as `user`.

## The engine

`RuleEngine` is pure: given a transaction's fields, the ordered rules, which fields it may set (the category if it has none, the merchant only when it came from sync or an import, CAT-8.4) and the learning statistics, it returns the new category and merchant and why. It's called by:

- transaction create (category only),
- CSV import, per row, in the import's database transaction,
- sync (`sync-runner.ts`) and linking, in theirs,
- a rule's **Apply to existing** (CAT-8.5), which runs only that rule.

Evaluation (CAT-8.3, CAT-9.3): walk the rules in order, matching each against the transaction as changed so far; the first rule to set each field wins. Then, if the category is still unset and learning is on, learning picks one. Text matches ignore case (`toLocaleLowerCase` on both sides).

Rules and the learning statistics are loaded once per import or sync, not per transaction. Learning's statistics (CAT-9.2): per lower-cased merchant, or original statement when the merchant is blank, the count of user-categorized, unsplit transactions per category, one `GROUP BY` query.

## API and screen

`/api/v1/rules`: list, create, update, delete, `PUT /order` (the full ordered list of IDs), `GET /:id/matches` (counts for CAT-8.5's offer) and `POST /:id/apply`. **Learn from my transactions** is a setting (`categorizationLearning`, default false) in `core.settings`.

The Rules screen (`/settings/rules`) is a list (`<app-list>`) with drag-to-reorder, and a full-page form, since a rule has a variable number of conditions and actions.
