<template>
  <AppDialog
    :open="open"
    :title="t('anagrafiche.clone.title')"
    :icon="mdiContentCopy"
    size="md"
    persistent
    :close-disabled="running"
    @close="close"
  >
    <p class="text-body-2 mb-4">
      {{ t('anagrafiche.clone.intro', { name: sourceName }) }}
    </p>

    <v-text-field
      v-model="ragSoc"
      :label="t('anagrafiche.clone.new_name')"
      :error-messages="nameError ? [nameError] : []"
      :disabled="running"
      counter="100"
      maxlength="100"
      density="comfortable"
      variant="outlined"
      autofocus
      @keyup.enter="submit"
    />

    <v-checkbox
      v-model="maskEmails"
      :label="t('anagrafiche.clone.mask_emails')"
      :disabled="running"
      density="compact"
      hide-details
    />

    <!-- Los datos fiscales SIEMPRE se regeneran: dos anagrafiche con el mismo
         pi_cf son la misma entidad legal a efectos de facturación. No se ofrece
         como opción desactivable para no crear duplicados fiscales por error. -->
    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mt-3"
      :text="t('anagrafiche.clone.notice')"
    />

    <!-- Reporte de la simulación / del clon ya ejecutado. -->
    <template v-if="report">
      <v-divider class="my-4" />

      <div class="text-subtitle-2 mb-2">
        {{ report.dry_run ? t('anagrafiche.clone.preview_title') : t('anagrafiche.clone.done_title') }}
      </div>

      <v-alert
        v-for="(warning, i) in report.warnings"
        :key="i"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-2"
        :text="warning"
      />

      <v-table density="compact" class="mb-3">
        <tbody>
          <tr v-for="(count, table) in report.rows_by_table" :key="table">
            <td class="text-body-2">{{ table }}</td>
            <td class="text-body-2 text-right">{{ count }}</td>
          </tr>
          <tr>
            <td class="text-body-2 font-weight-bold">{{ t('anagrafiche.clone.total_rows') }}</td>
            <td class="text-body-2 text-right font-weight-bold">{{ report.total_rows }}</td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="report.logins.length" class="mb-2">
        <div class="text-subtitle-2 mb-1">{{ t('anagrafiche.clone.credentials') }}</div>
        <v-table density="compact">
          <tbody>
            <tr v-for="login in report.logins" :key="login.loginn_old">
              <td class="text-body-2">{{ login.nome }}</td>
              <td class="text-body-2"><code>{{ login.loginn_new }}</code></td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </template>

    <template #actions>
      <v-btn variant="text" :disabled="running" @click="close">
        {{ t('common.cancel') }}
      </v-btn>
      <v-spacer />
      <v-btn
        variant="tonal"
        :loading="running && pendingDryRun"
        :disabled="running"
        @click="preview"
      >
        {{ t('anagrafiche.clone.preview') }}
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :prepend-icon="mdiContentCopy"
        :loading="running && !pendingDryRun"
        :disabled="running"
        @click="submit"
      >
        {{ t('anagrafiche.clone.confirm') }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiContentCopy } from '@mdi/js';
import AppDialog from '@shared/ui/AppDialog.vue';
import {
  anagraficaService,
  type AnagraficaCloneReport,
} from '../services/anagrafica.service';

/**
 * Modal de clonación de una anagrafica.
 *
 * Ofrece dos acciones: "Simular" (dry-run, no escribe nada y muestra el alcance
 * exacto) y "Clonar". La simulación existe porque un clon toca cientos de filas
 * y conviene ver qué va a pasar antes de ejecutarlo.
 */
const props = defineProps<{
  open: boolean;
  sourceId: number;
  sourceName: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'cloned', newId: number): void;
}>();

const { t } = useI18n();

const ragSoc = ref('');
const maskEmails = ref(true);
const running = ref(false);
const pendingDryRun = ref(false);
const nameError = ref('');
const report = ref<AnagraficaCloneReport | null>(null);

// Al abrir se propone un nombre por defecto y se limpia el estado anterior,
// para que reabrir el modal no muestre el reporte de un clon previo.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    ragSoc.value = props.sourceName ? `${props.sourceName} (TEST)`.slice(0, 100) : '';
    maskEmails.value = true;
    running.value = false;
    pendingDryRun.value = false;
    nameError.value = '';
    report.value = null;
  },
);

function validate(): boolean {
  const value = ragSoc.value.trim();
  if (!value) {
    nameError.value = t('anagrafiche.clone.name_required') as string;
    return false;
  }
  nameError.value = '';
  return true;
}

async function run(dryRun: boolean): Promise<void> {
  if (!validate() || running.value) return;

  running.value = true;
  pendingDryRun.value = dryRun;

  try {
    const result = await anagraficaService.clone({
      id_anagrafica: props.sourceId,
      rag_soc: ragSoc.value.trim(),
      dry_run: dryRun,
      mask_emails: maskEmails.value,
    });
    report.value = result;

    if (!dryRun) {
      emit('cloned', result.new_id);
    }
  } catch (e) {
    nameError.value = e instanceof Error ? e.message : (t('common.error') as string);
  } finally {
    running.value = false;
  }
}

function preview(): void {
  void run(true);
}

function submit(): void {
  void run(false);
}

function close(): void {
  if (running.value) return;
  emit('close');
}
</script>
