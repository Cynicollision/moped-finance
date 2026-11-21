# SimpleFIN fixtures

Responses from SimpleFIN Bridge's demo token ([developer guide](https://beta-bridge.simplefin.org/info/developers)), recorded 2026-11-21 and pretty-printed. The demo has one connection with three bank accounts (savings, checking, and an empty one) and made-up transactions. The access URL isn't recorded. Tests read these through a stubbed `fetch`; CI never calls Bridge.

| File | Request (`GET /accounts?...`) | What it shows |
|---|---|---|
| `accounts-v2.json` | `version=2&pending=1&start-date=<44 days ago>` | What a sync asks for (SYNC-3.6): v2's `errlist`, `connections` and `conn_id`, with `payee`, `memo` and `transacted_at` on every transaction. No warning at 44 days. |
| `accounts-v2-default-window.json` | `version=2` | Without `start-date`, only transactions from yesterday on, and an `x-api-message` saying so. The same with `pending=1`. |
| `accounts-v2-range-warning.json` | `version=2&pending=1&start-date=<45 days ago>` | Bridge's warning in `errlist` (`gen.api`) for a window longer than it recommends. |
| `accounts-v1.json` | none | Without `version`, Bridge answers in v1: an `org` per account and `errors` instead of `errlist` and `connections`. The same with `pending=1`. |
| `accounts-v1-range-warning.json` | `pending=1&start-date=<45 days ago>` | The same warning as a plain string in v1's `errors`. |
| `accounts-forbidden.json` | `version=2` with wrong credentials | The body of the 403. |
| `accounts-v2-pending-edited.json` | Edited by hand from `accounts-v2-default-window.json` | The demo returns no pending transactions, even with `pending=1`, so Demo Checking's last two are marked `pending`, and the last has `posted` 0. |
