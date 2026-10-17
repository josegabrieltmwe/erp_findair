<template>
  <div>
    <!-- Loading state -->
    <template v-if="store.loading">
      <v-row dense>
        <v-col cols="12">
          <v-skeleton-loader
            type="card-avatar, list-item-three-line, table-tbody"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-skeleton-loader type="article" />
        </v-col>
        <v-col cols="12" md="6">
          <v-skeleton-loader type="article" />
        </v-col>
      </v-row>
    </template>

    <!-- Error state -->
    <v-alert
      v-else-if="store.error"
      type="error"
      prominent
      class="mb-4"
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

    <!-- Loaded -->
    <template v-else-if="store.shipment">
      <ShipmentHeader class="mb-3" />

      <!-- Readonly banner. Mirrors the legacy spedy_form.php block at
           line 295-315 ("giafatt"): when the shipment carries both an
           emitted client invoice (id_fattura_a > 0) and an assigned
           supplier waybill (AWB_forn != ''), ~30 editable fields are
           locked. We surface that explicitly so operators know WHY
           the inputs are read-only. -->
      <v-alert
        v-if="isFullyLocked"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-3"
        prepend-icon="mdi-lock-outline"
      >
        <span class="font-weight-medium">{{
          t("shipment.detail.readonly_title")
        }}</span>
        {{ t("shipment.detail.readonly_body") }}
        (<code>{{ store.shipment.id_fattura_a }}</code
        >)
        <code>{{ store.shipment.AWB_forn }}</code>
      </v-alert>

      <v-card border flat class="mb-3" rounded="lg">
        <v-tabs
          v-model="tab"
          color="primary"
          align-tabs="start"
          slider-color="primary"
          density="comfortable"
          show-arrows
        >
          <v-tab value="overview" prepend-icon="mdi-view-dashboard-outline">{{
            t("shipment.detail.tab_overview")
          }}</v-tab>
          <v-tab
            value="addresses"
            prepend-icon="mdi-map-marker-multiple-outline"
            >{{ t("shipment.detail.tab_addresses") }}</v-tab
          >
          <v-tab value="packages" prepend-icon="mdi-package-variant-closed">{{
            t("shipment.detail.tab_packages")
          }}</v-tab>
          <v-tab value="service" prepend-icon="mdi-truck-fast-outline">{{
            t("shipment.detail.tab_service")
          }}</v-tab>
          <v-tab
            value="documents"
            prepend-icon="mdi-file-document-multiple-outline"
            >{{ t("shipment.detail.tab_documents") }}</v-tab
          >
          <v-tab value="activity" prepend-icon="mdi-clock-outline">{{
            t("shipment.detail.tab_activity")
          }}</v-tab>
        </v-tabs>
      </v-card>

      <v-tabs-window v-model="tab">
        <!-- OVERVIEW -->
        <v-tabs-window-item value="overview">
          <ShipmentOverviewTab @navigate="tab = $event" />
        </v-tabs-window-item>

        <!-- ADDRESSES -->
        <v-tabs-window-item value="addresses">
          <div class="d-flex flex-column" style="gap: 12px">
            <ShipmentClientHeader />
            <ShipmentAddressBlock
              tipo="D"
              :title="t('shipment.detail.addr_destination')"
            />
            <ShipmentAddressBlock
              tipo="P"
              :title="t('shipment.detail.addr_pickup')"
            />
            <ShipmentPickupSchedule />
          </div>
        </v-tabs-window-item>

        <!-- PACKAGES -->
        <v-tabs-window-item value="packages">
          <div class="d-flex flex-column" style="gap: 12px">
            <ShipmentPackagesBox />
            <ShipmentColliList />
            <ShipmentExtraWeightsBox />
            <v-expansion-panels variant="accordion" multiple>
              <v-expansion-panel
                :title="t('shipment.detail.panel_insurance')"
                value="ins"
              >
                <template #title>
                  <v-icon icon="mdi-shield-check-outline" class="me-2" />
                  {{ t("shipment.detail.panel_insurance") }}
                </template>
                <template #text><ShipmentInsuranceBox embedded /></template>
              </v-expansion-panel>
              <v-expansion-panel
                :title="t('shipment.detail.panel_cod')"
                value="cod"
              >
                <template #title>
                  <v-icon icon="mdi-cash" class="me-2" />
                  {{ t("shipment.detail.panel_cod") }}
                </template>
                <template #text><ShipmentContrassegnoBox embedded /></template>
              </v-expansion-panel>
              <v-expansion-panel
                :title="t('shipment.detail.panel_customs')"
                value="cust"
              >
                <template #title>
                  <v-icon icon="mdi-passport" class="me-2" />
                  {{ t("shipment.detail.panel_customs") }}
                </template>
                <template #text><ShipmentCustomsBox embedded /></template>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </v-tabs-window-item>

        <!-- SERVICE & PRICING -->
        <v-tabs-window-item value="service">
          <div class="d-flex flex-column" style="gap: 12px">
            <ShipmentServiceFornitoreBox />
            <ShipmentAmountsBox />
            <ShipmentSupplementsBox />
            <ShipmentPostInvoiceBox />
            <ShipmentCheckfornBox
              @open-subcontracting="subcontractingOpen = true"
            />
          </div>
        </v-tabs-window-item>

        <!-- DOCUMENTS -->
        <v-tabs-window-item value="documents">
          <div class="d-flex flex-column" style="gap: 12px">
            <ShipmentFilesBox />
            <ShipmentNotesBox />
          </div>
        </v-tabs-window-item>

        <!-- ACTIVITY -->
        <v-tabs-window-item value="activity">
          <div class="d-flex flex-column" style="gap: 12px">
            <ShipmentTimelineCard />
            <ShipmentDeliveryBox />
            <ShipmentDatesBox />
            <ShipmentFlagsBox />
          </div>
        </v-tabs-window-item>
      </v-tabs-window>

      <!-- Dialogs (triggered by action bar or buttons) -->
      <ShipmentChatDialog v-model="chatOpen" :shipment-id="store.id" />
      <ShipmentProformaDialog v-model="proformaOpen" :shipment-id="store.id" />
      <ShipmentLdvDialog v-model="ldvOpen" :shipment-id="store.id" />
      <ShipmentSubcontractingDialog
        v-model="subcontractingOpen"
        :shipment-id="store.id"
      />
    </template>

    <EmptyState
      v-else
      :title="t('shipment.not_found')"
      :text="t('shipment.detail.not_found_text', { id: routeId })"
      icon="mdi-package-variant-closed-remove"
    >
      <template #actions>
        <v-btn
          variant="flat"
          color="primary"
          prepend-icon="mdi-magnify"
          href="/erp/"
        >
          {{ t("shipment.detail.go_back_search") }}
        </v-btn>
      </template>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { ldvService } from "@shipment/services/ldv.service";
import { shipmentService } from "@shipment/services/shipment.service";
import type { ShipmentTab } from "@shipment/services/shipment.types";
import { useToastStore } from "@shipment/stores/toast.store";
import { eventBus } from "@shipment/composables/useEventBus";

import ShipmentHeader from "@shipment/components/shipment/ShipmentHeader.vue";
import ShipmentOverviewTab from "@shipment/components/shipment/ShipmentOverviewTab.vue";
import ShipmentTimelineCard from "@shipment/components/shipment/ShipmentTimelineCard.vue";
import ShipmentClientHeader from "@shipment/components/shipment/ShipmentClientHeader.vue";
import ShipmentAddressBlock from "@shipment/components/shipment/ShipmentAddressBlock.vue";
import ShipmentPickupSchedule from "@shipment/components/shipment/ShipmentPickupSchedule.vue";
import ShipmentPackagesBox from "@shipment/components/shipment/ShipmentPackagesBox.vue";
import ShipmentColliList from "@shipment/components/shipment/ShipmentColliList.vue";
import ShipmentContrassegnoBox from "@shipment/components/shipment/ShipmentContrassegnoBox.vue";
import ShipmentInsuranceBox from "@shipment/components/shipment/ShipmentInsuranceBox.vue";
import ShipmentExtraWeightsBox from "@shipment/components/shipment/ShipmentExtraWeightsBox.vue";
import ShipmentCustomsBox from "@shipment/components/shipment/ShipmentCustomsBox.vue";
import ShipmentSupplementsBox from "@shipment/components/shipment/ShipmentSupplementsBox.vue";
import ShipmentFilesBox from "@shipment/components/shipment/ShipmentFilesBox.vue";
import ShipmentNotesBox from "@shipment/components/shipment/ShipmentNotesBox.vue";
import ShipmentServiceFornitoreBox from "@shipment/components/shipment/ShipmentServiceFornitoreBox.vue";
import ShipmentDeliveryBox from "@shipment/components/shipment/ShipmentDeliveryBox.vue";
import ShipmentDatesBox from "@shipment/components/shipment/ShipmentDatesBox.vue";
import ShipmentAmountsBox from "@shipment/components/shipment/ShipmentAmountsBox.vue";
import ShipmentPostInvoiceBox from "@shipment/components/shipment/ShipmentPostInvoiceBox.vue";
import ShipmentCheckfornBox from "@shipment/components/shipment/ShipmentCheckfornBox.vue";
import ShipmentFlagsBox from "@shipment/components/shipment/ShipmentFlagsBox.vue";
import ShipmentChatDialog from "@shipment/components/shipment/ShipmentChatDialog.vue";
import ShipmentProformaDialog from "@shipment/components/shipment/ShipmentProformaDialog.vue";
import ShipmentLdvDialog from "@shipment/components/shipment/ShipmentLdvDialog.vue";
import ShipmentSubcontractingDialog from "@shipment/components/shipment/ShipmentSubcontractingDialog.vue";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { storeToRefs } from "pinia";

const { t } = useI18n();
const route = useRoute();
const store = useShipmentStore();
const toasts = useToastStore();

// Expose the legacy `giafatt` guard to the template so the operator
// sees a banner explaining why most fields are locked when the
// shipment has already been invoiced + got its supplier AWB.
//
// We destructure the computed refs out of the composable rather than
// using the wrapper object directly, because v-if doesn't auto-unwrap
// nested refs on plain return objects — referencing `wrapper.giafatt`
// in the template yields the ComputedRef object itself (truthy) and
// the banner fires every time. The bare ref name is unwrapped by Vue.
const { shipment: shipmentRef } = storeToRefs(store);
const { giafatt: isFullyLocked } = useShipmentState(
  shipmentRef as unknown as import("vue").ComputedRef<
    import("@shipment/services/shipment.types").Shipment | null
  >,
);

const tab = ref<ShipmentTab>("overview");
const chatOpen = ref(false);
const proformaOpen = ref(false);
const ldvOpen = ref(false);
const subcontractingOpen = ref(false);

const routeId = computed(() =>
  Number(route.params.id ?? window.__TMWE_SHIPMENT__?.shipmentId ?? 0),
);

async function load(): Promise<void> {
  if (!routeId.value) return;
  await store.load(routeId.value);
}

async function reload(): Promise<void> {
  store.error = null;
  await load();
}

onMounted(load);
watch(() => route.params.id, load);

// Wire the sticky action bar to local dialogs.
const offChat = eventBus.on("openChat", () => (chatOpen.value = true));
const offProforma = eventBus.on(
  "openProforma",
  () => (proformaOpen.value = true),
);
const offLdv = eventBus.on("openLdv", () => (ldvOpen.value = true));
const offSub = eventBus.on(
  "openSubcontracting",
  () => (subcontractingOpen.value = true),
);
const offCancel = eventBus.on("cancelShipment", async () => {
  if (!store.id) return;
  if (!confirm(t("shipment.detail.confirm_cancel"))) return;
  const r = await shipmentService.cancel(store.id);
  if (r.success) {
    toasts.push("success", t("shipment.detail.toast_cancelled"));
    await store.load(store.id);
  } else {
    toasts.push("error", r.error ?? t("shipment.detail.toast_cancel_failed"));
  }
});
const offEmail = eventBus.on("emailMittente", async () => {
  if (!store.id) return;
  const r = await ldvService.sendToMittente(store.id);
  if (r.success)
    toasts.push(
      "success",
      t("shipment.detail.toast_ldv_emailed", { to: r.sent_to }),
    );
  else toasts.push("error", r.error ?? t("shipment.detail.toast_send_failed"));
});

onUnmounted(() => {
  offChat();
  offProforma();
  offLdv();
  offSub();
  offCancel();
  offEmail();
});
</script>
