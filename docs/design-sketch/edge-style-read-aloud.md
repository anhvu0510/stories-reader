# Edge-style Read Aloud — UI Sketch

## Skill Bundle

| Phase | Owner | Supporting | Why selected / when loaded |
|---|---|---|---|
| Direction | `frontend-design` | none | Reshape the existing reading surface around one quiet, unmistakable focus treatment. |
| Implementation | `react-dev` | none | Load after approval to implement the active-line and word-tracking behavior in React/TypeScript. |
| Verification | `web-design-guidelines` | `diagnose` | Load after implementation to verify readability, motion, reduced-motion behavior, and the original visual regression. |

## Design Read

The page's single job during Read Aloud is to keep the eye on the words currently being spoken without changing the book's layout. The current rounded paragraph frame competes with the text and makes each batch look like a separate card; the replacement should preserve the normal page, use one restrained active-line wash as the signature element, and let the current word provide the only strong accent.

## Sketch Board

| Area | Decision to review | Source |
|---|---|---|
| Primary job | Keep exactly one rendered text line visually active while the spoken word advances inside that line. No paragraph-level ring, fill, padding, shadow, blur, or rounded frame. | brief + `frontend-design` |
| Hierarchy/flow | Normal text stays unchanged; the active line receives a subtle full-line selection wash, and only the current word receives the warm yellow focus highlight. When the word wraps, the wash transfers to the next visual line. | brief + `frontend-design` |
| Visual direction | Quiet e-reader treatment: reuse the current theme's foreground/background tokens, add no new card surface, and spend the single strong accent on the spoken word. | `frontend-design` |
| Components/states | Playing: line wash + word highlight. Paused: preserve the current position without animation. Stopped/error: remove both treatments and restore untouched text. | brief + `frontend-design` |
| Responsive/accessibility | Derive the active line from the browser's rendered word rectangle so it follows font size and wrapping on every viewport; scroll only when that line exits a centered safe band, with reduced-motion users receiving instant positioning. | brief + `frontend-design` |
| Risks/unknowns | Current word highlighting mutates text nodes, while the paragraph frame is driven independently by React state. Implementation must avoid layout shift, stale line overlays, and scroll chasing during manual interaction. | repository + `diagnose` |

## Approval Gate

Reply `duyệt` or request changes. Production UI code starts only after approval.
