import React from 'react';
import type { ISvgIconProps } from './types';

/**
 * The in-flight indicator paired with a busy label (buttons.png — "Saving…").
 * The rotation is a Tailwind `animate-spin` applied by the caller through
 * `className`, so this file stays pure markup.
 */
export const SpinnerSVG: React.FC<ISvgIconProps> = ({ className }) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={2}
    strokeLinecap='round'
    aria-hidden='true'
    focusable='false'
    className={className}
  >
    <circle cx='12' cy='12' r='9' opacity='0.3' />
    <path d='M21 12a9 9 0 0 0-9-9' />
  </svg>
);
