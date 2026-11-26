/**
 * <exam-catalog>
 * Vista PÚBLICA con la lista de exámenes disponibles.
 * Muestra de cada examen: título, tiempo para resolverlo y porcentaje de aprobación.
 */
import { exams, groups, users, activeAttempts } from '../storage.js';
import { escapeHTML } from '../utils.js';
import { icons } from '../icons.js';
import { renderView } from '../views.js';

class ExamCatalog extends HTMLElement {
    #available = [];

    connectedCallback() {
        // Disponibles: con al menos una pregunta y asignados a algún grupo.
        this.#available = exams.getAll().filter((exam) => exam.preguntas?.length > 0 && exam.grupos?.length > 0);

        this.innerHTML = renderView('catalog', { inProgressBanners: this.#inProgressBanners() });

        this.querySelector('#catalog-search').addEventListener('input', (event) =>
            this.#renderGrid(event.target.value.trim().toLowerCase()),
        );
        this.#renderGrid();
    }

    /** Avisos de exámenes que quedaron a medias en este navegador (el tiempo sigue corriendo). */
    #inProgressBanners() {
        return activeAttempts.getAll()
            .map((attempt) => ({ attempt, exam: exams.getById(attempt.examId) }))
            .filter(({ exam }) => exam)
            .map(({ attempt, exam }) => `
                <div class="banner banner--warning">
                    ${icons.alert}
                    <p><strong>${escapeHTML(attempt.nombre ?? users.getById(attempt.estudianteId)?.nombre ?? 'Un estudiante')}</strong> tiene el examen "<strong>${escapeHTML(exam.titulo)}</strong>" en curso. El tiempo sigue corriendo.</p>
                    <a class="btn btn--primary btn--sm" href="#/examen/${encodeURIComponent(exam.id)}">Continuar</a>
                </div>`)
            .join('');
    }

    #renderGrid(filter = '') {
        const grid = this.querySelector('#exam-grid');
        const list = this.#available.filter((exam) =>
            [exam.titulo, exam.codigo, exam.descripcion].some((value) => value.toLowerCase().includes(filter)),
        );

        if (list.length === 0) {
            grid.innerHTML = `
                <div class="empty-state empty-state--card">
                    ${icons.file}
                    <p>${this.#available.length ? 'No hay exámenes que coincidan con tu búsqueda.' : 'Todavía no hay exámenes disponibles.'}</p>
                </div>`;
            return;
        }

        const groupNames = new Map(groups.getAll().map((group) => [group.id, group.nombre]));

        grid.replaceChildren(
            ...list.map((exam, index) => {
                const card = document.createElement('exam-card');
                card.data = { exam, groupNames: exam.grupos.map((id) => groupNames.get(id)).filter(Boolean) };
                card.style.setProperty('--delay', `${index * 60}ms`);
                return card;
            }),
        );
    }
}

customElements.define('exam-catalog', ExamCatalog);
