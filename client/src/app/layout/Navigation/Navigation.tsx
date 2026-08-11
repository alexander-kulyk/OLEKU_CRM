// core
import type React from 'react';
import { NavLink } from 'react-router';
import type { NavLinkRenderProps } from 'react-router';
// other
import { NAVIGATION_ITEMS } from './constants';

const BASE_LINK_CLASS_NAME =
  'block rounded-md px-md py-sm text-sm font-medium transition-colors';
const ACTIVE_LINK_CLASS_NAME = 'bg-primary-700 text-white';
const INACTIVE_LINK_CLASS_NAME =
  'text-primary-100 hover:bg-primary-800 hover:text-white';

function getNavLinkClassName({ isActive }: NavLinkRenderProps): string {
  return `${BASE_LINK_CLASS_NAME} ${isActive ? ACTIVE_LINK_CLASS_NAME : INACTIVE_LINK_CLASS_NAME}`;
}

export const Navigation: React.FC = () => {
  return (
    <nav
      aria-label='Primary'
      className='flex w-56 shrink-0 flex-col gap-lg bg-primary-900 p-md text-white'
    >
      <span className='px-md text-lg font-semibold tracking-wide'>CRM</span>
      <ul className='flex flex-col gap-xs'>
        {NAVIGATION_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} className={getNavLinkClassName} end>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
