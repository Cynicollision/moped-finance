# Authentication (`AUTH`)

Moped Finance is a single-user app: one person keeps their finances in it, behind a login. Each instance has one owner (AUTH-7), so finance data isn't partitioned by user; the login only decides whether you get in.

Screens: **Login** (`/login`, with **Forgot password?**), **Register** (`/register`), the **Sign out** action in the profile menu, and sections of **Settings** (`/settings`, SET-1.1): **Change Password** and **API Tokens**.

## AUTH-1 The user can sign in to reach their finances

| ID | Requirement | Status |
|---|---|---|
| AUTH-1.1 | The Login screen shall show a **Username** field, a **Password** field, a **Login** button, and, while registration is open (AUTH-2.7), a link "Register here" to the Register screen. | Implemented |
| AUTH-1.2 | The Login button shall be disabled until both Username and Password are non-empty. | Implemented |
| AUTH-1.3 | Submitting valid credentials shall sign the user in and navigate to the page they originally requested (`returnUrl`), or to the Dashboard if there was none. | Implemented |
| AUTH-1.4 | Submitting an unknown username or a wrong password shall not sign the user in and shall show the error "Invalid username or password." The message shall be identical for both cases so it doesn't reveal which usernames exist. | Implemented |
| AUTH-1.5 | In development builds only, the Login form shall be pre-filled with a configured developer username and password. Production and demo builds shall show empty fields. | Implemented |
| AUTH-1.6 | Usernames shall be case-sensitive: `Stn` and `stn` are different usernames, and signing in needs the username exactly as registered. | Implemented |

## AUTH-2 The user can create an account for themselves

| ID | Requirement | Status |
|---|---|---|
| AUTH-2.1 | The Register screen shall show **Username**, **Display Name**, **Password** and **Confirm Password** fields, a **Register** button, and a link "Login here" to the Login screen. | Implemented |
| AUTH-2.2 | The Register button shall be disabled until all four fields are non-empty. | Implemented |
| AUTH-2.3 | If Password and Confirm Password differ, the screen shall show "Passwords do not match." and shall not submit. | Implemented |
| AUTH-2.4 | Usernames shall be unique. Registering an existing username shall be rejected with "Username already taken." | Retired: with one user per instance (AUTH-7.2), registration is open only while there's no username to clash with |
| AUTH-2.5 | Successful registration shall sign the user in immediately and navigate the same way as AUTH-1.3. | Implemented |
| AUTH-2.6 | Passwords shall be stored only as salted bcrypt hashes (10 rounds) and shall never be returned by any API. | Implemented |
| AUTH-2.7 | Once a first user exists, registration shall be disabled: the API shall reject it with "Registration is closed.", the Login screen shall hide its Register link, and navigating to Register shall redirect to Login. The database shall hold at most one user, so of two registrations submitted at the same moment on a fresh instance, only one succeeds. | Implemented |
| AUTH-2.8 | The Register screen shall explain, before the user submits, that they're creating the only account for this instance, that it will own all of the instance's data, and that registration closes once it's done, so the Register screen won't be available again. | Implemented |
| AUTH-2.9 | The Register screen shall ask whether to **Start with default categories** (selected) or **Start empty**, and registration shall set up categories accordingly (CAT-6), saving them with the user or not at all. | Implemented |
| AUTH-2.10 | The username shall be 1 to 50 characters with no leading or trailing spaces, and the display name 1 to 100 characters. The Register screen shall stop each field at its limit, flag a username with a leading or trailing space or a display name of only spaces, and keep **Register** disabled until they're fixed, and the server shall refuse them. The display name is saved without leading or trailing spaces. | Implemented |
| AUTH-2.11 | The password shall meet the password rules (AUTH-9). | Implemented |

## AUTH-3 The user stays signed in, and only signed-in users see finance data

| ID | Requirement | Status |
|---|---|---|
| AUTH-3.1 | When the app loads, it shall ask the server who the current user is and restore the signed-in state, so a page reload does not require signing in again. | Implemented |
| AUTH-3.2 | Sessions shall be server-side, identified by an HTTP-only cookie, and expire after 24 hours without a request. Each request restarts the 24 hours, so a user who keeps using the app stays signed in. | Implemented |
| AUTH-3.3 | A signed-out visitor requesting any page other than Login or Register shall be redirected to Login, with the requested URL preserved for AUTH-1.3. | Implemented |
| AUTH-3.4 | Every finance API endpoint shall respond `401 Unauthorized` to a request with no valid session or API token (AUTH-11). | Implemented |
| AUTH-3.5 | The API shall also accept HTTP Basic credentials on finance endpoints (for scripts and tools), treated as a sign-in for that request only. | Retired (see AUTH-11): scripts use API tokens instead of sending the password |
| AUTH-3.6 | Sessions shall survive a server restart. | Implemented |
| AUTH-3.7 | Sessions shall be signed with a secret that can't be guessed: `SESSION_SECRET` if it's set, otherwise a random one the server generates on first start and keeps in the database. There shall be no built-in fallback value. | Implemented |
| AUTH-3.8 | The session cookie shall be `SameSite=Lax`, and HTTPS-only when the app is served over HTTPS (`USE_HTTPS`). Signing out shall clear it with the same attributes, so the browser drops it. | Implemented |

## AUTH-4 The user can sign out

| ID | Requirement | Status |
|---|---|---|
| AUTH-4.1 | The profile menu shall offer **Sign out**, which ends the server session, clears the session cookie and the client's user state, and navigates to Login. | Implemented |

## AUTH-5 The user can change their password

| ID | Requirement | Status |
|---|---|---|
| AUTH-5.1 | The API shall let a signed-in user change their password by supplying the current password and a new one. A wrong current password shall be rejected with "Invalid old password." | Implemented |
| AUTH-5.2 | Settings shall have a **Change Password** section with **Current Password**, **New Password** and **Confirm New Password**. **Change Password** stays disabled until all three are filled, the new passwords match and the new one meets the rules (AUTH-9.4); mismatched new passwords show "Passwords do not match." | Implemented |
| AUTH-5.3 | The new password shall meet the password rules (AUTH-9). On success the screen shall say "Password changed.", clear the fields, and keep this browser signed in, and every other session shall be signed out. The section shall say so before the user changes it: "Changing your password signs out your other devices." | Implemented |

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

Retired: the Settings screen and Profile moved to their own domain (SET), since Settings also holds settings that aren't about authentication.

| ID | Requirement | Status |
|---|---|---|
| AUTH-8.1 | The profile menu's **Settings** (APP-1.5) shall open the Settings screen (`/settings`, page title "Settings"), with the sections **Profile**, **Change Password** (AUTH-5.2), **Password Rules** (AUTH-9) and **Sign-in Protection** (AUTH-10). | Retired (see SET-1.1) |
| AUTH-8.2 | **Profile** shall show the username read-only (it can't be changed) and let the user edit **Display Name** (AUTH-2.10). Saving shall update the profile control's name and initials (APP-1.4) straight away. | Retired (see SET-2.1) |

## AUTH-9 Passwords are long enough to resist guessing

The rules are fixed and simple: a minimum length, without character-class rules that push people toward predictable patterns. Nothing about them is configurable (decided 2026-10-15, replacing rules the owner could edit in Settings).

| ID | Requirement | Status |
|---|---|---|
| AUTH-9.1 | A password shall be at least 8 characters, at most 72 bytes when encoded as UTF-8 (bcrypt's limit), and not the same as the username, ignoring case. | Implemented |
| AUTH-9.2 | **Password Rules** in Settings shall let the user set the **Minimum length**, from 12 to 64, and turn on any of: **Require an uppercase letter**, **Require a lowercase letter**, **Require a number**, **Require a symbol**. All four are off by default. | Retired (2026-10-15: the rules are fixed, AUTH-9.1) |
| AUTH-9.3 | The rules shall be stored with the instance, so they apply after restarts and upgrades. Changing them doesn't affect the current password; they apply the next time it's set. | Retired (2026-10-15: nothing is stored, see AUTH-9.5) |
| AUTH-9.4 | Wherever a password is set (Register, Change Password), the form shall show the rules under the field ("At least 8 characters") and mark them met or unmet as the user types, and the server shall refuse a password that breaks any of them with a message naming each one (for example "Password must be at least 8 characters."). | Implemented |
| AUTH-9.5 | A password set before the rules (or before they change) shall keep working for signing in: the rules apply the next time a password is set. | Implemented |

## AUTH-10 Repeated wrong passwords are slowed down

Guessing is limited per network address rather than by locking the account, so someone else on the network can't lock the owner out.

| ID | Requirement | Status |
|---|---|---|
| AUTH-10.1 | After the maximum number of failed sign-ins (default 5) from one network address within the window (default 15 minutes), the server shall refuse further sign-in attempts from that address until the lockout (default 15 minutes) has passed, even with the right password, with 429 "Too many failed sign-in attempts. Try again in N minutes." ("1 minute" when one is left), and a `Retry-After` header. A failed sign-in counts only within the window: older ones drop out of the count. | Implemented |
| AUTH-10.2 | Failed HTTP Basic credentials (AUTH-3.5) shall count toward the same limit, and a locked-out address shall be refused there too. | Retired: HTTP Basic was removed. API tokens (AUTH-11) are 256-bit random values that can't practically be guessed, so they need no limit |
| AUTH-10.3 | A successful sign-in shall reset that address's count. | Implemented |
| AUTH-10.4 | **Sign-in Protection** in Settings shall let the user set **Maximum failed attempts** (3 to 10), **Window** (5 to 60 minutes) and **Lockout** (5 to 60 minutes). | Retired (2026-10-15: the limits are server configuration, AUTH-10.7) |
| AUTH-10.5 | The server shall log each lockout as a warning with the address and time, without the username or password tried. | Implemented |
| AUTH-10.6 | Behind a reverse proxy, the address shall be the client's, not the proxy's, when the server is configured to trust the proxy (`TRUST_FIRST_PROXY`). Without it, the server ignores `X-Forwarded-For`, so a client can't escape a lockout by changing it. | Implemented |
| AUTH-10.7 | The limits shall be the defaults in AUTH-10.1 unless set in the server's environment: maximum failed attempts from 3 to 10, and the window and lockout from 5 to 60 minutes. The variables are `SIGN_IN_MAX_FAILED_ATTEMPTS`, `SIGN_IN_WINDOW_MINUTES` and `SIGN_IN_LOCKOUT_MINUTES`. The server shall refuse to start with a value that isn't a whole number in its range, logging which variable is wrong. | Implemented |

## AUTH-11 The user can let scripts and tools use the API with tokens

Personal API tokens let a script, a scheduled job, or a tool like `curl` call the finance API (`/api`) without signing in. They work like personal access tokens in other apps: the token is shown once, only a hash of it is kept, and it can be revoked at any time. Signing in, the password and the tokens themselves need a signed-in browser session.

| ID | Requirement | Status |
|---|---|---|
| AUTH-11.1 | Settings shall have an **API Tokens** section (SET-1.1) listing every token with its **Name**, **Access**, **Created**, **Last used** ("Never" if unused) and **Expires** ("Never", or "Expired" once past), newest first. With no tokens it shall say "No API tokens yet." | Implemented |
| AUTH-11.2 | **New Token** shall ask for a **Name** (1 to 100 characters), **Access** (**Read-only**, selected, or **Read & write**) and **Expiration** (**30 days**, **90 days**, selected, **1 year**, or **No expiration**). **Create** stays disabled until Name is filled in. | Implemented |
| AUTH-11.3 | After a token is created, the screen shall show it once, with a **Copy** button and the warning "Copy this token now. You won't be able to see it again." The server shall keep only a SHA-256 hash of it, so no screen or API can show it again. | Implemented |
| AUTH-11.4 | A token shall be `mf_` followed by 43 characters: 32 random bytes, base64url-encoded. | Implemented |
| AUTH-11.5 | **Revoke** on a token shall ask for confirmation, naming the token, then delete it. Requests using it fail from then on. | Implemented |
| AUTH-11.6 | A request to a finance API endpoint with the header `Authorization: Bearer <token>` shall be treated as signed in for that request only. No session or cookie is created. | Implemented |
| AUTH-11.7 | A request with an unknown, revoked or expired token shall get 401 "Invalid or expired API token.", even if it also carries a valid session cookie. | Implemented |
| AUTH-11.8 | A **Read-only** token shall be allowed only `GET` requests. Any other method shall get 403 "This API token is read-only." | Implemented |
| AUTH-11.9 | Tokens shall not work on the sign-in, registration, password and token endpoints (`/auth`): there they're ignored, so only a browser session can manage the account and its tokens. | Implemented |
| AUTH-11.10 | **Last used** shall be updated when a token is used successfully, accurate to the minute. | Implemented |
| AUTH-11.11 | Changing or resetting the password (AUTH-5, AUTH-12) shall not affect tokens. Each stays valid until it's revoked or expires. | Implemented |

## AUTH-12 The owner can get back in after forgetting the password

There's no email and no recovery key. Whoever can run commands on the host already controls the instance and its data, so the reset is a command run there, as in other self-hosted apps (decided 2026-10-16, over a recovery key in `.env` or recovery codes shown at registration).

| ID | Requirement | Status |
|---|---|---|
| AUTH-12.1 | The Login screen shall have a **Forgot password?** link that shows how to reset the password: run `docker exec -it moped-finance-api npm run reset-password` on the host (AUTH-12.2). It shall also say that restarting the app (`docker restart moped-finance-api`) ends a sign-in lockout (AUTH-10). | Implemented |
| AUTH-12.2 | The `reset-password` command shall show the instance's username and display name, ask for a **New password** and **Confirm new password** without showing what's typed, and save it. With no user yet, it shall say that registration is still open and change nothing. | Implemented |
| AUTH-12.3 | The new password shall meet the password rules (AUTH-9). One that breaks them, or doesn't match its confirmation, shall be refused with the reason and asked for again. Ctrl+C cancels without changing anything. | Implemented |
| AUTH-12.4 | Resetting the password shall sign out every session. API tokens keep working (AUTH-11.11). | Implemented |
| AUTH-12.5 | Without a terminal (input piped in), the command shall read the new password and its confirmation from the first two lines, so it can be scripted; a refused password then ends the command with an error instead of asking again. | Implemented |

## Notes

- **API tokens over plain HTTP.** Like the session cookie, a token crosses the network in clear text unless the app is served over HTTPS (see `docs/deployment.md`). Unlike the password, a token can be revoked on its own, expires, can be limited to reading, and isn't reused on other sites.

- **Lockouts are kept in memory** (decided 2026-10-16). There's one server process, so nothing is lost by not storing them, and restarting the server clears every lockout: the way back in for an owner who locked themselves out. Behind a reverse proxy without `TRUST_FIRST_PROXY`, every request seems to come from the proxy, so one person's failed sign-ins lock everyone out; deployment.md says to set it with a proxy.

- **Fresh instances are claimable.** Whoever registers first on a fresh instance becomes its owner. Accepted (2026-09-26) for a LAN-only host: the owner registers right after the first start (see `docs/deployment.md`), and AUTH-2.8 makes the one-time nature clear on screen.
