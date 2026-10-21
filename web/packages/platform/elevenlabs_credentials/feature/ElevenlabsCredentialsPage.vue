<template>
  <div>
    <CmSectionHeader
      :title="t('elevenlabs_credentials.title')"
      :subtitle="t('elevenlabs_credentials.subtitle')"
    >
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('elevenlabs_credentials.new_credential') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <v-card class="pa-4 mb-4" variant="outlined" data-testid="slot-summary">
      <div class="text-subtitle-2 mb-1">{{ t('elevenlabs_credentials.summary_title') }}</div>
      <div class="text-body-2 cm-cell-hint mb-3">{{ t('elevenlabs_credentials.summary_hint') }}</div>
      <v-table density="compact">
        <thead>
          <tr>
            <th>{{ t('elevenlabs_credentials.summary_slot') }}</th>
            <th>{{ t('elevenlabs_credentials.summary_standard') }}</th>
            <th>{{ t('elevenlabs_credentials.summary_own_approved') }}</th>
            <th>{{ t('elevenlabs_credentials.summary_own_waiting') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in slotSummary" :key="row.profile" :data-testid="`slot-row-${row.profile}`">
            <td class="font-weight-medium">{{ t(`elevenlabs_credentials.profile_${row.profile}`) }}</td>
            <td>
              <span v-if="row.standard_agent_id" class="cm-mono">{{ row.standard_agent_id }}</span>
              <v-chip v-else size="x-small" color="warning" variant="flat">{{ t('elevenlabs_credentials.summary_no_standard') }}</v-chip>
            </td>
            <td>{{ row.own_approved }}</td>
            <td>{{ row.own_waiting }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-card v-if="canSeeHealth" class="pa-4 mb-4" variant="outlined" data-testid="ai-health">
      <div class="text-subtitle-2 mb-2">{{ t('ai_admin.health.title') }}</div>
      <ElevenlabsHealthPanel />
    </v-card>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="cm-filters">
        <v-select
          v-model="filterProfile"
          :items="profileOptions"
          :label="t('elevenlabs_credentials.filter_profile')"
          density="compact"
          hide-details
          clearable
          @update:model-value="load"
        />
      </div>
    </v-card>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="text-subtitle-2 mb-3">{{ t('elevenlabs_credentials.diagnose_title') }}</div>
      <div class="cm-grid">
        <v-select
          v-model="diagnoseProfile"
          :items="profileOptions"
          :label="t('elevenlabs_credentials.form_profile')"
          density="compact"
          hide-details
        />
        <CmAnagraficaAutocomplete
          v-model="diagnosePartner"
          :label="t('elevenlabs_credentials.form_partner')"
          density="compact"
          clearable
        />
      </div>
      <v-btn class="mt-3" variant="tonal" :loading="diagnosing" :prepend-icon="mdiMagnify" @click="runDiagnose">
        {{ t('elevenlabs_credentials.diagnose_button') }}
      </v-btn>

      <v-table v-if="diagnosis" density="compact" class="mt-4">
        <tbody>
          <tr>
            <td class="cm-cell-hint">{{ t('elevenlabs_credentials.diagnose_source') }}</td>
            <td>
              <v-chip size="small" :class="diagnoseSourceClass(diagnosis.source)">
                {{ t(`elevenlabs_credentials.diagnose_source_${diagnosis.source}`) }}
              </v-chip>
            </td>
          </tr>
          <tr>
            <td class="cm-cell-hint">{{ t('elevenlabs_credentials.diagnose_agent_id') }}</td>
            <td>
              <span class="cm-mono">{{ diagnosis.agent_id || '—' }}</span>
              <v-chip size="x-small" class="ml-2" :class="diagnoseSourceClass(diagnosis.agent_id_source)">
                {{ t(`elevenlabs_credentials.diagnose_source_${diagnosis.agent_id_source}`) }}
              </v-chip>
            </td>
          </tr>
          <tr>
            <td class="cm-cell-hint">{{ t('elevenlabs_credentials.diagnose_api_key') }}</td>
            <td>
              <v-chip size="x-small" :color="diagnosis.api_key_present ? 'success' : undefined" variant="flat">
                {{ diagnosis.api_key_present ? t('elevenlabs_credentials.key_set') : t('elevenlabs_credentials.key_none') }}
              </v-chip>
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-alert v-if="diagnosis && diagnosis.source === 'not_configured'" type="warning" variant="tonal" density="compact" class="mt-3">
        {{ t('elevenlabs_credentials.diagnose_not_configured') }}
      </v-alert>
    </v-card>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiRobotOutline"
      :title="t('elevenlabs_credentials.empty_title')"
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
      <template #cell.partner_name="{ item }">
        <div>
          {{ (item as ElevenlabsCredential).partner_name
            || ((item as ElevenlabsCredential).id_anagrafica ? `#${(item as ElevenlabsCredential).id_anagrafica}` : t('elevenlabs_credentials.shared')) }}
        </div>
        <div v-if="(item as ElevenlabsCredential).id_anagrafica" class="cm-cell-hint">#{{ (item as ElevenlabsCredential).id_anagrafica }}</div>
      </template>
      <template #cell.agent_id="{ item }">
        <span class="cm-mono">{{ (item as ElevenlabsCredential).agent_id || '—' }}</span>
      </template>
      <template #cell.has_key="{ item }">
        <v-chip size="x-small" :color="(item as ElevenlabsCredential).has_key ? 'success' : undefined" variant="flat">
          {{ (item as ElevenlabsCredential).has_key ? t('elevenlabs_credentials.key_set') : t('elevenlabs_credentials.key_none') }}
        </v-chip>
      </template>
      <template #cell.approval_status="{ item }">
        <v-chip v-if="(item as ElevenlabsCredential).approval_status" size="x-small" variant="flat">
          {{ t(`elevenlabs_partner_agent.status_${(item as ElevenlabsCredential).approval_status}`) }}
        </v-chip>
        <span v-else>—</span>
      </template>
      <template #cell.billing_owner="{ item }">
        <span v-if="(item as ElevenlabsCredential).billing_owner">
          {{ t(`elevenlabs_partner_agent.billing_${(item as ElevenlabsCredential).billing_owner}`) }}
        </span>
        <span v-else>—</span>
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
          <div class="cm-grid">
            <v-select
              v-model="form.profile"
              :items="profileOptions"
              :label="t('elevenlabs_credentials.form_profile')"
              :disabled="formMode === 'edit'"
            />
            <CmAnagraficaAutocomplete
              v-model="form.id_anagrafica"
              :label="t('elevenlabs_credentials.form_partner')"
              clearable
            />
          </div>
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
 * Credenciales ElevenLabs por partner + perfil. Portado del patrón de
 * EwbCredentialsPage.vue.
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiRobotOutline, mdiMagnify } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ElevenlabsHealthPanel from '../../ai_admin/components/ElevenlabsHealthPanel.vue';
import { useAiScopes } from '../../ai_admin/composables/useAiScopes';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  elevenlabsCredentialsService,
  ELEVENLABS_PROFILES,
  type ElevenlabsCredential,
  type ElevenlabsCredentialPayload,
  type ElevenlabsCredentialDiagnosis,
} from '../services/elevenlabsCredentials.service';

const { t } = useI18n();
const aiScopes = useAiScopes();
const canSeeHealth = aiScopes.can('ai:admin');
void aiScopes.ensureProfile();
const toast = useToastStore();
const confirm = useConfirm();

const items = ref<ElevenlabsCredential[]>([]);
/** Todas las asignaciones (sin filtro): alimenta el resumen por slot. */
const allItems = ref<ElevenlabsCredential[]>([]);

const slotSummary = computed(() =>
  (['public_form', 'copilot_operator'] as const).map((profile) => {
    const rows = allItems.value.filter((r) => r.profile === profile);
    const standard = rows.find((r) => !r.id_anagrafica);
    const own = rows.filter((r) => !!r.id_anagrafica);
    return {
      profile,
      standard_agent_id: standard?.agent_id ?? null,
      own_approved: own.filter((r) => r.approval_status === 'approved').length,
      own_waiting: own.filter((r) => r.approval_status && r.approval_status !== 'approved').length,
    };
  }),
);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const filterProfile = ref<string | null>(null);
const selected = ref<{ id: number }[]>([]);

const profileOptions = ELEVENLABS_PROFILES.map((p) => ({
  title: t(`elevenlabs_credentials.profile_${p}`) as string,
  value: p,
}));

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('elevenlabs_credentials.col_profile') as string, key: 'profile' },
  { title: t('elevenlabs_credentials.col_partner') as string, key: 'partner_name' },
  { title: t('elevenlabs_credentials.col_agent_id') as string, key: 'agent_id', sortable: false },
  { title: t('elevenlabs_credentials.col_key') as string, key: 'has_key', sortable: false },
  { title: t('elevenlabs_credentials.col_approval') as string, key: 'approval_status', sortable: false },
  { title: t('elevenlabs_credentials.col_billing') as string, key: 'billing_owner', sortable: false },
  { title: t('elevenlabs_credentials.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = { profile: 'profile', partner_name: 'partner_name' };

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
interface FormState {
  id?: number;
  profile: string;
  id_anagrafica: number | null;
  api_key: string;
  agent_id: string;
  tts_voice_id: string;
  description: string;
}

const form = reactive<FormState>({
  profile: ELEVENLABS_PROFILES[0],
  id_anagrafica: null,
  api_key: '',
  agent_id: '',
  tts_voice_id: '',
  description: '',
});

const formValid = computed(
  () =>
    !!form.profile &&
    form.agent_id.trim().length > 0,
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await elevenlabsCredentialsService.list(filterProfile.value || undefined);
    allItems.value = filterProfile.value ? await elevenlabsCredentialsService.list() : items.value;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  form.id = undefined;
  form.profile = ELEVENLABS_PROFILES[0];
  form.id_anagrafica = null;
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
  form.id_anagrafica = item.id_anagrafica;
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
      id_anagrafica: form.id_anagrafica,
      agent_id: form.agent_id.trim(),
      tts_voice_id: form.tts_voice_id.trim(),
      description: form.description.trim(),
    };
    // Solo envía la key cuando el usuario la escribió (vacío en edit = sin cambios).
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
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function openDelete(item: ElevenlabsCredential): Promise<void> {
  const ok = await confirm.askDanger(
    t('elevenlabs_credentials.confirm_delete_message', {
      name: item.partner_name || (item.id_anagrafica ? '#' + item.id_anagrafica : t(`elevenlabs_credentials.profile_${item.profile}`)),
    }),
    t('elevenlabs_credentials.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    await elevenlabsCredentialsService.remove(item.id);
    toast.success(t('elevenlabs_credentials.deleted'));
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  void load();
});

const diagnoseProfile = ref<string>(ELEVENLABS_PROFILES[0]);
const diagnosePartner = ref<number | null>(null);
const diagnosing = ref(false);
const diagnosis = ref<ElevenlabsCredentialDiagnosis | null>(null);

function diagnoseSourceClass(source: string): string {
  if (source === 'not_configured') return 'cm-tone-danger';
  if (source === 'env_fallback') return 'cm-tone-warning';
  return 'cm-tone-success';
}

async function runDiagnose(): Promise<void> {
  diagnosing.value = true;
  try {
    diagnosis.value = await elevenlabsCredentialsService.diagnose(diagnoseProfile.value, diagnosePartner.value);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    diagnosing.value = false;
  }
}
</script>
