<template>
  <ModalWrapper
    name="wifi_scale"
    :title="t('shipment.wifi.title')"
    icon="mdi-scale"
    :max-width="640"
  >
    <p class="text-body-2 text-medium-emphasis mb-3">
      {{ t("shipment.wifi.intro") }}
      <code>spedizioni_colli.id</code>, <code>segnac_cliente</code>
      {{ t("common.or") }} <code>RIF_cliente</code>
      {{ t("shipment.wifi.intro_mono") }}
    </p>

    <!-- Step 1: lookup -->
    <v-card variant="outlined" class="mb-3">
      <v-card-title class="text-subtitle-2 font-weight-medium px-3 py-2">
        <v-icon icon="mdi-barcode-scan" size="16" class="me-2" />
        {{ t("shipment.wifi.lookup_collo") }}
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-3">
        <div class="d-flex ga-2">
          <v-text-field
            v-model="needle"
            :label="t('shipment.wifi.segnacollo')"
            density="compact"
            variant="outlined"
            hide-details
            autofocus
            class="flex-grow-1"
            @keyup.enter="lookup"
          />
          <v-btn
            variant="flat"
            color="primary"
            rounded="lg"
            prepend-icon="mdi-magnify"
            :loading="lookingUp"
            :disabled="!needle"
            @click="lookup"
          >
            {{ t("shipment.wifi.search") }}
          </v-btn>
        </div>

        <v-alert
          v-if="lookupError"
          type="error"
          density="compact"
          variant="tonal"
          class="mt-2"
        >
          {{ lookupError }}
        </v-alert>

        <div v-if="found" class="mt-3 pa-2 fc-row">
          <v-icon
            icon="mdi-check-circle"
            color="success"
            size="16"
            class="me-1"
          />
          {{ t("shipment.wifi.collo") }}
          <strong>#{{ found.collo_id }}</strong> ·
          {{ t("shipment.wifi.shipment") }} #{{ found.shipment_id }}
          <v-chip
            v-if="found.pesata"
            size="x-small"
            color="warning"
            variant="tonal"
            class="ms-2"
          >
            {{ t("shipment.wifi.already_weighed") }}
          </v-chip>
          <span v-if="found.peso" class="ms-2 text-medium-emphasis">
            {{ t("shipment.wifi.current") }}: {{ found.peso.toFixed(2) }} kg ·
            {{ found.dim_a }}×{{ found.dim_l }}×{{ found.dim_p }} cm
          </span>
        </div>
      </v-card-text>
    </v-card>

    <!-- Step 2: apply -->
    <v-card variant="outlined" :disabled="!found?.collo_id">
      <v-card-title class="text-subtitle-2 font-weight-medium px-3 py-2">
        <v-icon icon="mdi-scale" size="16" class="me-2" />
        {{ t("shipment.wifi.measurement") }}
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-3">
        <div class="d-flex ga-2 mb-2">
          <v-text-field
            v-model.number="peso"
            :label="t('shipment.wifi.weight_kg')"
            type="number"
            step="0.01"
            density="compact"
            variant="outlined"
            hide-details
            class="flex-grow-1"
          />
        </div>
        <div class="d-flex ga-2">
          <v-text-field
            v-model.number="dim_a"
            :label="t('shipment.wifi.height_cm')"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-text-field
            v-model.number="dim_l"
            :label="t('shipment.wifi.width_cm')"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-text-field
            v-model.number="dim_p"
            :label="t('shipment.wifi.depth_cm')"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
          />
        </div>

        <v-alert
          v-if="applyError"
          type="error"
          density="compact"
          variant="tonal"
          class="mt-2"
        >
          {{ applyError }}
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Recent readings -->
    <v-card variant="outlined" class="mt-3">
      <v-card-title class="text-subtitle-2 font-weight-medium px-3 py-2">
        <v-icon icon="mdi-history" size="16" class="me-2" />
        {{ t("shipment.wifi.recent_title") }}
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          variant="text"
          size="x-small"
          density="comfortable"
          :loading="loadingRecent"
          @click="loadRecent"
        />
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-0">
        <EmptyState
          v-if="!recent.length"
          icon="mdi-package-variant-closed"
          :title="t('shipment.wifi.recent_empty')"
          density="compact"
        />
        <v-table v-else density="compact">
          <thead>
            <tr>
              <th>{{ t("shipment.wifi.collo") }}</th>
              <th class="text-right">{{ t("shipment.wifi.weight_kg") }}</th>
              <th>{{ t("shipment.wifi.timestamp") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in recent" :key="r.collo_id">
              <td>{{ r.n_collo || `#${r.collo_id}` }}</td>
              <td class="text-right">{{ r.peso.toFixed(2) }}</td>
              <td class="text-medium-emphasis">{{ r.data_pesatura }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>

    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
      <v-btn
        variant="flat"
        color="primary"
        rounded="lg"
        prepend-icon="mdi-check"
        :loading="applying"
        :disabled="!canApply"
        @click="applyReading"
      >
        {{ t("shipment.wifi.apply") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useUiStore } from "@shipment/stores/ui.store";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import {
  wifiScaleService,
  type WifiFindResult,
  type WifiRecentItem,
} from "@shipment/services/wifi_scale.service";
import ModalWrapper from "../modals/ModalWrapper.vue";

const { t } = useI18n();
const ui = useUiStore();
const store = useShipmentStore();
const toasts = useToastStore();
const { id: shipmentId } = storeToRefs(store);

const needle = ref("");
const found = ref<WifiFindResult | null>(null);
const lookingUp = ref(false);
const lookupError = ref<string | null>(null);

const peso = ref<number>(0);
const dim_a = ref<number>(0);
const dim_l = ref<number>(0);
const dim_p = ref<number>(0);
const applying = ref(false);
const applyError = ref<string | null>(null);

const recent = ref<WifiRecentItem[]>([]);
const loadingRecent = ref(false);

const canApply = computed<boolean>(() => {
  if (!found.value?.collo_id) return false;
  return (
    Number(peso.value) > 0 &&
    Number(dim_a.value) > 0 &&
    Number(dim_l.value) > 0 &&
    Number(dim_p.value) > 0
  );
});

async function lookup(): Promise<void> {
  if (!needle.value.trim()) return;
  lookingUp.value = true;
  lookupError.value = null;
  found.value = null;
  try {
    const r = await wifiScaleService.find(needle.value.trim());
    if (!r.found) {
      lookupError.value = t("shipment.wifi.not_found");
      return;
    }
    found.value = r;
    // Pre-populate with current values (operator can override)
    peso.value = r.peso ?? 0;
    dim_a.value = r.dim_a ?? 0;
    dim_l.value = r.dim_l ?? 0;
    dim_p.value = r.dim_p ?? 0;
  } catch (e) {
    lookupError.value = (e as Error).message;
  } finally {
    lookingUp.value = false;
  }
}

async function applyReading(): Promise<void> {
  if (!found.value?.collo_id || !found.value.shipment_id) return;
  applying.value = true;
  applyError.value = null;
  try {
    const r = await wifiScaleService.apply({
      shipment_id: found.value.shipment_id,
      collo_id: found.value.collo_id,
      peso: Number(peso.value),
      dim_a: Number(dim_a.value),
      dim_l: Number(dim_l.value),
      dim_p: Number(dim_p.value),
    });
    if (!r.success) {
      applyError.value = r.error ?? t("shipment.wifi.apply_failed");
      return;
    }
    toasts.push(
      "success",
      t("shipment.wifi.toast_weighed", { id: r.collo_id }),
    );
    // Reset for next entry, keep shipment_id context
    needle.value = "";
    found.value = null;
    peso.value = 0;
    dim_a.value = 0;
    dim_l.value = 0;
    dim_p.value = 0;
    await loadRecent();
    // If the operator is weighing colli of the active shipment, refresh
    // the cargo store so the new value shows in MisureCard / PackagesBox.
    if (shipmentId.value && shipmentId.value === r.shipment_id) {
      await store.load(shipmentId.value);
    }
  } catch (e) {
    applyError.value = (e as Error).message;
  } finally {
    applying.value = false;
  }
}

async function loadRecent(): Promise<void> {
  if (!shipmentId.value) return;
  loadingRecent.value = true;
  try {
    const r = await wifiScaleService.recent(Number(shipmentId.value));
    recent.value = r.items;
  } catch {
    recent.value = [];
  } finally {
    loadingRecent.value = false;
  }
}

watch(
  () => ui.activeModal,
  (n) => {
    if (n === "wifi_scale") {
      needle.value = "";
      found.value = null;
      lookupError.value = null;
      applyError.value = null;
      peso.value = 0;
      dim_a.value = 0;
      dim_l.value = 0;
      dim_p.value = 0;
      void loadRecent();
    }
  },
);
</script>

<style scoped>
.fc-row {
  display: flex;
  align-items: center;
  background: rgba(var(--v-theme-success), 0.06);
  border-radius: 6px;
  font-size: 13px;
}
</style>
