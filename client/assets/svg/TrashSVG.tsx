import React from 'react';
import type { ISvgIconProps } from './types';

export const TrashSVG: React.FC<ISvgIconProps> = ({ className }) => (
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
    <path d='M3 6h18' />
    <path d='M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2' />
    <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' />
    <path d='M10 11v6' />
    <path d='M14 11v6' />
  </svg>
);
