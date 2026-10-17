<template>
  <!-- embedded: the host ModalWrapper already provides the dialog card + title. -->
  <component
    :is="embedded ? 'div' : VCard"
    v-bind="embedded ? {} : { border: true, rounded: 'lg' }"
  >
    <v-card-title v-if="!embedded" class="d-flex align-center"
      ><v-icon icon="mdi-check-decagram-outline" class="me-2" />
      {{ t("shipment.modals.delivery.title") }}</v-card-title
    >
    <component :is="embedded ? 'div' : VCardText">
      <v-row dense>
        <v-col cols="12" md="4">
          <!-- consegna_stato es un FK int a tracking_pubblico.id (7=Delivered…),
               no texto libre. Autocomplete alimentado por el catálogo de estados
               (scope=all). Emite el id; onConsegnaCommit conserva la lógica de
               aviso de entrega. -->
          <v-autocomplete
            v-model="consegnaStato.local"
            :items="deliveryStateItems"
            :loading="deliveryStatesLoading"
            item-title="title"
            item-value="value"
            :label="t('shipment.modals.delivery.status')"
            clearable
            :readonly="readonly('consegna_stato')"
            @update:model-value="onConsegnaCommit(consegnaStato)"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="consegnaData.local"
            :label="t('shipment.modals.delivery.delivered')"
            @blur="onConsegnaCommit(consegnaData)"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="consegnaFirma.local"
            :label="t('shipment.modals.delivery.signature')"
            @blur="consegnaFirma.commit"
          />
        </v-col>
        <!-- Imagen de la firma escaneada de entrega (paridad legacy
             spedy_form.php:718 → firme_delivery/<id>_d.png). La carpeta cuelga
             de /erp (no de /erp/tmwe_json). Si el png no existe, @error oculta
             el bloque en vez de mostrar una imagen rota. -->
        <v-col
          v-if="signatureImageUrl && !signatureImageError"
          cols="12"
          md="4"
        >
          <div class="text-caption text-medium-emphasis mb-1">
            {{ t("shipment.modals.delivery.signature_image") }}
          </div>
          <a :href="signatureImageUrl" target="_blank" rel="noopener">
            <img
              :src="signatureImageUrl"
              :alt="t('shipment.modals.delivery.signature_image')"
              class="delivery-signature-img"
              @error="signatureImageError = true"
            />
          </a>
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="dataSped1.local"
            :label="t('shipment.modals.delivery.departure_date')"
            type="date"
            @blur="dataSped1.commit"
          />
        </v-col>
        <v-col cols="auto">
          <v-btn
            variant="text"
            prepend-icon="$package"
            :href="trackingUrl"
            target="_blank"
            >{{ t("shipment.modals.delivery.tracking") }}</v-btn
          >
        </v-col>
      </v-row>
    </component>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { VCard, VCardText } from "vuetify/components";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import {
  useFieldBinding,
  type FieldBinding,
} from "@shipment/composables/useFieldBinding";
import { notificationService } from "@shipment/services/notification.service";
import {
  deliveryStatusService,
  type DeliveryStatus,
} from "@shipment/services/delivery_status.service";

defineProps<{ embedded?: boolean }>();

const { t } = useI18n();
const store = useShipmentStore();
const toasts = useToastStore();
const { id, shipment } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);

const consegnaStato = useFieldBinding("consegna_stato", "");

// Catálogo de estados de entrega (tracking_pubblico) para el autocomplete.
const deliveryStates = ref<DeliveryStatus[]>([]);
const deliveryStatesLoading = ref(false);
onMounted(async () => {
  deliveryStatesLoading.value = true;
  try {
    deliveryStates.value = await deliveryStatusService.list();
  } finally {
    deliveryStatesLoading.value = false;
  }
});
// El valor de consegna_stato llega como string desde la BD; mapeamos el id a
// string para que el autocomplete case el valor y muestre la descripción (no el
// id crudo). value:'' representa "sin estado".
const deliveryStateItems = computed(() =>
  deliveryStates.value.map((s) => ({
    value: String(s.id),
    title: s.description,
  })),
);
const consegnaData = useFieldBinding("consegna_data", "");
const consegnaFirma = useFieldBinding("consegna_firma", "");
const dataSped1 = useFieldBinding("data_sped1", "");

// Tracking record id for "consegnata" (legacy `dlv=7`).
const DELIVERED_STATO = "7";

/**
 * Commit a delivery field, then — mirroring legacy Consegnato() — when the
 * shipment is marked delivered (consegna_stato=7 + a delivery date) offer to
 * email the delivery notice to the sender (spedy_delivered_mail / TRKc). The
 * send is gated by an explicit confirm() like the legacy form, never automatic.
 */
async function onConsegnaCommit(field: FieldBinding<string>): Promise<void> {
  await field.commit();
  const isDelivered = String(consegnaStato.local) === DELIVERED_STATO;
  const hasDate = String(consegnaData.local).trim() !== "";
  if (!id.value || !isDelivered || !hasDate) return;
  if (!window.confirm(t("shipment.modals.delivery.confirm_notify"))) return;
  const r = await notificationService.delivered(Number(id.value));
  toasts.push(
    r.success ? "success" : "error",
    r.message ?? r.error ?? t("shipment.modals.delivery.notice"),
  );
}

const trackingUrl = computed(() =>
  id.value ? `/erp/tmwe_json/get-tracking-list?id=${id.value}` : "#",
);

// Imagen de firma de entrega. Cuelga de la raíz /erp (el basePath de la SPA es
// /erp/tmwe_json → recortamos el sufijo). @error marca signatureImageError y el
// bloque se oculta cuando el archivo no existe.
const signatureImageError = ref(false);
const signatureImageUrl = computed<string>(() => {
  if (!id.value) return "";
  const base =
    (typeof window !== "undefined" && window.__TMWE_SHIPMENT__?.basePath) ||
    "/bff/v1";
  const erpRoot = base.replace(/\/tmwe_json\/?$/, "") || "/erp";
  return `${erpRoot}/firme_delivery/${id.value}_d.png`;
});
</script>

<style scoped>
.delivery-signature-img {
  max-width: 100%;
  max-height: 90px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 6px;
  background: #fff;
  display: block;
}
</style>
