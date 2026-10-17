<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card v-if="regla" :aria-labelledby="titleId">
      <v-card-title
        :id="titleId"
        class="text-subtitle-1 d-flex align-center ga-2"
      >
        <v-icon
          :icon="action === 'close' ? 'mdi-calendar-end' : 'mdi-delete-outline'"
          :color="action === 'close' ? 'primary' : 'error'"
        />
        {{ t(`invoicing.fiscal.reglas.accion_dialog.${action}_title`) }}
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-2">
          {{ t(`invoicing.fiscal.reglas.accion_dialog.${action}_intro`) }}
        </p>
        <div class="text-body-2 mb-3">
          <strong>{{ regla.codigo }}</strong> ·
          {{ accionNombre(regla.accion, tr) }} · {{ regla.data_inizio }} →
          {{ regla.data_fine ?? t("invoicing.fiscal.open") }}
        </div>
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          role="alert"
        >
          {{ errorMessage }}
        </v-alert>
        <v-text-field
          v-if="action === 'close'"
          v-model="dataFine"
          type="date"
          :label="t('invoicing.fiscal.reglas.accion_dialog.data_fine') + ' *'"
          :hint="t('invoicing.fiscal.reglas.accion_dialog.data_fine_hint')"
          persistent-hint
          :error-messages="errs.data_fine ? [errs.data_fine] : []"
          density="comfortable"
          variant="outlined"
        />
        <v-text-field
          v-model="motivo"
          :label="t('invoicing.fiscal.motivo') + ' *'"
          :hint="t('invoicing.fiscal.motivo_hint')"
          persistent-hint
          :error-messages="errs.motivo ? [errs.motivo] : []"
          maxlength="255"
          density="comfortable"
          variant="outlined"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="busy"
          @click="emit('update:modelValue', false)"
        >
          {{ t("common.cancel") }}
        </v-btn>
        <v-btn
          :color="action === 'close' ? 'primary' : 'error'"
          :loading="busy"
          :disabled="!motivo.trim() || (action === 'close' && !dataFine)"
          @click="run"
        >
          {{ t(`invoicing.fiscal.reglas.accion_dialog.${action}_btn`) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * RuleActionDialog — cerrar o dar de baja una regla de fisc_reglas, con
 * motivo obligatorio.
 *   - `close`: una regla ACTIVA se cierra con una fecha de fin (una regla
 *     aplicada no se borra ni se edita: se cierra y se crea otra; la fecha no
 *     puede ser anterior a la última factura que la aplicó). Es un cambio
 *     estructural: el partner afectado pasa a «revalidar».
 *   - `deactivate`: baja de una regla que nunca se aplicó; si ya se aplicó el
 *     backend responde 409 y se ofrece cerrarla.
 * Los errores del backend (409, 422) se muestran en el diálogo.
 *
 * Props: `modelValue` (abierto), `regla` (la regla), `action` (`close` o
 * `deactivate`), `today` (fecha por defecto del cierre).
 * Emits: `update:modelValue`, `done` (se hizo: recargar el listado).
 *
 * Ejemplo:
 *   <RuleActionDialog v-model="open" :regla="r" action="close" :today="hoy" @done="reload" />
 */
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { accionNombre } from "./reglasModel";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import { fieldErrors } from "../../../services/fiscConfig.service";
import {
  fiscReglasService,
  type Regla,
} from "../../../services/fiscReglas.service";

const props = defineProps<{
  modelValue: boolean;
  regla: Regla | null;
  action: "close" | "deactivate";
  today: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "done"): void;
}>();

const { t, te } = useI18n();
const tr = (k: string, n?: Record<string, unknown>): string | null =>
  te(k) ? t(k, n ?? {}) : null;
const titleId = "rule-action-title";
const motivo = ref("");
const dataFine = ref("");
const busy = ref(false);
const errorMessage = ref("");
const errs = ref<Record<string, string>>({});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    motivo.value = "";
    dataFine.value = props.today;
    errorMessage.value = "";
    errs.value = {};
  },
);

async function run(): Promise<void> {
  if (!props.regla) return;
  busy.value = true;
  errorMessage.value = "";
  errs.value = {};
  try {
    if (props.action === "close") {
      await fiscReglasService.close(
        props.regla.id,
        dataFine.value,
        motivo.value,
      );
    } else {
      await fiscReglasService.deactivate(props.regla.id, motivo.value);
    }
    emit("done");
    emit("update:modelValue", false);
  } catch (e) {
    errs.value = fieldErrors(e);
    errorMessage.value = toUserMessage(e, String(e));
  } finally {
    busy.value = false;
  }
}
</script>
