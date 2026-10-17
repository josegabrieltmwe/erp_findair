<template>
  <v-dialog
    :model-value="modelValue"
    max-width="900"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center">
        <v-icon
          icon="mdi-checkbox-multiple-marked-outline"
          size="20"
          class="me-2"
        />
        {{ t("invoicing.invoice.select.title") }}
      </v-card-title>

      <v-card-text>
        <!-- Cliente (autocomplete remoto: one-way + onPick + mergedItems). -->
        <v-autocomplete
          :model-value="clientId"
          :items="mergedItems"
          :loading="searching"
          item-title="label"
          item-value="id"
          :label="t('invoicing.invoice.client')"
          density="comfortable"
          variant="outlined"
          no-filter
          clearable
          hide-details
          class="mb-3"
          @update:search="onSearch"
          @update:model-value="onPick"
        />

        <!-- Rango de fechas -->
        <div class="d-flex ga-2 mb-3 align-center">
          <v-btn size="small" variant="tonal" @click="setPreviousMonth">
            {{ t("invoicing.invoice.range.prev_month") }}
          </v-btn>
          <v-text-field
            v-model="dal"
            :label="t('invoicing.invoice.filters.date_from')"
            type="date"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 180px"
          />
          <v-text-field
            v-model="al"
            :label="t('invoicing.invoice.filters.date_to')"
            type="date"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 180px"
          />
        </div>

        <!-- Listado seleccionable -->
        <div v-if="clientId">
          <v-data-table
            v-model="selectedIds"
            :headers="headers"
            :items="rows"
            :loading="loading"
            item-value="id"
            show-select
            density="comfortable"
            class="billable-table inv-table"
            :items-per-page="-1"
            hide-default-footer
          >
            <template #[`item.tipo`]="{ item }">
              <v-chip
                size="x-small"
                :color="item.tipo === 'cargo' ? 'indigo' : 'teal'"
                label
              >
                {{ item.tipo }}
              </v-chip>
            </template>
            <template #[`item.carico`]="{ item }">
              {{ money(item.carico) }}
            </template>
            <template #no-data>
              <div class="py-4 text-medium-emphasis">
                {{
                  loading
                    ? t("common.loading")
                    : t("invoicing.invoice.no_billable")
                }}
              </div>
            </template>
          </v-data-table>

          <!-- Total seleccionado -->
          <v-alert
            v-if="rows.length"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ selectedIds.length }} / {{ rows.length }} ·
            {{ t("invoicing.invoice.total") }}: {{ money(selectedTotal) }}
          </v-alert>
        </div>
        <div v-else class="text-medium-emphasis text-body-2 py-4">
          {{ t("invoicing.invoice.select.pick_client") }}
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
        <v-btn
          color="primary"
          :loading="generating"
          :disabled="selectedIds.length === 0"
          @click="generate"
        >
          {{ t("invoicing.invoice.select.generate") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { anagraficaService } from "../../services/anagrafica.service";
import {
  invoiceService,
  type BillableShipment,
} from "../../services/invoice.service";
import { useToastStore } from "../../stores/toast.store";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  created: [number];
}>();

const { t } = useI18n();
const router = useRouter();
const toasts = useToastStore();

interface ClientItem {
  id: number;
  label: string;
}

const clientId = ref<number | null>(null);
const clientItems = ref<ClientItem[]>([]);
const selectedClient = ref<ClientItem | null>(null);
const searching = ref(false);
const [defDal, defAl] = monthRange(-1);
const dal = ref(defDal);
const al = ref(defAl);
const rows = ref<BillableShipment[]>([]);
const selectedIds = ref<(number | string)[]>([]);
const loading = ref(false);
const generating = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const headers = computed(() => [
  { title: "#", key: "id", width: 110 },
  { title: t("invoicing.invoice.select.col_type"), key: "tipo", width: 90 },
  { title: t("invoicing.invoice.select.col_date"), key: "data_sped1" },
  { title: t("invoicing.invoice.select.col_ref"), key: "rif" },
  { title: "AWB", key: "awb" },
  { title: t("invoicing.invoice.select.col_colli"), key: "colli", width: 70 },
  {
    title: t("invoicing.invoice.manual.netto"),
    key: "carico",
    align: "end" as const,
    width: 120,
  },
]);

const mergedItems = computed<ClientItem[]>(() => {
  const items = [...clientItems.value];
  const sel = selectedClient.value;
  if (sel && !items.some((i) => i.id === sel.id)) items.unshift(sel);
  return items;
});

const selectedTotal = computed(() =>
  rows.value
    .filter((r) => selectedIds.value.includes(r.id))
    .reduce((s, r) => s + (Number(r.carico) || 0), 0),
);

function money(v: number): string {
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function monthRange(offset: number): [string, string] {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return [
    fmt(first.getFullYear(), first.getMonth(), 1),
    fmt(last.getFullYear(), last.getMonth(), last.getDate()),
  ];
}
function setPreviousMonth(): void {
  [dal.value, al.value] = monthRange(-1);
}

function onSearch(text: string): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = (text ?? "").trim();
    if (q.length < 2) {
      clientItems.value = [];
      return;
    }
    searching.value = true;
    try {
      const res = await anagraficaService.search(q);
      clientItems.value = res
        .filter((a) => Number(a.id) > 0)
        .map((a) => ({
          id: Number(a.id),
          label: (a.rag_soc || `Cliente #${a.id}`).toString().trim(),
        }));
    } catch {
      clientItems.value = [];
    } finally {
      searching.value = false;
    }
  }, 250);
}
function onPick(id: number | null): void {
  clientId.value = id;
  selectedClient.value = id
    ? (mergedItems.value.find((i) => i.id === id) ?? selectedClient.value)
    : null;
  if (id) void loadRows(id);
  else rows.value = [];
}

async function loadRows(id: number): Promise<void> {
  loading.value = true;
  rows.value = [];
  selectedIds.value = [];
  try {
    const res = await invoiceService.billableShipments(id, {
      data_da: dal.value,
      data_a: al.value,
    });
    rows.value = res.data?.[0]?.shipments ?? [];
    // Preselección: todas marcadas (facturar todo es el caso común).
    selectedIds.value = rows.value.map((r) => r.id);
  } catch (e) {
    toasts.push("error", String(e));
  } finally {
    loading.value = false;
  }
}

async function generate(): Promise<void> {
  if (!clientId.value || selectedIds.value.length === 0) return;
  generating.value = true;
  try {
    const res = await invoiceService.generateBatch({
      id_anagrafica: [clientId.value],
      shipment_ids: selectedIds.value.map((x) => Number(x)),
      data_fattura: today(),
      dal: dal.value,
      al: al.value,
    });
    const gen = res.generated;
    if (gen.length === 0) {
      toasts.push("warning", t("invoicing.invoice.no_billable"));
      return;
    }
    toasts.push(
      "success",
      `${gen.length} ${t("invoicing.invoice.title_plural").toLowerCase()}`,
    );
    emit("created", gen.length);
    close();
    const first = gen[0]?.id_fattura;
    if (first)
      router.push({ name: "invoicing-detail", params: { id: String(first) } });
  } catch (e) {
    toasts.push("error", String(e));
  } finally {
    generating.value = false;
  }
}

function close(): void {
  emit("update:modelValue", false);
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      [dal.value, al.value] = monthRange(-1);
    } else {
      clientId.value = null;
      clientItems.value = [];
      selectedClient.value = null;
      rows.value = [];
      selectedIds.value = [];
    }
  },
);
// Recargar el listado al cambiar el rango con un cliente elegido.
watch([dal, al], () => {
  if (clientId.value) void loadRows(clientId.value);
});
</script>

<style scoped lang="scss">
@use "../../styles/invoice_table" as inv;
.billable-table {
  max-height: 420px;
  overflow-y: auto;
}
.inv-table {
  @include inv.inv-table;
}
</style>
