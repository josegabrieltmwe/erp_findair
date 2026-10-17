<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-account-group-outline" size="18" class="me-2" />
      {{ t("cargo.partners.title") }}
      <v-chip
        v-if="payload"
        size="x-small"
        :color="payload.can_add ? 'success' : 'warning'"
        variant="tonal"
        class="ms-2"
      >
        {{ payload.partners.length }} / 4
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
        {{ t("cargo.partners.add") }}
      </v-btn>
    </v-card-title>
    <v-divider />
    <v-card-text>
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
            t('cargo.partners.anagrafica_num', { id: p.anagrafica_id })
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
        {{ t("cargo.partners.none") }}
      </v-alert>
    </v-card-text>

    <!-- Add partner dialog. Autocomplete remoto (tipo=PRT) que busca partners
         por rag_soc y devuelve la anagrafica completa; se muestra el rag_soc y
         se usa el id para el alta. Patrón de MawbAddressBlock. -->
    <v-dialog v-model="addOpen" max-width="480">
      <v-card>
        <v-card-title class="text-subtitle-1">{{
          t("cargo.partners.add_dialog_title")
        }}</v-card-title>
        <v-divider />
        <v-card-text>
          <v-autocomplete
            :model-value="selectedPartner"
            :items="pickerItems"
            :loading="pickerLoading"
            item-title="rag_soc"
            :item-value="(row: AnagraficaPickerRow) => row.id"
            return-object
            clearable
            autofocus
            density="compact"
            variant="outlined"
            :label="t('cargo.partners.add_search_label')"
            :placeholder="t('cargo.partners.add_search_placeholder')"
            prepend-inner-icon="mdi-account-search"
            hide-no-data
            no-filter
            :hint="t('cargo.partners.add_hint')"
            persistent-hint
            @update:search="onPickerSearch"
            @update:model-value="onPickerPick"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item
                v-bind="itemProps"
                :title="item.raw.rag_soc"
                :subtitle="
                  t('cargo.partners.anagrafica_num', { id: item.raw.id })
                "
              />
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
            :disabled="!selectedPartner || !cargoId"
            :loading="adding"
            @click="onAdd"
          >
            {{ t("cargo.charges.add") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import {
  partnersService,
  type PartnerEntry,
  type PartnerVisibilityPayload,
} from "@cargo/services/partners.service";
import { anagraficaPickerService } from "@cargo/services/cargo_mawb.service";
import type { AnagraficaPickerRow } from "@cargo/services/cargo_mawb.types";

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const toasts = useToastStore();

const cargoId = computed<number | null>(() =>
  cargo.value ? Number(cargo.value.id) : null,
);

const payload = ref<PartnerVisibilityPayload | null>(null);
const loading = ref(false);
const adding = ref(false);
const removingId = ref<number | null>(null);

const addOpen = ref(false);

// Autocomplete de partner (tipo=PRT). `selectedPartner` guarda la fila completa
// (id + rag_soc + address); el alta usa selectedPartner.id.
const selectedPartner = ref<AnagraficaPickerRow | null>(null);
const pickerItems = ref<AnagraficaPickerRow[]>([]);
const pickerLoading = ref(false);
let pickerDebounce: ReturnType<typeof setTimeout> | null = null;

function onPickerSearch(q: string): void {
  const query = (q ?? "").trim();
  if (pickerDebounce) clearTimeout(pickerDebounce);
  if (query.length < 2) {
    pickerItems.value = [];
    return;
  }
  pickerDebounce = setTimeout(async () => {
    pickerLoading.value = true;
    try {
      pickerItems.value = await anagraficaPickerService.search(
        query,
        "PRT",
        20,
      );
    } catch {
      pickerItems.value = [];
    } finally {
      pickerLoading.value = false;
    }
  }, 250);
}

function onPickerPick(row: AnagraficaPickerRow | null): void {
  selectedPartner.value = row;
}

function closeAdd(): void {
  addOpen.value = false;
  selectedPartner.value = null;
  pickerItems.value = [];
}

function roleLabel(role: PartnerEntry["role"]): string {
  switch (role) {
    case "titolare":
      return t("cargo.partners.role_titolare");
    case "primary":
      return t("cargo.partners.role_primary");
    case "show1":
      return t("cargo.partners.role_show1");
    case "show2":
      return t("cargo.partners.role_show2");
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
  // Only show1/show2 are removable from this endpoint; titolare and
  // primary are structural — touch them elsewhere.
  return p.role === "show1" || p.role === "show2";
}

async function load(): Promise<void> {
  if (!cargoId.value) return;
  loading.value = true;
  try {
    const res = await partnersService.list(cargoId.value);
    if (res.success && res.data) {
      payload.value = res.data;
    } else {
      payload.value = null;
      toasts.push("error", res.error ?? t("cargo.partners.load_failed"));
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    loading.value = false;
  }
}

async function onAdd(): Promise<void> {
  if (!cargoId.value || !selectedPartner.value) return;
  adding.value = true;
  try {
    const res = await partnersService.add(
      cargoId.value,
      selectedPartner.value.id,
    );
    if (res.success && res.data) {
      payload.value = res.data;
      toasts.push("success", t("cargo.partners.added"));
      closeAdd();
    } else {
      toasts.push("error", res.error ?? t("cargo.partners.add_failed"));
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    adding.value = false;
  }
}

async function onRemove(partner_id: number): Promise<void> {
  if (!cargoId.value) return;
  removingId.value = partner_id;
  try {
    const res = await partnersService.remove(cargoId.value, partner_id);
    if (res.success && res.data) {
      payload.value = res.data;
      toasts.push("success", t("cargo.partners.removed"));
    } else {
      toasts.push("error", res.error ?? t("cargo.partners.remove_failed"));
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    removingId.value = null;
  }
}

onMounted(() => void load());
watch(cargoId, (id, oldId) => {
  if (id && id !== oldId) {
    void load();
  }
});
</script>
