# 03. Technical Architecture Blueprint — Kinetic Arcade

## 1. System Topology & Runtime Stack

Kinetic Arcade is a single-node **full-stack TypeScript web application** combining an Express backend (acting as a secure server-side Gemini AI gateway and static/SPA host) with a React 19 + Vite 8 + Tailwind CSS v4 frontend.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Container / Reverse Proxy (Nginx :8080 -> App :3000)                      │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Node.js v22 Express Server (server.ts, 0.0.0.0:3000)                      │
│  • GET  /api/health              -> Liveness probe ({ ok: true })         │
│  • POST /api/ai/suggest-quests   -> Aligned / Parse / Follow-up drafts    │
│  • POST /api/ai/suggest-habits   -> Aligned / Parse habit drafts          │
│  • POST /api/ai/suggest-boss     -> Milestone raid gate decomposition     │
│  • Resilience: allowlisted models + 503 retry & optional auto-fallback    │
│  • Dev:  Vite middlewareMode (appType: 'spa', lazy init after listen)     │
│  • Prod: express.static('dist') + wildcard SPA fallback                   │
└───────────────┬───────────────────────────────────────────┬───────────────┘
                │ JSON over HTTPS (same-origin /api/*)      │ @google/genai SDK (lazy)
                ▼                                           ▼
┌───────────────────────────────────────┐     ┌─────────────────────────────┐
│ Browser SPA (React 19 + D3 + WebAudio)│     │ Gemini API (Server-Side)    │
│  • App.tsx (central state + timer)    │     │  • gemini-4-hydrogen (def.) │
│  • Pure Reducers (workspaceState.ts)  │     │  • gemini-3.1-flash-lite    │
│  • Analytics (habitHeatmap.ts + D3)   │     │  • Key: process.env.        │
│  • Persistence: localStorage          │     │    GEMINI_API_KEY           │
└───────────────────────────────────────┘     └─────────────────────────────┘
```

### Port Resolution, Startup Hardening & HMR Control (`server.ts`, `vite.config.ts`)
- Because hosted reverse proxies (e.g., Nginx on `:8080`) inject `PORT=8080` and `NGINX_PORT=8080` alongside `DEFAULT_APP_PORT=3000`, `server.ts` resolves the listen port as:
  1. `--port <N>` CLI flag if explicitly supplied
  2. `Number(process.env.DEFAULT_APP_PORT)` if set (`3000`)
  3. `3000` if `NGINX_PORT` matches `PORT`
  4. Otherwise `Number(process.env.PORT) || 3000`
- **Fast Cold Boot**: `@google/genai` is dynamically imported on demand (`getGenAiSdk()`) rather than at top-level startup, and `httpServer.listen(PORT, '0.0.0.0')` binds immediately while Vite middleware initializes asynchronously so `/api/health` responds right away without startup timeout.
- **Process Hygiene & HMR**: `server.ts` attaches `httpServer.on('error')` and graceful `SIGTERM`/`SIGINT` shutdown handlers (closing Vite and HTTP server with a 2s unref'd fail-safe timer). When `DISABLE_HMR === 'true'`, Vite middleware sets `hmr: false`, `ws: false`, and strips the client WebSocket transport connect call to avoid spurious browser WebSocket errors. `vite.config.ts` uses `import.meta.dirname` for strict ESM compatibility.

---

## 2. Frontend Architecture & Module Boundaries

### 2.1 State Management Pattern
- **Single Source of Truth**: `src/App.tsx` owns the canonical `AppState` and synchronizes it automatically to `localStorage` under key `kinetic_arcade_workspace_v1`.
- **Pure State Reducers (`src/utils/workspaceState.ts`)**: All non-trivial business transitions (hydration, purging, filtering, quest/boss/habit completion, and HITL draft staging/editing/clamping/approval) are extracted into pure, side-effect-free TypeScript functions. This enables identical behavior in React UI handlers and Node.js regression tests (`scripts/verify.ts`).
- **Transient UI State**: Kept strictly outside persisted `AppState` in `App.tsx` or local component state:
  - AI loading & error banners (`questAiLoading`, `habitAiLoading`, `bossAiLoading`, `*AiError`)
  - Ephemeral animation triggers (`justCompletedId`, monotonic `streakPulseKey`)
  - Focus timer runtime (`focusDurationMinutes`, `focusSecondsLeft`, `focusRunning`, `focusQuestId`)
  - Toast queue (`toasts`) and modal visibility (`isNewQuestOpen`)

### 2.2 Component Hierarchy
```text
App.tsx
├── TopBar.tsx                       # 3-zone header + mobile strip
├── <main> (12-column grid)
│   ├── Primary Track (lg:col-span-8)
│   │   ├── QuestBoardScreen.tsx     # Boss Raid / AI Quest Planner / Staging Tray / Board
│   │   ├── HabitsScreen.tsx         # Heat Map / AI Habit Planner / Staging Tray / Matrix
│   │   │   └── HabitActivityHeatmap.tsx  # D3 SVG heatmap + trend curve
│   │   ├── FocusArenaScreen.tsx     # SVG radial timer + quest linker + session log
│   │   ├── RewardVaultScreen.tsx    # Coin shop + claimed passes + achievements
│   │   └── ExperienceScreen.tsx     # Profile, AI model selection, presets, JSON & purge
│   └── Telemetry Rail (lg:col-span-4)
│       └── PlayerRail.tsx           # Level bar, Coins/Streak(pulsing)/Focus, Bounties
├── NewQuestModal.tsx                # Accessible Escape-dismissible quest dialog
└── Toast Notification Stack         # aria-live="polite" floating feedback
```

---

## 3. D3 Visualization Architecture (`HabitActivityHeatmap.tsx`)

To avoid fighting React's virtual DOM, the D3 chart separates **data calculation**, **viewport measurement**, and **SVG DOM lifecycle**:

1. **Pure Model Calculation (`src/utils/habitHeatmap.ts`)**: `buildHabitHeatmapModel(habits)` transforms `Habit[]` into `days` (7 slots), `dailyTrends` (`completionRate` 0–100%), `cells` (habit × day matrix with `intensity` `0..3`), `dailyAveragePct`, `trendDeltaPct` (last 3 days vs. first 3 days), and `peakDay`.
2. **Responsive Sizing**: A `ResizeObserver` on `containerRef` updates `containerWidth` so margins (`left: 124px` compact / `210px` wide) and `d3.scaleBand` widths recalculate dynamically.
3. **D3 Imperative Render Pass**: Inside `useEffect`, `d3.select(svgRef.current)` clears and redraws two vertically aligned SVG bands sharing one `xScale` (`d3.scaleBand`):
   - **Trend Layer**: `d3.scaleLinear` (`[0, 100]`), `d3.area` + `d3.line` (`d3.curveMonotoneX`), SVG gradient fill, and interactive day nodes.
   - **Matrix Layer**: `d3.scaleBand` for habits (`yHabit`), `d3.scaleOrdinal` mapping intensities `0..3` to Kinetic Arcade color tokens, accessible `<path>` checkmarks inside completed tiles, keyboard handlers (`Enter`/`Space`), and React-managed floating hover tooltips clamped inside container bounds.

---

## 4. Sensory Feedback & Accessibility

- **Web Audio Synthesizer (`src/utils/sound.ts`)**: Zero external audio files. Uses the Web Audio API (`OscillatorNode` + exponential `GainNode` ramps) for 4 distinct non-intrusive cues (`playQuestComplete`, `playCoinClaim`, `playLevelUp`, `playTimerBell`), gated by `state.soundEnabled` and wrapped in `try/catch` for browser autoplay resilience.
- **CSS Micro-Interactions (`src/index.css`)**:
  - `.btn-tactile-*`: `120ms cubic-bezier(0.16, 1, 0.3, 1)` press displacement.
  - `.animate-check-pulse` & `.animate-streak-pulse`: `380ms` emerald ring expansion (`transform` + `box-shadow`), suppressed cleanly under `@media (prefers-reduced-motion: reduce)`.
  - `streakPulseKey` in `App.tsx` + `prevPulseKeyRef` + `requestAnimationFrame` reset in `PlayerRail.tsx` ensure rapid consecutive habit completions restart the pulse reliably without stale replay on mount.

---

## 5. Security, Resilience & Secret Boundary

- **API Key Isolation**: `GEMINI_API_KEY` is read exclusively inside `server.ts` (`getAiClient()`). No secrets, `.env` keys, API key input UIs, or `@google/genai` SDK imports exist in `src/`.
- **Strict AI Model Allowlist**: Both `server.ts` and `src/utils/workspaceState.ts` validate requested models via `normalizeAiModel` against an explicit allowlist (`gemini-4-hydrogen`, `gemini-3.1-flash-lite`), silently clamping unknown or deprecated strings back to `gemini-4-hydrogen`.
- **503 Demand-Spike Resilience**: `generateContentWithResilience` performs a brief `500ms` retry on `503 UNAVAILABLE` / high-demand errors and—when `autoFallback` is enabled—falls back once to the alternate allowlisted model. Real errors are always propagated cleanly via `formatAiErrorResponse` (never fabricated drafts).
- **Defense-in-Depth Validation**: Server endpoints clamp AI outputs, normalize enums, and enforce string length caps before returning JSON; client reducers (`clampQuestDraft`, `clampHabitDraft`, `sanitizeReferenceUrl`) re-clamp values on staging, inline editing, and hydration.
- **User-Agent Attribution**: All `GoogleGenAI` server instances pass `httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }`.
