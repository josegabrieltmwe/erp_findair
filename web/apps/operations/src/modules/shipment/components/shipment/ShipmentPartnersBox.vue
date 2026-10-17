<template>
  <!-- embedded: the host ModalWrapper provides the dialog card + title. The
       inner v-dialog below ('Add partner') is a separate popup, not a frame. -->
  <component
    :is="embedded ? 'div' : VCard"
    v-bind="embedded ? {} : { border: true, rounded: 'lg' }"
  >
    <v-card-title
      v-if="!embedded"
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-account-group-outline" size="18" class="me-2" />
      {{ t("shipment.modals.partners.box_title") }}
      <v-chip
        v-if="payload"
        size="x-small"
        :color="payload.can_add ? 'success' : 'warning'"
        variant="tonal"
        class="ms-2"
      >
        {{
          t("shipment.modals.partners.visible_count", {
            count: payload.partners.length,
          })
        }}
      </v-chip>
      <v-spacer />
      <v-btn
        size="x-small"
        variant="text"
        prepend-icon="mdi-plus"
        :disabled="!payload?.can_add"
        :loading="adding"
        @click="addOpen = true"
      >
        {{ t("shipment.modals.partners.add_partner") }}
      </v-btn>
    </v-card-title>
    <!-- Embedded: compact action bar (chip + Add). -->
    <div v-else class="d-flex align-center mb-2">
      <v-chip
        v-if="payload"
        size="x-small"
        :color="payload.can_add ? 'success' : 'warning'"
        variant="tonal"
      >
        {{
          t("shipment.modals.partners.visible_count", {
            count: payload.partners.length,
          })
        }}
      </v-chip>
      <v-spacer />
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-plus"
        :disabled="!payload?.can_add"
        :loading="adding"
        @click="addOpen = true"
      >
        {{ t("shipment.modals.partners.add_partner") }}
      </v-btn>
    </div>
    <v-divider v-if="!embedded" />
    <component :is="embedded ? 'div' : VCardText">
      <v-progress-linear v-if="loading" indeterminate />
      <v-list
        v-else-if="payload && payload.partners.length > 0"
        density="compact"
      >
        <v-list-item
          v-for="p in payload.partners"
          :key="`${p.role}-${p.anagrafica_id}`"
          :title="
            p.rag_soc ||
            t('shipment.modals.partners.anagrafica_n', { id: p.anagrafica_id })
          "
          :subtitle="roleLabel(p.role)"
        >
          <template #prepend>
            <v-icon
              :icon="roleIcon(p.role)"
              :color="roleColor(p.role)"
              size="18"
            />
          </template>
          <template #append>
            <v-btn
              v-if="canRemove(p)"
              icon="mdi-close"
              size="x-small"
              variant="text"
              :loading="removingId === p.anagrafica_id"
              @click="onRemove(p.anagrafica_id)"
            />
          </template>
        </v-list-item>
      </v-list>
      <v-alert v-else type="info" variant="tonal" density="compact">
        {{ t("shipment.modals.partners.empty") }}
      </v-alert>
    </component>

    <v-dialog v-model="addOpen" max-width="520">
      <v-card>
        <v-card-title class="text-subtitle-1 d-flex align-center">
          <v-icon icon="mdi-account-multiple-plus-outline" class="me-2" />
          {{ t("shipment.modals.partners.add_title") }}
        </v-card-title>
        <v-divider />
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">
            {{ t("shipment.modals.partners.add_hint") }}
          </p>
          <!-- Búsqueda por nombre (antes: teclear el id a mano). Patrón cliente:
               :model-value one-way + onPick, mergedItems para que el título del
               seleccionado siempre resuelva. -->
          <v-autocomplete
            :model-value="addPartnerId"
            :items="mergedPartnerItems"
            :loading="searchingPartners"
            item-title="label"
            item-value="id"
            :label="t('shipment.modals.partners.search_label')"
            :placeholder="t('shipment.modals.partners.search_placeholder')"
            :no-data-text="t('shipment.modals.partners.no_results')"
            prepend-inner-icon="mdi-account-search"
            variant="outlined"
            density="comfortable"
            no-filter
            hide-no-data
            clearable
            autofocus
            @update:search="onPartnerSearch"
            @update:model-value="onPickPartner"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item
                v-bind="itemProps"
                :title="item.raw.name"
                :subtitle="item.raw.sub"
              >
                <template #prepend>
                  <v-chip
                    size="x-small"
                    :color="tipoColor(item.raw.tipo)"
                    variant="tonal"
                    class="me-2"
                  >
                    {{ tipoLabel(item.raw.tipo) }}
                  </v-chip>
                </template>
                <template #append>
                  <span class="text-caption text-medium-emphasis"
                    >#{{ item.raw.id }}</span
                  >
                </template>
              </v-list-item>
            </template>
          </v-autocomplete>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeAdd">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-check"
            :disabled="!addPartnerId || !shipmentId"
            :loading="adding"
            @click="onAdd"
          >
            {{ t("shipment.modals.partners.add") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </component>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { VCard, VCardText } from "vuetify/components";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import {
  partnersService,
  type PartnerEntry,
  type PartnerVisibilityPayload,
} from "@shipment/services/partners.service";
import {
  anagraficaService,
  type AnagraficaLite,
} from "@shared/services/anagrafica.service";

defineProps<{ embedded?: boolean }>();

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const toasts = useToastStore();

const shipmentId = computed<number | null>(() =>
  shipment.value ? Number(shipment.value.id) : null,
);

const payload = ref<PartnerVisibilityPayload | null>(null);
const loading = ref(false);
const adding = ref(false);
const removingId = ref<number | null>(null);

const addOpen = ref(false);
const addPartnerId = ref<number | null>(null);

// --- Autocomplete de partner (búsqueda por nombre) -------------------------
interface PartnerOption {
  id: number;
  label: string; // "Nombre · #id" (item-title, para el campo cerrado)
  name: string; // nombre para el título de la fila
  sub: string; // subtítulo: P.IVA · ciudad
  tipo: string; // C/F/P
}

const partnerItems = ref<PartnerOption[]>([]);
const selectedPartner = ref<PartnerOption | null>(null);
const searchingPartners = ref(false);

function toPartnerOption(a: AnagraficaLite): PartnerOption {
  const id = Number(a.id);
  const name = (a.rag_soc || a.nome_breve || `#${id}`).trim();
  const sub = [
    a.pi_cf ? `P.IVA ${a.pi_cf}` : "",
    [a.citta, a.id_paese_iso].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id,
    label: `${name} · #${id}`,
    name,
    sub,
    tipo: String(a.tipo ?? ""),
  };
}

// Fusiona resultados de búsqueda con la opción seleccionada, para que el
// título del elegido siempre resuelva aunque cambie la lista (patrón cliente).
const mergedPartnerItems = computed<PartnerOption[]>(() => {
  const sel = selectedPartner.value;
  if (!sel) return partnerItems.value;
  return partnerItems.value.some((i) => i.id === sel.id)
    ? partnerItems.value
    : [sel, ...partnerItems.value];
});

function tipoLabel(tipo: string): string {
  if (tipo === "P") return t("shipment.modals.partners.tipo_partner");
  if (tipo === "C") return t("shipment.modals.partners.tipo_client");
  if (tipo === "F") return t("shipment.modals.partners.tipo_supplier");
  return tipo || "—";
}
function tipoColor(tipo: string): string {
  if (tipo === "P") return "primary";
  if (tipo === "F") return "warning";
  return "default";
}

function onPickPartner(id: number | null): void {
  addPartnerId.value = id == null ? null : Number(id);
  selectedPartner.value =
    id == null
      ? null
      : (mergedPartnerItems.value.find((i) => i.id === Number(id)) ??
        selectedPartner.value);
}

let partnerSearchToken = 0;
async function onPartnerSearch(text: string): Promise<void> {
  const q = (text ?? "").trim();
  if (selectedPartner.value && q === selectedPartner.value.label) return;
  if (q.length < 2) {
    partnerItems.value = [];
    return;
  }
  const token = ++partnerSearchToken;
  searchingPartners.value = true;
  try {
    const rows = await anagraficaService.search(q);
    if (token === partnerSearchToken) {
      partnerItems.value = rows.map(toPartnerOption);
    }
  } finally {
    if (token === partnerSearchToken) searchingPartners.value = false;
  }
}

function closeAdd(): void {
  addOpen.value = false;
  addPartnerId.value = null;
  selectedPartner.value = null;
  partnerItems.value = [];
}

function roleLabel(role: PartnerEntry["role"]): string {
  switch (role) {
    case "titolare":
      return t("shipment.modals.partners.role_titolare");
    case "primary":
      return t("shipment.modals.partners.role_primary");
    case "show1":
      return t("shipment.modals.partners.role_show1");
    case "show2":
      return t("shipment.modals.partners.role_show2");
    default:
      return role;
  }
}

function roleIcon(role: PartnerEntry["role"]): string {
  switch (role) {
    case "titolare":
      return "mdi-crown-outline";
    case "primary":
      return "mdi-star-outline";
    default:
      return "mdi-eye-outline";
  }
}

function roleColor(role: PartnerEntry["role"]): string {
  switch (role) {
    case "titolare":
      return "warning";
    case "primary":
      return "primary";
    default:
      return "default";
  }
}

function canRemove(p: PartnerEntry): boolean {
  return p.role === "show1" || p.role === "show2";
}

async function load(): Promise<void> {
  if (!shipmentId.value) return;
  loading.value = true;
  try {
    const res = await partnersService.list(shipmentId.value);
    if (res.success && res.data) {
      payload.value = res.data;
    } else {
      payload.value = null;
      toasts.push(
        "error",
        res.error ?? t("shipment.modals.partners.load_failed"),
      );
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    loading.value = false;
  }
}

async function onAdd(): Promise<void> {
  if (!shipmentId.value || !addPartnerId.value) return;
  adding.value = true;
  try {
    const res = await partnersService.add(shipmentId.value, addPartnerId.value);
    if (res.success && res.data) {
      payload.value = res.data;
      toasts.push("success", t("shipment.modals.partners.added"));
      addOpen.value = false;
      addPartnerId.value = null;
    } else {
      toasts.push(
        "error",
        res.error ?? t("shipment.modals.partners.add_failed"),
      );
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    adding.value = false;
  }
}

async function onRemove(partner_id: number): Promise<void> {
  if (!shipmentId.value) return;
  removingId.value = partner_id;
  try {
    const res = await partnersService.remove(shipmentId.value, partner_id);
    if (res.success && res.data) {
      payload.value = res.data;
      toasts.push("success", t("shipment.modals.partners.removed"));
    } else {
      toasts.push(
        "error",
        res.error ?? t("shipment.modals.partners.remove_failed"),
      );
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    removingId.value = null;
  }
}

onMounted(() => void load());
watch(shipmentId, (id, oldId) => {
  if (id && id !== oldId) {
    void load();
  }
});
</script>
