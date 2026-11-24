# Kinetic Arcade — Architecture & Product Documentation

Welcome to the documentation suite for **Kinetic Arcade**, a tactile gamified productivity workspace built with React 19, TypeScript, Tailwind CSS v4, Express, D3, and server-side Gemini AI (`@google/genai`).

## Document Catalog

| Document | Audience | Scope & Contents |
| :--- | :--- | :--- |
| [01. Concept Document](./01-concept-document.md) | Product, Executive, Functional Architect | Vision, target personas, core productivity-to-gameplay loops, Human-in-the-Loop (HITL) AI philosophy, and visual design principles. |
| [02. Functional Architecture](./02-functional-architecture.md) | Functional Architect, UX, QA | Screen-by-screen capabilities, user journeys, HITL staging flows, economy rules, level/rank math, and data management workflows. |
| [03. Technical Architecture Blueprint](./03-technical-architecture-blueprint.md) | Technical Architect, Full-Stack Engineers | Express + Vite runtime topology, port/proxy binding, React state architecture, D3 visualization pipeline, Web Audio engine, and security posture. |
| [04. Data Model & API Blueprint](./04-data-model-and-api-blueprint.md) | Technical Architect, Backend/Frontend Engineers | Complete `AppState` domain entities, `localStorage` persistence & JSON backup contracts, and `/api/ai/*` Gemini schemas & clamping rules. |
| [05. Quality & Regression Blueprint](./05-quality-and-regression-blueprint.md) | Technical Architect, QA, Maintainers | `regression-verifier` protocol, invariant coverage matrix, all automated checks in `scripts/verify.ts`, and release build gates. |
| [Boss Raid & Raid Bounty Evolution Plan](../plan/boss-raid-bounty-evolution-plan.md) | Product, Technical Architect, Engineers | 3-phase roadmap evolving Boss Raids & Bounties beyond checkboxes (gate evidence, debrief bonuses, defer/optional raids, Quest linkage, raid archive, post-raid follow-ups). |
| [AI Model Selection & 503 Resilience Plan](../plan/ai-model-selection-and-resilience-plan.md) | Product, Technical Architect, Engineers | Phase 1 (implemented) selectable free-tier Gemini models & 503 auto-fallback in Experience, plus optional Phase 2 paid-tier Pro model opt-in via billing key flow. |

## Quick Reference: Project Commands

```bash
npm run dev      # Start Express + Vite middleware server on port 3000
npm run verify   # Execute deterministic domain & HITL regression suite (scripts/verify.ts)
npm run lint     # Run TypeScript static typecheck (tsc --noEmit)
npm run build    # Produce production Vite bundle in dist/
npm run start    # Serve production build via Node/Express (server.ts)
```

## Key Source Modules

- **Server & AI Gateway**: `server.ts`
- **Root Shell & Orchestration**: `src/App.tsx`, `src/types.ts`, `src/index.css`
- **Pure State & Analytics**: `src/utils/workspaceState.ts`, `src/utils/habitHeatmap.ts`, `src/data/initialData.ts`
- **Client Services**: `src/utils/aiClient.ts`, `src/utils/sound.ts`
- **UI Screens & Components**: `src/components/*`
- **Verification & Governance Skills**: `scripts/verify.ts`, `skills/regression-verifier/SKILL.md`, `skills/docs-and-plan-sync/SKILL.md`
