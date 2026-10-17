<template>
  <v-menu
    v-model="open"
    :close-on-content-click="false"
    location="bottom start"
    offset="4"
  >
    <template #activator="{ props: btnProps }">
      <v-btn
        v-bind="btnProps"
        icon="mdi-eye-outline"
        size="x-small"
        variant="text"
        :title="
          ($attrs.title as string | undefined) ??
          'Show price breakdown (listino + fix C/F)'
        "
      />
    </template>

    <v-card min-width="280" border>
      <v-card-title class="text-subtitle-2 d-flex align-center py-2 px-3">
        <v-icon icon="mdi-tag-text-outline" size="16" class="me-2" />
        {{ t("shipment.suppl_breakdown.title") }}
        <v-spacer />
        <v-btn
          icon="mdi-close"
          size="x-small"
          variant="text"
          @click="open = false"
        />
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-3">
        <div v-if="loading" class="text-caption text-medium-emphasis">
          {{ t("shipment.suppl_breakdown.computing") }}
        </div>
        <div v-else-if="error" class="text-caption text-error">
          {{ error }}
        </div>
        <div v-else>
          <!-- Client side -->
          <div class="text-caption text-medium-emphasis mb-1">
            {{ t("shipment.suppl_breakdown.client") }}
          </div>
          <div class="d-flex justify-space-between mb-2">
            <span>{{ t("shipment.suppl_breakdown.listino") }}</span>
            <span class="font-weight-medium">{{ format(listCliente) }}</span>
          </div>
          <div class="d-flex justify-space-between mb-3">
            <span>{{ t("shipment.suppl_breakdown.fixed") }}</span>
            <span class="font-weight-medium" :class="fixClienteClass">{{
              format(fixCliente)
            }}</span>
          </div>

          <v-divider class="my-2" />

          <!-- Supplier side -->
          <div class="text-caption text-medium-emphasis mb-1">
            {{ t("shipment.suppl_breakdown.fornitore") }}
          </div>
          <div class="d-flex justify-space-between mb-2">
            <span>{{ t("shipment.suppl_breakdown.listino") }}</span>
            <span class="font-weight-medium">{{ format(listForn) }}</span>
          </div>
          <div class="d-flex justify-space-between">
            <span>{{ t("shipment.suppl_breakdown.fixed") }}</span>
            <span class="font-weight-medium" :class="fixFornClass">{{
              format(fixForn)
            }}</span>
          </div>

          <div
            v-if="!hasAnyPrice"
            class="text-caption text-medium-emphasis mt-3"
          >
            {{ t("shipment.suppl_breakdown.no_data") }}
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { supplementsService } from "@shipment/services/supplements.service";
import { formatMoney } from "@shipment/utils/currency";

/**
 * Per-row supplement price breakdown popover — parity with legacy
 * spedy_form.php `SppPrice()` (mini popup with listino + fix on both
 * client and supplier sides). The 4 numbers come from
 * Supplement_Orchestrator_Service::calculate_dual_supplements via
 * /ajax_shipment_supplements?op=prices.
 *
 * The popover lazy-loads on first open and caches the dataset for
 * the lifetime of the shipment store; subsequent opens reuse the
 * cached map.
 */
const props = defineProps<{
  /** Supplement catalog id (supplementi.id). */
  supplementId: number | string;
}>();

const { t } = useI18n();
const store = useShipmentStore();

const open = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

const listCliente = ref<number>(0);
const fixCliente = ref<number>(0);
const listForn = ref<number>(0);
const fixForn = ref<number>(0);

const hasAnyPrice = computed(
  () =>
    listCliente.value > 0 ||
    fixCliente.value > 0 ||
    listForn.value > 0 ||
    fixForn.value > 0,
);

const fixClienteClass = computed(() =>
  fixCliente.value > 0 ? "text-warning" : "text-medium-emphasis",
);
const fixFornClass = computed(() =>
  fixForn.value > 0 ? "text-warning" : "text-medium-emphasis",
);

function format(v: number): string {
  return formatMoney(v);
}

async function load(): Promise<void> {
  if (!store.id) return;
  loading.value = true;
  error.value = null;
  try {
    const r = await supplementsService.prices(store.id);
    if (!r.success || !r.data) {
      error.value = r.error ?? "Price computation failed";
      return;
    }
    const key = String(props.supplementId);
    listCliente.value = Number(r.data.list_cliente?.[key] ?? 0);
    fixCliente.value = Number(r.data.fix_cliente?.[key] ?? 0);
    listForn.value = Number(r.data.list_forn?.[key] ?? 0);
    fixForn.value = Number(r.data.fix_forn?.[key] ?? 0);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

// Lazy-load on first open.
watch(open, (v) => {
  if (v) void load();
});
</script>
