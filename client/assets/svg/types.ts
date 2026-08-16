/**
 * Every icon in this folder is a single-color line glyph drawn with
 * `stroke="currentColor"`, so it inherits the text color of whatever it sits
 * in and never needs a color prop.
 *
 * Size comes from `className` (`size-4`, `size-5`, …): the CSS `width`/
 * `height` a utility sets always beats the `width`/`height` presentation
 * attributes on the `<svg>`, which are only there as a 24px default for a
 * caller that passes no class at all.
 */
export interface ISvgIconProps {
  readonly className?: string;
}
