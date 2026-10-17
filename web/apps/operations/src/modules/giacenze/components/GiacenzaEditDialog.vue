<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    persistent
    @update:model-value="onDialogToggle"
  >
    <v-card>
      <v-card-title class="giac-dialog-title">
        {{ isEdit ? t("giacenze.giacenze.edit") : t("giacenze.giacenze.new") }}
      </v-card-title>

      <v-card-text>
        <!--
          Contexto de cabecera (paridad giacenze_form.php:163-172): cliente,
          LDV y tracking, con enlaces navegables. Solo en edicion.
        -->
        <div v-if="isEdit" class="giac-context">
          <a
            v-if="form.id_spedizione"
            :href="detailHref('shipment', form.id_spedizione)"
            target="_blank"
            class="giac-context__item"
          >
            <v-icon size="16" icon="mdi-package-variant-closed" />
            {{ t("giacenze.giacenze.shipment") }}: {{ form.id_spedizione }}
          </a>
          <span v-if="clientName" class="giac-context__item">
            <v-icon size="16" icon="mdi-account" />
            {{ t("giacenze.giacenze.client") }}: {{ clientName }}
          </span>
          <span v-if="trackingText" class="giac-context__item">
            <v-icon size="16" icon="mdi-map-marker-path" />
            {{ trackingText }}
          </span>
        </div>

        <v-form ref="formRef">
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.id_spedizione"
                :label="t('giacenze.giacenze.shipmentId')"
                type="number"
                :disabled="isEdit"
                :error-messages="errors.id_spedizione"
                required
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.operazione"
                :items="operationItems"
                :label="t('giacenze.giacenze.operation')"
                :error-messages="errors.operazione"
                required
              />
            </v-col>

            <v-col cols="12">
              <v-text-field
                v-model="form.descriz"
                :label="t('giacenze.giacenze.description')"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.data_open"
                :label="t('giacenze.giacenze.dataOpen')"
                type="date"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.data_close"
                :label="t('giacenze.giacenze.dataClose')"
                type="date"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.giacenza_gg"
                :label="t('giacenze.giacenze.days')"
                type="number"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <!--
                El importe se edita SIEMPRE en la divisa del titolare (la que
                ve el operador en el listado), no en EUR. El sufijo del label
                la hace explícita y el payload la envía para que el backend
                convierta antes de guardar: la BD almacena EUR.
                Bloqueado si la expedición ya fue post-facturada, igual que el
                legacy (giacenze_form.php:143-146).
              -->
              <v-text-field
                v-model.number="form.addebito_riconsegna"
                :label="`${t('giacenze.giacenze.redeliveryCharge')} (${amountCurrency})`"
                type="number"
                step="0.01"
                :readonly="amountLocked"
                :hint="
                  amountLocked
                    ? t('giacenze.giacenze.chargeLockedHint')
                    : undefined
                "
                :persistent-hint="amountLocked"
              >
                <!--
                  "Copia prezzo" (giacenze_form.php:180): trae el carico de la
                  expedicion. Deshabilitado si post-facturado, igual que el
                  legacy (el importe esta bloqueado). En su lugar, el candado.
                -->
                <template #append-inner>
                  <v-icon v-if="amountLocked" icon="mdi-lock" />
                  <v-btn
                    v-else-if="editingId"
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

            <v-col cols="12">
              <v-textarea
                v-model="form.note"
                :label="t('giacenze.giacenze.note')"
                rows="2"
                auto-grow
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.cont_fornitore_data"
                :label="t('giacenze.giacenze.contactSupplier')"
                type="date"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.cont_cliente_data"
                :label="t('giacenze.giacenze.contactClient')"
                type="date"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.cont_destin_data"
                :label="t('giacenze.giacenze.contactRecipient')"
                type="date"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.risp_cliente_data"
                :label="t('giacenze.giacenze.clientReply')"
                type="date"
              >
                <!--
                  Indicador de respuesta del cliente (paridad
                  giacenze_form.php:218-220): verde si respondio, rojo si no.
                  Es la señal que el operador mira para saber si puede actuar.
                -->
                <template #append-inner>
                  <v-chip
                    size="x-small"
                    :color="hasClientReply ? 'success' : 'error'"
                    variant="flat"
                  >
                    {{
                      hasClientReply
                        ? t("giacenze.giacenze.replied")
                        : t("giacenze.giacenze.awaitingReply")
                    }}
                  </v-chip>
                </template>
              </v-text-field>
            </v-col>
          </v-row>
        </v-form>

        <!--
          Direcciones de entrega (D actual + V original). Solo en edicion: en un
          alta todavia no hay expedicion resuelta. Redirigir la entrega se hace
          desde el formulario de expedicion, cuyo endpoint clona D->V.
        -->
        <template v-if="isEdit && form.id_spedizione">
          <v-divider class="my-4" />
          <div class="text-subtitle-2 mb-2">
            {{ t("giacenze.giacenze.addr.title") }}
          </div>
          <GiacenzaAddresses :shipment-id="form.id_spedizione" />
        </template>

        <!-- Mensajes al cliente (GIAc) y al fornitore (GIAf) + historial. -->
        <template v-if="isEdit && editingId">
          <v-divider class="my-4" />
          <div class="text-subtitle-2 mb-2">
            {{ t("giacenze.giacenze.msg.title") }}
          </div>
          <GiacenzaMessages :giacenza-id="editingId" />
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
        <v-btn color="primary" :loading="store.saving" @click="submit">{{
          t("common.save")
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useGiacenzeStore } from "../stores/giacenze.store";
import GiacenzaAddresses from "./GiacenzaAddresses.vue";
import { detailHref } from "@shared/platform/navTargets";
import GiacenzaMessages from "./GiacenzaMessages.vue";
import { giacenzeService } from "../services/giacenze.service";
import {
  GIACENZA_OPERATIONS,
  type Giacenza,
  type GiacenzaOperation,
  type GiacenzaWritePayload,
} from "../types";

const props = defineProps<{
  modelValue: boolean;
  giacenza: Giacenza | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [mode: "created" | "updated"];
}>();

const { t } = useI18n();
const store = useGiacenzeStore();

const isEdit = computed(() => props.giacenza !== null);
const editingId = computed(() => props.giacenza?.id ?? null);
// Contexto de cabecera: vienen del JOIN del listado (pueden faltar si el
// registro se abrio por otra via).
const clientName = computed(() => props.giacenza?.cliente_rag_soc ?? "");
const trackingText = computed(() => props.giacenza?.tracking_descr ?? "");

/**
 * ¿El cliente respondió? risp_cliente_data informado y distinto del centinela.
 * El registro trae datetime; el form lo edita como date, así que se mira el
 * dato original, no el del form.
 */
const hasClientReply = computed(() => {
  const v = props.giacenza?.risp_cliente_data ?? "";
  return v !== "" && v !== null && !v.startsWith("0000-00-00");
});

// "Copia prezzo": trae el carico de la expedicion al campo de importe. El
// backend lo devuelve ya en la divisa del cliente (la misma que se muestra).
const copyingPrice = ref(false);
async function copyPrice(): Promise<void> {
  const id = editingId.value;
  if (!id) return;
  copyingPrice.value = true;
  try {
    const res = await giacenzeService.caricoPrice(id);
    form.addebito_riconsegna = res.carico_display;
  } finally {
    copyingPrice.value = false;
  }
}

/**
 * Divisa en la que se muestra y se edita el importe: la del titolare del
 * cliente. La BD guarda EUR, así que el backend convierte al leer y al
 * escribir. En un alta todavía no hay expedición resuelta, de modo que se
 * asume EUR — que es también el fallback del backend.
 */
const amountCurrency = computed(
  () => props.giacenza?.addebito_riconsegna_currency ?? "EUR",
);

/** Expedición post-facturada: el importe queda bloqueado (paridad legacy). */
const amountLocked = computed(
  () => props.giacenza?.addebito_riconsegna_locked === true,
);

interface FormState {
  id_spedizione: number | null;
  operazione: GiacenzaOperation | null;
  descriz: string | null;
  note: string | null;
  data_open: string | null;
  data_close: string | null;
  giacenza_gg: number | null;
  addebito_riconsegna: number | null;
  cont_fornitore_data: string | null;
  cont_cliente_data: string | null;
  cont_destin_data: string | null;
  risp_cliente_data: string | null;
}

function blankForm(): FormState {
  return {
    id_spedizione: null,
    operazione: "A",
    descriz: null,
    note: null,
    data_open: null,
    data_close: null,
    giacenza_gg: null,
    addebito_riconsegna: null,
    cont_fornitore_data: null,
    cont_cliente_data: null,
    cont_destin_data: null,
    risp_cliente_data: null,
  };
}

const form = reactive<FormState>(blankForm());
const errors = reactive<{ id_spedizione: string[]; operazione: string[] }>({
  id_spedizione: [],
  operazione: [],
});

const operationItems = computed(() =>
  GIACENZA_OPERATIONS.map((op) => ({
    title: t(`giacenze.giacenze.operations.${op}`),
    value: op,
  })),
);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    errors.id_spedizione = [];
    errors.operazione = [];
    if (props.giacenza) {
      Object.assign(form, {
        id_spedizione: props.giacenza.id_spedizione,
        operazione: props.giacenza.operazione ?? "A",
        descriz: props.giacenza.descriz,
        note: props.giacenza.note,
        data_open: props.giacenza.data_open,
        data_close: props.giacenza.data_close,
        giacenza_gg: props.giacenza.giacenza_gg,
        // El importe MOSTRADO, no el crudo: `addebito_riconsegna` viene en EUR
        // y el listado muestra `_display` (convertido). Cargar el crudo hacía
        // que la fila y el modal enseñaran números distintos para el mismo
        // dato, y al guardar el valor de la fila se persistía como EUR.
        addebito_riconsegna:
          props.giacenza.addebito_riconsegna_display ??
          props.giacenza.addebito_riconsegna,
        cont_fornitore_data: props.giacenza.cont_fornitore_data,
        cont_cliente_data: props.giacenza.cont_cliente_data,
        cont_destin_data: props.giacenza.cont_destin_data,
        risp_cliente_data: props.giacenza.risp_cliente_data,
      });
    } else {
      Object.assign(form, blankForm());
    }
  },
);

function validate(): boolean {
  errors.id_spedizione = [];
  errors.operazione = [];
  let ok = true;
  if (!form.id_spedizione || form.id_spedizione <= 0) {
    errors.id_spedizione = [t("giacenze.giacenze.validation.shipmentRequired")];
    ok = false;
  }
  if (!form.operazione) {
    errors.operazione = [t("giacenze.giacenze.validation.operationRequired")];
    ok = false;
  }
  return ok;
}

function buildPayload(): GiacenzaWritePayload {
  return {
    id_spedizione: form.id_spedizione as number,
    operazione: form.operazione as GiacenzaOperation,
    descriz: form.descriz,
    note: form.note,
    data_open: form.data_open,
    data_close: form.data_close,
    giacenza_gg: form.giacenza_gg,
    addebito_riconsegna: form.addebito_riconsegna,
    // Declara en qué divisa va el importe. El backend lo convierte a EUR
    // antes de persistir; si se omitiera, asumiría EUR (fallback) y guardaría
    // el número tal cual, corrompiendo el dato para clientes no-EUR.
    addebito_riconsegna_currency: amountCurrency.value,
    cont_fornitore_data: form.cont_fornitore_data,
    cont_cliente_data: form.cont_cliente_data,
    cont_destin_data: form.cont_destin_data,
    risp_cliente_data: form.risp_cliente_data,
  };
}

async function submit(): Promise<void> {
  if (!validate()) return;
  const payload = buildPayload();
  if (props.giacenza) {
    await store.update(props.giacenza.id, payload);
    emit("saved", "updated");
  } else {
    await store.create(payload);
    emit("saved", "created");
  }
  close();
}

function close(): void {
  emit("update:modelValue", false);
}

function onDialogToggle(v: boolean): void {
  if (!v) close();
}
</script>

<style scoped>
.giac-dialog-title {
  font-size: 1.1rem;
  font-weight: 600;
}
.giac-context {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 8px 12px;
  margin-bottom: 12px;
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
</style>
