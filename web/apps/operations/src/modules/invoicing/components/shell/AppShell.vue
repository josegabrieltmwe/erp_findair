<template>
  <!--
    Shell de la SPA de facturación. Barra de progreso superior reflejando el
    estado de carga de los stores de facturación + slot para la vista activa.
  -->
  <div class="invoicing-shell">
    <v-progress-linear
      v-if="busy"
      indeterminate
      color="primary"
      height="3"
      class="invoicing-shell__progress"
    />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useInvoiceStore } from "../../stores/invoice.store";
import { useInvoiceListStore } from "../../stores/invoice_list.store";

const detail = useInvoiceStore();
const list = useInvoiceListStore();

const busy = computed(() => detail.loading || detail.saving || list.loading);
</script>

<style scoped>
.invoicing-shell {
  position: relative;
  min-height: 100vh;
}
.invoicing-shell__progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2000;
}
</style>
