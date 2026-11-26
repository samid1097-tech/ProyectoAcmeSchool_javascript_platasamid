/**
 * auth.js
 * Manejo de la sesión del PERSONAL (Administrativo o Docente).
 *
 * Los estudiantes NO inician sesión: el módulo de resolución de exámenes es público
 * y solo pide identificación y nombre completo.
 *
 * Roles:
 *  - staff:    Administrativo o Docente con sesión iniciada.
 *  - invitado: nadie ha iniciado sesión (puede usar el login y presentar exámenes).
 */
import { users, session, isStudent } from './storage.js';

export const ROLES = {
    STAFF: 'staff',
    GUEST: 'invitado',
};

/** Ruta de la vista inicial de cada rol. */
export const HOME_BY_ROLE = {
    [ROLES.STAFF]: 'usuarios',
    [ROLES.GUEST]: 'login',
};

/** Avisa a toda la aplicación que el estado de la sesión cambió. */
function notifyAuthChange() {
    window.dispatchEvent(new CustomEvent('auth-changed'));
}

/**
 * Intenta iniciar sesión con correo y contraseña (solo personal).
 * @returns el usuario si las credenciales son correctas, o null.
 */
export function login(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = users.getAll().find(
        (u) => !isStudent(u) && u.email.toLowerCase() === normalizedEmail && u.password === password,
    );
    if (!user) return null;

    session.set({ userId: user.id, inicio: new Date().toISOString() });
    notifyAuthChange();
    return user;
}

export function logout() {
    session.clear();
    notifyAuthChange();
}

/** Usuario del personal con sesión iniciada, o null. */
export function getCurrentUser() {
    const current = session.get();
    if (!current) return null;

    const user = users.getById(current.userId);
    if (!user || isStudent(user)) {
        // El usuario ya no existe o ahora es estudiante: la sesión deja de ser válida.
        session.clear();
        return null;
    }
    return user;
}

export function getRole() {
    return getCurrentUser() ? ROLES.STAFF : ROLES.GUEST;
}

/** Útil cuando se editan los datos de la cuenta que tiene la sesión abierta. */
export function refreshSession() {
    notifyAuthChange();
}
