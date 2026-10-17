<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  downloadDistinta,
  fetchCodClients,
  type DistintaFormat,
} from "../services/cod.service";
import type { Carrier } from "../types";

const { t } = useI18n();

/**
 * The clients that actually take COD, not carriers. SIFARMA is a client; the
 * carrier picker (api_selectable_carriers) never listed it, which is why this
 * loads its own source.
 */
const clients = ref<Carrier[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    clients.value = await fetchCodClients();
  } catch {
    error.value = t("errors.load_failed");
  } finally {
    loading.value = false;
  }
});

const idCliente = ref<number | null>(null);
const from = ref<string>("");
const to = ref<string>("");
const billNo = ref<string>("");

/**
 * XLSX by default: it is what SIFARMA's analysts open, and CONTRASSEGNO
 * arrives as a numeric cell they can sum. CSV stays available for whoever
 * feeds the file to a script.
 */
const format = ref<DistintaFormat>("xlsx");

const busy = ref(false);
const error = ref<string | null>(null);
const done = ref(false);

/**
 * Falta el periodo y no hay bill_no que lo sustituya.
 *
 * Sirve para dos cosas: marcar en rojo el campo que falta y deshabilitar la
 * descarga, de modo que la regla se ve ANTES de pulsar y no como un 400.
 */
const rangeMissing = computed(
  () => !billNo.value && (!from.value || !to.value),
);

async function generate(): Promise<void> {
  error.value = null;
  done.value = false;

  if (!idCliente.value) {
    error.value = t("cod_assegni.export.pick_client");
    return;
  }
  // Mismo criterio que el backend: el periodo es obligatorio salvo que se pida
  // una distinta concreta por bill_no. Sin ninguno de los dos el fichero barre
  // todo el histórico del cliente y no corresponde a ninguna remesa real.
  if (!billNo.value && (!from.value || !to.value)) {
    error.value = t("cod_assegni.export.range_required");
    return;
  }
  if (from.value && to.value && from.value > to.value) {
    error.value = t("cod_assegni.export.bad_range");
    return;
  }

  busy.value = true;
  try {
    await downloadDistinta({
      idCliente: idCliente.value,
      from: from.value || undefined,
      to: to.value || undefined,
      billNo: billNo.value || undefined,
      format: format.value,
    });
    done.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action_failed");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <v-card variant="outlined" max-width="640">
    <v-card-title class="text-subtitle-1">{{
      t("cod_assegni.export.title")
    }}</v-card-title>
    <v-card-text>
      <p class="text-body-2 text-medium-emphasis mb-4">
        {{ t("cod_assegni.export.subtitle") }}
      </p>

      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        {{ error }}
      </v-alert>
      <v-alert
        v-if="done"
        type="success"
        variant="tonal"
        density="compact"
        closable
        class="mb-4"
        @click:close="done = false"
      >
        {{ t("cod_assegni.export.done") }}
      </v-alert>

      <v-select
        v-model="idCliente"
        :items="clients"
        item-title="label"
        item-value="id"
        :label="t('cod_assegni.export.client')"
        :loading="loading"
        density="comfortable"
        variant="outlined"
        clearable
        class="mb-4"
      />

      <!-- Obligatorios mientras no se indique bill_no: el asterisco aparece y
           desaparece según lo que el operador ya haya rellenado, en vez de
           pedir siempre las dos cosas. -->
      <div class="d-flex ga-3 mb-1">
        <v-text-field
          v-model="from"
          :label="t('cod_assegni.export.from')"
          type="date"
          density="comfortable"
          variant="outlined"
          hide-details
          :error="rangeMissing && !from"
        >
          <template #label>
            {{ t("cod_assegni.export.from") }}
            <span v-if="!billNo" class="text-error">*</span>
          </template>
        </v-text-field>
        <v-text-field
          v-model="to"
          :label="t('cod_assegni.export.to')"
          type="date"
          density="comfortable"
          variant="outlined"
          hide-details
          :error="rangeMissing && !to"
        >
          <template #label>
            {{ t("cod_assegni.export.to") }}
            <span v-if="!billNo" class="text-error">*</span>
          </template>
        </v-text-field>
      </div>
      <p class="text-caption text-medium-emphasis mb-4">
        {{ t("cod_assegni.export.range_hint") }}
      </p>

      <v-text-field
        v-model="billNo"
        :label="t('cod_assegni.export.bill_no')"
        :hint="t('cod_assegni.export.bill_no_hint')"
        persistent-hint
        density="comfortable"
        variant="outlined"
        class="mb-4"
      />

      <!-- Same 13 columns either way; only the file differs. -->
      <v-btn-toggle
        v-model="format"
        mandatory
        density="compact"
        variant="outlined"
        divided
        class="mb-4 export-format"
      >
        <v-btn value="xlsx" size="small" prepend-icon="mdi-file-excel-outline">
          {{ t("cod_assegni.export.format_xlsx") }}
        </v-btn>
        <v-btn
          value="csv"
          size="small"
          prepend-icon="mdi-file-delimited-outline"
        >
          {{ t("cod_assegni.export.format_csv") }}
        </v-btn>
      </v-btn-toggle>

      <!-- One row per cheque: a shipment with several cheques becomes several
           rows. Said out loud so the analyst is not surprised by the count. -->
      <p class="text-caption text-medium-emphasis mb-4">
        {{ t("cod_assegni.export.note_rows") }}
      </p>

      <v-btn
        color="primary"
        variant="flat"
        :prepend-icon="
          format === 'xlsx'
            ? 'mdi-file-excel-outline'
            : 'mdi-file-delimited-outline'
        "
        :loading="busy"
        :disabled="!idCliente || rangeMissing"
        @click="generate"
      >
        {{ t("cod_assegni.export.generate") }}
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.export-format {
  width: 100%;
}

.export-format :deep(.v-btn) {
  flex: 1;
}
</style>
