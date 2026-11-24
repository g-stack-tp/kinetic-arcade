---
name: "docs-and-plan-sync"
description: >
  Project-specific documentation and roadmap governance skill for Kinetic Arcade.
  Evaluates every feature request, bug fix, architectural change, or design
  discussion and updates the corresponding files in `docs/` and `plan/` whenever
  a documentation or roadmap update is warranted.
---

# Kinetic Arcade Docs & Plan Sync

Whenever there is a user request, implementation change, bug fix, or design discussion in this repository, evaluate whether documentation (`docs/`) or roadmap plans (`plan/`) require an update and keep them synchronized with the codebase and agreed product direction.

## 1. Trigger & Skip Criteria

### Update Docs/Plans When:
- **Feature or Workflow Change**: A screen, user control, ordering rule, economy formula, or HITL staging flow is added, removed, or modified.
- **Data Model or API Change**: Any `AppState` field, domain entity (`src/types.ts`), hydration/purge rule (`src/utils/workspaceState.ts`), or Express endpoint contract (`server.ts`) changes.
- **Runtime / Security / Resilience Change**: Server startup behavior, HMR/proxy handling, model allowlists, error handling, or secret boundaries change.
- **Regression Suite Change**: New assertions or invariants are added to `scripts/verify.ts` and `skills/regression-verifier/SKILL.md`.
- **Design Discussion or Recommendation**: A discussion produces an agreed roadmap, phased rollout, P0/P1 prioritization, or architectural decision—even before code is written.

### Skip (No-Op) When:
- The change is a purely internal refactor, styling polish, or transient bug fix with zero impact on documented behavior, contracts, invariants, or roadmap status.
- Do not make superficial or repetitive edits when existing docs already accurately describe the system.

## 2. Document Routing Matrix

Update only the documents whose scope is actually affected:

| Scope of Change / Discussion | Target File(s) |
| :--- | :--- |
| Product vision, personas, core pillars, visual principles | `docs/01-concept-document.md` |
| Screen capabilities, UI layout/ordering, HITL flows, Experience settings, economy rules | `docs/02-functional-architecture.md` |
| Express + Vite topology, port/HMR/startup resilience, D3/WebAudio pipeline, security posture | `docs/03-technical-architecture-blueprint.md` |
| `AppState` fields, entity schemas, hydration/purge rules, `/api/*` request/response/error contracts | `docs/04-data-model-and-api-blueprint.md` |
| Automated regression test count and invariant table (`scripts/verify.ts`) | `docs/05-quality-and-regression-blueprint.md` |
| Multi-phase feature roadmaps, architectural recommendations, and phase status (`Implemented` vs `Planned`) | `plan/<topic>-plan.md` (update existing domain plan or create a new kebab-case plan file) |
| Document catalog, new plan links, key source modules, or project skills | `docs/README.md` |

## 3. Sync Protocol

1. **Assess Impact**: Determine whether the request or discussion alters product scope, UX workflows, data/API contracts, verification checks, or future roadmap phases.
2. **Inspect Before Editing**: Read the relevant `docs/` and `plan/` files so updates integrate surgically without duplicating or contradicting existing sections.
3. **Maintain Truthful Status Labels**:
   - In `plan/*.md`, clearly separate **`Implemented`**, **`In Progress`**, and **`Planned`** phases—never mark discussed proposals as implemented until verified in code.
   - Keep `docs/04-data-model-and-api-blueprint.md` strictly aligned with `src/types.ts`, `src/utils/workspaceState.ts`, and `server.ts`.
   - Keep `docs/05-quality-and-regression-blueprint.md` check counts and rows aligned with `scripts/verify.ts`.
4. **Naming & Indexing New Plans**:
   - Name new roadmap files descriptively using kebab-case: `plan/<domain-feature>-plan.md` (e.g., `plan/boss-raid-bounty-evolution-plan.md`, `plan/ai-model-selection-and-resilience-plan.md`).
   - Add a catalog entry in `docs/README.md` whenever a new document or plan file is created.
5. **Pair with Regression Verification**: When code changes accompany doc updates, ensure `skills/regression-verifier/SKILL.md` and `scripts/verify.ts` are updated in the same change set.
