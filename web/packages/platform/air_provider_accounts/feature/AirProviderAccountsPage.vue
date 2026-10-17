<template>
  <div>
    <CmSectionHeader
      :title="t('air_provider_accounts.title')"
      :subtitle="t('air_provider_accounts.subtitle')"
    />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="cm-filters">
        <CmAnagraficaAutocomplete
          v-model="partnerId"
          :label="t('air_provider_accounts.filter_partner')"
          @update:model-value="onPartnerChange"
        />
        <v-select
          v-model="filters.provider"
          :items="providerItems"
          :label="t('air_provider_accounts.filter_provider')"
          density="compact"
          hide-details
          clearable
          @update:model-value="load"
        />
        <v-select
          v-model="filters.environment"
          :items="envItems"
          :label="t('air_provider_accounts.filter_environment')"
          density="compact"
          hide-details
          clearable
          @update:model-value="load"
        />
        <CmPaesiSelect
          v-model="countryId"
          :label="t('air_provider_accounts.filter_country')"
          @select="onCountrySelect"
        />
        <v-switch
          v-model="filters.include_inactive"
          :label="t('air_provider_accounts.filter_include_inactive')"
          color="primary"
          density="compact"
          hide-details
          @update:model-value="load"
        />
      </div>
    </v-card>

    <v-alert v-if="!loading && !error && items.length === 0" type="info" variant="tonal">
      {{ t('air_provider_accounts.empty') }}
    </v-alert>
    <ListingDataView
      v-else
      :source="listSource"
      :headers="tableHeaders"
      :selected="selected"
      :sort-key-map="sortKeyMap"
      mode="infinite"
      :selectable="false"
      @update:selected="selected = $event"
      @row-click="openDetail(($event as IndexedAccount).account)"
    >
      <template #cell.owner="{ item }">
        <div class="font-weight-medium">
          {{ (item as IndexedAccount).account.owner.name || t('air_provider_accounts.no_owner') }}
        </div>
        <div class="text-caption text-medium-emphasis">
          #{{ (item as IndexedAccount).account.owner.partner_id }}
        </div>
      </template>
      <template #cell.provider_label="{ item }">
        <v-chip size="small" variant="tonal" :color="providerColor((item as IndexedAccount).account.provider)">
          {{ (item as IndexedAccount).account.provider_label }}
        </v-chip>
      </template>
      <template #cell.environment="{ item }">
        <v-chip
          size="x-small"
          variant="tonal"
          :color="(item as IndexedAccount).account.environment === 'production' ? 'error' : 'default'"
        >
          {{ t(`air_provider_accounts.env.${(item as IndexedAccount).account.environment}`) }}
        </v-chip>
      </template>
      <template #cell.capabilities="{ item }">
        <AirProviderCapabilities :capabilities="(item as IndexedAccount).account.capabilities" />
      </template>
      <template #cell.coverage="{ item }">
        <AirProviderCoverage :coverage="(item as IndexedAccount).account.coverage" compact />
      </template>
      <template #cell.health="{ item }">
        <AirProviderHealthChip :health="(item as IndexedAccount).account.health" />
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <!-- Detalle + simulador de resolución -->
    <v-dialog v-model="detailOpen" max-width="900" scrollable>
      <v-card v-if="selectedAccount">
        <v-card-title>
          {{ selectedAccount.owner.name || t('air_provider_accounts.no_owner') }}
        </v-card-title>
        <v-divider />
        <v-card-text>
          <AirProviderAccountSummary :account="selectedAccount" />
          <v-divider class="my-4" />
          <AirProviderResolutionPreview :account="selectedAccount" />
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen = false">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Inventario de cuentas de proveedor aéreo — Fase A-bis del plan de
 * deprecación de `admin_config` (docs/plan-deprecacion-admin-config.md),
 * Incremento 3 de `docs/proposal-admin-air-cargo-credentials.md`.
 *
 * Una fila por (anagráfica × proveedor × entorno), que es como se piensa
 * el problema: hasta ahora la misma pregunta —"¿cómo está configurada
 * esta anagráfica?"— exigía recorrer tres pantallas y saber qué tabla usa
 * cada flujo.
 *
 * SOLO LECTURA. Las pantallas por tabla siguen siendo la vía de edición.
 * Portado desde
 * `admin_config/src/features/air_provider_accounts/AirProviderAccountsPage.vue`.
 */
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmPaesiSelect from '../../geographic_config/components/CmPaesiSelect.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import type { PaeseLite } from '../../geographic_config/services/paesi.service';
import AirProviderAccountSummary from '../components/AirProviderAccountSummary.vue';
import AirProviderCapabilities from '../components/AirProviderCapabilities.vue';
import AirProviderCoverage from '../components/AirProviderCoverage.vue';
import AirProviderHealthChip from '../components/AirProviderHealthChip.vue';
import AirProviderResolutionPreview from '../components/AirProviderResolutionPreview.vue';
import {
  airProviderAccountsService,
  type AirProviderAccount,
  type AirAccountFilters,
  type AirProvider,
} from '../services/airProviderAccounts.service';

const { t } = useI18n();

const items = ref<AirProviderAccount[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const detailOpen = ref(false);
const selectedAccount = ref<AirProviderAccount | null>(null);

// account_key es una clave compuesta opaca ("afkl:9069:production"), no un id
// numérico — ListingDataView exige `id: number`. Solo lectura, sin crear/
// editar/reordenar: el índice del array es un id sintético seguro, el
// array se reemplaza entero en cada load().
interface IndexedAccount { id: number; account: AirProviderAccount }
const indexedItems = computed<IndexedAccount[]>(() => items.value.map((a, i) => ({ id: i, account: a })));
const listSource = useClientSideListSource(indexedItems, { loading });
const selected = ref<{ id: number }[]>([]);

const filters = ref<AirAccountFilters>({ include_inactive: false });

/**
 * CmPaesiSelect trabaja con el id de `paesi`; el backend filtra por ISO, que es
 * lo que las tablas de credenciales guardan. Mantenemos ambos: el id para el
 * control, el ISO para la consulta.
 */
const countryId = ref<number | null>(null);

/** Mismo motivo: el control usa `null`, el filtro omite la clave. */
const partnerId = ref<number | null>(null);

function onPartnerChange(value: number | null): void {
  filters.value.owner_partner_id = value ?? undefined;
  load();
}

function onCountrySelect(option: PaeseLite | null): void {
  filters.value.country_iso = option?.ISO ? option.ISO.toUpperCase() : undefined;
  load();
}

const providerItems = computed(() => [
  { title: 'Air France KLM Cargo', value: 'afkl' },
  { title: 'WebCargo', value: 'webcargo' },
]);

const envItems = computed(() => [
  { title: t('air_provider_accounts.env.production'), value: 'production' },
  { title: t('air_provider_accounts.env.sandbox'), value: 'sandbox' },
]);

const tableHeaders = computed<DataTableHeader[]>(() => [
  { title: t('air_provider_accounts.col_owner') as string, key: 'owner', sortable: false },
  { title: t('air_provider_accounts.col_provider') as string, key: 'provider_label', sortable: false },
  { title: t('air_provider_accounts.col_environment') as string, key: 'environment', sortable: false },
  { title: t('air_provider_accounts.col_capabilities') as string, key: 'capabilities', sortable: false },
  { title: t('air_provider_accounts.col_coverage') as string, key: 'coverage', sortable: false },
  { title: t('air_provider_accounts.col_health') as string, key: 'health', sortable: false },
]);
const sortKeyMap: Record<string, string> = {};

function providerColor(provider: AirProvider): string {
  return provider === 'afkl' ? 'indigo' : 'teal';
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await airProviderAccountsService.list(filters.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function openDetail(account: AirProviderAccount): void {
  selectedAccount.value = account;
  detailOpen.value = true;
}

onMounted(load);
</script>
