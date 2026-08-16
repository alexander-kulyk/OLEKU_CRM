// Public API for the `shared/ui` segment — the design-system primitives every
// feature composes (assets/ui_kit). Nothing here knows about events, the
// calendar, or any other domain concept.

export { Button } from './Button';
export type { IButtonProps } from './Button';

export { IconButton } from './IconButton';
export type { IIconButtonProps } from './IconButton';

export type { ButtonSize, ButtonVariant } from './button-styles';

export { Field } from './Field';
export type { IFieldProps } from './Field';

export { Input } from './Input';
export type { IInputProps } from './Input';

export { DatePicker } from './DatePicker';
export type { IDatePickerProps } from './DatePicker';

export { TimePicker } from './TimePicker';
export type { ITimePickerProps } from './TimePicker';

export { SegmentedControl } from './SegmentedControl';
export type {
  ISegmentedControlOption,
  ISegmentedControlProps,
} from './SegmentedControl';

export { Modal } from './Modal';
export type { IModalProps } from './Modal';

export { ConfirmDialog } from './ConfirmDialog';
export type { IConfirmDialogProps } from './ConfirmDialog';
