<template>
  <v-form class="cm-form" @submit.prevent="onSave">
    <div class="cm-form-subheading">{{ t('anagrafiche.more.title') }}</div>
    <v-row dense>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="form.issuing_carrier"
          v-field-help="'issuing_carrier'"
          :label="t('anagrafiche.more.issuing_carrier')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field
          v-model="form.agent_iata_code"
          v-field-help="'agent_iata_code'"
          :label="t('anagrafiche.more.agent_iata_code')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field
          v-model="form.at_place"
          v-field-help="'at_place'"
          :label="t('anagrafiche.more.at_place')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="form.signature_ragsoc"
          v-field-help="'signature_ragsoc'"
          :label="t('anagrafiche.more.signature_ragsoc')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="form.signature_agent"
          v-field-help="'signature_agent'"
          :label="t('anagrafiche.more.signature_agent')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12">
        <v-textarea
          v-model="form.b2b_footer"
          v-field-help="'b2b_footer'"
          :label="t('anagrafiche.more.b2b_footer')"
          rows="3"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12">
        <v-textarea
          v-model="form.text_quot_vettori"
          v-field-help="'text_quot_vettori'"
          :label="t('anagrafiche.more.text_quot_vettori')"
          rows="3"
          density="compact"
          variant="outlined"
        />
      </v-col>
    </v-row>

    <v-divider class="my-4" />

    <div class="cm-form-subheading">{{ t('anagrafiche.files.upload') }}</div>
    <v-row dense>
      <v-col v-for="type in fileTypes" :key="type" cols="12" md="6">
        <v-file-input
          :label="t(`anagrafiche.files.${type}`)"
          density="compact"
          variant="outlined"
          hide-details
          @update:model-value="(f) => onUpload(type, f as File | File[] | null)"
        />
      </v-col>
    </v-row>

    <div class="cm-form-actions">
      <v-btn variant="text" @click="reset">{{ t('common.reset') }}</v-btn>
      <v-btn color="primary" type="submit" :loading="saving" :disabled="!dirty">
        {{ t('common.save') }}
      </v-btn>
    </div>
  </v-form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AnagraficaMore } from '../services/anagrafica.service';
import { partnerFilesService, type PartnerFileType } from '../services/partnerFiles.service';
import { useToast } from '../composables/useToast';

const props = defineProps<{ idAnagrafica: number; more: AnagraficaMore | null }>();
const emit = defineEmits<{ save: [more: AnagraficaMore] }>();
const { t } = useI18n();
const toast = useToast();

const saving = ref(false);
const form = ref<AnagraficaMore>({});
const original = ref<AnagraficaMore>({});

const fileTypes: PartnerFileType[] = ['logo', 'privacy', 'conditions', 'fuel'];

function snapshot(m: AnagraficaMore | null): AnagraficaMore {
  return m ? { ...m } : {};
}

watch(() => props.more, (m) => {
  form.value = snapshot(m);
  original.value = JSON.parse(JSON.stringify(form.value));
}, { immediate: true });

const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(original.value));

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    emit('save', { ...form.value });
    original.value = JSON.parse(JSON.stringify(form.value));
  } finally {
    saving.value = false;
  }
}

function reset(): void {
  form.value = JSON.parse(JSON.stringify(original.value));
}

async function onUpload(type: PartnerFileType, fileInput: File | File[] | null): Promise<void> {
  const f = Array.isArray(fileInput) ? fileInput[0] : fileInput;
  if (!f) return;
  try {
    await partnerFilesService.upload(props.idAnagrafica, type, f);
    toast.success(t('anagrafiche.files.uploaded'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}
</script>

<style scoped>
.cm-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
