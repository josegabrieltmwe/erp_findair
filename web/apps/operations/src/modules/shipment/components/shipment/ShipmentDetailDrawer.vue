<template>
  <!--
    Detalle de una expedición en un panel lateral (izquierdo o derecho), sin navegación entre registros.

    Es la versión genérica de ShipmentDetailOverlay (el del listado): REUTILIZA el mismo contenido
    (ShipmentOverviewV2 = las cards editables, y ShipmentModals = los sub-modales) sin montar la página completa.
    Lo usa la ficha de cargo para operar sus tramos de recogida (izquierda) y de entrega (derecha).

    Todos los paneles comparten el mismo shipment.store: solo uno puede estar abierto a la vez (quien los abre,
    cierra el otro). NO teleportar a <body>: v-navigation-drawer debe quedar dentro del v-app.
  -->
  <v-navigation-drawer
    :model-value="modelValue"
    :location="location"
    :width="drawerWidth"
    temporary
    class="sld-drawer"
    :data-testid="`shipment-drawer-${location}`"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <v-card class="sld-card" height="100%" rounded="0">
      <div class="sld-bar">
        <span class="sld-title">
          <v-icon :icon="icon" size="18" class="me-2" />
          {{ title }}
          <code v-if="shipmentId">#{{ shipmentId }}</code>
          <span v-if="store.loading" class="sld-loading">· {{ t("shipment.overlay.loading") }}</span>
        </span>
        <v-spacer />
        <v-btn
          v-if="fullPageHref"
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
          data-testid="shipment-drawer-close"
          @click="close"
        />
      </div>

      <div class="sld-body">
        <v-alert v-if="store.error" type="error" density="compact" class="ma-3">{{ store.error }}</v-alert>
        <v-skeleton-loader
          v-else-if="store.loading && !store.shipment"
          type="card-avatar, list-item-three-line, table-tbody"
          class="ma-3"
        />
        <ShipmentOverviewV2 v-else-if="store.shipment" />
      </div>
    </v-card>

    <ShipmentModals />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import ShipmentOverviewV2 from "@shipment/components/shipment/overview/ShipmentOverviewV2.vue";
import ShipmentModals from "@shipment/components/shipment/modals/ShipmentModals.vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** Expedición a mostrar. */
    shipmentId: number | null;
    location?: "left" | "right";
    title?: string;
    icon?: string;
  }>(),
  { location: "right", title: "", icon: "mdi-package-variant-closed" },
);
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const { t } = useI18n();
const router = useRouter();
const { width: viewportWidth } = useDisplay();
const store = useShipmentStore();
const ui = useUiStore();

/** Mitad del viewport (mín. 560, tope 960); pantalla completa por debajo de 900 px. */
const drawerWidth = computed<number>(() => {
  const vw = viewportWidth.value;
  if (vw <= 900) return vw;
  return Math.min(Math.max(Math.round(vw * 0.5), 560), 960);
});

async function loadShipment(): Promise<void> {
  if (props.shipmentId == null) return;
  if (store.id && Number(store.id) === props.shipmentId && store.shipment) return;
  await store.load(props.shipmentId);
}

watch(
  () => [props.modelValue, props.shipmentId] as const,
  ([open, id]) => {
    if (open && id != null) void loadShipment();
    if (!open) ui.closeModal(); // cierra cualquier sub-modal que quedara abierto
  },
);
onMounted(() => {
  if (props.modelValue) void loadShipment();
});

function close(): void {
  emit("update:modelValue", false);
}

const fullPageHref = computed(() =>
  props.shipmentId
    ? router.resolve({ name: "shipment-detail", params: { id: String(props.shipmentId) } }).href
    : undefined,
);
</script>

<style scoped>
.sld-card { display: flex; flex-direction: column; overflow: hidden; }
.sld-drawer { max-width: 100vw; }
.sld-bar {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px; flex: 0 0 auto;
  border-bottom: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.08);
  background: rgb(var(--v-theme-surface));
}
.sld-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; }
.sld-loading { font-size: 12px; font-weight: 400; opacity: 0.6; margin-left: 6px; }
.sld-body { flex: 1 1 auto; overflow: auto; min-height: 0; padding: 8px; }
</style>
