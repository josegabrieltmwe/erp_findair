<template>
  <div class="rp">
    <div class="rp__label">{{ label }}</div>

    <!-- Audiencia elegible del escenario (contactos/partners). -->
    <v-autocomplete
      :model-value="null"
      :items="availableItems"
      :loading="loading"
      item-title="label"
      item-value="key"
      :placeholder="t('platform.email.pick_recipient')"
      :no-data-text="t('platform.email.no_recipients')"
      prepend-inner-icon="mdi-account-multiple-outline"
      variant="outlined"
      density="comfortable"
      hide-details
      hide-selected
      @update:model-value="onPickCatalog"
    />

    <!-- Añadir email manual. -->
    <div v-if="allowManual" class="rp__manual">
      <v-text-field
        v-model="manualInput"
        :placeholder="t('platform.email.add_manual')"
        prepend-inner-icon="mdi-email-plus-outline"
        variant="outlined"
        density="comfortable"
        hide-details
        :error="manualInput !== '' && !isValidEmail(manualInput)"
        @keydown.enter.prevent="addManual"
      >
        <template #append-inner>
          <v-btn
            :disabled="!isValidEmail(manualInput)"
            size="small"
            variant="text"
            icon="mdi-plus"
            @click="addManual"
          />
        </template>
      </v-text-field>
    </div>

    <!-- Seleccionados (chips). -->
    <div v-if="modelValue.length" class="rp__chips">
      <v-chip
        v-for="r in modelValue"
        :key="chipKey(r)"
        size="small"
        :color="r.source === 'manual' ? 'secondary' : 'primary'"
        variant="tonal"
        closable
        @click:close="remove(r)"
      >
        <v-icon
          :icon="r.source === 'manual' ? 'mdi-email-outline' : 'mdi-account'"
          size="13"
          start
        />
        {{ chipLabel(r) }}
      </v-chip>
    </div>
    <div v-else class="rp__hint">{{ hint || t('platform.email.recipients_hint') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Recipient } from './types';

const props = withDefaults(
  defineProps<{
    /** Destinatarios seleccionados (v-model). */
    modelValue: Recipient[];
    /** Audiencia elegible ya cargada por el consumidor. */
    audience: Recipient[];
    loading?: boolean;
    allowManual?: boolean;
    label: string;
    hint?: string;
  }>(),
  { loading: false, allowManual: true },
);

const emit = defineEmits<{ 'update:modelValue': [Recipient[]] }>();

const { t } = useI18n();
const manualInput = ref('');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/** Clave estable de un recipient (id de catálogo o email en minúsculas). */
function keyOf(r: Recipient): string {
  return r.id != null ? `id:${r.id}` : `em:${(r.email ?? '').toLowerCase()}`;
}
function chipKey(r: Recipient): string {
  return keyOf(r);
}
function chipLabel(r: Recipient): string {
  if (r.name && r.email) return `${r.name} <${r.email}>`;
  return r.name || r.email || String(r.id ?? '');
}

const selectedKeys = computed(() => new Set(props.modelValue.map(keyOf)));

/** Items del autocomplete = audiencia menos lo ya seleccionado. */
const availableItems = computed(() =>
  props.audience
    .filter((r) => !selectedKeys.value.has(keyOf(r)))
    .map((r) => ({
      key: keyOf(r),
      label: r.name && r.email ? `${r.name} — ${r.email}` : r.name || r.email || String(r.id),
      recipient: r,
    })),
);

function onPickCatalog(key: string | null): void {
  if (key == null) return;
  const item = availableItems.value.find((i) => i.key === key);
  if (!item) return;
  add(item.recipient);
}

function addManual(): void {
  const email = manualInput.value.trim().toLowerCase();
  if (!isValidEmail(email)) return;
  if (selectedKeys.value.has(`em:${email}`)) {
    manualInput.value = '';
    return;
  }
  add({ email, source: 'manual' });
  manualInput.value = '';
}

function add(r: Recipient): void {
  if (selectedKeys.value.has(keyOf(r))) return;
  emit('update:modelValue', [...props.modelValue, r]);
}

function remove(r: Recipient): void {
  const k = keyOf(r);
  emit(
    'update:modelValue',
    props.modelValue.filter((x) => keyOf(x) !== k),
  );
}
</script>

<style scoped lang="scss">
.rp {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rp__label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.rp__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rp__hint {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.7;
}
</style>
