<template>
  <div>
    <CmSectionHeader
      :title="t('internal_roles.title')"
      :subtitle="t('internal_roles.subtitle')"
    >
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('internal_roles.new_role') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && roles.length === 0"
      :data="roles"
      loading-type="skeleton"
      :skeleton-rows="6"
      :skeleton-cols="5"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiBadgeAccount" :title="t('internal_roles.empty_title')" />
      </template>

      <template #default>
        <v-card class="mb-4" variant="outlined">
          <v-card-title>
            <span>{{ t('internal_roles.system_roles') }}</span>
            <v-chip size="x-small" class="cm-tone-neutral ml-2">{{ systemRoles.length }}</v-chip>
          </v-card-title>
          <v-table>
            <thead>
              <tr>
                <th>{{ t('internal_roles.col_slug') }}</th>
                <th>{{ t('internal_roles.col_name') }}</th>
                <th>{{ t('internal_roles.col_perms') }}</th>
                <th>{{ t('internal_roles.col_users') }}</th>
                <th class="cm-actions-right">{{ t('internal_roles.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="role in systemRoles" :key="role.id">
                <td class="cm-mono">{{ role.slug }}</td>
                <td>{{ role.name }}</td>
                <td>{{ permSummary(role) }}</td>
                <td>{{ role.user_count ?? '—' }}</td>
                <td class="cm-actions-right">
                  <v-btn size="small" variant="text" :prepend-icon="mdiContentCopy" @click="openClone(role)">
                    {{ t('internal_roles.clone') }}
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>

        <v-card variant="outlined">
          <v-card-title>
            <span>{{ t('internal_roles.custom_roles') }}</span>
            <v-chip size="x-small" class="cm-tone-neutral ml-2">{{ customRoles.length }}</v-chip>
          </v-card-title>
          <v-table>
            <thead>
              <tr>
                <th>{{ t('internal_roles.col_slug') }}</th>
                <th>{{ t('internal_roles.col_name') }}</th>
                <th>{{ t('internal_roles.col_perms') }}</th>
                <th>{{ t('internal_roles.col_users') }}</th>
                <th class="cm-actions-right">{{ t('internal_roles.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="role in customRoles" :key="role.id">
                <td class="cm-mono">{{ role.slug }}</td>
                <td>{{ role.name }}</td>
                <td>{{ permSummary(role) }}</td>
                <td>{{ role.user_count ?? '—' }}</td>
                <td class="cm-actions-right">
                  <v-btn size="small" variant="text" :prepend-icon="mdiPencil" @click="openEdit(role)">
                    {{ t('common.edit') }}
                  </v-btn>
                  <v-btn size="small" variant="text" :prepend-icon="mdiContentCopy" @click="openClone(role)">
                    {{ t('internal_roles.clone') }}
                  </v-btn>
                  <v-btn size="small" variant="text" color="error" :prepend-icon="mdiDelete" @click="openDelete(role)">
                    {{ t('common.delete') }}
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="formDialog" max-width="900" persistent>
      <v-card>
        <v-card-title>
          {{ formMode === 'create' ? t('internal_roles.dialog_create') : t('internal_roles.dialog_edit', { name: form.name }) }}
        </v-card-title>
        <v-card-text>
          <div class="cm-grid mb-4">
            <v-text-field
              v-model="form.slug"
              :label="t('internal_roles.form_slug')"
              :disabled="formMode === 'edit' && currentIsSystem"
              :rules="[slugRule]"
              hide-details="auto"
            />
            <v-text-field
              v-model="form.name"
              :label="t('internal_roles.form_name')"
              hide-details="auto"
            />
          </div>
          <v-textarea
            v-model="form.description"
            :label="t('internal_roles.form_description')"
            rows="2"
            hide-details
            class="mb-4"
          />

          <div class="cm-form-label mb-2">
            {{ t('internal_roles.permission_matrix') }}
            <v-chip size="x-small" class="cm-tone-neutral ml-2">{{ permCount }}</v-chip>
          </div>
          <v-table class="cm-matrix">
            <thead>
              <tr>
                <th>{{ t('internal_roles.col_module') }}</th>
                <th v-for="op in operations" :key="op" class="text-center">{{ op }}</th>
                <th class="text-center">{{ t('internal_roles.col_all') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(label, mod) in availableModules" :key="mod">
                <td>
                  <div class="cm-mono">{{ mod }}</div>
                  <div class="cm-cell-hint">{{ label }}</div>
                </td>
                <td v-for="op in operations" :key="op" class="text-center">
                  <v-checkbox
                    :model-value="matrix[mod]?.[op] ?? false"
                    hide-details
                    density="compact"
                    @update:model-value="(v) => setCell(mod, op, !!v)"
                  />
                </td>
                <td class="text-center">
                  <v-checkbox
                    :model-value="isModuleAllOn(mod)"
                    :indeterminate="isModuleSomeOn(mod)"
                    hide-details
                    density="compact"
                    @update:model-value="(v) => toggleModuleAll(mod, !!v)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="formDialog = false">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!formValid" @click="saveRole">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="cloneDialog" max-width="560">
      <v-card v-if="cloneTarget">
        <v-card-title>{{ t('internal_roles.dialog_clone', { name: cloneTarget.name }) }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="cloneForm.slug"
            :label="t('internal_roles.form_slug')"
            :rules="[slugRule]"
          />
          <v-text-field
            v-model="cloneForm.name"
            :label="t('internal_roles.form_name')"
          />
          <v-textarea
            v-model="cloneForm.description"
            :label="t('internal_roles.form_description')"
            rows="2"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving" @click="cloneDialog = false">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!cloneFormValid" @click="confirmClone">
            {{ t('internal_roles.clone') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Roles internos RBAC — Fase A2 del plan de deprecación de `admin_config`
 * (docs/plan-deprecacion-admin-config.md). Portado 1:1 desde
 * `admin_config/src/features/internal_roles/InternalRolesPage.vue`.
 * Comparte el catálogo de módulos (?view=available) con module_permissions
 * — ambos migran juntos por eso.
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus,
  mdiPencil,
  mdiDelete,
  mdiContentCopy,
  mdiBadgeAccount,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  internalRolesService,
  type InternalRole,
  type InternalRolePermission,
} from '../services/internalRoles.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const operations = ['read', 'write', 'delete', 'admin'] as const;
type Operation = (typeof operations)[number];

const roles = ref<InternalRole[]>([]);
const availableModules = ref<Record<string, string>>({});
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const formDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const currentIsSystem = ref(false);
const form = reactive({
  id: 0,
  slug: '',
  name: '',
  description: '',
});
const matrix = reactive<Record<string, Record<Operation, boolean>>>({});

const cloneDialog = ref(false);
const cloneTarget = ref<InternalRole | null>(null);
const cloneForm = reactive({
  slug: '',
  name: '',
  description: '',
});

const systemRoles = computed(() => roles.value.filter((r) => r.is_system === 1));
const customRoles = computed(() => roles.value.filter((r) => r.is_system !== 1));

const slugRule = (v: string): boolean | string =>
  /^[a-z0-9_]+$/.test(v) || t('internal_roles.slug_invalid');

const formValid = computed(
  () =>
    !!form.slug &&
    /^[a-z0-9_]+$/.test(form.slug) &&
    !!form.name.trim(),
);

const cloneFormValid = computed(
  () =>
    !!cloneForm.slug &&
    /^[a-z0-9_]+$/.test(cloneForm.slug) &&
    !!cloneForm.name.trim(),
);

const permCount = computed(() => {
  let n = 0;
  for (const mod of Object.keys(matrix)) {
    for (const op of operations) {
      if (matrix[mod]?.[op]) n++;
    }
  }
  return n;
});

function emptyMatrix(): Record<string, Record<Operation, boolean>> {
  const m: Record<string, Record<Operation, boolean>> = {};
  for (const mod of Object.keys(availableModules.value)) {
    m[mod] = { read: false, write: false, delete: false, admin: false };
  }
  return m;
}

function setMatrixFromPermissions(perms: InternalRolePermission[] | undefined): void {
  for (const k of Object.keys(matrix)) delete matrix[k];
  const seed = emptyMatrix();
  for (const mod of Object.keys(seed)) matrix[mod] = seed[mod]!;
  if (!perms) return;
  for (const p of perms) {
    if (!matrix[p.module]) {
      matrix[p.module] = { read: false, write: false, delete: false, admin: false };
    }
    if ((operations as readonly string[]).includes(p.operation)) {
      matrix[p.module]![p.operation as Operation] = true;
    }
  }
}

function matrixToArray(): InternalRolePermission[] {
  const out: InternalRolePermission[] = [];
  for (const mod of Object.keys(matrix)) {
    for (const op of operations) {
      if (matrix[mod]?.[op]) out.push({ module: mod, operation: op });
    }
  }
  return out;
}

function setCell(mod: string, op: Operation, value: boolean): void {
  if (!matrix[mod]) {
    matrix[mod] = { read: false, write: false, delete: false, admin: false };
  }
  matrix[mod]![op] = value;
}

function isModuleAllOn(mod: string): boolean {
  const row = matrix[mod];
  if (!row) return false;
  return operations.every((op) => row[op]);
}

function isModuleSomeOn(mod: string): boolean {
  const row = matrix[mod];
  if (!row) return false;
  const someOn = operations.some((op) => row[op]);
  const allOn = operations.every((op) => row[op]);
  return someOn && !allOn;
}

function toggleModuleAll(mod: string, value: boolean): void {
  if (!matrix[mod]) {
    matrix[mod] = { read: false, write: false, delete: false, admin: false };
  }
  for (const op of operations) matrix[mod]![op] = value;
}

function permSummary(role: InternalRole): string {
  const perms = role.permissions ?? [];
  if (perms.length === 0) return t('internal_roles.no_perms');
  const modules = new Set(perms.map((p) => p.module));
  return t('internal_roles.perm_summary', { perms: perms.length, modules: modules.size });
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [rolesData, modulesData] = await Promise.all([
      internalRolesService.list(),
      internalRolesService.availableModules(),
    ]);
    roles.value = rolesData;
    availableModules.value = modulesData;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  formMode.value = 'create';
  currentIsSystem.value = false;
  form.id = 0;
  form.slug = '';
  form.name = '';
  form.description = '';
  setMatrixFromPermissions([]);
  formDialog.value = true;
}

function openEdit(role: InternalRole): void {
  formMode.value = 'edit';
  currentIsSystem.value = role.is_system === 1;
  form.id = role.id;
  form.slug = role.slug;
  form.name = role.name;
  form.description = role.description || '';
  setMatrixFromPermissions(role.permissions);
  formDialog.value = true;
}

async function saveRole(): Promise<void> {
  saving.value = true;
  try {
    const payload = {
      slug: form.slug,
      name: form.name,
      description: form.description,
      permissions: matrixToArray(),
    };
    if (formMode.value === 'create') {
      await internalRolesService.create(payload);
      toast.success(t('internal_roles.created'));
    } else {
      await internalRolesService.update({ id: form.id, ...payload });
      toast.success(t('internal_roles.updated'));
    }
    formDialog.value = false;
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

function openClone(role: InternalRole): void {
  cloneTarget.value = role;
  cloneForm.slug = role.slug + '_copy';
  cloneForm.name = role.name + ' (copy)';
  cloneForm.description = role.description || '';
  cloneDialog.value = true;
}

async function confirmClone(): Promise<void> {
  if (!cloneTarget.value) return;
  saving.value = true;
  try {
    await internalRolesService.clone({
      source_id: cloneTarget.value.id,
      slug: cloneForm.slug,
      name: cloneForm.name,
      description: cloneForm.description,
    });
    toast.success(t('internal_roles.cloned'));
    cloneDialog.value = false;
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function openDelete(role: InternalRole): Promise<void> {
  const userMsg = role.user_count
    ? t('internal_roles.confirm_delete_with_users', { name: role.name, n: role.user_count })
    : t('internal_roles.confirm_delete_message', { name: role.name });
  const ok = await confirm.askDanger(userMsg, t('internal_roles.confirm_delete_title'));
  if (!ok) return;
  try {
    await internalRolesService.remove(role.id);
    toast.success(t('internal_roles.deleted'));
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  void load();
});
</script>

<style scoped>
.cm-matrix {
  max-height: 460px;
  overflow: auto;
  border: 1px solid var(--cm-border-color);
  border-radius: var(--cm-radius-md);
}
.cm-form-label {
  font-size: var(--cm-fs-sm);
  font-weight: var(--cm-fw-semibold);
  color: var(--cm-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
