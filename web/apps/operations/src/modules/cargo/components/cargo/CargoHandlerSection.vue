<template>
  <div>
    <!-- Sin título/icono: el modal ya los muestra en su cabecera. Solo la barra
         de acción (chip #id + botón "Del transportista"). -->
    <div class="d-flex align-center mb-2">
      <v-chip v-if="hasHandler" size="small" color="info" variant="tonal">
        #{{ handlerId.local }}
      </v-chip>
      <v-spacer />
      <!-- Legacy "Copia handler dal vettore" (spedyc_handl_set.php): resolves
           the carrier's default handler+sede and persists it on the cargo. -->
      <v-btn
        size="small"
        variant="flat"
        color="primary"
        rounded="lg"
        prepend-icon="mdi-truck-fast-outline"
        class="text-none"
        :loading="assigning"
        :title="t('cargo.handler.copy_default_tooltip')"
        @click="copyFromCarrier"
      >
        {{ t("cargo.handler.from_carrier") }}
      </v-btn>
    </div>
    <div>
      <v-alert
        v-if="assignNote"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-2"
      >
        {{ assignNote }}
      </v-alert>
      <v-row dense>
        <v-col cols="12" md="6">
          <!-- Handler: UN solo autocomplete (antes había un v-select + un
               v-text-field con v-if/v-else que confundía). Las opciones vienen
               de la tabla handlers del partner del terminal. -->
          <v-autocomplete
            v-model="handlerModel"
            :items="handlerItems"
            item-title="title"
            item-value="value"
            :label="t('cargo.handler.handler_id')"
            :loading="loadingHandlers"
            clearable
          />
        </v-col>
        <v-col cols="12" md="6">
          <!-- Handler office/sede: autocomplete dependiente del handler elegido
               (legacy cargovett_handl_sedi_ajax.php / HandlSedi). -->
          <v-autocomplete
            v-model="sedeModel"
            :items="sedeItems"
            item-title="title"
            item-value="value"
            :label="t('cargo.handler.handler_sede')"
            :loading="loadingSedi"
            :no-data-text="t('cargo.handler.sede_pick_handler')"
            clearable
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="handlerLimite.local"
            :label="t('cargo.handler.cargo_deadline')"
            type="datetime-local"
            @blur="handlerLimite.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="handlerCons.local"
            :label="t('cargo.handler.handover')"
            type="datetime-local"
            @blur="handlerCons.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <!-- Legacy cmqY_handler_uscita: date the goods left the handler.
               Native spedizioni_cargo column; PATCH whitelist already accepts it. -->
          <v-text-field
            v-model="handlerUscita.local"
            :label="t('cargo.handler.handler_exit')"
            type="datetime-local"
            @blur="handlerUscita.commit"
          />
        </v-col>
        <v-col cols="12">
          <v-textarea
            v-model="handlerNote.local"
            :label="t('cargo.handler.handler_note')"
            rows="2"
            auto-grow
            @blur="handlerNote.commit"
          />
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useFieldBinding } from "@cargo/composables/useFieldBinding";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import {
  cargoService,
  type HandlerSede,
  type HandlerOption,
} from "@cargo/services/cargo.service";

const { t } = useI18n();
const store = useCargoStore();
const toasts = useToastStore();

const handlerId = useFieldBinding("handler_id", "");
const handlerSede = useFieldBinding("handler_id_sede", "");
const handlerLimite = useFieldBinding("handler_data_limite", "");
const handlerCons = useFieldBinding("handler_data_cons", "");
const handlerUscita = useFieldBinding("handler_uscita", "");
const handlerNote = useFieldBinding("handler_note", "");

const hasHandler = computed(() => Number(handlerId.local) > 0);

const assigning = ref(false);
const assignNote = ref("");

// Handlers del partner del terminal (legacy select handler_id, spedyc_array.php).
const loadingHandlers = ref(false);
const handlers = ref<HandlerOption[]>([]);
const handlerItems = computed(() => {
  const items = handlers.value.map((h) => ({
    title: h.nome,
    value: String(h.id),
  }));
  // Preservar un handler_id ya seteado que no esté en la lista del partner
  // actual (paridad con el antiguo fallback a text-field): item sintético.
  const cur = String(handlerId.local || "");
  if (Number(cur) > 0 && !items.some((i) => i.value === cur)) {
    items.unshift({ title: `#${cur}`, value: cur });
  }
  return items;
});

/** Carga la lista de handlers para el select (por el terminal del cargo). */
async function loadHandlers(): Promise<void> {
  if (!store.id) return;
  loadingHandlers.value = true;
  try {
    handlers.value = await cargoService.listHandlers(store.id);
  } catch {
    handlers.value = [];
  } finally {
    loadingHandlers.value = false;
  }
}

// Modelo del autocomplete de handler: traduce 0/""/null → null (placeholder,
// no muestra "0") y de vuelta null → "" al persistir. Al elegir uno, guarda y
// recarga sus sedi (equivalente a HandlSedi del legacy). El valor viaja como
// string para casar con item-value (String(id)).
const handlerModel = computed<string | null>({
  get: () => {
    const n = Number(handlerId.local || 0);
    return n > 0 ? String(n) : null;
  },
  set: (v) => {
    handlerId.local = v == null ? "" : String(v);
    void (async () => {
      await handlerId.commit();
      // Al cambiar de handler, la sede anterior deja de ser válida → limpiar.
      handlerSede.local = "";
      await handlerSede.commit();
      await loadSedi(Number(handlerId.local));
    })();
  },
});

const sedeModel = computed<string | null>({
  get: () => {
    const n = Number(handlerSede.local || 0);
    return n > 0 ? String(n) : null;
  },
  set: (v) => {
    handlerSede.local = v == null ? "" : String(v);
    void handlerSede.commit();
  },
});

// Sedi of the currently-selected handler (legacy cargovett_handl_sedi_ajax.php).
const loadingSedi = ref(false);
const sedi = ref<HandlerSede[]>([]);
const sedeItems = computed(() => {
  const items = sedi.value.map((s) => ({
    title: s.nome_sede,
    value: String(s.id),
  }));
  const cur = String(handlerSede.local || "");
  if (Number(cur) > 0 && !items.some((i) => i.value === cur)) {
    items.unshift({ title: `#${cur}`, value: cur });
  }
  return items;
});

/** Load the handler's sedi to drive the sede select. */
async function loadSedi(idHandler: number): Promise<void> {
  if (!idHandler) {
    sedi.value = [];
    return;
  }
  loadingSedi.value = true;
  try {
    sedi.value = await cargoService.listHandlerSedi(idHandler);
  } catch {
    sedi.value = [];
  } finally {
    loadingSedi.value = false;
  }
}

onMounted(() => {
  void loadHandlers();
  if (Number(handlerId.local) > 0) void loadSedi(Number(handlerId.local));
});

/**
 * Copy the carrier's default handler+sede onto the cargo (legacy
 * spedyc_handl_set.php). Persists server-side, then reloads the cargo so the
 * handler fields reflect the resolved values.
 */
async function copyFromCarrier(): Promise<void> {
  if (!store.id) return;
  assigning.value = true;
  assignNote.value = "";
  try {
    const res = await cargoService.assignHandlerFromVettore(store.id);
    if (!res.success || !res.data) {
      toasts.push("error", res.error ?? t("cargo.handler.copy_failed"));
      return;
    }
    assignNote.value = res.data.note || "";
    // The assign already returns the resolved handler's sedi — use them to
    // populate the select without a second round-trip.
    if (Array.isArray(res.data.sedi)) {
      sedi.value = res.data.sedi.map((s) => ({
        id: Number(s.id),
        nome_sede: s.nome_sede,
      }));
    }
    await store.load(store.id);
    toasts.push(
      "success",
      t("cargo.handler.assigned", { id: res.data.handler_id }),
    );
  } catch (err) {
    toasts.push("error", (err as Error).message);
  } finally {
    assigning.value = false;
  }
}
</script>
