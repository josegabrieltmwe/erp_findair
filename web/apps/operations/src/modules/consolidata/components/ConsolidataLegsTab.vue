<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-2">
      <span class="text-body-2">{{ t("consolidata.legs.help") }}</span>
      <v-btn
        v-if="canRecalc"
        size="small"
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="store.saving"
        @click="recalc"
      >
        {{ t("consolidata.legs.recalc") }}
      </v-btn>
    </div>
    <v-table density="compact">
      <thead>
        <tr>
          <th>#</th>
          <th>{{ t("consolidata.legs.type") }}</th>
          <th>{{ t("consolidata.legs.route") }}</th>
          <th class="text-right">{{ t("consolidata.legs.weight") }}</th>
          <th>{{ t("consolidata.legs.service") }}</th>
          <th class="text-right">{{ t("consolidata.legs.total") }}</th>
          <th>{{ t("consolidata.legs.validity") }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="l in legs" :key="l.id">
          <td>{{ l.ordine }}</td>
          <td>{{ l.tipo }}</td>
          <td>
            {{ place(l.orig_paese, l.orig_terminal || l.orig_cap) }} →
            {{ place(l.dest_paese, l.dest_terminal || l.dest_cap) }}
          </td>
          <td class="text-right">{{ l.peso.toFixed(2) }}</td>
          <td>
            {{ l.servizio_nome || "—" }}
            <v-chip
              v-if="l.fonte_prezzo"
              size="x-small"
              class="ml-1"
              variant="tonal"
              >{{ l.fonte_prezzo }}</v-chip
            >
            <div v-if="l.errore_quotazione" class="text-caption text-error">
              {{ l.errore_quotazione }}
            </div>
          </td>
          <td class="text-right">{{ l.totale.toFixed(2) }} {{ l.valuta }}</td>
          <td>{{ shortDate(l.quote_valid_until) || "—" }}</td>
          <td class="text-right text-no-wrap">
            <template v-if="canEdit">
              <v-btn
                icon="mdi-pencil"
                size="x-small"
                variant="text"
                :aria-label="t('consolidata.common.edit')"
                @click="openEdit(l)"
              />
              <v-btn
                icon="mdi-currency-eur"
                size="x-small"
                variant="text"
                :aria-label="t('consolidata.legs.priceTitle')"
                @click="openPrice(l)"
              />
            </template>
          </td>
        </tr>
        <tr v-if="!legs.length">
          <td colspan="8" class="text-center text-medium-emphasis py-4">
            {{ t("consolidata.legs.empty") }}
          </td>
        </tr>
      </tbody>
    </v-table>

    <ConsolidataLegEditDialog
      v-model="editDialog"
      :saving="store.saving"
      :error="store.error"
      :leg="current"
      @submit="saveEdit"
    />
    <ConsolidataPriceDialog
      v-model="priceDialog"
      :saving="store.saving"
      :error="store.error"
      :leg="current"
      @submit="savePrice"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataLegEditDialog from "./ConsolidataLegEditDialog.vue";
import ConsolidataPriceDialog from "./ConsolidataPriceDialog.vue";
import { useConsolidataStore } from "../stores/consolidata.store";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import { shortDate } from "../logic";
import type { Leg, PricePayload } from "../types";

defineProps<{ canEdit: boolean; canRecalc: boolean }>();
const { t } = useI18n();
const store = useConsolidataStore();
const toast = useToastStore();
const legs = computed(() => store.project?.tratte ?? []);
const current = ref<Leg | null>(null);
const editDialog = ref(false);
const priceDialog = ref(false);

const place = (country: string, where: string | null): string =>
  `${country} ${where ?? ""}`.trim();

function openEdit(l: Leg): void {
  store.clearError();
  current.value = l;
  editDialog.value = true;
}

function openPrice(l: Leg): void {
  store.clearError();
  current.value = l;
  priceDialog.value = true;
}

async function saveEdit(leg: Record<string, unknown>): Promise<void> {
  if (current.value && (await store.updateLeg(current.value.id, leg))) {
    editDialog.value = false;
    toast.success(t("consolidata.legs.saved"));
  }
}

async function savePrice(p: PricePayload): Promise<void> {
  if (current.value && (await store.overridePrice(current.value.id, p))) {
    priceDialog.value = false;
    toast.success(t("consolidata.legs.priceSaved"));
  }
}

async function recalc(): Promise<void> {
  if (await store.recalc()) toast.success(t("consolidata.legs.recalculated"));
}
</script>
