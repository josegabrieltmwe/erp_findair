<template>
  <v-dialog :model-value="modelValue" max-width="560" persistent @update:model-value="onClose">
    <v-card>
      <v-card-title>{{ isEdit ? t('common.edit') : t('common.add') }} — {{ t('anagrafiche.tabs.lettint') }}</v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="6">
            <v-text-field v-model="form.dichiaraz_intenti_numero" :label="t('anagrafiche.fields.numero')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field v-model="form.aliquota_IVA"
          v-field-help="'aliquota_IVA'" :label="t('anagrafiche.lettint.aliquota_IVA')" type="number" step="0.01" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field v-model="form.dichiaraz_intenti_data" :label="t('anagrafiche.fields.data_inizio')" type="date" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field v-model="form.dichiaraz_intenti_data_scad" :label="t('anagrafiche.fields.data_fine')" type="date" density="compact" variant="outlined" />
          </v-col>
          <!-- Fase E3: causale IVA. Paridad legacy anagr_form.php: el dropdown
               id_causale_IVA_x3 solo ofrece "Seleziona" y "S" = «come da lettera
               d'intenti» (fuente fatture_causali_new tipo_cli_base='S'). Se guarda
               en dich_intenti_iva.id_causale_IVA (varchar(5), default 'S'). -->
          <v-col cols="12" md="12">
            <v-select
              v-model="form.id_causale_IVA"
              v-field-help="'id_causale_IVA'"
              :items="causaleItems"
              :label="t('anagrafiche.lettint.id_causale_IVA')"
              item-title="title"
              item-value="value"
              clearable
              density="compact"
              variant="outlined"
            />
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="onClose">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" @click="onSave">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { LettIntRow } from '../services/anagrafica.service';
import { vatDeclarationsService } from '../services/vatDeclarations.service';
import { useToast } from '../composables/useToast';

const props = defineProps<{ modelValue: boolean; idAnagrafica: number; lettInt: LettIntRow | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>();
const { t } = useI18n();
const toast = useToast();

const saving = ref(false);
const form = ref<Partial<LettIntRow>>({});
const isEdit = computed(() => !!props.lettInt?.id);

// Paridad legacy: el dropdown de causale IVA de la dichiarazione d'intenti solo
// ofrece la voz "S" («come da lettera d'intenti»). El catálogo real
// (fatture_causali_new, tipo_cli_base='S') siempre devuelve esa única opción con
// value literal 'S'; la reproducimos localmente (una sola opción) en vez de
// añadir un endpoint para un catálogo de un solo elemento.
const causaleItems = computed(() => [
  { title: t('anagrafiche.lettint.causale_opt_S'), value: 'S' },
]);

watch(() => props.modelValue, (v) => {
  if (v) form.value = props.lettInt ? { ...props.lettInt } : {};
});

function onClose(): void { emit('update:modelValue', false); }

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    if (isEdit.value && form.value.id) {
      await vatDeclarationsService.update(form.value.id, form.value);
    } else {
      await vatDeclarationsService.create(props.idAnagrafica, form.value);
    }
    toast.success(t('anagrafiche.updated'));
    emit('saved');
    onClose();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    saving.value = false;
  }
}
</script>
