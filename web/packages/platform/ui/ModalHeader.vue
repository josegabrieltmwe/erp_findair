<template>
  <!--
    Cabecera estándar de los modales de COMUNICACIÓN.

    Extraída de `EmailComposer` (.ec-head) para que los modales que participan
    del mismo flujo compartan identidad visual sin heredar la lógica de
    composición de correo. El caso que lo motivó: en courier se envía un RFQ con
    EmailComposer (icono en pastilla + título + subtítulo) y se ven las
    respuestas con un modal de formulario (título plano), de modo que dos pasos
    del MISMO flujo se veían de familias distintas.

    NO sustituye a la cabecera de `FormModal`: los modales de datos (Colli,
    Costi, Aduanas…) siguen con su frame, que aporta gestión de borrador y aviso
    de cambios sin guardar. Esta cabecera es para el flujo de comunicación.
  -->
  <div class="mh">
    <div class="mh__icon">
      <v-icon :icon="icon || 'mdi-email-fast-outline'" />
    </div>
    <div class="mh__text">
      <div class="mh__title">{{ title }}</div>
      <div v-if="subtitle" class="mh__sub">{{ subtitle }}</div>
    </div>
    <!-- Contadores, badges o acciones alineadas a la derecha. -->
    <div v-if="$slots.append" class="mh__append">
      <slot name="append" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  /** Icono mdi; por defecto el de correo. */
  icon?: string;
}>();
</script>

<style scoped>
.mh {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 14px;
  background: rgb(var(--v-theme-surface-variant));
}
.mh__icon {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
}
.mh__text {
  flex: 1;
  min-width: 0;
}
.mh__title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
}
.mh__sub {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.85;
  margin-top: 2px;
}
.mh__append {
  flex: none;
}
</style>
