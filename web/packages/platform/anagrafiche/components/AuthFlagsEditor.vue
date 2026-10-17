<template>
  <div class="auth-flags-editor">
    <!-- CAPABILITIES SECTION -->
    <div v-if="capabilityFlags.length > 0" class="afe-section">
      <div class="afe-section-title">
        <v-icon size="small" :icon="mdiShieldKey" class="mr-2" />
        {{ t('users.auth_flags.capabilities_title') }}
      </div>
      <div class="afe-section-subtitle">
        {{ t('users.auth_flags.capabilities_subtitle') }}
      </div>

      <div class="afe-flags-grid">
        <div
          v-for="flag in capabilityFlags"
          :key="flag.id"
          class="afe-flag-row"
          :class="{ 'afe-flag-active': model[flag.id] === 'S' }"
        >
          <v-checkbox
            :model-value="model[flag.id] === 'S'"
            :disabled="disabled"
            color="primary"
            density="compact"
            hide-details
            @update:model-value="(v) => onToggle(flag.id, v)"
          >
            <template #label>
              <div class="afe-flag-label">
                <span class="afe-flag-name">{{ flag.cap.display_name }}</span>
                <v-chip size="x-small" variant="tonal" class="ml-2 afe-flag-tag">
                  {{ flag.id }}
                </v-chip>
              </div>
            </template>
          </v-checkbox>

          <v-tooltip
            v-if="flag.cap.description || flag.cap.introduces.length > 0"
            location="right"
            max-width="420"
          >
            <template #activator="{ props: tipProps }">
              <v-icon
                v-bind="tipProps"
                size="small"
                :icon="mdiInformationOutline"
                class="afe-info-icon"
                tabindex="0"
                role="button"
                :aria-label="t('users.auth_flags.tooltip_aria', { flag: flag.id })"
              />
            </template>
            <div class="afe-tooltip">
              <p class="afe-tooltip-desc">{{ flag.cap.description }}</p>
              <template v-if="flag.cap.introduces.length > 0">
                <div class="afe-tooltip-section-title">
                  {{ t('users.auth_flags.tooltip_introduces') }}
                </div>
                <ul class="afe-tooltip-list">
                  <li
                    v-for="perm in flag.cap.introduces"
                    :key="perm"
                    class="afe-tooltip-perm"
                  >
                    {{ perm }}
                  </li>
                </ul>
              </template>
              <div v-if="flag.cap.bypasses.length > 0" class="afe-tooltip-meta">
                <strong>{{ t('users.auth_flags.tooltip_bypasses') }}:</strong>
                {{ flag.cap.bypasses.join(', ') }}
              </div>
              <div v-if="flag.cap.notes" class="afe-tooltip-notes">
                {{ flag.cap.notes }}
              </div>
            </div>
          </v-tooltip>
        </div>
      </div>
    </div>

    <!-- DATA FILTERS SECTION -->
    <div v-if="filterFlags.length > 0" class="afe-section">
      <div class="afe-section-title">
        <v-icon size="small" :icon="mdiFilter" class="mr-2" />
        {{ t('users.auth_flags.filters_title') }}
      </div>
      <div class="afe-section-subtitle">
        {{ t('users.auth_flags.filters_subtitle') }}
      </div>

      <div class="afe-flags-grid">
        <div
          v-for="flag in filterFlags"
          :key="flag.id"
          class="afe-flag-row"
          :class="{ 'afe-flag-active': model[flag.id] === 'S' }"
        >
          <v-checkbox
            :model-value="model[flag.id] === 'S'"
            :disabled="disabled || flagBypassedActive(flag)"
            color="warning"
            density="compact"
            hide-details
            @update:model-value="(v) => onToggle(flag.id, v)"
          >
            <template #label>
              <div class="afe-flag-label">
                <span class="afe-flag-name">{{ flag.cap.display_name }}</span>
                <v-chip size="x-small" variant="tonal" class="ml-2 afe-flag-tag">
                  {{ flag.id }}
                </v-chip>
                <v-chip
                  v-if="flagBypassedActive(flag)"
                  size="x-small"
                  color="info"
                  variant="tonal"
                  class="ml-2"
                >
                  {{ t('users.auth_flags.bypassed_label') }}
                </v-chip>
              </div>
            </template>
          </v-checkbox>

          <v-tooltip location="right" max-width="420">
            <template #activator="{ props: tipProps }">
              <v-icon
                v-bind="tipProps"
                size="small"
                :icon="mdiInformationOutline"
                class="afe-info-icon"
                tabindex="0"
                role="button"
              />
            </template>
            <div class="afe-tooltip">
              <p class="afe-tooltip-desc">{{ flag.cap.description }}</p>
              <div v-if="flag.cap.filter_sql" class="afe-tooltip-sql">
                <strong>SQL:</strong>
                <code>{{ flag.cap.filter_sql }}</code>
              </div>
              <div v-if="flag.cap.bypassed_by.length > 0" class="afe-tooltip-meta">
                <strong>{{ t('users.auth_flags.tooltip_bypassed_by') }}:</strong>
                {{ flag.cap.bypassed_by.join(', ') }}
              </div>
            </div>
          </v-tooltip>
        </div>
      </div>
    </div>

    <!-- REDUNDANCY / WARNING ALERTS -->
    <v-alert
      v-if="hasRedundantBilling"
      type="info"
      variant="tonal"
      density="compact"
      class="mt-3"
      :icon="mdiInformation"
    >
      {{ t('users.auth_flags.warning_auth18_covers_auth20') }}
    </v-alert>

    <v-alert
      v-if="hasFilterBypass"
      type="info"
      variant="tonal"
      density="compact"
      class="mt-3"
      :icon="mdiInformation"
    >
      {{ t('users.auth_flags.warning_filters_bypassed') }}
    </v-alert>

    <!-- DIRTY INDICATOR (for parent to know there are unsaved changes) -->
    <div v-if="dirty" class="afe-dirty-indicator">
      <v-icon size="x-small" :icon="mdiPencilOutline" class="mr-1" />
      {{ t('users.auth_flags.dirty_indicator') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiShieldKey,
  mdiFilter,
  mdiInformationOutline,
  mdiInformation,
  mdiPencilOutline,
} from '@mdi/js';
import { useAuthCapabilities, type AuthCapability } from '../composables/useAuthCapabilities';

/**
 * Plan v5 F1-F2: AuthFlagsEditor
 *
 * Editor de los 15 flags contatti.auth_10..auth_24 con vocabulario semántico
 * (display_name + tooltips) en lugar de identificadores opacos (auth_18).
 *
 * Reemplaza los v-chip read-only del UserSecurityPanel.vue legacy.
 *
 * Modelo:
 *   v-model = { auth_10: 'S'|'N', auth_18: 'S'|'N', ... }
 *
 * Emisiones:
 *   update:modelValue  — cambio en el objeto completo
 *   change             — { flag: string, before: string, after: string }
 *   dirty              — boolean: hay cambios desde el último prop modelValue
 */

const { t } = useI18n();
const { activeFlags, getByFlag } = useAuthCapabilities();

type FlagValue = 'S' | 'N';
type FlagsModel = Record<string, FlagValue>;

interface FlagDescriptor {
  id: string;
  cap: AuthCapability;
}

const props = withDefaults(
  defineProps<{
    modelValue: FlagsModel;
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: FlagsModel): void;
  (e: 'change', diff: { flag: string; before: FlagValue; after: FlagValue }): void;
  (e: 'dirty', isDirty: boolean): void;
}>();

// Internal working copy + baseline for dirty detection.
const model = ref<FlagsModel>({ ...props.modelValue });
const baseline = ref<FlagsModel>({ ...props.modelValue });

watch(
  () => props.modelValue,
  (next) => {
    // Parent reassigned (e.g. after save) → reset baseline.
    model.value = { ...next };
    baseline.value = { ...next };
  },
  { deep: true },
);

const dirty = computed(() => {
  for (const flag of activeFlags.value) {
    const a = model.value[flag] ?? 'N';
    const b = baseline.value[flag] ?? 'N';
    if (a !== b) return true;
  }
  return false;
});

watch(dirty, (v) => emit('dirty', v));

// Build typed descriptors for the template.
const flagDescriptors = computed<FlagDescriptor[]>(() => {
  return activeFlags.value
    .map((id) => {
      const cap = getByFlag(id);
      return cap ? { id, cap } : null;
    })
    .filter((d): d is FlagDescriptor => d !== null);
});

const capabilityFlags = computed(() =>
  flagDescriptors.value.filter((f) => f.cap.type === 'capability'),
);
const filterFlags = computed(() =>
  flagDescriptors.value.filter((f) => f.cap.type === 'filter'),
);

// Redundancy / bypass warnings.
const hasRedundantBilling = computed(
  () => model.value['auth_18'] === 'S' && model.value['auth_20'] === 'S',
);
const hasFilterBypass = computed(() => {
  // auth_18 bypassa auth_21 + auth_22
  return (
    model.value['auth_18'] === 'S' &&
    (model.value['auth_21'] === 'S' || model.value['auth_22'] === 'S')
  );
});

function flagBypassedActive(flag: FlagDescriptor): boolean {
  // If any of the bypassed_by flags is active, this filter is effectively no-op.
  for (const otherId of flag.cap.bypassed_by) {
    if (model.value[otherId] === 'S') return true;
  }
  return false;
}

function onToggle(flagId: string, newChecked: boolean | null): void {
  const before: FlagValue = model.value[flagId] ?? 'N';
  const after: FlagValue = newChecked ? 'S' : 'N';
  if (before === after) return;
  model.value = { ...model.value, [flagId]: after };
  emit('update:modelValue', model.value);
  emit('change', { flag: flagId, before, after });
}
</script>

<style scoped>
.auth-flags-editor {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.afe-section-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
}

.afe-section-subtitle {
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 0.75rem;
}

.afe-flags-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.25rem;
}

@media (min-width: 768px) {
  .afe-flags-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.25rem 1.5rem;
  }
}

.afe-flag-row {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  transition: background-color 0.15s;
}

.afe-flag-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.afe-flag-active {
  background-color: rgba(var(--v-theme-primary), 0.04);
}

.afe-flag-label {
  display: inline-flex;
  align-items: center;
  font-size: 0.875rem;
}

.afe-flag-name {
  font-weight: 500;
}

.afe-flag-tag {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.65rem !important;
}

.afe-info-icon {
  margin-left: 0.5rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  cursor: help;
}

.afe-info-icon:hover {
  color: rgb(var(--v-theme-primary));
}

.afe-tooltip {
  font-size: 0.8rem;
}

.afe-tooltip-desc {
  margin: 0 0 0.5rem 0;
}

.afe-tooltip-section-title {
  font-weight: 600;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}

.afe-tooltip-list {
  margin: 0;
  padding-left: 1rem;
  max-height: 180px;
  overflow-y: auto;
}

.afe-tooltip-perm {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.72rem;
}

.afe-tooltip-meta {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.85;
}

.afe-tooltip-sql {
  margin-top: 0.5rem;
  font-size: 0.72rem;
}

.afe-tooltip-sql code {
  display: block;
  background: rgba(0, 0, 0, 0.18);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  margin-top: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.afe-tooltip-notes {
  margin-top: 0.5rem;
  font-style: italic;
  opacity: 0.75;
  font-size: 0.72rem;
}

.afe-dirty-indicator {
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  color: rgb(var(--v-theme-warning));
  font-style: italic;
}
</style>
