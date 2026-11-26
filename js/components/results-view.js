/**
 * <results-view>
 * Vista privada con los resultados de los exámenes presentados por los estudiantes.
 */
import { results } from '../storage.js';
import { escapeHTML, formatDate } from '../utils.js';
import { icons } from '../icons.js';
import { renderView } from '../views.js';

class ResultsView extends HTMLElement {
    #all = [];

    connectedCallback() {
        // Más recientes primero.
        this.#all = results.getAll().sort((a, b) => b.fecha.localeCompare(a.fecha));
        const examTitles = [...new Set(this.#all.map((r) => r.examTitulo))];
        const groupNames = [...new Set(this.#all.map((r) => r.grupoNombre ?? '—'))];

        const toOptions = (values) =>
            values.map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');

        this.innerHTML = renderView('results', {
            examOptions: toOptions(examTitles),
            groupOptions: toOptions(groupNames),
        });

        this.querySelector('#filter-exam').addEventListener('change', () => this.#render());
        this.querySelector('#filter-group').addEventListener('change', () => this.#render());
        this.querySelector('#filter-text').addEventListener('input', () => this.#render());
        this.#render();
    }

    #getFiltered() {
        const exam = this.querySelector('#filter-exam').value;
        const group = this.querySelector('#filter-group').value;
        const text = this.querySelector('#filter-text').value.trim().toLowerCase();

        return this.#all.filter((r) =>
            (!exam || r.examTitulo === exam)
            && (!group || (r.grupoNombre ?? '—') === group)
            && (r.nombre.toLowerCase().includes(text) || r.identificacion.includes(text)),
        );
    }

    #render() {
        const list = this.#getFiltered();
        this.#renderStats(list);

        const tbody = this.querySelector('#results-body');
        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="table__empty">Aún no hay resultados registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map((r) => `
            <tr>
                <td data-label="Fecha">${formatDate(r.fecha)}</td>
                <td data-label="Estudiante">
                    <strong>${escapeHTML(r.nombre)}</strong>
                    <small class="table__sub">ID ${escapeHTML(r.identificacion)}</small>
                </td>
                <td data-label="Grupo"><span class="badge badge--accent">${escapeHTML(r.grupoNombre ?? '—')}</span></td>
                <td data-label="Examen">${escapeHTML(r.examTitulo)}</td>
                <td data-label="Aciertos">${r.correctas} / ${r.totalPreguntas}</td>
                <td data-label="Puntaje"><strong>${r.porcentaje}%</strong> <small class="text-muted">(mín. ${r.porcentajeAprobacion}%)</small></td>
                <td data-label="Estado">
                    <span class="badge ${r.aprobado ? 'badge--success' : 'badge--danger'}">${r.aprobado ? 'Aprobado' : 'No aprobado'}</span>
                    ${r.finalizadoPorTiempo ? `<span class="badge badge--warning" title="Finalizado por tiempo">${icons.clock}</span>` : ''}
                </td>
            </tr>`).join('');
    }

    #renderStats(list) {
        const total = list.length;
        const approved = list.filter((r) => r.aprobado).length;
        const average = total ? (list.reduce((sum, r) => sum + r.porcentaje, 0) / total).toFixed(1) : 0;

        const stats = [
            { label: 'Exámenes presentados', value: total, icon: icons.file, modifier: 'primary' },
            { label: 'Aprobados', value: approved, icon: icons.award, modifier: 'success' },
            { label: 'No aprobados', value: total - approved, icon: icons.x, modifier: 'danger' },
            { label: 'Promedio', value: `${average}%`, icon: icons.chart, modifier: 'accent' },
        ];

        this.querySelector('#stats').innerHTML = stats.map((stat) => `
            <article class="stat-card stat-card--${stat.modifier}">
                <span class="stat-card__icon">${stat.icon}</span>
                <div>
                    <strong class="stat-card__value">${stat.value}</strong>
                    <span class="stat-card__label">${stat.label}</span>
                </div>
            </article>`).join('');
    }
}

customElements.define('results-view', ResultsView);
