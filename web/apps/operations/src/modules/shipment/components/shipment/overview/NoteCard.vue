<template>
  <section class="card-tmwe card-tmwe--alt">
    <CardHeader
      icon="mdi-note-text-outline"
      :title="t('shipment.cards.note.title')"
    >
      <template #badge>
        <span v-if="filledCount" class="note-badge">{{ filledCount }}</span>
      </template>
      <template #actions>
        <v-btn
          icon="mdi-arrow-expand"
          variant="text"
          size="x-small"
          density="comfortable"
          :title="t('shipment.cards.note.open_full')"
          @click="ui.openModal('note')"
        />
      </template>
    </CardHeader>

    <div class="notes">
      <button
        v-for="n in noteFields"
        :key="n.key"
        type="button"
        class="note-row"
        :class="{ 'note-row--editing': editing === n.key }"
        @click="startEdit(n.key)"
      >
        <span class="note-dot" :class="{ 'note-dot--on': !!n.binding.local }" />
        <span class="note-body">
          <span class="note-label">{{ n.label }}</span>
          <!-- Inline editor when this row is active; otherwise a clamped preview. -->
          <v-textarea
            v-if="editing === n.key"
            ref="editor"
            v-model="n.binding.local"
            :rows="2"
            auto-grow
            density="compact"
            variant="outlined"
            hide-details
            class="note-edit"
            :readonly="isReadonly"
            @click.stop
            @blur="commitEdit(n.binding)"
            @keydown.esc="editing = null"
          />
          <span v-else-if="n.binding.local" class="note-preview">{{
            n.binding.local
          }}</span>
          <span v-else class="note-empty">{{
            t("shipment.cards.note.empty")
          }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useUiStore } from "@shipment/stores/ui.store";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";
import CardHeader from "@shipment/components/shell/CardHeader.vue";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);
const ui = useUiStore();

// Same one-field→commit-on-blur bindings the notes modal uses, so editing here
// persists (and fires the legacy side-effects) exactly like the modal does.
const note = useFieldBinding("note", "");
const noteOperative = useFieldBinding("note_operative", "");
const noteXdestin = useFieldBinding("note_x_destin", "");

const noteFields = computed(() => [
  { key: "note", label: t("shipment.modals.note.internal"), binding: note },
  {
    key: "note_operative",
    label: t("shipment.modals.note.operative"),
    binding: noteOperative,
  },
  {
    key: "note_x_destin",
    label: t("shipment.modals.note.destination"),
    binding: noteXdestin,
  },
]);

const isReadonly = computed<boolean>(() => readonly("note"));

const filledCount = computed(
  () => noteFields.value.filter((n) => !!n.binding.local).length,
);

const editing = ref<string | null>(null);
const editor = ref<HTMLElement[] | null>(null);

async function startEdit(key: string): Promise<void> {
  if (isReadonly.value) return;
  editing.value = key;
  await nextTick();
  // Focus the freshly mounted textarea.
  const el = editor.value?.[0] as unknown as { focus?: () => void } | undefined;
  el?.focus?.();
}

async function commitEdit(binding: {
  commit: () => Promise<void>;
}): Promise<void> {
  await binding.commit();
  editing.value = null;
}
</script>

<style scoped>
.notes {
  display: flex;
  flex-direction: column;
}
.note-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 0;
  background: none;
  border: none;
  cursor: text;
}
/* Sin línea separadora interna entre filas de nota (cards sin bordes internos,
   paridad visual con el detalle de cargo). */
.note-row--editing {
  cursor: default;
}
.note-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.22);
}
.note-dot--on {
  background: rgb(var(--v-theme-primary));
}
.note-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
}
.note-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.note-preview {
  font-size: 13px;
  line-height: 1.35;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}
.note-empty {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.4);
}
.note-edit {
  margin-top: 4px;
}
.note-badge {
  font-size: 11px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
</style>
