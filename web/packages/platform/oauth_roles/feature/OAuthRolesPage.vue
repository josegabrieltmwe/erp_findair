<template>
  <div>
    <CmSectionHeader
      :title="t('oauth_roles.title')"
      :subtitle="t('oauth_roles.subtitle')"
    >
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('oauth_roles.new_role') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <CmEmptyState
      v-if="!loading && !error && roles.length === 0"
      :icon="mdiShieldKey"
      :title="t('oauth_roles.empty_title')"
    />
    <template v-else>
      <v-card class="mb-4" variant="outlined">
        <v-card-title>
          <span>{{ t('oauth_roles.system_roles') }}</span>
          <v-chip size="x-small" class="cm-tone-neutral ml-2">{{ systemRoles.length }}</v-chip>
        </v-card-title>
        <ListingDataView
          :source="systemListSource"
          :headers="systemHeaders"
          :selected="selectedSystem"
          :sort-key-map="sortKeyMap"
          mode="infinite"
          :selectable="false"
          @update:selected="selectedSystem = $event"
        >
          <template #cell.role_name="{ item }">
            <span class="cm-mono">{{ (item as OAuthRole).role_name }}</span>
          </template>
          <template #cell.display_name="{ item }">
            {{ (item as OAuthRole).display_name || '—' }}
          </template>
          <template #cell.scopes="{ item }">
            {{ scopeCount(item as OAuthRole) }}
          </template>
          <template #cell.audience="{ item }">
            <v-chip v-if="(item as OAuthRole).internal_only" size="x-small" class="cm-tone-warning">
              {{ t('oauth_roles.internal_only_badge') }}
            </v-chip>
            <span v-else class="cm-cell-hint">{{ t('oauth_roles.audience_any') }}</span>
          </template>
          <template #cell.client_count="{ item }">
            {{ (item as OAuthRole).client_count ?? '—' }}
          </template>
          <template #cell.user_count="{ item }">
            {{ (item as OAuthRole).user_count ?? '—' }}
          </template>
          <template #cell.actions>
            <div class="cm-actions-right">
              <v-chip size="x-small" class="cm-tone-info">SYSTEM</v-chip>
            </div>
          </template>
        </ListingDataView>
      </v-card>

      <v-card variant="outlined">
        <v-card-title>
          <span>{{ t('oauth_roles.custom_roles') }}</span>
          <v-chip size="x-small" class="cm-tone-neutral ml-2">{{ customRoles.length }}</v-chip>
        </v-card-title>
        <ListingDataView
          :source="customListSource"
          :headers="customHeaders"
          :selected="selectedCustom"
          :sort-key-map="sortKeyMap"
          mode="infinite"
          :selectable="false"
          @update:selected="selectedCustom = $event"
        >
          <template #cell.role_name="{ item }">
            <span class="cm-mono">{{ (item as OAuthRole).role_name }}</span>
          </template>
          <template #cell.display_name="{ item }">
            {{ (item as OAuthRole).display_name || '—' }}
          </template>
          <template #cell.scopes="{ item }">
            {{ scopeCount(item as OAuthRole) }}
          </template>
          <template #cell.audience="{ item }">
            <v-chip v-if="(item as OAuthRole).internal_only" size="x-small" class="cm-tone-warning">
              {{ t('oauth_roles.internal_only_badge') }}
            </v-chip>
            <span v-else class="cm-cell-hint">{{ t('oauth_roles.audience_any') }}</span>
          </template>
          <template #cell.client_count="{ item }">
            {{ (item as OAuthRole).client_count ?? '—' }}
          </template>
          <template #cell.user_count="{ item }">
            {{ (item as OAuthRole).user_count ?? '—' }}
          </template>
          <template #cell.actions="{ item }">
            <div class="cm-actions-right">
              <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(item as OAuthRole)">
                {{ t('common.edit') }}
              </v-btn>
              <v-tooltip
                :disabled="!isInUse(item as OAuthRole)"
                :text="t('oauth_roles.delete_blocked_in_use', usageOf(item as OAuthRole))"
                location="top"
              >
                <template #activator="{ props: tp }">
                  <span v-bind="tp">
                    <v-btn
                      size="small"
                      variant="text"
                      color="error"
                      :prepend-icon="mdiDelete"
                      :disabled="isInUse(item as OAuthRole)"
                      @click="openDelete(item as OAuthRole)"
                    >
                      {{ t('common.delete') }}
                    </v-btn>
                  </span>
                </template>
              </v-tooltip>
            </div>
          </template>
        </ListingDataView>
      </v-card>
    </template>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-dialog v-model="formDialog" max-width="900" persistent>
      <v-card>
        <v-card-title>
          {{ formMode === 'create' ? t('oauth_roles.dialog_create') : t('oauth_roles.dialog_edit', { name: form.display_name }) }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid mb-4">
            <v-text-field
              v-model="form.role_name"
              :label="t('oauth_roles.form_role_name')"
              :disabled="formMode === 'edit'"
              :rules="[slugRule]"
              hide-details="auto"
            />
            <v-text-field
              v-model="form.display_name"
              :label="t('oauth_roles.form_display_name')"
              hide-details="auto"
            />
          </div>
          <v-textarea
            v-model="form.description"
            :label="t('oauth_roles.form_description')"
            rows="2"
            class="mb-4"
            hide-details
          />

          <div class="cm-form-label mb-2">
            {{ t('oauth_roles.scopes_section') }}
            <v-chip size="x-small" class="cm-tone-neutral ml-2">{{ form.scopes.length }}</v-chip>
          </div>
          <div class="cm-scope-grid mb-4">
            <v-checkbox
              v-for="s in availableScopes"
              :key="s.scope"
              v-model="form.scopes"
              :value="s.scope"
              :label="s.scope"
              hide-details
              density="compact"
            >
              <template #label>
                <div>
                  <div class="cm-mono">{{ s.scope }}</div>
                  <div class="cm-cell-hint">{{ s.description }}</div>
                </div>
              </template>
            </v-checkbox>
          </div>

          <v-switch
            v-model="restrictEndpoints"
            :label="t('oauth_roles.restrict_endpoints')"
            color="primary"
            hide-details
            class="mb-2"
          />
          <v-textarea
            v-if="restrictEndpoints"
            v-model="endpointsText"
            :label="t('oauth_roles.form_allowed_endpoints')"
            :placeholder="t('oauth_roles.endpoints_placeholder')"
            rows="3"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="formDialog = false">
            {{ t('common.cancel') }}
          </v-btn>
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
 * Plantillas de rol OAuth2 — Fase A1 del plan de deprecación de
 * `admin_config` (docs/plan-deprecacion-admin-config.md). Portado 1:1 desde
 * `admin_config/src/features/oauth_roles/OAuthRolesPage.vue`: primer eslabón
 * del grafo de dependencias (oauth_clients y client_onboarding lo necesitan).
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiShieldKey } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  oauthRolesService,
  roleConflictMessage,
  type OAuthRole,
  type AvailableScope,
} from '../services/oauthRoles.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const roles = ref<OAuthRole[]>([]);
const availableScopes = ref<AvailableScope[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const form = reactive({
  id: 0,
  role_name: '',
  display_name: '',
  description: '',
  scopes: [] as string[],
});
const restrictEndpoints = ref(false);
const endpointsText = ref('');

const systemRoles = computed(() => roles.value.filter((r) => r.is_system === 1));
const customRoles = computed(() => roles.value.filter((r) => r.is_system !== 1));

const selectedSystem = ref<{ id: number }[]>([]);
const selectedCustom = ref<{ id: number }[]>([]);
const systemListSource = useClientSideListSource(systemRoles, { loading });
const customListSource = useClientSideListSource(customRoles, { loading });

const systemHeaders: DataTableHeader[] = [
  { title: t('oauth_roles.col_name') as string, key: 'role_name' },
  { title: t('oauth_roles.col_display') as string, key: 'display_name' },
  { title: t('oauth_roles.col_scopes') as string, key: 'scopes', sortable: false },
  { title: t('oauth_roles.col_audience') as string, key: 'audience', sortable: false },
  { title: t('oauth_roles.col_clients') as string, key: 'client_count' },
  { title: t('oauth_roles.col_users') as string, key: 'user_count' },
  { title: '', key: 'actions', sortable: false, align: 'end' },
];
const customHeaders: DataTableHeader[] = [
  { title: t('oauth_roles.col_name') as string, key: 'role_name' },
  { title: t('oauth_roles.col_display') as string, key: 'display_name' },
  { title: t('oauth_roles.col_scopes') as string, key: 'scopes', sortable: false },
  { title: t('oauth_roles.col_audience') as string, key: 'audience', sortable: false },
  { title: t('oauth_roles.col_clients') as string, key: 'client_count' },
  { title: t('oauth_roles.col_users') as string, key: 'user_count' },
  { title: t('oauth_roles.col_actions') as string, key: 'actions', sortable: false, align: 'end' },
];
const sortKeyMap: Record<string, string> = {
  role_name: 'role_name', display_name: 'display_name', client_count: 'client_count', user_count: 'user_count',
};

/** Contadores de uso (clients + usuarios) para tooltip/bloqueo de borrado. */
function usageOf(r: OAuthRole): { clients: number; users: number } {
  return { clients: r.client_count ?? 0, users: r.user_count ?? 0 };
}
function isInUse(r: OAuthRole): boolean {
  const u = usageOf(r);
  return u.clients > 0 || u.users > 0;
}

const slugRule = (v: string): boolean | string =>
  /^[a-z0-9_]+$/.test(v) || t('oauth_roles.slug_invalid');

const formValid = computed(
  () =>
    !!form.role_name &&
    /^[a-z0-9_]+$/.test(form.role_name) &&
    !!form.display_name.trim() &&
    form.scopes.length > 0,
);

function scopeCount(r: OAuthRole): string {
  const s = Array.isArray(r.scopes) ? r.scopes : [];
  return t('oauth_roles.scope_count', { n: s.length });
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [rolesData, scopesData] = await Promise.all([
      oauthRolesService.list(),
      oauthRolesService.availableScopes(),
    ]);
    roles.value = rolesData;
    availableScopes.value = scopesData;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  form.id = 0;
  form.role_name = '';
  form.display_name = '';
  form.description = '';
  form.scopes = [];
  restrictEndpoints.value = false;
  endpointsText.value = '';
}

function openCreate(): void {
  formMode.value = 'create';
  resetForm();
  formDialog.value = true;
}

function openEdit(role: OAuthRole): void {
  formMode.value = 'edit';
  form.id = role.id;
  form.role_name = role.role_name;
  form.display_name = role.display_name || '';
  form.description = role.description || '';
  form.scopes = Array.isArray(role.scopes) ? [...role.scopes] : [];
  const endpoints = Array.isArray(role.allowed_endpoints) ? role.allowed_endpoints : [];
  restrictEndpoints.value = endpoints.length > 0;
  endpointsText.value = endpoints.join('\n');
  formDialog.value = true;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const allowed = restrictEndpoints.value
      ? endpointsText.value
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
    const payload = {
      role_name: form.role_name,
      display_name: form.display_name,
      description: form.description,
      scopes: form.scopes,
      allowed_endpoints: allowed,
    };
    if (formMode.value === 'create') {
      await oauthRolesService.create(payload);
      toast.success(t('oauth_roles.created'));
    } else {
      await oauthRolesService.update({ id: form.id, ...payload });
      toast.success(t('oauth_roles.updated'));
    }
    formDialog.value = false;
    await load();
  } catch (e) {
    // 409 ROLE_IN_USE_BY_EXTERNAL: no puede pasar a contener scopes
    // reservados mientras lo usen clients externos.
    toast.error(roleConflictMessage(e) ?? (e instanceof Error ? e.message : String(e)));
  } finally {
    saving.value = false;
  }
}

async function openDelete(role: OAuthRole): Promise<void> {
  // El botón ya va deshabilitado si el rol tiene asignaciones; el backend
  // además responde 409 ROLE_IN_USE si la lista estaba desactualizada.
  if (isInUse(role)) {
    toast.error(t('oauth_roles.delete_blocked_in_use', usageOf(role)));
    return;
  }
  const msg = t('oauth_roles.confirm_delete_message', { name: role.display_name || role.role_name });
  const ok = await confirm.askDanger(msg, t('oauth_roles.confirm_delete_title'));
  if (!ok) return;
  try {
    await oauthRolesService.remove(role.id);
    toast.success(t('oauth_roles.deleted'));
    await load();
  } catch (e) {
    const inUse = roleConflictMessage(e, 'ROLE_IN_USE');
    toast.error(inUse ?? (e instanceof Error ? e.message : String(e)));
    if (inUse) await load();
  }
}

onMounted(() => {
  void load();
});
</script>

<style scoped>
.cm-scope-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--cm-space-sm);
  max-height: 360px;
  overflow: auto;
  padding: var(--cm-space-md);
  border: 1px solid var(--cm-border-color);
  border-radius: var(--cm-radius-md);
  background: var(--cm-bg-subtle);
}
.cm-form-label {
  font-size: var(--cm-fs-sm);
  font-weight: var(--cm-fw-semibold);
  color: var(--cm-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
