<template>
  <div class="pa-4">
    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && accounts.length === 0"
      :data="accounts"
      loading-type="skeleton"
      :skeleton-rows="3"
      :skeleton-cols="3"
      @clear-error="error = null"
    >
      <template #empty>
        <v-alert type="info" variant="tonal" density="compact">
          {{ t('air_provider_accounts.tab_empty') }}
        </v-alert>
      </template>

      <template #default>
        <!-- Agrupado por NATURALEZA, no por tabla de origen: el administrador
             piensa en "carga aérea" y "couriers", no en webcargo_key ni
             air_carrier_credentials. -->
        <div v-for="group in groups" :key="group.category" class="mb-6">
          <div class="text-subtitle-2 mb-2">
            {{ t(`air_provider_accounts.category.${group.category}`) }}
          </div>

          <v-card
            v-for="account in group.accounts"
            :key="account.account_key"
            variant="outlined"
            class="mb-3"
          >
            <div class="d-flex align-center pa-3 ga-3">
              <v-chip size="small" variant="tonal" :color="providerColor(account.provider)">
                {{ account.provider_label }}
              </v-chip>
              <v-chip
                size="x-small"
                variant="tonal"
                :color="account.environment === 'production' ? 'error' : undefined"
              >
                {{ t(`air_provider_accounts.env.${account.environment}`) }}
              </v-chip>
              <AirProviderCoverage :coverage="account.coverage" compact />
              <v-spacer />
              <AirProviderHealthChip :health="account.health" />
              <v-btn
                variant="text"
                size="small"
                :append-icon="expanded === account.account_key ? mdiChevronUp : mdiChevronDown"
                @click="toggle(account.account_key)"
              >
                {{ t('air_provider_accounts.tab_details') }}
              </v-btn>
            </div>

            <v-expand-transition>
              <div v-if="expanded === account.account_key">
                <v-divider />
                <div class="pa-3">
                  <AirProviderAccountSummary :account="account" />
                  <v-divider class="my-4" />
                  <AirProviderResolutionPreview :account="account" />
                </div>
              </div>
            </v-expand-transition>
          </v-card>
        </div>

        <!-- Las categorías aún sin implementar se anuncian en vez de omitirse:
             una sección vacía se lee como "no tiene", que sería falso. -->
        <v-alert type="info" variant="tonal" density="compact" class="mt-2">
          {{ t('air_provider_accounts.tab_courier_pending') }}
        </v-alert>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
/**
 * Pestaña «Credenciales» de la ficha de anagráfica — Fase A-bis del plan
 * de deprecación de `admin_config`.
 *
 * Es una VISTA CONTEXTUAL del mismo inventario que sirve
 * `AirProviderAccountsPage`: mismo servicio, mismos sub-componentes,
 * mismo endpoint de solo lectura. Aquí el partner viene fijado por la
 * ruta y no se puede cambiar, que es la diferencia con la pantalla
 * global.
 *
 * Se registra en `anagraficaExtraTabs.ts` vía el contrato `extraTabs`
 * (packages/platform/anagrafiche/utils/extraTabs.ts).
 *
 * Portado desde
 * `admin_config/src/features/air_provider_accounts/AnagraficaCredenzialiSection.vue`.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiChevronDown, mdiChevronUp } from '@mdi/js';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import AirProviderAccountSummary from '../components/AirProviderAccountSummary.vue';
import AirProviderCoverage from '../components/AirProviderCoverage.vue';
import AirProviderHealthChip from '../components/AirProviderHealthChip.vue';
import AirProviderResolutionPreview from '../components/AirProviderResolutionPreview.vue';
import {
  airProviderAccountsService,
  type AirProviderAccount,
  type AirProvider,
} from '../services/airProviderAccounts.service';

/** Props que entrega `AnagraficaDetailPage` a toda pestaña extra. */
const props = defineProps<{ idAnagrafica: number }>();

const { t } = useI18n();

const accounts = ref<AirProviderAccount[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const expanded = ref<string | null>(null);

/**
 * Hoy el inventario solo cubre carga aérea. La agrupación existe ya para
 * que añadir couriers no obligue a rehacer la pestaña.
 */
const groups = computed(() => {
  if (!accounts.value.length) return [];
  return [{ category: 'air_cargo', accounts: accounts.value }];
});

function providerColor(provider: AirProvider): string {
  return provider === 'afkl' ? 'indigo' : 'teal';
}

function toggle(key: string): void {
  expanded.value = expanded.value === key ? null : key;
}

async function load(): Promise<void> {
  if (!props.idAnagrafica) return;
  loading.value = true;
  error.value = null;
  try {
    accounts.value = await airProviderAccountsService.list({
      owner_partner_id: props.idAnagrafica,
      include_inactive: true,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

// La ficha reutiliza el componente al navegar entre anagráficas sin remontarlo.
watch(() => props.idAnagrafica, load);
onMounted(load);
</script>
