# Boss Raid & Raid Bounty Evolution Plan

**Status:** Phase 1, Phase 1B & Shipped Raid Archive Implemented · Phase 2 (Weighted/Counter Gates & Quest Linkage) & Phase 3 Planned  
**Scope:** Evolve Boss Encounters (`BossEncounter`, `BossStep`) and Raid Bounties from binary checkboxes into verifiable, flexible milestone records with gate evidence, raid debriefs, raid deferral/parking, optional raids & stretch gates, weighted/counter gates, Quest Board linkage, raid archiving, and post-raid follow-up chaining.

---

## 1. Problem Statement

Previously, Boss Encounters (`src/types.ts`, `src/utils/workspaceState.ts`, `src/components/QuestBoardScreen.tsx`) behaved strictly as a single-slot, flat checklist:

1. Each `BossStep` stored only `{ id, title, damage: 100, completed: boolean }`, offering no way to record what actually shipped (PR links, release tags, walkthrough videos, verification paths, or gate decisions).
2. `claimBossBountyState` evaluated only `steps.every((s) => s.completed) && !bountyClaimed`, granting flat `rewardXp` and `rewardCoins` with no incentive or place for milestone debriefs, and blocking the entire Raid Bounty if any non-critical stretch gate wasn't ticked.
3. `AppState.boss` held only a single active raid, and `clearBossEncounterState` set `boss: null`, permanently erasing all gate context and shipping proof with no way to defer or park an in-progress raid when priorities shifted.
4. `Quest.bossStepId` was declared on `Quest` (`src/types.ts`) but not yet connected to Boss HP or gate completion.

---

## 2. Phased Architecture & Rollout Plan

### Phase 1 — Gate Evidence, Raid Debrief & Documentation Bonus *(Implemented)*

**Goal:** Turn every Boss Gate and Raid Bounty into a verifiable ship record without breaking simple quick-check workflows.

- **Data Model (`src/types.ts`)**:
  - Extend `BossStep` with `outcomeText?: string` and `references?: QuestReference[]` (reusing `QuestReference`, `inferReferenceKind`, and `sanitizeReferenceUrl`).
  - Extend `BossEncounter` with `raidOutcomeText?: string`, `raidReferences?: QuestReference[]`, `claimedAt?: string`, and `bonusCoinsAwarded?: number`.
- **State Reducers (`src/utils/workspaceState.ts`)**:
  - `bossHasEvidence(boss)`: returns `true` when `raidOutcomeText`, `raidReferences`, or any `BossStep`'s `outcomeText` / `references` is non-empty.
  - `computeBossDocumentationBonus(boss)`: non-blocking bonus equal to `Math.max(15, Math.round(boss.rewardCoins * 0.15))` when `bossHasEvidence(boss)` is `true`, and `0` otherwise.
  - `updateBossStepOutcomeState(state, stepId, patch)`: saves trimmed `outcomeText` and normalized `references` on a gate without altering `completed` or `damage`.
  - `updateBossRaidDebriefState(state, patch)`: saves raid-level `raidOutcomeText` and normalized `raidReferences`.
  - `claimBossBountyState(state, nowIso)`: grants `rewardXp` and `rewardCoins + bonusCoins`, records `claimedAt` and `bonusCoinsAwarded`, and stays idempotent on repeat calls.
- **UI (`src/components/QuestBoardScreen.tsx`, `src/App.tsx`)**:
  - Split each Boss Gate card into a tactile check ring/title button (toggles `damage` HP) and an inline **Evidence** drawer toggle (`Outcome & Refs`) with outcome notes, safe `http:`/`https:` links, and one-click clipboard copy for paths/notes.
  - Add a **Raid Debrief** panel on the active Boss Encounter showing raid-level summary/references, a consolidated rollup of all gate references, and the active **Evidence Bonus** status (`+15%` bonus Coins).

---

### Phase 1B — Defer Raid & Optional Raid / Optional Gates *(Implemented)*

**Goal:** Align Boss Raids with real-world Agile/Kanban WIP deferral and MoSCoW release readiness practices—allowing teams to park an active raid for later and separate blocking gates from optional stretch goals.

- **Data Model (`src/types.ts`)**:
  - Add `BossCommitment = 'required' | 'optional'` on `BossEncounter` and `BossDraft` (`'required'` by default).
  - Add `optional?: boolean` on `BossStep` and `BossDraftStep` to distinguish blocking gates from optional stretch gates.
  - Add `deferredAt?: string`, `resumeAt?: string`, `deferReason?: string`, `stretchBonusXpAwarded?: number`, and `stretchBonusCoinsAwarded?: number` on `BossEncounter`.
  - Add `deferredRaids: BossEncounter[]` to `AppState` (backfilled to `[]` in `hydrateWorkspaceState`, cleared in `purgeWorkspaceState`).
- **State Reducers (`src/utils/workspaceState.ts`)**:
  - `getBossProgress(boss)`: computes `requiredMaxHp`, `requiredDamageDealt`, `remainingRequiredHp`, `bossDefeated` (satisfied once all required gates are completed, falling back to all gates only if every gate is marked optional), and optional stretch counts.
  - `toggleBossCommitmentState(state, commitment?)` and `toggleBossStepOptionalState(state, stepId)`: toggle raid commitment (`Core Raid` vs `Optional Raid`) and individual gate optionality (`Required` vs `Optional`), keeping `boss.maxHp` synced to `requiredMaxHp`.
  - `claimBossBountyState`: unlocks defeat & base bounty once all required gates are completed, plus awards `+25 XP` and `+10 Coins` per completed optional stretch gate alongside the Evidence Bonus.
  - `deferBossEncounterState(state, { delayHours, reason, nowIso })`: moves the active `boss` into `deferredRaids` with optional scheduled `resumeAt` and `deferReason`, preserving all gate progress, outcomes, and references.
  - `resumeDeferredRaidState(state, raidId)`: restores a deferred raid into `state.boss` (automatically parking any currently active raid into `deferredRaids` so no progress is lost).
  - `discardDeferredRaidState(state, raidId)`, `getDueDeferredRaids(deferredRaids, nowIso)`, `orderDeferredRaids(deferredRaids, nowIso)`, and `orderBossSteps(steps)`: manage removal, urgency-first backlog sorting (due -> core -> soonest `resumeAt`), and required-before-optional gate ordering.
- **UI (`src/components/QuestBoardScreen.tsx`, `src/App.tsx`)**:
  - Add a **Core Raid / Optional Raid** toggle on the active Boss card, Boss Draft staging tray, and Manual Composer, plus an inline **Optional / Required** toggle on every gate card (grouping Required Gates ahead of Optional Stretch Gates).
  - Add a **Defer** control on the active Boss Encounter (`Later (Manual)`, `In 24h`, `In 72h`, `In 1 week` + optional note); surface **due** deferred raids (`resumeAt <= now`) in the top review zone while anchoring Today’s Quests above the fold ahead of the Boss Encounter, AI Quest Planner, and Deferred Backlog.

---

### Phase 2 — Counter/Weighted Gates, Quest Board Linkage & Raid Archive *(Archive Implemented; Gates & Linkage Planned)*

**Goal:** Support non-binary gates, connect daily Quest Board execution to Boss HP, and preserve shipped milestones after clearing.

- **Implemented — Shipped Raid Archive & Continuous Multi-Raid Flow**:
  - Added `raidHistory: BossEncounter[]` to `AppState` (hydrated to `[]` for legacy backups, cleared on `purgeWorkspaceState`).
  - `createBossEncounterState`, `archiveBossEncounterState`, `clearBossEncounterState`, and `resumeDeferredRaidState` automatically archive claimed raids (`bountyClaimed: true`) into `raidHistory` and park unclaimed active raids safely into `deferredRaids` whenever a new raid is launched.
  - Added prominent **`Start Next Raid`** / **`New Raid`** inline launchers (supporting both AI drafting and Manual Composer) directly on active and completed Boss Encounters, plus a collapsible **Shipped Boss Raids** archive drawer and persistent `Boss Slayer` achievement tracking.
- **Planned — Counter/Weighted Gates & Quest Board Linkage**:
  - Extend `BossStep` with `targetCount?: number` and `currentCount?: number` for iterative gates (e.g., `Review 4 PRs` `2/4`), plus configurable gate `damage` weights (`50 | 100 | 150 | 200`).
  - Wire `Quest.bossStepId`: add `spawnQuestFromBossStepState`, `incrementBossStepCounterState`, and bidirectional completion/evidence sync between linked Quests and `BossStep`s.

---

### Phase 3 — Post-Raid Follow-Up Rules & AI Debrief *(Planned)*

**Goal:** Automate post-release monitoring and next-milestone handoffs once a Raid Bounty is claimed.

- **Data Model & Reducers**:
  - Add `postRaidFollowUps?: FollowUpRule[]` to `BossEncounter`.
  - On `claimBossBountyState`, fire immediate (`delayHours === 0`) or deferred (`delayHours > 0`) follow-up quests into `quests` / `scheduledFollowUps`, guarded idempotently by `bountyClaimed`.
- **AI Integration (`server.ts`, `src/utils/aiClient.ts`)**:
  - Add a **"Draft Post-Raid Follow-Ups"** action on defeated raids reusing `POST /api/ai/suggest-quests` (`mode: 'followups'`, honoring the player's Experience `aiModel` & `aiAutoFallback` settings) seeded with `boss.title`, `raidOutcomeText`, and rolled-up gate outcomes/references, staging suggestions in `questDrafts` for HITL approval.

---

## 3. Verification & Regression Gates

Every phase must add deterministic unit assertions in `scripts/verify.ts` and register its invariants in `skills/regression-verifier/SKILL.md`:

- **Phase 1 & 1B**: Gate outcome/reference normalization, `javascript:` URL rejection, `bossHasEvidence` & `computeBossDocumentationBonus`, `claimBossBountyState` base vs evidence-bonus vs stretch-gate awards, `getBossProgress` optional gate defeat math, `deferBossEncounterState` / `resumeDeferredRaidState` auto-parking & `discardDeferredRaidState`, `deferredRaids` hydration/purge, and idempotency on repeat claims.
- **Phase 2 (upcoming)**: Counter gate bounds, weighted `maxHp` math, `Quest.bossStepId` bidirectional sync, and `raidHistory` archival/hydration/purge.
- **Phase 3 (upcoming)**: Post-raid `FollowUpRule[]` firing on bounty claim and AI follow-up lineage from `BossEncounter`.
