/**
 * main.js
 * Punto de entrada:
 *   1. Prepara los datos (la primera vez los lee de la carpeta data/)
 *      y descarga las vistas HTML de la carpeta views/.
 *   2. Registra los Web Components.
 *   3. Arranca el enrutador (navegación entre vistas usando el hash de la URL).
 */
import { seedData } from './storage.js';
import { preloadViews } from './views.js';
import { getRole, ROLES, HOME_BY_ROLE } from './auth.js';
import { navigate } from './utils.js';

const { STAFF, GUEST } = ROLES;

/**
 * Tabla de rutas.
 * - roles: quién puede ver la vista.
 * - param: nombre del atributo que recibe el parámetro de la URL.
 *
 * El módulo de resolución de exámenes es PÚBLICO (no requiere iniciar sesión).
 */
const ROUTES = {
    login: { tag: 'login-view', roles: [GUEST], title: 'Iniciar sesión' },
    usuarios: { tag: 'users-view', roles: [STAFF], title: 'Gestión de usuarios' },
    grupos: { tag: 'groups-view', roles: [STAFF], title: 'Grupos y estudiantes' },
    'gestion-examenes': { tag: 'exams-view', roles: [STAFF], title: 'Gestión de exámenes' },
    resultados: { tag: 'results-view', roles: [STAFF], title: 'Resultados' },
    examenes: { tag: 'exam-catalog', roles: [GUEST, STAFF], title: 'Exámenes disponibles' },
    examen: { tag: 'exam-runner', roles: [GUEST, STAFF], param: 'exam-id', title: 'Presentar examen' },
};

function parseHash() {
    const [name = '', param = ''] = location.hash.replace(/^#\/?/, '').split('/');
    return { name, param: decodeURIComponent(param) };
}

function router() {
    const { name, param } = parseHash();
    const route = ROUTES[name];
    const role = getRole();

    // Ruta inexistente o sin permiso: se envía a la vista inicial de su rol
    // (para quien no ha iniciado sesión, la entrada es el login).
    if (!route || !route.roles.includes(role)) return navigate(HOME_BY_ROLE[role]);

    const view = document.createElement(route.tag);
    if (route.param && param) view.setAttribute(route.param, param);

    const outlet = document.getElementById('app');
    outlet.replaceChildren(view);
    document.title = `${route.title} | Acme School`;
    window.scrollTo({ top: 0 });
}

async function start() {
    // Los datos y las vistas HTML deben estar listos ANTES de registrar los componentes,
    // porque <app-navbar> (que ya está en el HTML) lee la sesión al dibujarse.
    try {
        await Promise.all([seedData(), preloadViews()]);
    } catch (error) {
        console.error(error);
        document.getElementById('app').innerHTML =
            '<p class="noscript">No se pudieron cargar las vistas de la carpeta views/. Abre el proyecto con Live Server.</p>';
        return;
    }
    await import('./components/index.js');

    window.addEventListener('hashchange', router);
    router();
}

start();
