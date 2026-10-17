<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError } from "@tmwe/shared-frontend/http";
import { can } from "../env";
import {
  DELIVERED_STATUS_ID,
  formatDeliveryDate,
  groupOutcomes,
  mapOutcomes,
  normalizeScan,
  todayIso,
} from "../logic";
import { errMsg } from "../print";
import { warehouseApi } from "../services/warehouse.service";
import { useToastStore } from "../stores/toast.store";
import type { LdvInfo, Outcome, PodResult } from "../types";

const { t, locale } = useI18n();
const toast = useToastStore();
const canWrite = can.write();

const ldv = ref("");
const info = ref<LdvInfo | null>(null);
const outcomes = ref<Outcome[]>([]);
const esito = ref(String(DELIVERED_STATUS_ID));
const date = ref(todayIso());
const time = ref(new Date().toTimeString().slice(0, 5));
const firma = ref("");
const note = ref("");
const busy = ref(false);
const result = ref<PodResult | null>(null);

const outcomeItems = computed(() =>
  groupOutcomes(outcomes.value, {
    delivered: t("warehouse.deliveries.group_delivered"),
    exceptions: t("warehouse.deliveries.group_exceptions"),
    holdNote: t("warehouse.deliveries.may_hold"),
  }),
);

async function lookup(): Promise<void> {
  const v = normalizeScan(ldv.value);
  if (!v) return;
  busy.value = true;
  result.value = null;
  info.value = null;
  try {
    info.value = await warehouseApi.verifyLdv(v);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      toast.push("warning", t("warehouse.deliveries.ldv_not_found"));
    } else {
      toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
    }
  } finally {
    busy.value = false;
  }
}

async function submit(): Promise<void> {
  if (!info.value || !canWrite) return;
  busy.value = true;
  try {
    result.value = await warehouseApi.registerPod({
      ldv: info.value.ldv,
      esito: esito.value,
      firma: firma.value.trim() || undefined,
      note: note.value.trim() || undefined,
      data_consegna: formatDeliveryDate(date.value, time.value),
    });
    toast.push("success", t("warehouse.deliveries.saved"));
    info.value = null;
    ldv.value = "";
    firma.value = "";
    note.value = "";
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.save_failed")));
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    outcomes.value = mapOutcomes(
      await warehouseApi.trackingStatuses(),
      String(locale.value),
    );
  } catch (e) {
    outcomes.value = mapOutcomes([{ id: DELIVERED_STATUS_ID, tipo: "D", descr_eng: "Delivered", descr_ita: "Consegnato", descr_spa: "Entregado" }], String(locale.value));
    toast.push("warning", errMsg(e, t("warehouse.deliveries.outcomes_failed")));
  }
});
</script>

<template>
  <div class="wh-page">
    <h1 class="text-h6 mb-4">{{ t("warehouse.deliveries.title") }}</h1>
    <v-alert v-if="!canWrite" type="info" variant="tonal" density="compact" class="mb-3">
      {{ t("warehouse.common.read_only") }}
    </v-alert>
    <v-alert
      v-if="result && result.delivery_claimed === false"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ t("warehouse.deliveries.already_delivered") }}
    </v-alert>

    <div class="d-flex ga-2 mb-4">
      <v-text-field
        v-model="ldv"
        :label="t('warehouse.deliveries.ldv')"
        autofocus
        variant="outlined"
        density="comfortable"
        prepend-inner-icon="mdi-barcode-scan"
        hide-details
        style="max-width: 340px"
        @keyup.enter="lookup"
      />
      <v-btn color="primary" :loading="busy" :disabled="!ldv.trim()" @click="lookup">{{
        t("warehouse.deliveries.verify")
      }}</v-btn>
    </div>

    <v-card v-if="info" variant="outlined" max-width="560">
      <v-card-text>
        <div class="text-caption">LDV {{ info.ldv }}</div>
        <div class="text-subtitle-1">{{ info.destinatario }}</div>
        <div class="text-body-2 mb-3">
          {{ info.indirizzo }}, {{ info.cap }} {{ info.citta }}
        </div>
        <v-select
          v-model="esito"
          :items="outcomeItems"
          item-title="title"
          item-value="value"
          :label="t('warehouse.deliveries.outcome')"
          variant="outlined"
          density="comfortable"
          :disabled="!canWrite"
        />
        <div class="d-flex ga-2">
          <v-text-field
            v-model="date"
            type="date"
            :label="t('warehouse.common.date')"
            variant="outlined"
            density="comfortable"
          />
          <v-text-field
            v-model="time"
            type="time"
            :label="t('warehouse.deliveries.time')"
            variant="outlined"
            density="comfortable"
          />
        </div>
        <v-text-field
          v-model="firma"
          :label="t('warehouse.deliveries.signer')"
          variant="outlined"
          density="comfortable"
          :disabled="!canWrite"
        />
        <v-textarea
          v-model="note"
          :label="t('warehouse.deliveries.note')"
          rows="2"
          variant="outlined"
          density="comfortable"
          :disabled="!canWrite"
        />
      </v-card-text>
      <v-card-actions>
        <v-btn variant="text" @click="info = null">{{ t("warehouse.common.cancel") }}</v-btn>
        <v-spacer />
        <v-btn color="primary" variant="flat" :loading="busy" :disabled="!canWrite" @click="submit">{{
          t("warehouse.deliveries.register")
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<style scoped>
.wh-page {
  padding: 24px;
  max-width: 680px;
}
</style>
