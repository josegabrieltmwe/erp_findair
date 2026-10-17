<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { assignCheck, fetchSuggestions } from "../services/cod.service";
import type { ReviewBatch, ReviewCheck, Suggestion } from "../types";

const props = defineProps<{ idSession: number; check: ReviewCheck }>();
const emit = defineEmits<{
  (e: "assigned", batch: ReviewBatch): void;
  (e: "more"): void;
}>();

const { t } = useI18n();

const loading = ref(true);
const assigning = ref<number | null>(null);
const error = ref<string | null>(null);
const candidates = ref<Suggestion[]>([]);
const total = ref(0);

/**
 * The recommendations, right where the cheque is.
 *
 * A cash return with no AWB used to mean opening a dialog to see what it might
 * belong to. Here the top candidates sit under the cheque, so the specialist
 * decides without a detour -- and the "…more" escape into the full picker
 * stays, because a search this narrow (amount + date window) does not always
 * contain the answer.
 */
onMounted(async () => {
  try {
    const result = await fetchSuggestions(props.idSession, props.check.id);
    candidates.value = result.candidates.slice(0, 3);
    total.value = result.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load_failed");
  } finally {
    loading.value = false;
  }
});

function amountOf(s: Suggestion): string {
  const v =
    typeof s.contras_imp === "number" ? s.contras_imp : Number(s.contras_imp);
  return Number.isFinite(v)
    ? v.toLocaleString(undefined, { minimumFractionDigits: 2 })
    : String(s.contras_imp);
}

function dateOf(value: string | null): string {
  if (!value || value.startsWith("0000-00-00")) {
    return "";
  }
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

/** Assign straight from the inline row, recorded as a person's decision. */
async function pick(s: Suggestion): Promise<void> {
  assigning.value = s.id;
  error.value = null;
  try {
    const batch = await assignCheck(
      props.idSession,
      props.check.id,
      s.id,
      t("cod_assegni.suggest.note_from_candidates"),
    );
    emit("assigned", batch);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action_failed");
  } finally {
    assigning.value = null;
  }
}
</script>

<template>
  <div class="inline-sug">
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      {{ error }}
    </v-alert>

    <div
      v-if="loading"
      class="text-caption text-medium-emphasis d-flex align-center ga-2"
    >
      <v-progress-circular indeterminate size="14" width="2" />
      {{ t("cod_assegni.suggest.searching") }}
    </div>

    <template v-else>
      <!-- No candidate fits the amount + date window. Not a dead end: the full
           picker searches by AWB / LDV / id, which this narrow rule does not. -->
      <div v-if="!candidates.length" class="text-caption text-medium-emphasis">
        {{ t("cod_assegni.suggest.none_inline") }}
      </div>

      <div v-else>
        <div class="text-caption text-medium-emphasis mb-1">
          {{
            total === 1
              ? t("cod_assegni.suggest.exactly_one")
              : t("cod_assegni.suggest.n_candidates", { n: total })
          }}
        </div>

        <div v-for="s in candidates" :key="s.id" class="inline-sug__row">
          <div class="inline-sug__info">
            <strong>{{ s.id }}</strong>
            <span v-if="s.AWB_forn" class="text-medium-emphasis">
              · {{ s.AWB_forn }}</span
            >
            <span class="inline-sug__amount"> · {{ amountOf(s) }} €</span>
            <span v-if="s.cliente_nome" class="text-medium-emphasis">
              · {{ s.cliente_nome }}</span
            >
            <span v-if="dateOf(s.data_sped0)" class="text-medium-emphasis">
              · {{ dateOf(s.data_sped0) }}</span
            >
          </div>
          <v-btn
            size="x-small"
            variant="tonal"
            color="primary"
            :loading="assigning === s.id"
            :disabled="assigning !== null"
            @click="pick(s)"
          >
            {{ t("cod_assegni.suggest.assign") }}
          </v-btn>
        </div>
      </div>

      <!-- Always offered: the inline list is the fast path, not the only one. -->
      <v-btn
        size="x-small"
        variant="text"
        class="mt-1"
        prepend-icon="mdi-magnify"
        @click="emit('more')"
      >
        {{ t("cod_assegni.suggest.search_more") }}
      </v-btn>
    </template>
  </div>
</template>

<style scoped>
.inline-sug {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface-light, 245 245 245) / 0.6);
}

.inline-sug__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.inline-sug__info {
  flex: 1;
  min-width: 0;
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-sug__amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
</style>
