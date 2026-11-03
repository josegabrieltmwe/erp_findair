<template>
  <div class="cons-page">
    <div class="d-flex align-center mb-1">
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        density="comfortable"
        :to="{ name: 'consolidata-list' }"
      />
      <h2 class="text-h6 ml-1">{{ t("consolidata.quote.title") }}</h2>
    </div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      {{ t("consolidata.quote.subtitle") }}
    </p>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      @click:close="error = null"
    >
      {{ error }}
    </v-alert>

    <v-form @submit.prevent="submit">
      <v-card variant="outlined" class="mb-4 pa-4">
        <v-row dense>
          <v-col cols="6" md="2">
            <v-text-field
              v-model="dest.country"
              :label="t('consolidata.quote.destCountry')"
              maxlength="2"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field
              v-model="dest.zip"
              :label="t('consolidata.quote.destZip')"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="dest.city"
              :label="t('consolidata.quote.destCity')"
            />
          </v-col>
          <v-col cols="6" md="3">
            <v-text-field
              v-model="dest.terminal"
              :label="t('consolidata.quote.terminal')"
              maxlength="5"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="preference"
              :items="preferenceItems"
              :label="t('consolidata.quote.preference')"
            />
          </v-col>
        </v-row>
      </v-card>

      <div class="d-flex align-center justify-space-between mb-2">
        <h3 class="text-subtitle-1">{{ t("consolidata.quote.shipments") }}</h3>
        <v-btn
          variant="tonal"
          size="small"
          prepend-icon="mdi-plus"
          @click="addShipment"
        >
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
          <span class="text-caption text-medium-emphasis">{{
            t("consolidata.quote.shipment", { n: i + 1 })
          }}</span>
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
          <v-col cols="6" md="2">
            <v-text-field v-model="s.ref" :label="t('consolidata.quote.ref')" />
          </v-col>
          <v-col cols="6" md="1">
            <v-text-field
              v-model="s.origin_country"
              :label="t('consolidata.quote.originCountry')"
              maxlength="2"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field
              v-model="s.origin_zip"
              :label="t('consolidata.quote.originZip')"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field
              v-model="s.origin_city"
              :label="t('consolidata.quote.originCity')"
            />
          </v-col>
          <v-col cols="6" md="1">
            <v-text-field
              v-model="s.origin_terminal"
              :label="t('consolidata.quote.terminal')"
              maxlength="5"
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field
              v-model="s.goods"
              :label="t('consolidata.quote.goods')"
            />
          </v-col>
          <v-col cols="6" md="1">
            <v-text-field
              v-model.number="s.value"
              :label="t('consolidata.quote.value')"
              type="number"
              min="0"
              step="0.01"
            />
          </v-col>
          <v-col cols="6" md="1">
            <v-text-field
              v-model="s.ready_date"
              :label="t('consolidata.quote.readyDate')"
              type="date"
            />
          </v-col>
        </v-row>
        <div class="text-caption text-medium-emphasis mb-1">
          {{
            t("consolidata.quote.packagesTitle", { kg: num(totalWeight(s)) })
          }}
        </div>
        <v-row
          v-for="(pk, j) in s.packages"
          :key="j"
          dense
          class="align-center"
        >
          <v-col cols="4" md="2">
            <v-text-field
              v-model.number="pk.quantity"
              :label="t('consolidata.quote.packages')"
              type="number"
              min="1"
              step="1"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="4" md="2">
            <v-text-field
              v-model.number="pk.weight"
              :label="t('consolidata.quote.pkgWeight')"
              type="number"
              min="0.1"
              step="0.1"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="4" md="2">
            <v-text-field
              v-model.number="pk.length"
              :label="t('consolidata.quote.length')"
              type="number"
              min="0"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="4" md="2">
            <v-text-field
              v-model.number="pk.width"
              :label="t('consolidata.quote.width')"
              type="number"
              min="0"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="4" md="2">
            <v-text-field
              v-model.number="pk.height"
              :label="t('consolidata.quote.height')"
              type="number"
              min="0"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="4" md="2" class="d-flex ga-1">
            <v-btn
              icon="mdi-minus"
              size="x-small"
              variant="text"
              :disabled="s.packages.length <= 1"
              :aria-label="t('consolidata.quote.removePackage')"
              :title="t('consolidata.quote.removePackage')"
              @click="s.packages.splice(j, 1)"
            />
            <v-btn
              v-if="j === s.packages.length - 1"
              icon="mdi-plus"
              size="x-small"
              variant="text"
              :aria-label="t('consolidata.quote.addPackage')"
              :title="t('consolidata.quote.addPackage')"
              @click="s.packages.push(blankPackage())"
            />
          </v-col>
        </v-row>
      </v-card>

      <v-btn color="primary" type="submit" :loading="loading" class="mt-2">{{
        t("consolidata.quote.submit")
      }}</v-btn>
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

      <v-alert
        v-if="result.compliance.review_required"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-2"
      >
        {{ t("consolidata.quote.reviewRequired") }}
        <span v-if="result.compliance.restricted_countries.length">
          {{
            t("consolidata.quote.restrictedCountries", {
              countries: result.compliance.restricted_countries.join(", "),
            })
          }}
        </span>
      </v-alert>

      <div class="d-flex align-center justify-space-between mt-6 mb-2">
        <h3 class="text-subtitle-1">{{ t("consolidata.quote.options") }}</h3>
        <span class="text-caption text-medium-emphasis">
          {{
            t("consolidata.quote.hubCandidates", {
              hubs: result.hub_candidates.join(", ") || "—",
            })
          }}
        </span>
      </div>

      <v-row>
        <v-col v-for="opt in result.options" :key="opt.key" cols="12" lg="6">
          <v-card
            :variant="opt.key === result.recommended ? 'tonal' : 'outlined'"
            :color="opt.key === result.recommended ? 'primary' : undefined"
            height="100%"
          >
            <v-card-title
              class="text-body-1 d-flex align-center flex-wrap ga-2"
            >
              {{ opt.label }}
              <v-chip
                v-if="opt.key === result.recommended"
                size="x-small"
                color="primary"
                >{{ t("consolidata.quote.recommended") }}</v-chip
              >
              <v-chip
                v-if="opt.incomplete"
                size="x-small"
                color="error"
                variant="tonal"
                >{{ t("consolidata.quote.incomplete") }}</v-chip
              >
              <v-chip
                v-else-if="opt.dominated"
                size="x-small"
                color="default"
                variant="tonal"
              >
                {{
                  t("consolidata.quote.dominated", {
                    by: opt.dominated_by ?? "—",
                  })
                }}
              </v-chip>
              <v-spacer />
              <span class="text-h6">{{ money(opt.totale, opt.valuta) }}</span>
            </v-card-title>
            <v-card-subtitle class="text-caption">
              {{ t("consolidata.quote.legsCount", { n: opt.legs.length }) }}
              <span v-if="opt.giorni_totali">
                ·
                {{
                  t("consolidata.quote.days", { n: opt.giorni_totali })
                }}</span
              >
              <span v-if="opt.eta">
                · {{ t("consolidata.quote.eta", { date: opt.eta }) }}</span
              >
            </v-card-subtitle>
            <v-card-text>
              <div class="text-caption text-medium-emphasis mb-1">
                {{ t("consolidata.quote.legDetail") }}
              </div>
              <v-table density="compact" class="cons-quote-table mb-3">
                <thead>
                  <tr>
                    <th>{{ t("consolidata.quote.legType") }}</th>
                    <th>{{ t("consolidata.quote.legRoute") }}</th>
                    <th>{{ t("consolidata.quote.legService") }}</th>
                    <th class="text-right">
                      {{ t("consolidata.quote.legPrice") }}
                    </th>
                    <th class="text-right">
                      {{ t("consolidata.quote.legFuel") }}
                    </th>
                    <th class="text-right">
                      {{ t("consolidata.quote.legSupplements") }}
                    </th>
                    <th class="text-right">
                      {{ t("consolidata.quote.legTotal") }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(leg, i) in opt.legs" :key="i">
                    <td>{{ leg.tipo }}</td>
                    <td>
                      {{ leg.origin.terminal || leg.origin.country }} →
                      {{ leg.destination.terminal || leg.destination.country }}
                    </td>
                    <td>{{ leg.servizio_nome ?? "—" }}</td>
                    <template v-if="leg.errore">
                      <td colspan="4" class="text-error cons-leg-error">
                        {{ t("consolidata.quote.legError") }}: {{ leg.errore }}
                      </td>
                    </template>
                    <template v-else>
                      <td class="text-right">
                        {{ money(leg.prezzo, leg.valuta) }}
                      </td>
                      <td class="text-right">
                        {{ money(leg.fuel, leg.valuta) }}
                      </td>
                      <td class="text-right">
                        {{ money(leg.supplementi, leg.valuta) }}
                      </td>
                      <td class="text-right">
                        {{ money(leg.totale, leg.valuta) }}
                      </td>
                    </template>
                  </tr>
                </tbody>
              </v-table>

              <div class="text-caption text-medium-emphasis mb-1">
                {{ t("consolidata.quote.fixedCosts") }}
              </div>
              <v-table density="compact" class="cons-quote-table">
                <tbody>
                  <tr
                    v-if="
                      opt.costi_fissi.pratiche_export > 0 ||
                      opt.costi_fissi.export_clearance > 0
                    "
                  >
                    <td>
                      {{
                        t("consolidata.quote.exportClearance", {
                          n: opt.costi_fissi.pratiche_export,
                        })
                      }}
                    </td>
                    <td class="text-right">
                      {{ money(opt.costi_fissi.export_clearance, opt.valuta) }}
                    </td>
                  </tr>
                  <tr
                    v-if="
                      opt.costi_fissi.house > 0 || opt.costi_fissi.house_fee > 0
                    "
                  >
                    <td>
                      {{
                        t("consolidata.quote.houseFee", {
                          n: opt.costi_fissi.house,
                        })
                      }}
                    </td>
                    <td class="text-right">
                      {{ money(opt.costi_fissi.house_fee, opt.valuta) }}
                    </td>
                  </tr>
                  <tr
                    v-if="
                      opt.costi_fissi.hub_handling_kg > 0 ||
                      opt.costi_fissi.hub_handling > 0
                    "
                  >
                    <td>
                      {{
                        t("consolidata.quote.hubHandling", {
                          kg: opt.costi_fissi.hub_handling_kg,
                        })
                      }}
                    </td>
                    <td class="text-right">
                      {{ money(opt.costi_fissi.hub_handling, opt.valuta) }}
                    </td>
                  </tr>
                  <tr v-if="opt.costi_fissi.shuttle">
                    <td>
                      {{
                        t("consolidata.quote.shuttle", {
                          km: opt.costi_fissi.shuttle_km ?? 0,
                        })
                      }}
                    </td>
                    <td class="text-right">
                      {{ money(opt.costi_fissi.shuttle, opt.valuta) }}
                    </td>
                  </tr>
                  <tr class="font-weight-bold">
                    <td>{{ t("consolidata.quote.fixedCostsTotal") }}</td>
                    <td class="text-right">
                      {{ money(opt.costi_fissi.totale, opt.valuta) }}
                    </td>
                  </tr>
                </tbody>
              </v-table>

              <div
                class="d-flex justify-space-between text-caption text-medium-emphasis mt-2"
              >
                <span
                  >{{ t("consolidata.quote.legsSubtotal") }}:
                  {{ money(opt.totale_tratte, opt.valuta) }}</span
                >
                <span class="font-weight-bold">{{ optTotal(opt) }}</span>
              </div>
            </v-card-text>
            <v-card-actions v-if="!opt.incomplete && canCreate">
              <v-spacer />
              <v-btn
                variant="tonal"
                color="primary"
                size="small"
                prepend-icon="mdi-folder-plus-outline"
                @click="askCreate(opt)"
              >
                {{ t("consolidata.quote.createFromOption") }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
      <p class="text-body-2 text-medium-emphasis mt-2">
        {{ result.recommendation_reason.text }}
      </p>
    </template>

    <ConsolidataFromOptionDialog
      v-model="createDialog"
      :saving="creating"
      :error="createError"
      :option-label="chosen?.label ?? ''"
      :default-title="defaultTitle"
      @submit="createFromOption"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import ConsolidataFromOptionDialog from "../components/ConsolidataFromOptionDialog.vue";
import {
  consolidataService,
  ConsolidataRequestError,
} from "../services/consolidata.service";
import { useConsolidataStore } from "../stores/consolidata.store";
import { useFormat } from "../composables/useFormat";
import { actionAvailable, errorI18nKey, normalizeApiError } from "../logic";
import type {
  ConsolidataError,
  QuoteAddress,
  QuoteOption,
  QuotePackage,
  QuoteResult,
  QuoteShipmentInput,
} from "../types";

const { t } = useI18n();
const router = useRouter();
const toast = useToastStore();
const detailStore = useConsolidataStore();
const { money, num } = useFormat();
const optTotal = (o: QuoteOption): string => money(o.totale, o.valuta);

interface ShipmentRow {
  key: number;
  ref: string;
  origin_country: string;
  origin_zip: string;
  origin_city: string;
  origin_terminal: string;
  goods: string;
  value: number | null;
  ready_date: string;
  packages: QuotePackage[];
}

let nextKey = 1;
function blankPackage(): QuotePackage {
  return { quantity: 1, weight: 100, length: 60, width: 40, height: 40 };
}
function blankShipment(): ShipmentRow {
  const n = nextKey++;
  return {
    key: n,
    ref: `Q${n}`,
    origin_country: "",
    origin_zip: "",
    origin_city: "",
    origin_terminal: "",
    goods: "",
    value: null,
    ready_date: "",
    packages: [blankPackage()],
  };
}

function totalWeight(s: ShipmentRow): number {
  return s.packages.reduce(
    (sum, p) => sum + Number(p.quantity || 0) * Number(p.weight || 0),
    0,
  );
}

const dest = reactive({ country: "", zip: "", city: "", terminal: "" });
const preference = ref<"price" | "speed" | "balanced">("balanced");
// Computed: las etiquetas cambian con el idioma (E10).
const preferenceItems = computed(() => [
  { title: t("consolidata.quote.preferencePrice"), value: "price" },
  { title: t("consolidata.quote.preferenceSpeed"), value: "speed" },
  { title: t("consolidata.quote.preferenceBalanced"), value: "balanced" },
]);

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

/** Petición tal como se envió: `create_from_option` debe usar exactamente los mismos datos. */
const lastRequest = ref<{
  shipments: QuoteShipmentInput[];
  destination: QuoteAddress;
} | null>(null);

function buildShipments(): QuoteShipmentInput[] {
  return shipments.map((s, i) => {
    const origin: QuoteAddress = {
      country: s.origin_country.trim().toUpperCase(),
      zip: s.origin_zip.trim(),
      city: s.origin_city.trim(),
    };
    const trm = s.origin_terminal.trim().toUpperCase();
    if (trm) origin.terminal = trm;
    const out: QuoteShipmentInput = {
      ref: s.ref.trim() || `Q${i + 1}`,
      origin,
      weight: Math.round(totalWeight(s) * 100) / 100,
      packages: s.packages.map((p) => ({
        quantity: Number(p.quantity) || 1,
        weight: Number(p.weight) || 0,
        length: Number(p.length) || 0,
        width: Number(p.width) || 0,
        height: Number(p.height) || 0,
      })),
    };
    if (s.goods.trim()) out.goods = s.goods.trim();
    if (s.value !== null && String(s.value) !== "") out.value = Number(s.value);
    if (s.ready_date) out.ready_date = s.ready_date;
    return out;
  });
}

function buildDestination(): QuoteAddress {
  const d: QuoteAddress = {
    country: dest.country.trim().toUpperCase(),
    zip: dest.zip.trim(),
    city: dest.city.trim(),
  };
  const trm = dest.terminal.trim().toUpperCase();
  if (trm) d.terminal = trm;
  return d;
}

async function submit(): Promise<void> {
  error.value = null;
  result.value = null;
  loading.value = true;
  try {
    const req = {
      shipments: buildShipments(),
      destination: buildDestination(),
    };
    result.value = await consolidataService.quote({
      ...req,
      preference: preference.value,
    });
    lastRequest.value = req;
  } catch (err) {
    error.value =
      err instanceof ConsolidataRequestError
        ? err.info.message || t(errorI18nKey(err.info.code))
        : t("consolidata.errors.UNKNOWN");
  } finally {
    loading.value = false;
  }
}

// ─── Crear proyecto desde una opción (create_from_option) ───────────────
const canCreate = computed(
  () =>
    !detailStore.meta ||
    actionAvailable(detailStore.actions, "create_from_option", "A"),
);
const createDialog = ref(false);
const creating = ref(false);
const createError = ref<ConsolidataError | null>(null);
const chosen = ref<QuoteOption | null>(null);
const defaultTitle = computed(() => {
  const d = lastRequest.value?.destination;
  return chosen.value
    ? `${chosen.value.label}${d?.country ? ` → ${d.country}` : ""}`
    : "";
});

function askCreate(opt: QuoteOption): void {
  chosen.value = opt;
  createError.value = null;
  createDialog.value = true;
}

async function createFromOption(v: {
  customerId: number;
  titolo: string;
}): Promise<void> {
  if (!chosen.value || !lastRequest.value) return;
  creating.value = true;
  createError.value = null;
  try {
    const res = await consolidataService.createFromOption({
      option: chosen.value.key,
      shipments: lastRequest.value.shipments,
      destination: lastRequest.value.destination,
      titolo: v.titolo,
      customer_id: v.customerId,
    });
    createDialog.value = false;
    toast.success(t("consolidata.messages.created"));
    const id = Number(res.progetto?.id ?? 0);
    if (id > 0)
      void router.push({
        name: "consolidata-detail",
        params: { id: String(id) },
      });
  } catch (err) {
    createError.value =
      err instanceof ConsolidataRequestError
        ? err.info
        : normalizeApiError(err);
  } finally {
    creating.value = false;
  }
}

onMounted(() => void detailStore.fetchMeta());
</script>

<style scoped>
.cons-page {
  padding: 16px;
}
.cons-leg-error {
  white-space: normal !important;
}
.cons-quote-table :deep(td),
.cons-quote-table :deep(th) {
  white-space: nowrap;
}
</style>
