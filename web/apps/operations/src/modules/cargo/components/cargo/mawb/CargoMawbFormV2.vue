<template>
  <div class="mawb-form">
    <v-skeleton-loader v-if="store.loading" type="card, card, card" />

    <v-alert v-else-if="store.error" type="error" prominent class="mb-3">
      {{ store.error }}
    </v-alert>

    <template v-else-if="store.mawb">
      <!--
        Pre-print read-only banner. Mirrors legacy `awbmodif='N'`: if the
        first flight leg departs in less than 24 h, the form is frozen so
        operators cannot rewrite an AWB that the airline already pulled.
      -->
      <v-alert
        v-if="isPrePrintLocked"
        type="warning"
        density="compact"
        variant="tonal"
        icon="mdi-lock-outline"
        class="mb-3"
      >
        {{ t("cargo.mawbv2.preprint_lock") }}
        <template v-if="firstFlightDeparture"
          >({{ firstFlightDeparture }})</template
        >.
        {{ t("cargo.mawbv2.preprint_lock_2") }}
      </v-alert>

      <!-- Non-blocking save indicator. Replaces disabling the whole form (and
           the per-field success toast) while a PATCH is in flight. -->
      <div class="mawb-form__status">
        <v-progress-linear
          :active="store.saving"
          indeterminate
          color="primary"
          height="2"
        />
        <div class="d-flex align-center justify-end px-1" style="height: 20px">
          <span
            v-if="store.saving"
            class="text-caption text-medium-emphasis d-flex align-center ga-1"
          >
            <v-icon icon="mdi-cloud-upload-outline" size="13" />
            {{ t("cargo.mawbv2.tab.saving") }}
          </span>
          <span
            v-else-if="hasUnsaved"
            class="text-caption text-warning d-flex align-center ga-1"
          >
            <v-icon icon="mdi-circle-medium" size="16" />
            {{ t("cargo.mawbv2.tab.unsaved") }}
          </span>
          <span
            v-else-if="savedRecently"
            class="text-caption text-success d-flex align-center ga-1"
          >
            <v-icon icon="mdi-check" size="13" />
            {{ t("cargo.mawbv2.tab.saved") }}
          </span>
        </div>
      </div>

      <v-tabs v-model="tab" density="compact" color="primary" show-arrows>
        <v-tab v-for="tb in TABS" :key="tb.value" :value="tb.value">
          <v-icon :icon="tb.icon" size="16" class="me-2" />
          {{ t(tb.label) }}
          <!-- Dirty marker: with tabs an unsaved edit can sit off-screen, so
               the pill has to surface it on the tab itself. -->
          <v-icon
            v-if="tb.fields && draft.anyDirty(tb.fields)"
            icon="mdi-circle-medium"
            size="18"
            color="warning"
            class="ms-1"
          />
        </v-tab>
      </v-tabs>
      <v-divider class="mb-3" />

      <!--
        Input styling: aligned to the project-wide modern standard
        (outlined + comfortable, from plugins/vuetify.ts) so the AWB/HAWB
        forms match the rest of the app instead of using a bespoke filled
        look. Kept as a single defaults-provider so density stays uniform.
      -->
      <v-defaults-provider
        :defaults="{
          VTextField: { variant: 'outlined' },
          VTextarea: { variant: 'outlined' },
          VSelect: { variant: 'outlined' },
          VCombobox: { variant: 'outlined' },
          VAutocomplete: { variant: 'outlined' },
        }"
      >
        <v-window v-model="tab">
          <v-window-item value="identity">
            <MawbIdentityTab
              :mawb="store.mawb"
              :draft="draft"
              :locked="locked"
              :applying-agent="vettoriStore.applyingAgent"
              @commit="onFieldCommit"
              @set-terminal-partner="setTerminalPartnerOpen = true"
            />
          </v-window-item>

          <v-window-item value="addresses">
            <MawbAddressesTab
              ref="addressesTabRef"
              :shipper="shipper"
              :consignee="consignee"
              :notify="notify"
              :locked="locked"
              :cargo-id="cargoId ? Number(cargoId) : null"
              @field-change="onAddressFieldChange"
              @fields-change="onAddressFieldsChange"
            />
          </v-window-item>

          <v-window-item value="goods">
            <MawbGoodsTab
              :mawb="store.mawb"
              :draft="draft"
              :locked="locked"
              :cargo-id="Number(cargoId ?? 0)"
              @commit="onFieldCommit"
              @patch="onPatch"
              @append-tag="onAppendTag"
              @tact-looked-up="onTactLookedUp"
            />
          </v-window-item>

          <v-window-item value="charges">
            <MawbChargesTab
              :mawb="store.mawb"
              :draft="draft"
              :locked="locked"
              :options="otherChargeOptions"
              @patch="onPatch"
            />
          </v-window-item>

          <v-window-item value="signature">
            <MawbSignatureTab
              :mawb="store.mawb"
              :draft="draft"
              :locked="locked"
              @commit="onFieldCommit"
              @patch="onPatch"
            />
          </v-window-item>

          <v-window-item value="docs">
            <FormSection
              :title="t('cargo.azioni.documents')"
              icon="mdi-file-download-outline"
            >
              <AwbDocsBar />
            </FormSection>
            <CargoHawbList />
          </v-window-item>
        </v-window>
      </v-defaults-provider>

      <!-- SET TERMINAL'S PARTNER — confirm (legacy FldAgentSet). Overwrites the
           5 agent fields on the master AND every house from the departure
           terminal's partner metadata, so it asks first. -->
      <AppDialog
        :open="setTerminalPartnerOpen"
        :title="t('cargo.mawbv2.set_terminal_partner')"
        icon="mdi-account-tie"
        size="confirm"
        @close="setTerminalPartnerOpen = false"
        @update:model-value="(v: boolean) => (setTerminalPartnerOpen = v)"
      >
        {{ t("cargo.mawbv2.set_terminal_partner_confirm") }}
        <template #actions>
          <v-spacer />
          <v-btn variant="text" @click="setTerminalPartnerOpen = false">
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="vettoriStore.applyingAgent"
            @click="applyTerminalPartner"
          >
            {{ t("common.confirm") }}
          </v-btn>
        </template>
      </AppDialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import AppDialog from "@shared/ui/AppDialog.vue";
import FormSection from "@shared/ui/FormSection.vue";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoMawbStore } from "@cargo/stores/cargo_mawb.store";
import { useVettoriStore } from "@cargo/stores/vettori.store";
import type {
  MawbAddress,
  CargoMawbPatch,
} from "@cargo/services/cargo_mawb.types";
import { useMawbFieldDraft } from "@cargo/composables/useMawbFieldDraft";
import CargoHawbList from "@cargo/components/cargo/CargoHawbList.vue";
import AwbDocsBar from "@cargo/components/cargo/mawb/AwbDocsBar.vue";
import MawbIdentityTab from "./tabs/MawbIdentityTab.vue";
import MawbAddressesTab, {
  type AddressPrefix,
} from "./tabs/MawbAddressesTab.vue";
import MawbGoodsTab from "./tabs/MawbGoodsTab.vue";
import MawbChargesTab from "./tabs/MawbChargesTab.vue";
import MawbSignatureTab from "./tabs/MawbSignatureTab.vue";

const { t } = useI18n();
const cargoStore = useCargoStore();
const { cargo, id: cargoId } = storeToRefs(cargoStore);
const store = useCargoMawbStore();
const vettoriStore = useVettoriStore();

const setTerminalPartnerOpen = ref(false);
const tab = ref<string>("identity");

/**
 * Draft layer: while a field is being edited its local value wins over the
 * store, so the PATCH response for a *different* field cannot overwrite it.
 */
const draft = useMawbFieldDraft();

/** Tab definitions. `fields` drives the unsaved-changes dot on each tab. */
const TABS = [
  {
    value: "identity",
    label: "cargo.mawbv2.tab.identity",
    icon: "mdi-barcode",
    fields: ["awb_number", "agent_iata_code", "at_place", "issuing_carrier"],
  },
  {
    value: "addresses",
    label: "cargo.mawbv2.tab.addresses",
    icon: "mdi-map-marker-outline",
    fields: null,
  },
  {
    value: "goods",
    label: "cargo.mawbv2.tab.goods",
    icon: "mdi-package-variant-closed",
    fields: [
      "goods_descr",
      "mnf_descr",
      "SSR",
      "OSI",
      "handling_SCI",
      "TACT_MinimumCharge",
      "declared_val_carriage",
      "declared_val_customs",
      "accounting",
      "note_interne",
    ],
  },
  {
    value: "charges",
    label: "cargo.mawbv2.tab.charges",
    icon: "mdi-cash-multiple",
    fields: Array.from({ length: 8 }, (_, i) => `oth_crg_val_${i + 1}`),
  },
  {
    value: "signature",
    label: "cargo.mawbv2.tab.signature",
    icon: "mdi-pen",
    fields: ["signature_ragsoc", "signature_agent"],
  },
  {
    value: "docs",
    label: "cargo.mawbv2.tab.docs",
    icon: "mdi-file-download-outline",
    fields: null,
  },
] as const;

const hasUnsaved = computed(() => draft.dirtyFields.value.length > 0);

/** Brief "Saved" acknowledgement after a save settles (replaces the toasts). */
const savedRecently = ref(false);
let savedTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => store.saving,
  (now, was) => {
    if (was && !now) {
      savedRecently.value = true;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => (savedRecently.value = false), 2000);
    }
  },
);

/** Descriptions for the "Other charges" label combobox (from awb_other_charge). */
const otherChargeOptions = computed<string[]>(
  () => store.mawb?._other_charge_options ?? [],
);

/**
 * Pre-print lock — paridad con legacy `awbmodif='N'`. The first flight
 * leg (`flight_data1`) is the reference because that is when the AWB
 * paperwork must be final.
 */
const firstFlightDeparture = computed<string | null>(() => {
  const raw = cargo.value?.flight_data1 as string | undefined;
  if (!raw || raw === "" || raw.startsWith("0000-")) return null;
  return raw;
});

const isPrePrintLocked = computed<boolean>(() => {
  const raw = firstFlightDeparture.value;
  if (!raw) return false;
  const dep = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(dep.getTime())) return false;
  const lockAt = dep.getTime() - 24 * 60 * 60 * 1000;
  return Date.now() >= lockAt;
});

/**
 * Business lock only (pre-print). Deliberately does NOT include `store.saving`:
 * disabling every input while a save was in flight is what made the form
 * impossible to type in — the operator lost the field mid-edit on each blur.
 */
const locked = computed<boolean>(() => isPrePrintLocked.value);

function legacyToAddress(
  prefix: "shipper" | "consignee" | "notify",
): MawbAddress {
  const m = store.mawb;
  if (!m) return { nome: "", adress: "", citta: "", id_paese_iso: "" };
  return {
    nome: String(m[`${prefix}_nome`] ?? ""),
    adress: String(m[`${prefix}_address`] ?? ""),
    cap: (m[`${prefix}_cap`] as string | null) ?? null,
    citta: String(m[`${prefix}_citta`] ?? ""),
    prov: (m[`${prefix}_prov`] as string | null) ?? null,
    id_paese_iso: String(m[`${prefix}_paese`] ?? ""),
    attenzione: (m[`${prefix}_attne`] as string | null) ?? null,
    tel: (m[`${prefix}_tel`] as string | null) ?? null,
    mail: (m[`${prefix}_mail`] as string | null) ?? null,
  };
}

const shipper = computed(() => legacyToAddress("shipper"));
const consignee = computed(() => legacyToAddress("consignee"));
const notify = computed(() => legacyToAddress("notify"));

async function load(): Promise<void> {
  if (!cargoId.value) return;
  // A reload is authoritative: drop drafts so stale local text cannot mask it.
  draft.clearAll();
  await store.load(Number(cargoId.value));
}

/**
 * Persist a partial MAWB change. Fields carried by the patch are released from
 * the draft layer once the save lands. On failure the draft is kept, so the
 * operator's text stays on screen instead of silently reverting.
 */
async function onPatch(patch: CargoMawbPatch): Promise<void> {
  if (!cargoId.value) return;
  const fields = Object.keys(patch);
  const ok = await store.patch(Number(cargoId.value), patch);
  if (ok) for (const f of fields) draft.clearDraft(f);
}

/**
 * Commit a scalar field on blur. Skips the round-trip when the value is
 * unchanged, which is the common case for a focus-through.
 */
async function onFieldCommit(field: string): Promise<void> {
  if (!draft.isDirty(field)) return;
  const stored = store.mawb?.[field];
  const next = draft.displayValue(field, stored);
  if (next === (stored == null ? "" : String(stored))) {
    draft.clearDraft(field);
    return;
  }
  await onPatch({ [field]: next } as CargoMawbPatch);
}

/**
 * Append a predefined phrase to a free-text MAWB field and persist it —
 * paridad con legacy `AwbSetTxt`. If the field is empty the separator is
 * omitted so we never lead with ", ".
 */
async function onAppendTag({
  field,
  phrase,
  sep,
}: {
  field: string;
  phrase: string;
  sep: string;
}): Promise<void> {
  if (locked.value) return;
  // Respect an in-progress edit: append to what the operator sees, not to the
  // stale stored value.
  const current = draft.displayValue(field, store.mawb?.[field]).trim();
  const next = current ? `${current}${sep}${phrase}` : phrase;
  await onPatch({ [field]: next } as CargoMawbPatch);
}

async function onTactLookedUp(): Promise<void> {
  await load();
}

async function applyTerminalPartner(): Promise<void> {
  if (!cargoId.value) return;
  const ok = await vettoriStore.applyIataAgent(Number(cargoId.value));
  setTerminalPartnerOpen.value = false;
  if (ok) await load();
}

/** Legacy column names for each address block (Awb_Service writes them flat). */
function addressColumnMap(
  prefix: AddressPrefix,
): Record<keyof MawbAddress, string> {
  return {
    nome: `${prefix}_nome`,
    adress: `${prefix}_address`,
    cap: `${prefix}_cap`,
    citta: `${prefix}_citta`,
    prov: `${prefix}_prov`,
    id_paese_iso: `${prefix}_paese`,
    attenzione: `${prefix}_attne`,
    tel: `${prefix}_tel`,
    mail: `${prefix}_mail`,
  };
}

const addressesTabRef = ref<{
  release: (p: AddressPrefix, f?: keyof MawbAddress) => void;
} | null>(null);

async function onAddressFieldChange({
  prefix,
  field,
  value,
}: {
  prefix: AddressPrefix;
  field: keyof MawbAddress;
  value: string;
}): Promise<void> {
  if (!cargoId.value) return;
  const col = addressColumnMap(prefix)[field];
  if (!col) return;
  const ok = await store.patch(Number(cargoId.value), { [col]: value });
  if (ok) addressesTabRef.value?.release(prefix, field);
}

/**
 * Batched address update (copy-from / rubrica pick / clear). One PATCH for the
 * whole block — it used to fire one request per field, up to 9 in a row, each
 * refreshing the store and fighting the other blocks' local state.
 */
async function onAddressFieldsChange({
  prefix,
  fields,
}: {
  prefix: AddressPrefix;
  fields: Partial<Record<keyof MawbAddress, string>>;
}): Promise<void> {
  const map = addressColumnMap(prefix);
  const patch: Record<string, string> = {};
  for (const [field, value] of Object.entries(fields) as [
    keyof MawbAddress,
    string,
  ][]) {
    const col = map[field];
    if (col) patch[col] = value;
  }
  if (!cargoId.value || !Object.keys(patch).length) return;
  const ok = await store.patch(Number(cargoId.value), patch);
  if (ok) addressesTabRef.value?.release(prefix);
}

onMounted(load);
watch(cargoId, load);
</script>

<style scoped>
.mawb-form__status {
  min-height: 22px;
}
</style>
