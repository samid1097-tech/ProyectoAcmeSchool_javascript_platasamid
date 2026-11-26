/**
 * utils.js
 * Funciones de ayuda reutilizadas por los componentes.
 */

/** Escapa caracteres HTML para evitar inyección de código al usar innerHTML. */
export function escapeHTML(value = '') {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

/** Cambia de vista usando el enrutador basado en el hash de la URL. */
export function navigate(path) {
    location.hash = `#/${path}`;
}

/** Convierte segundos a formato mm:ss. */
export function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDate(isoDate) {
    return new Date(isoDate).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Obtiene las iniciales de un nombre (máximo 2 letras). */
export function getInitials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join('');
}

/**
 * Muestra los errores de validación debajo de cada campo del formulario.
 * @param {HTMLFormElement} form
 * @param {Object} errors - { nombreCampo: 'mensaje' }
 */
export function showFieldErrors(form, errors) {
    form.querySelectorAll('[data-error-for]').forEach((element) => {
        element.textContent = errors[element.dataset.errorFor] ?? '';
    });

    form.querySelectorAll('[name]').forEach((input) => {
        const hasError = Boolean(errors[input.name]);
        input.classList.toggle('is-invalid', hasError);
        input.setAttribute('aria-invalid', String(hasError));
    });

    const firstError = Object.keys(errors)[0];
    const field = firstError ? form.elements[firstError] : null;
    if (field instanceof HTMLElement) field.focus();
}

/** Muestra una notificación temporal en la esquina de la pantalla. */
export function showToast(message, type = 'info', duration = 3500) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.append(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    container.append(toast);

    setTimeout(() => {
        toast.classList.add('toast--leaving');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
}

/**
 * Ventana de confirmación personalizada (reemplaza a window.confirm).
 * @returns {Promise<boolean>} true si el usuario confirma.
 */
export function confirmAction({ title = '¿Estás seguro?', message = '', confirmText = 'Confirmar', danger = false } = {}) {
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'modal';
        dialog.innerHTML = `
            <form method="dialog" class="modal__content">
                <h2 class="modal__title">${escapeHTML(title)}</h2>
                <p class="modal__message">${escapeHTML(message)}</p>
                <div class="modal__actions">
                    <button value="cancel" class="btn btn--ghost">Cancelar</button>
                    <button value="ok" class="btn ${danger ? 'btn--danger' : 'btn--primary'}">${escapeHTML(confirmText)}</button>
                </div>
            </form>`;

        let answered = false;
        const finish = (confirmed) => {
            if (answered) return;
            answered = true;
            if (dialog.open) dialog.close();
            dialog.remove();
            resolve(confirmed);
        };

        // Clic en "Cancelar" o "Confirmar" (event.submitter es el botón presionado).
        dialog.querySelector('form').addEventListener('submit', (event) => {
            event.preventDefault();
            finish(event.submitter?.value === 'ok');
        });
        // Tecla Escape.
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            finish(false);
        });
        // Cierre desde código (ej: el examen termina por tiempo con el diálogo abierto).
        dialog.addEventListener('close', () => finish(false));

        document.body.append(dialog);
        dialog.showModal();
    });
}
