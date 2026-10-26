<template>
  <CmAsyncSection
    :loading="loading"
    :error="error"
    :empty="false"
    :data="profile"
    @clear-error="error = null"
  >
    <template #default>
      <div v-if="profile">
        <!-- ACCESO LEGACY — flags auth_* editables (Plan v5 F1-F7) -->
        <div class="cm-section-block">
          <div class="cm-block-title cm-block-title-with-actions">
            <span>{{ t('users.security.legacy_title') }}</span>
            <RouterLink
              :to="{
                name: 'settings-permission-audit',
                query: { target_type: 'user', target_id: props.userId },
              }"
              class="cm-audit-link"
            >
              <v-icon size="x-small" :icon="mdiHistory" class="mr-1" />
              {{ t('users.security.view_audit_history') }}
            </RouterLink>
          </div>

          <AuthFlagsEditor
            v-model="authFlagsModel"
            :disabled="authFlagsSaving"
            @dirty="authFlagsDirty = $event"
          />

          <div class="cm-auth-save-row">
            <v-btn
              color="primary"
              :loading="authFlagsSaving"
              :disabled="!authFlagsDirty"
              :prepend-icon="mdiContentSave"
              size="small"
              @click="saveAuthFlags"
            >
              {{ t('users.security.save_auth_flags') }}
            </v-btn>
            <span v-if="!authFlagsDirty" class="cm-auth-hint">
              {{ t('users.security.no_changes') }}
            </span>
          </div>

          <!-- Preview de scopes efectivos, calculado en vivo -->
          <div class="mt-3">
            <EffectivePermissionsPreview
              target-type="user"
              :target-id="props.userId"
              :refresh-key="effectiveRefreshKey"
            />
          </div>
        </div>

        <!-- ROLES (RBAC) -->
        <div class="cm-section-block">
          <div class="cm-block-title">{{ t('users.security.roles_title') }}</div>
          <div class="cm-roles-row">
            <CmInternalRoleSelect
              v-model="selectedRoleIds"
              multiple
              :label="t('users.security.roles_label')"
              class="cm-roles-select"
            />
            <v-btn
              color="primary"
              :loading="saving"
              :prepend-icon="mdiContentSave"
              @click="save"
            >
              {{ t('common.save') }}
            </v-btn>
          </div>
        </div>

        <!-- OVERRIDES -->
        <div class="cm-section-block">
          <div class="cm-block-title">
            {{ t('users.security.overrides_title') }}
            <v-btn
              size="x-small"
              variant="text"
              color="primary"
              :prepend-icon="mdiPlus"
              class="ml-2"
              @click="addOverride"
            >
              {{ t('users.security.add_override') }}
            </v-btn>
          </div>

          <p v-if="overrides.length === 0" class="cm-empty-overrides">
            {{ t('users.security.no_overrides') }}
          </p>

          <div v-for="(ov, idx) in overrides" :key="idx" class="cm-override-row">
            <v-select
              v-model="ov.module"
              :items="moduleItems"
              :label="t('users.security.module')"
              density="compact"
              variant="outlined"
              hide-details
              class="cm-override-module"
            />
            <v-select
              v-model="ov.operation"
              :items="operationItems"
              :label="t('users.security.operation')"
              density="compact"
              variant="outlined"
              hide-details
              class="cm-override-op"
            />
            <v-select
              v-model="ov.effect"
              :items="effectItems"
              :label="t('users.security.effect')"
              density="compact"
              variant="outlined"
              hide-details
              class="cm-override-effect"
            />
            <v-text-field
              v-model="ov.reason"
              :label="t('users.security.reason')"
              density="compact"
              variant="outlined"
              hide-details
              class="cm-override-reason"
            />
            <v-btn
              :icon="mdiClose"
              size="small"
              variant="text"
              color="error"
              :title="t('common.delete')"
              @click="removeOverride(idx)"
            />
          </div>
        </div>

        <!-- EFFECTIVE -->
        <div v-if="effectiveEntries.length > 0" class="cm-section-block">
          <div class="cm-block-title">{{ t('users.security.effective_title') }}</div>
          <div class="cm-chips-row">
            <v-chip
              v-for="entry in effectiveEntries"
              :key="entry.key"
              size="x-small"
              :variant="entry.source === 'deny' ? 'flat' : 'outlined'"
              :color="effectiveColor(entry.source)"
            >
              {{ entry.module }}:{{ entry.op }}
            </v-chip>
          </div>
        </div>

        <!-- RESTRICCIONES DE ENDPOINT (whitelist/blacklist por acción) -->
        <div class="cm-section-block">
          <div class="cm-block-title">
            {{ t('users.security.endpoint_restrictions_title') }}
            <v-chip
              v-if="endpointMode === 'whitelist'"
              size="x-small"
              color="warning"
              variant="flat"
              class="ml-2"
            >
              {{ t('users.security.endpoint_mode_whitelist') }}
            </v-chip>
            <v-chip
              v-else-if="endpointMode === 'blacklist'"
              size="x-small"
              color="info"
              variant="flat"
              class="ml-2"
            >
              {{ t('users.security.endpoint_mode_blacklist') }}
            </v-chip>
            <v-chip
              v-else
              size="x-small"
              color="grey"
              variant="outlined"
              class="ml-2"
            >
              {{ t('users.security.endpoint_mode_unrestricted') }}
            </v-chip>
            <v-btn
              size="x-small"
              variant="text"
              color="primary"
              :prepend-icon="mdiPlus"
              class="ml-2"
              @click="addRestriction"
            >
              {{ t('users.security.add_restriction') }}
            </v-btn>
          </div>

          <p class="cm-restriction-hint">
            {{ t('users.security.endpoint_restrictions_hint') }}
          </p>

          <p v-if="restrictions.length === 0" class="cm-empty-overrides">
            {{ t('users.security.no_restrictions') }}
          </p>

          <div v-for="(r, idx) in restrictions" :key="r.id ?? `new-${idx}`" class="cm-override-row">
            <v-text-field
              v-model="r.action"
              :label="t('users.security.action')"
              density="compact"
              variant="outlined"
              hide-details
              :placeholder="t('users.security.action_placeholder')"
              class="cm-override-module"
            />
            <v-select
              v-model="r.effect"
              :items="restrictionEffectItems"
              :label="t('users.security.effect')"
              density="compact"
              variant="outlined"
              hide-details
              class="cm-override-effect"
            />
            <v-text-field
              v-model="r.reason"
              :label="t('users.security.reason')"
              density="compact"
              variant="outlined"
              hide-details
              class="cm-override-reason"
            />
            <v-btn
              :icon="mdiContentSave"
              size="small"
              variant="text"
              color="primary"
              :title="t('common.save')"
              :loading="restrictionSaving === (r.id ?? `new-${idx}`)"
              @click="saveRestriction(r, idx)"
            />
            <v-btn
              v-if="r.id !== null"
              :icon="mdiClose"
              size="small"
              variant="text"
              color="error"
              :title="t('common.delete')"
              @click="removeRestriction(r, idx)"
            />
          </div>

          <v-alert
            v-if="endpointMode === 'whitelist' && restrictions.filter(r => r.id !== null && r.effect === 'allow').length === 0"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ t('users.security.whitelist_empty_warning') }}
          </v-alert>

          <div v-if="restrictions.some(r => r.id !== null)" class="mt-2">
            <v-btn
              size="small"
              variant="text"
              color="error"
              :prepend-icon="mdiDelete"
              @click="clearAllRestrictions"
            >
              {{ t('users.security.clear_all_restrictions') }}
            </v-btn>
          </div>
        </div>

        <!-- ROL BASE API (contatti_oauth_role): uno por usuario; los aditivos van en el bloque de abajo. El permiso
             efectivo por API es la unión de roles ∩ el rol del client OAuth. -->
        <div class="cm-section-block">
          <div class="cm-block-title">
            {{ t('users.security.api_role_title') }}
            <v-chip
              size="x-small"
              :color="apiRole?.role_id ? 'primary' : 'grey'"
              :variant="apiRole?.role_id ? 'flat' : 'outlined'"
              class="ml-2"
            >
              {{ apiRole?.role_name || t('users.security.api_role_none') }}
            </v-chip>
          </div>

          <p class="cm-restriction-hint">
            {{ t('users.security.api_role_hint') }}
          </p>

          <div class="cm-roles-row">
            <CmOAuthRoleSelect
              v-model="apiRoleId"
              :label="t('users.security.api_role_label')"
              :placeholder="t('users.security.api_role_none')"
              :internal-only="apiRoleInternalOnlyMode"
              :exclude-names="ADDON_ROLE_NAMES"
              :disabled="apiRoleSaving || apiRoleLoading"
              class="cm-roles-select"
            />
            <v-btn
              size="small"
              color="primary"
              variant="flat"
              :prepend-icon="mdiContentSave"
              :loading="apiRoleSaving"
              :disabled="!apiRoleDirty"
              @click="saveApiRole"
            >
              {{ t('common.save') }}
            </v-btn>
            <v-btn
              v-if="apiRole?.role_id"
              size="small"
              variant="text"
              color="error"
              :prepend-icon="mdiDelete"
              :disabled="apiRoleSaving"
              @click="revokeApiRole"
            >
              {{ t('users.security.api_role_revoke') }}
            </v-btn>
          </div>
        </div>

        <!-- ROLES ADITIVOS — se suman al rol base; la unión de sus scopes es lo que cuenta. -->
        <div class="cm-section-block">
          <div class="cm-block-title">{{ t('users.security.addon_title') }}</div>
          <p class="cm-restriction-hint">{{ t('users.security.addon_hint') }}</p>
          <ContactAddonRoles :contatto-id="userId" :state="apiRole" @updated="onAddonUpdated" />
        </div>
      </div>
    </template>
  </CmAsyncSection>
</template>

<script setup lang="ts">
/**
 * Panel de seguridad de usuario — Fase A2 del plan de deprecación de
 * `admin_config` (docs/plan-deprecacion-admin-config.md). Portado desde
 * `admin_config/src/features/users/UserSecurityPanel.vue`. El preview de
 * scopes efectivos y el link de auditoría se conectaron en Fase A4, una
 * vez migrados `authz_explain` y `permission_audit`.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { mdiContentSave, mdiPlus, mdiClose, mdiDelete, mdiHistory } from '@mdi/js';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmInternalRoleSelect from '../../internal_roles/components/CmInternalRoleSelect.vue';
import AuthFlagsEditor from '../../anagrafiche/components/AuthFlagsEditor.vue';
import EffectivePermissionsPreview from '../../authz_explain/components/EffectivePermissionsPreview.vue';
import {
  usersService,
  type UserSecurityProfile,
  type UserOverride,
  type OverrideEffect,
  type OverrideOperation,
} from '../services/users.service';
import {
  userEndpointRestrictionsService,
  type RestrictionEffect,
  type RestrictionMode,
  type EndpointRestriction,
} from '../services/userEndpointRestrictions.service';
import CmOAuthRoleSelect from '../../oauth_roles/components/CmOAuthRoleSelect.vue';
import { roleConflictMessage } from '../../oauth_roles/services/oauthRoles.service';
import { contattiService, ADDON_ROLE_NAMES, type ApiRoleState } from '../../anagrafiche/services/contatti.service';
import ContactAddonRoles from '../components/ContactAddonRoles.vue';
import { useAuthCapabilities } from '../../anagrafiche/composables/useAuthCapabilities';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';

interface Props {
  userId: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  saved: [];
}>();

const { t } = useI18n();
const toast = useToastStore();
const confirmDialog = useConfirm();

const profile = ref<UserSecurityProfile | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const selectedRoleIds = ref<number[]>([]);
const overrides = ref<UserOverride[]>([]);
const availableModules = ref<Record<string, string>>({});

// Plan v5 F1-F7: flags auth_* editables
const { activeFlags } = useAuthCapabilities();
const authFlagsModel = ref<Record<string, 'S' | 'N'>>({});
const authFlagsSaving = ref(false);
const authFlagsDirty = ref(false);
const effectiveRefreshKey = ref(0);

// Restricciones de endpoint (whitelist/blacklist por acción)
interface RestrictionRow extends Omit<EndpointRestriction, 'reason'> {
  reason: string; // nunca null en el formulario
}
const restrictions = ref<RestrictionRow[]>([]);
const endpointMode = ref<RestrictionMode>('unrestricted');
const restrictionSaving = ref<number | string | null>(null);

// Rol API (contatti_oauth_role): 1 rol OAuth por usuario. Sustituye a los
// scopes sueltos por usuario (user_scopes, retirados): el permiso efectivo
// por API es rol del client ∩ rol del usuario.
const apiRole = ref<ApiRoleState | null>(null);
const apiRoleId = ref<number | null>(null);
const apiRoleLoading = ref(false);
const apiRoleSaving = ref(false);
const apiRoleDirty = computed(() => (apiRole.value?.role_id ?? null) !== apiRoleId.value);
// Los roles con scopes restringidos (admin/config:*) solo tienen sentido para
// usuarios de TMWE (anagrafica 1); al resto no se les ofrecen.
const apiRoleInternalOnlyMode = computed<'show' | 'hide'>(() =>
  profile.value?.user?.id_anagrafica === 1 ? 'show' : 'hide',
);

const restrictionEffectItems = computed(() => [
  { title: t('users.security.effect_allow'), value: 'allow' as RestrictionEffect },
  { title: t('users.security.effect_deny'), value: 'deny' as RestrictionEffect },
]);

const operationItems: OverrideOperation[] = ['read', 'write', 'delete', 'admin'];

const effectItems = computed(() => [
  { title: t('users.security.effect_grant'), value: 'grant' as OverrideEffect },
  { title: t('users.security.effect_deny'), value: 'deny' as OverrideEffect },
]);

const moduleItems = computed(() =>
  Object.entries(availableModules.value).map(([key, desc]) => ({
    title: `${key} — ${desc}`,
    value: key,
  })),
);

interface EffectiveEntry {
  key: string;
  module: string;
  op: string;
  source: string;
}

const effectiveEntries = computed<EffectiveEntry[]>(() => {
  if (!profile.value?.effective) return [];
  const out: EffectiveEntry[] = [];
  for (const [mod, ops] of Object.entries(profile.value.effective)) {
    for (const [op, source] of Object.entries(ops)) {
      out.push({ key: `${mod}:${op}`, module: mod, op, source: String(source) });
    }
  }
  return out;
});

function effectiveColor(source: string): string {
  if (source === 'grant') return 'success';
  if (source === 'deny') return 'error';
  return 'grey';
}

async function load(): Promise<void> {
  if (!props.userId || props.userId <= 0) return;
  loading.value = true;
  error.value = null;
  try {
    const [p, modules, endpointState, apiRoleState] = await Promise.all([
      usersService.getSecurityProfile(props.userId),
      // Los módulos no cambian a menudo — usar una pequeña caché en memoria.
      moduleCache ? Promise.resolve(moduleCache) : usersService.getAvailableModules(),
      userEndpointRestrictionsService.list(props.userId).catch(() => null),
      contattiService.getApiRole(props.userId).catch(() => null),
    ]);
    profile.value = p;
    selectedRoleIds.value = (p.roles ?? []).map((r) => r.role_id);
    overrides.value = (p.overrides ?? []).map((o) => ({
      module: o.module,
      operation: o.operation,
      effect: o.effect,
      reason: o.reason ?? '',
    }));
    if (!moduleCache) moduleCache = modules;
    availableModules.value = moduleCache;

    // Plan v5 F1-F7: hidratar el modelo auth_flags desde profile.legacy
    const legacy = (p.legacy ?? {}) as Record<string, string | undefined>;
    const initial: Record<string, 'S' | 'N'> = {};
    for (const flag of activeFlags.value) {
      initial[flag] = legacy[flag] === 'S' ? 'S' : 'N';
    }
    authFlagsModel.value = initial;
    authFlagsDirty.value = false;

    if (endpointState) {
      endpointMode.value = endpointState.mode;
      restrictions.value = endpointState.restrictions.map((r) => ({
        ...r,
        reason: r.reason ?? '',
      }));
    } else {
      // Si el servicio falla (p. ej. backend caído), no romper el panel.
      endpointMode.value = 'unrestricted';
      restrictions.value = [];
    }

    // Rol API (contatti_oauth_role). Si el servicio falla, el bloque queda
    // como "sin rol" pero no rompe el panel.
    apiRole.value = apiRoleState;
    apiRoleId.value = apiRoleState?.role_id ?? null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load security profile';
  } finally {
    loading.value = false;
  }
}

/**
 * Plan v5 F1-F7: persiste cambios de flags auth_* vía PUT /api_admin_users.
 * Solo envía los flags que difieren del baseline (profile.legacy).
 * El hook del backend escribe automáticamente en permission_audit_log.
 */
async function saveAuthFlags(): Promise<void> {
  if (!profile.value || !authFlagsDirty.value) return;
  authFlagsSaving.value = true;
  try {
    const baseline = (profile.value.legacy ?? {}) as Record<string, string | undefined>;
    const payload: Record<string, 'S' | 'N'> = {};
    for (const flag of activeFlags.value) {
      const next = authFlagsModel.value[flag] ?? 'N';
      const prev = baseline[flag] === 'S' ? 'S' : 'N';
      if (next !== prev) {
        payload[flag] = next;
      }
    }
    if (Object.keys(payload).length === 0) {
      // Nada que enviar (el modelo se resincronizó con el baseline).
      return;
    }
    await usersService.update(props.userId, payload);
    toast.success(t('users.security.auth_flags_saved'));
    emit('saved');
    // Recargar el perfil para refrescar el baseline.
    await load();
    effectiveRefreshKey.value += 1;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('users.security.auth_flags_save_failed'));
  } finally {
    authFlagsSaving.value = false;
  }
}

let moduleCache: Record<string, string> | null = null;

async function save(): Promise<void> {
  saving.value = true;
  try {
    await usersService.saveSecurity(props.userId, selectedRoleIds.value, overrides.value);
    toast.success(t('users.security.saved'));
    emit('saved');
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Save failed');
  } finally {
    saving.value = false;
  }
}

function addOverride(): void {
  overrides.value.push({
    module: '',
    operation: 'read',
    effect: 'grant',
    reason: '',
  });
}

function removeOverride(idx: number): void {
  overrides.value.splice(idx, 1);
}

// =====================================================================
// Restricciones de endpoint (whitelist/blacklist por acción)
// =====================================================================

function addRestriction(): void {
  // Las filas nuevas tienen id=null hasta guardarse.
  restrictions.value.push({
    id: null,
    action: '',
    effect: 'allow',
    reason: '',
    granted_by: null,
    created_at: null,
  });
}

async function saveRestriction(row: RestrictionRow, idx: number): Promise<void> {
  const action = row.action.trim();
  if (!action) {
    toast.error(t('users.security.action_required'));
    return;
  }
  const key = row.id ?? `new-${idx}`;
  restrictionSaving.value = key;
  try {
    const state = await userEndpointRestrictionsService.setRestriction(
      props.userId,
      action,
      row.effect,
      row.reason || null,
    );
    endpointMode.value = state.mode;
    restrictions.value = state.restrictions.map((r) => ({
      ...r,
      reason: r.reason ?? '',
    }));
    toast.success(t('users.security.restriction_saved'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Save failed');
  } finally {
    restrictionSaving.value = null;
  }
}

async function removeRestriction(row: RestrictionRow, idx: number): Promise<void> {
  if (row.id === null) {
    // Fila solo local, simplemente eliminar.
    restrictions.value.splice(idx, 1);
    return;
  }
  try {
    const state = await userEndpointRestrictionsService.removeRestriction(props.userId, row.action);
    endpointMode.value = state.mode;
    restrictions.value = state.restrictions.map((r) => ({
      ...r,
      reason: r.reason ?? '',
    }));
    toast.success(t('users.security.restriction_removed'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Remove failed');
  }
}

async function clearAllRestrictions(): Promise<void> {
  const ok = await confirmDialog.askDanger(
    t('users.security.clear_all_restrictions_confirm'),
    t('users.security.clear_all_restrictions'),
  );
  if (!ok) return;
  try {
    const state = await userEndpointRestrictionsService.removeAll(props.userId);
    endpointMode.value = state.mode;
    restrictions.value = state.restrictions.map((r) => ({
      ...r,
      reason: r.reason ?? '',
    }));
    toast.success(t('users.security.restrictions_cleared'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Clear failed');
  }
}

// =====================================================================
// Rol API (contatti_oauth_role)
// =====================================================================

async function persistApiRole(roleId: number | null): Promise<void> {
  apiRoleSaving.value = true;
  try {
    const state = await contattiService.setApiRole(props.userId, roleId);
    apiRole.value = state;
    apiRoleId.value = state.role_id;
    toast.success(roleId == null
      ? t('users.security.api_role_revoked')
      : t('users.security.api_role_saved'));
    emit('saved');
    effectiveRefreshKey.value += 1;
  } catch (e) {
    // 409 ROLE_NOT_ASSIGNABLE: rol solo-interno para un usuario que no es de TMWE.
    toast.error(roleConflictMessage(e, 'ROLE_NOT_ASSIGNABLE') ?? (e instanceof Error ? e.message : 'Save failed'));
  } finally {
    apiRoleSaving.value = false;
  }
}

/** Un rol aditivo se sumó o retiró: el estado del contacto cambia, y con él los permisos efectivos. */
function onAddonUpdated(state: ApiRoleState): void {
  apiRole.value = state;
  emit('saved');
  effectiveRefreshKey.value += 1;
}

/** Guarda el rol elegido; con el selector vacío ("sin rol") revoca. */
async function saveApiRole(): Promise<void> {
  if (!apiRoleDirty.value) return;
  await persistApiRole(apiRoleId.value);
}

async function revokeApiRole(): Promise<void> {
  const ok = await confirmDialog.askDanger(
    t('users.security.api_role_revoke_confirm'),
    t('users.security.api_role_revoke'),
  );
  if (!ok) return;
  await persistApiRole(null);
}

watch(() => props.userId, load);
onMounted(load);
</script>

<style scoped>
.cm-section-block {
  margin-bottom: var(--cm-space-lg);
}
.cm-block-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--cm-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--cm-space-sm);
  display: flex;
  align-items: center;
}
.cm-block-title-with-actions {
  justify-content: space-between;
}
.cm-audit-link {
  font-size: 0.7rem;
  text-transform: none;
  letter-spacing: 0;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.cm-audit-link:hover {
  text-decoration: underline;
}
.cm-auth-save-row {
  display: flex;
  align-items: center;
  gap: var(--cm-space-md);
  margin-top: var(--cm-space-md);
}
.cm-auth-hint {
  font-size: 0.75rem;
  color: var(--cm-text-muted);
  font-style: italic;
}
.cm-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--cm-space-xs);
}
.cm-roles-row {
  display: flex;
  align-items: flex-start;
  gap: var(--cm-space-md);
  flex-wrap: wrap;
}
.cm-roles-select {
  flex: 1 1 auto;
  min-width: 320px;
  max-width: 480px;
}
.cm-empty-overrides {
  font-size: 0.85em;
  color: var(--cm-text-muted);
}
.cm-restriction-hint {
  font-size: 0.8em;
  color: var(--cm-text-muted);
  margin-bottom: var(--cm-space-sm);
  font-style: italic;
}
.cm-override-row {
  display: flex;
  gap: var(--cm-space-sm);
  align-items: center;
  margin-bottom: var(--cm-space-xs);
  flex-wrap: wrap;
}
.cm-override-module { min-width: 240px; max-width: 320px; flex: 1 1 240px; }
.cm-override-op { width: 130px; }
.cm-override-effect { width: 130px; }
.cm-override-reason { min-width: 180px; max-width: 280px; flex: 1 1 180px; }
</style>
