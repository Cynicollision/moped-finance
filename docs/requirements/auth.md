# Authentication (`AUTH`)

Moped Finance is a single-user app: one person keeps their finances in it, behind a login. Each instance has one owner (AUTH-7), so finance data isn't partitioned by user; the login only decides whether you get in.

Screens: **Login** (`/login`), **Register** (`/register`), **Settings** (`/settings`), and the **Sign out** action in the profile menu.

## AUTH-1 The user can sign in to reach their finances

| ID | Requirement | Status |
|---|---|---|
| AUTH-1.1 | The Login screen shall show a **Username** field, a **Password** field, a **Login** button, and, while registration is open (AUTH-2.7), a link "Register here" to the Register screen. | Implemented |
| AUTH-1.2 | The Login button shall be disabled until both Username and Password are non-empty. | Implemented |
| AUTH-1.3 | Submitting valid credentials shall sign the user in and navigate to the page they originally requested (`returnUrl`), or to the Summary if there was none. | Implemented |
| AUTH-1.4 | Submitting an unknown username or a wrong password shall not sign the user in and shall show the error "Invalid username or password." The message shall be identical for both cases so it doesn't reveal which usernames exist. | Implemented |
| AUTH-1.5 | In development builds only, the Login form shall be pre-filled with a configured developer username and password. Production and demo builds shall show empty fields. | Implemented |
| AUTH-1.6 | Usernames shall be case-sensitive: `Stn` and `stn` are different usernames, and signing in needs the username exactly as registered. | Implemented |

## AUTH-2 The user can create an account for themselves

| ID | Requirement | Status |
|---|---|---|
| AUTH-2.1 | The Register screen shall show **Username**, **Display Name**, **Password** and **Confirm Password** fields, a **Register** button, and a link "Login here" to the Login screen. | Implemented |
| AUTH-2.2 | The Register button shall be disabled until all four fields are non-empty. | Implemented |
| AUTH-2.3 | If Password and Confirm Password differ, the screen shall show "Passwords do not match." and shall not submit. | Implemented |
| AUTH-2.4 | Usernames shall be unique. Registering an existing username shall be rejected with "Username already taken." | Implemented |
| AUTH-2.5 | Successful registration shall sign the user in immediately and navigate the same way as AUTH-1.3. | Implemented |
| AUTH-2.6 | Passwords shall be stored only as salted bcrypt hashes (10 rounds) and shall never be returned by any API. | Implemented |
| AUTH-2.7 | Once a first user exists, registration shall be disabled: the API shall reject it with "Registration is closed.", the Login screen shall hide its Register link, and navigating to Register shall redirect to Login. | Implemented |
| AUTH-2.8 | The Register screen shall explain, before the user submits, that they're creating the only account for this instance, that it will own all of the instance's data, and that registration closes once it's done, so the Register screen won't be available again. | Planned |
| AUTH-2.9 | The Register screen shall ask whether to **Start with default categories** (selected) or **Start empty**, and registration shall set up categories accordingly (CAT-6). | Planned |
| AUTH-2.10 | The username shall be 1 to 50 characters with no leading or trailing spaces, and the display name 1 to 100 characters. The Register screen shall flag a field that breaks these before submitting, and the server shall refuse it. | Planned |
| AUTH-2.11 | The password shall meet the password rules (AUTH-9), which are the defaults at registration. | Planned |

## AUTH-3 The user stays signed in, and only signed-in users see finance data

| ID | Requirement | Status |
|---|---|---|
| AUTH-3.1 | When the app loads, it shall ask the server who the current user is and restore the signed-in state, so a page reload does not require signing in again. | Implemented |
| AUTH-3.2 | Sessions shall be server-side, identified by an HTTP-only cookie, and expire after 24 hours without a request. Each request restarts the 24 hours, so a user who keeps using the app stays signed in. | Partial |
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
| AUTH-5.2 | Settings shall have a **Change Password** section with **Current Password**, **New Password** and **Confirm New Password**. **Change Password** stays disabled until all three are filled; mismatched new passwords show "Passwords do not match." | Planned |
| AUTH-5.3 | The new password shall meet the password rules (AUTH-9). On success the screen shall say "Password changed.", clear the fields, and keep the user signed in. | Planned |

## AUTH-6 A user can only see and change their own data

Retired: the app committed to one owner per instance (AUTH-7), so finance records no longer belong to a user.

| ID | Requirement | Status |
|---|---|---|
| AUTH-6.1 | Every institution, account, balance entry, category group, category, transaction and budget stream shall belong to exactly one user. | Retired (see AUTH-7.1) |
| AUTH-6.2 | List and search endpoints shall return only the signed-in user's records. | Retired (see AUTH-7.1) |
| AUTH-6.3 | Requesting, changing or deleting another user's record by ID shall behave as though the record does not exist. | Retired (see AUTH-7.1) |
| AUTH-6.4 | A record shall only be linked to records the same user owns. | Retired (see AUTH-7.1) |

## AUTH-7 One owner per instance

| ID | Requirement | Status |
|---|---|---|
| AUTH-7.1 | Finance records (institutions, accounts, balance entries, category groups, categories, transactions, budget streams) shall belong to the instance, not to a user. The signed-in user sees and changes all of them. | Implemented |
| AUTH-7.2 | An instance shall have one user. Registration closes after the first one (AUTH-2.7). | Implemented |

## AUTH-8 The user can manage their profile in Settings

| ID | Requirement | Status |
|---|---|---|
| AUTH-8.1 | The profile menu's **Settings** (APP-1.5) shall open the Settings screen (`/settings`, page title "Settings"), with the sections **Profile**, **Change Password** (AUTH-5.2) and **Password Rules** (AUTH-9). | Planned |
| AUTH-8.2 | **Profile** shall show the username read-only (it can't be changed) and let the user edit **Display Name** (AUTH-2.10). Saving shall update the profile control's name and initials (APP-1.4) straight away. | Planned |

## AUTH-9 The owner decides how strong the password must be

The defaults are a sensible middle: long enough to resist guessing, without character-class rules that push people toward predictable patterns. The owner can make them stricter, not weaker.

| ID | Requirement | Status |
|---|---|---|
| AUTH-9.1 | A password shall always be at least the minimum length (default 12 characters), at most 72 bytes when encoded as UTF-8 (bcrypt's limit), and not the same as the username, ignoring case. | Planned |
| AUTH-9.2 | **Password Rules** in Settings shall let the user set the **Minimum length**, from 12 to 64, and turn on any of: **Require an uppercase letter**, **Require a lowercase letter**, **Require a number**, **Require a symbol**. All four are off by default. | Planned |
| AUTH-9.3 | The rules shall be stored with the instance, so they apply after restarts and upgrades. Changing them doesn't affect the current password; they apply the next time it's set. | Planned |
| AUTH-9.4 | Wherever a password is set (Register, Change Password), the form shall list the current rules under the field and mark each one met or unmet as the user types, and the server shall refuse a password that breaks any of them with a message naming each one (for example "Password must be at least 12 characters. Password must contain a number."). | Planned |

## Known gaps

- **Settings doesn't exist (AUTH-8, AUTH-5.2).** The profile menu's **Settings** links to `/system`, which isn't a route, so it lands on the Summary. Changing the password is API-only (AUTH-5.1), and the display name can't be edited.
- **No password rules (AUTH-9).** A password only has to be non-empty, and usernames and display names have no length limits or space checks beyond the column size (AUTH-2.10).
- **No lockout or rate limiting** on repeated failed logins (`TODO.md`).
- **Sessions end 24 hours after sign-in (AUTH-3.2),** however active the user is.
- **Cookie settings are inconsistent.** The session cookie's `secure` flag comes from `COOKIE_SECURE`, but logout clears the cookie with `secure` set from `NODE_ENV`. No `sameSite` is set. `TODO.md` lists the fix.
- **Registration race.** AUTH-2.7 checks for an existing user before inserting, so two registrations submitted at the same moment on a fresh instance could both succeed. Low risk for a self-hosted app whose owner registers once.

## Notes

- **Fresh instances are claimable.** Whoever registers first on a fresh instance becomes its owner. Accepted (2026-09-26) for a LAN-only host: the owner registers right after the first start (see `docs/deployment.md`), and AUTH-2.8 makes the one-time nature clear on screen.
