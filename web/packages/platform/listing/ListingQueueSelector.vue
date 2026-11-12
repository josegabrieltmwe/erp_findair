<template>
  <v-menu location="bottom start" :close-on-content-click="true">
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        variant="outlined"
        density="comfortable"
        prepend-icon="mdi-tray-full"
        append-icon="mdi-menu-down"
        data-testid="queue-selector"
        class="listing-queue-selector"
      >
        {{ currentLabel }}
      </v-btn>
    </template>
    <v-list density="compact" min-width="260" max-height="70vh">
      <v-list-item
        :active="!modelValue || modelValue === allKey"
        prepend-icon="mdi-format-list-bulleted"
        :title="allLabel"
        @click="emit('select', allKey)"
      />
      <template v-for="g in groups" :key="g.section">
        <v-divider />
        <v-list-subheader>{{ groupLabel(g.section) }}</v-list-subheader>
        <v-list-item
          v-for="q in g.items"
          :key="q.key"
          :active="modelValue === q.key"
          :prepend-icon="q.icon"
          :title="queueLabel(q.key, q.label)"
          :data-testid="`queue-${q.key}`"
          @click="emit('select', q.key)"
        />
      </template>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { QueueGroup } from "./queueCatalog";

const props = defineProps<{
  groups: readonly QueueGroup[];
  /** `type` activo del listado. */
  modelValue: string;
  /** Valor que significa «sin cola» (todas). */
  allKey: string;
  allLabel: string;
  /** Prefijo de claves i18n del nombre de cada cola: `${prefix}.${key}.label`. */
  labelKeyPrefix: string;
}>();

const emit = defineEmits<{ select: [key: string] }>();
const { t, te } = useI18n();

function queueLabel(key: string, fallback: string): string {
  const k = `${props.labelKeyPrefix}.${key}.label`;
  return te(k) ? (t(k) as string) : fallback;
}

function groupLabel(section: string): string {
  const k = `listing.queue.groups.${section}`;
  return te(k) ? (t(k) as string) : section;
}

const currentLabel = computed(() => {
  for (const g of props.groups) {
    const q = g.items.find((i) => i.key === props.modelValue);
    if (q) return queueLabel(q.key, q.label);
  }
  // Un tipo que no es una cola (p. ej. «en tránsito»): no se hace pasar por «todas».
  return !props.modelValue || props.modelValue === props.allKey
    ? props.allLabel
    : (t("listing.queue.label") as string);
});
</script>
