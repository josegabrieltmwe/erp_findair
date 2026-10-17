import { h } from 'vue';
import type { IconSet, IconProps } from 'vuetify';
import { aliases, mdi as mdiSvg } from 'vuetify/iconsets/mdi-svg';
import { mdi as mdiFont } from 'vuetify/iconsets/mdi';

/**
 * hybridMdi — shared MDI iconset that speaks BOTH icon dialects.
 *
 * The app code and shared packages mix two icon styles:
 *   - SVG paths from '@mdi/js'  (e.g. :icon="mdiPencil" → "M20.71,7.04…")
 *   - font class names          (e.g. icon="mdi-account-multiple")
 *
 * A plain font set can't paint an SVG path (it injects it as a CSS class →
 * empty icons); the mdi-svg set can't paint a font class name. Since both
 * styles appear across the shared packages, this hybrid set inspects each
 * value and delegates to the right underlying set.
 *
 * Critically, Vuetify's INTERNAL aliases ($checkboxOn, $success, and the
 * v-switch thumb) resolve to a path prefixed with 'svg:'. Vuetify only strips
 * that prefix when the set is literally named 'svg', so under a custom set the
 * full "svg:M…" string arrives here and must be forwarded to mdi-svg — else
 * the switch/checkbox thumb renders EMPTY (the "v-switch that doesn't show"
 * bug this module exists to fix).
 *
 * Single source of truth: every app's plugins/vuetify.ts imports this so the
 * fix (and any future icon tweak) lives in one place.
 */
export const hybridMdi: IconSet = {
  component: (props: IconProps) => {
    const icon = props.icon;
    if (typeof icon === 'string' && icon.startsWith('svg:')) {
      return h(mdiSvg.component, { ...props, icon: icon.slice(4) });
    }
    const isFontName = typeof icon === 'string' && icon.startsWith('mdi-');
    const set = isFontName ? mdiFont : mdiSvg;
    return h(set.component, props);
  },
};

/**
 * Ready-to-spread `icons` config for createVuetify(). Uses the mdi-svg
 * aliases (so internal $-aliases resolve to real paths) with the hybrid set.
 *
 *   createVuetify({ icons: sharedIcons, theme: {...}, defaults: {...} })
 */
export const sharedIcons = {
  defaultSet: 'mdi',
  aliases,
  sets: { mdi: hybridMdi },
} as const;
