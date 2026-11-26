/**
 * views.js
 * Carga las plantillas HTML de la carpeta views/ y las rellena con datos.
 *
 * Cada vista tiene su propio archivo .html. Al arrancar la aplicación se descargan
 * todas una sola vez (preloadViews) y quedan en memoria, así cambiar de página
 * es instantáneo.
 *
 * Marcas que se pueden usar dentro de los archivos .html:
 *   {{dato}}                 -> texto (se escapa para evitar inyección de HTML)
 *   {{{dato}}}               -> HTML ya preparado por el componente (por ejemplo, <option>)
 *   <i data-icon="plus"></i> -> se reemplaza por el ícono SVG de icons.js
 */
import { escapeHTML } from './utils.js';
import { icons } from './icons.js';

const VIEW_NAMES = [
    'login',
    'users',
    'groups',
    'exams',
    'results',
    'catalog',
    'runner-start',
    'runner-exam',
    'runner-result',
    'runner-message',
];

const cache = new Map();

// Marcas: {{{html}}} | {{texto}} | <i data-icon="nombre"></i>
const MARKS = /\{\{\{\s*(\w+)\s*\}\}\}|\{\{\s*(\w+)\s*\}\}|<i data-icon="(\w+)"><\/i>/g;

/** Descarga todas las vistas de la carpeta views/ y las guarda en memoria. */
export async function preloadViews() {
    await Promise.all(
        VIEW_NAMES.map(async (name) => {
            const response = await fetch(`views/${name}.html`);
            if (!response.ok) throw new Error(`No se pudo cargar views/${name}.html (${response.status})`);
            cache.set(name, await response.text());
        }),
    );
}

/**
 * Devuelve el HTML de una vista con sus marcas reemplazadas.
 * @param {string} name - nombre del archivo sin extensión (ej: 'login').
 * @param {Object} data - valores para las marcas {{dato}} y {{{dato}}}.
 */
export function renderView(name, data = {}) {
    const html = cache.get(name);
    if (html === undefined) throw new Error(`La vista "${name}" no está cargada.`);

    // Los comentarios son solo documentación del archivo: no se insertan en la página.
    const template = html.replace(/<!--[\s\S]*?-->/g, '');

    // Un solo recorrido: lo que se inserta no se vuelve a revisar
    // (así un texto del usuario que contenga "{{algo}}" se muestra tal cual).
    return template.replace(MARKS, (_, rawKey, textKey, iconName) => {
        if (rawKey) return String(data[rawKey] ?? '');
        if (textKey) return escapeHTML(data[textKey] ?? '');
        return icons[iconName] ?? '';
    });
}
