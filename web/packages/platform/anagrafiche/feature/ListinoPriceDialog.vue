<template>
  <v-dialog :model-value="modelValue" max-width="1100" scrollable @update:model-value="onClose">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon :icon="mdiTableLarge" class="mr-2" />
        <span>{{ t('anagrafiche.listini.matrix_title') }}</span>
        <v-chip v-if="listinoNome" size="small" class="ml-2" variant="tonal" color="primary">{{ listinoNome }}</v-chip>
        <v-spacer />
        <!-- selector de pack (variante) si hay más de uno -->
        <v-select
          v-if="packs.length > 1"
          v-model="packId"
          :items="packItems"
          item-title="title"
          item-value="value"
          :label="t('anagrafiche.listini.pack_variant')"
          density="compact" variant="outlined" hide-details
          class="mr-2" style="max-width: 200px;"
          @update:model-value="loadMatrix"
        />
        <v-btn :icon="mdiClose" variant="text" size="small" @click="onClose" />
      </v-card-title>

      <div v-if="loading" class="py-10 text-center"><v-progress-circular indeterminate /></div>

      <template v-else-if="!pivot.rows.length && !supplements.length">
        <v-card-text>
          <v-alert type="info" variant="tonal" density="compact">{{ t('anagrafiche.listini.no_prices') }}</v-alert>
        </v-card-text>
      </template>

      <template v-else>
        <!-- ── Tabs ── -->
        <v-tabs v-model="tab" color="primary" density="comfortable" class="px-4">
          <v-tab value="tariffa">
            <v-icon :icon="mdiTableLarge" start size="18" />{{ t('anagrafiche.listini.tab_tariff') }}
          </v-tab>
          <v-tab v-if="extPrices.length" value="extra">
            <v-icon :icon="mdiPlusBoxOutline" start size="18" />{{ t('anagrafiche.listini.extra_weight_title') }}
          </v-tab>
          <v-tab v-if="supplements.length" value="suppl">
            <v-icon :icon="mdiCurrencyEur" start size="18" />{{ t('anagrafiche.listini.tab_suppl') }}
            <span class="ml-1 text-medium-emphasis">({{ filteredSupplements.length }}/{{ supplements.length }})</span>
          </v-tab>
          <!-- Calculadora al final: es una herramienta puntual, no datos del
               listino; los tabs de contenido van primero. -->
          <v-tab v-if="canPreview" value="calc">
            <v-icon :icon="mdiCalculatorVariantOutline" start size="18" />{{ t('anagrafiche.listini.tab_calc') }}
          </v-tab>
        </v-tabs>

        <!-- Metadatos del listino: barra fija bajo las tabs (siempre visible). -->
        <div v-if="meta" class="cm-meta-bar px-4 py-2">
          <div class="cm-meta-chips">
            <v-chip v-if="meta.servizio_nome" size="small" variant="tonal" :prepend-icon="mdiTableLarge">
              {{ meta.servizio_nome }}
            </v-chip>
            <v-chip size="small" variant="outlined">{{ t('anagrafiche.listini.meta_currency') }}: {{ currency }}</v-chip>
            <v-chip size="small" variant="outlined">
              {{ t('anagrafiche.listini.meta_unit') }}: {{ meta.metric_imperial === 'I' ? 'lb' : 'kg' }}
            </v-chip>
            <v-chip v-if="packLabel" size="small" variant="outlined">
              {{ t('anagrafiche.listini.meta_pack') }}: {{ packLabel }}
            </v-chip>
            <v-chip v-if="Number(meta.maggiorazione)" size="small" variant="tonal" color="warning">
              {{ t('anagrafiche.listini.meta_markup') }}: {{ Number(meta.maggiorazione).toFixed(2) }} {{ currency }}
              <span v-if="meta.listino_magg_nome" class="ml-1">· {{ meta.listino_magg_nome }}</span>
            </v-chip>
            <v-tooltip v-if="meta.note" :text="meta.note" location="bottom" max-width="400">
              <template #activator="{ props: tp }">
                <v-chip v-bind="tp" size="small" variant="text" :prepend-icon="mdiInformationOutline">
                  {{ t('anagrafiche.listini.meta_note') }}
                </v-chip>
              </template>
            </v-tooltip>
          </div>
        </div>

        <!-- Versiones temporales del listino (paridad legacy listy_show). -->
        <div v-if="hasVersions" class="cm-versions-bar px-4 py-2">
          <span class="cm-versions-label">{{ t('anagrafiche.listini.versions_title') }}:</span>
          <v-chip
            v-for="v in visibleVersions"
            :key="v.data_start + v.data_stop"
            size="small"
            :color="versionColor(v.estado)"
            :variant="isActiveVersion(v) ? 'flat' : 'tonal'"
            class="cm-version-chip"
            @click="selectVersion(v)"
          >
            <strong class="mr-1">{{ t('anagrafiche.listini.version_' + v.estado) }}</strong>
            {{ fmtVersionDate(v.data_start) }} — {{ fmtVersionDate(v.data_stop) }}
          </v-chip>
          <v-btn
            v-if="expiredCount && !showExpiredVersions"
            size="x-small" variant="text" :prepend-icon="mdiHistory"
            @click="showExpiredVersions = true"
          >
            {{ t('anagrafiche.listini.show_expired', { n: expiredCount }) }}
          </v-btn>
        </div>

        <v-card-text style="max-height: 60vh;">
          <v-window v-model="tab">
            <!-- ── TAB Tariffa: matriz peso×zona (o tipo-pallet×zona si bancale) ── -->
            <v-window-item value="tariffa">

              <!-- BANCALE: matriz tipo de pallet × zona -->
              <template v-if="bancaleMatrix">
                <div class="cm-matrix-legend mb-2">
                  <span><v-icon :icon="mdiPackageVariantClosed" size="14" class="mr-1" />{{ t('anagrafiche.listini.legend_pallet') }}</span>
                  <span><v-icon :icon="mdiMapMarkerDistance" size="14" class="mr-1" />{{ t('anagrafiche.listini.legend_cols') }}</span>
                  <span><v-icon :icon="mdiCurrencyEur" size="14" class="mr-1" />{{ t('anagrafiche.listini.legend_cell_pallet') }}</span>
                </div>
                <div class="cm-matrix-scroll">
                  <v-table density="compact" class="cm-price-matrix cm-table-zebra" fixed-header>
                    <thead>
                      <tr>
                        <th class="cm-corner">{{ t('anagrafiche.listini.pallet_type') }}</th>
                        <th v-for="z in bancaleMatrix.zones" :key="z" class="text-right">
                          <div class="cm-zone-name">{{ zoneName(z) }}</div>
                          <div v-if="zoneName(z) !== z" class="cm-zone-code">{{ t('anagrafiche.listini.zone') }} {{ z }}</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="tp in bancaleMatrix.types" :key="tp.id">
                        <td class="font-weight-medium cm-rowhead">
                          {{ tp.nome }}
                          <div v-if="tp.dims" class="cm-zone-code">{{ tp.dims }}</div>
                        </td>
                        <td v-for="z in bancaleMatrix.zones" :key="z" class="text-right">
                          {{ bancaleCell(tp.id, z) }}
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </template>

              <!-- POR PESO: matriz peso × zona (o km si zone_dist_km='S') -->
              <template v-else>
                <!-- Barra compacta: leyenda a la izquierda + filtro de peso a la
                     derecha. Antes la leyenda ocupaba 3 líneas fijas que se
                     entienden a la primera y luego solo restaban altura útil. -->
                <div class="cm-matrix-bar mb-2">
                  <span class="cm-matrix-legend-inline">
                    <v-icon :icon="mdiWeight" size="14" class="mr-1" />{{ t('anagrafiche.listini.legend_rows') }}
                    <span class="mx-2">·</span>
                    <v-icon :icon="mdiMapMarkerDistance" size="14" class="mr-1" />{{ isKm ? t('anagrafiche.listini.legend_km') : t('anagrafiche.listini.legend_cols') }}
                    <span class="mx-2">·</span>
                    <v-icon :icon="mdiCurrencyEur" size="14" class="mr-1" />{{ t('anagrafiche.listini.legend_cells') }}
                  </span>
                  <v-spacer />
                  <div class="cm-weight-filter">
                    <v-text-field
                      v-model="weightFrom"
                      :label="t('anagrafiche.listini.w_from')"
                      type="number"
                      min="0"
                      density="compact"
                      variant="outlined"
                      hide-details
                      clearable
                    />
                    <v-text-field
                      v-model="weightTo"
                      :label="t('anagrafiche.listini.w_to')"
                      type="number"
                      min="0"
                      density="compact"
                      variant="outlined"
                      hide-details
                      clearable
                    />
                    <span class="cm-weight-count">
                      {{ pivot.weights.length }} / {{ pivot.totalWeights }}
                    </span>
                  </div>
                </div>

                <!-- Nota: multiplicación por kg + leyenda de sub-valores de celda -->
                <div v-if="multiplierNote || hasExtraCols" class="cm-matrix-note mb-2">
                  <span v-if="multiplierNote"><v-icon :icon="mdiInformationOutline" size="13" class="mr-1" />{{ multiplierNote }}</span>
                  <span v-if="hasExtraCols">{{ t('anagrafiche.listini.note_extras') }}</span>
                </div>

                <div class="cm-matrix-scroll">
                  <v-table density="compact" class="cm-price-matrix cm-table-zebra" fixed-header>
                    <thead>
                      <!-- Cabecera DOBLE, como el legacy (listy_show_list.php:245-270):
                           fila 1 = zona de destino, fila 2 = unidad del valor
                           ("EUR/kg"). Separar el "qué" del "en qué unidad" evita
                           tener que deducirlo de la leyenda. -->
                      <tr>
                        <th class="text-right cm-corner" rowspan="2">
                          {{ t('anagrafiche.listini.weight_kg') }}
                          <span class="cm-axis-hint">↓</span>
                        </th>
                        <th
                          v-for="z in pivot.zones"
                          :key="z"
                          class="text-right cm-zone-th"
                        >
                          <div class="cm-zone-name">{{ isKm ? z : zoneName(z) }}</div>
                          <!-- Subtítulo con el código SOLO si hay nombre real en BD
                               (`nota_zona`). Sin él, zoneName() ya devuelve
                               "Zona <n>" y repetirlo daba "Zona 1 / Zona 1". -->
                          <div v-if="!isKm && hasZoneLabel(z)" class="cm-zone-code">{{ t('anagrafiche.listini.zone') }} {{ z }}</div>
                        </th>
                      </tr>
                      <tr class="cm-unit-row">
                        <th v-for="z in pivot.zones" :key="'u' + z" class="text-right cm-unit-th">
                          {{ unitLabel }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="peso in pivot.weights" :key="peso">
                        <td class="text-right font-weight-medium cm-rowhead">{{ fmtWeight(peso) }}</td>
                        <td v-for="z in pivot.zones" :key="z" class="text-right">
                          {{ pivot.cell(peso, z) }}
                          <div v-for="ex in pivot.extras(peso, z)" :key="ex" class="cm-cell-extra">{{ ex }}</div>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </template>

            </v-window-item>

            <!-- ── TAB Peso extra: tarifa por unidad que excede el último tramo ── -->
            <v-window-item v-if="extPrices.length" value="extra">
              <p class="cm-matrix-legend-inline mb-2">
                <v-icon :icon="mdiInformationOutline" size="14" class="mr-1" />
                {{ t('anagrafiche.listini.extra_weight_hint') }}
              </p>
              <div class="cm-matrix-scroll cm-fit">
                <v-table density="compact" class="cm-table-zebra cm-fit-table" fixed-header>
                  <thead>
                    <tr>
                      <th>{{ t('anagrafiche.listini.zone') }}</th>
                      <th class="text-right">{{ t('anagrafiche.listini.extra_per_unit') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="ex in extPrices" :key="String(ex.zona) + ex.peso_max">
                      <td>{{ zoneName(String(ex.zona)) }}</td>
                      <td class="text-right cm-num">{{ Number(ex.prezzo).toFixed(2) }} {{ currency }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
            </v-window-item>

            <!-- ── TAB Calcolatore: precio del cliente a un peso ── -->
            <v-window-item v-if="canPreview" value="calc">
              <v-sheet border rounded class="cm-preview-box pa-3">
                <div class="d-flex align-center flex-wrap" style="gap: 12px;">
                  <v-icon :icon="mdiCalculatorVariantOutline" color="primary" />
                  <span class="font-weight-medium">{{ t('anagrafiche.listini.preview_title') }}</span>

                  <!-- Listino BANCALE: selector de tipo de pallet + cantidad -->
                  <template v-if="isBancale">
                    <v-select
                      v-model="bancaleTypeId"
                      :items="bancaleTypes"
                      item-title="name"
                      item-value="id"
                      :label="t('anagrafiche.listini.pallet_type')"
                      density="compact" variant="outlined" hide-details
                      style="max-width: 220px;"
                    />
                    <v-text-field
                      v-model.number="bancaleQty"
                      type="number" min="1" step="1"
                      :label="t('anagrafiche.listini.pallet_qty')"
                      density="compact" variant="outlined" hide-details
                      style="max-width: 110px;"
                      @keyup.enter="runPreview"
                    />
                  </template>

                  <!-- Listino por PESO: campo kg -->
                  <v-text-field
                    v-else
                    v-model.number="previewWeight"
                    type="number" min="0" step="1"
                    :label="t('anagrafiche.listini.weight_kg')"
                    density="compact" variant="outlined" hide-details
                    style="max-width: 160px;"
                    @keyup.enter="runPreview"
                  />

                  <v-btn color="primary" :loading="previewLoading" :prepend-icon="mdiCalculatorVariantOutline" @click="runPreview">
                    {{ t('anagrafiche.listini.preview_calc') }}
                  </v-btn>
                  <v-switch
                    v-if="!isBancale"
                    v-model="withSupplements"
                    color="primary" density="compact" hide-details
                    :label="t('anagrafiche.listini.preview_with_suppl')"
                    @update:model-value="previewRows.length && runPreview()"
                  />
                </div>
                <div v-if="isBancale && selectedBancaleType" class="text-caption text-medium-emphasis mt-1">
                  {{ selectedBancaleType.max_base }} · {{ selectedBancaleType.max_height }} · {{ selectedBancaleType.max_weight }}
                </div>
                <div v-if="previewRows.length" class="text-caption text-medium-emphasis mt-1">
                  {{ t('anagrafiche.listini.preview_hint', { fuel: previewRows[0].fuel_perc }) }}
                </div>

                <v-table v-if="previewRows.length" density="compact" class="cm-price-matrix cm-table-zebra cm-narrow-table mt-2">
                  <thead>
                    <tr>
                      <th class="text-right">{{ t('anagrafiche.listini.zone') }}</th>
                      <th class="text-right">{{ t('anagrafiche.listini.preview_base') }}</th>
                      <th v-if="previewHasSuppl" class="text-right">{{ t('anagrafiche.listini.preview_suppl') }}</th>
                      <th class="text-right">{{ t('anagrafiche.listini.preview_fuel') }}</th>
                      <th class="text-right cm-total-col">{{ t('anagrafiche.listini.preview_total') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in previewRows" :key="r.zona">
                      <td class="text-right">{{ zoneName(r.zona) }}</td>
                      <template v-if="r.error">
                        <td :colspan="previewHasSuppl ? 4 : 3" class="text-medium-emphasis text-caption">{{ t('anagrafiche.listini.preview_no_price') }}</td>
                      </template>
                      <template v-else>
                        <td class="text-right">{{ r.base.toFixed(2) }}<span v-if="r.extra" class="cm-extra-tag"> +{{ r.extra.toFixed(2) }}</span></td>
                        <td v-if="previewHasSuppl" class="text-right">{{ Number(r.suppl).toFixed(2) }}</td>
                        <td class="text-right">{{ r.fuel.toFixed(2) }}</td>
                        <td class="text-right cm-total-col font-weight-bold">{{ r.total.toFixed(2) }} {{ currency }}</td>
                      </template>
                    </tr>
                  </tbody>
                </v-table>

                <!-- Aviso de exclusión: suplementos por-destino no entran en el preview -->
                <div v-if="previewRows.length && !isBancale" class="text-caption text-medium-emphasis mt-2">
                  <v-icon :icon="mdiInformationOutline" size="13" class="mr-1" />{{ t('anagrafiche.listini.preview_suppl_note') }}
                </div>
                <v-alert v-else type="info" variant="tonal" density="compact" class="mt-3">
                  {{ t('anagrafiche.listini.preview_prompt') }}
                </v-alert>
              </v-sheet>
            </v-window-item>

            <!-- ── TAB Supplementi: buscador + filtro "solo con coste" ── -->
            <v-window-item v-if="supplements.length" value="suppl">
              <div class="d-flex align-center flex-wrap mb-2" style="gap: 12px;">
                <v-text-field
                  v-model="supplSearch"
                  :prepend-inner-icon="mdiMagnify"
                  :label="t('common.search')"
                  density="compact" variant="outlined" hide-details clearable
                  style="max-width: 280px;"
                />
                <v-switch
                  v-model="supplOnlyWithCost"
                  color="primary" density="compact" hide-details
                  :label="t('anagrafiche.listini.suppl_only_cost')"
                />
                <v-spacer />
                <span class="text-caption text-medium-emphasis">
                  {{ filteredSupplements.length }} / {{ supplements.length }}
                </span>
              </div>

              <!-- Scroll propio (como la matriz) + columnas SEPARADAS por tipo de
                   coste. Antes eran 103 filas seguidas sin scroll, con todo el
                   importe concatenado en una sola celda de texto
                   ("0.37/kg (min 0.90)"): imposible de comparar entre filas. -->
              <div class="cm-matrix-scroll">
                <!-- Sin `cm-price-matrix`: esa clase es para la matriz peso×zona
                     (columnas de 96px). Aquí solo se hereda el estilo global de
                     `.v-table` + zebra del proyecto. -->
                <v-table density="compact" class="cm-table-zebra cm-suppl-table" fixed-header>
                  <!-- Cabeceras ordenables. Reutiliza la clase `sdv-th-sortable`
                       y el icono de flecha de ListingDataView, para que el gesto
                       de ordenar sea el mismo en todo el proyecto. El componente
                       en sí no sirve aquí: exige un `ListSource` con paginación
                       remota y estas 103 filas ya están en memoria. -->
                  <thead>
                    <tr>
                      <th
                        v-for="h in supplHeaders"
                        :key="h.key"
                        :class="h.align === 'end' ? 'text-right' : ''"
                      >
                        <span class="sdv-th-sortable" @click="toggleSupplSort(h.key)">
                          {{ h.title }}
                          <v-icon
                            v-if="supplSort === h.key"
                            :icon="supplSortDir === 'ASC' ? mdiArrowUp : mdiArrowDown"
                            size="13"
                          />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in filteredSupplements" :key="s.id" :class="{ 'cm-suppl-empty': !supplementHasCost(s) }">
                      <td>{{ s.supplemento_nome || ('#' + s.id_supplementi) }}</td>
                      <td class="text-right">
                        <span v-if="supplParts(s).fixed">{{ supplParts(s).fixed }}</span>
                        <span v-else class="cm-text-muted">—</span>
                      </td>
                      <td class="text-right">
                        <span v-if="supplParts(s).variable">{{ supplParts(s).variable }}</span>
                        <span v-else class="cm-text-muted">—</span>
                      </td>
                      <td class="text-right cm-text-muted">
                        {{ supplParts(s).bounds || '—' }}
                      </td>
                    </tr>
                    <tr v-if="!filteredSupplements.length">
                      <td colspan="4" class="text-center text-medium-emphasis py-4">{{ t('anagrafiche.listini.suppl_none') }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
            </v-window-item>

          </v-window>
        </v-card-text>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiClose, mdiTableLarge, mdiWeight, mdiMapMarkerDistance, mdiCurrencyEur, mdiPlusBoxOutline, mdiCalculatorVariantOutline, mdiInformationOutline, mdiMagnify, mdiPackageVariantClosed, mdiHistory, mdiArrowUp, mdiArrowDown } from '@mdi/js';
import {
  listinoPricesService,
  type ListinoPack, type PriceMatrixRow, type ListinoEnriched, type PricePreviewRow, type BancaleType, type ListinoVersion,
} from '../services/listinoPrices.service';
import { useToast } from '../composables/useToast';

const props = defineProps<{
  modelValue: boolean;
  listinoNomeId: number;
  listinoNome?: string;
  idAnagrafica?: number;
  idServizio?: number;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const { t } = useI18n();
const toast = useToast();

const loading = ref(false);
const packs = ref<ListinoPack[]>([]);
const packId = ref<number | null>(null);
const rowsMatrix = ref<PriceMatrixRow[]>([]);
const enriched = ref<ListinoEnriched | null>(null);

/** Nombre descriptivo de una zona (Francia…) o el código si no hay nombre. */
// Filtro de rango de peso para la matriz (ver `pivot`). Vacío = sin filtrar.
const weightFrom = ref<string | number | null>(null);
const weightTo = ref<string | number | null>(null);

/** ¿La zona tiene nombre REAL en BD (`nota_zona`), o solo el genérico? */
function hasZoneLabel(z: string): boolean {
  const n = enriched.value?.zone_names?.[z];
  return !!(n && n.trim() !== '');
}

function zoneName(z: string): string {
  const n = enriched.value?.zone_names?.[z];
  if (n && n.trim() !== '') return n;
  // Sin `nota_zona` en BD (lo normal: la mayoría de servicios no la rellenan),
  // el legacy imprime "Zona <n>" — listy_show_list.php:250. Mostrar el número
  // pelado dejaba cabeceras "1 2 3" que no se entendían como zonas.
  // La zona -1 es la B1 (sud) y el legacy la etiqueta así explícitamente.
  if (z === '-1') return 'B1';
  return `${t('anagrafiche.listini.zone')} ${z}`;
}

const meta = computed(() => enriched.value?.metadata ?? null);
const supplements = computed(() => enriched.value?.supplements ?? []);
const extPrices = computed(() => enriched.value?.ext_prices ?? []);
const currency = computed(() => meta.value?.valuta_sigla || '€');

/**
 * Etiqueta de unidad de la 2ª fila de cabecera: "EUR/kg", "EUR/lb" o "EUR/cad"
 * en listinos por bancale/collo. Paridad legacy `$fsxprz` (listy_show_list.php:258).
 */
const unitLabel = computed(() => {
  const cur = currency.value;
  if (meta.value?.peso_bancale === 'B' || meta.value?.peso_bancale === 'C') {
    return `${cur}/${t('anagrafiche.listini.per_unit_each')}`;
  }
  return `${cur}/${meta.value?.metric_imperial === 'I' ? 'lb' : 'kg'}`;
});


// Matriz bancale (tipo de pallet × zona) — solo en listinos peso_bancale='B'.
const bancaleMatrix = computed(() => enriched.value?.bancale ?? null);

// ── Versiones temporales del listino ──
const selectedVersion = ref<string>(''); // '' = vigente (NOW)
const showExpiredVersions = ref(false);
const allVersions = computed<ListinoVersion[]>(() => enriched.value?.versions ?? []);
const visibleVersions = computed(() =>
  allVersions.value.filter((v) => showExpiredVersions.value || v.estado !== 'scaduto'),
);
const hasVersions = computed(() => allVersions.value.length > 1);
const expiredCount = computed(() => allVersions.value.filter((v) => v.estado === 'scaduto').length);

function versionColor(estado: string): string {
  return estado === 'in_corso' ? 'primary' : estado === 'futuro' ? 'info' : 'error';
}
function fmtVersionDate(s: string): string {
  if (!s || s.startsWith('0000')) return '—';
  const d = s.split(' ')[0].split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : s;
}
function isActiveVersion(v: ListinoVersion): boolean {
  // sin selección → la vigente (in_corso) es la activa
  if (!selectedVersion.value) return v.estado === 'in_corso';
  return selectedVersion.value.startsWith(v.data_start.split(' ')[0]) || selectedVersion.value === v.data_start;
}
async function selectVersion(v: ListinoVersion): Promise<void> {
  // la vigente se pide sin date (NOW); las demás con su data_start
  selectedVersion.value = v.estado === 'in_corso' ? '' : v.data_start;
  await loadMatrix();
}
function bancaleCell(typeId: number, zona: string): string {
  const v = bancaleMatrix.value?.cells?.[String(typeId)]?.[zona];
  return v === undefined || v === null ? '—' : Number(v).toFixed(2);
}

// ── Tabs + filtros de suplementos ──
const tab = ref('tariffa');
const supplSearch = ref('');
const supplOnlyWithCost = ref(true);

/** Un suplemento "tiene coste" si alguno de sus 7 campos de coste es > 0. */
function supplementHasCost(s: Record<string, unknown>): boolean {
  const fields = ['costo_fisso', 'costo_kg', 'costo_collo', 'costo_gg', 'costo_perc', 'costo_min', 'costo_max'];
  return fields.some((f) => Number(s[f]) > 0);
}

// ── Ordenación de la tabla de suplementos (en memoria) ──
// Definición ÚNICA de las columnas: alimenta el <thead> y el mapa de valores
// para ordenar, así no hay que tocar dos sitios al añadir una columna.
const supplHeaders = computed(() => [
  { key: 'nome', title: t('anagrafiche.listini.supplement'), align: 'start' as const },
  { key: 'fixed', title: t('anagrafiche.listini.suppl_fixed'), align: 'end' as const },
  { key: 'variable', title: t('anagrafiche.listini.suppl_variable'), align: 'end' as const },
  { key: 'bounds', title: t('anagrafiche.listini.suppl_minmax'), align: 'end' as const },
]);

const supplSort = ref('nome');
const supplSortDir = ref<'ASC' | 'DESC'>('ASC');

/** Click en cabecera: misma columna alterna sentido; otra columna empieza ASC. */
function toggleSupplSort(key: string): void {
  if (supplSort.value === key) {
    supplSortDir.value = supplSortDir.value === 'ASC' ? 'DESC' : 'ASC';
  } else {
    supplSort.value = key;
    supplSortDir.value = 'ASC';
  }
}

/**
 * Valor por el que se ordena cada columna. Las de importe ordenan por NÚMERO,
 * no por el texto que se muestra: "9.00" y "40.00 EUR" como cadenas se
 * ordenarían al revés de lo que espera el operador.
 */
function supplSortValue(s: Record<string, unknown>, key: string): string | number {
  const num = (v: unknown) => Number(v) || 0;
  if (key === 'fixed') return num(s.costo_fisso);
  if (key === 'variable') {
    // Un suplemento variable puede serlo por kg, collo, día o %: se ordena por
    // el que tenga configurado (solo uno en la práctica).
    return num(s.costo_kg) || num(s.costo_collo) || num(s.costo_gg) || num(s.costo_perc);
  }
  if (key === 'bounds') return num(s.costo_min) || num(s.costo_max);
  return String(s.supplemento_nome ?? '').toLowerCase();
}

const filteredSupplements = computed(() => {
  const q = supplSearch.value.trim().toLowerCase();
  const rows = supplements.value.filter((s) => {
    if (supplOnlyWithCost.value && !supplementHasCost(s)) return false;
    if (q && !String(s.supplemento_nome ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  const dir = supplSortDir.value === 'ASC' ? 1 : -1;
  const key = supplSort.value;
  // Copia antes de ordenar: `.sort()` muta y `supplements` es la fuente cruda.
  return [...rows].sort((a, b) => {
    const va = supplSortValue(a, key);
    const vb = supplSortValue(b, key);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
  });
});

/**
 * Descompone el coste de un suplemento en las 3 columnas de la tabla:
 *   fixed    — importe fijo (costo_fisso)
 *   variable — por unidad: /kg, /collo, /día o %
 *   bounds   — mínimo y máximo aplicables
 * Antes iba todo concatenado en una celda ("0.37/kg (min 0.90)"), lo que
 * impedía comparar importes entre filas de un vistazo.
 */
function supplParts(s: Record<string, unknown>): { fixed: string; variable: string; bounds: string } {
  const num = (v: unknown) => Number(v) || 0;
  const cur = currency.value;

  const fixed = num(s.costo_fisso) ? `${num(s.costo_fisso).toFixed(2)} ${cur}` : '';

  const variable: string[] = [];
  if (num(s.costo_kg)) variable.push(`${num(s.costo_kg).toFixed(2)}/kg`);
  if (num(s.costo_collo)) variable.push(`${num(s.costo_collo).toFixed(2)}/${t('anagrafiche.listini.per_collo')}`);
  if (num(s.costo_gg)) variable.push(`${num(s.costo_gg).toFixed(2)}/${t('anagrafiche.listini.per_day')}`);
  if (num(s.costo_perc)) variable.push(`${num(s.costo_perc).toFixed(2)} %`);

  const bounds: string[] = [];
  if (num(s.costo_min)) bounds.push(`min ${num(s.costo_min).toFixed(2)}`);
  if (num(s.costo_max)) bounds.push(`max ${num(s.costo_max).toFixed(2)}`);

  return { fixed, variable: variable.join(' + '), bounds: bounds.join(' · ') };
}

const packItems = computed(() =>
  packs.value.map((p) => ({ title: p.pack ? `${p.pack}` : `#${p.id}`, value: p.id })),
);

const pivot = computed(() => {
  const zonesSet = new Set<string>();
  const weightsSet = new Set<number>();
  const map = new Map<string, PriceMatrixRow>();
  for (const r of rowsMatrix.value) {
    const z = String(r.zona);
    const w = Number(r.peso_max);
    zonesSet.add(z);
    weightsSet.add(w);
    map.set(`${w}|${z}`, r);
  }
  const zones = Array.from(zonesSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  let weights = Array.from(weightsSet).sort((a, b) => a - b);
  // Filtro de peso: un listino típico trae ~110 tramos y buscar uno concreto
  // obliga a recorrer toda la tabla. Filtra por rango [desde, hasta]; vacío = todo.
  const from = weightFrom.value === null || weightFrom.value === '' ? null : Number(weightFrom.value);
  const to = weightTo.value === null || weightTo.value === '' ? null : Number(weightTo.value);
  if (from !== null && !Number.isNaN(from)) weights = weights.filter((w) => w >= from);
  if (to !== null && !Number.isNaN(to)) weights = weights.filter((w) => w <= to);
  return {
    zones,
    weights,
    totalWeights: weightsSet.size,
    rows: rowsMatrix.value,
    cell: (w: number, z: string) => {
      const r = map.get(`${w}|${z}`);
      return r === undefined ? '—' : Number(r.prezzo).toFixed(2);
    },
    // Sub-valores de la celda (min/base/2º collo) según los flags del pack.
    extras: (w: number, z: string): string[] => {
      const r = map.get(`${w}|${z}`);
      if (!r || !meta.value) return [];
      const out: string[] = [];
      const num = (v: unknown) => Number(v) || 0;
      if (meta.value.usa_costo_min === 'S' && num(r.prezzo_min)) out.push(`min ${num(r.prezzo_min).toFixed(2)}`);
      if (meta.value.usa_costo_base === 'S' && num(r.prezzo_base)) out.push(`base ${num(r.prezzo_base).toFixed(2)}`);
      if (meta.value.costo_a_collo2 === 'S' && num(r.prezzo2)) out.push(`2º ${num(r.prezzo2).toFixed(2)}`);
      return out;
    },
  };
});

// ¿Hay alguna columna extra activa? (para mostrar la nota de leyenda)
const hasExtraCols = computed(() =>
  !!meta.value && (meta.value.usa_costo_min === 'S' || meta.value.usa_costo_base === 'S' || meta.value.costo_a_collo2 === 'S'),
);

// Servicio a km: la matriz tarifa por distancia, no por zona.
const isKm = computed(() => meta.value?.zone_dist_km === 'S');

// Descripción legible del tipo de pack.
const packLabel = computed(() => {
  const p = meta.value?.pack;
  const key = `anagrafiche.listini.pack_${p}`;
  const tr = t(key);
  return tr === key ? (p ?? '') : tr;
});

// Nota explicativa de multiplicación (step por kg).
const multiplierNote = computed(() => {
  if (meta.value?.moltipl_step !== 'S') return '';
  const ogni = Number(meta.value?.moltipl_ogni_x_kg) || 1;
  return t('anagrafiche.listini.note_step', { kg: ogni });
});

/** Formatea el peso con separador de miles (5500 → "5.500"). */
function fmtWeight(w: number): string {
  return Number(w).toLocaleString('it-IT');
}

// ── Preview "precio del cliente" (base + peso extra + fuel) por zona ──
const previewWeight = ref<number | null>(null);
const previewLoading = ref(false);
const previewRows = ref<PricePreviewRow[]>([]);
const withSupplements = ref(false);
const canPreview = computed(() => !!props.idAnagrafica && !!props.idServizio);
const previewHasSuppl = computed(() => previewRows.value.some((r) => Number(r.suppl) > 0));

// Bancale: listino que tarifa por tipo de pallet (no por kg).
const isBancale = computed(() => (meta.value?.peso_bancale ?? 'P') === 'B');
const bancaleTypes = ref<BancaleType[]>([]);
const bancaleTypeId = ref<number | null>(null);
const bancaleQty = ref<number>(1);

const selectedBancaleType = computed(() => bancaleTypes.value.find((t) => t.id === bancaleTypeId.value) ?? null);

/** Parsea "100x120 cm" → [100,120]; "80 cm"/"250 kg" → 80/250. */
function parseDim(s: string): number[] {
  return (s.match(/[\d.]+/g) ?? []).map(Number);
}

async function loadBancaleTypes(): Promise<void> {
  if (!canPreview.value || !isBancale.value) return;
  try {
    const res = await listinoPricesService.bancaleTypes(
      props.idAnagrafica as number, props.idServizio as number, props.listinoNomeId,
    );
    bancaleTypes.value = res.types;
    bancaleTypeId.value = res.types[0]?.id ?? null;
  } catch {
    bancaleTypes.value = [];
  }
}

async function runPreview(): Promise<void> {
  if (!canPreview.value) return;
  previewLoading.value = true;
  try {
    let res;
    if (isBancale.value) {
      const tp = selectedBancaleType.value;
      if (!tp) { previewRows.value = []; return; }
      // dimensiones máximas del tipo: base "BxL", altura, peso
      const [b1 = 100, b2 = 120] = parseDim(tp.max_base);
      const [h = 100] = parseDim(tp.max_height);
      const [p = 100] = parseDim(tp.max_weight);
      const qty = Math.max(1, Number(bancaleQty.value) || 1);
      res = await listinoPricesService.previewBancale(
        props.idAnagrafica as number, props.idServizio as number,
        [{ l1: h, l2: b1, l3: b2, peso: p, qty }],
        pivot.value.zones, props.listinoNomeId,
      );
    } else {
      const w = Number(previewWeight.value);
      if (!Number.isFinite(w) || w <= 0) { previewRows.value = []; return; }
      res = await listinoPricesService.preview(
        props.idAnagrafica as number, props.idServizio as number, w,
        pivot.value.zones, props.listinoNomeId, withSupplements.value,
      );
    }
    previewRows.value = res.rows;
    if (!res.rows.length) {
      toast.info(t('anagrafiche.listini.preview_empty'));
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
    previewRows.value = [];
  } finally {
    previewLoading.value = false;
  }
}

function onClose(): void {
  emit('update:modelValue', false);
}

async function loadMatrix(): Promise<void> {
  if (!packId.value) {
    rowsMatrix.value = [];
    return;
  }
  loading.value = true;
  try {
    const m = await listinoPricesService.matrix(packId.value, selectedVersion.value || undefined);
    rowsMatrix.value = m.prices;
    enriched.value = m.enriched ?? null;
    bancaleTypes.value = [];
    bancaleTypeId.value = null;
    await loadBancaleTypes();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
    rowsMatrix.value = [];
    enriched.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => props.modelValue, async (open) => {
  // reset del preview y tabs al abrir/cerrar
  previewRows.value = [];
  previewWeight.value = null;
  tab.value = 'tariffa';
  supplSearch.value = '';
  supplOnlyWithCost.value = true;
  withSupplements.value = false;
  selectedVersion.value = '';
  showExpiredVersions.value = false;
  if (!open || !props.listinoNomeId) return;
  loading.value = true;
  rowsMatrix.value = [];
  try {
    packs.value = await listinoPricesService.packs(props.listinoNomeId);
    packId.value = packs.value[0]?.id ?? null;
    await loadMatrix();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
    packs.value = [];
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* Las tablas heredan los estilos GLOBALES de .v-table (page-utils.scss): thead
   gris/uppercase, tamaños por token, borde y hover. Aquí solo lo específico. */

/* Matriz peso×zona: celdas numéricas tabulares, sin wrap. */
.cm-price-matrix :deep(td),
.cm-price-matrix :deep(th) {
  white-space: nowrap;
}
.cm-price-matrix :deep(td) {
  font-variant-numeric: tabular-nums;
}

/* La tabla NO se estira a todo el ancho del diálogo. Con 3-4 zonas quedaban
   huecos enormes entre el peso y su precio y el ojo perdía la fila. Columnas
   de ancho fijo, agrupadas a la izquierda. */
.cm-price-matrix :deep(table) {
  width: auto;
  min-width: 100%;
}
.cm-price-matrix :deep(th),
.cm-price-matrix :deep(td) {
  width: 96px;
  max-width: 96px;
}
/* La columna de peso: son 2-4 caracteres, no necesita más. */
.cm-price-matrix :deep(.cm-corner),
.cm-price-matrix :deep(.cm-rowhead) {
  width: 84px;
  max-width: 84px;
}

/* ── Cabecera doble (zona / unidad), como el legacy ── */
.cm-price-matrix :deep(.cm-zone-th) {
  /* la 2ª fila lleva el borde inferior: así el par se lee como un bloque */
  border-bottom: 0 !important;
  padding-bottom: 0;
}
.cm-price-matrix :deep(.cm-unit-th) {
  font-size: var(--cm-fs-xs);
  font-weight: 400;
  text-transform: none;
  opacity: 0.6;
  padding-top: 0;
  white-space: nowrap;
}
/* La fila de unidades es parte del thead pegajoso: mismo fondo, sin hueco.
   `fixed-header` de Vuetify solo fija la PRIMERA fila del thead, así que la
   segunda se ancla a mano justo debajo (top = alto de la fila de zonas). */
.cm-price-matrix :deep(.cm-unit-row th) {
  background: var(--cm-bg-thead);
  position: sticky;
  /* 36px = alto de `thead th` en page-utils.scss (estilo global del proyecto).
     Si cambia allí, cambia aquí: la 2ª fila se ancla justo bajo la 1ª. */
  top: 36px;
  /* 3 > 2 (celdas de peso): al bajar, la cabecera pasa por encima del cuerpo.
     La esquina (4) queda por encima de ambas. */
  z-index: 3;
  /* altura propia menor: es un subtítulo, no una cabecera completa */
  height: 24px !important;
}
/* La esquina abarca las dos filas (rowspan=2): se fija arriba y a la izquierda. */
.cm-price-matrix :deep(thead .cm-corner) {
  top: 0;
}
/* Separador visual entre el eje (peso) y los datos. */
.cm-price-matrix :deep(.cm-rowhead),
.cm-price-matrix :deep(.cm-corner) {
  border-right: 2px solid var(--cm-border-color-light);
}

/* Densidad: solo se recorta el padding vertical. La ALTURA y el resto
   (tipografía, bordes, zebra, hover) los pone el estilo global de `.v-table`
   en page-utils.scss — fijar `height` aquí lo pisaba y desalineaba esta tabla
   respecto a las demás del detalle. */
.cm-price-matrix :deep(tbody td) {
  padding-top: 2px;
  padding-bottom: 2px;
}

/* Cabecera de fila (peso) + esquina pegajosas al hacer scroll. Usa el mismo
   fondo de thead que el resto de tablas (--cm-bg-thead). */
.cm-price-matrix :deep(.cm-rowhead),
.cm-price-matrix :deep(.cm-corner) {
  position: sticky;
  left: 0;
  /* fondo opaco sólido: la columna fija no debe transparentar las celdas que
     pasan por debajo al hacer scroll horizontal (gana a la zebra). */
  background: var(--cm-bg-thead) !important;
  /* Capas al hacer scroll (importa con matrices anchas — hay listinos de 96
     zonas ≈ 9.300px):
       2 = celdas de peso (columna fija)  ·  3 = fila de unidades del thead
       4 = esquina (fija en ambos ejes, debe quedar por encima de todo)
     Antes valía 1 y la fila de unidades (2) pasaba POR ENCIMA de la columna
     de peso al desplazar en horizontal, tapándola. */
  z-index: 2;
}
.cm-price-matrix :deep(.cm-corner) {
  /* por encima de la fila de unidades (3) y de las celdas de peso (2) */
  z-index: 4;
}
.cm-price-matrix :deep(thead .cm-corner) {
  /* la esquina es a la vez thead y rowhead: por encima de todo al scrollear */
  z-index: 5;
}
.cm-axis-hint {
  opacity: 0.5;
  font-weight: 400;
}

/* Leyenda explicativa (qué es fila / columna / celda). */
/* ── Tabla que ocupa SOLO el espacio necesario ──
   Para tablas de pocas columnas (peso extra): en vez de estirarse al ancho del
   diálogo, se ajusta al contenido. `cm-fit` envuelve y `cm-fit-table` deja que
   la <table> se autodimensione. */
.cm-fit {
  width: fit-content;
  max-width: 100%;
}
.cm-fit-table :deep(table) {
  width: auto;
}
.cm-fit-table :deep(th),
.cm-fit-table :deep(td) {
  padding-right: 24px;
  white-space: nowrap;
}
.cm-fit-table :deep(th:last-child),
.cm-fit-table :deep(td:last-child) {
  padding-right: 16px;
}

.cm-matrix-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.cm-matrix-legend-inline {
  display: inline-flex;
  align-items: center;
  font-size: var(--cm-fs-xs);
  color: var(--cm-text-muted);
}
.cm-weight-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cm-weight-filter :deep(.v-input) {
  width: 108px;
  flex: 0 0 108px;
}
.cm-weight-count {
  font-size: var(--cm-fs-xs);
  color: var(--cm-text-muted);
  white-space: nowrap;
}
.cm-meta-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
/* Barra de metadatos fija bajo las tabs: separador sutil del contenido. */
.cm-meta-bar {
  border-bottom: 1px solid var(--cm-border-color-light);
  background: var(--cm-bg-surface);
}
/* Barra de versiones temporales. */
.cm-versions-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--cm-border-color-light);
  background: var(--cm-bg-surface);
}
.cm-versions-label {
  font-size: var(--cm-fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--cm-text-muted);
}
.cm-version-chip {
  cursor: pointer;
}
.cm-zone-name {
  font-weight: var(--cm-fw-semibold);
}
.cm-zone-code {
  font-size: var(--cm-fs-xs);
  font-weight: 400;
  opacity: 0.55;
}
.cm-preview-box {
  background: rgba(var(--v-theme-primary), 0.04);
}
.cm-total-col {
  background: rgba(var(--v-theme-primary), 0.06);
}
.cm-extra-tag {
  color: rgb(var(--v-theme-warning));
  font-size: var(--cm-fs-xs);
}
/* Sub-valores dentro de una celda de la matriz (min/base/2º collo). */
.cm-cell-extra {
  font-size: var(--cm-fs-xs);
  color: var(--cm-text-muted);
  line-height: 1.1;
}
/* Nota explicativa sobre la matriz (multiplicación / sub-valores). */
.cm-matrix-note {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: var(--cm-fs-xs);
  color: var(--cm-text-muted);
  font-style: italic;
}
.cm-matrix-note span {
  display: inline-flex;
  align-items: center;
}
/* La matriz peso×zona puede tener ~100 filas: scroll propio para que no alargue
   toda la tab ni contagie el scroll a las demás. */
.cm-matrix-scroll {
  /* NO scrollea este div. Antes tenía `overflow:auto` y envolvía a una v-table
     con `fixed-header`: quedaban DOS contenedores de scroll anidados y la
     cabecera se fijaba al wrapper INTERNO de Vuetify mientras el scroll ocurría
     en el externo — al bajar, la fila de zonas desaparecía y quedaba una tabla
     de números sin saber qué columna era cada zona.
     Ahora el scroll lo hace el wrapper de Vuetify (abajo), que es a quien
     `fixed-header` fija el thead. */
  border: 1px solid var(--cm-border-color-light);
  border-radius: var(--cm-radius-md, 6px);
  overflow: hidden; /* recorta las esquinas redondeadas del wrapper interno */
}
.cm-matrix-scroll :deep(.v-table__wrapper) {
  max-height: 52vh;
  overflow: auto;
}

/* ── Anchos de columna por tabla (evita columnas desbalanceadas) ── */
/* Tabla de SUPLEMENTOS: nombre ancho, coste estrecho a la derecha. */
/* Cabecera ordenable: MISMO gesto y aspecto que ListingDataView
   (`.sdv-th-sortable`). Se replica porque aquel estilo es `scoped` a ese
   componente y no alcanza a este diálogo; los valores se mantienen idénticos
   para que ordenar se sienta igual en todo el proyecto. */
.cm-suppl-table :deep(.sdv-th-sortable) {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color 0.12s;
}
.cm-suppl-table :deep(.sdv-th-sortable:hover) {
  color: rgb(var(--v-theme-primary));
}

/* Nombre: ocupa lo que sobre y trunca si no cabe. */
.cm-suppl-table :deep(th:first-child),
.cm-suppl-table :deep(td:first-child) {
  width: 100%;
  max-width: 0; /* con width:100% es lo que fuerza el ellipsis */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Las 3 columnas de importe, estrechas y sin wrap. */
.cm-suppl-table :deep(th:not(:first-child)),
.cm-suppl-table :deep(td:not(:first-child)) {
  width: 130px;
  min-width: 130px;
  white-space: nowrap;
}
/* Suplemento SIN coste configurado: atenuado, para que los que sí tienen
   importe destaquen (en un listino típico la mayoría están vacíos). */
.cm-suppl-table :deep(tr.cm-suppl-empty td) {
  opacity: 0.45;
}

/* Tabla de PESO EXTRA y PREVIEW: columnas estrechas y fijas. */
.cm-narrow-table :deep(th),
.cm-narrow-table :deep(td) { width: 140px; }
.cm-narrow-table :deep(th:first-child),
.cm-narrow-table :deep(td:first-child) { width: 120px; }
</style>
