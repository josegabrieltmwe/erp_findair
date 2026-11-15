import { describe, expect, it } from 'vitest';
import { hasFindairAccessWithoutShipmentCreation, normalizeApiRole } from './contatti.service';

/**
 * C1 (acceso FindAir sin permiso de alta): la API expone `can_create_shipments` en el
 * payload de `api_anagrafica_findair_access` — veto de `auth_19` (`SHIPMENT_CREATION_VETOED`).
 * `ContattoPermissionsDialog` usa `hasFindairAccessWithoutShipmentCreation` sobre el estado
 * normalizado para decidir si muestra el aviso; estos tests cubren esa misma condición para
 * que el aviso aparezca cuando `can_create_shipments: false` y no aparezca cuando es `true`.
 */
describe('normalizeApiRole: can_create_shipments', () => {
  it('mapea can_create_shipments: false del payload crudo', () => {
    const state = normalizeApiRole({ enabled: true, role_id: 5, role_name: 'findair_basic', can_create_shipments: false });
    expect(state.can_create_shipments).toBe(false);
  });

  it('mapea can_create_shipments: true del payload crudo', () => {
    const state = normalizeApiRole({ enabled: true, role_id: 5, role_name: 'findair_basic', can_create_shipments: true });
    expect(state.can_create_shipments).toBe(true);
  });

  it('por defecto es true cuando el campo no viene en el payload (API vieja o rol no-findair)', () => {
    const state = normalizeApiRole({ enabled: true, role_id: 5, role_name: 'findair_basic' });
    expect(state.can_create_shipments).toBe(true);
  });

  it('por defecto es true con payload vacío/nulo', () => {
    expect(normalizeApiRole(null).can_create_shipments).toBe(true);
    expect(normalizeApiRole(undefined).can_create_shipments).toBe(true);
  });
});

describe('hasFindairAccessWithoutShipmentCreation (condición del aviso en ContattoPermissionsDialog)', () => {
  it('el aviso aparece: acceso FindAir habilitado + veto de alta de envíos activo', () => {
    const state = normalizeApiRole({ enabled: true, role_id: 5, role_name: 'findair_basic', can_create_shipments: false });
    expect(hasFindairAccessWithoutShipmentCreation(state)).toBe(true);
  });

  it('el aviso NO aparece: acceso FindAir habilitado y puede crear envíos', () => {
    const state = normalizeApiRole({ enabled: true, role_id: 5, role_name: 'findair_basic', can_create_shipments: true });
    expect(hasFindairAccessWithoutShipmentCreation(state)).toBe(false);
  });

  it('el aviso NO aparece: sin acceso FindAir (enabled=false), aunque can_create_shipments sea false', () => {
    const state = normalizeApiRole({ enabled: false, can_create_shipments: false });
    expect(hasFindairAccessWithoutShipmentCreation(state)).toBe(false);
  });

  it('el aviso NO aparece cuando todavía no hay estado cargado (null)', () => {
    expect(hasFindairAccessWithoutShipmentCreation(null)).toBe(false);
    expect(hasFindairAccessWithoutShipmentCreation(undefined)).toBe(false);
  });
});
