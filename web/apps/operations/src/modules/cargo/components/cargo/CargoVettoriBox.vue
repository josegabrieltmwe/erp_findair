<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-airplane" size="18" class="me-2" />
      {{ t("cargo.vettori.title") }}
      <v-chip
        v-if="vettoreSigla.local"
        size="x-small"
        color="primary"
        variant="tonal"
        class="ms-2"
      >
        {{ vettoreSigla.local }}
      </v-chip>
      <v-spacer />
      <v-btn
        size="x-small"
        variant="text"
        prepend-icon="mdi-format-list-bulleted"
        :loading="vettoriStore.loadingCarriers"
        @click="openPicker"
      >
        {{ t("cargo.vettori.available_carriers") }}
      </v-btn>
      <!-- Este boton emitia `openVettori` por el bus y estaba MUERTO: nadie
           escuchaba ese evento, asi que el clic emitia a un Set vacio y no
           pasaba nada. Ahora abre la busqueda por el mismo guard que el resto
           de entradas, que explica el bloqueo en vez de no hacer nada. -->
      <v-btn
        size="x-small"
        variant="text"
        prepend-icon="mdi-magnify"
        :loading="quote.checking.value"
        @click="quote.openSearch()"
      >
        {{ t("cargo.vettori.search_flights") }}
      </v-btn>
    </v-card-title>

    <QuoteBlockedDialog
      v-model="quote.blockedOpen.value"
      :issues="quote.issues.value"
      :loading="quote.checking.value"
      @recheck="quote.recheck()"
      @fix="quote.goFix"
    />
    <v-divider />
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="vettoreTipo.local"
            :label="t('cargo.vettori.carrier_type')"
            :readonly="readonly('vettore_tipo')"
            @blur="vettoreTipo.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <!-- Carrier is a catalog FK: sigla/nome are set only through the
               carrier picker (api_cargo_vettori_list) so a user cannot type a
               value that matches no real vettore. Kept readonly, never wiped —
               a persisted value not in the (route-scoped) catalog still shows. -->
          <v-text-field
            v-model="vettoreSigla.local"
            :label="t('cargo.vettori.iata_prefix')"
            readonly
          >
            <!-- Cola/logo de la aerolínea seleccionada (por código IATA). -->
            <template v-if="vettoreSigla.local" #prepend-inner>
              <AirlineLogo :code="vettoreSigla.local" :size="24" />
            </template>
          </v-text-field>
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="vettoreNome.local"
            :label="t('cargo.vettori.carrier_name')"
            readonly
            append-inner-icon="mdi-format-list-bulleted"
            @click:append-inner="openPicker"
            @click="openPicker"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-autocomplete
            v-model="terminalPart.local"
            :label="t('cargo.vettori.origin_terminal')"
            :items="originTerminals"
            :loading="loadingPart"
            item-title="label"
            item-value="sigla"
            auto-select-first
            :custom-filter="() => true"
            :readonly="readonly('terminal_part')"
            @update:search="(q: string) => loadTerminals('part', q)"
            @update:model-value="terminalPart.commit"
            @blur="terminalPart.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-autocomplete
            v-model="terminalDest.local"
            :label="t('cargo.vettori.dest_terminal')"
            :items="destTerminals"
            :loading="loadingDest"
            item-title="label"
            item-value="sigla"
            auto-select-first
            :custom-filter="() => true"
            :readonly="readonly('terminal_dest')"
            @update:search="(q: string) => loadTerminals('dest', q)"
            @update:model-value="terminalDest.commit"
            @blur="terminalDest.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-select
            v-model="tipoMerce.local"
            :label="t('cargo.vettori.cargo_type')"
            :items="tipoMerceOptions"
            clearable
            :readonly="readonly('tipo_merce')"
            @update:model-value="tipoMerce.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-combobox
            v-model="incoterm.local"
            :label="t('cargo.vettori.incoterm')"
            :items="incotermOptions"
            :readonly="readonly('incoterm')"
            @update:model-value="incoterm.commit"
            @blur="incoterm.commit"
          />
        </v-col>
      </v-row>
    </v-card-text>

    <!-- Carrier picker dialog. Populated by api_cargo_vettori_list. -->
    <v-dialog v-model="pickerOpen" max-width="640">
      <v-card>
        <v-card-title class="text-subtitle-1">
          {{ t("cargo.vettori.available_carriers") }}
          <span v-if="cargo" class="text-caption text-medium-emphasis ms-2">
            {{
              t("cargo.vettori.route", {
                from: cargo.terminal_part,
                to: cargo.terminal_dest,
              })
            }}
          </span>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-progress-linear
            v-if="vettoriStore.loadingCarriers"
            indeterminate
          />
          <v-list v-else-if="vettoriStore.hasCarriers" density="compact">
            <v-list-item
              v-for="c in vettoriStore.carriers"
              :key="c.id"
              :title="c.label"
              :subtitle="
                t('cargo.vettori.awbs_available', { count: c.awbs_available })
              "
              @click="pickCarrier(c)"
            >
              <template #prepend>
                <AirlineLogo :code="c.sigla" :size="32" class="me-3" />
              </template>
              <template #append>
                <v-chip size="x-small" variant="tonal" color="primary">{{
                  c.sigla
                }}</v-chip>
              </template>
            </v-list-item>
          </v-list>
          <v-alert v-else type="info" variant="tonal" density="compact">
            {{ t("cargo.vettori.no_carriers") }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="pickerOpen = false">{{
            t("common.close")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoState } from "@cargo/composables/useCargoState";
import { useFieldBinding } from "@cargo/composables/useFieldBinding";
import { useVettoriStore } from "@cargo/stores/vettori.store";
import type { VettoreOption } from "@cargo/services/vettori.service";
import { stripCarrierMarkup } from "@cargo/utils/carrierName";
import { useQuoteGuard } from "@cargo/composables/useQuoteGuard";
import AirlineLogo from "./AirlineLogo.vue";
import QuoteBlockedDialog from "./flight-manager/QuoteBlockedDialog.vue";
import {
  terminalsService,
  type TerminalOption,
} from "@cargo/services/terminals.service";

const { t } = useI18n();
const store = useCargoStore();
const { cargo, pickup, destination } = storeToRefs(store);
const { readonly } = useCargoState(cargo);
const quote = useQuoteGuard();

const vettoreTipo = useFieldBinding("vettore_tipo", "");
const vettoreSigla = useFieldBinding("vettore_sigla", "");
const vettoreNome = useFieldBinding("vettore_nome", "");
const terminalPart = useFieldBinding("terminal_part", "");
const terminalDest = useFieldBinding("terminal_dest", "");

// Terminal autocomplete (legacy parity: terminal_ajax_terminal.php). Lists
// airports/ports of the relevant country from api_cargo_terminals. Origin ISO
// comes from the pickup address (fallback cargo.paese_part); dest from the
// destination address (fallback cargo.paese_dest).
const originTerminals = ref<TerminalOption[]>([]);
const destTerminals = ref<TerminalOption[]>([]);
const loadingPart = ref(false);
const loadingDest = ref(false);

function isoFor(side: "part" | "dest"): string {
  if (side === "part") {
    return String(pickup.value?.id_paese_iso ?? cargo.value?.paese_part ?? "");
  }
  return String(
    destination.value?.id_paese_iso ?? cargo.value?.paese_dest ?? "",
  );
}

async function loadTerminals(side: "part" | "dest", q = ""): Promise<void> {
  const iso = isoFor(side);
  if (!iso) return;
  const loading = side === "part" ? loadingPart : loadingDest;
  const target = side === "part" ? originTerminals : destTerminals;
  const current = side === "part" ? terminalPart.local : terminalDest.local;
  loading.value = true;
  try {
    const list = await terminalsService.list(iso, "", q);
    // Keep the current value selectable even if it is not in the catalog
    // (legacy cargos may carry a non-listed sigla) so the field never blanks.
    if (current && !list.some((tt) => tt.sigla === current)) {
      list.unshift({
        sigla: String(current),
        nome: String(current),
        citta: "",
        iso_paese: iso,
        tipo: "",
        principal: false,
        label: String(current),
      });
    }
    target.value = list;
  } finally {
    loading.value = false;
  }
}

// Preload each side's list once the country is known, so the current value
// resolves to its label and the dropdown is populated on first open.
watch(
  () => isoFor("part"),
  (iso) => {
    if (iso) void loadTerminals("part");
  },
  { immediate: true },
);
watch(
  () => isoFor("dest"),
  (iso) => {
    if (iso) void loadTerminals("dest");
  },
  { immediate: true },
);
const tipoMerce = useFieldBinding("tipo_merce", "");
const incoterm = useFieldBinding("incoterm", "");

// Same DOC/NDC/SPL catalog the filter panel uses (enums.cargo_type.*).
const tipoMerceOptions = computed(() => [
  { title: t("enums.cargo_type.documents"), value: "DOC" },
  { title: t("enums.cargo_type.non_doc"), value: "NDC" },
  { title: t("enums.cargo_type.special"), value: "SPL" },
]);

// Standard Incoterms 2020 — free text allowed (combobox) to match the legacy
// open select, but pre-populated with the common codes.
const incotermOptions = [
  "EXW",
  "FCA",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
];

// Legacy cargos created via `presa_ajax_cargo2.php` carry an HTML <span>
// inside vettore_nome (e.g. "Amerijet <span>(LOWER GEN)</span>"). The
// legacy form rendered that with innerHTML; the Vue input would expose
// it as literal text. Strip on every store -> local sync so the user
// sees a clean value, and a subsequent edit/commit writes the clean
// version back to DB.
watch(
  () => vettoreNome.local,
  (v) => {
    const clean = stripCarrierMarkup(v);
    if (clean !== v) vettoreNome.local = clean;
  },
  { immediate: true },
);

const vettoriStore = useVettoriStore();
const pickerOpen = ref(false);

async function openPicker(): Promise<void> {
  if (!cargo.value) return;
  pickerOpen.value = true;
  await vettoriStore.fetchCarriers(Number(cargo.value.id));
}

function pickCarrier(c: VettoreOption): void {
  vettoreSigla.local = c.sigla as typeof vettoreSigla.local;
  vettoreNome.local = c.nome as typeof vettoreNome.local;
  // Commit both — they go to spedizioni_cargo.vettore_sigla / vettore_nome.
  void vettoreSigla.commit();
  void vettoreNome.commit();
  pickerOpen.value = false;
}
</script>
