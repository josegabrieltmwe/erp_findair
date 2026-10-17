<template>
  <div>
    <EntityHeader
      v-if="!isCreate"
      :title="headerTitle"
      :identifier="record?.id"
      :metadata="headerSubtitle"
    >
      <template #breadcrumbs>
        <button type="button" class="eh-back-link" @click="back">
          <v-icon :icon="mdiArrowLeft" size="16" />
          {{ t('common.back') }}
        </button>
      </template>

      <!-- La acción primaria de cada tab es su propio Save; aquí solo van las
           que operan sobre el registro entero (§7.4: copiar/clonar son
           secundarias, borrar es destructiva y va en el menú desbordado). -->
      <template v-if="record" #secondary-actions>
        <v-btn
          variant="tonal"
          color="primary"
          :prepend-icon="mdiContentCopy"
          :title="t('anagrafiche.actions.copy_id_hint')"
          @click="copyId"
        >
          {{ t('anagrafiche.actions.copy_id') }}
        </v-btn>
        <v-menu location="bottom end">
          <template #activator="{ props: menuProps }">
            <v-btn v-bind="menuProps" variant="tonal" :append-icon="mdiChevronDown">
              {{ t('common.actions') }}
            </v-btn>
          </template>
          <v-list density="compact" min-width="220">
            <v-list-item
              :prepend-icon="mdiPlus"
              :title="t('anagrafiche.actions.new_from')"
              :subtitle="t('anagrafiche.actions.new_from_hint')"
              @click="goCreate"
            />
            <v-divider />
            <v-list-item
              :prepend-icon="mdiDelete"
              :title="t('anagrafiche.actions.delete')"
              base-color="error"
              @click="confirmDelete"
            />
          </v-list>
        </v-menu>
      </template>
    </EntityHeader>
    <CmSectionHeader v-else :title="headerTitle" :subtitle="headerSubtitle" />

    <CmAsyncSection :loading="loading" :error="error" @clear-error="error = null">
      <template #default>
        <!-- Modo alta: formulario base mínimo. Las sub-entidades (sedi, contatti,
             banche, listini…) necesitan un id_anagrafica existente, así que el alta
             crea primero el registro base y redirige al detalle para completarlo.
             Espeja el legacy anagr.php: el registro nace al guardar y se salta a id=NUEVO. -->
        <v-card v-if="isCreate">
          <div class="cm-create-shell">
            <AnagraficaCreateSection :saving="creating" @create="onCreate" @cancel="back" />
          </div>
        </v-card>

        <v-card v-else>
          <div class="cm-detail-shell" :class="{ 'cm-detail-shell--compact': isCompactNav }">
            <!--
              Navegación de secciones responsive (§7.3):
                > 1200px  rail vertical agrupado (como antes).
                721-1200px  mismo v-tabs, horizontal y con scroll propio —
                  Vuetify ya soporta ambos ejes con el mismo componente, así
                  que basta con NO fijar `direction="vertical"`.
                <= 720px  selector compacto (v-select) en vez de tabs: un
                  rail o una fila de tabs no caben con legibilidad en móvil.
            -->
            <v-select
              v-if="isMobileNav"
              :model-value="activeTab"
              :items="flatTabItems"
              item-title="label"
              item-value="key"
              density="comfortable"
              variant="outlined"
              hide-details
              class="cm-detail-mobile-select"
              @update:model-value="activeTab = $event"
            >
              <template #item="{ props: itemProps, item }">
                <v-list-item v-bind="itemProps" :prepend-icon="item.raw.icon" />
              </template>
            </v-select>
            <v-tabs
              v-else
              v-model="activeTab"
              :direction="isCompactNav ? undefined : 'vertical'"
              :show-arrows="isCompactNav"
              color="primary"
              class="cm-detail-tabs"
              density="comfortable"
            >
              <template v-for="section in groupedTabs" :key="section.key">
                <!-- Encabezado de grupo: solo tiene sentido en el rail vertical
                     (en horizontal no hay dónde ponerlo sin partir la fila).
                     Se omite también con un único grupo (nada que agrupar). -->
                <div v-if="!isCompactNav && groupedTabs.length > 1" class="cm-tab-group-label">
                  {{ section.label }}
                </div>
                <v-tab v-for="tab in section.tabs" :key="tab.key" :value="tab.key">
                  <v-icon :icon="tab.icon" class="mr-2" size="20" />
                  {{ tab.label }}
                </v-tab>
              </template>
            </v-tabs>

            <v-window v-model="activeTab" class="cm-detail-window">
              <v-window-item value="dati_base">
                <AnagraficaDatiBaseSection
                  v-if="record"
                  :model-value="record"
                  @save="onSaveBase"
                />
              </v-window-item>

              <v-window-item value="sedi">
                <AnagraficaSediSection
                  v-if="record"
                  :id-anagrafica="recordId"
                  :sedi="record.sedi || []"
                  :default-sede-id="Number(record.id_sedi_interna_fatt) || 0"
                  @refresh="reload"
                />
              </v-window-item>

              <v-window-item value="contatti">
                <AnagraficaContattiSection
                  v-if="record"
                  :id-anagrafica="recordId"
                  :contatti="record.contatti || []"
                  @refresh="reload"
                />
              </v-window-item>

              <v-window-item value="banche">
                <AnagraficaBancheSection
                  v-if="record"
                  :id-anagrafica="recordId"
                  :banche="record.banche || []"
                  :default-banca-id="Number(record.id_banca_def) || 0"
                  @refresh="reload"
                />
              </v-window-item>

              <v-window-item value="lettint">
                <AnagraficaLettIntSection
                  v-if="record"
                  :id-anagrafica="recordId"
                  :items="record.lettint || []"
                  @refresh="reload"
                />
              </v-window-item>

              <v-window-item value="fatturazione">
                <AnagraficaFatturazioneSection
                  v-if="record"
                  :model-value="record"
                  @save="onSaveBase"
                />
              </v-window-item>

              <v-window-item value="info">
                <AnagraficaMoreSection
                  v-if="record"
                  :id-anagrafica="recordId"
                  :more="record.more || null"
                  @save="onSaveMore"
                />
              </v-window-item>

              <v-window-item value="listini">
                <AnagraficaListiniSection
                  v-if="record"
                  :id-anagrafica="recordId"
                />
              </v-window-item>

              <!-- Márgenes cargo (Air/Sea/Courier): escalones kg/% + presets +
                   seguro + Kg/Lb. Reubicada tras Listini y renombrada desde la
                   antigua pestaña 'assicurazione'. -->
              <v-window-item value="margini_cargo">
                <AnagraficaAssicurazioneSection
                  v-if="record"
                  :id-anagrafica="recordId"
                />
              </v-window-item>

              <v-window-item value="causali_iva">
                <AnagraficaCausaliIvaSection
                  v-if="record"
                  :id-anagrafica="recordId"
                />
              </v-window-item>

              <!--
                Pestañas aportadas por la app host. El paquete compartido NO
                sabe qué renderiza: solo entrega `idAnagrafica` y `record`, que
                es todo lo que necesita una sección de detalle. Así la
                dependencia va host → paquete y no al revés.
              -->
              <v-window-item
                v-for="tab in visibleExtraTabs"
                :key="tab.key"
                :value="tab.key"
              >
                <component
                  :is="tab.component"
                  :id-anagrafica="recordId"
                  :record="record"
                  @refresh="reload"
                />
              </v-window-item>
            </v-window>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { useMediaQuery } from '@vueuse/core';
import {
  mdiArrowLeft,
  mdiAccountDetails,
  mdiOfficeBuilding,
  mdiContacts,
  mdiBank,
  mdiFileCertificate,
  mdiReceiptTextOutline,
  mdiInformation,
  mdiAirplane,
  mdiCurrencyEur,
  mdiInvoiceTextOutline,
  mdiContentCopy,
  mdiChevronDown,
  mdiPlus,
  mdiDelete,
} from '@mdi/js';
import {
  composeTabs,
  resolveActiveTab,
  visibleExtraTabs as pickVisibleExtraTabs,
  type AnagraficaExtraTab,
  type TabDescriptor,
  type TabGroup,
} from '../utils/extraTabs';
import CmSectionHeader from '../components/CmSectionHeader.vue';
import CmAsyncSection from '../components/CmAsyncSection.vue';
import EntityHeader from '../../ui/EntityHeader.vue';
import {
  anagraficaService,
  type AnagraficaDetail,
  type AnagraficaMore,
} from '../services/anagrafica.service';
import { useToast } from '../composables/useToast';
import { useConfirm } from '../composables/useConfirm';
import AnagraficaCreateSection from './AnagraficaCreateSection.vue';
import AnagraficaDatiBaseSection from './AnagraficaDatiBaseSection.vue';
import AnagraficaSediSection from './AnagraficaSediSection.vue';
import AnagraficaContattiSection from './AnagraficaContattiSection.vue';
import AnagraficaBancheSection from './AnagraficaBancheSection.vue';
import AnagraficaLettIntSection from './AnagraficaLettIntSection.vue';
import AnagraficaFatturazioneSection from './AnagraficaFatturazioneSection.vue';
import AnagraficaMoreSection from './AnagraficaMoreSection.vue';
import AnagraficaAssicurazioneSection from './AnagraficaAssicurazioneSection.vue';
import AnagraficaListiniSection from './AnagraficaListiniSection.vue';
import AnagraficaCausaliIvaSection from './AnagraficaCausaliIvaSection.vue';

const props = defineProps<{
  id?: string;
  tab?: string;
  /** Pestañas extra del host; vacío = comportamiento idéntico al anterior. */
  extraTabs?: AnagraficaExtraTab[];
}>();
const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const toast = useToast();
const confirm = useConfirm();

const recordId = computed(() => Number(props.id ?? route.params.id ?? 0));
// Modo alta: ruta anagrafica-create (sin id). Distinto de un id inválido en detalle.
const isCreate = computed(() => route.name === 'anagrafica-create');
const record = ref<AnagraficaDetail | null>(null);
const loading = ref(false);
const creating = ref(false);
const error = ref<string | null>(null);

const activeTab = ref(props.tab || 'dati_base');

/** Propias + las del host, con las propias siempre primero. */
const tabs = computed(() => composeTabs(ownTabs.value, visibleExtraTabs.value));

/**
 * Pestañas del host que aplican a este registro.
 *
 * Se evalúa `visible()` solo con el registro ya cargado: hacerlo antes las
 * ocultaría durante la carga y provocaría un salto visible al aparecer.
 */
const visibleExtraTabs = computed<AnagraficaExtraTab[]>(
  () => pickVisibleExtraTabs(props.extraTabs, record.value),
);

// Grupo de cada pestaña propia (docs/plan-admin-navigation-shared-ui-consolidation.md
// §6.4). `lettint` (cartas de intención) es fiscal, no "avanzado" — es
// documentación de exención de IVA para exportación, misma familia que
// fatturazione/causali_iva.
const ownTabs = computed(() => [
  { key: 'dati_base', label: t('anagrafiche.tabs.dati_base'), icon: mdiAccountDetails, group: 'overview' as const },
  { key: 'sedi', label: t('anagrafiche.tabs.sedi'), icon: mdiOfficeBuilding, group: 'relations' as const },
  { key: 'contatti', label: t('anagrafiche.tabs.contatti'), icon: mdiContacts, group: 'relations' as const },
  { key: 'banche', label: t('anagrafiche.tabs.banche'), icon: mdiBank, group: 'relations' as const },
  { key: 'lettint', label: t('anagrafiche.tabs.lettint'), icon: mdiFileCertificate, group: 'fiscal' as const },
  { key: 'fatturazione', label: t('anagrafiche.tabs.fatturazione'), icon: mdiReceiptTextOutline, group: 'fiscal' as const },
  { key: 'info', label: t('anagrafiche.tabs.info'), icon: mdiInformation, group: 'overview' as const },
  { key: 'listini', label: t('anagrafiche.tabs.listini'), icon: mdiCurrencyEur, group: 'commercial' as const },
  { key: 'margini_cargo', label: t('anagrafiche.tabs.margini_cargo'), icon: mdiAirplane, group: 'commercial' as const },
  { key: 'causali_iva', label: t('anagrafiche.tabs.causali_iva'), icon: mdiInvoiceTextOutline, group: 'fiscal' as const },
]);

const TAB_GROUPS_ORDER: TabGroup[] = ['overview', 'relations', 'commercial', 'fiscal', 'integrations', 'advanced'];

interface TabGroupSection {
  key: TabGroup;
  label: string;
  tabs: TabDescriptor[];
}

/** Agrupa `tabs` (propias + extra ya compuestas) para el rail, en orden fijo; grupos sin pestañas no aparecen. */
const groupedTabs = computed<TabGroupSection[]>(() =>
  TAB_GROUPS_ORDER.map((g) => ({
    key: g,
    label: t('anagrafiche.tab_groups.' + g) as string,
    tabs: tabs.value.filter((tab) => tab.group === g),
  })).filter((section) => section.tabs.length > 0),
);

// Breakpoints de navegación de secciones (§7.3). 1200px es el límite superior
// del rango "horizontal scrollable tabs"; por debajo de 720px las tabs (rail
// o fila) dejan de caber con legibilidad y se sustituyen por un selector.
const isCompactNav = useMediaQuery('(max-width: 1200px)');
const isMobileNav = useMediaQuery('(max-width: 720px)');

/** Lista plana (sin agrupar) para el selector móvil — un <select> no necesita jerarquía visual. */
const flatTabItems = computed(() => tabs.value.map((tab) => ({ key: tab.key, label: tab.label, icon: tab.icon })));


// El `#id` ya lo antepone `EntityHeader` vía su prop `identifier` — aquí solo
// el nombre, para no duplicar el id en el título en modo detalle.
const headerTitle = computed(() => {
  if (isCreate.value) return t('anagrafiche.create.title') as string;
  if (!record.value) return t('sections.anagrafiche');
  return record.value.rag_soc || `#${record.value.id}`;
});
const headerSubtitle = computed(() => {
  if (isCreate.value) return t('anagrafiche.create.subtitle') as string;
  return record.value?.tipo ? `${t('anagrafiche.fields.tipo')}: ${record.value.tipo}` : '';
});

async function reload(): Promise<void> {
  if (!recordId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const detail = await anagraficaService.getDetail(recordId.value);
    if (!detail) {
      error.value = t('anagrafiche.not_found') as string;
      return;
    }
    record.value = detail;
  } catch (e) {
    error.value = e instanceof Error ? e.message : (t('common.error') as string);
  } finally {
    loading.value = false;
  }
}

async function onSaveBase(payload: Record<string, unknown>): Promise<void> {
  if (!recordId.value) return;
  try {
    const updated = await anagraficaService.update(recordId.value, payload);
    if (updated) record.value = updated;
    toast.success(t('anagrafiche.updated'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

async function onSaveMore(more: AnagraficaMore): Promise<void> {
  if (!recordId.value) return;
  try {
    const updated = await anagraficaService.update(recordId.value, { more });
    if (updated) record.value = updated;
    toast.success(t('anagrafiche.updated'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}

async function onCreate(payload: Record<string, unknown>): Promise<void> {
  if (creating.value) return;
  creating.value = true;
  try {
    const created = await anagraficaService.create(payload);
    // Mensaje de confirmación con el nombre del cliente. Timeout ampliado (6s)
    // para que siga visible tras redirigir al detalle del nuevo registro.
    const name = (payload.rag_soc as string) || String(created.id);
    toast.success(t('anagrafiche.created_named', { name }), 6000);
    // Saltar al detalle del nuevo registro para completar sub-entidades (sedi,
    // contatti, banche…), igual que el legacy redirige a id=NUEVO.
    router.push({ name: 'anagrafica-detail', params: { id: String(created.id) } });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    creating.value = false;
  }
}

function back(): void {
  router.push({ name: 'anagrafiche' });
}

function goCreate(): void {
  router.push({ name: 'anagrafica-create' });
}

// Copia el id del cliente al portapapeles (útil para pegarlo en soporte, tickets,
// referencias cruzadas). Fallback silencioso si el navegador bloquea clipboard.
async function copyId(): Promise<void> {
  if (!record.value) return;
  try {
    await navigator.clipboard.writeText(String(record.value.id));
    toast.success(t('anagrafiche.actions.copied', { id: record.value.id }));
  } catch {
    toast.error(t('common.error'));
  }
}

async function confirmDelete(): Promise<void> {
  if (!record.value) return;
  const ok = await confirm.ask({
    title: t('anagrafiche.delete_title') as string,
    message: t('anagrafiche.delete_message', {
      name: record.value.rag_soc || `#${record.value.id}`,
    }) as string,
    variant: 'danger',
    confirmLabel: t('common.delete') as string,
  });
  if (!ok) return;
  try {
    await anagraficaService.remove(recordId.value);
    toast.success(t('anagrafiche.deleted'));
    router.push({ name: 'anagrafiche' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('HAS_ACTIVE_SHIPMENTS')) {
      toast.error(t('anagrafiche.delete_blocked_active_shipments'));
    } else {
      toast.error(msg || (t('common.error') as string));
    }
  }
}

watch(() => props.tab, (v) => {
  if (v) activeTab.value = v;
});

// Recargar cuando cambia el id de la ruta sin remontar el componente. Es el
// caso de crear una anagrafica: onCreate hace router.push de /new → /{id} y
// Vue Router reutiliza este mismo componente (no dispara onMounted de nuevo),
// así que sin este watch el detalle quedaba vacío tras la creación.
watch(recordId, (id) => {
  if (id && !isCreate.value) {
    // Volver al primer tab para completar los datos base del nuevo registro.
    activeTab.value = 'dati_base';
    reload();
  }
});

/**
 * Una URL puede apuntar a una pestaña que no existe para este registro: un
 * deep link a `/anagrafiche/:id/credenziali` sobre una anagráfica cuya pestaña
 * extra no es visible, o un enlace antiguo a una clave retirada. Sin esto,
 * `activeTab` apuntaría a un `v-window-item` inexistente y la ficha quedaría
 * en blanco, sin error visible.
 */
watch([tabs, activeTab], ([list, current]) => {
  if (!list.length || !current) return;
  const safe = resolveActiveTab(list, current);
  if (safe !== current) activeTab.value = safe;
});

onMounted(() => {
  if (!isCreate.value) reload();
});
</script>

<style scoped>
.cm-detail-shell {
  display: flex;
  align-items: stretch;
  min-height: 600px;
  /* ACOTA la altura para que el scroll ocurra DENTRO de la tabla del tab
     (ListingDataView scrollea en su propio wrapper) en vez de estirar la
     página. Sin esto, un tab con lista larga (p. ej. 20 contactos) crecía hasta
     ~1400px: las filas existían pero quedaban fuera de pantalla y ningún
     ancestro scrolleaba, así que eran inalcanzables. */
  max-height: calc(100vh - 200px);
}
/* 721-1200px y <=720px (§7.3): la columna deja de tener sentido — las tabs
   horizontales/el selector van ARRIBA del contenido, no al lado. La altura
   acotada de `.cm-detail-shell` sigue aplicando: el contenido del tab activo
   scrollea internamente igual que en desktop. */
.cm-detail-shell--compact {
  flex-direction: column;
}
.cm-detail-mobile-select {
  margin: var(--cm-space-sm, 8px) var(--cm-space-sm, 8px) 0;
}
.eh-back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: rgba(var(--v-theme-on-surface), 0.65);
  cursor: pointer;
}
.eh-back-link:hover,
.eh-back-link:focus-visible {
  color: rgb(var(--v-theme-primary));
}
.cm-create-shell {
  padding: var(--cm-space-xl) var(--cm-space-lg) var(--cm-space-lg);
}
.cm-detail-tabs {
  flex: 0 0 220px;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  padding: var(--cm-space-sm, 8px);
}
/* 721-1200px: la fila horizontal no debe heredar el ancho fijo de columna
   del rail vertical, ni el borde lateral (pasa a ser contenido apilado). */
.cm-detail-shell--compact .cm-detail-tabs {
  flex: 0 0 auto;
  border-right: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
/* Uniformidad con el menú lateral principal (PlatformSidebar .ps-nav-item):
   item activo = fondo primary al 12%, texto/icono primary, negrita, esquinas
   redondeadas y SIN la barra indicadora por defecto de Vuetify. */
.cm-tab-group-label {
  padding: 10px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.cm-tab-group-label:first-child {
  padding-top: 4px;
}
.cm-detail-tabs :deep(.v-tab) {
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
.cm-detail-tabs :deep(.v-tab:hover) {
  background: rgb(var(--v-theme-surface-variant));
}
.cm-detail-tabs :deep(.v-tab.v-tab--selected) {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
/* Oculta la barra deslizante (slider) que Vuetify pinta en el borde. */
.cm-detail-tabs :deep(.v-tab__slider) {
  display: none;
}
/* El overlay de estado de Vuetify duplicaría el fondo del hover/activo. */
.cm-detail-tabs :deep(.v-tab .v-btn__overlay) {
  opacity: 0 !important;
}
.cm-detail-window {
  flex: 1 1 auto;
  /* Ritmo vertical de 16px + algo más arriba para que el contenido del tab
     (header de sección / barra de filtros) NO se pegue al borde de las tabs. */
  padding: var(--cm-space-xl) var(--cm-space-lg) var(--cm-space-lg);
  min-width: 0;
  /* `min-height: 0` es imprescindible en un hijo flex: sin él no puede
     encogerse por debajo de su contenido y el `max-height` del shell nunca
     llega a aplicarse (el tab seguiría estirando la página).
     `overflow-y: auto` da el scroll a los tabs de FORMULARIO (dati_base,
     fatturazione…), que son contenido largo sin tabla propia. En los tabs con
     listado, la tabla scrollea antes en su propio wrapper. */
  min-height: 0;
  overflow-y: auto;
}
/* Vuetify mete DOS capas propias entre `.cm-detail-window` y el contenido del
   tab (`.v-window__container` y `.v-window-item`). Ambas traen `min-height:auto`
   (valor inicial en flex/grid), que IMPIDE encoger por debajo del contenido: el
   contenedor crecía a ~1400px y el `overflow-y:auto` del padre nunca llegaba a
   activarse. Forzando `min-height: 0` y una altura del 100% la cadena vuelve a
   propagar la altura acotada hasta la tabla, que scrollea en su wrapper. */
.cm-detail-window :deep(.v-window),
.cm-detail-window :deep(.v-window__container) {
  min-height: 0;
  height: 100%;
}
.cm-detail-window :deep(.v-window-item--active) {
  min-height: 0;
  height: 100%;
}
</style>
