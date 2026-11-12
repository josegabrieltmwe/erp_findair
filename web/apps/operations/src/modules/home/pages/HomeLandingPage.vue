<template>
  <!--
    Inicio minimalista. El buscador global y «Nuevo…» viven en la barra superior (PlatformTopBar),
    y el menú lateral es la navegación: aquí no se repiten.
      «Da fare oggi» (TodayBoard): tarjetas con lo que espera una acción, cada una con su
      número y su enlace a la lista filtrada; las que valen 0 se ocultan.
    El cuadro de mando completo vive en /home/indicators y solo se carga si se visita.
  -->
  <div class="home-landing" data-testid="home-landing">
    <TodayBoard />

    <router-link :to="{ name: 'home-indicators' }" class="home-landing__more" data-testid="home-indicators-link">
      {{ t('home.landing.all_indicators') }}
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import TodayBoard from '@shared/dashboard/TodayBoard.vue';

const { t } = useI18n();
</script>

<style scoped lang="scss">
.home-landing { display: flex; flex-direction: column; gap: 32px; width: 100%; max-width: 1100px; margin: 0 auto; padding: 40px 20px 64px; }
.home-landing__more { align-self: flex-start; font-size: 0.85rem; }
</style>
