import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpMock = vi.fn();
// Un rechazo desde vi.fn deja una promesa derivada sin capturar y vitest lo da por fallo: los errores HTTP se simulan fuera del espia.
let httpFailure: unknown = null;
vi.mock('@shared/anagrafiche/services/http', () => ({
  http: (...args: unknown[]) => (httpFailure ? Promise.reject(httpFailure) : httpMock(...args)),
}));

import { AiAdminError } from '@shared/ai_admin/services/aiAdmin.service';
import { aiCredentialsService, myAiCredentialsService } from '@shared/ai_credentials/services/aiCredentials.service';
import {
  buildCredentialPayload,
  describeCredentialError,
  effectiveKind,
  type CredentialFormValues,
} from '@shared/ai_credentials/credentialForm';

const ENDPOINT = '/api_admin_ai_my_credentials';

function form(over: Partial<CredentialFormValues> = {}): CredentialFormValues {
  return {
    provider: 'anthropic',
    id_anagrafica: null,
    api_key: '',
    model: '',
    name: '',
    is_default: true,
    was_default: false,
    ...over,
  };
}

describe('myAiCredentialsService (modo propio, contrato ai-admin/1)', () => {
  beforeEach(() => {
    httpMock.mockReset();
    httpFailure = null;
  });

  it('lista SIN parametros (el partner lo fija el servidor) y normaliza las filas', async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: {
        items: [{ id: 21, provider: 'anthropic', name: 'Mi clave', model: '', is_default: 'S', has_key: true }],
        effective: { source: 'partner', provider: 'anthropic', uses_tmwe_key: false },
      },
    });

    const out = await myAiCredentialsService.list();

    expect(httpMock).toHaveBeenCalledTimes(1);
    expect(httpMock).toHaveBeenLastCalledWith(ENDPOINT, undefined);
    expect(out.items[0]).toMatchObject({ id: 21, has_key: true, id_anagrafica: null });
    expect(out.effective).toEqual({ source: 'partner', provider: 'anthropic', uses_tmwe_key: false });
  });

  it('una lista vacia o sin "effective" no rompe', async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });
    expect(await myAiCredentialsService.list()).toEqual({ items: [], effective: null });
  });

  it('create: solo campos del contrato; NUNCA id_anagrafica, partner_id ni stato', async () => {
    httpMock.mockResolvedValue({ success: true, data: { id: 22 } });

    await myAiCredentialsService.create({
      provider: 'openai',
      api_key: 'sk-' + 'a'.repeat(30),
      name: 'x',
      // Colados a proposito: el tipo no los admite, pero el cuerpo tampoco debe llevarlos.
      ...({ id_anagrafica: 1, partner_id: 1, stato: 'A', encrypted_api_key: 'x' } as object),
    });

    const call = httpMock.mock.calls[0];
    expect(call[0]).toBe(ENDPOINT);
    expect(call[1].method).toBe('POST');
    expect(Object.keys(call[1].body).sort()).toEqual(['api_key', 'name', 'provider']);
  });

  it('update: no envia el proveedor (la API no lo cambia) y la clave solo si se rota', async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });

    await myAiCredentialsService.update({ id: 21, provider: 'openai', name: 'Nuevo', model: 'm' });
    expect(httpMock.mock.calls[0][1]).toEqual({ method: 'PUT', body: { id: 21, name: 'Nuevo', model: 'm' } });

    await myAiCredentialsService.update({ id: 21, api_key: 'sk-' + 'b'.repeat(30) });
    expect(httpMock.mock.calls[1][1].body).toEqual({ id: 21, api_key: 'sk-' + 'b'.repeat(30) });
  });

  it('remove: DELETE con el id en la query y devuelve de donde saldra la clave', async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: { id: 21, effective: { source: 'global', provider: 'anthropic', uses_tmwe_key: true } },
    });

    const effective = await myAiCredentialsService.remove(21);

    expect(httpMock).toHaveBeenLastCalledWith(ENDPOINT, { method: 'DELETE', query: { id: '21' } });
    expect(effective?.uses_tmwe_key).toBe(true);
  });

  it('setDefault: un PUT {id, is_default: S}, sin proveedor ni partner', async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });
    await myAiCredentialsService.setDefault(21);
    expect(httpMock).toHaveBeenLastCalledWith(ENDPOINT, { method: 'PUT', body: { id: 21, is_default: 'S' } });
  });

  it.each([
    ['AI_FORBIDDEN', 'forbidden'],
    ['AI_VALIDATION', 'api_key has an invalid format'],
    ['AI_NOT_FOUND', 'Credential not found'],
  ])('un cuerpo {success:false, error_code:%s} se convierte en AiAdminError con su codigo', async (code, message) => {
    httpMock.mockResolvedValue({ success: false, error_code: code, error: message });

    const err = await myAiCredentialsService.list().catch((e) => e);

    expect(err).toBeInstanceOf(AiAdminError);
    expect(err.code).toBe(code);
    expect(err.message).toBe(message);
  });

  it('un 403/422 HTTP (ApiError con el cuerpo en details) conserva el error_code del contrato', async () => {
    const body = { success: false, error_code: 'AI_FORBIDDEN', error: 'Use the TMWE credentials endpoint' };
    httpFailure = Object.assign(new Error('Forbidden'), { status: 403, code: 'FORBIDDEN', details: body });

    const err = await myAiCredentialsService.update({ id: 1, name: 'x' }).catch((e) => e);

    expect(err).toBeInstanceOf(AiAdminError);
    expect(err.code).toBe('AI_FORBIDDEN');
    expect(err.message).toBe('Use the TMWE credentials endpoint');
  });
});

describe('modo TMWE intacto', () => {
  beforeEach(() => {
    httpMock.mockReset();
    httpFailure = null;
  });

  it('aiCredentialsService sigue usando api_admin_ai_credentials (no el endpoint propio)', async () => {
    httpMock.mockResolvedValue({ success: true, data: [] });
    await aiCredentialsService.list(7);
    expect(httpMock).toHaveBeenLastCalledWith('/api_admin_ai_credentials', { query: { id_anagrafica: '7' } });

    httpMock.mockResolvedValue({ success: true });
    await aiCredentialsService.setDefault(null, 'openai');
    expect(httpMock.mock.calls.every((c) => c[0] === '/api_admin_ai_credentials')).toBe(true);
  });
});

describe('buildCredentialPayload', () => {
  it('modo propio: nunca lleva id_anagrafica, aunque el formulario lo tenga', () => {
    const p = buildCredentialPayload(form({ id_anagrafica: 9069 }), 'create', true);
    expect(p).not.toHaveProperty('id_anagrafica');
    expect(p.provider).toBe('anthropic');
  });

  it('modo TMWE: conserva id_anagrafica (null = credencial global) exactamente como antes', () => {
    expect(buildCredentialPayload(form({ id_anagrafica: null }), 'create', false)).toHaveProperty('id_anagrafica', null);
    expect(buildCredentialPayload(form({ id_anagrafica: 9069 }), 'create', false).id_anagrafica).toBe(9069);
  });

  it('la clave solo se envia si se escribio; en edicion vacia = se conserva la guardada', () => {
    expect(buildCredentialPayload(form({ api_key: '' }), 'edit', true)).not.toHaveProperty('api_key');
    expect(buildCredentialPayload(form({ api_key: '   ' }), 'edit', true)).not.toHaveProperty('api_key');
    expect(buildCredentialPayload(form({ api_key: '  sk-nueva  ' }), 'edit', true).api_key).toBe('sk-nueva');
  });

  it('is_default: siempre en el alta; en edicion solo si cambio', () => {
    expect(buildCredentialPayload(form({ is_default: false }), 'create', true).is_default).toBe('N');
    expect(buildCredentialPayload(form({ is_default: true, was_default: true }), 'edit', true)).not.toHaveProperty('is_default');
    expect(buildCredentialPayload(form({ is_default: false, was_default: true }), 'edit', true).is_default).toBe('N');
    expect(buildCredentialPayload(form({ is_default: true, was_default: false }), 'edit', true).is_default).toBe('S');
  });

  it('recorta modelo y nombre', () => {
    const p = buildCredentialPayload(form({ model: ' gpt-4o ', name: ' Mia ' }), 'create', true);
    expect([p.model, p.name]).toEqual(['gpt-4o', 'Mia']);
  });
});

describe('effectiveKind (aviso: clave de TMWE o propia)', () => {
  it('uses_tmwe_key decide entre fallback a TMWE y clave propia', () => {
    expect(effectiveKind({ source: 'global', provider: 'anthropic', uses_tmwe_key: true })).toBe('tmwe');
    expect(effectiveKind({ source: 'partner', provider: 'anthropic', uses_tmwe_key: false })).toBe('own');
  });

  it('sin respuesta o sin ninguna clave disponible es "none"', () => {
    expect(effectiveKind(null)).toBe('none');
    expect(effectiveKind({ source: null, provider: null, uses_tmwe_key: false })).toBe('none');
  });
});

describe('describeCredentialError', () => {
  const FORBIDDEN_TEXT = 'No tienes permiso';

  it('en modo propio AI_FORBIDDEN se sustituye por el mensaje comprensible', () => {
    expect(describeCredentialError(new AiAdminError('raw', 'AI_FORBIDDEN', 403), true, FORBIDDEN_TEXT)).toBe(FORBIDDEN_TEXT);
  });

  it('AI_VALIDATION y el resto conservan el texto de la API', () => {
    expect(describeCredentialError(new AiAdminError('name is too long', 'AI_VALIDATION', 422), true, FORBIDDEN_TEXT)).toBe('name is too long');
    expect(describeCredentialError(new Error('boom'), true, FORBIDDEN_TEXT)).toBe('boom');
    expect(describeCredentialError('texto', true, FORBIDDEN_TEXT)).toBe('texto');
  });

  it('en modo TMWE nada cambia, tampoco para AI_FORBIDDEN', () => {
    expect(describeCredentialError(new AiAdminError('raw', 'AI_FORBIDDEN', 403), false, FORBIDDEN_TEXT)).toBe('raw');
  });
});
