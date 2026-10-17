<template>
  <!--
    Sidebar content for the detail shell — shows the list of records in
    the current filter (the "elenco" the operator was browsing before
    opening this record). Click navigates to that record without losing
    the page-level state (chat SSE, drawers, splitter) because the
    surrounding layout doesn't remount.

    In `rail` mode (collapsed sidebar) only the record id is shown so
    the operator can still see context without consuming horizontal
    space. The header band hides in rail to maximize the list height.
  -->
  <div
    v-if="navigator.total.value > 0 || navigator.loading.value"
    class="rec-sb"
    :class="{ 'rec-sb--rail': rail }"
  >
    <!-- "Back to list" — only when consumer provided onBack. Sits at
         the top of the sidebar (and in rail mode it collapses to an
         icon-only button) so the operator can always return to the
         listing without having to find the browser back button. -->
    <button
      v-if="onBack"
      type="button"
      class="rec-sb-back"
      :class="{ 'rec-sb-back--rail': rail }"
      :title="rail ? t('platform.records.back_to_list_title') : undefined"
      @click="onBack"
    >
      <v-icon icon="mdi-arrow-left" size="16" />
      <span v-if="!rail" class="rec-sb-back-label">{{ t('platform.records.back_to_list') }}</span>
      <span v-if="!rail" class="rec-sb-back-kbd">Esc</span>
    </button>

    <div v-if="!rail" class="rec-sb-top">
      <v-icon icon="mdi-view-grid-outline" size="16" />
      <h3 class="rec-sb-title">{{ t('platform.records.title') }}</h3>
      <span class="rec-sb-count">{{ navigator.total.value }}</span>
    </div>

    <div v-if="!rail" class="rec-sb-sub">
      <span v-if="filterLabel">{{ filterLabel }}</span>
      <span v-else>{{ t('platform.records.current_filter') }}</span>
    </div>

    <button
      v-for="r in navigator.records.value"
      :key="r.id"
      type="button"
      class="rec-sb-rec"
      :class="{
        'rec-sb-rec--current': String(r.id) === String(currentId),
        'rec-sb-rec--rail': rail,
      }"
      :title="rail ? `#${r.id}${r.cliente ? ' — ' + r.cliente : ''}` : undefined"
      @click="onGoTo(r.id)"
    >
      <template v-if="!rail">
        <div class="rec-sb-rec-text">
          <div class="rec-sb-rec-id">#{{ r.id }}</div>
          <div v-if="r.cliente" class="rec-sb-rec-sub">{{ r.cliente }}</div>
        </div>
        <span
          v-if="r.consegna_label"
          class="rec-sb-rec-dot"
          :class="{ 'is-delivered': isDelivered(r.consegna_label) }"
        />
      </template>
      <template v-else>
        <span class="rec-sb-rec-mini">{{ shortId(r.id) }}</span>
      </template>
    </button>

    <div
      v-if="!navigator.loading.value && navigator.total.value === 0"
      class="rec-sb-empty"
    >
      <v-icon icon="mdi-magnify" size="22" />
      <div v-if="!rail">{{ t('platform.records.empty') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComputedRef, Ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

/**
 * Generic record navigator shape — both cargo and shipment expose a
 * useRecordNavigator() composable returning the same surface. This file
 * stays SPA-agnostic by taking the navigator as a prop instead of
 * importing the composable directly.
 */
interface RecordItem {
  id: number | string;
  cliente?: string | null;
  consegna_label?: string;
}

/** Accepts both Ref and ComputedRef (the navigator composable returns
 *  ComputedRef but the consumer doesn't care about the distinction). */
type ReadRef<T> = Ref<T> | ComputedRef<T>;

interface RecordNavigator {
  records: ReadRef<RecordItem[]>;
  total: ReadRef<number>;
  loading: ReadRef<boolean>;
  goTo: (id: number | string) => void;
}

const props = defineProps<{
  navigator: RecordNavigator;
  currentId: number | string | null;
  /** Rail mode — used when the DetailShell sidebar is collapsed. */
  rail?: boolean;
  /** Optional copy describing the active filter, e.g. "Da controllare". */
  filterLabel?: string;
  /** Optional callback wired to the "Back to list" button. When absent
   *  the button is hidden so legacy consumers see no change. */
  onBack?: () => void;
}>();

const emit = defineEmits<{
  (e: 'go-to', id: number | string): void;
}>();

function onGoTo(id: number | string): void {
  props.navigator.goTo(id);
  emit('go-to', id);
}

function isDelivered(label: string | undefined): boolean {
  if (!label) return false;
  return /consegnat/i.test(label) || /delivered/i.test(label);
}

/** Show the last 5 digits of the id when in rail (icons-only) mode. */
function shortId(id: number | string): string {
  const s = String(id);
  return s.length > 5 ? s.slice(-5) : s;
}
</script>

<style scoped lang="scss">
.rec-sb {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.rec-sb-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 8px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid rgba(15, 23, 42, 0.08);
  color: rgb(var(--v-theme-on-surface-variant));
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  margin-bottom: 10px;
  transition: background .14s, color .14s, border-color .14s;
}
.rec-sb-back:hover {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgba(var(--v-theme-primary), 0.35);
  color: rgb(var(--v-theme-primary));
}
.rec-sb-back-label {
  flex: 1;
}
.rec-sb-back-kbd {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .04em;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: rgb(var(--v-theme-surface));
  opacity: 0.7;
}
.rec-sb-back--rail {
  justify-content: center;
  padding: 8px 6px;
}

.rec-sb-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.rec-sb-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 0;
  flex: 1;
}

.rec-sb-count {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
}

.rec-sb-sub {
  font-size: 11px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: .65;
  margin-bottom: 8px;
}

.rec-sb-rec {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 9px;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: background .12s, color .12s;
  text-align: left;
  width: 100%;
  font-size: 12.5px;
}

.rec-sb-rec:hover {
  background: rgba(var(--v-theme-on-surface), .04);
}

.rec-sb-rec--current {
  background: rgba(var(--v-theme-primary), .12);
  color: rgb(var(--v-theme-primary));
}

.rec-sb-rec--current:hover {
  background: rgba(var(--v-theme-primary), .18);
}

.rec-sb-rec-text {
  flex: 1;
  min-width: 0;
}

.rec-sb-rec-id {
  font-weight: 700;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: -.02em;
}

.rec-sb-rec-sub {
  font-size: 11px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: .8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rec-sb-rec-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--v-theme-on-surface-variant));
  opacity: .4;
  flex-shrink: 0;
}

.rec-sb-rec-dot.is-delivered {
  background: rgb(var(--v-theme-success));
  opacity: 1;
}

/* Rail mode — icon-sized list items with the short id only. */
.rec-sb-rec--rail {
  justify-content: center;
  padding: 6px 4px;
}

.rec-sb-rec-mini {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: -.02em;
  opacity: .8;
}

.rec-sb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 8px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: .65;
  font-size: 12px;
  text-align: center;
}
</style>
