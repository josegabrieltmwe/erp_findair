<template>
  <div>
    <div class="d-flex justify-space-between align-center flex-wrap ga-2 mb-2">
      <span class="text-body-2">{{ t("consolidata.legs.help") }}</span>
      <div class="d-flex ga-2">
        <v-btn
          v-if="gates.addLeg"
          size="small"
          color="primary"
          prepend-icon="mdi-plus"
          :disabled="atLimit"
          @click="openAdd"
        >
          {{ t("consolidata.legs.add") }}
        </v-btn>
        <v-btn
          v-if="gates.recalc"
          size="small"
          variant="tonal"
          prepend-icon="mdi-refresh"
          :loading="store.saving"
          @click="recalc"
        >
          {{ t("consolidata.legs.recalc") }}
        </v-btn>
      </div>
    </div>
    <p v-if="maxLegs" class="text-caption text-medium-emphasis mb-2">
      {{ t("consolidata.legs.limit", { n: legs.length, max: maxLegs }) }}
    </p>
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
          <td class="text-right">{{ num(l.peso) }}</td>
          <td>
            {{ l.servizio_nome || "—" }}
            <v-chip
              v-if="l.fonte_prezzo"
              size="x-small"
              class="ml-1"
              variant="tonal"
              >{{ sourceLabel(l.fonte_prezzo) }}</v-chip
            >
            <div v-if="l.errore_quotazione" class="text-caption text-error">
              {{ l.errore_quotazione }}
            </div>
          </td>
          <td class="text-right">{{ money(l.totale, l.valuta) }}</td>
          <td>{{ shortDate(l.quote_valid_until) || "—" }}</td>
          <td class="text-right text-no-wrap">
            <v-btn
              v-if="gates.updateLeg"
              icon="mdi-pencil"
              size="x-small"
              variant="text"
              :aria-label="t('consolidata.common.edit')"
              :title="t('consolidata.common.edit')"
              @click="openEdit(l)"
            />
            <v-btn
              v-if="gates.overridePrice"
              icon="mdi-cash-edit"
              size="x-small"
              variant="text"
              :aria-label="t('consolidata.legs.priceTitle')"
              :title="t('consolidata.legs.priceTitle')"
              @click="openPrice(l)"
            />
            <v-btn
              v-if="gates.removeLeg"
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              :aria-label="t('consolidata.common.remove')"
              :title="t('consolidata.common.remove')"
              @click="remove(l)"
            />
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
    <ConsolidataLegAddDialog
      v-model="addDialog"
      :saving="store.saving"
      :error="store.error"
      :can-manual-price="gates.overridePrice"
      :defaults="addDefaults"
      @submit="saveAdd"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataLegEditDialog from "./ConsolidataLegEditDialog.vue";
import ConsolidataPriceDialog from "./ConsolidataPriceDialog.vue";
import ConsolidataLegAddDialog from "./ConsolidataLegAddDialog.vue";
import { useConsolidataStore } from "../stores/consolidata.store";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import { useFormat } from "../composables/useFormat";
import { useConsolidataConfirm } from "../composables/useConfirm";
import { shortDate, type LegForm, type projectGates } from "../logic";
import type { Leg, LegPayload, PricePayload } from "../types";

defineProps<{ gates: ReturnType<typeof projectGates> }>();
const { t, te } = useI18n();
const { money, num } = useFormat();
const confirm = useConsolidataConfirm();
const store = useConsolidataStore();
const toast = useToastStore();
const legs = computed(() => store.project?.tratte ?? []);
const current = ref<Leg | null>(null);
const editDialog = ref(false);
const priceDialog = ref(false);
const addDialog = ref(false);

const maxLegs = computed(() => store.meta?.limits?.max_legs ?? 0);
const atLimit = computed(
  () => maxLegs.value > 0 && legs.value.length >= maxLegs.value,
);

/** El tramo nuevo parte del hub y destino del proyecto. */
const addDefaults = computed<Partial<LegForm>>(() => {
  const p = store.project;
  const last = legs.value[legs.value.length - 1];
  return {
    weight: last?.peso ?? null,
    destination: {
      country: p?.dest_country ?? "",
      zip: "",
      city: "",
      terminal: "",
    },
    origin: {
      country: last?.dest_paese ?? "",
      zip: last?.dest_cap ?? "",
      city: last?.dest_citta ?? "",
      terminal: last?.dest_terminal ?? p?.hub_terminal ?? "",
    },
  };
});

const place = (country: string, where: string | null): string =>
  `${country} ${where ?? ""}`.trim();

function sourceLabel(src: string): string {
  const key = `consolidata.legs.source.${src}`;
  return te(key) ? t(key) : src;
}

function openAdd(): void {
  store.clearError();
  addDialog.value = true;
}

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

async function saveAdd(leg: LegPayload): Promise<void> {
  if (await store.addLeg(leg)) {
    addDialog.value = false;
    toast.success(t("consolidata.legs.added"));
  }
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

async function remove(l: Leg): Promise<void> {
  if (
    !(await confirm(
      t("consolidata.legs.confirmRemove", { n: l.ordine, tipo: l.tipo }),
      true,
    ))
  )
    return;
  if (await store.removeLeg(l.id)) toast.success(t("consolidata.legs.removed"));
}

async function recalc(): Promise<void> {
  if (await store.recalc()) toast.success(t("consolidata.legs.recalculated"));
}
</script>
