<template>
  <div>
    <CmSectionHeader v-if="!embedded" :title="t('ai_credentials.title')" :subtitle="ownMode ? t('ai_credentials.own_subtitle') : t('ai_credentials.subtitle')">
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('ai_credentials.new_credential') }}
        </v-btn>
      </template>
    </CmSectionHeader>
    <div v-else class="d-flex justify-end mb-3">
      <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
        {{ t('ai_credentials.new_credential') }}
      </v-btn>
    </div>

    <v-alert
      v-if="ownMode && !loading && !error"
      :type="effectiveState === 'own' ? 'success' : effectiveState === 'tmwe' ? 'info' : 'warning'"
      variant="tonal"
      density="compact"
      class="mb-4"
      data-testid="own-effective"
    >
      {{ t('ai_credentials.own_effective_' + effectiveState) }}
    </v-alert>

    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      <div>{{ ownMode ? t('ai_credentials.own_hint') : t('ai_credentials.resolution_hint') }}</div>
      <div class="mt-1">{{ t('ai_credentials.usage_hint') }}</div>
    </v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="cm-filters">
        <v-select
          v-model="filterProvider"
          :items="providerOptions"
          :label="t('ai_credentials.filter_provider')"
          density="compact"
          hide-details
          clearable
        />
      </div>
    </v-card>

    <CmEmptyState
      v-if="!loading && !error && items.length === 0"
      :icon="mdiRobotOutline"
      :title="t('ai_credentials.empty_title')"
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
      <template #cell.provider="{ item }">
        <v-chip size="small" class="cm-tone-neutral">
          {{ providerLabel((item as AiCredential).provider) }}
        </v-chip>
        <div v-if="ownMode && (item as AiCredential).name" class="cm-cell-hint">{{ (item as AiCredential).name }}</div>
      </template>
      <template #cell.partner_name="{ item }">
        <div>{{ partnerLabel(item as AiCredential) }}</div>
        <div v-if="(item as AiCredential).id_anagrafica" class="cm-cell-hint">#{{ (item as AiCredential).id_anagrafica }}</div>
        <div v-if="(item as AiCredential).name" class="cm-cell-hint">{{ (item as AiCredential).name }}</div>
      </template>
      <template #cell.model="{ item }">
        <span class="cm-mono">{{ (item as AiCredential).model || t('ai_credentials.model_default') }}</span>
      </template>
      <template #cell.is_default="{ item }">
        <v-chip v-if="(item as AiCredential).is_default === 'S'" size="x-small" color="primary" variant="flat">
          {{ t('ai_credentials.default_yes') }}
        </v-chip>
        <v-btn
          v-else
          size="x-small"
          variant="text"
          :loading="busyId === (item as AiCredential).id"
          @click="makeDefault(item as AiCredential)"
        >
          {{ t('ai_credentials.make_default') }}
        </v-btn>
      </template>
      <template #cell.has_key="{ item }">
        <v-chip size="x-small" :color="(item as AiCredential).has_key ? 'success' : undefined" variant="flat">
          {{ (item as AiCredential).has_key ? t('ai_credentials.key_set') : t('ai_credentials.key_none') }}
        </v-chip>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn
            v-if="!ownMode"
            size="small"
            variant="text"
            :prepend-icon="mdiConnection"
            :loading="testingId === (item as AiCredential).id"
            :disabled="!(item as AiCredential).has_key"
            @click="testConnection(item as AiCredential)"
          >
            {{ t('ai_credentials.test') }}
          </v-btn>
          <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as AiCredential)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiDelete"
            @click="openDelete(item as AiCredential)"
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
          {{ formMode === 'create' ? t('ai_credentials.dialog_create') : t('ai_credentials.dialog_edit') }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid">
            <v-select
              v-model="form.provider"
              :items="providerOptions"
              :label="t('ai_credentials.form_provider')"
              :disabled="ownMode && formMode === 'edit'"
            />
            <CmAnagraficaAutocomplete
              v-if="!embedded && !ownMode"
              v-model="form.id_anagrafica"
              :label="t('ai_credentials.form_partner')"
              clearable
            />
          </div>
          <v-text-field
            v-model="form.api_key"
            :label="t('ai_credentials.form_api_key')"
            :placeholder="formMode === 'edit' ? t('ai_credentials.secret_unchanged_hint') : ''"
            :hint="t('ai_credentials.api_key_hint')"
            persistent-hint
            :type="showKey ? 'text' : 'password'"
            :append-inner-icon="showKey ? mdiEyeOff : mdiEye"
            autocomplete="new-password"
            spellcheck="false"
            maxlength="512"
            class="mt-3"
            @click:append-inner="showKey = !showKey"
          />
          <v-combobox
            v-model="form.model"
            :items="modelSuggestions"
            :label="t('ai_credentials.form_model')"
            :hint="t('ai_credentials.model_hint')"
            persistent-hint
            maxlength="100"
            class="mt-3"
          />
          <v-text-field
            v-model="form.name"
            :label="t('ai_credentials.form_name')"
            maxlength="100"
            class="mt-3"
          />
          <v-switch
            v-model="form.is_default"
            :label="ownMode ? t('ai_credentials.form_default_own') : form.id_anagrafica ? t('ai_credentials.form_default_partner') : t('ai_credentials.form_default_global')"
            color="primary"
            hide-details
            class="mt-2"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="closeForm">{{ t('common.cancel') }}</v-btn>
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
 * Credenciales de proveedores de IA (Anthropic / OpenAI) por partner, con
 * fallback a la credencial global de TMWE. Mismo patrón que
 * ElevenlabsCredentialsPage.vue. La key es solo escritura: nunca se precarga
 * ni se recibe del backend (solo has_key).
 */
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus,
  mdiPencil,
  mdiDelete,
  mdiRobotOutline,
  mdiConnection,
  mdiEye,
  mdiEyeOff,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { buildCredentialPayload, describeCredentialError, effectiveKind } from '../credentialForm';
import {
  aiCredentialsService,
  myAiCredentialsService,
  AI_PROVIDERS,
  AI_MODEL_SUGGESTIONS,
  type AiProvider,
  type AiCredential,
  type AiCredentialsEffective,
} from '../services/aiCredentials.service';

/**
 * `idAnagrafica`: copia de la ficha de anagrafica (`/anagrafica/:id`). Solo lista
 * y crea credenciales propias de ese partner; las globales siguen en Ajustes.
 */
/**
 * `own`: modo propio. Un partner que NO es TMWE gestiona SU clave por
 * /api_admin_ai_my_credentials: sin selector de partner (lo fija el servidor), sin
 * columna de titular, sin prueba de conexión, y con un aviso de si usa la clave de
 * TMWE (la paga TMWE) o la suya (la paga él). El modo TMWE no cambia.
 */
const props = defineProps<{ idAnagrafica?: number; own?: boolean }>();
const embedded = computed(() => props.idAnagrafica != null);
const ownMode = computed(() => props.own === true);
const effective = ref<AiCredentialsEffective | null>(null);
/** 'own' = clave propia, 'tmwe' = fallback a TMWE, 'none' = sin ninguna. */
const effectiveState = computed(() => effectiveKind(effective.value));

/** Traduce los errores del contrato; AI_FORBIDDEN en modo propio tiene mensaje propio. */
function describeError(e: unknown): string {
  return describeCredentialError(e, ownMode.value, t('ai_credentials.own_forbidden') as string);
}

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const allItems = ref<AiCredential[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const filterProvider = ref<string | null>(null);
const selected = ref<{ id: number }[]>([]);
const busyId = ref<number | null>(null);
const testingId = ref<number | null>(null);

// El backend no filtra por provider; el volumen es mínimo, se filtra aquí.
const items = computed(() =>
  filterProvider.value ? allItems.value.filter((i) => i.provider === filterProvider.value) : allItems.value,
);

const providerOptions = AI_PROVIDERS.map((p) => ({
  title: t(`ai_credentials.provider_${p}`) as string,
  value: p,
}));

function providerLabel(provider: string): string {
  return (AI_PROVIDERS as readonly string[]).includes(provider)
    ? (t(`ai_credentials.provider_${provider}`) as string)
    : provider;
}

function partnerLabel(item: AiCredential): string {
  if (item.partner_name) return item.partner_name;
  return item.id_anagrafica ? `#${item.id_anagrafica}` : (t('ai_credentials.shared') as string);
}

const listSource = useClientSideListSource(items, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('ai_credentials.col_provider') as string, key: 'provider' },
  ...(props.own === true ? [] : [{ title: t('ai_credentials.col_partner') as string, key: 'partner_name' }]),
  { title: t('ai_credentials.col_model') as string, key: 'model', sortable: false },
  { title: t('ai_credentials.col_default') as string, key: 'is_default', sortable: false },
  { title: t('ai_credentials.col_key') as string, key: 'has_key', sortable: false },
  { title: t('ai_credentials.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = { provider: 'provider', partner_name: 'partner_name' };

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const showKey = ref(false);

interface FormState {
  id?: number;
  provider: AiProvider;
  id_anagrafica: number | null;
  api_key: string;
  model: string;
  name: string;
  is_default: boolean;
  /** Estado original, para enviar is_default solo si cambió. */
  was_default: boolean;
}

const form = reactive<FormState>({
  provider: AI_PROVIDERS[0],
  id_anagrafica: null,
  api_key: '',
  model: '',
  name: '',
  is_default: true,
  was_default: false,
});

const modelSuggestions = computed(() => AI_MODEL_SUGGESTIONS[form.provider] ?? []);

// Misma regla que el backend (validate_api_key): sin espacios, 20..512 chars.
const apiKeyValid = computed(() => {
  const k = form.api_key.trim();
  if (k === '') return formMode.value === 'edit';
  return k.length >= 20 && k.length <= 512 && !/\s/.test(k);
});

const formValid = computed(() => !!form.provider && apiKeyValid.value);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    if (ownMode.value) {
      const mine = await myAiCredentialsService.list();
      allItems.value = mine.items;
      effective.value = mine.effective;
    } else {
      const rows = await aiCredentialsService.list(props.idAnagrafica);
      allItems.value = embedded.value ? rows.filter((r) => r.id_anagrafica === props.idAnagrafica) : rows;
    }
  } catch (e) {
    error.value = describeError(e);
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  form.id = undefined;
  form.provider = AI_PROVIDERS[0];
  form.id_anagrafica = props.idAnagrafica ?? null;
  form.api_key = '';
  form.model = '';
  form.name = '';
  form.is_default = true;
  form.was_default = false;
  showKey.value = false;
}

function closeForm(): void {
  formDialog.value = false;
  // No dejar la key tecleada en memoria del componente más de lo necesario.
  form.api_key = '';
  showKey.value = false;
}

function openCreate(): void {
  formMode.value = 'create';
  resetForm();
  formDialog.value = true;
}

function openEdit(item: AiCredential): void {
  formMode.value = 'edit';
  resetForm();
  form.id = item.id;
  form.provider = ((AI_PROVIDERS as readonly string[]).includes(item.provider)
    ? item.provider
    : AI_PROVIDERS[0]) as AiProvider;
  form.id_anagrafica = item.id_anagrafica;
  form.api_key = ''; // nunca se precarga — vacío = mantener key guardada
  form.model = item.model || '';
  form.name = item.name || '';
  form.is_default = item.is_default === 'S';
  form.was_default = item.is_default === 'S';
  formDialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    // Modo propio: sin id_anagrafica (lo fija el servidor). El modo TMWE conserva su payload.
    const payload = buildCredentialPayload(form, formMode.value, ownMode.value);

    const service = ownMode.value ? myAiCredentialsService : aiCredentialsService;
    if (formMode.value === 'create') {
      await service.create(payload);
      toast.success(t('ai_credentials.created'));
    } else {
      await service.update(payload);
      toast.success(t('ai_credentials.updated'));
    }
    closeForm();
    await load();
  } catch (e) {
    toast.error(describeError(e));
  } finally {
    saving.value = false;
  }
}

async function makeDefault(item: AiCredential): Promise<void> {
  busyId.value = item.id;
  try {
    if (ownMode.value) await myAiCredentialsService.setDefault(item.id);
    else await aiCredentialsService.setDefault(item.id_anagrafica, item.provider);
    toast.success(t('ai_credentials.default_set'));
    await load();
  } catch (e) {
    toast.error(describeError(e));
  } finally {
    busyId.value = null;
  }
}

async function testConnection(item: AiCredential): Promise<void> {
  testingId.value = item.id;
  try {
    const r = await aiCredentialsService.test(item.id);
    if (r.ok) {
      toast.success(t('ai_credentials.test_ok', { provider: providerLabel(item.provider) }));
    } else {
      toast.error(t('ai_credentials.test_failed', { message: r.message }));
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    testingId.value = null;
  }
}

async function openDelete(item: AiCredential): Promise<void> {
  const ok = await confirm.askDanger(
    ownMode.value
      ? t('ai_credentials.confirm_delete_own_message', { provider: providerLabel(item.provider) })
      : t('ai_credentials.confirm_delete_message', {
          provider: providerLabel(item.provider),
          name: partnerLabel(item),
        }),
    t('ai_credentials.confirm_delete_title'),
  );
  if (!ok) return;
  try {
    if (ownMode.value) await myAiCredentialsService.remove(item.id);
    else await aiCredentialsService.remove(item.id);
    toast.success(t('ai_credentials.deleted'));
    await load();
  } catch (e) {
    toast.error(describeError(e));
  }
}

watch(() => props.idAnagrafica, load);
onMounted(() => {
  void load();
});
</script>
