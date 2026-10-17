<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";
import EmptyState from "@shared/ui/EmptyState.vue";
import {
  assignCheck,
  fetchSuggestions,
  searchShipments,
} from "../services/cod.service";
import type { ReviewBatch, ReviewCheck, Suggestion } from "../types";

const props = defineProps<{ idSession: number; check: ReviewCheck }>();
const emit = defineEmits<{
  (e: "assigned", batch: ReviewBatch): void;
  (e: "close"): void;
}>();

const { t } = useI18n();

const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const candidates = ref<Suggestion[]>([]);
const total = ref(0);
const exact = ref(false);
const selected = ref<number | null>(null);

/**
 * The escape hatch, as a lookup rather than a memory test.
 *
 * Typing a bare shipment id means knowing it by heart and getting no feedback
 * until after the money is pinned. Searching shows the amount and the customer,
 * so the person can SEE they picked the right one first.
 *
 * The refs follow the project's remote-autocomplete rule: a plain ref for the
 * id (never derived from `items`), one-way :model-value + onPick as the only
 * writer. Deriving it from the list makes Vuetify silently drop the selection
 * whenever the search results change.
 */
const manualId = ref<number | null>(null);
const searchResults = ref<Suggestion[]>([]);
const searching = ref(false);
const pickedItem = ref<Suggestion | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

/** Search results plus whatever is selected, so its label always resolves. */
const searchItems = computed<Suggestion[]>(() => {
  const rows = [...searchResults.value];
  if (pickedItem.value && !rows.some((r) => r.id === pickedItem.value!.id)) {
    rows.unshift(pickedItem.value);
  }
  return rows;
});

function labelOf(s: Suggestion): string {
  const parts = [String(s.id)];
  if (s.AWB_forn) parts.push(s.AWB_forn);
  if (s.RIF_cliente) parts.push(`LDV ${s.RIF_cliente}`);
  parts.push(`${amountOf(s)} €`);
  if (s.cliente_nome) parts.push(s.cliente_nome);
  return parts.join(" · ");
}

function onSearch(query: string): void {
  // Vuetify echoes the label back right after a pick; that is not a query.
  if (pickedItem.value && query === labelOf(pickedItem.value)) {
    return;
  }
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  const q = (query ?? "").trim();
  if (q.length < 3) {
    searchResults.value = [];
    return;
  }
  // Debounced: this fires on every keystroke and hits the database.
  searchTimer = setTimeout(async () => {
    searching.value = true;
    try {
      searchResults.value = (
        await searchShipments(props.idSession, q)
      ).candidates;
    } catch {
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  }, 300);
}

/** The only writer of manualId. */
function onPick(id: number | null): void {
  manualId.value = id;
  pickedItem.value =
    id === null ? null : (searchItems.value.find((s) => s.id === id) ?? null);
  if (id !== null) {
    selected.value = null;
  }
}

onMounted(async () => {
  try {
    const result = await fetchSuggestions(props.idSession, props.check.id);
    candidates.value = result.candidates;
    total.value = result.total;
    exact.value = result.exact;
    // Never preselect. Even the single-candidate case is a suggestion: these
    // rows are here precisely because no rule could resolve them, and a
    // pre-ticked radio is an answer wearing a question's clothes.
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load_failed");
  } finally {
    loading.value = false;
  }
});

function amountOf(s: Suggestion): string {
  const value =
    typeof s.contras_imp === "number" ? s.contras_imp : Number(s.contras_imp);
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : String(s.contras_imp);
}

/** Legacy zero dates are not dates: MariaDB hands back '0000-00-00' for unset. */
function dateOf(value: string | null): string {
  if (!value || value.startsWith("0000-00-00")) {
    return "—";
  }
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

async function save(): Promise<void> {
  const id = selected.value ?? manualId.value;
  if (!id || id <= 0) {
    error.value = t("cod_assegni.suggest.pick_one");
    return;
  }

  saving.value = true;
  error.value = null;
  try {
    const batch = await assignCheck(
      props.idSession,
      props.check.id,
      id,
      selected.value
        ? t("cod_assegni.suggest.note_from_candidates")
        : t("cod_assegni.suggest.note_typed"),
    );
    emit("assigned", batch);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action_failed");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppDialog
    :open="true"
    :title="t('cod_assegni.suggest.title')"
    icon="mdi-cash-refund"
    :max-width="820"
    @close="emit('close')"
  >
    <!-- What we are deciding about, kept on screen: the person is about to tie
         money to a shipment and should not have to remember which cheque. -->
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      <div class="text-body-2">
        <strong>{{ check.numero_assegno }}</strong>
        <span v-if="check.banca"> · {{ check.banca }}</span>
        · <strong>{{ check.importo }}</strong>
        <span v-if="check.documento"> · {{ check.documento }}</span>
      </div>
      <div v-if="check.match_note" class="text-caption mt-1">
        {{ check.match_note }}
      </div>
    </v-alert>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <v-skeleton-loader v-if="loading" type="table" />

    <template v-else>
      <p class="text-body-2 text-medium-emphasis mb-3">
        {{
          exact
            ? t("cod_assegni.suggest.exactly_one")
            : t("cod_assegni.suggest.n_candidates", { n: total })
        }}
      </p>

      <EmptyState
        v-if="!candidates.length"
        icon="mdi-magnify-remove-outline"
        :title="t('cod_assegni.suggest.none')"
        :text="t('cod_assegni.suggest.none_hint')"
      />

      <v-radio-group v-else v-model="selected" hide-details class="mb-4">
        <v-table density="compact">
          <thead>
            <tr>
              <th style="width: 48px"></th>
              <th>{{ t("cod_assegni.suggest.shipment") }}</th>
              <th>{{ t("cod_assegni.suggest.awb") }}</th>
              <th>{{ t("cod_assegni.suggest.customer") }}</th>
              <th>{{ t("cod_assegni.suggest.date") }}</th>
              <th class="text-right">{{ t("cod_assegni.suggest.cod") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in candidates" :key="s.id">
              <td><v-radio :value="s.id" density="compact" hide-details /></td>
              <td>{{ s.id }}</td>
              <td>{{ s.AWB_forn || "—" }}</td>
              <td>
                {{ s.cliente_nome || "—" }}
                <div
                  v-if="s.RIF_cliente"
                  class="text-caption text-medium-emphasis"
                >
                  {{ s.RIF_cliente }}
                </div>
              </td>
              <td>{{ dateOf(s.data_sped0) }}</td>
              <td class="text-right">{{ amountOf(s) }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-radio-group>

      <!-- The escape hatch. The candidate list is amount + date window +
           carrier; a cheque that fits none of it still has to land somewhere,
           and a specialist who knows the answer should not be blocked by a
           search that does not. -->
      <!-- One-way :model-value + onPick as the only writer: with a remote
           search, v-model + return-object makes Vuetify drop the selection
           every time `items` changes underneath. -->
      <v-autocomplete
        :model-value="manualId"
        :items="searchItems"
        :item-title="labelOf"
        item-value="id"
        :label="t('cod_assegni.suggest.manual_id')"
        :hint="t('cod_assegni.suggest.manual_hint')"
        :loading="searching"
        :no-data-text="t('cod_assegni.suggest.search_hint')"
        persistent-hint
        density="comfortable"
        variant="outlined"
        clearable
        no-filter
        :disabled="selected !== null"
        @update:search="onSearch"
        @update:model-value="onPick"
      >
        <template #item="{ props: itemProps, item }">
          <v-list-item v-bind="itemProps" :title="undefined">
            <v-list-item-title>
              {{ item.raw.id }}
              <span v-if="item.raw.AWB_forn" class="text-medium-emphasis">
                · {{ item.raw.AWB_forn }}
              </span>
            </v-list-item-title>
            <v-list-item-subtitle>
              <strong>{{ amountOf(item.raw) }} €</strong>
              <span v-if="item.raw.cliente_nome">
                · {{ item.raw.cliente_nome }}</span
              >
              <span v-if="item.raw.data_sped0">
                · {{ dateOf(item.raw.data_sped0) }}</span
              >
            </v-list-item-subtitle>
          </v-list-item>
        </template>
      </v-autocomplete>
    </template>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" :disabled="saving" @click="emit('close')">
        {{ t("common.cancel") }}
      </v-btn>
      <v-btn color="primary" variant="flat" :loading="saving" @click="save">
        {{ t("cod_assegni.suggest.assign") }}
      </v-btn>
    </template>
  </AppDialog>
</template>
