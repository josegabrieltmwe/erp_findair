<template>
  <v-dialog :model-value="modelValue" max-width="620" @update:model-value="emit('update:modelValue', $event)">
    <v-card v-if="task">
      <v-card-title>{{ t('scheduler.params') }} — {{ task.label }}</v-card-title>
      <v-card-text>
        <div v-if="fields.length === 0 && !advanced" class="text-medium-emphasis mb-3">
          {{ t('scheduler.no_params') }}
        </div>

        <template v-if="!advanced">
          <div v-for="f in fields" :key="f.key" class="d-flex align-center ga-2 mb-2">
            <v-switch
              v-if="f.type === 'bool'"
              :model-value="values[f.key]"
              @update:model-value="setValue(f.key, $event)"
              :label="f.label"
              color="primary"
              density="compact"
              hide-details
              inset
            />
            <v-select
              v-else-if="f.options && f.options.length"
              :model-value="(values[f.key] as string | null | undefined) ?? null"
              @update:model-value="setValue(f.key, $event)"
              :items="f.options"
              :label="f.label"
              density="compact"
              hide-details
              clearable
            />
            <v-text-field
              v-else
              :model-value="values[f.key]"
              @update:model-value="setValue(f.key, $event)"
              :type="f.type === 'string' ? 'text' : 'number'"
              :label="f.label"
              density="compact"
              hide-details
              clearable
            />
            <v-tooltip v-if="f.danger" :text="t('scheduler.danger_field')" location="top">
              <template #activator="{ props }">
                <v-icon v-bind="props" :icon="mdiAlertOutline" color="warning" size="small" />
              </template>
            </v-tooltip>
          </div>
        </template>

        <v-textarea
          v-else
          v-model="rawJson"
          :label="t('scheduler.params_json')"
          :error-messages="jsonError ? [jsonError] : []"
          rows="8"
          auto-grow
          class="text-mono"
        />

        <v-btn variant="text" size="small" class="mt-2 px-0" @click="toggleAdvanced">
          {{ advanced ? t('scheduler.params_form') : t('scheduler.params_advanced') }}
        </v-btn>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!!jsonError" @click="save">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Editor del payload fijo de una tarea programada.
 *
 * Los campos los declara el backend (Job_Handler_Registry::payload_fields):
 * el formulario no inventa claves. Las que no tienen campo se conservan tal
 * cual al guardar, y el modo JSON permite editarlas todas.
 *
 * Los campos `danger` (pasar a live, quitar dry-run, cambiar el destinatario)
 * tienen efectos fuera del ERP: emails a clientes, escrituras en BD. Cambiarlos
 * pide una confirmación explícita.
 */
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiAlertOutline } from '@mdi/js';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { schedulerService, type ScheduledTask, type PayloadField } from '../services/scheduler.service';

const props = defineProps<{ modelValue: boolean; task: ScheduledTask | null }>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'saved', task: ScheduledTask): void;
}>();

const { t } = useI18n();
const confirm = useConfirm();
const toast = useToastStore();

type FieldValue = string | number | boolean | null | undefined;

const values = ref<Record<string, FieldValue>>({});
/** Claves que el operador ha tocado en esta edición. */
const touched = ref<Set<string>>(new Set());
const advanced = ref(false);
const rawJson = ref('{}');
const saving = ref(false);

const fields = computed<PayloadField[]>(() => props.task?.job_meta?.payload_fields ?? []);

watch(
  () => [props.modelValue, props.task] as const,
  ([open, task]) => {
    if (!open || !task) return;
    values.value = { ...((task.payload ?? {}) as Record<string, FieldValue>) };
    touched.value = new Set();
    // Una clave ausente se muestra con el default que aplica el HANDLER (lo
    // declara el backend), para que el interruptor no mienta. No se escribe
    // al guardar salvo que el operador la cambie: guardar otro campo no debe
    // convertir un default implícito en un valor fijado.
    for (const f of fields.value) {
      if (values.value[f.key] === undefined && f.default !== undefined) {
        values.value[f.key] = f.default;
      }
    }
    rawJson.value = JSON.stringify(task.payload ?? {}, null, 2);
    advanced.value = fields.value.length === 0;
  },
  { immediate: true },
);

const jsonError = computed<string | null>(() => {
  if (!advanced.value) return null;
  try {
    const v = JSON.parse(rawJson.value || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? null : t('scheduler.params_json_invalid');
  } catch {
    return t('scheduler.params_json_invalid');
  }
});

function setValue(key: string, v: FieldValue): void {
  values.value[key] = v;
  touched.value.add(key);
}

/**
 * El payload resultante del formulario: tipado y sin campos vacíos. Solo se
 * escriben las claves que ya estaban o que el operador ha tocado.
 */
function fromForm(): Record<string, unknown> {
  const original = props.task?.payload ?? {};
  const out: Record<string, unknown> = { ...original };
  for (const f of fields.value) {
    if (!(f.key in original) && !touched.value.has(f.key)) {
      continue;
    }
    const v = values.value[f.key];
    if (v === null || v === undefined || v === '') {
      delete out[f.key];
      continue;
    }
    if (f.type === 'int') out[f.key] = parseInt(String(v), 10);
    else if (f.type === 'float') out[f.key] = parseFloat(String(v));
    else if (f.type === 'bool') out[f.key] = v === true;
    else out[f.key] = String(v);
  }
  return out;
}

function toggleAdvanced(): void {
  if (!advanced.value) {
    rawJson.value = JSON.stringify(fromForm(), null, 2);
  } else if (!jsonError.value) {
    const parsed = JSON.parse(rawJson.value || '{}') as Record<string, FieldValue>;
    // Lo editado en JSON cuenta como tocado.
    for (const k of Object.keys(parsed)) touched.value.add(k);
    values.value = { ...parsed };
  }
  advanced.value = !advanced.value;
}

async function save(): Promise<void> {
  if (!props.task) return;
  const next = advanced.value ? JSON.parse(rawJson.value || '{}') : fromForm();
  const before = props.task.payload ?? {};

  const changedDanger = fields.value
    .filter((f) => f.danger && JSON.stringify(before[f.key]) !== JSON.stringify(next[f.key]))
    .map((f) => f.label);
  if (changedDanger.length) {
    const ok = await confirm.ask({
      title: t('scheduler.danger_title'),
      message: t('scheduler.danger_message', { fields: changedDanger.join(', ') }),
      confirmLabel: t('scheduler.danger_confirm'),
      variant: 'danger',
    });
    if (!ok) return;
  }

  saving.value = true;
  try {
    const updated = await schedulerService.updatePayload(props.task.id, next);
    emit('saved', updated);
    emit('update:modelValue', false);
    toast.success(t('scheduler.params_saved'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}
</script>
