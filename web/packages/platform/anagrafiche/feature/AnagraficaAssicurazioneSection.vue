<template>
  <div>
    <CmSectionHeader :title="t('anagrafiche.scaglioni.section_title')" :subtitle="t('anagrafiche.scaglioni.section_subtitle')">
      <template #actions>
        <v-btn-toggle v-model="unit" mandatory density="comfortable" color="primary">
          <v-btn value="metric" size="small">{{ t('anagrafiche.metric.kg') }}</v-btn>
          <v-btn value="imperial" size="small">{{ t('anagrafiche.metric.lb') }}</v-btn>
        </v-btn-toggle>
        <v-btn variant="text" size="small" :prepend-icon="mdiRefresh" :loading="loading" @click="reload">
          {{ t('common.refresh') }}
        </v-btn>
        <v-btn color="primary" :prepend-icon="mdiSwapHorizontal" size="small" @click="convertUnit">
          {{ unit === 'metric' ? t('anagrafiche.scaglioni.convert_to_imperial') : t('anagrafiche.scaglioni.convert_to_metric') }}
        </v-btn>
      </template>
    </CmSectionHeader>

    <div class="cm-margins-shell">
      <!-- Tabs verticales por modalidad, con iconos y el mismo estilo de "item
           activo" que el menú lateral del detalle (fondo primary 12%, texto
           primary, redondeado, sin slider). -->
      <v-tabs
        v-model="tipo"
        direction="vertical"
        color="primary"
        density="comfortable"
        class="cm-margins-tabs"
      >
        <v-tab v-for="tb in tipoTabs" :key="tb.value" :value="tb.value">
          <v-icon :icon="tb.icon" class="mr-2" size="20" />
          {{ tb.label }}
        </v-tab>

        <!-- "Airlines" es una entrada más del menú, justo bajo Aéreo: los
             pactos por aerolínea son una configuración propia, no un apéndice
             de los escalones aéreos, y con varias configuradas la tabla
             quedaba enterrada al final de esa pestaña. -->
        <v-tab value="VETTORI">
          <v-icon :icon="mdiAirplaneCog" class="mr-2" size="20" />
          {{ t('anagrafiche.scaglioni_vettore.tab_label') }}
          <v-chip
            v-if="vettoreConfigs.length"
            size="x-small"
            variant="tonal"
            color="primary"
            class="ml-2"
          >
            {{ vettoreConfigs.length }}
          </v-chip>
        </v-tab>
      </v-tabs>

      <v-window v-model="tipo" class="cm-margins-window">
        <v-window-item v-for="t_ in tipi" :key="t_" :value="t_">
          <!-- Sin fila de escalones para este tipo todavía: ofrecer crearla. -->
          <div v-if="!bracketByTipo[t_]" class="cm-empty-brackets pa-6 text-center">
            <div class="text-body-2 text-medium-emphasis mb-3">
              {{ t('anagrafiche.scaglioni.empty_for_type', { type: tipoLabel(t_) }) }}
            </div>
            <v-btn
              color="primary"
              :prepend-icon="mdiPlus"
              :loading="creating === t_"
              @click="createBrackets(t_)"
            >
              {{ t('anagrafiche.scaglioni.create_brackets') }}
            </v-btn>
          </div>

          <div v-else class="cm-margins-grid">
            <!-- Columna 1: los 10 escalones como enumeración vertical (uno bajo
                 otro). Cabecera de columnas + filas compactas kg / %. -->
            <section class="cm-tiers-col">
              <header class="cm-tiers-head">
                <span class="cm-tiers-head__n"></span>
                <span class="cm-tiers-head__kg">{{ t('anagrafiche.scaglioni.kg') }}</span>
                <span class="cm-tiers-head__mode"></span>
                <span class="cm-tiers-head__pr">{{ t('anagrafiche.scaglioni.profit_pct') }}</span>
              </header>
              <div v-for="tier in bracketByTipo[t_]!.tiers" :key="tier.tier" class="cm-tier-row">
                <span class="cm-tier-label">{{ tier.tier }}</span>
                <v-text-field
                  :model-value="tier.kg"
                  type="number"
                  step="0.01"
                  density="compact"
                  variant="outlined"
                  hide-details
                  :suffix="unit === 'metric' ? 'kg' : 'lb'"
                  class="cm-tier-input"
                  @update:model-value="(v) => updateField(t_, `kg${pad(tier.tier)}`, Number(v))"
                />
                <v-btn-toggle
                  :model-value="tier.margin_type === 'FIXED' ? 'FIXED' : 'PERCENT'"
                  density="compact"
                  variant="outlined"
                  mandatory
                  class="cm-tier-mode"
                  @update:model-value="(v) => updateField(t_, `mt${pad(tier.tier)}`, v === 'FIXED' ? 'F' : 'P')"
                >
                  <v-btn value="PERCENT" size="x-small">%</v-btn>
                  <v-btn value="FIXED" size="x-small">€</v-btn>
                </v-btn-toggle>
                <v-text-field
                  v-if="tier.margin_type === 'FIXED'"
                  :model-value="tier.fixed_amount ?? 0"
                  type="number"
                  step="0.01"
                  density="compact"
                  variant="outlined"
                  hide-details
                  :suffix="bracketByTipo[t_]!.margin_currency ?? 'EUR'"
                  class="cm-tier-input"
                  @update:model-value="(v) => updateField(t_, `fx${pad(tier.tier)}`, Number(v))"
                />
                <v-text-field
                  v-else
                  :model-value="tier.profit_pct"
                  type="number"
                  step="0.01"
                  density="compact"
                  variant="outlined"
                  hide-details
                  suffix="%"
                  class="cm-tier-input"
                  @update:model-value="(v) => updateField(t_, `pr${pad(tier.tier)}`, Number(v))"
                />
              </div>
            </section>

            <!-- Columna 2: preset + seguro, agrupados en subcards. -->
            <aside class="cm-side-col">
              <div class="cm-side-card">
                <div class="cm-side-card__title">{{ t('anagrafiche.scaglioni.preset') }}</div>
                <v-select
                  :model-value="Number(bracketByTipo[t_]!.id_preset_base) || 0"
                  :items="presetsByTipo[t_]"
                  item-title="label"
                  item-value="id"
                  :label="t('anagrafiche.scaglioni.preset')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  :loading="presetsLoading"
                  @update:model-value="(v) => onPickPreset(t_, Number(v))"
                />
                <p class="cm-side-card__hint">{{ t('anagrafiche.scaglioni.preset_hint') }}</p>
              </div>

              <div class="cm-side-card">
                <div class="cm-side-card__title">{{ t('anagrafiche.scaglioni.insurance_group') }}</div>
                <v-text-field
                  :model-value="bracketByTipo[t_]!.insurance_min"
                  :label="t('anagrafiche.scaglioni.insurance_min')"
                  type="number"
                  step="0.01"
                  density="compact"
                  variant="outlined"
                  hide-details
                  suffix="€"
                  class="mb-2"
                  @update:model-value="(v) => updateField(t_, 'ass_min', Number(v))"
                />
                <v-text-field
                  :model-value="bracketByTipo[t_]!.insurance_pct"
                  :label="t('anagrafiche.scaglioni.insurance_pct')"
                  type="number"
                  step="0.01"
                  density="compact"
                  variant="outlined"
                  hide-details
                  suffix="%"
                  @update:model-value="(v) => updateField(t_, 'ass_perc', Number(v))"
                />
              </div>
            </aside>
          </div>

        </v-window-item>

        <!-- Airlines: pactos específicos con una aerolínea o proveedor de
             quote, que sustituyen a los escalones generales SOLO para ese
             proveedor. Un vettore sin fila propia sigue usando los generales,
             así que dar de alta uno nunca altera el precio de los demás. -->
        <v-window-item value="VETTORI">
          <div class="cm-vettori-block">
            <div class="cm-vettori-block__head">
              <div>
                <div class="cm-vettori-block__title">
                  {{ t('anagrafiche.scaglioni_vettore.section_title') }}
                </div>
                <div class="cm-vettori-block__hint">
                  {{ t('anagrafiche.scaglioni_vettore.section_hint') }}
                </div>
              </div>
              <v-btn
                color="primary"
                size="small"
                :prepend-icon="mdiPlus"
                :disabled="!hasSelectableVettori"
                @click="openVettoreDialog()"
              >
                {{ t('anagrafiche.scaglioni_vettore.add') }}
              </v-btn>
            </div>

            <!-- Filtro por aerolínea. Aparece solo cuando hay suficientes
                 pactos como para que buscar sea más rápido que mirar. -->
            <v-autocomplete
              v-if="vettoreConfigs.length > 3"
              v-model="vettoreFilter"
              :items="vettoreFilterItems"
              item-title="label"
              item-value="code"
              :label="t('anagrafiche.scaglioni_vettore.filter')"
              :custom-filter="filterConfiguredVettore"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              class="cm-vettori-filter"
            >
              <template #item="{ props: itemProps, item }">
                <v-list-item v-bind="itemProps" :subtitle="item.raw.code">
                  <template #prepend>
                    <CmAirlineTail :code="item.raw.code" :size="22" class="mr-3" />
                  </template>
                </v-list-item>
              </template>
            </v-autocomplete>

            <div v-if="!vettoreConfigs.length" class="cm-vettori-empty">
              {{ t('anagrafiche.scaglioni_vettore.empty') }}
            </div>

            <!-- El filtro no encuentra nada: distinto de "no hay pactos". -->
            <div v-else-if="!filteredVettoreConfigs.length" class="cm-vettori-empty">
              {{ t('anagrafiche.scaglioni_vettore.no_match') }}
            </div>

            <div v-else class="cm-vettori-list">
              <article
                v-for="cfg in filteredVettoreConfigs"
                :key="cfg.id"
                class="cm-vettore-card"
              >
                <!-- Identidad: cola + nombre + código, ancho fijo para que
                     todas las fichas alineen su columna de tramos. -->
                <header class="cm-vettore-card__id">
                  <CmAirlineTail :code="cfg.vettore" :size="32" />
                  <div class="cm-vettore-card__names">
                    <span class="cm-vettore-card__name">{{ cfg.vettore_label }}</span>
                    <span class="cm-vettore-card__code">{{ cfg.vettore }}</span>
                  </div>
                </header>

                <!-- Tramos en rejilla de columnas iguales: los kg y los %
                     quedan alineados verticalmente entre sí y entre fichas,
                     que es lo que los chips de ancho variable impedían. -->
                <div class="cm-vettore-card__tiers">
                  <div
                    v-for="(tier, i) in definedTiers(cfg)"
                    :key="i"
                    class="cm-tier-cell"
                  >
                    <span class="cm-tier-cell__kg">{{ tier.kg }}<small>kg</small></span>
                    <span v-if="tier.isFixed" class="cm-tier-cell__pr">
                      {{ tier.fx }}<small>{{ cfg.margin_currency ?? 'EUR' }}</small>
                    </span>
                    <span v-else class="cm-tier-cell__pr">{{ tier.pr }}<small>%</small></span>
                  </div>
                  <span
                    v-if="!definedTiers(cfg).length"
                    class="text-caption text-medium-emphasis"
                  >
                    —
                  </span>
                </div>

                <div class="cm-vettore-card__actions">
                  <v-btn
                    variant="text"
                    size="small"
                    :icon="mdiPencil"
                    @click="openVettoreDialog(cfg)"
                  />
                  <v-btn
                    variant="text"
                    size="small"
                    color="error"
                    :icon="mdiDelete"
                    :loading="deletingVettore === cfg.vettore"
                    @click="removeVettore(cfg)"
                  />
                </div>
              </article>
            </div>
          </div>
        </v-window-item>
      </v-window>
    </div>


    <AnagraficaVettoreMarginDialog
      v-model="vettoreDialogOpen"
      :id-anagrafica="props.idAnagrafica"
      tipo="A"
      :available-vettori="availableVettori"
      :edit-vettore="editingVettore"
      :edit-brackets="editingBrackets"
      :edit-margin-currency="editingMarginCurrency"
      :existing-configs="vettoreConfigs"
      @saved="reloadVettori"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiRefresh,
  mdiSwapHorizontal,
  mdiPlus,
  mdiAirplane,
  mdiAirplaneCog,
  mdiFerry,
  mdiTruckFast,
  mdiPencil,
  mdiDelete,
} from '@mdi/js';
import {
  scaglioniService,
  type BracketData,
  type ScaglioniPreset,
  type ScaglioniTipo,
  type ScaglioniUnit,
} from '../services/scaglioni.service';
import {
  scaglioniVettoreService,
  type AvailableVettore,
  type VettoreBracket,
  type VettoreConfiguration,
} from '../services/scaglioniVettore.service';
import { useToast } from '../composables/useToast';
import CmSectionHeader from '../components/CmSectionHeader.vue';
import CmAirlineTail from '../components/CmAirlineTail.vue';
import AnagraficaVettoreMarginDialog from './AnagraficaVettoreMarginDialog.vue';

const props = defineProps<{ idAnagrafica: number }>();
const { t } = useI18n();
const toast = useToast();

const loading = ref(false);
const creating = ref<ScaglioniTipo | null>(null);
const brackets = ref<BracketData[]>([]);
const unit = ref<ScaglioniUnit>('metric');
/**
 * Pestaña activa. Además de las tres modalidades (A/S/E) admite 'VETTORI',
 * la sección de márgenes por aerolínea — que no es un modo de transporte,
 * pero sí una entrada más del mismo menú lateral.
 */
const tipo = ref<ScaglioniTipo | 'VETTORI'>('A');

// --- Márgenes por vettore (aerolínea / proveedor de quote) -----------------
// Solo aplican al modo aéreo: son el nivel 1 de la cascada de márgenes y
// sustituyen a los escalones generales SOLO para el proveedor configurado.
const vettoreConfigs = ref<VettoreConfiguration[]>([]);
const availableVettori = ref<AvailableVettore[]>([]);
const vettoreDialogOpen = ref(false);
const editingVettore = ref<string>('');
const editingBrackets = ref<VettoreBracket[]>([]);
const editingMarginCurrency = ref<string>('EUR');
const deletingVettore = ref<string | null>(null);

const hasSelectableVettori = computed(() =>
  availableVettori.value.some((v) => !v.configured),
);

/** Código de aerolínea por el que se filtra el listado ('' = todas). */
const vettoreFilter = ref<string | null>(null);

/** Solo las aerolíneas YA configuradas: filtrar por una sin pacto daría vacío. */
const vettoreFilterItems = computed(() =>
  vettoreConfigs.value.map((c) => ({ code: c.vettore, label: c.vettore_label })),
);

const filteredVettoreConfigs = computed(() =>
  vettoreFilter.value
    ? vettoreConfigs.value.filter((c) => c.vettore === vettoreFilter.value)
    : vettoreConfigs.value,
);

/** Buscar por nombre O por código IATA, igual que en el modal de alta. */
function filterConfiguredVettore(
  value: string,
  query: string,
  item?: { raw?: { code: string; label: string } },
): boolean {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return true;
  const raw = item?.raw;
  return (
    (raw?.label ?? value ?? '').toLowerCase().includes(q) ||
    (raw?.code ?? '').toLowerCase().includes(q)
  );
}

/**
 * Tramos definidos (% > 0, o fijo con importe > 0) como pares kg/valor.
 *
 * Devuelve datos, no cadenas ya formateadas, para poder pintarlos en una
 * rejilla de columnas iguales: con texto corrido ("45kg→200% · 100kg→180% · …")
 * los diez tramos se leían como un párrafo y nada quedaba alineado.
 */
function definedTiers(
  cfg: VettoreConfiguration,
): Array<{ kg: number; pr: number; isFixed: boolean; fx: number }> {
  const out: Array<{ kg: number; pr: number; isFixed: boolean; fx: number }> = [];
  for (let i = 1; i <= 10; i += 1) {
    const ii = pad(i);
    const kg = Number(cfg['kg' + ii] ?? 0);
    const pr = Number(cfg['pr' + ii] ?? 0);
    const isFixed = String(cfg['mt' + ii] ?? 'P').toUpperCase() === 'F';
    const fx = Number(cfg['fx' + ii] ?? 0);
    if (isFixed ? fx > 0 : pr > 0) out.push({ kg, pr, isFixed, fx });
  }
  return out;
}

async function reloadVettori(): Promise<void> {
  if (!props.idAnagrafica) return;
  try {
    const res = await scaglioniVettoreService.list(props.idAnagrafica, 'A');
    vettoreConfigs.value = res.configurations;
    availableVettori.value = res.available_vettori;
  } catch {
    // La tabla puede no existir todavía en este entorno: el bloque queda
    // vacío en vez de romper la pestaña entera de márgenes.
    vettoreConfigs.value = [];
    availableVettori.value = [];
  }
}

function openVettoreDialog(cfg?: VettoreConfiguration): void {
  if (cfg) {
    editingVettore.value = cfg.vettore;
    editingBrackets.value = Array.from({ length: 10 }, (_, i) => {
      const ii = pad(i + 1);
      const mt = String(cfg['mt' + ii] ?? 'P').toUpperCase() === 'F' ? 'F' : 'P';
      return {
        n: i + 1,
        kg: Number(cfg['kg' + ii] ?? 0),
        pr: Number(cfg['pr' + ii] ?? 0),
        mt: mt as 'P' | 'F',
        fx: Number(cfg['fx' + ii] ?? 0),
      };
    });
    editingMarginCurrency.value = String(cfg.margin_currency ?? 'EUR');
  } else {
    editingVettore.value = '';
    editingBrackets.value = [];
    editingMarginCurrency.value = 'EUR';
  }
  vettoreDialogOpen.value = true;
}

async function removeVettore(cfg: VettoreConfiguration): Promise<void> {
  deletingVettore.value = cfg.vettore;
  try {
    await scaglioniVettoreService.remove(props.idAnagrafica, cfg.vettore, 'A');
    await reloadVettori();
    toast.success(t('anagrafiche.scaglioni_vettore.removed') as string);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    deletingVettore.value = null;
  }
}

const tipi: ScaglioniTipo[] = ['A', 'S', 'E'];

function tipoLabel(t_: ScaglioniTipo): string {
  const key = t_ === 'A' ? 'tipo_a' : t_ === 'S' ? 'tipo_s' : 'tipo_e';
  return t(`anagrafiche.scaglioni.${key}`) as string;
}

// Tabs por modalidad con icono: A=aéreo (avión), S=marítimo (ferry), E=courier.
const tipoTabs = computed(() => [
  { value: 'A' as ScaglioniTipo, label: tipoLabel('A'), icon: mdiAirplane },
  { value: 'S' as ScaglioniTipo, label: tipoLabel('S'), icon: mdiFerry },
  { value: 'E' as ScaglioniTipo, label: tipoLabel('E'), icon: mdiTruckFast },
]);

// Presets del partner, por modalidad. Cargados una vez (no dependen de unit).
const presetsLoading = ref(false);
const presets = ref<Record<ScaglioniTipo, ScaglioniPreset[]>>({ A: [], S: [], E: [] });

interface PresetItem { id: number; label: string }
const presetsByTipo = computed<Record<ScaglioniTipo, PresetItem[]>>(() => {
  const map: Record<ScaglioniTipo, PresetItem[]> = { A: [], S: [], E: [] };
  for (const t_ of tipi) {
    map[t_] = presets.value[t_].map((p) => ({
      id: p.id,
      label: p.is_base ? `${p.nome} [BASE]` : p.nome,
    }));
  }
  return map;
});

const bracketByTipo = computed<Record<ScaglioniTipo, BracketData | null>>(() => {
  const map: Record<ScaglioniTipo, BracketData | null> = { A: null, S: null, E: null };
  for (const b of brackets.value) map[b.tipo] = b;
  return map;
});

function pad(n: number): string { return n < 10 ? '0' + n : String(n); }

async function reload(): Promise<void> {
  if (!props.idAnagrafica) return;
  loading.value = true;
  try {
    brackets.value = await scaglioniService.list(props.idAnagrafica, unit.value);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    loading.value = false;
  }
}

async function loadPresets(): Promise<void> {
  if (!props.idAnagrafica) return;
  presetsLoading.value = true;
  try {
    const [a, s, e] = await Promise.all([
      scaglioniService.listPresets(props.idAnagrafica, 'A'),
      scaglioniService.listPresets(props.idAnagrafica, 'S'),
      scaglioniService.listPresets(props.idAnagrafica, 'E'),
    ]);
    presets.value = { A: a, S: s, E: e };
  } catch (err) {
    // Sin presets no rompe la sección: el select queda con solo "NONE".
    toast.error(err instanceof Error ? err.message : (t('common.error') as string));
  } finally {
    presetsLoading.value = false;
  }
}

// Aplica el preset elegido (id=0 "NONE" = sin cambio, mantiene lo personalizado)
// y recarga los escalones para reflejar los valores copiados.
async function onPickPreset(tipoVal: ScaglioniTipo, presetId: number): Promise<void> {
  if (!presetId || presetId <= 0) return;
  try {
    await scaglioniService.applyPreset(props.idAnagrafica, tipoVal, presetId);
    toast.success(t('anagrafiche.scaglioni.preset_applied'));
    await reload();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : (t('common.error') as string));
  }
}

// Crea la fila de escalones para un tipo que aún no existe (a cero) y recarga
// para que aparezca el editor de los 10 escalones + seguro + preset.
async function createBrackets(tipoVal: ScaglioniTipo): Promise<void> {
  creating.value = tipoVal;
  try {
    await scaglioniService.createBrackets(props.idAnagrafica, tipoVal);
    toast.success(t('anagrafiche.scaglioni.brackets_created'));
    await reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    creating.value = null;
  }
}

async function updateField(tipoVal: ScaglioniTipo, field: string, value: number | string): Promise<void> {
  try {
    await scaglioniService.updateField(props.idAnagrafica, tipoVal, field, value, unit.value);
    toast.success(t('anagrafiche.updated'));
    await reload(); // refresca margin_type/fixed_amount tras cambiar de modo
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

async function convertUnit(): Promise<void> {
  const target: ScaglioniUnit = unit.value === 'metric' ? 'imperial' : 'metric';
  try {
    const r = await scaglioniService.convertUnit(props.idAnagrafica, target);
    toast.success(t('anagrafiche.scaglioni.converted', { n: r.converted_records }));
    unit.value = target;
    await reload();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

watch(unit, reload);
onMounted(() => {
  void reload();
  void loadPresets();
  void reloadVettori();
});
</script>

<style scoped>
/* Shell: tabs verticales de modalidad + panel de contenido, como el detalle. */
.cm-margins-shell {
  display: flex;
  align-items: flex-start;
  gap: var(--cm-space-md, 16px);
  margin-top: var(--cm-space-sm, 8px);
}

/* Tabs verticales con el MISMO look que el menú lateral del detalle:
   item activo = fondo primary 12%, texto/icono primary, negrita, redondeado,
   sin la barra deslizante por defecto de Vuetify. */
.cm-margins-tabs {
  flex: 0 0 150px;
  padding: 4px;
}
.cm-margins-tabs :deep(.v-tab) {
  justify-content: flex-start;
  min-height: 40px;
  margin-bottom: 2px;
  border-radius: var(--cm-radius-lg, 8px);
  text-transform: none;
  letter-spacing: normal;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}
.cm-margins-tabs :deep(.v-tab:hover) {
  background: rgb(var(--v-theme-surface-variant));
}
.cm-margins-tabs :deep(.v-tab.v-tab--selected) {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
.cm-margins-tabs :deep(.v-tab__slider) {
  display: none;
}
.cm-margins-tabs :deep(.v-tab .v-btn__overlay) {
  opacity: 0 !important;
}
.cm-margins-window {
  flex: 1 1 auto;
  min-width: 0;
}

/* Contenido: 2 columnas — escalones (enumeración vertical) | preset + seguro.
   La columna de escalones se ajusta a su contenido (auto), no a 1fr, para que
   la columna lateral quede pegada al lado y no se genere un hueco enorme. */
.cm-margins-grid {
  display: grid;
  grid-template-columns: auto 240px;
  justify-content: start;
  column-gap: var(--cm-space-md, 16px);
  row-gap: var(--cm-space-md, 16px);
  align-items: start;
}
@media (max-width: 720px) {
  .cm-margins-grid {
    grid-template-columns: 1fr;
  }
}

/* Columna de escalones: cabecera + filas #n | kg | %. Campos estrechos. */
.cm-tiers-col {
  min-width: 0;
}
.cm-tiers-head {
  display: grid;
  grid-template-columns: 28px 130px 76px 130px;
  gap: 8px;
  align-items: center;
  padding: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--cm-text-muted);
}
.cm-tiers-head__n { text-align: center; }
.cm-tier-row {
  display: grid;
  grid-template-columns: 28px 130px 76px 130px;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.cm-tier-label {
  font-weight: 700;
  font-size: 12px;
  color: var(--cm-text-muted);
  text-align: center;
}
.cm-tier-input {
  max-width: 130px;
}
.cm-tier-mode {
  max-width: 76px;
}

/* Columna lateral: subcards para preset y seguro. */
.cm-side-col {
  display: flex;
  flex-direction: column;
  gap: var(--cm-space-md, 16px);
}
.cm-side-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: var(--cm-radius-lg, 8px);
  padding: 12px;
  background: rgb(var(--v-theme-surface));
}
.cm-side-card__title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--cm-text-muted);
  margin-bottom: 8px;
}
.cm-side-card__hint {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--cm-text-muted);
}

/* Bloque de márgenes por vettore (solo en la pestaña aérea). */
.cm-vettori-block {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.cm-vettori-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 12px;
}
/* La explicación no debe empujar al botón ni estirarse a todo el ancho: a
   partir de ~70 caracteres el ojo pierde el renglón. */
.cm-vettori-block__head > div:first-child {
  max-width: 62ch;
}
.cm-vettori-block__title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--cm-text-muted);
}
.cm-vettori-block__hint {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--cm-text-muted);
}
.cm-vettori-empty {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--cm-text-muted);
  border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: var(--cm-radius-lg, 8px);
}

/* Fichas en vez de tabla: una tabla de 3 columnas desbordaba en pantallas
   estrechas y dejaba los tramos como un párrafo ilegible. */
.cm-vettori-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cm-vettore-card {
  display: grid;
  /* Identidad de ancho FIJO: así la columna de tramos empieza en la misma x
     en todas las fichas y el bloque se lee como una tabla alineada. */
  grid-template-columns: 200px minmax(0, 1fr) 88px;
  gap: 16px;
  align-items: center;
  padding: 10px 14px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: var(--cm-radius-lg, 8px);
  background: rgb(var(--v-theme-surface));
}
.cm-vettore-card__id {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.cm-vettore-card__names {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cm-vettore-card__name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cm-vettore-card__code {
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--cm-text-muted);
  line-height: 1.2;
}

/* Rejilla de celdas iguales: kg arriba, % abajo, centrados. Los diez tramos
   caben en una línea y los valores quedan alineados entre fichas. */
.cm-vettore-card__tiers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(58px, 1fr));
  gap: 2px;
  min-width: 0;
}
.cm-tier-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px 2px;
  border-radius: 4px;
  background: rgba(var(--v-theme-primary), 0.05);
  line-height: 1.25;
}
.cm-tier-cell__kg {
  font-size: 10px;
  color: var(--cm-text-muted);
  white-space: nowrap;
}
.cm-tier-cell__pr {
  font-size: 12px;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  white-space: nowrap;
}
.cm-tier-cell small {
  font-size: 9px;
  font-weight: 400;
  opacity: 0.75;
  margin-left: 1px;
}
.cm-vettore-card__actions {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
}

/* Filtro por aerolínea: acotado para no estirarse a todo el ancho del panel,
   que lo haría parecer un campo de formulario en vez de un buscador. */
.cm-vettori-filter {
  max-width: 340px;
  margin-bottom: 12px;
}

@media (max-width: 900px) {
  /* Identidad y acciones en una línea; los tramos pasan debajo a todo el
     ancho, en vez de comprimirse hasta ser ilegibles. */
  .cm-vettore-card {
    grid-template-columns: minmax(0, 1fr) 88px;
    row-gap: 10px;
  }
  .cm-vettore-card__tiers {
    grid-column: 1 / -1;
    grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
  }
  .cm-vettori-block__head {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
