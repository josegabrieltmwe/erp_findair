<template>
  <!--
    Host del módulo consolidata (mismo patrón que CargoHost / ShipmentHost).
    El listado es `fullscreen` (trae su propio DashboardShell); el detalle y el
    simulador se pintan dentro del shell común de operations. La key ignora la
    query para que `?view=ID` abra la vista previa sin remontar la página.
  -->
  <v-main v-if="fullscreen" class="cons-host-main">
    <router-view :key="$route.path" />
  </v-main>
  <router-view v-else :key="$route.path" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const fullscreen = computed(() => route.meta?.fullscreen === true);
</script>
