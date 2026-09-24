/**
 * How long the client spends animating each kind of event. The server waits
 * this long before a bot moves, so nobody's dive plays out faster than the eye.
 */
export const ANIM = {
  /** dice tumbling before they settle */
  dice: 950,
  /** one hop from tile to tile */
  hop: 230,
  /** a chip flying between the line and a diver */
  treasure: 500,
} as const;
