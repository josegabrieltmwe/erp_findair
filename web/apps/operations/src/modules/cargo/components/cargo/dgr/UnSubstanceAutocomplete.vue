<script lang="ts">
/**
 * Re-export del componente DGR compartido (@shared/dgr/UnSubstanceAutocomplete.vue).
 * Implementación única en packages/platform (antes idéntica cargo/shipment). El
 * catálogo UNR (searchDgrSubstances) es agnóstico al modo cargo/courier, por lo
 * que el componente vive en el package y ambas apps lo reexportan.
 */
export { default } from "@shared/dgr/UnSubstanceAutocomplete.vue";
</script>
