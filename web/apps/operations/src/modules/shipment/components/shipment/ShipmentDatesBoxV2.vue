<template>
  <div class="dates-grid">
    <div class="dates-field">
      <label class="dates-label">
        <v-icon icon="mdi-calendar-edit" size="14" class="me-1" />
        {{ t("shipment.modals.dates.issue_date") }}
        <span class="dates-hint">(data_sped0)</span>
      </label>
      <v-text-field
        v-model="dataSped0.local"
        type="datetime-local"
        density="compact"
        variant="outlined"
        hide-details
        :readonly="readonly('data_sped0')"
        @blur="dataSped0.commit"
      />
    </div>

    <div class="dates-field">
      <label class="dates-label">
        <v-icon icon="mdi-truck-fast-outline" size="14" class="me-1" />
        {{ t("shipment.modals.dates.ship_date") }}
        <span class="dates-hint">(data_sped1)</span>
      </label>
      <v-text-field
        v-model="dataSped1.local"
        type="date"
        density="compact"
        variant="outlined"
        hide-details
        :readonly="readonly('data_sped1')"
        @blur="dataSped1.commit"
      />
    </div>

    <div class="dates-field">
      <label class="dates-label">
        <v-icon
          icon="mdi-package-variant-closed-check"
          size="14"
          class="me-1"
        />
        {{ t("shipment.modals.dates.expected_delivery") }}
        <span class="dates-hint">(data_consegna_prevista)</span>
      </label>
      <v-text-field
        v-model="dataConsegnaPrevista.local"
        type="datetime-local"
        density="compact"
        variant="outlined"
        hide-details
        @blur="dataConsegnaPrevista.commit"
      />
    </div>

    <div class="dates-field">
      <label class="dates-label">
        <v-icon icon="mdi-truck-delivery-outline" size="14" class="me-1" />
        {{ t("shipment.modals.dates.courier_date") }}
        <span class="dates-hint">(data_corriere)</span>
      </label>
      <v-text-field
        v-model="dataCorriere.local"
        type="date"
        density="compact"
        variant="outlined"
        hide-details
        @blur="dataCorriere.commit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);

const dataSped0 = useFieldBinding("data_sped0", "");
const dataSped1 = useFieldBinding("data_sped1", "");
const dataConsegnaPrevista = useFieldBinding("data_consegna_prevista", "");
const dataCorriere = useFieldBinding("data_corriere", "");
</script>

<style scoped>
.dates-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  padding: 4px 0;
}

@media (max-width: 640px) {
  .dates-grid {
    grid-template-columns: 1fr;
  }
}

.dates-field {
  display: flex;
  flex-direction: column;
}

.dates-label {
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.75);
  margin-bottom: 4px;
  letter-spacing: 0.2px;
}

.dates-hint {
  margin-left: 6px;
  font-weight: 400;
  font-size: 10.5px;
  color: rgba(var(--v-theme-on-surface), 0.45);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
