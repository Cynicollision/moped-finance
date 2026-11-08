---
name: next
description: Make a session's worth of progress on Moped Finance from TODO.md. Proposes the unblocked items to work on next (or takes the one named), settles questions one at a time, then plans, builds and opens one PR at a time.
argument-hint: '[TODO item or requirement IDs] [notes on it]'
disable-model-invocation: true
---

# Next

Make progress on the app as outlined in `TODO.md`, one session's focus at a time.

Arguments: `$ARGUMENTS`

## 1. Choose the focus

**If the arguments name an item** (its wording, a requirement ID, or a milestone item's bold title), that's the focus; anything else in them is the user's notes on it. Find the matching `TODO.md` item and go to step 2. If it matches more than one, or none, say what you found and ask.

**Otherwise, propose candidates.** Read `TODO.md`, and the requirement files its current milestone points at, then offer two to four items that should come next. Choose only from:

- `TODO.md` items, in its order: within a milestone, the first unfinished items come first, since later items build on them. A later item qualifies only if nothing before it that it depends on is still open.
- `Partial` or `Planned` requirements already in progress, or that the next items need built first.
- Tech debt, cleanup and dependency upkeep (`npm outdated`, `npm audit --omit=dev` in `client/` and `server/`, per `docs/development.md#dependencies`) when `TODO.md` lists them or they unblock something.

Don't scan the codebase for new work at this step. Skip items `TODO.md` says are waiting on a decision or another release, unless the decision is what the session would be.

Present the candidates with `AskUserQuestion`, recommendation first, each with a one-line description of what it delivers and what it unblocks. Any notes in the arguments apply to the chosen item.

## 2. Get the complete picture

Read the doc that fits the work (per `CLAUDE.md`), the item's requirements, and the requirements they touch in other domains, so you know the whole intended behavior, not only the rows the item names. Read the milestone's design doc if there is one. Then read the code the item changes.

## 3. Settle questions, one at a time

Ask about anything the requirements, design and code don't settle: a decision, a gap, a requirement that disagrees with the code or with another requirement. Ask **one question per message**, with `AskUserQuestion` when the answer is a choice (recommendation first), and wait for the answer before the next. Don't ask what a sensible default or the existing patterns settle; say which default you took instead.

Write each decision into the requirement or design doc it belongs to as you go (with the date when the doc records decisions that way), so it outlives the session.

## 4. Plan in a few lines

Give a short plan in chat: how many PRs and what each delivers, the main changes, and the requirements and docs each one updates. Wait for the user's go-ahead or changes before editing code.

## 5. Build, one PR at a time

For each PR:

1. Branch from an up-to-date `main` as `claude/<short-kebab-summary>`.
2. Build it, following `docs/conventions.md` and naming new tests after their requirement IDs.
3. Keep the docs in step in the same PR: requirement statuses and wording, the design doc where the code proves it wrong, `architecture.md`/`development.md` and the rest when they go stale. Delete the `TODO.md` item once it's done. Add follow-up work you find to the right milestone, or adjust later items, per `CLAUDE.md`'s Backlog rules.
4. For anything the browser shows, test it in the app (below).
5. Run the checks in `docs/development.md#before-opening-a-pr`, then open the PR with `gh pr create`, reporting any failures in its description.
6. **Stop and let the user review and merge.** Open the next PR only after they say this one is merged, starting again from step 1 on the updated `main`.

## Testing in the app

Use the built-in browser. Check `tabs_context` for a tab already signed in to the app. If there isn't one:

- Make sure the API is up (`docker compose ps`; `docker compose up -d` if not).
- Start the client with `preview_start`, using the client configuration in `.claude/launch.json` if there is one (otherwise `npm start` in `client/` serves http://localhost:4200).
- Ask the user to sign in in the browser pane, and continue when they say they have. Never type the password yourself.
