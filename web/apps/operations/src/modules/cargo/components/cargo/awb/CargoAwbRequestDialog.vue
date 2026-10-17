<template>
  <!--
    Pedir a la aerolínea que asigne números AWB nuevos al partner.

    Cuando el stock se agota no se puede emitir AWB y la expedición se queda
    parada; esto es lo que la desatasca. El destinatario NO se teclea: sale de
    la ficha del vettore (cargo_vettori_dett). El campo manual existe solo para
    los casos en que la ficha no lo tenga, no como vía principal.
  -->
  <v-dialog v-model="model" max-width="560">
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-email-arrow-right-outline" size="20" />
        {{ t("cargo.awb_request.title") }}
      </v-card-title>

      <v-divider />

      <v-card-text>
        <div class="text-body-2 text-medium-emphasis mb-3">
          {{ t("cargo.awb_request.intro", { carrier: carrierLabel }) }}
        </div>

        <!-- El destinatario se enseña siempre: es lo que evita el error del
             legacy de mandar el correo a quien no era. -->
        <v-alert
          v-if="carrierMail"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3 text-caption"
        >
          {{ t("cargo.awb_request.recipient") }}
          <strong>{{ carrierMail }}</strong>
        </v-alert>
        <v-alert
          v-else
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3 text-caption"
        >
          {{ t("cargo.awb_request.no_recipient") }}
        </v-alert>

        <v-text-field
          v-model.number="qty"
          type="number"
          min="0"
          max="1000"
          :label="t('cargo.awb_request.qty')"
          density="compact"
          variant="outlined"
          hide-details
          class="mb-3"
        />

        <v-combobox
          v-model="extraTo"
          :label="t('cargo.awb_request.extra_to')"
          :hint="t('cargo.awb_request.extra_to_hint')"
          multiple
          chips
          closable-chips
          density="compact"
          variant="outlined"
          persistent-hint
          class="mb-3"
        />

        <v-textarea
          v-model="note"
          :label="t('cargo.awb_request.note')"
          density="compact"
          variant="outlined"
          rows="3"
          auto-grow
          hide-details
        />

        <!-- Enfriamiento: no es un error del operador, es un freno para no
             repetirle el mismo correo a la aerolínea. Por eso se presenta
             como aviso con salida ("enviar igualmente"), no como fallo. -->
        <v-alert
          v-if="store.cooldownInfo"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-3 text-caption"
        >
          {{
            t("cargo.awb_request.cooldown", {
              date: store.cooldownInfo.last_sent_at,
              days: store.cooldownInfo.cooldown_days,
            })
          }}
        </v-alert>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" size="small" @click="model = false">
          {{ t("common.cancel") }}
        </v-btn>
        <v-btn
          :color="store.cooldownInfo ? 'warning' : 'primary'"
          variant="flat"
          rounded="lg"
          :loading="store.requestingAwb"
          :disabled="!canSend"
          @click="submit"
        >
          {{
            store.cooldownInfo
              ? t("cargo.awb_request.send_anyway")
              : t("cargo.awb_request.send")
          }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useVettoriStore } from "@cargo/stores/vettori.store";

const props = defineProps<{
  modelValue: boolean;
  idVettore: number;
  partnerId: number;
  carrierLabel?: string;
  /** Email de la ficha del vettore, si se conoce. */
  carrierMail?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "sent"): void;
}>();

const { t } = useI18n();
const store = useVettoriStore();

const model = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

const qty = ref<number>(50);
const note = ref("");
const extraTo = ref<string[]>([]);

/** Sin destinatario en ficha hay que dar uno a mano, o no hay a quién enviar. */
const canSend = computed(
  () =>
    props.idVettore > 0 &&
    props.partnerId > 0 &&
    (!!props.carrierMail || extraTo.value.length > 0),
);

async function submit(): Promise<void> {
  // Si ya hubo un 429, este segundo clic ES la confirmación: se reenvía con
  // `force`. El aviso sigue visible mientras tanto, así que el operador ve
  // qué está forzando.
  const res = await store.requestAwbStock({
    id_vettore: props.idVettore,
    partner_id: props.partnerId,
    qty: qty.value || 0,
    note: note.value,
    extra_to: [...extraTo.value],
    force: store.cooldownInfo !== null,
  });
  // "cooldown" no cierra el diálogo: hay que enseñar el aviso y esperar a que
  // el operador decida.
  if (res === true) {
    emit("sent");
    model.value = false;
  }
}

// Formulario limpio en cada apertura: reutilizar la nota de la petición
// anterior mandaría un texto que ya no viene a cuento.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      qty.value = 50;
      note.value = "";
      extraTo.value = [];
      // Sin esto, un enfriamiento de una aerolínea anterior seguiría visible
      // y el primer clic saldría ya con `force`.
      store.cooldownInfo = null;
    }
  },
);
</script>
