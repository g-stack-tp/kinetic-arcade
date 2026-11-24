# 02. Functional Architecture — Kinetic Arcade

## 1. Navigation & Workspace Shell

Kinetic Arcade uses a persistent 2-zone workspace shell anchored by a single-row top navigation bar (`TopBar`) and a 12-column responsive layout (`8-column` primary screen + `4-column` persistent `PlayerRail`):

| TopBar Zone | Elements | Behavior |
| :--- | :--- | :--- |
| **Zone 1 (Brand)** | Kinetic Arcade wordmark + bolt mark | Navigates to `quests` (Quest Board). |
| **Zone 2 (Navigation)** | `Quest Board`, `Habits`, `Focus Arena`, `Reward Vault`, `Experience` | Switches `activeScreen` (`ScreenId`) with zero page reload; renders compact mobile strip below `md`. |
| **Zone 3 (Primary CTA)** | `+ New Quest` button | Opens `NewQuestModal` from any screen. |

### Persistent PlayerRail (`lg:col-span-4`)
Visible alongside every screen:
- **Identity & Rank Header**: Displays `Level`, `rankTitle`, `playerName`, `playerRole`, and clickable `Emblem` shortcut to `Experience`.
- **Experience Progress Bar**: Current-level XP progress, XP remaining to next level, and `Customize` action.
- **Telemetry Strip**: `Coins`, `Streak` (with emerald pulse animation `.animate-streak-pulse` triggered on every habit completion), and `Focus` (`focusMinutesToday / dailyFocusGoalMinutes`).
- **Active Power-Ups**: Conditional inline readout for remaining `2x XP` quest charges and `Streak Shields`.
- **Focus Arena Quick Launcher**: Displays live countdown (`MM:SS`) and jumps directly to `Focus Arena`.
- **Daily Bounties**: 3 repeatable daily objectives (`Momentum Opener`: 3 quests, `Habit Rhythm`: 3 habits, `Arena Sprinter`: 25 focus mins) with live progress bars and `Claim` actions.

---

## 2. Screen-by-Screen Functional Specification

### 2.1 Quest Board (`quests`)
Ordered top-to-bottom for execution-first flow (`Execute Today → Boss Milestone → AI Planning → Deferred Backlog`):
1. **Pending Human Review & Urgent Alerts (Conditional)**:
   - **Boss Raid Draft Staging (`state.bossDraft !== null`)**: Inline HITL review panel allowing editing of `title`, `subtitle`, `commitment` (`required | optional`), and individual gates (`+ Add Gate`, `Required / Optional` toggle, remove gate) with `Discard Draft` and `Approve & Launch Raid`.
   - **Quest Draft Staging Tray (`state.questDrafts.length > 0`)**: Displays loading skeletons, retryable errors, or staged `questDrafts` with inline `Edit` (title, category, priority, XP, target window), `Approve`, `Save & Approve`, `Discard`, `Approve All`, and `Discard All`.
   - **Due Deferred Boss Raids**: Surfaces parked raids whose scheduled `resumeAt` has arrived (`Ready to resume`) at the top with one-click `Resume Raid` / `Swap & Resume`.
2. **Today's Execution Core (Pinned Above the Fold)**:
   - **Quick-Add Composer & New Quest Modal**: Inline quick-add bar (`title` + priority tier selector) and full `NewQuestModal` (notes, category, custom XP `20–500`, target window).
   - **Filter & Search Toolbar**: Tabs (`All`, `Critical`, `Focus`, `Completed`), `Clear Routine (n)` (preserves completed quests with outcomes/references), `Clear All Completed (n)`, and live search matching title, category, notes, `outcomeText`, `triggeredFromTitle`, and `references`.
   - **Deterministic Quest Ordering (`filterAndOrderQuests`)**: Active quests precede completed quests sorted by priority (`critical → focus → routine`); completed quests sort by `completedAt` descending (most recently finished first).
   - **Quest Rows & Inline Capture Drawer**: Completion toggle (`animate-check-pulse` + Double XP consumption + follow-up rule evaluation), `Outcome & Refs` drawer (captured action results, sanitized `http:`/`https:` links or copyable paths, manual/AI follow-up rule arming), `Focus` shortcut, and delete action.
3. **Boss Encounter Module (`state.boss` or Empty Launcher)**:
   - **Active Raid**: Displays commitment toggle (`Core` vs `Optional`), required-gate HP track (`getBossProgress`), `New Raid` (inline launcher that safely parks the current raid in Deferred Boss Raids), `Defer` control (`Later`, `24h`, `72h`, `1 week` + note), `Raid Debrief` & `+15%` Documentation Bonus Coins, collapsible gates (`Hide Gates` / `Show Gates`) ordered with **Required Gates** ahead of **Optional Stretch Gates** (`+25 XP / +10 Coins` each), gate-level `Evidence` drawers, `Claim` bounty button, and `Clear` (`X`).
   - **Completed Raid (`bountyClaimed === true`)**: Displays a prominent **`Start Next Raid`** primary CTA and completion strip (`Archive to History` / `Start Next Raid`) so launching the next milestone automatically archives the completed raid (with all gate evidence and debrief links) to `raidHistory`.
   - **Empty Launcher (`state.boss === null && !state.bossDraft`)**: AI Boss Raid Decomposer (`Draft Raid with AI`) and `Manual Composer` (including commitment selection).
4. **AI Quest Planner & Input Parser** *(displays active `aiModel` in subtitle)*:
   - **Suggest Aligned**: Generates 3 quests aligned with `playerRole`, `dailyFocusGoalMinutes`, active quests, and active boss title into `questDrafts`.
   - **Parse Input**: Extracts 1–5 structured quests from free-text notes into `questDrafts`.
5. **Upcoming, Deferred & Shipped Archive**:
   - **Deferred Boss Raids**: Remaining parked raids ordered by due status → commitment (`Core` before `Optional`) → soonest `resumeAt` → most recently deferred.
   - **Shipped Boss Raids Archive (`state.raidHistory`)**: Collapsible history of completed/claimed raids preserving XP/Coins earned, debrief notes, and clickable/copyable references.
   - **Queued Follow-Up Quests (`state.scheduledFollowUps`)**: Ordered chronologically by `triggerAt` ascending with `Trigger Now` and `Cancel` (`X`) actions.

### 2.2 Habits & Streaks (`habits`)
1. **7-Day Activity Heat Map & Completion Trend (`HabitActivityHeatmap`)**:
   - **Top Band (D3 Trend Curve)**: Plots daily habit completion percentage (`0%–100%`) across the trailing 7 days with hover readouts (`X of Y habits logged`), daily average, peak day, and early-week vs. recent-week trend delta (`pts`).
   - **Bottom Band (D3 Activity Heat Map)**: Displays `(Habit × Day)` rounded tiles colored by 4 intensity levels (`0: Missed`, `1: Building`, `2: On Track`, `3: Target Hit`), paired with checkmark glyphs inside completed tiles, keyboard navigation (`Enter`/`Space`), hover tooltip, and **click-to-toggle** synchronization.
2. **AI Habit Planner & Input Parser + HITL Staging Tray** *(displays active `aiModel` in subtitle)*:
   - **Suggest Aligned** / **Parse Input** -> stages `HabitDraft[]` for human review (`title`, `category`, `targetDaysPerWeek` `1–7`, `xpReward` `15–80`) with `Edit`, `Approve`, `Approve All`, `Discard`, and `Discard All`.
3. **Manual Add & 7-Day Matrix**:
   - Quick-add form (`title`, `category` in `Deep Work | Health | Learning | Operations`, weekly target `3x/5x/6x/7x`).
   - Interactive 7-day toggle table displaying per-habit weekly pace (`hits/target`), live consecutive streak (`computeHabitStreak`), and delete button.

### 2.3 Focus Arena (`focus`)
- **Preset Selector**: `5 min Sprint`, `15 min`, `25 min`, `50 min` (locked while timer runs).
- **Radial SVG Countdown Dial**: Real-time progress ring, `MM:SS` readout, and status (`READY`, `SPRINT ACTIVE`, `PAUSED`).
- **Quest Linking**: Bind sprint to any incomplete quest or run a Free Deep Work Session.
- **Sprint Controls & Reward Math**:
  - `Start Sprint` / `Pause Sprint` / `Resume Sprint`, `Log & Claim` (early log uses elapsed minutes if $\ge 60\text{s}$, else selected duration), `Reset`.
  - Reward formula: `xpEarned = max(20, round(minutes * 2.5))`, `coinsEarned = max(6, round(minutes * 0.6))`.
- **Recent Focus Sessions Table**: Retains up to 20 most recent completed sessions with timestamp, duration, and earned XP/Coins.

### 2.4 Reward Vault (`vault`)
- **Shop Catalog**: Includes default power-ups (`Double XP Boost (3 Quests)` for 80c, `Streak Shield Token` for 65c) and real-world treats, plus `Custom Reward` creation (`cost >= 10` Coins).
- **Redemption Mechanics**: Deducts coins, increments `doubleXpCharges` (`+3`) or `streakShields` (`+1`) for utility rewards, or appends claimable treat passes with `Mark Used` action.
- **Achievements Grid**: Tracks 6 deterministic milestones (`First Clear`, `Momentum Architect`, `Boss Slayer`, `Streak Keeper`, `Deep Sprinter`, `Vault Patron`).

### 2.5 Experience & Data (`experience`)
- **Personalize Profile**: Edit `playerName`, `playerRole`, `avatarEmblem` (6 icons), `avatarTone` (4 themes), `dailyFocusGoalMinutes` (`15–480`), `defaultSprintMinutes`, and `soundEnabled`.
- **AI Drafting Model**:
  - Select the active Gemini model used across Quest Planner, Follow-Ups, Habits, and Boss Raids: **Gemini 4 Hydrogen (`gemini-4-hydrogen`)** (Balanced Default) or **Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite`)** (Fast · High Availability).
  - Toggle **Auto-fallback on high demand (503)** (enabled by default) so persistent `503 UNAVAILABLE` spikes automatically fall back to the alternate model and report the fallback in the confirmation toast.
  - Changes save immediately, persist in `localStorage` and JSON backups, and are preserved across preset loads and *Purge Activity Data*.
- **Load Experience & JSON Backup**:
  - Load curated presets: *Product Launch Sprint*, *Deep Study & Research*, or *Fresh Level 1 Starter*.
  - `Export JSON` downloads full `AppState`; `Load JSON` validates and hydrates workspace backups.
- **Two-Step Purge Workspace Data**:
  - **Purge Activity Data (Keep Profile)**: Clears quests, all AI drafts, scheduled follow-ups, boss encounter, deferred raids, habits, focus sessions, redeemed rewards, XP, coins, streaks, and daily counters while keeping personalization and AI model settings.
  - **Purge Everything & Reset Profile**: Wipes local storage and resets profile and AI model settings back to defaults (`Player One`, `Kinetic Builder`, `gemini-4-hydrogen`, `aiAutoFallback: true`) at Level 1.

---

## 3. Core Economy & Progression Rules

| Rule | Formula / Bounds |
| :--- | :--- |
| **Level Thresholds** | Level 1 requires `250 XP`; each subsequent level $L$ requires $250 + (L - 1) \times 100$ XP. |
| **Ranks** | 6 ranks stepping every 2 levels: `Apprentice Builder` (L1–2), `Focused Tactician` (L3–4), `Kinetic Specialist` (L5–6), `Momentum Architect` (L7–8), `Sprint Vanguard` (L9–10), `Arcade Grandmaster` (L11+). |
| **Double XP Boost** | Applies `2× XP` on the next active quest completion and consumes `1` charge (`doubleXpCharges - 1`); untoggling reverts base XP only. |
| **Habit Today vs. Backfill** | Toggling *today's* habit cell grants/reverts `xpReward` & `coinReward` and updates `habitsCheckedToday`; toggling historical days updates streak/heatmap consistency without re-awarding today's XP. |
| **AI Draft Isolation** | AI outputs enter `questDrafts`, `habitDrafts`, or `bossDraft` only; active boards, XP, and Coins never change until `Approve`. |
| **AI Economy Clamping** | Quest Drafts: `20–200 XP`, `10–60 Coins`. Habit Drafts: `15–80 XP`, `5–25 Coins`, `1–7 days/week`. |
