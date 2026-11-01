import { describe, expect, it } from 'vitest';
import { isStaleClient, matchesClientSearch } from '@shared/oauth_clients/services/clientActivity';
import type { OAuthClient } from '@shared/oauth_clients/services/oauthClients.service';

const NOW = Date.parse('2026-10-25T12:00:00');
const base = (over: Partial<OAuthClient>): OAuthClient => ({ id: 1, client_id: 'abc', client_name: 'App', status: 'active', ...over });

describe('isStaleClient', () => {
  it('activo sin actividad registrada es latente', () => {
    expect(isStaleClient(base({ last_activity: null }), NOW)).toBe(true);
  });
  it('activo con uso reciente no es latente', () => {
    expect(isStaleClient(base({ last_activity: '2026-10-01 08:00:00' }), NOW)).toBe(false);
  });
  it('activo con último uso hace más de 90 días es latente', () => {
    expect(isStaleClient(base({ last_activity: '2026-06-01 08:00:00' }), NOW)).toBe(true);
  });
  it('deshabilitado nunca es latente', () => {
    expect(isStaleClient(base({ status: 'disabled', last_activity: null }), NOW)).toBe(false);
  });
  it('sin status usa stato A/O', () => {
    expect(isStaleClient(base({ status: undefined, stato: 'O', last_activity: null }), NOW)).toBe(false);
    expect(isStaleClient(base({ status: undefined, stato: 'A', last_activity: null }), NOW)).toBe(true);
  });
  it('fecha ilegible se trata como latente', () => {
    expect(isStaleClient(base({ last_activity: 'nunca' }), NOW)).toBe(true);
  });
});

describe('matchesClientSearch', () => {
  it('vacío coincide con todo', () => {
    expect(matchesClientSearch(base({}), '  ')).toBe(true);
  });
  it('busca sin distinguir mayúsculas en nombre, empresa, email y rol', () => {
    const c = base({ company_name: 'Acme Cargo', contact_email: 'ops@acme.io', role_name: 'Integrator Full' });
    expect(matchesClientSearch(c, 'ACME')).toBe(true);
    expect(matchesClientSearch(c, 'ops@')).toBe(true);
    expect(matchesClientSearch(c, 'integrator')).toBe(true);
    expect(matchesClientSearch(c, 'zzz')).toBe(false);
  });
});
