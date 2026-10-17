<template>
  <!--
    Subgrupo de cestas. NO es una tarjeta: en el cockpit la unica superficie
    elevada son las propias cestas.

    Antes llevaba `.card-tmwe`, que es una clase GLOBAL de `mockup2.scss`
    (cargado en main.ts) y aporta `background`, `border-radius: 14px` y
    `padding: 0 14px 13px`. Eso metia cada grupo en una caja dentro de la
    seccion, con cestas-tarjeta dentro: tres niveles de superficie. El
    prototipo usa solo un rotulo de texto (`.subttl`) sobre el fondo.

    Tampoco lleva icono: el titulo en mayusculas ya identifica el grupo, y el
    icono competia con el de cada cesta.
  -->
  <section class="homekpi-group">
    <div class="homekpi-group-head">
      <h3 class="homekpi-group-title">{{ title }}</h3>
      <span v-if="!loading && total != null" class="homekpi-group-count">{{ total }}</span>
    </div>

    <div class="homekpi-group-body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  /** Sum of counts across the group — shown as a small chip in the header. */
  total?: number;
  loading?: boolean;
}>();
</script>

<style scoped lang="scss">
/*
  Primitivas del subgrupo, autocontenidas. Sin `.card-tmwe`: en el cockpit el
  grupo es un ROTULO + su rejilla de cestas, no una tarjeta.
*/

.homekpi-group {
  /* Sin fondo, sin borde, sin radio: la separacion entre grupos la da el `gap`
     de `.tmwe-cockpit__content`. */
  min-width: 0;
}

/* Rotulo del subgrupo — equivalente al `.subttl` del prototipo. */
.homekpi-group-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
  min-width: 0;
}

.homekpi-group-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-on-surface-variant));
  line-height: 1.3;
  /* El titulo cede espacio antes que el contador: con nombres largos
     ("Ricezione & controllo") el total se salia de la fila. */
  min-width: 0;
  overflow-wrap: anywhere;
}

/* Total del grupo. Texto plano alineado con el rotulo — sin pastilla de fondo,
   que anadia otra superficie a un elemento que solo informa. */
.homekpi-group-count {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface-variant));
  font-feature-settings: 'tnum';
  font-variant-numeric: tabular-nums;
}

/* ─── tile grid ─────────────────────────────────────────────────── */
.homekpi-group-body {
  display: grid;
  /* `auto-fill` con minimo de 210px — el mismo valor que el `.cgrid` del
     prototipo. Al estar los grupos apilados a lo ancho (ver
     `.tmwe-cockpit__content`), las cestas rellenan toda la fila disponible en
     vez de apretarse en una columna estrecha. */
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
  padding: 0;
  /* `align-items: stretch` is the default, but state it explicitly so
     a future regression can't accidentally let tiles shrink to
     content. With `min-height` on the tile this guarantees a uniform
     row regardless of value length. */
  align-items: stretch;
}
</style>
