<template>
  <!--
    Centro de notificaciones — la campana de la barra superior.

    Muchas cosas ocurren sin que el operario se entere: el stock de AWB se
    agota, un vettore contesta un RFQ y nadie lo mira. Antes había que entrar a
    mirar la pantalla concreta; aquí aparecen solas, con acciones sugeridas.

    Clona el patrón de PlatformChatBadge (badge + panel + polling 60s + cierre
    por clic-fuera y Escape), que es el ya probado en producción.
  -->
  <div class="ptb-notif" :class="{ 'ptb-notif--open': open }">
    <button
      type="button"
      class="ptb-iconbtn ptb-notif-btn"
      :title="bellTitle"
      @click="toggle"
    >
      <v-icon :icon="unread > 0 ? 'mdi-bell-ring-outline' : 'mdi-bell-outline'" size="18" />
      <span v-if="unread > 0" class="ptb-notif-dot">
        {{ unread > 99 ? '99+' : unread }}
      </span>
    </button>

    <div v-if="open" class="ptb-notif-panel" @click.stop>
      <div class="ptb-notif-head">
        <span class="ptb-notif-title">{{ t('platform.notifications.title') }}</span>
        <button
          v-if="unread > 0"
          type="button"
          class="ptb-notif-link"
          @click="markAllRead"
        >
          {{ t('platform.notifications.mark_all_read') }}
        </button>
      </div>

      <div v-if="loading && !items.length" class="ptb-notif-empty">
        {{ t('platform.notifications.loading') }}
      </div>

      <div v-else-if="!items.length" class="ptb-notif-empty">
        {{ t('platform.notifications.empty') }}
      </div>

      <div v-else class="ptb-notif-list">
        <div
          v-for="n in items"
          :key="n.id"
          class="ptb-notif-item"
          :class="[`ptb-notif-item--${n.severity}`, { 'ptb-notif-item--read': n.status === 'read' }]"
        >
          <v-icon :icon="severityIcon(n.severity)" size="16" class="ptb-notif-item-icon" />
          <div class="ptb-notif-item-main">
            <div class="ptb-notif-item-title">{{ n.title }}</div>
            <div v-if="n.body" class="ptb-notif-item-body">{{ n.body }}</div>
            <div class="ptb-notif-item-foot">
              <span class="ptb-notif-item-age">{{ relativeAge(n.created) }}</span>
              <!-- Las acciones son el punto: el aviso propone qué hacer, no
                   sólo informa de que algo pasó. -->
              <button
                v-for="(a, i) in n.actions"
                :key="i"
                type="button"
                class="ptb-notif-action"
                @click="runAction(n, a)"
              >
                {{ a.label }}
              </button>
              <button
                type="button"
                class="ptb-notif-action ptb-notif-action--muted"
                @click="dismiss(n)"
              >
                {{ t('platform.notifications.dismiss') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface NotificationAction {
  kind: 'navigate' | 'open_modal' | 'dismiss';
  label: string;
  target: string;
  params?: Record<string, unknown>;
}

interface NotificationItem {
  id: number;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  actions: NotificationAction[];
  status: 'new' | 'read';
  created: string;
}

const items = ref<NotificationItem[]>([]);
const unread = ref(0);
const open = ref(false);
const loading = ref(false);
let pollHandle: number | null = null;

const bellTitle = computed(() =>
  unread.value === 0
    ? (t('platform.notifications.title_none') as string)
    : (t('platform.notifications.title_count', { count: unread.value }) as string)
);

function severityIcon(s: string): string {
  if (s === 'critical') return 'mdi-alert-octagon';
  if (s === 'warning') return 'mdi-alert';
  return 'mdi-information-outline';
}

/** Antigüedad en texto corto. Un timestamp absoluto obliga a calcular
    mentalmente si el aviso es de hace una hora o de la semana pasada. */
function relativeAge(iso: string): string {
  const ts = new Date(iso.replace(' ', 'T')).getTime();
  if (Number.isNaN(ts)) return '';
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return t('platform.notifications.age_now') as string;
  if (mins < 60) return t('platform.notifications.age_min', { n: mins }) as string;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('platform.notifications.age_hour', { n: hours }) as string;
  return t('platform.notifications.age_day', { n: Math.floor(hours / 24) }) as string;
}

async function fetchInbox(): Promise<void> {
  loading.value = true;
  try {
    const r = await fetch('/bff/v1/api_notifications', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return;
    const body = await r.json();
    // Unified_Response_Trait envuelve como { success, data }.
    const data = body?.data ?? body;
    if (data && typeof data === 'object') {
      items.value = Array.isArray(data.items) ? data.items : [];
      unread.value = Number(data.unread_count ?? 0);
    }
  } catch {
    // Error de red: la campana mantiene el último valor en vez de romper
    // la barra superior entera.
  } finally {
    loading.value = false;
  }
}

async function postAction(action: 'read' | 'dismiss', ids?: number[]): Promise<void> {
  try {
    await fetch('/bff/v1/api_notifications_action', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(ids ? { action, ids } : { action }),
    });
  } catch {
    // idem: no romper la UI por un fallo de red
  }
  await fetchInbox();
}

function markAllRead(): void {
  void postAction('read');
}

function dismiss(n: NotificationItem): void {
  // Optimista: la fila desaparece al instante y el refetch confirma. Esperar
  // al servidor para quitar algo que el usuario acaba de descartar se siente
  // roto.
  items.value = items.value.filter((x) => x.id !== n.id);
  void postAction('dismiss', [n.id]);
}

/**
 * Ejecuta la acción elegida.
 *
 * `open_modal` no abre nada por sí mismo: emite un evento global que la app
 * de destino escucha. El centro no puede conocer los diálogos de cada módulo
 * —vive en el paquete compartido— y tampoco debe.
 */
function runAction(n: NotificationItem, a: NotificationAction): void {
  if (a.kind === 'dismiss') {
    dismiss(n);
    return;
  }
  if (a.kind === 'navigate' && a.target) {
    void postAction('read', [n.id]);
    window.location.href = a.target;
    return;
  }
  if (a.kind === 'open_modal' && a.target) {
    void postAction('read', [n.id]);
    window.dispatchEvent(
      new CustomEvent('tmwe:notification-action', {
        detail: { modal: a.target, params: a.params ?? {}, notification_id: n.id },
      })
    );
    open.value = false;
  }
}

function toggle(): void {
  open.value = !open.value;
  if (open.value) void fetchInbox();
}

function onWindowClick(ev: MouseEvent): void {
  if (!open.value) return;
  const target = ev.target as HTMLElement | null;
  if (target && target.closest('.ptb-notif')) return;
  open.value = false;
}

function onKey(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && open.value) open.value = false;
}

onMounted(() => {
  void fetchInbox();
  pollHandle = window.setInterval(() => { void fetchInbox(); }, 60_000);
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
.ptb-notif {
  position: relative;
  display: inline-flex;
}
.ptb-notif-btn {
  position: relative;
}
.ptb-notif-dot {
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

.ptb-notif-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: 380px;
  max-width: 90vw;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.08);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: 6px;
  z-index: 1000;
}

.ptb-notif-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 4px 8px 6px;
}
.ptb-notif-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.ptb-notif-link {
  font-size: 11px;
  color: rgb(var(--v-theme-primary));
  background: none;
  border: 0;
  cursor: pointer;
}

.ptb-notif-empty {
  padding: 18px 8px;
  text-align: center;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Tope de alto: con 50 avisos el panel no debe tapar la pantalla entera. */
.ptb-notif-list {
  max-height: 60vh;
  overflow-y: auto;
}

.ptb-notif-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  border-left: 3px solid transparent;
}
.ptb-notif-item:hover {
  background: rgb(var(--v-theme-surface-variant));
}
/* La franja lateral distingue la severidad sin leer el texto. */
.ptb-notif-item--critical { border-left-color: rgb(var(--v-theme-error)); }
.ptb-notif-item--warning  { border-left-color: rgb(var(--v-theme-warning)); }
.ptb-notif-item--info     { border-left-color: rgb(var(--v-theme-info)); }
/* Ya leída: sigue visible pero deja de competir por la atención. */
.ptb-notif-item--read { opacity: 0.6; }

.ptb-notif-item-icon { margin-top: 2px; }
.ptb-notif-item-main { flex: 1; min-width: 0; }
.ptb-notif-item-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}
.ptb-notif-item-body {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-top: 2px;
}
.ptb-notif-item-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}
.ptb-notif-item-age {
  font-size: 11px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.ptb-notif-action {
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}
.ptb-notif-action--muted {
  color: rgb(var(--v-theme-on-surface-variant));
  font-weight: 400;
}
</style>
