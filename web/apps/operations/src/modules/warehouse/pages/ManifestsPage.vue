<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { can } from "../env";
import { isManifestSent, parseIdList, todayIso } from "../logic";
import { errMsg } from "../print";
import { warehouseApi } from "../services/warehouse.service";
import { useToastStore } from "../stores/toast.store";
import type { ManifestHistoryItem } from "../types";

const { t } = useI18n();
const toast = useToastStore();
const canWrite = can.write();

const date = ref(todayIso());
const carrier = ref("");
const page = ref(1);
const perPage = 20;
const items = ref<ManifestHistoryItem[]>([]);
const total = ref(0);
const busy = ref(false);

const idsText = ref("");
const confirmOpen = ref(false);
const ids = computed(() => parseIdList(idsText.value));
const lastResult = ref<string | null>(null);

async function load(): Promise<void> {
  busy.value = true;
  try {
    const r = await warehouseApi.manifestHistory({
      date: date.value,
      carrier: carrier.value,
      page: page.value,
      perPage,
    });
    items.value = r.items;
    total.value = r.pagination?.total ?? r.items.length;
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  } finally {
    busy.value = false;
  }
}

async function generate(): Promise<void> {
  busy.value = true;
  try {
    const r = await warehouseApi.generateBrt(ids.value);
    lastResult.value = t("warehouse.manifests.queued", {
      id: r.id_manifest,
      n: r.shipments,
    });
    confirmOpen.value = false;
    idsText.value = "";
    toast.push("success", lastResult.value);
    await load();
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.manifests.failed")));
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="wh-page">
    <h1 class="text-h6 mb-4">{{ t("warehouse.manifests.title") }}</h1>
    <v-alert v-if="!canWrite" type="info" variant="tonal" density="compact" class="mb-3">
      {{ t("warehouse.common.read_only") }}
    </v-alert>

    <v-card variant="outlined" class="mb-5">
      <v-card-title class="text-subtitle-1">{{ t("warehouse.manifests.generate") }}</v-card-title>
      <v-card-text>
        <v-tabs density="compact" model-value="brt">
          <v-tab value="brt">BRT</v-tab>
          <v-tab v-for="c in ['DHL', 'TNT', 'UPS']" :key="c" :value="c" disabled>{{ c }}</v-tab>
        </v-tabs>
        <div class="text-caption text-medium-emphasis my-2">
          {{ t("warehouse.manifests.others_unavailable") }}
        </div>
        <v-textarea
          v-model="idsText"
          :label="t('warehouse.manifests.ids')"
          :hint="t('warehouse.manifests.ids_hint')"
          persistent-hint
          rows="2"
          variant="outlined"
          :disabled="!canWrite"
        />
        <div class="mt-2 text-body-2">
          {{ t("warehouse.manifests.selected", { n: ids.length }) }}
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!canWrite || !ids.length"
          @click="confirmOpen = true"
          >{{ t("warehouse.manifests.generate_brt") }}</v-btn
        >
      </v-card-actions>
    </v-card>

    <h2 class="text-subtitle-1 mb-2">{{ t("warehouse.manifests.history") }}</h2>
    <div class="d-flex flex-wrap ga-3 mb-3">
      <v-text-field
        v-model="date"
        type="date"
        :label="t('warehouse.common.date')"
        variant="outlined"
        density="compact"
        hide-details
        style="max-width: 180px"
        @update:model-value="page = 1; load()"
      />
      <v-text-field
        v-model="carrier"
        :label="t('warehouse.manifests.carrier')"
        variant="outlined"
        density="compact"
        hide-details
        style="max-width: 200px"
        @keyup.enter="page = 1; load()"
      />
      <v-btn variant="tonal" @click="page = 1; load()">{{ t("warehouse.common.search") }}</v-btn>
    </div>
    <v-progress-linear v-if="busy" indeterminate />
    <div v-if="!busy && !items.length" class="text-medium-emphasis">
      {{ t("warehouse.manifests.empty") }}
    </div>
    <v-table v-else density="compact">
      <thead>
        <tr>
          <th>#</th>
          <th>{{ t("warehouse.manifests.created") }}</th>
          <th>{{ t("warehouse.manifests.carrier") }}</th>
          <th>{{ t("warehouse.manifests.shipments") }}</th>
          <th>{{ t("warehouse.manifests.sent") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in items" :key="m.id">
          <td>{{ m.id }}</td>
          <td>{{ m.insert_datetime }}</td>
          <td>{{ m.fornitore_nome }}</td>
          <td>{{ m.num_spedizioni }}</td>
          <td>
            <v-chip size="x-small" :color="isManifestSent(m.invio_ftp) ? 'success' : 'warning'">{{
              isManifestSent(m.invio_ftp) ? m.invio_ftp : t("warehouse.manifests.not_sent")
            }}</v-chip>
          </td>
        </tr>
      </tbody>
    </v-table>
    <v-pagination
      v-if="total > perPage"
      v-model="page"
      :length="Math.ceil(total / perPage)"
      density="compact"
      @update:model-value="load"
    />

    <v-dialog v-model="confirmOpen" max-width="460">
      <v-card :title="t('warehouse.manifests.confirm_title')">
        <v-card-text>{{ t("warehouse.manifests.confirm_body", { n: ids.length }) }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="confirmOpen = false">{{ t("warehouse.common.cancel") }}</v-btn>
          <v-btn color="primary" variant="flat" :loading="busy" @click="generate">{{
            t("warehouse.manifests.confirm_yes")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.wh-page {
  padding: 24px;
  max-width: 900px;
}
</style>
