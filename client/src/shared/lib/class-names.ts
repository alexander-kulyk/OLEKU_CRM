/**
 * Joins Tailwind class strings, dropping anything falsy. The one helper the
 * design-system primitives use to compose a base class list with a variant
 * entry and an optional caller-supplied `className` — so no component has to
 * hand-roll template literals with stray spaces in them.
 */
export type ClassNameValue = string | false | null | undefined;

export function classNames(...values: readonly ClassNameValue[]): string {
  return values.filter(Boolean).join(' ');
}
