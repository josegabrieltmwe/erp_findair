<template>
  <div>
    <CmSectionHeader
      :title="t('oauth_clients.title')"
      :subtitle="t('oauth_clients.subtitle')"
    >
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openProvision">
          {{ t('oauth_clients.new_client') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="cm-filters">
        <v-select
          v-model="filterStatus"
          :label="t('oauth_clients.filter_status')"
          :items="statusOptions"
          density="compact"
          hide-details
          clearable
          @update:model-value="load"
        />
        <v-select
          v-model="filterTier"
          :label="t('oauth_clients.filter_tier')"
          :items="tierOptions"
          density="compact"
          hide-details
          clearable
          @update:model-value="load"
        />
      </div>
    </v-card>

    <CmEmptyState
      v-if="!loading && !error && clients.length === 0"
      :icon="mdiKeyChain"
      :title="t('oauth_clients.empty_title')"
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
      <template #cell.client_id="{ item }">
        <span class="cm-mono">{{ (item as OAuthClient).client_id }}</span>
      </template>
      <template #cell.client_name="{ item }">
        {{ (item as OAuthClient).client_name || '—' }}
      </template>
      <template #cell.company_name="{ item }">
        {{ (item as OAuthClient).company_name || '—' }}
      </template>
      <template #cell.client_type="{ item }">
        <v-chip size="small" :class="typeToneClass((item as OAuthClient).client_type)">
          {{ (item as OAuthClient).client_type || 'internal' }}
        </v-chip>
      </template>
      <template #cell.role_name="{ item }">
        <span v-if="(item as OAuthClient).role_name" class="cm-mono">{{ (item as OAuthClient).role_name }}</span>
        <span v-else class="cm-cell-hint">{{ t('oauth_clients.no_role') }}</span>
      </template>
      <template #cell.tier="{ item }">
        <v-chip size="small" :class="tierToneClass((item as OAuthClient).tier)">
          {{ (item as OAuthClient).tier || '—' }}
        </v-chip>
      </template>
      <template #cell.status="{ item }">
        <v-chip size="small" :class="isActive(item as OAuthClient) ? 'cm-tone-success' : 'cm-tone-neutral'">
          {{ (item as OAuthClient).status || (item as OAuthClient).stato || '—' }}
        </v-chip>
      </template>
      <template #cell.actions="{ item }">
        <div class="cm-actions-right">
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="mdiKeyVariant"
            :title="t('oauth_clients.show_effective_scopes')"
            @click="openEffectiveScopes(item as OAuthClient)"
          >
            {{ t('oauth_clients.effective_scopes') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="mdiShieldKey"
            @click="openRbacRoles(item as OAuthClient)"
          >
            {{ t('oauth_clients.manage_role') }}
          </v-btn>
          <v-btn size="small" variant="text" :prepend-icon="mdiKey" @click="openRotate(item as OAuthClient)">
            {{ t('oauth_clients.rotate') }}
          </v-btn>
          <v-btn
            v-if="isActive(item as OAuthClient)"
            size="small"
            variant="text"
            color="error"
            :prepend-icon="mdiCancel"
            @click="disable(item as OAuthClient)"
          >
            {{ t('oauth_clients.disable') }}
          </v-btn>
          <v-btn
            v-else
            size="small"
            variant="text"
            color="success"
            :prepend-icon="mdiPlay"
            @click="reactivate(item as OAuthClient)"
          >
            {{ t('oauth_clients.reactivate') }}
          </v-btn>
        </div>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <!-- Diálogo de provisión -->
    <v-dialog v-model="provisionDialog" max-width="700" persistent>
      <v-card>
        <v-card-title>{{ t('oauth_clients.dialog_provision') }}</v-card-title>
        <v-card-text>
          <CmUserAutocomplete
            v-model="provForm.user_id"
            :label="t('oauth_clients.form_user')"
            class="mb-3"
          />
          <v-text-field
            v-model="provForm.client_name"
            :label="t('oauth_clients.form_client_name')"
            class="mb-3"
          />
          <v-text-field
            v-model="provForm.company_name"
            :label="t('oauth_clients.form_company_name')"
            class="mb-3"
          />
          <v-text-field
            v-model="provForm.contact_email"
            :label="t('oauth_clients.form_contact_email')"
            type="email"
            class="mb-3"
          />
          <v-select
            v-model="provForm.tier"
            :label="t('oauth_clients.form_tier')"
            :items="tierOptions"
            class="mb-3"
          />
          <CmOAuthRoleSelect
            v-model="provForm.role_id"
            :label="t('oauth_clients.form_oauth_role')"
            :hint="t('oauth_clients.form_oauth_role_hint')"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="provisionDialog = false">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!provFormValid" @click="provision">
            {{ t('oauth_clients.create_client') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo de credenciales (revelado único, no se recuperan después) -->
    <v-dialog v-model="credentialsDialog" max-width="640" persistent>
      <v-card v-if="newCredentials">
        <v-card-title class="text-warning">
          <v-icon :icon="mdiAlert" class="mr-2" />
          {{ t('oauth_clients.credentials_title') }}
        </v-card-title>
        <v-card-text>
          <v-alert type="warning" density="compact" class="mb-3">
            {{ t('oauth_clients.credentials_warning') }}
          </v-alert>
          <v-text-field
            :model-value="newCredentials.client_id"
            :label="t('oauth_clients.field_client_id')"
            readonly
            variant="outlined"
            density="comfortable"
            class="mb-4"
            :append-inner-icon="mdiContentCopy"
            @click:append-inner="copy(newCredentials.client_id)"
          />
          <v-text-field
            :model-value="newCredentials.client_secret"
            :label="t('oauth_clients.field_client_secret')"
            readonly
            variant="outlined"
            density="comfortable"
            :append-inner-icon="mdiContentCopy"
            @click:append-inner="copy(newCredentials.client_secret)"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="closeCredentials">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo de asignación de rol OAuth (componente reutilizable) -->
    <OAuthClientRoleDialog v-model="rbacDialog" :client="rbacTarget" @saved="load" />

    <!-- Diálogo de scopes efectivos -->
    <v-dialog v-model="effectiveScopesDialog" max-width="640">
      <v-card v-if="effectiveScopesTarget">
        <v-card-title class="d-flex align-center">
          <v-icon :icon="mdiKeyVariant" class="mr-2" />
          {{ t('oauth_clients.effective_scopes_title', { name: effectiveScopesTarget.client_name || effectiveScopesTarget.client_id }) }}
          <v-spacer />
          <v-btn icon="$close" variant="text" @click="effectiveScopesDialog = false" />
        </v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis mb-3">
            {{ t('oauth_clients.effective_scopes_subtitle') }}
          </p>
          <EffectivePermissionsPreview
            target-type="client"
            :target-id="effectiveScopesTarget.id"
          />
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * OAuth clients — Fase A1 del plan de deprecación de `admin_config`
 * (docs/plan-deprecacion-admin-config.md). Portado desde
 * `admin_config/src/features/oauth_clients/OAuthClientsPage.vue`. El botón
 * "scopes efectivos" (EffectivePermissionsPreview) se conectó en Fase A4,
 * una vez migrado `authz_explain`.
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus,
  mdiKeyChain,
  mdiKey,
  mdiKeyVariant,
  mdiCancel,
  mdiPlay,
  mdiAlert,
  mdiContentCopy,
  mdiShieldKey,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import CmUserAutocomplete from '../components/CmUserAutocomplete.vue';
import CmOAuthRoleSelect from '../../oauth_roles/components/CmOAuthRoleSelect.vue';
import OAuthClientRoleDialog from '../components/OAuthClientRoleDialog.vue';
import EffectivePermissionsPreview from '../../authz_explain/components/EffectivePermissionsPreview.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { oauthClientsService, type OAuthClient } from '../services/oauthClients.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const clients = ref<OAuthClient[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const filterStatus = ref<string | undefined>(undefined);
const filterTier = ref<string | undefined>(undefined);
const selected = ref<{ id: number }[]>([]);

const listSource = useClientSideListSource(clients, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: t('oauth_clients.col_client_id') as string, key: 'client_id' },
  { title: t('oauth_clients.col_name') as string, key: 'client_name' },
  { title: t('oauth_clients.col_company') as string, key: 'company_name' },
  { title: t('oauth_clients.col_type') as string, key: 'client_type' },
  { title: t('oauth_clients.col_role') as string, key: 'role_name' },
  { title: t('oauth_clients.col_tier') as string, key: 'tier' },
  { title: t('oauth_clients.col_status') as string, key: 'status' },
  { title: t('oauth_clients.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = {
  client_id: 'client_id', client_name: 'client_name', company_name: 'company_name',
  client_type: 'client_type', role_name: 'role_name', tier: 'tier', status: 'status',
};

const provisionDialog = ref(false);
const provForm = reactive({
  user_id: null as number | null,
  client_name: '',
  company_name: '',
  contact_email: '',
  tier: 'standard',
  role_id: null as number | null,
});

const credentialsDialog = ref(false);
const newCredentials = ref<{ client_id: string; client_secret: string } | null>(null);

const rbacDialog = ref(false);
const rbacTarget = ref<OAuthClient | null>(null);

const effectiveScopesDialog = ref(false);
const effectiveScopesTarget = ref<OAuthClient | null>(null);
function openEffectiveScopes(c: OAuthClient): void {
  effectiveScopesTarget.value = c;
  effectiveScopesDialog.value = true;
}

const statusOptions = [
  { title: t('oauth_clients.status_active'), value: 'active' },
  { title: t('oauth_clients.status_disabled'), value: 'disabled' },
];
const tierOptions = [
  { title: 'standard', value: 'standard' },
  { title: 'premium', value: 'premium' },
];

const provFormValid = computed(
  () =>
    !!provForm.user_id &&
    !!provForm.client_name.trim() &&
    !!provForm.company_name.trim(),
);

function isActive(c: OAuthClient): boolean {
  if (c.status) return c.status === 'active';
  return c.stato === 'A';
}

function tierToneClass(tier?: string | null): string {
  if (tier === 'premium') return 'cm-tone-accent';
  if (tier === 'standard') return 'cm-tone-neutral';
  return 'cm-tone-neutral';
}

function typeToneClass(type?: string | null): string {
  if (type === 'external') return 'cm-tone-info';
  // Clients legacy/no-especificados se muestran como `internal` (neutro) —
  // varios son funcionalmente externos pero se crearon antes de que
  // existiera la distinción (p. ej. Findair).
  return 'cm-tone-neutral';
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    clients.value = await oauthClientsService.list({
      status: filterStatus.value,
      tier: filterTier.value,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function openProvision(): void {
  provForm.user_id = null;
  provForm.client_name = '';
  provForm.company_name = '';
  provForm.contact_email = '';
  provForm.tier = 'standard';
  provForm.role_id = null;
  provisionDialog.value = true;
}

async function provision(): Promise<void> {
  if (!provForm.user_id) return;
  saving.value = true;
  try {
    const res = await oauthClientsService.provision({
      user_id: provForm.user_id,
      client_name: provForm.client_name,
      company_name: provForm.company_name,
      contact_email: provForm.contact_email || undefined,
      tier: provForm.tier,
      role_id: provForm.role_id ?? undefined,
    });
    provisionDialog.value = false;
    newCredentials.value = { client_id: res.client_id, client_secret: res.client_secret };
    credentialsDialog.value = true;
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

function openRbacRoles(c: OAuthClient): void {
  rbacTarget.value = c;
  rbacDialog.value = true;
}

async function disable(c: OAuthClient): Promise<void> {
  const ok = await confirm.askDanger(
    t('oauth_clients.confirm_disable_message', { name: c.client_name }),
    t('oauth_clients.confirm_disable_title'),
  );
  if (!ok) return;
  try {
    await oauthClientsService.disable(c.id);
    toast.success(t('oauth_clients.disabled'));
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

async function reactivate(c: OAuthClient): Promise<void> {
  try {
    await oauthClientsService.reactivate(c.id);
    toast.success(t('oauth_clients.reactivated'));
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

async function openRotate(c: OAuthClient): Promise<void> {
  const ok = await confirm.askDanger(
    t('oauth_clients.confirm_rotate_message', { name: c.client_name }),
    t('oauth_clients.confirm_rotate_title'),
  );
  if (!ok) return;
  try {
    const res = await oauthClientsService.rotateCredentials(c.id);
    newCredentials.value = res;
    credentialsDialog.value = true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

function copy(text: string): void {
  navigator.clipboard.writeText(text).then(
    () => toast.success(t('common.copied')),
    () => toast.error(t('common.copy_failed')),
  );
}

function closeCredentials(): void {
  newCredentials.value = null;
  credentialsDialog.value = false;
}

onMounted(() => {
  void load();
});
</script>
