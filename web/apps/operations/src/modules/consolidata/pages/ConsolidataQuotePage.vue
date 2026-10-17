<template>
  <div class="cons-page">
    <div class="d-flex align-center mb-1">
      <v-btn icon="mdi-arrow-left" variant="text" density="comfortable" :to="{ name: 'consolidata' }" />
      <h2 class="text-h6 ml-1">{{ t("consolidata.quote.title") }}</h2>
    </div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      {{ t("consolidata.quote.subtitle") }}
    </p>

    <v-alert v-if="error" type="error" variant="tonal" closable class="mb-4" @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-form @submit.prevent="submit">
      <v-card variant="outlined" class="mb-4 pa-4">
        <v-row dense>
          <v-col cols="12" md="3">
            <v-text-field v-model="dest.country" :label="t('consolidata.quote.destCountry')" maxlength="2" />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field v-model="dest.zip" :label="t('consolidata.quote.destZip')" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="dest.city" :label="t('consolidata.quote.destCity')" />
          </v-col>
          <v-col cols="12" md="2">
            <v-select v-model="preference" :items="preferenceItems" :label="t('consolidata.quote.preference')" />
          </v-col>
        </v-row>
      </v-card>

      <div class="d-flex align-center justify-space-between mb-2">
        <h3 class="text-subtitle-1">{{ t("consolidata.quote.shipments") }}</h3>
        <v-btn variant="tonal" size="small" prepend-icon="mdi-plus" @click="addShipment">
          {{ t("consolidata.quote.addShipment") }}
        </v-btn>
      </div>

      <v-card
        v-for="(s, i) in shipments"
        :key="s.key"
        variant="outlined"
        class="mb-3 pa-4"
      >
        <div class="d-flex align-center justify-space-between mb-1">
          <span class="text-caption text-medium-emphasis">{{ t("consolidata.quote.shipment", { n: i + 1 }) }}</span>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            :disabled="shipments.length <= 1"
            :title="t('consolidata.quote.removeShipment')"
            @click="removeShipment(i)"
          />
        </div>
        <v-row dense>
          <v-col cols="12" md="2">
            <v-text-field v-model="s.origin_country" :label="t('consolidata.quote.originCountry')" maxlength="2" />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field v-model="s.origin_zip" :label="t('consolidata.quote.originZip')" />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field v-model="s.origin_city" :label="t('consolidata.quote.originCity')" />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field v-model.number="s.weight" :label="t('consolidata.quote.weight')" type="number" min="0.1" step="0.1" />
          </v-col>
          <v-col cols="6" md="1">
            <v-text-field v-model.number="s.packages" :label="t('consolidata.quote.packages')" type="number" min="1" step="1" />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field v-model="s.goods" :label="t('consolidata.quote.goods')" />
          </v-col>
        </v-row>
      </v-card>

      <v-btn color="primary" type="submit" :loading="loading" class="mt-2">{{ t("consolidata.quote.submit") }}</v-btn>
    </v-form>

    <template v-if="result">
      <v-alert
        v-for="w in result.warnings"
        :key="w"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-4"
      >
        {{ t(`consolidata.quote.warnings.${w}`, w) }}
      </v-alert>

      <v-alert v-if="result.compliance.review_required" type="warning" variant="tonal" density="compact" class="mt-2">
        {{ t("consolidata.quote.reviewRequired") }}
        <span v-if="result.compliance.restricted_countries.length">
          {{ t("consolidata.quote.restrictedCountries", { countries: result.compliance.restricted_countries.join(", ") }) }}
        </span>
      </v-alert>

      <div class="d-flex align-center justify-space-between mt-6 mb-2">
        <h3 class="text-subtitle-1">{{ t("consolidata.quote.options") }}</h3>
        <span class="text-caption text-medium-emphasis">
          {{ t("consolidata.quote.hubCandidates", { hubs: result.hub_candidates.join(", ") || "—" }) }}
        </span>
      </div>

      <v-row>
        <v-col v-for="opt in result.options" :key="opt.key" cols="12" lg="6">
          <v-card
            :variant="opt.key === result.recommended ? 'tonal' : 'outlined'"
            :color="opt.key === result.recommended ? 'primary' : undefined"
            height="100%"
          >
            <v-card-title class="text-body-1 d-flex align-center flex-wrap ga-2">
              {{ opt.label }}
              <v-chip v-if="opt.key === result.recommended" size="x-small" color="primary">{{ t("consolidata.quote.recommended") }}</v-chip>
              <v-chip v-if="opt.incomplete" size="x-small" color="error" variant="tonal">{{ t("consolidata.quote.incomplete") }}</v-chip>
              <v-chip v-else-if="opt.dominated" size="x-small" color="default" variant="tonal">
                {{ t("consolidata.quote.dominated", { by: opt.dominated_by ?? "—" }) }}
              </v-chip>
              <v-spacer />
              <span class="text-h6">{{ opt.totale.toFixed(2) }} {{ opt.valuta }}</span>
            </v-card-title>
            <v-card-subtitle class="text-caption">
              {{ t("consolidata.quote.legsCount", { n: opt.legs.length }) }}
              <span v-if="opt.giorni_totali"> · {{ t("consolidata.quote.days", { n: opt.giorni_totali }) }}</span>
              <span v-if="opt.eta"> · {{ t("consolidata.quote.eta", { date: opt.eta }) }}</span>
            </v-card-subtitle>
            <v-card-text>
              <div class="text-caption text-medium-emphasis mb-1">{{ t("consolidata.quote.legDetail") }}</div>
              <v-table density="compact" class="cons-quote-table mb-3">
                <thead>
                  <tr>
                    <th>{{ t("consolidata.quote.legType") }}</th>
                    <th>{{ t("consolidata.quote.legRoute") }}</th>
                    <th>{{ t("consolidata.quote.legService") }}</th>
                    <th class="text-right">{{ t("consolidata.quote.legPrice") }}</th>
                    <th class="text-right">{{ t("consolidata.quote.legFuel") }}</th>
                    <th class="text-right">{{ t("consolidata.quote.legSupplements") }}</th>
                    <th class="text-right">{{ t("consolidata.quote.legTotal") }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(leg, i) in opt.legs" :key="i">
                    <td>{{ leg.tipo }}</td>
                    <td>{{ leg.origin.terminal || leg.origin.country }} → {{ leg.destination.terminal || leg.destination.country }}</td>
                    <td>{{ leg.servizio_nome ?? "—" }}</td>
                    <template v-if="leg.errore">
                      <td colspan="4" class="text-error">{{ t("consolidata.quote.legError") }}</td>
                    </template>
                    <template v-else>
                      <td class="text-right">{{ leg.prezzo.toFixed(2) }}</td>
                      <td class="text-right">{{ leg.fuel.toFixed(2) }}</td>
                      <td class="text-right">{{ leg.supplementi.toFixed(2) }}</td>
                      <td class="text-right">{{ leg.totale.toFixed(2) }}</td>
                    </template>
                  </tr>
                </tbody>
              </v-table>

              <div class="text-caption text-medium-emphasis mb-1">{{ t("consolidata.quote.fixedCosts") }}</div>
              <v-table density="compact" class="cons-quote-table">
                <tbody>
                  <tr v-if="opt.costi_fissi.pratiche_export > 0 || opt.costi_fissi.export_clearance > 0">
                    <td>{{ t("consolidata.quote.exportClearance", { n: opt.costi_fissi.pratiche_export }) }}</td>
                    <td class="text-right">{{ opt.costi_fissi.export_clearance.toFixed(2) }}</td>
                  </tr>
                  <tr v-if="opt.costi_fissi.house > 0 || opt.costi_fissi.house_fee > 0">
                    <td>{{ t("consolidata.quote.houseFee", { n: opt.costi_fissi.house }) }}</td>
                    <td class="text-right">{{ opt.costi_fissi.house_fee.toFixed(2) }}</td>
                  </tr>
                  <tr v-if="opt.costi_fissi.hub_handling_kg > 0 || opt.costi_fissi.hub_handling > 0">
                    <td>{{ t("consolidata.quote.hubHandling", { kg: opt.costi_fissi.hub_handling_kg }) }}</td>
                    <td class="text-right">{{ opt.costi_fissi.hub_handling.toFixed(2) }}</td>
                  </tr>
                  <tr v-if="opt.costi_fissi.shuttle">
                    <td>{{ t("consolidata.quote.shuttle", { km: opt.costi_fissi.shuttle_km ?? 0 }) }}</td>
                    <td class="text-right">{{ opt.costi_fissi.shuttle.toFixed(2) }}</td>
                  </tr>
                  <tr class="font-weight-bold">
                    <td>{{ t("consolidata.quote.fixedCostsTotal") }}</td>
                    <td class="text-right">{{ opt.costi_fissi.totale.toFixed(2) }}</td>
                  </tr>
                </tbody>
              </v-table>

              <div class="d-flex justify-space-between text-caption text-medium-emphasis mt-2">
                <span>{{ t("consolidata.quote.legsSubtotal") }}: {{ opt.totale_tratte.toFixed(2) }}</span>
                <span class="font-weight-bold">{{ opt.totale.toFixed(2) }} {{ opt.valuta }}</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      <p class="text-body-2 text-medium-emphasis mt-2">{{ result.recommendation_reason.text }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  consolidataService,
  ConsolidataRequestError,
} from "../services/consolidata.service";
import type { QuoteResult } from "../types";

const { t } = useI18n();

interface ShipmentRow {
  key: number;
  origin_country: string;
  origin_zip: string;
  origin_city: string;
  weight: number;
  packages: number;
  goods: string;
}

let nextKey = 1;
function blankShipment(): ShipmentRow {
  return {
    key: nextKey++,
    origin_country: "",
    origin_zip: "",
    origin_city: "",
    weight: 100,
    packages: 1,
    goods: "",
  };
}

const dest = reactive({ country: "", zip: "", city: "" });
const preference = ref<"price" | "speed" | "balanced">("balanced");
const preferenceItems = [
  { title: t("consolidata.quote.preferencePrice"), value: "price" },
  { title: t("consolidata.quote.preferenceSpeed"), value: "speed" },
  { title: t("consolidata.quote.preferenceBalanced"), value: "balanced" },
];

const shipments = reactive<ShipmentRow[]>([blankShipment()]);

function addShipment(): void {
  shipments.push(blankShipment());
}

function removeShipment(i: number): void {
  if (shipments.length > 1) {
    shipments.splice(i, 1);
  }
}

const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<QuoteResult | null>(null);

async function submit(): Promise<void> {
  error.value = null;
  result.value = null;
  loading.value = true;
  try {
    result.value = await consolidataService.quote({
      shipments: shipments.map((s, i) => ({
        ref: `Q${i + 1}`,
        origin: {
          country: s.origin_country.trim().toUpperCase(),
          zip: s.origin_zip.trim(),
          city: s.origin_city.trim(),
        },
        weight: s.weight,
        packages: [
          { quantity: s.packages, weight: s.weight / s.packages, length: 60, width: 40, height: 40 },
        ],
        goods: s.goods.trim() || undefined,
      })),
      destination: {
        country: dest.country.trim().toUpperCase(),
        zip: dest.zip.trim(),
        city: dest.city.trim(),
      },
      preference: preference.value,
    });
  } catch (err) {
    error.value =
      err instanceof ConsolidataRequestError
        ? err.info.message
        : t("consolidata.errors.UNKNOWN");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.cons-page {
  padding: 16px;
}
.cons-quote-table :deep(td),
.cons-quote-table :deep(th) {
  white-space: nowrap;
}
</style>
