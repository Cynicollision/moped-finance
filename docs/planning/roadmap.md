# Roadmap

The release milestones toward 1.0, one line each. v0.1.0, the initial release with manual accounts, came out on 2026-11-07. Each milestone ends with a release: a `vX.Y.0` tag and a GitHub Release (see [development.md](../development.md#releases)). Version 1.0 is the release that finishes the last milestone below; until then each one takes the next minor version.

| Milestone | Release | What it adds | Status |
|---|---|---|---|
| [M01 Manual accounts](milestones/M01-manual-accounts.md) | v0.1 | Accounts, balances, transactions, categories, budget and spending, entered by hand or imported | Released 2026-11-07 (its file was written after the fact, and is lighter than the rest) |
| [M02 Bank sync and categorization](milestones/M02-bank-sync-and-categorization.md) | v0.2 | Transactions and balances from SimpleFIN Bridge, with rules and learning that set categories on add, import and sync | In progress |
| [M03 Real estate values](backlog.md#m03-real-estate-values-v03) | v0.3 | Real Estate accounts' values from an online estimate | Not planned yet |

Each milestone being built has a file in [milestones/](milestones/), numbered in order (`M02-bank-sync-and-categorization.md`) and named by milestone, not version. It holds the plan, the tasks and what was learned building it. A milestone not planned yet has a section in [backlog.md](backlog.md) instead.

## How a milestone file works

- **The plan half is living** while the milestone is built: tasks are ticked, and each PR adds a *Changed while doing it* note under its task. **The outcome half is written once**, when the milestone closes. After that the file is a dated record and isn't edited again.
- **It holds the plan, not the spec.** What the app does is in [requirements/](../requirements/README.md), with each sub-requirement's status. How the milestone is built is in its design doc beside it (`M02-design.md`) while it's being built; when it ships, what stays true is folded into [architecture.md](../architecture.md) and the design doc is deleted. The milestone file says what to build in what order, why, and how it went.
- **Only the current milestone has a full plan.** Later ones are a line in the table above and a section in the backlog (maybe an item or two) until a planning session writes their file.

## Skeleton

```markdown
# MNN — Title

Status: planned | in progress | released YYYY-MM-DD as vX.Y.0

# Plan

## Question

The one question the milestone answers, and what "yes" means, in checks a person could run.

## Scope

In: ... Out (and where it goes instead): ...

## Decisions taken in this plan

Numbered, each cheap to change before its task starts.

## How to work on a task

## Tasks

- [ ] **T1 — Name.** Requirements, what to build. *Done when:* an observable check.

## Definition of done

- [ ] Checks that, together, answer the question.

# Outcome

## Answer
## What was built
## What we learned
## Changes to the plan
## Follow-ups
```
