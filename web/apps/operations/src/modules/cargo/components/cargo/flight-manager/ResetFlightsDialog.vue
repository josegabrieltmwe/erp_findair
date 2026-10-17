<template>
  <AppDialog
    :open="modelValue"
    :title="
      hasActiveBooking
        ? t('cargo.resetflights.title_booking')
        : t('cargo.resetflights.title')
    "
    icon="mdi-airplane-remove"
    icon-color="error"
    size="confirm"
    persistent
    @close="close"
  >
    <!-- Con reserva viva el aviso es otro: no se "rehace" nada, se cancela
         contra el carrier y eso no se deshace. -->
    <p class="mb-3">
      {{
        hasActiveBooking
          ? t("cargo.resetflights.intro_booking")
          : t("cargo.resetflights.intro")
      }}
    </p>

    <!-- What will be cleared, so the operator sees the blast radius. -->
    <ul class="reset-list mb-3">
      <li
        v-if="hasActiveBooking"
        class="reset-list__item reset-list__item--danger"
      >
        <v-icon icon="mdi-cancel" size="16" class="me-2" />
        {{ t("cargo.resetflights.will_cancel_booking") }}
        <!-- El AWB, para que la confirmacion nombre lo que se esta tirando. -->
        <strong v-if="bookingRef" class="ms-1">{{ bookingRef }}</strong>
      </li>
      <li v-if="hasRate" class="reset-list__item">
        <v-icon icon="mdi-tag-off-outline" size="16" class="me-2" />
        {{ t("cargo.resetflights.will_clear_rate") }}
      </li>
      <li
        v-if="!hasActiveBooking && !hasRate && !hasManualLegs"
        class="reset-list__item text-medium-emphasis"
      >
        <v-icon icon="mdi-information-outline" size="16" class="me-2" />
        {{ t("cargo.resetflights.nothing") }}
      </li>
    </ul>

    <!-- Los tramos manuales son OPCIONALES, y por eso no van en la lista de
         arriba: son lo unico que el operador escribio a mano, asi que soltar
         la tarifa sin perderlos es un caso real. Marcado por defecto porque
         quitar el vuelo entero es lo que se pide casi siempre. -->
    <v-checkbox
      v-if="hasManualLegs"
      v-model="clearLegs"
      color="error"
      density="compact"
      hide-details
      :disabled="busy"
      :label="t('cargo.resetflights.also_clear_legs')"
    />

    <!-- Booking cancel is destructive (frees AWB stock): require explicit opt-in. -->
    <v-checkbox
      v-if="hasActiveBooking"
      v-model="cancelAck"
      color="error"
      density="compact"
      hide-details
      :disabled="busy"
      :label="t('cargo.resetflights.ack_cancel_booking')"
    />

    <template #actions>
      <v-spacer />
      <v-btn variant="text" :disabled="busy" @click="close">
        {{ t("common.back") }}
      </v-btn>
      <v-btn
        color="error"
        variant="flat"
        prepend-icon="mdi-airplane-remove"
        :loading="busy"
        :disabled="!canConfirm"
        @click="emit('confirm', { clearManualLegs: clearLegs })"
      >
        {{
          hasActiveBooking
            ? t("cargo.resetflights.confirm_with_cancel")
            : t("cargo.resetflights.confirm")
        }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    busy: boolean;
    hasActiveBooking: boolean;
    hasRate: boolean;
    hasManualLegs: boolean;
    /** AWB (o id) de la reserva viva, para nombrarla en la confirmacion. */
    bookingRef?: string | null;
  }>(),
  { bookingRef: null },
);

const { t } = useI18n();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "confirm", opts: { clearManualLegs: boolean }): void;
}>();

// Explicit acknowledgement that a live booking will be cancelled.
const cancelAck = ref(false);
// Borrar tambien los tramos manuales (marcado por defecto).
const clearLegs = ref(true);
// Reset the acknowledgement each time the dialog re-opens.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      cancelAck.value = false;
      clearLegs.value = true;
    }
  },
);

const canConfirm = computed<boolean>(() => {
  // Nothing to do → block. Los tramos solo cuentan si se van a borrar: con la
  // casilla desmarcada y sin rate ni reserva, confirmar no haria NADA, y un
  // boton que no hace nada es peor que uno deshabilitado.
  const legsCount = props.hasManualLegs && clearLegs.value;
  if (!props.hasActiveBooking && !props.hasRate && !legsCount) return false;
  // A live booking requires the operator to opt in to the cancel.
  if (props.hasActiveBooking && !cancelAck.value) return false;
  return true;
});

function close(): void {
  if (!props.busy) emit("update:modelValue", false);
}
</script>

<style scoped>
.reset-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.reset-list__item {
  display: flex;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}
.reset-list__item--danger {
  color: rgb(var(--v-theme-error));
  font-weight: 500;
}
</style>
