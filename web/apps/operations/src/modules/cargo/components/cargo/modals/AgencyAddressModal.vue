<template>
  <ModalWrapper
    name="agency"
    :title="t('cargo.modal.agency')"
    icon="mdi-domain"
    :max-width="720"
  >
    <CargoAddressBlock
      ref="blockRef"
      embedded
      tipo="A"
      :title="t('cargo.modal.agency')"
      icon="mdi-domain"
    />
    <template #actions>
      <v-btn variant="text" :disabled="store.saving" @click="onCancel">{{
        t("common.cancel")
      }}</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="store.saving"
        :disabled="store.saving"
        @click="onSave"
      >
        {{ t("common.save") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref } from "vue";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import ModalWrapper from "./ModalWrapper.vue";
import CargoAddressBlock from "@cargo/components/cargo/CargoAddressBlock.vue";

const { t } = useI18n();
const ui = useUiStore();
const store = useCargoStore();
const blockRef = ref<{ save: () => Promise<boolean>; dirty: boolean } | null>(
  null,
);

async function onSave(): Promise<void> {
  const ok = await blockRef.value?.save();
  if (ok) ui.closeModal();
}

/**
 * Cerrar descarta el buffer local del bloque (nada se ha persistido todavía).
 * Si hay cambios pendientes se pide confirmación: antes se perdían en silencio.
 */
function onCancel(): void {
  if (
    blockRef.value?.dirty &&
    !window.confirm(t("cargo.addr.discard_confirm"))
  ) {
    return;
  }
  ui.closeModal();
}
</script>
