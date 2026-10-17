<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-file-tree-outline" size="18" class="me-2" />
      {{ t("cargo.hawb.house_awbs") }}
      <v-badge :content="count" color="primary" inline class="ms-2" />
      <v-spacer />
      <v-btn
        size="small"
        variant="outlined"
        prepend-icon="mdi-format-list-bulleted"
        @click="openList"
      >
        {{ t("cargo.hawb.manage") }}
      </v-btn>
    </v-card-title>
    <v-divider />
    <v-card-text v-if="loading" class="text-center py-3">
      <v-progress-circular indeterminate color="primary" size="22" />
    </v-card-text>
    <v-list v-else-if="rows.length" density="compact" lines="two">
      <v-list-item v-for="r in rows.slice(0, 5)" :key="r.id" @click="openList">
        <v-list-item-title>
          <span class="metric-mono">{{ r.awb_number || "—" }}</span>
        </v-list-item-title>
        <v-list-item-subtitle class="text-caption">
          {{ r.shipper_name || "—" }} → {{ r.consignee_name || "—" }} ·
          {{
            t("cargo.hawb.pieces_weight", {
              p: r.pieces,
              w: r.weight.toFixed(1),
            })
          }}
        </v-list-item-subtitle>
      </v-list-item>
      <v-list-item v-if="rows.length > 5" @click="openList">
        <v-list-item-title class="text-caption text-medium-emphasis">
          {{ t("cargo.hawb.and_more", { n: rows.length - 5 }) }}
        </v-list-item-title>
      </v-list-item>
    </v-list>
    <v-card-text
      v-else
      class="text-caption text-medium-emphasis text-center py-4"
    >
      {{ t("cargo.hawb.empty") }}
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import { hawbService, type HawbRow } from "@cargo/services/hawb.service";

const { t } = useI18n();

const cargoStore = useCargoStore();
const { id } = storeToRefs(cargoStore);
const ui = useUiStore();

const rows = ref<HawbRow[]>([]);
const loading = ref(false);

const count = computed(() => rows.value.length);

async function load(): Promise<void> {
  if (!id.value) {
    rows.value = [];
    return;
  }
  loading.value = true;
  try {
    rows.value = await hawbService.list(Number(id.value));
  } finally {
    loading.value = false;
  }
}

function openList(): void {
  ui.openModal("hawb_list");
}

onMounted(load);
watch(() => id.value, load);
</script>

<style scoped>
.metric-mono {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
