<template>
  <div
    class="splitter"
    role="separator"
    :title="t('shell.drag_to_resize')"
    @mousedown="onDown"
    @touchstart.passive="onDown"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useUiStore } from "@shipment/stores/ui.store";

/**
 * Drag handle that drives ui.store.splitterPct (clamped 30-70).
 * Styling lives in styles/mockup2.scss (.splitter).
 *
 * The parent `.cols` grid reads `--p` from ui.store via inline
 * style binding; we just keep the percentage in sync.
 */
const { t } = useI18n();
const ui = useUiStore();

let dragging = false;

function findParent(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".shipment-v2 .cols");
}

function onMove(e: MouseEvent | TouchEvent): void {
  if (!dragging) return;
  const parent = findParent();
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  const clientX =
    "touches" in e ? (e.touches[0]?.clientX ?? 0) : (e as MouseEvent).clientX;
  const pct = ((clientX - rect.left) / rect.width) * 100;
  ui.setSplitterPct(pct);
}

function onUp(): void {
  if (!dragging) return;
  dragging = false;
  document.body.style.userSelect = "";
}

function onDown(): void {
  dragging = true;
  document.body.style.userSelect = "none";
}

onMounted(() => {
  document.addEventListener("mousemove", onMove);
  document.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("mouseup", onUp);
  document.addEventListener("touchend", onUp);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousemove", onMove);
  document.removeEventListener("touchmove", onMove);
  document.removeEventListener("mouseup", onUp);
  document.removeEventListener("touchend", onUp);
});
</script>
