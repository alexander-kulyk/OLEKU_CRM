// core
import type React from 'react';
import { NavLink } from 'react-router';
import type { NavLinkRenderProps } from 'react-router';
// other
import { classNames } from '../../../shared/lib';
import { NAVIGATION_ITEMS } from './constants';
import type { INavigationItem } from './constants';

const BASE_LINK_CLASS_NAME =
  'flex items-center gap-md rounded-md px-md py-sm text-body transition-colors';
const ACTIVE_LINK_CLASS_NAME = 'bg-surface-sunken font-medium text-ink';
const INACTIVE_LINK_CLASS_NAME = 'text-ink-secondary hover:bg-surface-muted hover:text-ink';

const ACTIVE_ICON_CLASS_NAME = 'size-5 shrink-0 text-accent';
const INACTIVE_ICON_CLASS_NAME = 'size-5 shrink-0 text-ink-muted';

interface INavigationLinkProps {
  readonly item: INavigationItem;
}

/**
 * One destination row. The active treatment — a sunken warm fill, the label
 * in full ink, and the glyph in the accent — comes from
 * assets/ui_kit/menu.png, and is driven by `NavLink`'s own `isActive` rather
 * than by comparing the location here.
 */
const NavigationLink: React.FC<INavigationLinkProps> = ({ item }) => {
  const { Icon, label, to } = item;

  const getLinkClassName = ({ isActive }: NavLinkRenderProps): string =>
    classNames(
      BASE_LINK_CLASS_NAME,
      isActive ? ACTIVE_LINK_CLASS_NAME : INACTIVE_LINK_CLASS_NAME,
    );

  const renderLinkContent = ({ isActive }: NavLinkRenderProps): React.ReactNode => (
    <>
      <Icon className={isActive ? ACTIVE_ICON_CLASS_NAME : INACTIVE_ICON_CLASS_NAME} />
      {label}
    </>
  );

  return (
    <NavLink to={to} className={getLinkClassName} end>
      {renderLinkContent}
    </NavLink>
  );
};

/**
 * The persistent navigation rail (assets/ui_kit/menu.png): a light warm
 * surface separated from the page by a single hairline, a compact product
 * mark, then one row per destination.
 */
export const Navigation: React.FC = () => {
  return (
    <nav
      aria-label='Primary'
      className='flex w-sidebar shrink-0 flex-col gap-xl border-r border-line bg-surface px-md py-lg'
    >
      <span className='px-md text-eyebrow text-ink-muted'>NORTHLINE CRM</span>

      <ul className='flex flex-col gap-xs'>
        {NAVIGATION_ITEMS.map((item) => (
          <li key={item.to}>
            <NavigationLink item={item} />
          </li>
        ))}
      </ul>
    </nav>
  );
};
