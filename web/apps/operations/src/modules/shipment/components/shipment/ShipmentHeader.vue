<template>
  <v-card border rounded="lg" elevation="0" class="shipment-header">
    <div class="d-flex flex-wrap align-stretch">
      <!-- Route summary -->
      <div
        class="route-block flex-grow-1 d-flex align-center justify-center pa-3"
      >
        <div class="endpoint text-center px-3">
          <div
            class="text-overline text-medium-emphasis"
            style="letter-spacing: 0.08em"
          >
            {{ t("shipment.header.from") }}
          </div>
          <div class="d-flex align-center justify-center mt-1" style="gap: 8px">
            <CountryFlag :iso="originCountry" :size="18" />
            <span class="text-body-1 font-weight-semibold">{{
              originCountry || "—"
            }}</span>
          </div>
          <div v-if="originCity" class="text-caption text-medium-emphasis mt-1">
            {{ originCity }}
          </div>
        </div>

        <v-icon
          icon="mdi-arrow-right"
          size="22"
          class="mx-3 text-medium-emphasis"
        />

        <div class="endpoint text-center px-3">
          <div
            class="text-overline text-medium-emphasis"
            style="letter-spacing: 0.08em"
          >
            {{ t("shipment.header.to") }}
          </div>
          <div class="d-flex align-center justify-center mt-1" style="gap: 8px">
            <CountryFlag :iso="destCountry" :size="18" />
            <span class="text-body-1 font-weight-semibold">{{
              destCountry || "—"
            }}</span>
          </div>
          <div v-if="destCity" class="text-caption text-medium-emphasis mt-1">
            {{ destCity }}
          </div>
        </div>
      </div>

      <v-divider vertical class="d-none d-sm-block" />

      <!-- Service & courier -->
      <div class="service-block d-flex align-center pa-3">
        <v-icon
          icon="mdi-truck-fast-outline"
          size="20"
          class="me-3 text-medium-emphasis"
        />
        <div>
          <div
            class="text-overline text-medium-emphasis"
            style="letter-spacing: 0.08em"
          >
            {{ t("shipment.header.service") }}
          </div>
          <div class="text-body-2 font-weight-semibold mt-1">
            {{ courierLabel }}
          </div>
          <div
            v-if="serviceLabel && serviceLabel !== '—'"
            class="text-caption text-medium-emphasis"
          >
            {{ serviceLabel }}
          </div>
          <div
            v-if="awb"
            class="text-caption font-weight-medium mt-1"
            style="font-family: ui-monospace, Menlo, Consolas, monospace"
          >
            {{ awb }}
          </div>
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { stripHtml } from "@shipment/composables/useTextSanitize";
import CountryFlag from "@shipment/components/common/CountryFlag.vue";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment, destination, pickup } = storeToRefs(store);

const COURIER_NAMES: Record<number, string> = {
  2: "BART",
  3: "DHL",
  4: "SDA",
  5: "FedEx",
  7: "UPS",
  8: "TNT",
  20: "TMWE",
};

const originCountry = computed(
  () =>
    (pickup.value?.country || shipment.value?.sed_id_paese_iso || "") as string,
);
const originCity = computed(
  () => (pickup.value?.city || shipment.value?.sed_citta || "") as string,
);
const destCountry = computed(
  () => (destination.value?.country || "") as string,
);
const destCity = computed(() => (destination.value?.city || "") as string);

const courierLabel = computed(() => {
  const id = Number(shipment.value?.id_fornitore ?? 0);
  if (!id) return "—";
  return COURIER_NAMES[id] ?? `#${id}`;
});

const serviceLabel = computed(
  () => stripHtml(String(shipment.value?.servizio ?? "")) || "—",
);

const awb = computed(() => shipment.value?.AWB_forn || "");
</script>

<style scoped>
.shipment-header {
  /* Two-tone background with one color: surface-variant for the route, slightly
     tinted success-tonal for the service. Keeps the palette to the existing
     primary/success/secondary set requested by the user. */
  overflow: hidden;
}
.route-block {
  background: rgb(var(--v-theme-surface-variant), 0.55);
  min-width: 0;
}
.service-block {
  background: rgb(var(--v-theme-success), 0.07);
  min-width: 220px;
}
.endpoint {
  min-width: 120px;
}
@media (max-width: 600px) {
  .service-block {
    width: 100%;
    border-top: 1px solid rgb(var(--v-theme-on-surface), 0.06);
  }
}
</style>
