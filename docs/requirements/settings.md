# Settings (`SET`)

Settings (`/settings`) is where the owner changes how the app works for them: a list of sections, each its own page below Settings (APP-1.8). Sections that belong to another domain, such as the password and API tokens, keep their rules in that domain; this file owns the screen itself and the settings that belong nowhere else.

## SET-1 The user can find every setting in one place

| ID | Requirement | Status |
|---|---|---|
| SET-1.1 | The profile menu's **Settings** (APP-1.5) shall open Settings (`/settings`, page title "Settings"), listing these sections in this order, each with a one-line description and linking to its own page: **Profile** (SET-2), **Appearance** (SET-3), **Dashboard** (SET-5), **Institutions and Accounts** (INST-1), **Categories** (CAT-1), **Rules** (CAT-8), **Bank Sync** (SET-4), **Change Password** (AUTH-5.2) and **API Tokens** (AUTH-11). Sections that aren't built yet are left out. | Partial |
| SET-1.2 | Settings shall be stored with the instance, not in the browser, so every device sees the same ones and they survive restarts and upgrades. A setting the user has never changed has its default. | Implemented |

## SET-2 The user can manage their profile

| ID | Requirement | Status |
|---|---|---|
| SET-2.1 | **Profile** shall show the username read-only (it can't be changed) and let the user edit **Display Name** (AUTH-2.10). Saving shall say "Profile saved" and update the profile control's name and initials (APP-1.4) straight away. | Implemented |

## SET-3 The user can choose how the app looks

| ID | Requirement | Status |
|---|---|---|
| SET-3.1 | **Appearance** shall offer **Theme**: **Dark** (the default), **Light**, or **Match system**, which follows the device's light or dark setting as it changes. The choice shall apply straight away, charts included, be stored with the instance (SET-1.2), and be applied before the first screen draws, so the app doesn't flash the other theme. | Implemented |

## SET-4 The user can control bank sync

Bank sync uses [SimpleFIN Bridge](https://beta-bridge.simplefin.org) (decided 2026-10-15). The user links their banks in Bridge, not in this app, and gives the app one connection that covers all of them.

| ID | Requirement | Status |
|---|---|---|
| SET-4.1 | **Bank Sync** shall let the user turn scheduled sync (INST-2.1) on or off and choose how often it runs, and show when it last ran and whether it succeeded, with **Sync now** to sync on demand. The details are decided with the design (`TODO.md`, Automated bank sync). | Planned |
| SET-4.2 | **Bank Sync** shall let the user connect by pasting a SimpleFIN **setup token**. The server shall exchange it for an access URL straight away and store that with the instance (SET-1.2); no screen or API shall show the access URL again. Once connected, the section shall say so, with a **Disconnect** button that, after confirming, removes the stored access URL. The connection is set in Settings only, not in the server's environment. | Planned |

## SET-5 The user can choose how the Dashboard groups accounts

| ID | Requirement | Status |
|---|---|---|
| SET-5.1 | **Dashboard** shall offer **Show Retirement as its own group** (on by default). When it's off, the Dashboard lists Retirement accounts under **Investments**, whose total and change (DASH-2.2) then include them, and doesn't show a Retirement group. Account types and groups elsewhere are unchanged. The change shall apply when the user next opens the Dashboard. | Implemented |

## Known gaps

- **Rules and Bank Sync aren't built (SET-1.1).** The other sections exist.

## Notes

- AUTH-8 held the Settings screen and Profile until 2026-09-27. They moved here because Settings also holds sections that aren't about authentication, such as Appearance.
- **Some limits aren't settings** (decided 2026-10-15). The password rules are fixed (AUTH-9.1), and the sign-in protection limits (AUTH-10.7) are optional environment variables rather than a Settings page. Both have values that suit nearly everyone, which keeps Settings to what the owner changes day to day.
- **How the theme shows before the app loads (SET-3.1).** The browser keeps a copy of the last theme it showed and applies it before anything draws (`public/theme.js`). A browser that has never opened the app, or whose site data was cleared, has no copy: it starts dark and switches once the stored setting loads after signing in.
- **Why the SimpleFIN connection isn't an environment variable.** A setup token works once: the app has to exchange it for the access URL, which is the real credential. Pasting the token into Settings does that in one step; an environment variable would mean exchanging it by hand. Bridge can revoke the access URL at any time, after which the user connects again with a new token.
