import React from 'react';
import { CalendarSVG } from '../../../assets';
import { Input } from './Input';
import type { IInputProps } from './Input';

/** Everything `Input` takes, minus the two props this control fixes itself. */
export type IDatePickerProps = Omit<IInputProps, 'type' | 'trailingIcon'>;

/**
 * The product's date field. A native `<input type='date'>` underneath — the
 * platform picker, its keyboard handling and its locale formatting all come
 * for free, and the value stays the `YYYY-MM-DD` string
 * `shared/lib/event-datetime` expects on both sides of the boundary.
 *
 * What the design system adds is the shell: the kit's control height, focus
 * ring and invalid state via `Input`, and a calendar glyph in place of the
 * browser's own indicator. The native indicator isn't removed but stretched
 * across the whole control (see `src/index.css`), so clicking anywhere on
 * the field opens the picker.
 */
export const DatePicker: React.FC<IDatePickerProps> = (props) => (
  <Input type='date' trailingIcon={<CalendarSVG className='size-4' />} {...props} />
);
