<template>
  <ModalWrapper
    name="riaddebito"
    :title="t('shipment.modals.recharge.title')"
    icon="mdi-cash-refund"
    :max-width="780"
  >
    <v-skeleton-loader v-if="loading" type="card, article" />

    <v-alert
      v-else-if="loadError"
      type="error"
      density="compact"
      variant="tonal"
      class="mb-3"
    >
      {{ loadError }}
    </v-alert>

    <template v-else-if="preview">
      <!-- Eligibility banner -->
      <v-alert
        v-if="!eligible"
        type="warning"
        density="compact"
        variant="tonal"
        icon="mdi-alert-outline"
        class="mb-3"
      >
        {{ t("shipment.modals.recharge.not_eligible") }}
        <strong>controllo_fatt = {{ preview.controllo_fatt }}</strong>
        {{
          preview.id_fattura_a2 ? t("shipment.modals.recharge.a2_assigned") : ""
        }}
      </v-alert>

      <!-- KPI row -->
      <v-row dense class="mb-2">
        <v-col cols="6" md="3">
          <div class="rkpi">
            <div class="rkpi__lbl">
              {{ t("shipment.modals.recharge.current_charge") }}
            </div>
            <div class="rkpi__val">{{ fmt(preview.carico_actual) }}</div>
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="rkpi">
            <div class="rkpi__lbl">
              {{ t("shipment.modals.recharge.recalc_price") }}
            </div>
            <div class="rkpi__val">{{ fmt(preview.prezzo_ricalcolato) }}</div>
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="rkpi">
            <div class="rkpi__lbl">
              {{ t("shipment.modals.recharge.delta") }}
            </div>
            <div class="rkpi__val" :class="deltaClass">
              {{ fmt(preview.delta) }}
            </div>
          </div>
        </v-col>
        <v-col cols="6" md="3">
          <div class="rkpi">
            <div class="rkpi__lbl">
              {{ t("shipment.modals.recharge.weight_diff") }}
            </div>
            <div class="rkpi__val">
              {{ preview.differenza_peso.toFixed(2) }} kg
            </div>
          </div>
        </v-col>
      </v-row>

      <v-tabs v-model="tab" density="compact" color="primary">
        <v-tab value="confronto">{{
          t("shipment.modals.recharge.tab_comparison")
        }}</v-tab>
        <v-tab value="proposta">{{
          t("shipment.modals.recharge.tab_proposal")
        }}</v-tab>
        <v-tab value="anteprima">{{
          t("shipment.modals.recharge.tab_preview")
        }}</v-tab>
      </v-tabs>
      <v-divider />

      <v-window v-model="tab" class="mt-3">
        <!-- CONFRONTO TAB -->
        <v-window-item value="confronto">
          <v-table density="compact">
            <thead>
              <tr>
                <th>{{ t("shipment.modals.recharge.col_item") }}</th>
                <th class="text-right">
                  {{ t("shipment.modals.recharge.col_forecast") }}
                </th>
                <th class="text-right">
                  {{ t("shipment.modals.recharge.col_real") }}
                </th>
                <th class="text-right">
                  {{ t("shipment.modals.recharge.delta") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{{
                    t("shipment.modals.recharge.client_price")
                  }}</strong>
                </td>
                <td class="text-right">{{ fmt(preview.carico_actual) }}</td>
                <td class="text-right">
                  {{ fmt(preview.prezzo_ricalcolato) }}
                </td>
                <td class="text-right" :class="deltaClass">
                  {{ fmt(preview.delta) }}
                </td>
              </tr>
              <tr>
                <td>{{ t("shipment.modals.recharge.fuel_surcharge") }}</td>
                <td class="text-right">{{ fmt(preview.fuel_actual) }}</td>
                <td class="text-right">{{ fmt(preview.fuel_ricalcolato) }}</td>
                <td class="text-right">{{ fmt(preview.delta_fuel) }}</td>
              </tr>
              <tr>
                <td>{{ t("shipment.modals.recharge.weight_taxed") }}</td>
                <td class="text-right">
                  {{ preview.peso_tassato.toFixed(2) }} kg
                </td>
                <td class="text-right">{{ preview.pr1.toFixed(2) }} kg</td>
                <td
                  class="text-right"
                  :class="preview.differenza_peso > 0 ? 'r-pos' : ''"
                >
                  {{ preview.differenza_peso.toFixed(2) }} kg
                </td>
              </tr>
            </tbody>
          </v-table>

          <div v-if="preview.supplements_delta.length" class="mt-3">
            <div class="text-caption font-weight-bold mb-2">
              {{ t("shipment.modals.recharge.shipment_supplements") }}
            </div>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>{{ t("shipment.modals.recharge.col_id") }}</th>
                  <th>{{ t("shipment.modals.recharge.col_supplement") }}</th>
                  <th class="text-center">
                    {{ t("shipment.modals.recharge.col_origin") }}
                  </th>
                  <th class="text-center">
                    {{ t("shipment.modals.recharge.col_active") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in preview.supplements_delta" :key="s.id">
                  <td>
                    <code>#{{ s.id_supplementi }}</code>
                  </td>
                  <td>{{ s.supplement_name ?? "—" }}</td>
                  <td class="text-center">
                    <v-chip
                      size="x-small"
                      :color="s.delta === 'S' ? 'warning' : 'default'"
                    >
                      {{
                        s.delta === "S"
                          ? t("shipment.modals.recharge.origin_supplier")
                          : s.delta === "A"
                            ? t("shipment.modals.recharge.origin_absorbed")
                            : t("shipment.modals.recharge.origin_client")
                      }}
                    </v-chip>
                  </td>
                  <td class="text-center">
                    {{ s.attivo === "S" ? "✓" : "—" }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-window-item>

        <!-- PROPOSTA TAB -->
        <v-window-item value="proposta">
          <v-list density="compact" lines="two">
            <v-list-item>
              <v-list-item-title>{{
                t("shipment.modals.recharge.auto_delta")
              }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ t("shipment.modals.recharge.auto_delta_sub") }}
              </v-list-item-subtitle>
              <template #append>
                <span class="text-h6 me-3">{{ fmt(preview.delta) }}</span>
              </template>
            </v-list-item>
          </v-list>

          <v-divider class="my-3" />

          <v-checkbox
            v-model="useOverride"
            :label="t('shipment.modals.recharge.manual_override')"
            density="compact"
            hide-details
          />

          <v-text-field
            v-if="useOverride"
            v-model.number="overrideAmount"
            :label="t('shipment.modals.recharge.override_amount')"
            type="number"
            step="0.01"
            density="compact"
            variant="outlined"
            hide-details
            class="mt-2"
            :hint="
              t('shipment.modals.recharge.override_hint', {
                amount: fmt(preview.delta),
              })
            "
            persistent-hint
          />

          <v-divider class="my-3" />

          <!-- Descrizione in fattura (postfatt_txt) — editabile.
               Precompilata con "Differenza peso: X Kg" quando pr1 > peso_tassato. -->
          <v-textarea
            v-model="postfattTxt"
            :label="t('shipment.modals.recharge.invoice_desc')"
            density="compact"
            variant="outlined"
            rows="2"
            auto-grow
            hide-details
            class="mt-2"
          />
        </v-window-item>

        <!-- ANTEPRIMA TAB -->
        <v-window-item value="anteprima">
          <v-card variant="outlined">
            <v-card-text>
              <div class="text-caption text-medium-emphasis mb-2">
                {{
                  preview.operaz === "P"
                    ? t("shipment.modals.recharge.preview_post")
                    : t("shipment.modals.recharge.preview_update")
                }}
              </div>
              <div class="text-h4 font-weight-bold" :class="deltaClass">
                {{
                  preview.operaz === "P"
                    ? fmt(applyAmount)
                    : fmt(preview.prezzo_ricalcolato)
                }}
              </div>
              <v-divider class="my-3" />
              <div class="d-flex flex-column ga-1">
                <div>
                  <span class="text-medium-emphasis me-2">{{
                    t("shipment.modals.recharge.lbl_shipment")
                  }}</span>
                  <code>#{{ preview.shipment_id }}</code>
                </div>
                <div v-if="preview.rif_cliente">
                  <span class="text-medium-emphasis me-2">{{
                    t("shipment.modals.recharge.lbl_client_ref")
                  }}</span>
                  {{ preview.rif_cliente }}
                </div>
                <div>
                  <span class="text-medium-emphasis me-2">{{
                    t("shipment.modals.recharge.lbl_client_invoice")
                  }}</span>
                  <code>#{{ preview.id_fattura_a || "—" }}</code>
                </div>
                <div>
                  <span class="text-medium-emphasis me-2">{{
                    t("shipment.modals.recharge.lbl_currency")
                  }}</span>
                  {{ preview.currency }}
                </div>
              </div>
              <v-alert
                v-if="postfattTxt"
                type="success"
                density="compact"
                variant="tonal"
                class="mt-3"
                icon="mdi-text-box-outline"
              >
                <span class="text-medium-emphasis">{{
                  t("shipment.modals.recharge.invoice_desc_label")
                }}</span
                ><br />
                {{ postfattTxt }}
              </v-alert>
              <v-alert
                type="info"
                density="compact"
                variant="tonal"
                class="mt-3"
                icon="mdi-information-outline"
              >
                <span v-if="preview.operaz === 'P'">{{
                  t("shipment.modals.recharge.info_post")
                }}</span>
                <span v-else>{{
                  t("shipment.modals.recharge.info_update")
                }}</span>
              </v-alert>
            </v-card-text>
          </v-card>
        </v-window-item>
      </v-window>
    </template>

    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.cancel")
      }}</v-btn>
      <v-btn
        v-if="preview && eligible"
        variant="flat"
        color="primary"
        rounded="lg"
        prepend-icon="mdi-check"
        :loading="applying"
        @click="submitApply"
      >
        {{ t("shipment.modals.recharge.apply", { amount: fmt(applyAmount) }) }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useUiStore } from "@shipment/stores/ui.store";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import {
  rechargeService,
  type RechargePreview,
} from "@shipment/services/recharge.service";
import ModalWrapper from "../modals/ModalWrapper.vue";
import { formatMoney } from "@shipment/utils/currency";

const { t } = useI18n();
const ui = useUiStore();
const store = useShipmentStore();
const toasts = useToastStore();
const { id } = storeToRefs(store);

const preview = ref<RechargePreview | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);
const applying = ref(false);
const tab = ref<"confronto" | "proposta" | "anteprima">("confronto");

const useOverride = ref(false);
const overrideAmount = ref<number>(0);
const postfattTxt = ref<string>("");

const eligible = computed<boolean>(() => {
  if (!preview.value) return false;
  // El backend ya resuelve elegibilidad (controllo_fatt IN CA/NO/0 && a2==0).
  return preview.value.eligible === true;
});

const applyAmount = computed<number>(() => {
  if (!preview.value) return 0;
  return useOverride.value
    ? Number(overrideAmount.value ?? 0)
    : preview.value.delta;
});

const deltaClass = computed(() => {
  const v = preview.value?.delta ?? 0;
  if (v > 0) return "r-pos";
  if (v < 0) return "r-neg";
  return "";
});

async function loadPreview(): Promise<void> {
  if (!id.value) return;
  loading.value = true;
  loadError.value = null;
  preview.value = null;
  try {
    const r = await rechargeService.preview(Number(id.value));
    if (!r.success || !r.data) {
      loadError.value = r.error ?? t("shipment.modals.recharge.load_error");
      return;
    }
    preview.value = r.data;
    overrideAmount.value = r.data.delta;
    postfattTxt.value = r.data.postfatt_txt_preview ?? "";
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function submitApply(): Promise<void> {
  if (!id.value || !preview.value) return;
  applying.value = true;
  try {
    const r = await rechargeService.apply(
      Number(id.value),
      useOverride.value ? Number(overrideAmount.value) : undefined,
      // Enviar el texto solo si el operador lo modificó respecto al preview.
      postfattTxt.value !== (preview.value.postfatt_txt_preview ?? "")
        ? postfattTxt.value
        : undefined,
    );
    if (!r.success) {
      toasts.push(
        "error",
        r.error ?? r.message ?? t("shipment.modals.recharge.apply_failed"),
      );
      return;
    }
    const action = r.data?.action ?? "recharge_applied";
    if (action === "no_delta" || action === "carico_locked") {
      toasts.push(
        "info",
        action === "no_delta"
          ? t("shipment.modals.recharge.no_delta")
          : t("shipment.modals.recharge.carico_locked"),
      );
    } else if (action === "carico_updated") {
      toasts.push(
        "success",
        t("shipment.modals.recharge.carico_updated", {
          amount: fmt(r.data?.carico ?? preview.value.prezzo_ricalcolato),
        }),
      );
    } else {
      toasts.push(
        "success",
        t("shipment.modals.recharge.applied", {
          amount: fmt(r.data?.delta_applied ?? applyAmount.value),
        }),
      );
    }
    ui.closeModal();
    await store.load(Number(id.value));
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    applying.value = false;
  }
}

function fmt(v: number, valuta?: string): string {
  const cur = valuta || preview.value?.currency || "EUR";
  return formatMoney(v, cur);
}

watch(
  () => ui.activeModal,
  (n) => {
    if (n === "riaddebito") {
      tab.value = "confronto";
      useOverride.value = false;
      postfattTxt.value = "";
      void loadPreview();
    }
  },
);
</script>

<style scoped>
.rkpi {
  text-align: center;
  padding: 8px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface-variant), 0.4);
}
.rkpi__lbl {
  font-size: 11px;
  opacity: 0.65;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.rkpi__val {
  font-size: 18px;
  font-weight: 700;
  margin-top: 2px;
  font-feature-settings: "tnum";
}
.r-pos {
  color: rgb(var(--v-theme-success));
}
.r-neg {
  color: rgb(var(--v-theme-error));
}
</style>
