<template>
  <div class="mawb-form__grid">
    <MawbAddressBlock
      ref="shipperRef"
      :label="t('cargo.mawbv2.shipper')"
      icon="mdi-truck-fast-outline"
      tipo="PRS"
      prefix="shipper_"
      :cargo-id="cargoId"
      :model-value="shipper"
      :readonly="locked"
      @field-change="(p) => emit('field-change', { prefix: 'shipper', ...p })"
      @fields-change="
        (p) => emit('fields-change', { prefix: 'shipper', fields: p })
      "
    />
    <MawbAddressBlock
      ref="consigneeRef"
      :label="t('cargo.mawbv2.consignee')"
      icon="mdi-package-variant-closed"
      tipo="DST"
      prefix="consignee_"
      :cargo-id="cargoId"
      :model-value="consignee"
      :readonly="locked"
      @field-change="(p) => emit('field-change', { prefix: 'consignee', ...p })"
      @fields-change="
        (p) => emit('fields-change', { prefix: 'consignee', fields: p })
      "
    />
    <MawbAddressBlock
      ref="notifyRef"
      :label="t('cargo.mawbv2.notify')"
      icon="mdi-bell-outline"
      tipo="DST"
      prefix="notify_"
      :cargo-id="cargoId"
      :model-value="notify"
      :readonly="locked"
      @field-change="(p) => emit('field-change', { prefix: 'notify', ...p })"
      @fields-change="
        (p) => emit('fields-change', { prefix: 'notify', fields: p })
      "
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import MawbAddressBlock from "../MawbAddressBlock.vue";
import type { MawbAddress } from "@cargo/services/cargo_mawb.types";

export type AddressPrefix = "shipper" | "consignee" | "notify";

defineProps<{
  shipper: MawbAddress;
  consignee: MawbAddress;
  notify: MawbAddress;
  locked: boolean;
  cargoId: number | null;
}>();

const emit = defineEmits<{
  (
    e: "field-change",
    payload: { prefix: AddressPrefix; field: keyof MawbAddress; value: string },
  ): void;
  (
    e: "fields-change",
    payload: {
      prefix: AddressPrefix;
      fields: Partial<Record<keyof MawbAddress, string>>;
    },
  ): void;
}>();

const { t } = useI18n();

type AddressBlockExposed = {
  releaseField: (f: keyof MawbAddress) => void;
  releaseAll: () => void;
};
const shipperRef = ref<AddressBlockExposed | null>(null);
const consigneeRef = ref<AddressBlockExposed | null>(null);
const notifyRef = ref<AddressBlockExposed | null>(null);

/**
 * Release a block's dirty flags once the parent has persisted them, so server
 * refreshes own those fields again.
 */
function release(prefix: AddressPrefix, field?: keyof MawbAddress): void {
  const target =
    prefix === "shipper"
      ? shipperRef.value
      : prefix === "consignee"
        ? consigneeRef.value
        : notifyRef.value;
  if (!target) return;
  if (field) target.releaseField(field);
  else target.releaseAll();
}

defineExpose({ release });
</script>

<style scoped>
.mawb-form__grid {
  display: grid;
  /* Shipper / consignee / notify are peers, so they go 3-up or 1-up — never
     2+1, which would leave the third block orphaned at half width. */
  grid-template-columns: 1fr;
  gap: 12px;
  align-items: start;
}
@media (min-width: 1100px) {
  .mawb-form__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
