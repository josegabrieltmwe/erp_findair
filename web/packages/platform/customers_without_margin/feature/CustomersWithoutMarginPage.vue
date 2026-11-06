<template>
  <div>
    <CmSectionHeader :title="t('margins_missing.title')" :subtitle="t('margins_missing.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="cwm-toolbar">
        <v-btn-toggle
          v-model="tipo"
          mandatory
          density="compact"
          variant="outlined"
          divided
          color="primary"
          :aria-label="t('margins_missing.tipo')"
        >
          <v-btn v-for="it in tipoItems" :key="it.value" :value="it.value" :prepend-icon="it.icon" size="small">
            {{ it.title }}
          </v-btn>
        </v-btn-toggle>
        <v-text-field
          v-model="search"
          :label="t('margins_missing.search')"
          :prepend-inner-icon="mdiMagnify"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="cwm-search"
        />
        <v-spacer />
        <v-btn variant="tonal" :prepend-icon="mdiRefresh" :loading="loading" @click="load">
          {{ t('margins_missing.refresh') }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      loading-type="skeleton"
      :skeleton-rows="8"
      :skeleton-cols="isTmwe ? 5 : 4"
      retryable
      @retry="load"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiCheckCircleOutline" :title="t('margins_missing.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="cm-table-zebra">
            <thead>
              <tr>
                <th>{{ t('margins_missing.col.client') }}</th>
                <th v-if="isTmwe">{{ t('margins_missing.col.titolare') }}</th>
                <th style="width: 120px">{{ t('margins_missing.col.alta') }}</th>
                <th class="text-end" style="width: 150px" :title="t('margins_missing.col.shipments_hint')">
                  {{ t('margins_missing.col.shipments') }}
                </th>
                <th class="text-end" style="width: 190px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td>
                  <router-link :to="{ name: 'anagrafica-detail', params: { id: String(row.id) } }" class="cwm-client">
                    {{ row.ragione_sociale || '—' }}
                  </router-link>
                  <span class="text-caption text-medium-emphasis ms-2">#{{ row.id }}</span>
                </td>
                <td v-if="isTmwe">{{ row.titolare || '—' }}</td>
                <td>{{ formatDate(row.alta) }}</td>
                <td class="text-end">{{ row.cargo_shipments_12m }}</td>
                <td class="text-end">
                  <v-btn
                    size="small"
                    variant="tonal"
                    color="primary"
                    :prepend-icon="mdiTuneVariant"
                    :to="marginConfigRoute(row.id, tipo)"
                  >
                    {{ t('margins_missing.configure') }}
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center pa-2">
            <span class="text-caption">{{ t('margins_missing.total', { n: total }) }}</span>
            <v-spacer />
            <v-pagination
              v-if="pages > 1"
              v-model="page"
              :length="pages"
              :total-visible="7"
              density="compact"
            />
          </div>
        </v-card>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
/**
 * «Clientes sin margen»: clientes activos sin escalones del tipo elegido ni pactos por aerolínea.
 *
 * Sin margen, la búsqueda de vuelos de cargo devuelve tarifas a coste y no seleccionables; esta lista deja
 * arreglarlo antes, empezando por quien más expide (orden del API: expediciones cargo de los últimos 12 meses).
 * «Configurar margen» abre la pestaña de márgenes de la ficha del cliente en el tipo elegido.
 *
 * Permisos (solo UX; el API manda): ruta `requiresAdmin` + `SETTINGS_ROUTE_SCOPES` (`margins:read`, módulo
 * `margenes_clientes`). TMWE ve todos los clientes y la columna de titular; un partner solo los suyos.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiAirplane,
  mdiCheckCircleOutline,
  mdiFerry,
  mdiMagnify,
  mdiRefresh,
  mdiTruckFast,
  mdiTuneVariant,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { ApiError } from '../../anagrafiche/services/api.types';
import { useProfile } from '../../composables/useProfile';
import {
  customersWithoutMarginService,
  marginConfigRoute,
  pageCount,
  DEFAULT_PER_PAGE,
  type CustomerWithoutMargin,
  type MarginTipo,
} from '../services/customersWithoutMargin.service';

const { t, locale } = useI18n();
const { isAdmin, ensureProfile } = useProfile();

/** Columna de titular: solo TMWE ve clientes de varios partners. */
const isTmwe = computed(() => isAdmin.value === true);

const tipoItems = computed(() => [
  { value: 'A' as MarginTipo, title: t('margins_missing.tipo_a'), icon: mdiAirplane },
  { value: 'E' as MarginTipo, title: t('margins_missing.tipo_e'), icon: mdiTruckFast },
  { value: 'S' as MarginTipo, title: t('margins_missing.tipo_s'), icon: mdiFerry },
]);

const tipo = ref<MarginTipo>('A');
const search = ref<string>('');
const page = ref(1);
const perPage = DEFAULT_PER_PAGE;

const rows = ref<CustomerWithoutMargin[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);
const pages = computed(() => pageCount(total.value, perPage));

/** Respuestas fuera de orden (búsqueda tecleada rápido): solo vale la última. */
let seq = 0;

async function load(): Promise<void> {
  const mine = ++seq;
  loading.value = true;
  error.value = null;
  try {
    const res = await customersWithoutMarginService.list({
      tipo: tipo.value,
      q: search.value ?? '',
      page: page.value,
      perPage,
    });
    if (mine !== seq) return;
    rows.value = res.items;
    total.value = res.total;
  } catch (e) {
    if (mine !== seq) return;
    // Ante un fallo nunca se pinta «todos tienen margen».
    rows.value = [];
    total.value = 0;
    error.value =
      e instanceof ApiError && e.status === 403
        ? t('margins_missing.error_forbidden')
        : e instanceof Error && e.message
          ? e.message
          : t('margins_missing.error');
  } finally {
    if (mine === seq) loading.value = false;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale.value);
}

/** Cambiar tipo o búsqueda vuelve a la primera página; si ya estaba en ella, recarga directamente. */
function resetAndLoad(): void {
  if (page.value !== 1) page.value = 1;
  else void load();
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(resetAndLoad, 300);
});
watch(tipo, resetAndLoad);
watch(page, () => void load());

onMounted(() => {
  void ensureProfile();
  void load();
});
</script>

<style scoped>
.cwm-toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}
.cwm-search {
  max-width: 320px;
  min-width: 220px;
}
.cwm-client {
  font-weight: 600;
  text-decoration: none;
  color: inherit;
}
.cwm-client:hover {
  text-decoration: underline;
}
</style>
