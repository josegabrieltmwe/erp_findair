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
import { routeStatsService } from "@shipment/services/route_stats.service";

defineProps<{ country?: string; cap?: string; city?: string }>();

// Express route-stats service uses .fetch({country, cap, city}).
const fetcher = (p: { country: string; cap: string; city: string }) =>
  routeStatsService.fetch(p);
</script>
