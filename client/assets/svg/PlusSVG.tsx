import React from 'react';
import type { ISvgIconProps } from './types';

export const PlusSVG: React.FC<ISvgIconProps> = ({ className }) => (
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
    <path d='M5 12h14' />
    <path d='M12 5v14' />
  </svg>
);
