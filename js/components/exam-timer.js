/**
 * <exam-timer>
 * Reloj de cuenta regresiva en tiempo real.
 *
 * Se basa en la hora de finalización (endTime) y no en restar 1 cada segundo,
 * así el tiempo es exacto aunque la pestaña quede en segundo plano o se recargue.
 * Cuando llega a 0 dispara el evento "time-up".
 */
import { formatTime } from '../utils.js';
import { icons } from '../icons.js';

const WARNING_SECONDS = 60;
const DANGER_SECONDS = 15;

class ExamTimer extends HTMLElement {
    #endTime = 0;
    #intervalId = null;
    #expired = false;

    connectedCallback() {
        this.#ensureRendered();
    }

    disconnectedCallback() {
        this.stop();
    }

    /** Inicia la cuenta regresiva hasta la fecha indicada (en milisegundos). */
    start(endTime) {
        this.#ensureRendered();
        this.stop();
        this.#endTime = endTime;
        this.#expired = false;
        this.#tick();
        this.#intervalId = setInterval(() => this.#tick(), 250);
    }

    stop() {
        clearInterval(this.#intervalId);
        this.#intervalId = null;
    }

    #ensureRendered() {
        if (this.querySelector('.timer__value')) return;

        this.classList.add('timer');
        this.innerHTML = `
            <span class="timer__icon">${icons.clock}</span>
            <span class="timer__label">Tiempo restante</span>
            <time class="timer__value" role="timer" aria-live="off">00:00</time>`;
    }

    #tick() {
        const remaining = Math.max(0, Math.ceil((this.#endTime - Date.now()) / 1000));

        this.querySelector('.timer__value').textContent = formatTime(remaining);
        this.classList.toggle('timer--warning', remaining <= WARNING_SECONDS && remaining > DANGER_SECONDS);
        this.classList.toggle('timer--danger', remaining <= DANGER_SECONDS);

        if (remaining === 0 && !this.#expired) {
            this.#expired = true;
            this.stop();
            this.dispatchEvent(new CustomEvent('time-up', { bubbles: true }));
        }
    }
}

customElements.define('exam-timer', ExamTimer);
