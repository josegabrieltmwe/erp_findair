<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import DriverManifestSheet from "../components/DriverManifestSheet.vue";
import { driverService } from "../services/driver.service";
import type { Manifest } from "../types";

/**
 * Borderò de un autista para imprimir o guardar como PDF (U-19). Se abre en una pestaña nueva desde el icono de
 * impresora de cada autista del tablero (`/pickup/schedule`), como el `bordero.php` del legado, que también se
 * abría en otra ventana y lanzaba la impresión. El documento es el mismo de `/pickup/routes`
 * (`api_driver_manifest` + `DriverManifestSheet`). Query: `driver_id`, `date` (AAAA-MM-DD), `print=0` para no
 * lanzar la impresión.
 */
const { t } = useI18n();
const route = useRoute();

const manifest = ref<Manifest | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

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
    manifest.value &&
    manifest.value.stops.length > 0 &&
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
    <template v-else-if="manifest">
      <v-alert
        v-if="manifest.stops.length === 0"
        type="info"
        variant="tonal"
        density="compact"
        data-testid="manifest-print-empty"
      >
        {{
          t("pickup.manifest.empty", {
            name: manifest.driver.nome,
            date: manifest.date,
          })
        }}
      </v-alert>
      <DriverManifestSheet v-else :manifest="manifest" />
    </template>
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
}
</style>
