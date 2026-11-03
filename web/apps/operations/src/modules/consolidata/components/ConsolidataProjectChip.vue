<template>
  <!--
    Chip «En proyecto #N» en la cabecera de la expedición express
    (view=by_spedizione). Sin datos, sin la vista en el API o con error: no se
    pinta nada.
  -->
  <router-link
    v-if="first"
    :to="{ name: 'consolidata-detail', params: { id: String(first.id) } }"
    class="cons-chip-link"
  >
    <v-chip
      size="x-small"
      variant="tonal"
      color="secondary"
      prepend-icon="mdi-layers-triple-outline"
      :title="first.titolo"
    >
      {{ t("consolidata.integration.inProject", { id: first.id }) }}
      <span v-if="items.length > 1">&nbsp;+{{ items.length - 1 }}</span>
    </v-chip>
  </router-link>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useProfile } from "@shared/composables/useProfile";
import { consolidataService } from "../services/consolidata.service";
import type { ProjectRef } from "../types";

const props = defineProps<{ shipmentId: number | string | null | undefined }>();
const { t } = useI18n();
const items = ref<ProjectRef[]>([]);
const first = computed(() => items.value[0] ?? null);

const { isAdmin, ensureProfile } = useProfile();

async function load(id: number): Promise<void> {
  try {
    // Solo staff ve proyectos: a otros el API respondería 403 y el toast global saltaría.
    await ensureProfile();
    if (isAdmin.value !== true) return;
    const res = await consolidataService.bySpedizione(id);
    if (Number(props.shipmentId) === id)
      items.value = Array.isArray(res.items) ? res.items : [];
  } catch {
    items.value = [];
  }
}

watch(
  () => Number(props.shipmentId || 0),
  (id) => {
    items.value = [];
    if (id > 0) void load(id);
  },
  { immediate: true },
);
</script>

<style scoped>
.cons-chip-link {
  text-decoration: none;
}
</style>
