/**
 * Opening a place from anywhere (a board panel, a pin on the route globe) is
 * a window event, so the arrival view doesn't need to share state with them.
 */
export const VISIT_EVENT = "place:visit";

export type VisitDetail = {
  slug: string;
  /** Where the click came from, so the arrival can grow out of it. */
  from?: { top: number; left: number; width: number; height: number };
};

export function visitPlace(slug: string, from?: Element | null) {
  const r = from?.getBoundingClientRect();
  const detail: VisitDetail = {
    slug,
    from: r ? { top: r.top, left: r.left, width: r.width, height: r.height } : undefined,
  };
  window.dispatchEvent(new CustomEvent<VisitDetail>(VISIT_EVENT, { detail }));
}
