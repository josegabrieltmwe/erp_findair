import { http } from './http';
import { unwrap } from './normalizers';

export interface ContattoLite {
  id: number;
  nome?: string;
  cognome?: string;
  mail?: string;
  loginn?: string;
  ruolo?: string;
  id_anagrafica: number;
  stato?: string;
  [k: string]: unknown;
}

/** Credenciales mostradas una sola vez (loginn solo en create). */
export interface RevealedCredentials {
  loginn?: string | null;
  password: string;
}

/** Respuesta de create: el contacto + sus credenciales "shown once". */
export interface ContattoCreated {
  contatto: ContattoLite | null;
  credentials: RevealedCredentials | null;
}

const ENDPOINT = '/api_anagrafica_contacts';
const FINDAIR_ENDPOINT = '/api_anagrafica_findair_access';

export type FindairLevel = 'basic' | 'full';

/** Rol OAuth tal como lo describe `api_anagrafica_findair_access`. */
export interface RoleSummary {
  id: number;
  name: string;
  display_name: string;
  /** true = aditivo: se suma al rol base en lugar de sustituirlo. */
  addon: boolean;
}

/**
 * Roles API de un contacto (tabla `contatti_oauth_role`): UN rol base más los aditivos que se suman (la unión de
 * sus scopes es lo que cuenta, luego se cruza con el techo del client OAuth).
 * `level` es la vista "findair" del rol base (basic/full) cuando es findair_basic/full; para otro rol es null.
 * `grantable_roles` son los que el llamante puede conceder a ESTE contacto: la UI solo ofrece esos.
 */
export interface ApiRoleState {
  enabled: boolean;
  level: FindairLevel | null;
  role_id: number | null;
  role_name: string | null;
  addon_roles: string[];
  addon_role_details: RoleSummary[];
  grantable_roles: RoleSummary[];
}
/** Alias histórico: el "acceso findair" es el caso particular de rol API findair_*. */
export type FindairAccessState = ApiRoleState;

/** Roles aditivos conocidos (espejo de Contatti_Oauth_Role_Model::ADDON_ROLE_NAMES) para no ofrecerlos como rol base. */
export const ADDON_ROLE_NAMES = [
  'erp_operator', 'accounting_viewer', 'account_admin', 'history_viewer', 'archive_manager',
  'contacts_search_all', 'courier_driver', 'dispatcher', 'root', 'partner_pricing', 'partner_mail_admin',
] as const;

function normalizeSummary(r: Partial<RoleSummary> | null | undefined): RoleSummary | null {
  const id = Number(r?.id);
  if (!r || !Number.isFinite(id) || id <= 0 || typeof r.name !== 'string') return null;
  return { id, name: r.name, display_name: typeof r.display_name === 'string' && r.display_name ? r.display_name : r.name, addon: Boolean(r.addon) };
}

function normalizeApiRole(data: Partial<ApiRoleState> | null | undefined): ApiRoleState {
  const roleId = data?.role_id == null ? null : Number(data.role_id);
  const list = (v: unknown): RoleSummary[] =>
    (Array.isArray(v) ? v : []).map((r) => normalizeSummary(r as Partial<RoleSummary>)).filter((r): r is RoleSummary => r !== null);
  return {
    enabled: Boolean(data?.enabled),
    level: data?.level === 'full' ? 'full' : data?.level === 'basic' ? 'basic' : null,
    role_id: roleId != null && Number.isFinite(roleId) && roleId > 0 ? roleId : null,
    role_name: typeof data?.role_name === 'string' && data.role_name ? data.role_name : null,
    addon_roles: Array.isArray(data?.addon_roles) ? data!.addon_roles!.filter((n): n is string => typeof n === 'string') : [],
    addon_role_details: list(data?.addon_role_details),
    grantable_roles: list(data?.grantable_roles),
  };
}

export const contattiService = {
  /**
   * List all contacts for a given partner (id_anagrafica is required by backend).
   * Search is performed client-side because the endpoint has no ?search= filter.
   */
  async listByPartner(anagraficaId: number): Promise<ContattoLite[]> {
    if (!anagraficaId || anagraficaId <= 0) return [];
    try {
      const raw = await http<unknown>(ENDPOINT, {
        query: { id_anagrafica: anagraficaId },
      });
      const arr = unwrap<ContattoLite[]>(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  },

  /**
   * Autisti (drivers) of a client, to populate the pickup/delivery driver
   * selects of a sede. Parity with the legacy `$pll_id_autista_x1`, which read
   * contatti of the "Autista interno" type (id_contatto_tipo=2).
   */
  async autisti(anagraficaId: number): Promise<ContattoLite[]> {
    if (!anagraficaId || anagraficaId <= 0) return [];
    try {
      const raw = await http<unknown>(ENDPOINT, {
        query: { id_anagrafica: anagraficaId, id_contatto_tipo: 2 },
      });
      const arr = unwrap<ContattoLite[]>(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  },

  async getById(id: number): Promise<ContattoLite | null> {
    if (!id) return null;
    try {
      const raw = await http<unknown>(ENDPOINT, { query: { id } });
      return unwrap<ContattoLite>(raw) ?? null;
    } catch {
      return null;
    }
  },

  async create(idAnagrafica: number, payload: Partial<ContattoLite>): Promise<ContattoCreated> {
    const raw = await http<{ data?: ContattoCreated; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { ...payload, id_anagrafica: idAnagrafica },
    });
    if (raw?.error) throw new Error(raw.error);
    return {
      contatto: raw?.data?.contatto ?? null,
      credentials: raw?.data?.credentials ?? null,
    };
  },

  /** WS2.2 (G4): reset de password; devuelve la nueva password "shown once". */
  async resetPassword(id: number): Promise<string> {
    const raw = await http<{ data?: { credentials?: RevealedCredentials }; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { action: 'reset_password', id },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data?.credentials?.password ?? '';
  },

  /**
   * Regenera el token de la APP móvil del contacto (limpia el IMEI). Devuelve
   * el nuevo token, que se muestra una sola vez.
   */
  async resetAppToken(id: number): Promise<string> {
    const raw = await http<{ data?: { app_token?: string }; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { action: 'reset_app_token', id },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data?.app_token ?? '';
  },

  /**
   * Prepara el handshake de login directo en el portal B2B como este contacto,
   * manteniendo el id del operador. Devuelve la URL de entrada (se abre en una
   * pestaña nueva porque el portal B2B es otra aplicación).
   */
  async b2bDirect(id: number): Promise<string> {
    const raw = await http<{ data?: { login_url?: string }; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { action: 'b2b_direct', id },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data?.login_url ?? '';
  },

  /** WS2.3 (G5): enviar el perfil/credenciales del contacto por email. */
  async sendProfile(id: number): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { action: 'send_profile', id },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  async update(id: number, payload: Partial<ContattoLite>): Promise<ContattoLite | null> {
    const raw = await http<{ data?: ContattoLite; error?: string }>(ENDPOINT, {
      method: 'PUT',
      query: { id },
      body: { id, ...payload },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? null;
  },

  async updatePermissions(id: number, perms: Record<string, string | boolean>): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'PATCH',
      query: { id },
      body: { id, ...perms },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  async remove(id: number): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'DELETE',
      query: { id },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  /**
   * Rol API de un contacto. "Acceso findair" = rol API findair_basic/full.
   * Endpoint dedicado (Anagrafica_Findair_Access_Controller, ruta
   * api_anagrafica_findair_access), con guard de pertenencia: el partner solo
   * puede tocar contactos de su anagrafica; TMWE cualquiera.
   */
  async getApiRole(contattoId: number): Promise<ApiRoleState> {
    const raw = await http<unknown>(FINDAIR_ENDPOINT, { query: { id: contattoId } });
    return normalizeApiRole(unwrap<Partial<ApiRoleState>>(raw));
  },

  /**
   * Asigna (roleId) o revoca (null) el rol API del contacto. `role_id` tiene
   * precedencia sobre `level` en el backend; aquí solo se envía role_id.
   */
  async setApiRole(contattoId: number, roleId: number | null): Promise<ApiRoleState> {
    const body = roleId == null
      ? { id: contattoId, enabled: false }
      : { id: contattoId, enabled: true, role_id: roleId };
    const raw = await http<{ data?: Partial<ApiRoleState>; error?: string }>(FINDAIR_ENDPOINT, {
      method: 'POST',
      body,
    });
    if (raw?.error) throw new Error(raw.error);
    return normalizeApiRole(raw?.data);
  },

  /**
   * Suma (enabled=true) o retira (enabled=false) un rol ADITIVO sin tocar el rol base. El backend decide por el
   * propio rol si es aditivo; para un rol base usar setApiRole.
   */
  async setAddonRole(contattoId: number, roleId: number, enabled: boolean): Promise<ApiRoleState> {
    const raw = await http<{ data?: Partial<ApiRoleState>; error?: string }>(FINDAIR_ENDPOINT, {
      method: 'POST',
      body: { id: contattoId, enabled, role_id: roleId },
    });
    if (raw?.error) throw new Error(raw.error);
    return normalizeApiRole(raw?.data);
  },

  /** Compat: lectura del acceso findair (= getApiRole). */
  async getFindairAccess(id: number): Promise<FindairAccessState> {
    return this.getApiRole(id);
  },

  /**
   * Compat: atajo findair por nivel. El backend resuelve `level` al rol
   * findair_basic/findair_full; sin `level`, al rol por defecto del grupo del
   * contacto (TMWE / partner / cliente); `enabled=false` revoca el rol actual.
   */
  async setFindairAccess(
    id: number,
    enabled: boolean,
    level?: FindairLevel,
  ): Promise<FindairAccessState> {
    const raw = await http<{ data?: Partial<ApiRoleState>; error?: string }>(FINDAIR_ENDPOINT, {
      method: 'POST',
      body: enabled && level ? { id, enabled, level } : { id, enabled },
    });
    if (raw?.error) throw new Error(raw.error);
    return normalizeApiRole(raw?.data);
  },

  /**
   * Client-side filter helper: filters a contact list by free text against
   * nome, cognome, mail and loginn (case-insensitive).
   */
  filterClientSide(items: ContattoLite[], query: string): ContattoLite[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => {
      const haystack = [c.nome, c.cognome, c.mail, c.loginn]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q) || String(c.id) === q;
    });
  },
};
