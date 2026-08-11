/**
 * The three persistent navigation destinations, in the exact order the
 * shell must render them (specs/app-navigation/spec.md — "Persistent
 * vertical navigation").
 */
export interface INavigationItem {
  readonly label: string;
  readonly to: string;
}

export const NAVIGATION_ITEMS: readonly INavigationItem[] = [
  { label: 'Calendar', to: '/events' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'Users', to: '/users' },
];
