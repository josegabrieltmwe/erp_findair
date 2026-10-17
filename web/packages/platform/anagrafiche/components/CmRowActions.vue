<template>
  <div class="cm-row-actions">
    <!-- Acción primaria (por defecto 'edit') sacada FUERA del menú como botón
         icono visible: es la acción más usada en cada fila. -->
    <v-btn
      v-if="primaryAction"
      :icon="primaryAction.icon"
      size="small"
      variant="tonal"
      :color="primaryAction.color ?? 'primary'"
      :disabled="primaryAction.disabled"
      :loading="primaryAction.loading"
      :title="primaryAction.title"
      :aria-label="primaryAction.title"
      class="cm-row-actions__primary"
      @click="primaryAction.onClick"
    />
    <!-- Resto de acciones en el menú kebab. Se oculta si no queda ninguna. -->
    <v-menu v-if="menuActions.length" location="bottom end">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          :icon="mdiDotsVertical"
          size="small"
          variant="text"
          :title="t('common.actions')"
          :aria-label="t('common.actions')"
        />
      </template>
      <v-list density="compact" min-width="200">
        <template v-for="(action, i) in menuActions" :key="action.key ?? i">
          <v-divider v-if="action.divider" class="my-1" />
          <v-list-item
            :disabled="action.disabled"
            :base-color="action.color"
            @click="action.onClick"
          >
            <template #prepend>
              <v-progress-circular
                v-if="action.loading"
                indeterminate
                size="18"
                width="2"
                class="mr-2"
              />
              <v-icon v-else :icon="action.icon" size="small" class="mr-2" />
            </template>
            <v-list-item-title>{{ action.title }}</v-list-item-title>
          </v-list-item>
        </template>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiDotsVertical } from '@mdi/js';

/** Una acción del menú contextual de una fila. */
export interface RowAction {
  /** Clave estable para el v-for (opcional). */
  key?: string;
  /** Texto visible del ítem. */
  title: string;
  /** Path del icono mdi (@mdi/js). */
  icon: string;
  /** Handler del click. */
  onClick: () => void;
  /** Color semántico del ítem (p.ej. 'error'). */
  color?: string;
  /** Deshabilita el ítem. */
  disabled?: boolean;
  /** Muestra spinner en lugar del icono. */
  loading?: boolean;
  /** Oculta el ítem por completo. */
  hidden?: boolean;
  /** Dibuja un separador ANTES de este ítem. */
  divider?: boolean;
}

const props = withDefaults(
  defineProps<{
    actions: RowAction[];
    /**
     * Clave de la acción que se saca FUERA del menú como botón visible.
     * Default 'edit' (la acción más usada). `null` = todo dentro del kebab.
     */
    primaryKey?: string | null;
  }>(),
  { primaryKey: 'edit' },
);
const { t } = useI18n();

const visibleActions = computed(() => props.actions.filter((a) => !a.hidden));
// La acción primaria (por key) se muestra como botón fuera; el resto en el menú.
const primaryAction = computed(() =>
  props.primaryKey == null
    ? undefined
    : visibleActions.value.find((a) => a.key === props.primaryKey),
);
const menuActions = computed(() =>
  visibleActions.value.filter((a) => a !== primaryAction.value),
);
</script>

<style scoped>
.cm-row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
</style>
