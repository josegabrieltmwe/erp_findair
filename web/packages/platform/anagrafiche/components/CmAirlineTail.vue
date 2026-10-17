<template>
  <!-- Cola de la aerolínea por su código IATA. Las imágenes son estáticas en
       /erp/tmwe_client_aircargo/images/{IATA}.jpg (46 aerolíneas), servidas por
       HTTP: no hay llamada a ningún servicio externo.

       Cuando la aerolínea no tiene cola propia se muestra la de TMWE, nunca un
       hueco: un espacio vacío se lee como "falta un dato" cuando lo que ocurre
       es que esa aerolínea no está en el catálogo de imágenes.

       Réplica local de modules/cargo/components/cargo/AirlineLogo.vue. No se
       importa aquél porque este paquete se consume vía `@shared/anagrafiche` y
       no puede depender de un módulo del host. Los arreglos hay que aplicarlos
       en LOS DOS: este es el gemelo, no una variante. -->
  <div
    class="cm-airline-tail"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="code || 'TMWE'"
  >
    <v-img
      v-if="src"
      :src="src"
      :alt="code || 'TMWE'"
      :width="size"
      :height="size"
      :aspect-ratio="1"
      cover
      @error="onError"
    >
      <template #error><span /></template>
    </v-img>
    <!-- Cuando la genérica tampoco carga, `src` queda vacío y el v-img pintaba
         una caja en blanco. El avión ocupa ese hueco: reserva el sitio (para
         que la fila no se descoloque) y dice qué debería haber ahí. -->
    <v-icon v-else icon="mdi-airplane" :size="Math.round(size * 0.62)" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

/** Cola genérica de TMWE: la que se usa cuando la aerolínea no tiene la suya. */
const TMWE_TAIL = '/erp/tmwe_client_aircargo/images/tmwe.jpg';

const props = withDefaults(
  defineProps<{
    /** Código IATA (ej. 'KL', 'AF'). Case-insensitive. */
    code?: string | null;
    /** Tamaño en px (cuadrado). */
    size?: number;
  }>(),
  { code: '', size: 26 },
);

const failed = ref(false);
/**
 * La genérica también falló. Sin este segundo flag `onError` volvería a
 * dispararse sobre la propia genérica y quedaría pidiéndola en bucle.
 */
const fallbackFailed = ref(false);

watch(
  () => props.code,
  () => {
    failed.value = false;
    fallbackFailed.value = false;
  },
);

function onError(): void {
  if (failed.value) {
    fallbackFailed.value = true;
    return;
  }
  failed.value = true;
}

const src = computed(() => {
  const c = (props.code ?? '').trim().toUpperCase();
  if (fallbackFailed.value) return '';
  if (!c || failed.value) return TMWE_TAIL;
  return `/erp/tmwe_client_aircargo/images/${c}.jpg`;
});
</script>

<style scoped>
.cm-airline-tail {
  border-radius: 4px;
  flex: 0 0 auto;
  background: rgba(255, 255, 255, 0.6);
  /* Centra el icono de reemplazo dentro de la caja reservada. */
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), 0.38);
}
</style>
