<template>
  <div class="d-flex align-center ga-1">
    <v-chip size="small" variant="tonal" :color="color">
      <v-icon :icon="icon" size="13" start />
      {{ t(`air_provider_accounts.health.${health.status}`, health.status) }}
    </v-chip>
    <v-tooltip v-if="health.warnings.length" location="top">
      <template #activator="{ props: tp }">
        <v-chip v-bind="tp" size="x-small" variant="tonal" color="warning">
          <v-icon :icon="mdiAlert" size="12" start />{{ health.warnings.length }}
        </v-chip>
      </template>
      <div v-for="(w, i) in health.warnings" :key="i" class="text-caption">
        {{ t(`air_provider_accounts.warning.${w.code}`, w.code) }}
        <span v-if="w.detail">— {{ w.detail }}</span>
      </div>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
/**
 * Salud canónica.
 *
 * `not_verified` NO se pinta en rojo: es el estado normal mientras no haya
 * prueba de conexión (Incremento 6). Que exista un secreto no prueba que
 * autentique, así que teñir de verde una cuenta solo por estar rellenada
 * sería exactamente la confusión que el diagnóstico señala.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiAlert, mdiCheckCircle, mdiHelpCircleOutline, mdiCloseCircle, mdiCogOutline } from '@mdi/js';
import type { AirProviderAccount } from '../services/airProviderAccounts.service';

const props = defineProps<{ health: AirProviderAccount['health'] }>();
const { t } = useI18n();

const color = computed(() => {
  switch (props.health.status) {
    case 'healthy': return 'success';
    case 'incomplete': return 'warning';
    case 'failed':
    case 'expired': return 'error';
    default: return undefined;
  }
});

const icon = computed(() => {
  switch (props.health.status) {
    case 'healthy': return mdiCheckCircle;
    case 'incomplete': return mdiAlert;
    case 'failed':
    case 'expired': return mdiCloseCircle;
    case 'environment_managed': return mdiCogOutline;
    default: return mdiHelpCircleOutline;
  }
});
</script>
