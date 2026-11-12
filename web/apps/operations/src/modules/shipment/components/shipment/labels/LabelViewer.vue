<template>
  <div
    class="lv"
    tabindex="0"
    role="group"
    :aria-label="t('shipment.awb.viewer.aria')"
    @keydown="onKey"
  >
    <div v-if="loading" class="lv__state">
      <v-progress-circular indeterminate size="32" />
      <div v-if="loadingText" class="text-caption mt-3 text-medium-emphasis">
        {{ loadingText }}
      </div>
    </div>
    <div v-else-if="error" class="lv__state text-error">
      {{ error }}
      <v-btn class="mt-2" size="small" variant="tonal" @click="emit('retry')">
        {{ t("shipment.awb.viewer.retry") }}
      </v-btn>
    </div>
    <EmptyState
      v-else-if="!items.length && !docs.length"
      icon="mdi-package-variant-closed-remove"
      :title="emptyTitle"
      :text="emptyText"
    />
    <template v-else>
      <!-- Barra de acciones: imprimir y descargar solo cuando hay etiquetas reales. -->
      <div v-if="items.length" class="lv__toolbar">
        <v-menu location="bottom end">
          <template #activator="{ props: mp }">
            <v-btn
              v-bind="mp"
              variant="tonal"
              size="small"
              prepend-icon="mdi-printer"
              append-icon="mdi-menu-down"
              :loading="printing"
            >
              {{ t("shipment.awb.print") }}
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-file-outline"
              :title="t('shipment.awb.viewer.this_package')"
              @click="emitPrint('current')"
            />
            <v-list-item
              v-if="items.length > 1"
              prepend-icon="mdi-file-multiple-outline"
              :title="
                t('shipment.awb.viewer.all_packages', { n: items.length })
              "
              @click="emitPrint('all')"
            />
            <v-list-item
              v-if="items.length > 2"
              prepend-icon="mdi-format-list-numbered"
              :title="t('shipment.awb.viewer.range')"
              @click="openRange('print')"
            />
          </v-list>
        </v-menu>
        <v-menu location="bottom end">
          <template #activator="{ props: mp }">
            <v-btn
              v-bind="mp"
              variant="text"
              size="small"
              prepend-icon="mdi-download"
              append-icon="mdi-menu-down"
            >
              {{ t("shipment.awb.download") }}
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-file-outline"
              :title="t('shipment.awb.viewer.this_package')"
              @click="emitDownload('current', 'pdf')"
            />
            <v-list-item
              v-if="items.length > 1"
              prepend-icon="mdi-file-pdf-box"
              :title="t('shipment.awb.viewer.all_pdf')"
              @click="emitDownload('all', 'pdf')"
            />
            <v-list-item
              v-if="items.length > 1 && zipAvailable"
              prepend-icon="mdi-folder-zip-outline"
              :title="t('shipment.awb.viewer.all_zip')"
              @click="emitDownload('all', 'zip')"
            />
            <v-list-item
              v-if="items.length > 2"
              prepend-icon="mdi-format-list-numbered"
              :title="t('shipment.awb.viewer.range')"
              @click="openRange('download')"
            />
          </v-list>
        </v-menu>
      </div>

      <!-- Rango de bultos («1-5,8») para imprimir o descargar. -->
      <form v-if="rangeFor" class="lv__range" @submit.prevent="applyRange">
        <v-text-field
          v-model="rangeText"
          :label="t('shipment.awb.viewer.range_label')"
          :placeholder="'1-5,8'"
          :error-messages="rangeError"
          density="compact"
          variant="outlined"
          hide-details="auto"
          autofocus
          class="lv__range-input"
        />
        <v-btn type="submit" size="small" color="primary">
          {{
            rangeFor === "print"
              ? t("shipment.awb.print")
              : t("shipment.awb.download")
          }}
        </v-btn>
        <v-btn size="small" variant="text" @click="rangeFor = null">
          {{ t("common.cancel") }}
        </v-btn>
      </form>

      <div
        v-if="items.length"
        class="lv__body"
        :class="{ 'lv__body--rail': showRail }"
      >
        <!-- Carril de bultos: número y tracking, sin cargar ninguna imagen. -->
        <nav
          v-if="showRail"
          class="lv__rail"
          :aria-label="t('shipment.awb.viewer.packages')"
        >
          <form class="lv__goto" @submit.prevent="goToTyped">
            <v-text-field
              v-model="gotoText"
              :label="t('shipment.awb.viewer.go_to')"
              density="compact"
              variant="outlined"
              hide-details
              inputmode="numeric"
            />
          </form>
          <div class="lv__rail-list">
            <button
              v-for="(it, i) in items"
              :key="it.key"
              type="button"
              class="lv__chip"
              :class="{ 'lv__chip--on': i === safeCurrent }"
              :aria-current="i === safeCurrent ? 'true' : undefined"
              @click="select(i)"
            >
              <span class="lv__chip-n">{{ it.number }}</span>
              <span class="lv__chip-t">{{ shortTracking(it.tracking) }}</span>
              <v-icon
                v-if="it.loaded"
                icon="mdi-check"
                size="12"
                class="lv__chip-ok"
              />
            </button>
          </div>
        </nav>

        <section class="lv__stage">
          <div class="lv__nav">
            <v-btn
              icon="mdi-chevron-left"
              variant="text"
              density="comfortable"
              :disabled="safeCurrent <= 0"
              :title="t('shipment.awb.viewer.prev')"
              @click="select(safeCurrent - 1)"
            />
            <span class="text-caption text-medium-emphasis lv__nav-title">
              <strong>{{ cur?.title }}</strong>
              <span v-if="cur?.tracking" class="ms-1"
                >· {{ cur.tracking }}</span
              >
              <span v-if="items.length > 1" class="ms-2">
                ({{ safeCurrent + 1 }} / {{ items.length }})
              </span>
            </span>
            <v-btn
              icon="mdi-chevron-right"
              variant="text"
              density="comfortable"
              :disabled="safeCurrent >= items.length - 1"
              :title="t('shipment.awb.viewer.next')"
              @click="select(safeCurrent + 1)"
            />
            <v-spacer />
            <v-btn
              icon="mdi-magnify-minus-outline"
              size="x-small"
              variant="text"
              :disabled="!zoom.canZoomOut.value"
              :title="t('shipment.awb.zoom_out')"
              @click="zoom.zoomOut"
            />
            <span class="lv__zoom">{{ zoom.label.value }}</span>
            <v-btn
              icon="mdi-magnify-plus-outline"
              size="x-small"
              variant="text"
              :disabled="!zoom.canZoomIn.value"
              :title="t('shipment.awb.zoom_in')"
              @click="zoom.zoomIn"
            />
            <v-btn
              icon="mdi-fit-to-page-outline"
              size="x-small"
              variant="text"
              :disabled="zoom.isFit.value"
              :title="t('shipment.awb.zoom_fit')"
              @click="zoom.reset"
            />
          </div>

          <div
            class="lv__frame"
            :class="{ 'lv__frame--zoomed': !zoom.isFit.value }"
            @wheel="zoom.onWheel"
          >
            <div v-if="itemError" class="lv__state text-error">
              {{ itemError }}
              <v-btn
                class="mt-2"
                size="small"
                variant="tonal"
                @click="emit('retry')"
              >
                {{ t("shipment.awb.viewer.retry") }}
              </v-btn>
            </div>
            <template v-else>
              <v-progress-circular
                v-if="itemLoading || (cur?.src && !imgReady)"
                indeterminate
                size="28"
                class="lv__spinner"
              />
              <img
                v-if="cur?.src"
                :key="cur.key"
                :src="cur.src"
                :alt="cur.title"
                class="lv__img"
                :class="{ 'lv__img--ready': imgReady }"
                :style="zoom.styleFor()"
                @load="imgReady = true"
                @error="imgReady = true"
              />
            </template>
          </div>
        </section>
      </div>

      <!-- Documentos auxiliares (factura comercial, mercancías peligrosas…): fuera de la numeración de bultos
           y de «imprimir etiquetas». -->
      <div v-if="docs.length" class="lv__docs">
        <div class="text-caption font-weight-bold mb-1">
          {{ t("shipment.awb.viewer.docs", { n: docs.length }) }}
        </div>
        <div v-for="d in docs" :key="d.key" class="lv__doc">
          <v-icon icon="mdi-file-document-outline" size="16" class="me-2" />
          <span class="text-body-2 flex-grow-1">{{ d.title }}</span>
          <v-btn
            size="x-small"
            variant="tonal"
            prepend-icon="mdi-open-in-new"
            :disabled="!d.url"
            @click="emit('open-doc', d)"
          >
            {{ t("shipment.awb.open_pdf") }}
          </v-btn>
          <v-btn
            icon="mdi-download"
            size="x-small"
            variant="text"
            :disabled="!d.url"
            :title="t('shipment.awb.download_pdf')"
            @click="emit('download-doc', d)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Visor único de etiquetas para la LDV interna (TMWE) y las etiquetas de los fornitores.
 *
 * Presentacional: un bulto grande cada vez, carril de bultos (número + tracking, sin imágenes), zoom único,
 * teclado, documentos auxiliares aparte y menús de imprimir/descargar por selección (este bulto, todos, rango).
 * No imprime ni descarga por sí mismo: emite la selección y quien lo usa llama al servidor, que genera el PDF/ZIP
 * (nunca se monta HTML con imágenes en el navegador). Los datos llegan por props; la carga a demanda de cada
 * bulto la hace quien lo usa al ver `update:current`.
 */
import EmptyState from "@shared/ui/EmptyState.vue";
import { useLabelZoom } from "@shared/composables/useLabelZoom";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  clampIndex,
  neighborIndexes,
  parsePackageSelection,
  shortTracking,
  type LabelFormat,
  type LabelScope,
  type LabelSelection,
} from "@shipment/labels/labelPackages";
import { labelViewerAction } from "@shipment/labels/labelViewerKeys";

export interface LabelViewerItem {
  key: string;
  /** Número de bulto (1-based, el que entiende el API). */
  number: number;
  title: string;
  tracking?: string | null;
  /** URL o data URI de la imagen; ausente = aún no cargada. */
  src?: string;
  /** Ya cargado (marca en el carril). */
  loaded?: boolean;
}

export interface LabelViewerDoc {
  key: string;
  title: string;
  url?: string;
}

const props = withDefaults(
  defineProps<{
    items: LabelViewerItem[];
    docs?: LabelViewerDoc[];
    /** Bulto mostrado (0-based). */
    current: number;
    loading?: boolean;
    loadingText?: string;
    error?: string | null;
    /** El bulto actual se está pidiendo. */
    itemLoading?: boolean;
    itemError?: string | null;
    printing?: boolean;
    /** El ZIP solo existe para la LDV interna. */
    zipAvailable?: boolean;
    emptyTitle?: string;
    emptyText?: string;
  }>(),
  {
    docs: () => [],
    loading: false,
    loadingText: "",
    error: null,
    itemLoading: false,
    itemError: null,
    printing: false,
    zipAvailable: false,
    emptyTitle: "",
    emptyText: "",
  },
);

const emit = defineEmits<{
  "update:current": [index: number];
  print: [selection: LabelSelection];
  download: [selection: LabelSelection];
  "open-doc": [doc: LabelViewerDoc];
  "download-doc": [doc: LabelViewerDoc];
  retry: [];
}>();

const { t } = useI18n();
const zoom = useLabelZoom();

/** El carril solo aparece con varios bultos. */
const showRail = computed(() => props.items.length > 1);
const safeCurrent = computed(() =>
  clampIndex(props.current, props.items.length),
);
const cur = computed(() => props.items[safeCurrent.value]);

const imgReady = ref(false);
watch(
  () => [cur.value?.key, cur.value?.src] as const,
  () => {
    imgReady.value = false;
    zoom.reset();
    // Precarga del vecino: la navegación con flechas no espera a la red. Solo si ya hay URL.
    for (const i of neighborIndexes(safeCurrent.value, props.items.length)) {
      const src = props.items[i]?.src;
      if (src && !src.startsWith("data:") && typeof Image !== "undefined") {
        new Image().src = src;
      }
    }
  },
  { immediate: true },
);

function select(i: number): void {
  const next = clampIndex(i, props.items.length);
  if (next !== safeCurrent.value) emit("update:current", next);
}

function onKey(e: KeyboardEvent): void {
  const action = labelViewerAction({
    key: e.key,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    targetTag: (e.target as HTMLElement | null)?.tagName,
  });
  if (!action) return;
  e.preventDefault();
  if (action === "prev") select(safeCurrent.value - 1);
  else if (action === "next") select(safeCurrent.value + 1);
  else if (action === "first") select(0);
  else if (action === "last") select(props.items.length - 1);
  else if (action === "zoomIn") zoom.zoomIn();
  else if (action === "zoomOut") zoom.zoomOut();
  else zoom.reset();
}

// ── «Ir al bulto N» ──
const gotoText = ref("");
function goToTyped(): void {
  const n = Number(gotoText.value);
  if (!Number.isInteger(n) || n < 1) return;
  const idx = props.items.findIndex((it) => it.number === n);
  if (idx >= 0) select(idx);
  gotoText.value = "";
}

// ── Selección para imprimir / descargar ──
const maxNumber = computed(() =>
  props.items.reduce((m, it) => Math.max(m, it.number), 0),
);

function selection(scope: LabelScope, format: LabelFormat): LabelSelection {
  if (scope === "current") {
    return { scope, packages: cur.value ? [cur.value.number] : null, format };
  }
  return { scope, packages: null, format };
}
function emitPrint(scope: LabelScope): void {
  emit("print", selection(scope, "pdf"));
}
function emitDownload(scope: LabelScope, format: LabelFormat): void {
  emit("download", selection(scope, format));
}

const rangeFor = ref<"print" | "download" | null>(null);
const rangeText = ref("");
const rangeError = ref<string | undefined>(undefined);
function openRange(kind: "print" | "download"): void {
  rangeFor.value = kind;
  rangeText.value = "";
  rangeError.value = undefined;
}
function applyRange(): void {
  const r = parsePackageSelection(rangeText.value, maxNumber.value);
  if (!r.ok) {
    rangeError.value = t(`shipment.awb.viewer.range_err_${r.reason}`, {
      max: maxNumber.value,
    });
    return;
  }
  const sel: LabelSelection = {
    scope: "range",
    packages: r.packages,
    format: "pdf",
  };
  if (rangeFor.value === "print") emit("print", sel);
  else emit("download", sel);
  rangeFor.value = null;
}
</script>

<style scoped>
.lv {
  outline: none;
}
.lv__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}
.lv__toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-bottom: 8px;
}
.lv__range {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}
.lv__range-input {
  max-width: 260px;
}
.lv__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.lv__body--rail {
  grid-template-columns: 168px minmax(0, 1fr);
}
.lv__rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.lv__rail-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 60vh;
  overflow-y: auto;
}
.lv__chip {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  /* Con cientos de bultos, solo se pinta lo visible. */
  content-visibility: auto;
  contain-intrinsic-size: auto 34px;
}
.lv__chip:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.lv__chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}
.lv__chip--on {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}
.lv__chip-n {
  min-width: 24px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.lv__chip-t {
  flex: 1;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.65);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lv__chip-ok {
  color: rgb(var(--v-theme-success));
}
.lv__stage {
  min-width: 0;
}
.lv__nav {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 6px;
}
.lv__nav-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lv__zoom {
  min-width: 44px;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
/* Marco de altura fija: el bulto cabe entero sin scroll; con zoom scrollea dentro del marco. */
.lv__frame {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 240px;
  max-height: 70vh;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.02);
}
.lv__frame--zoomed {
  overflow: auto;
  cursor: grab;
}
.lv__spinner {
  position: absolute;
}
.lv__img {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  height: auto;
  margin-inline: auto;
  opacity: 0;
}
.lv__img--ready {
  opacity: 1;
  transition: opacity 0.15s ease;
}
.lv__docs {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.lv__doc {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
}
/* Pantallas estrechas: el carril pasa arriba, en horizontal. */
@media (max-width: 700px) {
  .lv__body--rail {
    grid-template-columns: minmax(0, 1fr);
  }
  .lv__rail-list {
    flex-direction: row;
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .lv__chip {
    width: auto;
    flex: 0 0 auto;
  }
  .lv__goto {
    display: none;
  }
}
</style>
