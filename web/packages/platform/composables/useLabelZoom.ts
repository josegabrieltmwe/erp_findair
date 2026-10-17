import { computed, ref, type Ref } from 'vue';

/**
 * Zoom control for a label preview.
 *
 * The label may already carry a `rotate()` transform (courier labels ship
 * landscape and are turned upright). Zoom must therefore be COMPOSED into the
 * same `transform` string — declaring a second `transform` on the element would
 * override the rotation instead of adding to it, and the label would flip back
 * on the first zoom step.
 *
 * "Fit" (scale 1) means the label is sized by CSS to fit its frame; zooming
 * past that scrolls inside the frame rather than growing the dialog.
 */

/** Discrete steps, so +/- always lands on a readable round number. */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

export const ZOOM_FIT = 1;

export interface LabelZoom {
  /** Current scale factor (1 = fit to frame). */
  scale: Ref<number>;
  /** Human-readable level, e.g. "150%". */
  label: import('vue').ComputedRef<string>;
  /** True when the view is at the default fit scale. */
  isFit: import('vue').ComputedRef<boolean>;
  canZoomIn: import('vue').ComputedRef<boolean>;
  canZoomOut: import('vue').ComputedRef<boolean>;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** Ctrl/⌘ + wheel to zoom; plain wheel keeps scrolling the frame. */
  onWheel: (e: WheelEvent) => void;
  /**
   * Build the inline style for the image, merging the caller's own transform
   * (typically the rotation) with the zoom scale.
   */
  styleFor: (base?: Record<string, string>) => Record<string, string>;
}

export function useLabelZoom(): LabelZoom {
  const scale = ref<number>(ZOOM_FIT);

  const label = computed(() => `${Math.round(scale.value * 100)}%`);
  const isFit = computed(() => scale.value === ZOOM_FIT);
  const canZoomIn = computed(() => scale.value < ZOOM_STEPS[ZOOM_STEPS.length - 1]);
  const canZoomOut = computed(() => scale.value > ZOOM_STEPS[0]);

  function step(dir: 1 | -1): void {
    const idx = ZOOM_STEPS.findIndex((s) => s >= scale.value);
    const current = idx === -1 ? ZOOM_STEPS.length - 1 : idx;
    const next = Math.min(
      Math.max(current + dir, 0),
      ZOOM_STEPS.length - 1,
    );
    scale.value = ZOOM_STEPS[next];
  }

  function zoomIn(): void {
    step(1);
  }
  function zoomOut(): void {
    step(-1);
  }
  function reset(): void {
    scale.value = ZOOM_FIT;
  }

  function onWheel(e: WheelEvent): void {
    // Only hijack the wheel when the zoom modifier is held, so the dialog can
    // still be scrolled normally.
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }

  function styleFor(base: Record<string, string> = {}): Record<string, string> {
    if (scale.value === ZOOM_FIT) return base;

    // Compose: the caller's transform (rotation) first, then the scale, so the
    // label spins to upright and *then* grows around its own centre.
    const baseTransform = base.transform ?? '';
    const transform = `${baseTransform} scale(${scale.value})`.trim();

    return {
      ...base,
      transform,
      transformOrigin: base.transformOrigin ?? 'center center',
    };
  }

  return {
    scale,
    label,
    isFit,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
    onWheel,
    styleFor,
  };
}
