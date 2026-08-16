# Bitácora de Arte — para Medios

Registro visual (bitácora/timeline) de trabajos de arte realizados durante el semestre, pensado para alimentarse directo desde WhatsApp (foto + fecha) y mostrarlos en orden cronológico. Construido como un **Design Canvas (`.dc.html`)**: una página HTML autocontenida que corre sobre un pequeño runtime de componentes (`support.js`) sin build step ni framework externo.

## Estructura del proyecto

```
Bitácora de Arte.dc.html      # la app: markup + lógica del componente
styles.css                    # sistema de diseño (tokens + clases de componentes)
support.js                    # runtime del Design Canvas (motor de <x-dc>, sc-for, sc-if, etc.)
image-slot.js                 # web component <image-slot>: subir/recortar/persistir fotos
.image-slots.state.json       # sidecar con las imágenes ya cargadas (base64/webp) por entrada
.thumbnail                    # miniatura de portada del proyecto
_ds/organic-66cd2492.../      # paquete fuente del sistema de diseño "Organic" (referencia/plantilla)
```

## Qué hace la app

`Bitácora de Arte.dc.html` renderiza:

1. **Header** — marca "Bitácora", contador de piezas (`{{ entryCount }} piezas`) y un toggle **Modo administrador**.
2. **Timeline vertical** — una lista (`sc-for`) de entradas, cada una con:
   - línea y punto conectores (`.tl-line` / `.tl-dot`) al estilo bitácora,
   - fecha y una etiqueta (`tag`) con el medio/técnica (Grabado, Escultura, Fotografía, Pintura, Instalación, Dibujo…),
   - una tarjeta (`.card.elev-sm`) con foto (vía `<image-slot>`), título y nota descriptiva,
   - en modo admin, botones flotantes de **Editar** (✎) y **Eliminar** (✕) sobre cada tarjeta.
3. **Lightbox** — al hacer click en una tarjeta se abre un `dialog` con la imagen ampliada, fecha, medio, título y descripción completa.
4. **Formulario de alta/edición** — modal con campos Título, Fecha, Medio/técnica, Descripción y un `<image-slot>` para la foto/video; botón flotante **+** (visible solo en modo admin) para agregar una pieza nueva.

Toda la lógica vive en un bloque `<script type="text/x-dc">` con una clase `Component extends DCLogic` que mantiene el estado (`rawEntries`, `isAdmin`, `formOpen`, `activeIndex`, etc.) y expone `renderVals()` para bindear los datos al markup. No hay backend: las entradas se guardan en memoria del componente; las fotos se persisten localmente vía el sidecar `.image-slots.state.json` que gestiona `image-slot.js`.

### Datos de ejemplo (seed)

La bitácora arranca con 6 entradas de muestra (marzo–junio 2025): xilografía, escultura en arcilla, fotografía analógica, pintura al óleo, instalación textil y dibujo a carboncillo — sirven de plantilla para el formato esperado de cada pieza.

## `<image-slot>` — el componente de imágenes

Web component reusable (`image-slot.js`) que resuelve la carga, recorte y persistencia de fotos:

- **Drag & drop o click** para subir una imagen (PNG/JPEG/WebP/AVIF).
- Recodifica la imagen a **WebP** vía `<canvas>` (máx. 1200px, calidad 0.85) antes de guardarla, para mantener el sidecar liviano.
- **Modo reframe** (doble click): permite paneo y zoom para recortar el encuadre (arrastrar, rueda del mouse, esquinas para escalar).
- Persiste cada imagen en `.image-slots.state.json` (clave = `id` del slot) para que sobreviva recargas, se comparta y se exporte junto con la página.
- Soporta fotos de stock de Unsplash con atribución obligatoria (si no hay `credit`, muestra un tile de error en vez de la foto, por los términos de uso de Unsplash).
- Atributos clave: `id` (persistencia), `shape` (`rect`/`rounded`/`circle`/`pill`), `fit` (`cover`/`contain`), `placeholder`.

## Sistema de diseño

El sistema de diseño vive en `styles.css` (tokens + componentes) y fue derivado de la plantilla **"Organic"** (documentada en `_ds/organic-.../readme.md`), retonada para este proyecto con una paleta distinta.

### Identidad visual

| Aspecto | Valor |
|---|---|
| Estilo | Cálido, redondeado, ligeramente lúdico — formas orgánicas, radios grandes, botones tipo píldora |
| Tipografía de títulos | **Caprasimo** (display, peso 400) |
| Tipografía de cuerpo | **Figtree** (400/600/700) |
| Radios | `--radius-sm` 8px · `--radius-md` 16px · `--radius-lg` 28px (tarjetas y diálogos usan `28px × 1.15`; botones, tags, inputs y `.seg` son totalmente redondeados, `999px`) |
| Densidad de espaciado | Escala 1.10× — `--space-1` a `--space-8` (4.4px → 35.2px) |
| Sombras | `--shadow-sm/md/lg`, tintadas de tinta cálida (`color-mix` sobre `#2d1c22`) |

### Paleta de color (tal como está aplicada en `styles.css`)

- **Fondo** `--color-bg` `#f7ecf0` · **Superficie** `--color-surface` `#efd9e3` · **Texto** `--color-text` `#241a1f`
- **Acento primario** `--color-accent` `#9c2f5e` (magenta/vino) — con rampa tonal 100→900 para hovers, fills tintados y estados presionados
- **Acento secundario** `--color-accent-2` `#6e4a86` (violeta) — como "segunda voz" genuina, no solo un highlight
- **Divisores** `color-mix(in srgb, #241a1f 16%, transparent)`

> Nota: la carpeta de referencia `_ds/organic-.../` documenta la versión *original* de la plantilla Organic con una paleta crema/terracota/salvia (`#f5ead8` / `#c67139` / `#7a8a5e`). El `styles.css` en la raíz del proyecto —el que realmente consume la app— fue retonado a esta paleta magenta/violeta, manteniendo la misma estructura de tokens, rampas OKLCH y clases de componentes.

Cada rol de color tiene una rampa tonal de 9 pasos (100–900) generada en espacio OKLCH sobre una escala de luminosidad perceptual compartida: los pasos claros (100–300) se usan para fills tintados y bordes sutiles, 500 es la base del rol, y los pasos oscuros (700–900) para texto sobre fondos tintados y estados presionados.

### Componentes disponibles (clases CSS)

| Clase | Uso |
|---|---|
| `.btn`, `.btn-primary/secondary/ghost/icon/block` | Botones — el primario es un fill sólido del acento |
| `.tag`, `.tag-accent/accent-2/neutral/outline` | Etiquetas pequeñas tintadas desde las rampas |
| `.field`, `.input`, `.radio`, `.seg`/`.seg-opt` | Campos de formulario y selección, sobre elementos nativos |
| `.card`, `.card-kicker/-title/-body/-meta`, `.elev-sm/md/lg` | Tarjetas de contenido y niveles de elevación |
| `.nav`, `.nav-brand` | Barra de navegación superior |
| `.table` | Tablas de datos (no usada actualmente en la app) |
| `.dialog-backdrop`, `.dialog`, `.dialog-title/-body/-actions` | Modales (lightbox y formulario) |
| `.washed` | Envoltorio que desatura/aclara fotos para que se integren al fondo cálido |

### Estados e interacción

- Todo estado interactivo está temado (nunca el estilo por defecto del navegador): hover y pressed se derivan de la rampa de acento.
- Foco de teclado: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }`.
- Selección de texto (`::selection`) con tinte del acento; controles deshabilitados caen a 45% de opacidad.

### Reglas de diseño (del `readme.md` de la plantilla Organic)

**Hacer:** sobre-redondear contenedores y botones; usar círculos/blobs como decoración; usar la rampa `accent-2` (salvia/violeta) como voz genuina; lavar (`.washed`) toda fotografía de contenido.

**Evitar:** esquinas rectas o geometría de solo líneas finas; desaturar la paleta a grises (la calidez es el punto central); tipografías condensadas o geométricas para títulos (Caprasimo es la única voz display); amontonar elementos (las formas redondeadas necesitan aire).

## Runtime técnico (`support.js` / `.dc.html`)

- `<x-dc>` es el contenedor raíz del Design Canvas; `<helmet>` inyecta `<link>`/`<style>`/`<script>` adicionales a la página.
- Directivas de plantilla: `sc-for` (listas, con `hint-placeholder-count` para preview), `sc-if` (renderizado condicional, con `hint-placeholder-val`), interpolación `{{ expresión }}`.
- La clase `Component extends DCLogic` define `state` y debe implementar `renderVals()`, que devuelve el objeto de valores/acciones bindeados al template (equivalente a un `render()` con view-model).
- `<image-slot>` es un *custom element* aparte, vendorizado en `image-slot.js`, reutilizable en cualquier `.dc.html`.

## Sistema de diseño fuente (`_ds/organic-66cd2492-.../`)

Paquete de referencia con toda la documentación y páginas de muestra de la plantilla "Organic" antes de retonarla para este proyecto: `readme.md` (guía de uso), `theme.json`-equivalente (`_ds_manifest.json`, con todos los tokens y metadata), `_ds_bundle.js` y `_adherence.oxlintrc.json` (reglas de lint que prohíben hex/px crudos y tipografías fuera del sistema, para forzar el uso de los tokens vía `var()`).
