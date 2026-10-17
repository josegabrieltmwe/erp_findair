<template>
  <v-dialog :model-value="modelValue" max-width="640" persistent @update:model-value="onClose">
    <v-card>
      <v-card-title>{{ isEdit ? t('common.edit') : t('common.add') }} — {{ t('anagrafiche.tabs.banche') }}</v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="8">
            <v-text-field v-model="form.nome" :label="t('anagrafiche.fields.banca')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="form.swift" :label="t('anagrafiche.fields.swift')" maxlength="11" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12">
            <v-text-field v-model="form.iban" :label="t('anagrafiche.fields.iban')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="form.abi" :label="t('anagrafiche.fields.abi')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="form.cab" :label="t('anagrafiche.fields.cab')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="form.cc" :label="t('anagrafiche.fields.cc')" density="compact" variant="outlined" />
          </v-col>
          <!-- Fase E3: cin + agenzia -->
          <v-col cols="12" md="4">
            <v-text-field v-model="form.cin" :label="t('anagrafiche.banca.cin')" maxlength="4" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" md="8">
            <v-text-field v-model="form.agenzia" :label="t('anagrafiche.banca.agenzia')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12">
            <v-textarea v-model="form.note"
          v-field-help="'note'" :label="t('anagrafiche.fields.note')" rows="2" density="compact" variant="outlined" />
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
import type { BancaRow } from '../services/anagrafica.service';
import { bancheService } from '../services/banche.service';
import { useToast } from '../composables/useToast';

const props = defineProps<{ modelValue: boolean; idAnagrafica: number; banca: BancaRow | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>();
const { t } = useI18n();
const toast = useToast();

const saving = ref(false);
const form = ref<Partial<BancaRow>>({});
const isEdit = computed(() => !!props.banca?.id);

watch(() => props.modelValue, (v) => {
  if (v) form.value = props.banca ? { ...props.banca } : {};
});

function onClose(): void { emit('update:modelValue', false); }

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    if (isEdit.value && form.value.id) {
      await bancheService.update(form.value.id, form.value);
    } else {
      await bancheService.create(props.idAnagrafica, form.value);
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
