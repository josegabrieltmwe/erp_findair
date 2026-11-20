import { describe, expect, it } from 'vitest';
import { buildAccess } from '@shared/composables/useAccess';
import {
  canEnterSettingsHub,
  canOpenAdminRoute,
  SETTINGS_ROUTE_SCOPES,
  SETTINGS_ROUTES_OPEN_TO_ANY_USER,
  STAFF_ONLY_SCOPES,
} from './settingsAccess';

const ctx = (isAdmin: boolean | null, scopes?: string[]) => ({
  isAdmin,
  access: buildAccess(scopes ? { access: { scopes } } : null),
});

describe('SETTINGS_ROUTE_SCOPES', () => {
  it('solo mapea scopes que tienen únicamente roles de personal', () => {
    for (const [route, scopes] of Object.entries(SETTINGS_ROUTE_SCOPES)) {
      for (const s of scopes) expect(STAFF_ONLY_SCOPES.has(s), `${route} -> ${s}`).toBe(true);
    }
  });

  it('no incluye scopes que también tienen clientes', () => {
    for (const s of ['shipment:read', 'contacts:read', 'crm:read', 'invoices:read', 'payments:read', 'payment_gateways:read', 'payment_gateways:write', 'driver:read']) {
      expect(STAFF_ONLY_SCOPES.has(s)).toBe(false);
    }
  });

  it('las pantallas sensibles siguen siendo solo TMWE', () => {
    for (const r of ['settings-profit-presets', 'settings-payment-config', 'settings-driver-zones', 'settings-users', 'settings-oauth-clients', 'pickup-routes']) {
      expect(SETTINGS_ROUTE_SCOPES[r]).toBeUndefined();
    }
  });
});

describe('canOpenAdminRoute', () => {
  it('TMWE entra a todo, haya o no access (respaldo)', () => {
    expect(canOpenAdminRoute('settings-users', ctx(true))).toBe(true);
    expect(canOpenAdminRoute('settings-cargo-carriers', ctx(true, []))).toBe(true);
  });

  it('no TMWE con el scope entra a la ruta mapeada', () => {
    expect(canOpenAdminRoute('settings-cargo-carriers', ctx(false, ['config:read']))).toBe(true);
  });

  it('no TMWE sin el scope no entra', () => {
    expect(canOpenAdminRoute('settings-cargo-carriers', ctx(false, ['shipment:read']))).toBe(false);
  });

  it('no TMWE no entra a rutas sin mapear aunque tenga muchos scopes', () => {
    expect(canOpenAdminRoute('settings-users', ctx(false, ['config:read', 'suppliers:read', 'profile:write']))).toBe(false);
  });

  it('clientes sin margen: entra quien tiene margins:read (margenes_clientes), no quien solo tiene config:read', () => {
    expect(canOpenAdminRoute('settings-customers-without-margin', ctx(false, ['margins:read']))).toBe(true);
    expect(canOpenAdminRoute('settings-customers-without-margin', ctx(false, ['config:read']))).toBe(false);
  });

  it('agente de voz del partner: entra quien tiene partner_agent:read, no quien solo tiene config:read', () => {
    expect(canOpenAdminRoute('settings-elevenlabs-my-agent', ctx(false, ['partner_agent:read']))).toBe(true);
    expect(canOpenAdminRoute('settings-elevenlabs-my-agent', ctx(false, ['config:read']))).toBe(false);
  });

  it('falla cerrado: perfil desconocido o backend sin access', () => {
    expect(canOpenAdminRoute('settings-cargo-carriers', ctx(null))).toBe(false);
    expect(canOpenAdminRoute('settings-cargo-carriers', ctx(false))).toBe(false);
  });

  it('autoservicio OAuth (SETTINGS_ROUTES_OPEN_TO_ANY_USER): entra cualquiera, sin scope ni admin ni access conocido', () => {
    expect(canOpenAdminRoute('settings-my-oauth-clients', ctx(false, []))).toBe(true);
    expect(canOpenAdminRoute('settings-my-oauth-clients', ctx(false))).toBe(true);
    expect(canOpenAdminRoute('settings-my-oauth-clients', ctx(null))).toBe(true);
  });
});

describe('canEnterSettingsHub', () => {
  it('TMWE sí; personal con config:read sí', () => {
    expect(canEnterSettingsHub(ctx(true))).toBe(true);
    expect(canEnterSettingsHub(ctx(false, ['config:read']))).toBe(true);
  });

  // Antes de SETTINGS_ROUTES_OPEN_TO_ANY_USER, un cliente sin ningún scope de
  // STAFF_ONLY_SCOPES no entraba al hub. Desde que existe al menos una ruta
  // abierta a cualquiera (autoservicio OAuth, portal_my_clients), el hub se
  // abre para cualquier usuario autenticado — esa tarjeta sola lo justifica,
  // aunque el resto de pestañas le queden vacías.
  it('un cliente sin scopes de personal entra igualmente por la ruta abierta a cualquiera', () => {
    expect(canEnterSettingsHub(ctx(false, ['shipment:read', 'contacts:read', 'profile:write']))).toBe(true);
    expect(canEnterSettingsHub(ctx(false, []))).toBe(true);
    expect(SETTINGS_ROUTES_OPEN_TO_ANY_USER.has('settings-my-oauth-clients')).toBe(true);
  });
});
