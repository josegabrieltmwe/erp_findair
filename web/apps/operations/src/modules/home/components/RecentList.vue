<template>
  <section class="recent-list">
    <header class="recent-list__head">
      <v-icon :icon="icon" size="18" color="primary" class="me-2" />
      <h3 class="recent-list__title">{{ title }}</h3>
      <v-spacer />
      <a class="recent-list__more" :href="listHref">
        {{ t("home.recent.see_all") }}
        <v-icon icon="mdi-arrow-right" size="14" />
      </a>
    </header>

    <!-- Loading: skeleton rows so the operator sees the list shape
         while data is in flight, instead of a tiny mid-card spinner. -->
    <ul v-if="loading" class="recent-list__items recent-list__items--loading">
      <li v-for="n in 5" :key="`skel-${n}`" class="recent-list__row-skeleton">
        <div class="skel-line skel-line--title" />
        <div class="skel-line skel-line--sub" />
      </li>
    </ul>

    <ul v-else-if="rows.length" class="recent-list__items">
      <li v-for="r in rows" :key="r.id">
        <a class="recent-list__row" :href="getHref(r)">
          <div class="recent-list__row-main">
            <div class="recent-list__row-title">{{ r.title }}</div>
            <div v-if="r.subtitle" class="recent-list__row-sub">
              {{ r.subtitle }}
            </div>
          </div>
          <div class="recent-list__row-meta">
            <div v-if="r.status" class="recent-list__row-status">
              {{ r.status }}
            </div>
            <div v-if="r.date" class="recent-list__row-date">
              {{ formatDate(r.date) }}
            </div>
          </div>
        </a>
      </li>
    </ul>

    <div v-else class="recent-list__empty">{{ emptyText }}</div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
export interface RecentRow {
  id: number;
  title: string;
  subtitle?: string;
  date?: string;
  status?: string;
}

defineProps<{
  title: string;
  icon: string;
  listHref: string;
  rows: RecentRow[];
  loading: boolean;
  emptyText: string;
  /** Builds the per-row href so we don't hardcode `/cargo/N` vs `/shipment/N` here. */
  getHref: (row: RecentRow) => string;
}>();

function formatDate(d: string): string {
  if (!d) return "";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return d;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}
</script>

<style scoped lang="scss">
.recent-list {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  min-height: 240px;
}
.recent-list__head {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}
.recent-list__title {
  font-size: 13px;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-on-surface-variant));
}
.recent-list__more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.recent-list__more:hover {
  text-decoration: underline;
}
.recent-list__loading {
  display: grid;
  place-items: center;
  flex: 1;
}
.recent-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
}
.recent-list__row {
  display: flex;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.04);
  text-decoration: none;
  color: inherit;
  transition: background 0.1s;
}
.recent-list__row:last-child {
  border-bottom: 0;
}
.recent-list__row:hover {
  background: rgb(var(--v-theme-surface-variant));
}
.recent-list__row-main {
  flex: 1;
  min-width: 0;
}
.recent-list__row-title {
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-list__row-sub {
  font-size: 11.5px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-top: 2px;
}
.recent-list__row-meta {
  text-align: right;
  flex-shrink: 0;
  font-size: 11px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.recent-list__row-status {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.recent-list__empty {
  padding: 40px 16px;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 13px;
  flex: 1;
  display: grid;
  place-items: center;
}

/* ─── Loading skeleton rows ──────────────────────────────── */
@keyframes skel-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
.recent-list__items--loading {
  pointer-events: none;
}
.recent-list__row-skeleton {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.recent-list__row-skeleton:last-child {
  border-bottom: 0;
}
.skel-line {
  height: 11px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    rgb(var(--v-theme-surface-variant)) 0%,
    rgb(var(--v-theme-surface)) 50%,
    rgb(var(--v-theme-surface-variant)) 100%
  );
  background-size: 200% 100%;
  animation: skel-shimmer 1.4s ease-in-out infinite;
}
.skel-line--title {
  width: 60%;
  height: 13px;
}
.skel-line--sub {
  width: 85%;
  opacity: 0.7;
}
</style>
