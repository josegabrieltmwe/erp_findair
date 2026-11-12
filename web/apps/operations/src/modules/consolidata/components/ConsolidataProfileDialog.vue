<template>
  <v-dialog
    :model-value="modelValue"
    max-width="760"
    scrollable
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{
        t("consolidata.profile.title", { ref: shipment?.ref ?? "" })
      }}</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">{{ t("consolidata.profile.help") }}</p>
        <ConsolidataApiError :error="error" />
        <v-row dense>
          <v-col
            v-for="f in PROFILE_FIELDS"
            :key="f"
            cols="12"
            :sm="wide.includes(f) ? 12 : 6"
          >
            <v-select
              v-if="f === 'incoterm'"
              v-model="form[f]"
              :items="incoterms"
              :label="label(f)"
              clearable
              :error-messages="err(f)"
            />
            <v-textarea
              v-else-if="f === 'note'"
              v-model="form[f]"
              :label="label(f)"
              rows="2"
              auto-grow
              :error-messages="err(f)"
            />
            <v-text-field
              v-else
              v-model="form[f]"
              :label="label(f)"
              :maxlength="maxLength(f)"
              :error-messages="err(f)"
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
          :disabled="!hasChanges"
          @click="submit"
        >
          {{ t("consolidata.common.save") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import { useDialogErrorScope } from "../composables/useDialogErrorScope";
import {
  INCOTERMS,
  PROFILE_FIELDS,
  profileFormFrom,
  profilePayload,
  type ProfileField,
  type ProfileFormValues,
} from "../logic";
import type { ConsolidataError, Shipment } from "../types";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error: ConsolidataError | null;
  shipment: Shipment | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", idSped: number, payload: Record<string, string>): void;
}>();
const { t, te } = useI18n();
useDialogErrorScope(() => props.modelValue);

const incoterms: string[] = [...INCOTERMS];
/** Campos largos que ocupan la fila entera. */
const wide: readonly ProfileField[] = [
  "mittente_indirizzo",
  "destinatario_indirizzo",
  "note",
];
/** Límites del API (Consolidation_Shipment_Service::PROFILE_TEXT); el servidor valida igualmente. */
const MAX: Partial<Record<ProfileField, number>> = {
  esportatore_nome: 150,
  esportatore_paese: 2,
  orig_provincia: 100,
  mittente_indirizzo: 200,
  mittente_referente: 150,
  mittente_tel: 30,
  mittente_mail: 100,
  destinatario_nome: 150,
  destinatario_paese: 2,
  destinatario_indirizzo: 200,
  destinatario_cap: 20,
  destinatario_citta: 100,
  destinatario_provincia: 100,
  destinatario_referente: 150,
  destinatario_tel: 30,
  destinatario_mail: 100,
  hs_code: 20,
};

const initial = reactive<ProfileFormValues>(profileFormFrom(null));
const form = reactive<ProfileFormValues>(profileFormFrom(null));
const payload = computed(() => profilePayload(form, initial));
const hasChanges = computed(() => Object.keys(payload.value).length > 0);

function label(f: ProfileField): string {
  const key = `consolidata.profile.fields.${f}`;
  return te(key) ? t(key) : f;
}
function maxLength(f: ProfileField): number | undefined {
  return MAX[f];
}
function err(f: ProfileField): string[] | undefined {
  const m = props.error?.fields[`spedizione.profilo.${f}`];
  return m ? [m] : undefined;
}

function submit(): void {
  if (!props.shipment || !hasChanges.value) return;
  emit("submit", props.shipment.id, payload.value);
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const values = profileFormFrom(props.shipment?.profilo);
    Object.assign(initial, values);
    Object.assign(form, values);
  },
);
</script>
