<script setup lang="ts">
/**
 * Error de reserva/cancelación, en un idioma que el operador entiende.
 *
 * Antes la tarjeta interpolaba `store.error` tal cual, que es el texto en
 * inglés que devuelve el carrier — y en el peor caso su JSON crudo:
 *
 *   {"code":"D18","name":"AWB format is not invalid",
 *    "description":"AWB format must be 11 digits"}
 *
 * El `error_code` sí viajaba en la respuesta, pero el store lo descartaba, así
 * que no había forma de elegir un mensaje propio. Con el código disponible se
 * muestra una frase traducida que dice qué hacer, y el texto técnico queda
 * detrás de un desplegable para quien lo necesite al depurar.
 *
 * Sirve a KLM y a WebCargo sin ramas: el enrutado por carrier ocurre aguas
 * arriba, en el store, y ambos escriben en los mismos refs.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  /** Texto devuelto por el backend/carrier. */
  message?: string | null;
  /** Código estable del backend (QUOTE_EXPIRED, AWB_PREFIX_MISSING, …). */
  code?: string | null;
  /**
   * Resultado DESCONOCIDO (timeout): ni éxito ni fallo. Se pinta como aviso,
   * no como error, porque decir "ha fallado" cuando el carrier pudo completar
   * la operación es justo lo que lleva a reintentar y duplicar la reserva.
   */
  indeterminate?: boolean;
}>();

const { t, te } = useI18n();

const detailOpen = ref(false);

const BASE = "cargo.flightmgr.booking_error";

/**
 * Mensaje traducido para el código, si lo hay.
 *
 * `te()` antes que `t()` a propósito: con una clave inexistente, vue-i18n
 * devuelve la propia clave, y pintar "cargo.flightmgr.booking_error.X_Y" sería
 * peor que el texto crudo del carrier. Un código sin traducir cae al mensaje
 * genérico y el detalle técnico sigue estando a un clic.
 */
const friendly = computed<string>(() => {
  const code = (props.code ?? "").trim();
  if (code && te(`${BASE}.${code}`)) {
    return t(`${BASE}.${code}`);
  }
  return t(`${BASE}.generic`);
});

/** El texto del carrier sólo aporta si dice algo distinto del mensaje propio. */
const hasDetail = computed<boolean>(() => {
  const raw = (props.message ?? "").trim();
  return raw !== "" && raw !== friendly.value;
});
</script>

<template>
  <v-alert
    :type="indeterminate ? 'warning' : 'error'"
    variant="tonal"
    density="compact"
    class="mt-2"
  >
    <div class="text-body-2 font-weight-medium">
      {{ t(`${BASE}.title`) }}
    </div>
    <div class="text-body-2">{{ friendly }}</div>

    <!-- El texto crudo del carrier: útil para diagnosticar, ruido para operar.
         Por eso va plegado y no como cuerpo del aviso. -->
    <template v-if="hasDetail">
      <button
        type="button"
        class="be-toggle text-caption"
        @click="detailOpen = !detailOpen"
      >
        {{ detailOpen ? t(`${BASE}.detail_hide`) : t(`${BASE}.detail_show`) }}
      </button>
      <div v-if="detailOpen" class="be-detail text-caption mt-1">
        <div v-if="code" class="font-weight-medium">{{ code }}</div>
        <div>{{ message }}</div>
      </div>
    </template>
  </v-alert>
</template>

<style scoped lang="scss">
.be-toggle {
  margin-top: 4px;
  padding: 0;
  background: none;
  border: 0;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  opacity: 0.85;
}
.be-toggle:hover {
  opacity: 1;
}
/* El mensaje del carrier puede ser un JSON de una sola línea muy larga: que
   rompa y haga scroll dentro del aviso en vez de ensanchar la tarjeta. */
.be-detail {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  opacity: 0.9;
}
</style>
