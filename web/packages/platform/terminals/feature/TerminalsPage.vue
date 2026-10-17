<template>
  <div>
    <CmSectionHeader
      :title="t('sections.terminals')"
      :subtitle="t('terminals.subtitle')"
    />

    <!-- Filtros -->
    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="cm-filters" style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="filters.sigla"
          :prepend-inner-icon="mdiMagnify"
          :label="t('terminals.sigla')"
          density="compact" hide-details clearable
          style="max-width: 160px"
          @keyup.enter="reload"
        />
        <v-autocomplete
          v-model="filters.iso"
          :items="countries"
          :item-title="countryTitle"
          item-value="ISO2"
          :label="t('terminals.country')"
          density="compact" hide-details clearable
          :loading="countriesLoading"
          style="min-width: 220px; max-width: 260px"
          @update:model-value="reload"
        >
          <template #selection="{ item }">
            <span v-if="item?.raw?.ISO2" class="d-flex align-center" style="gap:6px">
              <CmCountryFlag :iso="item.raw.ISO2" />
              <span>{{ item.raw.ISO2 }}</span>
            </span>
          </template>
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :title="undefined">
              <template #prepend>
                <CmCountryFlag :iso="item.raw.ISO2" :size="18" class="me-2" />
              </template>
              <v-list-item-title>{{ countryTitle(item.raw) }}</v-list-item-title>
            </v-list-item>
          </template>
        </v-autocomplete>
        <v-text-field
          v-model="filters.citta"
          :label="t('terminals.city')"
          density="compact" hide-details clearable
          style="max-width: 180px"
          @keyup.enter="reload"
        />
        <v-select
          v-model="filters.tipo" :items="tipoItems"
          item-title="title" item-value="value"
          :label="t('terminals.type')" density="compact" hide-details
          style="max-width: 130px"
        />
        <v-select
          v-model="filters.stato" :items="statoItems"
          item-title="title" item-value="value"
          :label="t('terminals.status')" density="compact" hide-details
          style="max-width: 140px"
        />
        <v-btn class="cm-btn-accent-tonal" variant="tonal" :prepend-icon="mdiMagnify" @click="reload">
          {{ t('common.search') }}
        </v-btn>
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('terminals.new') }}
        </v-btn>
      </div>
    </v-card>

    <CmEmptyState
      v-if="!loading && !error && rows.length === 0"
      :icon="mdiAirplane"
      :title="t('terminals.empty')"
    />
    <ListingDataView
      v-else
      :source="listSource"
      :headers="tableHeaders"
      :selected="selected"
      :sort-key-map="sortKeyMap"
      mode="paginated"
      :selectable="false"
      @update:selected="selected = $event"
    >
      <template #cell.tipo="{ item }">
        <b>{{ (item as Terminal).tipo === 'A' ? 'AIR' : 'SEA' }}</b>
      </template>
      <template #cell.iso_paese="{ item }">
        <span class="d-flex align-center" style="gap:6px">
          <CmCountryFlag :iso="(item as Terminal).iso_paese" />
          <span>{{ (item as Terminal).iso_paese }}</span>
        </span>
      </template>
      <template #cell.sigla="{ item }">
        <b>{{ (item as Terminal).sigla }}</b>
      </template>
      <template #cell.gruppo="{ item }">
        <v-text-field
          :model-value="(item as Terminal).gruppo ?? ''"
          density="compact" hide-details variant="plain" style="max-width:60px"
          @change="(e:any) => saveField(item as Terminal, 'gruppo', e.target.value)"
        />
      </template>
      <template #cell.principali="{ item }">
        <v-icon
          :icon="(item as Terminal).principali === 'S' ? mdiCheckCircle : mdiCircleOutline"
          :color="(item as Terminal).principali === 'S' ? 'success' : 'grey'"
          style="cursor:pointer"
          @click="flipField(item as Terminal, 'principali')"
        />
      </template>
      <template #cell.citta="{ item }">
        {{ (item as Terminal).citta }}
      </template>
      <template #cell.nome="{ item }">
        <v-text-field
          :model-value="(item as Terminal).nome ?? ''"
          density="compact" hide-details variant="plain" style="max-width:160px"
          @change="(e:any) => saveField(item as Terminal, 'nome', e.target.value)"
        />
      </template>
      <template #cell.nome_mawb="{ item }">
        <v-text-field
          :model-value="(item as Terminal).nome_mawb ?? ''"
          density="compact" hide-details variant="plain" style="max-width:180px"
          @change="(e:any) => saveField(item as Terminal, 'nome_mawb', e.target.value)"
        />
      </template>
      <template #cell.addr_c="{ item }">
        <span :style="badgeStyle((item as Terminal).has_addr_c)" style="cursor:pointer" @click="openAddress(item as Terminal, 'C')">
          {{ truthy((item as Terminal).has_addr_c) ? 'OK' : 'NA' }}
        </span>
      </template>
      <template #cell.addr_t="{ item }">
        <span :style="badgeStyle((item as Terminal).has_addr_t)" style="cursor:pointer" @click="openAddress(item as Terminal, 'T')">
          {{ truthy((item as Terminal).has_addr_t) ? 'OK' : 'NA' }}
        </span>
      </template>
      <template #cell.geo="{ item }">
        <v-tooltip :text="t('terminals.geocode')" location="top">
          <template #activator="{ props }">
            <v-icon
              v-bind="props"
              :icon="truthy((item as Terminal).has_geo) ? mdiMapMarkerCheck : mdiMapMarkerOff"
              :color="truthy((item as Terminal).has_geo) ? 'success' : 'grey'"
              :loading="geocoding === (item as Terminal).id"
              style="cursor:pointer"
              @click="geocode(item as Terminal)"
            />
          </template>
        </v-tooltip>
      </template>
      <template #cell.suppl_navetta="{ item }">
        <FlagToggle :value="(item as Terminal).suppl_navetta" @change="(v) => saveField(item as Terminal, 'suppl_navetta', v)" />
      </template>
      <template #cell.suppl_navetta_dst="{ item }">
        <FlagToggle :value="(item as Terminal).suppl_navetta_dst" @change="(v) => saveField(item as Terminal, 'suppl_navetta_dst', v)" />
      </template>
      <template #cell.local="{ item }">
        <FlagToggle :value="(item as Terminal).local" @change="(v) => saveField(item as Terminal, 'local', v)" />
      </template>
      <template #cell.terminal_presa="{ item }">
        <FlagToggle :value="(item as Terminal).terminal_presa" @change="(v) => saveField(item as Terminal, 'terminal_presa', v)" />
      </template>
      <template #cell.actions="{ item }">
        <CmRowActions :actions="rowActions(item as Terminal)" />
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <!-- Dialog: crear / editar terminal -->
    <v-dialog v-model="createOpen" max-width="600" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiAirplane" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('terminals.new') : t('terminals.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="createOpen = false" />
        </div>
        <v-divider />

        <v-form ref="createFormRef" @submit.prevent="doCreate">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="5">
                <v-text-field
                  v-model="createForm.sigla"
                  :label="t('terminals.sigla')"
                  :rules="[requiredRule]"
                  :hint="t('terminals.sigla_hint')"
                  persistent-hint
                  variant="outlined" density="comfortable"
                  class="text-uppercase"
                  :prepend-inner-icon="mdiTagOutline"
                  autofocus
                  @update:model-value="(v:string) => (createForm.sigla = v.toUpperCase())"
                />
              </v-col>
              <v-col cols="12" sm="7">
                <v-select
                  v-model="createForm.tipo"
                  :items="tipoItemsReq" item-title="title" item-value="value"
                  :label="t('terminals.type')"
                  variant="outlined" density="comfortable"
                  :prepend-inner-icon="mdiShapeOutline"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-autocomplete
                  v-model="createForm.iso_paese"
                  :items="countries" :item-title="countryTitle" item-value="ISO2"
                  :label="t('terminals.country')"
                  :loading="countriesLoading"
                  variant="outlined" density="comfortable"
                  clearable
                >
                  <template #prepend-inner>
                    <CmCountryFlag v-if="createForm.iso_paese" :iso="createForm.iso_paese" class="me-2" />
                  </template>
                  <template #selection="{ item }">
                    <span v-if="item?.raw?.ISO2">{{ countryTitle(item.raw) }}</span>
                  </template>
                  <template #item="{ props: itemProps, item }">
                    <v-list-item v-bind="itemProps" :title="undefined">
                      <template #prepend>
                        <CmCountryFlag :iso="item.raw.ISO2" :size="18" class="me-2" />
                      </template>
                      <v-list-item-title>{{ countryTitle(item.raw) }}</v-list-item-title>
                    </v-list-item>
                  </template>
                </v-autocomplete>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="createForm.citta"
                  :label="t('terminals.city')"
                  variant="outlined" density="comfortable"
                  :prepend-inner-icon="mdiCity"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="createForm.nome"
                  :label="t('terminals.nome_tendina')"
                  :hint="t('terminals.nome_hint')"
                  persistent-hint
                  variant="outlined" density="comfortable"
                  :prepend-inner-icon="mdiFormatText"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="createForm.nome_mawb"
                  :label="t('terminals.nome_mawb')"
                  variant="outlined" density="comfortable"
                  :prepend-inner-icon="mdiFormatText"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="createForm.gruppo"
                  :label="t('terminals.gruppo')"
                  variant="outlined" density="comfortable"
                  :prepend-inner-icon="mdiTagOutline"
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider />
          <v-card-actions class="px-4 py-3">
            <v-spacer />
            <v-btn variant="text" @click="createOpen = false">{{ t('common.cancel') }}</v-btn>
            <v-btn class="cm-btn-accent" variant="flat" :loading="saving" :prepend-icon="mdiContentSave" type="button" @click="doCreate">
              {{ t('common.save') }}
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <!-- Dialog: dirección C/T -->
    <v-dialog v-model="addrOpen" max-width="620" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="addrQuale === 'T' ? mdiWarehouse : mdiTruckDelivery" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">
            {{ addrQuale === 'T' ? t('terminals.addr_title_t') : t('terminals.addr_title_c') }}
          </span>
          <v-chip v-if="addrTerminal" size="small" variant="flat" class="cm-dialog-head__chip ms-2">
            {{ addrTerminal.sigla }}
          </v-chip>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="addrOpen = false" />
        </div>
        <v-divider />

        <v-card-text class="pt-5">
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="addrForm.nome" :label="t('terminals.addr_nome')"
                variant="outlined" density="comfortable" :prepend-inner-icon="mdiOfficeBuildingOutline"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="addrForm.address" :label="t('terminals.addr_address')"
                variant="outlined" density="comfortable" :prepend-inner-icon="mdiMapMarkerOutline"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field v-model="addrForm.cap" :label="t('terminals.addr_cap')" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="8">
              <v-text-field v-model="addrForm.citta" :label="t('terminals.city')" variant="outlined" density="comfortable" :prepend-inner-icon="mdiCity" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="addrForm.prov" :label="t('terminals.addr_prov')" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-autocomplete
                v-model="addrForm.iso_paese"
                :items="countries" :item-title="countryTitle" item-value="ISO2"
                :label="t('terminals.country')" :loading="countriesLoading"
                variant="outlined" density="comfortable" clearable
              >
                <template #prepend-inner>
                  <CmCountryFlag v-if="addrForm.iso_paese" :iso="addrForm.iso_paese" class="me-2" />
                </template>
                <template #selection="{ item }">
                  <span v-if="item?.raw?.ISO2">{{ countryTitle(item.raw) }}</span>
                </template>
                <template #item="{ props: itemProps, item }">
                  <v-list-item v-bind="itemProps" :title="undefined">
                    <template #prepend>
                      <CmCountryFlag :iso="item.raw.ISO2" :size="18" class="me-2" />
                    </template>
                    <v-list-item-title>{{ countryTitle(item.raw) }}</v-list-item-title>
                  </v-list-item>
                </template>
              </v-autocomplete>
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="addrForm.tel" :label="t('terminals.addr_tel')" variant="outlined" density="comfortable" :prepend-inner-icon="mdiPhoneOutline" />
            </v-col>
          </v-row>
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer />
          <v-btn variant="text" @click="addrOpen = false">{{ t('common.cancel') }}</v-btn>
          <v-btn class="cm-btn-accent" variant="flat" :loading="saving" :prepend-icon="mdiContentSave" @click="saveAddress">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, h, onMounted, defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiAirplane, mdiCheckCircle, mdiCircleOutline,
  mdiMapMarkerCheck, mdiMapMarkerOff,
  mdiClose, mdiContentSave, mdiTagOutline, mdiShapeOutline, mdiCity,
  mdiFormatText, mdiWarehouse, mdiTruckDelivery, mdiOfficeBuildingOutline,
  mdiMapMarkerOutline, mdiPhoneOutline,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmCountryFlag from '../../geographic_config/components/CmCountryFlag.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import type { DataTableHeader, ListSource } from '../../listing/types';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  terminalsService,
  type Terminal,
  type TerminalAddress,
  type TerminalFilters,
  type TerminalCountry,
  type Flag,
} from '../services/terminals.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

// Mini-componente toggle S/N (select compacto)
const FlagToggle = defineComponent({
  props: { value: { type: String, required: true } },
  emits: ['change'],
  setup(props, { emit }) {
    return () =>
      h('select', {
        value: props.value,
        style: 'width:46px; padding:2px; border:1px solid #ccc; border-radius:4px;',
        onChange: (e: Event) => emit('change', (e.target as HTMLSelectElement).value as Flag),
      }, [
        h('option', { value: 'S' }, 'Sì'),
        h('option', { value: 'N' }, 'No'),
      ]);
  },
});

const rows = ref<Terminal[]>([]);
const total = ref(0);
const page = ref(1);
const perPage = ref(100);
const loading = ref(false);
const selected = ref<{ id: number }[]>([]);

const tableHeaders: DataTableHeader[] = [
  { title: t('terminals.type') as string, key: 'tipo', sortable: false, width: 60 },
  { title: t('terminals.country') as string, key: 'iso_paese', sortable: false },
  { title: t('terminals.sigla') as string, key: 'sigla', sortable: false },
  { title: t('terminals.gruppo') as string, key: 'gruppo', sortable: false },
  { title: t('terminals.principali') as string, key: 'principali', sortable: false, align: 'center' },
  { title: t('terminals.city') as string, key: 'citta', sortable: false },
  { title: t('terminals.nome_tendina') as string, key: 'nome', sortable: false },
  { title: t('terminals.nome_mawb') as string, key: 'nome_mawb', sortable: false },
  { title: 'ADDR C', key: 'addr_c', sortable: false, align: 'center' },
  { title: 'ADDR T', key: 'addr_t', sortable: false, align: 'center' },
  { title: 'GEO', key: 'geo', sortable: false, align: 'center' },
  { title: t('terminals.navetta_p') as string, key: 'suppl_navetta', sortable: false, align: 'center' },
  { title: t('terminals.navetta_c') as string, key: 'suppl_navetta_dst', sortable: false, align: 'center' },
  { title: t('terminals.local') as string, key: 'local', sortable: false, align: 'center' },
  { title: t('terminals.presa') as string, key: 'terminal_presa', sortable: false, align: 'center' },
  { title: t('common.actions') as string, key: 'actions', sortable: false, align: 'center' },
];
const sortKeyMap: Record<string, string> = {};

/** Adaptador ListSource server-side, mismo patrón que ContactsPage. */
const listSource: ListSource<Terminal> = reactive({
  get total() { return total.value; },
  get rows() { return rows.value; },
  get loading() { return loading.value; },
  get error() { return error.value; },
  get page() { return page.value; },
  get perPage() { return perPage.value; },
  sort: '',
  sortDir: 'ASC',
  async loadPage(p: number) { page.value = p; await load(); },
  async loadMore() { /* solo modo paginado */ },
  async refresh() { page.value = 1; await load(); },
  setSort() { /* columnas no ordenables hoy */ },
  async setPerPage(n: number) { perPage.value = n; page.value = 1; await load(); },
}) as ListSource<Terminal>;

// Países para el autocomplete del filtro (value = ISO2 = cargo_terminals.iso_paese).
// Solo países que TIENEN terminales (evita opciones sin resultados).
const countries = ref<TerminalCountry[]>([]);
const countriesLoading = ref(false);
function countryTitle(p: TerminalCountry | null | undefined): string {
  if (!p || !p.ISO2) return '';
  return `(${p.ISO2}) ${p.nome ?? ''}`.trim();
}
async function loadCountries() {
  countriesLoading.value = true;
  try {
    countries.value = (await terminalsService.listCountries()).filter((c) => !!c.ISO2);
  } catch {
    countries.value = [];
  } finally {
    countriesLoading.value = false;
  }
}
const error = ref<string | null>(null);
const saving = ref(false);
const geocoding = ref<number | null>(null);

const filters = reactive<TerminalFilters>({
  sigla: '', iso: '', citta: '', tipo: '', stato: 'A',
});

const tipoItems = [
  { title: t('common.all'), value: '' },
  { title: 'AIR', value: 'A' },
  { title: 'SEA', value: 'P' },
];
const tipoItemsReq = [
  { title: 'AIR', value: 'A' },
  { title: 'SEA', value: 'P' },
];
const statoItems = [
  { title: t('terminals.status_active'), value: 'A' },
  { title: t('terminals.status_deleted'), value: 'O' },
  { title: t('common.all'), value: '*' },
];

function truthy(v: unknown): boolean {
  return v === 1 || v === '1' || v === true;
}
function badgeStyle(v: unknown): string {
  return truthy(v) ? 'color:#1565c0;font-weight:bold' : 'color:#c62828;font-weight:bold';
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await terminalsService.list(page.value, filters, perPage.value);
    rows.value = res.rows;
    total.value = res.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}
function reload() { page.value = 1; load(); }

async function saveField(row: Terminal, field: string, value: string) {
  try {
    const nv = await terminalsService.updateField(row.id, field, value);
    (row as Record<string, unknown>)[field] = nv;
    toast.success(t('common.saved'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
    load();
  }
}
async function flipField(row: Terminal, field: 'principali') {
  try {
    const nv = await terminalsService.updateField(row.id, field, row[field] === 'S' ? 'N' : 'S');
    row[field] = nv as Flag;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// ── Crear / Editar ──
const createOpen = ref(false);
const createFormRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
// editId: null = alta; number = edición del terminal con ese id.
const editId = ref<number | null>(null);
const createForm = reactive({
  sigla: '', tipo: 'A' as 'A' | 'P', iso_paese: '', citta: '', nome: '', nome_mawb: '', gruppo: '',
});
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(createForm, { sigla: '', tipo: 'A', iso_paese: '', citta: '', nome: '', nome_mawb: '', gruppo: '' });
}
function openCreate() {
  editId.value = null;
  resetForm();
  createOpen.value = true;
}
/** Acciones de fila: editar (visible) + eliminar en kebab. */
function rowActions(row: Terminal): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) },
  ];
}

function openEdit(row: Terminal) {
  editId.value = row.id;
  Object.assign(createForm, {
    sigla: row.sigla ?? '',
    tipo: (row.tipo === 'P' ? 'P' : 'A'),
    iso_paese: row.iso_paese ?? '',
    citta: row.citta ?? '',
    nome: row.nome ?? '',
    nome_mawb: row.nome_mawb ?? '',
    gruppo: row.gruppo ?? '',
  });
  createOpen.value = true;
}
async function doCreate() {
  const ok = await createFormRef.value?.validate();
  if (ok && !ok.valid) return;
  if (!createForm.sigla.trim()) { toast.error(t('terminals.sigla_required')); return; }
  saving.value = true;
  try {
    const payload = { ...createForm, sigla: createForm.sigla.trim().toUpperCase() };
    if (editId.value === null) {
      await terminalsService.create(payload);
    } else {
      await terminalsService.update(editId.value, payload);
    }
    toast.success(t('common.saved'));
    createOpen.value = false;
    reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

// ── Dirección ──
const addrOpen = ref(false);
const addrQuale = ref<'C' | 'T'>('C');
const addrTerminal = ref<Terminal | null>(null);
const addrForm = reactive<TerminalAddress>({
  nome: '', address: '', cap: '', citta: '', prov: '', iso_paese: '', tel: '',
});
async function openAddress(row: Terminal, quale: 'C' | 'T') {
  addrTerminal.value = row;
  addrQuale.value = quale;
  Object.assign(addrForm, { nome: '', address: '', cap: '', citta: '', prov: '', iso_paese: '', tel: '' });
  addrOpen.value = true;
  try {
    const existing = await terminalsService.getAddress(row.id, quale);
    if (existing) Object.assign(addrForm, existing);
  } catch { /* dirección vacía */ }
}
async function saveAddress() {
  if (!addrTerminal.value) return;
  saving.value = true;
  try {
    await terminalsService.saveAddress(addrTerminal.value.id, addrQuale.value, { ...addrForm });
    toast.success(t('common.saved'));
    addrOpen.value = false;
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

// ── Geo ──
async function geocode(row: Terminal) {
  geocoding.value = row.id;
  try {
    const res = await terminalsService.geocode(row.id);
    if (res) {
      row.has_geo = 1;
      toast.success(t('terminals.geocode_ok'));
    } else {
      toast.error(t('terminals.geocode_fail'));
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    geocoding.value = null;
  }
}

// ── Borrar ──
async function removeRow(row: Terminal) {
  const ok = await confirm.askDanger(
    t('terminals.delete_confirm', { sigla: row.sigla }),
    t('terminals.delete_title'),
  );
  if (!ok) return;
  try {
    await terminalsService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  loadCountries();
  load();
});
</script>

<style scoped>
/* Cabecera de diálogo en la línea visual del admin (sin barra negra):
   fondo claro de acento de marca + texto/icono en el azul de marca
   (--cm-accent #1648b4), divisor inferior. */
.cm-dialog-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 12px 14px 20px;
  background: var(--cm-tone-accent-bg, #e6efff);
}
.cm-dialog-head__icon {
  color: var(--cm-accent, #1648b4);
}
.cm-dialog-head__title {
  font-size: var(--cm-fs-md, 1rem);
  font-weight: var(--cm-fw-semibold, 600);
  color: var(--cm-tone-accent-text, #1648b4);
}
.cm-dialog-head__chip {
  background: var(--cm-accent, #1648b4) !important;
  color: #fff !important;
  font-weight: 700;
}

/* Botones de acción en azul de marca (no el primary casi-negro del tema). */
.cm-btn-accent {
  background: var(--cm-accent, #1648b4) !important;
  color: #fff !important;
}
.cm-btn-accent-tonal {
  background: var(--cm-tone-accent-bg, #e6efff) !important;
  color: var(--cm-tone-accent-text, #1648b4) !important;
}
</style>
