<template>
  <component
    :is="embedded ? 'div' : 'v-card'"
    v-bind="embedded ? {} : { border: true, rounded: 'lg', class: 'h-100' }"
  >
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
      :class="{ 'px-0 pt-0': embedded }"
    >
      <!-- Título/icono se ocultan en modo embedded: el modal ya los muestra en
           su cabecera (evita duplicar la info y desperdiciar espacio). Los
           chips y botones de acción SÍ se conservan. -->
      <template v-if="!embedded">
        <v-icon :icon="icon" size="18" class="me-2" />
        {{ title }}
      </template>
      <!-- Origen heredado de la sede del cliente -->
      <v-chip
        v-if="isSedePickup"
        color="primary"
        size="small"
        variant="tonal"
        class="ms-2"
        prepend-icon="mdi-office-building-marker"
      >
        {{ t("cargo.addr.from_sede") }}
      </v-chip>
      <v-spacer />
      <v-chip
        v-if="isRemote === 'S' && !isSedePickup"
        color="warning"
        size="small"
        variant="tonal"
        prepend-icon="mdi-map-marker-radius"
      >
        {{ t("cargo.addr.remote") }}
      </v-chip>
      <!-- Presa: alternar entre sede y dirección propia -->
      <v-btn
        v-if="isSedePickup"
        size="small"
        variant="tonal"
        class="ms-2"
        prepend-icon="mdi-map-marker-plus-outline"
        :disabled="isAddressLocked"
        @click="switchToCustom"
      >
        {{ t("cargo.addr.use_other_address") }}
      </v-btn>
      <v-btn
        v-else-if="canReturnToSede"
        size="small"
        variant="tonal"
        class="ms-2"
        prepend-icon="mdi-office-building-marker"
        :loading="store.saving"
        :disabled="isAddressLocked"
        @click="switchToSede"
      >
        {{ t("cargo.addr.use_sede_address") }}
      </v-btn>
    </v-card-title>
    <v-divider v-if="!embedded" />

    <!--
      Vista solo-lectura de la sede. Paridad spedyc_form.php:65-71: además de la
      dirección, el legacy muestra los datos de recogida (presa fissa, hora,
      límite y email de la sede).
    -->
    <v-card-text v-if="isSedePickup">
      <div class="text-body-2">
        <div class="font-weight-medium">{{ sede?.label || "—" }}</div>
        <div>{{ sede?.indirizzo || "—" }}</div>
        <div>
          {{ [sede?.cap, sede?.citta, sede?.prov].filter(Boolean).join(" ") }}
          <span v-if="sede?.id_paese_iso">· {{ sede.id_paese_iso }}</span>
        </div>
      </div>

      <v-divider class="my-3" />

      <div class="d-flex flex-wrap ga-4 text-body-2">
        <div>
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.addr.presa_fissa") }}
          </div>
          <div>
            {{ sede?.presa_fissa === "S" ? t("common.yes") : t("common.no") }}
          </div>
        </div>
        <div v-if="sede?.presa_ora">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.addr.presa_ora") }}
          </div>
          <div>{{ sede.presa_ora }}</div>
        </div>
        <div v-if="sede?.presa_limite">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.addr.presa_limite") }}
          </div>
          <div>{{ sede.presa_limite }}</div>
        </div>
        <div v-if="sede?.mail">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.addr.email") }}
          </div>
          <div>{{ sede.mail }}</div>
        </div>
      </div>

      <p class="text-caption text-medium-emphasis mt-3 mb-0">
        {{ t("cargo.addr.from_sede_hint") }}
      </p>
    </v-card-text>

    <v-card-text v-else>
      <!-- Rubrica picker — paridad legacy `anagr_cerca_*` de spedyc_form
           (L489 destino, L517 presa, L541 agenzia doganale). -->
      <v-autocomplete
        v-model="pickerSel"
        :items="pickerItems"
        :loading="pickerLoading"
        item-title="name"
        return-object
        clearable
        density="compact"
        variant="outlined"
        no-filter
        hide-details
        :placeholder="t('cargo.addr.search_rubrica')"
        prepend-inner-icon="mdi-account-search"
        class="mb-4"
        :disabled="isReadonly"
        :menu-props="{ maxHeight: 340 }"
        @update:search="onRubricaSearch"
        @update:model-value="onRubricaPick"
        @focus="onRubricaFocus"
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

      <!-- Anagrafica: chi (paese, ragione sociale) -->
      <FormSection
        :title="t('cargo.addr.section_anagrafica')"
        icon="mdi-account-box-outline"
        flat
      >
        <v-row dense>
          <v-col cols="12" md="3">
            <CmCountrySelect
              :model-value="local.id_paese_iso"
              :label="t('cargo.addr.country_iso')"
              :disabled="isReadonly"
              @update:model-value="onCountryChange"
            />
          </v-col>
          <v-col cols="12" md="9">
            <v-text-field
              v-model="local.nome"
              :label="t('cargo.addr.name_company')"
              :readonly="isReadonly"
              density="compact"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- Indirizzo: dove (via, CAP, città, provincia) -->
      <FormSection
        :title="t('cargo.addr.section_indirizzo')"
        icon="mdi-map-marker-outline"
        flat
      >
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              v-model="local.adress"
              :label="t('cargo.addr.address')"
              :readonly="isReadonly"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="local.cap"
              :label="t('cargo.addr.cap_zip')"
              :readonly="isReadonly"
              :loading="capLoading"
              density="compact"
              @blur="onCapBlur"
            />
          </v-col>
          <v-col cols="12" :md="showAirport ? 6 : 6">
            <v-combobox
              v-model="local.citta"
              :items="citySuggestions"
              :label="t('cargo.addr.city')"
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
              :country="String(local.id_paese_iso ?? '')"
              mode="auto"
              :disabled="isReadonly"
              :label="t('cargo.addr.province_state')"
              density="compact"
            />
          </v-col>
          <!--
            Terminal (columna dhl_airport). En cargo NO es el "aeropuerto más
            cercano" del courier: es un terminal elegido por país
            (cargo_terminals), por eso variant="terminal" y ningún lookup
            derivado del CAP. El legacy spedyc_form no renderiza dhl_airport en
            los bloques de dirección — se conserva aquí porque la SPA ya lo
            venía guardando y la columna es común a express y cargo.
          -->
          <v-col v-if="showAirport" cols="12" md="4">
            <CmAddressAirport
              v-model="airportModel"
              variant="terminal"
              :country="String(local.id_paese_iso ?? '')"
              :label="t('cargo.addr.airport_iata')"
              :placeholder="t('common.select')"
              :disabled="isReadonly"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- Contatti: attenzione, telefono, cellulare, email -->
      <FormSection
        :title="t('cargo.addr.section_contatti')"
        icon="mdi-card-account-phone-outline"
        flat
        last
      >
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              v-model="local.attenzione"
              :label="t('cargo.addr.attention_name')"
              :readonly="isReadonly"
              density="compact"
              prepend-inner-icon="mdi-account-outline"
            />
          </v-col>
          <v-col cols="12" :md="showCell ? 4 : 6">
            <v-text-field
              v-model="local.tel"
              :label="t('cargo.addr.phone')"
              :readonly="isReadonly"
              density="compact"
              prepend-inner-icon="mdi-phone-outline"
            />
          </v-col>
          <!--
            `cell` NO existe en el bloque de destino, ni en cargo ni en courier:
            el legacy solo lo pinta en presa (_x2, spedyc_form L512) y en
            agenzia doganale (_x4, L538). Mismo criterio que
            ShipmentAddressBlock, que lo condiciona a tipo === 'P'.
          -->
          <v-col v-if="showCell" cols="12" md="4">
            <v-text-field
              v-model="local.cell"
              :label="t('cargo.addr.cell')"
              :readonly="isReadonly"
              density="compact"
              prepend-inner-icon="mdi-cellphone"
            />
          </v-col>
          <v-col cols="12" :md="showCell ? 4 : 6">
            <v-text-field
              v-model="local.mail"
              :label="t('cargo.addr.email')"
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
        v-if="tipo === 'D'"
        :country="String(local.id_paese_iso ?? '')"
        :cap="String(local.cap ?? '')"
        :city="String(local.citta ?? '')"
        class="mt-3"
      />
    </v-card-text>
  </component>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoState } from "@cargo/composables/useCargoState";
import { useRemoteAreaCheck } from "@cargo/composables/useRemoteAreaCheck";
import { geoService } from "@cargo/services/geo.service";
import {
  rubricaService,
  type RubricaRow,
} from "@cargo/services/rubrica.service";
import RouteStatsPanel from "@cargo/components/cargo/RouteStatsPanel.vue";
import FormSection from "@shared/ui/FormSection.vue";
import CmProvinciaSelect from "@shared/anagrafiche/components/CmProvinciaSelect.vue";
import CmCountrySelect from "@shared/anagrafiche/components/CmCountrySelect.vue";
import CmAddressAirport from "@shared/anagrafiche/components/CmAddressAirport.vue";
import type {
  CargoAddress,
  CargoAddressTipo,
} from "@cargo/services/cargo.service";

const props = defineProps<{
  tipo: CargoAddressTipo;
  title: string;
  icon: string;
  /** Dentro de un modal (que ya muestra título/icono): oculta el header
      redundante y el marco de card para integrarse sin duplicar. */
  embedded?: boolean;
}>();

const { t } = useI18n();
const store = useCargoStore();
const { cargo, destination, pickup, agency, handler, sede, usesSedeAddress } =
  storeToRefs(store);
const { readonly: ro, isAddressLocked } = useCargoState(cargo);
const { remote: isRemote, check } = useRemoteAreaCheck();

// ─── Modo sede (solo presa) ──────────────────────────────────
// Cargo no tiene `presa_tipo`: el origen es la sede cuando NO hay fila de
// presa activa (spedyc_form.php:74). `customMode` deja salir de esa vista
// para teclear una dirección propia sin persistir nada todavía.
const customMode = ref(false);
const isSedePickup = computed(
  () =>
    props.tipo === "P" &&
    usesSedeAddress.value &&
    sede.value !== null &&
    !customMode.value,
);
/** Volver a la sede solo tiene sentido si el cargo tiene una asociada. */
const canReturnToSede = computed(
  () => props.tipo === "P" && sede.value !== null && !usesSedeAddress.value,
);

const isReadonly = computed(() => isAddressLocked.value || ro("id_cliente"));

// ─── Variación por tipo (paridad spedyc_form) ────────────────
// El legacy no pinta los mismos campos en los tres bloques:
//   _x1 destino  → sin cell
//   _x2 presa    → con cell
//   _x4 agenzia  → con cell
// El handler ('H') no tiene bloque de dirección en el legacy (se elige por
// desplegable handler_id/handler_id_sede), pero la SPA sí lo edita como
// dirección; se le da el mismo trato que a la agenzia.
const showCell = computed(() => props.tipo !== "D");
// El terminal solo tiene sentido en los extremos de la ruta (destino/presa);
// una agenzia doganale o un handler no son un terminal de vuelo.
const showAirport = computed(() => props.tipo === "D" || props.tipo === "P");

const local = ref<Partial<CargoAddress>>({
  id_paese_iso: "",
  nome: "",
  adress: "",
  cap: "",
  citta: "",
  prov: "",
  dhl_airport: "",
  attenzione: "",
  tel: "",
  cell: "",
  mail: "",
});
const citySuggestions = ref<string[]>([]);
const capLoading = ref(false);

// Airport binding: the legacy stores "0" (or empty) for "no airport"; the
// terminal select needs a null to show its placeholder. Normalize "0"/"" ↔ null.
// (CmAddressAirport also normalizes for render; this side owns markDirty.)
const airportModel = computed<string | null>({
  get: () => {
    const a = String(local.value.dhl_airport ?? "");
    return a === "" || a === "0" ? null : a;
  },
  set: (v: string | null) => {
    local.value.dhl_airport = v ?? "";
    markDirty();
  },
});

const sourceAddress = computed<CargoAddress | null>(() => {
  switch (props.tipo) {
    case "D":
      return destination.value;
    case "P":
      return pickup.value;
    case "A":
      return agency.value;
    case "H":
      return handler.value;
  }
  return null;
});

watch(
  sourceAddress,
  (a) => {
    local.value = a
      ? {
          id: a.id,
          id_paese_iso: a.id_paese_iso ?? "",
          nome: a.nome ?? "",
          adress: a.adress ?? "",
          cap: a.cap ?? "",
          citta: a.citta ?? "",
          prov: a.prov ?? "",
          dhl_airport:
            a.dhl_airport && a.dhl_airport !== "0" ? a.dhl_airport : "",
          attenzione: a.attenzione ?? "",
          tel: a.tel ?? "",
          cell: a.cell ?? "",
          mail: a.mail ?? "",
        }
      : {
          id_paese_iso: "",
          nome: "",
          adress: "",
          cap: "",
          citta: "",
          prov: "",
          dhl_airport: "",
          attenzione: "",
          tel: "",
          cell: "",
          mail: "",
        };
    // Reset dirty: the buffer now mirrors the store, nothing pending.
    dirty.value = false;
    // Si el backend ya devuelve una fila de presa, el origen dejó de heredarse
    // de la sede: el modo local sobra.
    if (a) customMode.value = false;
    // CmAddressAirport (variant terminal) loads its own options from
    // cargo_terminals by country; no local seeding needed.
  },
  { immediate: true, deep: true },
);

async function lookupCap(): Promise<void> {
  const country = String(local.value.id_paese_iso ?? "").toUpperCase();
  const cap = String(local.value.cap ?? "").trim();
  if (!country || cap.length < 3) return;
  capLoading.value = true;
  try {
    const r = await geoService.lookupCap({ country, cap });
    citySuggestions.value = r.cities ?? [];
    // Legacy checkCapExe deriva SIEMPRE la provincia del CAP (sobrescribe lo
    // previo). Respetamos el valor anterior solo si el lookup no la resuelve.
    if (r.prov_short) {
      local.value.prov = String(r.prov_short);
    }
    // CAP con una única ciudad → autocompletar (legacy fija la ciudad cuando la
    // lista trae 1 sola; con varias, ofrece el combobox = citySuggestions).
    if ((r.cities?.length ?? 0) === 1 && r.cities[0]) {
      local.value.citta = r.cities[0];
    }
    // Nota: en cargo el aeropuerto NO se deriva del CAP. A diferencia del
    // courier (dhl_airport = aeropuerto más cercano), el cargo usa un TERMINAL
    // por país (cargo_terminals, legacy terminal_dest/terminal_part), que el
    // usuario elige en CmAddressAirport variant="terminal".
  } finally {
    capLoading.value = false;
  }
}

// Edit-in-buffer: typing no longer persists. The parent address modal calls
// save() from its "Salva" button; closing without saving discards the buffer.
const dirty = ref(false);
function markDirty(): void {
  dirty.value = true;
}

/** Persist the buffered address. Returns false on failure. */
async function save(): Promise<boolean> {
  if (isReadonly.value) return true;
  // En modo sede no hay nada que guardar: la ausencia de fila ES el estado.
  if (isSedePickup.value) return true;
  const ok = await store.saveAddress(props.tipo, local.value);
  if (ok) {
    dirty.value = false;
    // Guardar una presa propia crea la fila 'P': el backend ya no la considera
    // heredada de la sede, así que salimos del modo local.
    customMode.value = false;
  }
  return ok;
}

// -- Origen sede ↔ dirección propia (solo presa) ---------------------------

/**
 * "Usa otra dirección": vacía los campos y habilita la edición. No persiste
 * nada hasta pulsar "Salva" — es entonces cuando se crea la fila 'P' y el
 * origen deja de heredarse de la sede.
 */
function switchToCustom(): void {
  local.value = {
    id_paese_iso: "",
    nome: "",
    adress: "",
    cap: "",
    citta: "",
    prov: "",
    dhl_airport: "",
    attenzione: "",
    tel: "",
    cell: "",
    mail: "",
  };
  citySuggestions.value = [];
  customMode.value = true;
  dirty.value = true;
}

/**
 * "Usa la dirección de la sede": el backend archiva la fila 'P' y el origen
 * vuelve a heredarse de sedi_interne. Recarga las direcciones.
 */
async function switchToSede(): Promise<void> {
  customMode.value = false;
  await store.useSedeAsOrigin();
}

defineExpose({ save, dirty });

async function onCapBlur(): Promise<void> {
  markDirty();
  const country = String(local.value.id_paese_iso ?? "").toUpperCase();
  const cap = local.value.cap ?? "";
  if (country && cap) {
    // Lookups only (CAP→city + remote-area). Persistence happens on "Salva".
    await Promise.all([
      lookupCap(),
      check(
        country,
        String(cap),
        String(local.value.citta ?? ""),
        props.tipo === "D" ? "x1" : "x2",
      ),
    ]);
  }
}

async function onCityChange(): Promise<void> {
  markDirty();
  const country = String(local.value.id_paese_iso ?? "").toUpperCase();
  if (!country) return;
  await check(
    country,
    String(local.value.cap ?? ""),
    String(local.value.citta ?? ""),
    props.tipo === "D" ? "x1" : "x2",
  );
}

/**
 * Country change — mirrors the legacy `checkStati`. Changing the country
 * invalidates the CAP-derived fields (cap, città, provincia) and the airport
 * (terminal por país); clear them so stale values are not persisted.
 * CmProvinciaSelect and CmAddressAirport regenerate their options from the new
 * country (both watch `country`).
 */
function onCountryChange(v: string | null): void {
  const next = (v ?? "").toUpperCase();
  const prev = String(local.value.id_paese_iso ?? "").toUpperCase();
  local.value.id_paese_iso = v ?? "";
  if (next === prev) return;
  local.value.cap = "";
  local.value.citta = "";
  local.value.prov = "";
  local.value.dhl_airport = "";
  citySuggestions.value = [];
  markDirty();
}

// ─── Rubrica picker ───────────────────────────────────────────
// Debounced full-text search against the modern Rubrica_Search_Controller.
// Selecting a row fills the buffer; the user still confirms with "Salva".
const pickerSel = ref<RubricaRow | null>(null);
const pickerItems = ref<RubricaRow[]>([]);
const pickerLoading = ref(false);
let pickerTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Ejecuta la búsqueda de rúbrica. Con texto vacío devuelve el listado por
 * defecto (preferidos primero, hasta `limit`) — paridad legacy (sin `keyI`,
 * rubrica.php hace `LIMIT 0,50` ordenado por preferito) — para que el
 * autocomplete muestre opciones al abrirlo, sin escribir.
 */
async function runRubricaSearch(text: string): Promise<void> {
  pickerLoading.value = true;
  try {
    pickerItems.value = await rubricaService.search({
      text,
      limit: text ? 12 : 50,
      // Paridad legacy: la rúbrica es la del CLIENTE de la expedición
      // (rubrica.php?idcli=<id_cliente>), no la del operador de sesión.
      id_cliente: Number(cargo.value?.id_cliente) || undefined,
    });
  } catch {
    pickerItems.value = [];
  } finally {
    pickerLoading.value = false;
  }
}

function onRubricaSearch(q: string): void {
  if (pickerTimer) clearTimeout(pickerTimer);
  const trimmed = (q ?? "").trim();
  pickerTimer = setTimeout(() => void runRubricaSearch(trimmed), 250);
}

/** Precarga el listado por defecto al abrir el menú (si aún no hay items). */
function onRubricaFocus(): void {
  if (pickerItems.value.length === 0 && !pickerLoading.value) {
    void runRubricaSearch("");
  }
}

/**
 * RubricaRow viene con nombres "modernos" (city/country/contact_name); las
 * direcciones de cargo usan directamente los nombres de columna legacy
 * (citta/id_paese_iso/attenzione), de ahí el mapeo explícito.
 */
function onRubricaPick(row: RubricaRow | null): void {
  if (!row) return;
  local.value = {
    ...local.value,
    nome: row.name ?? "",
    adress: row.adress ?? row.address ?? "",
    cap: row.cap ?? "",
    citta: row.city ?? "",
    prov: row.prov ?? "",
    id_paese_iso: row.country ?? "",
    attenzione: row.contact_name ?? "",
    tel: row.tel ?? "",
  };
  markDirty();
  // Clear the autocomplete value so the same entry can be re-picked later.
  pickerSel.value = null;
}
</script>
