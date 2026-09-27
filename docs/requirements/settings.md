# Settings (`SET`)

The Settings screen (`/settings`) is where the owner changes how the app works for them. It's one screen with several sections. Sections that belong to another domain, such as the password and API tokens, keep their rules in that domain; this file owns the screen itself and the settings that belong nowhere else.

## SET-1 The user can find every setting in one place

| ID | Requirement | Status |
|---|---|---|
| SET-1.1 | The profile menu's **Settings** (APP-1.5) shall open the Settings screen (`/settings`, page title "Settings"), with these sections in this order: **Profile** (SET-2), **Appearance** (SET-3), **Change Password** (AUTH-5.2), **API Tokens** (AUTH-11), **Password Rules** (AUTH-9) and **Sign-in Protection** (AUTH-10). Each section is a titled card on one scrolling page. Sections that aren't built yet are left out. | Partial |

## SET-2 The user can manage their profile

| ID | Requirement | Status |
|---|---|---|
| SET-2.1 | **Profile** shall show the username read-only (it can't be changed) and let the user edit **Display Name** (AUTH-2.10). Saving shall update the profile control's name and initials (APP-1.4) straight away. | Planned |

## SET-3 The user can choose how the app looks

| ID | Requirement | Status |
|---|---|---|
| SET-3.1 | **Appearance** shall offer **Theme**: **Dark** (selected; today's look), **Light**, or **Match system**. The choice shall apply straight away, be stored with the instance so every device uses it, and be applied before the first screen draws, so the app doesn't flash the other theme. | Planned |

## Known gaps

- **Only API Tokens exists (SET-1.1).** Profile, Appearance, Change Password, Password Rules and Sign-in Protection aren't built.
- **The app is dark only (SET-3.1).**

## Notes

- AUTH-8 held the Settings screen and Profile until 2026-09-27. They moved here because Settings also holds sections that aren't about authentication, such as Appearance.
