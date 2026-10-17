<template>
  <v-dialog
    :model-value="modelValue"
    max-width="980"
    persistent
    scrollable
    @update:model-value="onDialogToggle"
  >
    <v-card>
      <v-card-title class="pf-dialog-title">
        {{ isEdit ? t("proforma.proforma.edit") : t("proforma.proforma.new") }}
      </v-card-title>

      <v-card-text>
        <v-progress-linear
          v-if="loading"
          indeterminate
          color="primary"
          class="mb-3"
        />

        <!-- ── Cabecera ──────────────────────────────────── -->
        <v-row dense>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model.number="header.id_spedizione"
              :label="t('proforma.proforma.shipmentId')"
              type="number"
              :disabled="isEdit"
              :error-messages="errors.id_spedizione"
              required
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="header.data"
              :label="t('proforma.proforma.date')"
              type="date"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-select
              v-model="header.motivo"
              :items="motivoItems"
              :label="t('proforma.proforma.reason')"
              clearable
            />
          </v-col>
          <v-col cols="12" sm="3">
            <CmCountrySelect
              v-model="header.iso_paese_origine"
              :label="t('proforma.proforma.origin')"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-autocomplete
              v-model="header.id_valuta"
              :items="valuteItems"
              item-title="title"
              item-value="value"
              :label="t('proforma.proforma.currency')"
              clearable
            />
          </v-col>
        </v-row>

        <!-- ── Líneas ────────────────────────────────────── -->
        <div class="pf-items-head">
          <h4 class="pf-items-title">{{ t("proforma.proforma.items") }}</h4>
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-plus"
            @click="addLine"
          >
            {{ t("proforma.proforma.item.addLine") }}
          </v-btn>
        </div>
        <p v-if="errors.items" class="pf-items-error">{{ errors.items }}</p>

        <v-table density="compact" class="pf-items-table">
          <thead>
            <tr>
              <th>{{ t("proforma.proforma.item.description") }}</th>
              <th class="pf-col-sm">
                {{ t("proforma.proforma.item.customsCode") }}
              </th>
              <th class="pf-col-xs">{{ t("proforma.proforma.item.qty") }}</th>
              <th class="pf-col-xs">
                {{ t("proforma.proforma.item.qtyUnit") }}
              </th>
              <th class="pf-col-xs">
                {{ t("proforma.proforma.item.netWeight") }}
              </th>
              <th class="pf-col-xs">
                {{ t("proforma.proforma.item.grossWeight") }}
              </th>
              <th class="pf-col-xs">
                {{ t("proforma.proforma.item.weightUnit") }}
              </th>
              <th class="pf-col-xs">{{ t("proforma.proforma.item.value") }}</th>
              <th class="pf-col-act"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, idx) in lines" :key="idx">
              <td>
                <v-text-field
                  v-model="line.descrizione"
                  density="compact"
                  hide-details
                />
              </td>
              <td>
                <v-text-field
                  v-model="line.voce_doganale"
                  density="compact"
                  hide-details
                />
              </td>
              <td>
                <v-text-field
                  v-model="line.qta"
                  type="number"
                  density="compact"
                  hide-details
                />
              </td>
              <td>
                <v-select
                  v-model="line.qta_unit"
                  :items="unitItems"
                  density="compact"
                  hide-details
                />
              </td>
              <td>
                <v-text-field
                  v-model="line.peso_netto"
                  type="number"
                  density="compact"
                  hide-details
                />
              </td>
              <td>
                <v-text-field
                  v-model="line.peso_lordo"
                  type="number"
                  density="compact"
                  hide-details
                />
              </td>
              <td>
                <v-text-field
                  v-model="line.peso_unit"
                  density="compact"
                  hide-details
                  maxlength="3"
                />
              </td>
              <td>
                <v-text-field
                  v-model="line.valore"
                  type="number"
                  density="compact"
                  hide-details
                />
              </td>
              <td class="pf-col-act">
                <v-btn
                  size="x-small"
                  variant="text"
                  color="error"
                  icon="mdi-close"
                  @click="removeLine(idx)"
                />
              </td>
            </tr>
            <tr v-if="!lines.length">
              <td colspan="9" class="pf-no-lines">{{ t("common.noData") }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
        <v-btn color="primary" :loading="store.saving" @click="submit">{{
          t("common.save")
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useProformaStore } from "../stores/proforma.store";
import CmCountrySelect from "@shared/anagrafiche/components/CmCountrySelect.vue";
import {
  currenciesService,
  type CurrencyOption,
} from "@shared/anagrafiche/services/currencies.service";
import type { ProformaItem, ProformaWritePayload } from "../types";

const props = defineProps<{
  modelValue: boolean;
  proformaId: number | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [mode: "created" | "updated"];
}>();

const { t } = useI18n();
const store = useProformaStore();

const isEdit = computed(() => props.proformaId !== null);
const loading = ref(false);

interface HeaderState {
  id_spedizione: number | null;
  iso_paese_origine: string | null;
  motivo: string | null;
  id_valuta: number | string | null;
  data: string | null;
}

function blankHeader(): HeaderState {
  return {
    id_spedizione: null,
    iso_paese_origine: null,
    motivo: null,
    id_valuta: null,
    data: null,
  };
}

function blankLine(): ProformaItem {
  return {
    descrizione: "",
    voce_doganale: "",
    qta: 1,
    qta_unit: "",
    peso_netto: null,
    peso_lordo: null,
    peso_unit: "K",
    valore: null,
  };
}

const header = reactive<HeaderState>(blankHeader());
const lines = ref<ProformaItem[]>([]);
const errors = reactive<{ id_spedizione: string[]; items: string }>({
  id_spedizione: [],
  items: "",
});

const motivoItems = computed(() =>
  store.motivi.map((m) => ({
    title: m.descriz || m.sigla_dhl,
    value: m.sigla_dhl,
  })),
);
const unitItems = computed(() => store.units.map((u) => u.sigla_dhl));

// Currency: id_valuta is a numeric FK to valute.id. Fed from the shared
// currencies master (/api_master_currencies → {id, sigla, nome}). A persisted
// id not in the catalog is preserved by unshifting it into the item list.
const valuteCatalog = ref<CurrencyOption[]>([]);
const valuteItems = computed(() => {
  const list = valuteCatalog.value.map((c) => ({
    value: c.id,
    title: c.nome ? `${c.sigla} — ${c.nome}` : c.sigla,
  }));
  const cur = header.id_valuta;
  const curNum = typeof cur === "string" ? parseInt(cur, 10) : cur;
  if (
    typeof curNum === "number" &&
    !Number.isNaN(curNum) &&
    !list.some((i) => i.value === curNum)
  ) {
    list.unshift({ value: curNum, title: String(curNum) });
  }
  return list;
});
async function loadValute(): Promise<void> {
  try {
    valuteCatalog.value = await currenciesService.list();
  } catch {
    valuteCatalog.value = [];
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    errors.id_spedizione = [];
    errors.items = "";
    await store.ensureLookups();
    void loadValute();

    if (props.proformaId) {
      loading.value = true;
      try {
        const pf = await store.fetchOne(props.proformaId);
        Object.assign(header, {
          id_spedizione: Number(pf.id_spedizione),
          iso_paese_origine: pf.iso_paese_origine,
          motivo: pf.motivo,
          id_valuta: pf.id_valuta,
          data: pf.data,
        });
        lines.value = (pf.items ?? []).map((it) => ({
          descrizione: it.descrizione,
          voce_doganale: it.voce_doganale,
          qta: it.qta,
          qta_unit: it.qta_unit,
          peso_netto: it.peso_netto,
          peso_lordo: it.peso_lordo,
          peso_unit: it.peso_unit,
          valore: it.valore,
        }));
      } finally {
        loading.value = false;
      }
    } else {
      Object.assign(header, blankHeader());
      lines.value = [blankLine()];
    }
  },
);

function addLine(): void {
  lines.value.push(blankLine());
}

function removeLine(idx: number): void {
  lines.value.splice(idx, 1);
}

function validate(): boolean {
  errors.id_spedizione = [];
  errors.items = "";
  let ok = true;
  if (!header.id_spedizione || header.id_spedizione <= 0) {
    errors.id_spedizione = [t("proforma.proforma.validation.shipmentRequired")];
    ok = false;
  }
  const meaningful = lines.value.filter(
    (l) => (l.descrizione ?? "").trim() !== "",
  );
  if (!meaningful.length) {
    errors.items = t("proforma.proforma.validation.noLines");
    ok = false;
  }
  return ok;
}

function buildPayload(): ProformaWritePayload {
  const items = lines.value.filter((l) => (l.descrizione ?? "").trim() !== "");
  return {
    id_spedizione: header.id_spedizione as number,
    iso_paese_origine: header.iso_paese_origine,
    motivo: header.motivo,
    id_valuta: header.id_valuta,
    data: header.data,
    items,
  };
}

async function submit(): Promise<void> {
  if (!validate()) return;
  const payload = buildPayload();
  if (props.proformaId) {
    await store.update(props.proformaId, payload);
    emit("saved", "updated");
  } else {
    await store.create(payload);
    emit("saved", "created");
  }
  close();
}

function close(): void {
  emit("update:modelValue", false);
}

function onDialogToggle(v: boolean): void {
  if (!v) close();
}
</script>

<style scoped>
.pf-dialog-title {
  font-size: 1.1rem;
  font-weight: 600;
}
.pf-items-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0 8px;
}
.pf-items-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}
.pf-items-error {
  color: rgb(var(--v-theme-error));
  font-size: 0.8rem;
  margin: 0 0 8px;
}
.pf-items-table :deep(th) {
  font-size: 0.72rem;
  white-space: nowrap;
}
.pf-col-xs {
  width: 90px;
}
.pf-col-sm {
  width: 130px;
}
.pf-col-act {
  width: 40px;
}
.pf-no-lines {
  text-align: center;
  color: var(--cm-text-secondary, #64748b);
  padding: 16px 0;
}
</style>
