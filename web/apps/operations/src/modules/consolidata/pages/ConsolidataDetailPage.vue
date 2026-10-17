<template>
  <div class="cons-page">
    <v-btn
      variant="text"
      size="small"
      prepend-icon="mdi-arrow-left"
      @click="router.push({ name: 'consolidata' })"
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
        <span class="text-body-2">{{
          t("consolidata.detail.client", { id: p.id_cliente })
        }}</span>
        <span class="text-body-2">
          {{
            p.assegnato_a
              ? t("consolidata.detail.assignedTo", { id: p.assegnato_a })
              : t("consolidata.queue.unassigned")
          }}
        </span>
        <v-spacer />
        <strong>{{ p.totale.toFixed(2) }} {{ p.valuta }}</strong>
      </header>

      <v-alert v-if="p.risposta_at" type="info" variant="tonal" class="mb-3">
        <div class="font-weight-medium">
          {{
            t("consolidata.detail.answered", {
              price: (p.risposta_prezzo ?? 0).toFixed(2),
              cur: answerCurrency,
            })
          }}
        </div>
        <div class="text-body-2">
          {{
            t("consolidata.detail.answerValid", {
              date: shortDate(p.risposta_valida_fino),
            })
          }}
          <span v-if="p.risposta_nota"> · {{ p.risposta_nota }}</span>
        </div>
      </v-alert>
      <v-alert v-if="p.id_cargo" type="success" variant="tonal" class="mb-3">
        {{ t("consolidata.detail.linkedCargo", { id: p.id_cargo }) }}
      </v-alert>

      <ConsolidataApiError
        v-if="!dialogOpen"
        :error="store.error"
        @close="store.clearError()"
      />

      <div class="d-flex flex-wrap ga-2 mb-3">
        <v-btn
          v-if="!p.assegnato_a"
          size="small"
          variant="tonal"
          :loading="store.saving"
          @click="onTake"
        >
          {{ t("consolidata.actions.take") }}
        </v-btn>
        <v-btn
          v-if="can('answer_quote')"
          size="small"
          color="primary"
          @click="openDialog('answer')"
        >
          {{ t("consolidata.actions.answer") }}
        </v-btn>
        <v-btn
          v-if="can('convert')"
          size="small"
          color="success"
          @click="openDialog('convert')"
        >
          {{ t("consolidata.actions.convert") }}
        </v-btn>
        <v-btn
          v-if="can('reopen')"
          size="small"
          variant="tonal"
          :loading="store.saving"
          @click="onState('reopen')"
        >
          {{ t("consolidata.actions.reopen") }}
        </v-btn>
        <v-btn
          v-if="can('close')"
          size="small"
          variant="tonal"
          :loading="store.saving"
          @click="onState('close')"
        >
          {{ t("consolidata.actions.close") }}
        </v-btn>
        <v-btn
          v-if="can('cancel')"
          size="small"
          variant="text"
          color="error"
          :loading="store.saving"
          @click="onState('cancel')"
        >
          {{ t("consolidata.actions.cancel") }}
        </v-btn>
      </div>

      <v-tabs v-model="tab" density="comfortable">
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
        <v-tab value="history">{{ t("consolidata.tabs.history") }}</v-tab>
        <v-tab value="notes">{{ t("consolidata.tabs.notes") }}</v-tab>
      </v-tabs>
      <v-window v-model="tab" class="pt-3">
        <v-window-item value="shipments"
          ><ConsolidataShipmentsTab :can-edit="editable"
        /></v-window-item>
        <v-window-item value="legs"
          ><ConsolidataLegsTab :can-edit="editable" :can-recalc="can('recalc')"
        /></v-window-item>
        <v-window-item value="allocation"
          ><ConsolidataAllocationTab
        /></v-window-item>
        <v-window-item value="readiness"
          ><ConsolidataReadinessTab :can-waive="can('waive_warning')"
        /></v-window-item>
        <v-window-item value="history"><ConsolidataHistoryTab /></v-window-item>
        <v-window-item value="notes"><ConsolidataNotesTab /></v-window-item>
      </v-window>

      <ConsolidataAnswerDialog
        v-model="answerDialog"
        :saving="store.saving"
        :error="store.error"
        :currency="p.valuta"
        :initial-price="p.risposta_prezzo ?? p.totale"
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import ConsolidataApiError from "../components/ConsolidataApiError.vue";
import ConsolidataAllocationTab from "../components/ConsolidataAllocationTab.vue";
import ConsolidataAnswerDialog from "../components/ConsolidataAnswerDialog.vue";
import ConsolidataConvertDialog from "../components/ConsolidataConvertDialog.vue";
import ConsolidataHistoryTab from "../components/ConsolidataHistoryTab.vue";
import ConsolidataLegsTab from "../components/ConsolidataLegsTab.vue";
import ConsolidataNotesTab from "../components/ConsolidataNotesTab.vue";
import ConsolidataReadinessTab from "../components/ConsolidataReadinessTab.vue";
import ConsolidataShipmentsTab from "../components/ConsolidataShipmentsTab.vue";
import { useConsolidataStore } from "../stores/consolidata.store";
import { actionAvailable, shortDate, stateColor, stateI18nKey } from "../logic";
import type { AnswerPayload } from "../types";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useConsolidataStore();
const toast = useToastStore();

const tab = ref("shipments");
const answerDialog = ref(false);
const convertDialog = ref(false);
const p = computed(() => store.project);
const answerCurrency = computed(
  () => p.value?.risposta_valuta ?? p.value?.valuta ?? "",
);
const dialogOpen = computed(() => answerDialog.value || convertDialog.value);

/** Qué acciones están disponibles lo dice el catálogo del API (`meta`), no el front. */
const can = (action: string): boolean =>
  p.value ? actionAvailable(store.actions, action, p.value.stato) : false;
const editable = computed(() => can("add_shipment"));

function openDialog(which: "answer" | "convert"): void {
  store.clearError();
  if (which === "answer") answerDialog.value = true;
  else convertDialog.value = true;
}

async function onTake(): Promise<void> {
  if (await store.take()) toast.success(t("consolidata.messages.taken"));
}

async function onState(action: "close" | "reopen" | "cancel"): Promise<void> {
  if (!window.confirm(t(`consolidata.confirm.${action}`))) return;
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
  if (id > 0) void store.openProject(id);
}

watch(() => route.params.id, load);
onMounted(load);
</script>

<style scoped>
.cons-page {
  padding: 16px;
}
</style>
