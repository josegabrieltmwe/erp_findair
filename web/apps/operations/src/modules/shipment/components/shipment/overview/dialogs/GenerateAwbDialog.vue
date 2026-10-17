<template>
  <AppDialog
    :open="modelValue"
    :title="t('shipment.awb.generate_dialog_title')"
    icon="mdi-truck-plus-outline"
    size="sm"
    persistent
    @close="emit('update:modelValue', false)"
  >
    <v-alert
      type="warning"
      variant="tonal"
      density="compact"
      icon="mdi-alert-outline"
      class="mb-3"
    >
      <strong>{{ t("shipment.awb.generate_warning") }}</strong
      >:
      {{ t("shipment.awb.generate_warning_body", { courier: courierLabel }) }}
      <div v-if="willBookPickup" class="mt-2">
        <v-icon icon="mdi-truck-check-outline" size="14" class="me-1" />
        {{ t("shipment.awb.generate_will_book_pickup") }}
      </div>
    </v-alert>

    <!-- Pre-flight validation (auto, replaces the standalone "Verifica
             pre-stampa" menu entry). Errors block the booking; warnings advise. -->
    <div
      v-if="validating"
      class="d-flex align-center mb-3 text-medium-emphasis"
    >
      <v-progress-circular indeterminate size="16" width="2" class="me-2" />
      <span class="text-caption">{{ t("shipment.awb.validating") }}</span>
    </div>
    <v-alert
      v-else-if="errors.length"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      <div class="font-weight-medium mb-1">
        {{ t("shipment.awb.val_errors_title", { count: errors.length }) }}
      </div>
      <ul class="ldv-val-list">
        <li v-for="(e, i) in errors" :key="`e${i}`">{{ e.message }}</li>
      </ul>
    </v-alert>
    <v-alert
      v-else-if="warnings.length"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      <div class="font-weight-medium mb-1">
        {{ t("shipment.awb.val_warnings_title", { count: warnings.length }) }}
      </div>
      <ul class="ldv-val-list">
        <li v-for="(w, i) in warnings" :key="`w${i}`">{{ w.message }}</li>
      </ul>
    </v-alert>
    <v-alert
      v-else
      type="success"
      variant="tonal"
      density="compact"
      icon="mdi-check-circle-outline"
      class="mb-3"
    >
      {{ t("shipment.awb.val_passed") }}
    </v-alert>
    <div class="d-flex flex-column gap-2">
      <div class="d-flex">
        <span class="text-medium-emphasis me-2" style="min-width: 140px">{{
          t("shipment.awb.field_courier")
        }}</span>
        <span class="font-weight-medium">{{ courierLabel }}</span>
      </div>
      <div class="d-flex">
        <span class="text-medium-emphasis me-2" style="min-width: 140px">{{
          t("shipment.awb.field_service")
        }}</span>
        <span class="font-weight-medium">{{ supplierServiceName || "—" }}</span>
      </div>
      <div class="d-flex">
        <span class="text-medium-emphasis me-2" style="min-width: 140px">{{
          t("shipment.awb.field_ship_date")
        }}</span>
        <span class="font-weight-medium">
          {{ shipDateLabel }}
          <span v-if="shipDateAdjusted" class="text-caption text-warning ms-1">
            {{ t("shipment.awb.ship_date_adjusted") }}
          </span>
        </span>
      </div>
    </div>
    <template #actions>
      <!-- Cancel stays left; AppDialog puts a spacer before this slot, so an
             explicit leading spacer would double it — instead push the primary
             button right with its own spacer. -->
      <v-btn
        variant="text"
        :disabled="generating"
        @click="emit('update:modelValue', false)"
      >
        {{ t("common.cancel") }}
      </v-btn>
      <v-spacer />
      <!-- Wrap in a span so the tooltip still fires while the button is
             disabled (a disabled <button> swallows pointer events). -->
      <v-tooltip
        :disabled="!(validating || hasBlockingErrors)"
        location="top"
        :text="
          validating
            ? t('shipment.awb.generate_disabled_validating')
            : t('shipment.awb.generate_disabled_errors')
        "
      >
        <template #activator="{ props: tipProps }">
          <span v-bind="tipProps">
            <v-btn
              color="primary"
              variant="flat"
              prepend-icon="mdi-truck-fast-outline"
              :loading="generating"
              :disabled="validating || hasBlockingErrors"
              @click="emit('generate')"
            >
              {{ t("shipment.awb.generate_now") }}
            </v-btn>
          </span>
        </template>
      </v-tooltip>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * Generate-AWB confirmation dialog: pre-flight validation summary + booking
 * button. Presentational — validation/booking state comes from useAwbGeneration;
 * the courier/service/pickup header values are passed as props (they are also
 * shown in the card header, so they stay owned by the card). Extracted from
 * ServizioCard unchanged.
 */
import type { ValidationIssue } from "@shipment/services/labels.service";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";

defineProps<{
  modelValue: boolean;
  courierLabel: string | null;
  supplierServiceName: string | null;
  willBookPickup: boolean;
  validating: boolean;
  generating: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  hasBlockingErrors: boolean;
  shipDateLabel: string;
  shipDateAdjusted: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  generate: [];
}>();

const { t } = useI18n();
</script>

<style scoped>
.ldv-val-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.4;
}
</style>
