<template>
  <ModalWrapper
    name="proforma"
    :title="t('shipment.modals.proforma.title')"
    icon="mdi-file-document-outline"
    :max-width="1100"
  >
    <div v-if="loading" class="d-flex justify-center pa-6">
      <v-progress-circular indeterminate size="32" />
    </div>

    <template v-else>
      <!-- Header (paese, motivo, valuta, data) -->
      <FormSection
        :title="t('shipment.modals.proforma.header_section')"
        icon="mdi-file-document-outline"
        flat
      >
        <v-row dense>
          <v-col cols="12" md="2">
            <CmCountrySelect
              v-model="header.iso_paese_origine"
              :label="t('shipment.modals.proforma.country_iso')"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-autocomplete
              v-model="header.motivo"
              :items="motiviItems"
              :label="t('shipment.modals.proforma.export_reason')"
              density="compact"
              variant="outlined"
              hide-details
              clearable
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-autocomplete
              v-model="header.id_valuta"
              :items="currencyItems"
              :loading="currencyLoading"
              :label="t('shipment.modals.proforma.currency_id')"
              item-title="title"
              item-value="value"
              density="compact"
              variant="outlined"
              hide-details
              auto-select-first
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="header.data"
              type="date"
              :label="t('shipment.modals.proforma.date')"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- Lines -->
      <v-table density="compact" class="proforma-table">
        <thead>
          <tr>
            <th class="text-left">
              {{ t("shipment.modals.proforma.col_description") }}
            </th>
            <th class="text-left col-code">
              {{ t("shipment.modals.proforma.col_customs_code") }}
            </th>
            <th class="text-right col-qty">
              {{ t("shipment.modals.proforma.col_qty") }}
            </th>
            <th class="text-left col-unit">
              {{ t("shipment.modals.proforma.col_unit") }}
            </th>
            <th class="text-right col-weight">
              {{ t("shipment.modals.proforma.col_net_weight") }}
            </th>
            <th class="text-right col-weight">
              {{ t("shipment.modals.proforma.col_gross_weight") }}
            </th>
            <th class="text-left col-wunit">
              {{ t("shipment.modals.proforma.col_weight_unit") }}
            </th>
            <th class="text-right col-value">
              {{ t("shipment.modals.proforma.col_value") }}
            </th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(it, i) in items" :key="i">
            <td>
              <v-text-field
                v-model="it.descrizione"
                hide-details
                density="compact"
                variant="plain"
              />
            </td>
            <td>
              <v-text-field
                v-model="it.voce_doganale"
                hide-details
                density="compact"
                variant="plain"
                placeholder="HS code"
              />
            </td>
            <td>
              <v-text-field
                v-model.number="it.qta"
                type="number"
                min="0"
                hide-details
                density="compact"
                variant="plain"
                class="text-right"
              />
            </td>
            <td>
              <v-text-field
                v-model="it.qta_unit"
                hide-details
                density="compact"
                variant="plain"
                placeholder="PCS"
              />
            </td>
            <td>
              <v-text-field
                v-model.number="it.peso_netto"
                type="number"
                min="0"
                step="0.01"
                hide-details
                density="compact"
                variant="plain"
                class="text-right"
              />
            </td>
            <td>
              <v-text-field
                v-model.number="it.peso_lordo"
                type="number"
                min="0"
                step="0.01"
                hide-details
                density="compact"
                variant="plain"
                class="text-right"
              />
            </td>
            <td>
              <v-select
                v-model="it.peso_unit"
                :items="['K', 'L']"
                hide-details
                density="compact"
                variant="plain"
              />
            </td>
            <td>
              <v-text-field
                v-model.number="it.valore"
                type="number"
                min="0"
                step="0.01"
                hide-details
                density="compact"
                variant="plain"
                class="text-right"
              />
            </td>
            <td>
              <v-btn
                icon="mdi-close"
                variant="text"
                size="x-small"
                @click="items.splice(i, 1)"
              />
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="9" class="text-center text-medium-emphasis py-4">
              {{ t("shipment.modals.proforma.no_rows") }}
            </td>
          </tr>
        </tbody>
        <tfoot v-if="items.length">
          <tr>
            <td colspan="7" class="text-right text-medium-emphasis">
              {{ t("shipment.modals.proforma.total") }}
            </td>
            <td class="text-right font-weight-bold">{{ totalLabel }}</td>
            <td></td>
          </tr>
        </tfoot>
      </v-table>

      <v-btn
        class="mt-3"
        variant="outlined"
        prepend-icon="mdi-plus"
        size="small"
        @click="addRow"
      >
        {{ t("shipment.modals.proforma.add_row") }}
      </v-btn>
    </template>

    <template #actions>
      <v-btn
        variant="outlined"
        prepend-icon="mdi-file-pdf-box"
        :disabled="!shipmentId || !items.length"
        :loading="pdfLoading"
        @click="generatePdf"
      >
        {{ t("shipment.modals.proforma.pdf") }}
      </v-btn>
      <v-spacer />
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="saving"
        :disabled="!shipmentId"
        @click="save"
      >
        {{ t("common.save") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import { useToastStore } from "@shipment/stores/toast.store";
import { formatMoney } from "@shipment/utils/currency";
import {
  proformaService,
  type ProformaItem,
  type ProformaHeader,
} from "@shipment/services/proforma.service";
import CmCountrySelect from "@shared/anagrafiche/components/CmCountrySelect.vue";
import FormSection from "@shared/ui/FormSection.vue";
import {
  currenciesService,
  type CurrencyOption,
} from "@shared/anagrafiche/services/currencies.service";
import ModalWrapper from "./ModalWrapper.vue";

const { t } = useI18n();
const shipmentStore = useShipmentStore();
const { id: shipmentId } = storeToRefs(shipmentStore);
const ui = useUiStore();
const toasts = useToastStore();

const loading = ref(false);
const saving = ref(false);
const pdfLoading = ref(false);

const header = ref<ProformaHeader>({
  iso_paese_origine: "",
  motivo: "",
  id_valuta: undefined,
  data: new Date().toISOString().slice(0, 10),
});
const items = ref<ProformaItem[]>([]);

const motivi = ref<Array<{ id: number; descr: string }>>([]);
const units = ref<string[]>([]);

// Currency picker fed from the valute master table (/api_master_currencies),
// which returns {id, sigla}. id_valuta is an INT FK to valute.id, so the
// dropdown value must be the numeric id (joined server-side as cur.id = fp.id_valuta).
const currencyCatalog = ref<CurrencyOption[]>([]);
const currencyLoading = ref(false);

interface CurrencyItem {
  value: number;
  title: string;
}

// Preserve a persisted currency id that is not in the catalog so the saved
// value round-trips unchanged (shown by its id until the catalog loads).
const currencyItems = computed<CurrencyItem[]>(() => {
  const list = currencyCatalog.value.map((c) => ({
    value: c.id,
    title: c.nome ? `${c.sigla} — ${c.nome}` : c.sigla,
  }));
  const cur = header.value.id_valuta;
  if (typeof cur === "number" && !list.some((i) => i.value === cur)) {
    list.unshift({ value: cur, title: String(cur) });
  }
  return list;
});

const motiviItems = computed(() => motivi.value.map((m) => m.descr));

const totalLabel = computed<string>(() => {
  const sum = items.value.reduce(
    (acc, it) => acc + Number(it.valore || 0) * Number(it.qta || 0),
    0,
  );
  return formatMoney(sum);
});

// Open modal → fetch existing proforma + lookup data.
watch(
  () => ui.activeModal === "proforma",
  async (isOpen) => {
    if (!isOpen || !shipmentId.value) return;
    loading.value = true;
    try {
      const [data, lk] = await Promise.all([
        proformaService.get(Number(shipmentId.value)),
        proformaService.lookup(),
      ]);
      if (lk.motivi) motivi.value = lk.motivi;
      if (lk.units) units.value = lk.units;
      if (data.success && data.proforma) {
        const p = data.proforma;
        header.value = {
          iso_paese_origine: p.iso_paese_origine ?? "",
          motivo: p.motivo ?? "",
          id_valuta: p.id_valuta,
          data: p.data ?? new Date().toISOString().slice(0, 10),
        };
        items.value = Array.isArray(p.items) ? p.items : [];
      } else {
        items.value = [];
      }
    } finally {
      loading.value = false;
    }
  },
);

onMounted(async () => {
  currencyLoading.value = true;
  try {
    currencyCatalog.value = await currenciesService.list();
  } catch {
    currencyCatalog.value = [];
  } finally {
    currencyLoading.value = false;
  }
});

function addRow(): void {
  items.value.push({
    descrizione: "",
    voce_doganale: "",
    qta: 1,
    qta_unit: "PCS",
    peso_netto: 0,
    peso_lordo: 0,
    peso_unit: "K",
    valore: 0,
  });
}

async function save(): Promise<void> {
  if (!shipmentId.value) return;
  saving.value = true;
  try {
    const r = await proformaService.save(
      Number(shipmentId.value),
      header.value,
      items.value,
    );
    if (!r.success) {
      toasts.push(
        "error",
        r.error ?? t("shipment.modals.proforma.save_failed"),
      );
    } else {
      toasts.push("success", t("shipment.modals.proforma.saved"));
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    saving.value = false;
  }
}

async function generatePdf(): Promise<void> {
  if (!shipmentId.value) return;
  // Save first so the PDF reflects current edits.
  await save();
  pdfLoading.value = true;
  try {
    const r = await proformaService.generatePdf(Number(shipmentId.value));
    if (r.success && r.url) {
      window.open(r.url, "_blank");
    } else {
      toasts.push("error", t("shipment.modals.proforma.pdf_failed"));
    }
  } finally {
    pdfLoading.value = false;
  }
}
</script>

<style scoped>
.proforma-table :deep(td) {
  padding: 4px 6px !important;
}
.proforma-table :deep(input) {
  font-size: 12.5px !important;
}
/* Column widths (moved off inline th styles). */
.col-code {
  width: 110px;
}
.col-qty {
  width: 90px;
}
.col-unit {
  width: 80px;
}
.col-weight {
  width: 100px;
}
.col-wunit {
  width: 60px;
}
.col-value {
  width: 110px;
}
.col-actions {
  width: 36px;
}
</style>
