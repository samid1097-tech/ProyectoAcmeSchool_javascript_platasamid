/**
 * <users-view>
 * CRUD de usuarios: tabla de registros + formulario de creación / actualización.
 * Cargos: Administrativo, Docente y Estudiante.
 *  - Administrativo / Docente: tienen contraseña para iniciar sesión.
 *  - Estudiante: tiene grupo y NO tiene contraseña (presenta exámenes con su identificación).
 * Solo accesible para el personal (controlado en el enrutador).
 */
import { users, groups, activeAttempts, CARGOS, STUDENT_CARGO, isEmailTaken, isIdTaken } from '../storage.js';
import { getCurrentUser, refreshSession } from '../auth.js';
import { escapeHTML, isValidEmail, showFieldErrors, showToast, confirmAction } from '../utils.js';
import { icons } from '../icons.js';
import { renderView } from '../views.js';

const CARGO_BADGE = {
    Administrativo: 'badge--primary',
    Docente: 'badge--accent',
    Estudiante: 'badge--success',
};

class UsersView extends HTMLElement {
    #editingId = null;

    connectedCallback() {
        this.innerHTML = this.#template();
        // El aviso "No hay grupos" solo se muestra si de verdad no hay grupos.
        if (groups.getAll().length > 0) this.querySelector('#group-field .field-hint').remove();

        this.form = this.querySelector('#user-form');
        this.form.addEventListener('submit', (event) => this.#handleSubmit(event));
        this.form.elements.cargo.addEventListener('change', () => this.#toggleGroupField());
        this.querySelector('#btn-cancel').addEventListener('click', () => this.#resetForm());
        this.querySelector('#users-body').addEventListener('click', (event) => this.#handleTableClick(event));
        this.querySelector('#users-search').addEventListener('input', () => this.#renderTable());
        this.querySelector('#users-filter').addEventListener('change', () => this.#renderTable());

        this.#renderTable();
    }

    #template() {
        const allGroups = groups.getAll();
        return renderView('users', {
            groupOptions: allGroups.map((g) => `<option value="${g.id}">${escapeHTML(g.nombre)}</option>`).join(''),
        });
    }

    /** Estudiante: muestra "Grupo" y oculta "Contraseña". Personal: al revés. */
    #toggleGroupField() {
        const isStudent = this.form.elements.cargo.value === STUDENT_CARGO;
        this.querySelector('#group-field').hidden = !isStudent;
        this.querySelector('#password-field').hidden = isStudent;
        if (isStudent) this.form.elements.password.value = '';
        else this.form.elements.grupoId.value = '';
    }

    #renderTable() {
        const allUsers = users.getAll();
        const currentUser = getCurrentUser();
        const cargoFilter = this.querySelector('#users-filter').value;
        const text = this.querySelector('#users-search').value.trim().toLowerCase();
        const groupNames = new Map(groups.getAll().map((g) => [g.id, g.nombre]));

        const filtered = allUsers.filter((user) =>
            (!cargoFilter || user.cargo === cargoFilter)
            && [user.nombre, user.email, user.identificacion].some((value) => value.toLowerCase().includes(text)),
        );

        this.querySelector('#users-count').textContent = `${allUsers.length} registrados`;
        const tbody = this.querySelector('#users-body');

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="table__empty">No se encontraron usuarios.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((user) => `
            <tr class="${user.id === this.#editingId ? 'is-editing' : ''}">
                <td data-label="Identificación">${escapeHTML(user.identificacion)}</td>
                <td data-label="Nombre">
                    <strong>${escapeHTML(user.nombre)}</strong>
                    ${user.id === currentUser?.id ? '<span class="badge badge--success">Tú</span>' : ''}
                    <small class="table__sub">${escapeHTML(user.email)}</small>
                </td>
                <td data-label="Teléfono">${escapeHTML(user.telefono || '—')}</td>
                <td data-label="Cargo">
                    <div class="badge-group">
                        <span class="badge ${CARGO_BADGE[user.cargo] ?? 'badge--primary'}">${escapeHTML(user.cargo)}</span>
                        ${user.cargo === STUDENT_CARGO
                            ? `<span class="badge badge--warning">${escapeHTML(groupNames.get(user.grupoId) ?? 'Sin grupo')}</span>`
                            : ''}
                    </div>
                </td>
                <td data-label="Acciones" class="table__actions">
                    <button class="btn-icon" data-action="edit" data-id="${user.id}" title="Editar" aria-label="Editar a ${escapeHTML(user.nombre)}">${icons.edit}</button>
                    <button class="btn-icon btn-icon--danger" data-action="delete" data-id="${user.id}" title="Eliminar" aria-label="Eliminar a ${escapeHTML(user.nombre)}">${icons.trash}</button>
                </td>
            </tr>`).join('');
    }

    #getFormData() {
        const { elements } = this.form;
        const cargo = elements.cargo.value;
        return {
            identificacion: elements.identificacion.value.trim(),
            nombre: elements.nombre.value.trim().replace(/\s+/g, ' '),
            email: elements.email.value.trim().toLowerCase(),
            telefono: elements.telefono.value.replace(/\s+/g, ''),
            cargo,
            grupoId: cargo === STUDENT_CARGO ? elements.grupoId.value : null,
            password: elements.password.value,
        };
    }

    #validate(data) {
        const errors = {};
        const isNew = this.#editingId === null;

        if (!/^\d{5,15}$/.test(data.identificacion)) {
            errors.identificacion = 'Debe contener solo números (entre 5 y 15 dígitos).';
        } else if (isIdTaken(data.identificacion, this.#editingId)) {
            errors.identificacion = 'Ya existe un usuario con esta identificación.';
        }

        if (data.nombre.length < 3) errors.nombre = 'Ingresa el nombre completo.';

        if (!isValidEmail(data.email)) errors.email = 'Ingresa un correo válido.';
        else if (isEmailTaken(data.email, this.#editingId)) errors.email = 'Este correo ya está registrado.';

        if (!/^\+?\d{7,15}$/.test(data.telefono)) errors.telefono = 'Teléfono no válido (7 a 15 dígitos).';

        if (!CARGOS.includes(data.cargo)) {
            errors.cargo = 'Selecciona un cargo.';
        } else if (data.cargo === STUDENT_CARGO && this.#editingId === getCurrentUser()?.id) {
            // Si el administrador se cambia a estudiante perdería el acceso a este módulo.
            errors.cargo = 'No puedes cambiar tu propio cargo a Estudiante.';
        }

        if (data.cargo === STUDENT_CARGO && !groups.getById(data.grupoId)) {
            errors.grupoId = 'Selecciona el grupo del estudiante.';
        }

        // Contraseña: solo para el personal. En edición es opcional si ya tenía una.
        if (data.cargo !== STUDENT_CARGO) {
            const hadPassword = Boolean(users.getById(this.#editingId)?.password);
            if ((isNew || data.password || !hadPassword) && data.password.length < 6) {
                errors.password = 'La contraseña debe tener mínimo 6 caracteres.';
            }
        }

        return errors;
    }

    #handleSubmit(event) {
        event.preventDefault();
        const data = this.#getFormData();
        const errors = this.#validate(data);

        showFieldErrors(this.form, errors);
        if (Object.keys(errors).length) return;

        // Los estudiantes no inician sesión, así que no guardan contraseña.
        if (data.cargo === STUDENT_CARGO) data.password = '';
        else if (this.#editingId && !data.password) delete data.password; // Se conserva la actual

        if (this.#editingId) {
            users.update(this.#editingId, data);
            if (this.#editingId === getCurrentUser()?.id) refreshSession();
            showToast('Usuario actualizado correctamente.', 'success');
        } else {
            users.create(data);
            showToast('Usuario creado correctamente.', 'success');
        }

        this.#resetForm();
    }

    async #handleTableClick(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const user = users.getById(button.dataset.id);
        if (!user) return;

        if (button.dataset.action === 'edit') this.#startEdit(user);
        if (button.dataset.action === 'delete') await this.#deleteUser(user);
    }

    #startEdit(user) {
        this.#editingId = user.id;
        const { elements } = this.form;

        ['identificacion', 'nombre', 'email', 'telefono', 'cargo'].forEach((field) => {
            elements[field].value = user[field] ?? '';
        });
        this.#toggleGroupField();
        elements.grupoId.value = user.grupoId ?? '';
        elements.password.value = '';

        this.querySelector('#user-form-title').innerHTML = `${icons.edit} Editar usuario`;
        this.querySelector('#btn-submit span').textContent = 'Actualizar usuario';
        this.querySelector('#btn-cancel').hidden = false;
        this.querySelector('#password-hint').hidden = false;
        showFieldErrors(this.form, {});

        this.#renderTable();
        this.form.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
        elements.nombre.focus({ preventScroll: true });
    }

    async #deleteUser(user) {
        if (user.id === getCurrentUser()?.id) {
            showToast('No puedes eliminar el usuario con el que iniciaste sesión.', 'error');
            return;
        }

        const confirmed = await confirmAction({
            title: 'Eliminar usuario',
            message: `Se eliminará a "${user.nombre}". Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            danger: true,
        });
        if (!confirmed) return;

        users.remove(user.id);
        activeAttempts.clear(user.id); // Si era estudiante con un examen en curso
        if (this.#editingId === user.id) this.#resetForm();
        else this.#renderTable();
        showToast('Usuario eliminado.', 'success');
    }

    #resetForm() {
        this.#editingId = null;
        this.form.reset();
        this.#toggleGroupField();
        showFieldErrors(this.form, {});

        this.querySelector('#user-form-title').innerHTML = `${icons.plus} Nuevo usuario`;
        this.querySelector('#btn-submit span').textContent = 'Guardar usuario';
        this.querySelector('#btn-cancel').hidden = true;
        this.querySelector('#password-hint').hidden = true;
        this.#renderTable();
    }
}

customElements.define('users-view', UsersView);
