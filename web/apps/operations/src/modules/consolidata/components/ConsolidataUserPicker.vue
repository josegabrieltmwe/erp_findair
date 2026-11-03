<template>
  <!-- Usuarios del staff (view=staff_users). Si el API no tiene la vista, la
       lista queda vacía y se explica en el `no-data`. -->
  <v-autocomplete
    :model-value="modelValue"
    :items="items"
    :loading="loading"
    item-title="nome"
    item-value="id"
    :label="label"
    density="comfortable"
    variant="outlined"
    clearable
    no-filter
    :no-data-text="
      failed
        ? t('consolidata.assign.unavailable')
        : t('consolidata.assign.noUsers')
    "
    prepend-inner-icon="mdi-account-tie"
    @update:search="onSearch"
    @update:model-value="
      emit('update:modelValue', $event ? Number($event) : null)
    "
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { consolidataService } from "../services/consolidata.service";
import type { StaffUser } from "../types";

defineProps<{ modelValue: number | null; label: string }>();
const emit = defineEmits<{
  (e: "update:modelValue", v: number | null): void;
}>();
const { t } = useI18n();

const items = ref<StaffUser[]>([]);
const loading = ref(false);
const failed = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

async function load(q: string): Promise<void> {
  loading.value = true;
  try {
    const res = await consolidataService.staffUsers(q);
    items.value = Array.isArray(res.items) ? res.items : [];
    failed.value = false;
  } catch {
    items.value = [];
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function onSearch(q: string | null): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void load((q ?? "").trim()), 250);
}

onMounted(() => void load(""));
</script>
