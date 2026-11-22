<template>
  <v-expansion-panels v-if="hasData" v-model="open" class="invoice-summary mt-2">
    <v-expansion-panel>
      <v-expansion-panel-title>
        <span class="text-subtitle-2">{{ t("invoicing.invoice.summary.title") }}</span>
        <template v-for="g in summary" :key="g.valuta_sigla">
          <span class="ms-4 text-medium-emphasis">
            {{ t("invoicing.invoice.summary.count", { count: g.count }) }} ·
            <strong class="text-high-emphasis">{{ money(g.importo_netto + g.importo_iva, g.valuta_sigla) }}</strong>
            <span v-if="g.margine_pct != null"> ({{ g.margine_pct }}%)</span>
          </span>
        </template>
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <!-- Totales por divisa (paridad visual legacy fatt_list.php:268-288). -->
        <v-table density="compact" class="mb-4">
          <thead>
            <tr>
              <th>{{ t("invoicing.invoice.summary.currency") }}</th>
              <th class="text-end">{{ t("invoicing.invoice.cost") }}</th>
              <th class="text-center">{{ t("invoicing.invoice.margin") }}</th>
              <th class="text-end">{{ t("invoicing.invoice.net") }}</th>
              <th class="text-end">{{ t("invoicing.invoice.vat") }}</th>
              <th class="text-end">{{ t("invoicing.invoice.total") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in summary" :key="g.valuta_sigla">
              <td>{{ g.valuta_sigla }}</td>
              <td class="text-end">{{ g.costo_netto ? money(g.costo_netto, g.valuta_sigla) : "—" }}</td>
              <td class="text-center">{{ g.margine_pct != null ? `${g.margine_pct}%` : "—" }}</td>
              <td class="text-end">{{ money(g.importo_netto, g.valuta_sigla) }}</td>
              <td class="text-end">{{ money(g.importo_iva, g.valuta_sigla) }}</td>
              <td class="text-end font-weight-medium">
                {{ money(g.importo_netto + g.importo_iva, g.valuta_sigla) }}
              </td>
            </tr>
          </tbody>
        </v-table>

        <!-- Riepilogo per agente (fatt_list.php:310-344): solo lectura, el -->
        <!-- listado no admite todavía filtrar por agente. -->
        <template v-if="byAgent.length">
          <div class="text-caption text-medium-emphasis mb-1">
            {{ t("invoicing.invoice.summary.by_agent") }}
          </div>
          <v-table density="compact" class="mb-4">
            <thead>
              <tr>
                <th>{{ t("invoicing.invoice.agent") }}</th>
                <th class="text-center">{{ t("invoicing.invoice.summary.currency") }}</th>
                <th class="text-end">{{ t("invoicing.invoice.cost") }}</th>
                <th class="text-center">{{ t("invoicing.invoice.margin") }}</th>
                <th class="text-end">{{ t("invoicing.invoice.net") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(g, i) in byAgent" :key="`${g.id_agente ?? 'none'}-${g.valuta_sigla}-${i}`">
                <td>{{ g.agente_nombre || "—" }}</td>
                <td class="text-center">{{ g.valuta_sigla }}</td>
                <td class="text-end">{{ g.costo_netto ? money(g.costo_netto, g.valuta_sigla) : "—" }}</td>
                <td class="text-center">{{ g.margine_pct != null ? `${g.margine_pct}%` : "—" }}</td>
                <td class="text-end">{{ money(g.importo_netto, g.valuta_sigla) }}</td>
              </tr>
            </tbody>
          </v-table>
        </template>

        <!-- Riepilogo per cliente (fatt_list.php:348-397): clicable, reusa el -->
        <!-- mismo filtro por cliente que la celda de la tabla principal. -->
        <template v-if="byClient.length">
          <div class="text-caption text-medium-emphasis mb-1">
            {{ t("invoicing.invoice.summary.by_client") }}
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>{{ t("invoicing.invoice.client") }}</th>
                <th class="text-center">{{ t("invoicing.invoice.summary.currency") }}</th>
                <th class="text-end">{{ t("invoicing.invoice.cost") }}</th>
                <th class="text-center">{{ t("invoicing.invoice.margin") }}</th>
                <th class="text-end">{{ t("invoicing.invoice.net") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(g, i) in byClient"
                :key="`${g.id_anagrafica}-${g.valuta_sigla}-${i}`"
                class="invoice-summary__client-row"
                @click="emit('filterByClient', g)"
              >
                <td>
                  <button type="button" class="filterable text-truncate">
                    {{ g.rag_soc || `#${g.id_anagrafica}` }}
                  </button>
                </td>
                <td class="text-center">{{ g.valuta_sigla }}</td>
                <td class="text-end">{{ g.costo_netto ? money(g.costo_netto, g.valuta_sigla) : "—" }}</td>
                <td class="text-center">{{ g.margine_pct != null ? `${g.margine_pct}%` : "—" }}</td>
                <td class="text-end">{{ money(g.importo_netto, g.valuta_sigla) }}</td>
              </tr>
            </tbody>
          </v-table>
        </template>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script setup lang="ts">
/**
 * InvoiceListSummaryFooter — paridad visual legacy (fatt_list.php): totales
 * del filtro completo por divisa + "Riepilogo per agente"/"per cliente".
 * Solo tiene sentido para facturas EMITIDAS (fatt_f_list.php, recibidas,
 * nunca tuvo esto en el legacy); el padre decide cuándo montarlo.
 *
 * Colapsable, abierto por defecto (a diferencia del legacy, que no podía
 * ocultarse): `aggregates` llega ya calculado del store
 * (`useInvoiceListStore().aggregates`), una vez por cambio de filtro, no por
 * página.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type {
  InvoiceAggregateGroup,
  InvoiceListAggregates,
} from "../../services/invoice.service";

const props = defineProps<{ aggregates: InvoiceListAggregates | undefined }>();
const emit = defineEmits<{
  filterByClient: [group: InvoiceAggregateGroup];
}>();

const { t } = useI18n();
const open = ref([0]);

const summary = computed(() => props.aggregates?.summary ?? []);
const byClient = computed(() => props.aggregates?.by_client ?? []);
const byAgent = computed(() => props.aggregates?.by_agent ?? []);
const hasData = computed(
  () => summary.value.length > 0 || byClient.value.length > 0 || byAgent.value.length > 0,
);

function money(v: number, cur: string): string {
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur || "EUR"}`;
}
</script>

<style scoped>
.invoice-summary__client-row {
  cursor: pointer;
}
.invoice-summary__client-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.filterable {
  color: rgb(var(--v-theme-primary));
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
}
</style>
