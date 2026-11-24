# AI Model Selection & 503 Resilience Plan

**Status:** Phase 1 Implemented · Phase 2 Optional (On-Demand)  
**Scope:** Expose Gemini model selection and high-demand (`503 UNAVAILABLE`) failover in the **Experience** screen while preserving strict server-side secret isolation, HITL draft boundaries, and allowlist safety.

---

## 1. Problem Statement

Previously, all three Express AI endpoints (`/api/ai/suggest-quests`, `/api/ai/suggest-habits`, `/api/ai/suggest-boss`) hardcoded `gemini-4-hydrogen` and returned raw upstream JSON error payloads on failure. During temporary demand spikes (`503 UNAVAILABLE`), users had no way to switch to a lighter high-availability model or automatically fail over without losing productivity momentum.

---

## 2. Phased Architecture & Rollout

### Phase 1 — Selectable Standard Models, 503 Retry & Auto-Fallback *(Implemented)*

- **State & Persistence (`src/types.ts`, `src/data/initialData.ts`, `src/utils/workspaceState.ts`)**:
  - Added `AiModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'`, `aiModel` (default `'gemini-4-hydrogen'`), and `aiAutoFallback` (default `true`) to `AppState`.
  - Enforced strict allowlist validation via `normalizeAiModel` (clamping unknown or deprecated model names back to `'gemini-4-hydrogen'`).
  - Backfilled defaults on legacy JSON hydration (`hydrateWorkspaceState`), preserved settings across presets (`createStudyPresetState`, `handleLoadPreset`) and activity-only purges (`purgeWorkspaceState(state, true)`), and reset defaults on full purge (`purgeWorkspaceState(state, false)`).
- **Server Gateway & Resilience (`server.ts`)**:
  - Added `normalizeAiModel` allowlist validation and `generateContentWithResilience` across `/api/ai/suggest-quests`, `/api/ai/suggest-habits`, and `/api/ai/suggest-boss`.
  - On `503 UNAVAILABLE` / high-demand errors, performs one brief `500ms` retry on the selected model; if still overloaded and `autoFallback !== false`, automatically retries once on the alternate allowlisted model (`gemini-4-hydrogen` ↔ `gemini-3.1-flash-lite`) and returns `{ modelUsed, fallbackUsed }`.
  - Added `formatAiErrorResponse` to parse raw Google GenAI JSON errors into concise, actionable messages with semantic HTTP status codes (`503`, `429`, `403`, `400`, `404`, `500`), never fabricating fake drafts on failure.
  - Verified `ThinkingLevel.LOW` (quests/habits) and `ThinkingLevel.MEDIUM` (boss decomposition) compatibility across both allowlisted models.
- **UI & Feedback (`src/components/ExperienceScreen.tsx`, `src/App.tsx`, `src/components/QuestBoardScreen.tsx`, `src/components/HabitsScreen.tsx`)**:
  - Added an **AI Drafting Model** card in **Experience** with instant-save radio selection (`Gemini 4 Hydrogen` vs `Gemini 3.1 Flash Lite`) and an **Auto-fallback on high demand (503)** checkbox toggle (zero API key UI).
  - Surfaced the active model label in the Quest Board and Habits AI Planner subtitles and surfaced fallback model usage in staging confirmation toasts.
- **Verification (`scripts/verify.ts`, `skills/regression-verifier/SKILL.md`)**:
  - Added deterministic check **#24** covering allowlist normalization, deprecated model clamping, legacy hydration backfill, preset preservation, and keep-profile vs. full-reset purge invariants.

---

### Phase 2 — Optional Paid-Tier Models *(Planned / Opt-In)*

- **Scope**: Optionally expand `AI_MODEL_OPTIONS` to include paid-tier reasoning models (`gemini-4-neon`, `gemini-4-carbon`, `gemini-4-argon`) only if requested by the user after completing the AI Studio billing-enabled key flow (`paid_model_flow`).
- **Constraints**:
  - Keep `gemini-4-hydrogen` and `gemini-3.1-flash-lite` as the default fallback targets so standard-tier sessions remain resilient.
  - Maintain zero client-side API key input fields; credentials stay strictly server-side in `process.env.GEMINI_API_KEY`.
