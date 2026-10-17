<template>
  <!--
    El tab-bar quedó con una sola pestaña ("Resumen") tras mover vuelos/MAWB/
    HAWB a modales; con una sola vista el selector de tabs sobra. Se elimina el
    botón de tab y se conserva únicamente la barra de mini-estado (útil: muestra
    el estado y abre el modal 'stato').
  -->
  <nav class="tabbar tabbar--status-only">
    <CargoMiniStatusBar @click="ui.openModal('stato')" />
  </nav>
</template>

<script setup lang="ts">
import { useUiStore } from "@cargo/stores/ui.store";
import CargoMiniStatusBar from "@cargo/components/shell/CargoMiniStatusBar.vue";

const ui = useUiStore();
</script>

<style scoped>
/* Sin botones de tab: la barra solo aloja el mini-estado, alineado al inicio. */
.tabbar--status-only {
  display: flex;
  align-items: center;
}
</style>
