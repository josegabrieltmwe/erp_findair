<template>
  <!--
    Cross-record navigator para el detalle cargo. Espejo del de shipment_express
    para unificar la experiencia: se muestra SOLO cuando se llegó desde un
    listado filtrado (cache poblado por `useRecordNavigator.ensureLoaded()`).
    Lleva:
      - un chip con el filtro ("Filtered list · N") que también vuelve al listado;
      - botones prev/next con contador de registros;
      - atajos de teclado (← →, j / k, g g, Shift+G, Esc).
    (Cargo no tiene modo overlay, así que esta versión es la reducida.)
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
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useRecordNavigator } from "@cargo/composables/useRecordNavigator";
import {
  findKpiForListing,
  kpiLabel,
} from "@shared/dashboard/home_kpi_catalog";

const { t } = useI18n();
const store = useCargoStore();
const route = useRoute();
const router = useRouter();
const { id } = storeToRefs(store);
const currentId = computed<number | null>(() => id.value);
const navigator = useRecordNavigator(currentId);

/**
 * Etiqueta del chip — usa el descriptor del catálogo cuando el listado llegó
 * por un tipo KPI conocido (p.ej. `?type=clwt`), o "Filtered list" genérico.
 */
const filterLabel = computed<string>(() => {
  const type = String(route.query.type ?? "");
  const kpi = findKpiForListing(
    "cargo-list",
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
  void router.push({
    name: "cargo-list",
    query: { ...route.query, restore: "1" },
  });
}

/* ---------- chord "g g" (primer registro) estilo vim ---------- */
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
  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.matches("input,textarea,select") || target.isContentEditable)
  )
    return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

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
