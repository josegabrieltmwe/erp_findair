import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shared/anagrafiche/services/api.types';

const httpMock = vi.fn();
vi.mock('@shared/anagrafiche/services/http', () => ({ http: (...args: unknown[]) => httpMock(...args) }));

import {
  portalMyClientsService,
  isSelfServiceDisabledError,
  isRateLimitedError,
  isClientCapReached,
  type PortalOAuthClient,
} from '@shared/portal_my_clients/services/portalMyClients.service';

const client = (over: Partial<PortalOAuthClient> = {}): PortalOAuthClient => ({
  id: 1,
  client_id: 'c_1',
  client_name: 'My app',
  company_name: '',
  contact_email: '',
  tier: 'standard',
  scopes: [],
  status: 'active',
  last_activity_at: null,
  disabled_at: null,
  disabled_reason: null,
  created_at: null,
  ...over,
});

describe('portalMyClientsService', () => {
  beforeEach(() => httpMock.mockReset());

  it('list(): pide /portal_my_clients sin parametros y normaliza clients/limits', async () => {
    httpMock.mockResolvedValue({
      success: true,
      count: 1,
      limits: { max_clients_per_user: 20, create_rate_limit_per_hour: 5 },
      clients: [client()],
    });
    const result = await portalMyClientsService.list();
    expect(httpMock).toHaveBeenCalledWith('/portal_my_clients');
    expect(result.count).toBe(1);
    expect(result.limits.max_clients_per_user).toBe(20);
    expect(result.clients).toHaveLength(1);
  });

  it('list(): tolera una respuesta sin clients/limits (no rompe la UI)', async () => {
    httpMock.mockResolvedValue({ success: true });
    const result = await portalMyClientsService.list();
    expect(result.clients).toEqual([]);
    expect(result.limits).toEqual({ max_clients_per_user: 0, create_rate_limit_per_hour: 0 });
  });

  it('create(): siempre envia action="create" explicito, nunca lo omite', async () => {
    httpMock.mockResolvedValue({ success: true, id: 2, client_id: 'c_2', client_secret: 's_2', client_name: 'X', scopes: [], warning: '' });
    await portalMyClientsService.create({ client_name: 'X' });
    const [url, options] = httpMock.mock.calls[0];
    expect(url).toBe('/portal_my_clients');
    expect(options).toEqual({ method: 'POST', body: { action: 'create', client_name: 'X' } });
  });

  it('rotate(): POST con action=rotate e id en el cuerpo', async () => {
    httpMock.mockResolvedValue({ success: true, id: 1, client_id: 'c_1', client_secret: 'new', warning: '' });
    await portalMyClientsService.rotate(1);
    expect(httpMock.mock.calls[0][1]).toEqual({ method: 'POST', body: { action: 'rotate', id: 1 } });
  });

  it('disable(): omite reason si no se pasa; lo incluye si se pasa', async () => {
    httpMock.mockResolvedValue({ success: true });
    await portalMyClientsService.disable(1);
    expect(httpMock.mock.calls[0][1]).toEqual({ method: 'POST', body: { action: 'disable', id: 1 } });
    await portalMyClientsService.disable(1, 'no longer needed');
    expect(httpMock.mock.calls[1][1]).toEqual({ method: 'POST', body: { action: 'disable', id: 1, reason: 'no longer needed' } });
  });

  it('enable(): POST con action=enable', async () => {
    httpMock.mockResolvedValue({ success: true });
    await portalMyClientsService.enable(1);
    expect(httpMock.mock.calls[0][1]).toEqual({ method: 'POST', body: { action: 'enable', id: 1 } });
  });

  it('updateMetadata(): POST con action=update_metadata, id y los campos dados', async () => {
    httpMock.mockResolvedValue({ success: true, id: 1, updated: ['client_name'] });
    await portalMyClientsService.updateMetadata(1, { client_name: 'Renamed' });
    expect(httpMock.mock.calls[0][1]).toEqual({ method: 'POST', body: { action: 'update_metadata', id: 1, client_name: 'Renamed' } });
  });
});

describe('isSelfServiceDisabledError / isRateLimitedError', () => {
  it('distingue 403 (producción) de 429 (rate limit / soft cap) de cualquier otro error', () => {
    expect(isSelfServiceDisabledError(new ApiError('disabled', 403, 'FORBIDDEN'))).toBe(true);
    expect(isSelfServiceDisabledError(new ApiError('rate', 429, 'RATE_LIMIT'))).toBe(false);
    expect(isRateLimitedError(new ApiError('rate', 429, 'RATE_LIMIT'))).toBe(true);
    expect(isRateLimitedError(new ApiError('disabled', 403, 'FORBIDDEN'))).toBe(false);
    expect(isSelfServiceDisabledError(new Error('x'))).toBe(false);
    expect(isRateLimitedError(new Error('x'))).toBe(false);
  });
});

describe('isClientCapReached', () => {
  it('compara count contra limits.max_clients_per_user, igual que el backend ($total >= MAX)', () => {
    expect(isClientCapReached({ count: 19, limits: { max_clients_per_user: 20, create_rate_limit_per_hour: 5 } })).toBe(false);
    expect(isClientCapReached({ count: 20, limits: { max_clients_per_user: 20, create_rate_limit_per_hour: 5 } })).toBe(true);
    expect(isClientCapReached({ count: 0, limits: { max_clients_per_user: 0, create_rate_limit_per_hour: 0 } })).toBe(false);
  });
});
