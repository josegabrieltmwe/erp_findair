<template>
  <div>
    <!-- Carga y error dentro del mismo shell que el detalle: la ruta es
         fullscreen y un aviso suelto dejaba la página sin navegación. -->
    <DetailLoadState
      v-if="store.loading || (store.error && !store.shipment)"
      :loading="store.loading"
      :heading="routeIdLabel"
      :title="loadErrorTitle"
      :message="loadErrorMessage"
      :detail="loadErrorDetail"
      :permanent="loadErrorPermanent"
      :retry-label="t('common.retry')"
      :back-label="t('platform.records.back_to_list')"
      :back-to="{ name: 'shipment-list' }"
      @retry="reload"
    />

    <!-- Loaded — v2 layout -->
    <template v-else-if="store.shipment">
      <ShipmentDetailLayoutV2>
        <template #default="{ tab }">
          <!-- The legacy `addresses` tab was removed; the IndirizziCard
               in the overview carries an inline expand toggle that
               renders the full address blocks in place. -->
          <ShipmentOverviewV2 v-if="tab === 'overview'" />
        </template>
      </ShipmentDetailLayoutV2>

      <!--
        Off-canvas drawers stay as Teleport overlays (Documents, Chat).
        The old `ShipmentSidebar` drawer was promoted into the DetailShell
        sidebar (persistent rail/expanded) so it no longer needs to live
        here. `RecordNavigator` floating bar is also gone — the rail
        sidebar now surfaces the same record list and the arrow-key
        shortcuts still work via useRecordNavigator at this page level.
      -->
      <DocumentsDrawer />
      <ChatDrawer ref="chatDrawerRef" />
      <ShipmentAuditDrawer />
      <ShipmentTrackingDrawer />
      <RecordNavigator />

      <!-- Modal stack -->
      <ShipmentModals />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import { useUiStore, type ModalName } from "@shipment/stores/ui.store";
import { useChatRealtime } from "@shipment/composables/useChatRealtime";
import { usePricingRecalc } from "@shipment/composables/usePricingRecalc";

import ShipmentDetailLayoutV2 from "@shipment/layouts/ShipmentDetailLayoutV2.vue";
import DetailLoadState from "@shared/detail/DetailLoadState.vue";
import {
  classifyDetailLoadError,
  isPermanentDetailLoadError,
} from "@shared/detail/detailLoadError";
import ShipmentOverviewV2 from "@shipment/components/shipment/overview/ShipmentOverviewV2.vue";
// `ShipmentSidebar` (off-canvas records drawer) was inlined into
// ShipmentDetailLayoutV2 as a persistent DetailShell sidebar — the
// component file remains in /drawers/ for now in case other pages
// reference it, but it is no longer mounted here.
import DocumentsDrawer from "@shipment/components/shipment/drawers/DocumentsDrawer.vue";
import ChatDrawer from "@shipment/components/shipment/drawers/ChatDrawer.vue";
import ShipmentAuditDrawer from "@shipment/components/shipment/audit/ShipmentAuditDrawer.vue";
import ShipmentTrackingDrawer from "@shipment/components/shipment/tracking/ShipmentTrackingDrawer.vue";
import RecordNavigator from "@shipment/components/shell/RecordNavigator.vue";
import ShipmentModals from "@shipment/components/shipment/modals/ShipmentModals.vue";

const { t } = useI18n();

const route = useRoute();
const store = useShipmentStore();
const toasts = useToastStore();
const ui = useUiStore();

/**
 * Drawer ref so the realtime composable can push live messages into
 * the open drawer without dispatching a global re-fetch. The ref
 * resolves to whatever `defineExpose()` declared inside ChatDrawer.vue.
 */
const chatDrawerRef = ref<{ appendLiveMessage: () => Promise<void> } | null>(
  null,
);
const currentShipmentId = computed<number | null>(() => store.id);

/**
 * Mount the single EventSource at the page level — survives shipment
 * navigation via vue-router because the page itself is kept-alive in
 * the v2 layout. Failures inside the composable are handled
 * internally; this call always succeeds.
 */
useChatRealtime({
  currentShipmentId,
  onMessage: () => {
    void chatDrawerRef.value?.appendLiveMessage();
  },
});

/**
 * Reactive pricing recalc — watches peso/colli/service/route fields and
 * re-fetches the shipment after the backend daemon has updated carico /
 * costo_previsto. Honours `carico_lk + costo_previsto_lk` (skip both-locked).
 * See `composables/usePricingRecalc.ts` for the full rule set.
 */
usePricingRecalc();

async function load(): Promise<void> {
  const id = Number(route.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    toasts.push("error", "Invalid shipment id");
    return;
  }
  await store.load(id);

  // Auto-abrir un modal vía ?modal=… (deep-link desde el listado de
  // postfacturación: el botón "Addebita" navega aquí con ?modal=riaddebito).
  const m = route.query.modal;
  if (typeof m === "string" && m !== "") {
    ui.openModal(m as Exclude<ModalName, null>);
  }
}

async function reload(): Promise<void> {
  await load();
}

/**
 * Texto del fallo de carga, por CÓDIGO y no por el mensaje del backend (que
 * llega en italiano). Sin acceso / no existe son permanentes: sin «Reintentar».
 */
const loadErrorKind = computed(() => classifyDetailLoadError(store.errorCode));
const loadErrorPermanent = computed(() =>
  isPermanentDetailLoadError(loadErrorKind.value),
);
const loadErrorTitle = computed(() => {
  switch (loadErrorKind.value) {
    case "access_denied":
      return t("shipment.detail.access_denied");
    case "not_found":
      return t("shipment.detail.not_found");
    default:
      return t("shipment.detail.load_error");
  }
});
const loadErrorMessage = computed(() => {
  switch (loadErrorKind.value) {
    case "access_denied":
      return t("shipment.detail.access_denied_text", { id: route.params.id });
    case "not_found":
      return t("shipment.detail.not_found_text", { id: route.params.id });
    default:
      return t("shipment.detail.load_error_text");
  }
});
/** El mensaje crudo solo como detalle técnico de un fallo transitorio. */
const loadErrorDetail = computed(() =>
  loadErrorPermanent.value ? "" : String(store.error ?? ""),
);
const routeIdLabel = computed(() => `#${String(route.params.id ?? "")}`);

onMounted(load);
watch(() => route.params.id, load);
</script>
