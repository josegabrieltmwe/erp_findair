<template>
  <div class="svc-box">
    <!-- Servizio cliente -->
    <div class="svc-section">
      <div class="svc-section__header">
        <v-icon
          icon="mdi-account-outline"
          size="16"
          class="me-2 text-primary"
        />
        <span class="svc-section__title">{{
          t("shipment.service_box.client_service")
        }}</span>
        <v-chip
          v-if="currentClientServiceLabel !== '—'"
          size="x-small"
          variant="tonal"
          color="primary"
          class="ms-2"
        >
          {{ currentClientServiceLabel }}
        </v-chip>
      </div>
      <v-btn
        variant="tonal"
        color="primary"
        size="small"
        rounded="lg"
        prepend-icon="mdi-swap-horizontal"
        class="mt-2"
        :disabled="readonly('id_servizio')"
        @click="clienteModalOpen = true"
      >
        {{ t("shipment.service_box.change_client_service") }}
      </v-btn>
    </div>

    <!-- Fornitore / vettore -->
    <v-divider class="my-3" />
    <div class="svc-section">
      <div class="svc-section__header">
        <v-icon icon="mdi-truck-outline" size="16" class="me-2" />
        <span class="svc-section__title">{{
          t("shipment.service_box.supplier_carrier")
        }}</span>
        <v-chip
          v-if="currentFornitoreLabel !== '—'"
          size="x-small"
          variant="tonal"
          class="ms-2"
        >
          {{ currentFornitoreLabel }}
        </v-chip>
      </div>
      <v-btn
        variant="tonal"
        size="small"
        rounded="lg"
        prepend-icon="mdi-swap-horizontal"
        class="mt-2"
        :disabled="readonly('id_fornitore')"
        @click="fornitoreModalOpen = true"
      >
        {{ t("shipment.service_box.change_supplier") }}
      </v-btn>
    </div>

    <!-- AWB (read-only display + reset) -->
    <v-divider class="my-3" />
    <div class="svc-section">
      <div class="svc-section__header">
        <v-icon icon="mdi-barcode" size="16" class="me-2" />
        <span class="svc-section__title">{{
          t("shipment.service_box.awb_tracking")
        }}</span>
      </div>
      <div class="awb-display mt-2">
        <span
          class="awb-display__value"
          :class="{ 'awb-display__value--empty': !awbValue }"
        >
          {{ awbValue || t("shipment.service_box.to_assign") }}
        </span>
        <v-btn
          v-if="awbValue && !readonly('AWB_forn')"
          variant="text"
          size="x-small"
          icon="mdi-close-circle-outline"
          :title="t('shipment.service_box.reset_awb')"
          class="ms-2"
          @click="onResetAwb"
        />
      </div>
    </div>

    <!-- Enviar la expedición por email: a couriers (cotización) o a partners -->
    <v-divider class="my-3" />
    <div class="d-flex flex-wrap ga-2">
      <v-btn
        variant="tonal"
        color="info"
        size="small"
        rounded="lg"
        prepend-icon="mdi-email-arrow-right-outline"
        :disabled="!id"
        @click="rfqModalOpen = true"
      >
        {{ t("shipment.rfq.open_button") }}
      </v-btn>
      <v-btn
        variant="tonal"
        color="secondary"
        size="small"
        rounded="lg"
        prepend-icon="mdi-account-arrow-right-outline"
        :disabled="!id"
        @click="partnerModalOpen = true"
      >
        {{ t("shipment.partner_offer.open_button") }}
      </v-btn>
    </div>

    <!-- Sub-modals -->
    <ShipmentServiceClienteModal v-model:open="clienteModalOpen" />
    <ShipmentServiceFornitoreModal v-model:open="fornitoreModalOpen" />
    <ExpressRfqModal v-model="rfqModalOpen" :shipment-id="Number(id) || 0" />
    <PartnerOfferModal
      v-model="partnerModalOpen"
      :shipment-id="Number(id) || 0"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useToastStore } from "@shipment/stores/toast.store";
import { useServiceSelectionStore } from "@shipment/stores/service_selection.store";
import { stripHtml } from "@shipment/composables/useTextSanitize";
import ShipmentServiceClienteModal from "./service/ShipmentServiceClienteModal.vue";
import ShipmentServiceFornitoreModal from "./service/ShipmentServiceFornitoreModal.vue";
import ExpressRfqModal from "./ExpressRfqModal.vue";
import PartnerOfferModal from "./PartnerOfferModal.vue";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment, id } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);
const toasts = useToastStore();
const serviceSelectionStore = useServiceSelectionStore();

const clienteModalOpen = ref(false);
const fornitoreModalOpen = ref(false);
const rfqModalOpen = ref(false);
const partnerModalOpen = ref(false);

function get<T = string>(field: string): T | undefined {
  return (shipment.value as unknown as Record<string, T> | null)?.[field];
}

const awbValue = computed<string>(() => String(get("AWB_forn") ?? ""));

const currentClientServiceLabel = computed<string>(() => {
  const s = shipment.value;
  if (!s) return "—";
  const raw = get("servizio");
  if (raw) return stripHtml(raw);
  const svcObj = (s as Record<string, unknown>).service;
  if (
    svcObj &&
    typeof svcObj === "object" &&
    (svcObj as Record<string, string>).nome
  ) {
    return (svcObj as Record<string, string>).nome;
  }
  const sid = Number(s.id_servizio) || 0;
  if (!sid) return "—";
  const fromCache = serviceSelectionStore.clientServices.find(
    (x) => Number(x.service_id) === sid,
  );
  if (fromCache?.description) return fromCache.description;
  return t("shipment.service_box.service_n", { id: sid });
});

const currentFornitoreLabel = computed<string>(() => {
  const s = shipment.value;
  if (!s) return "—";
  const fornLabel = get("fornitore_descr");
  if (fornLabel) return fornLabel;
  const fid = Number(s.id_fornitore) || 0;
  if (fid) return t("shipment.service_box.supplier_n", { id: fid });
  return "—";
});

async function onResetAwb(): Promise<void> {
  await store.update({ AWB_forn: "" });
  toasts.push("success", t("shipment.service_box.toast_awb_reset"));
}
</script>

<style scoped>
.svc-box {
  padding: 4px 0;
}
.svc-section__header {
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.svc-section__title {
  white-space: nowrap;
}
.awb-display {
  display: flex;
  align-items: center;
}
.awb-display__value {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.3px;
  color: rgba(var(--v-theme-on-surface), 0.85);
}
.awb-display__value--empty {
  color: rgba(var(--v-theme-on-surface), 0.35);
  font-style: italic;
  font-weight: 400;
  font-family: inherit;
}
</style>
