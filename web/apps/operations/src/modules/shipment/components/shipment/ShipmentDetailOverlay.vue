<template>
  <!--
    Detalle de expedición en modal abierto desde el listado.

    REUTILIZA los componentes de contenido del detalle (ShipmentOverviewV2 =
    las cards editables, y ShipmentModals = los sub-modales de edición) SIN
    montar la página completa (ShipmentDetailPageV2 / DetailShell / drawers /
    EventSource de chat), que duplicaría el chrome de la app dentro del modal.

    Barra propia ligera con prev/anterior/siguiente sobre la cohorte del
    listado (useRecordNavigator en modo overlay → navega con ?view=).
  -->
  <!--
    NO teleportar a <body>. `v-navigation-drawer` se inscribe en el layout de
    Vuetify y tiene que quedar DENTRO del `v-app`, que la app monta en
    #app-wrapper (main.ts). Un `<Teleport to="body">` lo saca fuera del v-app
    y Vuetify ya no puede posicionarlo.
  -->
  <v-navigation-drawer
    :model-value="modelValue"
    location="right"
    :width="drawerWidth"
    temporary
    class="sdo-drawer"
    @update:model-value="(v) => $emit('update:modelValue', v)"
  >
    <v-card class="sdo-card" height="100%" rounded="0">
      <!-- Barra superior propia: prev/next + título + acciones -->
      <div class="sdo-bar">
        <div class="sdo-nav">
          <v-btn
            icon="mdi-chevron-left"
            size="small"
            variant="text"
            :disabled="!navigator.hasPrev.value"
            :title="t('shipment.overlay.prev')"
            @click="navigator.goPrev()"
          />
          <span class="sdo-pos">
            <template v-if="navigator.index.value >= 0">
              {{ navigator.index.value + 1 }} /
              {{ navigator.total.value || navigator.cached.value }}
            </template>
          </span>
          <v-btn
            icon="mdi-chevron-right"
            size="small"
            variant="text"
            :disabled="!navigator.hasNext.value"
            :title="t('shipment.overlay.next')"
            @click="navigator.goNext()"
          />
        </div>

        <span class="sdo-title">
          <v-icon icon="mdi-package-variant-closed" size="18" class="me-2" />
          {{ t("shipment.overlay.shipment") }}
          <code v-if="viewId">#{{ viewId }}</code>
          <span v-if="store.loading" class="sdo-loading"
            >· {{ t("shipment.overlay.loading") }}</span
          >
        </span>

        <v-spacer />

        <v-btn
          :href="fullPageHref"
          target="_blank"
          rel="noopener"
          variant="text"
          size="small"
          icon="mdi-open-in-new"
          :title="t('shipment.overlay.open_full_page')"
        />
        <v-btn
          variant="text"
          size="small"
          icon="mdi-close"
          :title="t('shipment.overlay.close')"
          @click="close"
        />
      </div>

      <!-- Cuerpo: solo el contenido del detalle (cards), no la página -->
      <div class="sdo-body">
        <v-alert
          v-if="store.error"
          type="error"
          density="compact"
          class="ma-3"
        >
          {{ store.error }}
        </v-alert>
        <v-skeleton-loader
          v-else-if="store.loading && !store.shipment"
          type="card-avatar, list-item-three-line, table-tbody"
          class="ma-3"
        />
        <ShipmentOverviewV2 v-else-if="store.shipment" />
      </div>
    </v-card>

    <!-- Sub-modales de edición (cliente, costi, dest, supplements…). Leen
       el mismo shipment.store; se teleportan a body y flotan sobre el modal. -->
    <ShipmentModals />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";
import { useDisplay } from "vuetify";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import { useRecordNavigator } from "@shipment/composables/useRecordNavigator";
import ShipmentOverviewV2 from "@shipment/components/shipment/overview/ShipmentOverviewV2.vue";
import ShipmentModals from "@shipment/components/shipment/modals/ShipmentModals.vue";

const props = defineProps<{
  modelValue: boolean;
  /** Id de la expedición a mostrar (viene de ?view en el listado). */
  viewId: number | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
}>();

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { width: viewportWidth } = useDisplay();

/**
 * Ancho del drawer: 70% del viewport como minimo operativo (peticion de Luca),
 * con tope de 1280px para que en pantallas muy anchas el contenido no quede
 * disperso, y pantalla completa por debajo de 900px.
 *
 * `v-navigation-drawer` espera un numero de pixeles: un valor en `vw` no lo
 * interpreta, por eso se calcula aqui en vez de en CSS.
 */
const drawerWidth = computed<number>(() => {
  const vw = viewportWidth.value;
  if (vw <= 900) return vw;
  return Math.min(Math.max(Math.round(vw * 0.7), 720), 1280);
});

const store = useShipmentStore();
const ui = useUiStore();
const { id: storeId } = storeToRefs(store);

// Navegador prev/next sobre la cohorte del listado, en modo overlay
// (push a ?view=). currentId = el id cargado en el store.
const currentId = computed<number | null>(() => storeId.value);
const navigator = useRecordNavigator(currentId, { overlay: true });

/** Carga la expedición cuando cambia viewId (apertura o prev/next). */
async function loadView(): Promise<void> {
  if (props.viewId == null) return;
  await store.load(props.viewId);
}

watch(
  () => props.viewId,
  (v) => {
    if (v != null) void loadView();
  },
);

// Carga la cohorte del navegador a partir del filtro del listado (route.query
// — `view` se ignora al parsear, así que es el mismo cache que el listado).
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void navigator.ensureLoaded(route.query);
      void loadView();
    } else {
      ui.closeModal(); // cierra cualquier sub-modal que quedara abierto
    }
  },
);

function close(): void {
  emit("update:modelValue", false);
}

/** Teclas ←/→ para navegar dentro del modal. */
function onKey(e: KeyboardEvent): void {
  if (!props.modelValue) return;
  const tgt = e.target as HTMLElement | null;
  if (tgt && (tgt.matches("input,textarea,select") || tgt.isContentEditable))
    return;
  if (e.key === "ArrowLeft" && navigator.hasPrev.value) {
    e.preventDefault();
    navigator.goPrev();
  } else if (e.key === "ArrowRight" && navigator.hasNext.value) {
    e.preventDefault();
    navigator.goNext();
  }
}

onMounted(() => {
  document.addEventListener("keydown", onKey);
  if (props.modelValue) {
    void navigator.ensureLoaded(route.query);
    void loadView();
  }
});
onBeforeUnmount(() => document.removeEventListener("keydown", onKey));

/** URL de la ficha dedicada, sin el `view` que mantiene abierto el drawer. */
const fullPageHref = computed(() => {
  const vid = props.viewId;
  if (!vid) return undefined;
  const q = { ...route.query };
  delete q.view;
  return router.resolve({
    name: "shipment-detail",
    params: { id: String(vid) },
    query: q,
  }).href;
});
</script>

<style scoped>
.sdo-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sdo-drawer {
  /* El ancho lo fija `drawerWidth` (70% del viewport, tope 1280px). Aqui solo
     se garantiza que nunca desborde en pantallas estrechas. */
  max-width: 100vw;
}
.sdo-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.sdo-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.08);
  background: rgb(var(--v-theme-surface));
  flex: 0 0 auto;
}
.sdo-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}
.sdo-pos {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  min-width: 56px;
  text-align: center;
  font-feature-settings: "tnum";
}
.sdo-title {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.sdo-loading {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.6;
  margin-left: 6px;
}
.sdo-body {
  flex: 1 1 auto;
  overflow: auto;
  min-height: 0;
  padding: 8px;
}
</style>
