import React from 'react';
import { ClockSVG } from '../../../assets';
import { Input } from './Input';
import type { IInputProps } from './Input';

/** Everything `Input` takes, minus the two props this control fixes itself. */
export type ITimePickerProps = Omit<IInputProps, 'type' | 'trailingIcon'>;

/**
 * The product's time field — the time-of-day counterpart to {@link DatePicker},
 * built the same way: a native `<input type='time'>` holding an `HH:MM`
 * string, wrapped in the kit's control shell with a clock glyph in place of
 * the browser's own indicator.
 */
export const TimePicker: React.FC<ITimePickerProps> = (props) => (
  <Input type='time' trailingIcon={<ClockSVG className='size-4' />} {...props} />
);
