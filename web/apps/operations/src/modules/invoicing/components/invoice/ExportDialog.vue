<template>
  <v-dialog
    :model-value="modelValue"
    max-width="460"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1">{{
        kind === "intra"
          ? t("invoicing.exports.intra")
          : t("invoicing.exports.balance")
      }}</v-card-title>
      <v-card-text>
        <template v-if="kind === 'intra'">
          <div class="d-flex ga-3">
            <v-text-field
              v-model.number="year"
              type="number"
              :label="t('invoicing.exports.year')"
              density="comfortable"
              @update:model-value="applyQuarter"
            />
            <v-select
              v-model="quarter"
              :items="quarterItems"
              item-title="label"
              item-value="value"
              :label="t('invoicing.exports.quarter')"
              density="comfortable"
              clearable
              @update:model-value="applyQuarter"
            />
          </div>
          <div class="d-flex ga-3">
            <v-text-field
              v-model="desde"
              type="date"
              :label="t('invoicing.exports.from')"
              density="comfortable"
              @update:model-value="quarter = null"
            />
            <v-text-field
              v-model="hasta"
              type="date"
              :label="t('invoicing.exports.to')"
              density="comfortable"
              @update:model-value="quarter = null"
            />
          </div>
          <v-text-field
            v-model="pais"
            :label="t('invoicing.exports.country')"
            :hint="t('invoicing.exports.country_hint')"
            persistent-hint
            maxlength="2"
            density="comfortable"
          />
        </template>
        <template v-else>
          <v-select
            v-model="type"
            :items="typeItems"
            item-title="label"
            item-value="value"
            :label="t('invoicing.exports.type')"
            density="comfortable"
          />
          <div class="d-flex ga-3">
            <v-text-field
              v-model.number="year"
              type="number"
              :label="t('invoicing.exports.year')"
              density="comfortable"
            />
            <v-select
              v-model="format"
              :items="['xlsx', 'csv']"
              :label="t('invoicing.exports.format')"
              density="comfortable"
            />
          </div>
        </template>
        <v-alert v-if="errorMsg" type="error" variant="tonal" density="compact">
          {{ errorMsg }}
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{
          t("common.cancel")
        }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-download"
          :loading="busy"
          :disabled="!valid"
          @click="download"
        >
          {{ t("invoicing.exports.download") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  invoiceExportService,
  quarterRange,
  type BalanceFormat,
  type BalanceType,
} from "../../services/invoiceExport.service";

const props = defineProps<{ modelValue: boolean; kind: "intra" | "balance" }>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const { t } = useI18n();

const thisYear = new Date().getFullYear();
const year = ref<number>(thisYear);
const quarter = ref<1 | 2 | 3 | 4 | null>(null);
const desde = ref("");
const hasta = ref("");
const pais = ref("");
const type = ref<BalanceType>("active");
const format = ref<BalanceFormat>("xlsx");
const busy = ref(false);
const errorMsg = ref("");

const quarterItems = [1, 2, 3, 4].map((q) => ({ value: q, label: `Q${q}` }));
const typeItems = computed(() => [
  { value: "active", label: t("invoicing.exports.type_active") },
  { value: "passive", label: t("invoicing.exports.type_passive") },
]);

watch(
  () => props.modelValue,
  (open) => {
    if (open) errorMsg.value = "";
  },
);

function applyQuarter(): void {
  if (!quarter.value || !year.value) return;
  const r = quarterRange(Number(year.value), quarter.value);
  desde.value = r.desde;
  hasta.value = r.hasta;
}

const valid = computed(() => {
  const y = Number(year.value);
  if (props.kind === "intra") return !!desde.value && !!hasta.value;
  return y >= 2000 && y <= 2099;
});

async function download(): Promise<void> {
  busy.value = true;
  errorMsg.value = "";
  try {
    const file =
      props.kind === "intra"
        ? await invoiceExportService.intraEu(desde.value, hasta.value, pais.value)
        : await invoiceExportService.balance(type.value, Number(year.value), format.value);
    invoiceExportService.save(file);
    emit("update:modelValue", false);
  } catch (e) {
    errorMsg.value =
      e instanceof Error && e.message !== "EMPTY_EXPORT"
        ? e.message
        : t("invoicing.exports.empty");
  } finally {
    busy.value = false;
  }
}
</script>
