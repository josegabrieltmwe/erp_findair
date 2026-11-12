/**
 * Imprime un PDF que genera el servidor, sin montar HTML con imágenes en el navegador.
 *
 * Descarga el PDF con la sesión (mismo origen, `credentials`), lo abre en un iframe oculto y lanza la
 * impresión. Si el navegador no deja imprimir desde el iframe (visor de PDF interno), cae a abrir el PDF en
 * una pestaña para que el usuario imprima desde ahí. El error del servidor (JSON) llega como `Error` con su
 * mensaje, para mostrarlo en un aviso.
 */
export interface PrintPdfDeps {
  fetchFn?: typeof fetch;
  createObjectURL?: (b: Blob) => string;
  revokeObjectURL?: (u: string) => void;
  openTab?: (url: string) => void;
  mountIframe?: (
    url: string,
    onLoad: () => void,
  ) => { print: () => void; remove: () => void };
}

function defaultMountIframe(url: string, onLoad: () => void) {
  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.setAttribute("aria-hidden", "true");
  frame.onload = onLoad;
  frame.src = url;
  document.body.appendChild(frame);
  return {
    print: () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    },
    remove: () => frame.remove(),
  };
}

export async function printPdfFromUrl(
  url: string,
  deps: PrintPdfDeps = {},
): Promise<void> {
  const fetchFn = deps.fetchFn ?? fetch;
  const create = deps.createObjectURL ?? ((b: Blob) => URL.createObjectURL(b));
  const revoke =
    deps.revokeObjectURL ?? ((u: string) => URL.revokeObjectURL(u));
  const openTab =
    deps.openTab ??
    ((u: string) => void window.open(u, "_blank", "noopener,noreferrer"));
  const mount = deps.mountIframe ?? defaultMountIframe;

  const res = await fetchFn(url, { credentials: "same-origin" });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("pdf")) {
    const body = (await res.json().catch(() => null)) as {
      detail?: string;
      error?: string | { message?: string };
    } | null;
    const msg =
      body?.detail ??
      (typeof body?.error === "string" ? body.error : body?.error?.message) ??
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const blobUrl = create(await res.blob());
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const handle = mount(blobUrl, () => {
      try {
        handle.print();
      } catch {
        openTab(blobUrl);
      }
      // El diálogo de impresión es bloqueante en la mayoría de navegadores; se limpia pasado un rato.
      setTimeout(() => {
        handle.remove();
        revoke(blobUrl);
      }, 60_000);
      finish();
    });
    // Si el iframe nunca carga (visor sin evento load), no se deja al usuario sin nada.
    setTimeout(() => {
      if (!done) {
        openTab(blobUrl);
        finish();
      }
    }, 8_000);
  });
}
