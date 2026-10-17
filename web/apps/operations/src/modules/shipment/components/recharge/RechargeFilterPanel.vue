<template>
  <!--
    Drawer de filtros avanzados de Postfatturazione. Mismo patrón que
    ShipmentFilterPanel / CargoFilterPanel (drawer lateral derecho con buffer
    local aplicado al pulsar "Cerca"). Sustituye la antigua toolbar horizontal
    para uniformar la presentación de filtros entre todos los listados.
  -->
  <v-navigation-drawer
    v-model="open"
    location="right"
    width="420"
    temporary
    :scrim="true"
  >
    <v-toolbar density="comfortable" flat color="surface-variant">
      <v-toolbar-title class="text-subtitle-1 font-weight-medium">
        {{ t("shipment.recharge.advanced_filters") }}
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
      <v-tab value="dates">{{ t("shipment.recharge.tab_dates") }}</v-tab>
      <v-tab value="basics">{{ t("shipment.recharge.tab_fornitore") }}</v-tab>
    </v-tabs>

    <v-tabs-window v-model="activeTab" class="pa-4">
      <!-- Fechas -->
      <v-tabs-window-item value="dates">
        <v-text-field
          v-model="local.date_from"
          :label="t('shipment.recharge.from')"
          type="date"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
        <v-text-field
          v-model="local.date_to"
          :label="t('shipment.recharge.to')"
          type="date"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
          class="mt-3"
        />
      </v-tabs-window-item>

      <!-- Fornitore -->
      <v-tabs-window-item value="basics">
        <v-text-field
          v-model="local.id_fornitore"
          :label="t('shipment.recharge.id_fornitore')"
          type="number"
          density="comfortable"
          variant="outlined"
          hide-details
          clearable
        />
      </v-tabs-window-item>
    </v-tabs-window>

    <template #append>
      <div class="pa-4 d-flex ga-2">
        <v-btn variant="text" :disabled="!hasAny" @click="clearAll">
          {{ t("shipment.recharge.clear_filters") }}
        </v-btn>
        <v-spacer />
        <v-btn color="primary" :loading="loading" @click="applyAndClose">
          {{ t("shipment.recharge.search") }}
        </v-btn>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

export interface RechargeFilters {
  date_from: string;
  date_to: string;
  id_fornitore: string;
}

const props = defineProps<{
  modelValue: boolean;
  filters: RechargeFilters;
  loading?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  apply: [RechargeFilters];
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const activeTab = ref("dates");

// Buffer local: se aplica al store al pulsar "Cerca". Se sincroniza con los
// filtros del padre cada vez que se abre el panel.
const local = reactive<RechargeFilters>({ ...props.filters });
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) Object.assign(local, props.filters);
  },
);

const hasAny = computed(
  () => !!(local.date_from || local.date_to || local.id_fornitore),
);

function applyAndClose(): void {
  emit("apply", { ...local });
  open.value = false;
}
function clearAll(): void {
  local.date_from = "";
  local.date_to = "";
  local.id_fornitore = "";
  emit("apply", { ...local });
}
</script>
