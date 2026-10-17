<template>
  <!-- Logo/cola de la aerolínea por su código IATA. Las imágenes son estáticas
       en /erp/tmwe_client_aircargo/images/{IATA}.jpg (46 aerolíneas), servidas
       por HTTP — no hay llamada a servicio externo.

       Si el archivo no existe o falla la carga se muestra la cola genérica de
       TMWE (tmwe.jpg), no un hueco: una fila sin imagen se lee como "falta un
       dato", cuando lo que ocurre es que esa aerolínea no tiene cola propia
       en el catálogo. Con `:fallback-src="null"` no se intenta la genérica y
       se cae directo al contenido del slot `placeholder`.

       GEMELO: packages/platform/anagrafiche/components/CmAirlineTail.vue es una
       réplica de este componente (no puede importarlo: ese paquete se consume
       vía `@shared/anagrafiche` y no puede depender de un módulo del host). Lo
       que se arregle aquí hay que arreglarlo allí. -->

  <!-- La caja se reserva SIEMPRE, tenga imagen o no.

       Antes el root era el propio `v-img` con `v-if="src"`, asi que cuando la
       genérica tambien fallaba el componente no renderizaba NADA y desaparecia
       del flujo flex: la fila perdia el ancho del logo mas el `gap` del padre y
       su contenido arrancaba desplazado a la izquierda respecto de las demas.
       En una tabla de resultados eso se lee como una sangria aleatoria.

       Con el contenedor fijo el hueco se mantiene y las filas quedan alineadas
       aunque falte la imagen. -->
  <div
    class="airline-logo"
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
    <!-- Sin imagen: el avion generico. El cargo SIEMPRE es aereo, asi que el
         icono no inventa informacion — solo ocupa el sitio. `slot` para que un
         consumidor pueda poner el suyo sin que salgan dos. -->
    <slot v-else name="placeholder">
      <v-icon icon="mdi-airplane" :size="Math.round(size * 0.62)" />
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

/** Cola genérica: la que se usa cuando la aerolínea no tiene la suya. */
const DEFAULT_FALLBACK = "/erp/tmwe_client_aircargo/images/tmwe.jpg";

const props = withDefaults(
  defineProps<{
    /** Código IATA de la aerolínea (ej. 'LH', 'AZ'). Case-insensitive. */
    code?: string | null;
    /** Tamaño en px (cuadrado). */
    size?: number;
    /**
     * Imagen a usar cuando no hay código o su cola no carga.
     * `null` = no mostrar nada (comportamiento anterior a 2026-08).
     */
    fallbackSrc?: string | null;
  }>(),
  {
    code: "",
    size: 28,
    fallbackSrc: DEFAULT_FALLBACK,
  },
);

const emit = defineEmits<{
  /** El código está vacío o la imagen no pudo cargarse. */
  (e: "fallback"): void;
}>();

const failed = ref(false);
/**
 * La genérica también falló.
 *
 * Sin este segundo flag, `onError` volvería a disparar sobre la propia
 * genérica y el componente quedaría pidiéndola en bucle.
 */
const fallbackFailed = ref(false);

// Reintentar la carga si cambia la aerolínea.
watch(
  () => props.code,
  () => {
    failed.value = false;
    fallbackFailed.value = false;
  },
);

function onError(): void {
  if (failed.value) {
    // Ya estábamos mostrando la genérica: no hay a qué caer.
    fallbackFailed.value = true;
    return;
  }
  failed.value = true;
  emit("fallback");
}

const src = computed(() => {
  const c = (props.code ?? "").trim().toUpperCase();
  const fallback = fallbackFailed.value ? "" : (props.fallbackSrc ?? "");

  if (!c || failed.value) {
    return fallback;
  }
  return `/erp/tmwe_client_aircargo/images/${c}.jpg`;
});
</script>

<style scoped>
.airline-logo {
  border-radius: 4px;
  /* `flex: 0 0 auto` NO basta para reservar sitio: sin caja explicita un
     contenedor vacio mide 0. El width/height inline (size) es lo que garantiza
     que la fila no se descoloque cuando no hay imagen. */
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
