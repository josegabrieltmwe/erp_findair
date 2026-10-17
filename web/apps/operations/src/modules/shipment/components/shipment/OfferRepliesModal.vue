<template>
  <v-dialog
    :model-value="modelValue"
    max-width="680"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="orm-card">
      <!-- Misma cabecera que EmailComposer: ver las respuestas es un paso del
           MISMO flujo que enviar la solicitud, así que no debe verse de otra
           familia visual. -->
      <ModalHeader :title="title" :subtitle="subtitle" :icon="icon">
        <template v-if="offers.length" #append>
          <v-chip size="small" variant="tonal" color="primary">
            {{ repliedCount }}/{{ offers.length }}
          </v-chip>
        </template>
      </ModalHeader>
      <v-divider />

      <v-card-text class="pa-0">
        <v-expansion-panels
          v-if="sortedOffers.length"
          v-model="openPanel"
          variant="accordion"
          multiple
        >
          <v-expansion-panel
            v-for="o in sortedOffers"
            :key="o.id"
            :value="o.id"
            elevation="0"
          >
            <!-- Fila-resumen (siempre visible), como una lista normal. -->
            <v-expansion-panel-title>
              <div class="rp-row">
                <v-icon
                  :icon="
                    o.accettata === 'S'
                      ? 'mdi-trophy'
                      : 'mdi-office-building-outline'
                  "
                  size="18"
                  :color="o.accettata === 'S' ? 'success' : 'medium-emphasis'"
                  class="rp-row__ic"
                />
                <div class="rp-row__name text-truncate">
                  {{ recipientLabel(o) }}
                </div>
                <div class="rp-row__date">{{ sentAt(o) }}</div>
                <div class="rp-row__price">
                  {{
                    Number(o.costo) > 0 ? `${o.costo} ${o.change_valuta}` : "—"
                  }}
                </div>
                <StatusChip
                  :status="statusKey(o)"
                  :map="statusMap"
                  size="x-small"
                  class="rp-row__status"
                />
                <!-- Aceptar a nivel de LISTA. -->
                <v-btn
                  v-if="allowAccept && canAccept(o)"
                  size="x-small"
                  variant="tonal"
                  color="success"
                  icon="mdi-check"
                  :loading="accepting === Number(o.id)"
                  class="rp-row__accept"
                  :title="t('shipment.replies.accept')"
                  @click.stop="onAccept(o)"
                />
              </div>
            </v-expansion-panel-title>

            <!-- Detalle (acordeón). -->
            <v-expansion-panel-text>
              <div class="rp-detail">
                <div class="rp-field">
                  <span class="rp-k">{{ t("shipment.replies.offer_id") }}</span>
                  <span class="rp-v">#{{ o.id }}</span>
                </div>
                <div v-if="emailsOf(o).length" class="rp-field">
                  <span class="rp-k">{{
                    t("shipment.replies.recipients")
                  }}</span>
                  <span class="rp-v">
                    <div v-for="(em, i) in emailsOf(o)" :key="i">{{ em }}</div>
                  </span>
                </div>
                <div v-if="strOf(o, 'txt_risposta')" class="rp-field">
                  <span class="rp-k">{{ t("shipment.replies.notes") }}</span>
                  <span class="rp-v">{{ strOf(o, "txt_risposta") }}</span>
                </div>
                <div v-if="strOf(o, 'txt_schedule')" class="rp-field">
                  <span class="rp-k">{{ t("shipment.replies.schedule") }}</span>
                  <span class="rp-v">{{ strOf(o, "txt_schedule") }}</span>
                </div>
                <div v-if="strOf(o, 'rif_vettore')" class="rp-field">
                  <span class="rp-k">{{
                    t("shipment.replies.reference")
                  }}</span>
                  <span class="rp-v">{{ strOf(o, "rif_vettore") }}</span>
                </div>
                <div v-if="repliedAt(o)" class="rp-field">
                  <span class="rp-k">{{
                    t("shipment.replies.replied_at")
                  }}</span>
                  <span class="rp-v">{{ repliedAt(o) }}</span>
                </div>
              </div>

              <div class="d-flex align-center mt-2">
                <div
                  v-if="o.accettata === 'S'"
                  class="text-success text-caption font-weight-bold d-flex align-center"
                >
                  <v-icon icon="mdi-trophy-outline" size="16" class="me-1" />
                  {{ t("shipment.replies.winner") }}
                </div>
                <v-spacer />
                <!-- Cancelar selección (solo en la ganadora, si hay reset). -->
                <v-btn
                  v-if="reset && o.accettata === 'S'"
                  size="small"
                  variant="text"
                  color="error"
                  prepend-icon="mdi-close"
                  :loading="resetting === Number(o.id)"
                  @click="onReset(o)"
                >
                  {{ t("shipment.replies.reset") }}
                </v-btn>
                <!-- Aceptar a nivel de DETALLE. -->
                <v-btn
                  v-if="allowAccept && canAccept(o)"
                  size="small"
                  variant="tonal"
                  color="success"
                  prepend-icon="mdi-check"
                  :loading="accepting === Number(o.id)"
                  @click="onAccept(o)"
                >
                  {{ t("shipment.replies.accept") }}
                </v-btn>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <EmptyState
          v-else
          icon="mdi-email-outline"
          :title="t('shipment.replies.empty_title')"
          :text="t('shipment.replies.empty_text')"
          class="py-6"
        />
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t("common.close") }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Confirmación de aceptar. -->
    <v-dialog v-model="confirmOpen" max-width="440">
      <v-card>
        <v-card-title class="text-subtitle-1">
          {{ t("shipment.replies.accept_confirm_title") }}
        </v-card-title>
        <v-card-text class="text-body-2">
          {{
            t("shipment.replies.accept_confirm_text", {
              recipient: pending ? recipientLabel(pending) : "",
              price: pending ? `${pending.costo} ${pending.change_valuta}` : "",
            })
          }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmOpen = false">
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn color="success" variant="flat" @click="confirmAccept">
            {{ t("shipment.replies.accept") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import EmptyState from "@shared/ui/EmptyState.vue";
import StatusChip from "@shared/ui/StatusChip.vue";
import ModalHeader from "@shared/ui/ModalHeader.vue";

/** Forma mínima común de una respuesta de oferta (express o partner). */
export interface OfferReplyRow {
  id: number | string;
  id_courier: number | string;
  costo?: number | string | null;
  change_valuta?: string | null;
  data_rich?: string | null;
  data_risp?: string | null;
  accettata?: string | null;
  [k: string]: unknown;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    offers: OfferReplyRow[];
    title: string;
    /** Línea de contexto bajo el título (misma cabecera que EmailComposer). */
    subtitle?: string;
    icon?: string;
    /** Si el escenario permite aceptar (courier sí; partner según backend). */
    allowAccept?: boolean;
    /** Resuelve la etiqueta del destinatario (nombre courier/partner). */
    recipientLabel: (o: OfferReplyRow) => string;
    /** Clave del campo con el email del destinatario (courier_email / partner_email). */
    emailKey?: string;
    /** Ejecuta la aceptación. */
    accept: (o: OfferReplyRow) => Promise<void>;
    /** Cancela la selección de la ganadora (opcional). */
    reset?: (o: OfferReplyRow) => Promise<void>;
  }>(),
  {
    icon: "mdi-email-check-outline",
    allowAccept: true,
    emailKey: "courier_email",
  },
);
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const { t } = useI18n();

const openPanel = ref<(number | string)[]>([]);
const accepting = ref<number | null>(null);
const resetting = ref<number | null>(null);
const confirmOpen = ref(false);
const pending = ref<OfferReplyRow | null>(null);

// Estado → StatusChip (patrón unificado del proyecto).
const statusMap = computed(() => ({
  accepted: { label: t("shipment.replies.status_accepted"), color: "success" },
  replied: { label: t("shipment.replies.status_replied"), color: "primary" },
  pending: { label: t("shipment.replies.status_pending"), color: "warning" },
}));
function statusKey(o: OfferReplyRow): string {
  if (o.accettata === "S") return "accepted";
  return isReplied(o) ? "replied" : "pending";
}

// Ganadora → respondidas → pendientes.
const sortedOffers = computed(() =>
  [...props.offers].sort((a, b) => rank(b) - rank(a)),
);
function rank(o: OfferReplyRow): number {
  if (o.accettata === "S") return 3;
  if (isReplied(o)) return 2;
  return 1;
}

function isReplied(o: OfferReplyRow): boolean {
  return !!o.data_risp && o.data_risp !== "0000-00-00 00:00:00";
}

/** Cuántas han contestado — se muestra como `respondidas/enviadas` en la
 *  cabecera, mismo criterio que el badge del menú de comunicación. */
const repliedCount = computed(() => props.offers.filter(isReplied).length);
function canAccept(o: OfferReplyRow): boolean {
  return isReplied(o) && o.accettata !== "S" && Number(o.costo) > 0;
}

function strOf(o: OfferReplyRow, key: string): string {
  const v = o[key];
  return v == null ? "" : String(v).trim();
}
/** Emails del destinatario, saneados (uno por elemento) para el detalle. */
function emailsOf(o: OfferReplyRow): string[] {
  const raw = strOf(o, props.emailKey);
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}
function fmtDate(raw: string): string {
  if (!raw || raw.startsWith("0000-00-00")) return "";
  return raw.replace("T", " ").slice(0, 16);
}
function sentAt(o: OfferReplyRow): string {
  return fmtDate(strOf(o, "data_rich"));
}
function repliedAt(o: OfferReplyRow): string {
  return fmtDate(strOf(o, "confirm_datetime") || strOf(o, "data_risp"));
}

function onAccept(o: OfferReplyRow): void {
  pending.value = o;
  confirmOpen.value = true;
}
async function confirmAccept(): Promise<void> {
  const o = pending.value;
  confirmOpen.value = false;
  if (!o) return;
  accepting.value = Number(o.id);
  try {
    await props.accept(o);
  } finally {
    accepting.value = null;
    pending.value = null;
  }
}

async function onReset(o: OfferReplyRow): Promise<void> {
  if (!props.reset) return;
  resetting.value = Number(o.id);
  try {
    await props.reset(o);
  } finally {
    resetting.value = null;
  }
}
</script>

<style scoped lang="scss">
/* Fila-resumen: columnas alineadas como una lista, sin desbordes. */
.rp-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto auto auto auto;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.rp-row__ic {
  flex: none;
}
.rp-row__name {
  font-weight: 500;
  font-size: 0.9rem;
  min-width: 0;
}
.rp-row__date {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
}
.rp-row__price {
  font-weight: 700;
  font-size: 0.9rem;
  white-space: nowrap;
  text-align: right;
}
.rp-row__status {
  justify-self: end;
}
.rp-row__accept {
  justify-self: end;
}

/* Detalle. */
.rp-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rp-field {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
  font-size: 0.85rem;
  line-height: 1.4;
}
.rp-k {
  color: rgb(var(--v-theme-on-surface-variant));
  font-weight: 600;
}
.rp-v {
  white-space: pre-wrap;
  word-break: break-word;
}

/* En pantallas estrechas, ocultar la fecha en el resumen (queda en el detalle). */
@media (max-width: 560px) {
  .rp-row {
    grid-template-columns: 22px minmax(0, 1fr) auto auto auto;
  }
  .rp-row__date {
    display: none;
  }
}
</style>
