# Casos genéricos de formulario

> **Estado:** borrador · **Última modificación:** 2026-11-01 · Generado por lectura de código (no se ejecutó nada). Parte de [plan-pruebas-formularios.md](../plan-pruebas-formularios.md). Las reglas de cada ficha salen del código citado; lo marcado «no determinado» no se pudo confirmar.

## Catálogo de casos genéricos de formulario

Se aplican a **todo formulario** de la SPA. Las fichas por formulario no los repiten: solo recogen lo específico. Al ejecutar una ficha, se recorre antes este catálogo con los campos que correspondan. «Campo» significa cada control de entrada del formulario.

| ID | Escenario | Datos de entrada | Resultado esperado | Prio. | Tipo |
|---|---|---|---|---|---|
| G-01 | Obligatorio vacío | Dejar vacío cada campo obligatorio, uno a uno, y enviar | El envío no sale. El campo se marca con mensaje localizado y el foco va al primero inválido. No se hace ninguna llamada al API | P0 | Auto |
| G-02 | Solo espacios | Campos de texto con espacios o tabulaciones | Se trata como vacío (obligatorio) o se recorta antes de enviar. Nunca se guarda un valor en blanco | P1 | Auto |
| G-03 | Longitud máxima | Valor de exactamente el máximo, máximo + 1 y un texto muy largo (10 000 caracteres) | El máximo se acepta. Por encima se bloquea con mensaje, o se limita al teclear. Sin error 5xx ni cuerpo truncado en silencio | P1 | Auto |
| G-04 | Caracteres especiales y Unicode | Acentos, ñ, ç, ß, apóstrofos, comillas, `&`, `%`, emoji y alfabetos no latinos | Se guardan y se vuelven a mostrar idénticos, en pantalla, en listados y en documentos generados | P1 | Auto |
| G-05 | HTML y scripts como texto | `<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, `{{7*7}}` | Se guarda y se muestra como texto literal en todas las pantallas. No se ejecuta nada | P0 | Auto |
| G-06 | Inyección en filtros y búsquedas | `' OR 1=1 --`, `%`, `_`, `\` en campos de búsqueda | Se trata como texto. Sin error del servidor ni resultados fuera de ámbito | P1 | Auto |
| G-07 | Tipo de dato | Letras en campos numéricos, coma y punto decimales, negativos, notación `1e5`, pegar texto con separador de miles | Solo se aceptan formatos válidos para el idioma activo. El valor enviado al API es siempre numérico y sin ambigüedad | P0 | Auto |
| G-08 | Límites numéricos | Mínimo, mínimo − 1, máximo, máximo + 1, 0 y número de muchos decimales | Los límites del negocio se respetan. Importes con los decimales de su moneda y sin pérdida de precisión | P0 | Auto |
| G-09 | Fechas | Fecha pasada, futura, bisiesta (29-02), 31 en mes de 30 días, formato del idioma y cambio de zona horaria | La fecha enviada es la elegida, sin desfase de un día. Los rangos «desde» ≤ «hasta» se validan | P1 | Auto |
| G-10 | Doble envío | Pulsar el botón principal dos veces seguidas, o Intro repetido | Una sola petición. El botón queda deshabilitado con indicador de ocupado hasta la respuesta | P0 | Auto |
| G-11 | Cancelar con cambios | Modificar campos y pulsar Cancelar, cerrar el diálogo, Escape o navegar | Si hay cambios, pide confirmación. Si se descarta, no se guarda nada. Al reabrir, el formulario está limpio | P1 | Auto |
| G-12 | Recarga o atrás | Recargar o pulsar atrás a mitad de un formulario | No se pierde información sin aviso ni se envía a medias. Los borradores, si existen, se recuperan | P2 | Manual |
| G-13 | Sesión caducada al enviar | Caducar la sesión y enviar | Se pide login una sola vez. Al volver, los datos no se pierden si el flujo lo permite. Sin duplicar el envío | P0 | Auto |
| G-14 | Sin permiso (403) | Enviar con un perfil sin permiso, o forzando la petición | Mensaje de falta de permiso, sin cerrar la sesión. La UI no ofrece normalmente la acción | P0 | Auto |
| G-15 | Error de validación del servidor (400/422) | Valor aceptado por la UI pero rechazado por el API | El error se asigna al campo correcto, o se muestra un aviso general legible. Lo tecleado se conserva | P0 | Auto |
| G-16 | Conflicto (409) o dato duplicado | Crear un registro que ya existe, o editar uno modificado por otro usuario | Mensaje claro con la causa y la salida. Sin duplicados | P1 | Auto |
| G-17 | Límite de tamaño de la petición (413) | Cuerpo por encima del límite del BFF | Mensaje claro. El formulario no se queda cargando | P1 | Auto |
| G-18 | Límite de peticiones (429) | Disparar el envío repetidamente | Aviso con el tiempo de espera. No se pierde lo tecleado | P1 | Auto |
| G-19 | Error de servidor (5xx) y tiempo agotado | Respuesta 500, 502, 503 o sin respuesta | Mensaje comprensible, sin trazas. El formulario vuelve a ser editable y se puede reintentar sin duplicar | P0 | Auto |
| G-20 | Red caída | Cortar la red al enviar | Error visible. Al recuperar la red, el reintento funciona. Nunca se muestra «guardado» sin respuesta confirmada | P1 | Manual |
| G-21 | Estado de carga y deshabilitado | Abrir el formulario de edición con datos lentos | Indicador de carga. Los campos no se pueden editar hasta tener los datos. Sin parpadeos de valores por defecto | P2 | Auto |
| G-22 | Valores por defecto | Abrir en modo alta y en modo edición | Los valores iniciales son los esperados y no se reutilizan restos de una edición anterior | P1 | Auto |
| G-23 | Campos dependientes | Cambiar el campo del que depende otro (país → provincia, tipo → campos extra) | El dependiente se limpia o recalcula y no queda un valor inválido. La validación se actualiza | P1 | Auto |
| G-24 | Autocompletado y selectores remotos | Buscar, no encontrar resultados, resultado único, muchos resultados, borrar la selección | Debounce razonable, estado «sin resultados», selección conservada y limpiable. Sin peticiones obsoletas que pisen la última | P1 | Auto |
| G-25 | Pegado y autorrelleno del navegador | Pegar con saltos de línea y espacios, usar el autorrelleno | El valor se normaliza o rechaza con mensaje. Los campos sensibles no se autorrellenan con credenciales ajenas | P2 | Manual |
| G-26 | Subida de fichero (si hay) | Fichero válido, vacío, de extensión o tipo incorrecto, muy grande, con nombre con caracteres especiales | Solo se aceptan tipos y tamaños permitidos. Errores claros. Progreso y cancelación. El nombre se muestra como texto | P0 | Auto |
| G-27 | Idiomas | Repetir el recorrido feliz en es, it, en, de y nl | Etiquetas, errores y ayudas traducidos. Formato de número y fecha del idioma. Nada desbordado | P1 | Auto |
| G-28 | Teclado y accesibilidad | Tabulación, Intro para enviar, Escape para cerrar, lector de pantalla | Orden de tabulación lógico, foco visible, etiquetas asociadas a cada campo, errores anunciados | P2 | Manual |
| G-29 | Responsive | Anchos de 1280 px y 400 px | Campos y botones accesibles, sin desbordes ni texto cortado | P2 | Manual |
| G-30 | Escritura con suplantación | Enviar como STAFF suplantando a un partner | El dato queda asociado al partner efectivo. La cabecera `X-Effective-Partner-Id` coincide, o la respuesta se descarta con 502 | P0 | Auto |
