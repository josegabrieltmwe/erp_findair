<template>
  <div>
    <!-- Carga y error dentro del mismo shell que el detalle: la ruta es
         fullscreen y un aviso suelto dejaba la página sin navegación. -->
    <DetailLoadState
      v-if="store.loading || (store.error && !store.cargo)"
      :loading="store.loading"
      :heading="`#${routeId || ''}`"
      :title="loadErrorTitle"
      :message="loadErrorMessage"
      :detail="loadErrorDetail"
      :permanent="isPermanentLoadError"
      :retry-label="t('common.retry')"
      :back-label="t('platform.records.back_to_list')"
      :back-to="{ name: 'cargo-list' }"
      @retry="reload"
    />

    <!-- Loaded — V2 layout -->
    <template v-else-if="store.cargo">
      <CargoDetailLayoutV2>
        <template #default>
          <!-- Single overview. Everything — flight legs, MAWB, HAWB list,
               consolidation — is managed here via modals (opened from the
               cards), so there is no separate page tab. Matches the legacy
               single-view workflow. -->
          <CargoOverviewV2 />
        </template>
      </CargoDetailLayoutV2>

      <!-- Panel lateral del chat (documentos, auditoría y CRM son modales) -->
      <CargoChatDrawer ref="chatDrawerRef" />

      <!-- Barra de navegación entre registros (prev/next + contador + atajos),
           unificada con shipment_express. Sólo se muestra si se llegó desde un
           listado filtrado. -->
      <RecordNavigator />

      <!-- Tramos del cargo en paneles laterales: recogida (izquierda) y entrega (derecha). -->
      <CargoLegPanels />

      <!-- Modal stack -->
      <CargoModals />

      <!--
        Global PDF loading overlay — Teleports to <body> and is driven
        by `pdf_loading.store`. Any service that initiates a PDF
        generation request flips the store flag, the overlay paints,
        the request completes, the flag clears and the overlay fades.
        Mounted once here (page-level) so it covers the entire cargo
        detail experience: topbar menu, AzioniCard grid, future buttons.
      -->
      <PdfLoadingOverlay />
    </template>

    <!-- Not found -->
    <EmptyState
      v-else
      :title="t('cargo.page.not_found')"
      :text="t('cargo.page.not_found_text', { id: routeId })"
      icon="mdi-airplane-off"
    >
      <template #actions>
        <v-btn
          variant="flat"
          color="primary"
          prepend-icon="mdi-magnify"
          href="/cargo/list"
        >
          {{ t("cargo.page.back_to_search") }}
        </v-btn>
      </template>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import EmptyState from "@shared/ui/EmptyState.vue";
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useChatRealtime } from "@cargo/composables/useChatRealtime";
import { usePricingRecalc } from "@cargo/composables/usePricingRecalc";

import DetailLoadState from "@shared/detail/DetailLoadState.vue";
import {
  classifyDetailLoadError,
  isPermanentDetailLoadError,
} from "@shared/detail/detailLoadError";
import CargoDetailLayoutV2 from "@cargo/layouts/CargoDetailLayoutV2.vue";
import CargoOverviewV2 from "@cargo/components/cargo/overview/CargoOverviewV2.vue";
// Flight legs, MAWB, HAWB list and consolidation are no longer embedded as a
// page tab — they are edited from the overview via modals (FlightsModal,
// MawbModal, HawbListModal, ConsolidationModal).
import CargoChatDrawer from "@cargo/components/cargo/drawers/CargoChatDrawer.vue";
import CargoModals from "@cargo/components/cargo/modals/CargoModals.vue";
import PdfLoadingOverlay from "@cargo/components/cargo/PdfLoadingOverlay.vue";
import RecordNavigator from "@cargo/components/shell/RecordNavigator.vue";
import CargoLegPanels from "@cargo/components/cargo/legs/CargoLegPanels.vue";

const { t } = useI18n();
const route = useRoute();
const store = useCargoStore();

// Auto-recalc cargo pricing when peso/flight/currency fields change.
// Skip rules live inside the composable (ricalcola_volo='N' or both
// price-lock columns set).
usePricingRecalc();

/**
 * Drawer ref so the realtime SSE composable can push live messages
 * into the open chat drawer without dispatching a global re-fetch.
 */
const chatDrawerRef = ref<{ appendLiveMessage: () => Promise<void> } | null>(
  null,
);
const currentCargoId = computed<number | null>(() => {
  if (!store.id) return null;
  const n = Number(store.id);
  return Number.isFinite(n) ? n : null;
});

/**
 * Mount the single EventSource at the page level — survives cargo
 * navigation via vue-router. The same /web_chat_realtime_stream endpoint
 * is anagrafica-scoped (not entity-scoped), so the same stream serves
 * both shipment_express and cargo_express.
 */
useChatRealtime({
  currentShipmentId: currentCargoId,
  onMessage: () => {
    void chatDrawerRef.value?.appendLiveMessage();
  },
});

const routeId = computed(() =>
  Number(route.params.id ?? window.__TMWE_CARGO__?.cargoId ?? 0),
);

// Fallos permanentes — el cargo no existe, está borrado (stato='O') o no hay
// acceso: reintentar no sirve. El resto (red, 5xx) mantiene «Reintentar».
// El cliente http común colapsa todo 403 en FORBIDDEN; el backend puede mandar
// además ACCESS_DENIED / SHIPMENT_ACCESS_DENIED (ver detailLoadError.ts).
// El texto sale del CÓDIGO, no del mensaje del backend (que llega en italiano).
const loadErrorKind = computed(() => classifyDetailLoadError(store.errorCode));
const isPermanentLoadError = computed(() =>
  isPermanentDetailLoadError(loadErrorKind.value),
);
const loadErrorTitle = computed(() => {
  switch (loadErrorKind.value) {
    case "access_denied":
      return t("cargo.page.access_denied");
    case "not_found":
      return t("cargo.page.not_found");
    default:
      return t("cargo.page.load_error");
  }
});
const loadErrorMessage = computed(() => {
  switch (loadErrorKind.value) {
    case "access_denied":
      return t("cargo.page.access_denied_text", { id: routeId.value });
    case "not_found":
      return t("cargo.page.not_found_text", { id: routeId.value });
    default:
      return t("cargo.page.load_error_text");
  }
});
/** El mensaje crudo solo como detalle técnico de un fallo transitorio. */
const loadErrorDetail = computed(() =>
  isPermanentLoadError.value ? "" : String(store.error ?? ""),
);

async function load(): Promise<void> {
  if (!routeId.value) return;
  await store.load(routeId.value);
  // Flight manager (rate + booking) hydrates on its own when its
  // CargoFlightManagerCard mounts inside CargoVoliCard. No page-level
  // hydrate needed; the badge in the topbar reads from the same store.
}

async function reload(): Promise<void> {
  store.error = null;
  await load();
}

onMounted(load);
watch(() => route.params.id, load);
</script>

<style scoped lang="scss">
.cols-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}
</style>
