<template>
  <div class="overview-layout">
    <!-- Left rail: compact KPI sidebar (sticky) -->
    <aside class="kpi-rail">
      <v-card border rounded="lg" elevation="0">
        <div class="d-flex flex-column kpi-stack">
          <KpiMetric
            dense
            icon="mdi-package-variant-closed"
            :label="t('shipment.overview.packages')"
            :value="String(shipment?.colli ?? 0)"
            :sublabel="`${formatKg(shipment?.peso)} kg`"
            @click="$emit('navigate', 'packages')"
          />
          <v-divider />
          <KpiMetric
            dense
            icon="mdi-scale"
            :label="t('shipment.overview.chargeable')"
            :value="`${formatKg(shipment?.peso_tassato)} kg`"
            :sublabel="realWeightLabel"
            @click="$emit('navigate', 'packages')"
          />
          <v-divider />
          <KpiMetric
            dense
            icon="mdi-cash-multiple"
            :label="t('shipment.overview.cost')"
            :value="formatMoney(shipment?.costor)"
            :sublabel="
              t('shipment.overview.forecast_v', {
                v: formatMoney(shipment?.costo),
              })
            "
            @click="$emit('navigate', 'service')"
          />
          <v-divider />
          <KpiMetric
            dense
            icon="mdi-cash-plus"
            :label="t('shipment.overview.charged')"
            :value="formatMoney(carico)"
            :sublabel="
              t('shipment.overview.fuel_v', {
                v: formatMoney(shipment?.fuel_surc),
              })
            "
            @click="$emit('navigate', 'service')"
          />
          <template v-if="hasCustoms">
            <v-divider />
            <KpiMetric
              dense
              icon="mdi-passport"
              :label="t('shipment.overview.customs')"
              :value="`${formatMoney(shipment?.dogana_imp)} ${shipment?.id_valuta_dogana ?? ''}`"
              :sublabel="t('shipment.overview.declared')"
              @click="$emit('navigate', 'packages')"
            />
          </template>
          <template v-if="hasCod">
            <v-divider />
            <KpiMetric
              dense
              icon="mdi-cash"
              :label="t('shipment.overview.cod')"
              :value="formatMoney(shipment?.contras_imp)"
              :sublabel="
                shipment?.contras_incasso === 'S'
                  ? t('shipment.overview.cashed_in')
                  : t('shipment.overview.pending')
              "
              @click="$emit('navigate', 'packages')"
            />
          </template>
          <template v-if="hasInsurance">
            <v-divider />
            <KpiMetric
              dense
              icon="mdi-shield-check-outline"
              :label="t('shipment.overview.insurance')"
              :value="`${formatMoney(shipment?.assicuraz_imp)} ${shipment?.id_valuta_assic ?? ''}`"
              :sublabel="t('shipment.overview.declared')"
              @click="$emit('navigate', 'packages')"
            />
          </template>
        </div>
      </v-card>
    </aside>

    <!-- Right column: form / details -->
    <div class="overview-main d-flex flex-column" style="gap: 12px">
      <!-- Hero: client identity, status chips -->
      <v-card border rounded="lg" elevation="0">
        <v-card-text class="pa-4">
          <div
            class="text-overline text-medium-emphasis"
            style="letter-spacing: 0.06em"
          >
            {{ t("shipment.overview.client") }}
          </div>
          <div class="text-h6 font-weight-semibold mt-1">
            {{ shipment?.cliente ?? "—" }}
          </div>
          <div v-if="clientRef" class="text-caption text-medium-emphasis mt-1">
            {{ t("shipment.overview.ref") }}: {{ clientRef }} ·
            {{ t("shipment.overview.partner") }}
            {{ shipment?.ang_partner_rag_soc ?? "—" }}
          </div>

          <div
            v-if="badges.length"
            class="d-flex flex-wrap mt-3"
            style="gap: 6px"
          >
            <v-chip
              v-for="(b, i) in badges"
              :key="i"
              :color="b.color === 'default' ? undefined : b.color"
              :prepend-icon="b.icon"
              variant="tonal"
              size="small"
            >
              <v-tooltip v-if="b.hint" activator="parent" location="top">{{
                b.hint
              }}</v-tooltip>
              {{ b.label }}
            </v-chip>
          </div>
        </v-card-text>
      </v-card>

      <!-- Addresses: two-column summary -->
      <v-row dense>
        <v-col cols="12" md="6">
          <AddressSummary
            icon="mdi-arrow-down-right"
            :title="t('shipment.detail.addr_destination')"
            :address="destination"
            @edit="$emit('navigate', 'addresses')"
          />
        </v-col>
        <v-col cols="12" md="6">
          <AddressSummary
            icon="mdi-arrow-up-right"
            :title="t('shipment.detail.addr_pickup')"
            :address="pickup"
            @edit="$emit('navigate', 'addresses')"
          />
        </v-col>
      </v-row>

      <!-- Service + Lifecycle -->
      <v-row dense>
        <v-col cols="12" md="6">
          <v-card border rounded="lg" elevation="0">
            <v-card-title
              class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-2"
            >
              <v-icon icon="mdi-truck-fast-outline" class="me-2" size="18" />
              {{ t("shipment.overview.service_courier") }}
              <v-spacer />
              <v-btn
                size="x-small"
                variant="text"
                prepend-icon="mdi-pencil-outline"
                @click="$emit('navigate', 'service')"
              >
                {{ t("common.edit") }}
              </v-btn>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-3">
              <div class="d-flex flex-column" style="gap: 8px">
                <FieldRow
                  :label="t('shipment.overview.courier')"
                  :value="courierLabel"
                />
                <FieldRow
                  :label="t('shipment.overview.service')"
                  :value="serviceLabel"
                />
                <FieldRow
                  :label="t('shipment.overview.awb_tracking')"
                  :value="shipment?.AWB_forn || '—'"
                  mono
                />
                <FieldRow
                  :label="t('shipment.overview.type')"
                  :value="parcelLabel"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <ShipmentTimelineCard />
        </v-col>
        <v-col cols="12" md="6">
          <ShipmentPartnersBox />
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentStatus } from "@shipment/composables/useShipmentStatus";
import { stripHtml } from "@shipment/composables/useTextSanitize";
import KpiMetric from "@shipment/components/shell/KpiMetric.vue";
import AddressSummary from "@shipment/components/shell/AddressSummary.vue";
import FieldRow from "@shipment/components/shell/FieldRow.vue";
import ShipmentTimelineCard from "@shipment/components/shipment/ShipmentTimelineCard.vue";
import ShipmentPartnersBox from "@shipment/components/shipment/ShipmentPartnersBox.vue";
import type { ShipmentTab } from "@shipment/services/shipment.types";

defineEmits<{ (e: "navigate", tab: ShipmentTab): void }>();

const { t } = useI18n();
const store = useShipmentStore();
const { shipment, destination, pickup } = storeToRefs(store);
const { badges } = useShipmentStatus(shipment);

const COURIER_NAMES: Record<number, string> = {
  2: "BART",
  3: "DHL",
  4: "SDA",
  5: "FedEx",
  7: "UPS",
  8: "TNT",
  20: "TMWE",
};
const courierLabel = computed(() => {
  const id = Number(shipment.value?.id_fornitore ?? 0);
  if (!id) return "—";
  return COURIER_NAMES[id] ?? `#${id}`;
});
const serviceLabel = computed(
  () =>
    stripHtml(
      String(shipment.value?.servizio ?? shipment.value?.service ?? ""),
    ) || "—",
);
const parcelLabel = computed(() => {
  const v = shipment.value?.opz_par_doc;
  if (v === "P") return t("shipment.overview.parcel");
  if (v === "D") return t("shipment.overview.document");
  return "—";
});

const clientRef = computed(
  () =>
    (shipment.value?.rif_cliente ??
      shipment.value?.RIF_cliente ??
      "") as string,
);

const realWeightLabel = computed(() => {
  const real = Number(shipment.value?.peso_reale ?? 0);
  return real > 0
    ? t("shipment.overview.real_kg", { v: formatKg(real) })
    : t("shipment.overview.not_measured");
});

const carico = computed(() => {
  const c = Number(shipment.value?.carico ?? 0);
  const f = Number(shipment.value?.fuel_surc ?? 0);
  return c + f;
});

const hasCustoms = computed(() => Number(shipment.value?.dogana_imp ?? 0) > 0);
const hasCod = computed(() => Number(shipment.value?.contras_imp ?? 0) > 0);
const hasInsurance = computed(
  () => Number(shipment.value?.assicuraz_imp ?? 0) > 0,
);

function formatKg(v: unknown): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function formatMoney(v: unknown): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
</script>

<style scoped>
.overview-layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 12px;
  align-items: start;
}
.kpi-rail {
  position: sticky;
  top: 12px;
}
.kpi-stack > :deep(.kpi-metric) {
  width: 100%;
}
.overview-main {
  min-width: 0;
}
@media (max-width: 960px) {
  .overview-layout {
    grid-template-columns: 1fr;
  }
  .kpi-rail {
    position: static;
  }
}
</style>
