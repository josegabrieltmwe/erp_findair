<template>
  <div class="d-flex flex-wrap ga-1 align-center">
    <template v-for="c in coverage" :key="c.country_iso">
      <v-chip size="x-small" variant="outlined">
        <v-icon v-if="c.primary" :icon="mdiStar" size="11" start />
        {{ c.country_iso }}
        <span v-if="!compact && c.terminals.length" class="ms-1 text-caption">
          {{ c.terminals.join(' ') }}
        </span>
      </v-chip>
    </template>
    <span v-if="!coverage.length" class="text-caption text-medium-emphasis">—</span>
  </div>
</template>

<script setup lang="ts">
/**
 * Cobertura: dónde se puede usar la cuenta. La estrella marca la cuenta
 * principal del país, que es la que gana cuando hay varias.
 */
import { mdiStar } from '@mdi/js';
import type { AirCoverage } from '../services/airProviderAccounts.service';

withDefaults(defineProps<{ coverage: AirCoverage[]; compact?: boolean }>(), {
  compact: false,
});
</script>
