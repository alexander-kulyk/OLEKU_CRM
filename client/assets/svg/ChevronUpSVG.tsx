import React from 'react';
import type { ISvgIconProps } from './types';

/**
 * The sortable-header direction glyph (specs/user-management/spec.md —
 * "Sortable table headers SHALL ... expose their current direction to
 * assistive technology"). Descending direction reuses this same icon
 * rotated 180° (`className='rotate-180'`) rather than a second SVG file, so
 * the two directions can never visually drift apart.
 */
export const ChevronUpSVG: React.FC<ISvgIconProps> = ({ className }) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={2}
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
    focusable='false'
    className={className}
  >
    <path d='m18 15-6-6-6 6' />
  </svg>
);
