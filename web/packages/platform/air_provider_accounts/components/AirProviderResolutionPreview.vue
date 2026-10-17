<template>
  <div>
    <div class="text-subtitle-2 mb-1">
      {{ t('air_provider_accounts.preview_title') }}
    </div>
    <div class="text-caption text-medium-emphasis mb-3">
      {{ t('air_provider_accounts.preview_hint') }}
    </div>

    <div class="cm-filters mb-3">
      <v-select
        v-model="capability"
        :items="capabilityItems"
        :label="t('air_provider_accounts.preview_capability')"
        density="compact"
        hide-details
      />
      <v-text-field
        v-model="origin"
        :label="t('air_provider_accounts.preview_origin')"
        density="compact"
        hide-details
        maxlength="3"
        style="max-width: 120px"
      />
      <v-text-field
        v-model="destination"
        :label="t('air_provider_accounts.preview_destination')"
        density="compact"
        hide-details
        maxlength="3"
        style="max-width: 120px"
      />
      <v-btn color="primary" :loading="loading" :disabled="!capability" @click="run">
        {{ t('air_provider_accounts.preview_run') }}
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" density="compact">{{ error }}</v-alert>

    <template v-if="result">
      <!-- No resuelve: es información, no un fallo. Significa que una búsqueda
           real con esos datos tampoco encontraría cuenta. -->
      <v-alert v-if="!result.resolved" type="warning" variant="tonal" density="compact">
        {{ result.error || t('air_provider_accounts.preview_unresolved') }}
      </v-alert>

      <template v-else>
        <v-card variant="tonal" color="primary" class="pa-3 mb-3">
          <div class="text-caption">{{ t('air_provider_accounts.preview_chosen') }}</div>
          <div class="text-subtitle-1 font-weight-medium">
            {{ result.owner_name || t('air_provider_accounts.house_account') }}
          </div>
          <div class="text-caption font-monospace">
            {{ result.credential_ref?.source }} #{{ result.credential_ref?.id }}
            · {{ result.route?.origin_country }} → {{ result.route?.destination_country }}
          </div>
          <div class="d-flex flex-wrap ga-1 mt-2">
            <v-chip v-for="r in result.reason_codes ?? []" :key="r" size="x-small" variant="flat">
              {{ t(`air_provider_accounts.reason.${r}`, r) }}
            </v-chip>
          </div>
        </v-card>

        <!-- Los avisos son el motivo por el que existe el simulador: un
             fallback o una credencial de entorno FUNCIONAN, pero no significan
             que el partner esté configurado. -->
        <v-alert
          v-for="(w, i) in result.warnings"
          :key="`pw${i}`"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          {{ t(`air_provider_accounts.warning.${w.code}`, w.code) }}
          <span v-if="w.detail" class="text-caption"> — {{ w.detail }}</span>
        </v-alert>

        <!-- Las descartadas explican por qué NO se eligió la cuenta que el
             administrador esperaba, que suele ser la pregunta real. -->
        <template v-if="result.discarded?.length">
          <div class="text-caption text-medium-emphasis mt-3 mb-1">
            {{ t('air_provider_accounts.preview_discarded') }}
          </div>
          <v-table density="compact">
            <tbody>
              <tr v-for="(d, i) in result.discarded" :key="`d${i}`">
                <td>{{ d.partner_name || `#${d.partner_id}` }}</td>
                <td class="font-monospace text-caption">#{{ d.ref_id }}</td>
                <td class="text-caption text-medium-emphasis">
                  {{ discardReason(d) }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </template>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Simulador de resolución.
 *
 * Responde la pregunta que hoy no se puede contestar desde la pantalla:
 * qué credencial usará una búsqueda real, y por qué. El backend reutiliza
 * los resolutores de producción, así que lo que aquí se ve es lo que
 * pasará — verificado con 6/6 de paridad contra tarifas ya emitidas.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  airProviderAccountsService,
  type AirProviderAccount,
  type AirResolvePreview,
  type AirPreviewDiscarded,
} from '../services/airProviderAccounts.service';

const props = defineProps<{ account: AirProviderAccount }>();
const { t } = useI18n();

const capability = ref<string>('');
const origin = ref('');
const destination = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<AirResolvePreview | null>(null);

/** Solo las capacidades que esta cuenta declara: preguntar por otras mentiría. */
const capabilityItems = computed(() =>
  props.account.capabilities.map((c) => ({
    title: t(`air_provider_accounts.capability.${c.code}`, c.code),
    value: c.code,
  })),
);

watch(
  () => props.account.account_key,
  () => {
    capability.value = props.account.capabilities[0]?.code ?? '';
    // Semilla razonable: el primer país cubierto suele ser el que el
    // administrador quiere comprobar.
    origin.value = '';
    destination.value = '';
    result.value = null;
    error.value = null;
  },
  { immediate: true },
);

/**
 * Por qué se descartó una candidata.
 *
 * `reasons` son los códigos de precedencia que la candidata SÍ cumplía
 * (`destination`, `origin`…): la descartada perdió porque otra ganó por un
 * criterio anterior. `why_not` es un campo opcional de `Account_Candidate`
 * que hoy ningún resolutor rellena, así que solo se muestra si algún día
 * llega.
 */
function discardReason(d: AirPreviewDiscarded): string {
  if (d.why_not) return d.why_not;
  const reasons = (d.reasons ?? []).map((r) => t(`air_provider_accounts.reason.${r}`, r));
  return reasons.length
    ? t('air_provider_accounts.preview_matched_by', { reasons: reasons.join(', ') })
    : '';
}

async function run(): Promise<void> {
  loading.value = true;
  error.value = null;
  result.value = null;
  try {
    result.value = await airProviderAccountsService.resolvePreview({
      provider: props.account.provider,
      capability: capability.value,
      requesting_partner_id: props.account.owner.partner_id,
      origin: origin.value.toUpperCase(),
      destination: destination.value.toUpperCase(),
      environment: props.account.environment,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}
</script>
