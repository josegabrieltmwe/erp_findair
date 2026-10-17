/**
 * fiscConfig.service — «Configuración fiscal» con vigencias (DISENO §3.2,
 * §5, §6, §7, §10.2, §11). Consume `api_fisc_config`
 * (Web_Fisc_Config_Controller, sesión + Bearer).
 *
 * Los verbos van por `op=` (el param `action` está reservado por app.php).
 * Los errores NO se capturan aquí: los componentes hacen try/catch + toast
 * (ApiError lleva `errorCode` — VALIDATION_ERROR, FISC_OVERLAP,
 * FISC_ROW_APPLIED… — y `payload.details`).
 */
import { ApiError } from "@tmwe/shared-frontend/http";
import { http } from "./http";

export type FiscTabla =
  | "voci"
  | "valori"
  | "parametri"
  | "requisiti"
  | "chiavi"
  | "canali"
  | "intermediari"
  | "plazos";

export type Situacion = "FUTURA" | "VIGENTE" | "CERRADA";

/** Una fila de cualquier tabla de reglas (los campos dependen de la tabla). */
export interface FiscRow {
  id?: number;
  chiave?: string;
  data_inizio: string;
  data_fine: string | null;
  stato?: string;
  situacion: Situacion;
  /** null = hay que consultarlo (tablas con registro de uso). */
  aplicada: boolean | null;
  ultima_aplicacion?: string | null;
  usos?: number;
  [key: string]: unknown;
}

export interface FiscMeta {
  hoy: string;
  tablas: FiscTabla[];
  escribibles: FiscTabla[];
  filtros: Record<string, string[]>;
  condiciones: { codigos: string[]; prefijos: string[] };
  enums: Record<string, Record<string, string[]>>;
  voci: Array<{
    id: number;
    codice: string;
    tipo: string;
    /** EXPEDICION o FACTURA: con `tipo` decide la etapa de las reglas del concepto. */
    ambito?: string;
    nome: string;
    data_inizio: string;
    data_fine: string | null;
  }>;
  intermediari: Array<{ id: number; codice: string; modo: string }>;
  puede_escribir: boolean;
  es_tmwe: boolean;
}

/** Tipos de dato de una condición (Fisc_Fact_Catalog::TIPOS). */
export type FiscTipoDato =
  | "texto"
  | "entero"
  | "decimal"
  | "booleano"
  | "fecha"
  | "pais"
  | "lista";

/** Un dato que una condición puede usar (`op=catalogo`, `datos[]`). */
export interface FiscDato {
  clave: string;
  tipo: FiscTipoDato;
  etapa_minima: string;
  /** EXPEDICION, FACTURA o AMBOS. */
  ambito: string;
  operadores: string[];
  etiquetas: Record<string, string>;
  origen: string | null;
  /** Definido pero sin origen todavía (cliente.grupo): una regla que lo use falla cerrada. */
  pendiente: boolean;
}

/** Una etapa del pipeline con su política de conflicto. */
export interface FiscEtapa {
  etapa: string;
  orden: number;
  por_expedicion: boolean;
  etiquetas: Record<string, string>;
  /** Políticas de las acciones de la etapa: fijar, acumular y/o bloquear. */
  politicas: Array<"fijar" | "acumular" | "bloquear">;
}

/** Una acción del catálogo de reglas (`op=catalogo`, `acciones[]`). */
export interface FiscAccion {
  codigo: string;
  etapa: string;
  politica: "fijar" | "acumular" | "bloquear";
  fase: string;
  implementada: boolean;
  descripcion: string;
  esquema: unknown[] | Record<string, unknown> | null;
}

/** Respuesta de `GET api_fisc_config?op=catalogo` (datos de código, sin BD). */
export interface FiscCatalogo {
  datos: FiscDato[];
  tipos: Record<string, string[]>;
  operadores: string[];
  etapas: FiscEtapa[];
  acciones: FiscAccion[];
  atajos: { codigos: string[]; prefijos: string[] };
  max_anidamiento: number;
  parametro_prefijo: string;
}

export interface PreviewError {
  codigo: string;
  mensaje: string;
  fields?: Record<string, string>;
  solapes?: Array<{
    id: number;
    data_inizio: string;
    data_fine: string | null;
  }>;
}

export interface ChangePreview {
  ok: boolean;
  actual: FiscRow;
  cierre: {
    id: number;
    se_cierra: boolean;
    data_fine_actual: string | null;
    data_fine_nueva: string | null;
  };
  nueva: Record<string, unknown>;
  cambios: Record<string, { antes: unknown; despues: unknown }>;
  aplicada: boolean;
  ultima_aplicacion: string | null;
  errores: PreviewError[];
  avisos: string[];
}

export interface ReviewItem {
  scope: string;
  ambito: string;
  id?: number;
  id_a?: number;
  id_b?: number;
  desde?: string;
  hasta?: string;
  id_antes?: number;
  id_despues?: number;
  data_fine?: string;
}

export interface ReviewSection {
  overlaps: ReviewItem[];
  gaps: ReviewItem[];
  expiring: ReviewItem[];
}

export interface ReviewReport {
  fecha: string;
  aviso_dias: number;
  secciones: Record<string, ReviewSection>;
  totales: { solapes: number; huecos: number; vencen: number };
  alertas_abiertas: number;
  alertas_cerradas: number;
}

export interface FiscAlerta {
  id: number;
  tipo: string;
  severidad: "CRITICA" | "ALTA" | "MEDIA";
  entidad: string;
  id_entidad: number;
  id_partner: number;
  mensaje: string;
  creada: string;
}

export type EntidadTipo = "cliente" | "partner" | "usuario";

export type EstadoRequisito = "OK" | "FALTA" | "FORMATO_INVALIDO";
export type AplicaRequisito = "SI" | "SEGUN_OPERACION" | "NO";

export interface RequisitoEntidad {
  id_requisito: number;
  dato: string;
  claves: string[];
  condicion: string;
  documentos: string[];
  obligatorio: boolean;
  aplica: AplicaRequisito;
  estado: EstadoRequisito;
  valor: string | null;
  /** De dónde sale el valor: excepción de fisc_impostazioni, origen vivo (ficha/config) o nada. */
  origen?: OrigenValor;
  clave_valor: string | null;
  formato: string;
  mensaje_error: string;
  base_legal: string;
  nivel: "ERROR" | "AVISO" | "OK";
}

export type OrigenValor = "EXCEPCION" | "ORIGEN_VIVO" | "NINGUNO";

/** Valor resuelto de una clave: excepción vigente > origen vivo > nada. */
export interface ValorResuelto {
  chiave: string;
  valor: string | null;
  origen: OrigenValor;
  ref: string;
  /** Dato de la ficha (o config) aunque haya excepción. */
  valor_ficha: string | null;
  difiere_ficha: boolean;
  /** Descripción del origen vivo de la clave ('' si no tiene). */
  origen_vivo: string;
  estado: EstadoRequisito;
}

export interface AjusteEntidad {
  id: number;
  chiave: string;
  valore: string;
  verificado: string;
  data_inizio: string;
  data_fine: string | null;
  formato_ok?: boolean;
  clave_vigente?: boolean;
  valor_ficha?: string | null;
  difiere_ficha?: boolean;
}

export interface ClaveFiscal {
  chiave: string;
  ambito: string;
  formato: string;
  descrizione: string;
  data_inizio: string;
  data_fine: string | null;
}

export interface DatosFiscales {
  entidad: {
    ambito: string;
    id: number;
    rag_soc: string;
    tipo: string;
    id_partner_emisor: number;
    iso_emisor: string;
    iso_cliente: string;
  };
  fecha: string;
  requeridos: RequisitoEntidad[];
  vigentes: AjusteEntidad[];
  valores: ValorResuelto[];
  historial: AjusteEntidad[];
  claves: ClaveFiscal[];
  puede_escribir: boolean;
}

export interface SettingsCheck {
  ok: boolean;
  fecha: string;
  errores: string[];
  avisos: string[];
}

/** Semáforo de preparación de un partner en un país (op=panorama / ficha_partner). */
export type Semaforo = "VERDE" | "AMBAR" | "ROJO";

export interface MotivoSemaforo {
  nivel: Semaforo;
  codigo: string;
  texto: string;
  /** Clave del dato que falta (DATO_EMISOR, AVISO_EMISOR). */
  dato?: string;
}

export interface PanoramaPartner {
  id_partner: number;
  nombre: string;
  iso_paese: string;
  facturas_ultimo_ano: number;
  semaforo: Semaforo;
  motivos: MotivoSemaforo[];
  impuesto: string;
  formato: string;
  canal: string;
  proceso: string;
}

export interface FichaPartner {
  partner: { id: number; nombre: string };
  iso_paese: string;
  fecha: string;
  semaforo: Semaforo;
  motivos: MotivoSemaforo[];
  resumen: { impuesto: string; formato: string; canal: string };
  impuestos: Array<{
    id: number;
    voce: string;
    condicion: string;
    perc: number | null;
    codigo_legal: string;
    mencion: string;
    rif_normativo: string;
    desde: string;
    hasta: string | null;
    general: boolean;
  }>;
  canales: Array<{
    id: number;
    tipo: string;
    formato: string;
    documento: string;
    condicion: string;
    intermediario: string;
    modo: string;
    desde: string;
    hasta: string | null;
    general: boolean;
  }>;
  plazos: Array<{
    id: number;
    documento: string;
    caso: string;
    evento: string;
    dias: number;
    tipo_dias: string;
    base_legal: string;
    descripcion: string;
    todos_los_paises: boolean;
  }>;
  requisitos: Array<{
    id: number;
    documento: string;
    condicion: string;
    dato: string;
    obligatorio: boolean;
    mensaje: string;
    base_legal: string;
  }>;
  reglas: Array<{
    id_regla: number;
    codigo: string;
    nombre: string;
    accion: string;
    etapa: string;
    resumen: string;
    params: Record<string, unknown>;
    desde: string;
    hasta: string | null;
    estado: string;
  }>;
  emisor: { errores: string[]; avisos: string[] };
  proceso: { estado: string; fecha: string | null };
  alertas_abiertas: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const BASE = "/api_fisc_config";

function query(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  return q.toString();
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await http<ApiEnvelope<T>>(`${BASE}?op=${String(body.op)}`, {
    method: "POST",
    body,
  });
  return res.data;
}

/** Errores por campo de un VALIDATION_ERROR (o vacío). */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError)) return {};
  const payload = e.payload as
    | { details?: { fields?: Record<string, string> } }
    | undefined;
  return payload?.details?.fields ?? {};
}

export const fiscConfigService = {
  async meta(): Promise<FiscMeta> {
    const res = await http<ApiEnvelope<FiscMeta>>(`${BASE}?op=meta`);
    return res.data;
  },

  /** Catálogo de datos, operadores, etapas y acciones (solo lectura). */
  async catalogo(): Promise<FiscCatalogo> {
    const res = await http<ApiEnvelope<FiscCatalogo>>(`${BASE}?op=catalogo`);
    return res.data;
  },

  /** Filas activas (línea de tiempo) o las vigentes en `fecha`. */
  async list(
    tabla: FiscTabla,
    filters: Record<string, string | number | null | undefined> = {},
    signal?: AbortSignal,
  ): Promise<FiscRow[]> {
    const res = await http<ApiEnvelope<FiscRow[]>>(
      `${BASE}?${query({ op: "list", tabla, ...filters })}`,
      { signal },
    );
    return res.data ?? [];
  },

  /** Fila con su estado de aplicación (para decidir baja o cierre). */
  async row(tabla: FiscTabla, id: number | string): Promise<FiscRow> {
    const res = await http<ApiEnvelope<FiscRow>>(
      `${BASE}?${query({ op: "row", tabla, id })}`,
    );
    return res.data;
  },

  create(
    tabla: FiscTabla,
    data: Record<string, unknown>,
    motivo: string,
  ): Promise<{ id: number | string }> {
    return post({ op: "create", tabla, data, motivo });
  },

  preview(
    tabla: FiscTabla,
    id: number,
    data: Record<string, unknown>,
    desde: string,
  ): Promise<ChangePreview> {
    return post({ op: "preview", tabla, id, data, desde });
  },

  /** «Cambiar desde fecha»: cierra la fila el día anterior y crea la nueva. */
  closeAndCreate(
    tabla: FiscTabla,
    id: number,
    data: Record<string, unknown>,
    desde: string,
    motivo: string,
  ): Promise<{ id: number }> {
    return post({ op: "close_and_create", tabla, id, data, desde, motivo });
  },

  close(
    tabla: FiscTabla,
    id: number | string,
    dataFine: string,
    motivo: string,
  ): Promise<{ ok: boolean }> {
    return post({ op: "close", tabla, id, data_fine: dataFine, motivo });
  },

  deactivate(
    tabla: FiscTabla,
    id: number | string,
    motivo: string,
  ): Promise<{ ok: boolean }> {
    return post({ op: "deactivate", tabla, id, motivo });
  },

  setIntermediarioModo(
    id: number,
    modo: "TEST" | "PROD",
    motivo: string,
  ): Promise<{ ok: boolean }> {
    return post({ op: "intermediario_modo", id, modo, motivo });
  },

  /** Informe sin efectos (GET). */
  async revision(fecha?: string): Promise<ReviewReport> {
    const res = await http<ApiEnvelope<ReviewReport>>(
      `${BASE}?${query({ op: "revision", fecha })}`,
    );
    return res.data;
  },

  /** Igual que `fisc valores:check`: levanta y cierra alertas FILA_VENCE. */
  runRevision(fecha?: string): Promise<ReviewReport> {
    return post({ op: "revision", fecha });
  },

  async alertas(
    filters: {
      tipo?: string;
      severidad?: string;
      partner?: number | null;
    } = {},
  ): Promise<FiscAlerta[]> {
    const res = await http<ApiEnvelope<FiscAlerta[]>>(
      `${BASE}?${query({ op: "alertas", ...filters })}`,
    );
    return res.data ?? [];
  },

  closeAlert(id: number, motivo: string): Promise<{ ok: boolean }> {
    return post({ op: "close_alert", id, motivo });
  },

  /** Semáforo de preparación de todos los partners ERP (rojos primero). */
  async panorama(
    fecha?: string,
  ): Promise<{ fecha: string; partners: PanoramaPartner[] }> {
    const res = await http<
      ApiEnvelope<{ fecha: string; partners: PanoramaPartner[] }>
    >(`${BASE}?${query({ op: "panorama", fecha })}`);
    return res.data;
  },

  /** «Cómo factura este partner en este país» (por defecto, su país fiscal). */
  async fichaPartner(
    partner: number,
    pais?: string,
    fecha?: string,
  ): Promise<FichaPartner> {
    const res = await http<ApiEnvelope<FichaPartner>>(
      `${BASE}?${query({ op: "ficha_partner", partner, pais, fecha })}`,
    );
    return res.data;
  },

  async datosFiscales(
    tipo: EntidadTipo,
    id: number,
    fecha?: string,
  ): Promise<DatosFiscales> {
    const res = await http<ApiEnvelope<DatosFiscales>>(
      `${BASE}?${query({ op: "datos_fiscales", tipo, id, fecha })}`,
    );
    return res.data;
  },

  async settingsCheck(
    tipo: EntidadTipo,
    id: number,
    fecha?: string,
  ): Promise<SettingsCheck> {
    const res = await http<ApiEnvelope<SettingsCheck>>(
      `${BASE}?${query({ op: "settings_check", tipo, id, fecha })}`,
    );
    return res.data;
  },

  /** Ajuste de la entidad desde una fecha (cierra el anterior). */
  async settingSet(payload: {
    tipo: EntidadTipo;
    id: number;
    clave: string;
    valor: string;
    desde: string;
    hasta?: string | null;
    motivo: string;
  }): Promise<{ id: number }> {
    const res = await http<ApiEnvelope<{ id: number }>>(
      `${BASE}?op=setting_set`,
      {
        method: "PUT",
        body: { op: "setting_set", ...payload, hasta: payload.hasta ?? "" },
      },
    );
    return res.data;
  },
};
