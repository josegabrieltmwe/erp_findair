<template>
  <v-dialog
    :model-value="modelValue"
    max-width="900"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center">
        <v-icon icon="mdi-receipt-text-arrow-left" size="20" class="me-2" />
        {{ t("invoicing.invoice.supplier.title") }}
      </v-card-title>

      <v-tabs v-model="mode" density="compact" color="primary">
        <v-tab value="xml">{{ t("invoicing.xml.tab_upload") }}</v-tab>
        <v-tab value="manual">{{ t("invoicing.xml.tab_manual") }}</v-tab>
      </v-tabs>

      <v-card-text v-if="mode === 'xml'">
        <SupplierXmlImport v-if="modelValue" @imported="onImported" />
      </v-card-text>

      <v-card-text v-else>
        <!-- Proveedor (autocomplete remoto: one-way + onPick). -->
        <v-autocomplete
          :model-value="supplierId"
          :items="mergedItems"
          :loading="searching"
          item-title="label"
          item-value="id"
          :label="t('invoicing.invoice.supplier.provider')"
          density="comfortable"
          variant="outlined"
          no-filter
          clearable
          hide-details
          class="mb-3"
          @update:search="onSearch"
          @update:model-value="onPick"
        />

        <div class="d-flex ga-2 mb-3">
          <v-text-field
            v-model="numeroAlfanum"
            :label="t('invoicing.invoice.supplier.external_number')"
            density="comfortable"
            variant="outlined"
            hide-details
            :hint="t('invoicing.invoice.supplier.external_number_hint')"
            persistent-hint
          />
          <v-text-field
            v-model="dataFattura"
            :label="t('invoicing.invoice.filters.date_from')"
            type="date"
            density="comfortable"
            variant="outlined"
            hide-details
            style="max-width: 200px"
          />
        </div>

        <div class="d-flex ga-2 mb-3">
          <v-text-field
            v-model.number="importoNetto"
            :label="t('invoicing.invoice.manual.netto')"
            type="number"
            density="comfortable"
            variant="outlined"
            hide-details
          />
          <v-text-field
            v-model.number="importoIva"
            :label="t('invoicing.invoice.manual.vat_amount')"
            type="number"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </div>

        <!-- Distribución de coste (quotes) -->
        <div class="text-subtitle-2 mb-1">
          {{ t("invoicing.invoice.supplier.cost_distribution") }}
        </div>
        <v-table density="comfortable" class="mb-2 inv-table">
          <thead>
            <tr>
              <th style="width: 120px">
                {{ t("invoicing.invoice.supplier.year") }}
              </th>
              <th style="width: 140px">
                {{ t("invoicing.invoice.manual.netto") }}
              </th>
              <th style="width: 140px">
                {{ t("invoicing.invoice.supplier.account") }}
              </th>
              <th style="width: 40px" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(q, i) in quotes" :key="i">
              <td>
                <v-text-field
                  v-model.number="q.anno"
                  type="number"
                  density="compact"
                  variant="plain"
                  hide-details
                />
              </td>
              <td>
                <v-text-field
                  v-model.number="q.importo_netto"
                  type="number"
                  density="compact"
                  variant="plain"
                  hide-details
                />
              </td>
              <td><CmPianoContoAutocomplete v-model="q.id_piano_conto" /></td>
              <td>
                <v-btn
                  icon="mdi-delete"
                  size="x-small"
                  variant="text"
                  @click="removeQuote(i)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
        <v-btn
          size="small"
          variant="tonal"
          prepend-icon="mdi-plus"
          class="mb-2"
          @click="addQuote"
        >
          {{ t("invoicing.invoice.supplier.add_quote") }}
        </v-btn>

        <!-- Aviso si la suma de quotes no cuadra con el neto -->
        <v-alert
          v-if="quotesTotal > 0"
          :type="quotesMatch ? 'success' : 'warning'"
          variant="tonal"
          density="compact"
        >
          {{ t("invoicing.invoice.supplier.quotes_total") }}:
          {{ money(quotesTotal) }} /
          {{ money(importoNetto) }}
          <span v-if="!quotesMatch">
            — {{ t("invoicing.invoice.supplier.quotes_mismatch") }}</span
          >
        </v-alert>
      </v-card-text>

      <v-card-actions v-if="mode === 'manual'">
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!canSave"
          @click="save"
        >
          {{ t("common.save") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { anagraficaService } from "../../services/anagrafica.service";
import { invoiceService } from "../../services/invoice.service";
import CmPianoContoAutocomplete from "../../components/invoice/CmPianoContoAutocomplete.vue";
import SupplierXmlImport from "./SupplierXmlImport.vue";
import { useRouter } from "vue-router";
import { useToastStore } from "../../stores/toast.store";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  created: [number];
}>();

const { t } = useI18n();
const toasts = useToastStore();
const router = useRouter();
const mode = ref<"xml" | "manual">("xml");

function onImported(id: number): void {
  emit("created", id);
  close();
  void router.push({ name: "invoicing-detail", params: { id: String(id) } });
}

interface ProviderItem {
  id: number;
  label: string;
}
interface Quote {
  anno: number;
  importo_netto: number;
  id_piano_conto: number;
}

const supplierId = ref<number | null>(null);
const providerItems = ref<ProviderItem[]>([]);
const selectedProvider = ref<ProviderItem | null>(null);
const searching = ref(false);
const numeroAlfanum = ref("");
const dataFattura = ref(today());
const importoNetto = ref(0);
const importoIva = ref(0);
const quotes = ref<Quote[]>([emptyQuote()]);
const saving = ref(false);

let searchTimer: ReturnType<typeof setTimeout> | null = null;

const mergedItems = computed<ProviderItem[]>(() => {
  const items = [...providerItems.value];
  const sel = selectedProvider.value;
  if (sel && !items.some((i) => i.id === sel.id)) items.unshift(sel);
  return items;
});

const quotesTotal = computed(() =>
  quotes.value.reduce((s, q) => s + (Number(q.importo_netto) || 0), 0),
);
const quotesMatch = computed(
  () => Math.abs(quotesTotal.value - (Number(importoNetto.value) || 0)) < 0.01,
);
const canSave = computed(
  () => !!supplierId.value && Number(importoNetto.value) > 0,
);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function money(v: number): string {
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}
function emptyQuote(): Quote {
  return {
    anno: new Date().getFullYear(),
    importo_netto: 0,
    id_piano_conto: 0,
  };
}
function addQuote(): void {
  quotes.value.push(emptyQuote());
}
function removeQuote(i: number): void {
  quotes.value.splice(i, 1);
  if (quotes.value.length === 0) quotes.value.push(emptyQuote());
}

function onSearch(text: string): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = (text ?? "").trim();
    if (q.length < 2) {
      providerItems.value = [];
      return;
    }
    searching.value = true;
    try {
      const rows = await anagraficaService.search(q);
      providerItems.value = rows
        .filter((a) => Number(a.id) > 0)
        .map((a) => ({
          id: Number(a.id),
          label: (a.rag_soc || a.nome_breve || `#${a.id}`).toString().trim(),
        }));
    } catch {
      providerItems.value = [];
    } finally {
      searching.value = false;
    }
  }, 250);
}
function onPick(id: number | null): void {
  supplierId.value = id;
  selectedProvider.value = id
    ? (mergedItems.value.find((i) => i.id === id) ?? selectedProvider.value)
    : null;
}

async function save(): Promise<void> {
  if (!canSave.value || !supplierId.value) return;
  saving.value = true;
  try {
    const inv = await invoiceService.createSupplier({
      id_anagrafica: supplierId.value,
      data_fattura: dataFattura.value,
      numero_alfanum: numeroAlfanum.value.trim(),
      importo_netto: Number(importoNetto.value) || 0,
      importo_iva: Number(importoIva.value) || 0,
      valuta_sigla: "EUR",
      quotes: quotes.value
        .filter(
          (q) =>
            Number(q.anno) !== 0 ||
            Number(q.importo_netto) !== 0 ||
            Number(q.id_piano_conto) !== 0,
        )
        .map((q) => ({
          anno: Number(q.anno) || 0,
          importo_netto: Number(q.importo_netto) || 0,
          id_piano_conto: Number(q.id_piano_conto) || 0,
        })),
    });
    toasts.push("success", t("invoicing.invoice.supplier.created"));
    emit("created", Number(inv.id));
    close();
  } catch (e) {
    toasts.push("error", String(e));
  } finally {
    saving.value = false;
  }
}

function close(): void {
  emit("update:modelValue", false);
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      mode.value = "xml";
      supplierId.value = null;
      providerItems.value = [];
      selectedProvider.value = null;
      numeroAlfanum.value = "";
      dataFattura.value = today();
      importoNetto.value = 0;
      importoIva.value = 0;
      quotes.value = [emptyQuote()];
    }
  },
);
</script>

<style scoped lang="scss">
@use "../../styles/invoice_table" as inv;
.inv-table {
  @include inv.inv-table;
}
</style>
