<template>
  <div>
    <p class="text-body-2 mb-2">
      {{ t("consolidata.allocation.help", { criterio: view?.criterio ?? "" }) }}
    </p>
    <v-table v-if="view && view.spedizioni.length" density="compact">
      <thead>
        <tr>
          <th>{{ t("consolidata.allocation.leg") }}</th>
          <th v-for="s in view.spedizioni" :key="s.id" class="text-right">
            {{ s.ref }}
          </th>
          <th class="text-right">{{ t("consolidata.allocation.legTotal") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="l in legs" :key="l.id">
          <td>{{ l.ordine }} · {{ l.tipo }}</td>
          <td v-for="s in view.spedizioni" :key="s.id" class="text-right">
            {{ cell(l.id, s.id) }}
          </td>
          <td class="text-right">{{ l.totale.toFixed(2) }}</td>
        </tr>
        <tr class="font-weight-bold">
          <td>{{ t("consolidata.allocation.total") }}</td>
          <td v-for="s in view.spedizioni" :key="s.id" class="text-right">
            {{ s.quota_totale.toFixed(2) }}
          </td>
          <td class="text-right">{{ view.totale_riparto.toFixed(2) }}</td>
        </tr>
      </tbody>
    </v-table>
    <p v-else class="text-medium-emphasis">
      {{ t("consolidata.allocation.empty") }}
    </p>
    <p v-if="view" class="text-caption mt-2">
      {{
        t("consolidata.allocation.check", {
          legs: view.totale_tratte.toFixed(2),
          alloc: view.totale_riparto.toFixed(2),
        })
      }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useConsolidataStore } from "../stores/consolidata.store";

const { t } = useI18n();
const store = useConsolidataStore();
const view = computed(() => store.shipments);
const legs = computed(() => store.project?.tratte ?? []);

function cell(idTratta: number, idSped: number): string {
  const row = view.value?.riparto.find(
    (r) => r.id_tratta === idTratta && r.id_prog_sped === idSped,
  );
  return row ? row.quota.toFixed(2) : "—";
}
</script>
