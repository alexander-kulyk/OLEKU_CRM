import type React from 'react';
import { CalendarSVG, UsersSVG } from '../../../../../assets';
import type { ISvgIconProps } from '../../../../../assets';

/**
 * The persistent navigation destinations, in the exact order the shell must
 * render them (specs/app-navigation/spec.md — "Persistent vertical
 * navigation").
 *
 * Each entry carries its own glyph, so `Navigation` renders one row shape
 * from this table rather than branching per destination
 * (data-driven-rendering skill) — adding a destination is one entry here.
 */
export interface INavigationItem {
  readonly label: string;
  readonly to: string;
  readonly Icon: React.FC<ISvgIconProps>;
}

export const NAVIGATION_ITEMS: readonly INavigationItem[] = [
  { label: 'Calendar', to: '/events', Icon: CalendarSVG },
  { label: 'Users', to: '/users', Icon: UsersSVG },
];
