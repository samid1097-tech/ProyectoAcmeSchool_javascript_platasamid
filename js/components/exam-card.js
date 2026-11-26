/**
 * <exam-card>
 * Tarjeta de un examen disponible: título, tiempo, porcentaje de aprobación y grupos.
 * Recibe los datos con la propiedad "data": { exam, groupNames }
 */
import { escapeHTML } from '../utils.js';
import { icons } from '../icons.js';

class ExamCard extends HTMLElement {
    #data = null;

    set data(value) {
        this.#data = value;
        this.#render();
    }

    get data() {
        return this.#data;
    }

    #render() {
        if (!this.#data) return;
        const { exam, groupNames } = this.#data;

        this.innerHTML = `
            <article class="exam-card">
                <div class="exam-card__top">
                    <span class="badge badge--primary">${escapeHTML(exam.codigo)}</span>
                    <span class="exam-card__questions">${exam.preguntas.length} preguntas</span>
                </div>

                <h3 class="exam-card__title">${escapeHTML(exam.titulo)}</h3>
                <p class="exam-card__description">${escapeHTML(exam.descripcion)}</p>

                <ul class="exam-card__meta">
                    <li>${icons.clock}<span><strong>${exam.tiempo}</strong> minutos</span></li>
                    <li>${icons.target}<span>Aprueba con <strong>${exam.porcentajeAprobacion}%</strong></span></li>
                    <li>${icons.layers}<span>${groupNames.map((name) => escapeHTML(name)).join(', ')}</span></li>
                </ul>

                <a class="btn btn--primary btn--block" href="#/examen/${encodeURIComponent(exam.id)}">
                    <span>Presentar examen</span>${icons.arrowRight}
                </a>
            </article>`;
    }
}

customElements.define('exam-card', ExamCard);
