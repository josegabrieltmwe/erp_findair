<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import DriverManifestSheet from "../components/DriverManifestSheet.vue";
import {
  filterManifest,
  manifestKindFilter,
  type ManifestKindFilter,
} from "../logic";
import { driverService } from "../services/driver.service";
import type { Manifest } from "../types";

/**
 * Borderò de un autista para imprimir o guardar como PDF (U-19). Se abre en una pestaña nueva desde el icono de
 * impresora de cada autista del tablero (`/pickup/schedule`), como el `bordero.php` del legado, que también se
 * abría en otra ventana y lanzaba la impresión. El documento es el mismo de `/pickup/routes`
 * (`api_driver_manifest` + `DriverManifestSheet`). Query: `driver_id`, `date` (AAAA-MM-DD), `tipo` (`R` solo
 * recogidas, `C` solo entregas; sin él, todas: U-20, como la casilla del legado) y `print=0` para no lanzar la
 * impresión. El selector de tipo de la pestaña no sale en el papel.
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const manifest = ref<Manifest | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const kind = computed<ManifestKindFilter>(() =>
  manifestKindFilter(route.query.tipo),
);
const shown = computed(() =>
  manifest.value ? filterManifest(manifest.value, kind.value) : null,
);
const filterLabel = computed(() =>
  kind.value === "all" ? "" : t(`pickup.manifest.filter_${kind.value}`),
);

function setKind(v: ManifestKindFilter): void {
  const query = { ...route.query, print: "0" } as Record<string, string>;
  if (v === "all") delete query.tipo;
  else query.tipo = v;
  void router.replace({ query });
}

function queryString(key: string): string {
  const v = route.query[key];
  return typeof v === "string" ? v : "";
}

onMounted(async () => {
  const driverId = Number(queryString("driver_id"));
  const date = queryString("date");
  if (
    !Number.isInteger(driverId) ||
    driverId <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    error.value = t("pickup.manifest.bad_link");
    loading.value = false;
    return;
  }
  try {
    manifest.value = await driverService.manifest(driverId, date);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    loading.value = false;
  }
  if (
    shown.value &&
    shown.value.stops.length > 0 &&
    queryString("print") !== "0"
  ) {
    await nextTick();
    // Deja pintar los códigos de barras (imágenes SVG) antes de abrir el diálogo de impresión.
    window.setTimeout(() => window.print(), 300);
  }
});
</script>

<template>
  <div class="pk-page">
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />
    <v-alert
      v-else-if="error"
      type="error"
      variant="tonal"
      density="compact"
      data-testid="manifest-print-error"
    >
      {{ error }}
    </v-alert>
    <template v-else-if="shown">
      <v-btn-toggle
        :model-value="kind"
        mandatory
        density="compact"
        variant="outlined"
        divided
        class="pk-noprint mb-3"
        data-testid="manifest-kind"
        @update:model-value="setKind"
      >
        <v-btn value="all" size="small">{{
          t("pickup.manifest.filter_all")
        }}</v-btn>
        <v-btn value="R" size="small">{{
          t("pickup.manifest.filter_R")
        }}</v-btn>
        <v-btn value="C" size="small">{{
          t("pickup.manifest.filter_C")
        }}</v-btn>
      </v-btn-toggle>
      <v-alert
        v-if="shown.stops.length === 0"
        type="info"
        variant="tonal"
        density="compact"
        data-testid="manifest-print-empty"
      >
        {{
          kind === "all"
            ? t("pickup.manifest.empty", {
                name: shown.driver.nome,
                date: shown.date,
              })
            : t("pickup.manifest.empty_kind", {
                name: shown.driver.nome,
                date: shown.date,
                kind: filterLabel,
              })
        }}
      </v-alert>
      <DriverManifestSheet
        v-else
        :manifest="shown"
        :filter-label="filterLabel"
      />
    </template>
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
}
</style>
