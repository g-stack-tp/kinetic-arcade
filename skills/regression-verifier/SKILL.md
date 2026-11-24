---
name: "regression-verifier"
description: >
  Project-specific regression verification skill for Kinetic Arcade. Requires
  every requested feature, bug fix, or state transition change to be registered
  as an executable assertion in scripts/verify.ts and verified via `npm run verify`
  before completing any change.
---

# Kinetic Arcade Regression Verifier

Whenever a change, new feature, or bug fix is requested in this repository, you MUST:

1. **Add or Update Regression Coverage**: Add deterministic test assertions in `scripts/verify.ts` covering the requested behavior and its edge cases before finishing the turn.
2. **Run the Full Verification Gate**: Execute `npm run verify` (plus `tsc --noEmit` and `vite build`) and confirm every check passes with zero failures.

## Covered Invariants

### 1. Purge & Clean Slate Completeness
- Purging workspace data (`purgeWorkspaceState`) MUST clear:
  - `quests` (`[]`), `questDrafts` (`[]`), `habits` (`[]`), and `habitDrafts` (`[]`)
  - `boss` (`null` — no residual raid steps or leftover DMG gates) and `bossDraft` (`null`)
  - `focusSessions` (`[]`)
  - `redeemedRewards` (`[]`)
  - `xp`, `coins`, `streakDays`, `streakShields`, `doubleXpCharges`, `focusMinutesToday`, `questsCompletedToday`, `habitsCheckedToday` (all `0`)
  - All `bounties` reset to `claimed: false`
- When `keepPersonalization` is `true`, `playerName`, `playerRole`, `avatarEmblem`, `avatarTone`, `dailyFocusGoalMinutes`, `defaultSprintMinutes`, `soundEnabled`, `aiModel`, and `aiAutoFallback` are preserved.
- When `keepPersonalization` is `false`, profile and AI settings reset to clean defaults (`Player One`, `Kinetic Builder`, `bolt`, `indigo`, `gemini-4-hydrogen`, `aiAutoFallback: true`).

### 2. Hydrating & Loading JSON Backups
- `hydrateWorkspaceState` MUST respect an explicit `boss: null` in persisted/imported JSON and NEVER silently resurrect the default demo boss encounter on reload.
- `parseAndHydrateWorkspaceJson` MUST reject malformed JSON or payloads missing `quests`.

### 3. Quest Board Filtering, Ordering, Completion & Clearing
- `filterAndOrderQuests` MUST apply `searchQuery` across ALL filter modes (`all`, `critical`, `focus`, `completed`), including completed quests shown under `all`, sort active quests ahead of completed quests by priority (`critical → focus → routine`), and sort completed quests by `completedAt` descending (most recently finished first).
- `clearCompletedQuestsState` MUST remove all completed quests while preserving active quests.
- `toggleQuestCompletionState` MUST double XP only when `doubleXpCharges > 0` and decrement `doubleXpCharges` by 1, and clamp XP/coins to `>= 0` when untoggled.

### 4. Boss Encounter Lifecycle, Gate Evidence & Defer / Optional Raids (Phase 1 & 1B)
- `createBossEncounterState` creates a Boss Raid with `commitment` (`'required' | 'optional'`), optional step flags (`optional?: boolean`), and `maxHp = requiredSteps.length * 100` (falling back to all steps when every step is marked optional).
- `getBossProgress` computes required HP/defeat status independently of optional stretch gates; completing optional gates awards `+25 XP` and `+10 Coins` per optional gate upon bounty claim without blocking defeat if unchecked.
- `toggleBossCommitmentState` toggles raid commitment; `toggleBossStepOptionalState` toggles a gate's `optional` flag and resyncs `boss.maxHp`.
- `toggleBossStepState` toggles damage gates cleanly; `updateBossStepOutcomeState` and `updateBossRaidDebriefState` capture gate/raid `outcomeText` and normalized `references` without mutating completion state.
- `claimBossBountyState` only grants XP & coins when `getBossProgress(boss).bossDefeated` is true and `bountyClaimed` is `false`, awarding `computeBossDocumentationBonus(boss)` (`max(15, round(rewardCoins * 0.15))`) when `bossHasEvidence(boss)` is true plus optional stretch bonuses, and recording `claimedAt`, `bonusCoinsAwarded`, `stretchBonusXpAwarded`, and `stretchBonusCoinsAwarded`.
- `deferBossEncounterState` parks the active boss into `deferredRaids` (preserving gate progress/evidence and setting optional `resumeAt` and `deferReason`) and sets `boss: null`; `getDueDeferredRaids` filters parked raids where `resumeAt <= nowIso`; `orderDeferredRaids` sorts due raids first, then `required` before `optional`, then soonest `resumeAt`, then most recently deferred; `orderBossSteps` places required gates ahead of optional stretch gates.
- `resumeDeferredRaidState` restores a parked raid to `state.boss` (clearing defer metadata), archives any currently claimed `state.boss` into `raidHistory`, or automatically parks any unclaimed active `state.boss` into `deferredRaids` rather than overwriting it; `discardDeferredRaidState` deletes a parked raid; `hydrateWorkspaceState` backfills `deferredRaids: []` and `raidHistory: []`, and `purgeWorkspaceState` clears both.
- `createBossEncounterState` seamlessly supports launching additional Boss Encounters: if `state.boss` is already claimed (`bountyClaimed: true`), it archives it into `raidHistory`; if unclaimed, it parks it safely in `deferredRaids`.
- `archiveBossEncounterState` and `clearBossEncounterState` archive claimed raids into `raidHistory` while setting `boss: null`; `deleteArchivedRaidState` removes archived entries cleanly.

### 5. Human-in-the-Loop (HITL) AI Draft Staging & Bounds
- `stageQuestDraftsState` MUST isolate staged drafts in `questDrafts` without mutating `quests`, `xp`, or `coins`.
- `clampQuestDraft` MUST enforce economy bounds (`xpReward` within `20–200`, `coinReward` within `10–60`, allowed category & priority enums).
- `updateQuestDraftState` edits drafts in place; `discardQuestDraftState` and `clearQuestDraftsState` remove drafts with zero side effects on actuals.
- `approveQuestDraftState` and `approveAllQuestDraftsState` promote reviewed drafts into active `Quest` actuals (`completed: false`) without prematurely granting completion XP.
- `stageHabitDraftsState`, `clampHabitDraft`, `updateHabitDraftState`, `discardHabitDraftState`, `clearHabitDraftsState`, `approveHabitDraftState`, and `approveAllHabitDraftsState` enforce the same isolation, bounds clamping (`xpReward` `15–80`, `coinReward` `5–25`, `targetDaysPerWeek` `1–7`), and human approval before adding actual `Habit` rows.
- `stageBossDraftState`, `updateBossDraftState`, `discardBossDraftState`, and `approveBossDraftState` keep Boss Raid drafts isolated until human approval converts them into an active `BossEncounter`.

### 6. Habits & Daily Cadence
- `toggleHabitDayState` updates `habitsCheckedToday` accurately for today's date key and grants/reverts XP & coins only for today's check-in.
- `buildHabitHeatmapModel` and `classifyCellIntensity` deterministically compute the 7-day `(habit × day)` matrix, intensity levels (`0` Missed, `1` Building, `2` On Track, `3` Target Hit), daily completion percentages, early-vs-recent trend delta, peak day, and empty-habit states.

### 7. Quest Outcome Capture, Reference Locations & Follow-Up Chaining
- `updateQuestOutcomeState` captures `outcomeText` and normalizes `references` (`url`, `path`, `note`), dropping blank locations; `sanitizeReferenceUrl` accepts strictly `http:`/`https:` URLs and rejects unsafe schemes (`javascript:`, `data:`).
- `filterAndOrderQuests` searches across `outcomeText`, `triggeredFromTitle`, and `references` (`label` & `location`).
- `clearCompletedQuestsState(state, { preserveWithOutcomeOrRefs: true })` preserves completed quests that carry outcomes or references while removing routine completed quests; untoggling preserves captured outcomes and references.
- `toggleQuestCompletionState` activates `FollowUpRule`s with `delayHours === 0` immediately into `quests` and queues `delayHours > 0` rules into `scheduledFollowUps` with inherited `references` and `triggeredFromTitle`, guarding against duplicate triggers via `triggeredAt` on re-toggle.
- `evaluateScheduledFollowUpsState`, `triggerScheduledFollowUpNowState`, `discardScheduledFollowUpState`, and `orderScheduledFollowUps` manage deferred triggers cleanly (chronologically ordered by `triggerAt` ascending); `hydrateWorkspaceState` backfills `scheduledFollowUps: []` and `purgeWorkspaceState` clears `scheduledFollowUps`.

### 8. AI Drafting Model Selection & Resilience
- `normalizeAiModel` strictly allowlists supported Gemini models (`gemini-4-hydrogen`, `gemini-3.1-flash-lite`) and clamps unknown or deprecated model strings back to `DEFAULT_AI_MODEL` (`gemini-4-hydrogen`).
- `hydrateWorkspaceState` backfills `aiModel: 'gemini-4-hydrogen'` and `aiAutoFallback: true` on legacy backups and preserves valid persisted preferences.
- `createStudyPresetState` and `purgeWorkspaceState(state, true)` preserve `aiModel` and `aiAutoFallback`; `purgeWorkspaceState(state, false)` resets them to defaults.

## Protocol for Future Changes

When adding a new screen, reducer, or rule:
1. Extract pure state transitions into `src/utils/workspaceState.ts` (or a dedicated utility module).
2. Import those exact functions in `scripts/verify.ts` and add a named test block (`verify("<feature name>", () => { ... })`).
3. Run `npm run verify` to confirm zero regressions across all existing and new invariants.
