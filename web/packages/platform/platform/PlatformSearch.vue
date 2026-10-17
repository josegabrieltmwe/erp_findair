<template>
  <!--
    Platform search — global lookup box embedded in the topbar.
    Calls /api_platform_search with debouncing, renders the top
    results in an absolute panel and navigates on click.

    Keyboard:
       /     → focus the box (when no input is currently focused)
       Esc   → blur + close panel
       ↓ ↑   → navigate results
       Enter → open highlighted result
  -->
  <div class="psh" :class="{ 'psh--open': open }">
    <div class="psh-box">
      <v-icon icon="mdi-magnify" size="16" class="psh-icon" />
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        class="psh-input"
        :placeholder="t('platform.search.placeholder')"
        autocomplete="off"
        @focus="open = true"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <kbd v-if="!open" class="psh-kbd">/</kbd>
      <v-icon
        v-if="query && open"
        icon="mdi-close"
        size="14"
        class="psh-clear"
        @mousedown.prevent
        @click="reset"
      />
    </div>

    <div v-if="open" class="psh-panel">
      <div v-if="loading" class="psh-state">
        <v-progress-circular indeterminate size="14" width="2" />
        <span class="ms-2">{{ t('platform.search.searching') }}</span>
      </div>
      <div v-else-if="query.length < 2" class="psh-state psh-state--muted">
        {{ t('platform.search.min_chars') }}
      </div>
      <div v-else-if="results.length === 0" class="psh-state psh-state--muted">
        {{ t('platform.search.no_results', { query }) }}
      </div>
      <ul v-else class="psh-results">
        <li
          v-for="(r, idx) in results"
          :key="`${r.type}-${r.id}`"
          class="psh-result"
          :class="{ 'psh-result--active': idx === activeIdx }"
          @mousedown.prevent="open = true"
          @mouseenter="activeIdx = idx"
          @click="navigate(r)"
        >
          <v-icon
            :icon="iconFor(r.type)"
            :color="colorFor(r.type)"
            size="16"
            class="psh-result-icon"
          />
          <div class="psh-result-body">
            <div class="psh-result-main">{{ r.label }}</div>
            <div v-if="r.sub" class="psh-result-sub">{{ r.sub }}</div>
          </div>
          <span class="psh-result-type">{{ typeLabel(r.type) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type SearchResultType = 'cargo' | 'shipment' | 'anagrafica';

interface SearchResult {
  type: SearchResultType;
  id: number;
  label: string;
  sub?: string;
  href: string;
}

const open = ref(false);
const query = ref('');
const results = ref<SearchResult[]>([]);
const loading = ref(false);
const activeIdx = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
let debounceTimer: number | null = null;

watch(query, (next) => {
  activeIdx.value = 0;
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  if (next.trim().length < 2) {
    results.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  debounceTimer = window.setTimeout(() => void runSearch(next.trim()), 200);
});

async function runSearch(q: string): Promise<void> {
  try {
    const url = `/bff/v1/api_platform_search?q=${encodeURIComponent(q)}`;
    const resp = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!resp.ok) {
      results.value = [];
      return;
    }
    const body = await resp.json();
    if (body?.success && Array.isArray(body.results)) {
      results.value = body.results;
    } else {
      results.value = [];
    }
  } catch {
    results.value = [];
  } finally {
    loading.value = false;
  }
}

function navigate(r: SearchResult): void {
  window.location.href = r.href;
}

// F2.4 — per-type rendering helpers (icon, color tag, label).
function iconFor(t: SearchResultType): string {
  switch (t) {
    case 'cargo': return 'mdi-airplane';
    case 'anagrafica': return 'mdi-account-box-outline';
    default: return 'mdi-truck-fast-outline';
  }
}
function colorFor(t: SearchResultType): string {
  switch (t) {
    case 'cargo': return 'primary';
    case 'anagrafica': return 'warning';
    default: return 'success';
  }
}
function typeLabel(type: SearchResultType): string {
  switch (type) {
    case 'cargo': return t('platform.search.type_cargo') as string;
    case 'anagrafica': return t('platform.search.type_anagrafica') as string;
    default: return t('platform.search.type_shipment') as string;
  }
}

function reset(): void {
  query.value = '';
  results.value = [];
  inputRef.value?.focus();
}

function onBlur(): void {
  // Slight delay so click handlers on results can fire before we hide.
  window.setTimeout(() => { open.value = false; }, 120);
}

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape') {
    inputRef.value?.blur();
    open.value = false;
    return;
  }
  if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    activeIdx.value = Math.min(results.value.length - 1, activeIdx.value + 1);
    return;
  }
  if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    activeIdx.value = Math.max(0, activeIdx.value - 1);
    return;
  }
  if (ev.key === 'Enter') {
    ev.preventDefault();
    const r = results.value[activeIdx.value];
    if (r) navigate(r);
  }
}

// Global "/" shortcut to focus.
function onGlobalKey(ev: KeyboardEvent): void {
  if (ev.key !== '/') return;
  const t = ev.target as HTMLElement | null;
  if (t) {
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (t.isContentEditable) return;
  }
  ev.preventDefault();
  inputRef.value?.focus();
  inputRef.value?.select();
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey);
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
});
</script>

<style scoped lang="scss">
.psh {
  position: relative;
  min-width: 240px;
  flex-shrink: 0;
}
.psh-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgb(var(--v-theme-surface-variant));
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: border-color .12s, background .12s;
}
.psh--open .psh-box {
  background: rgb(var(--v-theme-surface));
  border-color: rgb(var(--v-theme-primary));
}
.psh-icon {
  color: rgb(var(--v-theme-on-surface-variant));
  flex-shrink: 0;
}
.psh-input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
  min-width: 0;
}
.psh-input::placeholder {
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.6;
}
.psh-kbd {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.08);
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.75;
}
.psh-clear { cursor: pointer; }
.psh-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.08);
  border-radius: 8px;
  box-shadow: 0 8px 24px -8px rgba(0,0,0,.18), 0 2px 6px -2px rgba(0,0,0,.12);
  z-index: 200;
  overflow: hidden;
  max-height: 360px;
  overflow-y: auto;
}
.psh-state {
  padding: 12px 14px;
  font-size: 12.5px;
  color: rgb(var(--v-theme-on-surface-variant));
  display: flex;
  align-items: center;
}
.psh-state--muted {
  opacity: 0.65;
}
.psh-results {
  list-style: none;
  margin: 0;
  padding: 4px;
}
.psh-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.psh-result--active {
  background: rgb(var(--v-theme-surface-variant));
}
.psh-result-body {
  flex: 1;
  min-width: 0;
}
.psh-result-main {
  font-weight: 600;
  font-size: 13px;
}
.psh-result-sub {
  font-size: 11.5px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.psh-result-type {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface-variant));
  background: rgb(var(--v-theme-surface-variant));
  padding: 2px 6px;
  border-radius: 4px;
}

@media (max-width: 720px) {
  .psh { min-width: 0; flex: 1; }
  .psh-kbd { display: none; }
}
</style>
