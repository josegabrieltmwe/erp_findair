/**
 * Cross-listing → detail navigation context.
 *
 * When an operator clicks a row in a filtered listing, this helper:
 *
 *  1. Stashes enough state in `sessionStorage` to restore the listing
 *     to the exact same view when they come back (filter key, the row
 *     id they entered through, the listing's scroll position).
 *
 *  2. Lets the detail page emit a "back to list" action that pushes
 *     the operator to the listing URL with `?restore=1`, signalling
 *     the listing to apply the stashed state on mount.
 *
 *  3. Lets the listing page consume the stash on `?restore=1` and
 *     scroll the previously-clicked row into view.
 *
 * Keyed by the SERIALIZED filter set so two tabs with different
 * filters can't restore over each other.
 *
 * Storage is intentionally `sessionStorage` (not local) — the context
 * is meaningful only for the current tab's session and shouldn't
 * resurrect after a browser restart.
 */

const STORAGE_KEY = 'tmwe:list:context';

export interface ListContext {
  /** The listing route name — `shipment-list` / `cargo-list`. */
  page: string;
  /** Serialized filter set (the same one used to key the navigator cache). */
  filterKey: string;
  /** Anchor row id — used to scroll the row into view on restore. */
  anchorId: number | string;
  /** Fallback if the anchor row is no longer rendered (e.g. paged off). */
  scrollY: number;
  /** Timestamp; we expire stashes older than 1h to keep storage clean. */
  ts: number;
}

const MAX_AGE_MS = 60 * 60 * 1000;

function readAll(): Record<string, ListContext> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ListContext>;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* fall through */
  }
  return {};
}

function writeAll(all: Record<string, ListContext>): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/**
 * Stash the current listing context before navigating to a detail
 * view. Called from the listing's `onRowClick`.
 */
export function saveListContext(ctx: ListContext): void {
  const all = readAll();
  // Drop expired entries while we're here.
  const now = Date.now();
  for (const k of Object.keys(all)) {
    if (now - (all[k].ts ?? 0) > MAX_AGE_MS) delete all[k];
  }
  all[ctx.page] = { ...ctx, ts: now };
  writeAll(all);
}

/**
 * Read (and consume) the stashed context for a given listing page.
 * Returns null when no context is available or it has expired.
 */
export function loadListContext(page: string): ListContext | null {
  const all = readAll();
  const ctx = all[page];
  if (!ctx) return null;
  if (Date.now() - (ctx.ts ?? 0) > MAX_AGE_MS) {
    delete all[page];
    writeAll(all);
    return null;
  }
  return ctx;
}

/**
 * Drop the stash for a page — called after a successful restore or
 * when the operator opens the listing without `?restore=1`.
 */
export function clearListContext(page: string): void {
  const all = readAll();
  if (all[page]) {
    delete all[page];
    writeAll(all);
  }
}

/**
 * Best-effort scroll of the row that matches `anchorId`. The listing
 * marks each row with `data-row-id`; we look that up and call
 * `scrollIntoView`. Falls back to the saved `scrollY` if the row is
 * not in the DOM (e.g. user scrolled past page 1 originally and the
 * listing only restored page 1 by default).
 */
export function restoreListScroll(ctx: ListContext): void {
  // Use rAF + a short delay so the row markup has had a chance to
  // mount after the listing's `fetchPage()` resolves.
  const tryScroll = (): boolean => {
    const el = document.querySelector(`[data-row-id="${ctx.anchorId}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
      el.classList.add('list-row--just-returned');
      window.setTimeout(() => el.classList.remove('list-row--just-returned'), 1600);
      return true;
    }
    return false;
  };
  // First attempt on next frame.
  requestAnimationFrame(() => {
    if (tryScroll()) return;
    // Row not mounted yet — retry up to 1s in 100ms intervals.
    let attempts = 0;
    const t = window.setInterval(() => {
      attempts += 1;
      if (tryScroll() || attempts >= 10) {
        window.clearInterval(t);
        if (attempts >= 10 && typeof ctx.scrollY === 'number') {
          window.scrollTo({ top: ctx.scrollY, behavior: 'auto' });
        }
      }
    }, 100);
  });
}
