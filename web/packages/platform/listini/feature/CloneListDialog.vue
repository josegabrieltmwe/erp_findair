<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon :icon="mdiContentCopy" class="mr-2" />{{ t('price_lists.clone_title') }}
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-3">
          {{ t('price_lists.clone_hint', { name: source?.nome ?? '' }) }}
        </p>
        <v-text-field
          v-model="cloneName"
          :label="t('price_lists.col_name')"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          @keyup.enter="doClone"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="cloning" @click="emit('update:modelValue', false)">{{
          t('common.cancel')
        }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="cloning"
          :disabled="!cloneName.trim()"
          @click="doClone"
        >
          {{ t('price_lists.clone') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Clone a price list. Extracted from PriceListsPage. Owns its own name field and
 * the clone call; the parent refreshes the list on `cloned`. The name seed
 * ("<name> (copia)") is applied by the parent when it opens the dialog and set
 * as the prop; we mirror it locally so the user can edit before confirming.
 */
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiContentCopy } from '@mdi/js';
import { useToastStore } from '@shared/anagrafiche/stores/toast.store';
import { listiniService, type ListinoLite } from '../services/listini.service';

const props = defineProps<{
  modelValue: boolean;
  source: ListinoLite | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  cloned: [];
}>();

const { t } = useI18n();
const toast = useToastStore();

const cloning = ref(false);
const cloneName = ref('');

// Seed the editable name each time the dialog opens for a new source.
watch(
  () => props.modelValue,
  (open) => {
    if (open && props.source) cloneName.value = `${props.source.nome} (copia)`;
  },
);

async function doClone(): Promise<void> {
  if (!props.source || !cloneName.value.trim()) return;
  cloning.value = true;
  try {
    await listiniService.clone(props.source.id, cloneName.value.trim());
    toast.success(t('price_lists.list_cloned'));
    emit('update:modelValue', false);
    emit('cloned');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    cloning.value = false;
  }
}
</script>
