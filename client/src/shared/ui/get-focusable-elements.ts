/**
 * Selects the elements a keyboard user can reach with Tab, in DOM order —
 * intentionally the same short list every accessible-dialog implementation
 * uses (WAI-ARIA APG Dialog pattern). Internal to `Modal`; not part of the
 * `shared/ui` public API.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** The focusable descendants of `container`, in DOM order. */
export function getFocusableElements(
  container: HTMLElement,
): readonly HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}
