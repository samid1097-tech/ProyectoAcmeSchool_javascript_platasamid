/**
 * <question-editor>
 * Editor de preguntas de un examen. Cada pregunta tiene varias respuestas
 * y solo UNA puede estar marcada como correcta (se usa un radio por pregunta).
 *
 * Uso:
 *   editor.value = [...preguntas]   // cargar preguntas
 *   editor.value                    // obtener preguntas
 *   editor.validate()               // mensaje de error o null
 */
import { generateId } from '../storage.js';
import { escapeHTML } from '../utils.js';
import { icons } from '../icons.js';

const MIN_ANSWERS = 2;

const newAnswer = (correcta = false) => ({ id: generateId(), descripcion: '', correcta });
const newQuestion = () => ({ id: generateId(), enunciado: '', respuestas: [newAnswer(true), newAnswer()] });

class QuestionEditor extends HTMLElement {
    #preguntas = [];
    #initialized = false;

    connectedCallback() {
        if (!this.#initialized) {
            this.addEventListener('click', (event) => this.#handleClick(event));
            this.addEventListener('change', (event) => this.#highlightCorrect(event));
            this.#initialized = true;
        }
        this.#render();
    }

    get value() {
        this.#syncFromDOM();
        return this.#preguntas.map((pregunta) => ({
            ...pregunta,
            enunciado: pregunta.enunciado.trim(),
            respuestas: pregunta.respuestas.map((r) => ({ ...r, descripcion: r.descripcion.trim() })),
        }));
    }

    set value(preguntas) {
        this.#preguntas = structuredClone(preguntas ?? []);
        if (this.isConnected) this.#render();
    }

    /** Valida las preguntas. Devuelve un mensaje de error o null si todo está bien. */
    validate() {
        const preguntas = this.value;
        this.querySelectorAll('.question-item').forEach((el) => el.classList.remove('has-error'));

        if (preguntas.length === 0) return 'Agrega al menos una pregunta al examen.';

        for (const [index, pregunta] of preguntas.entries()) {
            const number = index + 1;
            let error = null;

            if (!pregunta.enunciado) error = `La pregunta ${number} no tiene enunciado.`;
            else if (pregunta.respuestas.length < MIN_ANSWERS) error = `La pregunta ${number} debe tener al menos ${MIN_ANSWERS} respuestas.`;
            else if (pregunta.respuestas.some((r) => !r.descripcion)) error = `La pregunta ${number} tiene respuestas vacías.`;
            else if (pregunta.respuestas.filter((r) => r.correcta).length !== 1) error = `Marca la respuesta correcta de la pregunta ${number}.`;

            if (error) {
                const element = this.querySelector(`.question-item[data-id="${pregunta.id}"]`);
                element?.classList.add('has-error');
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return error;
            }
        }
        return null;
    }

    /** Lee lo que el usuario escribió en el DOM y lo guarda en el estado interno. */
    #syncFromDOM() {
        // Si aún no se ha dibujado, el estado interno ya es la fuente de verdad.
        if (!this.isConnected) return;

        this.#preguntas = [...this.querySelectorAll('.question-item')].map((questionEl) => ({
            id: questionEl.dataset.id,
            enunciado: questionEl.querySelector('[data-field="enunciado"]').value,
            respuestas: [...questionEl.querySelectorAll('.answer-row')].map((answerEl) => ({
                id: answerEl.dataset.id,
                descripcion: answerEl.querySelector('[data-field="descripcion"]').value,
                correcta: answerEl.querySelector('input[type="radio"]').checked,
            })),
        }));
    }

    /** Resalta visualmente la respuesta marcada como correcta. */
    #highlightCorrect(event) {
        if (event.target.type !== 'radio') return;
        event.target.closest('.answers').querySelectorAll('.answer-row').forEach((row) => {
            row.classList.toggle('is-correct', row.querySelector('input[type="radio"]').checked);
        });
    }

    #handleClick(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        this.#syncFromDOM();
        const questionId = button.closest('.question-item')?.dataset.id;
        const pregunta = this.#preguntas.find((q) => q.id === questionId);
        let focusSelector = null;

        switch (button.dataset.action) {
            case 'add-question': {
                const created = newQuestion();
                this.#preguntas.push(created);
                focusSelector = `.question-item[data-id="${created.id}"] textarea`;
                break;
            }
            case 'remove-question':
                this.#preguntas = this.#preguntas.filter((q) => q.id !== questionId);
                break;
            case 'add-answer': {
                const created = newAnswer();
                pregunta.respuestas.push(created);
                focusSelector = `.answer-row[data-id="${created.id}"] input[type="text"]`;
                break;
            }
            case 'remove-answer': {
                const answerId = button.closest('.answer-row').dataset.id;
                pregunta.respuestas = pregunta.respuestas.filter((r) => r.id !== answerId);
                // Si se borró la correcta, se marca la primera para no quedar sin respuesta correcta.
                if (!pregunta.respuestas.some((r) => r.correcta)) pregunta.respuestas[0].correcta = true;
                break;
            }
            default:
                return;
        }

        this.#render();
        if (focusSelector) {
            const input = this.querySelector(focusSelector);
            input?.focus();
            input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    #render() {
        const total = this.#preguntas.length;

        this.innerHTML = `
            <div class="qe__header">
                <h3>Preguntas <span class="badge badge--primary">${total}</span></h3>
                <p class="text-muted">Marca con el círculo la respuesta correcta de cada pregunta.</p>
            </div>

            <div class="qe__list">
                ${total
                    ? this.#preguntas.map((pregunta, index) => this.#questionTemplate(pregunta, index)).join('')
                    : `<p class="empty-state">Aún no hay preguntas. ¡Agrega la primera!</p>`}
            </div>

            <button type="button" class="btn btn--outline btn--block" data-action="add-question">
                ${icons.plus}<span>Agregar pregunta</span>
            </button>`;
    }

    #questionTemplate(pregunta, index) {
        const canRemoveAnswer = pregunta.respuestas.length > MIN_ANSWERS;

        return `
            <article class="question-item" data-id="${pregunta.id}">
                <header class="question-item__header">
                    <span class="question-number">${index + 1}</span>
                    <label class="sr-only" for="q-${pregunta.id}">Enunciado de la pregunta ${index + 1}</label>
                    <textarea id="q-${pregunta.id}" data-field="enunciado" rows="2" placeholder="Escribe la pregunta…">${escapeHTML(pregunta.enunciado)}</textarea>
                    <button type="button" class="btn-icon btn-icon--danger" data-action="remove-question" title="Eliminar pregunta" aria-label="Eliminar pregunta ${index + 1}">${icons.trash}</button>
                </header>

                <div class="answers">
                    ${pregunta.respuestas.map((respuesta, answerIndex) => `
                        <div class="answer-row ${respuesta.correcta ? 'is-correct' : ''}" data-id="${respuesta.id}">
                            <input type="radio" name="correcta-${pregunta.id}" ${respuesta.correcta ? 'checked' : ''}
                                aria-label="Marcar respuesta ${answerIndex + 1} como correcta" title="Respuesta correcta">
                            <input type="text" data-field="descripcion" value="${escapeHTML(respuesta.descripcion)}"
                                placeholder="Respuesta ${answerIndex + 1}" aria-label="Descripción de la respuesta ${answerIndex + 1}">
                            <button type="button" class="btn-icon" data-action="remove-answer" ${canRemoveAnswer ? '' : 'disabled'}
                                title="Eliminar respuesta" aria-label="Eliminar respuesta ${answerIndex + 1}">${icons.x}</button>
                        </div>`).join('')}
                </div>

                <button type="button" class="btn btn--link" data-action="add-answer">${icons.plus}<span>Agregar respuesta</span></button>
            </article>`;
    }
}

customElements.define('question-editor', QuestionEditor);
