<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1000"
    scrollable
    @update:model-value="onToggle"
  >
    <v-card v-if="cur" data-testid="giac-detail">
      <!-- ── Cabecera ──────────────────────────────────────────────── -->
      <v-card-title class="giac-head">
        <span class="giac-head__title">{{
          t("giacenze.giacenze.detail.title", { id: cur.id })
        }}</span>
        <v-chip
          size="small"
          label
          :color="closed ? 'grey' : 'warning'"
          data-testid="giac-state"
        >
          {{
            closed
              ? t("giacenze.giacenze.step.closed")
              : t("giacenze.giacenze.detail.open")
          }}
        </v-chip>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          :title="t('common.close')"
          @click="close"
        />
      </v-card-title>

      <v-card-text class="giac-body">
        <div class="giac-context">
          <a
            v-if="cur.id_spedizione"
            class="giac-context__item"
            :href="detailHref('shipment', cur.id_spedizione)"
          >
            <v-icon size="16" icon="mdi-package-variant-closed" />
            {{ t("giacenze.giacenze.shipment") }} {{ cur.id_spedizione }}
          </a>
          <span v-if="cur.cliente_rag_soc" class="giac-context__item">
            <v-icon size="16" icon="mdi-account" /> {{ cur.cliente_rag_soc }}
          </span>
          <span v-if="cur.tracking_descr" class="giac-context__item">
            <v-icon size="16" icon="mdi-map-marker-path" />
            {{ cur.tracking_descr }}
          </span>
          <span v-if="hasDate(cur.data_open)" class="giac-context__item">
            <v-icon size="16" icon="mdi-calendar" />
            {{
              t("giacenze.giacenze.detail.openedAgo", {
                date: cur.data_open,
                days: days,
              })
            }}
          </span>
        </div>

        <!-- ── Da sistemare: qué falta y qué hacer ahora ─────────────── -->
        <v-alert
          :type="
            step === 'ready_to_close' ? 'success' : closed ? 'info' : 'warning'
          "
          variant="tonal"
          density="comfortable"
          class="giac-fix"
          data-testid="giac-fixbar"
        >
          <div class="giac-fix__text">
            {{ t(`giacenze.giacenze.fix.${step}`) }}
          </div>
          <template #append>
            <v-btn
              v-if="step === 'notify_client'"
              color="primary"
              size="small"
              prepend-icon="mdi-email-outline"
              data-testid="giac-act-notify-client"
              @click="compose('GIAc')"
              >{{ t("giacenze.giacenze.act.notifyClient") }}</v-btn
            >
            <v-btn
              v-else-if="step === 'instruct_supplier'"
              color="primary"
              size="small"
              prepend-icon="mdi-truck-outline"
              data-testid="giac-act-notify-supplier"
              @click="compose('GIAf')"
              >{{ t("giacenze.giacenze.act.notifySupplier") }}</v-btn
            >
            <v-btn
              v-else-if="step === 'ready_to_close'"
              color="primary"
              size="small"
              prepend-icon="mdi-check-circle-outline"
              :loading="busy"
              data-testid="giac-act-close"
              @click="closeHold"
              >{{ t("giacenze.giacenze.closeHold") }}</v-btn
            >
            <v-btn
              v-else-if="closed"
              size="small"
              variant="flat"
              prepend-icon="mdi-lock-open-variant-outline"
              :loading="busy"
              data-testid="giac-act-reopen"
              @click="reopenHold"
              >{{ t("giacenze.giacenze.reopen") }}</v-btn
            >
          </template>
        </v-alert>

        <v-row>
          <!-- ── Columna izquierda: ciclo, esito, instrucciones, depósito ── -->
          <v-col cols="12" md="7">
            <section class="giac-sec">
              <h3 class="giac-sec__title">
                {{ t("giacenze.giacenze.cycle.title") }}
              </h3>
              <ol class="giac-cycle" data-testid="giac-cycle">
                <li
                  v-for="s in cycle"
                  :key="s.key"
                  :class="{
                    'giac-cycle__done': s.done,
                    'giac-cycle__now': s.now,
                  }"
                >
                  <v-icon
                    size="18"
                    :icon="
                      s.done
                        ? 'mdi-check-circle'
                        : s.now
                          ? 'mdi-arrow-right-circle'
                          : 'mdi-circle-outline'
                    "
                    :color="s.done ? 'success' : s.now ? 'warning' : undefined"
                  />
                  <span class="giac-cycle__label">{{
                    t(`giacenze.giacenze.cycle.${s.key}`)
                  }}</span>
                  <span class="giac-cycle__date">{{ s.date }}</span>
                </li>
              </ol>
            </section>

            <section class="giac-sec">
              <h3 class="giac-sec__title">
                {{ t("giacenze.giacenze.esito.title") }}
              </h3>
              <div
                class="giac-esiti"
                role="group"
                :aria-label="t('giacenze.giacenze.esito.title')"
              >
                <v-btn
                  v-for="op in operations"
                  :key="op"
                  size="small"
                  :variant="cur.operazione === op ? 'flat' : 'tonal'"
                  :color="cur.operazione === op ? 'primary' : undefined"
                  :disabled="closed || busy"
                  :prepend-icon="esitoIcon[op]"
                  :title="t(`giacenze.giacenze.esito.hint.${op}`)"
                  :data-testid="`giac-esito-${op}`"
                  @click="setEsito(op)"
                  >{{ t(`giacenze.giacenze.operations.${op}`) }}</v-btn
                >
              </div>
              <p v-if="!cur.operazione" class="giac-hint">
                {{ t("giacenze.giacenze.esito.missing") }}
              </p>
            </section>

            <section class="giac-sec">
              <h3 class="giac-sec__title">
                {{ t("giacenze.giacenze.instr.title") }}
              </h3>
              <v-textarea
                v-model="draft.descriz"
                :label="t('giacenze.giacenze.instr.client')"
                :hint="t('giacenze.giacenze.instr.clientHint')"
                persistent-hint
                rows="2"
                auto-grow
                :readonly="closed"
                data-testid="giac-descriz"
              />
              <v-textarea
                v-model="draft.note"
                :label="t('giacenze.giacenze.note')"
                rows="2"
                auto-grow
                class="mt-2"
                :readonly="closed"
              />
              <div class="giac-sec__actions">
                <v-btn
                  size="small"
                  color="primary"
                  :disabled="closed || !instrDirty"
                  :loading="busy"
                  data-testid="giac-save-instr"
                  @click="saveInstructions"
                  >{{ t("giacenze.giacenze.instr.save") }}</v-btn
                >
              </div>
            </section>

            <section class="giac-sec">
              <h3 class="giac-sec__title">
                {{ t("giacenze.giacenze.deposit.title") }}
              </h3>
              <v-row dense>
                <v-col cols="12" sm="5">
                  <v-text-field
                    v-model.number="draft.giacenza_gg"
                    :label="t('giacenze.giacenze.days')"
                    :hint="t('giacenze.giacenze.deposit.daysHint')"
                    persistent-hint
                    type="number"
                    min="0"
                    :readonly="closed"
                    data-testid="giac-days"
                  />
                </v-col>
                <v-col cols="12" sm="7">
                  <v-text-field
                    v-model.number="draft.addebito_riconsegna"
                    :label="`${t('giacenze.giacenze.redeliveryCharge')} (${amountCurrency})`"
                    type="number"
                    step="0.01"
                    :readonly="amountLocked || closed"
                    :hint="
                      amountLocked
                        ? t('giacenze.giacenze.chargeLockedHint')
                        : undefined
                    "
                    :persistent-hint="amountLocked"
                    data-testid="giac-charge"
                  >
                    <template #append-inner>
                      <v-icon v-if="amountLocked" icon="mdi-lock" />
                      <v-btn
                        v-else-if="!closed"
                        icon="mdi-content-copy"
                        size="x-small"
                        variant="text"
                        :loading="copyingPrice"
                        :title="t('giacenze.giacenze.copyPrice')"
                        @click="copyPrice"
                      />
                    </template>
                  </v-text-field>
                </v-col>
              </v-row>
              <div class="giac-sec__actions">
                <v-btn
                  size="small"
                  color="primary"
                  :disabled="closed || !depositDirty"
                  :loading="busy"
                  data-testid="giac-save-deposit"
                  @click="saveDeposit"
                  >{{ t("giacenze.giacenze.deposit.save") }}</v-btn
                >
              </div>
            </section>
          </v-col>

          <!-- ── Columna derecha: direcciones y mensajes ───────────────── -->
          <v-col cols="12" md="5">
            <section class="giac-sec">
              <h3 class="giac-sec__title">
                {{ t("giacenze.giacenze.addr.title") }}
              </h3>
              <GiacenzaAddresses
                v-if="cur.id_spedizione"
                :shipment-id="cur.id_spedizione"
                :readonly="closed"
                @changed="emit('changed')"
              />
            </section>
            <section class="giac-sec">
              <h3 class="giac-sec__title">
                {{ t("giacenze.giacenze.msg.title") }}
              </h3>
              <GiacenzaMessages
                ref="messagesRef"
                :giacenza-id="cur.id"
                @sent="onSent"
              />
            </section>
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-btn
          v-if="!closed"
          variant="text"
          color="error"
          prepend-icon="mdi-check-circle-outline"
          :disabled="busy"
          @click="closeHold"
          >{{ t("giacenze.giacenze.closeHold") }}</v-btn
        >
        <v-spacer />
        <v-btn
          variant="text"
          append-icon="mdi-chevron-right"
          data-testid="giac-next"
          @click="emit('next', cur.id)"
        >
          {{ t("giacenze.giacenze.detail.next") }}
        </v-btn>
        <v-btn variant="text" @click="close">{{ t("common.close") }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { detailHref } from "@shared/platform/navTargets";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";
import { useGiacenzeStore } from "../stores/giacenze.store";
import { giacenzeService } from "../services/giacenze.service";
import GiacenzaAddresses from "./GiacenzaAddresses.vue";
import GiacenzaMessages from "./GiacenzaMessages.vue";
import { hasDate, lifecycleStep, openDays } from "../queues";
import {
  GIACENZA_OPERATIONS,
  type Giacenza,
  type GiacenzaOperation,
} from "../types";

const props = defineProps<{ modelValue: boolean; giacenza: Giacenza | null }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  /** Algo cambió en el servidor: la lista debe refrescarse. */
  changed: [];
  /** Pasar a la siguiente giacenza de la lista. */
  next: [id: number];
}>();

const { t } = useI18n();
const store = useGiacenzeStore();
const toast = useToastStore();
const confirm = useConfirmStore();

const cur = ref<Giacenza | null>(null);
const busy = ref(false);
const copyingPrice = ref(false);
const messagesRef = ref<InstanceType<typeof GiacenzaMessages> | null>(null);
const operations = GIACENZA_OPERATIONS;
const esitoIcon: Record<GiacenzaOperation, string> = {
  A: "mdi-clock-outline",
  C: "mdi-van-utility",
  N: "mdi-map-marker-plus-outline",
  R: "mdi-inbox-arrow-up-outline",
  E: "mdi-alert-octagon-outline",
};

const draft = reactive<{
  descriz: string;
  note: string;
  giacenza_gg: number | null;
  addebito_riconsegna: number | null;
}>({ descriz: "", note: "", giacenza_gg: null, addebito_riconsegna: null });

const step = computed(() =>
  cur.value ? lifecycleStep(cur.value) : "notify_client",
);
const closed = computed(() => step.value === "closed");
const days = computed(() => (cur.value ? openDays(cur.value) : 0));
const amountCurrency = computed(
  () => cur.value?.addebito_riconsegna_currency ?? "EUR",
);
const amountLocked = computed(
  () => cur.value?.addebito_riconsegna_locked === true,
);

const instrDirty = computed(
  () =>
    draft.descriz !== (cur.value?.descriz ?? "") ||
    draft.note !== (cur.value?.note ?? ""),
);
const shownCharge = (g: Giacenza): number | null =>
  g.addebito_riconsegna_display ?? g.addebito_riconsegna ?? null;
const depositDirty = computed(
  () =>
    Number(draft.giacenza_gg ?? 0) !== Number(cur.value?.giacenza_gg ?? 0) ||
    Number(draft.addebito_riconsegna ?? 0) !==
      Number(cur.value ? (shownCharge(cur.value) ?? 0) : 0),
);

/** Los tres pasos del ciclo con su fecha; el que toca va resaltado. */
const cycle = computed(() => {
  const g = cur.value;
  if (!g) return [];
  const supplierDone =
    hasDate(g.cont_fornitore_data) &&
    (g.cont_fornitore_data ?? "") >= (g.risp_cliente_data ?? "");
  const items = [
    {
      key: "client_notified",
      done: hasDate(g.cont_cliente_data),
      date: g.cont_cliente_data,
    },
    {
      key: "client_reply",
      done: hasDate(g.risp_cliente_data),
      date: g.risp_cliente_data,
    },
    {
      key: "supplier_notified",
      done: supplierDone,
      date: g.cont_fornitore_data,
    },
  ];
  const firstPending = items.findIndex((i) => !i.done);
  return items.map((i, idx) => ({
    ...i,
    date: hasDate(i.date) ? String(i.date).slice(0, 16) : "—",
    now: !closed.value && idx === firstPending,
  }));
});

function fail(error: unknown): void {
  const msg = error instanceof Error && error.message ? error.message : "";
  toast.error(msg || t("giacenze.giacenze.messages.actionFailed"));
}

function syncDraft(g: Giacenza): void {
  draft.descriz = g.descriz ?? "";
  draft.note = g.note ?? "";
  draft.giacenza_gg = g.giacenza_gg ?? 0;
  draft.addebito_riconsegna = shownCharge(g) ?? 0;
}

/** Recarga la ficha desde el servidor conservando los datos de lista (cliente, tracking). */
async function reload(): Promise<void> {
  const id = cur.value?.id;
  if (!id) return;
  const fresh = await giacenzeService.get(id);
  cur.value = { ...cur.value, ...fresh } as Giacenza;
  syncDraft(cur.value);
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open || !props.giacenza) return;
    cur.value = props.giacenza;
    syncDraft(props.giacenza);
    try {
      await reload();
    } catch {
      /* se queda con los datos de la lista */
    }
  },
  { immediate: true },
);
watch(
  () => props.giacenza?.id,
  (id) => {
    if (id && props.modelValue && props.giacenza) {
      cur.value = props.giacenza;
      syncDraft(props.giacenza);
      void reload().catch(() => undefined);
    }
  },
);

function compose(tipo: "GIAc" | "GIAf"): void {
  void messagesRef.value?.openCompose(tipo);
}

async function onSent(): Promise<void> {
  try {
    await reload();
  } catch {
    /* ignorado */
  }
  emit("changed");
}

/** Guarda instrucción y notas con las reglas del legado: la instrucción sella la respuesta del cliente. */
async function saveInstructions(): Promise<void> {
  if (!cur.value) return;
  busy.value = true;
  try {
    await giacenzeService.updateOperation(
      cur.value.id,
      cur.value.operazione ?? "A",
      {
        descriz: draft.descriz,
        note: draft.note,
      },
    );
    await reload();
    toast.success(t("giacenze.giacenze.messages.updated"));
    emit("changed");
  } catch (e) {
    fail(e);
  } finally {
    busy.value = false;
  }
}

async function saveDeposit(): Promise<void> {
  if (!cur.value) return;
  busy.value = true;
  try {
    const payload: Record<string, unknown> = {
      giacenza_gg: draft.giacenza_gg ?? 0,
    };
    if (!amountLocked.value) {
      payload.addebito_riconsegna = draft.addebito_riconsegna ?? 0;
      payload.addebito_riconsegna_currency = amountCurrency.value;
    }
    await store.update(cur.value.id, payload);
    await reload();
    toast.success(t("giacenze.giacenze.messages.updated"));
    emit("changed");
  } catch (e) {
    fail(e);
  } finally {
    busy.value = false;
  }
}

async function copyPrice(): Promise<void> {
  if (!cur.value) return;
  copyingPrice.value = true;
  try {
    const res = await giacenzeService.caricoPrice(cur.value.id);
    draft.addebito_riconsegna = res.carico_display;
  } catch (e) {
    fail(e);
  } finally {
    copyingPrice.value = false;
  }
}

/** Esito (A/C/N/R/E). Salvo «en espera», tras confirmarlo se ofrece avisar al proveedor con el texto ya listo. */
async function setEsito(op: GiacenzaOperation): Promise<void> {
  if (!cur.value || op === cur.value.operazione) return;
  const ok = await confirm.ask({
    title: t(`giacenze.giacenze.operations.${op}`),
    message: t(`giacenze.giacenze.esito.confirm.${op}`),
    confirmLabel: t("common.confirm"),
  });
  if (!ok) return;
  busy.value = true;
  try {
    await giacenzeService.updateOperation(cur.value.id, op, {});
    await reload();
    emit("changed");
    if (op !== "A") compose("GIAf");
  } catch (e) {
    fail(e);
  } finally {
    busy.value = false;
  }
}

async function closeHold(): Promise<void> {
  if (!cur.value) return;
  const charge = shownCharge(cur.value) ?? 0;
  const ok = await confirm.ask({
    title: t("giacenze.giacenze.closeHold"),
    message: charge
      ? t("giacenze.giacenze.messages.closeConfirmCharge", {
          amount: charge,
          currency: amountCurrency.value,
        })
      : t("giacenze.giacenze.messages.closeConfirm"),
    confirmLabel: t("giacenze.giacenze.closeHold"),
  });
  if (!ok) return;
  busy.value = true;
  try {
    await giacenzeService.close(cur.value.id);
    await reload();
    toast.success(t("giacenze.giacenze.messages.closed"));
    emit("changed");
  } catch (e) {
    fail(e);
  } finally {
    busy.value = false;
  }
}

async function reopenHold(): Promise<void> {
  if (!cur.value) return;
  const ok = await confirm.ask({
    title: t("giacenze.giacenze.reopen"),
    message: t("giacenze.giacenze.messages.reopenConfirm"),
    confirmLabel: t("giacenze.giacenze.reopen"),
  });
  if (!ok) return;
  busy.value = true;
  try {
    await giacenzeService.reopen(cur.value.id);
    await reload();
    toast.success(t("giacenze.giacenze.messages.reopened"));
    emit("changed");
  } catch (e) {
    fail(e);
  } finally {
    busy.value = false;
  }
}

function close(): void {
  emit("update:modelValue", false);
}

function onToggle(v: boolean): void {
  if (!v) close();
}
</script>

<style scoped>
.giac-head {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.1rem;
  font-weight: 600;
}
.giac-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.giac-context {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 6px;
  font-size: 0.85rem;
}
.giac-context__item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
  text-decoration: none;
}
.giac-context__item[href]:hover {
  text-decoration: underline;
}
.giac-sec {
  margin-bottom: 16px;
}
.giac-sec__title {
  margin: 0 0 8px;
  font-size: 0.9rem;
  font-weight: 600;
}
.giac-sec__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
.giac-cycle {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.giac-cycle li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  opacity: 0.75;
}
.giac-cycle__now {
  font-weight: 600;
  opacity: 1 !important;
}
.giac-cycle__label {
  flex: 1;
}
.giac-cycle__date {
  font-variant-numeric: tabular-nums;
  font-size: 0.8rem;
}
.giac-esiti {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.giac-hint {
  margin: 6px 0 0;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-warning));
}
</style>
