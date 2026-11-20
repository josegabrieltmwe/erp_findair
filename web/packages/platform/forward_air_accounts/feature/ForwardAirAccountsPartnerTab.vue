<template>
  <ForwardAirAccountsPage scope="admin" :partner-id="idAnagrafica" />
</template>

<script setup lang="ts">
/** Pestaña de la ficha de anagrafica: las cuentas de Forward Air de ESTE partner (administración de TMWE). */
import ForwardAirAccountsPage from './ForwardAirAccountsPage.vue';

defineProps<{ idAnagrafica: number }>();
</script>
