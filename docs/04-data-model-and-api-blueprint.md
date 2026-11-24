# 04. Data Model & API Blueprint — Kinetic Arcade

## 1. Domain Data Model (`src/types.ts`)

### 1.1 Root State (`AppState`)
Persisted as JSON in `localStorage['kinetic_arcade_workspace_v1']` and portable via Export/Import JSON.

| Field Group | Fields | Notes |
| :--- | :--- | :--- |
| **Personalization & AI** | `playerName`, `playerRole`, `avatarEmblem`, `avatarTone`, `dailyFocusGoalMinutes`, `defaultSprintMinutes`, `soundEnabled`, `aiModel: AiModelId`, `aiAutoFallback: boolean` | Preserved on *Purge Activity Data* and workspace preset loads; reset to clean defaults (`gemini-4-hydrogen`, `aiAutoFallback: true`) on *Purge Everything*. |
| **Economy & Counters** | `xp`, `coins`, `streakDays`, `streakShields`, `doubleXpCharges`, `focusMinutesToday`, `questsCompletedToday`, `habitsCheckedToday` | All reset to `0` on workspace purge. |
| **Actual Entities** | `quests: Quest[]`, `scheduledFollowUps: ScheduledFollowUp[]`, `boss: BossEncounter \| null`, `deferredRaids: BossEncounter[]`, `raidHistory: BossEncounter[]`, `habits: Habit[]`, `bounties: DailyBounty[]`, `focusSessions: FocusSession[]`, `rewards: RewardItem[]`, `redeemedRewards: RedeemedReward[]` | Canonical user-committed items. `boss` is explicitly nullable (`null`); `deferredRaids`, `raidHistory`, and `scheduledFollowUps` backfill to `[]`. |
| **HITL Staging Entities** | `questDrafts: QuestDraft[]`, `bossDraft: BossDraft \| null`, `habitDrafts: HabitDraft[]` | Isolated AI-generated / parsed drafts awaiting human review. |

### 1.2 Key Entity Definitions

- **`AiModelId`**: `'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'`
- **`Quest`**: `id`, `title`, `notes?`, `category` (`Deep Work | Engineering | Design | Writing | Health`), `priority` (`critical | focus | routine`), `xpReward`, `coinReward`, `dueLabel`, `completed`, `completedAt?`, `bossStepId?`, `outcomeText?`, `references?: QuestReference[]`, `followUpRules?: FollowUpRule[]`, `parentQuestId?`, `triggeredFromTitle?`
- **`ScheduledFollowUp`**: `id`, `parentQuestId`, `parentQuestTitle`, `parentOutcomeText?`, `parentReferences?`, `title`, `notes?`, `category`, `priority`, `xpReward`, `coinReward`, `createdAt`, `triggerAt`
- **`BossEncounter`**: `id`, `title`, `subtitle`, `commitment?: 'required' | 'optional'`, `maxHp` (synced to required gates), `rewardXp`, `rewardCoins`, `bountyClaimed`, `claimedAt?`, `bonusCoinsAwarded?`, `stretchBonusXpAwarded?`, `stretchBonusCoinsAwarded?`, `raidOutcomeText?`, `raidReferences?: QuestReference[]`, `deferredAt?`, `resumeAt?`, `deferReason?`, `steps: BossStep[]` (`damage: 100`, `optional?`, `outcomeText?`, `references?`)
- **`Habit`**: `id`, `title`, `category`, `xpReward`, `coinReward`, `targetDaysPerWeek`, `history: Record<string, boolean>` (keyed by `YYYY-MM-DD`)
- **`QuestDraft`**: Mirrors editable `Quest` attributes + `draftId`, `rationale?`, `sourceMode: 'aligned' | 'parsed' | 'followup'`, `parentQuestId?`, `triggeredFromTitle?`, `references?`
- **`HabitDraft`**: Mirrors editable `Habit` attributes + `draftId`, `rationale?`, `sourceMode: 'aligned' | 'parsed'`
- **`BossDraft`**: `draftId`, `title`, `subtitle`, `commitment?`, `steps: { id: string; title: string; optional?: boolean }[]`

---

## 2. Persistence, Hydration & Purge Semantics (`src/utils/workspaceState.ts`)

1. **`hydrateWorkspaceState(parsed)`**:
   - Merges partial/imported JSON safely with defaults from `createInitialState()`.
   - **Explicit Null Preservation**: Uses `Object.prototype.hasOwnProperty.call(parsed, 'boss')` so an explicit `boss: null` stays `null` on reload instead of resurrecting the demo boss.
   - **AI Model Normalization**: Validates `parsed.aiModel` through `normalizeAiModel` (clamping unknown/deprecated values to `'gemini-4-hydrogen'`) and backfills `aiAutoFallback: true` when absent.
   - Backfills `scheduledFollowUps: []`, `deferredRaids: []`, and `raidHistory: []` for legacy backups, and re-clamps persisted `questDrafts` and `habitDrafts` through `clampQuestDraft` / `clampHabitDraft`.
2. **`parseAndHydrateWorkspaceJson(jsonText)`**:
   - Rejects malformed JSON or non-object payloads missing `Array.isArray(parsed.quests)` with structured `{ ok: false, error }` feedback.
3. **`purgeWorkspaceState(currentState, keepPersonalization)`**:
   - Calls `createBlankSlateState(...)`, clearing all `quests`, `questDrafts`, `scheduledFollowUps`, `habits`, `habitDrafts`, `focusSessions`, `redeemedRewards`, `boss: null`, `bossDraft: null`, `deferredRaids: []`, `raidHistory: []`, all XP/coin/streak/daily counters (`0`), and resetting `bounties` to `claimed: false`.
   - When `keepPersonalization` is `true`, preserves player identity plus `aiModel` and `aiAutoFallback`; when `false`, resets everything to defaults.

---

## 3. Server API Contracts (`server.ts`)

All AI endpoints lazily load `@google/genai` (`^3.3.0`), enforce `responseMimeType: 'application/json'` with explicit `responseSchema`, validate `model` against the allowlist (`gemini-4-hydrogen` default, `gemini-3.1-flash-lite` fast/high-availability), and wrap generation in `generateContentWithResilience` (one `500ms` retry on `503 UNAVAILABLE`, followed by optional automatic fallback to the alternate allowlisted model when `autoFallback !== false`).

### 3.1 `GET /api/health`
- **Response (`200 OK`)**: `{ "ok": true }`

### 3.2 `POST /api/ai/suggest-quests`
- **Thinking Config**: `ThinkingLevel.LOW` (supported by both `gemini-4-hydrogen` and `gemini-3.1-flash-lite`)
- **Request Body**:
  ```json
  {
    "mode": "aligned | parse | followups",
    "inputText": "optional notes or focus direction",
    "model": "gemini-4-hydrogen | gemini-3.1-flash-lite",
    "autoFallback": true,
    "profile": { "playerName": "string", "playerRole": "string", "dailyFocusGoalMinutes": 90 },
    "activeQuestTitles": ["string"],
    "bossTitle": "optional active boss title",
    "parentQuestId": "optional (followups mode)",
    "completedQuestTitle": "optional (followups mode)",
    "outcomeText": "optional (followups mode)",
    "references": [{ "label": "string", "location": "string" }]
  }
  ```
- **Response (`200 OK`)**: `{ "drafts": QuestDraft[], "modelUsed": AiModelId, "fallbackUsed": boolean }` (max 6 items).
- **Server/Client Bounds**:
  - `category` $\in \{\text{Deep Work, Engineering, Design, Writing, Health}\}$ (fallback: `Deep Work`)
  - `priority` $\in \{\text{critical, focus, routine}\}$ (fallback: `focus`)
  - `xpReward` clamped to `[20, 200]`; `coinReward` clamped to `[10, 60]`
  - `title` max 120 chars; `notes` max 220 chars; `dueLabel` max 40 chars; `rationale` max 140 chars

### 3.3 `POST /api/ai/suggest-habits`
- **Thinking Config**: `ThinkingLevel.LOW`
- **Request Body**:
  ```json
  {
    "mode": "aligned | parse",
    "inputText": "optional routine goals",
    "model": "gemini-4-hydrogen | gemini-3.1-flash-lite",
    "autoFallback": true,
    "profile": { "playerName": "string", "playerRole": "string", "dailyFocusGoalMinutes": 90 },
    "activeHabitTitles": ["string"],
    "activeQuestTitles": ["string"]
  }
  ```
- **Response (`200 OK`)**: `{ "drafts": HabitDraft[], "modelUsed": AiModelId, "fallbackUsed": boolean }` (max 6 items).
- **Server/Client Bounds**:
  - `category` $\in \{\text{Deep Work, Health, Learning, Operations}\}$ (fallback: `Deep Work`)
  - `targetDaysPerWeek` clamped to `[1, 7]` (uses `Number.isFinite` check so `0` clamps to `1`, not fallback `5`)
  - `xpReward` clamped to `[15, 80]`; `coinReward` clamped to `[5, 25]`

### 3.4 `POST /api/ai/suggest-boss`
- **Thinking Config**: `ThinkingLevel.MEDIUM` (supported by both `gemini-4-hydrogen` and `gemini-3.1-flash-lite`)
- **Request Body**:
  ```json
  {
    "goalText": "optional milestone objective",
    "model": "gemini-4-hydrogen | gemini-3.1-flash-lite",
    "autoFallback": true,
    "profile": { "playerName": "string", "playerRole": "string", "dailyFocusGoalMinutes": 90 },
    "activeQuestTitles": ["string"]
  }
  ```
- **Response (`200 OK`)**: `{ "draft": BossDraft, "modelUsed": AiModelId, "fallbackUsed": boolean }` (3–5 sequential steps, max 110 chars per gate; safe 3-step fallback if AI returns empty array).

### 3.5 Error Envelope (`400 / 403 / 404 / 429 / 500 / 503`)
- `formatAiErrorResponse` parses nested Google GenAI JSON error strings and returns `{ "error": "<actionable human-readable message>" }` with semantic HTTP status codes (e.g., `503` advising to switch models in Experience or retry shortly, `429` for rate limits, `403` for API key permissions), surfaced inline in the staging tray with a `Retry` trigger.
