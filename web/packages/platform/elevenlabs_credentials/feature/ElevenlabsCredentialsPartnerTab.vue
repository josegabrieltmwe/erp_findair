<template>
  <div>
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('elevenlabs_credentials.partner_tab_hint') }}
    </v-alert>

    <div class="d-flex justify-end mb-3">
      <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
        {{ t('elevenlabs_credentials.new_credential') }}
      </v-btn>
    </div>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiRobotOutline"
      :title="t('elevenlabs_credentials.empty_title_partner')"
    />
    <ListingDataView
      v-else
      :source="listSource"
      :headers="tableHeaders"
      :selected="selected"
      :sort-key-map="sortKeyMap"
      mode="infinite"
      :selectable="false"
      @update:selected="selected = $event"
    >
      <template #cell.profile="{ item }">
        <v-chip size="small" class="cm-tone-neutral">
          {{ t(`elevenlabs_credentials.profile_${(item as ElevenlabsCredential).profile}`) }}
        </v-chip>
      </template>
      <template #cell.agent_id="{ item }">
        <span class="cm-mono">{{ (item as ElevenlabsCredential).agent_id || '—' }}</span>
      </template>
      <template #cell.has_key="{ item }">
        <v-chip size="x-small" :color="(item as ElevenlabsCredential).has_key ? 'success' : undefined" variant="flat">
          {{ (item as ElevenlabsCredential).has_key ? t('elevenlabs_credentials.key_set') : t('elevenlabs_credentials.key_none') }}
        </v-chip>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as ElevenlabsCredential)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiDelete"
            @click="openDelete(item as ElevenlabsCredential)"
          >
            {{ t('common.delete') }}
          </v-btn>
        </div>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-dialog v-model="formDialog" max-width="640" persistent>
      <v-card>
        <v-card-title>
          {{ formMode === 'create' ? t('elevenlabs_credentials.dialog_create') : t('elevenlabs_credentials.dialog_edit') }}
        </v-card-title>
        <v-card-text>
          <v-select
            v-model="form.profile"
            :items="profileOptions"
            :label="t('elevenlabs_credentials.form_profile')"
            :disabled="formMode === 'edit'"
          />
          <!-- Sin selector de partner: esta credencial nace fijada al dueño
               de la ficha (idAnagrafica), a diferencia del formulario admin
               global (ElevenlabsCredentialsPage.vue), que sí lo pide. -->
          <v-text-field
            v-model="form.api_key"
            :label="t('elevenlabs_credentials.form_api_key')"
            :placeholder="formMode === 'edit' ? t('elevenlabs_credentials.secret_unchanged_hint') : ''"
            type="password"
            autocomplete="new-password"
            maxlength="255"
            class="mt-3"
          />
          <v-text-field
            v-model="form.agent_id"
            :label="t('elevenlabs_credentials.form_agent_id')"
            maxlength="100"
            class="mt-3"
          />
          <v-text-field
            v-model="form.tts_voice_id"
            :label="t('elevenlabs_credentials.form_tts_voice_id')"
            :placeholder="t('elevenlabs_credentials.tts_voice_id_hint')"
            maxlength="100"
            class="mt-3"
          />
          <v-text-field
            v-model="form.description"
            :label="t('elevenlabs_credentials.form_description')"
            maxlength="255"
            class="mt-3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="formDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!formValid" @click="save">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Tab de credenciales ElevenLabs (por perfil) dentro de la ficha de
 * anagrafica. Variante embebida y fijada al partner de
 * ElevenlabsCredentialsPage.vue (la vista admin global): mismo backend
 * (api_admin_elevenlabs_credentials), lista solo lo propio de este partner
 * y crea/edita siempre con `id_anagrafica` fijo -- sin selector.
 *
 * Este tab lista SOLO las filas con id_anagrafica = este partner -- nunca
 * la fila global/TMWE (id_anagrafica NULL), que se gestiona desde el panel
 * admin. El banner explica que la ausencia de filas aquí es normal: el
 * partner sigue funcionando cayendo al fallback de TMWE
 * (Elevenlabs_Conversation_Credential_Service::resolve_credentials).
 */
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiRobotOutline } from '@mdi/js';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  elevenlabsCredentialsService,
  ELEVENLABS_PROFILES,
  type ElevenlabsCredential,
  type ElevenlabsCredentialPayload,
} from '../services/elevenlabsCredentials.service';

const props = defineProps<{
  idAnagrafica: number;
}>();
const emit = defineEmits<{ refresh: [] }>();

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<ElevenlabsCredential[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const selected = ref<{ id: number }[]>([]);

const profileOptions = ELEVENLABS_PROFILES.map((p) => ({
  title: t(`elevenlabs_credentials.profile_${p}`) as string,
  value: p,
}));

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('elevenlabs_credentials.col_profile') as string, key: 'profile' },
  { title: t('elevenlabs_credentials.col_agent_id') as string, key: 'agent_id', sortable: false },
  { title: t('elevenlabs_credentials.col_key') as string, key: 'has_key', sortable: false },
  { title: t('elevenlabs_credentials.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = { profile: 'profile' };

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await elevenlabsCredentialsService.list({ idAnagrafica: props.idAnagrafica });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
interface FormState {
  id?: number;
  profile: string;
  api_key: string;
  agent_id: string;
  tts_voice_id: string;
  description: string;
}

const form = reactive<FormState>({
  profile: ELEVENLABS_PROFILES[0],
  api_key: '',
  agent_id: '',
  tts_voice_id: '',
  description: '',
});

const formValid = computed(() => !!form.profile && form.agent_id.trim().length > 0);

function resetForm(): void {
  form.id = undefined;
  form.profile = ELEVENLABS_PROFILES[0];
  form.api_key = '';
  form.agent_id = '';
  form.tts_voice_id = '';
  form.description = '';
}

function openCreate(): void {
  formMode.value = 'create';
  resetForm();
  formDialog.value = true;
}

function openEdit(item: ElevenlabsCredential): void {
  formMode.value = 'edit';
  form.id = item.id;
  form.profile = item.profile;
  form.api_key = ''; // nunca se precarga — vacío = mantener key guardada
  form.agent_id = item.agent_id || '';
  form.tts_voice_id = item.tts_voice_id || '';
  form.description = item.description || '';
  formDialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: ElevenlabsCredentialPayload = {
      id: form.id,
      profile: form.profile,
      id_anagrafica: props.idAnagrafica,
      agent_id: form.agent_id.trim(),
      tts_voice_id: form.tts_voice_id.trim(),
      description: form.description.trim(),
    };
    if (form.api_key.trim()) payload.api_key = form.api_key.trim();

    if (formMode.value === 'create') {
      await elevenlabsCredentialsService.create(payload);
      toast.success(t('elevenlabs_credentials.created'));
    } else {
      await elevenlabsCredentialsService.update(payload);
      toast.success(t('elevenlabs_credentials.updated'));
    }
    formDialog.value = false;
    await load();
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function openDelete(item: ElevenlabsCredential): Promise<void> {
  const ok = await confirm.askDanger(
    t('elevenlabs_credentials.confirm_delete_message', {
      name: t(`elevenlabs_credentials.profile_${item.profile}`),
    }),
    t('elevenlabs_credentials.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await elevenlabsCredentialsService.remove(item.id);
    toast.success(t('elevenlabs_credentials.deleted'));
    await load();
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

watch(() => props.idAnagrafica, load);
onMounted(() => {
  void load();
});
</script>
