<template>
  <RouteStatsPanelShared
    :country="country"
    :cap="cap"
    :city="city"
    :fetcher="fetcher"
  />
</template>

<script setup lang="ts">
import RouteStatsPanelShared from "@shared/detail/RouteStatsPanel.vue";
import { routeStatsService } from "@cargo/services/route_stats.service";

defineProps<{ country?: string; cap?: string; city?: string }>();

// Cargo route-stats service uses .get(country, cap, city).
const fetcher = (p: { country: string; cap: string; city: string }) =>
  routeStatsService.get(p.country, p.cap, p.city);
</script>
