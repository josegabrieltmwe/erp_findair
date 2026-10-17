/**
 * Contratos de la plataforma de correo (modelli).
 *
 * Un solo componente de envío (`EmailComposer`) se especializa por escenario
 * mediante un `EmailScenarioAdapter`. El adapter aporta el conocimiento de
 * dominio (qué modello, cómo resolver destinatarios elegibles, cómo enviar);
 * el componente aporta la mecánica común (preview WYSIWYG, selección de
 * destinatarios + manuales + CC, adjuntos, envío).
 */

/** Un destinatario, sea del catálogo (audiencia) o tecleado a mano. */
export interface Recipient {
  /** id de anagrafica/contacto cuando viene del catálogo. */
  id?: number;
  email?: string;
  name?: string;
  /** Idioma del destinatario si el escenario lo expone (p.ej. lingua_web). */
  lingua?: string;
  /** Procedencia: elegido de la audiencia vs introducido manualmente. */
  source: 'catalog' | 'manual';
}

/** Documento adjuntable (p.ej. ficheros de la expedición). */
export interface AttachmentRef {
  id: number;
  name: string;
}

/** Idioma seleccionable del correo. */
export interface LangItem {
  title: string;
  value: string;
}

/** El correo renderizado por el backend (endpoint genérico de preview). */
export interface EmailPreview {
  subject: string;
  body: string;
  from: string;
  lang: string;
  tipo: string;
}

/**
 * Estado editable del composer, lo que el usuario ve/ajusta antes de enviar.
 */
export interface EmailComposerModel {
  lang: string;
  /** Nota del operador (se inyecta en el cuerpo vía token del modello). */
  text: string;
  /** Asunto (del template; editable solo si el adapter lo permite). */
  subject: string;
  /** Cuerpo HTML renderizado y editable (WYSIWYG). */
  bodyHtml: string;
  /** Destinatarios principales (catálogo + manuales). */
  recipients: Recipient[];
  /** Copia. */
  cc: Recipient[];
  /** Adjuntos seleccionados (ids). */
  attachments: number[];
}

/** Resultado de un envío. */
export interface EmailSendResult {
  sent: number;
  errors: string[];
}

/**
 * Especialización por escenario. Cada flujo de envío implementa uno de estos y
 * se lo pasa al `EmailComposer`.
 */
export interface EmailScenarioAdapter {
  /** Clave de escenario del backend (coincide con el provider de preview). */
  readonly scenario: string;

  /** Cabecera del modal. */
  readonly title: string;
  readonly subtitle?: string;
  readonly icon?: string;

  /** Capacidades (flags de degradación controlada por escenario). */
  readonly supportsPreview: boolean;
  readonly supportsManualRecipients: boolean;
  readonly supportsCc: boolean;
  readonly supportsAttachments: boolean;
  readonly supportsLangSelect: boolean;
  /** Nota/mensaje libre del operador (token del modello). */
  readonly supportsNote: boolean;

  /** Idiomas ofrecidos y default. */
  langItems(): LangItem[];
  defaultLang(): string;

  /** Audiencia elegible (contactos/partners del escenario). */
  loadRecipients(): Promise<Recipient[]>;

  /** Adjuntos disponibles (vacío si no aplica). */
  loadAttachments?(): Promise<AttachmentRef[]>;

  /**
   * Pide al backend el correo renderizado (subject/body reales). El componente
   * pasa lang + note (+ contexto propio del adapter). Devuelve null si el
   * escenario no soporta preview o falla.
   */
  preview(input: { lang: string; text: string }): Promise<EmailPreview | null>;

  /**
   * Envía. Recibe el modelo completo; el adapter traduce a su contrato de
   * endpoint (ids vs emails, body_html editado, etc.).
   */
  send(model: EmailComposerModel): Promise<EmailSendResult>;
}
