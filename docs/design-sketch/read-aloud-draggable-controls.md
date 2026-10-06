# Thanh control đọc dọc — UI Sketch

## Skill Bundle

| Phase | Owner | Supporting | Why selected / when loaded |
|---|---|---|---|
| Direction | `ui-ux-pro-max` | `high-end-visual-design` | Mobile product controls; compact enclosed surface. |
| Implementation | `react-patterns` | `coding-standards` | After approval; existing React 19 component. |
| Verification | `frontend-a11y` | `react-testing` | After implementation; gestures, keyboard and button regression. |

## Design Read

User approved a narrower implementation: **không đổi style hiện tại, chỉ đóng khung trong suốt và cho kéo dọc**. Preserve every existing control button's classes, size, icons, colors, spacing and callbacks. Add only a transparent rounded enclosure with a subtle existing-primary border and a separate transparent grip. No new surface fill, font, palette, dependency, or TTS pipeline change. User requirements supersede visual redesign recommendations from the direction skills.

## Sketch Board

| Area | Decision to review | Source |
|---|---|---|
| Primary job | Di chuyển cả thanh lên/xuống mà không chạm nhầm phát/dừng. | Brief, ui-ux-pro-max |
| Hierarchy/flow | Tay nắm trên cùng; thứ tự locate khi có, nhạc nền khi có, play/pause/loading, đoạn sau, dừng giữ nguyên. | Repository |
| Visual direction | Khung trong suốt, bo 24px, padding 8px; giữ nguyên các nút hiện tại. | User-approved refinement |
| Components/states | Chỉ tay nắm nhận thao tác kéo; các nút giữ callback hiện tại. Bỏ transition vị trí khi đang kéo để đi sát ngón tay. | ui-ux-pro-max |
| Responsive/accessibility | Hit-area nút và tay nắm ít nhất 44px; kéo Y, khóa X; giới hạn trên/dưới theo vùng an toàn. ArrowUp/Down trên tay nắm cũng di chuyển. | ui-ux-pro-max |
| Risks/unknowns | Giữ vị trí trong phiên reader, không thêm persisted store key. Re-clamp khi xoay máy, đổi chiều cao thanh, hoặc viewport thay đổi; không chiếm scroll ngoài tay nắm. | Brief, repository |

## Preview

Initial mockup `read-aloud-draggable-controls.html` is historical and superseded by the user's preserve-style refinement. The actual component can be checked in `read-aloud-controls-check.html` via the local Vite server. It does not play audio or access user data.

Repo `/design` yêu cầu HTML preview và duyệt thị giác; yêu cầu đó ưu tiên hơn design-router vốn chỉ tạo Markdown khi chưa được yêu cầu prototype.

## Approval Gate

Approved with the explicit refinement above. Implemented in ReadAloudControlFrame and composed around unchanged VerticalBatchChapterNav controls. Focused gesture tests cover Y-only drag, viewport clamps, playback buttons, pointer cancellation/capture loss, keyboard movement and viewport resize. Browser preview for the real component: `read-aloud-controls-check.html` served through Vite, not file://.

## Verification and self-check

Full suite: 66 files, 415 tests passed. Typecheck/lint passed with 105 pre-existing warnings and zero errors. Production build and whitespace checks passed. Real component browser preview confirmed transparent fill (`rgba(0, 0, 0, 0)`), whole-frame vertical movement without horizontal change, lower clearance, top clamp at 80px, arrow-key movement and functional pause/resume button. The Vite preview had transient dependency warm-up errors before reload; do not interpret its earlier console log history as a clean production smoke test. No Android hardware validation or visual baseline comparison performed.

Self-evaluation: 4.0/5. Accuracy 4 — verified CLI and browser behavior, but Android touch/selection remains untested. Completeness 4 — requested frame and drag implemented; device acceptance remains. Clarity 4 — the initial alternative mockup required a user correction, now explicitly superseded. Actionability 4 — implementation and live preview are available; not installed on a phone. Conciseness 4 — explanations are compact, but the mandated approval round added overhead. Highest-impact follow-up: validate touch dragging on the Android device. Would the user agree? Likely, if the transparent frame and unchanged button styling match their device rendering.
