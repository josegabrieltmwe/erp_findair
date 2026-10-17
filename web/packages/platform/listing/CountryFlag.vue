<template>
  <span class="country-flag-wrap" :title="isoUpper || undefined">
    <img
      v-if="src"
      :src="src"
      :alt="isoUpper"
      :height="size"
      class="country-flag"
      loading="lazy"
      @error="onError"
    />
    <span v-else class="country-flag-fallback">
      {{ isoUpper || '—' }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { hasFlag } from 'country-flag-icons';

/**
 * Renders the SVG flag for an ISO-3166-1 alpha-2 country code (IT, US, FR…).
 * The ERP stores these codes in `id_paese_iso`, surfaced by the listing
 * handlers as `origin.country` / `destination.country`.
 *
 * Lives in @tmwe/platform so cargo_express and shipment_express share one
 * implementation (both list lanes by origin/destination country). Falls
 * back to the bare code when the flag asset is missing or the input isn't
 * a clean 2-letter code, so callers never render a broken image.
 *
 * Flag assets resolve via a bare Vite import (`country-flag-icons/3x2/XX.svg`)
 * which works from any package as long as the dep is installed in the
 * consuming app (cargo_express + shipment_express both declare it).
 */
const props = withDefaults(
  defineProps<{
    iso?: string | null;
    size?: number;
  }>(),
  { size: 16 },
);

const isoUpper = computed(() => (props.iso ?? '').toUpperCase().trim());

const src = ref('');

// Eager glob of every 3x2 flag — Vite resolves these at build time into
// hashed asset URLs, so the runtime lookup is a plain object access (no
// dynamic import network round-trip per row, which matters when a listing
// renders 50–100 flags at once).
//
// La ruta es RELATIVA a este archivo, no absoluta (`/node_modules/...`).
// Con pnpm la dependencia se enlaza en `packages/platform/node_modules/`,
// NO en la raíz `frontend/node_modules/`, así que el patrón absoluto no
// casaba con nada desde la app `operations`: el glob quedaba vacío, `src`
// siempre '' y CADA fila caía al fallback de texto (el ISO en un recuadro)
// sin que se empaquetara un solo SVG. Relativo resuelve desde el paquete
// que declara la dependencia y funciona en cualquier app consumidora.
const flagUrls = import.meta.glob<string>(
  '../node_modules/country-flag-icons/3x2/*.svg',
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

/**
 * El glob indexa por la ruta tal cual la resuelve Vite, que puede variar
 * según desde dónde se importe el componente. Reindexamos por código ISO
 * (el nombre del fichero) para que el lookup no dependa del prefijo.
 */
const flagByCode: Record<string, string> = {};
for (const [path, url] of Object.entries(flagUrls)) {
  const code = path.slice(path.lastIndexOf('/') + 1).replace('.svg', '');
  flagByCode[code] = url;
}

watchEffect(() => {
  const code = isoUpper.value;
  if (!code || code.length !== 2 || !hasFlag(code)) {
    src.value = '';
    return;
  }
  src.value = flagByCode[code] ?? '';
});

function onError(): void {
  src.value = '';
}
</script>

<style scoped lang="scss">
.country-flag-wrap {
  display: inline-flex;
  align-items: center;
  line-height: 0;
}

/* Subtle 3D lift: thin ring + soft drop shadow so the flag reads as a
   physical chip sitting just above the row surface (matches the listing's
   subtle-depth language). */
.country-flag {
  display: inline-block;
  vertical-align: middle;
  border-radius: 3px;
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.10),
    0 1px 2px rgba(15, 23, 42, 0.18);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

/* Row hover (driven by the parent <tr>:hover) lifts the flag a touch. */
:deep(tr:hover) .country-flag,
:deep(.v-data-table__tr:hover) .country-flag {
  transform: translateY(-1px);
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.12),
    0 2px 5px rgba(15, 23, 42, 0.25);
}

.country-flag-fallback {
  display: inline-block;
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 3px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
