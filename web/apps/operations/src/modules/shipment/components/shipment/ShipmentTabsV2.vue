<template>
  <!-- With the legacy `addresses` tab removed (the IndirizziCard in the
       overview now hosts an inline expand toggle), only the
       MiniStatusBar remains. We render it on its own row so the topbar
       layout stays consistent. -->
  <nav class="tabbar">
    <MiniStatusBar @click="ui.openModal('stato')" />
  </nav>
</template>

<script setup lang="ts">
import { useUiStore } from "@shipment/stores/ui.store";
import MiniStatusBar from "@shipment/components/shell/MiniStatusBar.vue";

type TabValue = "overview";

defineProps<{
  modelValue: TabValue;
}>();

defineEmits<{
  (e: "update:modelValue", value: TabValue): void;
}>();

const ui = useUiStore();
</script>
