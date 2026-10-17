<template>
  <div class="pa-4">
    <DatosFiscalesPanel :id="Number(idAnagrafica)" :tipo="tipo" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EntidadTipo } from "../../services/fiscConfig.service";
import DatosFiscalesPanel from "./DatosFiscalesPanel.vue";

/**
 * Pestaña «Datos fiscales» de la ficha de anagrafica (contrato `extraTabs`
 * de @shared/anagrafiche). Partner (P) y la casa TMWE (I) muestran sus
 * datos de emisor; el resto, los de cliente.
 */
const props = defineProps<{
  idAnagrafica: number;
  record?: { tipo?: string } | null;
}>();

defineEmits<{ refresh: [] }>();

const tipo = computed<EntidadTipo>(() => {
  const t = String(props.record?.tipo ?? "").toUpperCase();
  return t === "P" || t === "I" ? "partner" : "cliente";
});
</script>
