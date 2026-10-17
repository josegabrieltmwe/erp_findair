<template>
  <div class="cm-anagrafiche-page">
    <CmSectionHeader :title="pageTitle" :subtitle="pageSubtitle">
      <template #actions>
        <ViewModeToggle v-model="viewMode" />
        <v-btn color="primary" :prepend-icon="mdiAccountPlus" @click="goCreate">
          {{ t('anagrafiche.new_anagrafica') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <!-- Tabs de tipo (Todos/Partners/Clientes) — solo en modo libre. En modo
         bloqueado (`lockedTipo`, p. ej. /clients) el tipo ya está fijo y
         estos tabs no aportarían nada, así que no se muestran. Cambiar de
         tab actualiza `filterTipo` y recarga, igual que la vista rápida de
         abajo pero como navegación de primer nivel — pensado para la vista
         administrativa de Settings, donde alternar entre "todos", "solo
         partners" y "solo clientes" es el caso de uso principal. -->
    <v-tabs
      v-if="!lockedTipo"
      :model-value="typeTab"
      class="cm-type-tabs"
      color="primary"
      @update:model-value="onTypeTabChange"
    >
      <v-tab value="all">{{ t('anagrafiche.type_tab.all') }}</v-tab>
      <v-tab value="partners">{{ t('anagrafiche.type_tab.partners') }}</v-tab>
      <v-tab value="clients">{{ t('anagrafiche.type_tab.clients') }}</v-tab>
    </v-tabs>

    <CmAsyncSection :error="error" :loading="false" @clear-error="error = null">
      <!-- Barra rápida: los filtros de uso diario quedan siempre a la vista.
           El resto del formulario legacy (anagr_cerca.php) vive en el panel
           avanzado desplegable de abajo, para no convertir la cabecera del
           listado en un formulario de 28 campos. -->
      <div class="cm-filters">
        <!--
          Vista rápida: preset de FILTROS (tipo/bloccato), no de columnas —
          por eso no usa `ListingWorkViewSelector`/`ListingWorkView`, cuyo
          contrato compartido (`headersForWorkView`) solo decide qué columnas
          se muestran. Forzarlo aquí habría sido reutilizar el tipo para algo
          que no fue diseñado a hacer. El legacy (anagr_list.php) llama
          "Customers" a tipo='C' y así es como un operario que viene de allí
          espera entrar al listado — ver comentario de `filterTipo` abajo.

          Oculta en modo bloqueado (`lockedTipo`): alternar a "Todos" no
          cambiaría nada (el backend ignora `tipo`), así que mostrarla solo
          confundiría prometiendo un alcance que no existe en esta vista.
        -->
        <v-select
          v-if="!lockedTipo"
          :model-value="activeQuickView"
          :items="quickViewItems"
          :label="t('anagrafiche.quick_view_label')"
          density="compact"
          variant="outlined"
          hide-details
          class="cm-filter-narrow"
          @update:model-value="applyQuickView"
        />
        <v-text-field
          v-model="searchInput"
          :label="t('anagrafiche.search_placeholder')"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="cm-filter-search"
          @update:model-value="onSearchChange"
        />
        <v-text-field
          v-model="filterId"
          :label="t('anagrafiche.filter_id')"
          type="number"
          min="1"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="cm-filter-id"
          @update:model-value="onSearchChange"
        />
        <!-- Oculto en modo bloqueado: el tipo no es negociable desde aquí,
             ni mostrarlo deshabilitado aporta — solo ocuparía espacio para
             comunicar un valor que el operador no puede cambiar. -->
        <v-select
          v-if="!lockedTipo"
          v-model="filterTipo"
          :items="tipoItems"
          :label="t('anagrafiche.filter_tipo')"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="cm-filter-narrow"
          @update:model-value="onFilterChange"
        />
        <!-- Filtro por dueño (id_anagr_titolare) — disponible en cualquier
             modo, incluido bloqueado: "quiénes son los clientes de X" es una
             pregunta válida tanto en la vista administrativa como en
             /clients. Aislamiento por partner ya aplicado server-side, así
             que un partner no-TMWE solo puede filtrar dentro de su ámbito. -->
        <CmAnagraficaAutocomplete
          v-model="filterTitolare"
          :label="t('anagrafiche.filter_titolare')"
          class="cm-filter-narrow"
          @update:model-value="onFilterChange"
        />
        <v-select
          v-model="filterBloccato"
          :items="boolItems"
          :label="t('anagrafiche.filter_bloccato')"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="cm-filter-narrow"
          @update:model-value="onFilterChange"
        />
        <v-select
          v-model="filterVies"
          :items="viesItems"
          :label="t('anagrafiche.filter_vies')"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="cm-filter-narrow"
          @update:model-value="onFilterChange"
        />
        <v-btn
          :color="advancedOpen || advancedCount > 0 ? 'primary' : undefined"
          :variant="advancedOpen ? 'tonal' : 'text'"
          :prepend-icon="mdiTune"
          :append-icon="advancedOpen ? mdiChevronUp : mdiChevronDown"
          @click="advancedOpen = !advancedOpen"
        >
          {{ t('anagrafiche.filters_advanced') }}
          <v-badge
            v-if="advancedCount > 0"
            :content="advancedCount"
            color="primary"
            inline
          />
        </v-btn>
        <v-btn color="primary" variant="text" :prepend-icon="mdiRefresh" :loading="loading" @click="reload">
          {{ t('common.refresh') }}
        </v-btn>
      </div>

      <!-- Panel avanzado: paridad 1:1 con el buscador legacy. Los campos se
           agrupan por bloque temático en vez de replicar la rejilla absoluta
           del legacy. Se aplica al pulsar "Buscar" (o Enter en los textos):
           con tantos campos, recargar en cada tecla sería ruido de red. -->
      <v-expand-transition>
        <v-sheet v-show="advancedOpen" class="cm-adv" rounded border>
          <div
            v-for="group in advancedGroups"
            :key="group.key"
            class="cm-adv-group"
          >
            <div class="cm-adv-title">{{ t(group.labelKey) }}</div>
            <div class="cm-adv-grid">
              <template v-for="f in group.fields" :key="f.field">
                <!-- País: selector compartido con bandera + búsqueda. -->
                <CmCountrySelect
                  v-if="f.kind === 'country'"
                  :model-value="draft[f.field]"
                  :label="t(f.labelKey)"
                  class="cm-adv-field"
                  @update:model-value="draft[f.field] = $event"
                />
                <v-select
                  v-else-if="f.kind === 'select'"
                  v-model="draft[f.field]"
                  :items="optionItems[f.field] || []"
                  :loading="f.async ? optionsLoading : false"
                  item-title="title"
                  item-value="value"
                  :label="t(f.labelKey)"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  class="cm-adv-field"
                />
                <v-text-field
                  v-else
                  v-model="draft[f.field]"
                  :label="t(f.labelKey)"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  class="cm-adv-field"
                  @keyup.enter="applyAdvanced"
                />
              </template>
            </div>
          </div>

          <div class="cm-adv-actions">
            <v-btn variant="text" :prepend-icon="mdiFilterRemove" @click="resetAdvanced">
              {{ t('anagrafiche.filters_reset') }}
            </v-btn>
            <v-btn
              color="primary"
              :prepend-icon="mdiMagnify"
              :loading="loading"
              @click="applyAdvanced"
            >
              {{ t('anagrafiche.filters_apply') }}
            </v-btn>
          </div>
        </v-sheet>
      </v-expand-transition>
    </CmAsyncSection>

    <!-- Filtros activos como chips removibles. Se alimentan de los valores
         clicados en las celdas (click-to-filter) y de los selects. -->
    <ActiveFilterChips
      :filters="activeFilters"
      @remove="removeFilter"
      @clear="clearAllFilters"
    />

    <!-- Estado vacío: se muestra solo cuando NO hay error, no carga y no hay filas.
         Con datos, la tabla compartida (ListingDataView) gobierna su propio look
         (sticky header, zebra, hover-3D, chips, overlay de recarga). -->
    <CmEmptyState
      v-if="!loading && !error && rows.length === 0"
      :icon="mdiAccountSearch"
      :title="hasActiveFilters ? t('anagrafiche.empty_filtered_title') : t('anagrafiche.empty_title')"
    >
      <p>{{ hasActiveFilters ? t('anagrafiche.empty_filtered_hint') : t('anagrafiche.empty_hint') }}</p>
    </CmEmptyState>

    <!-- ListingDataView (.sdv-card) ya trae flex:1 1 auto + min-height:0 y
         hace SU PROPIO scroll interno, heredando la altura del padre flex.
         DashboardShell activa :has(.sdv-card) { height:100vh; overflow:hidden }
         precisamente para darle un alto acotado real al padre — no hace
         falta (ni conviene) calcularlo aquí a mano.

         Antes este contenedor tenía `height: calc(100vh - 260px)` fijo,
         pensado para cuando esta página vivía fuera de DashboardShell. Hoy
         sus DOS únicos consumidores (operations, admin_config) la envuelven
         en DashboardShell — verificado 2026-08-18 — así que el cálculo
         manual ya no tenía ningún caso de uso real, y competía con el alto
         que DashboardShell ya reserva: si el offset mágico no coincidía con
         el chrome real (header + tabs + filtros, que varían con idioma/
         ancho), la tabla se recortaba SIN dar scroll externo — el mismo
         patrón ya documentado y corregido en AnagraficaDetailPage
         (.cm-sublist-viewport). Se retira aquí por el mismo motivo: mt-2
         se mantiene como único ajuste, el resto lo resuelve el flex del
         padre + ListingDataView. -->
    <div v-else class="cm-anagrafiche-list-body mt-2">
      <ListingDataView
        :source="listSource"
        :headers="tableHeaders"
        :selected="selected"
        :mode="viewMode"
        :sort-key-map="sortKeyMap"
        :selectable="false"
        @update:selected="selected = $event"
        @update:mode="(v) => (viewMode = v)"
      >
      <!-- ListingDataView intercepta TODA columna con su slot cell.<key>;
           una columna sin slot definido se renderiza vacía (no cae al valor
           por defecto de Vuetify). Por eso cada columna necesita su slot.
           Los valores clicables (.filterable) aplican un filtro por ese valor;
           ver/editar es exclusivo de los botones de la columna de acciones. -->
      <template #cell.id="{ item }">
        <button
          type="button"
          class="filterable cm-id-cell"
          :title="t('anagrafiche.filter_click.by_id')"
          @click.stop="setFilter('id', String((item as AnagraficaRow).id))"
        >{{ (item as AnagraficaRow).id }}</button>
      </template>

      <template #cell.rag_soc="{ item }">
        <button
          v-if="(item as AnagraficaRow).rag_soc"
          type="button"
          class="filterable font-weight-medium text-truncate cm-name-cell"
          :title="t('anagrafiche.filter_click.by_rag_soc')"
          @click.stop="setFilter('search', String((item as AnagraficaRow).rag_soc))"
        >{{ (item as AnagraficaRow).rag_soc }}</button>
        <span v-else class="cm-text-muted">—</span>
      </template>

      <template #cell.pi_cf="{ item }">
        <span v-if="(item as AnagraficaRow).pi_cf">{{ (item as AnagraficaRow).pi_cf }}</span>
        <span v-else class="cm-text-muted">—</span>
      </template>

      <template #cell.tipo="{ item }">
        <button
          v-if="(item as AnagraficaRow).tipo"
          type="button"
          class="filterable"
          :title="t('anagrafiche.filter_click.by_tipo')"
          @click.stop="setFilter('tipo', String((item as AnagraficaRow).tipo))"
        >
          <StatusChip
            :status="(item as AnagraficaRow).tipo ?? ''"
            :map="tipoChipMap"
            size="x-small"
            style="cursor: pointer"
          />
        </button>
        <span v-else class="cm-text-muted">—</span>
      </template>

      <template #cell.vies_check="{ item }">
        <button
          v-if="(item as AnagraficaRow).vies_check"
          type="button"
          class="filterable"
          :title="t('anagrafiche.filter_click.by_vies')"
          @click.stop="setFilter('vies_check', String((item as AnagraficaRow).vies_check))"
        >
          <v-chip
            size="x-small"
            variant="tonal"
            :color="viesColor(String((item as AnagraficaRow).vies_check))"
            style="cursor: pointer"
          >
            {{ (item as AnagraficaRow).vies_check }}
          </v-chip>
        </button>
        <span v-else class="cm-text-muted">—</span>
      </template>

      <template #cell.bloccato="{ item }">
        <button
          type="button"
          class="filterable cm-bloccato-btn"
          :title="t('anagrafiche.filter_click.by_bloccato')"
          @click.stop="setFilter('bloccato', (item as AnagraficaRow).bloccato === 'S' ? 'S' : 'N')"
        >
          <v-icon v-if="(item as AnagraficaRow).bloccato === 'S'" :icon="mdiLock" size="18" color="error" />
          <span v-else class="cm-text-muted">—</span>
        </button>
      </template>

      <!-- Actividad comercial. Un cliente sin fila en `anagrafiche_stats` llega
           con 0; se pinta "—" en vez de un 0 para no confundir "sin datos" con
           "cero envíos". -->
      <template #cell.sped_24m="{ item }">
        <span v-if="(item as AnagraficaRow).sped_24m" class="cm-num">
          {{ formatInt((item as AnagraficaRow).sped_24m) }}
        </span>
        <span v-else class="cm-text-muted">—</span>
      </template>

      <template #cell.sped_12m="{ item }">
        <span v-if="(item as AnagraficaRow).sped_12m" class="cm-num">
          {{ formatInt((item as AnagraficaRow).sped_12m) }}
        </span>
        <span v-else class="cm-text-muted">—</span>
      </template>

      <template #cell.importi_12m="{ item }">
        <span v-if="(item as AnagraficaRow).importi_12m" class="cm-num">
          {{ formatMoney((item as AnagraficaRow).importi_12m) }}
        </span>
        <span v-else class="cm-text-muted">—</span>
      </template>

      <template #cell.last_srv_date="{ item }">
        <span v-if="(item as AnagraficaRow).last_srv_date">
          {{ (item as AnagraficaRow).last_srv_date }}
        </span>
        <span v-else class="cm-text-muted">—</span>
      </template>

      <template #cell.actions="{ item }">
        <div class="cm-row-actions" @click.stop>
          <!-- Acción primaria (la más usada) siempre visible. -->
          <v-btn
            :icon="mdiPencil"
            size="small"
            variant="tonal"
            color="primary"
            class="cm-row-edit"
            :title="t('common.edit')"
            @click="goDetail(item as AnagraficaRow)"
          />
          <!-- Acciones secundarias agrupadas en un menú kebab. -->
          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                :icon="mdiDotsVertical"
                size="small"
                variant="text"
                :title="t('common.actions')"
              />
            </template>
            <v-list density="compact" min-width="180">
              <v-list-item
                :prepend-icon="mdiOpenInNew"
                :title="t('anagrafiche.actions.open_detail')"
                @click="goDetail(item as AnagraficaRow)"
              />
              <v-list-item
                :prepend-icon="mdiReceiptTextOutline"
                :title="t('anagrafiche.actions.open_billing')"
                @click="goDetailTab(item as AnagraficaRow, 'fatturazione')"
              />
              <v-list-item
                :prepend-icon="mdiCurrencyEur"
                :title="t('anagrafiche.actions.open_listini')"
                @click="goDetailTab(item as AnagraficaRow, 'listini')"
              />
              <v-divider />
              <v-list-item
                :prepend-icon="mdiContentCopy"
                :title="t('anagrafiche.actions.clone')"
                @click="openClone(item as AnagraficaRow)"
              />
              <v-divider />
              <v-list-item
                :prepend-icon="mdiDelete"
                :title="t('common.delete')"
                base-color="error"
                @click="confirmDelete(item as AnagraficaRow)"
              />
            </v-list>
          </v-menu>
        </div>
      </template>
      </ListingDataView>
    </div>

    <AnagraficaCloneDialog
      :open="cloneOpen"
      :source-id="cloneSource?.id ?? 0"
      :source-name="cloneSource?.rag_soc ?? ''"
      @close="cloneOpen = false"
      @cloned="onCloned"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  mdiAccountPlus,
  mdiAccountSearch,
  mdiRefresh,
  mdiPencil,
  mdiDelete,
  mdiLock,
  mdiDotsVertical,
  mdiOpenInNew,
  mdiReceiptTextOutline,
  mdiCurrencyEur,
  mdiContentCopy,
  mdiTune,
  mdiChevronUp,
  mdiChevronDown,
  mdiMagnify,
  mdiFilterRemove,
} from '@mdi/js';
import ListingDataView from '@shared/listing/ListingDataView.vue';
import ViewModeToggle from '@shared/listing/ViewModeToggle.vue';
import ActiveFilterChips from '@shared/listing/ActiveFilterChips.vue';
import { useListViewMode } from '@shared/listing/useListViewMode';
import StatusChip, { type StatusEntry } from '@shared/ui/StatusChip.vue';
import type { ListSource, DataTableHeader, ActiveFilter } from '@shared/listing/types';
import CmSectionHeader from '../components/CmSectionHeader.vue';
import CmAsyncSection from '../components/CmAsyncSection.vue';
import CmEmptyState from '../components/CmEmptyState.vue';
import CmCountrySelect from '../components/CmCountrySelect.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import AnagraficaCloneDialog from './AnagraficaCloneDialog.vue';
import { resolveActiveQuickView, filtersForQuickView, type QuickViewId } from '../utils/quickView';
import {
  anagraficaService,
  type AnagraficaLite,
  type AnagraficaListFilters,
  type AnagraficaListResult,
} from '../services/anagrafica.service';
import { paymentsService } from '../services/payments.service';
import { currenciesService } from '../services/currencies.service';
import { useToast } from '../composables/useToast';
import { useConfirm } from '../composables/useConfirm';
import { useDebouncedCallback } from '../composables/useDebouncedRef';

/**
 * Fila del listado. ListingDataView exige `id: number` (IdentifiedRow); el
 * backend devuelve `id` como string, así que lo normalizamos al mapear.
 */
interface AnagraficaRow extends AnagraficaLite {
  id: number;
  vies_check?: string;
  bloccato?: string;
  // Contadores de `anagrafiche_stats` (paridad columnas 2Y/1Y/último servicio
  // del listado legacy). Los calcula un batch; 0 si la anagrafica no tiene fila.
  sped_24m?: number;
  sped_12m?: number;
  sped_6m?: number;
  importi_12m?: number;
  /** Último mes con servicio, formato 'YYYY-MM'. */
  last_srv_date?: string | null;
}

// ListingDataView tipa selected/source con `{ id: number }` (no genérico);
// exponemos las filas por ese contrato base y casteamos en los slots #cell.*.
type IdRow = { id: number };

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const toast = useToast();
const confirm = useConfirm();

const rows = ref<AnagraficaRow[]>([]);
const total = ref(0);
const page = ref(1);
const perPage = ref(20);
const loading = ref(false);
const error = ref<string | null>(null);
// selectable=false → nunca hay selección real; ListingDataView aún requiere el prop.
const selected = ref<IdRow[]>([]);

// Modo de vista (paginado / scroll infinito), persistido en localStorage.
// Default 'infinite' en anagrafiche: es un listado largo donde el scroll
// continuo es lo que el usuario espera. La clave namespacea esta lista para
// no arrastrar el default global 'paginated' de cargo/shipment.
const viewMode = useListViewMode('tmwe:anagrafiche-view-mode', 'infinite');

// Sort server-side (antes ausente). Default: id descendente (más recientes arriba).
const sort = ref('id');
const sortDir = ref<'ASC' | 'DESC'>('DESC');

const searchInput = ref('');
const filterId = ref<string | null>(null);

// Modo BLOQUEADO por tipo (`meta.lockTipo`) — a diferencia de un simple
// valor inicial, esto oculta el selector de tipo y usa el endpoint DEDICADO
// de ese tipo (tipo forzado SERVER-SIDE — ver `fetchList()`/`listFn` más
// abajo, que mapea 'C' -> listClients()/Anagrafica_Clients_Controller y
// 'P' -> listPartners()/Anagrafica_Partners_Controller): el operador no
// puede cambiar ni vaciar el filtro, ni siquiera manipulando el DOM o la
// query — el backend ignora cualquier `tipo` que le llegue.
//
// Nace del ítem "Clientes" del sidebar (/clients): un `defaultTipo` que
// solo PRESELECCIONABA el filtro dejaba ver proveedores/corrieri/internos/
// archivados en cuanto el operador tocaba el selector — no era la garantía
// que ese botón prometía. Ver Anagrafica_Clients_Controller (backend).
// 'P' (card "Partners" en Settings) replica el mismo patrón.
//
// Se lee de la ruta, NO se cablea aquí: este componente lo comparten
// operations, partner_clients y admin_config. Una ruta sin `lockTipo`
// (p. ej. la vista administrativa "Todas las anagrafiche" en Settings, o
// el uso de admin_config) se comporta exactamente como antes: filtro de
// tipo libre, sin preselección.
const lockedTipo = (route.meta?.lockTipo as string | undefined) ?? null;

/**
 * Título/subtítulo del header cambian según el modo bloqueado: esta página
 * la comparten la vista libre "Todas las anagrafiche" (sin lockTipo, título
 * genérico) y las vistas acotadas a un solo tipo (/settings/partners,
 * /clients) -- mostrarles "Anagrafiche / Customer, partner & supplier
 * management" es engañoso cuando el listado ya está forzado server-side a
 * un único tipo (ver `lockedTipo` arriba).
 */
const pageTitle = computed<string>(() => {
  if (lockedTipo === 'P') return t('anagrafiche.type_tab.partners') as string;
  if (lockedTipo === 'C') return t('anagrafiche.type_tab.clients') as string;
  return t('sections.anagrafiche') as string;
});
const pageSubtitle = computed<string>(() => {
  if (lockedTipo === 'P') return t('anagrafiche.partners_subtitle') as string;
  if (lockedTipo === 'C') return t('anagrafiche.clients_subtitle') as string;
  return t('anagrafiche.subtitle') as string;
});

// `anagrafiche` es UNA sola tabla: clientes (C), clientes por verificar (CV),
// partners (P), proveedores (F), corrieri (T/TP), internos (I) y archivados (A)
// conviven en ella — en una muestra de 100 registros, 25 NO eran clientes. El
// legacy llama "Customers" a `tipo='C'` (anagr_list.php).
const filterTipo = ref<string | null>(lockedTipo);
const filterBloccato = ref<string | null>(null);
const filterVies = ref<string | null>(null);
/** Filtro por dueño (id_anagr_titolare) — id numérico o null, disponible en
 *  cualquier modo (bloqueado o libre). Ver CmAnagraficaAutocomplete arriba. */
const filterTitolare = ref<number | null>(null);

// Tabs de tipo (Todos/Partners/Clientes) — solo en modo libre, ver template.
// Deriva de `filterTipo` en vez de mantener estado propio duplicado: si el
// tipo cambia por otra vía (panel avanzado, click-to-filter) el tab activo
// debe reflejarlo, no quedar desincronizado.
type TypeTab = 'all' | 'partners' | 'clients';
const TYPE_TAB_VALUES: Record<TypeTab, string | null> = { all: null, partners: 'P', clients: 'C' };
const typeTab = computed<TypeTab>(() => {
  if (filterTipo.value === 'P') return 'partners';
  if (filterTipo.value === 'C') return 'clients';
  return 'all';
});
function onTypeTabChange(tab: unknown): void {
  filterTipo.value = TYPE_TAB_VALUES[tab as TypeTab] ?? null;
  void listSource.refresh();
}

// ── Filtros avanzados (paridad buscador legacy anagr_cerca.php) ─────────────
// Campos del formulario legacy que no caben en la barra rápida. `advanced`
// guarda lo APLICADO (lo que viaja al backend) y `draft` lo que el usuario
// está escribiendo en el panel; se copia de uno a otro al pulsar "Buscar".
// Separarlos evita recargar el listado en cada tecla con 20+ campos.
type AdvField =
  | 'rag_soc' | 'pi_cf' | 'note'
  | 'id_paese_iso' | 'citta' | 'prov' | 'presafissa' | 'multisede'
  | 'id_pagam_met' | 'id_pagam_scad' | 'tipo_pagamento' | 'esente_IVA'
  | 'fattura' | 'credito_residuo' | 'diritto_fisso' | 'fatt_sped_posta'
  | 'solleciti_invia' | 'id_banca_def' | 'valuta_sigla'
  | 'legale' | 'origine_sito_pubbl' | 'metric_imperial' | 'id_agente'
  | 'xpec' | 'xdestcode';

type AdvState = Record<AdvField, string | null>;

const ADV_FIELDS: AdvField[] = [
  'rag_soc', 'pi_cf', 'note',
  'id_paese_iso', 'citta', 'prov', 'presafissa', 'multisede',
  'id_pagam_met', 'id_pagam_scad', 'tipo_pagamento', 'esente_IVA',
  'fattura', 'credito_residuo', 'diritto_fisso', 'fatt_sped_posta',
  'solleciti_invia', 'id_banca_def', 'valuta_sigla',
  'legale', 'origine_sito_pubbl', 'metric_imperial', 'id_agente',
  'xpec', 'xdestcode',
];

function emptyAdvState(): AdvState {
  return ADV_FIELDS.reduce((acc, f) => {
    acc[f] = null;
    return acc;
  }, {} as AdvState);
}

const advanced = reactive<AdvState>(emptyAdvState());
const draft = reactive<AdvState>(emptyAdvState());
const advancedOpen = ref(false);

/** Nº de filtros avanzados aplicados — alimenta el badge del botón. */
const advancedCount = computed(
  () => ADV_FIELDS.filter((f) => advanced[f] !== null && advanced[f] !== '').length,
);

const hasActiveFilters = computed(
  () => !!(searchInput.value || filterId.value || filterTipo.value || filterBloccato.value
    || filterVies.value || filterTitolare.value)
    || advancedCount.value > 0,
);

// ── Vista rápida (preset de filtros) ────────────────────────────────────────
const quickViewItems = computed(() => [
  { title: t('anagrafiche.quick_view.all'), value: 'all' as QuickViewId },
  { title: t('anagrafiche.quick_view.clients'), value: 'clients' as QuickViewId },
  { title: t('anagrafiche.quick_view.blocked'), value: 'blocked' as QuickViewId },
]);

const activeQuickView = computed<QuickViewId>(() =>
  resolveActiveQuickView({ tipo: filterTipo.value, bloccato: filterBloccato.value }),
);

function applyQuickView(id: QuickViewId): void {
  const f = filtersForQuickView(id);
  filterTipo.value = f.tipo;
  filterBloccato.value = f.bloccato;
  void listSource.refresh();
}

const tipoItems = computed(() => [
  { title: t('anagrafiche.type.CV'), value: 'CV' },
  { title: t('anagrafiche.type.C'), value: 'C' },
  { title: t('anagrafiche.type.P'), value: 'P' },
  { title: t('anagrafiche.type.F_generic'), value: 'F' },
  { title: t('anagrafiche.type.T'), value: 'T' },
  { title: t('anagrafiche.type.TP'), value: 'TP' },
  { title: t('anagrafiche.type.I'), value: 'I' },
  { title: t('anagrafiche.type.A'), value: 'A' },
]);
const boolItems = computed(() => [
  { title: t('common.yes'), value: 'S' },
  { title: t('common.no'), value: 'N' },
]);
const viesItems = computed(() => [
  { title: t('anagrafiche.vies.ok'), value: 'OK' },
  { title: t('anagrafiche.vies.ko'), value: 'KO' },
  { title: t('anagrafiche.vies.na'), value: 'NN' },
  { title: '—', value: 'X' },
]);

// ── Catálogos de los selects avanzados ─────────────────────────────────────
// Los valores replican EXACTAMENTE los del legacy (anagr_array.php): cambiar
// una clave aquí rompe la equivalencia con el WHERE del backend.
type Opt = { title: string; value: string };

const optionsLoading = ref(false);
// Catálogos remotos (métodos/plazos de pago, divisas). Se cargan al abrir el
// panel por primera vez, no en el mount: la mayoría de sesiones no lo abre.
const remoteOptions = reactive<Record<string, Opt[]>>({
  id_pagam_met: [],
  id_pagam_scad: [],
  valuta_sigla: [],
});

/** Sí/No — el patrón más repetido del buscador legacy. */
const yesNoItems = computed<Opt[]>(() => [
  { title: t('common.yes') as string, value: 'S' },
  { title: t('common.no') as string, value: 'N' },
]);

const optionItems = computed<Record<string, Opt[]>>(() => ({
  // sedi_interne
  presafissa: yesNoItems.value,
  multisede: yesNoItems.value,
  // Pagos / facturación
  id_pagam_met: remoteOptions.id_pagam_met,
  id_pagam_scad: remoteOptions.id_pagam_scad,
  tipo_pagamento: [
    { title: t('anagrafiche.filters_opt.tipo_pagamento.A') as string, value: 'A' },
    { title: t('anagrafiche.filters_opt.tipo_pagamento.R') as string, value: 'R' },
    { title: t('anagrafiche.filters_opt.tipo_pagamento.S') as string, value: 'S' },
  ],
  // esente_IVA: régimen IVA, NO un booleano (ver AnagraficaFatturazioneSection).
  esente_IVA: [
    { title: t('anagrafiche.filters_opt.esente_IVA.21') as string, value: '21' },
    { title: t('anagrafiche.filters_opt.esente_IVA.S') as string, value: 'S' },
    { title: t('anagrafiche.filters_opt.esente_IVA.S1') as string, value: 'S1' },
    { title: t('anagrafiche.filters_opt.esente_IVA.S2') as string, value: 'S2' },
    { title: t('anagrafiche.filters_opt.esente_IVA.SN') as string, value: 'SN' },
  ],
  fattura: yesNoItems.value,
  // credito_residuo: 'C' = con crédito (>0), 'S' = sin crédito (=0).
  credito_residuo: [
    { title: t('anagrafiche.filters_opt.credito_residuo.C') as string, value: 'C' },
    { title: t('anagrafiche.filters_opt.credito_residuo.S') as string, value: 'S' },
  ],
  diritto_fisso: yesNoItems.value,
  fatt_sped_posta: yesNoItems.value,
  solleciti_invia: yesNoItems.value,
  // 'x' = banca no impostata (id_banca_def = 0) en el legacy.
  id_banca_def: [
    { title: t('anagrafiche.filters_opt.id_banca_def.x') as string, value: 'x' },
  ],
  // 'NOEU' = cualquier divisa distinta de EUR (semántica del servicio).
  valuta_sigla: [
    { title: t('anagrafiche.filters_opt.valuta_sigla.NOEU') as string, value: 'NOEU' },
    ...remoteOptions.valuta_sigla,
  ],
  // Estado / clasificación
  legale: [
    { title: t('anagrafiche.filters_opt.legale.N') as string, value: 'N' },
    { title: t('anagrafiche.filters_opt.legale.S') as string, value: 'S' },
    { title: t('anagrafiche.filters_opt.legale.P') as string, value: 'P' },
  ],
  origine_sito_pubbl: yesNoItems.value,
  metric_imperial: [
    { title: t('anagrafiche.filters_opt.metric_imperial.M') as string, value: 'M' },
    { title: t('anagrafiche.filters_opt.metric_imperial.I') as string, value: 'I' },
  ],
  // Especiales
  xpec: [
    { title: t('anagrafiche.filters_opt.xpec.CP') as string, value: 'CP' },
    { title: t('anagrafiche.filters_opt.xpec.SP') as string, value: 'SP' },
    { title: t('anagrafiche.filters_opt.xpec.FPS') as string, value: 'FPS' },
    { title: t('anagrafiche.filters_opt.xpec.FPN') as string, value: 'FPN' },
    { title: t('anagrafiche.filters_opt.xpec.SPS') as string, value: 'SPS' },
    { title: t('anagrafiche.filters_opt.xpec.SPN') as string, value: 'SPN' },
  ],
  xdestcode: [
    { title: t('anagrafiche.filters_opt.xdestcode.S') as string, value: 'S' },
    { title: t('anagrafiche.filters_opt.xdestcode.N') as string, value: 'N' },
  ],
}));

/**
 * Distribución del panel avanzado. Agrupa por bloque temático en lugar de
 * replicar la rejilla de posiciones absolutas del legacy (que no es
 * responsive). `kind` decide el control; `async` marca los catálogos remotos.
 */
interface AdvFieldDef {
  field: AdvField;
  labelKey: string;
  kind: 'text' | 'select' | 'country';
  async?: boolean;
}
interface AdvGroup {
  key: string;
  labelKey: string;
  fields: AdvFieldDef[];
}

const advancedGroups: AdvGroup[] = [
  {
    key: 'identity',
    labelKey: 'anagrafiche.filters_group.identity',
    fields: [
      { field: 'rag_soc', labelKey: 'anagrafiche.fields.rag_soc', kind: 'text' },
      { field: 'pi_cf', labelKey: 'anagrafiche.fields.pi_cf', kind: 'text' },
      { field: 'note', labelKey: 'anagrafiche.fields.note', kind: 'text' },
      { field: 'id_agente', labelKey: 'anagrafiche.fields.id_agente', kind: 'text' },
      { field: 'origine_sito_pubbl', labelKey: 'anagrafiche.fields.origine_sito_pubbl', kind: 'select' },
      { field: 'legale', labelKey: 'anagrafiche.fields.legale', kind: 'select' },
    ],
  },
  {
    key: 'location',
    labelKey: 'anagrafiche.filters_group.location',
    fields: [
      { field: 'id_paese_iso', labelKey: 'anagrafiche.filter_paese', kind: 'country' },
      { field: 'citta', labelKey: 'anagrafiche.fields.citta', kind: 'text' },
      { field: 'prov', labelKey: 'anagrafiche.fields.prov', kind: 'text' },
      { field: 'presafissa', labelKey: 'anagrafiche.fields.presa_fissa', kind: 'select' },
      { field: 'multisede', labelKey: 'anagrafiche.filters_field.multisede', kind: 'select' },
      { field: 'metric_imperial', labelKey: 'anagrafiche.fields.metric_imperial', kind: 'select' },
    ],
  },
  {
    key: 'billing',
    labelKey: 'anagrafiche.filters_group.billing',
    fields: [
      { field: 'id_pagam_met', labelKey: 'anagrafiche.fields.id_pagam_met', kind: 'select', async: true },
      { field: 'id_pagam_scad', labelKey: 'anagrafiche.fields.id_pagam_scad', kind: 'select', async: true },
      { field: 'tipo_pagamento', labelKey: 'anagrafiche.fields.tipo_pagamento', kind: 'select' },
      { field: 'esente_IVA', labelKey: 'anagrafiche.fields.esente_IVA', kind: 'select' },
      { field: 'fattura', labelKey: 'anagrafiche.filters_field.fattura', kind: 'select' },
      { field: 'credito_residuo', labelKey: 'anagrafiche.filters_field.credito_residuo', kind: 'select' },
      { field: 'diritto_fisso', labelKey: 'anagrafiche.fields.diritto_fisso', kind: 'select' },
      { field: 'valuta_sigla', labelKey: 'anagrafiche.fields.valuta_sigla', kind: 'select', async: true },
      { field: 'id_banca_def', labelKey: 'anagrafiche.filters_field.id_banca_def', kind: 'select' },
    ],
  },
  {
    key: 'documents',
    labelKey: 'anagrafiche.filters_group.documents',
    fields: [
      { field: 'xpec', labelKey: 'anagrafiche.filters_field.xpec', kind: 'select' },
      { field: 'xdestcode', labelKey: 'anagrafiche.filters_field.xdestcode', kind: 'select' },
      { field: 'fatt_sped_posta', labelKey: 'anagrafiche.filters_field.fatt_sped_posta', kind: 'select' },
      { field: 'solleciti_invia', labelKey: 'anagrafiche.filters_field.solleciti_invia', kind: 'select' },
    ],
  },
];

// Chip de tipo por categoría (mismo patrón unificado que cargo/shipment/facturas).
const tipoChipMap = computed<Record<string, StatusEntry>>(() => ({
  CV: { label: t('anagrafiche.type.CV') as string, color: 'warning' },
  C: { label: t('anagrafiche.type.C') as string, color: 'primary' },
  P: { label: t('anagrafiche.type.P') as string, color: 'info' },
  F: { label: t('anagrafiche.type.F_generic') as string, color: 'blue-grey' },
  T: { label: t('anagrafiche.type.T') as string, color: 'deep-purple' },
  TP: { label: t('anagrafiche.type.TP') as string, color: 'deep-purple' },
  I: { label: t('anagrafiche.type.I') as string, color: 'teal' },
  A: { label: t('anagrafiche.type.A') as string, color: 'grey' },
}));

const tableHeaders = computed<DataTableHeader[]>(() => [
  { title: t('anagrafiche.col_id'), key: 'id', width: 80 },
  { title: t('anagrafiche.col_rag_soc'), key: 'rag_soc' },
  { title: t('anagrafiche.col_pi_cf'), key: 'pi_cf', width: 160 },
  { title: t('anagrafiche.col_tipo'), key: 'tipo', width: 100, align: 'center' },
  { title: t('anagrafiche.col_vies'), key: 'vies_check', width: 90, align: 'center' },
  { title: t('anagrafiche.col_bloccato'), key: 'bloccato', width: 90, align: 'center' },
  // Actividad comercial (paridad columnas 2Y / 1Y / último servicio del legacy).
  // No son ordenables: viven en `anagrafiche_stats`, no en la query paginada.
  { title: t('anagrafiche.col_sped_24m'), key: 'sped_24m', width: 80, align: 'end', sortable: false },
  { title: t('anagrafiche.col_sped_12m'), key: 'sped_12m', width: 80, align: 'end', sortable: false },
  { title: t('anagrafiche.col_importi_12m'), key: 'importi_12m', width: 110, align: 'end', sortable: false },
  { title: t('anagrafiche.col_last_srv'), key: 'last_srv_date', width: 100, align: 'center', sortable: false },
  { title: t('anagrafiche.col_actions'), key: 'actions', sortable: false, width: 110, align: 'end' },
]);

// Whitelist UI-key → campo backend. Coincide con Anagrafica_Service::$allowed_sort.
const sortKeyMap: Record<string, string> = {
  id: 'id',
  rag_soc: 'rag_soc',
  tipo: 'tipo',
};

/** Entero con separador de miles según el locale activo. */
function formatInt(v?: number): string {
  return typeof v === 'number' ? v.toLocaleString() : '';
}

/** Importe sin decimales (los de stats son totales agregados, no céntimos). */
function formatMoney(v?: number): string {
  return typeof v === 'number' ? Math.round(v).toLocaleString() : '';
}

function viesColor(v: string): string {
  if (v === 'OK') return 'success';
  if (v === 'KO') return 'error';
  if (v === 'NN') return 'grey';
  return 'warning';
}

/**
 * Carga una página. Con `append=true` (scroll infinito) acumula las filas
 * nuevas al final; sin él (paginado / refresh / filtro) las reemplaza.
 */
async function fetchList(append = false): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    // Los avanzados se vuelcan tal cual: el servicio ya omite null/''.
    const advPayload: Record<string, string> = {};
    for (const f of ADV_FIELDS) {
      const v = advanced[f];
      if (v !== null && v !== '') advPayload[f] = v;
    }
    // Cada valor de lockedTipo despacha a SU endpoint dedicado (tipo forzado
    // server-side, no negociable) — no hay un endpoint genérico "bloqueado
    // a cualquier tipo". Añadir un nuevo lockTipo requiere su propio
    // Anagrafica_<Tipo>_Controller + método en el servicio, mismo patrón
    // que listClients()/listPartners().
    let listFn: (filters?: AnagraficaListFilters) => Promise<AnagraficaListResult>;
    if (lockedTipo === 'P') {
      listFn = anagraficaService.listPartners;
    } else if (lockedTipo) {
      listFn = anagraficaService.listClients;
    } else {
      listFn = anagraficaService.list;
    }
    const result = await listFn({
      page: page.value,
      perPage: perPage.value,
      search: searchInput.value || undefined,
      id: filterId.value || undefined,
      id_anagr_titolare: filterTitolare.value ? String(filterTitolare.value) : undefined,
      tipo: filterTipo.value ?? undefined,
      bloccato: filterBloccato.value ?? undefined,
      vies_check: filterVies.value ?? undefined,
      ...advPayload,
      sort: sort.value,
      order: sortDir.value,
    });
    const incoming = result.items.map((r) => ({ ...r, id: Number(r.id) }));
    rows.value = append ? [...rows.value, ...incoming] : incoming;
    total.value = result.total;
    page.value = result.page;
  } catch (e) {
    error.value = e instanceof Error ? e.message : (t('common.error') as string);
    if (!append) {
      rows.value = [];
      total.value = 0;
    }
  } finally {
    loading.value = false;
  }
}

/**
 * Adaptador ListSource que expone el estado local de la página a la tabla
 * compartida, sin necesidad de un store Pinia (patrón "thin adapter" descrito
 * en listing/types.ts). El listado de anagrafiche solo usa el modo paginado,
 * así que loadMore es un no-op.
 */
const listSource = reactive<ListSource<IdRow>>({
  get total() { return total.value; },
  get rows() { return rows.value as unknown as IdRow[]; },
  get loading() { return loading.value; },
  get error() { return error.value; },
  get page() { return page.value; },
  get perPage() { return perPage.value; },
  get sort() { return sort.value; },
  get sortDir() { return sortDir.value; },
  async loadPage(p: number) { page.value = p; await fetchList(false); },
  async loadMore() {
    // Scroll infinito: pedir la siguiente página y acumular. Guardas: no
    // recargar si ya está cargando o si ya tenemos todas las filas.
    if (loading.value || rows.value.length >= total.value) return;
    page.value += 1;
    await fetchList(true);
  },
  async refresh() { page.value = 1; await fetchList(false); },
  setSort(s: string, dir: 'ASC' | 'DESC') { sort.value = s; sortDir.value = dir; },
  setPerPage(n: number) { perPage.value = n; },
}) as ListSource<IdRow>;

function reload(): void {
  void listSource.refresh();
}

const debouncedReload = useDebouncedCallback(() => {
  void listSource.refresh();
}, 350);

function onSearchChange(): void {
  debouncedReload();
}
// Los selects de filtro deben resetear a página 1 (bug previo: no lo hacían y
// podías quedar en una página vacía tras filtrar).
function onFilterChange(): void {
  void listSource.refresh();
}

// ── Panel avanzado: aplicar / limpiar / catálogos ──────────────────────────

/** Vuelca el borrador a los filtros aplicados y recarga desde la página 1. */
function applyAdvanced(): void {
  for (const f of ADV_FIELDS) {
    const v = draft[f];
    advanced[f] = typeof v === 'string' && v.trim() !== '' ? v.trim() : (v ?? null);
  }
  void listSource.refresh();
}

/** Limpia SOLO los avanzados; los de la barra rápida se mantienen. */
function resetAdvanced(): void {
  for (const f of ADV_FIELDS) {
    draft[f] = null;
    advanced[f] = null;
  }
  void listSource.refresh();
}

/**
 * Catálogos remotos del panel. Se piden una sola vez, la primera vez que se
 * abre el panel. Los fallos degradan a lista vacía: un catálogo caído no debe
 * impedir usar el resto de filtros.
 */
let optionsLoaded = false;
async function loadAdvancedOptions(): Promise<void> {
  if (optionsLoaded) return;
  optionsLoaded = true;
  optionsLoading.value = true;
  try {
    const [methods, schedules, currencies] = await Promise.all([
      paymentsService.paymentMethods().catch(() => []),
      paymentsService.paymentSchedules().catch(() => []),
      currenciesService.list().catch(() => []),
    ]);
    remoteOptions.id_pagam_met = methods.map((m) => ({
      title: m.descr ?? `#${m.id}`,
      value: String(m.id),
    }));
    remoteOptions.id_pagam_scad = schedules.map((s) => ({
      title: s.label ?? s.descr ?? `#${s.id}`,
      value: String(s.id),
    }));
    remoteOptions.valuta_sigla = currencies
      .map((c) => {
        const sigla = String((c as Record<string, unknown>).sigla ?? '').trim();
        return { title: sigla, value: sigla };
      })
      .filter((o) => o.value !== '');
  } finally {
    optionsLoading.value = false;
  }
}

watch(advancedOpen, (open) => {
  if (open) void loadAdvancedOptions();
});

// ── Click-to-filter ────────────────────────────────────────────────────────
// Al clicar un valor en una celda se aplica como filtro de esa columna y se
// recarga vía AJAX (refresh resetea a página 1). El `field` mapea al ref local
// que ya alimenta fetchList; así el filtro clicado y el del panel comparten
// estado (misma clave → mismo chip → misma limpieza).
type FilterField = 'id' | 'search' | 'tipo' | 'bloccato' | 'vies_check' | 'id_anagr_titolare';

const FILTER_REFS: Record<FilterField, { get: () => string | null; set: (v: string | null) => void }> = {
  id: { get: () => filterId.value, set: (v) => { filterId.value = v; } },
  search: { get: () => searchInput.value, set: (v) => { searchInput.value = v ?? ''; } },
  tipo: { get: () => filterTipo.value, set: (v) => { filterTipo.value = v; } },
  bloccato: { get: () => filterBloccato.value, set: (v) => { filterBloccato.value = v; } },
  vies_check: { get: () => filterVies.value, set: (v) => { filterVies.value = v; } },
  id_anagr_titolare: {
    get: () => (filterTitolare.value ? String(filterTitolare.value) : null),
    set: (v) => { filterTitolare.value = v ? parseInt(v, 10) : null; },
  },
};

// Etiqueta del chip (grupo) por campo.
const FILTER_GROUP_KEY: Record<FilterField, string> = {
  id: 'anagrafiche.col_id',
  search: 'anagrafiche.col_rag_soc',
  tipo: 'anagrafiche.col_tipo',
  bloccato: 'anagrafiche.col_bloccato',
  vies_check: 'anagrafiche.col_vies',
  id_anagr_titolare: 'anagrafiche.filter_titolare',
};

function setFilter(field: FilterField, value: string): void {
  // En modo bloqueado `tipo` no es negociable — ver `lockedTipo` arriba.
  // Ignorar en vez de aplicar y no reflejarlo evita el efecto confuso de
  // "el chip cambia pero la lista no" (el backend lo ignora de todos modos).
  if (lockedTipo && field === 'tipo') return;
  const v = (value ?? '').trim();
  if (!v) return;
  FILTER_REFS[field].set(v);
  void listSource.refresh();
}

// Etiqueta legible del valor de un filtro para mostrar en el chip.
function filterValueLabel(field: FilterField, value: string): string {
  if (field === 'tipo') return (t(`anagrafiche.type.${value === 'F' ? 'F_generic' : value}`) as string) || value;
  if (field === 'bloccato') return value === 'S' ? (t('common.yes') as string) : (t('common.no') as string);
  if (field === 'vies_check') {
    const map: Record<string, string> = {
      OK: t('anagrafiche.vies.ok') as string,
      KO: t('anagrafiche.vies.ko') as string,
      NN: t('anagrafiche.vies.na') as string,
    };
    return map[value] ?? value;
  }
  return value;
}

// Definición (etiqueta + control) de cada campo avanzado, indexada por campo.
// Sirve para etiquetar sus chips sin repetir el mapa de grupos.
const ADV_DEF_BY_FIELD = computed<Record<string, AdvFieldDef>>(() => {
  const out: Record<string, AdvFieldDef> = {};
  for (const g of advancedGroups) {
    for (const f of g.fields) out[f.field] = f;
  }
  return out;
});

/** Etiqueta legible del valor de un filtro avanzado (usa su catálogo). */
function advValueLabel(field: AdvField, value: string): string {
  const def = ADV_DEF_BY_FIELD.value[field];
  if (def && def.kind === 'select') {
    const opt = (optionItems.value[field] || []).find((o) => o.value === value);
    if (opt) return opt.title;
  }
  return value;
}

const activeFilters = computed<ActiveFilter[]>(() => {
  const out: ActiveFilter[] = [];
  for (const field of Object.keys(FILTER_REFS) as FilterField[]) {
    // `tipo` no se muestra como chip removible en modo bloqueado: no es un
    // filtro que el operador aplicó, es el alcance fijo de esta vista.
    if (lockedTipo && field === 'tipo') continue;
    const value = FILTER_REFS[field].get();
    if (typeof value === 'string' && value !== '') {
      out.push({
        field,
        group: t(FILTER_GROUP_KEY[field]) as string,
        value: filterValueLabel(field, value),
      });
    }
  }
  // Chips de los filtros avanzados aplicados. Se prefijan con `adv:` para que
  // removeFilter distinga el origen (los nombres no colisionan con los de la
  // barra rápida, pero el prefijo lo hace explícito).
  for (const field of ADV_FIELDS) {
    const value = advanced[field];
    if (typeof value === 'string' && value !== '') {
      const def = ADV_DEF_BY_FIELD.value[field];
      out.push({
        field: `adv:${field}`,
        group: def ? (t(def.labelKey) as string) : field,
        value: advValueLabel(field, value),
        iso: field === 'id_paese_iso' ? value : undefined,
      });
    }
  }
  return out;
});

function removeFilter(field: string): void {
  if (lockedTipo && field === 'tipo') return;
  if (field.startsWith('adv:')) {
    const advField = field.slice(4) as AdvField;
    if (!ADV_FIELDS.includes(advField)) return;
    advanced[advField] = null;
    draft[advField] = null;
    void listSource.refresh();
    return;
  }
  const ref = FILTER_REFS[field as FilterField];
  if (!ref) return;
  ref.set(field === 'search' ? '' : null);
  void listSource.refresh();
}

function clearAllFilters(): void {
  for (const field of Object.keys(FILTER_REFS) as FilterField[]) {
    if (lockedTipo && field === 'tipo') continue;
    FILTER_REFS[field].set(field === 'search' ? '' : null);
  }
  for (const field of ADV_FIELDS) {
    advanced[field] = null;
    draft[field] = null;
  }
  void listSource.refresh();
}

function goCreate(): void {
  router.push({ name: 'anagrafica-create' });
}
function goDetail(row: AnagraficaRow): void {
  router.push({ name: 'anagrafica-detail', params: { id: String(row.id) } });
}
// Abre el detalle directamente en una pestaña concreta (facturación, listini…).
function goDetailTab(row: AnagraficaRow, tab: string): void {
  router.push({ name: 'anagrafica-detail-tab', params: { id: String(row.id), tab } });
}

async function confirmDelete(row: AnagraficaRow): Promise<void> {
  const ok = await confirm.ask({
    title: t('anagrafiche.delete_title') as string,
    message: t('anagrafiche.delete_message', { name: row.rag_soc || `#${row.id}` }) as string,
    variant: 'danger',
    confirmLabel: t('common.delete') as string,
  });
  if (!ok) return;
  try {
    await anagraficaService.remove(row.id);
    toast.success(t('anagrafiche.deleted'));
    reload();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('HAS_ACTIVE_SHIPMENTS')) {
      toast.error(t('anagrafiche.delete_blocked_active_shipments'));
    } else {
      toast.error(msg || (t('common.error') as string));
    }
  }
}

// --- Clonación de anagrafica -------------------------------------------------

const cloneOpen = ref(false);
const cloneSource = ref<AnagraficaRow | null>(null);

function openClone(row: AnagraficaRow): void {
  cloneSource.value = row;
  cloneOpen.value = true;
}

// El modal se deja ABIERTO tras clonar: muestra el reporte con las credenciales
// generadas, que es justo lo que hay que anotar antes de cerrarlo.
function onCloned(newId: number): void {
  toast.success(t('anagrafiche.clone.success', { id: newId }));
  reload();
}

// KeepAlive (ver OperationsShell.vue KEEP_ALIVE_INCLUDE, mismo patrón que
// CargoListPage/ShipmentListPage/CrmListPage): volver de un detalle ya no
// remonta la página, reactiva la instancia existente — `hasMountedOnce`
// evita que `onActivated` repita la carga en la activación inicial (Vue la
// dispara también justo después de `mounted`, la primera vez que un
// componente entra en un KeepAlive). A diferencia de CRM, el estado de la
// lista (filtros/página/filas) es local al componente, no un store Pinia:
// KeepAlive ya lo preserva solo; `onActivated` solo refresca los datos por
// si algo cambió en el detalle (ej. se editó un cliente).
let hasMountedOnce = false;

onMounted(() => {
  hasMountedOnce = true;
  void fetchList(false);
});

onActivated(() => {
  if (!hasMountedOnce) return;
  void fetchList(false);
});
</script>

<style scoped>
.cm-type-tabs {
  margin-bottom: var(--cm-space-sm, 8px);
}
.cm-filters {
  display: flex;
  align-items: center;
  gap: var(--cm-space-md);
  margin-bottom: var(--cm-space-md);
  flex-wrap: wrap;
}
.cm-filter-search {
  min-width: 240px;
  max-width: 380px;
  flex: 1 1 auto;
}
.cm-filter-narrow {
  max-width: 180px;
}
.cm-filter-id {
  max-width: 120px;
  flex: 0 0 auto;
}
/* Panel de filtros avanzados (paridad buscador legacy). Rejilla fluida: los
   campos se reparten en columnas de ~200px y bajan de fila solos, así que
   funciona igual en un portátil que en un monitor ancho. */
.cm-adv {
  padding: var(--cm-space-md);
  margin-bottom: var(--cm-space-md);
  background: rgba(var(--v-theme-surface), 1);
}
.cm-adv-group + .cm-adv-group {
  margin-top: var(--cm-space-md);
  padding-top: var(--cm-space-md);
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.cm-adv-title {
  margin-bottom: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--cm-text-muted);
}
.cm-adv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--cm-space-sm) var(--cm-space-md);
}
.cm-adv-field {
  min-width: 0;
}
.cm-adv-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--cm-space-sm);
  margin-top: var(--cm-space-md);
  padding-top: var(--cm-space-md);
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
/* Completa la cadena flex entre `.dsh-main` (DashboardShell, ya
   flex-column + min-height:0, ver DashboardShell.vue) y `.sdv-card`
   (ListingDataView, flex:1 1 auto + min-height:0): esta página es el hijo
   directo de `.dsh-main` a través de <RouterView>, así que sin estas dos
   reglas la cadena se rompe aquí y `.sdv-card` vuelve a crecer con su
   contenido en vez de heredar el alto real disponible — exactamente lo que
   causaba el corte sin scroll externo que reemplaza este bloque (antes
   `.cm-listing-viewport { height: calc(100vh - 260px) }`, un offset a ojo
   que no coincidía con el chrome real y no dejaba nada por donde
   scrollear). No fijar ninguna altura aquí: DashboardShell ya la da. */
.cm-anagrafiche-page {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.cm-anagrafiche-list-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
/* Valor clicable-para-filtrar: se lee como texto normal de la celda y solo al
   hover/focus revela que es accionable (tinte primary + halo). Mismo patrón que
   el listado de cargo. Todo con tokens --v-theme-* → adapta a claro/oscuro. */
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
.cm-name-cell {
  max-width: 260px;
  font-weight: 500;
}
.cm-bloccato-btn {
  line-height: 1;
}
.cm-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
.cm-row-edit {
  text-transform: none;
  letter-spacing: normal;
}
.cm-text-muted {
  color: var(--cm-text-muted);
}
.cm-id-cell {
  font-variant-numeric: tabular-nums;
  color: var(--cm-text-muted);
}
</style>
