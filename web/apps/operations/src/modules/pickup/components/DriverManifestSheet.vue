<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatAmount, manifestRows, manifestTotals, stopMapLinks } from "../logic";
import type { Manifest } from "../types";

/**
 * Borderò del autista, en pantalla y para imprimir con `window.print()` (mismo
 * patrón que `warehouse/pages/DriverLoadPage.vue`). Sin librería de códigos de
 * barras en el proyecto: la LDV sale como texto monoespaciado.
 */
const { t, locale } = useI18n();
const props = defineProps<{ manifest: Manifest }>();

const rows = computed(() => manifestRows(props.manifest.stops));
const totals = computed(() => manifestTotals(props.manifest.summary, props.manifest.stops));
const links = computed(() =>
  props.manifest.stops.map((s) => ({ id: s.pickup_id, order: s.order, ...stopMapLinks(s) })),
);

function print(): void {
  window.print();
}
</script>

<template>
  <section class="pk-print">
    <div class="pk-noprint d-flex justify-end mb-2">
      <v-btn color="primary" variant="flat" prepend-icon="mdi-printer" @click="print">
        {{ t("pickup.manifest.print") }}
      </v-btn>
    </div>

    <h2 class="pk-print-title">{{ t("pickup.manifest.title") }}</h2>
    <div class="mb-3">
      {{ manifest.driver.nome }} · {{ manifest.date }}
      <span v-if="manifest.driver.cell"> · {{ manifest.driver.cell }}</span>
    </div>

    <table class="pk-print-table">
      <thead>
        <tr>
          <th>#</th>
          <th>{{ t("pickup.manifest.kind") }}</th>
          <th>{{ t("pickup.manifest.address") }}</th>
          <th>{{ t("pickup.manifest.ldv") }}</th>
          <th class="num">{{ t("pickup.manifest.colli") }}</th>
          <th class="num">kg</th>
          <th>{{ t("pickup.manifest.collect") }}</th>
          <th class="blank">{{ t("pickup.manifest.time") }}</th>
          <th class="blank">{{ t("pickup.manifest.signature") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.key">
          <td>{{ r.order }}</td>
          <td>{{ r.kind === "C" ? t("pickup.manifest.delivery") : t("pickup.manifest.pickup") }}</td>
          <td>
            <b>{{ r.name }}</b
            ><br />{{ r.address }}
          </td>
          <td class="ldv">
            {{ r.ldv || "—" }}<span v-if="r.ref"><br />{{ r.ref }}</span>
          </td>
          <td class="num">{{ r.colli }}</td>
          <td class="num">{{ r.peso }}</td>
          <td class="cod">
            <template v-if="r.cod > 0">{{
              t("pickup.manifest.collect_amount", { amount: formatAmount(r.cod, locale) })
            }}</template>
          </td>
          <td class="blank" />
          <td class="blank" />
        </tr>
      </tbody>
    </table>

    <p class="pk-print-totals">
      {{ t("pickup.manifest.totals", { pickups: totals.total_pickups, deliveries: totals.total_deliveries }) }}
      · {{ t("pickup.manifest.colli") }}: <b>{{ totals.shipments_colli || totals.total_colli }}</b>
      · kg: <b>{{ totals.shipments_peso || totals.total_peso }}</b>
      <template v-if="totals.total_contrassegno > 0">
        · {{ t("pickup.manifest.collect") }}:
        <b>{{ t("pickup.manifest.collect_amount", { amount: formatAmount(totals.total_contrassegno, locale) }) }}</b>
      </template>
    </p>

    <ul class="pk-noprint pk-links">
      <li v-for="l in links" :key="l.id">
        #{{ l.order }}
        <a v-if="l.address" :href="l.address" target="_blank" rel="noopener">{{ t("pickup.manifest.open_maps") }}</a>
        <a v-if="l.coords" :href="l.coords" target="_blank" rel="noopener">{{ t("pickup.manifest.open_maps_coords") }}</a>
      </li>
    </ul>
  </section>
</template>

<style>
.pk-print-table {
  width: 100%;
  border-collapse: collapse;
}
.pk-print-table th,
.pk-print-table td {
  border: 1px solid #bbb;
  padding: 4px 6px;
  text-align: left;
  font-size: 0.8rem;
  vertical-align: top;
}
.pk-print-table .num {
  text-align: right;
}
.pk-print-table .ldv {
  font-family: ui-monospace, "Courier New", monospace;
  letter-spacing: 0.04em;
}
.pk-print-table .cod {
  font-weight: 700;
}
.pk-print-table .blank {
  min-width: 90px;
  height: 36px;
}
.pk-print-totals {
  margin-top: 10px;
  font-size: 0.9rem;
}
.pk-links {
  margin-top: 12px;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 0.85rem;
}
.pk-links a {
  margin-left: 6px;
}
@media print {
  body * {
    visibility: hidden;
  }
  .pk-print,
  .pk-print * {
    visibility: visible;
  }
  .pk-print {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    color: #000;
    background: #fff;
  }
  .pk-noprint {
    display: none !important;
  }
}
</style>
