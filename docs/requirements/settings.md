# Settings (`SET`)

Settings (`/settings`) is where the owner changes how the app works for them: a list of sections, each its own page below Settings (APP-1.8). Sections that belong to another domain, such as the password and API tokens, keep their rules in that domain; this file owns the screen itself and the settings that belong nowhere else.

## SET-1 The user can find every setting in one place

| ID | Requirement | Status |
|---|---|---|
| SET-1.1 | The profile menu's **Settings** (APP-1.5) shall open Settings (`/settings`, page title "Settings"), listing these sections in this order, each with a one-line description and linking to its own page: **Profile** (SET-2), **Appearance** (SET-3), **Institutions** (INST-1), **Categories** (CAT-1), **Rules** (CAT-8), **Bank Sync** (SET-4), **Change Password** (AUTH-5.2), **API Tokens** (AUTH-11), **Password Rules** (AUTH-9) and **Sign-in Protection** (AUTH-10). Sections that aren't built yet are left out. | Partial |

## SET-2 The user can manage their profile

| ID | Requirement | Status |
|---|---|---|
| SET-2.1 | **Profile** shall show the username read-only (it can't be changed) and let the user edit **Display Name** (AUTH-2.10). Saving shall update the profile control's name and initials (APP-1.4) straight away. | Planned |

## SET-3 The user can choose how the app looks

| ID | Requirement | Status |
|---|---|---|
| SET-3.1 | **Appearance** shall offer **Theme**: **Dark** (selected; today's look), **Light**, or **Match system**. The choice shall apply straight away, be stored with the instance so every device uses it, and be applied before the first screen draws, so the app doesn't flash the other theme. | Planned |

## SET-4 The user can control bank sync

| ID | Requirement | Status |
|---|---|---|
| SET-4.1 | **Bank Sync** shall let the user turn scheduled sync (INST-2.1) on or off and choose how often it runs, and show when it last ran and whether it succeeded. Each institution can still be synced on demand from its card (INST-2.2). The details are decided with the provider (`TODO.md`, Automated bank sync). | Planned |

## Known gaps

- **Only Institutions, Categories and API Tokens exist (SET-1.1).** Profile, Appearance, Rules, Bank Sync, Change Password, Password Rules and Sign-in Protection aren't built.
- **The app is dark only (SET-3.1).**

## Notes

- AUTH-8 held the Settings screen and Profile until 2026-09-27. They moved here because Settings also holds sections that aren't about authentication, such as Appearance.
