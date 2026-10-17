<template>
  <v-dialog :model-value="modelValue" max-width="960" persistent @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>
        <div class="d-flex align-center justify-space-between" style="width: 100%">
          <div>
            {{ t('module_permissions.edit_title') }}
            <div class="text-caption text-medium-emphasis cm-mono">
              {{ user.nome || user.loginn || ('#' + user.id) }} · {{ userEmail }}
            </div>
          </div>
          <v-chip v-if="totalGranted > 0" size="small" class="cm-tone-info">
            {{ t('module_permissions.granted_count', { n: totalGranted }) }}
          </v-chip>
        </div>
      </v-card-title>
      <v-tabs v-model="activeTab" density="compact">
        <v-tab value="matrix">{{ t('module_permissions.tab_matrix') }}</v-tab>
        <v-tab value="profile">{{ t('module_permissions.tab_profile') }}</v-tab>
      </v-tabs>

      <v-card-text v-show="activeTab === 'profile'">
        <UserSecurityPanel :user-id="user.id" />
      </v-card-text>

      <v-card-text v-show="activeTab === 'matrix'">
        <v-alert v-if="error" type="error" density="compact" closable class="mb-3" @click:close="error = null">
          {{ error }}
        </v-alert>

        <v-text-field
          v-model="moduleFilter"
          :label="t('module_permissions.filter_module')"
          :prepend-inner-icon="mdiMagnify"
          density="compact"
          hide-details
          clearable
          class="mb-3"
        />

        <div v-if="!loading" class="d-flex align-center ga-2 mb-2 flex-wrap">
          <span class="cm-cell-hint">{{ t('module_permissions.bulk_actions') }}:</span>
          <v-btn size="x-small" variant="tonal" @click="selectAllVisible">
            {{ t('module_permissions.bulk_all') }}
          </v-btn>
          <v-btn size="x-small" variant="tonal" @click="deselectAllVisible">
            {{ t('module_permissions.bulk_none') }}
          </v-btn>
          <v-btn v-if="permissions.includes('admin')" size="x-small" variant="tonal" @click="grantAdminAllVisible">
            {{ t('module_permissions.bulk_admin') }}
          </v-btn>
        </div>

        <v-progress-linear v-if="loading" indeterminate />

        <v-table v-else density="compact" class="cm-matrix">
          <thead>
            <tr>
              <th>{{ t('module_permissions.col_module') }}</th>
              <th v-for="p in permissions" :key="p" class="text-center" :title="permissionTooltip(p)">
                {{ p }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in filteredModules" :key="m.key">
              <td>
                <div class="cm-stack-tight">
                  <span class="cm-mono">{{ m.key }}</span>
                  <span class="cm-cell-hint">{{ m.description }}</span>
                </div>
              </td>
              <td v-for="p in permissions" :key="p" class="text-center">
                <v-checkbox
                  :model-value="hasPerm(m.key, p)"
                  density="compact"
                  hide-details
                  color="primary"
                  @update:model-value="togglePerm(m.key, p, $event)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
      <v-card-actions>
        <v-btn variant="text" :disabled="saving" @click="close">
          {{ activeTab === 'matrix' ? t('common.cancel') : t('common.close') }}
        </v-btn>
        <v-spacer />
        <template v-if="activeTab === 'matrix'">
          <v-btn
            variant="text"
            color="error"
            :disabled="saving || totalGranted === 0"
            @click="revokeAll"
          >
            {{ t('module_permissions.revoke_all') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!dirty"
            @click="save"
          >
            {{ t('common.save') }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiMagnify } from '@mdi/js';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import UserSecurityPanel from '../../users/feature/UserSecurityPanel.vue';
import {
  modulePermissionsService,
  type AvailableModules,
  type UserSummary,
  type SearchUser,
  type Grant,
} from '../services/modulePermissions.service';

interface Props {
  modelValue: boolean;
  user: UserSummary | SearchUser;
  available: AvailableModules | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
}>();

const { t } = useI18n();
const confirm = useConfirm();

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const activeTab = ref<'matrix' | 'profile'>('matrix');
const moduleFilter = ref('');

/** Estado de trabajo: mapa "modulo|permiso" -> boolean */
const state = ref<Record<string, boolean>>({});
/** Snapshot del estado original (para calcular dirty) */
const original = ref<Record<string, boolean>>({});

const userEmail = computed(() => (props.user as { mail?: string }).mail || '');

const permissions = computed<string[]>(() => props.available?.permissions ?? []);

const modulesList = computed(() => {
  if (!props.available?.modules) return [];
  return Object.entries(props.available.modules).map(([key, description]) => ({ key, description }));
});

const filteredModules = computed(() => {
  const q = moduleFilter.value.trim().toLowerCase();
  if (!q) return modulesList.value;
  return modulesList.value.filter(
    (m) => m.key.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q),
  );
});

const totalGranted = computed(() => Object.values(state.value).filter(Boolean).length);

const dirty = computed(() => {
  const keys = new Set([...Object.keys(state.value), ...Object.keys(original.value)]);
  for (const k of keys) {
    if (!!state.value[k] !== !!original.value[k]) return true;
  }
  return false;
});

function permissionTooltip(p: string): string {
  return props.available?.permission_descriptions?.[p] || p;
}

function hasPerm(module: string, permission: string): boolean {
  return !!state.value[`${module}|${permission}`];
}

function togglePerm(module: string, permission: string, on: boolean | null): void {
  const key = `${module}|${permission}`;
  state.value = { ...state.value, [key]: !!on };
}

/** Bulk: activa/desactiva todos los permisos de todos los módulos visibles (filtrados). */
function setAllVisible(on: boolean): void {
  const next = { ...state.value };
  for (const m of filteredModules.value) {
    for (const p of permissions.value) {
      next[`${m.key}|${p}`] = on;
    }
  }
  state.value = next;
}
function selectAllVisible(): void {
  setAllVisible(true);
}
function deselectAllVisible(): void {
  setAllVisible(false);
}
/** Bulk: concede el permiso 'admin' en todos los módulos visibles (filtrados). */
function grantAdminAllVisible(): void {
  const next = { ...state.value };
  for (const m of filteredModules.value) {
    next[`${m.key}|admin`] = true;
  }
  state.value = next;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const data = await modulePermissionsService.getUserPermissions(props.user.id);
    const flat: Record<string, boolean> = {};
    for (const [module, entries] of Object.entries(data.permissions)) {
      for (const e of entries) {
        flat[`${module}|${e.permission}`] = true;
      }
    }
    state.value = { ...flat };
    original.value = { ...flat };
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    const grants: Grant[] = Object.entries(state.value)
      .filter(([, on]) => on)
      .map(([key]) => {
        const [module, permission] = key.split('|');
        return { module, permission };
      });
    await modulePermissionsService.replaceAll(props.user.id, grants);
    original.value = { ...state.value };
    emit('saved');
    emit('update:modelValue', false);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

async function revokeAll(): Promise<void> {
  const ok = await confirm.askDanger(
    t('module_permissions.confirm_revoke_all_msg', { name: props.user.nome || props.user.loginn || ('#' + props.user.id) }),
    t('module_permissions.confirm_revoke_all_title'),
  );
  if (!ok) return;
  saving.value = true;
  try {
    await modulePermissionsService.replaceAll(props.user.id, []);
    state.value = {};
    original.value = {};
    emit('saved');
    emit('update:modelValue', false);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

function close(): void {
  emit('update:modelValue', false);
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      activeTab.value = 'matrix';
      moduleFilter.value = '';
      error.value = null;
      void load();
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.cm-matrix th,
.cm-matrix td {
  vertical-align: middle;
}
.cm-stack-tight {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.cm-cell-hint {
  font-size: 0.78rem;
  color: var(--cm-text-muted, #777);
}
.cm-matrix .v-checkbox {
  justify-content: center;
}
</style>
