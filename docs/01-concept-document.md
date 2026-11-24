# 01. Product Concept Document — Kinetic Arcade

## 1. Executive Summary

**Kinetic Arcade** is a tactile, single-player gamified productivity workspace designed to close the gap between planning daily work and sustaining execution momentum. Instead of sterile checklists or noisy, manipulative "streak-shaming" trackers, Kinetic Arcade pairs clean, high-clarity task, habit, and focus-sprint tools with an immediate, deterministic reward loop (**XP**, **Levels & Ranks**, **Coins**, **Boss Milestone Raids**, and a **Reward Vault**), augmented by **Human-in-the-Loop (HITL) AI planners**.

---

## 2. Problem Statement

Traditional productivity tools suffer from three recurring friction points:

1. **Planning Overhead**: Converting messy meeting notes, milestone goals, or vague routine intentions into structured, right-sized tasks takes manual effort.
2. **Opaque Progress**: Completing isolated checklist items rarely communicates cumulative momentum toward multi-step deliverables or weekly habit consistency.
3. **AI Trust Deficit**: Autonomous AI task generators often clutter task lists with hallucinated priorities, inflated rewards, or duplicate items without user consent.

Kinetic Arcade solves these through:
- **Tactile Feedback Loops**: Every completed quest, habit check-in, boss gate, and focus sprint produces crisp visual, audio, and numeric feedback.
- **Data-Driven Habit Telemetry**: A 7-day matrix paired with an interactive D3 consistency heat map and daily completion trend curve reveals momentum at a glance.
- **Staged HITL AI Assistance**: AI acts purely as a *drafter*—never mutating active quests, habits, boss raids, XP, or coins until a human edits and explicitly approves drafts from an inline staging tray.

---

## 3. Target Personas

| Persona | Primary Goal | Key Kinetic Arcade Workflows |
| :--- | :--- | :--- |
| **Product Builder / Software Engineer** | Ship multi-step releases while protecting deep-work blocks. | Decompose releases into 100-DMG Boss Raid gates, link Focus Arena sprints to engineering quests, track morning deep-work habits. |
| **Graduate Researcher / Learner** | Sustain daily reading, active recall, and thesis writing milestones. | Load the *Deep Study & Research* preset, parse study notes via AI Quest Planner, monitor 7-day recall consistency via the D3 heat map. |
| **Personalizer / Minimalist Operator** | Start clean or bring customized routines without demo clutter. | Configure emblem/tone/focus targets in *Experience*, purge demo activity data while preserving identity, export/import JSON backups. |

---

## 4. Core Concept & Gameplay-Productivity Loop

```text
  [1. Plan & Draft]              [2. Execute & Focus]            [3. Progress & Redeem]
  ─────────────────              ────────────────────            ──────────────────────
  • Quick-Add / Modal    ──▶     • Quest Board Clears     ──▶    • Earn XP & Level Up
  • AI Quest / Habit             • Boss Gate Damage (100)        • Earn Coins & Claim
    Drafts (HITL Tray)           • 7-Day Habit Check-ins           Daily Bounties
  • AI Boss Decomposer           • Focus Arena Sprints           • Spend Coins in Vault
                                                                   (2x XP, Shields, Treats)
```

### Core Pillars

1. **Quest Board & Milestone Boss Raids**:
   - Atomic deliverables live as **Quests** categorized across `Deep Work`, `Engineering`, `Design`, `Writing`, and `Health` with `critical`, `focus`, and `routine` priority tiers.
   - Major objectives become **Boss Encounters**—a shared HP pool (`steps.length × 100 HP`) where each milestone gate deals `100 DMG` upon completion and unlocks a Raid Bounty.
2. **Habits, Streaks & D3 Activity Heat Map**:
   - Repeatable daily/weekly rituals track check-ins across a rolling 7-day window.
   - An interactive **D3 Activity Heat Map & Completion Trend** visualizes per-habit intensity (`Missed`, `Building`, `On Track`, `Target Hit`) alongside a daily completion rate curve (`0%–100%`).
   - Completing any habit day triggers a subtle emerald streak pulse in the persistent `PlayerRail`.
3. **Focus Arena**:
   - Preset countdown sprints (`5m`, `15m`, `25m`, `50m`) optionally bound to an active quest, logging completed sessions and awarding duration-scaled XP and Coins.
4. **Reward Vault & Personalization (`Experience`)**:
   - Coins fund functional power-ups (**Double XP Boost**, **Streak Shield Token**) and user-defined real-world treats, paired with deterministic **Achievements** and full local data portability (`Export JSON`, `Load JSON`, `Load Preset`, and two-stage `Purge`).

---

## 5. Aesthetic & UX Principles

- **Kinetic Arcade Tactility**: Crisp light canvas (`#faf8ff`), elevated white surfaces (`#ffffff`), recessed wells (`#eaedff`), extruded 3D buttons (`.btn-tactile-*`), and Web Audio synthesized chimes.
- **60-30-10 Color Discipline**: Neutral canvas/surfaces carry structural hierarchy; high-intent Indigo (`#4648d4`), Emerald (`#10b981`), Amber (`#f59e0b`), and Coral (`#f43f5e`) are reserved strictly for primary CTAs, progress, economy, and boss/destructive states.
- **Anti-Slop & Accessibility**: Unboxed typographic metadata separated by `·`, `tabular-nums` (`JetBrains Mono` + `Plus Jakarta Sans`) across all metrics, non-hue markers (checkmarks alongside heat colors), and full `@media (prefers-reduced-motion: reduce)` support.
