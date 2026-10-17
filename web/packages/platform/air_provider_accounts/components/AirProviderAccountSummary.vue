<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-2 mb-3">
      <v-chip size="small" variant="tonal" :color="account.provider === 'afkl' ? 'indigo' : 'teal'">
        {{ account.provider_label }}
      </v-chip>
      <v-chip
        size="small"
        variant="tonal"
        :color="account.environment === 'production' ? 'error' : undefined"
      >
        {{ t(`air_provider_accounts.env.${account.environment}`) }}
      </v-chip>
      <AirProviderHealthChip :health="account.health" />
      <v-spacer />
      <span class="text-caption text-medium-emphasis font-monospace">{{ account.account_key }}</span>
    </div>

    <v-row dense>
      <v-col cols="12" sm="6">
        <div class="text-caption text-medium-emphasis">
          {{ t('air_provider_accounts.col_capabilities') }}
        </div>
        <AirProviderCapabilities :capabilities="account.capabilities" />
      </v-col>
      <v-col cols="12" sm="6">
        <div class="text-caption text-medium-emphasis">
          {{ t('air_provider_accounts.col_coverage') }}
        </div>
        <AirProviderCoverage :coverage="account.coverage" />
      </v-col>
    </v-row>

    <!-- Representación: solo WebCargo realtime. El party AV/DQ declara ante el
         proveedor quién cotiza en nombre de quién, así que no es un detalle
         técnico: determina quién factura. -->
    <template v-if="account.representations.length">
      <div class="text-caption text-medium-emphasis mt-3">
        {{ t('air_provider_accounts.representations') }}
      </div>
      <v-table density="compact" class="mt-1">
        <thead>
          <tr>
            <th>{{ t('air_provider_accounts.col_country') }}</th>
            <th>AV</th>
            <th>DQ</th>
            <th>{{ t('air_provider_accounts.col_av_country') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in account.representations" :key="i">
            <td>{{ r.country_iso }}</td>
            <td class="font-monospace">{{ r.av }}</td>
            <td class="font-monospace">{{ r.dq }}</td>
            <td>{{ r.av_country }}</td>
          </tr>
        </tbody>
      </v-table>
    </template>

    <v-alert
      v-for="(w, i) in account.health.warnings"
      :key="`w${i}`"
      type="warning"
      variant="tonal"
      density="compact"
      class="mt-3"
    >
      {{ t(`air_provider_accounts.warning.${w.code}`, w.code) }}
      <span v-if="w.detail" class="text-caption"> — {{ w.detail }}</span>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
/**
 * Resumen de una cuenta: capacidades, cobertura, representación y
 * problemas. No muestra ningún secreto — el backend no los devuelve.
 */
import { useI18n } from 'vue-i18n';
import AirProviderCapabilities from './AirProviderCapabilities.vue';
import AirProviderCoverage from './AirProviderCoverage.vue';
import AirProviderHealthChip from './AirProviderHealthChip.vue';
import type { AirProviderAccount } from '../services/airProviderAccounts.service';

defineProps<{ account: AirProviderAccount }>();
const { t } = useI18n();
</script>
