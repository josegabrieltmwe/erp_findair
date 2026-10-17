<template>
  <!--
    Platform chat unread badge — F0.3 partner-parity.
    Polls /bff/v1/web_chat_unread_counter every 60s and renders
    an icon button with a red dot when the user has unread messages in
    Express, Cargo or CRM. Click opens a dropdown with per-area links
    to the relevant listing filtered by unread.

    Backend already exists: Chat_Unread_Counter_Service + the web/api
    controllers. No new endpoint needed.
  -->
  <div class="ptb-chat" :class="{ 'ptb-chat--open': open }">
    <button
      type="button"
      class="ptb-iconbtn ptb-chat-btn"
      :title="totalTitle"
      @click="open = !open"
    >
      <v-icon icon="mdi-message-text-outline" size="18" />
      <span v-if="total > 0" class="ptb-chat-dot">
        {{ total > 99 ? '99+' : total }}
      </span>
    </button>

    <div v-if="open" class="ptb-chat-panel" @click.stop>
      <div class="ptb-chat-panel-title">{{ t('platform.chat.unread_title') }}</div>

      <a
        v-for="row in rows"
        :key="row.key"
        class="ptb-chat-row"
        :href="row.href"
        :class="{ 'ptb-chat-row--zero': row.count === 0 }"
      >
        <v-icon :icon="row.icon" size="18" :color="row.count > 0 ? row.color : undefined" />
        <span class="ptb-chat-row-label">{{ row.label }}</span>
        <span class="ptb-chat-row-count">{{ row.count }}</span>
      </a>

      <div v-if="total === 0" class="ptb-chat-empty">
        {{ t('platform.chat.empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface UnreadCounter {
  express: number;
  cargo: number;
  crm: number;
  crm_not_in_to_do?: number;
  total: number;
}

const counts = ref<UnreadCounter>({ express: 0, cargo: 0, crm: 0, total: 0 });
const open = ref(false);
let pollHandle: number | null = null;

const total = computed(() => counts.value.total ?? 0);
const totalTitle = computed(() =>
  total.value === 0
    ? (t('platform.chat.title_none') as string)
    : (t('platform.chat.title_count', { count: total.value }) as string)
);

interface RowDescriptor {
  key: string;
  label: string;
  icon: string;
  color: string;
  count: number;
  href: string;
}

const rows = computed<RowDescriptor[]>(() => [
  {
    key: 'express',
    label: t('platform.chat.express') as string,
    icon: 'mdi-truck-fast-outline',
    color: 'success',
    count: counts.value.express ?? 0,
    href: '/shipment/list?chat_unread=1',
  },
  {
    key: 'cargo',
    label: t('platform.chat.cargo') as string,
    icon: 'mdi-airplane',
    color: 'primary',
    count: counts.value.cargo ?? 0,
    href: '/cargo/list?chat_unread=1',
  },
  {
    key: 'crm',
    label: t('platform.chat.crm') as string,
    icon: 'mdi-clipboard-text-outline',
    color: 'warning',
    count: counts.value.crm ?? 0,
    // SPA crm_pratica. El router usa hash history, así que el filtro va
    // dentro del hash. ti=open == legacy winbody.php?pp=crm&ti=open.
    href: '/erp/tmwe_json/crm_pratica#/pratiche?ti=open',
  },
]);

async function fetchCounts(): Promise<void> {
  try {
    const r = await fetch('/bff/v1/web_chat_unread_counter', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return;
    const body = await r.json();
    // Unified_Response_Trait wraps payloads as { success, data }.
    const data = body?.data ?? body;
    if (data && typeof data === 'object') {
      counts.value = {
        express: Number(data.express ?? 0),
        cargo: Number(data.cargo ?? 0),
        crm: Number(data.crm ?? 0),
        crm_not_in_to_do: Number(data.crm_not_in_to_do ?? 0),
        total: Number(data.total ?? 0),
      };
    }
  } catch {
    // Swallow network errors — badge stays at last value.
  }
}

function onWindowClick(ev: MouseEvent): void {
  if (!open.value) return;
  const t = ev.target as HTMLElement | null;
  if (t && t.closest('.ptb-chat')) return;
  open.value = false;
}

function onKey(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && open.value) open.value = false;
}

onMounted(() => {
  void fetchCounts();
  pollHandle = window.setInterval(() => { void fetchCounts(); }, 60_000);
  window.addEventListener('click', onWindowClick);
  window.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  if (pollHandle !== null) window.clearInterval(pollHandle);
  window.removeEventListener('click', onWindowClick);
  window.removeEventListener('keydown', onKey);
});
</script>

<style scoped lang="scss">
.ptb-chat {
  position: relative;
  display: inline-flex;
}

.ptb-chat-btn {
  position: relative;
}

.ptb-chat-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgb(var(--v-theme-error));
  color: white;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  letter-spacing: 0.02em;
}

.ptb-chat-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 240px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.08);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: 6px;
  z-index: 1000;
}

.ptb-chat-panel-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 4px 8px 6px;
}

.ptb-chat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  transition: background .12s;
}
.ptb-chat-row:hover { background: rgb(var(--v-theme-surface-variant)); }
.ptb-chat-row--zero { opacity: 0.45; }

.ptb-chat-row-label { flex: 1; }

.ptb-chat-row-count {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 24px;
  text-align: right;
}

.ptb-chat-empty {
  padding: 8px;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  text-align: center;
}
</style>
