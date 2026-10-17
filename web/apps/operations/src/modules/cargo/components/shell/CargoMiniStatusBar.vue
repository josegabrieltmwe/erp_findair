<template>
  <button class="ministatus" type="button" @click="$emit('click')">
    <v-icon icon="mdi-clock-outline" size="15" />
    <span class="mbar">
      <i v-for="(state, i) in segments" :key="i" :class="state" />
    </span>
    <span class="ministatus-text">{{ currentLabel }}</span>
    <span v-if="currentDate" class="ministatus-date">· {{ currentDate }}</span>
  </button>
</template>

<script setup lang="ts">
import { useCargoLifecycle } from "@cargo/composables/useCargoLifecycle";

const { segments, currentLabel, currentDate } = useCargoLifecycle();
defineEmits<{ (e: "click"): void }>();
</script>
