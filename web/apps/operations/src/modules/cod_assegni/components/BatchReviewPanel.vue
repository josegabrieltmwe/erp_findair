<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import StatusChip from "@shared/ui/StatusChip.vue";
import ConfirmDialog from "@shared/ui/ConfirmDialog.vue";
import EmptyState from "@shared/ui/EmptyState.vue";
import SuggestionPicker from "../components/SuggestionPicker.vue";
import InlineSuggestions from "../components/InlineSuggestions.vue";
import {
  approveBatch,
  confirmBulk,
  confirmCheck,
  fetchCarriers,
  fetchReview,
  rematchBatch,
} from "../services/cod.service";
import type {
  ApplyReport,
  Carrier,
  MatchState,
  ReviewBatch,
  ReviewCheck,
} from "../types";

const props = defineProps<{ idSession: number }>();

const { t } = useI18n();

const batch = ref<ReviewBatch | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const busy = ref(false);
const notice = ref<string | null>(null);

/** The cheque a dialog is currently about. */
const confirming = ref<ReviewCheck | null>(null);
const picking = ref<ReviewCheck | null>(null);
const rematchOpen = ref(false);

/**
 * The carrier the re-match will run against.
 *
 * Matching is scoped by carrier, so a batch opened under the wrong one comes
 * back not_found on every document while the shipments sit there under the
 * right one — and plain "re-match" cannot fix that, it asks the same question
 * again. Picking another carrier here repoints the batch and re-matches in one
 * action, instead of deleting it and reissuing a QR already handed out.
 *
 * Seeded from the batch each time the dialog opens, so the default is "same
 * carrier as now" and the existing behaviour is what you get by just confirming.
 */
const rematchCarrier = ref<number | null>(null);
const carriers = ref<Carrier[]>([]);

watch(rematchOpen, async (open) => {
  if (!open) {
    return;
  }
  rematchCarrier.value = batch.value?.session.id_fornitore ?? null;
  if (carriers.value.length === 0) {
    try {
      carriers.value = await fetchCarriers();
    } catch {
      // The picker stays empty and the dialog still re-matches against the
      // carrier the batch already has — the pre-existing behaviour.
    }
  }
});

/** True when the operator picked a carrier other than the batch's. */
const carrierChanged = computed(
  () =>
    !!rematchCarrier.value &&
    rematchCarrier.value !== batch.value?.session.id_fornitore,
);

/**
 * Which cheques are ticked for a bulk confirm.
 *
 * A Set, not an array of the check objects: the list refreshes under it after
 * every action, and keying on the immutable id survives that where holding the
 * row would leave a tick pointing at a stale object.
 */
const ticked = ref<Set<number>>(new Set());

/** Which cheque's inline recommendations are open (the cash-return case). */
const expandedSuggestions = ref<Set<number>>(new Set());

/**
 * "Only the ones still needing a shipment."
 *
 * The efficient way to work a big batch: the return legs already carry a
 * shipment and just need an OK, but the cash returns and unmatched cheques need
 * one CHOSEN -- the slow, one-at-a-time work. This filter narrows the queue to
 * exactly those, so the operator is not scrolling past nine done-bar-a-click
 * cheques to reach the two that need thought.
 */
const onlyUnassigned = ref(false);
const approveOpen = ref(false);
const report = ref<ApplyReport | null>(null);

watch(() => props.idSession, load, { immediate: true });

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    batch.value = await fetchReview(props.idSession);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load_failed");
  } finally {
    loading.value = false;
  }
}

/**
 * The work queue, in the order the server ranked it.
 *
 * Cash returns come first because they are the only rows nobody but a person
 * can resolve: an "AS" document means the money came back in cash and carries
 * no AWB at all, so there is nothing to match on.
 */
const allDecisions = computed(() =>
  (batch.value?.checks ?? []).filter((c) => c.needs_decision),
);

const stateMap = computed<Record<string, { label: string; color: string }>>(
  () => ({
    matched: { label: t("cod_assegni.match.matched"), color: "success" },
    return_match: { label: t("cod_assegni.match.return_match"), color: "info" },
    cash_return: { label: t("cod_assegni.match.cash_return"), color: "error" },
    ambiguous: { label: t("cod_assegni.match.ambiguous"), color: "warning" },
    not_found: { label: t("cod_assegni.match.not_found"), color: "warning" },
    manual: { label: t("cod_assegni.match.manual"), color: "primary" },
    pending: { label: t("cod_assegni.match.pending"), color: "grey" },
    rejected: { label: t("cod_assegni.match.rejected"), color: "grey" },
  }),
);

/**
 * Filtrado del lote.
 *
 * Un lote admite 200 fotos y cada hoja lleva 5-9 cheques, asi que una remesa
 * real trae entre 1.000 y 1.800 filas. Hasta ahora el unico control era el
 * switch `onlyUnassigned` — que ademas se ocultaba justo cuando TODO estaba sin
 * asignar, es decir en un lote recien extraido, que es cuando mas falta hace.
 *
 * Todo se filtra en cliente: el endpoint devuelve el lote entero (~600 bytes
 * por cheque, 1 MB en el peor caso) y recorrer 1.800 objetos en memoria es
 * instantaneo. Pedirle paginacion al backend seria mas trabajo y mas lento.
 */
const query = ref("");
const stateFilter = ref<string[]>([]);
const bankFilter = ref<string[]>([]);

/**
 * `v-model.number` sobre un campo vaciado deja `""`, no `null`, y `"" * 100` es
 * 0: el filtro no llegaria a fallar, pero el chip de filtro activo se quedaria
 * pegado mostrando un valor vacio. Este computed normaliza cualquier entrada no
 * numerica a `null` = "sin filtro".
 */
const minAmountRaw = ref<number | string | null>(null);
const minAmount = computed<number | null>(() => {
  const v = minAmountRaw.value;
  if (v === null || v === "" || v === undefined) {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
});

/** Bancos presentes en ESTE lote, para no ofrecer un catalogo global inutil. */
const banks = computed(() => {
  const seen = new Set<string>();
  for (const c of allDecisions.value) {
    const b = (c.banca ?? "").trim();
    if (b !== "") {
      seen.add(b);
    }
  }
  return Array.from(seen).sort();
});

/** Estados presentes, con su etiqueta traducida y cuantos hay de cada uno. */
const stateOptions = computed(() => {
  const count = new Map<string, number>();
  for (const c of allDecisions.value) {
    count.set(c.stato_match, (count.get(c.stato_match) ?? 0) + 1);
  }
  return Array.from(count.entries()).map(([value, n]) => ({
    value,
    title: `${stateMap.value[value]?.label ?? value} (${n})`,
  }));
});

/**
 * Busca en numero de cheque, documento, banca y expedicion a la vez.
 *
 * Un solo campo en vez de cuatro: quien busca "AB 0057" no quiere elegir antes
 * en que columna mirar, y quien pega un numero de expedicion tampoco.
 */
function matchesQuery(c: ReviewCheck, q: string): boolean {
  if (q === "") {
    return true;
  }
  const haystack = [
    c.numero_assegno,
    c.documento,
    c.banca,
    c.id_spedizione > 0 ? String(c.id_spedizione) : "",
  ]
    .join(" ")
    .toLowerCase();
  // Sin espacios: el papel dice "AB 0057095401" y la gente teclea "AB0057".
  return (
    haystack.includes(q) ||
    haystack.replace(/\s+/g, "").includes(q.replace(/\s+/g, ""))
  );
}

const decisions = computed(() => {
  const q = query.value.trim().toLowerCase();
  return allDecisions.value.filter((c) => {
    if (onlyUnassigned.value && c.id_spedizione > 0) {
      return false;
    }
    if (
      stateFilter.value.length > 0 &&
      !stateFilter.value.includes(c.stato_match)
    ) {
      return false;
    }
    if (
      bankFilter.value.length > 0 &&
      !bankFilter.value.includes((c.banca ?? "").trim())
    ) {
      return false;
    }
    if (
      minAmount.value !== null &&
      (c.importo_cents ?? 0) < minAmount.value * 100
    ) {
      return false;
    }
    return matchesQuery(c, q);
  });
});

/** Chips de filtro activo: lo aplicado, visible y quitable de uno en uno. */
const activeFilters = computed(() => {
  const out: Array<{ field: string; group: string; value: string }> = [];
  if (query.value.trim() !== "") {
    out.push({
      field: "query",
      group: t("cod_assegni.review.search"),
      value: query.value.trim(),
    });
  }
  for (const s of stateFilter.value) {
    out.push({
      field: `state:${s}`,
      group: t("cod_assegni.review.state"),
      value: stateMap.value[s]?.label ?? s,
    });
  }
  for (const b of bankFilter.value) {
    out.push({
      field: `bank:${b}`,
      group: t("cod_assegni.check.bank"),
      value: b,
    });
  }
  if (minAmount.value !== null) {
    out.push({
      field: "minAmount",
      group: t("cod_assegni.review.min_amount"),
      value: `≥ ${minAmount.value}`,
    });
  }
  if (onlyUnassigned.value) {
    out.push({
      field: "onlyUnassigned",
      group: t("cod_assegni.review.filter"),
      value: t("cod_assegni.review.unassigned_short"),
    });
  }
  return out;
});

function removeFilter(field: string): void {
  if (field === "query") {
    query.value = "";
  } else if (field === "minAmount") {
    minAmountRaw.value = null;
  } else if (field === "onlyUnassigned") {
    onlyUnassigned.value = false;
  } else if (field.startsWith("state:")) {
    stateFilter.value = stateFilter.value.filter((s) => s !== field.slice(6));
  } else if (field.startsWith("bank:")) {
    bankFilter.value = bankFilter.value.filter((b) => b !== field.slice(5));
  }
}

function clearFilters(): void {
  query.value = "";
  stateFilter.value = [];
  bankFilter.value = [];
  minAmountRaw.value = null;
  onlyUnassigned.value = false;
}

/**
 * Cuantos cheques se pintan de golpe.
 *
 * Cada tarjeta monta 11 componentes Vuetify (chips, checkbox, tres botones,
 * enlace…). Con 1.000 cheques serian ~11.000 componentes vivos a la vez, y cada
 * accion recarga el lote y los repinta todos. Limitarlo a 50 y crecer bajo
 * demanda mantiene la pantalla utilizable sin cambiar como se trabaja: quien
 * revisa de arriba abajo pulsa "ver mas"; quien busca un cheque concreto ya lo
 * tiene filtrado antes de llegar al limite.
 *
 * No es paginacion con numeros: partir en paginas una cola de trabajo obliga a
 * recordar por que pagina ibas cada vez que una accion recarga el lote.
 */
const PAGE_STEP = 50;
const visibleCount = ref(PAGE_STEP);

/** Al filtrar se vuelve al principio: el listado que miras es otro. */
watch([query, stateFilter, bankFilter, minAmount, onlyUnassigned], () => {
  visibleCount.value = PAGE_STEP;
});

const visibleDecisions = computed(() =>
  decisions.value.slice(0, visibleCount.value),
);
const hasMore = computed(() => decisions.value.length > visibleCount.value);

function showMore(): void {
  visibleCount.value += PAGE_STEP;
}

/** How many still need a shipment picked, for the filter's own label. */
const unassignedCount = computed(
  () => allDecisions.value.filter((c) => c.id_spedizione <= 0).length,
);

const settled = computed(() =>
  (batch.value?.checks ?? []).filter((c) => !c.needs_decision),
);

/** What this row needs from the person looking at it, in one line. */
function guidance(state: MatchState): string {
  switch (state) {
    case "cash_return":
      return t("cod_assegni.guidance.cash_return");
    case "return_match":
      return t("cod_assegni.guidance.return_match");
    case "ambiguous":
      return t("cod_assegni.guidance.ambiguous");
    case "not_found":
      return t("cod_assegni.guidance.not_found");
    default:
      return "";
  }
}

/** A derived match is confirmable; the rest need a shipment chosen. */
function canConfirm(check: ReviewCheck): boolean {
  return check.stato_match === "return_match" && check.id_spedizione > 0;
}

async function doConfirm(): Promise<void> {
  const check = confirming.value;
  if (!check) {
    return;
  }
  busy.value = true;
  try {
    await confirmCheck(props.idSession, check.id);
    confirming.value = null;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action_failed");
  } finally {
    busy.value = false;
  }
}

async function doRematch(): Promise<void> {
  busy.value = true;
  try {
    // Only sent when it actually changed: an unchanged carrier would make the
    // server rewrite the batch with the value it already holds.
    const result = await rematchBatch(
      props.idSession,
      carrierChanged.value ? (rematchCarrier.value ?? undefined) : undefined,
    );
    batch.value = result;
    rematchOpen.value = false;
    notice.value = t("cod_assegni.rematch.done", { n: result.updated });
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action_failed");
  } finally {
    busy.value = false;
  }
}

/**
 * Approving is the one-way door: the capture becomes the shipments' record.
 *
 * Offered even with rows still pending, because a batch where one cash return
 * is unresolvable should not block the twenty cheques that are perfectly clear.
 * The server only applies what a person ruled on; the rest stay on the bench.
 */
async function doApprove(): Promise<void> {
  busy.value = true;
  try {
    report.value = await approveBatch(props.idSession);
    approveOpen.value = false;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action_failed");
  } finally {
    busy.value = false;
  }
}

function onAssigned(updated: ReviewBatch): void {
  batch.value = updated;
  picking.value = null;
  // Whatever just got assigned is settled now; drop any stale tick/expansion.
  ticked.value = new Set();
  expandedSuggestions.value = new Set();
}

/** Only derived matches (a shipment already attached) can be bulk-confirmed. */
const confirmable = computed(() => decisions.value.filter(canConfirm));

const tickedConfirmable = computed(() =>
  confirmable.value.filter((c) => ticked.value.has(c.id)),
);

function toggleTick(id: number): void {
  const next = new Set(ticked.value);
  next.has(id) ? next.delete(id) : next.add(id);
  ticked.value = next;
}

function toggleAll(): void {
  ticked.value =
    tickedConfirmable.value.length === confirmable.value.length
      ? new Set()
      : new Set(confirmable.value.map((c) => c.id));
}

function toggleSuggestions(id: number): void {
  const next = new Set(expandedSuggestions.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expandedSuggestions.value = next;
}

/** Confirm every ticked derived match in one action. */
async function doConfirmBulk(): Promise<void> {
  const ids = tickedConfirmable.value.map((c) => c.id);
  if (!ids.length) {
    return;
  }
  busy.value = true;
  try {
    const result = await confirmBulk(props.idSession, ids);
    notice.value = t("cod_assegni.review.bulk_done", { n: result.count });
    ticked.value = new Set();
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action_failed");
  } finally {
    busy.value = false;
  }
}

function confidenceColor(check: ReviewCheck): string {
  if (check.source === "manual") {
    return "primary";
  }
  return check.confidence >= 0.8
    ? "success"
    : check.confidence >= 0.5
      ? "warning"
      : "error";
}
</script>

<template>
  <div>
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <v-alert
      v-if="notice"
      type="info"
      variant="tonal"
      density="compact"
      closable
      class="mb-4"
      @click:close="notice = null"
    >
      {{ notice }}
    </v-alert>

    <!-- The approval result. Divergences are the point: each one means the
         carrier settled something other than what was invoiced, and nothing was
         overwritten to hide it. -->
    <v-alert
      v-if="report"
      :type="report.divergences.length ? 'warning' : 'success'"
      variant="tonal"
      density="compact"
      closable
      class="mb-4"
      @click:close="report = null"
    >
      <div class="text-body-2">
        {{
          t("cod_assegni.approve.done", {
            n: report.applied,
            s: report.shipments,
          })
        }}
        <span v-if="report.skipped">
          · {{ t("cod_assegni.approve.skipped", { n: report.skipped }) }}</span
        >
      </div>

      <ul v-if="report.divergences.length" class="mt-2 text-body-2">
        <li v-for="d in report.divergences" :key="d.id_spedizione">
          {{
            t("cod_assegni.approve.divergence", {
              shipment: d.id_spedizione,
              expected: d.expected,
              got: d.got,
            })
          }}
        </li>
      </ul>

      <div v-for="w in report.warnings" :key="w" class="text-caption mt-1">
        {{ w }}
      </div>
    </v-alert>

    <v-skeleton-loader v-if="loading" type="article, table" />

    <template v-else-if="batch">
      <!-- The batch total, and what it is NOT.

           This is what we read off the sheets, not a reconciliation: nothing
           here has been compared against contras_imp. The operator with the
           paper already checked it against the printed TOTALE; this figure is
           for orientation. -->
      <v-card variant="tonal" class="mb-4">
        <v-card-text class="d-flex flex-wrap align-center ga-6">
          <div>
            <div class="text-caption text-medium-emphasis">
              {{ t("cod_assegni.review.captured") }}
            </div>
            <div class="text-h6">
              {{ batch.totals.amount }}
              <span class="text-body-2 text-medium-emphasis">
                ·
                {{
                  t("cod_assegni.review.n_cheques", { n: batch.totals.count })
                }}
              </span>
            </div>
          </div>

          <div v-if="batch.session.bill_no">
            <div class="text-caption text-medium-emphasis">
              {{ t("cod_assegni.session.bill_no") }}
            </div>
            <div class="text-body-1">{{ batch.session.bill_no }}</div>
          </div>

          <v-spacer />

          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-refresh"
            :disabled="busy"
            @click="rematchOpen = true"
          >
            {{ t("cod_assegni.rematch.action") }}
          </v-btn>

          <v-btn
            color="primary"
            variant="flat"
            size="small"
            prepend-icon="mdi-check-decagram"
            :disabled="busy || !batch.checks.length"
            @click="approveOpen = true"
          >
            {{ t("cod_assegni.approve.action") }}
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- The queue. -->
      <div class="d-flex align-center mb-2">
        <h2 class="text-subtitle-1 mb-0">
          {{ t("cod_assegni.review.decisions") }}
          <v-chip
            v-if="decisions.length"
            size="small"
            color="warning"
            variant="tonal"
            class="ml-2"
          >
            {{ decisions.length }}
            <template v-if="decisions.length !== allDecisions.length">
              / {{ allDecisions.length }}
            </template>
          </v-chip>
        </h2>
        <v-spacer />
        <!-- Narrow to the cheques that still need a shipment chosen: the slow
             work, separated from the return legs that only want an OK. Only
             offered when there is a mix, so it never appears as dead weight. -->
        <v-switch
          v-if="unassignedCount > 0 && unassignedCount < allDecisions.length"
          v-model="onlyUnassigned"
          :label="
            t('cod_assegni.review.only_unassigned', { n: unassignedCount })
          "
          density="compact"
          hide-details
          color="primary"
        />
      </div>

      <!--
        Barra de filtros. Aparece solo cuando hay suficientes cheques para que
        buscar tenga sentido: en un lote de cinco estorba, en uno de mil es lo
        primero que se necesita.
      -->
      <div
        v-if="allDecisions.length > 8"
        class="d-flex flex-wrap align-center ga-2 mb-3"
      >
        <v-text-field
          v-model="query"
          :placeholder="t('cod_assegni.review.search_hint')"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          style="min-width: 240px; max-width: 340px"
        />
        <v-select
          v-model="stateFilter"
          :items="stateOptions"
          :label="t('cod_assegni.review.state')"
          density="compact"
          variant="outlined"
          hide-details
          multiple
          clearable
          style="min-width: 180px; max-width: 240px"
        />
        <v-select
          v-if="banks.length > 1"
          v-model="bankFilter"
          :items="banks"
          :label="t('cod_assegni.check.bank')"
          density="compact"
          variant="outlined"
          hide-details
          multiple
          clearable
          style="min-width: 160px; max-width: 220px"
        />
        <v-text-field
          v-model.number="minAmountRaw"
          :label="t('cod_assegni.review.min_amount')"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          style="max-width: 130px"
        />
      </div>

      <!-- Lo aplicado, visible y quitable de uno en uno. -->
      <div
        v-if="activeFilters.length"
        class="d-flex flex-wrap align-center ga-2 mb-3"
      >
        <v-chip
          v-for="f in activeFilters"
          :key="f.field"
          size="small"
          variant="tonal"
          closable
          @click:close="removeFilter(f.field)"
        >
          <span class="text-medium-emphasis me-1">{{ f.group }}:</span
          >{{ f.value }}
        </v-chip>
        <v-btn variant="text" size="small" @click="clearFilters">
          {{ t("cod_assegni.review.clear_filters") }}
        </v-btn>
      </div>

      <EmptyState
        v-if="!decisions.length"
        icon="mdi-check-circle-outline"
        :title="
          onlyUnassigned
            ? t('cod_assegni.review.none_unassigned')
            : t('cod_assegni.review.all_settled')
        "
        :text="
          onlyUnassigned
            ? t('cod_assegni.review.none_unassigned_hint')
            : t('cod_assegni.review.all_settled_hint')
        "
      />

      <!-- Bulk confirm: nine return legs the specialist trusts, ticked and
           signed off together instead of one dialog at a time. Only shows when
           there is something tickable, so it never clutters a queue of cash
           returns that each need a shipment chosen by hand. -->
      <div v-if="confirmable.length" class="d-flex align-center ga-3 mb-3 px-1">
        <v-checkbox
          :model-value="
            tickedConfirmable.length === confirmable.length &&
            confirmable.length > 0
          "
          :indeterminate="
            tickedConfirmable.length > 0 &&
            tickedConfirmable.length < confirmable.length
          "
          density="compact"
          hide-details
          @update:model-value="toggleAll"
        />
        <span class="text-body-2 text-medium-emphasis">
          {{
            t("cod_assegni.review.bulk_select_all", { n: confirmable.length })
          }}
        </span>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          prepend-icon="mdi-check-all"
          :disabled="busy || !tickedConfirmable.length"
          @click="doConfirmBulk"
        >
          {{
            t("cod_assegni.review.bulk_confirm", {
              n: tickedConfirmable.length,
            })
          }}
        </v-btn>
      </div>

      <v-card
        v-for="check in visibleDecisions"
        :key="check.id"
        variant="outlined"
        class="mb-3"
      >
        <v-card-text>
          <div class="d-flex flex-wrap align-center ga-3 mb-2">
            <!-- Tickable only when there is a shipment to confirm against;
                 otherwise there is nothing a bulk confirm could do with it. -->
            <v-checkbox
              v-if="canConfirm(check)"
              :model-value="ticked.has(check.id)"
              density="compact"
              hide-details
              class="flex-grow-0"
              @update:model-value="toggleTick(check.id)"
            />
            <StatusChip :status="check.stato_match" :map="stateMap" />
            <strong class="text-body-1">{{ check.numero_assegno }}</strong>
            <span class="text-body-2 text-medium-emphasis">{{
              check.banca || "—"
            }}</span>
            <v-spacer />
            <strong class="text-body-1">{{ check.importo }}</strong>
            <v-chip
              :color="confidenceColor(check)"
              size="x-small"
              variant="tonal"
            >
              {{ Math.round(check.confidence * 100) }}%
            </v-chip>
          </div>

          <div class="text-body-2 text-medium-emphasis mb-1">
            {{ t("cod_assegni.review.document") }}:
            <strong>{{ check.documento || "—" }}</strong>
            <!--
              El número de expedición es un enlace a su ficha.

              Confirmar o elegir expedición es una decisión que el especialista
              toma mirando la expedición: importe del contrareembolso,
              destinatario, fecha. Sin enlace había que copiar el id e ir a
              buscarlo a mano, y eso empuja a confirmar sin comprobar.

              En pestaña nueva a propósito: el lote es el puesto de trabajo, y
              salir de él perdería los checks marcados y los paneles abiertos.
            -->
            <template v-if="check.id_spedizione">
              · {{ t("cod_assegni.review.shipment") }}:
              <RouterLink
                :to="{
                  name: 'shipment-detail',
                  params: { id: String(check.id_spedizione) },
                }"
                target="_blank"
                class="shipment-link"
                :title="t('cod_assegni.review.open_shipment')"
              >
                <strong>{{ check.id_spedizione }}</strong>
                <v-icon icon="mdi-open-in-new" size="12" class="ms-1" />
              </RouterLink>
            </template>
          </div>

          <!-- Why it is here, in the words the matcher used. A specialist who
               cannot see the reasoning cannot audit the decision. -->
          <p v-if="check.match_note" class="text-body-2 mb-2">
            {{ check.match_note }}
          </p>
          <p class="text-caption text-medium-emphasis mb-0">
            {{ guidance(check.stato_match) }}
          </p>

          <!-- Recommendations, right here, for a cheque with no shipment yet.
               No dialog to open: the top candidates and an assign button sit
               under the cheque that needs them. -->
          <InlineSuggestions
            v-if="check.id_spedizione <= 0 && expandedSuggestions.has(check.id)"
            :id-session="idSession"
            :check="check"
            @assigned="onAssigned"
            @more="picking = check"
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            v-if="check.id_spedizione <= 0"
            variant="text"
            :color="expandedSuggestions.has(check.id) ? 'primary' : undefined"
            :disabled="busy"
            prepend-icon="mdi-lightbulb-on-outline"
            @click="toggleSuggestions(check.id)"
          >
            {{ t("cod_assegni.review.recommend") }}
          </v-btn>
          <v-btn
            v-if="canConfirm(check)"
            color="primary"
            variant="text"
            :disabled="busy"
            @click="confirming = check"
          >
            {{ t("cod_assegni.review.confirm") }}
          </v-btn>
          <v-btn variant="text" :disabled="busy" @click="picking = check">
            {{ t("cod_assegni.review.choose_shipment") }}
          </v-btn>
        </v-card-actions>
      </v-card>

      <!-- Crece bajo demanda en vez de pintar el lote entero. Dice cuantos
           quedan para que nadie crea que la cola termina aqui. -->
      <div v-if="hasMore" class="d-flex justify-center my-3">
        <v-btn
          variant="tonal"
          size="small"
          prepend-icon="mdi-chevron-down"
          @click="showMore"
        >
          {{
            t("cod_assegni.review.show_more", {
              n: decisions.length - visibleCount,
            })
          }}
        </v-btn>
      </div>

      <!-- Everything already ruled on. Collapsed: it is evidence, not work. -->
      <v-expansion-panels v-if="settled.length" class="mt-4">
        <v-expansion-panel>
          <v-expansion-panel-title>
            {{ t("cod_assegni.review.settled", { n: settled.length }) }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>{{ t("cod_assegni.check.number") }}</th>
                  <th>{{ t("cod_assegni.review.document") }}</th>
                  <th>{{ t("cod_assegni.review.shipment") }}</th>
                  <th class="text-right">
                    {{ t("cod_assegni.check.amount") }}
                  </th>
                  <th>{{ t("cod_assegni.review.state") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="check in settled" :key="check.id">
                  <td>{{ check.numero_assegno }}</td>
                  <td>{{ check.documento || "—" }}</td>
                  <!-- Estos son los ya resueltos, así que aquí SIEMPRE hay
                       expedición que abrir; mismo enlace que arriba. -->
                  <td>
                    <RouterLink
                      v-if="check.id_spedizione"
                      :to="{
                        name: 'shipment-detail',
                        params: { id: String(check.id_spedizione) },
                      }"
                      target="_blank"
                      class="shipment-link"
                      :title="t('cod_assegni.review.open_shipment')"
                    >
                      {{ check.id_spedizione }}
                      <v-icon icon="mdi-open-in-new" size="12" class="ms-1" />
                    </RouterLink>
                    <template v-else>—</template>
                  </td>
                  <td class="text-right">{{ check.importo }}</td>
                  <td>
                    <StatusChip :status="check.stato_match" :map="stateMap" />
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>

    <ConfirmDialog
      :model-value="confirming !== null"
      :title="t('cod_assegni.review.confirm_title')"
      :body="
        t('cod_assegni.review.confirm_body', {
          cheque: confirming?.numero_assegno ?? '',
          shipment: confirming?.id_spedizione ?? '',
        })
      "
      :confirm-label="t('cod_assegni.review.confirm')"
      :cancel-label="t('common.cancel')"
      :loading="busy"
      @confirm="doConfirm"
      @cancel="confirming = null"
      @update:model-value="
        (v: boolean) => {
          if (!v) confirming = null;
        }
      "
    />

    <ConfirmDialog
      v-model="rematchOpen"
      :title="t('cod_assegni.rematch.title')"
      :body="t('cod_assegni.rematch.body')"
      :confirm-label="t('cod_assegni.rematch.action')"
      :cancel-label="t('common.cancel')"
      :loading="busy"
      @confirm="doRematch"
      @cancel="rematchOpen = false"
    >
      <v-select
        v-model="rematchCarrier"
        class="mt-4"
        :items="carriers"
        item-title="label"
        item-value="id"
        :label="t('cod_assegni.rematch.carrier')"
        :hint="t('cod_assegni.rematch.carrier_hint')"
        persistent-hint
        density="comfortable"
        variant="outlined"
        :disabled="busy || carriers.length === 0"
      />

      <!-- Changing the carrier rewrites the batch, so say so before the click,
           not after. The QR and the photos are untouched. -->
      <v-alert
        v-if="carrierChanged"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-4"
        :text="t('cod_assegni.rematch.carrier_warning')"
      />
    </ConfirmDialog>

    <ConfirmDialog
      v-model="approveOpen"
      :title="t('cod_assegni.approve.title')"
      :body="t('cod_assegni.approve.body')"
      :confirm-label="t('cod_assegni.approve.action')"
      :cancel-label="t('common.cancel')"
      :loading="busy"
      @confirm="doApprove"
      @cancel="approveOpen = false"
    />

    <SuggestionPicker
      v-if="picking"
      :id-session="idSession"
      :check="picking"
      @assigned="onAssigned"
      @close="picking = null"
    />
  </div>
</template>

<style scoped>
/* El id va dentro de una línea atenuada, así que hereda ese color y solo se
   delata como enlace al pasar por encima: destacarlo en azul competiría con el
   importe y el número de cheque, que es lo que el especialista lee primero. */
.shipment-link {
  color: inherit;
  text-decoration: none;
}
.shipment-link:hover {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
}
</style>
