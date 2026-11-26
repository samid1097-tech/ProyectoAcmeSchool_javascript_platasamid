/**
 * <exam-runner exam-id="...">
 * Módulo PÚBLICO de resolución de exámenes (no requiere iniciar sesión). Tiene 3 pasos:
 *   1. Datos: el estudiante ingresa su número de identificación y nombre completo.
 *   2. Examen: encabezado, reloj, preguntas enumeradas y botón "Terminar".
 *   3. Resultado: porcentaje de aciertos y mensaje de aprobación.
 *
 * Reglas (se validan con la identificación, sin contraseña):
 *   - La identificación debe ser de un estudiante registrado por el personal y el nombre debe coincidir.
 *   - Solo puede presentar exámenes asignados a su grupo.
 *   - Cada examen se presenta UNA sola vez.
 *   - El intento en curso se guarda en localStorage: si recarga la página
 *     continúa donde iba y el tiempo NO se reinicia.
 */
import { exams, groups, results, users, activeAttempts, findResult, findStudentById } from '../storage.js';
import { escapeHTML, showToast, confirmAction, formatTime, showFieldErrors } from '../utils.js';
import { icons } from '../icons.js';
import { renderView } from '../views.js';

/** Normaliza un nombre para compararlo: sin tildes, sin mayúsculas y sin espacios repetidos. */
const normalizeName = (name) =>
    name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

class ExamRunner extends HTMLElement {
    #exam = null;
    #student = null;
    #attempt = null;
    #finished = false;

    // Advierte al estudiante si intenta cerrar/recargar la pestaña durante el examen.
    #onBeforeUnload = (event) => {
        event.preventDefault();
        event.returnValue = '';
    };

    connectedCallback() {
        this.#exam = exams.getById(this.getAttribute('exam-id'));

        if (!this.#isAvailable(this.#exam)) {
            this.#renderMessage('Examen no disponible', 'Este examen no existe o todavía no está habilitado.');
            return;
        }

        // Si en este navegador hay un intento a medias de este examen, se retoma
        // (así recargar la página no reinicia el examen ni el tiempo).
        const saved = activeAttempts.getAll().find((attempt) => attempt.examId === this.#exam.id);
        const savedStudent = saved && users.getById(saved.estudianteId);
        if (savedStudent && this.#exam.grupos.includes(savedStudent.grupoId)) {
            this.#student = savedStudent;
            this.#resume(saved);
            return;
        }
        // El estudiante de ese intento ya no existe o cambió de grupo: el intento se descarta.
        if (saved) activeAttempts.clear(saved.estudianteId);

        this.#renderStart();
    }

    disconnectedCallback() {
        window.removeEventListener('beforeunload', this.#onBeforeUnload);
    }

    /** El examen existe, tiene preguntas y está asignado a al menos un grupo. */
    #isAvailable(exam) {
        return Boolean(exam && exam.preguntas.length > 0 && exam.grupos?.length > 0);
    }

    /** Retoma un intento guardado (o lo califica si el tiempo ya terminó). */
    #resume(attempt) {
        this.#attempt = attempt;
        if (Date.now() >= attempt.fin) {
            showToast('El tiempo del examen terminó mientras estabas fuera.', 'warning');
            this.#finish(true);
        } else {
            showToast(`Retomamos el examen de ${attempt.nombre ?? this.#student.nombre} donde lo dejó.`, 'info');
            this.#renderExam();
        }
    }

    /* ---------- Paso 1: datos del estudiante ---------- */

    #renderStart() {
        const exam = this.#exam;

        this.innerHTML = renderView('runner-start', {
            codigo: exam.codigo,
            titulo: exam.titulo,
            descripcion: exam.descripcion,
            totalPreguntas: exam.preguntas.length,
            tiempo: exam.tiempo,
            porcentajeAprobacion: exam.porcentajeAprobacion,
        });

        const form = this.querySelector('#start-form');
        form.addEventListener('submit', (event) => this.#handleStart(event, form));
        form.elements.identificacion.focus();
    }

    async #handleStart(event, form) {
        event.preventDefault();
        const identificacion = form.elements.identificacion.value.trim();
        const nombre = form.elements.nombre.value.trim().replace(/\s+/g, ' ');

        // 1. Formato de los datos
        const errors = {};
        if (!/^\d{5,15}$/.test(identificacion)) errors.identificacion = 'Debe contener solo números (entre 5 y 15 dígitos).';
        if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]{3,}$/.test(nombre)) errors.nombre = 'Ingresa tu nombre completo (solo letras).';

        // 2. Debe ser un estudiante registrado y el nombre debe coincidir
        const student = errors.identificacion ? null : findStudentById(identificacion);
        if (!errors.identificacion && !student) {
            errors.identificacion = 'Esta identificación no está registrada como estudiante. Pide a la institución que te registre.';
        } else if (student && !errors.nombre && normalizeName(student.nombre) !== normalizeName(nombre)) {
            errors.nombre = 'El nombre no coincide con el registrado para esta identificación.';
        }

        showFieldErrors(form, errors);
        this.#showAlert(null);
        if (Object.keys(errors).length) return;

        // 3. Reglas del examen
        const exam = this.#exam;
        if (!exam.grupos.includes(student.grupoId)) {
            const group = groups.getById(student.grupoId);
            this.#showAlert(`Este examen no está asignado a tu grupo${group ? ` (${group.nombre})` : ''}.`);
            return;
        }

        const previous = findResult(student.id, exam.id);
        if (previous) {
            this.#showAlert(`Ya presentaste este examen y obtuviste ${previous.porcentaje}% (${previous.aprobado ? 'aprobado' : 'no aprobado'}). Cada examen se presenta una sola vez.`);
            return;
        }

        const saved = activeAttempts.get(student.id);
        if (saved) {
            if (saved.examId === exam.id) {
                this.#student = student;
                this.#resume(saved);
                return;
            }
            const otherExam = exams.getById(saved.examId);
            if (this.#isAvailable(otherExam) && otherExam.grupos.includes(student.grupoId)) {
                this.#showAlert(`Tienes en curso el examen "${otherExam.titulo}". Termínalo antes de iniciar otro.`);
                return;
            }
            activeAttempts.clear(student.id); // Intento de un examen que ya no existe o no es de su grupo
        }

        // 4. Confirmación e inicio
        const confirmed = await confirmAction({
            title: 'Comenzar examen',
            message: `${student.nombre}, tendrás ${exam.tiempo} minuto(s) y un solo intento. ¿Deseas comenzar ahora?`,
            confirmText: 'Comenzar',
        });
        if (!confirmed) return;

        const now = Date.now();
        this.#student = student;
        this.#attempt = {
            examId: exam.id,
            estudianteId: student.id,
            identificacion: student.identificacion,
            nombre: student.nombre,
            respuestas: {}, // { idPregunta: idRespuestaSeleccionada }
            inicio: now,
            fin: now + exam.tiempo * 60 * 1000,
        };
        activeAttempts.set(this.#attempt);
        this.#renderExam();
    }

    #showAlert(message) {
        const alert = this.querySelector('.form-alert');
        alert.hidden = !message;
        alert.innerHTML = message ? `${icons.alert} ${escapeHTML(message)}` : '';
    }

    /* ---------- Paso 2: presentación del examen ---------- */

    #renderExam() {
        const exam = this.#exam;
        const total = exam.preguntas.length;

        this.innerHTML = renderView('runner-exam', {
            titulo: exam.titulo,
            totalPreguntas: total,
            porcentajeAprobacion: exam.porcentajeAprobacion,
            nombre: this.#student.nombre,
            preguntas: exam.preguntas.map((pregunta, index) => this.#questionTemplate(pregunta, index)).join(''),
        });

        const form = this.querySelector('#exam-form');
        form.addEventListener('change', (event) => this.#handleAnswer(event));
        form.addEventListener('submit', (event) => this.#handleFinishClick(event));

        const timer = this.querySelector('exam-timer');
        timer.addEventListener('time-up', () => {
            showToast('¡Se acabó el tiempo! Tu examen fue enviado.', 'warning');
            this.#finish(true);
        });
        timer.start(this.#attempt.fin);

        window.addEventListener('beforeunload', this.#onBeforeUnload);
        this.#updateProgress();
    }

    #questionTemplate(pregunta, index) {
        const selected = this.#attempt.respuestas[pregunta.id];

        return `
            <fieldset class="question-card ${selected ? 'is-answered' : ''}" data-question-id="${pregunta.id}" style="--delay:${Math.min(index, 10) * 50}ms">
                <legend class="question-card__title">
                    <span class="question-number">${index + 1}</span>
                    <span>${escapeHTML(pregunta.enunciado)}</span>
                </legend>

                <div class="options">
                    ${pregunta.respuestas.map((respuesta) => `
                        <label class="option">
                            <input type="radio" name="${pregunta.id}" value="${respuesta.id}" ${selected === respuesta.id ? 'checked' : ''}>
                            <span class="option__mark" aria-hidden="true"></span>
                            <span class="option__text">${escapeHTML(respuesta.descripcion)}</span>
                        </label>`).join('')}
                </div>
            </fieldset>`;
    }

    #handleAnswer(event) {
        const input = event.target;
        if (input.type !== 'radio' || this.#finished) return;

        this.#attempt.respuestas[input.name] = input.value;
        activeAttempts.set(this.#attempt);
        input.closest('.question-card').classList.add('is-answered');
        this.#updateProgress();
    }

    #updateProgress() {
        const total = this.#exam.preguntas.length;
        const answered = this.#countAnswered();
        this.querySelector('.progress__bar').style.width = `${(answered / total) * 100}%`;
        this.querySelector('#answered-label').textContent = `Has respondido ${answered} de ${total} preguntas.`;
    }

    #countAnswered() {
        return this.#exam.preguntas.filter((pregunta) => this.#attempt.respuestas[pregunta.id]).length;
    }

    async #handleFinishClick(event) {
        event.preventDefault();
        const pending = this.#exam.preguntas.length - this.#countAnswered();

        const confirmed = await confirmAction({
            title: 'Terminar examen',
            message: pending > 0
                ? `Tienes ${pending} pregunta(s) sin responder. ¿Deseas terminar de todas formas?`
                : '¿Estás seguro de enviar tus respuestas? No podrás cambiarlas después.',
            confirmText: 'Terminar',
        });

        // El tiempo pudo acabarse mientras el diálogo estaba abierto.
        if (confirmed && !this.#finished) this.#finish(false);
    }

    /* ---------- Paso 3: calificación y resultado ---------- */

    #finish(byTimeout) {
        if (this.#finished) return;
        this.#finished = true;

        this.querySelector('exam-timer')?.stop();
        window.removeEventListener('beforeunload', this.#onBeforeUnload);
        // Si el diálogo de confirmación seguía abierto, se cierra.
        document.querySelectorAll('dialog.modal[open]').forEach((dialog) => dialog.close());

        const exam = this.#exam;
        const student = this.#student;

        // Protección extra: si ya se guardó (por ejemplo, desde otra pestaña), no se duplica.
        const existing = findResult(student.id, exam.id);
        if (existing) {
            activeAttempts.clear(student.id);
            this.#renderResult(existing);
            return;
        }

        const { respuestas } = this.#attempt;
        const total = exam.preguntas.length;
        const correctas = exam.preguntas.filter((pregunta) =>
            pregunta.respuestas.some((r) => r.correcta && r.id === respuestas[pregunta.id]),
        ).length;

        const porcentaje = Math.round((correctas / total) * 10000) / 100; // 2 decimales
        const finishedAt = Math.min(Date.now(), this.#attempt.fin);

        const result = results.create({
            examId: exam.id,
            examCodigo: exam.codigo,
            examTitulo: exam.titulo,
            estudianteId: student.id,
            identificacion: student.identificacion,
            nombre: student.nombre,
            grupoId: student.grupoId,
            grupoNombre: groups.getById(student.grupoId)?.nombre ?? '—',
            respuestas,
            correctas,
            totalPreguntas: total,
            porcentaje,
            porcentajeAprobacion: exam.porcentajeAprobacion,
            aprobado: porcentaje >= exam.porcentajeAprobacion,
            finalizadoPorTiempo: byTimeout,
            duracionSegundos: Math.round((finishedAt - this.#attempt.inicio) / 1000),
            fecha: new Date().toISOString(),
        });

        activeAttempts.clear(student.id);
        this.#renderResult(result);
    }

    #renderResult(result) {
        const approved = result.aprobado;

        this.innerHTML = renderView('runner-result', {
            cardClass: approved ? 'result-card--success' : 'result-card--danger',
            porcentaje: result.porcentaje,
            titulo: approved ? '¡Felicitaciones, aprobaste!' : 'No aprobaste esta vez',
            nombre: result.nombre,
            mensaje: approved
                ? 'superaste el porcentaje requerido. ¡Excelente trabajo!'
                : 'no alcanzaste el porcentaje requerido. ¡Sigue practicando!',
            badgeClass: approved ? 'badge--success' : 'badge--danger',
            badgeIcon: approved ? icons.award : icons.x,
            estado: approved ? 'APROBADO' : 'NO APROBADO',
            examTitulo: result.examTitulo,
            correctas: result.correctas,
            totalPreguntas: result.totalPreguntas,
            porcentajeAprobacion: result.porcentajeAprobacion,
            tiempoUtilizado: formatTime(result.duracionSegundos),
        });

        // La fila "Finalización: Por tiempo agotado" solo aplica si se acabó el tiempo.
        if (!result.finalizadoPorTiempo) this.querySelector('.result-details li:last-child').remove();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ---------- Utilidades ---------- */

    #renderMessage(title, message, actions = '') {
        this.innerHTML = renderView('runner-message', { titulo: title, mensaje: message, acciones: actions });
    }
}

customElements.define('exam-runner', ExamRunner);
