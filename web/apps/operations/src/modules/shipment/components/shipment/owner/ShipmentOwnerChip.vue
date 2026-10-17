<template>
  <v-menu
    v-if="hasInfo"
    v-model="menuOpen"
    :close-on-content-click="false"
    location="bottom start"
  >
    <template #activator="{ props: act }">
      <v-chip
        v-bind="act"
        size="x-small"
        variant="tonal"
        color="info"
        prepend-icon="mdi-account-circle-outline"
        :append-icon="canReassign ? 'mdi-pencil-outline' : undefined"
        style="cursor: pointer"
      >
        <span class="text-truncate" style="max-width: 140px">{{
          ownerDisplay
        }}</span>
        <v-tooltip activator="parent" location="bottom">
          <div>
            <div v-if="ownerLabel">
              <strong>{{ t("shipment.owner.created_by") }}</strong>
              {{ ownerLabel }}
            </div>
            <div v-if="insertDatetime">
              <strong>{{ t("shipment.owner.created_on") }}</strong>
              {{ insertDatetime }}
            </div>
            <div v-if="insertIp">
              <strong>{{ t("shipment.owner.ip") }}</strong> {{ insertIp }}
            </div>
          </div>
        </v-tooltip>
      </v-chip>
    </template>

    <v-card min-width="280" rounded="lg">
      <v-card-text class="pb-2">
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t("shipment.owner.reassign") }}
        </div>
        <v-autocomplete
          v-model="selected"
          :items="options"
          item-title="name"
          item-value="id"
          :loading="loading"
          :no-data-text="t('shipment.owner.no_users')"
          density="compact"
          variant="outlined"
          hide-details
          @update:menu="onOpen"
        />
      </v-card-text>
      <v-card-actions class="pt-0">
        <v-spacer />
        <v-btn size="small" variant="text" @click="menuOpen = false">{{
          t("common.cancel")
        }}</v-btn>
        <v-btn
          size="small"
          color="primary"
          variant="flat"
          :loading="saving"
          :disabled="!selected || selected === currentOwnerId"
          @click="reassign"
        >
          {{ t("common.save") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import {
  ownerService,
  type OwnerOption,
} from "@shipment/services/shipment.service";

const { t } = useI18n();
const store = useShipmentStore();
const row = computed(() => store.shipment as Record<string, unknown> | null);

const currentOwnerId = computed<number>(() =>
  Number(row.value?.owner_user ?? row.value?.insert_user ?? 0),
);
const insertDatetime = computed<string>(() =>
  String(row.value?.insert_datetime ?? ""),
);
const insertIp = computed<string>(() => String(row.value?.insert_IP ?? ""));
const hasInfo = computed(() =>
  Boolean(currentOwnerId.value || insertDatetime.value),
);

// Resolve the owner id → name once the options are loaded; until then show the
// raw id (legacy behaviour) so the chip never renders empty.
const options = ref<OwnerOption[]>([]);
const ownerLabel = computed<string>(() => {
  const match = options.value.find((o) => o.id === currentOwnerId.value);
  return (
    match?.name || (currentOwnerId.value ? String(currentOwnerId.value) : "")
  );
});
const ownerDisplay = computed(() => ownerLabel.value || "—");
const canReassign = computed(() => Boolean(store.id));

const menuOpen = ref(false);
const loading = ref(false);
const saving = ref(false);
const selected = ref<number | null>(null);

async function loadOptions(): Promise<void> {
  if (!store.id || loading.value) return;
  loading.value = true;
  try {
    const res = await ownerService.options(Number(store.id));
    options.value = res.options;
    selected.value = res.current_owner || currentOwnerId.value || null;
  } finally {
    loading.value = false;
  }
}

// Lazy-load the assignable list the first time the picker opens.
function onOpen(open: boolean): void {
  if (open && options.value.length === 0) void loadOptions();
}

async function reassign(): Promise<void> {
  if (!selected.value || selected.value === currentOwnerId.value) return;
  saving.value = true;
  try {
    const ok = await store.update({ owner_user: String(selected.value) });
    if (ok) menuOpen.value = false;
  } finally {
    saving.value = false;
  }
}
</script>
