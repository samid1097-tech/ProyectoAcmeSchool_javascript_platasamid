/**
 * storage.js
 * Capa de persistencia de la aplicación usando localStorage.
 * Toda la información se guarda en formato JSON.
 */

const KEYS = {
    USERS: 'acme_usuarios',
    OLD_STUDENTS: 'acme_estudiantes', // Versión anterior: estudiantes en una lista aparte

    GROUPS: 'acme_grupos',
    EXAMS: 'acme_examenes',
    RESULTS: 'acme_resultados',
    SESSION: 'acme_sesion',
    ATTEMPTS: 'acme_intentos_activos',
};

/** Lee y convierte un valor JSON de localStorage. */
function read(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        console.error(`Error leyendo "${key}" de localStorage`, error);
        return fallback;
    }
}

/** Convierte a JSON y guarda un valor en localStorage. */
function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

/** Genera un identificador único sencillo. */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Crea un objeto con las operaciones CRUD para una colección.
 * Así reutilizamos la misma lógica para usuarios, estudiantes, grupos, exámenes y resultados.
 */
function createCollection(key) {
    const collection = {
        getAll() {
            return read(key, []);
        },

        getById(id) {
            return collection.getAll().find((item) => item.id === id) ?? null;
        },

        create(data) {
            const item = { ...data, id: generateId(), creadoEn: new Date().toISOString() };
            write(key, [...collection.getAll(), item]);
            return item;
        },

        update(id, data) {
            const items = collection.getAll();
            const index = items.findIndex((item) => item.id === id);
            if (index === -1) return null;

            items[index] = { ...items[index], ...data, id, actualizadoEn: new Date().toISOString() };
            write(key, items);
            return items[index];
        },

        remove(id) {
            write(key, collection.getAll().filter((item) => item.id !== id));
        },
    };

    return collection;
}

/** Crea un almacenamiento para un único valor (no una lista). */
function createSingleValue(key) {
    return {
        get: () => read(key, null),
        set: (value) => write(key, value),
        clear: () => localStorage.removeItem(key),
    };
}

/** Cargos posibles de un usuario. El cargo "Estudiante" exige un grupo. */
export const CARGOS = ['Administrativo', 'Docente', 'Estudiante'];
export const STUDENT_CARGO = 'Estudiante';

export const users = createCollection(KEYS.USERS);
export const groups = createCollection(KEYS.GROUPS);
export const exams = createCollection(KEYS.EXAMS);
export const results = createCollection(KEYS.RESULTS);
export const session = createSingleValue(KEYS.SESSION);

/**
 * Exámenes en curso, uno por estudiante: { idEstudiante: intento }.
 * Permite retomar el examen si se recarga la página.
 */
export const activeAttempts = {
    /** Todos los exámenes en curso guardados en este navegador. */
    getAll() {
        return Object.values(read(KEYS.ATTEMPTS, {}));
    },
    get(studentId) {
        return read(KEYS.ATTEMPTS, {})[studentId] ?? null;
    },
    set(attempt) {
        const all = read(KEYS.ATTEMPTS, {});
        all[attempt.estudianteId] = attempt;
        write(KEYS.ATTEMPTS, all);
    },
    clear(studentId) {
        const all = read(KEYS.ATTEMPTS, {});
        delete all[studentId];
        write(KEYS.ATTEMPTS, all);
    },
};

export function isStudent(user) {
    return user?.cargo === STUDENT_CARGO;
}

/** Usuarios con cargo "Estudiante". */
export function getStudents() {
    return users.getAll().filter(isStudent);
}

/** El correo es el usuario de inicio de sesión, por eso debe ser único. */
export function isEmailTaken(email, excludeId = null) {
    const normalized = email.trim().toLowerCase();
    return users.getAll().some((user) => user.id !== excludeId && user.email.toLowerCase() === normalized);
}

/** Busca un estudiante por su número de identificación (o null). */
export function findStudentById(identificacion) {
    return getStudents().find((student) => student.identificacion === identificacion) ?? null;
}

/** La identificación también es única para todos los usuarios. */
export function isIdTaken(identificacion, excludeId = null) {
    return users.getAll().some((user) => user.id !== excludeId && user.identificacion === identificacion);
}

/**
 * Migración: en la versión anterior los estudiantes estaban en "acme_estudiantes".
 * Se pasan a la lista de usuarios con cargo "Estudiante" conservando su id
 * (así sus resultados siguen asociados).
 */
function migrateOldStudents() {
    const oldStudents = read(KEYS.OLD_STUDENTS, null);
    if (!oldStudents) return;

    const current = users.getAll();
    const migrated = oldStudents
        .filter((s) => !current.some((u) => u.id === s.id || u.email.toLowerCase() === s.email.toLowerCase()))
        .map((s) => ({ telefono: '', ...s, cargo: STUDENT_CARGO }));

    write(KEYS.USERS, [...current, ...migrated]);
    localStorage.removeItem(KEYS.OLD_STUDENTS);
}

/** Busca el resultado de un estudiante en un examen (null si aún no lo ha presentado). */
export function findResult(studentId, examId) {
    return results.getAll().find((r) => r.estudianteId === studentId && r.examId === examId) ?? null;
}

/* =========================================================
   Datos iniciales desde la carpeta data/
   ========================================================= */

/** Archivos de la carpeta data/ y la clave de localStorage que llena cada uno. */
const DATA_FILES = [
    { key: KEYS.USERS, file: 'usuarios.json' },
    { key: KEYS.GROUPS, file: 'grupos.json' },
    { key: KEYS.EXAMS, file: 'examenes.json' },
    { key: KEYS.RESULTS, file: 'resultados.json' },
];

/**
 * Lee los archivos JSON de la carpeta data/ y los copia a localStorage.
 * Si algún archivo falta o no es una lista, no se guarda nada y se lanza un error.
 */
async function loadFromDataFolder() {
    const contents = await Promise.all(
        DATA_FILES.map(async ({ key, file }) => {
            const response = await fetch(`data/${file}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`No se pudo leer data/${file} (${response.status})`);

            const data = await response.json();
            if (!Array.isArray(data)) throw new Error(`data/${file} debe contener una lista [ ... ]`);
            return { key, data };
        }),
    );

    contents.forEach(({ key, data }) => write(key, data));
}

/** Datos mínimos por si no se pudo leer la carpeta data/ (así la app sigue funcionando). */
function createDefaultAdmin() {
    users.create({
        identificacion: '1000000000',
        nombre: 'Administrador Acme',
        email: 'admin@acme.com',
        telefono: '3001234567',
        cargo: 'Administrativo',
        password: 'admin123',
    });
}

/** Exámenes de versiones anteriores (sin grupos): se crean grupos y se les asignan. */
function upgradeExamsWithoutGroups() {
    const pending = exams.getAll().filter((exam) => !Array.isArray(exam.grupos));
    if (pending.length === 0) return;

    if (groups.getAll().length === 0) {
        groups.create({ nombre: 'Grupo A', descripcion: 'Jornada mañana' });
        groups.create({ nombre: 'Grupo B', descripcion: 'Jornada tarde' });
    }
    const allGroupIds = groups.getAll().map((group) => group.id);
    pending.forEach((exam) => exams.update(exam.id, { grupos: allGroupIds }));
}

/**
 * Prepara los datos al abrir la aplicación:
 *  - Primera vez (localStorage vacío): carga los JSON de la carpeta data/.
 *  - Siguientes veces: usa lo que ya está en localStorage.
 */
export async function seedData() {
    migrateOldStudents();

    if (users.getAll().length === 0) {
        try {
            await loadFromDataFolder();
        } catch (error) {
            console.warn('No se pudieron cargar los datos de la carpeta data/. Se crea solo el administrador.', error);
            createDefaultAdmin();
        }
    }

    upgradeExamsWithoutGroups();
}
