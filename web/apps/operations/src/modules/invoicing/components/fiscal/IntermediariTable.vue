<template>
  <div>
    <div class="d-flex align-center mb-2">
      <div class="text-subtitle-1 font-weight-medium">
        {{ t("invoicing.fiscal.tabla.intermediari") }}
      </div>
      <v-spacer />
      <v-btn
        variant="text"
        icon="mdi-refresh"
        size="small"
        :title="t('common.refresh')"
        :loading="loading"
        @click="load"
      />
    </div>
    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mb-2 text-body-2"
    >
      {{ t("invoicing.fiscal.intermediari.intro") }}
    </v-alert>

    <v-data-table
      :headers="headers"
      :items="rows"
      :loading="loading"
      density="compact"
      hide-default-footer
    >
      <template #[`item.modo`]="{ item }">
        <v-chip
          size="x-small"
          variant="flat"
          :color="item.modo === 'PROD' ? 'success' : 'warning'"
        >
          {{ item.modo }}
        </v-chip>
      </template>
      <template #[`item.vigencia`]="{ item }">
        <span class="text-no-wrap">
          {{ item.data_inizio }} →
          {{ item.data_fine ?? t("invoicing.fiscal.open") }}
        </span>
      </template>
      <template #[`item.actions`]="{ item }">
        <v-btn
          v-if="store.canWrite"
          size="x-small"
          variant="tonal"
          prepend-icon="mdi-swap-horizontal"
          @click="openModo(item)"
        >
          {{ t("invoicing.fiscal.intermediari.change_mode") }}
        </v-btn>
      </template>
    </v-data-table>

    <v-dialog v-model="modoOpen" max-width="480">
      <v-card v-if="selected">
        <v-card-title class="text-subtitle-1">
          {{
            t("invoicing.fiscal.intermediari.mode_title", {
              codigo: String(selected.codice ?? ""),
            })
          }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">
            {{ t("invoicing.fiscal.intermediari.mode_intro") }}
          </p>
          <v-btn-toggle
            v-model="modo"
            mandatory
            divided
            variant="outlined"
            class="mb-3"
          >
            <v-btn v-for="m in modos" :key="m" :value="m">{{ m }}</v-btn>
          </v-btn-toggle>
          <v-text-field
            v-model="motivo"
            :label="t('invoicing.fiscal.motivo') + ' *'"
            :hint="t('invoicing.fiscal.motivo_hint')"
            persistent-hint
            density="compact"
          />
          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            {{ errorMessage }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="modoOpen = false">
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="busy"
            :disabled="!motivo.trim() || modo === selected.modo"
            @click="saveModo"
          >
            {{ t("common.save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fiscConfigService,
  type FiscRow,
} from "../../services/fiscConfig.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import { useToastStore } from "../../stores/toast.store";

const emit = defineEmits<{ (e: "changed"): void }>();

const { t } = useI18n();
const store = useFiscConfigStore();
const toasts = useToastStore();

const rows = ref<FiscRow[]>([]);
const loading = ref(false);
const modoOpen = ref(false);
const selected = ref<FiscRow | null>(null);
const modos = ["TEST", "PROD"] as const;
const modo = ref<"TEST" | "PROD">("TEST");
const motivo = ref("");
const busy = ref(false);
const errorMessage = ref("");

const headers = computed(() => [
  ...["codice", "adaptador", "tipos_canal", "capacidades", "modo"].map(
    (key) => ({
      title: t(`invoicing.fiscal.field.${key}`),
      key,
    }),
  ),
  { title: t("invoicing.fiscal.vigencia"), key: "vigencia", sortable: false },
  {
    title: t("common.actions"),
    key: "actions",
    sortable: false,
    align: "end" as const,
  },
]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await fiscConfigService.list("intermediari");
  } catch (e) {
    toasts.push("error", toUserMessage(e, String(e)));
  } finally {
    loading.value = false;
  }
}

function openModo(row: FiscRow): void {
  selected.value = row;
  modo.value = row.modo === "PROD" ? "TEST" : "PROD";
  motivo.value = "";
  errorMessage.value = "";
  modoOpen.value = true;
}

async function saveModo(): Promise<void> {
  if (!selected.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    await fiscConfigService.setIntermediarioModo(
      Number(selected.value.id),
      modo.value,
      motivo.value,
    );
    modoOpen.value = false;
    toasts.push("success", t("invoicing.fiscal.toast.saved"));
    await load();
    emit("changed");
  } catch (e) {
    errorMessage.value = toUserMessage(e, String(e));
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>
