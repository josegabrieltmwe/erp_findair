<template>
  <div>
    <CmSectionHeader :title="t('anagrafiche.tabs.contatti')">
      <template #actions>
        <ViewModeToggle v-model="viewMode" />
        <v-btn color="primary" :prepend-icon="mdiPlus" size="small" @click="openCreate">
          {{ t('common.add') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <!-- Filtros del listado de contactos. Client-side sobre los contactos ya
         cargados en el prop (no hay red): búsqueda libre + tipo + acceso findair.
         Reutiliza contattiService.filterClientSide y contactOptionsService. -->
    <div class="cm-filters">
      <v-text-field
        v-model="searchInput"
        :label="t('anagrafiche.contatti_filters.search')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="cm-filter-search"
        @update:model-value="onSearchChange"
      />
      <v-select
        v-model="filterSede"
        :items="sedeItems"
        item-title="label"
        item-value="value"
        :label="t('anagrafiche.contatti_filters.sede')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="cm-filter-narrow"
      />
      <v-select
        v-model="filterTipo"
        :items="tipoItems"
        item-title="label"
        item-value="id"
        :label="t('anagrafiche.contatti_filters.tipo')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="cm-filter-narrow"
      />
      <v-select
        v-model="filterFindair"
        :items="findairFilterItems"
        :label="t('anagrafiche.findair.col')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="cm-filter-narrow"
      />
      <span class="cm-filter-count">{{ t('anagrafiche.contatti_filters.count', { n: filteredContatti.length, total: contatti.length }) }}</span>
    </div>

    <ActiveFilterChips
      :filters="activeFilters"
      @remove="removeFilter"
      @clear="clearAllFilters"
    />

    <div class="cm-sublist-viewport">
    <ListingDataView
      :source="listSource"
      :headers="headers"
      :selected="[]"
      :mode="viewMode"
      :sort-key-map="sortKeyMap"
      :selectable="false"
      @update:mode="viewMode = $event"
    >
      <template #cell.id="{ item }">{{ (item as ContattoRow).id }}</template>
      <template #cell.nome="{ item }">
        <span class="font-weight-medium">{{ (item as ContattoRow).nome || '—' }}</span>
      </template>
      <template #cell.mail="{ item }">
        <span v-if="(item as ContattoRow).mail">{{ (item as ContattoRow).mail }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.loginn="{ item }">
        <span v-if="(item as Record<string, unknown>).loginn">{{ (item as Record<string, unknown>).loginn }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <template #cell.ruolo="{ item }">
        <span v-if="(item as Record<string, unknown>).ruolo">{{ (item as Record<string, unknown>).ruolo }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>
      <!-- Rol API por contacto (contatti_oauth_role). El switch activa el
           acceso con el rol del grupo del contacto (TMWE → tmwe_staff_portal,
           partner → partner_staff, cliente → findair_basic) o lo revoca; el menú
           ofrece los atajos findair (basic = sin etiqueta courier real;
           full = con etiqueta courier) y, para TMWE, la lista completa de
           roles OAuth (sin los solo-internos salvo contactos de TMWE). -->
      <template #cell.findair="{ item }">
        <div class="cm-findair-cell">
          <v-switch
            :model-value="findairEnabled(item as ContattoRow)"
            :loading="findairBusy[(item as ContattoRow).id]"
            :disabled="findairBusy[(item as ContattoRow).id] || findairLoading"
            color="primary"
            density="compact"
            hide-details
            @update:model-value="(v) => toggleFindair(item as ContattoRow, !!v)"
          />
          <v-menu v-if="findairEnabled(item as ContattoRow)" @update:model-value="(open) => open && ensureApiRoles()">
            <template #activator="{ props: menuProps }">
              <v-chip
                size="x-small"
                variant="tonal"
                :color="apiRoleChipColor(item as ContattoRow)"
                class="cm-findair-chip"
                v-bind="menuProps"
              >
                <span class="cm-mono">{{ apiRoleLabel(item as ContattoRow) }}</span>
                <v-icon end :icon="mdiMenuDown" size="14" />
              </v-chip>
            </template>
            <v-list density="compact">
              <v-list-subheader>{{ t('anagrafiche.findair.shortcuts') }}</v-list-subheader>
              <v-list-item
                :active="findairLevel(item as ContattoRow) === 'basic'"
                @click="setFindairLevel(item as ContattoRow, 'basic')"
              >
                <v-list-item-title>{{ t('anagrafiche.findair.level_basic') }}</v-list-item-title>
                <v-list-item-subtitle>{{ t('anagrafiche.findair.level_basic_hint') }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item
                :active="findairLevel(item as ContattoRow) === 'full'"
                @click="setFindairLevel(item as ContattoRow, 'full')"
              >
                <v-list-item-title>{{ t('anagrafiche.findair.level_full') }}</v-list-item-title>
                <v-list-item-subtitle>{{ t('anagrafiche.findair.level_full_hint') }}</v-list-item-subtitle>
              </v-list-item>
              <template v-if="isTmwe">
                <v-divider />
                <v-list-subheader>{{ t('anagrafiche.findair.api_role') }}</v-list-subheader>
                <v-list-item v-if="apiRolesLoading" disabled>
                  <v-list-item-title>{{ t('common.loading') }}</v-list-item-title>
                </v-list-item>
                <v-list-item v-else-if="selectableApiRoles.length === 0" disabled>
                  <v-list-item-title>{{ t('anagrafiche.findair.no_roles') }}</v-list-item-title>
                </v-list-item>
                <v-list-item
                  v-for="r in selectableApiRoles"
                  :key="r.id"
                  :active="apiRoleId(item as ContattoRow) === r.id"
                  @click="setApiRole(item as ContattoRow, r)"
                >
                  <v-list-item-title>{{ r.display_name || r.role_name }}</v-list-item-title>
                  <v-list-item-subtitle class="cm-mono">{{ r.role_name }}</v-list-item-subtitle>
                </v-list-item>
              </template>
            </v-list>
          </v-menu>
        </div>
      </template>

      <template #cell.actions="{ item }">
        <CmRowActions :actions="rowActions(item as ContattoRow)" />
      </template>
    </ListingDataView>
    </div>

    <ContattoFormDialog v-model="dialogOpen" :id-anagrafica="idAnagrafica" :contatto="editing" @saved="onSaved" />
    <ContattoPermissionsDialog v-model="permsOpen" :contatto="editingPerms" @saved="onSaved" />

    <!-- Password reseteada, mostrada una sola vez. -->
    <v-dialog v-model="resetOpen" max-width="480" persistent>
      <v-card v-if="resetPw">
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2" :icon="mdiKeyVariant" />
          {{ t('anagrafiche.reset_password') }}
        </v-card-title>
        <v-card-text>
          <v-alert type="success" variant="tonal" density="compact" class="mb-3">
            {{ t('anagrafiche.reset_password_done') }}
          </v-alert>
          <CredentialsRevealCard :password="resetPw" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="resetOpen = false">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Token de APP regenerado, mostrado una sola vez. -->
    <v-dialog v-model="tokenOpen" max-width="480" persistent>
      <v-card v-if="appToken">
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2" :icon="mdiCellphoneKey" />
          {{ t('anagrafiche.app_token.title') }}
        </v-card-title>
        <v-card-text>
          <v-alert type="success" variant="tonal" density="compact" class="mb-3">
            {{ t('anagrafiche.app_token.done') }}
          </v-alert>
          <CredentialsRevealCard :password="appToken" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="tokenOpen = false">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiShieldKeyOutline, mdiKeyVariant, mdiEmailFastOutline, mdiCellphoneKey, mdiLoginVariant, mdiMenuDown } from '@mdi/js';
import type { ContattoRow } from '../services/anagrafica.service';
import { contattiService, type FindairLevel, type ApiRoleState, type ContattoLite } from '../services/contatti.service';
import { oauthRolesService, isInternalOnlyRole, roleConflictMessage, type OAuthRole } from '../../oauth_roles/services/oauthRoles.service';
import { contactOptionsService } from '../services/contactOptions.service';
import { useAnagraficaContext } from '../composables/useAnagraficaContext';
import { sediInterneService } from '../services/sediInterne.service';
import { useDebouncedCallback } from '../composables/useDebouncedRef';
import ActiveFilterChips from '@shared/listing/ActiveFilterChips.vue';
import ListingDataView from '@shared/listing/ListingDataView.vue';
import ViewModeToggle from '@shared/listing/ViewModeToggle.vue';
import { useClientSideListSource } from '@shared/listing/useClientSideListSource';
import { useListViewMode } from '@shared/listing/useListViewMode';
import type { ActiveFilter } from '@shared/listing/types';
import { useToast } from '../composables/useToast';
import { useConfirm } from '../composables/useConfirm';
import ContattoFormDialog from './ContattoFormDialog.vue';
import CmSectionHeader from '../components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../components/CmRowActions.vue';
import ContattoPermissionsDialog from './ContattoPermissionsDialog.vue';
import CredentialsRevealCard from '../components/CredentialsRevealCard.vue';

const props = defineProps<{ idAnagrafica: number; contatti: ContattoRow[] }>();
const emit = defineEmits<{ refresh: [] }>();
const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const { isTmwe } = useAnagraficaContext();

const dialogOpen = ref(false);
const editing = ref<ContattoRow | null>(null);
const permsOpen = ref(false);
const editingPerms = ref<ContattoRow | null>(null);
const resetOpen = ref(false);
const resetPw = ref<string | null>(null);
const tokenOpen = ref(false);
const appToken = ref<string | null>(null);

// ── Filtros del listado (client-side sobre props.contatti) ────────────────
const searchInput = ref('');
const searchQuery = ref('');
const filterSede = ref<number | null>(null);
const filterTipo = ref<number | null>(null);
const filterFindair = ref<'yes' | 'no' | null>(null);

// Opciones de tipo de contacto (reusa el mismo servicio que el form de alta).
const tipoItems = ref<{ id: number; label: string }[]>([]);
// Opciones de sede (sedi interne del partner). Mismo servicio que el form de alta.
const sedeItems = ref<{ label: string; value: number }[]>([]);
const sedeLabelById = computed<Record<number, string>>(() => {
  const m: Record<number, string> = {};
  for (const s of sedeItems.value) m[s.value] = s.label;
  return m;
});
onMounted(async () => {
  try { tipoItems.value = await contactOptionsService.contactTypes(); } catch { /* noop */ }
  try {
    const sedi = await sediInterneService.listByPartner(props.idAnagrafica);
    sedeItems.value = sedi.map((s) => ({ label: String(s.label ?? s.citta ?? s.id), value: Number(s.id) }));
  } catch { /* noop */ }
});
const tipoLabelById = computed<Record<number, string>>(() => {
  const m: Record<number, string> = {};
  for (const t_ of tipoItems.value) m[t_.id] = t_.label;
  return m;
});

const findairFilterItems = computed(() => [
  { title: t('anagrafiche.contatti_filters.findair_yes'), value: 'yes' },
  { title: t('anagrafiche.contatti_filters.findair_no'), value: 'no' },
]);

// Debounce del texto: el input actualiza searchInput al instante y searchQuery
// tras 300ms, que es el que gobierna el filtro (evita recomputar en cada tecla).
const applySearch = useDebouncedCallback(() => { searchQuery.value = searchInput.value || ''; }, 300);
function onSearchChange(): void { applySearch(); }

const filteredContatti = computed<ContattoRow[]>(() => {
  let list = props.contatti;
  // Búsqueda libre: reutiliza filterClientSide (nome/cognome/mail/loginn/id).
  if (searchQuery.value.trim()) {
    list = contattiService.filterClientSide(list as unknown as ContattoLite[], searchQuery.value) as unknown as ContattoRow[];
  }
  if (filterSede.value != null) {
    list = list.filter((c) => Number((c as Record<string, unknown>).id_sede_interna) === filterSede.value);
  }
  if (filterTipo.value != null) {
    list = list.filter((c) => Number((c as Record<string, unknown>).id_contatto_tipo) === filterTipo.value);
  }
  if (filterFindair.value) {
    const want = filterFindair.value === 'yes';
    list = list.filter((c) => findairEnabled(c) === want);
  }
  // ListingDataView exige id:number; el backend puede devolverlo como string.
  return list.map((c) => ({ ...c, id: Number(c.id) }));
});

// Toggle paginado/scroll infinito, persistido (mismo patrón que el listado
// principal). Default paginado para sub-listados dentro de la ficha.
const viewMode = useListViewMode('tmwe:anagrafica-contatti-view-mode', 'paginated');
// Adaptador client-side para usar el componente base ListingDataView con los
// contactos ya filtrados en memoria (sticky header/zebra/hover unificados).
const listSource = useClientSideListSource<ContattoRow>(() => filteredContatti.value, {
  mode: () => viewMode.value,
});
// Orden en memoria por columnas de texto/id (findair/actions no ordenables).
const sortKeyMap: Record<string, string> = {
  id: 'id', nome: 'nome', mail: 'mail', loginn: 'loginn', ruolo: 'ruolo',
};

const hasActiveFilters = computed(
  () => !!(searchQuery.value.trim() || filterSede.value != null || filterTipo.value != null || filterFindair.value),
);

const activeFilters = computed<ActiveFilter[]>(() => {
  const out: ActiveFilter[] = [];
  if (searchQuery.value.trim()) {
    out.push({ field: 'search', group: t('anagrafiche.contatti_filters.search') as string, value: searchQuery.value.trim() });
  }
  if (filterSede.value != null) {
    out.push({ field: 'sede', group: t('anagrafiche.contatti_filters.sede') as string, value: sedeLabelById.value[filterSede.value] ?? `#${filterSede.value}` });
  }
  if (filterTipo.value != null) {
    out.push({ field: 'tipo', group: t('anagrafiche.contatti_filters.tipo') as string, value: tipoLabelById.value[filterTipo.value] ?? `#${filterTipo.value}` });
  }
  if (filterFindair.value) {
    out.push({
      field: 'findair',
      group: t('anagrafiche.findair.col') as string,
      value: filterFindair.value === 'yes' ? (t('anagrafiche.contatti_filters.findair_yes') as string) : (t('anagrafiche.contatti_filters.findair_no') as string),
    });
  }
  return out;
});

function removeFilter(field: string): void {
  if (field === 'search') { searchInput.value = ''; searchQuery.value = ''; }
  else if (field === 'sede') filterSede.value = null;
  else if (field === 'tipo') filterTipo.value = null;
  else if (field === 'findair') filterFindair.value = null;
}
function clearAllFilters(): void {
  searchInput.value = '';
  searchQuery.value = '';
  filterSede.value = null;
  filterTipo.value = null;
  filterFindair.value = null;
}

// ── Rol API (acceso findair) por contacto ─────────────────────────────────
// El estado inicial (enabled/level) viene YA en cada ContattoRow desde el
// listado (backend, un solo query batch — sin N+1). Aquí solo mantenemos las
// mutaciones optimistas locales tras un cambio; si no hay override local, se
// lee del row. `findairLoading` queda por compatibilidad del template (siempre
// false: no hay carga diferida).
const findairOverride = reactive<Record<number, ApiRoleState>>({});
const findairBusy = reactive<Record<number, boolean>>({});
const findairLoading = ref(false);

/** Atajos findair: nivel → role_name del rol OAuth homónimo. */
const FINDAIR_ROLE_BY_LEVEL: Record<FindairLevel, string> = {
  basic: 'findair_basic',
  full: 'findair_full',
};

function findairEnabled(row: ContattoRow): boolean {
  if (row.id in findairOverride) return findairOverride[row.id].enabled;
  return row.findair_enabled === true;
}
function findairLevel(row: ContattoRow): FindairLevel | null {
  if (row.id in findairOverride) return findairOverride[row.id].level;
  const lvl = row.findair_level;
  return lvl === 'full' ? 'full' : lvl === 'basic' ? 'basic' : null;
}
/**
 * role_name actual del contacto. Tras una mutación local viene del override;
 * si no, del listado (`findair_role_name`, si el backend lo incluye) o, como
 * último recurso, del nivel findair (basic/full → findair_basic/findair_full).
 */
function apiRoleName(row: ContattoRow): string | null {
  if (row.id in findairOverride) return findairOverride[row.id].role_name;
  const fromRow = (row as Record<string, unknown>).findair_role_name;
  if (typeof fromRow === 'string' && fromRow) return fromRow;
  const lvl = findairLevel(row);
  return lvl ? FINDAIR_ROLE_BY_LEVEL[lvl] : null;
}
function apiRoleId(row: ContattoRow): number | null {
  if (row.id in findairOverride) return findairOverride[row.id].role_id;
  const fromRow = (row as Record<string, unknown>).findair_role_id;
  if (typeof fromRow === 'number' && fromRow > 0) return fromRow;
  const name = apiRoleName(row);
  return apiRoles.value.find((r) => r.role_name === name)?.id ?? null;
}
function apiRoleLabel(row: ContattoRow): string {
  return apiRoleName(row) ?? t('anagrafiche.findair.no_role');
}
function apiRoleChipColor(row: ContattoRow): string {
  const lvl = findairLevel(row);
  if (lvl === 'full') return 'deep-purple';
  if (lvl === 'basic') return 'primary';
  return 'teal';
}

// El listado batch solo trae enabled/level (findair_*). Para un contacto con
// rol activo que NO es findair (level null) el role_name no viene en la fila,
// así que se resuelve con una lectura puntual (solo esas filas, no N+1 general).
watch(
  () => props.contatti,
  (rows) => {
    for (const row of rows) {
      const id = Number(row.id);
      if (id in findairOverride || findairBusy[id]) continue;
      if (row.findair_enabled !== true || row.findair_level != null) continue;
      if (typeof (row as Record<string, unknown>).findair_role_name === 'string') continue;
      void contattiService.getApiRole(id)
        .then((state) => { if (!(id in findairOverride)) findairOverride[id] = state; })
        .catch(() => { /* la fila se queda con el fallback */ });
    }
  },
  { immediate: true },
);

// Lista de roles OAuth (api_admin_oauth_roles, admin-only): se carga una vez,
// al abrir el primer menú, y solo para TMWE (el partner ve los atajos findair).
const apiRoles = ref<OAuthRole[]>([]);
const apiRolesLoading = ref(false);
let apiRolesLoaded = false;
async function ensureApiRoles(): Promise<void> {
  if (apiRolesLoaded || apiRolesLoading.value || !isTmwe.value) return;
  apiRolesLoading.value = true;
  try {
    apiRoles.value = await oauthRolesService.list();
    apiRolesLoaded = true;
  } catch {
    apiRoles.value = [];
  } finally {
    apiRolesLoading.value = false;
  }
}
// Los roles solo-internos (scopes admin/config:*) solo se ofrecen a contactos
// de la anagrafica TMWE (id 1).
const selectableApiRoles = computed<OAuthRole[]>(() =>
  props.idAnagrafica === 1 ? apiRoles.value : apiRoles.value.filter((r) => !isInternalOnlyRole(r)),
);

async function toggleFindair(row: ContattoRow, enabled: boolean): Promise<void> {
  findairBusy[row.id] = true;
  try {
    // Sin nivel: el backend asigna el rol del grupo del contacto (TMWE →
    // tmwe_staff_portal, partner → partner_staff, cliente → findair_basic).
    findairOverride[row.id] = await contattiService.setFindairAccess(row.id, enabled);
    toast.success(enabled ? t('anagrafiche.findair.enabled') : t('anagrafiche.findair.disabled'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
    // Re-sincronizar el estado real si falló (revierte el switch optimista).
    try { findairOverride[row.id] = await contattiService.getApiRole(row.id); } catch { /* noop */ }
  } finally {
    findairBusy[row.id] = false;
  }
}

/** Atajo findair básico/completo: sigue apuntando a findair_basic/findair_full. */
async function setFindairLevel(row: ContattoRow, level: FindairLevel): Promise<void> {
  if (findairLevel(row) === level) return;
  findairBusy[row.id] = true;
  try {
    findairOverride[row.id] = await contattiService.setFindairAccess(row.id, true, level);
    toast.success(t('anagrafiche.findair.level_changed'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    findairBusy[row.id] = false;
  }
}

/** Cualquier rol OAuth del catálogo (1 rol por contacto). */
async function setApiRole(row: ContattoRow, role: OAuthRole): Promise<void> {
  if (apiRoleId(row) === role.id) return;
  findairBusy[row.id] = true;
  try {
    findairOverride[row.id] = await contattiService.setApiRole(row.id, role.id);
    toast.success(t('anagrafiche.findair.role_changed', { role: role.display_name || role.role_name }));
  } catch (e) {
    // 409 ROLE_NOT_ASSIGNABLE: rol solo-interno para un contacto que no es de TMWE.
    toast.error(roleConflictMessage(e, 'ROLE_NOT_ASSIGNABLE') ?? (e instanceof Error ? e.message : (t('common.error') as string)));
  } finally {
    findairBusy[row.id] = false;
  }
}

const headers = computed(() => [
  { title: t('anagrafiche.col_id'), key: 'id', width: 80 },
  { title: t('anagrafiche.fields.nome'), key: 'nome' },
  { title: t('anagrafiche.fields.mail'), key: 'mail' },
  { title: t('anagrafiche.fields.login'), key: 'loginn', width: 140 },
  { title: t('anagrafiche.fields.ruolo'), key: 'ruolo' },
  { title: t('anagrafiche.findair.col'), key: 'findair', sortable: false, width: 200, align: 'center' as const },
  { title: t('common.actions'), key: 'actions', sortable: false, width: 140, align: 'end' as const },
]);

/** Acciones de fila (>2 → menú dropdown con icono + texto). */
function rowActions(row: ContattoRow): RowAction[] {
  return [
    { key: 'perms', title: t('users.bulk.grant_role'), icon: mdiShieldKeyOutline, onClick: () => openPerms(row) },
    { key: 'profile', title: t('anagrafiche.send_profile'), icon: mdiEmailFastOutline, onClick: () => sendProfile(row) },
    { key: 'reset_pw', title: t('anagrafiche.reset_password'), icon: mdiKeyVariant, onClick: () => resetPassword(row) },
    { key: 'app_token', title: t('anagrafiche.app_token.cta'), icon: mdiCellphoneKey, onClick: () => resetAppToken(row) },
    { key: 'b2b', title: t('anagrafiche.b2b_direct.cta'), icon: mdiLoginVariant, onClick: () => b2bDirect(row) },
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => confirmDelete(row), divider: true },
  ];
}

function openCreate(): void {
  editing.value = null;
  dialogOpen.value = true;
}
function openEdit(row: ContattoRow): void {
  editing.value = row;
  dialogOpen.value = true;
}
function openPerms(row: ContattoRow): void {
  editingPerms.value = row;
  permsOpen.value = true;
}

async function confirmDelete(row: ContattoRow): Promise<void> {
  const ok = await confirm.ask({
    title: t('common.delete') as string,
    message: row.nome || `#${row.id}`,
    variant: 'danger',
    confirmLabel: t('common.delete') as string,
  });
  if (!ok) return;
  try {
    await contattiService.remove(row.id);
    toast.success(t('anagrafiche.deleted'));
    emit('refresh');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

/** WS2.2 (G4): reset de password con confirmación; muestra la nueva una vez. */
async function resetPassword(row: ContattoRow): Promise<void> {
  const ok = await confirm.ask({
    title: t('anagrafiche.reset_password') as string,
    message: t('anagrafiche.reset_password_confirm', { name: row.nome || row.loginn || `#${row.id}` }) as string,
    variant: 'danger',
    confirmLabel: t('anagrafiche.reset_password') as string,
  });
  if (!ok) return;
  try {
    const pw = await contattiService.resetPassword(row.id);
    resetPw.value = pw;
    resetOpen.value = true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

/** Fase 4: regenera el token de la APP móvil; lo muestra una sola vez. */
async function resetAppToken(row: ContattoRow): Promise<void> {
  const ok = await confirm.ask({
    title: t('anagrafiche.app_token.cta') as string,
    message: t('anagrafiche.app_token.confirm', { name: row.nome || row.loginn || `#${row.id}` }) as string,
    variant: 'danger',
    confirmLabel: t('anagrafiche.app_token.cta') as string,
  });
  if (!ok) return;
  try {
    const token = await contattiService.resetAppToken(row.id);
    appToken.value = token;
    tokenOpen.value = true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

/** Fase 5: login directo en el portal B2B como este contacto (otra app → nueva pestaña). */
async function b2bDirect(row: ContattoRow): Promise<void> {
  const ok = await confirm.ask({
    title: t('anagrafiche.b2b_direct.cta') as string,
    message: t('anagrafiche.b2b_direct.confirm', { name: row.nome || row.loginn || `#${row.id}` }) as string,
    confirmLabel: t('anagrafiche.b2b_direct.cta') as string,
  });
  if (!ok) return;
  try {
    const url = await contattiService.b2bDirect(row.id);
    if (url) {
      window.open(url, '_blank', 'noopener');
    } else {
      toast.error(t('common.error') as string);
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

/** WS2.3 (G5): enviar perfil/credenciales por email. */
async function sendProfile(row: ContattoRow): Promise<void> {
  try {
    await contattiService.sendProfile(row.id);
    toast.success(t('anagrafiche.send_profile_done'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

function onSaved(): void {
  emit('refresh');
}
</script>

<style scoped>
.cm-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--cm-space-sm, 8px);
}
.cm-section-header h3 {
  margin: 0;
  font-weight: 500;
}
.cm-findair-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.cm-findair-chip {
  cursor: pointer;
}
/* Barra de filtros del listado de contactos (mismo patrón que el listado de
   anagrafiche). */
.cm-filters {
  display: flex;
  align-items: center;
  gap: var(--cm-space-md, 16px);
  margin-bottom: var(--cm-space-sm, 8px);
  flex-wrap: wrap;
}
.cm-filter-search {
  min-width: 220px;
  max-width: 340px;
  flex: 1 1 auto;
}
.cm-filter-narrow {
  max-width: 200px;
}
.cm-filter-count {
  font-size: var(--cm-fs-xs, 12px);
  color: var(--cm-text-muted);
  white-space: nowrap;
}
.cm-text-muted {
  color: var(--cm-text-muted);
}
/* Contenedor de altura acotada para que ListingDataView scrollee internamente
   (sticky header + zebra). Dentro de la ficha con tabs, limitamos al viewport. */
.cm-sublist-viewport {
  display: flex;
  flex-direction: column;
  /* Alto FLUIDO, no `calc(100vh - Npx)`.
     La altura magica no contaba el chrome real (topbar + cabecera de ficha +
     tabs, que varian con el idioma y el ancho): reservaba 560px donde habia 617
     disponibles y, peor, RECORTABA la tabla sin dar scroll — con 20 contactos
     quedaban 12 filas inalcanzables (ni el wrapper ni ningun ancestro
     scrolleaban). Heredando del padre flex, ListingDataView (flex:1 1 auto +
     min-height:0) scrollea en su propio wrapper, que es el patron del proyecto. */
  flex: 1 1 auto;
  min-height: 360px;
}
</style>
