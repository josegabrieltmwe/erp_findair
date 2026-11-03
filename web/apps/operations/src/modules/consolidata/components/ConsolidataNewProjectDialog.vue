<template>
  <v-dialog
    :model-value="modelValue"
    max-width="620"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ t("consolidata.create.title") }}</v-card-title>
      <v-card-text>
        <ConsolidataApiError :error="error" @close="error = null" />
        <ConsolidataClientPicker
          v-model="form.id_cliente"
          :label="t('filters.group.client')"
          :error-messages="fieldErr('id_cliente')"
          class="mb-2"
        />
        <v-text-field
          v-model="form.titolo"
          :label="t('consolidata.create.titolo')"
          maxlength="255"
          :error-messages="fieldErr('titolo')"
        />
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-select
              v-model="form.tipo"
              :items="typeItems"
              :label="t('consolidata.create.tipo')"
              :error-messages="fieldErr('tipo')"
            />
          </v-col>
          <v-col cols="6" sm="4">
            <v-text-field
              v-model="form.hub_terminal"
              :label="t('consolidata.create.hub')"
              maxlength="5"
              :error-messages="fieldErr('hub_terminal')"
            />
          </v-col>
          <v-col cols="6" sm="4">
            <v-text-field
              v-model="form.dest_country"
              :label="t('consolidata.create.destCountry')"
              maxlength="2"
              :error-messages="fieldErr('dest_country')"
            />
          </v-col>
        </v-row>
        <v-text-field
          v-model="form.eori_dichiarante"
          :label="t('consolidata.create.eori')"
          maxlength="17"
          :error-messages="fieldErr('eori_dichiarante')"
        />
        <v-textarea
          v-model="form.note_specialist"
          :label="t('consolidata.create.note')"
          rows="2"
          auto-grow
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{
          t("consolidata.common.cancel")
        }}</v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!form.id_cliente || !form.titolo.trim()"
          @click="submit"
        >
          {{ t("consolidata.create.submit") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import ConsolidataClientPicker from "./ConsolidataClientPicker.vue";
import {
  consolidataService,
  ConsolidataRequestError,
} from "../services/consolidata.service";
import { normalizeApiError } from "../logic";
import {
  PROJECT_TYPES,
  type ConsolidataError,
  type ProjectType,
} from "../types";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "created", id: number): void;
}>();
const { t } = useI18n();

const blank = () => ({
  id_cliente: null as number | null,
  titolo: "",
  tipo: "CONS" as ProjectType,
  hub_terminal: "",
  dest_country: "",
  eori_dichiarante: "",
  note_specialist: "",
});
const form = reactive(blank());
const saving = ref(false);
const error = ref<ConsolidataError | null>(null);

const typeItems = computed(() =>
  PROJECT_TYPES.map((v) => ({ value: v, title: t(`consolidata.type.${v}`) })),
);

function fieldErr(f: string): string[] | undefined {
  const m = error.value?.fields[f];
  return m ? [m] : undefined;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      Object.assign(form, blank());
      error.value = null;
    }
  },
);

async function submit(): Promise<void> {
  if (!form.id_cliente) return;
  saving.value = true;
  error.value = null;
  try {
    const res = await consolidataService.create({
      ...form,
      id_cliente: form.id_cliente,
    });
    const id = Number((res as { id?: number }).id ?? 0);
    emit("update:modelValue", false);
    if (id > 0) emit("created", id);
  } catch (err) {
    error.value =
      err instanceof ConsolidataRequestError
        ? err.info
        : normalizeApiError(err);
  } finally {
    saving.value = false;
  }
}
</script>
