/**
 * <app-navbar>
 * Barra de navegación. Los enlaces dependen del rol:
 *  - Personal (Administrativo/Docente): módulos de gestión. NO ve "Presentar examen".
 *  - Visitante (sin sesión): presentar examen (módulo público) e iniciar sesión.
 */
import { getCurrentUser, logout, ROLES, HOME_BY_ROLE } from '../auth.js';
import { escapeHTML, getInitials, navigate, confirmAction, showToast } from '../utils.js';
import { icons } from '../icons.js';

const LINKS_BY_ROLE = {
    [ROLES.STAFF]: [
        { path: 'usuarios', label: 'Usuarios', icon: icons.users },
        { path: 'grupos', label: 'Grupos', icon: icons.layers },
        { path: 'gestion-examenes', label: 'Exámenes', icon: icons.file },
        { path: 'resultados', label: 'Resultados', icon: icons.chart },
    ],
    [ROLES.GUEST]: [
        { path: 'examenes', label: 'Presentar examen', icon: icons.list },
    ],
};

class AppNavbar extends HTMLElement {
    // Las funciones flecha mantienen el "this" del componente al usarse como listeners.
    #handleRouteChange = () => {
        this.#closeMenu();
        this.#highlightActiveLink();
    };

    #handleAuthChange = () => this.render();

    connectedCallback() {
        this.render();
        this.addEventListener('click', (event) => this.#handleClick(event));
        window.addEventListener('hashchange', this.#handleRouteChange);
        window.addEventListener('auth-changed', this.#handleAuthChange);
    }

    disconnectedCallback() {
        window.removeEventListener('hashchange', this.#handleRouteChange);
        window.removeEventListener('auth-changed', this.#handleAuthChange);
    }

    render() {
        const user = getCurrentUser();
        const role = user ? ROLES.STAFF : ROLES.GUEST;
        const links = LINKS_BY_ROLE[role];

        this.innerHTML = `
            <nav class="navbar" aria-label="Navegación principal">
                <a class="navbar__brand" href="#/${HOME_BY_ROLE[role]}">
                    <span class="navbar__logo">A</span>
                    <span>Acme<strong>School</strong></span>
                </a>

                <button class="navbar__toggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="nav-menu">
                    ${icons.menu}
                </button>

                <div class="navbar__menu" id="nav-menu">
                    <ul class="navbar__links">
                        ${links.map((link) => `
                            <li>
                                <a href="#/${link.path}" data-path="${link.path}">
                                    ${link.icon}<span>${link.label}</span>
                                </a>
                            </li>`).join('')}
                    </ul>
                    ${user ? this.#accountTemplate(user) : this.#guestTemplate()}
                </div>
            </nav>`;

        this.#highlightActiveLink();
    }

    #accountTemplate(user) {
        return `
            <div class="navbar__user">
                <span class="avatar" aria-hidden="true">${escapeHTML(getInitials(user.nombre))}</span>
                <div class="navbar__user-info">
                    <strong>${escapeHTML(user.nombre)}</strong>
                    <small>${escapeHTML(user.cargo)}</small>
                </div>
                <button class="btn btn--ghost btn--sm" type="button" data-action="logout" title="Cerrar sesión">
                    ${icons.logout}<span>Salir</span>
                </button>
            </div>`;
    }

    #guestTemplate() {
        return `
            <div class="navbar__guest">
                <a class="btn btn--primary btn--sm" href="#/login" data-path="login">${icons.login}<span>Iniciar sesión</span></a>
            </div>`;
    }

    async #handleClick(event) {
        if (event.target.closest('.navbar__toggle')) {
            this.#toggleMenu();
            return;
        }

        if (event.target.closest('[data-action="logout"]')) {
            const confirmed = await confirmAction({
                title: 'Cerrar sesión',
                message: '¿Deseas salir de la plataforma?',
                confirmText: 'Salir',
            });
            if (!confirmed) return;

            logout();
            showToast('Sesión cerrada correctamente.', 'info');
            navigate('login');
        }
    }

    #toggleMenu() {
        const menu = this.querySelector('.navbar__menu');
        const toggle = this.querySelector('.navbar__toggle');
        const isOpen = menu.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
    }

    #closeMenu() {
        this.querySelector('.navbar__menu')?.classList.remove('is-open');
        this.querySelector('.navbar__toggle')?.setAttribute('aria-expanded', 'false');
    }

    #highlightActiveLink() {
        const current = location.hash.replace(/^#\/?/, '').split('/')[0];
        // La vista de "examen/:id" pertenece a la sección "examenes".
        const section = current === 'examen' ? 'examenes' : current;

        this.querySelectorAll('.navbar__links [data-path]').forEach((link) => {
            const isActive = link.dataset.path === section;
            link.classList.toggle('is-active', isActive);
            if (isActive) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }
}

customElements.define('app-navbar', AppNavbar);
