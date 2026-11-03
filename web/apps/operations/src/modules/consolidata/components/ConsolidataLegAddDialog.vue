<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ t("consolidata.legs.addTitle") }}</v-card-title>
      <v-card-text>
        <ConsolidataApiError :error="error" />
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-select
              v-model="form.tipo"
              :items="LEG_TYPES"
              :label="t('consolidata.legs.type')"
              :error-messages="err('leg.tipo')"
            />
          </v-col>
          <v-col cols="6" sm="4">
            <v-text-field
              v-model.number="form.weight"
              :label="t('consolidata.legs.weight')"
              type="number"
              min="0"
              step="0.01"
              :error-messages="err('leg.weight')"
            />
          </v-col>
          <v-col cols="6" sm="4">
            <v-text-field
              v-model.number="form.value"
              :label="t('consolidata.legs.value')"
              type="number"
              min="0"
              step="0.01"
              :error-messages="err('leg.value')"
            />
          </v-col>
          <template v-for="side in SIDES" :key="side">
            <v-col cols="12" class="pb-0">
              <div class="text-caption text-medium-emphasis">
                {{
                  side === "origin"
                    ? t("consolidata.legs.origin")
                    : t("consolidata.legs.destination")
                }}
              </div>
            </v-col>
            <v-col cols="3" sm="2">
              <v-text-field
                v-model="form[side].country"
                :label="t('consolidata.legs.country')"
                maxlength="2"
                :error-messages="err(`leg.${side}.country`)"
              />
            </v-col>
            <v-col cols="4" sm="3">
              <v-text-field
                v-model="form[side].zip"
                :label="t('consolidata.legs.zip')"
                :error-messages="err(`leg.${side}.zip`)"
              />
            </v-col>
            <v-col cols="5" sm="4">
              <v-text-field
                v-model="form[side].city"
                :label="t('consolidata.legs.city')"
                :error-messages="err(`leg.${side}.city`)"
              />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field
                v-model="form[side].terminal"
                :label="t('consolidata.legs.terminal')"
                maxlength="5"
                :hint="
                  form.tipo === 'AIR'
                    ? t('consolidata.legs.terminalRequired')
                    : ''
                "
                :error-messages="err(`leg.${side}.terminal`)"
              />
            </v-col>
          </template>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.goods"
              :label="t('consolidata.legs.goods')"
              :error-messages="err('leg.goods')"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.note"
              :label="t('consolidata.legs.note')"
            />
          </v-col>
          <template v-if="needsManualPrice || (canManualPrice && manual)">
            <v-col cols="12" class="pb-0">
              <div class="text-caption text-medium-emphasis">
                {{ t("consolidata.legs.manualPrice") }}
              </div>
            </v-col>
            <v-col cols="4">
              <v-text-field
                v-model.number="form.prezzo"
                :label="t('consolidata.legs.price')"
                type="number"
                min="0"
                step="0.01"
                :error-messages="err('leg.manual_price')"
              />
            </v-col>
            <v-col cols="4">
              <v-text-field
                v-model.number="form.fuel"
                :label="t('consolidata.legs.fuel')"
                type="number"
                min="0"
                step="0.01"
              />
            </v-col>
            <v-col cols="4">
              <v-text-field
                v-model.number="form.supplementi"
                :label="t('consolidata.legs.surcharges')"
                type="number"
                min="0"
                step="0.01"
              />
            </v-col>
          </template>
          <v-col v-if="canManualPrice && !needsManualPrice" cols="12">
            <v-checkbox
              v-model="manual"
              :label="t('consolidata.legs.useManualPrice')"
              density="compact"
              hide-details
            />
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{
          t("consolidata.common.cancel")
        }}</v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!valid"
          @click="submit"
          >{{ t("consolidata.common.save") }}</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import { useDialogErrorScope } from "../composables/useDialogErrorScope";
import { LEG_TYPES, type ConsolidataError, type LegPayload } from "../types";
import { legPayload, type LegForm } from "../logic";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error: ConsolidataError | null;
  /** El precio manual solo lo fija el staff con `override_price` (G1). */
  canManualPrice: boolean;
  defaults?: Partial<LegForm>;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", leg: LegPayload): void;
}>();
const { t } = useI18n();
useDialogErrorScope(() => props.modelValue);

const SIDES = ["origin", "destination"] as const;

const blank = (): LegForm => ({
  tipo: "AIR",
  origin: { country: "", zip: "", city: "", terminal: "" },
  destination: { country: "", zip: "", city: "", terminal: "" },
  weight: null,
  value: null,
  goods: "",
  note: "",
  prezzo: null,
  fuel: null,
  supplementi: null,
});
const form = reactive<LegForm>(blank());
const manual = ref(false);
const needsManualPrice = computed(() => form.tipo === "TRANSIT");
const valid = computed(
  () =>
    Number(form.weight) > 0 &&
    form.origin.country.trim().length === 2 &&
    form.destination.country.trim().length === 2,
);

function err(field: string): string[] | undefined {
  const m = props.error?.fields[field];
  return m ? [m] : undefined;
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const b = blank();
    Object.assign(form, b, props.defaults ?? {}, {
      origin: { ...b.origin, ...(props.defaults?.origin ?? {}) },
      destination: { ...b.destination, ...(props.defaults?.destination ?? {}) },
    });
    manual.value = false;
  },
);

function submit(): void {
  emit("submit", legPayload(form, manual.value || needsManualPrice.value));
}
</script>
