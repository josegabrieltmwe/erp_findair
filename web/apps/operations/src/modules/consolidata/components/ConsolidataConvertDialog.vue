<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ t("consolidata.convert.title") }}</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">{{ t("consolidata.convert.help") }}</p>
        <ConsolidataApiError :error="error" />
        <v-autocomplete
          v-model="idCargo"
          :items="cargoItems"
          :loading="searching"
          item-title="label"
          item-value="id"
          variant="outlined"
          density="compact"
          clearable
          no-filter
          :label="t('consolidata.convert.cargoSearch')"
          :no-data-text="t('consolidata.convert.cargoNoData')"
          :hint="t('consolidata.convert.cargoId')"
          persistent-hint
          prepend-inner-icon="mdi-magnify"
          :error-messages="error?.fields.id_cargo"
          @update:search="onSearch"
        />

        <template v-if="result">
          <v-alert
            :type="result.completo ? 'success' : 'warning'"
            variant="tonal"
            class="mb-2"
          >
            {{
              result.completo
                ? t("consolidata.convert.complete")
                : t("consolidata.convert.incomplete", { n: result.pendientes })
            }}
          </v-alert>
          <v-table density="compact">
            <thead>
              <tr>
                <th>{{ t("consolidata.shipments.ref") }}</th>
                <th>{{ t("consolidata.convert.shipmentId") }}</th>
                <th>{{ t("consolidata.convert.result") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in result.houses" :key="h.ref">
                <td>{{ h.ref }}</td>
                <td>{{ h.id_spedizione ?? "—" }}</td>
                <td>
                  <v-chip v-if="h.success" size="small" color="success">
                    {{
                      h.idempotent
                        ? t("consolidata.convert.alreadyLinked")
                        : t("consolidata.convert.linked")
                    }}
                  </v-chip>
                  <v-chip v-else size="small" color="warning">
                    {{
                      h.pendiente ? t("consolidata.convert.noShipment") : h.code
                    }}
                  </v-chip>
                  <span v-if="h.error" class="text-caption ml-2">{{
                    h.error
                  }}</span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{
          t("consolidata.common.close")
        }}</v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!idCargo"
          @click="emit('submit', Number(idCargo))"
        >
          {{
            result
              ? t("consolidata.convert.retry")
              : t("consolidata.convert.run")
          }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import { useCargoSearch } from "../composables/useCargoSearch";
import { useDialogErrorScope } from "../composables/useDialogErrorScope";
import type { ConsolidataError, ConversionResult } from "../types";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error: ConsolidataError | null;
  result: ConversionResult | null;
  linkedCargo?: number | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", idCargo: number): void;
}>();
const { t } = useI18n();
const {
  items: cargoItems,
  searching,
  selected: idCargo,
  onSearch,
  reset,
} = useCargoSearch();
useDialogErrorScope(() => props.modelValue);

watch(
  () => props.modelValue,
  (open) => {
    if (open) reset(props.linkedCargo ?? null);
  },
);
</script>
