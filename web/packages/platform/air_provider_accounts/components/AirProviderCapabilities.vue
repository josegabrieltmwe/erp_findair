<template>
  <div class="d-flex flex-wrap ga-1">
    <v-chip
      v-for="cap in capabilities"
      :key="cap.code"
      size="x-small"
      variant="tonal"
      :color="cap.active === false ? undefined : 'primary'"
    >
      <!-- Icono ADEMÁS del color: el estado no puede depender solo del color
           (accesibilidad), y "sin secreto" es información, no decoración. -->
      <v-icon v-if="cap.has_secret" :icon="mdiKey" size="12" start />
      <v-icon v-else-if="cap.code !== 'realtime'" :icon="mdiKeyRemove" size="12" start />
      {{ t(`air_provider_accounts.capability.${cap.code}`, cap.code) }}
      <span v-if="cap.source_refs.length > 1" class="ms-1 text-caption">
        ×{{ cap.source_refs.length }}
      </span>
    </v-chip>
    <span v-if="!capabilities.length" class="text-caption text-medium-emphasis">—</span>
  </div>
</template>

<script setup lang="ts">
/**
 * Capacidades de una cuenta. Una capacidad puede estar respaldada por
 * VARIAS filas físicas (una key por mercado); el `×N` lo dice sin repetir
 * el chip, que es como se veía antes ("published, published, published").
 */
import { useI18n } from 'vue-i18n';
import { mdiKey, mdiKeyRemove } from '@mdi/js';
import type { AirCapability } from '../services/airProviderAccounts.service';

defineProps<{ capabilities: AirCapability[] }>();
const { t } = useI18n();
</script>
