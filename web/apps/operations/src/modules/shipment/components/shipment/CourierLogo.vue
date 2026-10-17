<template>
  <!-- Logo del corriere/fornitore por su id de anagrafica. Las imágenes son
       estáticas en /erp/images/corr_{id_fornitore}.png (mismas que usa el
       listado legacy spedy_list.php), servidas por HTTP — no hay servicio
       externo. Si el archivo no existe o falla la carga, no se muestra nada
       y se emite @fallback para que el padre pinte el badge/icono. -->
  <v-img
    v-if="src && !failed"
    :src="src"
    :alt="alt || String(id)"
    :width="size"
    :height="size"
    :aspect-ratio="1"
    class="courier-logo"
    contain
    @error="onError"
  >
    <template #error><span /></template>
  </v-img>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    /** id_fornitore (id de anagrafica del corriere, ej. 3=DHL, 7=UPS, 8=FedEx). */
    id?: string | number | null;
    /** Texto alternativo (nombre del corriere). */
    alt?: string | null;
    /** Tamaño en px (cuadrado). */
    size?: number;
  }>(),
  {
    id: "",
    alt: "",
    size: 26,
  },
);

const emit = defineEmits<{
  /** No hay id o la imagen no pudo cargarse. */
  (e: "fallback"): void;
}>();

const failed = ref(false);

// Reintentar la carga si cambia el corriere.
watch(
  () => props.id,
  () => {
    failed.value = false;
  },
);

const src = computed(() => {
  const raw = String(props.id ?? "").trim();
  // Solo ids numéricos > 0 tienen logo (corr_{id}.png).
  return /^\d+$/.test(raw) && Number(raw) > 0
    ? `/erp/images/corr_${raw}.png`
    : "";
});

function onError(): void {
  failed.value = true;
  emit("fallback");
}
</script>

<style scoped>
.courier-logo {
  border-radius: 4px;
  flex: 0 0 auto;
}
</style>
