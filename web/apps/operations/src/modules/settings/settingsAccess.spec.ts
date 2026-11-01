import { describe, expect, it } from 'vitest';
import { buildAccess } from '@shared/composables/useAccess';
import {
  canEnterSettingsHub,
  canOpenAdminRoute,
  SETTINGS_ROUTE_SCOPES,
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
    for (const s of ['shipment:read', 'contacts:read', 'crm:read', 'invoices:read', 'payments:read', 'driver:read']) {
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

  it('falla cerrado: perfil desconocido o backend sin access', () => {
    expect(canOpenAdminRoute('settings-cargo-carriers', ctx(null))).toBe(false);
    expect(canOpenAdminRoute('settings-cargo-carriers', ctx(false))).toBe(false);
  });
});

describe('canEnterSettingsHub', () => {
  it('TMWE sí; un cliente no; personal con config:read sí', () => {
    expect(canEnterSettingsHub(ctx(true))).toBe(true);
    expect(canEnterSettingsHub(ctx(false, ['shipment:read', 'contacts:read', 'profile:write']))).toBe(false);
    expect(canEnterSettingsHub(ctx(false, ['config:read']))).toBe(true);
  });
});
