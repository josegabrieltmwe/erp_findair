<template>
  <v-card flat>
    <v-card-title class="text-subtitle-1 d-flex align-center flex-wrap ga-2">
      {{ title }}
      <!-- Origen desde la sede del cliente -->
      <v-chip
        v-if="isSedePickup"
        color="primary"
        size="small"
        variant="tonal"
        prepend-icon="mdi-office-building-marker"
        >{{ t("shipment.modals.address.from_sede") }}</v-chip
      >
      <v-spacer />
      <!-- Ver la dirección ACTUALMENTE registrada del envío (paridad legacy
           "Show original address" / AddrHistory, spedy_form.php:2782-2784).
           Popup informativo de solo lectura; no es un histórico de BD. -->
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-map-marker-outline"
        @click="registeredOpen = true"
      >
        {{ t("shipment.modals.address.view_registered") }}
      </v-btn>
      <v-chip
        v-if="isRemote === 'S'"
        color="warning"
        size="small"
        variant="tonal"
        >{{ t("shipment.modals.address.remote_area") }}</v-chip
      >
      <!-- Pickup: alternar entre sede y dirección custom -->
      <v-btn
        v-if="isSedePickup"
        size="small"
        variant="tonal"
        prepend-icon="mdi-map-marker-plus-outline"
        :disabled="isAddressLocked"
        @click="switchToCustom"
      >
        {{ t("shipment.modals.address.use_other_address") }}
      </v-btn>
      <v-btn
        v-else-if="tipo === 'P' && (customMode || shipment?.presa_tipo === 'T')"
        size="small"
        variant="tonal"
        prepend-icon="mdi-office-building-marker"
        :loading="store.saving"
        :disabled="isAddressLocked"
        @click="switchToSede"
      >
        {{ t("shipment.modals.address.use_sede_address") }}
      </v-btn>
    </v-card-title>

    <!-- Vista solo-lectura de la dirección de la sede -->
    <v-card-text v-if="isSedePickup">
      <div class="text-body-2">
        <div class="font-weight-medium">
          {{ shipment?.sed_label || local.name || "—" }}
        </div>
        <div>{{ addressLine || shipment?.sed_indirizzo || "—" }}</div>
        <div>
          {{ [local.cap, local.city, local.prov].filter(Boolean).join(" ") }}
          <span v-if="local.country">· {{ local.country }}</span>
        </div>
      </div>
      <p class="text-caption text-medium-emphasis mt-2 mb-0">
        {{ t("shipment.modals.address.from_sede_hint") }}
      </p>
    </v-card-text>

    <v-card-text v-else>
      <!-- Rubrica picker (paridad legacy spedy_form rubrica.php) -->
      <v-autocomplete
        v-model="pickerSel"
        :items="pickerItems"
        :loading="pickerLoading"
        item-title="name"
        return-object
        clearable
        density="compact"
        variant="outlined"
        hide-no-data
        hide-details
        :placeholder="t('shipment.modals.address.search_rubrica')"
        prepend-inner-icon="mdi-account-search"
        class="mb-4"
        :disabled="isReadonly"
        @update:search="onRubricaSearch"
        @update:model-value="onRubricaPick"
      >
        <template #item="{ props: itemProps, item }">
          <v-list-item v-bind="itemProps">
            <template #title>
              <span class="font-weight-medium">{{ item.raw.name }}</span>
              <v-icon
                v-if="item.raw.preferred === 'S'"
                icon="mdi-star"
                size="13"
                color="amber-darken-2"
                class="ms-1"
              />
            </template>
            <template #subtitle>
              <span class="text-caption">
                {{
                  [
                    item.raw.adress,
                    item.raw.cap,
                    item.raw.city,
                    item.raw.country,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                }}
              </span>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <!-- Anagrafica: chi (paese, ragione sociale, contatto) -->
      <FormSection
        :title="t('shipment.modals.address.section_anagrafica')"
        icon="mdi-account-box-outline"
        flat
      >
        <v-row dense>
          <v-col cols="12" md="3">
            <CmCountrySelect
              :model-value="local.country"
              :label="t('shipment.modals.address.country')"
              :disabled="isReadonly"
              :clearable="false"
              @update:model-value="onCountryChange"
            />
          </v-col>
          <v-col cols="12" md="9">
            <v-text-field
              v-model="local.name"
              :label="t('shipment.modals.address.name')"
              :readonly="isReadonly"
              density="compact"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- Indirizzo: dove (via, CAP, città, provincia) -->
      <FormSection
        :title="t('shipment.modals.address.section_indirizzo')"
        icon="mdi-map-marker-outline"
        flat
      >
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              v-model="addressLine"
              :label="t('shipment.modals.address.address')"
              :readonly="isReadonly"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="local.cap"
              :label="t('shipment.modals.address.cap')"
              :readonly="isReadonly"
              :loading="capLoading"
              density="compact"
              @blur="onCapBlur"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-combobox
              v-model="local.city"
              :items="citySuggestions"
              :label="t('shipment.modals.address.city')"
              :readonly="isReadonly"
              hide-no-data
              auto-select-first
              density="compact"
              @update:model-value="onCityChange"
            />
          </v-col>
          <v-col cols="12" md="3">
            <CmProvinciaSelect
              v-model="local.prov"
              :country="String(local.country ?? '')"
              mode="auto"
              :disabled="isReadonly"
              :label="t('shipment.modals.address.province')"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="4">
            <CmAddressAirport
              v-model="airportModel"
              variant="nearest"
              :items="airportItems"
              :loading="airportLoading"
              :country="String(local.country ?? '')"
              :label="t('shipment.modals.address.airport')"
              :placeholder="t('common.select')"
              :readonly="isReadonly"
              :disabled="isReadonly"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- Contatti: telefono, cellulare, email -->
      <FormSection
        :title="t('shipment.modals.address.section_contatti')"
        icon="mdi-card-account-phone-outline"
        flat
        last
      >
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              v-model="local.attention"
              :label="t('shipment.modals.address.attention')"
              :readonly="isReadonly"
              density="compact"
              prepend-inner-icon="mdi-account-outline"
            />
          </v-col>
          <v-col cols="12" :md="props.tipo === 'P' ? 4 : 6">
            <v-text-field
              v-model="local.tel"
              :label="t('shipment.modals.address.phone')"
              :readonly="isReadonly"
              density="compact"
              prepend-inner-icon="mdi-phone-outline"
            />
          </v-col>
          <v-col v-if="props.tipo === 'P'" cols="12" md="4">
            <v-text-field
              v-model="local.cell"
              :label="t('shipment.modals.address.cell')"
              :hint="t('shipment.modals.address.cell_hint')"
              persistent-hint
              :readonly="isReadonly"
              density="compact"
              prepend-inner-icon="mdi-cellphone"
            />
          </v-col>
          <v-col cols="12" :md="props.tipo === 'P' ? 4 : 6">
            <v-text-field
              v-model="local.email"
              :label="t('shipment.modals.address.email')"
              :readonly="isReadonly"
              density="compact"
              prepend-inner-icon="mdi-email-outline"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- Historical delivery stats for the destination route (legacy
           spedy_form_ajax_stats.php). Destination only. -->
      <RouteStatsPanel
        v-if="props.tipo === 'D'"
        :country="String(local.country ?? '')"
        :cap="String(local.cap ?? '')"
        :city="String(local.city ?? '')"
        class="mt-3"
      />
    </v-card-text>

    <!-- Popup solo-lectura con la dirección registrada del envío (paridad
         legacy AddrHistory). Muestra los campos persistidos en el store, no un
         buffer editable. -->
    <v-dialog v-model="registeredOpen" max-width="420">
      <v-card>
        <v-card-title class="text-subtitle-1 d-flex align-center">
          <v-icon icon="mdi-map-marker-outline" size="18" class="me-2" />
          {{ t("shipment.modals.address.view_registered") }}
        </v-card-title>
        <v-card-text>
          <div v-if="registeredLines.length" class="text-body-2">
            <div
              v-for="(line, i) in registeredLines"
              :key="i"
              :class="{ 'font-weight-medium': i === 0 }"
            >
              {{ line }}
            </div>
          </div>
          <div v-else class="text-body-2 text-medium-emphasis">
            {{ t("shipment.modals.address.no_registered") }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="registeredOpen = false">
            {{ t("common.close") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useRemoteAreaCheck } from "@shipment/composables/useRemoteAreaCheck";
import { geoService } from "@shipment/services/geo.service";
import {
  rubricaService,
  type RubricaRow,
} from "@shipment/services/rubrica.service";
import { terminalsService } from "@shared/anagrafiche/services/terminals.service";
import RouteStatsPanel from "@shipment/components/shipment/RouteStatsPanel.vue";
import CmProvinciaSelect from "@shared/anagrafiche/components/CmProvinciaSelect.vue";
import CmCountrySelect from "@shared/anagrafiche/components/CmCountrySelect.vue";
import CmAddressAirport from "@shared/anagrafiche/components/CmAddressAirport.vue";
import FormSection from "@shared/ui/FormSection.vue";
import type { ShipmentAddress } from "@shipment/services/shipment.types";

const props = defineProps<{ tipo: "P" | "D"; title: string }>();

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const { readonly: ro, isAddressLocked } = useShipmentState(shipment);
const { remote: isRemote, check } = useRemoteAreaCheck();

// Origen desde la SEDE del cliente: cuando el pickup (tipo 'P') hereda la
// dirección de la sede (presa_tipo='S' / uses_sede_address). En ese modo los
// campos se muestran en solo-lectura (son datos de la sede, no editables) y se
// ofrece "usar otra dirección" para pasar a triangulación.
const isSedePickup = computed(
  () =>
    props.tipo === "P" &&
    (shipment.value?.presa_tipo === "S" ||
      shipment.value?.uses_sede_address === true) &&
    !customMode.value,
);

// El usuario pidió introducir una dirección custom (aún sin persistir hasta
// guardar). Sale del modo sede localmente.
const customMode = ref(false);

const isReadonly = computed(
  () => isAddressLocked.value || ro("id_cliente") || isSedePickup.value,
);

const local = ref<ShipmentAddress>({});
const citySuggestions = ref<string[]>([]);

// ─── "Ver dirección registrada" (paridad legacy AddrHistory) ──────────────
// Popup solo-lectura con la dirección ACTUAL persistida del envío para esta
// posición (pickup 'P' → origin_address, dest 'D' → destination_address). No
// usa el buffer editable `local`, sino los datos del store, formateados como
// el legacy (nombre / dirección / cap ciudad prov / país / att / tel).
const registeredOpen = ref(false);

const registeredLines = computed<string[]>(() => {
  const a =
    props.tipo === "D"
      ? shipment.value?.destination_address
      : shipment.value?.origin_address;
  if (!a) return [];
  const addr = a.address;
  const addrText = Array.isArray(addr) ? addr.filter(Boolean).join(", ") : addr;
  const lines: string[] = [];
  const name = a.name ?? a.nome;
  if (name) lines.push(String(name));
  if (addrText) lines.push(String(addrText));
  const capCityProv = [a.cap, a.city ?? a.citta, a.prov]
    .filter(Boolean)
    .join(" ");
  if (capCityProv) lines.push(capCityProv);
  const country = a.country_name || a.country || a.id_paese_iso;
  if (country) lines.push(String(country));
  const att = a.attention ?? a.attenzione;
  if (att) lines.push(`${t("shipment.modals.address.attention")}: ${att}`);
  const tel = a.tel;
  if (tel) lines.push(`${t("shipment.modals.address.phone")}: ${tel}`);
  return lines;
});
// Airport autocomplete options: {value: IATA sigla, label: "SIGLA — city"}.
// Fed by terminalsService (api_cargo_terminals, shared master lookup) on
// country change and on typed search, so the user can pick any airport of the
// country instead of only the CAP-derived nearest ones.
const airportItems = ref<Array<{ value: string; label: string }>>([]);
const airportLoading = ref(false);

const capLoading = ref(false);

watch(
  shipment,
  (s) => {
    const a = props.tipo === "D" ? s?.destination_address : s?.origin_address;
    local.value = { ...(a ?? {}) };
    // Si el backend confirma que el origen es la sede (presa_tipo='S'), salir
    // del modo custom local (p.ej. tras "usar la sede" o al recargar).
    if (props.tipo === "P" && (s?.presa_tipo === "S" || s?.uses_sede_address)) {
      customMode.value = false;
    }
    // Seed the options with the persisted value so it renders before the
    // country lookup resolves, then load the full airport list of the country.
    // Skip the legacy "0" sentinel (= no airport) so it is not shown as an item.
    const seed = String(local.value.airport ?? "");
    if (seed && seed !== "0") {
      airportItems.value = [{ value: seed, label: seed }];
    }
    void loadAirports(String(local.value.country ?? ""));
  },
  { immediate: true, deep: true },
);

/**
 * Load ALL airports of a country into airportItems once. Vuetify then filters
 * this list client-side as the user types (by the "SIGLA — city" label), so
 * there is no per-keystroke request and no risk of a malformed remote query.
 * Keeps the currently-selected value present even if the lookup omits it.
 */
async function loadAirports(country: string): Promise<void> {
  const iso = country.trim().toUpperCase();
  const curAirport = String(local.value.airport ?? "");
  const hasAirport = curAirport !== "" && curAirport !== "0";
  if (!iso) {
    airportItems.value = hasAirport
      ? [{ value: curAirport, label: curAirport }]
      : [];
    return;
  }
  airportLoading.value = true;
  try {
    const rows = await terminalsService.list(iso, "A");
    const opts = rows.map((r) => ({
      value: r.sigla,
      label: r.label || `${r.sigla}${r.citta ? " — " + r.citta : ""}`,
    }));
    if (hasAirport && !opts.some((o) => o.value === curAirport)) {
      opts.unshift({ value: curAirport, label: curAirport });
    }
    airportItems.value = opts;
  } catch {
    // Silent: the field stays usable with whatever options it already had.
  } finally {
    airportLoading.value = false;
  }
}

const addressLine = computed({
  get: () => {
    const a = local.value.address;
    if (Array.isArray(a)) return a.join(", ");
    return a ?? "";
  },
  set: (v: string) => {
    local.value.address = v;
  },
});

// Airport binding: the legacy stores "0" (or empty) when no airport is set, but
// "0" is not a real option, so the field would render a bare "0" selection.
// Normalize "0"/empty ↔ null so the placeholder ("Seleccionar") shows instead.
const airportModel = computed<string | null>({
  get: () => {
    const a = String(local.value.airport ?? "");
    return a === "" || a === "0" ? null : a;
  },
  set: (v: string | null) => {
    local.value.airport = v ?? "";
    markDirty();
  },
});

function toLegacyPayload(addr: ShipmentAddress): Record<string, unknown> {
  return {
    nome: addr.name ?? addr.nome,
    adress: Array.isArray(addr.address)
      ? addr.address.join(", ")
      : (addr.address ?? addr.adress),
    cap: addr.cap,
    citta: addr.city ?? addr.citta,
    prov: addr.prov,
    id_paese_iso: addr.country ?? addr.id_paese_iso,
    attenzione: addr.attention ?? addr.attenzione,
    tel: addr.tel,
    cell: addr.cell,
    mail: addr.email ?? addr.mail,
    dhl_airport: addr.airport ?? addr.dhl_airport,
  };
}

// Edit-in-buffer: typing no longer persists. The parent modal calls save()
// from its "Salva" button. `dirty` lets the modal warn on close.
const dirty = ref(false);

function markDirty(): void {
  dirty.value = true;
}

/** Persist the buffered address. Returns false on failure. */
async function save(): Promise<boolean> {
  if (isReadonly.value) return true;
  const ok = await store.saveAddress(props.tipo, toLegacyPayload(local.value));
  if (ok) {
    dirty.value = false;
    // Al guardar una dirección custom de pickup, el backend ya puso
    // presa_tipo='T'; salimos del modo local.
    customMode.value = false;
  }
  return ok;
}

// -- Origen sede ↔ custom (solo pickup) ------------------------------------

/** "Usa otra dirección": vacía los campos y habilita la edición (custom). No
 *  persiste presa_tipo hasta que se guarde la dirección. */
function switchToCustom(): void {
  local.value = {};
  customMode.value = true;
  dirty.value = true;
}

/** "Usa la dirección de la sede": revierte a presa_tipo='S' (backend borra la
 *  fila 'P' y el origen vuelve a heredarse de la sede). Recarga el shipment. */
async function switchToSede(): Promise<void> {
  customMode.value = false;
  await store.useSedeAsOrigin();
}

defineExpose({ save, dirty });

async function lookupCap(): Promise<void> {
  const country = (local.value.country ?? "").toUpperCase();
  const cap = (local.value.cap ?? "").trim();
  if (!country || cap.length < 3) return;
  capLoading.value = true;
  try {
    const r = await geoService.lookupCap({ country, cap });
    citySuggestions.value = r.cities ?? [];
    // Legacy checkCapExe deriva SIEMPRE la provincia del CAP (inyecta el select
    // provcmd, sobrescribiendo lo previo). Replicamos: el CAP manda sobre la
    // provincia. Solo respetamos el valor previo si el lookup no la resuelve.
    if (r.prov_short) {
      local.value.prov = r.prov_short as string;
    }
    // Si el CAP resuelve a una única ciudad, autocompletar (legacy: cuando la
    // lista trae 1 sola, la fija; con varias, ofrece el desplegable = items).
    if ((r.cities?.length ?? 0) === 1 && r.cities[0]) {
      local.value.city = r.cities[0];
    }
    if (r.closer_airports && r.closer_airports.length > 0) {
      // CAP-derived nearest airports as the initial suggestion. Typing a query
      // (onAirportSearch) then loads the full country list from terminalsService.
      airportItems.value = r.closer_airports.map((a) => ({
        value: a.sigla,
        label: a.label ?? a.sigla,
      }));
      if (!local.value.airport && r.airport?.sigla) {
        local.value.airport = r.airport.sigla;
      }
    }
  } finally {
    capLoading.value = false;
  }
}

async function onCapBlur(): Promise<void> {
  markDirty();
  const country = (local.value.country ?? "").toUpperCase();
  const cap = local.value.cap ?? "";
  if (country && cap) {
    // Lookups only (CAP→city/airport + remote-area). No persistence — the
    // address is saved when the user clicks "Salva".
    await Promise.all([
      lookupCap(),
      check(
        country,
        cap,
        local.value.city ?? "",
        props.tipo === "D" ? "x1" : "x2",
      ),
    ]);
  }
}

/**
 * Country change — mirrors the legacy `checkStati(quale)`. Changing the country
 * invalidates the postal-code-derived fields (CAP, città, provincia, aeroporto),
 * so we clear them and reload the airport list for the new country. The
 * province SELECT itself is regenerated by CmProvinciaSelect (it watches
 * `country`), matching the legacy addres_ajax_prov.php regeneration.
 */
async function onCountryChange(v: string | null): Promise<void> {
  const next = (v ?? "").toUpperCase();
  const prev = (local.value.country ?? "").toUpperCase();
  local.value.country = v ?? "";
  if (next === prev) return;
  // The old CAP/city/prov/airport belong to the previous country → drop them.
  local.value.cap = "";
  local.value.city = "";
  local.value.prov = "";
  local.value.airport = "";
  citySuggestions.value = [];
  markDirty();
  await loadAirports(next);
}

async function onCityChange(): Promise<void> {
  markDirty();
  const country = (local.value.country ?? "").toUpperCase();
  if (!country) return;
  await Promise.all([
    check(
      country,
      local.value.cap ?? "",
      local.value.city ?? "",
      props.tipo === "D" ? "x1" : "x2",
    ),
    lookupAirportByCity(),
  ]);
}

/**
 * City → airport derivation. Mirrors the legacy `checkAirportExe`
 * (addres_airport_ajax.php?cap=&cit=): when the city changes and the airport is
 * not yet set, derive the nearest airport. We reuse `cap_city_prov` (the same
 * session-authenticated endpoint used on CAP blur, which already returns the
 * CAP-derived nearest airport) rather than the Bearer-only closer-airports API.
 * Only fills `dhl_airport` when empty/unset so a manual pick is never overwritten.
 */
async function lookupAirportByCity(): Promise<void> {
  const country = (local.value.country ?? "").toUpperCase();
  const cap = (local.value.cap ?? "").trim();
  const cur = String(local.value.airport ?? "");
  // Only derive when there is no airport yet and we have a CAP to resolve from.
  if (!country || cap.length < 3 || (cur && cur !== "0")) return;
  try {
    const r = await geoService.lookupCap({ country, cap });
    if (r.closer_airports && r.closer_airports.length > 0) {
      airportItems.value = r.closer_airports.map((a) => ({
        value: a.sigla,
        label: a.label ?? a.sigla,
      }));
    }
    if (r.airport?.sigla) {
      local.value.airport = r.airport.sigla;
    }
  } catch {
    // Silent: the airport field keeps whatever value/options it already had.
  }
}

// ─── Rubrica picker ───────────────────────────────────────────
// Debounced full-text search against the modern Rubrica_Search_Controller.
// Selecting a row fills local.* with the 9 main address fields + commits.
const pickerSel = ref<RubricaRow | null>(null);
const pickerItems = ref<RubricaRow[]>([]);
const pickerLoading = ref(false);
let pickerTimer: ReturnType<typeof setTimeout> | null = null;

function onRubricaSearch(q: string): void {
  if (pickerTimer) clearTimeout(pickerTimer);
  pickerTimer = setTimeout(async () => {
    const trimmed = (q ?? "").trim();
    if (trimmed.length < 2) {
      pickerItems.value = [];
      return;
    }
    pickerLoading.value = true;
    try {
      pickerItems.value = await rubricaService.search({
        text: trimmed,
        limit: 12,
      });
    } catch {
      pickerItems.value = [];
    } finally {
      pickerLoading.value = false;
    }
  }, 250);
}

async function onRubricaPick(row: RubricaRow | null): Promise<void> {
  if (!row) return;
  local.value = {
    ...local.value,
    name: row.name ?? "",
    address: row.adress ?? row.address ?? "",
    cap: row.cap ?? "",
    city: row.city ?? "",
    prov: row.prov ?? "",
    country: row.country ?? "",
    attention: row.contact_name ?? "",
    tel: row.tel ?? "",
  };
  // Buffer only — persisted on "Salva". Picking a row from the rubrica fills
  // the fields; the user still confirms with the button.
  markDirty();
  // Clear the autocomplete value so the same entry can be re-picked later.
  pickerSel.value = null;
}
</script>
