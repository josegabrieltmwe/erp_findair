export type LabelViewerAction =
  | "prev"
  | "next"
  | "first"
  | "last"
  | "zoomIn"
  | "zoomOut"
  | "zoomFit";

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Elemento que recibe la tecla: en un campo de texto las teclas escriben, no navegan. */
  targetTag?: string;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Atajos del visor de etiquetas. Con Ctrl/⌘/Alt no se intercepta nada (son del navegador). */
export function labelViewerAction(e: KeyLike): LabelViewerAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.targetTag && TYPING_TAGS.has(e.targetTag.toUpperCase())) return null;
  switch (e.key) {
    case "ArrowLeft":
    case "PageUp":
      return "prev";
    case "ArrowRight":
    case "PageDown":
      return "next";
    case "Home":
      return "first";
    case "End":
      return "last";
    case "+":
    case "=":
      return "zoomIn";
    case "-":
    case "_":
      return "zoomOut";
    case "0":
      return "zoomFit";
    default:
      return null;
  }
}
