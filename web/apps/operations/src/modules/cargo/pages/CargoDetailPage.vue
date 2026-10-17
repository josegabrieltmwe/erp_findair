<template>
  <div>
    <!-- Loading skeleton -->
    <template v-if="store.loading">
      <v-skeleton-loader
        type="card-avatar, list-item-three-line, table-tbody"
      />
    </template>

    <!-- Not found / deleted (stato='O') / no access — permanent, no retry -->
    <v-alert
      v-else-if="store.error && isPermanentLoadError"
      type="warning"
      prominent
      class="ma-4"
      icon="mdi-file-remove-outline"
    >
      <div class="text-subtitle-2 mb-1">
        {{ t("cargo.page.not_found") }}
      </div>
      <div class="text-body-2">
        {{ t("cargo.page.not_found_text", { id: routeId }) }}
      </div>
    </v-alert>

    <!-- Transient load error — offer retry -->
    <v-alert
      v-else-if="store.error"
      type="error"
      prominent
      class="ma-4"
      icon="mdi-alert-circle"
    >
      <div class="text-subtitle-2 mb-1">{{ t("cargo.page.load_error") }}</div>
      <div class="text-body-2">{{ store.error }}</div>
      <template #append>
        <v-btn variant="text" color="error" @click="reload">{{
          t("common.retry")
        }}</v-btn>
      </template>
    </v-alert>

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

      <!-- Off-canvas drawers -->
      <CargoDocumentsDrawer />
      <CargoChatDrawer ref="chatDrawerRef" />
      <CargoAuditDrawer />

      <!-- Barra de navegación entre registros (prev/next + contador + atajos),
           unificada con shipment_express. Sólo se muestra si se llegó desde un
           listado filtrado. -->
      <RecordNavigator />

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
          href="/erp/"
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

import CargoDetailLayoutV2 from "@cargo/layouts/CargoDetailLayoutV2.vue";
import CargoOverviewV2 from "@cargo/components/cargo/overview/CargoOverviewV2.vue";
// Flight legs, MAWB, HAWB list and consolidation are no longer embedded as a
// page tab — they are edited from the overview via modals (FlightsModal,
// MawbModal, HawbListModal, ConsolidationModal).
import CargoDocumentsDrawer from "@cargo/components/cargo/drawers/CargoDocumentsDrawer.vue";
import CargoChatDrawer from "@cargo/components/cargo/drawers/CargoChatDrawer.vue";
import CargoAuditDrawer from "@cargo/components/cargo/audit/CargoAuditDrawer.vue";
import CargoModals from "@cargo/components/cargo/modals/CargoModals.vue";
import PdfLoadingOverlay from "@cargo/components/cargo/PdfLoadingOverlay.vue";
import RecordNavigator from "@cargo/components/shell/RecordNavigator.vue";

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

// Permanent load failures — cargo missing, soft-deleted (stato='O'), or no
// access. All map to a "cannot open this cargo" state where a retry is
// pointless. Everything else (network blip, 5xx) keeps the retry button.
// The shared http client collapses every 403 to errorCode 'FORBIDDEN'
// (it does not forward the backend's SHIPMENT_ACCESS_DENIED), so match
// that too — a 403 on a cargo detail is always permanent.
const PERMANENT_ERROR_CODES = new Set([
  "NOT_FOUND",
  "FORBIDDEN",
  "SHIPMENT_ACCESS_DENIED",
]);
const isPermanentLoadError = computed(
  () => store.errorCode != null && PERMANENT_ERROR_CODES.has(store.errorCode),
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
