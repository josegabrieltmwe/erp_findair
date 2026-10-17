<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError } from "@tmwe/shared-frontend/http";
import { can } from "../env";
import {
  createScanGuard,
  validateWeighing,
  type WeighField,
  type WeighMode,
} from "../logic";
import { errMsg } from "../print";
import { warehouseApi } from "../services/warehouse.service";
import { useToastStore } from "../stores/toast.store";
import type { ValidationResult } from "../types";

const { t } = useI18n();
const toast = useToastStore();
const canWrite = can.write();

interface Done {
  sticker: string;
  kg: number;
  mode: WeighMode;
  orphan: boolean;
  at: string;
}

const scanInput = ref<{ focus: () => void } | null>(null);
const code = ref("");
const mode = ref<WeighMode>("parcel");
const kg = ref("");
const width = ref("");
const length = ref("");
const height = ref("");
const found = ref<ValidationResult | null>(null);
const busy = ref(false);
const errors = ref<WeighField[]>([]);
const done = ref<Done[]>([]);
const guard = createScanGuard();

const isOrphanOffer = computed(
  () => !!found.value && !found.value.found,
);

function focusScan(): void {
  void nextTick(() => scanInput.value?.focus());
}

function resetForm(): void {
  code.value = "";
  kg.value = "";
  width.value = "";
  length.value = "";
  height.value = "";
  found.value = null;
  errors.value = [];
  focusScan();
}

async function scan(): Promise<void> {
  const c = guard.accept(code.value);
  if (!c) return;
  code.value = c;
  busy.value = true;
  try {
    found.value = await warehouseApi.lookup(c);
    const p = found.value.parcel;
    if (found.value.found && p) {
      if (p.peso) kg.value = String(p.peso);
      if (p.dim_a) width.value = String(p.dim_a);
      if (p.dim_l) length.value = String(p.dim_l);
      if (p.dim_p) height.value = String(p.dim_p);
    }
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  } finally {
    busy.value = false;
  }
}

async function save(): Promise<void> {
  if (!canWrite || !found.value) return;
  const v = validateWeighing({
    mode: mode.value,
    kg: kg.value,
    width: width.value,
    length: length.value,
    height: height.value,
  });
  errors.value = v.errors;
  if (!v.ok || !v.values) return;
  busy.value = true;
  try {
    const orphanNew = isOrphanOffer.value;
    if (orphanNew) {
      await warehouseApi.registerOrphan(code.value, v.values);
    } else if (found.value.source === "spedizioni_colli" && found.value.parcel) {
      if (mode.value === "document") {
        await warehouseApi.weighDocument(found.value.parcel.id, v.values);
      } else {
        await warehouseApi.weighParcel(found.value.parcel.id, v.values);
      }
    } else {
      toast.push("warning", t("warehouse.weighing.orphan_already"));
      return;
    }
    done.value.unshift({
      sticker: code.value,
      kg: v.values.peso,
      mode: mode.value,
      orphan: orphanNew,
      at: new Date().toLocaleTimeString(),
    });
    toast.push("success", t("warehouse.weighing.saved"));
    resetForm();
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      toast.push("warning", t("warehouse.weighing.duplicate"));
    } else {
      toast.push("error", errMsg(e, t("warehouse.common.save_failed")));
    }
  } finally {
    busy.value = false;
  }
}

onMounted(focusScan);
</script>

<template>
  <div class="wh-page">
    <h1 class="text-h6 mb-4">{{ t("warehouse.weighing.title") }}</h1>
    <v-alert
      v-if="!canWrite"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ t("warehouse.common.read_only") }}
    </v-alert>

    <v-text-field
      ref="scanInput"
      v-model="code"
      :label="t('warehouse.weighing.marker')"
      :hint="t('warehouse.weighing.marker_hint')"
      persistent-hint
      autofocus
      variant="outlined"
      prepend-inner-icon="mdi-barcode-scan"
      :loading="busy"
      class="mb-3"
      @keyup.enter="scan"
    />

    <v-btn-toggle v-model="mode" mandatory divided class="mb-4">
      <v-btn value="parcel">{{ t("warehouse.weighing.parcel") }}</v-btn>
      <v-btn value="document">{{ t("warehouse.weighing.document") }}</v-btn>
    </v-btn-toggle>

    <v-card v-if="found" variant="outlined" class="mb-4">
      <v-card-text>
        <v-alert
          v-if="found.found"
          type="success"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{
            found.source === "orphan"
              ? t("warehouse.weighing.found_orphan")
              : t("warehouse.weighing.found", {
                  shipment: found.parcel?.id_spedizione ?? "-",
                  n: found.parcel?.n_collo ?? "-",
                })
          }}
        </v-alert>
        <v-alert
          v-else
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ t("warehouse.weighing.not_found") }}
        </v-alert>

        <v-row dense>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="kg"
              :label="t('warehouse.weighing.kg')"
              inputmode="decimal"
              variant="outlined"
              density="comfortable"
              :error="errors.includes('kg')"
              :disabled="!canWrite"
              @keyup.enter="save"
            />
          </v-col>
          <template v-if="mode === 'parcel'">
            <v-col cols="4" sm="3">
              <v-text-field
                v-model="width"
                :label="t('warehouse.weighing.width')"
                inputmode="decimal"
                variant="outlined"
                density="comfortable"
                :error="errors.includes('width')"
                :disabled="!canWrite"
                @keyup.enter="save"
              />
            </v-col>
            <v-col cols="4" sm="3">
              <v-text-field
                v-model="length"
                :label="t('warehouse.weighing.length')"
                inputmode="decimal"
                variant="outlined"
                density="comfortable"
                :error="errors.includes('length')"
                :disabled="!canWrite"
                @keyup.enter="save"
              />
            </v-col>
            <v-col cols="4" sm="3">
              <v-text-field
                v-model="height"
                :label="t('warehouse.weighing.height')"
                inputmode="decimal"
                variant="outlined"
                density="comfortable"
                :error="errors.includes('height')"
                :disabled="!canWrite"
                @keyup.enter="save"
              />
            </v-col>
          </template>
        </v-row>
        <div v-if="errors.length" class="text-error text-caption mb-2">
          {{ t("warehouse.weighing.invalid") }}
        </div>
        <div class="d-flex ga-2">
          <v-btn
            color="primary"
            :loading="busy"
            :disabled="!canWrite"
            @click="save"
          >
            {{
              isOrphanOffer
                ? t("warehouse.weighing.register_orphan")
                : t("warehouse.weighing.save")
            }}
          </v-btn>
          <v-btn variant="text" @click="resetForm">{{
            t("warehouse.common.cancel")
          }}</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <h2 class="text-subtitle-1 mb-2">{{ t("warehouse.weighing.recent") }}</h2>
    <div v-if="!done.length" class="text-medium-emphasis">
      {{ t("warehouse.weighing.recent_empty") }}
    </div>
    <v-table v-else density="compact">
      <tbody>
        <tr v-for="(d, i) in done" :key="i">
          <td>{{ d.at }}</td>
          <td>{{ d.sticker }}</td>
          <td>{{ d.kg }} kg</td>
          <td>
            {{
              d.mode === "document"
                ? t("warehouse.weighing.document")
                : t("warehouse.weighing.parcel")
            }}
          </td>
          <td v-if="d.orphan">
            <v-chip size="x-small" color="warning">{{
              t("warehouse.weighing.orphan_tag")
            }}</v-chip>
          </td>
          <td v-else />
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<style scoped>
.wh-page {
  padding: 24px;
  max-width: 760px;
}
</style>
