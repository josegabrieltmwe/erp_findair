<template>
  <v-dialog
    :model-value="modelValue"
    max-width="760"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center">
        <v-icon icon="mdi-file-document-edit" size="20" class="me-2" />
        {{ t("invoicing.invoice.manual.title") }}
      </v-card-title>

      <v-card-text>
        <!-- Cliente (autocomplete remoto: one-way + onPick + mergedItems,
             regla feedback_vuetify_autocomplete_remote). -->
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

        <div class="d-flex ga-3 mb-3 align-start">
          <v-text-field
            v-model="dataFattura"
            :label="t('invoicing.invoice.filters.date_from')"
            type="date"
            density="comfortable"
            variant="outlined"
            hide-details
            style="max-width: 220px"
          />

          <!-- Serie de numeración. Solo se muestra si el partner tiene más de
               una: con una sola no hay nada que elegir. -->
          <v-select
            v-if="numberingEngines.length > 1"
            v-model="engineId"
            :items="engineItems"
            :label="t('invoicing.numbering.field.engine')"
            density="comfortable"
            variant="outlined"
            hide-details
            style="max-width: 260px"
          />

          <!-- El número definitivo se fija al guardar: entre el preview y el
               submit otra factura puede consumirlo. -->
          <div v-if="previewLabel" class="numbering-preview">
            <div class="text-caption text-medium-emphasis">
              {{ t("invoicing.numbering.preview_label") }}
            </div>
            <code class="numbering-preview-code">{{ previewLabel }}</code>
            <div class="text-caption text-medium-emphasis">
              {{ t("invoicing.numbering.preview_orientative") }}
            </div>
          </div>
        </div>

        <!-- Mezclar series dentro del mismo periodo fiscal es lo que una
             inspección lee como numeración no progresiva. Se avisa antes de
             guardar; el operador decide (puede haber motivos legítimos). -->
        <v-alert
          v-if="mixingWarning"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ mixingWarning }}
        </v-alert>

        <!-- Líneas editables -->
        <div class="text-subtitle-2 mb-1">
          {{ t("invoicing.invoice.manual.lines") }}
        </div>
        <v-table density="comfortable" class="mb-2 inv-table">
          <thead>
            <tr>
              <th>{{ t("invoicing.invoice.manual.description") }}</th>
              <th style="width: 120px">
                {{ t("invoicing.invoice.manual.netto") }}
              </th>
              <th style="width: 90px">
                {{ t("invoicing.invoice.manual.vat_pct") }}
              </th>
              <th style="width: 120px">
                {{ t("invoicing.invoice.manual.vat_amount") }}
              </th>
              <th style="width: 90px">
                {{ t("invoicing.invoice.manual.vat_code") }}
              </th>
              <th style="width: 40px" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, i) in lines" :key="i">
              <td>
                <v-text-field
                  v-model="line.descriz"
                  density="compact"
                  variant="plain"
                  hide-details
                />
              </td>
              <td>
                <v-text-field
                  v-model.number="line.importo_netto"
                  type="number"
                  density="compact"
                  variant="plain"
                  hide-details
                  @update:model-value="recalcLine(line)"
                />
              </td>
              <td>
                <v-text-field
                  v-model.number="line.aliquota_iva"
                  type="number"
                  density="compact"
                  variant="plain"
                  hide-details
                  @update:model-value="recalcLine(line)"
                />
              </td>
              <td>
                <v-text-field
                  v-model.number="line.importo_iva"
                  type="number"
                  density="compact"
                  variant="plain"
                  hide-details
                />
              </td>
              <td>
                <v-text-field
                  v-model="line.cod_iva"
                  density="compact"
                  variant="plain"
                  hide-details
                />
              </td>
              <td>
                <v-btn
                  icon="mdi-delete"
                  size="x-small"
                  variant="text"
                  @click="removeLine(i)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
        <v-btn
          size="small"
          variant="tonal"
          prepend-icon="mdi-plus"
          class="mb-3"
          @click="addLine"
        >
          {{ t("invoicing.invoice.manual.add_line") }}
        </v-btn>

        <!-- Totales en vivo -->
        <v-alert type="info" variant="tonal" density="compact">
          {{ t("invoicing.invoice.manual.netto") }}: {{ money(totalNetto) }} ·
          {{ t("invoicing.invoice.manual.vat_amount") }}:
          {{ money(totalIva) }} · {{ t("invoicing.invoice.total") }}:
          {{ money(totalNetto + totalIva) }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
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
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { anagraficaService } from "../../services/anagrafica.service";
import { invoiceService } from "../../services/invoice.service";
import {
  numberingService,
  type NumberingEngine,
} from "../../services/numbering.service";
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
interface ManualLine {
  descriz: string;
  importo_netto: number;
  aliquota_iva: number;
  importo_iva: number;
  cod_iva: string;
}

const clientId = ref<number | null>(null);
const clientItems = ref<ClientItem[]>([]);
const selectedClient = ref<ClientItem | null>(null);
const searching = ref(false);
const dataFattura = ref(today());
const saving = ref(false);
const lines = ref<ManualLine[]>([emptyLine()]);

// Series de numeración del partner. El operador elige cuál usar; con una sola
// el selector se oculta y se usa la que venga por defecto.
const numberingEngines = ref<NumberingEngine[]>([]);
const engineId = ref<number | null>(null);
const previewLabel = ref<string>("");
/** Aviso si en este periodo ya se emitió con otra serie. Vacío = sin mezcla. */
const mixingWarning = ref<string>("");

const engineItems = computed(() =>
  numberingEngines.value.map((e) => ({
    value: e.id,
    title: e.is_default === "S" ? `${e.label} ★` : e.label,
  })),
);

let searchTimer: ReturnType<typeof setTimeout> | null = null;

const mergedItems = computed<ClientItem[]>(() => {
  const items = [...clientItems.value];
  const sel = selectedClient.value;
  if (sel && !items.some((i) => i.id === sel.id)) items.unshift(sel);
  return items;
});

const totalNetto = computed(() =>
  lines.value.reduce((s, l) => s + (Number(l.importo_netto) || 0), 0),
);
const totalIva = computed(() =>
  lines.value.reduce((s, l) => s + (Number(l.importo_iva) || 0), 0),
);
const canSave = computed(
  () =>
    !!clientId.value &&
    lines.value.some(
      (l) => l.descriz.trim() !== "" && Number(l.importo_netto) !== 0,
    ),
);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function money(v: number): string {
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}
function emptyLine(): ManualLine {
  return {
    descriz: "",
    importo_netto: 0,
    aliquota_iva: 22,
    importo_iva: 0,
    cod_iva: "21",
  };
}
function addLine(): void {
  lines.value.push(emptyLine());
}
function removeLine(i: number): void {
  lines.value.splice(i, 1);
  if (lines.value.length === 0) lines.value.push(emptyLine());
}
/** IVA sugerida = netto × %; el operador puede sobrescribirla. */
function recalcLine(line: ManualLine): void {
  const netto = Number(line.importo_netto) || 0;
  const pct = Number(line.aliquota_iva) || 0;
  line.importo_iva = Math.round(netto * (pct / 100) * 100) / 100;
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
      const rows = await anagraficaService.search(q);
      clientItems.value = rows
        .filter((a) => Number(a.id) > 0)
        .map((a) => ({
          id: Number(a.id),
          label: (a.rag_soc || a.nome_breve || `Cliente #${a.id}`)
            .toString()
            .trim(),
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
}

async function save(): Promise<void> {
  if (!canSave.value || !clientId.value) return;
  saving.value = true;
  try {
    const payload = {
      id_anagrafica: clientId.value,
      data_fattura: dataFattura.value,
      tipo_fattura: "A",
      valuta_sigla: "EUR",
      // Serie elegida. Si se omite, el backend usa el motor por defecto del
      // partner y, si no tiene ninguno, cae al MAX+1 legacy.
      ...(engineId.value ? { id_numbering_engine: engineId.value } : {}),
      lines: lines.value
        .filter((l) => l.descriz.trim() !== "" || Number(l.importo_netto) !== 0)
        .map((l) => ({
          tipo_record: "M",
          descriz: l.descriz,
          importo_netto: Number(l.importo_netto) || 0,
          importo_iva: Number(l.importo_iva) || 0,
          aliquota_iva: Number(l.aliquota_iva) || 0,
          cod_iva: l.cod_iva,
        })),
    };
    const inv = await invoiceService.createManual(payload);
    toasts.push("success", t("invoicing.invoice.manual.created"));
    emit("created", Number(inv.id));
    close();
    if (inv.id)
      router.push({ name: "invoicing-detail", params: { id: String(inv.id) } });
  } catch (e) {
    toasts.push("error", String(e));
  } finally {
    saving.value = false;
  }
}

function close(): void {
  emit("update:modelValue", false);
}

/** Series disponibles para facturas activas. Falla en silencio: el selector es
 *  opcional y el backend resuelve el motor por defecto si no se envía. */
async function loadEngines(): Promise<void> {
  try {
    const rows = await numberingService.list("A");
    numberingEngines.value = rows;
    engineId.value =
      rows.find((e) => e.is_default === "S")?.id ?? rows[0]?.id ?? null;
  } catch {
    numberingEngines.value = [];
    engineId.value = null;
  }
}

/** Preview del próximo número. Orientativo: el definitivo se fija al guardar. */
async function refreshPreview(): Promise<void> {
  try {
    const pv = await numberingService.preview(
      "A",
      dataFattura.value,
      engineId.value ?? undefined,
    );
    previewLabel.value = pv.numero_formattato ?? String(pv.next_numero);
    mixingWarning.value = pv.mixing
      ? t("invoicing.numbering.warn.mixing", {
          series: (pv.mixing_engines ?? [])
            .map((e) => `${e.label} (${e.n})`)
            .join(", "),
        })
      : "";
  } catch {
    previewLabel.value = "";
    mixingWarning.value = "";
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      clientId.value = null;
      clientItems.value = [];
      selectedClient.value = null;
      dataFattura.value = today();
      lines.value = [emptyLine()];
      previewLabel.value = "";
      mixingWarning.value = "";
      void loadEngines().then(() => refreshPreview());
    }
  },
);

// El número depende del motor y de la fecha (periodos mensuales).
watch([engineId, dataFattura], () => {
  if (props.modelValue) void refreshPreview();
});
</script>

<style scoped lang="scss">
@use "../../styles/invoice_table" as inv;
.inv-table {
  @include inv.inv-table;
}

.numbering-preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 4px;
}

.numbering-preview-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  align-self: flex-start;
}
</style>
