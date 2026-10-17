<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { driverService } from "../services/driver.service";
import type { LdvLookup, PodPayload } from "../types";

const { t } = useI18n();

const ldv = ref("");
const looking = ref(false);
const shipment = ref<LdvLookup | null>(null);
const error = ref<string | null>(null);

// formulario de entrega
const esito = ref<"C" | "M">("C");
const note = ref("");
const firma = ref("");
const geo = ref<{ lat: number; lng: number } | null>(null);
const geoBusy = ref(false);
const saving = ref(false);
const done = ref(false);

async function lookup(): Promise<void> {
  const v = ldv.value.trim();
  if (!v) return;
  looking.value = true;
  error.value = null;
  done.value = false;
  shipment.value = null;
  try {
    shipment.value = await driverService.verifyLdv(v);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    looking.value = false;
  }
}

function captureGeo(): void {
  if (!navigator.geolocation) {
    error.value = t("pickup.pod.no_geo");
    return;
  }
  geoBusy.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      geo.value = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      geoBusy.value = false;
    },
    () => {
      error.value = t("pickup.pod.geo_failed");
      geoBusy.value = false;
    },
    { enableHighAccuracy: true, timeout: 8000 },
  );
}

async function register(): Promise<void> {
  if (!shipment.value) return;
  saving.value = true;
  error.value = null;
  try {
    const payload: PodPayload = {
      ldv: shipment.value.ldv,
      esito: esito.value,
      note: note.value || undefined,
      firma: firma.value || undefined,
      lat: geo.value?.lat ?? null,
      lng: geo.value?.lng ?? null,
    };
    await driverService.registerPod(payload);
    done.value = true;
    reset();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action");
  } finally {
    saving.value = false;
  }
}

function reset(): void {
  shipment.value = null;
  ldv.value = "";
  note.value = "";
  firma.value = "";
  geo.value = null;
  esito.value = "C";
}
</script>

<template>
  <div class="pk-page">
    <header class="pk-page-head">
      <h1 class="pk-page-title">{{ t("pickup.pod.title") }}</h1>
    </header>

    <v-alert
      v-if="done"
      type="success"
      variant="tonal"
      density="compact"
      closable
      class="mb-4"
      @click:close="done = false"
    >
      {{ t("pickup.pod.done") }}
    </v-alert>
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <!-- Búsqueda por LDV -->
    <div class="pk-lookup mb-4">
      <v-text-field
        v-model="ldv"
        :label="t('pickup.pod.ldv')"
        :hint="t('pickup.pod.ldv_hint')"
        persistent-hint
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-barcode-scan"
        hide-details="auto"
        @keyup.enter="lookup"
      />
      <v-btn
        color="primary"
        :loading="looking"
        :disabled="!ldv.trim()"
        @click="lookup"
      >
        {{ t("pickup.pod.search") }}
      </v-btn>
    </div>

    <!-- Ficha de la expedición + formulario -->
    <v-card v-if="shipment" variant="outlined" max-width="560">
      <v-card-text>
        <div class="pk-ship">
          <div class="pk-ship-ldv">LDV {{ shipment.ldv }}</div>
          <div class="pk-ship-dest">{{ shipment.destinatario }}</div>
          <div class="pk-ship-addr">
            {{ shipment.indirizzo }}, {{ shipment.cap }} {{ shipment.citta }}
          </div>
        </div>

        <v-divider class="my-4" />

        <v-btn-toggle
          v-model="esito"
          mandatory
          divided
          class="mb-4"
          density="comfortable"
        >
          <v-btn value="C" color="success">
            <v-icon start icon="mdi-check" />{{ t("pickup.pod.delivered") }}
          </v-btn>
          <v-btn value="M" color="error">
            <v-icon start icon="mdi-close" />{{ t("pickup.pod.failed") }}
          </v-btn>
        </v-btn-toggle>

        <v-text-field
          v-model="firma"
          :label="t('pickup.pod.firma')"
          :hint="t('pickup.pod.firma_hint')"
          density="comfortable"
          variant="outlined"
          class="mb-3"
        />
        <v-textarea
          v-model="note"
          :label="t('pickup.pod.note')"
          rows="2"
          density="comfortable"
          variant="outlined"
          class="mb-3"
        />

        <div class="pk-geo mb-2">
          <v-btn
            size="small"
            variant="tonal"
            :loading="geoBusy"
            prepend-icon="mdi-crosshairs-gps"
            @click="captureGeo"
          >
            {{ t("pickup.pod.geo") }}
          </v-btn>
          <span v-if="geo" class="pk-geo-ok">
            <v-icon size="16" icon="mdi-check-circle" color="success" />
            {{ geo.lat.toFixed(5) }}, {{ geo.lng.toFixed(5) }}
          </span>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn variant="text" @click="reset">{{
          t("pickup.edit.cancel")
        }}</v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          @click="register"
        >
          {{ t("pickup.pod.register") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
  max-width: 640px;
}
.pk-page-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 16px;
}
.pk-lookup {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.pk-lookup .v-text-field {
  max-width: 340px;
}
.pk-ship-ldv {
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
  letter-spacing: 0.04em;
}
.pk-ship-dest {
  font-size: 1.1rem;
  font-weight: 600;
}
.pk-ship-addr {
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.pk-geo {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pk-geo-ok {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
</style>
