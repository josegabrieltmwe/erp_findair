<template>
  <div>
    <div class="fisc-filters mb-3">
      <v-select
        v-model="tipo"
        :items="store.enumOf('alertas', 'tipo')"
        :label="t('invoicing.fiscal.alertas.tipo')"
        density="compact"
        hide-details
        clearable
        @update:model-value="load"
      />
      <v-select
        v-model="severidad"
        :items="severidades"
        item-title="title"
        item-value="value"
        :label="t('invoicing.fiscal.alertas.severidad')"
        density="compact"
        hide-details
        clearable
        @update:model-value="load"
      />
      <v-text-field
        v-if="store.esTmwe"
        v-model="partner"
        type="number"
        :label="t('invoicing.fiscal.filters.partner')"
        density="compact"
        hide-details
        clearable
        @keyup.enter="load"
        @click:clear="load"
      />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="load"
      >
        {{ t("common.refresh") }}
      </v-btn>
    </div>

    <v-data-table
      :headers="headers"
      :items="rows"
      :loading="loading"
      density="compact"
      :items-per-page="50"
    >
      <template #[`item.severidad`]="{ item }">
        <v-chip size="x-small" variant="flat" :color="sevColor(item.severidad)">
          {{ t(`invoicing.fiscal.alertas.sev.${item.severidad}`) }}
        </v-chip>
      </template>
      <template #[`item.mensaje`]="{ item }">
        <span class="fisc-msg">{{ item.mensaje }}</span>
      </template>
      <template #[`item.actions`]="{ item }">
        <v-btn
          v-if="store.canWrite"
          size="x-small"
          variant="tonal"
          prepend-icon="mdi-check"
          @click="openClose(item)"
        >
          {{ t("invoicing.fiscal.alertas.close") }}
        </v-btn>
      </template>
      <template #no-data>
        <div class="text-medium-emphasis py-6">
          {{ t("invoicing.fiscal.alertas.empty") }}
        </div>
      </template>
    </v-data-table>

    <v-dialog v-model="closeOpen" max-width="480">
      <v-card v-if="selected">
        <v-card-title class="text-subtitle-1">
          {{ t("invoicing.fiscal.alertas.close_title", { id: selected.id }) }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">{{ selected.mensaje }}</p>
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3 text-body-2"
          >
            {{ t("invoicing.fiscal.alertas.close_intro") }}
          </v-alert>
          <v-text-field
            v-model="motivo"
            :label="t('invoicing.fiscal.motivo') + ' *'"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="busy"
            :disabled="!motivo.trim()"
            @click="confirmClose"
          >
            {{ t("invoicing.fiscal.alertas.close") }}
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
  type FiscAlerta,
} from "../../services/fiscConfig.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import { useToastStore } from "../../stores/toast.store";

const emit = defineEmits<{ (e: "count", n: number): void }>();

const { t } = useI18n();
const store = useFiscConfigStore();
const toasts = useToastStore();

const rows = ref<FiscAlerta[]>([]);
const loading = ref(false);
const tipo = ref<string | null>(null);
const severidad = ref<string | null>(null);
const partner = ref<string | null>(null);
const closeOpen = ref(false);
const selected = ref<FiscAlerta | null>(null);
const motivo = ref("");
const busy = ref(false);

const severidades = computed(() =>
  ["CRITICA", "ALTA", "MEDIA"].map((v) => ({
    value: v,
    title: t(`invoicing.fiscal.alertas.sev.${v}`),
  })),
);

const headers = computed(() => [
  { title: t("invoicing.fiscal.alertas.severidad"), key: "severidad" },
  { title: t("invoicing.fiscal.alertas.tipo"), key: "tipo" },
  { title: t("invoicing.fiscal.field.id_partner"), key: "id_partner" },
  {
    title: t("invoicing.fiscal.alertas.mensaje"),
    key: "mensaje",
    sortable: false,
  },
  { title: t("invoicing.fiscal.alertas.creada"), key: "creada" },
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
    rows.value = await fiscConfigService.alertas({
      tipo: tipo.value ?? undefined,
      severidad: severidad.value ?? undefined,
      partner: partner.value ? Number(partner.value) : null,
    });
    emit("count", rows.value.length);
  } catch (e) {
    toasts.push("error", toUserMessage(e, String(e)));
  } finally {
    loading.value = false;
  }
}

function openClose(a: FiscAlerta): void {
  selected.value = a;
  motivo.value = "";
  closeOpen.value = true;
}

async function confirmClose(): Promise<void> {
  if (!selected.value) return;
  busy.value = true;
  try {
    await fiscConfigService.closeAlert(selected.value.id, motivo.value);
    closeOpen.value = false;
    toasts.push("success", t("invoicing.fiscal.toast.saved"));
    await load();
  } catch (e) {
    toasts.push("error", toUserMessage(e, String(e)));
  } finally {
    busy.value = false;
  }
}

function sevColor(s: string): string {
  return s === "CRITICA" ? "error" : s === "ALTA" ? "warning" : "info";
}

onMounted(() => {
  void load();
});
</script>

<style scoped>
.fisc-filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  align-items: center;
}

.fisc-msg {
  white-space: normal;
}
</style>
