import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpMock = vi.fn();
vi.mock('@shared/anagrafiche/services/http', () => ({ http: (...args: unknown[]) => httpMock(...args) }));

import { AI_FEATURES, AiAdminError, aiAdminService, cleanQuery } from '@shared/ai_admin/services/aiAdmin.service';
import { AI_LEGACY_ROUTE_TABS, AI_TAB_SCOPES, canSeeAiScope, extractScopes, resolveAiTab, visibleAiTabs } from '@shared/ai_admin/composables/useAiScopes';
import { resolveCredentialTab } from '@shared/ai_credentials/credentialTabs';
import { AI_PROVIDERS } from '@shared/ai_credentials/services/aiCredentials.service';
import { resolveAgentAdminTab } from '@shared/elevenlabs_agents/agentAdminTabs';
import { flagIsOn, flagSettingsOnly, flagToValue, formatCost, groupMemoryByUser, parseLimit } from '@shared/ai_admin/format';

describe('aiAdminService (contrato ai-admin/1)', () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it('lista ajustes con partner_id solo si se indica', async () => {
    httpMock.mockResolvedValue({ success: true, data: { items: [{ key: 'copilot_enabled', value: '1', scope: 'global' }] } });
    const items = await aiAdminService.listSettings();
    expect(items).toHaveLength(1);
    expect(httpMock).toHaveBeenLastCalledWith('/api_admin_ai_settings', { query: {} });
    await aiAdminService.listSettings(7);
    expect(httpMock).toHaveBeenLastCalledWith('/api_admin_ai_settings', { query: { partner_id: '7' } });
  });

  it('guarda un ajuste con PUT y sin partner_id cuando es global', async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });
    await aiAdminService.saveSetting('voice_enabled', '0');
    expect(httpMock).toHaveBeenLastCalledWith('/api_admin_ai_settings', { method: 'PUT', body: { key: 'voice_enabled', value: '0' } });
    await aiAdminService.saveSetting('voice_enabled', '1', 3);
    expect(httpMock.mock.calls[1][1].body).toEqual({ key: 'voice_enabled', value: '1', partner_id: 3 });
  });

  it('presupuestos: PUT con limites nulos (ilimitado) y DELETE por id en query', async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });
    await aiAdminService.saveBudget({ feature: 'copilot', period: 'month', max_tokens: null, max_cost_cents: 500 });
    expect(httpMock.mock.calls[0][1]).toEqual({
      method: 'PUT',
      body: { feature: 'copilot', period: 'month', max_tokens: null, max_cost_cents: 500 },
    });
    await aiAdminService.removeBudget(12);
    expect(httpMock.mock.calls[1]).toEqual(['/api_admin_ai_budgets', { method: 'DELETE', query: { id: '12' } }]);
  });

  it('uso: descarta filtros vacios y devuelve totals y series', async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: { totals: { tokens_in: 1, tokens_out: 2, voice_seconds: 0, cost_cents: null, requests: 1, errors: 0 }, series: [] },
    });
    const usage = await aiAdminService.getUsage({ from: '2026-10-01', to: '', feature: undefined, group_by: 'feature' });
    expect(httpMock.mock.calls[0][1]).toEqual({ query: { from: '2026-10-01', group_by: 'feature' } });
    expect(usage.totals.requests).toBe(1);
    expect(usage.series).toEqual([]);
  });

  it('auditoria: pagina con cursor y next_cursor', async () => {
    httpMock.mockResolvedValue({ success: true, data: { items: [{ id: 5 }], next_cursor: 5 } });
    const page = await aiAdminService.listAudit({ feature: 'voice', limit: 50, cursor: 9 });
    expect(httpMock.mock.calls[0][1]).toEqual({ query: { feature: 'voice', limit: '50', cursor: '9' } });
    expect(page.next_cursor).toBe(5);
    httpMock.mockResolvedValue({ success: true, data: { items: [], next_cursor: null } });
    expect((await aiAdminService.listAudit()).next_cursor).toBeNull();
  });

  it('memoria de voz: borra por user_id o por id en query y devuelve deleted', async () => {
    httpMock.mockResolvedValue({ success: true, data: { deleted: 3 } });
    expect(await aiAdminService.eraseVoiceMemoryOfUser(42)).toBe(3);
    expect(httpMock.mock.calls[0]).toEqual(['/api_admin_copilot_memory', { method: 'DELETE', query: { user_id: '42' } }]);
    await aiAdminService.eraseVoiceMemoryItem(8);
    expect(httpMock.mock.calls[1][1]).toEqual({ method: 'DELETE', query: { id: '8' } });
  });

  it('salud ElevenLabs: live=1 solo bajo peticion', async () => {
    httpMock.mockResolvedValue({ success: true, data: [{ profile: 'public_form', drift: true }] });
    await aiAdminService.getElevenlabsHealth();
    expect(httpMock.mock.calls[0][1]).toEqual({ query: {} });
    const rows = await aiAdminService.getElevenlabsHealth(true);
    expect(httpMock.mock.calls[1][1]).toEqual({ query: { live: '1' } });
    expect(rows[0].drift).toBe(true);
  });

  it('un success=false conserva error_code y mensaje del servidor', async () => {
    httpMock.mockResolvedValue({ success: false, error_code: 'AI_FORBIDDEN', error: 'sin permiso' });
    await expect(aiAdminService.listBudgets()).rejects.toMatchObject({ name: 'AiAdminError', code: 'AI_FORBIDDEN', message: 'sin permiso' });
  });

  it('un error HTTP con cuerpo del contrato se traduce a AiAdminError', async () => {
    // Misma forma que ApiError de http.ts: status, code genérico y cuerpo del contrato en details.
    const apiError = Object.assign(new Error('Request failed'), {
      status: 429,
      code: 'RATE_LIMIT',
      details: { success: false, error_code: 'AI_BUDGET_EXCEEDED', error: 'tope' },
    });
    httpMock.mockRejectedValue(apiError);
    const err = await aiAdminService.getUsage().catch((e) => e);
    expect(err).toBeInstanceOf(AiAdminError);
    expect(err.code).toBe('AI_BUDGET_EXCEEDED');
    expect(err.status).toBe(429);
  });
});

describe('scopes de IA (visibilidad de menu)', () => {
  it('con lista de scopes: estricto; ai:admin implica los de administracion', () => {
    const p = { scopes: ['ai:audit:read'] };
    expect(canSeeAiScope(p, true, 'ai:audit:read')).toBe(true);
    expect(canSeeAiScope(p, true, 'ai:admin')).toBe(false);
    expect(canSeeAiScope(p, true, 'ai:memory:erase')).toBe(false);
    expect(canSeeAiScope({ scopes: 'ai:admin ai:generate' }, false, 'ai:memory:erase')).toBe(true);
    expect(canSeeAiScope({ scopes: ['ai:admin'] }, false, 'ai:generate')).toBe(false);
  });

  it('sin lista de scopes se confia en is_admin; sin scope exigido, siempre visible', () => {
    expect(extractScopes({})).toBeNull();
    expect(canSeeAiScope({}, true, 'ai:admin')).toBe(true);
    expect(canSeeAiScope({}, false, 'ai:admin')).toBe(false);
    expect(canSeeAiScope(null, null, 'ai:audit:read')).toBe(false);
    expect(canSeeAiScope(null, false, null)).toBe(true);
  });
});

describe('Centro de IA: pestanas y scopes', () => {
  it('mapa unico de scopes por pestana', () => {
    expect(AI_TAB_SCOPES).toEqual({
      usage: 'ai:admin',
      budgets: 'ai:admin',
      flags: 'ai:admin',
      audit: 'ai:audit:read',
      memory: 'ai:memory:erase',
      health: 'ai:admin',
      mine: null,
    });
  });

  it('oculta pestanas sin permiso', () => {
    expect(visibleAiTabs({ scopes: ['ai:audit:read'] }, false)).toEqual(['audit', 'mine']);
    expect(visibleAiTabs({ scopes: 'ai:admin' }, false)).toEqual(['usage', 'budgets', 'flags', 'audit', 'memory', 'health', 'mine']);
    expect(visibleAiTabs({ scopes: ['ai:generate'] }, false)).toEqual(['mine']);
    expect(visibleAiTabs({}, true)).toHaveLength(7);
    expect(visibleAiTabs({}, false)).toEqual(['mine']);
  });

  it('resuelve la pestana pedida o cae a la primera visible', () => {
    const v = visibleAiTabs({ scopes: ['ai:audit:read'] }, false);
    expect(resolveAiTab('audit', v)).toBe('audit');
    expect(resolveAiTab('budgets', v)).toBe('audit');
    expect(resolveAiTab(['mine'], v)).toBe('mine');
    expect(resolveAiTab(undefined, [])).toBeNull();
  });

  it('las rutas antiguas apuntan a pestanas existentes', () => {
    expect(AI_LEGACY_ROUTE_TABS).toEqual({
      '/settings/ai-budgets': 'budgets',
      '/settings/ai-flags': 'flags',
      '/settings/ai-audit': 'audit',
      '/settings/voice-memory': 'memory',
      '/settings/my-ai-usage': 'mine',
    });
    for (const tab of Object.values(AI_LEGACY_ROUTE_TABS)) expect(tab in AI_TAB_SCOPES).toBe(true);
  });
});

describe('features de IA', () => {
  it('incluye wizard, cod y tracking con etiqueta en todos los idiomas', async () => {
    expect([...AI_FEATURES]).toEqual(['specialist', 'copilot', 'extract', 'voice', 'wizard', 'cod', 'tracking']);
    for (const l of ['de', 'en', 'es', 'it', 'nl']) {
      const j = (await import(`./locales/${l}.json`)).default;
      for (const f of AI_FEATURES) expect(j.ai_admin.feature[f], `${l}.${f}`).toBeTruthy();
    }
  });
});

describe('formato', () => {
  it('coste, limites y flags', () => {
    expect(formatCost(1234)).toBe('12.34');
    expect(formatCost(null)).toBe('—');
    expect(parseLimit('')).toBeNull();
    expect(parseLimit('15')).toBe(15);
    expect(parseLimit('-1')).toBeUndefined();
    expect(parseLimit('abc')).toBeUndefined();
    expect(flagIsOn('1')).toBe(true);
    expect(flagIsOn('0')).toBe(false);
    expect(flagToValue(true)).toBe('1');
    expect(cleanQuery({ a: '', b: null, c: 0, d: 'x' })).toEqual({ c: '0', d: 'x' });
  });

  it('agrupa la memoria por usuario sin contenido', () => {
    const groups = groupMemoryByUser([
      { user_id: 2, created_at: '2026-10-01 10:00:00', size_chars: 100 },
      { user_id: 1, created_at: '2026-10-02 10:00:00', size_chars: 50 },
      { user_id: 2, created_at: '2026-10-03 10:00:00', size_chars: 20 },
    ]);
    expect(groups).toEqual([
      { user_id: 1, count: 1, size: 50, last: '2026-10-02 10:00:00' },
      { user_id: 2, count: 2, size: 120, last: '2026-10-03 10:00:00' },
    ]);
  });
});

describe('credenciales de IA: un solo sitio para el proveedor por defecto', () => {
  it('el selector de proveedor no sale en los interruptores', () => {
    const items = [{ key: 'copilot_enabled' }, { key: 'provider_preference' }, { key: 'voice_enabled' }];
    expect(flagSettingsOnly(items).map((i) => i.key)).toEqual(['copilot_enabled', 'voice_enabled']);
  });

  it('openai va antes que anthropic', () => {
    expect([...AI_PROVIDERS]).toEqual(['openai', 'anthropic']);
  });

  it('pestanas LLM y Voz con LLM por defecto', () => {
    expect(resolveCredentialTab('voice')).toBe('voice');
    expect(resolveCredentialTab(['voice'])).toBe('voice');
    expect(resolveCredentialTab('x')).toBe('llm');
    expect(resolveCredentialTab(undefined)).toBe('llm');
  });
});

describe('agentes de voz del admin', () => {
  it('pestanas Sincronizar y Revision con Sincronizar por defecto', () => {
    expect(resolveAgentAdminTab('review')).toBe('review');
    expect(resolveAgentAdminTab(['review'])).toBe('review');
    expect(resolveAgentAdminTab('otra')).toBe('sync');
    expect(resolveAgentAdminTab(undefined)).toBe('sync');
  });
});
