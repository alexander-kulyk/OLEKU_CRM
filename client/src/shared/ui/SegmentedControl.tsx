import React from 'react';
import { classNames } from '../lib';

export interface ISegmentedControlOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
}

export interface ISegmentedControlProps<TValue extends string> {
  /** Names the group for assistive technology (e.g. "Calendar view"). */
  readonly label: string;
  readonly options: readonly ISegmentedControlOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly className?: string;
}

const GROUP_CLASS_NAME =
  'inline-flex items-center gap-xs rounded-md bg-surface-muted p-xs';
const SEGMENT_BASE_CLASS_NAME =
  'rounded-sm px-lg py-xs text-label transition-colors';
const SEGMENT_ACTIVE_CLASS_NAME = 'bg-surface text-ink shadow-rest';
const SEGMENT_INACTIVE_CLASS_NAME = 'text-ink-secondary hover:text-ink';

interface ISegmentedControlOptionButtonProps<TValue extends string> {
  readonly option: ISegmentedControlOption<TValue>;
  readonly isActive: boolean;
  readonly onSelect: (value: TValue) => void;
}

/** One segment. Owns the `value`-currying so the map above stays a single
 * JSX element with no inline handler logic. */
const SegmentedControlOptionButton = <TValue extends string>({
  option,
  isActive,
  onSelect,
}: ISegmentedControlOptionButtonProps<TValue>): React.ReactElement => {
  const handleClick = (): void => {
    onSelect(option.value);
  };

  return (
    <button
      type='button'
      onClick={handleClick}
      aria-pressed={isActive}
      className={classNames(
        SEGMENT_BASE_CLASS_NAME,
        isActive ? SEGMENT_ACTIVE_CLASS_NAME : SEGMENT_INACTIVE_CLASS_NAME,
      )}
    >
      {option.label}
    </button>
  );
};

/**
 * A small set of mutually exclusive choices shown side by side, with the
 * active one lifted onto a white surface (assets/ui_kit/fields.png —
 * "Segmented control"). Used for the calendar's Month / Week / Day switch.
 *
 * Generic over the value type, so a caller with a union (`CalendarView`) gets
 * that union back in `onChange` instead of a bare `string` — which is why
 * this is a generic function rather than a `React.FC`.
 */
export const SegmentedControl = <TValue extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: ISegmentedControlProps<TValue>): React.ReactElement => (
  <div
    role='group'
    aria-label={label}
    className={classNames(GROUP_CLASS_NAME, className)}
  >
    {options.map((option) => (
      <SegmentedControlOptionButton
        key={option.value}
        option={option}
        isActive={option.value === value}
        onSelect={onChange}
      />
    ))}
  </div>
);
