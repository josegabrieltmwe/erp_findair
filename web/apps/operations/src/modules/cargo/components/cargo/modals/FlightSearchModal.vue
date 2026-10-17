<template>
  <!--
    Sin ModalWrapper: la busqueda gestiona sus DOS dialogos (parametros y
    listado) y decide cual toca. Envolverla en un tercer marco dejaba un modal
    de 1100px vacio detras del formulario mientras no habia resultados.

    El canal `activeModal` del ui store sigue siendo el interruptor, pero aqui
    solo monta/desmonta el contenido.
  -->
  <CargoFlightSearch v-if="ui.activeModal === 'flight_search'" />
</template>

<script setup lang="ts">
import { useUiStore } from "@cargo/stores/ui.store";
import CargoFlightSearch from "@cargo/components/cargo/flight-search/CargoFlightSearch.vue";
const ui = useUiStore();
</script>
