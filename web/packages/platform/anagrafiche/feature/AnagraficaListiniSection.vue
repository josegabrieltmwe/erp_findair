<template>
  <div>
    <!-- Header de sección estándar (igual que UsersPage/OAuthClients) -->
    <CmSectionHeader
      :title="t('anagrafiche.tabs.listini')"
      :subtitle="t('anagrafiche.listini.subtitle')"
    >
      <template #actions>
        <v-btn variant="text" size="small" :prepend-icon="mdiRefresh" :loading="loading" @click="reload">
          {{ t('common.refresh') }}
        </v-btn>
        <v-btn variant="text" size="small" :prepend-icon="mdiLock" :loading="batchSaving" @click="lockAllFiltered(true)">
          {{ t('anagrafiche.listini.lock_all') }}
        </v-btn>
        <v-btn variant="text" size="small" :prepend-icon="mdiLockOpenVariant" :loading="batchSaving" @click="lockAllFiltered(false)">
          {{ t('anagrafiche.listini.unlock_all') }}
        </v-btn>
        <v-btn color="primary" size="small" :prepend-icon="mdiAutoFix" @click="bulkOpen = true">
          {{ t('anagrafiche.listini.base_profile_cta') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <!-- House fee de la consolidata: fila fija fuera del grid (no es un servicio del catálogo ni se filtra/bloquea) -->
    <v-card v-if="houseFee" variant="outlined" class="pa-3 mb-3 d-flex align-center" style="gap: 12px;" data-testid="house-fee-card">
      <div class="flex-grow-1">
        <div class="font-weight-medium">{{ houseFee.servizio_nome }}</div>
        <div class="text-caption text-medium-emphasis">{{ t('anagrafiche.listini.house_fee_desc') }}</div>
      </div>
      <div class="text-no-wrap">
        <template v-if="houseFee.prf_fix !== null && houseFee.prf_fix !== undefined">€{{ fmtNum(houseFee.prf_fix) }}</template>
        <span v-else class="text-medium-emphasis">
          <template v-if="houseFee.owner_prf_fix !== null && houseFee.owner_prf_fix !== undefined">
            {{ t('anagrafiche.listini.house_fee_owner') }}: €{{ fmtNum(houseFee.owner_prf_fix) }}
          </template>
          <v-chip v-else size="small" color="warning" variant="tonal">{{ t('anagrafiche.listini.house_fee_unset') }}</v-chip>
        </span>
      </div>
      <v-btn variant="text" size="small" :prepend-icon="mdiPencil" @click="openEdit(houseFee)">{{ t('common.edit') }}</v-btn>
    </v-card>

    <!-- Barra de filtros (grid compartido cm-filters) -->
    <div class="cm-filters">
      <v-text-field
        v-model="fSearch"
        :label="t('common.search')"
        :prepend-inner-icon="mdiMagnify"
        density="compact" variant="outlined" hide-details clearable
        class="cm-filter-search"
      />
      <v-select v-model="fPaese" :items="paeseItems" :label="t('anagrafiche.listini.f_paese')"
        density="compact" variant="outlined" hide-details clearable class="cm-filter-narrow" />
      <v-select v-model="fTipoSrv" :items="tipoSrvItems" :label="t('anagrafiche.listini.f_tipo_srv')"
        density="compact" variant="outlined" hide-details clearable class="cm-filter-narrow" />
      <v-select v-model="fImport" :items="importItems" :label="t('anagrafiche.listini.f_import')"
        density="compact" variant="outlined" hide-details clearable class="cm-filter-narrow" />
      <v-select v-model="fLP" :items="lpItems" :label="t('anagrafiche.listini.f_lp')"
        density="compact" variant="outlined" hide-details clearable class="cm-filter-narrow" />
      <v-select v-model="fLevel" :items="levelItems" :label="t('anagrafiche.listini.f_level')"
        density="compact" variant="outlined" hide-details clearable class="cm-filter-narrow" />
      <v-select v-model="fPriority" :items="priorityItems" :label="t('anagrafiche.listini.f_priority')"
        density="compact" variant="outlined" hide-details clearable class="cm-filter-narrow" />
    </div>

    <!-- Tabla envuelta en CmAsyncSection (loading skeleton + empty state) -->
    <CmAsyncSection
      :loading="loading"
      :error="null"
      :empty="!loading && filteredRows.length === 0"
      :data="filteredRows"
      loading-type="skeleton"
      :skeleton-rows="8"
      :skeleton-cols="6"
    >
      <template #empty>
        <CmEmptyState :icon="mdiPackageVariantClosed" :title="t('anagrafiche.listini.empty_title')">
          <p>{{ t('anagrafiche.listini.empty_hint') }}</p>
        </CmEmptyState>
      </template>

      <template #default>
        <v-card class="pa-0 mt-4" variant="outlined">
          <v-data-table
            v-model="selected"
            :headers="headers"
            :items="filteredRows"
            :loading="batchSaving"
            show-select
            item-value="id_servizio"
            density="comfortable"
            hover
            class="cm-listini-table"
          >
      <!-- From-Type: país-tipo + marca IMP (paridad columna From-Type legacy) -->
      <template #item.from_type="{ item }">
        <span class="text-no-wrap">
          {{ (item as ServiceConfigRow).servizio_paese }}-{{ (item as ServiceConfigRow).servizio_tipo }}
          <v-chip v-if="(item as ServiceConfigRow).servizio_import === 'S'" size="x-small" color="amber-darken-2" variant="tonal" class="ml-1">IMP</v-chip>
        </span>
      </template>

      <!-- Servicio: nombre limpio (sin tags HTML legacy) -->
      <template #item.servizio_descr="{ item }">
        <span :class="{ 'text-disabled': (item as ServiceConfigRow).blocked }">
          {{ stripTags((item as ServiceConfigRow).servizio_nome || (item as ServiceConfigRow).servizio_descr || '') }}
        </span>
      </template>

      <!-- Serv.Fuel: fuel base del servizio (read-only) -->
      <template #item.servizio_fuel="{ item }">
        <span class="text-medium-emphasis">{{ fmtPct((item as ServiceConfigRow).servizio_fuel) }}</span>
      </template>

      <!-- Tipo L/P: chip de solo lectura -->
      <template #item.tipo="{ item }">
        <v-chip size="small" variant="tonal"
          :color="(item as ServiceConfigRow).tipo === 'P' ? 'deep-purple' : 'primary'">
          {{ (item as ServiceConfigRow).tipo === 'P' ? t('anagrafiche.listini.profit') : t('anagrafiche.listini.lst') }}
        </v-chip>
      </template>

      <!-- Listino asignado / config: solo lectura, resumen legible -->
      <template #item.config="{ item }">
        <template v-if="(item as ServiceConfigRow).tipo !== 'P'">
          <span :class="listinoBroken(item as ServiceConfigRow)
            ? 'cm-listino-broken'
            : ((item as ServiceConfigRow).id_listino_nome ? 'cm-listino-set' : 'text-medium-emphasis')">
            {{ listinoLabel(item as ServiceConfigRow) }}
          </span>
          <!-- El listino guardado existe pero está archivado (o su id ya no
               existe): el motor lo descarta y tarifa por el base. Sin este chip
               la fila muestra un listino que NO se aplica. -->
          <v-chip
            v-if="listinoBroken(item as ServiceConfigRow)"
            size="x-small"
            color="warning"
            variant="tonal"
            class="ml-2"
            :title="brokenHint(item as ServiceConfigRow)"
          >
            <v-icon start size="x-small">{{ mdiAlert }}</v-icon>
            {{ (item as ServiceConfigRow).listino_health === 'missing'
              ? t('anagrafiche.listini.listino_missing')
              : t('anagrafiche.listini.listino_archived') }}
          </v-chip>
          <span class="text-medium-emphasis ml-2 text-caption">
            ×{{ fmtNum((item as ServiceConfigRow).coefficiente) }} · {{ fmtPct((item as ServiceConfigRow).fuel_surc) }}
          </span>
        </template>
        <template v-else>
          <span class="text-medium-emphasis text-caption">
            {{ t('anagrafiche.listini.prf_mod') }} {{ fmtPct((item as ServiceConfigRow).prf_mod) }}
            · {{ t('anagrafiche.listini.prf_fix') }} €{{ fmtNum((item as ServiceConfigRow).prf_fix) }}
            <v-chip v-if="(item as ServiceConfigRow).forza_API === 'S'" size="x-small" color="warning" variant="tonal" class="ml-1">API</v-chip>
          </span>
          <!-- En modo P el listino sigue guardado pero NO se aplica. Sin esta
               pista el operador ve "Profitto" y no sabe que hay un listino
               latente que reaparecerá si vuelve a modo L. -->
          <span
            v-if="(item as ServiceConfigRow).id_listino_nome"
            class="text-disabled text-caption ml-2 cm-listino-inactive"
            :title="t('anagrafiche.listini.listino_inactive_hint')"
          >
            ({{ stripTags((item as ServiceConfigRow).listino_nome) || `#${(item as ServiceConfigRow).id_listino_nome}` }})
          </span>
        </template>
      </template>

      <!-- Bloqueo: chip de estado (solo lectura; el toggle está en acciones) -->
      <template #item.blocked="{ item }">
        <v-chip size="small" variant="tonal"
          :color="(item as ServiceConfigRow).blocked ? 'error' : 'success'">
          {{ (item as ServiceConfigRow).blocked ? t('anagrafiche.listini.col_blocked') : t('anagrafiche.listini.col_active') }}
        </v-chip>
      </template>

      <!-- Acciones por fila: editar (modal) · ver precios · bloquear/desbloquear -->
      <template #item.actions="{ item }">
        <CmRowActions :actions="rowActions(item as ServiceConfigRow)" />
      </template>
          </v-data-table>
        </v-card>
      </template>
    </CmAsyncSection>

    <!-- Confirmación de "dejar disponibles solo los seleccionados": cierra
         cientos de servizi de una vez, así que se pide confirmación explícita
         con el recuento exacto de lo que se va a bloquear. -->
    <v-dialog v-model="onlySelectedOpen" max-width="560">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon :icon="mdiLock" class="mr-2" color="warning" />
          {{ t('anagrafiche.listini.only_selected_title') }}
        </v-card-title>
        <v-card-text>
          <p class="mb-3">
            {{ t('anagrafiche.listini.only_selected_confirm', {
              keep: selected.length,
              block: Math.max(0, totalRows - selected.length),
            }) }}
          </p>
          <v-alert type="info" variant="tonal" density="compact">
            {{ t('anagrafiche.listini.only_selected_note') }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="onlySelectedOpen = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="warning" variant="flat" :loading="batchSaving" :prepend-icon="mdiLock" @click="onOnlySelected">
            {{ t('anagrafiche.listini.only_selected_apply') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Wizard "Aplicar perfil base de tarifas" (paridad legacy SetLsty C/P/O/M):
         asigna a TODOS los servicios el listino base del perfil elegido. -->
    <v-dialog v-model="bulkOpen" max-width="640">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon :icon="mdiAutoFix" class="mr-2" />
          {{ t('anagrafiche.listini.base_profile_title') }}
        </v-card-title>
        <v-card-subtitle class="pb-2">{{ t('anagrafiche.listini.base_profile_subtitle') }}</v-card-subtitle>

        <v-card-text>
          <!-- Tarjetas seleccionables, una por perfil -->
          <div class="cm-profile-grid">
            <v-card
              v-for="opt in baseProfileOptions"
              :key="opt.value"
              :variant="bulkType === opt.value ? 'tonal' : 'outlined'"
              :color="bulkType === opt.value ? 'primary' : undefined"
              class="cm-profile-card pa-3"
              @click="bulkType = opt.value"
            >
              <div class="d-flex align-center mb-1">
                <v-icon :icon="opt.icon" class="mr-2" :color="bulkType === opt.value ? 'primary' : 'medium-emphasis'" />
                <span class="font-weight-medium">{{ opt.title }}</span>
                <v-spacer />
                <v-icon v-if="bulkType === opt.value" :icon="mdiCheckCircle" color="primary" size="20" />
              </div>
              <div class="text-caption text-medium-emphasis">{{ opt.desc }}</div>
            </v-card>
          </div>

          <!-- Opción forzar -->
          <v-alert type="warning" variant="tonal" density="compact" class="mt-4">
            <v-switch
              v-model="bulkForza"
              color="warning"
              :label="t('anagrafiche.listini.bulk_forza')"
              hide-details
              density="compact"
            />
            <div class="text-caption mt-1">{{ t('anagrafiche.listini.bulk_forza_hint') }}</div>
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="bulkOpen = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" :loading="bulkSaving" :prepend-icon="mdiCheck" @click="onBulkApply">
            {{ t('anagrafiche.listini.base_profile_apply') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Editar fila en modal (en vez de inline) -->
    <AnagraficaListinoEditDialog
      v-model="editOpen"
      :id-anagrafica="idAnagrafica"
      :row="editRow"
      :listini="editRow ? listinoItems(editRow) : []"
      @saved="reload"
      @show-prices="openPriceList"
    />

    <!-- G-L4: Show price list (matriz del listino) -->
    <ListinoPriceDialog
      v-model="priceOpen"
      :listino-nome-id="priceListinoId"
      :listino-nome="priceListinoNome"
      :id-anagrafica="idAnagrafica"
      :id-servizio="priceServizioId"
    />

    <!-- Barra de acción contextual flotante (patrón Gmail/Material): aparece
         anclada abajo al marcar filas, con el contador y las acciones de lote. -->
    <Teleport to="body">
      <Transition name="cm-action-bar">
        <div v-if="selected.length" class="cm-action-bar" role="toolbar">
          <div class="cm-action-bar__inner">
            <div class="cm-action-bar__count">
              <v-icon :icon="mdiCheckboxMultipleMarked" size="20" class="mr-2" />
              <strong>{{ t('anagrafiche.listini.batch_selected', { n: selected.length }) }}</strong>
              <v-btn size="x-small" variant="text" class="ml-1" :icon="mdiClose"
                :title="t('anagrafiche.listini.clear_selection')" @click="selected = []" />
            </div>

            <v-divider vertical class="mx-1" />

            <span class="cm-action-bar__label">{{ t('anagrafiche.listini.batch_set_type') }}</span>
            <v-btn size="small" variant="tonal" color="primary" :loading="batchSaving" @click="batchSetTipo('L')">
              <v-icon :icon="mdiFormatListBulleted" start />{{ t('anagrafiche.listini.lst') }}
            </v-btn>
            <v-btn size="small" variant="tonal" color="deep-purple" :loading="batchSaving" @click="batchSetTipo('P')">
              <v-icon :icon="mdiCurrencyEur" start />{{ t('anagrafiche.listini.profit') }}
            </v-btn>

            <v-divider vertical class="mx-1" />

            <span class="cm-action-bar__label">{{ t('anagrafiche.listini.batch_block_group') }}</span>
            <v-btn size="small" variant="tonal" color="error" :loading="batchSaving" @click="batchBlock(true)">
              <v-icon :icon="mdiLock" start />{{ t('anagrafiche.listini.batch_block') }}
            </v-btn>
            <v-btn size="small" variant="tonal" color="success" :loading="batchSaving" @click="batchBlock(false)">
              <v-icon :icon="mdiLockOpenVariant" start />{{ t('anagrafiche.listini.batch_unblock') }}
            </v-btn>

            <v-divider vertical class="mx-1" />

            <!-- El alta real es "cerrar todo y abrir lo justo": este botón lo
                 hace en un solo paso, dejando disponibles SOLO los servizi
                 seleccionados. Se resuelve en servidor (una petición). -->
            <v-btn
              size="small"
              variant="flat"
              color="warning"
              :loading="batchSaving"
              :title="t('anagrafiche.listini.only_selected_hint')"
              @click="onlySelectedOpen = true"
            >
              <v-icon :icon="mdiLock" start />{{ t('anagrafiche.listini.only_selected') }}
            </v-btn>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiRefresh, mdiMagnify, mdiLock, mdiLockOpenVariant, mdiEyeOutline,
  mdiCheckboxMultipleMarked, mdiPackageVariantClosed, mdiPencil, mdiClose,
  mdiFormatListBulleted, mdiCurrencyEur, mdiAutoFix, mdiCheck, mdiCheckCircle,
  mdiAccountOutline, mdiHandshakeOutline, mdiTagOutline, mdiChartLine, mdiAlert,
} from '@mdi/js';
import {
  serviceConfigService,
  type ServiceConfigRow,
  type ListinoType,
} from '../services/serviceConfig.service';
import { useToast } from '../composables/useToast';
import CmSectionHeader from '../components/CmSectionHeader.vue';
import CmAsyncSection from '../components/CmAsyncSection.vue';
import CmEmptyState from '../components/CmEmptyState.vue';
import CmRowActions, { type RowAction } from '../components/CmRowActions.vue';
import ListinoPriceDialog from './ListinoPriceDialog.vue';
import AnagraficaListinoEditDialog from './AnagraficaListinoEditDialog.vue';
import { stripTags } from '../../utils/text';

const props = defineProps<{ idAnagrafica: number }>();
const { t } = useI18n();
const toast = useToast();

// G-L4: Show price list
const priceOpen = ref(false);
const priceListinoId = ref(0);
const priceListinoNome = ref('');
const priceServizioId = ref(0);
function openPriceList(row: ServiceConfigRow): void {
  priceListinoId.value = Number(row.id_listino_nome) || 0;
  priceListinoNome.value = row.listino_nome ?? '';
  priceServizioId.value = Number(row.id_servizio) || 0;
  if (priceListinoId.value > 0) priceOpen.value = true;
}

const rows = ref<ServiceConfigRow[]>([]);
const houseFee = ref<ServiceConfigRow | null>(null);
const loading = ref(false);

// L2: filtros del listado
const fSearch = ref('');
const fPaese = ref<string | null>(null);
const fTipoSrv = ref<string | null>(null);
const fImport = ref<string | null>(null);
const fLP = ref<string | null>(null);
const fLevel = ref<number | null>(null);
const fPriority = ref<string | null>(null);

function fmtPct(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? `${n.toFixed(2)} %` : '—';
}

/**
 * Etiqueta de la columna "config". Con listino explícito muestra su nombre;
 * sin él (id_listino_nome = 0) muestra "Base price list" y, cuando el backend
 * lo resuelve, el nombre del base que realmente se aplicará — así el operador
 * ve qué tarifa rige en lugar de una celda ambigua.
 */
function listinoLabel(row: ServiceConfigRow): string {
  if (row.id_listino_nome) {
    return stripTags(row.listino_nome) || `#${row.id_listino_nome}`;
  }
  const base = stripTags(row.base_listino_nome ?? '');
  const label = t('anagrafiche.listini.base_price') as string;
  return base ? `${label} (${base})` : label;
}

/**
 * El listino guardado NO se está aplicando: está archivado (stato='O') o su id
 * ya no existe. En ambos casos ListyCli() lo descarta y tarifa por el base, así
 * que la fila muestra un listino que no rige. Medido en dev: 175k asignaciones
 * activas apuntan a listinos archivados.
 */
function listinoBroken(row: ServiceConfigRow): boolean {
  return row.listino_health === 'archived' || row.listino_health === 'missing';
}

/** Explica en el tooltip qué se aplica realmente en su lugar. */
function brokenHint(row: ServiceConfigRow): string {
  const base = stripTags(row.base_listino_nome ?? '');
  const key = row.listino_health === 'missing'
    ? 'anagrafiche.listini.listino_missing_hint'
    : 'anagrafiche.listini.listino_archived_hint';
  return t(key, { base: base || (t('anagrafiche.listini.base_price') as string) }) as string;
}

// L3: selección múltiple + batch
const selected = ref<number[]>([]);
const batchSaving = ref(false);

const paeseItems = computed(() =>
  Array.from(new Set(rows.value.map((r) => r.servizio_paese).filter(Boolean))) as string[],
);
const tipoSrvItems = ['EXP', 'AIR', 'SEA'];
const importItems = computed(() => [
  { title: t('common.yes'), value: 'S' },
  { title: t('common.no'), value: 'N' },
]);
const lpItems = computed(() => [
  { title: t('anagrafiche.listini.lst'), value: 'L' },
  { title: t('anagrafiche.listini.profit'), value: 'P' },
]);
// Level: Special(-1) / Blocked(0) / 1..10 (paridad listy_level)
const levelItems = computed(() => [
  { title: t('anagrafiche.listini.level_special'), value: -1 },
  { title: t('anagrafiche.listini.level_blocked'), value: 0 },
  ...Array.from({ length: 10 }, (_, i) => ({ title: `${t('anagrafiche.listini.level')} ${i + 1}`, value: i + 1 })),
]);
const priorityItems = computed(() => [
  { title: t('anagrafiche.listini.prio_s'), value: 'S' },
  { title: t('anagrafiche.listini.prio_n'), value: 'N' },
  { title: t('anagrafiche.listini.prio_e'), value: 'E' },
]);

const filteredRows = computed(() => {
  const q = fSearch.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (q) {
      const hay = `${r.servizio_descr ?? ''} ${r.servizio_nome ?? ''} ${r.listino_nome ?? ''}`.toLowerCase();
      if (!hay.includes(q) && String(r.id_servizio) !== q) return false;
    }
    if (fPaese.value && r.servizio_paese !== fPaese.value) return false;
    if (fTipoSrv.value && r.servizio_tipo !== fTipoSrv.value) return false;
    if (fImport.value && r.servizio_import !== fImport.value) return false;
    if (fLP.value && (r.tipo || 'L') !== fLP.value) return false;
    if (fLevel.value !== null && Number(r.servizio_livello) !== fLevel.value) return false;
    if (fPriority.value && r.servizio_prioritario !== fPriority.value) return false;
    return true;
  });
});

/** Lock-all: bloquea/desbloquea todos los servizi MOSTRADOS (filtrados). */
async function lockAllFiltered(blocked: boolean): Promise<void> {
  const ids = filteredRows.value.map((r) => r.id_servizio);
  if (!ids.length) return;
  await runBatch(() => serviceConfigService.toggleBlockBatch(props.idAnagrafica, ids, blocked));
}

async function batchSetTipo(tipo: 'L' | 'P'): Promise<void> {
  await runBatch(() => serviceConfigService.updateFieldBatch(props.idAnagrafica, selected.value, 'tipo', tipo));
}
async function batchBlock(blocked: boolean): Promise<void> {
  await runBatch(() => serviceConfigService.toggleBlockBatch(props.idAnagrafica, selected.value, blocked));
}

/** Total de servizi del catálogo (no de la vista filtrada). */
const totalRows = computed(() => rows.value.length);

/**
 * "Dejar disponibles solo los seleccionados": bloquea todo el catálogo excepto
 * la selección. Es el gesto real del alta de un cliente (medido: media de 147
 * servizi bloqueados de 336). Va por un endpoint propio porque el batch normal
 * hace una petición HTTP por servizio: aquí serían ~300 encadenadas.
 */
async function onOnlySelected(): Promise<void> {
  const keep = [...selected.value];
  batchSaving.value = true;
  try {
    const r = await serviceConfigService.bulkBlock(props.idAnagrafica, true, keep);
    toast.success(t('anagrafiche.listini.only_selected_done', { changed: r.changed, kept: keep.length }));
    onlySelectedOpen.value = false;
    selected.value = [];
    reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    batchSaving.value = false;
  }
}
async function runBatch(fn: () => Promise<{ ok: number; failed: number }>): Promise<void> {
  batchSaving.value = true;
  try {
    const r = await fn();
    toast.success(t('anagrafiche.listini.batch_done', { ok: r.ok, failed: r.failed }));
    selected.value = [];
    reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    batchSaving.value = false;
  }
}
const availableListini = ref<Record<number, { id: number; nome: string }[]>>({});

const onlySelectedOpen = ref(false);
const bulkOpen = ref(false);
const bulkType = ref<ListinoType>('base');
const bulkForza = ref(false);
const bulkSaving = ref(false);

const headers = computed(() => [
  { title: t('anagrafiche.listini.from_type'), key: 'from_type', value: 'servizio_paese', width: 110, sortable: true },
  { title: t('anagrafiche.listini.service'), key: 'servizio_descr', width: 200, sortable: true },
  { title: t('anagrafiche.listini.serv_fuel'), key: 'servizio_fuel', width: 90, align: 'end' as const, sortable: true },
  { title: t('anagrafiche.listini.tipo'), key: 'tipo', width: 100, align: 'center' as const, sortable: true },
  { title: t('anagrafiche.listini.config'), key: 'config', value: 'listino_nome', sortable: true },
  { title: t('anagrafiche.listini.blocked'), key: 'blocked', width: 110, align: 'center' as const, sortable: true },
  { title: t('common.actions'), key: 'actions', width: 130, align: 'center' as const, sortable: false },
]);

function fmtNum(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

// Edición por modal (en vez de inline en la fila)
const editOpen = ref(false);
const editRow = ref<ServiceConfigRow | null>(null);
function openEdit(row: ServiceConfigRow): void {
  editRow.value = row;
  editOpen.value = true;
}

/** Acciones de fila (>2 → menú dropdown con icono + texto). */
function rowActions(row: ServiceConfigRow): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, color: 'primary', onClick: () => openEdit(row) },
    {
      key: 'price',
      title: t('anagrafiche.listini.show_price_list'),
      icon: mdiEyeOutline,
      disabled: row.tipo === 'P' || !row.id_listino_nome,
      onClick: () => openPriceList(row),
    },
    {
      key: 'block',
      title: row.blocked ? t('anagrafiche.listini.unblock') : t('anagrafiche.listini.block'),
      icon: row.blocked ? mdiLock : mdiLockOpenVariant,
      color: row.blocked ? 'error' : undefined,
      onClick: () => onToggleBlock(row, !row.blocked),
    },
  ];
}

const BASE_LISTINO_OPT = computed(() => ({ id: 0, nome: t('anagrafiche.listini.base_price') as string }));

function listinoItems(row: ServiceConfigRow): { id: number; nome: string }[] {
  const opts = availableListini.value[row.id_servizio] ?? [];
  return [BASE_LISTINO_OPT.value, ...opts];
}


// Perfiles base (paridad legacy SetLsty C/P/O/M) con icono + descripción para
// las tarjetas del wizard.
const baseProfileOptions = computed<{ value: ListinoType; title: string; desc: string; icon: string }[]>(() => [
  { value: 'base',    title: t('anagrafiche.listini.type_base'),    desc: t('anagrafiche.listini.type_base_desc'),    icon: mdiAccountOutline },
  { value: 'partner', title: t('anagrafiche.listini.type_partner'), desc: t('anagrafiche.listini.type_partner_desc'), icon: mdiHandshakeOutline },
  { value: 'promo',   title: t('anagrafiche.listini.type_promo'),   desc: t('anagrafiche.listini.type_promo_desc'),   icon: mdiTagOutline },
  { value: 'market',  title: t('anagrafiche.listini.type_market'),  desc: t('anagrafiche.listini.type_market_desc'),  icon: mdiChartLine },
]);

async function reload(): Promise<void> {
  if (!props.idAnagrafica) return;
  loading.value = true;
  try {
    const [list, avail] = await Promise.all([
      serviceConfigService.list(props.idAnagrafica),
      // catálogo de listini por servizio; estable durante la sesión de edición
      Object.keys(availableListini.value).length
        ? Promise.resolve(availableListini.value)
        : serviceConfigService.availableListini(props.idAnagrafica).catch(() => ({})),
    ]);
    houseFee.value = list.find((r) => r.special === 'house_fee') ?? null;
    rows.value = list.filter((r) => r.special !== 'house_fee');
    availableListini.value = avail;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    loading.value = false;
  }
}

async function onToggleBlock(row: ServiceConfigRow, blocked: boolean): Promise<void> {
  try {
    await serviceConfigService.toggleBlock(props.idAnagrafica, row.id_servizio, blocked);
    toast.success(t('anagrafiche.updated'));
    reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

async function onBulkApply(): Promise<void> {
  bulkSaving.value = true;
  try {
    const r = await serviceConfigService.bulkAssign(props.idAnagrafica, bulkType.value, bulkForza.value);
    toast.success(t('anagrafiche.listini.bulk_done', { updated: r.updated, skipped: r.skipped }));
    bulkOpen.value = false;
    reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    bulkSaving.value = false;
  }
}

onMounted(reload);
</script>

<style scoped>
/* Filtros: ancho flexible (búsqueda) + selects estrechos, sobre el grid
   compartido .cm-filters (page-utils.scss). Mismo patrón que UsersPage. */
.cm-filter-search {
  flex: 1 1 240px;
  min-width: 220px;
}
.cm-filter-narrow {
  flex: 0 1 160px;
  min-width: 140px;
}

/* ── Barra de acción contextual flotante (patrón Gmail/Material) ── */
.cm-action-bar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 2400;            /* sobre el contenido, bajo los diálogos (2500+) */
  max-width: calc(100vw - 32px);
}
.cm-action-bar__inner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 14px;
  border-radius: 999px;     /* píldora */
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 24px -4px rgba(15, 23, 42, 0.28), 0 2px 8px -2px rgba(15, 23, 42, 0.18);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.cm-action-bar__count {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
.cm-action-bar__label {
  font-size: var(--cm-fs-xs, 11px);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.65;
}
/* Transición de entrada/salida (slide + fade desde abajo). */
.cm-action-bar-enter-active,
.cm-action-bar-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.cm-action-bar-enter-from,
.cm-action-bar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}

/* ── Wizard de perfil base: grid de tarjetas seleccionables ── */
.cm-profile-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.cm-profile-card {
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.cm-profile-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
}

/* La tabla dentro de la v-card outlined no necesita borde propio. */
.cm-listini-table {
  background: transparent;
}

/* Zebra: filas pares con fondo tenue (igual que invoicing/_invoice_table). */
.cm-listini-table :deep(tbody tr:nth-child(even) > td) {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.cm-listini-table :deep(tbody tr:hover > td) {
  background: rgba(var(--v-theme-primary), 0.08) !important;
}

/* Listino asignado en azul (paridad legacy: #0f54b7 sobre fondo claro). */
.cm-listino-set {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}

/* Listino guardado pero inerte (modo P): tachado para que no se confunda con
   la tarifa vigente. */
.cm-listino-inactive {
  text-decoration: line-through;
}

/* Listino archivado o inexistente: se muestra pero NO se aplica (el motor cae
   al base). Se atenúa para que no se lea como la tarifa vigente. */
.cm-listino-broken {
  color: rgb(var(--v-theme-warning));
  text-decoration: line-through;
}

</style>
