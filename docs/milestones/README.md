# Milestones

One file per milestone, numbered in order: `M02-bank-sync-and-categorization.md`. Each milestone ends in a release (M02 is v0.2.0), but files are named by milestone, not version. [TODO.md](../../TODO.md) lists the milestones in order with one line each; the current milestone's file holds its plan, its tasks and what was learned building it.

| Milestone | Release | Status |
|---|---|---|
| [M01 — Manual accounts](M01-manual-accounts.md) | v0.1.0 | Released 2026-11-07 (written after the fact, and lighter than the rest) |
| [M02 — Bank sync and categorization](M02-bank-sync-and-categorization.md) | v0.2.0 | Planned |

## How a milestone file works

- **The plan half is living** while the milestone is built: tasks are ticked, and each PR adds a *Changed while doing it* note under its task. **The outcome half is written once**, when the milestone closes. After that the file is a dated record and isn't edited again.
- **It holds the plan, not the spec.** What the app does is in [requirements/](../requirements/README.md), with each sub-requirement's status. How the milestone is built is in its design doc beside it (`M02-design.md`) while it's being built; when it ships, what stays true is folded into [architecture.md](../architecture.md) and the design doc is deleted. The milestone file says what to build in what order, why, and how it went.
- **Only the current milestone has a full plan.** Later ones are a line in `TODO.md` (and maybe an item or two) until a planning session writes their file.

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
