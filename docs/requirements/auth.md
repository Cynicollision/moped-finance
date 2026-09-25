# Authentication (`AUTH`)

Moped Finance is a single-user-oriented app: one person keeps their finances in it, behind a login. The data model is multi-user (every record has an owner), which is why isolation between users is still specified here.

Screens: **Login** (`/login`), **Register** (`/register`), and the **Sign out** action in the profile menu.

## AUTH-1 The user can sign in to reach their finances

| ID | Requirement | Status |
|---|---|---|
| AUTH-1.1 | The Login screen shall show a **Username** field, a **Password** field, a **Login** button, and a link "Register here" to the Register screen. | Implemented |
| AUTH-1.2 | The Login button shall be disabled until both Username and Password are non-empty. | Implemented |
| AUTH-1.3 | Submitting valid credentials shall sign the user in and navigate to the page they originally requested (`returnUrl`), or to the Accounts summary if there was none. | Implemented |
| AUTH-1.4 | Submitting an unknown username or a wrong password shall not sign the user in and shall show the error "Invalid username or password." The message shall be identical for both cases so it doesn't reveal which usernames exist. | Implemented |
| AUTH-1.5 | In development builds only, the Login form shall be pre-filled with a configured developer username and password. Production and demo builds shall show empty fields. | Implemented |

## AUTH-2 The user can create an account for themselves

| ID | Requirement | Status |
|---|---|---|
| AUTH-2.1 | The Register screen shall show **Username**, **Display Name**, **Password** and **Confirm Password** fields, a **Register** button, and a link "Login here" to the Login screen. | Implemented |
| AUTH-2.2 | The Register button shall be disabled until all four fields are non-empty. | Implemented |
| AUTH-2.3 | If Password and Confirm Password differ, the screen shall show "Passwords do not match." and shall not submit. | Implemented |
| AUTH-2.4 | Usernames shall be unique. Registering an existing username shall be rejected with "Username already taken." | Implemented |
| AUTH-2.5 | Successful registration shall sign the user in immediately and navigate the same way as AUTH-1.3. | Implemented |
| AUTH-2.6 | Passwords shall be stored only as salted bcrypt hashes (10 rounds) and shall never be returned by any API. | Implemented |
| AUTH-2.7 | Once a first user exists, registration shall be disabled and the Register screen and link hidden. | Planned |

## AUTH-3 The user stays signed in, and only signed-in users see finance data

| ID | Requirement | Status |
|---|---|---|
| AUTH-3.1 | When the app loads, it shall ask the server who the current user is and restore the signed-in state, so a page reload does not require signing in again. | Implemented |
| AUTH-3.2 | Sessions shall be server-side, identified by an HTTP-only cookie, and expire 24 hours after they are created. | Implemented |
| AUTH-3.3 | A signed-out visitor requesting any page other than Login or Register shall be redirected to Login, with the requested URL preserved for AUTH-1.3. | Implemented |
| AUTH-3.4 | Every finance API endpoint shall respond `401 Unauthorized` to a request with no valid session. | Implemented |
| AUTH-3.5 | The API shall also accept HTTP Basic credentials on finance endpoints (for scripts and tools), treated as a sign-in for that request only. | Implemented |
| AUTH-3.6 | Sessions shall survive a server restart. | Planned |
| AUTH-3.7 | In production, the server shall refuse to start without a configured session secret. | Planned |

## AUTH-4 The user can sign out

| ID | Requirement | Status |
|---|---|---|
| AUTH-4.1 | The profile menu shall offer **Sign out**, which ends the server session, clears the session cookie and the client's user state, and navigates to Login. | Implemented |

## AUTH-5 The user can change their password

| ID | Requirement | Status |
|---|---|---|
| AUTH-5.1 | The API shall let a signed-in user change their password by supplying the current password and a new one. A wrong current password shall be rejected with "Invalid old password." | Implemented |

## AUTH-6 A user can only see and change their own data

| ID | Requirement | Status |
|---|---|---|
| AUTH-6.1 | Every institution, account, balance entry, category group, category, transaction and budget stream shall belong to exactly one user. | Implemented |
| AUTH-6.2 | List and search endpoints shall return only the signed-in user's records. | Implemented |
| AUTH-6.3 | Requesting, changing or deleting another user's record by ID shall behave as though the record does not exist ("Resource not found or access denied"). | Partial |
| AUTH-6.4 | A record shall only be linked to records the same user owns (for example an account to an institution, a transaction to a category). | Partial |

## Observations

Things found while reading the code that the requirements above don't yet cover or that you may want to decide on.

- **AUTH-6.3 gaps.** Fetching a single institution, category or category group by ID does not check ownership, so any signed-in user who knows an ID can read it. Deleting a budget stream by ID also skips the ownership check. Update and delete of the other record types do check.
- **AUTH-6.4 gaps.** Creating or updating an account doesn't verify the institution belongs to the user; creating or updating a transaction doesn't verify the category (or, on update, the new account); the transaction import's optional target account isn't verified. These matter little with one user and a lot if a second is ever added.
- **Settings menu item is a dead end.** The profile menu has **Settings**, linking to `/system`. No such route exists, so it lands on the Accounts summary. There is no screen for changing the password (AUTH-5.1 is API-only); it would be the obvious first inhabitant.
- **No password rules.** A password only has to be non-empty (AUTH-2). No minimum length, no lockout or rate limiting on repeated failed logins.
- **Username matching is case-sensitive**, so `Stn` and `stn` are different users.
- **Registration is open to anyone who can reach the server** until AUTH-2.7 is done. `TODO.md` lists this under Next.
- **Display name.** Collected at registration and shown in the profile menu; there's no way to edit it.
