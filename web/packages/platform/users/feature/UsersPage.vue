<template>
  <div>
    <CmSectionHeader :title="t('users.title')" :subtitle="t('users.subtitle')">
      <template #actions>
        <v-btn color="primary" :prepend-icon="mdiAccountPlus" @click="openCreate">
          {{ t('users.new_user') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <CmAsyncSection :error="error" :loading="false" @clear-error="error = null">
      <div class="cm-filters">
        <v-text-field
          v-model="searchInput"
          :label="t('users.filter_search')"
          :placeholder="t('users.filter_search_hint')"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="cm-filter-search"
          @update:model-value="onSearchChange"
        />
        <CmAnagraficaAutocomplete
          v-model="filterAnagrafica"
          :label="t('users.filter_partner')"
          class="cm-filter-autocomplete"
          @select="onPartnerSelect"
        />
        <v-select
          v-model="filterStatus"
          :items="statusItems"
          :label="t('common.status')"
          density="compact"
          variant="outlined"
          hide-details
          class="cm-filter-status"
          @update:model-value="reload"
        />
        <v-btn color="primary" variant="text" :prepend-icon="mdiRefresh" :loading="loading" @click="reload">
          {{ t('common.refresh') }}
        </v-btn>
      </div>
    </CmAsyncSection>

    <!-- Filtros activos (click-to-filter) -->
    <ActiveFilterChips
      :filters="activeFilters"
      @remove="removeFilter"
      @clear="clearAllFilters"
    />

    <CmEmptyState
      v-if="!loading && rows.length === 0"
      :icon="mdiAccountSearch"
      :title="t('users.empty_title')"
    >
      <p>{{ t('users.empty_hint') }}</p>
    </CmEmptyState>
    <ListingDataView
      v-else
      :source="listSource"
      :headers="tableHeaders"
      :selected="selected"
      :sort-key-map="sortKeyMap"
      mode="paginated"
      @update:selected="selected = $event"
    >
      <template #bulk-actions="{ selectedIds, clear }">
        <v-btn size="small" variant="text" class="mr-2" @click="clear">
          {{ t('users.bulk.clear') }}
        </v-btn>
        <v-btn
          size="small"
          variant="tonal"
          color="primary"
          :prepend-icon="mdiAccountPlus"
          @click="openBulk('grant', selectedIds)"
        >
          {{ t('users.bulk.grant_role') }}
        </v-btn>
        <v-btn
          size="small"
          variant="tonal"
          color="error"
          :prepend-icon="mdiAccountRemove"
          @click="openBulk('revoke', selectedIds)"
        >
          {{ t('users.bulk.revoke_role') }}
        </v-btn>
      </template>

      <template #cell.nome="{ item }">
        <a href="javascript:void(0)" class="cm-name-link" @click="goToDetail(item as UserLite)">
          {{ (item as UserLite).nome || (item as UserLite).loginn }}
        </a>
      </template>
      <template #cell.loginn="{ item }">
        {{ (item as UserLite).loginn }}
      </template>
      <template #cell.mail="{ item }">
        {{ (item as UserLite).mail }}
      </template>
      <template #cell.partner="{ item }">
        <button
          v-if="(item as UserLite).id_anagrafica"
          type="button"
          class="filterable cm-partner-cell"
          :title="t('users.filter_click.by_partner')"
          @click.stop="setFilterFromCell('partner', (item as UserLite).id_anagrafica)"
        >
          <span class="cm-partner-id">#{{ (item as UserLite).id_anagrafica }}</span>
          <span class="cm-partner-name">{{ (item as UserLite).rag_soc || '—' }}</span>
        </button>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.auth_10="{ item }">
        <button
          type="button"
          class="filterable"
          :title="t('users.filter_click.by_kind')"
          @click.stop="setFilterFromCell('auth_10', (item as UserLite).auth_10 === 'S' ? 'S' : 'N')"
        >
          <v-chip
            size="small"
            :color="(item as UserLite).auth_10 === 'S' ? 'primary' : 'deep-purple'"
            variant="tonal"
            style="cursor: pointer"
          >
            {{ (item as UserLite).auth_10 === 'S' ? t('users.kind_web') : t('users.kind_api') }}
          </v-chip>
        </button>
      </template>
      <template #cell.role_names="{ item }">
        <span v-if="(item as UserLite).role_names" class="cm-role-list">{{ (item as UserLite).role_names }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.actions="{ item }">
        <CmRowActions :actions="rowActions(item as UserLite)" />
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <UserCreateDialog v-model="createDialog" @created="onUserCreated" />
    <UserEditDialog v-model="editDialog" :user="editingUser" @saved="onUserSaved" />
    <ResetPasswordDialog v-model="resetDialog" :user="resetUser" />
    <UserBulkRolesDialog
      v-model="bulkDialog"
      :user-ids="selectedUserIds"
      :action="bulkAction"
      @done="onBulkDone"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Usuarios — Fase A2 del plan de deprecación de `admin_config`
 * (docs/plan-deprecacion-admin-config.md). Portado desde
 * `admin_config/src/features/users/UsersPage.vue`. Detalle de usuario
 * (`UserDetailPage.vue`) migrado por separado como ruta `user-detail`.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  mdiAccountPlus,
  mdiAccountRemove,
  mdiAccountSearch,
  mdiAccountDetails,
  mdiPencil,
  mdiDelete,
  mdiKeyVariant,
  mdiRefresh,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import UserCreateDialog from './UserCreateDialog.vue';
import UserEditDialog from './UserEditDialog.vue';
import ResetPasswordDialog from './ResetPasswordDialog.vue';
import UserBulkRolesDialog from './UserBulkRolesDialog.vue';
import ActiveFilterChips from '../../listing/ActiveFilterChips.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import type { ActiveFilter, DataTableHeader, ListSource } from '../../listing/types';
import { usersService, type UserLite } from '../services/users.service';
import type { AnagraficaLite } from '../../anagrafiche/services/anagrafica.service';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { useDebouncedCallback } from '../../anagrafiche/composables/useDebouncedRef';

const { t } = useI18n();
const router = useRouter();
const toast = useToastStore();
const confirm = useConfirm();

// ---------------------------------------------------------------------------
// Listado + filtros
// ---------------------------------------------------------------------------
const rows = ref<UserLite[]>([]);
const total = ref(0);
const page = ref(1);
const perPage = ref(20);
const loading = ref(false);
const error = ref<string | null>(null);

const searchInput = ref('');
const filterAnagrafica = ref<number | null>(null);
const filterStatus = ref<'active' | 'all'>('active');
const filterAuth10 = ref<'S' | 'N' | null>(null);
// Nombre de partner cacheado al clicar, para etiquetar el chip.
const partnerName = ref<Record<number, string>>({});

const statusItems = computed(() => [
  { title: t('users.status_active'), value: 'active' },
  { title: t('users.status_all'), value: 'all' },
]);

const tableHeaders = computed<DataTableHeader[]>(() => [
  { title: t('users.col_name') as string, key: 'nome', sortable: false },
  { title: t('users.col_login') as string, key: 'loginn', sortable: false, width: 140 },
  { title: t('users.col_email') as string, key: 'mail', sortable: false },
  { title: t('users.col_partner') as string, key: 'partner', sortable: false, width: 220 },
  { title: t('users.col_kind') as string, key: 'auth_10', sortable: false, width: 110, align: 'center' },
  { title: t('users.col_roles') as string, key: 'role_names', sortable: false },
  { title: t('common.actions') as string, key: 'actions', sortable: false, width: 160, align: 'end' },
]);
const sortKeyMap: Record<string, string> = {};

const selected = ref<{ id: number }[]>([]);
const selectedUserIds = computed<number[]>(() => selected.value.map((r) => r.id));

/**
 * Adaptador ListSource sobre el estado paginado existente — server-side
 * real (page/perPage/search del backend).
 */
const listSource: ListSource<UserLite> = reactive({
  get total() { return total.value; },
  get rows() { return rows.value; },
  get loading() { return loading.value; },
  get error() { return error.value; },
  get page() { return page.value; },
  get perPage() { return perPage.value; },
  sort: 'id',
  sortDir: 'DESC',
  async loadPage(p: number) { page.value = p; await reload(); },
  async loadMore() { /* solo modo paginado */ },
  async refresh() { page.value = 1; await reload(); },
  setSort() { /* sin UI de orden hoy */ },
  async setPerPage(n: number) { perPage.value = n; page.value = 1; await reload(); },
}) as ListSource<UserLite>;

async function reload(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await usersService.list({
      page: page.value,
      perPage: perPage.value,
      status: filterStatus.value,
      search: searchInput.value || undefined,
      anagraficaId: filterAnagrafica.value ?? undefined,
      auth10: filterAuth10.value ?? undefined,
    });
    rows.value = result.items;
    total.value = result.total;
    page.value = result.page;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load users';
  } finally {
    loading.value = false;
  }
}

const debouncedReload = useDebouncedCallback(() => {
  page.value = 1;
  reload();
}, 350);

function onSearchChange(): void {
  debouncedReload();
}

// ── Click-to-filter ─────────────────────────────────────────────────────────
// Clicar el partner o el tipo de usuario en una fila filtra el listado por ese
// valor (server-side vía api_admin_users). Ver/editar es exclusivo de los
// botones de la columna de acciones (el nombre es un enlace explícito a detalle).
function setFilterFromCell(field: 'partner' | 'auth_10', value: number | string): void {
  if (field === 'partner') {
    const id = Number(value);
    if (!id) return;
    const row = rows.value.find((r) => r.id_anagrafica === id);
    if (row?.rag_soc) partnerName.value[id] = row.rag_soc;
    filterAnagrafica.value = id;
  } else {
    filterAuth10.value = value === 'S' ? 'S' : 'N';
  }
  page.value = 1;
  reload();
}

const activeFilters = computed<ActiveFilter[]>(() => {
  const out: ActiveFilter[] = [];
  if (filterAnagrafica.value) {
    out.push({
      field: 'partner',
      group: t('users.col_partner') as string,
      value: partnerName.value[filterAnagrafica.value] ?? `#${filterAnagrafica.value}`,
    });
  }
  if (filterAuth10.value) {
    out.push({
      field: 'auth_10',
      group: t('users.col_kind') as string,
      value: filterAuth10.value === 'S' ? (t('users.kind_web') as string) : (t('users.kind_api') as string),
    });
  }
  return out;
});

function removeFilter(field: string): void {
  if (field === 'partner') filterAnagrafica.value = null;
  else if (field === 'auth_10') filterAuth10.value = null;
  page.value = 1;
  reload();
}

function clearAllFilters(): void {
  filterAnagrafica.value = null;
  filterAuth10.value = null;
  page.value = 1;
  reload();
}

function onPartnerSelect(_p: AnagraficaLite | null): void {
  page.value = 1;
  reload();
}

watch(filterStatus, () => {
  page.value = 1;
});

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------
const createDialog = ref(false);
const editDialog = ref(false);
const editingUser = ref<UserLite | null>(null);
const resetDialog = ref(false);
const resetUser = ref<UserLite | null>(null);

// Selección/acciones bulk — la selección misma vive en `selected`
// (v-model:selected de ListingDataView); aquí solo el estado del diálogo.
const bulkDialog = ref(false);
const bulkAction = ref<'grant' | 'revoke'>('grant');

function openBulk(action: 'grant' | 'revoke', ids: number[]): void {
  if (ids.length === 0) return;
  bulkAction.value = action;
  bulkDialog.value = true;
}

function onBulkDone(): void {
  selected.value = [];
  reload();
}

function goToDetail(user: UserLite): void {
  router.push({ name: 'user-detail', params: { id: String(user.id) } });
}

/** Acciones de fila: editar (visible) + resto en kebab. */
function rowActions(user: UserLite): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(user) },
    { key: 'detail', title: t('users.detail.open'), icon: mdiAccountDetails, onClick: () => goToDetail(user) },
    { key: 'reset_pw', title: t('users.reset_password'), icon: mdiKeyVariant, onClick: () => openResetPassword(user) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', divider: true, onClick: () => confirmDelete(user) },
  ];
}

function openCreate(): void {
  createDialog.value = true;
}

function openEdit(user: UserLite): void {
  editingUser.value = user;
  editDialog.value = true;
}

function openResetPassword(user: UserLite): void {
  resetUser.value = user;
  resetDialog.value = true;
}

function onUserCreated(): void {
  toast.success(t('users.created'));
  reload();
}

function onUserSaved(): void {
  toast.success(t('users.updated'));
  reload();
}

async function confirmDelete(user: UserLite): Promise<void> {
  const ok = await confirm.ask({
    title: t('users.delete_title') as string,
    message: t('users.delete_message', {
      name: user.nome || user.loginn,
    }) as string,
    variant: 'danger',
    confirmLabel: t('common.delete') as string,
  });
  if (!ok) return;
  try {
    await usersService.remove(user.id);
    toast.success(t('users.deleted'));
    reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Delete failed');
  }
}

onMounted(reload);
</script>

<style scoped>
.cm-filters {
  display: flex;
  align-items: center;
  gap: var(--cm-space-md);
  margin-bottom: var(--cm-space-md);
  flex-wrap: wrap;
}
.cm-filter-search {
  min-width: 240px;
  max-width: 320px;
  flex: 1 1 auto;
}
.cm-filter-autocomplete {
  min-width: 280px;
  max-width: 360px;
  flex: 1 1 auto;
}
.cm-filter-status {
  max-width: 180px;
}

/* Valor clicable-para-filtrar: texto normal hasta hover/focus. Patrón cargo. */
.filterable {
  display: inline-block;
  max-width: 100%;
  padding: 0 2px;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.12s, background 0.12s, box-shadow 0.12s;
}
.filterable:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.08);
}
.filterable:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}
.cm-partner-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  line-height: 1.2;
}
.cm-partner-id {
  font-family: var(--cm-font-mono, monospace);
  font-size: 0.75em;
  color: var(--cm-text-muted);
}
.cm-partner-name {
  font-weight: 500;
}

.cm-role-list {
  font-size: 0.85em;
}
.cm-text-muted {
  color: var(--cm-text-muted);
}

.cm-name-link {
  color: var(--v-theme-primary, #1976d2);
  text-decoration: none;
  font-weight: 500;
}
.cm-name-link:hover {
  text-decoration: underline;
}
</style>
