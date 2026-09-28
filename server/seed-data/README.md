# Seed data

Synthetic sample data for development, loaded by `npm run db:seed:finance` (`scripts/seed-finance-db.ts`). Every name, merchant and amount is made up.

It covers one household from 2024-02-29 to 2026-05-15, just before the development build's fixed "today" (2026-05-17), so every chart timeframe up to two years has data:

| File | Contents | Format |
|---|---|---|
| `accounts.csv` | 9 accounts, one or more per account group, one hidden. Institutions are created from `InstitutionName`. | Seed only |
| `categories.csv` | 26 categories in 8 groups (income, expense and transfer), one inactive. Groups are created from `Group`. | Seed only |
| `budget-streams.csv` | 16 monthly, quarterly and yearly streams (income, expenses and savings, which each follow from the category), linked by `CategoryName`. | Seed only |
| `transactions.csv` | ~1,100 transactions: paychecks, bills, card spending and payments, transfers, trips, holiday gifts, refunds, and one hidden duplicate charge with its refund. Money out is negative. | Transaction import/export (TXN-3.1) |
| `balance-history.csv` | A balance for every account every 3 days, plus 2026-05-15. Checking, savings and the card follow the transactions, investments take a random market walk with a dip in spring 2025, and the mortgage drops with each payment. Liabilities are negative. | Balance history export (ACCT-3.1) |

Records refer to each other by name, and the seed stops at the first bad row. `transactions.csv` goes through the same reader as a transaction import, so it doubles as a sample import file. To import one account's rows of `balance-history.csv`, copy them into their own file first.
