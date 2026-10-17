<template>
  <!-- Acceso global "Nueva expedición" — visible en la topbar de todas las SPAs
       que montan PlatformTopBar. Un botón con menú (Cargo / Courier) que navega
       a las páginas /new existentes (window.location, porque cada SPA es un
       bundle servido en su propia ruta base). No duplica lógica de creación:
       reutiliza CargoNewPage / ShipmentNewPage. -->
  <v-menu location="bottom end" offset="6">
    <template #activator="{ props: menuProps }">
      <button
        type="button"
        class="ptb-newbtn"
        :title="t('platform.new_shipment.title')"
        v-bind="menuProps"
      >
        <v-icon icon="mdi-plus" size="18" />
        <span class="ptb-newbtn__label">{{ t('platform.new_shipment.title') }}</span>
      </button>
    </template>

    <v-list density="compact" min-width="200">
      <v-list-subheader>{{ t('platform.new_shipment.subheader') }}</v-list-subheader>
      <v-list-item prepend-icon="mdi-airplane" @click="go('cargo')">
        <v-list-item-title>{{ t('platform.new_shipment.cargo') }}</v-list-item-title>
      </v-list-item>
      <v-list-item prepend-icon="mdi-truck-fast" @click="go('courier')">
        <v-list-item-title>{{ t('platform.new_shipment.courier') }}</v-list-item-title>
      </v-list-item>

      <!-- F9 — el menú era solo de expediciones; el operario también da de alta
           clientes. Solo se listan acciones cuyo destino EXISTE de verdad
           (`anagrafica-create` → /clients/new). "Nueva presa" queda fuera a
           propósito: no hay ruta de alta en el modern, solo el legacy. -->
      <v-divider class="my-1" />
      <v-list-item prepend-icon="mdi-account-plus" @click="go('client')">
        <v-list-item-title>{{ t('platform.new_shipment.client') }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();

type NewType = 'cargo' | 'courier' | 'client';

// URL de página (apps viejas) por tipo.
const PATHS: Record<NewType, string> = {
  cargo: '/cargo/new',
  courier: '/shipment/new',
  client: '/clients/new',
};

// Ruta interna equivalente (existe cuando este componente vive dentro de la
// SPA unificada `operations`, que registra `cargo-new` / `shipment-new` /
// `anagrafica-create`). OJO: la ruta de alta de cliente se llama
// `anagrafica-create`, NO `anagrafica-new`.
const ROUTE_NAME: Record<NewType, string> = {
  cargo: 'cargo-new',
  courier: 'shipment-new',
  client: 'anagrafica-create',
};

function go(type: NewType): void {
  // Si estamos dentro de una SPA que YA tiene la ruta interna (operations),
  // navegamos por el router (sin recarga). Si no existe (apps viejas, cada
  // dominio en su bundle), caemos a la navegación de navegador real.
  const name = ROUTE_NAME[type];
  if (router && router.hasRoute(name)) {
    void router.push({ name });
    return;
  }
  window.location.assign(PATHS[type]);
}
</script>

<style scoped lang="scss">
.ptb-newbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px 0 10px;
  border-radius: 8px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: filter 0.15s ease;

  &:hover {
    filter: brightness(1.08);
  }
}

/* En pantallas estrechas se muestra solo el icono (+). */
@media (max-width: 700px) {
  .ptb-newbtn__label {
    display: none;
  }
  .ptb-newbtn {
    padding: 0 8px;
  }
}
</style>
