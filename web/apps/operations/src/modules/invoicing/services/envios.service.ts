/**
 * envios.service — página «Envíos al Estado» (rediseño R7-R8, DISENO §10).
 * Consume `api_fisc_envios` (Web_Fisc_Envios_Controller, sesión + Bearer).
 *
 * Los verbos van por `op=` (el param `action` está reservado por app.php).
 * Los errores NO se capturan aquí: el store hace try/catch + toast.
 */
import { http } from "./http";

export type EnviosTab =
  | "listas"
  | "enviadas"
  | "aceptadas"
  | "rechazadas"
  | "retenidas";

export const ENVIOS_TABS: EnviosTab[] = [
  "listas",
  "enviadas",
  "aceptadas",
  "rechazadas",
  "retenidas",
];

export type EnvioEstado =
  | "PENDIENTE"
  | "ENVIADA"
  | "ACEPTADA"
  | "RECHAZADA"
  | "ERROR";

export type Semaforo = "verde" | "ambar" | "rojo" | null;

/** Una fila de la página (fisc_trasmissioni + factura + canal + control). */
export interface EnvioRow {
  id: number;
  id_fattura: number;
  id_canale: number;
  id_intermediario: number;
  estado: EnvioEstado;
  intentos: number;
  id_envio_externo: string;
  payload_hash: string;
  acuse_codigo: string;
  plazo_limite: string | null;
  plazo_aviso: string | null;
  plazo_caso: string;
  error: string | null;
  enviado: string | null;
  respuesta: string | null;
  id_anterior: number;
  nombre_fichero: string;
  numero: string | number;
  numero_alfanum?: string;
  data_fattura: string;
  cod_sdi_TD?: string;
  stato_sdi?: string;
  importo_netto: number | string;
  importo_iva: number | string;
  valuta_sigla?: string;
  id_anagrafica_partn: number;
  partner_rag_soc?: string;
  cliente_rag_soc?: string;
  canal_pais?: string | null;
  canal_tipo?: string | null;
  canal_formato?: string | null;
  canal_modo?: string | null;
  intermediario_codice?: string | null;
  intermediario_modo?: string | null;
  cert_resultado?: string | null;
  validacion_estado?: string | null;
  es_primero: boolean;
  /** FACTURA (por defecto) | AUTOFACTURA (TD17/TD18/TD28; id_fattura = pasiva de origen). */
  tipo_documento?: "FACTURA" | "AUTOFACTURA";
  id_autofattura?: number;
  /** Autofactura: control que sustituye al certificado (XSD + estado). */
  autofactura?: { ok: boolean; control: string; tipo: string } | null;
  /** Calculados por el backend. */
  retenida: boolean;
  motivos: string[];
  semaforo: Semaforo;
  dias_restantes: number | null;
  pestana: EnviosTab;
  tiene_fichero: boolean;
}

export type EnviosCounters = Record<EnviosTab, number>;

export interface EnviosFilters {
  partner?: number | null;
  pais?: string;
  estado?: string;
  tipo_canal?: string;
  vence?: "" | "vencido" | "hoy" | "7d";
  q?: string;
}

export interface EnviosPage {
  items: EnvioRow[];
  total: number;
  counters: EnviosCounters;
  puedeEnviar: boolean;
  esTmwe: boolean;
}

export interface EnvioAcuse {
  id: number;
  id_trasmissione: number;
  tipo: string;
  codigo: string;
  estado: EnvioEstado;
  id_externo: string;
  mensaje: string | null;
  fichero: string;
  origen: string;
  fecha_acuse: string | null;
  recibido: string;
}

export interface VerificacionPaso {
  id: number;
  paso: string;
  regla: string;
  esperado: string;
  obtenido: string;
  resultado: "OK" | "KO";
  detalle: string | null;
}

export interface EnvioDetail {
  envio: EnvioRow;
  intentos: Array<Partial<EnvioRow> & { id: number; estado: EnvioEstado }>;
  acuses: EnvioAcuse[];
  verificacion: {
    certificado: {
      resultado: string;
      hash_documento: string;
      creado: string;
    } | null;
    pasos: VerificacionPaso[];
    autofactura?: { ok: boolean; control: string; tipo: string } | null;
  };
  alertas: Array<{
    id: number;
    tipo: string;
    severidad: string;
    mensaje: string;
    creada: string;
  }>;
  puede_enviar: boolean;
}

export interface EnvioFile {
  filename: string;
  mime: string;
  content_base64: string;
}

export interface SendResult {
  id: number;
  ok: boolean;
  estado?: EnvioEstado;
  entrega_manual?: boolean;
  fichero?: string;
  acuse?: string;
  avisos?: string[];
  error?: string;
  codigo?: string;
}

export interface ReceiptResult {
  id: number;
  estado: EnvioEstado;
  codigo: string;
  mensaje?: string;
  duplicado: boolean;
  avisos: string[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  pagination?: { total: number; page: number; per_page: number };
  counters?: EnviosCounters;
  puede_enviar?: boolean;
  es_tmwe?: boolean;
  error?: string;
}

function query(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  return q.toString();
}

export const enviosService = {
  /** Pestaña paginada + contadores de todas las pestañas. */
  async list(
    tab: EnviosTab,
    filters: EnviosFilters,
    page: number,
    perPage: number,
    signal?: AbortSignal,
  ): Promise<EnviosPage> {
    const res = await http<ApiEnvelope<EnvioRow[]>>(
      `/api_fisc_envios?${query({ op: "list", tab, page, per_page: perPage, ...filters })}`,
      { signal },
    );
    return {
      items: res.data ?? [],
      total: res.pagination?.total ?? 0,
      counters: (res.counters ?? {}) as EnviosCounters,
      puedeEnviar: !!res.puede_enviar,
      esTmwe: !!res.es_tmwe,
    };
  },

  async detail(id: number, signal?: AbortSignal): Promise<EnvioDetail> {
    const res = await http<ApiEnvelope<EnvioDetail>>(
      `/api_fisc_envios?op=detail&id=${id}`,
      { signal },
    );
    return res.data;
  },

  /** Fichero del canal entregado (XML FatturaPA, UBL, PDF…) en base64. */
  async file(id: number): Promise<EnvioFile> {
    const res = await http<ApiEnvelope<EnvioFile>>(
      `/api_fisc_envios?op=file&id=${id}`,
    );
    return res.data;
  },

  /** XML de la autofactura de la pasiva (descarga del canal manual). */
  async autofacturaXml(idPasiva: number): Promise<{
    filename: string;
    content: string;
    mime_type?: string;
  }> {
    const res = await http<
      ApiEnvelope<{ filename: string; content: string; mime_type?: string }>
    >(`/api_invoice_einvoice_autofattura?id=${idPasiva}&download=1`);
    return res.data;
  },

  /** Acuse original (tal como llegó) en base64. */
  async receipt(idAcuse: number): Promise<EnvioFile> {
    const res = await http<ApiEnvelope<EnvioFile>>(
      `/api_fisc_envios?op=receipt&id_acuse=${idAcuse}`,
    );
    return res.data;
  },

  /** Envío individual o por lotes: un resultado por envío. */
  async send(ids: number[]): Promise<{
    resultados: SendResult[];
    enviados: number;
    fallidos: number;
  }> {
    const res = await http<
      ApiEnvelope<{
        resultados: SendResult[];
        enviados: number;
        fallidos: number;
      }>
    >(`/api_fisc_envios?op=send`, {
      method: "POST",
      body: { op: "send", ids },
    });
    return res.data;
  },

  async retry(id: number): Promise<SendResult> {
    const res = await http<ApiEnvelope<SendResult>>(
      `/api_fisc_envios?op=retry`,
      {
        method: "POST",
        body: { op: "retry", id },
      },
    );
    return res.data;
  },

  /**
   * Carga el acuse oficial (intermediario MANUAL). `resultado` solo para
   * confirmaciones de email que el sistema no puede interpretar.
   */
  async uploadReceipt(
    id: number,
    filename: string,
    contentBase64: string,
    resultado?: "ACEPTADA" | "RECHAZADA",
  ): Promise<ReceiptResult> {
    const res = await http<ApiEnvelope<ReceiptResult>>(
      `/api_fisc_envios?op=upload_receipt`,
      {
        method: "POST",
        body: {
          op: "upload_receipt",
          id,
          filename,
          content_base64: contentBase64,
          resultado: resultado ?? "",
        },
      },
    );
    return res.data;
  },
};

/** Lee un File del navegador como base64 (sin el prefijo data:). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
