<template>
  <div>
    <!-- Loading skeleton -->
    <template v-if="store.loading">
      <v-skeleton-loader
        type="card-avatar, list-item-three-line, table-tbody"
      />
    </template>

    <!-- Error -->
    <v-alert
      v-else-if="store.error"
      type="error"
      prominent
      class="ma-4"
      icon="mdi-alert-circle"
    >
      <div class="text-subtitle-2 mb-1">
        {{ t("shipment.detail.load_error") }}
      </div>
      <div class="text-body-2">{{ store.error }}</div>
      <template #append>
        <v-btn variant="text" color="error" @click="reload">{{
          t("common.retry")
        }}</v-btn>
      </template>
    </v-alert>

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

onMounted(load);
watch(() => route.params.id, load);
</script>
