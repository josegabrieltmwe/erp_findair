<template>
  <v-dialog
    :model-value="modelValue"
    max-width="760"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1">{{
        t("invoicing.actions.credit_note")
      }}</v-card-title>
      <v-card-text>
        <v-btn-toggle
          v-model="mode"
          mandatory
          density="comfortable"
          color="primary"
          variant="outlined"
          divided
          class="mb-4"
        >
          <v-btn value="full">{{ t("invoicing.invoice.credit.full") }}</v-btn>
          <v-btn value="partial" :disabled="creditLines.length === 0">{{
            t("invoicing.invoice.credit.partial")
          }}</v-btn>
        </v-btn-toggle>

        <div v-if="mode === 'partial'" class="mb-3">
          <p class="text-caption text-medium-emphasis mb-2">
            {{ t("invoicing.invoice.credit.partial_hint") }}
          </p>
          <v-table density="compact">
            <thead>
              <tr>
                <th style="width: 40px" />
                <th>{{ t("invoicing.invoice.credit.line") }}</th>
                <th class="text-right">
                  {{ t("invoicing.invoice.credit.line_net") }}
                </th>
                <th style="width: 130px">
                  {{ t("invoicing.invoice.credit.to_credit") }}
                </th>
                <th class="text-right">
                  {{ t("invoicing.invoice.credit.vat") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in creditLines" :key="l.id">
                <td>
                  <v-checkbox-btn v-model="l.selected" density="compact" />
                </td>
                <td>
                  {{ l.descriz }}
                  <span
                    v-if="l.aliquota !== null"
                    class="text-caption text-medium-emphasis"
                    >({{ l.aliquota }}%)</span
                  >
                </td>
                <td class="text-right">{{ fmt(l.maxNet) }}</td>
                <td>
                  <v-text-field
                    :model-value="l.net"
                    type="number"
                    min="0"
                    :max="l.maxNet"
                    step="0.01"
                    density="compact"
                    variant="outlined"
                    hide-details
                    :disabled="!l.selected"
                    @update:model-value="(v) => onNet(l, v)"
                  />
                </td>
                <td class="text-right">
                  {{ l.selected ? fmt(vatOf(l.net, l.aliquota)) : "" }}
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex justify-end ga-6 mt-3 text-body-2">
            <span
              >{{ t("invoicing.invoice.credit.total_net") }}:
              <strong>{{ fmt(totals.net) }}</strong></span
            >
            <span
              >{{ t("invoicing.invoice.credit.total_vat") }}:
              <strong>{{ fmt(totals.vat) }}</strong></span
            >
            <span
              >{{ t("invoicing.invoice.credit.total_gross") }}:
              <strong>{{ fmt(totals.gross) }}</strong></span
            >
          </div>
        </div>

        <div v-if="remaining" class="mb-3 text-body-2">
          <div>
            {{ t("invoicing.invoice.credit.already_credited") }}:
            <strong>{{ fmt(remaining.credited_netto) }}</strong>
            ({{ t("invoicing.invoice.credit.vat") }}
            {{ fmt(remaining.credited_iva) }})
          </div>
          <div>
            {{ t("invoicing.invoice.credit.still_creditable") }}:
            <strong>{{ fmt(remaining.remaining_netto) }}</strong>
            ({{ t("invoicing.invoice.credit.vat") }}
            {{ fmt(remaining.remaining_iva) }})
          </div>
          <v-alert
            v-for="i in issues"
            :key="i"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ t(`invoicing.invoice.credit.issue_${i}`) }}
          </v-alert>
        </div>
        <v-select
          v-model="motivo"
          :items="motivoOptions"
          item-title="label"
          item-value="value"
          :label="t('invoicing.invoice.credit.motivo')"
          density="comfortable"
          :rules="[(v) => !!v || t('common.required')]"
        />
        <v-textarea
          v-model="note"
          :label="t('invoicing.invoice.credit.note')"
          rows="2"
          density="comfortable"
          hide-details
        />
        <p class="text-caption text-medium-emphasis mt-2">
          {{
            mode === "partial"
              ? t("invoicing.invoice.credit.hint_partial")
              : t("invoicing.invoice.credit.hint")
          }}
        </p>
        <v-alert
          v-if="errorMsg"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-2"
        >
          {{ errorMsg }}
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{
          t("common.cancel")
        }}</v-btn>
        <v-btn
          color="error"
          :loading="saving"
          :disabled="!canSubmit"
          @click="submit"
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
import { einvoiceService } from "../../services/einvoice.service";
import type { InvoiceLine } from "../../services/invoice.service";
import {
  CREDIT_MOTIVI,
  buildCreditItems,
  capNet,
  creditErrors,
  creditLinesFrom,
  creditTotals,
  vatOf,
  type CreditLine,
} from "../../services/creditNote.logic";
import { remainingIssues, type CreditRemaining } from "../../services/creditNote.logic";
import { useToastStore } from "../../stores/toast.store";

const props = defineProps<{
  modelValue: boolean;
  invoiceId: number;
  /** Líneas de la factura original (dettagli) para el abono parcial. */
  lines?: InvoiceLine[];
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  created: [number];
}>();

const { t } = useI18n();
const toasts = useToastStore();

const mode = ref<"full" | "partial">("full");
const motivo = ref<string>("");
const note = ref<string>("");
const saving = ref(false);
const errorMsg = ref("");
const creditLines = ref<CreditLine[]>([]);
const remaining = ref<CreditRemaining | null>(null);

async function loadRemaining(): Promise<void> {
  remaining.value = null;
  if (!props.invoiceId) return;
  const id = props.invoiceId;
  try {
    const r = await einvoiceService.creditRemaining(id);
    if (id === props.invoiceId) remaining.value = r;
  } catch {
    remaining.value = null; // se oculta el bloque; el backend valida igualmente
  }
}

watch(
  () => [props.modelValue, props.lines] as const,
  ([open]) => {
    if (!open) return;
    creditLines.value = creditLinesFrom(props.lines ?? []);
    mode.value = "full";
    errorMsg.value = "";
    void loadRemaining();
  },
  { immediate: true },
);

// Motivos fiscales TD04: el valor (value) lo exige el backend sin traducir; la
// etiqueta (label) se muestra al usuario en su idioma.
const motivoOptions = computed(() =>
  CREDIT_MOTIVI.map((value) => ({
    value,
    label: t(`invoicing.invoice.credit.motivi.${value}`),
  })),
);

const totals = computed(() => creditTotals(creditLines.value));
const issues = computed(() =>
  remainingIssues(mode.value, totals.value, remaining.value),
);
const canSubmit = computed(
  () =>
    !!motivo.value &&
    issues.value.length === 0 &&
    (mode.value === "full" || creditErrors(creditLines.value).length === 0),
);

function fmt(v: number): string {
  return v.toFixed(2);
}

function onNet(l: CreditLine, v: unknown): void {
  l.net = capNet(Number(v), l.maxNet);
}

async function submit(): Promise<void> {
  if (!props.invoiceId || !canSubmit.value) return;
  saving.value = true;
  errorMsg.value = "";
  try {
    // Abono total: items vacíos → el backend copia las líneas de la original.
    const items =
      mode.value === "partial" ? buildCreditItems(creditLines.value) : [];
    const res = await einvoiceService.createCreditNote(
      props.invoiceId,
      items,
      motivo.value,
      note.value,
    );
    toasts.push("success", t("invoicing.invoice.credit.created"));
    emit("created", res.id);
    emit("update:modelValue", false);
  } catch (e) {
    // Incluye el 422 del servidor cuando se supera lo pendiente de acreditar.
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>
