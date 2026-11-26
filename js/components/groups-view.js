/**
 * <groups-view>
 * Gestión de grupos (CRUD) y de los estudiantes registrados:
 * permite cambiar a un estudiante de grupo o eliminarlo.
 * Solo accesible para el personal (controlado en el enrutador).
 */
import { users, groups, exams, results, activeAttempts, getStudents } from '../storage.js';
import { escapeHTML, showFieldErrors, showToast, confirmAction } from '../utils.js';
import { icons } from '../icons.js';
import { renderView } from '../views.js';

class GroupsView extends HTMLElement {
    #editingId = null;

    connectedCallback() {
        this.innerHTML = this.#template();

        this.form = this.querySelector('#group-form');
        this.form.addEventListener('submit', (event) => this.#handleSubmit(event));
        this.querySelector('#btn-cancel').addEventListener('click', () => this.#resetForm());
        this.querySelector('#groups-list').addEventListener('click', (event) => this.#handleGroupClick(event));

        const studentsBody = this.querySelector('#students-body');
        studentsBody.addEventListener('click', (event) => this.#handleStudentClick(event));
        studentsBody.addEventListener('change', (event) => this.#handleGroupChange(event));
        this.querySelector('#filter-group').addEventListener('change', () => this.#renderStudents());
        this.querySelector('#filter-text').addEventListener('input', () => this.#renderStudents());

        this.#renderAll();
    }

    #template() {
        return renderView('groups');
    }

    #renderAll() {
        this.#renderGroups();
        this.#renderGroupFilter();
        this.#renderStudents();
    }

    /* ---------- Grupos ---------- */

    #renderGroups() {
        const list = this.querySelector('#groups-list');
        const allGroups = groups.getAll();
        const allStudents = getStudents();
        const allExams = exams.getAll();

        if (allGroups.length === 0) {
            list.innerHTML = `<li class="empty-state">Aún no hay grupos. Crea el primero.</li>`;
            return;
        }

        list.innerHTML = allGroups.map((group) => {
            const studentCount = allStudents.filter((s) => s.grupoId === group.id).length;
            const examCount = allExams.filter((e) => e.grupos?.includes(group.id)).length;

            return `
                <li class="group-item ${group.id === this.#editingId ? 'is-editing' : ''}">
                    <div class="group-item__info">
                        <strong>${escapeHTML(group.nombre)}</strong>
                        ${group.descripcion ? `<small>${escapeHTML(group.descripcion)}</small>` : ''}
                        <small class="text-muted">${studentCount} estudiante(s) · ${examCount} examen(es)</small>
                    </div>
                    <div class="group-item__actions">
                        <button class="btn-icon" data-action="edit" data-id="${group.id}" title="Editar" aria-label="Editar ${escapeHTML(group.nombre)}">${icons.edit}</button>
                        <button class="btn-icon btn-icon--danger" data-action="delete" data-id="${group.id}" title="Eliminar" aria-label="Eliminar ${escapeHTML(group.nombre)}">${icons.trash}</button>
                    </div>
                </li>`;
        }).join('');
    }

    #handleSubmit(event) {
        event.preventDefault();
        const nombre = this.form.elements.nombre.value.trim().replace(/\s+/g, ' ');
        const descripcion = this.form.elements.descripcion.value.trim();

        const errors = {};
        if (nombre.length < 2) {
            errors.nombre = 'El nombre debe tener mínimo 2 caracteres.';
        } else if (groups.getAll().some((g) => g.id !== this.#editingId && g.nombre.toLowerCase() === nombre.toLowerCase())) {
            errors.nombre = 'Ya existe un grupo con este nombre.';
        }

        showFieldErrors(this.form, errors);
        if (Object.keys(errors).length) return;

        if (this.#editingId) {
            groups.update(this.#editingId, { nombre, descripcion });
            showToast('Grupo actualizado.', 'success');
        } else {
            groups.create({ nombre, descripcion });
            showToast('Grupo creado.', 'success');
        }
        this.#resetForm();
    }

    async #handleGroupClick(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const group = groups.getById(button.dataset.id);
        if (!group) return;

        if (button.dataset.action === 'edit') this.#startEdit(group);
        if (button.dataset.action === 'delete') await this.#deleteGroup(group);
    }

    #startEdit(group) {
        this.#editingId = group.id;
        this.form.elements.nombre.value = group.nombre;
        this.form.elements.descripcion.value = group.descripcion ?? '';
        showFieldErrors(this.form, {});

        this.querySelector('#group-form-title').innerHTML = `${icons.edit} Editar grupo`;
        this.querySelector('#btn-submit span').textContent = 'Actualizar grupo';
        this.querySelector('#btn-cancel').hidden = false;
        this.#renderGroups();
        this.form.elements.nombre.focus();
    }

    async #deleteGroup(group) {
        const studentCount = getStudents().filter((s) => s.grupoId === group.id).length;
        if (studentCount > 0) {
            showToast(`No se puede eliminar: "${group.nombre}" tiene ${studentCount} estudiante(s). Cámbialos de grupo primero.`, 'error', 5000);
            return;
        }

        const confirmed = await confirmAction({
            title: 'Eliminar grupo',
            message: `Se eliminará "${group.nombre}" y se quitará de los exámenes donde esté asignado.`,
            confirmText: 'Eliminar',
            danger: true,
        });
        if (!confirmed) return;

        groups.remove(group.id);
        // Quita el grupo de los exámenes que lo tenían asignado.
        exams.getAll()
            .filter((exam) => exam.grupos?.includes(group.id))
            .forEach((exam) => exams.update(exam.id, { grupos: exam.grupos.filter((id) => id !== group.id) }));

        if (this.#editingId === group.id) this.#resetForm();
        else this.#renderAll();
        showToast('Grupo eliminado.', 'success');
    }

    #resetForm() {
        this.#editingId = null;
        this.form.reset();
        showFieldErrors(this.form, {});
        this.querySelector('#group-form-title').innerHTML = `${icons.plus} Nuevo grupo`;
        this.querySelector('#btn-submit span').textContent = 'Guardar grupo';
        this.querySelector('#btn-cancel').hidden = true;
        this.#renderAll();
    }

    /* ---------- Estudiantes ---------- */

    #groupOptions(selectedId) {
        return groups.getAll()
            .map((g) => `<option value="${g.id}" ${g.id === selectedId ? 'selected' : ''}>${escapeHTML(g.nombre)}</option>`)
            .join('');
    }

    #renderGroupFilter() {
        const select = this.querySelector('#filter-group');
        const current = select.value;
        select.innerHTML = `<option value="">Todos los grupos</option>${this.#groupOptions(current)}`;
    }

    #renderStudents() {
        const groupFilter = this.querySelector('#filter-group').value;
        const text = this.querySelector('#filter-text').value.trim().toLowerCase();
        const allStudents = getStudents();
        const allResults = results.getAll();

        const list = allStudents.filter((s) =>
            (!groupFilter || s.grupoId === groupFilter)
            && [s.nombre, s.email, s.identificacion].some((value) => value.toLowerCase().includes(text)),
        );

        this.querySelector('#students-count').textContent = allStudents.length;
        const tbody = this.querySelector('#students-body');

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="table__empty">No hay estudiantes para mostrar.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map((s) => `
            <tr>
                <td data-label="Identificación">${escapeHTML(s.identificacion)}</td>
                <td data-label="Nombre">
                    <strong>${escapeHTML(s.nombre)}</strong>
                    <small class="table__sub">${escapeHTML(s.email)}</small>
                </td>
                <td data-label="Grupo">
                    <select class="select-sm" data-student-id="${s.id}" aria-label="Grupo de ${escapeHTML(s.nombre)}">
                        ${groups.getById(s.grupoId) ? '' : '<option value="" selected>Sin grupo</option>'}
                        ${this.#groupOptions(s.grupoId)}
                    </select>
                </td>
                <td data-label="Presentados">${allResults.filter((r) => r.estudianteId === s.id).length}</td>
                <td data-label="Acciones" class="table__actions">
                    <button class="btn-icon btn-icon--danger" data-action="delete-student" data-id="${s.id}" title="Eliminar" aria-label="Eliminar a ${escapeHTML(s.nombre)}">${icons.trash}</button>
                </td>
            </tr>`).join('');
    }

    #handleGroupChange(event) {
        const select = event.target.closest('select[data-student-id]');
        if (!select || !select.value) return;

        const student = users.update(select.dataset.studentId, { grupoId: select.value });
        const group = groups.getById(select.value);
        showToast(`${student.nombre} ahora pertenece a ${group.nombre}.`, 'success');
        this.#renderGroups(); // Actualiza los contadores de cada grupo
    }

    async #handleStudentClick(event) {
        const button = event.target.closest('button[data-action="delete-student"]');
        if (!button) return;

        const student = users.getById(button.dataset.id);
        if (!student) return;

        const confirmed = await confirmAction({
            title: 'Eliminar estudiante',
            message: `Se eliminará la cuenta de "${student.nombre}". Sus resultados se conservarán en el historial.`,
            confirmText: 'Eliminar',
            danger: true,
        });
        if (!confirmed) return;

        users.remove(student.id);
        activeAttempts.clear(student.id);
        this.#renderGroups();
        this.#renderStudents();
        showToast('Estudiante eliminado.', 'success');
    }
}

customElements.define('groups-view', GroupsView);
