/**
 * Icon sizes in pixels, so the same kind of icon has the same size on every
 * screen. Text next to them is 14 to 16 px: an icon a bit bigger reads as
 * the same line.
 */
export const ICON_SIZE = {
  /** Inside a small row, such as the arrow that opens a report line. */
  small: 16,
  /** The arrow at the end of a link row. */
  chevron: 18,
  /** Next to the text of a button or a row. */
  regular: 20,
  /** The bottom bar and the month arrows: easy to hit with a thumb. */
  nav: 22,
  /** Above the name of a big button, and in a big category badge. */
  large: 24,
  /** The "+" in the middle of the bottom bar. */
  add: 28,
} as const;

/** Thicker lines for an icon that stands out (lucide's default is 2). */
export const BOLD_STROKE = 2.4;
