/**
 * <exams-view>
 * CRUD de exámenes: tabla de registros + formulario con editor de preguntas.
 * Solo accesible para usuarios autenticados (controlado en el enrutador).
 */
import { exams, groups } from '../storage.js';
import { escapeHTML, showFieldErrors, showToast, confirmAction } from '../utils.js';
import { icons } from '../icons.js';
import { renderView } from '../views.js';

class ExamsView extends HTMLElement {
    #editingId = null;
    #filter = '';

    connectedCallback() {
        this.innerHTML = this.#template();

        this.form = this.querySelector('#exam-form');
        this.panel = this.querySelector('#exam-form-panel');
        this.editor = this.querySelector('question-editor');

        this.form.addEventListener('submit', (event) => this.#handleSubmit(event));
        this.querySelector('#btn-cancel').addEventListener('click', () => this.#resetForm());
        this.querySelector('#exams-body').addEventListener('click', (event) => this.#handleTableClick(event));
        this.querySelector('#exams-search').addEventListener('input', (event) => {
            this.#filter = event.target.value.trim().toLowerCase();
            this.#renderTable();
        });

        // Vista inicial: formulario listo para crear un examen + tabla de exámenes.
        this.#resetForm();
    }

    #template() {
        return renderView('exams');
    }

    #renderTable() {
        const filtered = exams.getAll().filter((exam) =>
            [exam.codigo, exam.titulo].some((value) => value.toLowerCase().includes(this.#filter)),
        );
        const tbody = this.querySelector('#exams-body');

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="table__empty">No hay exámenes para mostrar.</td></tr>`;
            return;
        }

        const groupNames = new Map(groups.getAll().map((group) => [group.id, group.nombre]));
        const groupBadges = (exam) => {
            const names = (exam.grupos ?? []).filter((id) => groupNames.has(id)).map((id) => groupNames.get(id));
            return names.length
                ? names.map((name) => `<span class="badge badge--accent">${escapeHTML(name)}</span>`).join(' ')
                : '<span class="badge badge--danger" title="Ningún estudiante puede verlo">Sin grupos</span>';
        };

        tbody.innerHTML = filtered.map((exam) => `
            <tr class="${exam.id === this.#editingId ? 'is-editing' : ''}">
                <td data-label="Código"><span class="badge badge--primary">${escapeHTML(exam.codigo)}</span></td>
                <td data-label="Título">
                    <strong>${escapeHTML(exam.titulo)}</strong>
                    <small class="table__sub">${escapeHTML(exam.descripcion)}</small>
                </td>
                <td data-label="Tiempo">${exam.tiempo} min</td>
                <td data-label="Aprobación">${exam.porcentajeAprobacion}%</td>
                <td data-label="Preguntas">${exam.preguntas.length}</td>
                <td data-label="Grupos"><div class="badge-group">${groupBadges(exam)}</div></td>
                <td data-label="Acciones" class="table__actions">
                    <button class="btn-icon" data-action="edit" data-id="${exam.id}" title="Editar" aria-label="Editar ${escapeHTML(exam.titulo)}">${icons.edit}</button>
                    <button class="btn-icon btn-icon--danger" data-action="delete" data-id="${exam.id}" title="Eliminar" aria-label="Eliminar ${escapeHTML(exam.titulo)}">${icons.trash}</button>
                </td>
            </tr>`).join('');
    }

    #getFormData() {
        const { elements } = this.form;
        return {
            codigo: elements.codigo.value.trim().toUpperCase(),
            titulo: elements.titulo.value.trim(),
            tiempo: Number(elements.tiempo.value),
            porcentajeAprobacion: Number(elements.porcentajeAprobacion.value),
            descripcion: elements.descripcion.value.trim(),
            grupos: [...this.form.querySelectorAll('input[name="grupos"]:checked')].map((input) => input.value),
        };
    }

    /** Dibuja una casilla por cada grupo existente. */
    #renderGroupsPicker(selectedIds = []) {
        const picker = this.querySelector('#groups-picker');
        const allGroups = groups.getAll();

        picker.innerHTML = allGroups.length
            ? allGroups.map((group) => `
                <label class="checkbox-chip">
                    <input type="checkbox" name="grupos" value="${group.id}" ${selectedIds.includes(group.id) ? 'checked' : ''}>
                    <span>${escapeHTML(group.nombre)}</span>
                </label>`).join('')
            : `<p class="text-muted">No hay grupos creados. <a href="#/grupos">Crea un grupo</a> para poder asignar el examen.</p>`;
    }

    #validate(data) {
        const errors = {};
        const others = exams.getAll().filter((exam) => exam.id !== this.#editingId);

        if (!/^[A-Z0-9-]{2,20}$/.test(data.codigo)) {
            errors.codigo = 'Usa letras, números o guiones (2 a 20 caracteres).';
        } else if (others.some((exam) => exam.codigo === data.codigo)) {
            errors.codigo = 'Ya existe un examen con este código.';
        }

        if (data.titulo.length < 3) errors.titulo = 'El título debe tener mínimo 3 caracteres.';
        if (!Number.isInteger(data.tiempo) || data.tiempo < 1 || data.tiempo > 300) {
            errors.tiempo = 'Ingresa un número entero entre 1 y 300.';
        }
        if (!Number.isFinite(data.porcentajeAprobacion) || data.porcentajeAprobacion < 1 || data.porcentajeAprobacion > 100) {
            errors.porcentajeAprobacion = 'Ingresa un valor entre 1 y 100.';
        }
        if (data.descripcion.length < 10) errors.descripcion = 'Describe el examen (mínimo 10 caracteres).';
        if (data.grupos.length === 0) errors.grupos = 'Asigna el examen a al menos un grupo.';

        return errors;
    }

    #handleSubmit(event) {
        event.preventDefault();
        const data = this.#getFormData();
        const errors = this.#validate(data);
        showFieldErrors(this.form, errors);
        if (Object.keys(errors).length) {
            this.#showAlert(null);
            return;
        }

        const questionsError = this.editor.validate();
        this.#showAlert(questionsError);
        if (questionsError) return;

        const exam = { ...data, preguntas: this.editor.value };

        if (this.#editingId) {
            exams.update(this.#editingId, exam);
            showToast('Examen actualizado correctamente.', 'success');
        } else {
            exams.create(exam);
            showToast('Examen creado correctamente.', 'success');
        }

        this.#resetForm();
    }

    async #handleTableClick(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const exam = exams.getById(button.dataset.id);
        if (!exam) return;

        if (button.dataset.action === 'edit') this.#openForm(exam);
        if (button.dataset.action === 'delete') await this.#deleteExam(exam);
    }

    /** Carga un examen en el formulario para editarlo. */
    #openForm(exam) {
        this.#fillForm(exam);
        this.panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.form.elements.codigo.focus({ preventScroll: true });
    }

    /** Deja el formulario vacío, listo para crear un examen nuevo. */
    #resetForm() {
        this.#fillForm(null);
    }

    /** Llena el formulario con un examen (editar) o lo deja vacío (crear). */
    #fillForm(exam) {
        this.#editingId = exam?.id ?? null;
        this.form.reset();
        showFieldErrors(this.form, {});
        this.#showAlert(null);

        if (exam) {
            const { elements } = this.form;
            ['codigo', 'titulo', 'tiempo', 'porcentajeAprobacion', 'descripcion'].forEach((field) => {
                elements[field].value = exam[field];
            });
        }

        this.#renderGroupsPicker(exam?.grupos ?? []);
        this.editor.value = exam ? exam.preguntas : [];
        this.querySelector('#exam-form-title').innerHTML = exam
            ? `${icons.edit} Editar examen <span class="badge badge--primary">${escapeHTML(exam.codigo)}</span>`
            : `${icons.plus} Nuevo examen`;
        this.querySelector('#btn-submit span').textContent = exam ? 'Actualizar examen' : 'Guardar examen';
        this.querySelector('#btn-cancel').hidden = !exam;
        this.#renderTable();
    }

    async #deleteExam(exam) {
        const confirmed = await confirmAction({
            title: 'Eliminar examen',
            message: `Se eliminará "${exam.titulo}" con sus ${exam.preguntas.length} preguntas. Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            danger: true,
        });
        if (!confirmed) return;

        exams.remove(exam.id);
        if (this.#editingId === exam.id) this.#resetForm();
        else this.#renderTable();
        showToast('Examen eliminado.', 'success');
    }

    #showAlert(message) {
        const alert = this.querySelector('.form-alert');
        alert.hidden = !message;
        alert.innerHTML = message ? `${icons.alert} ${escapeHTML(message)}` : '';
    }
}

customElements.define('exams-view', ExamsView);
