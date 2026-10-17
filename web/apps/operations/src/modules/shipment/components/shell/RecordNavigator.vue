<template>
  <!--
    Cross-record navigator. Shown in the detail topbar ONLY when the
    operator arrived from a filtered listing (the cache is populated
    by `useRecordNavigator.ensureLoaded()`). Carries:
      - a chip describing the filter ("Filtro: Da controllare") that
        also doubles as the "back to list" trigger;
      - prev / next buttons with a record counter;
      - keyboard shortcuts (← →, j / k, g g, Shift+G, Esc) so the
        operator never has to take their hands off the keyboard.
  -->
  <div v-if="navigator.total.value > 0" class="recnav">
    <button
      type="button"
      class="recnav__chip"
      :title="chipTitle"
      @click="backToList"
    >
      <v-icon icon="mdi-arrow-left" size="14" class="recnav__chip-arrow" />
      <span class="recnav__chip-label">{{ filterLabel }}</span>
      <span class="recnav__chip-sep">·</span>
      <span class="recnav__chip-count">{{ navigator.total.value }}</span>
    </button>

    <div class="recnav__nav">
      <button
        type="button"
        class="rbtn"
        :disabled="!navigator.hasPrev.value"
        :title="t('shell.recnav.prev')"
        @click="navigator.goPrev"
      >
        <v-icon icon="mdi-chevron-left" size="18" />
      </button>
      <span class="rlbl">
        {{ t("shell.recnav.record") }}
        <b>{{ Math.max(navigator.index.value + 1, 1) }}</b>
        <span class="rlbl__sep">{{ t("shell.recnav.of") }}</span>
        <span>{{ navigator.total.value }}</span>
        <span
          v-if="navigator.cached.value < navigator.total.value"
          class="rlbl__hint"
          :title="
            t('shell.recnav.loaded_of', {
              loaded: navigator.cached.value,
              total: navigator.total.value,
            })
          "
          >({{ navigator.cached.value }})</span
        >
      </span>
      <button
        type="button"
        class="rbtn"
        :disabled="!navigator.hasNext.value"
        :title="t('shell.recnav.next')"
        @click="navigator.goNext"
      >
        <v-icon icon="mdi-chevron-right" size="18" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useRecordNavigator } from "@shipment/composables/useRecordNavigator";
import {
  findKpiForListing,
  kpiLabel,
} from "@shared/dashboard/home_kpi_catalog";

/**
 * `overlay=true` cuando el navegador se monta dentro del modal de detalle
 * abierto desde el listado (ShipmentDetailOverlay). En ese modo prev/next
 * navega con `?view=` y Escape cierra el modal en vez de volver a la lista.
 */
const props = withDefaults(defineProps<{ overlay?: boolean }>(), {
  overlay: false,
});

const { t } = useI18n();
const store = useShipmentStore();
const route = useRoute();
const router = useRouter();
const { id } = storeToRefs(store);
const currentId = computed<number | null>(() => id.value);
const overlayRef = computed<boolean>(() => props.overlay);
const navigator = useRecordNavigator(currentId, { overlay: overlayRef });

/**
 * Chip label — picks the catalog descriptor when the listing arrived
 * via a known KPI type (e.g. `?type=dacontr` → "Da controllare"),
 * otherwise falls back to a generic "Lista filtrata" so the chip
 * always communicates something useful.
 */
const filterLabel = computed<string>(() => {
  const type = String(route.query.type ?? "");
  const kpi = findKpiForListing(
    "shipment-list",
    type,
    String(route.query.kpi ?? ""),
  );
  if (kpi) return kpiLabel(t, kpi);
  if (type && type !== "all") return type;
  return t("shell.recnav.filtered_list");
});

const chipTitle = computed<string>(() =>
  t("shell.recnav.back_to_list", { label: filterLabel.value }),
);

function backToList(): void {
  if (props.overlay) {
    // En overlay: cerrar el modal = quitar ?view (el listado sigue de fondo).
    const q = { ...route.query };
    delete q.view;
    void router.push({ name: "shipment-list", query: q });
    return;
  }
  void router.push({
    name: "shipment-list",
    query: { ...route.query, restore: "1" },
  });
}

/* ---------- vim-style chord state for "g g" (first record) ---------- */
let chord: "idle" | "g" = "idle";
let chordTimer: number | null = null;
function clearChord(): void {
  chord = "idle";
  if (chordTimer !== null) window.clearTimeout(chordTimer);
  chordTimer = null;
}
function goFirst(): void {
  const first = navigator.records.value[0];
  if (first) navigator.goTo(first.id);
}
function goLast(): void {
  const arr = navigator.records.value;
  const last = arr[arr.length - 1];
  if (last) navigator.goTo(last.id);
}

function onKey(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null;
  if (t && (t.matches("input,textarea,select") || t.isContentEditable)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  // Chord branch — only "g g" is meaningful right now.
  if (chord === "g") {
    clearChord();
    if (e.key === "g") {
      e.preventDefault();
      goFirst();
      return;
    }
    return;
  }

  switch (e.key) {
    case "Escape":
      e.preventDefault();
      backToList();
      return;
    case "ArrowLeft":
    case "k":
      if (navigator.hasPrev.value) {
        e.preventDefault();
        navigator.goPrev();
      }
      return;
    case "ArrowRight":
    case "j":
      if (navigator.hasNext.value) {
        e.preventDefault();
        navigator.goNext();
      }
      return;
    case "g":
      // Start the `g g` chord — second `g` triggers goFirst above.
      chord = "g";
      if (chordTimer !== null) window.clearTimeout(chordTimer);
      chordTimer = window.setTimeout(clearChord, 800);
      return;
    case "G":
      e.preventDefault();
      goLast();
      return;
  }
}

onMounted(() => {
  void navigator.ensureLoaded(route.query);
  document.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKey);
  clearChord();
});
</script>

<style scoped lang="scss">
.recnav {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

/* ─── filter chip (left-aligned) ─────────────────────────────────── */
.recnav__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 8px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 999px;
  background: rgb(var(--v-theme-surface-variant));
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  transition:
    background 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease;
}
.recnav__chip:hover {
  background: rgba(var(--v-theme-primary), 0.1);
  border-color: rgba(var(--v-theme-primary), 0.4);
  color: rgb(var(--v-theme-primary));
}
.recnav__chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.recnav__chip-arrow {
  opacity: 0.65;
}
.recnav__chip-label {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recnav__chip-sep {
  opacity: 0.45;
}
.recnav__chip-count {
  font-feature-settings: "tnum";
  opacity: 0.7;
}

/* ─── nav buttons + counter ──────────────────────────────────────── */
.recnav__nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 999px;
  background: rgb(var(--v-theme-surface));
}
.rbtn {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 0;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface-variant));
  transition:
    background 0.12s ease,
    color 0.12s ease;
}
.rbtn:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.rbtn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.rlbl {
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 0 8px;
  font-feature-settings: "tnum";
  white-space: nowrap;
}
.rlbl b {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 700;
}
.rlbl__sep {
  margin: 0 4px;
  opacity: 0.55;
}
.rlbl__hint {
  margin-left: 5px;
  font-size: 10.5px;
  opacity: 0.55;
}
</style>
