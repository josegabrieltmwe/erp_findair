<template>
  <div>
    <CmSectionHeader
      :title="t('module_permissions.title')"
      :subtitle="t('module_permissions.subtitle')"
    >
      <template #actions>
        <v-btn
          color="primary"
          :prepend-icon="mdiAccountSearch"
          @click="openSearchDialog"
        >
          {{ t('module_permissions.find_user') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <!-- Franja de estadísticas -->
    <v-row v-if="stats" dense class="mb-3">
      <v-col cols="12" sm="4">
        <v-card variant="outlined" class="pa-3">
          <div class="text-caption text-medium-emphasis">{{ t('module_permissions.stat_users') }}</div>
          <div class="text-h5">{{ stats.user_count }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card variant="outlined" class="pa-3">
          <div class="text-caption text-medium-emphasis">{{ t('module_permissions.stat_perms') }}</div>
          <div class="text-h5">{{ stats.perm_count }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card variant="outlined" class="pa-3">
          <div class="text-caption text-medium-emphasis">{{ t('module_permissions.stat_modules') }}</div>
          <div class="text-h5">{{ stats.module_count }}</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Filtros -->
    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="cm-filters">
        <v-text-field
          v-model="searchText"
          :label="t('module_permissions.filter_search')"
          :prepend-inner-icon="mdiMagnify"
          density="compact"
          hide-details
          clearable
          @update:model-value="debouncedReload"
        />
        <v-select
          v-model="filterModule"
          :label="t('module_permissions.filter_module')"
          :items="moduleOptions"
          density="compact"
          hide-details
          clearable
          @update:model-value="reload"
        />
      </div>
    </v-card>

    <!-- Usuarios con permisos -->
    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && users.length === 0"
      :data="users"
      loading-type="skeleton"
      :skeleton-rows="6"
      :skeleton-cols="5"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState
          :icon="mdiShieldAccount"
          :title="t('module_permissions.empty_title')"
          :description="t('module_permissions.empty_hint')"
        />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact">
            <thead>
              <tr>
                <th>{{ t('module_permissions.col_user') }}</th>
                <th>{{ t('module_permissions.col_company') }}</th>
                <th>{{ t('module_permissions.col_perm_count') }}</th>
                <th>{{ t('module_permissions.col_module_count') }}</th>
                <th class="text-right">{{ t('module_permissions.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>
                  <div class="cm-stack-tight">
                    <span>{{ u.nome || u.loginn || '—' }}</span>
                    <span class="cm-cell-hint">{{ u.mail || u.loginn }}</span>
                  </div>
                </td>
                <td>{{ u.rag_soc || u.nome_breve || '—' }}</td>
                <td>
                  <v-chip size="small" class="cm-tone-info">{{ u.perm_count }}</v-chip>
                </td>
                <td>{{ u.module_count }}</td>
                <td class="cm-actions-right">
                  <v-btn
                    size="small"
                    variant="text"
                    :prepend-icon="mdiPencil"
                    @click="openEdit(u)"
                  >
                    {{ t('module_permissions.edit') }}
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Paginación -->
          <div v-if="pages > 1" class="d-flex justify-center pa-3">
            <v-pagination
              v-model="page"
              :length="pages"
              :total-visible="7"
              density="comfortable"
              @update:model-value="reload"
            />
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <!-- Diálogo de búsqueda -->
    <v-dialog v-model="searchDialog" max-width="640">
      <v-card>
        <v-card-title>{{ t('module_permissions.search_title') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="userSearch"
            :label="t('module_permissions.search_placeholder')"
            :prepend-inner-icon="mdiMagnify"
            density="comfortable"
            autofocus
            @update:model-value="debouncedUserSearch"
          />
          <v-progress-linear v-if="userSearchLoading" indeterminate class="mb-3" />
          <v-list v-if="userSearchResults.length > 0" density="compact" class="cm-search-results">
            <v-list-item
              v-for="u in userSearchResults"
              :key="u.id"
              :title="u.nome || u.loginn || ('#' + u.id)"
              :subtitle="(u.mail || '') + ' · ' + (u.rag_soc || '')"
              @click="selectSearchUser(u)"
            />
          </v-list>
          <CmEmptyState
            v-else-if="!userSearchLoading && userSearch.length >= 2"
            :icon="mdiAccountOff"
            :title="t('module_permissions.search_empty')"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="searchDialog = false">
            {{ t('common.close') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo de edición (matriz por usuario) -->
    <ModulePermissionsUserDialog
      v-if="editDialog && editTarget"
      v-model="editDialog"
      :user="editTarget"
      :available="available"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Permisos por módulo — Fase A2 del plan de deprecación de `admin_config`
 * (docs/plan-deprecacion-admin-config.md). Portado desde
 * `admin_config/src/features/module_permissions/ModulePermissionsPage.vue`.
 * Comparte el catálogo de módulos con internal_roles — migran juntos.
 */
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiAccountSearch,
  mdiAccountOff,
  mdiMagnify,
  mdiPencil,
  mdiShieldAccount,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import {
  modulePermissionsService,
  type UserSummary,
  type SearchUser,
  type AvailableModules,
} from '../services/modulePermissions.service';
import ModulePermissionsUserDialog from './ModulePermissionsUserDialog.vue';

const { t } = useI18n();
const toast = useToastStore();

const users = ref<UserSummary[]>([]);
const stats = ref<{ user_count: number; perm_count: number; module_count: number } | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const page = ref(1);
const perPage = ref(20);
const pages = ref(0);

const searchText = ref('');
const filterModule = ref<string | undefined>(undefined);
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

const available = ref<AvailableModules | null>(null);

const searchDialog = ref(false);
const userSearch = ref('');
const userSearchResults = ref<SearchUser[]>([]);
const userSearchLoading = ref(false);
let userSearchDebounce: ReturnType<typeof setTimeout> | null = null;

const editDialog = ref(false);
const editTarget = ref<UserSummary | SearchUser | null>(null);

const moduleOptions = computed(() => {
  if (!available.value?.modules) return [];
  return Object.entries(available.value.modules).map(([key, desc]) => ({
    title: `${key} — ${desc}`,
    value: key,
  }));
});

async function loadAvailable(): Promise<void> {
  try {
    available.value = await modulePermissionsService.getAvailable();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function reload(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await modulePermissionsService.getUsersSummary({
      page: page.value,
      per_page: perPage.value,
      search: searchText.value || undefined,
      module: filterModule.value,
    });
    users.value = res.users;
    pages.value = res.pages;
    stats.value = res.stats;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function debouncedReload(): void {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    page.value = 1;
    reload();
  }, 350);
}

function openSearchDialog(): void {
  searchDialog.value = true;
  userSearch.value = '';
  userSearchResults.value = [];
}

function debouncedUserSearch(): void {
  if (userSearchDebounce) clearTimeout(userSearchDebounce);
  userSearchDebounce = setTimeout(async () => {
    if (userSearch.value.trim().length < 2) {
      userSearchResults.value = [];
      return;
    }
    userSearchLoading.value = true;
    try {
      userSearchResults.value = await modulePermissionsService.searchUsers(userSearch.value);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      userSearchLoading.value = false;
    }
  }, 300);
}

function selectSearchUser(u: SearchUser): void {
  searchDialog.value = false;
  editTarget.value = u;
  editDialog.value = true;
}

function openEdit(u: UserSummary): void {
  editTarget.value = u;
  editDialog.value = true;
}

async function onSaved(): Promise<void> {
  toast.success(t('module_permissions.saved'));
  await reload();
}

onMounted(async () => {
  await loadAvailable();
  await reload();
});
</script>

<style scoped>
.cm-filters {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--cm-space-md, 12px);
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
.cm-actions-right {
  text-align: right;
}
.cm-search-results {
  max-height: 360px;
  overflow-y: auto;
}
</style>
