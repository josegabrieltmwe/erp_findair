<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-map-marker-path"
      :title="t('shipment.cards.indirizzi.title')"
    >
      <template #actions>
        <!-- Pickup scheduling moved out of a full row into a header button with
             an icon + label so it's clear what it opens; tinted when a pickup
             window/status is set. -->
        <button
          type="button"
          class="pickup-trigger"
          :class="{ 'pickup-trigger--active': hasPickupSchedule }"
          :title="t('shipment.cards.indirizzi.pickup_schedule')"
          @click="ui.openModal('pickup_schedule')"
        >
          <v-icon icon="mdi-clock-time-eight-outline" size="14" />
          <span>{{ t("shipment.cards.indirizzi.pickup_short") }}</span>
        </button>
      </template>
    </CardHeader>
    <!-- Sender | recipient side by side to use the card's full width instead
         of stacking two half-empty rows. Collapses to one column on narrow
         viewports. -->
    <div class="addr-grid">
      <div class="addr-cell">
        <AddressRow
          icon="mdi-routes"
          :caption="t('shipment.cards.indirizzi.pickup')"
          :main="pickupMain"
          :sub="pickupSub"
          :sub2="pickupSub2"
          @click="ui.openModal('pickup')"
        />
        <!-- Pickup window as a small chip under the sender, only when set. -->
        <button
          v-if="hasPickupSchedule"
          type="button"
          class="pickup-chip"
          :title="pickupScheduleSubtitle"
          @click="ui.openModal('pickup_schedule')"
        >
          <v-icon icon="mdi-clock-time-eight-outline" size="12" />
          {{ pickupScheduleValue }}
        </button>
      </div>
      <AddressRow
        icon="mdi-map-marker-outline"
        :caption="t('shipment.cards.indirizzi.dest')"
        :main="destMain"
        :sub="destSub"
        :sub2="destSub2"
        @click="ui.openModal('dest')"
      />
    </div>
    <!-- Addresses are edited in their modal (buffer + Salva). The old
         inline-expand editors were removed: they had no Save button, which
         contradicted the buffered-save UX. -->
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import CardHeader from "@shipment/components/shell/CardHeader.vue";
import AddressRow from "@shipment/components/shell/AddressRow.vue";
import { countryFlagEmoji, iataFlagEmoji } from "@shipment/utils/country";

const { t } = useI18n();
const store = useShipmentStore();
const { pickup, destination, shipment } = storeToRefs(store);
const ui = useUiStore();

function compose(a: typeof pickup.value): {
  main: string;
  sub: string;
  sub2: string;
} {
  if (!a) {
    return { main: t("shipment.cards.indirizzi.not_set"), sub: "", sub2: "" };
  }
  const main = a.name || a.nome || "—";
  const cap = a.cap || "";
  const city = a.city || a.citta || "";
  const prov = a.prov || "";
  const country = a.country || a.id_paese_iso || "";
  const addressRaw =
    a.address_one_line ||
    (Array.isArray(a.address) ? a.address.join(" ") : a.address) ||
    a.adress ||
    "";
  const subParts: string[] = [];
  if (addressRaw) subParts.push(addressRaw);
  const subParts2: string[] = [];
  if (cap || city || prov) {
    const left = [cap, city].filter(Boolean).join(" ");
    subParts2.push(prov ? `${left} (${prov})` : left);
  }
  if (country) {
    const flag = countryFlagEmoji(country);
    subParts2.push(flag ? `${flag} ${country}` : country);
  }
  return {
    main,
    sub: subParts.join(" · "),
    sub2: subParts2.join(" · "),
  };
}

const pickupMain = computed(() => compose(pickup.value).main);
const pickupSub = computed(() => compose(pickup.value).sub);
const pickupSub2 = computed(() => compose(pickup.value).sub2);
const destMain = computed(() => compose(destination.value).main);
const destSub = computed(() => compose(destination.value).sub);
const destSub2 = computed(() => {
  const base = compose(destination.value).sub2;
  // Tack on attenzione + telefono when destination has them.
  const d = destination.value;
  const attn = d?.attention || d?.attenzione || "";
  const tel = d?.tel || d?.cell || "";
  const airport = d?.airport || d?.dhl_airport || "";
  const airportFlag = iataFlagEmoji(airport);
  const airportLabel = airport
    ? `${t("shipment.cards.indirizzi.airport")} ${airportFlag ? `${airportFlag} ` : ""}${airport}`
    : "";
  const extras = [airportLabel, attn, tel].filter(Boolean);
  return [base, extras.join(" · ")].filter(Boolean).join(" · ");
});
// A pickup time is "empty" when missing or the all-zeros placeholder
// (00:00 / 00:00:00) the legacy DB stores when no window was set.
function normaliseTime(raw: unknown): string {
  const v = (raw ?? "").toString().trim();
  if (!v) return "";
  return /^00:00(:00)?$/.test(v) ? "" : v.replace(/:00$/, ""); // drop seconds for display
}

// Pickup-schedule summary line: shows the real time window, or a dash when the
// window is the 00:00→00:00 placeholder (avoids the noisy "00:00:00 → 00:00:00").
const pickupScheduleValue = computed<string>(() => {
  const s = shipment.value;
  if (!s) return "—";
  const dalle = normaliseTime(s.presa_dalle);
  const alle = normaliseTime(s.presa_alle);
  if (dalle || alle) return `${dalle || "..."} → ${alle || "..."}`;
  if (s.presa_numero)
    return t("shipment.cards.indirizzi.presa_num", { n: s.presa_numero });
  return "—";
});
const pickupScheduleSubtitle = computed<string>(() => {
  const s = shipment.value;
  if (!s) return "";
  const parts: string[] = [];
  if (s.presa_stato)
    parts.push(t("shipment.cards.indirizzi.stato", { s: s.presa_stato }));
  if (s.presa_fissa === "S") parts.push(t("shipment.cards.indirizzi.fissa"));
  if (s.presa_fornitore === "S")
    parts.push(t("shipment.cards.indirizzi.fornitore"));
  return parts.join(" · ");
});

// A pickup is "scheduled" when there's a real time window or a pickup number —
// drives whether the header icon is tinted and the chip is shown.
const hasPickupSchedule = computed<boolean>(
  () => pickupScheduleValue.value !== "—",
);
</script>

<style scoped lang="scss">
/* Two address tiles side by side, with a hairline divider between them.
   Uses the full card width that was previously left blank. */
.addr-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 4px;
}
.addr-grid > :nth-child(2) {
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  padding-left: 12px;
}
.addr-cell {
  min-width: 0;
}

/* Header pickup-schedule trigger: icon + label so the action reads clearly;
   tinted when a window/status is set. */
.pickup-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  transition:
    background 0.12s,
    color 0.12s;
}
.pickup-trigger:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.8);
}
.pickup-trigger--active {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}
.pickup-trigger--active:hover {
  background: rgba(var(--v-theme-primary), 0.15);
}

/* Pickup window chip under the sender — replaces the old full-width row. */
.pickup-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 2px 0 0 9px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
  font-feature-settings: "tnum";
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  border: 0;
  cursor: pointer;
  transition: background 0.12s;
}
.pickup-chip:hover {
  background: rgba(var(--v-theme-primary), 0.15);
}

/* Collapse to one column when the CARD (not the viewport) is too narrow —
   handles a narrow split column or a resized splitter, not just mobile.
   Container queries are baseline in all current target browsers. */
.card-tmwe {
  container-type: inline-size;
}
@container (max-width: 440px) {
  .addr-grid {
    grid-template-columns: 1fr;
  }
  .addr-grid > :nth-child(2) {
    border-left: 0;
    padding-left: 9px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  }
}
</style>
