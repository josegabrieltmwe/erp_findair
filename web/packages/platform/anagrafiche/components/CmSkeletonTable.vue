<template>
  <div class="cm-skeleton-table" :aria-busy="true" role="status">
    <div
      v-for="row in rows"
      :key="row"
      class="cm-skeleton-row"
      :style="{ animationDelay: `${row * 60}ms` }"
    >
      <div
        v-for="col in cols"
        :key="col"
        class="cm-skeleton-cell"
        :style="{ width: colWidth(col) }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    rows?: number;
    cols?: number;
  }>(),
  { rows: 6, cols: 5 },
);

function colWidth(idx: number): string {
  const widths = ['18%', '24%', '14%', '20%', '12%', '16%', '14%', '20%'];
  return widths[(idx - 1) % widths.length] ?? '18%';
}

// reference to silence unused-var when destructured upstream
void props;
</script>

<style scoped>
.cm-skeleton-table {
  padding: var(--cm-space-md);
}
.cm-skeleton-row {
  display: flex;
  gap: var(--cm-space-md);
  padding: var(--cm-space-sm) 0;
  border-bottom: 1px solid var(--cm-border-color-light);
  animation: cm-skeleton-pulse 1.4s ease-in-out infinite;
}
.cm-skeleton-row:last-child {
  border-bottom: 0;
}
.cm-skeleton-cell {
  height: 14px;
  background: linear-gradient(
    90deg,
    var(--cm-bg-hover) 0%,
    var(--cm-bg-active) 50%,
    var(--cm-bg-hover) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--cm-radius-sm);
  animation: cm-skeleton-shimmer 1.4s linear infinite;
}
@keyframes cm-skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
@keyframes cm-skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
