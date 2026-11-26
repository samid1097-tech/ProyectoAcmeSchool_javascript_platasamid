/**
 * <login-view>
 * Vista inicial de la aplicación para los módulos privados.
 * Solo el personal (Administrativo / Docente) inicia sesión con correo y contraseña.
 */
import { login, HOME_BY_ROLE } from '../auth.js';
import { isValidEmail, navigate, showFieldErrors, showToast, escapeHTML } from '../utils.js';
import { icons } from '../icons.js';
import { renderView } from '../views.js';

class LoginView extends HTMLElement {
    connectedCallback() {
        this.innerHTML = renderView('login');

        this.form = this.querySelector('#login-form');
        this.form.addEventListener('submit', (event) => this.#handleSubmit(event));
        this.querySelector('[data-action="toggle-password"]').addEventListener('click', (event) =>
            this.#togglePassword(event.currentTarget),
        );
        this.form.elements.email.focus();
    }

    #handleSubmit(event) {
        event.preventDefault();
        const email = this.form.elements.email.value.trim();
        const password = this.form.elements.password.value;

        const errors = {};
        if (!email) errors.email = 'El correo es obligatorio.';
        else if (!isValidEmail(email)) errors.email = 'Ingresa un correo válido.';
        if (!password) errors.password = 'La contraseña es obligatoria.';

        showFieldErrors(this.form, errors);
        if (Object.keys(errors).length) return;

        const user = login(email, password);
        if (!user) {
            this.#showAlert('Correo o contraseña incorrectos.');
            return;
        }

        showToast(`¡Hola, ${user.nombre}!`, 'success');
        navigate(HOME_BY_ROLE.staff);
    }

    #showAlert(message) {
        const alert = this.querySelector('.form-alert');
        alert.innerHTML = `${icons.alert} ${escapeHTML(message)}`;
        alert.hidden = false;

        const card = this.querySelector('.login__card');
        card.classList.remove('shake');
        void card.offsetWidth; // Reinicia la animación
        card.classList.add('shake');
    }

    #togglePassword(button) {
        const input = this.form.elements.password;
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        button.innerHTML = isHidden ? icons.eyeOff : icons.eye;
        button.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
    }
}

customElements.define('login-view', LoginView);
