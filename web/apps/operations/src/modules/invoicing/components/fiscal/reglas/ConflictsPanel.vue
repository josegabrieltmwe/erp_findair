<template>
  <div class="conflicts-panel" role="region" :aria-label="title">
    <v-progress-linear v-if="loading" indeterminate class="mb-2" />
    <v-alert
      v-if="error"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      {{ error }}
    </v-alert>

    <div
      v-if="!loading && !error && conflictos.length === 0"
      class="text-body-2 text-medium-emphasis"
    >
      <v-icon icon="mdi-check-circle-outline" size="16" color="success" />
      {{ t("invoicing.fiscal.reglas.conflictos.ninguno") }}
    </div>

    <v-alert
      v-for="c in conflictos"
      :key="`${c.id_a}-${c.id_b}`"
      :type="c.gravedad === 'aviso' ? 'warning' : 'info'"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      <div class="d-flex flex-wrap align-center ga-2 mb-1">
        <strong>{{ nombre(c.codigo_a, c.id_a) }}</strong>
        <v-icon icon="mdi-swap-horizontal" size="16" aria-hidden="true" />
        <strong>{{ nombre(c.codigo_b, c.id_b) }}</strong>
        <v-chip size="x-small" variant="outlined">
          {{ t(`invoicing.fiscal.reglas.politica.${c.politica}`) }}
        </v-chip>
        <v-chip
          size="x-small"
          variant="tonal"
          :color="c.certeza === 'segura' ? 'warning' : undefined"
        >
          {{ t(`invoicing.fiscal.reglas.conflictos.certeza_${c.certeza}`) }}
        </v-chip>
      </div>
      <div class="text-body-2">{{ c.motivo }}</div>
      <div class="text-caption text-medium-emphasis">
        {{
          t("invoicing.fiscal.reglas.conflictos.solape", {
            desde: c.solape.desde,
            hasta: c.solape.hasta ?? t("invoicing.fiscal.open"),
          })
        }}
        <template v-if="c.nota"> · {{ c.nota }}</template>
      </div>
      <div
        v-if="c.politica === 'fijar' && c.ganadora !== null"
        class="text-caption mt-1"
      >
        {{
          t("invoicing.fiscal.reglas.conflictos.gana", {
            regla: ganadoraNombre(c),
          })
        }}
      </div>
      <div v-else-if="c.orden.length" class="text-caption mt-1">
        {{
          t("invoicing.fiscal.reglas.conflictos.orden", {
            orden: c.orden.map((id) => nombreDe(c, id)).join(" → "),
          })
        }}
      </div>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
/**
 * ConflictsPanel — conflictos entre reglas (`op=conflictos`, F6b): dos reglas
 * de la misma etapa y grupo cuyo ámbito, vigencia y condición pueden coincidir
 * en una factura. Con política «fijar» dice cuál gana y por qué; con
 * «acumular», el orden de aplicación; con «bloquear» es solo informativo.
 * Se usa en el asistente (la regla en construcción) y en el listado (todas).
 *
 * Props: `conflictos` (los de la API), `loading`, `error` (texto si falló la
 * consulta), `title` (etiqueta de accesibilidad de la región).
 * Emits: ninguno.
 *
 * Ejemplo:
 *   <ConflictsPanel :conflictos="res.conflictos" :loading="loading" />
 */
import { useI18n } from "vue-i18n";
import type { ReglaConflicto } from "../../../services/fiscReglas.service";

withDefaults(
  defineProps<{
    conflictos: ReglaConflicto[];
    loading?: boolean;
    error?: string | null;
    title?: string;
  }>(),
  { loading: false, error: null, title: "" },
);

const { t } = useI18n();

/** Nombre mostrado de una regla: su código o, si no tiene (regla sin guardar), «nueva regla». */
function nombre(codigo: string, id: number): string {
  if (id === 0) return t("invoicing.fiscal.reglas.conflictos.nueva");
  return codigo || `#${id}`;
}

function nombreDe(c: ReglaConflicto, id: number): string {
  return id === c.id_a
    ? nombre(c.codigo_a, c.id_a)
    : nombre(c.codigo_b, c.id_b);
}

function ganadoraNombre(c: ReglaConflicto): string {
  return nombreDe(c, c.ganadora ?? 0);
}
</script>
