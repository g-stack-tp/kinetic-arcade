# 05. Quality, Verification & Regression Blueprint — Kinetic Arcade

## 1. Regression Governance (`skills/regression-verifier/SKILL.md`)

Kinetic Arcade enforces a repository-specific **Regression Verifier** protocol to prevent behavioral regressions across state transitions, economy math, purge/hydration boundaries, and data visualization models:

1. **Pure Logic Extraction**: State mutations and analytical calculations must reside in pure TypeScript modules (`src/utils/workspaceState.ts`, `src/utils/habitHeatmap.ts`, `src/data/initialData.ts`) rather than being buried inside React component callbacks.
2. **Executable Assertions**: Every new feature, state rule, or bug fix must register a named `verify(...)` block in `scripts/verify.ts`.
3. **Pre-Completion Gate**: Changes are only considered complete after all three commands succeed with exit code `0`:
   - `npm run verify` (Deterministic domain & HITL suite)
   - `npm run lint` (`tsc --noEmit`)
   - `npm run build` (`vite build`)

---

## 2. Automated Regression Suite (`scripts/verify.ts`)

Currently executes **25 deterministic assertions** (`node:assert/strict` via `tsx`):

| # | Invariant Verified | Target Functions |
| :-: | :--- | :--- |
| 1 | Workspace purge (keep profile) clears quests, all AI drafts, habits, boss (`null`), focus logs, rewards, XP, coins, streaks, and bounties while preserving player identity. | `purgeWorkspaceState` |
| 2 | Full purge resets profile fields back to blank Level 1 defaults (`Player One`, `Kinetic Builder`). | `purgeWorkspaceState` |
| 3 | Hydration & JSON import preserve explicit `boss: null` without resurrecting demo boss encounter. | `hydrateWorkspaceState`, `parseAndHydrateWorkspaceJson` |
| 4 | Malformed JSON syntax and payloads missing `quests` are cleanly rejected. | `parseAndHydrateWorkspaceJson` |
| 5 | Quest Board `searchQuery` filters across both active and completed quests under `All` mode. | `filterAndOrderQuests` |
| 6 | `Clear Completed` removes finished quests while preserving active quests. | `clearCompletedQuestsState` |
| 7 | Quest completion consumes 1 `doubleXpCharges` and doubles XP once. | `toggleQuestCompletionState` |
| 8 | Boss Encounter supports creation (`maxHp = steps × 100`), step damage, guarded bounty claiming, and clearing to `null`. | `createBossEncounterState`, `toggleBossStepState`, `claimBossBountyState`, `clearBossEncounterState` |
| 9 | HITL Quest Drafts isolate unapproved drafts from actuals, clamp XP (`20–200`) and Coins (`10–60`), support inline edits/discards, and promote without early completion XP. | `stageQuestDraftsState`, `clampQuestDraft`, `updateQuestDraftState`, `discardQuestDraftState`, `approveQuestDraftState` |
| 10 | HITL Quest batch `Approve All` & `Discard All` operate cleanly. | `approveAllQuestDraftsState`, `clearQuestDraftsState` |
| 11 | HITL Boss Draft decomposes, edits, discards without side effects, and launches active `BossEncounter` on approve. | `stageBossDraftState`, `updateBossDraftState`, `discardBossDraftState`, `approveBossDraftState` |
| 12 | Habit check-ins update today counter & XP on check (`checkedNow: true`) and revert accurately on uncheck (`checkedNow: false`, preventing false pulse/XP). | `toggleHabitDayState` |
| 13 | HITL Habit Drafts isolate drafts, clamp `xpReward` (`15–80`), `coinReward` (`5–25`), and `targetDaysPerWeek` (`1–7`, including `0 -> 1`), and support single/batch approval & discard. | `stageHabitDraftsState`, `clampHabitDraft`, `updateHabitDraftState`, `approveHabitDraftState`, `approveAllHabitDraftsState`, `discardHabitDraftState`, `clearHabitDraftsState` |
| 14 | Study preset fixture and Level/XP progression math behave deterministically. | `createStudyPresetState`, `getLevelInfo` |
| 15 | D3 Habit Heat Map model computes 7-day cell intensities (`0–3`), daily completion rates, early-vs-recent trend delta, peak day, and empty state deterministically. | `buildHabitHeatmapModel`, `classifyCellIntensity` |
| 16 | Quest `outcomeText` & `references` normalize/sanitize URLs, index in search, and survive completion untoggle. | `updateQuestOutcomeState`, `inferReferenceKind`, `sanitizeReferenceUrl`, `filterAndOrderQuests` |
| 17 | `Clear Routine` removes routine completed quests while preserving completed quests carrying captured outcomes or references. | `clearCompletedQuestsState` |
| 18 | Follow-up rules trigger immediately (`0h`) or queue (`> 0h`), inherit parent outcomes/refs, and stay idempotent across re-toggles. | `addQuestFollowUpRuleState`, `removeQuestFollowUpRuleState`, `toggleQuestCompletionState`, `evaluateScheduledFollowUpsState` |
| 19 | Queued follow-ups support manual `Trigger Now`, `Discard`, AI lineage propagation, hydration backfill, and purge cleanup. | `triggerScheduledFollowUpNowState`, `discardScheduledFollowUpState`, `hydrateWorkspaceState`, `purgeWorkspaceState` |
| 20 | Boss Raid Phase 1 captures gate evidence & raid debrief, computes `+15%` documentation bonus coins, and keeps bounty claim idempotent. | `updateBossStepOutcomeState`, `updateBossRaidDebriefState`, `bossHasEvidence`, `computeBossDocumentationBonus`, `claimBossBountyState` |
| 21 | Boss Raid Phase 1B supports optional raids, optional stretch gates (`+25 XP / +10 Coins`), all-optional defeat fallback, and draft flag preservation. | `getBossProgress`, `toggleBossCommitmentState`, `toggleBossStepOptionalState`, `approveBossDraftState`, `claimBossBountyState` |
| 22 | Boss Raid Phase 1B defer/resume swaps active raids safely, preserves gate state/evidence, tracks due schedule, discards, and hydrates/purges cleanly. | `deferBossEncounterState`, `getDueDeferredRaids`, `resumeDeferredRaidState`, `discardDeferredRaidState`, `hydrateWorkspaceState`, `purgeWorkspaceState` |
| 23 | Quest Board P0/P1 deterministic ordering sorts completed quests by `completedAt` desc, queued follow-ups by `triggerAt` asc, boss gates required-first, and deferred raids by due/core/soonest. | `filterAndOrderQuests`, `orderScheduledFollowUps`, `orderBossSteps`, `orderDeferredRaids` |
| 24 | AI Model selection enforces strict model allowlist normalization, backfills defaults on legacy hydration, and preserves/resets `aiModel` & `aiAutoFallback` across presets and workspace purges. | `normalizeAiModel`, `getAiModelLabel`, `hydrateWorkspaceState`, `createStudyPresetState`, `purgeWorkspaceState` |
| 25 | Multi-Boss Raid flow archives claimed raids into `raidHistory` when launching/resuming/clearing, parks unclaimed active raids into `deferredRaids`, supports archive deletion, and backfills/clears `raidHistory` on hydration & purge. | `createBossEncounterState`, `archiveBossEncounterState`, `clearBossEncounterState`, `resumeDeferredRaidState`, `deleteArchivedRaidState`, `hydrateWorkspaceState`, `purgeWorkspaceState` |

---

## 3. Live Runtime Health Check

After starting or restarting the server (`npm run dev` or `npm run start`):
- Verify Express health route returns `200 OK`: `curl -s -f http://localhost:3000/api/health` -> `{"ok":true}`
- Verify SPA root serves HTML `200 OK`: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` -> `200`
