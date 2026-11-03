<template>
  <!--
    «Proyecto de origen» en la ficha del cargo (view=by_cargo). Si el API no
    tiene la vista, falla o el cargo no viene de ningún proyecto, no se pinta
    nada: la ficha del cargo no debe romperse por esto.
  -->
  <v-card v-if="items.length" border rounded="lg" class="mb-3">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-layers-triple-outline" size="18" class="me-2" />
      {{ t("consolidata.integration.sourceProject", items.length) }}
    </v-card-title>
    <v-divider />
    <v-list density="compact">
      <v-list-item
        v-for="p in items"
        :key="p.id"
        :to="{ name: 'consolidata-detail', params: { id: String(p.id) } }"
      >
        <v-list-item-title>#{{ p.id }} · {{ p.titolo }}</v-list-item-title>
        <v-list-item-subtitle v-if="p.cliente_nome">{{
          p.cliente_nome
        }}</v-list-item-subtitle>
        <template #append>
          <v-chip size="x-small" :color="stateColor(p.stato)" class="me-1">{{
            t(stateI18nKey(p.stato))
          }}</v-chip>
          <v-chip
            v-if="p.fase"
            size="x-small"
            variant="tonal"
            :color="phaseColor(p.fase)"
            >{{ t(phaseI18nKey(p.fase)) }}</v-chip
          >
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useProfile } from "@shared/composables/useProfile";
import { useAccess } from "@shared/composables/useAccess";
import { consolidataService } from "../services/consolidata.service";
import { phaseColor, phaseI18nKey, stateColor, stateI18nKey } from "../logic";
import type { ProjectRef } from "../types";

const props = defineProps<{ cargoId: number | string | null | undefined }>();
const { t } = useI18n();
const items = ref<ProjectRef[]>([]);

const { isAdmin, ensureProfile } = useProfile();
const { can } = useAccess();

async function load(id: number): Promise<void> {
  try {
    // Solo el personal con consolidation:manage (TMWE y partners) ve proyectos: a otros el API respondería 403 y el toast global saltaría.
    await ensureProfile();
    if (isAdmin.value !== true && !can("consolidation:manage")) return;
    const res = await consolidataService.byCargo(id);
    if (Number(props.cargoId) === id)
      items.value = Array.isArray(res.items) ? res.items : [];
  } catch {
    items.value = [];
  }
}

watch(
  () => Number(props.cargoId || 0),
  (id) => {
    items.value = [];
    if (id > 0) void load(id);
  },
  { immediate: true },
);
</script>
