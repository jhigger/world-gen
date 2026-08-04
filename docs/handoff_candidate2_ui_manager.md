# Handoff Context: Candidate 2 — UIManager Module Refactor

## 1. Completed Prerequisites
- **Commit `42445ef`**: Implemented `ViewportManager` (`src/viewport-manager.ts`) to encapsulate 6 WebGL viewports, canvas resize observers, camera orbit sync, and animation render loops out of `src/main.ts`.
- **Code Review**: Passed 2-axis code review (Standards + Spec) with clean layer separation and 0 errors across 24 unit/profiler tests.
- **Clean Repository State**: All code committed to `main` branch, `npx tsc --noEmit` and `npm run build` passing cleanly.

---

## 2. Objective for Next Session: Candidate 2 (`UIManager`)
Extract DOM UI bindings, input event listeners, sliders, tooltips, and mobile drawer/modal UI handlers out of [`src/main.ts`](file:///D:/CODE/DEMO/world-gen/src/main.ts) into a clean, thin `UIManager` adapter module ([`src/ui-manager.ts`](file:///D:/CODE/DEMO/world-gen/src/ui-manager.ts)).

### Key Responsibilities for `UIManager`:
1. **DOM Input Adapter**:
   - Bind sliders, number inputs, selects, and checkboxes to `StateObservable` without knowing about WebGL or 3D physics.
   - Synchronize DOM inputs when `StateObservable` values change.
2. **Mobile Control Sheet & Modals**:
   - Encapsulate bottom sheet drag/toggle gestures (`#mobile-sheet-handle`, `#mobile-sidebar`).
   - Encapsulate parameter info modals (`#mobile-info-modal`).
3. **Tooltip & Overlay Management**:
   - Encapsulate document-body tooltip positioning (`setupTooltips()`).

---

## 3. Recommended Skills for Next Agent
1. `/implement`: To create `src/ui-manager.ts` and refactor `src/main.ts`.
2. `/tdd`: To write unit tests for `UIManager` DOM event bindings in `src/ui-manager.test.ts`.
3. `/code-review`: To run a 2-axis review before committing.
