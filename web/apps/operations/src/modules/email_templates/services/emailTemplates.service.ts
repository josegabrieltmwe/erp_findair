import { http } from "@shared/anagrafiche/services/http";

/**
 * Plantillas de correo (`modelli`).
 *
 * Backend:
 *   /api_master_templates_web   (Web_Modelli_Controller) — CRUD REST
 *     GET                lista (aislada por partner desde F0)
 *     GET  ?id=N         una plantilla
 *     POST               crear   — el dueño lo asigna el servidor
 *     PUT                actualizar (id en body)
 *     DELETE ?id=N       soft-delete stato='O'
 *   /api_modelli_preview_web    (Web_Modelli_Preview_Controller) — POST
 *     Renderiza el texto que se está editando con datos de EJEMPLO y devuelve
 *     el resultado + los problemas detectados. No guarda nada.
 *
 * Aislamiento: un partner solo ve y edita sus plantillas; TMWE (anagrafica 1)
 * las ve todas. Lo aplica el backend — el frontend no filtra por partner.
 *
 * Motor: se decide por la SINTAXIS del contenido. Si la plantilla contiene
 * `{{ … }}` o `{% … %}` se renderiza con Twig; en caso contrario con el
 * metalenguaje histórico `!#MARCADOR#!`. El editor solo lo muestra.
 */

export type Flag = "S" | "N";
export type Engine = "legacy" | "modern";
export type IssueSeverity = "error" | "warning" | "info";

/** Fila del listado. */
export interface EmailTemplate {
  id: number;
  tipo: string;
  id_anagrafica: number;
  lingua: string;
  descriz: string | null;
  oggetto: string | null;
  mail: Flag;
  fax: Flag;
  sms: Flag;
  carta: Flag;
  mittente_msg: string | null;
  stato: "A" | "O";
  [k: string]: unknown;
}

/** Fila completa, con el cuerpo. */
export interface EmailTemplateDetail extends EmailTemplate {
  html: string | null;
  html_purify: Flag | null;
}

/**
 * Campos escribibles.
 *
 * `id_anagrafica` solo se honra al CREAR y solo si el usuario es TMWE: es como
 * TMWE da de alta una plantilla base (id_anagrafica = 1) o una especialización
 * para un partner concreto. Para un usuario de partner el servidor lo ignora y
 * asigna su propia anagrafica (anti-IDOR, F0).
 *
 * En una actualización NUNCA se aplica: una plantilla no cambia de dueño.
 */
export interface EmailTemplatePayload {
  tipo: string;
  lingua: string;
  id_anagrafica?: number;
  descriz?: string;
  oggetto?: string;
  html?: string;
  mail?: Flag;
  fax?: Flag;
  sms?: Flag;
  carta?: Flag;
  mittente_msg?: string;
  html_purify?: Flag;
}

/** Problema detectado en una plantilla, en lenguaje llano. */
export interface TemplateIssue {
  severity: IssueSeverity;
  code: string;
  token: string;
  message: string;
}

/** Marcador disponible para el tipo, para el panel de ayuda. */
export interface TemplateToken {
  token: string;
  label: string;
  desc: string;
  is_html: boolean;
  alias_of: string | null;
  twig: string | null;
}

export interface TemplatePreview {
  engine: Engine;
  success: boolean;
  subject: string;
  body: string;
  error: string;
  error_code: string;
  issues: TemplateIssue[];
  tokens: string[];
  available: TemplateToken[];
}

/** Acciones del asistente de IA. Siempre devuelven una SUGERENCIA. */
export type AssistAction = "draft" | "translate" | "explain" | "fix";

export interface AssistResult {
  success: boolean;
  action: AssistAction;
  /** Cuerpo sugerido. Vacío en `explain` o si el modelo no respetó el formato. */
  html: string;
  oggetto: string;
  explanation: string;
  /** false si la sugerencia usa marcadores que no existen. */
  valid: boolean;
  issues: TemplateIssue[];
  provider: string;
  model: string;
  usage: { input?: number; output?: number };
  error: string;
  error_code: string;
}

const BASE = "/api_master_templates_web";
const PREVIEW = "/api_modelli_preview_web";
const ASSIST = "/api_modelli_assist_web";

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

/** Colapsa array / `{data}` / `{data:{items}}` en un array plano. */
function listOf<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const d = (raw as { data?: unknown })?.data;
  if (Array.isArray(d)) return d as T[];
  const items = (d as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

function objOf<T>(raw: unknown): T {
  const d = (raw as { data?: unknown })?.data;
  return (d ?? raw) as T;
}

export const emailTemplatesService = {
  /**
   * Listado de plantillas visibles para el usuario.
   *
   * Un partner recibe solo las suyas (lo fuerza el backend). TMWE las recibe
   * todas y puede acotar por `id_anagrafica` para ver las de un partner
   * concreto o las base (id_anagrafica = 1).
   */
  async list(params?: {
    tipo?: string;
    lingua?: string;
    id_anagrafica?: number;
  }): Promise<EmailTemplate[]> {
    // El backend (Listable_Trait) topa `limit` en 100 y RECHAZA valores
    // mayores con un error de validación — que se traduciría en una lista
    // vacía sin explicación. Se pagina hasta agotar en vez de pedir de golpe.
    const PAGE_SIZE = 100;
    const MAX_PAGES = 20; // 2.000 filas; hoy hay ~336

    const out: EmailTemplate[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const raw = await http<unknown>(BASE, {
        query: { ...params, limit: PAGE_SIZE, page },
      });
      const chunk = listOf<EmailTemplate>(raw);
      out.push(...chunk);
      if (chunk.length < PAGE_SIZE) break;
    }
    return out;
  },

  /** Una plantilla con su cuerpo. */
  async getById(id: number): Promise<EmailTemplateDetail> {
    const raw = await http<unknown>(BASE, { query: { id } });
    return objOf<EmailTemplateDetail>(raw);
  },

  async create(payload: EmailTemplatePayload): Promise<EmailTemplateDetail> {
    const raw = await http<RawWrite>(BASE, { method: "POST", body: payload });
    assertOk(raw, "No se pudo crear la plantilla");
    return objOf<EmailTemplateDetail>(raw);
  },

  async update(
    id: number,
    payload: Partial<EmailTemplatePayload>,
  ): Promise<EmailTemplateDetail> {
    const raw = await http<RawWrite>(BASE, {
      method: "PUT",
      body: { ...payload, id },
    });
    assertOk(raw, "No se pudo guardar la plantilla");
    return objOf<EmailTemplateDetail>(raw);
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: "DELETE", query: { id } });
    assertOk(raw, "No se pudo eliminar la plantilla");
  },

  /**
   * Previsualiza el texto que se está editando. No guarda: se le pasa el
   * contenido del editor tal cual, y el backend lo renderiza con datos de
   * ejemplo. Es también la vía para validar antes de guardar.
   */
  async preview(input: {
    html: string;
    oggetto?: string;
    tipo?: string;
  }): Promise<TemplatePreview> {
    const raw = await http<RawWrite>(PREVIEW, { method: "POST", body: input });
    assertOk(raw, "No se pudo generar la previsualización");
    return objOf<TemplatePreview>(raw);
  },

  /**
   * Pide una sugerencia a la IA. Nunca guarda: devuelve un borrador que el
   * editor muestra para aceptar o descartar. Si la sugerencia usa marcadores
   * inexistentes llega con `valid: false` y el detalle en `issues`.
   */
  async assist(input: {
    action: AssistAction;
    html?: string;
    oggetto?: string;
    tipo?: string;
    lingua?: string;
    target_lingua?: string;
    instruction?: string;
  }): Promise<AssistResult> {
    const raw = await http<RawWrite>(ASSIST, { method: "POST", body: input });
    assertOk(raw, "No se pudo obtener la sugerencia");
    return objOf<AssistResult>(raw);
  },
};
