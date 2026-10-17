<template>
  <section class="mt-8">
    <div class="d-flex align-center ga-2 mb-2">
      <v-icon icon="mdi-calendar-range" size="18" />
      <span class="text-subtitle-2">{{ t("invoicing.numbering.ranges.title") }}</span>
      <v-spacer />
      <v-btn
        v-if="canAdmin"
        size="small"
        color="primary"
        variant="tonal"
        prepend-icon="mdi-plus"
        :disabled="engines.length === 0"
        @click="openCreate()"
      >
        {{ t("invoicing.numbering.ranges.new") }}
      </v-btn>
    </div>
    <p class="text-caption text-medium-emphasis mb-3">
      {{ t("invoicing.numbering.ranges.intro") }}
    </p>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-2" />
    <v-alert v-if="loadError" type="error" variant="tonal" density="compact" class="mb-3">
      {{ loadError }}
    </v-alert>
    <div
      v-if="!loading && !loadError && engines.length === 0"
      class="text-body-2 text-medium-emphasis"
    >
      {{ t("invoicing.numbering.ranges.empty") }}
    </div>

    <v-card v-for="e in engines" :key="e.id" variant="outlined" class="mb-3">
      <div class="d-flex align-center ga-2 pa-3">
        <div>
          <div class="font-weight-medium">{{ e.label }}</div>
          <div class="text-caption text-medium-emphasis">{{ e.codice }}</div>
        </div>
        <v-spacer />
        <v-btn size="small" variant="text" prepend-icon="mdi-eye-outline" @click="openNext(e)">
          {{ t("invoicing.numbering.ranges.next_number") }}
        </v-btn>
      </div>
      <div
        v-if="(e.rangos ?? []).length === 0"
        class="px-3 pb-3 text-caption text-medium-emphasis"
      >
        {{ t("invoicing.numbering.ranges.none") }}
      </div>
      <v-table v-else density="compact">
        <thead>
          <tr>
            <th>{{ t("invoicing.numbering.ranges.valid_from") }}</th>
            <th>{{ t("invoicing.numbering.ranges.valid_to") }}</th>
            <th>{{ t("invoicing.numbering.field.formato") }}</th>
            <th>{{ t("invoicing.numbering.ranges.from_number") }}</th>
            <th>{{ t("invoicing.numbering.field.reinicio") }}</th>
            <th>{{ t("invoicing.numbering.ranges.status") }}</th>
            <th v-if="canAdmin" style="width: 60px" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in e.rangos" :key="r.id">
            <td>{{ r.data_inizio }}</td>
            <td>{{ isOpenRange(r) ? "—" : r.data_fine }}</td>
            <td><code>{{ r.formato }}</code></td>
            <td>
              <code>{{ r.primer_numero ?? r.valore_iniziale }}</code>
            </td>
            <td>{{ reinicioLabel(r.reinicio) }}</td>
            <td>
              <v-chip
                size="x-small"
                variant="tonal"
                :color="isOpenRange(r) ? 'success' : 'default'"
              >
                {{
                  isOpenRange(r)
                    ? t("invoicing.numbering.ranges.open")
                    : t("invoicing.numbering.ranges.closed")
                }}
              </v-chip>
            </td>
            <td v-if="canAdmin">
              <v-btn
                v-if="isOpenRange(r)"
                icon="mdi-lock-outline"
                size="x-small"
                variant="text"
                color="error"
                :title="t('invoicing.numbering.ranges.close')"
                @click="openClose(e, r)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- Alta de rango: primero vista previa, luego confirmación. -->
    <v-dialog v-model="createOpen" max-width="560">
      <v-card>
        <v-card-title class="text-subtitle-1">{{
          t("invoicing.numbering.ranges.new")
        }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="form.id_engine"
            :items="engines"
            item-title="label"
            item-value="id"
            :label="t('invoicing.numbering.field.engine')"
            density="comfortable"
            @update:model-value="draftPreview = null"
          />
          <v-text-field
            v-model="form.formato"
            :label="t('invoicing.numbering.field.formato')"
            :hint="t('invoicing.numbering.ranges.formato_hint')"
            persistent-hint
            density="comfortable"
            class="mb-2"
            @update:model-value="draftPreview = null"
          />
          <div class="d-flex ga-3">
            <v-text-field
              v-model="form.data_inizio"
              type="date"
              :label="t('invoicing.numbering.ranges.valid_from')"
              density="comfortable"
              @update:model-value="draftPreview = null"
            />
            <v-text-field
              v-model="form.data_fine"
              type="date"
              :label="t('invoicing.numbering.ranges.valid_to')"
              :hint="t('invoicing.numbering.ranges.valid_to_hint')"
              persistent-hint
              density="comfortable"
              @update:model-value="draftPreview = null"
            />
          </div>
          <div class="d-flex ga-3 mt-2">
            <v-select
              v-model="form.reinicio"
              :items="reinicioOptions"
              item-title="label"
              item-value="value"
              :label="t('invoicing.numbering.field.reinicio')"
              density="comfortable"
              @update:model-value="draftPreview = null"
            />
            <v-text-field
              v-model.number="form.valore_iniziale"
              type="number"
              min="1"
              :label="t('invoicing.numbering.ranges.from_number')"
              density="comfortable"
              @update:model-value="draftPreview = null"
            />
          </div>
          <v-text-field
            v-model="form.motivo"
            :label="t('invoicing.numbering.ranges.reason')"
            :hint="t('invoicing.numbering.ranges.reason_hint')"
            persistent-hint
            density="comfortable"
          />

          <v-alert
            v-if="draftPreview"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            <div class="font-weight-medium">
              {{ t("invoicing.numbering.ranges.preview_first") }}:
              <code>{{ draftPreview.preview?.primer_numero }}</code>
            </div>
            <div v-for="(a, i) in draftPreview.avisos ?? []" :key="i" class="text-caption">
              {{ a }}
            </div>
            <div class="text-caption mt-1">
              {{ t("invoicing.numbering.ranges.preview_confirm") }}
            </div>
          </v-alert>
          <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mt-3">
            {{ formError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="createOpen = false">{{ t("common.cancel") }}</v-btn>
          <v-btn
            v-if="!draftPreview"
            color="primary"
            variant="flat"
            :loading="saving"
            :disabled="!formValid"
            @click="submitCreate(false)"
          >
            {{ t("invoicing.numbering.ranges.check") }}
          </v-btn>
          <v-btn
            v-else
            color="primary"
            variant="flat"
            :loading="saving"
            @click="submitCreate(true)"
          >
            {{ t("invoicing.numbering.ranges.confirm_save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Cierre: irreversible. -->
    <v-dialog v-model="closeOpen" max-width="480">
      <v-card>
        <v-card-title class="text-subtitle-1">{{
          t("invoicing.numbering.ranges.close")
        }}</v-card-title>
        <v-card-text>
          <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
            {{ t("invoicing.numbering.ranges.close_warning") }}
          </v-alert>
          <v-text-field
            v-model="closeForm.data_fine"
            type="date"
            :label="t('invoicing.numbering.ranges.valid_to')"
            density="comfortable"
          />
          <v-text-field
            v-model="closeForm.motivo"
            :label="t('invoicing.numbering.ranges.reason')"
            density="comfortable"
          />
          <v-alert v-if="closeError" type="error" variant="tonal" density="compact">
            {{ closeError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeOpen = false">{{ t("common.cancel") }}</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="saving"
            :disabled="!closeForm.data_fine || !closeForm.motivo.trim()"
            @click="submitClose"
          >
            {{ t("invoicing.numbering.ranges.close_confirm") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Próximo número (orientativo). -->
    <v-dialog v-model="nextOpen" max-width="420">
      <v-card>
        <v-card-title class="text-subtitle-1">{{
          t("invoicing.numbering.ranges.next_number")
        }}</v-card-title>
        <v-card-text>
          <v-progress-circular v-if="nextLoading" indeterminate size="20" width="2" />
          <v-alert v-else-if="nextError" type="error" variant="tonal" density="compact">
            {{ nextError }}
          </v-alert>
          <template v-else-if="nextData">
            <ul class="pl-4">
              <li v-for="(n, i) in nextData.siguientes" :key="i">
                <code>{{ n.numero_completo }}</code>
              </li>
            </ul>
            <p class="text-caption text-medium-emphasis mt-2">
              {{ t("invoicing.numbering.preview_orientative") }}
            </p>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="nextOpen = false">{{ t("common.close") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import {
  isOpenRange,
  numberingRangesService,
  type NextNumberPreview,
  type NumberingRange,
  type RangeEngine,
  type RangeReinicio,
  type RangeSaveResult,
} from "../../services/numberingRanges.service";
import { useToastStore } from "../../stores/toast.store";

defineProps<{ canAdmin: boolean }>();

const { t } = useI18n();
const toasts = useToastStore();

const engines = ref<RangeEngine[]>([]);
const loading = ref(false);
const loadError = ref("");
const saving = ref(false);

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = "";
  try {
    engines.value = await numberingRangesService.list();
  } catch (e) {
    loadError.value = msg(e);
  } finally {
    loading.value = false;
  }
}

const reinicioOptions = computed(() =>
  (["NUNCA", "ANUAL", "MENSUAL"] as RangeReinicio[]).map((value) => ({
    value,
    label: reinicioLabel(value),
  })),
);

function reinicioLabel(v: string): string {
  const key = String(v).toLowerCase();
  return ["anual", "mensual", "nunca"].includes(key)
    ? t(`invoicing.numbering.reinicio.${key}`)
    : String(v);
}

// --- Alta ---------------------------------------------------------------
const createOpen = ref(false);
const formError = ref("");
const draftPreview = ref<RangeSaveResult | null>(null);
const form = reactive({
  id_engine: 0,
  formato: "",
  data_inizio: "",
  data_fine: "",
  reinicio: "NUNCA" as RangeReinicio,
  valore_iniziale: 1,
  motivo: "",
});

const formValid = computed(
  () =>
    form.id_engine > 0 &&
    form.formato.includes("{n") &&
    !!form.data_inizio &&
    !!form.motivo.trim(),
);

function openCreate(engine?: RangeEngine): void {
  const e = engine ?? engines.value[0];
  Object.assign(form, {
    id_engine: e?.id ?? 0,
    formato: "",
    data_inizio: "",
    data_fine: "",
    reinicio: "NUNCA",
    valore_iniziale: 1,
    motivo: "",
  });
  formError.value = "";
  draftPreview.value = null;
  createOpen.value = true;
}

async function submitCreate(confirmar: boolean): Promise<void> {
  saving.value = true;
  formError.value = "";
  try {
    const res = await numberingRangesService.create({ ...form }, confirmar);
    if (res.guardado) {
      toasts.push("success", t("invoicing.numbering.ranges.created"));
      createOpen.value = false;
      await load();
    } else {
      draftPreview.value = res;
    }
  } catch (e) {
    formError.value = msg(e);
    draftPreview.value = null;
  } finally {
    saving.value = false;
  }
}

// --- Cierre -------------------------------------------------------------
const closeOpen = ref(false);
const closeError = ref("");
const closing = ref<{ engine: RangeEngine; range: NumberingRange } | null>(null);
const closeForm = reactive({ data_fine: "", motivo: "" });

function openClose(engine: RangeEngine, range: NumberingRange): void {
  closing.value = { engine, range };
  closeForm.data_fine = "";
  closeForm.motivo = "";
  closeError.value = "";
  closeOpen.value = true;
}

async function submitClose(): Promise<void> {
  if (!closing.value) return;
  saving.value = true;
  closeError.value = "";
  try {
    await numberingRangesService.close(
      closing.value.engine.id,
      closing.value.range.id,
      closeForm.data_fine,
      closeForm.motivo,
    );
    toasts.push("success", t("invoicing.numbering.ranges.closed_ok"));
    closeOpen.value = false;
    await load();
  } catch (e) {
    closeError.value = msg(e);
  } finally {
    saving.value = false;
  }
}

// --- Próximo número -----------------------------------------------------
const nextOpen = ref(false);
const nextLoading = ref(false);
const nextError = ref("");
const nextData = ref<NextNumberPreview | null>(null);

async function openNext(engine: RangeEngine): Promise<void> {
  nextOpen.value = true;
  nextLoading.value = true;
  nextError.value = "";
  nextData.value = null;
  try {
    nextData.value = await numberingRangesService.preview(engine.id);
  } catch (e) {
    nextError.value = msg(e);
  } finally {
    nextLoading.value = false;
  }
}

onMounted(() => void load());
defineExpose({ reload: load });
</script>
