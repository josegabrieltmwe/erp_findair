<template>
  <component :is="wrapper" v-bind="wrapperProps">
    <v-card-title
      v-if="!embedded"
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-passport" size="18" class="me-2" />
      {{ t("cargo.customs.title") }}
      <v-chip
        v-if="active"
        size="x-small"
        color="info"
        variant="tonal"
        class="ms-2"
      >
        {{ imp.local }} {{ valuta.local }}
      </v-chip>
    </v-card-title>
    <v-divider v-if="!embedded" />
    <component :is="textWrapper">
      <!-- ── Datos comunes de aduana ─────────────────────────────────── -->
      <v-row dense>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model="imp.local"
            :label="t('cargo.customs.declared_value')"
            type="number"
            min="0"
            step="0.01"
            density="compact"
            :readonly="readonly('dogana_imp')"
            @blur="imp.commit"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-autocomplete
            v-model="valuta.local"
            :label="t('cargo.customs.currency_iso')"
            :items="currencyItems"
            :loading="currencyLoading"
            auto-select-first
            density="compact"
            :readonly="readonly('id_valuta_dogana')"
            @update:model-value="valuta.commit"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="dazi.local"
            :items="daziOptions"
            :label="t('cargo.customsistr.cargo_duties')"
            density="compact"
            :readonly="readonly('cargo_dazi')"
            @update:model-value="dazi.commit"
          />
        </v-col>
        <v-col cols="12">
          <v-textarea
            v-model="descri.local"
            :label="t('cargo.customs.customs_description')"
            rows="2"
            auto-grow
            density="compact"
            :readonly="readonly('dogana_descri')"
            @blur="descri.commit"
          />
        </v-col>
      </v-row>

      <!-- ── EXPORT ──────────────────────────────────────────────────── -->
      <div class="cust-block">
        <div class="cust-block__head">
          <v-icon icon="mdi-airplane-takeoff" size="16" />
          <span>{{ t("cargo.customs.export") }}</span>
        </div>
        <v-row dense align="center">
          <v-col cols="12" sm="3">
            <v-checkbox
              v-model="accExport"
              :label="t('cargo.customs.required')"
              density="compact"
              hide-details
              :disabled="customsStore.customsReadonly"
              @update:model-value="commitAccExport"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-autocomplete
              v-model="agExportModel"
              :items="customsStore.exportAgencies"
              item-title="nome"
              item-value="id"
              :label="
                customsStore.isoFrom
                  ? t('cargo.customs.export_agency_iso', {
                      iso: customsStore.isoFrom,
                    })
                  : t('cargo.customs.export_agency')
              "
              :loading="customsStore.loadingBox"
              :readonly="customsStore.customsReadonly"
              variant="plain"
              density="compact"
              hide-details
              clearable
            />
          </v-col>
          <v-col cols="12" sm="5">
            <v-text-field
              v-model="exportMail.local"
              :label="t('cargo.customs.email_broker')"
              type="email"
              variant="plain"
              density="compact"
              hide-details
              prepend-inner-icon="mdi-email-outline"
              :readonly="customsStore.customsReadonly"
              @blur="exportMail.commit"
            />
          </v-col>
          <v-col cols="12" sm="7">
            <v-checkbox
              v-model="sdoganamE"
              :label="t('cargo.customs.clearance_ok')"
              density="compact"
              hide-details
              color="success"
              :disabled="customsStore.customsReadonly"
              @update:model-value="(v) => commitSdoganam('sdoganam_E', v)"
            />
          </v-col>
          <v-col cols="12" sm="5" class="d-flex justify-end">
            <v-btn
              size="small"
              color="primary"
              variant="flat"
              rounded="lg"
              prepend-icon="mdi-email-fast-outline"
              class="cust-notify-btn text-none"
              :disabled="!exportMail.local && !agExport.local"
              @click="notifyAgency"
            >
              {{ t("cargo.customs.notify_agency") }}
            </v-btn>
          </v-col>
          <v-col
            v-if="exportTs"
            cols="12"
            class="text-caption text-medium-emphasis"
          >
            <v-icon icon="mdi-email-check-outline" size="13" />
            {{ t("cargo.customsistr.export_mail", { ts: exportTs }) }}
          </v-col>
        </v-row>
      </div>

      <!-- ── IMPORT ──────────────────────────────────────────────────── -->
      <div class="cust-block">
        <div class="cust-block__head">
          <v-icon icon="mdi-airplane-landing" size="16" />
          <span>{{ t("cargo.customs.import") }}</span>
        </div>
        <v-row dense align="center">
          <v-col cols="12" sm="3">
            <v-checkbox
              v-model="accImport"
              :label="t('cargo.customs.required')"
              density="compact"
              hide-details
              :disabled="customsStore.customsReadonly"
              @update:model-value="commitAccImport"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-autocomplete
              v-model="agImportModel"
              :items="customsStore.importAgencies"
              item-title="nome"
              item-value="id"
              :label="
                customsStore.isoDest
                  ? t('cargo.customs.import_agency_iso', {
                      iso: customsStore.isoDest,
                    })
                  : t('cargo.customs.import_agency')
              "
              :loading="customsStore.loadingBox"
              :readonly="customsStore.customsReadonly"
              variant="plain"
              density="compact"
              hide-details
              clearable
            />
          </v-col>
          <v-col cols="12" sm="5">
            <v-text-field
              v-model="importMail.local"
              :label="t('cargo.customs.email_additional')"
              type="email"
              variant="plain"
              density="compact"
              hide-details
              prepend-inner-icon="mdi-email-outline"
              :readonly="customsStore.customsReadonly"
              @blur="importMail.commit"
            />
          </v-col>
          <v-col cols="12" sm="7">
            <v-checkbox
              v-model="sdoganamI"
              :label="t('cargo.customs.declaration_ok')"
              density="compact"
              hide-details
              color="success"
              :disabled="customsStore.customsReadonly"
              @update:model-value="(v) => commitSdoganam('sdoganam_I', v)"
            />
          </v-col>
          <v-col cols="12" sm="5" class="d-flex justify-end">
            <v-btn
              size="small"
              color="primary"
              variant="flat"
              rounded="lg"
              prepend-icon="mdi-email-fast-outline"
              class="cust-notify-btn text-none"
              :disabled="!importMail.local && !agImport.local"
              @click="notifyAgency"
            >
              {{ t("cargo.customs.notify_agency") }}
            </v-btn>
          </v-col>
          <v-col
            v-if="importTs"
            cols="12"
            class="text-caption text-medium-emphasis"
          >
            <v-icon icon="mdi-email-check-outline" size="13" />
            {{ t("cargo.customsistr.import_mail", { ts: importTs }) }}
          </v-col>
        </v-row>
      </div>

      <!-- ── Instrucciones de aduana ─────────────────────────────────── -->
      <v-textarea
        v-model="istruz.local"
        :label="t('cargo.customsistr.instructions')"
        rows="2"
        auto-grow
        density="compact"
        class="mt-2"
        :readonly="readonly('sdoganam_istruz')"
        @blur="istruz.commit"
      />

      <v-alert
        v-if="customsStore.customsReadonly"
        type="info"
        variant="tonal"
        density="compact"
        class="mt-2"
      >
        {{ t("cargo.customs.readonly_invoiced") }}
      </v-alert>
    </component>
  </component>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoState } from "@cargo/composables/useCargoState";
import { useFieldBinding } from "@cargo/composables/useFieldBinding";
import { useCustomsStore } from "@cargo/stores/customs.store";
import { currencyService } from "@cargo/services/currency.service";
import { VCard, VCardText } from "vuetify/components";

const { t } = useI18n();
const props = defineProps<{ embedded?: boolean }>();
const store = useCargoStore();
const ui = useUiStore();
const { cargo } = storeToRefs(store);
const { readonly } = useCargoState(cargo);

// Comunes
const imp = useFieldBinding("dogana_imp", "0");
const valuta = useFieldBinding("id_valuta_dogana", "EUR");
const descri = useFieldBinding("dogana_descri", "");
const dazi = useFieldBinding("cargo_dazi", "");
const istruz = useFieldBinding("sdoganam_istruz", "");
// Agencias + emails de broker (ahora EDITABLES — antes solo lectura).
const agExport = useFieldBinding("id_ag_export", "0");
const agImport = useFieldBinding("id_ag_import", "0");
const exportMail = useFieldBinding("export_ag_mail", "");
const importMail = useFieldBinding("import_ag_mail", "");

// El autocomplete de agencia NO debe mostrar "0" (=sin agencia) como valor
// seleccionado. Se expone un modelo que traduce 0/""/null → null (placeholder)
// y de vuelta null → "0" al persistir (columna int, 0 = ninguna).
function agencyModel(binding: { local: unknown; commit: () => Promise<void> }) {
  return computed<number | null>({
    get: () => {
      const n = Number(binding.local ?? 0);
      return Number.isFinite(n) && n > 0 ? n : null;
    },
    set: (v) => {
      binding.local = v == null ? "0" : String(v);
      void binding.commit();
    },
  });
}
const agExportModel = agencyModel(agExport);
const agImportModel = agencyModel(agImport);
const active = computed(() => Number(imp.local) > 0);

const daziOptions = [
  { title: "—", value: "" },
  { title: "DDP", value: "DDP" },
  { title: "DDU", value: "DDU" },
  { title: "DAP", value: "DAP" },
  { title: "EXW", value: "EXW" },
  { title: "FCA", value: "FCA" },
];

// Monedas ISO para el autocomplete (mismo origen que CargoInsuranceBox:
// tabla de tasas del día api_currency_day). id_valuta_dogana se guarda como
// sigla ISO cruda (paridad legacy, sin conversión de importe).
const currencyItems = ref<string[]>(["EUR"]);
const currencyLoading = ref(false);
onMounted(async () => {
  currencyLoading.value = true;
  try {
    const day = await currencyService.getDayRates();
    const sigle =
      day?.success && day.data ? day.data.rates.map((r) => r.sigla) : [];
    currencyItems.value = Array.from(
      new Set(["EUR", ...sigle.filter((s) => s && s !== "EUR")]),
    );
  } catch {
    currencyItems.value = ["EUR"];
  } finally {
    currencyLoading.value = false;
  }
});

// Flags enum S/N: acc_export/import (Required) + sdoganam_E/I (Clearance OK).
const accExport = ref(false);
const accImport = ref(false);
const sdoganamE = ref(false);
const sdoganamI = ref(false);
watch(
  cargo,
  (s) => {
    accExport.value = s?.acc_export === "S";
    accImport.value = s?.acc_import === "S";
    sdoganamE.value = s?.sdoganam_E === "S";
    sdoganamI.value = s?.sdoganam_I === "S";
  },
  { immediate: true },
);
async function commitAccExport(v: boolean | null): Promise<void> {
  await store.update({ acc_export: v ? "S" : "N" });
}
async function commitAccImport(v: boolean | null): Promise<void> {
  await store.update({ acc_import: v ? "S" : "N" });
}
async function commitSdoganam(
  key: "sdoganam_E" | "sdoganam_I",
  v: boolean | null,
): Promise<void> {
  await store.update({ [key]: v ? "S" : "N" } as Record<string, unknown>);
}

const exportTs = computed<string>(() =>
  String(cargo.value?.data_mail_ag_export ?? ""),
);
const importTs = computed<string>(() =>
  String(cargo.value?.data_mail_ag_import ?? ""),
);

// Cambia al tab "Notificar agencias" del propio modal de aduanas (todo el
// trabajo de aduanas concentrado; antes abría un modal aparte mail_agenzie).
function notifyAgency(): void {
  ui.customsTab = "notify";
}

const customsStore = useCustomsStore();

// Load box (agencies + readonly flag) on mount and whenever the cargo
// id or one of the terminals changes — the agency lists depend on
// iso_paese resolved from terminal_part / terminal_dest.
onMounted(() => {
  if (cargo.value) {
    void customsStore.fetchBox(Number(cargo.value.id));
  }
});
watch(
  () =>
    [
      cargo.value?.id,
      cargo.value?.terminal_part,
      cargo.value?.terminal_dest,
    ] as const,
  ([id, _tp, _td], oldVal) => {
    if (!id) return;
    const oldId = oldVal?.[0];
    const oldTp = oldVal?.[1];
    const oldTd = oldVal?.[2];
    if (id !== oldId || _tp !== oldTp || _td !== oldTd) {
      void customsStore.fetchBox(Number(id));
    }
  },
);

const wrapper = computed(() => (props.embedded ? "div" : VCard));
const wrapperProps = computed(() =>
  props.embedded ? {} : { border: true, rounded: "lg" as const },
);
const textWrapper = computed(() => (props.embedded ? "div" : VCardText));
</script>

<style scoped>
/* Bloques EXPORT / IMPORT — paridad visual con la sección SdoganF del legacy. */
.cust-block {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border: 1px solid
    rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6));
}
.cust-block__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 4px;
}
/* Botón "Notificar agencia": compacto, con sombra suave y sin uppercase. */
.cust-notify-btn {
  font-weight: 600;
  letter-spacing: 0;
  box-shadow: 0 2px 8px -3px rgba(var(--v-theme-primary), 0.5);
}
</style>
