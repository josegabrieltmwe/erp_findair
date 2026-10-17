<template>
  <div>
    <CmSectionHeader :title="headerTitle" :subtitle="headerSubtitle">
      <template #actions>
        <v-btn variant="text" :prepend-icon="mdiArrowLeft" @click="goBack">
          {{ t('common.back') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !user"
      :data="user"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiAccountSearch" :title="t('users.detail.not_found')" />
      </template>

      <template #default>
        <div v-if="user">
          <!-- FICHA DE USUARIO -->
          <v-card variant="outlined" class="cm-card mb-4">
            <v-card-text>
              <div class="cm-card-header">
                <div class="cm-block-title">{{ t('users.detail.user_info') }}</div>
                <div>
                  <v-btn
                    v-if="!editMode"
                    size="small"
                    variant="text"
                    :prepend-icon="mdiPencil"
                    @click="enterEdit"
                  >
                    {{ t('common.edit') }}
                  </v-btn>
                  <template v-else>
                    <v-btn size="small" variant="text" @click="cancelEdit">
                      {{ t('common.cancel') }}
                    </v-btn>
                    <v-btn
                      size="small"
                      color="primary"
                      :loading="savingInfo"
                      :prepend-icon="mdiContentSave"
                      @click="saveInfo"
                    >
                      {{ t('common.save') }}
                    </v-btn>
                  </template>
                </div>
              </div>

              <template v-if="!editMode">
                <div class="cm-info-grid">
                  <div><span class="cm-info-label">{{ t('users.field_name') }}:</span> {{ user.nome }}</div>
                  <div><span class="cm-info-label">{{ t('users.field_login') }}:</span> <code>{{ user.loginn }}</code></div>
                  <div><span class="cm-info-label">{{ t('users.field_email') }}:</span> {{ user.mail || '—' }}</div>
                  <div><span class="cm-info-label">{{ t('users.col_partner') }}:</span> #{{ user.id_anagrafica }}<span v-if="user.rag_soc"> — {{ user.rag_soc }}</span></div>
                  <div><span class="cm-info-label">{{ t('users.field_legacy_role') }}:</span> {{ (user.ruolo as string) || '—' }}</div>
                  <div><span class="cm-info-label">{{ t('common.status') }}:</span> {{ user.stato === 'A' ? t('common.active') : t('common.inactive') }}</div>
                </div>
              </template>
              <template v-else>
                <div class="cm-info-edit">
                  <v-text-field
                    v-model="editForm.nome"
                    :label="t('users.field_name')"
                    variant="outlined"
                    density="comfortable"
                  />
                  <v-text-field
                    v-model="editForm.mail"
                    :label="t('users.field_email')"
                    type="email"
                    variant="outlined"
                    density="comfortable"
                  />
                  <v-text-field
                    v-model="editForm.ruolo"
                    :label="t('users.field_legacy_role')"
                    variant="outlined"
                    density="comfortable"
                  />
                </div>
              </template>
            </v-card-text>
          </v-card>

          <!-- PANEL DE SEGURIDAD -->
          <v-card variant="outlined" class="cm-card mb-4">
            <v-card-text>
              <UserSecurityPanel :user-id="user.id" @saved="onSecuritySaved" />
            </v-card-text>
          </v-card>

          <!-- OAUTH CLIENTS (resumen de solo lectura) -->
          <v-card variant="outlined" class="cm-card mb-4">
            <v-card-text>
              <div class="cm-card-header">
                <div class="cm-block-title">
                  {{ t('users.detail.oauth_clients') }}
                  <span v-if="oauthClients.length" class="cm-count">({{ oauthClients.length }})</span>
                </div>
              </div>

              <v-progress-linear v-if="oauthLoading" indeterminate height="2" />

              <p v-else-if="oauthClients.length === 0" class="cm-empty-oauth">
                {{ t('users.detail.no_oauth_clients') }}
              </p>

              <div v-else class="cm-oauth-list">
                <div
                  v-for="c in oauthClients"
                  :key="c.id"
                  class="cm-oauth-item"
                >
                  <v-icon :icon="mdiKeyChain" size="16" class="mr-2" />
                  <div class="cm-oauth-body">
                    <div class="cm-oauth-name">{{ c.client_name || '(no name)' }}</div>
                    <div class="cm-oauth-meta">
                      <v-chip
                        v-if="c.role_name"
                        size="x-small"
                        color="success"
                        variant="tonal"
                      >
                        {{ c.role_name }}
                      </v-chip>
                      <v-chip
                        v-else
                        size="x-small"
                        color="warning"
                        variant="tonal"
                      >
                        {{ t('users.detail.oauth_no_role') }}
                      </v-chip>
                      <span v-if="c.scope_count" class="cm-oauth-scopes">
                        · {{ t('users.detail.oauth_scopes', { n: c.scope_count }) }}
                      </span>
                      <span v-if="c.last_activity" class="cm-oauth-activity">
                        · {{ t('users.detail.oauth_last_used') }}: {{ c.last_activity }}
                      </span>
                    </div>
                  </div>
                  <v-chip
                    size="x-small"
                    :color="(c.status || c.stato) === 'active' || c.stato === 'A' ? 'success' : 'error'"
                    variant="tonal"
                  >
                    {{ c.status || c.stato }}
                  </v-chip>
                  <v-btn
                    size="small"
                    variant="text"
                    :prepend-icon="mdiShieldKey"
                    @click="openClientRole(c)"
                  >
                    {{ t('oauth_clients.manage_role') }}
                  </v-btn>
                </div>
              </div>
            </v-card-text>
          </v-card>

          <!-- ACCIONES DESTRUCTIVAS -->
          <div class="cm-actions-row">
            <v-btn
              variant="outlined"
              :prepend-icon="mdiKeyVariant"
              @click="resetDialog = true"
            >
              {{ t('users.reset_password') }}
            </v-btn>
            <v-btn
              variant="outlined"
              color="error"
              :prepend-icon="mdiAccountOff"
              @click="confirmDelete"
            >
              {{ t('users.delete_action') }}
            </v-btn>
          </div>
        </div>
      </template>
    </CmAsyncSection>

    <ResetPasswordDialog v-model="resetDialog" :user="user" />
    <OAuthClientRoleDialog v-model="clientRoleDialog" :client="clientRoleTarget" @saved="loadOauthClients" />
  </div>
</template>

<script setup lang="ts">
/**
 * Detalle de usuario — Fase A2 del plan de deprecación de `admin_config`
 * (docs/plan-deprecacion-admin-config.md). Portado desde
 * `admin_config/src/features/users/UserDetailPage.vue`. Monta
 * UserSecurityPanel (sin EffectivePermissionsPreview, Fase A4).
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  mdiArrowLeft,
  mdiPencil,
  mdiContentSave,
  mdiKeyVariant,
  mdiAccountOff,
  mdiAccountSearch,
  mdiKeyChain,
  mdiShieldKey,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import UserSecurityPanel from './UserSecurityPanel.vue';
import ResetPasswordDialog from './ResetPasswordDialog.vue';
import OAuthClientRoleDialog from '../../oauth_clients/components/OAuthClientRoleDialog.vue';
import {
  usersService,
  type UserLite,
  type OAuthClientSummary,
} from '../services/users.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const confirm = useConfirm();

const userId = computed(() => parseInt(String(route.params.id ?? ''), 10));

const user = ref<UserLite | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const editMode = ref(false);
const editForm = ref({ nome: '', mail: '', ruolo: '' });
const savingInfo = ref(false);

const oauthClients = ref<OAuthClientSummary[]>([]);
const oauthLoading = ref(false);

const resetDialog = ref(false);

// Rol OAuth del client (diálogo compartido con OAuthClientsPage).
const clientRoleDialog = ref(false);
const clientRoleTarget = ref<OAuthClientSummary | null>(null);
function openClientRole(c: OAuthClientSummary): void {
  clientRoleTarget.value = c;
  clientRoleDialog.value = true;
}

const headerTitle = computed(() =>
  user.value ? user.value.nome || user.value.loginn : t('users.title'),
);
const headerSubtitle = computed(() =>
  user.value ? `#${user.value.id} · ${user.value.loginn}` : t('users.detail.loading'),
);

async function load(): Promise<void> {
  if (!userId.value || userId.value <= 0) return;
  loading.value = true;
  error.value = null;
  try {
    user.value = await usersService.getById(userId.value);
    if (user.value) {
      void loadOauthClients();
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load user';
  } finally {
    loading.value = false;
  }
}

async function loadOauthClients(): Promise<void> {
  oauthLoading.value = true;
  try {
    oauthClients.value = await usersService.listOauthClientsForUser(userId.value);
  } catch {
    oauthClients.value = [];
  } finally {
    oauthLoading.value = false;
  }
}

function enterEdit(): void {
  if (!user.value) return;
  editForm.value = {
    nome: user.value.nome ?? '',
    mail: user.value.mail ?? '',
    ruolo: (user.value.ruolo as string) ?? '',
  };
  editMode.value = true;
}

function cancelEdit(): void {
  editMode.value = false;
}

async function saveInfo(): Promise<void> {
  if (!user.value) return;
  savingInfo.value = true;
  try {
    await usersService.update(user.value.id, {
      nome: editForm.value.nome.trim(),
      mail: editForm.value.mail.trim() || undefined,
      ruolo: editForm.value.ruolo.trim() || undefined,
    });
    Object.assign(user.value, editForm.value);
    editMode.value = false;
    toast.success(t('users.updated'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Save failed');
  } finally {
    savingInfo.value = false;
  }
}

function onSecuritySaved(): void {
  // No hace falta recargar la info de usuario; el propio panel recarga su perfil.
}

async function confirmDelete(): Promise<void> {
  if (!user.value) return;
  const ok = await confirm.ask({
    title: t('users.delete_title') as string,
    message: t('users.delete_message', { name: user.value.nome || user.value.loginn }) as string,
    variant: 'danger',
    confirmLabel: t('common.delete') as string,
  });
  if (!ok) return;
  try {
    await usersService.remove(user.value.id);
    toast.success(t('users.deleted'));
    goBack();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Delete failed');
  }
}

function goBack(): void {
  router.push({ name: 'settings-users' });
}

watch(userId, load);
onMounted(load);
</script>

<style scoped>
.cm-card {
  border-radius: 8px;
}
.cm-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--cm-space-md);
}
.cm-block-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--cm-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: var(--cm-space-xs);
}
.cm-count {
  color: var(--cm-text-muted);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}
.cm-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--cm-space-sm) var(--cm-space-lg);
  font-size: 0.9em;
}
.cm-info-label {
  color: var(--cm-text-muted);
  margin-right: var(--cm-space-xs);
}
.cm-info-edit {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--cm-space-md);
}
@media (max-width: 600px) {
  .cm-info-grid, .cm-info-edit {
    grid-template-columns: 1fr;
  }
}

.cm-empty-oauth {
  font-size: 0.85em;
  color: var(--cm-text-muted);
}
.cm-oauth-list {
  display: flex;
  flex-direction: column;
  gap: var(--cm-space-xs);
}
.cm-oauth-item {
  display: flex;
  align-items: center;
  gap: var(--cm-space-sm);
  padding: var(--cm-space-sm) var(--cm-space-md);
  border: 1px solid var(--cm-border-subtle, rgba(0,0,0,0.08));
  border-radius: 6px;
}
.cm-oauth-body {
  flex: 1;
}
.cm-oauth-name {
  font-weight: 500;
}
.cm-oauth-meta {
  font-size: 0.8em;
  color: var(--cm-text-muted);
  margin-top: 2px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--cm-space-xs);
}
.cm-oauth-scopes, .cm-oauth-activity {
  color: var(--cm-text-muted);
}

.cm-actions-row {
  display: flex;
  gap: var(--cm-space-sm);
  padding-top: var(--cm-space-md);
  border-top: 1px solid var(--cm-border-subtle, rgba(0,0,0,0.08));
}
</style>
