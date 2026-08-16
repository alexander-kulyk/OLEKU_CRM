/**
 * The event palette, and the rule for turning a stored color into the three
 * values the calendar actually paints with.
 *
 * Lives in `shared/config` because two features need it and neither owns the
 * other: `event-dialog` offers the swatches, `event-calendar` renders blocks
 * in whatever color came back from the API.
 *
 * The API accepts any six-digit hex value
 * (server/src/modules/events/event-color.ts), so this table is the only thing
 * deciding what a user can pick — but it is NOT the only thing that can end
 * up on an event. Records created before this palette (or defaulted by the
 * server, which still falls back to its own blue when `color` is omitted)
 * carry hexes that are not listed here, which is why
 * {@link resolveEventColorTokens} derives its result from the hex itself
 * rather than looking it up.
 */

export interface IEventColorOption {
  /** Six-digit lowercase hex triplet — the exact value sent to the API. */
  readonly value: string;
  /** The swatch's accessible name; the swatch itself is decorative. */
  readonly label: string;
}

/**
 * The swatches the Event dialog offers, in render order. Drawn from the UI
 * kit's calendar (assets/ui_kit/Calendar) — muted, mid-dark hues that stay
 * legible both as a tinted event block and as a solid swatch.
 */
export const EVENT_COLOR_OPTIONS: readonly IEventColorOption[] = [
  { value: '#3f7a52', label: 'Sage' },
  { value: '#c96442', label: 'Terracotta' },
  { value: '#4c5a9e', label: 'Indigo' },
  { value: '#7a5a93', label: 'Plum' },
  { value: '#b0812f', label: 'Amber' },
  { value: '#2f7a75', label: 'Teal' },
  { value: '#b4485f', label: 'Rose' },
  { value: '#56534d', label: 'Slate' },
];

/** Preselected in a Create dialog — the palette's first swatch. */
export const DEFAULT_EVENT_COLOR = EVENT_COLOR_OPTIONS[0].value;

/**
 * The three values one stored color resolves to on the calendar: a pale fill,
 * a saturated rail down the leading edge, and text dark enough to read on the
 * fill (assets/ui_kit/Calendar/week.png).
 */
export interface IEventColorTokens {
  /** The stored hex, used for the accent rail and the month-view dot. */
  readonly base: string;
  /** The event block's background. */
  readonly tint: string;
  /** Title and time text on top of `tint`. */
  readonly ink: string;
}

/** Roughly the `--color-ink` token; mixing toward it darkens without graying. */
const INK_CHANNELS: readonly [number, number, number] = [28, 27, 25];

const TINT_COLOR_RATIO = 0.12;
const INK_COLOR_RATIO = 0.7;

const FULL_HEX_LENGTH = 7;

function parseHexChannels(hex: string): readonly [number, number, number] | null {
  if (hex.length !== FULL_HEX_LENGTH || !hex.startsWith('#')) {
    return null;
  }

  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);

  if (Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)) {
    return null;
  }

  return [red, green, blue];
}

function toHex(channels: readonly number[]): string {
  return `#${channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixChannels(
  channels: readonly [number, number, number],
  towards: readonly [number, number, number],
  ratio: number,
): string {
  return toHex(
    channels.map((channel, index) => channel * ratio + towards[index] * (1 - ratio)),
  );
}

function buildColorTokens(
  base: string,
  channels: readonly [number, number, number],
): IEventColorTokens {
  return {
    base,
    tint: mixChannels(channels, [255, 255, 255], TINT_COLOR_RATIO),
    ink: mixChannels(channels, INK_CHANNELS, INK_COLOR_RATIO),
  };
}

/**
 * The `??` branch is unreachable — {@link DEFAULT_EVENT_COLOR} is a literal
 * from the table above. It is here only so the value types as a tuple rather
 * than a nullable one, without a cast.
 */
const DEFAULT_EVENT_COLOR_CHANNELS: readonly [number, number, number] =
  parseHexChannels(DEFAULT_EVENT_COLOR) ?? [0, 0, 0];

/**
 * Derives the fill and text colors for one event from its stored hex.
 *
 * Computed rather than looked up on purpose: an event whose color predates
 * the current palette still renders as a proper tinted block instead of
 * falling back to a default hue, so no stored event is ever mis-colored by a
 * palette change.
 */
export function resolveEventColorTokens(color: string): IEventColorTokens {
  const normalized = color.trim().toLowerCase();
  const channels = parseHexChannels(normalized);

  if (channels === null) {
    // Not a value this client can paint with — fall back to the palette's own
    // default rather than emitting an invalid CSS color.
    return buildColorTokens(DEFAULT_EVENT_COLOR, DEFAULT_EVENT_COLOR_CHANNELS);
  }

  return buildColorTokens(normalized, channels);
}
