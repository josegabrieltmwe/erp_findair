<template>
  <div class="leg-strip">
    <EmptyState
      v-if="!activeLegs.length"
      icon="mdi-airplane-clock"
      :title="t('cargo.legllist.empty_title')"
      :text="t('cargo.legllist.empty_text')"
    />

    <!--
      Compact itinerary: origin → destination on one line, with the stops
      folded behind a dialog. The old vertical v-timeline spent a full screen
      of height on at most 5 legs, which is the information an operator scans
      in one glance — not something worth scrolling for.
    -->
    <div v-else class="leg-strip__row">
      <div class="leg-strip__endpoint">
        <div class="leg-strip__iata">{{ origin.airport || "—" }}</div>
        <div class="leg-strip__time">{{ fmtDate(origin.date) }}</div>
      </div>

      <button
        type="button"
        class="leg-strip__path"
        :class="{ 'leg-strip__path--clickable': hasStops }"
        :disabled="!hasStops"
        :title="hasStops ? t('cargo.legllist.show_stops') : undefined"
        @click="stopsOpen = true"
      >
        <span class="leg-strip__line" />
        <span class="leg-strip__mid">
          <v-icon icon="mdi-airplane" size="15" class="leg-strip__plane" />
          <span v-if="hasStops" class="leg-strip__stops">
            <!-- Plural form is chosen by the count argument, not the named
                 param, so singular/plural resolves correctly in all locales. -->
            {{ t("cargo.legllist.stops", { n: stopCount }, stopCount) }}
          </span>
          <span v-else class="leg-strip__stops leg-strip__stops--direct">
            {{ t("cargo.legllist.direct") }}
          </span>
        </span>
        <span class="leg-strip__line" />
      </button>

      <div class="leg-strip__endpoint leg-strip__endpoint--end">
        <div class="leg-strip__iata">{{ destination.airport || "—" }}</div>
        <div class="leg-strip__time">{{ fmtDate(destination.date) }}</div>
      </div>

      <v-btn
        size="small"
        variant="text"
        density="comfortable"
        prepend-icon="mdi-format-list-bulleted"
        class="leg-strip__detail"
        @click="stopsOpen = true"
      >
        {{ t("cargo.legllist.detail") }}
      </v-btn>
    </div>

    <!-- Full leg breakdown, on demand. -->
    <AppDialog
      :open="stopsOpen"
      :title="t('cargo.legllist.title')"
      icon="mdi-airplane-takeoff"
      size="md"
      @close="stopsOpen = false"
      @update:model-value="(v: boolean) => (stopsOpen = v)"
    >
      <v-table density="compact" class="leg-table">
        <thead>
          <tr>
            <th class="text-caption">#</th>
            <th class="text-caption">{{ t("cargo.legllist.flight") }}</th>
            <th class="text-caption">{{ t("cargo.legllist.from") }}</th>
            <th class="text-caption">{{ t("cargo.legllist.departure") }}</th>
            <th class="text-caption">{{ t("cargo.legllist.to") }}</th>
            <th class="text-caption">{{ t("cargo.legllist.arrival") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="leg in activeLegs" :key="leg.index">
            <td class="text-caption text-medium-emphasis">{{ leg.index }}</td>
            <td class="font-weight-medium">{{ leg.flight_num || "—" }}</td>
            <td>
              <v-chip size="x-small" variant="tonal">{{
                leg.flight_airp || "—"
              }}</v-chip>
            </td>
            <td class="text-caption">{{ fmtDate(leg.flight_data) }}</td>
            <td>
              <v-chip size="x-small" variant="tonal">{{
                leg.flight_aird || "—"
              }}</v-chip>
            </td>
            <td class="text-caption">{{ fmtDate(leg.flight_datad) }}</td>
          </tr>
        </tbody>
      </v-table>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="stopsOpen = false">
          {{ t("common.close") }}
        </v-btn>
      </template>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import AppDialog from "@shared/ui/AppDialog.vue";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import type { Cargo, CargoFlightLeg } from "@cargo/services/cargo.types";

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);

const stopsOpen = ref(false);

const activeLegs = computed<CargoFlightLeg[]>(() => {
  const s = cargo.value;
  if (!s) return [];
  const list: CargoFlightLeg[] = [];
  for (let i = 1 as 1 | 2 | 3 | 4 | 5; i <= 5; i++) {
    const num = (s[`flight_num${i}` as keyof Cargo] as string) ?? "";
    const data = (s[`flight_data${i}` as keyof Cargo] as string) ?? "";
    const airp = (s[`flight_airp${i}` as keyof Cargo] as string) ?? "";
    const datad = (s[`flight_datad${i}` as keyof Cargo] as string) ?? "";
    const aird = (s[`flight_aird${i}` as keyof Cargo] as string) ?? "";
    if (!num && !airp && !aird) continue;
    list.push({
      index: i,
      flight_num: num,
      flight_data: data,
      flight_airp: airp,
      flight_datad: datad,
      flight_aird: aird,
    });
  }
  return list;
});

/** First leg's departure = the itinerary's true origin. */
const origin = computed(() => {
  const first = activeLegs.value[0];
  return { airport: first?.flight_airp ?? "", date: first?.flight_data ?? "" };
});

/** Last leg's arrival = the itinerary's true destination. */
const destination = computed(() => {
  const last = activeLegs.value[activeLegs.value.length - 1];
  return { airport: last?.flight_aird ?? "", date: last?.flight_datad ?? "" };
});

/** Intermediate stops = every leg boundary except origin and destination. */
const stopCount = computed(() => Math.max(0, activeLegs.value.length - 1));
const hasStops = computed(() => stopCount.value > 0);

/**
 * Legacy datetimes arrive as "YYYY-MM-DD HH:MM:SS" (or zeroed). Render the
 * useful part only — the strip has no room for seconds.
 */
function fmtDate(raw?: string | null): string {
  if (!raw || raw.startsWith("0000-")) return "—";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ]?(\d{2}:\d{2})?/);
  if (!m) return raw;
  const [, y, mo, d, hm] = m;
  return `${d}/${mo}/${y.slice(2)}${hm ? ` ${hm}` : ""}`;
}
</script>

<style scoped lang="scss">
.leg-strip__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgb(var(--v-theme-surface-variant));
  flex-wrap: wrap;
}
.leg-strip__endpoint {
  min-width: 62px;
}
.leg-strip__endpoint--end {
  text-align: right;
}
.leg-strip__iata {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: 0.02em;
}
.leg-strip__time {
  font-size: 0.72rem;
  opacity: 0.62;
  white-space: nowrap;
}

/* The route path doubles as the "show stops" affordance. */
.leg-strip__path {
  flex: 1 1 120px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 110px;
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
  font: inherit;
}
.leg-strip__path--clickable {
  cursor: pointer;
}
.leg-strip__path--clickable:hover .leg-strip__stops {
  text-decoration: underline;
}
.leg-strip__line {
  flex: 1;
  height: 1px;
  background: currentColor;
  opacity: 0.22;
}
.leg-strip__mid {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.leg-strip__plane {
  opacity: 0.55;
}
.leg-strip__stops {
  font-size: 0.72rem;
  opacity: 0.72;
}
.leg-strip__stops--direct {
  opacity: 0.5;
}
.leg-strip__detail {
  margin-inline-start: auto;
}
.leg-table :deep(td) {
  padding-block: 6px;
}
</style>
