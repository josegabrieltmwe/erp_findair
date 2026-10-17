<template>
  <div class="cm-page">
    <!-- Sin header propio: OperationsShell ya pone "Tracking" en el topbar
         (#topbar-title, vía activeDomain), y TrackingConsole trae su propio
         título + resumen de emails + botón de lanzar tracking -- un tercer
         bloque aquí repetía literalmente el mismo texto dos veces seguidas. -->
    <TrackingConsole />
  </div>
</template>

<script setup lang="ts">
import TrackingConsole from "../components/TrackingConsole.vue";
</script>
