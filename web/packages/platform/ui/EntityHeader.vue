<template>
  <!--
    Cabecera reutilizable para fichas de entidad (cliente, usuario, expedición,
    cargo, factura, cuenta de proveedor…). No sustituye a `CmSectionHeader`
    (listados/páginas simples con solo título+acciones): esta cabecera asume
    identidad de entidad — nombre + identificador + estado — y admite
    breadcrumbs y dos niveles de acciones.

    Agnóstica de dominio a propósito: no sabe qué es un "estado" de cliente vs.
    de expedición. El host arma sus propios badges (StatusChip u otro) y los
    pasa por el slot #badges.
  -->
  <header class="eh" :class="{ 'eh--sticky': sticky }">
    <div v-if="$slots.breadcrumbs" class="eh-breadcrumbs">
      <slot name="breadcrumbs" />
    </div>

    <div class="eh-main">
      <div class="eh-identity">
        <h1 class="eh-title">
          <span class="eh-title-text">{{ title }}</span>
          <span v-if="identifier" class="eh-identifier">#{{ identifier }}</span>
        </h1>
        <div v-if="$slots.badges || metadata" class="eh-meta">
          <slot name="badges" />
          <span v-if="metadata" class="eh-metadata">{{ metadata }}</span>
        </div>
      </div>

      <div class="eh-actions">
        <div v-if="$slots['secondary-actions']" class="eh-actions-secondary">
          <slot name="secondary-actions" />
        </div>
        <div v-if="$slots['primary-actions']" class="eh-actions-primary">
          <slot name="primary-actions" />
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Nombre/título de la entidad, ya resuelto por el host. */
    title: string;
    /** Identificador corto (id, código). Se antepone `#` automáticamente. */
    identifier?: string | number;
    /** Línea de metadatos secundaria en texto plano (ya traducida). Para
     *  badges de color/estado usar el slot #badges en su lugar. */
    metadata?: string;
    /** Fija la cabecera al hacer scroll dentro del contenedor padre. */
    sticky?: boolean;
  }>(),
  { sticky: false },
);
</script>

<style scoped>
.eh {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 4px 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-background));
}
.eh--sticky {
  position: sticky;
  top: 0;
  z-index: 20;
}
.eh-breadcrumbs {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.eh-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.eh-identity {
  min-width: 0;
  flex: 1 1 auto;
}
.eh-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}
.eh-title-text {
  overflow-wrap: break-word;
}
.eh-identifier {
  font-size: 0.875rem;
  font-weight: 400;
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.eh-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.eh-metadata {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.eh-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.eh-actions-secondary,
.eh-actions-primary {
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 720px) {
  .eh-main {
    flex-direction: column;
    align-items: stretch;
  }
  .eh-actions {
    justify-content: flex-end;
  }
}
</style>
