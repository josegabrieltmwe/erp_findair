<script lang="ts">
/**
 * Re-export del componente shell compartido (@shared/shell/NotFoundView.vue).
 * Implementación única en packages/platform (antes forkeada byte-idéntica
 * entre cargo/shipment). Consumidores conservan su import path local.
 */
export { default } from "@shared/shell/NotFoundView.vue";
</script>
