<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    width="420"
    temporary
    :scrim="true"
  >
    <v-toolbar density="comfortable" flat color="surface-variant">
      <v-toolbar-title class="text-subtitle-1 font-weight-medium">
        {{ t("invoicing.filters.advanced_title") }}
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        @click="open = false"
      />
    </v-toolbar>

    <v-tabs v-model="activeTab" density="compact" grow show-arrows>
      <v-tab value="dates">{{
        t("invoicing.invoice.filters.tabs.dates")
      }}</v-tab>
      <v-tab value="basics">{{
        t("invoicing.invoice.filters.tabs.basics")
      }}</v-tab>
      <v-tab value="status">{{
        t("invoicing.invoice.filters.tabs.status")
      }}</v-tab>
    </v-tabs>

    <v-tabs-window v-model="activeTab" class="pa-4">
      <!-- Fechas -->
      <v-tabs-window-item value="dates">
        <v-text-field
          v-model="local.data_da"
          :label="t('invoicing.invoice.filters.date_from')"
          type="date"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
        <v-text-field
          v-model="local.data_a"
          :label="t('invoicing.invoice.filters.date_to')"
          type="date"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
          class="mt-3"
        />
      </v-tabs-window-item>

      <!-- Básicos -->
      <v-tabs-window-item value="basics">
        <v-text-field
          v-model="local.numero"
          :label="t('invoicing.invoice.filters.number')"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
      </v-tabs-window-item>

      <!-- Estado SDI -->
      <v-tabs-window-item value="status">
        <v-select
          v-model="local.stato_sdi"
          :items="sdiOptions"
          :label="t('invoicing.invoice.filters.status')"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
        <v-select
          v-model="local.stato_pagamento"
          :items="paymentOptions"
          :label="t('invoicing.payment.title')"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
          class="mt-3"
        />
      </v-tabs-window-item>
    </v-tabs-window>

    <template #append>
      <div class="pa-4 d-flex ga-2">
        <v-btn variant="text" :disabled="!hasAny" @click="clearAll">
          {{ t("invoicing.listing.clear_filters") }}
        </v-btn>
        <v-spacer />
        <v-btn color="primary" :loading="loading" @click="applyAndClose">
          {{ t("common.search") }}
        </v-btn>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { PAYMENT_FILTER_VALUES } from "../../services/paymentStatus";

const { t } = useI18n();

export interface InvoiceFilters {
  data_da: string;
  data_a: string;
  numero: string;
  stato_sdi: string;
  /** paid | pending | overdue */
  stato_pagamento: string;
}

const props = defineProps<{
  modelValue: boolean;
  filters: InvoiceFilters;
  loading?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  apply: [InvoiceFilters];
}>();

// v-model del drawer.
const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const activeTab = ref("dates");

// Buffer local: se aplica al store solo al pulsar "Buscar" (paridad con el
// comportamiento previo del formulario del sidebar). Se sincroniza con los
// filtros del padre cada vez que se abre el panel.
const local = reactive<InvoiceFilters>({ ...props.filters });
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) Object.assign(local, props.filters);
  },
);

const sdiOptions = computed(() =>
  ["N", "I", "O", "K", "W"].map((v) => ({
    title: t(`invoicing.sdi.${v}`),
    value: v,
  })),
);

const paymentOptions = computed(() =>
  PAYMENT_FILTER_VALUES.map((v) => ({
    title: t(`invoicing.payment.${v}`),
    value: v,
  })),
);

const hasAny = computed(
  () =>
    !!(
      local.data_da ||
      local.data_a ||
      local.numero ||
      local.stato_sdi ||
      local.stato_pagamento
    ),
);

function applyAndClose(): void {
  emit("apply", { ...local });
  open.value = false;
}
function clearAll(): void {
  local.data_da = "";
  local.data_a = "";
  local.numero = "";
  local.stato_sdi = "";
  local.stato_pagamento = "";
  emit("apply", { ...local });
}
</script>
