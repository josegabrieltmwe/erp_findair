<template>
  <div class="card-collap">
    <details>
      <summary>
        <v-icon icon="mdi-note-text-outline" size="14" />
        <span class="cardh-title-collap">{{
          t("shipment.cards.verifiche.title")
        }}</span>
        <span class="vmini">
          <span
            class="vdot"
            :class="supplierCheckClass"
            :title="supplierCheckTitle"
          >
            <v-icon icon="mdi-truck-outline" size="12" />
          </span>
          <span class="vdot" :class="verifiedClass" :title="verifiedTitle">
            <v-icon icon="mdi-check-circle-outline" size="12" />
          </span>
        </span>
        <v-icon icon="mdi-chevron-right" size="14" class="chev" />
      </summary>
      <div class="vbody">
        <InfoRow
          icon="mdi-truck-outline"
          :title="t('shipment.cards.verifiche.supplier_check')"
          :subtitle="checkfornDesc"
          :value="supplierCheckLabel"
        />
        <InfoRow
          icon="mdi-check-circle-outline"
          :title="t('shipment.cards.verifiche.verified_offer')"
          :value="controllataLabel"
        />
        <!-- Notes moved to the dedicated, always-visible NoteCard. -->
        <div class="d-flex flex-wrap ga-2 mt-2">
          <v-btn
            size="x-small"
            variant="tonal"
            prepend-icon="mdi-account-multiple-outline"
            @click="ui.openModal('partners')"
          >
            {{ t("shipment.cards.verifiche.partner_visibility") }}
          </v-btn>
          <!-- Flags de gestión (archiviata / esente IVA art.9 / costo por
               verificar / aree remote / fuori misura). Paridad legacy
               spedy_form.php flags inferiores. -->
          <v-btn
            size="x-small"
            variant="tonal"
            prepend-icon="mdi-flag-outline"
            @click="ui.openModal('flags')"
          >
            {{ t("shipment.cards.verifiche.flags") }}
          </v-btn>
          <!-- Control factura proveedor + subcontratación (checkforn). Antes el
               box y su dialog vivían solo en la vista legacy V1. -->
          <v-btn
            size="x-small"
            variant="tonal"
            prepend-icon="mdi-truck-check-outline"
            @click="ui.openModal('checkforn')"
          >
            {{ t("shipment.cards.verifiche.supplier_check") }}
          </v-btn>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import InfoRow from "@shipment/components/shell/InfoRow.vue";

const { t } = useI18n();
const store = useShipmentStore();
const ui = useUiStore();
const { shipment } = storeToRefs(store);

function get(field: string): string {
  return String(
    (shipment.value as unknown as Record<string, unknown> | null)?.[field] ??
      "",
  );
}

const checkforn = computed(() => get("checkforn"));
const checkfornOk = computed(() => checkforn.value === "OK");
const supplierCheckLabel = computed(
  () => checkforn.value || t("shipment.cards.verifiche.not_verified"),
);
const supplierCheckTitle = computed(() =>
  checkfornOk.value
    ? t("shipment.cards.verifiche.supplier_check_ok")
    : t("shipment.cards.verifiche.supplier_check_other", {
        label: supplierCheckLabel.value,
      }),
);
const checkfornDesc = computed(() =>
  checkfornOk.value
    ? t("shipment.cards.verifiche.checkforn_ok_desc")
    : t("shipment.cards.verifiche.checkforn_ko_desc"),
);
const supplierCheckClass = computed(() => (checkfornOk.value ? "on" : ""));

const controllata = computed(() => get("controllata"));
const controllataLabel = computed(() => {
  switch (controllata.value) {
    case "S":
      return t("shipment.cards.verifiche.checked");
    case "O":
      return t("shipment.cards.verifiche.offer");
    case "N":
    default:
      return t("shipment.cards.verifiche.not_checked");
  }
});
const verifiedClass = computed(() => (controllata.value === "S" ? "on" : ""));
const verifiedTitle = computed(() =>
  controllata.value === "S"
    ? t("shipment.cards.verifiche.verified_ok")
    : t("shipment.cards.verifiche.verified_other", {
        label: controllataLabel.value,
      }),
);
</script>
