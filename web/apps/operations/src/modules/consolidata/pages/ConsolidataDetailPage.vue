<template>
  <div class="cons-page">
    <v-btn
      variant="text"
      size="small"
      prepend-icon="mdi-arrow-left"
      :to="{ name: 'consolidata-list', query: { restore: '1' } }"
    >
      {{ t("consolidata.detail.back") }}
    </v-btn>

    <v-progress-linear v-if="store.detailLoading" indeterminate class="my-3" />
    <ConsolidataApiError
      v-if="!p"
      :error="store.error"
      @close="store.clearError()"
    />

    <template v-if="p">
      <header class="d-flex flex-wrap align-center ga-3 my-3">
        <h2 class="text-h6 mr-2">#{{ p.id }} · {{ p.titolo }}</h2>
        <v-chip :color="stateColor(p.stato)">{{
          t(stateI18nKey(p.stato))
        }}</v-chip>
        <v-chip v-if="p.fase" :color="phaseColor(p.fase)" variant="tonal">{{
          t(phaseI18nKey(p.fase))
        }}</v-chip>
        <v-spacer />
        <strong class="text-h6">{{ money(p.totale, p.valuta) }}</strong>
      </header>

      <section class="cons-facts mb-3">
        <div>
          <span class="cons-fact-label">{{ t("filters.group.client") }}</span>
          <router-link
            :to="{
              name: 'anagrafica-detail',
              params: { id: String(p.id_cliente) },
            }"
            class="cons-link"
          >
            {{
              p.cliente_nome ||
              t("consolidata.detail.client", { id: p.id_cliente })
            }}
          </router-link>
        </div>
        <div>
          <span class="cons-fact-label">{{
            t("consolidata.detail.typeLabel")
          }}</span>
          {{ typeLabel(p.tipo) }}
        </div>
        <div>
          <span class="cons-fact-label">{{
            t("consolidata.detail.routeLabel")
          }}</span>
          {{ p.hub_terminal || "—" }} → {{ p.dest_country || "—" }}
        </div>
        <div>
          <span class="cons-fact-label">{{
            t("consolidata.detail.eoriLabel")
          }}</span>
          {{ p.eori_dichiarante || "—" }}
          <v-btn
            v-if="gates.setEori"
            icon="mdi-pencil"
            size="x-small"
            variant="text"
            :aria-label="t('consolidata.eori.title')"
            :title="t('consolidata.eori.title')"
            @click="openDialog('eori')"
          />
        </div>
        <div>
          <span class="cons-fact-label">{{
            t("consolidata.detail.assigneeLabel")
          }}</span>
          {{
            p.assegnato_a
              ? p.assegnato_nome ||
                t("consolidata.detail.assignedTo", { id: p.assegnato_a })
              : t("consolidata.list.unassigned")
          }}
        </div>
        <div v-if="p.id_cargo">
          <span class="cons-fact-label">{{
            t("consolidata.detail.cargoLabel")
          }}</span>
          <router-link
            :to="{ name: 'cargo-detail', params: { id: String(p.id_cargo) } }"
            class="cons-link"
          >
            #{{ p.id_cargo }}
          </router-link>
          <v-chip
            v-if="p.conversione"
            size="x-small"
            variant="tonal"
            class="ml-1"
          >
            {{ t(conversionI18nKey(p.conversione)) }}
          </v-chip>
        </div>
        <div>
          <span class="cons-fact-label">{{
            t("consolidata.detail.createdLabel")
          }}</span>
          {{ shortDate(p.insert_datetime) || "—" }}
        </div>
        <div>
          <span class="cons-fact-label">{{
            t("consolidata.detail.updatedLabel")
          }}</span>
          {{ shortDate(p.modif_datetime) || "—" }}
        </div>
        <div v-if="p.chiuso_at">
          <span class="cons-fact-label">{{
            t("consolidata.detail.closedLabel")
          }}</span>
          {{ shortDate(p.chiuso_at) }}
        </div>
      </section>

      <v-alert v-if="p.risposta_at" type="info" variant="tonal" class="mb-3">
        <div class="font-weight-medium">
          {{
            t("consolidata.detail.answered", {
              price: money(p.risposta_prezzo ?? 0, answerCurrency),
            })
          }}
          <span v-if="p.risposta_da_nome" class="text-body-2">
            ·
            {{
              t("consolidata.detail.answeredBy", { name: p.risposta_da_nome })
            }}
          </span>
        </div>
        <div class="text-body-2">
          {{
            t("consolidata.detail.answerValid", {
              date: shortDate(p.risposta_valida_fino) || "—",
            })
          }}
          <span v-if="p.risposta_nota"> · {{ p.risposta_nota }}</span>
        </div>
      </v-alert>

      <!-- Sin catálogo (`meta`) no se sabe qué acciones admite el proyecto: se dice, no se esconde en silencio (E8). -->
      <v-alert
        v-if="store.metaError"
        type="warning"
        variant="tonal"
        class="mb-3"
      >
        <div class="d-flex align-center flex-wrap ga-2">
          <span>{{ t("consolidata.detail.metaFailed") }}</span>
          <v-spacer />
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-refresh"
            @click="store.fetchMeta()"
          >
            {{ t("consolidata.common.retry") }}
          </v-btn>
        </div>
      </v-alert>

      <ConsolidataApiError
        v-if="store.openDialogs === 0"
        :error="store.error"
        @close="store.clearError()"
      />

      <div class="d-flex flex-wrap ga-2 mb-3">
        <v-btn
          v-if="gates.take"
          size="small"
          variant="tonal"
          :loading="store.saving"
          @click="onTake"
        >
          {{ t("consolidata.actions.take") }}
        </v-btn>
        <v-btn
          v-if="gates.assign"
          size="small"
          variant="tonal"
          prepend-icon="mdi-account-arrow-right"
          @click="openDialog('assign')"
        >
          {{ t("consolidata.actions.assign") }}
        </v-btn>
        <v-btn
          v-if="gates.requestQuote"
          size="small"
          variant="tonal"
          :loading="store.saving"
          @click="onRequestQuote"
        >
          {{ t("consolidata.actions.requestQuote") }}
        </v-btn>
        <v-btn
          v-if="gates.answer"
          size="small"
          color="primary"
          @click="openDialog('answer')"
        >
          {{ t("consolidata.actions.answer") }}
        </v-btn>
        <v-btn
          v-if="gates.operate"
          size="small"
          color="success"
          prepend-icon="mdi-cog-play-outline"
          @click="tab = 'conversion'"
        >
          {{ t("consolidata.actions.operate") }}
        </v-btn>
        <v-btn
          v-if="gates.convert"
          size="small"
          variant="tonal"
          color="success"
          @click="openDialog('convert')"
        >
          {{ t("consolidata.actions.convert") }}
        </v-btn>
        <v-btn
          v-if="gates.reopen"
          size="small"
          variant="tonal"
          :loading="store.saving"
          @click="onState('reopen')"
        >
          {{ t("consolidata.actions.reopen") }}
        </v-btn>
        <v-btn
          v-if="gates.close"
          size="small"
          variant="tonal"
          :loading="store.saving"
          @click="onState('close')"
        >
          {{ t("consolidata.actions.close") }}
        </v-btn>
        <v-btn
          v-if="gates.cancel"
          size="small"
          variant="text"
          color="error"
          :loading="store.saving"
          @click="onState('cancel')"
        >
          {{ t("consolidata.actions.cancel") }}
        </v-btn>
      </div>

      <v-tabs v-model="tab" density="comfortable" show-arrows>
        <v-tab value="shipments">{{ t("consolidata.tabs.shipments") }}</v-tab>
        <v-tab value="legs">{{ t("consolidata.tabs.legs") }}</v-tab>
        <v-tab value="allocation">{{ t("consolidata.tabs.allocation") }}</v-tab>
        <v-tab value="readiness">
          {{ t("consolidata.tabs.readiness") }}
          <v-badge
            v-if="store.readiness?.pendientes"
            :content="store.readiness.pendientes"
            color="warning"
            inline
          />
        </v-tab>
        <v-tab value="conversion">{{ t("consolidata.tabs.conversion") }}</v-tab>
        <v-tab value="history">{{ t("consolidata.tabs.history") }}</v-tab>
        <v-tab value="notes">{{ t("consolidata.tabs.notes") }}</v-tab>
      </v-tabs>
      <v-window v-model="tab" class="pt-3">
        <v-window-item value="shipments">
          <ConsolidataShipmentsTab
            :can-add="gates.addShipment"
            :can-update="gates.updateShipment"
            :can-remove="gates.removeShipment"
          />
        </v-window-item>
        <v-window-item value="legs"
          ><ConsolidataLegsTab :gates="gates"
        /></v-window-item>
        <v-window-item value="allocation"
          ><ConsolidataAllocationTab
        /></v-window-item>
        <v-window-item value="readiness">
          <ConsolidataReadinessTab :can-waive="gates.waive" />
        </v-window-item>
        <v-window-item value="conversion">
          <ConsolidataConversionTab
            :gates="gates"
            @convert="openDialog('convert')"
          />
        </v-window-item>
        <v-window-item value="history"><ConsolidataHistoryTab /></v-window-item>
        <v-window-item value="notes"
          ><ConsolidataNotesTab :can-add="gates.note"
        /></v-window-item>
      </v-window>

      <ConsolidataAnswerDialog
        v-model="answerDialog"
        :saving="store.saving"
        :error="store.error"
        :currency="p.valuta"
        :initial-price="p.totale"
        @submit="onAnswer"
      />
      <ConsolidataConvertDialog
        v-model="convertDialog"
        :saving="store.saving"
        :error="store.error"
        :result="store.conversion"
        :linked-cargo="p.id_cargo ?? null"
        @submit="onConvert"
      />
      <ConsolidataAssignDialog
        v-model="assignDialog"
        :saving="store.saving"
        :error="store.error"
        @submit="onAssign"
      />
      <ConsolidataEoriDialog
        v-model="eoriDialog"
        :saving="store.saving"
        :error="store.error"
        :current="p.eori_dichiarante"
        @submit="onEori"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import ConsolidataApiError from "../components/ConsolidataApiError.vue";
import ConsolidataAllocationTab from "../components/ConsolidataAllocationTab.vue";
import ConsolidataAnswerDialog from "../components/ConsolidataAnswerDialog.vue";
import ConsolidataAssignDialog from "../components/ConsolidataAssignDialog.vue";
import ConsolidataConversionTab from "../components/ConsolidataConversionTab.vue";
import ConsolidataConvertDialog from "../components/ConsolidataConvertDialog.vue";
import ConsolidataEoriDialog from "../components/ConsolidataEoriDialog.vue";
import ConsolidataHistoryTab from "../components/ConsolidataHistoryTab.vue";
import ConsolidataLegsTab from "../components/ConsolidataLegsTab.vue";
import ConsolidataNotesTab from "../components/ConsolidataNotesTab.vue";
import ConsolidataReadinessTab from "../components/ConsolidataReadinessTab.vue";
import ConsolidataShipmentsTab from "../components/ConsolidataShipmentsTab.vue";
import { useConsolidataStore } from "../stores/consolidata.store";
import { useFormat } from "../composables/useFormat";
import { useConsolidataConfirm } from "../composables/useConfirm";
import {
  conversionI18nKey,
  phaseColor,
  phaseI18nKey,
  projectGates,
  shortDate,
  stateColor,
  stateI18nKey,
} from "../logic";
import type { AnswerPayload } from "../types";

const { t, te } = useI18n();
const route = useRoute();
const store = useConsolidataStore();
const toast = useToastStore();
const { money } = useFormat();
const confirm = useConsolidataConfirm();

const tab = ref("shipments");
const answerDialog = ref(false);
const convertDialog = ref(false);
const assignDialog = ref(false);
const eoriDialog = ref(false);
const p = computed(() => store.project);
const answerCurrency = computed(
  () => p.value?.risposta_valuta ?? p.value?.valuta ?? "",
);

/** Qué acciones están disponibles lo dice el catálogo del API (`meta`), cada botón por su acción (E2/E3). */
const gates = computed(() =>
  projectGates(
    store.actions,
    p.value?.stato ?? "",
    p.value?.assegnato_a ?? null,
  ),
);

function typeLabel(tipo: string): string {
  const key = `consolidata.type.${tipo}`;
  return te(key) ? t(key) : tipo;
}

function openDialog(which: "answer" | "convert" | "assign" | "eori"): void {
  store.clearError();
  if (which === "answer") answerDialog.value = true;
  else if (which === "convert") convertDialog.value = true;
  else if (which === "assign") assignDialog.value = true;
  else eoriDialog.value = true;
}

async function onTake(): Promise<void> {
  if (await store.take()) toast.success(t("consolidata.messages.taken"));
}

async function onAssign(userId: number): Promise<void> {
  if (await store.assign(userId)) {
    assignDialog.value = false;
    toast.success(t("consolidata.messages.assigned"));
  }
}

async function onEori(eori: string): Promise<void> {
  if (await store.setEori(eori)) {
    eoriDialog.value = false;
    toast.success(t("consolidata.messages.eoriSaved"));
  }
}

async function onRequestQuote(): Promise<void> {
  if (!(await confirm(t("consolidata.confirm.requestQuote")))) return;
  if (await store.requestQuote())
    toast.success(t("consolidata.messages.quoteRequested"));
}

async function onState(action: "close" | "reopen" | "cancel"): Promise<void> {
  if (!(await confirm(t(`consolidata.confirm.${action}`), action === "cancel")))
    return;
  if (await store.setState(action))
    toast.success(t(`consolidata.messages.${action}`));
}

async function onAnswer(payload: AnswerPayload): Promise<void> {
  if (await store.answerQuote(payload)) {
    answerDialog.value = false;
    toast.success(t("consolidata.messages.answered"));
  }
}

async function onConvert(idCargo: number): Promise<void> {
  const res = await store.convert(idCargo);
  if (res)
    toast.success(
      t(
        res.completo
          ? "consolidata.messages.converted"
          : "consolidata.messages.convertedPartial",
      ),
    );
}

function load(): void {
  const id = Number(route.params.id);
  if (id > 0) {
    tab.value = "shipments";
    void store.openProject(id);
  }
}

// Tras cualquier cambio del proyecto, el historial y los pasos ya cargados se refrescan.
watch(
  () => p.value?.modif_datetime,
  (now, before) => {
    if (!before || now === before) return;
    if (store.logPage) void store.loadLog(store.logPage.current_page);
    if (store.steps) void store.loadSteps();
  },
);

watch(() => route.params.id, load);
onMounted(load);
</script>

<style scoped>
.cons-page {
  padding: 16px;
}
.cons-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 24px;
  font-size: 0.875rem;
}
.cons-fact-label {
  color: rgb(var(--v-theme-on-surface-variant));
  margin-right: 6px;
}
.cons-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.cons-link:hover {
  text-decoration: underline;
}
</style>
