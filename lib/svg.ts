export type Point = { x: number; y: number };

/**
 * Cubic path through a series of points, control points parked at the
 * horizontal midpoint of each segment. Gives the trail its soft S-curves
 * without overshooting past a point.
 *
 * Both the journey map and the landing-page trail drew this by hand; they are
 * meant to look like the same object, so they now share the maths.
 */
export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const mx = (from.x + to.x) / 2;
    d += ` C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`;
  }
  return d;
}
