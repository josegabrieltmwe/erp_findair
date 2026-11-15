import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import AnagraficaListiniSection from './AnagraficaListiniSection.vue';
import type { ServiceConfigRow } from '../services/serviceConfig.service';

/**
 * Test de MONTAJE real (DOM vía happy-dom, ver environmentMatchGlobs en
 * apps/operations/vitest.config.ts): a diferencia de fuelDisplay.spec.ts
 * (que prueba la aritmética pura), esto comprueba que el componente de
 * verdad pinta `fuel_efectivo` en la columna "Fuel efectivo" de la tabla,
 * incluido el caso límite del suelo en 0 que `fmtPct` (usada en el resto de
 * la fila) ocultaría.
 *
 * El servicio HTTP (`serviceConfigService`) se mockea: el componente carga
 * los datos en `onMounted` y aquí solo nos interesa lo que pinta con una
 * fila conocida, no la llamada de red real.
 */
vi.mock('../services/serviceConfig.service', () => ({
  serviceConfigService: {
    list: vi.fn(),
    availableListini: vi.fn().mockResolvedValue({}),
    updateField: vi.fn(),
    updateFieldBatch: vi.fn(),
    toggleBlock: vi.fn(),
    toggleBlockBatch: vi.fn(),
    bulkAssign: vi.fn(),
    bulkBlock: vi.fn(),
  },
}));

import { serviceConfigService } from '../services/serviceConfig.service';

const baseRow: ServiceConfigRow = {
  id_servizio: 1,
  servizio_descr: 'IT-EXP Dedicated',
  servizio_nome: 'IT-EXP Dedicated',
  servizio_paese: 'IT',
  servizio_tipo: 'EXP',
  servizio_import: 'N',
  servizio_fuel: 44,
  tipo: 'L',
  blocked: false,
};

function mountSection(rows: ServiceConfigRow[]) {
  (serviceConfigService.list as ReturnType<typeof vi.fn>).mockResolvedValue(rows);

  const vuetify = createVuetify({ components, directives });
  // Mensajes mínimos reales (mismas claves que
  // src/modules/partner_clients/locales/es.json) para poder comprobar el
  // tooltip de desglose, no solo el valor formateado de la celda.
  const i18n = createI18n({
    legacy: false,
    locale: 'es',
    // El componente usa decenas de claves fuera de lo que prueba este test
    // (filtros, acciones de fila…); silenciar el warning de "missing key" en
    // vez de copiar todo el catálogo real evita ruido sin perder cobertura.
    missingWarn: false,
    fallbackWarn: false,
    messages: {
      es: {
        anagrafiche: {
          listini: {
            fuel_efectivo: 'Fuel efectivo',
            fuel_breakdown:
              'Fuel servicio: {servizio}% + delta cliente: {delta}% = Fuel efectivo: {efectivo}%',
          },
        },
      },
    },
  });
  const pinia = createPinia();
  setActivePinia(pinia);

  return mount(AnagraficaListiniSection, {
    props: { idAnagrafica: 123 },
    global: {
      plugins: [vuetify, i18n, pinia],
    },
    attachTo: document.body,
  });
}

describe('AnagraficaListiniSection (montaje real)', () => {
  it('pinta fuel_efectivo (servizio + delta cliente) en la columna "Fuel efectivo", con el desglose en el tooltip', async () => {
    const wrapper = mountSection([
      { ...baseRow, fuel_cliente: -15, fuel_efectivo: 29 },
    ]);
    await flushPromises();

    // El valor que de verdad se cobra, calculado por el backend, aparece en
    // el DOM — no solo en la función pura formatFuelEfectivo.
    expect(wrapper.text()).toContain('29.00 %');

    const cell = wrapper.find('span.font-weight-medium.text-high-emphasis');
    expect(cell.exists()).toBe(true);
    expect(cell.text()).toBe('29.00 %');
    expect(cell.attributes('title')).toBe(
      'Fuel servicio: 44.00% + delta cliente: -15.00% = Fuel efectivo: 29.00%',
    );

    wrapper.unmount();
  });

  it('pinta el suelo en 0 con aviso visual, en vez de ocultarlo como fmtPct', async () => {
    const wrapper = mountSection([
      { ...baseRow, fuel_cliente: -60, fuel_efectivo: 0 },
    ]);
    await flushPromises();

    const cell = wrapper.find('span.font-weight-medium.text-warning');
    expect(cell.exists()).toBe(true);
    expect(cell.text()).toBe('0.00 %');

    // El Serv.Fuel base (44) sigue mostrándose con fmtPct normal, para
    // distinguir claramente ambas columnas en la misma fila.
    expect(wrapper.text()).toContain('44.00 %');

    wrapper.unmount();
  });
});
