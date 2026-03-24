/**
 * icon-rail.src.js — Left icon rail + popout sub-sidemenu
 * Compiles to: dist/icon-rail.js (IIFE, window.IconRailLib)
 * Icons: Material Symbols Outlined (loaded via CDN)
 * Requires: icon-rail.css for styling
 */

const ms = (name, sz = 20) =>
  `<span class="material-symbols-outlined" style="font-size:${sz}px;line-height:1" aria-hidden="true">${name}</span>`;

const NAV = [
  {
    id: 'dashboard', icon: 'dashboard', label: 'Dashboard', sub: 'CPD overview',
    items: [
      { icon: 'trending_up',  label: 'My Progress',   href: 'index.html',          sub: 'CPD progress & stats' },
      { icon: 'edit_note',    label: 'Activity Log',  href: 'index.html#activity', sub: 'Log CPD hours' },
      { icon: 'flag',         label: 'PDP Goals',     href: 'index.html#pdp',      sub: 'Personal development plan' },
      { icon: 'description',  label: 'CPD Report',    href: 'cpd-report.html',     sub: 'Full compliance report' },
    ],
  },
  {
    id: 'team', icon: 'group', label: 'Team', headerLabel: 'Team Management', sub: 'Manage your people',
    items: [
      { icon: 'bar_chart',  label: 'Team Overview',  href: 'team-management.html', sub: 'Compliance summary' },
      { icon: 'person',     label: 'My Team',        href: 'my-team.html',          sub: 'Members & CPD progress' },
      { icon: 'person_add', label: 'Invite Members', href: '#',                     sub: 'Coming soon', dim: true },
    ],
  },
  {
    id: 'learning', icon: 'school', label: 'Learning', sub: 'Courses & certificates',
    items: [
      { icon: 'menu_book',    label: 'Course Library', href: '#', sub: 'Coming soon', dim: true },
      { icon: 'play_circle',  label: 'My Learning',    href: '#', sub: 'Coming soon', dim: true },
      { icon: 'emoji_events', label: 'Achievements',   href: '#', sub: 'Coming soon', dim: true },
    ],
  },
  {
    id: 'reports', icon: 'assessment', label: 'Reports', sub: 'Analytics & compliance',
    items: [
      { icon: 'description', label: 'CPD Report',       href: 'cpd-report.html', sub: 'Full cycle report' },
      { icon: 'verified',    label: 'Compliance Check', href: '#',               sub: 'Coming soon', dim: true },
      { icon: 'analytics',   label: 'Team Analytics',   href: '#',               sub: 'Coming soon', dim: true },
    ],
  },
  {
    id: 'admin', icon: 'settings', label: 'Admin', sub: 'Settings & rules',
    items: [
      { icon: 'tune',            label: 'Admin Portal', href: 'vs-admin.html', sub: 'Platform administration' },
      { icon: 'gavel',           label: 'CE Rules',     href: '#',             sub: 'Coming soon', dim: true },
      { icon: 'account_balance', label: 'Authorities',  href: '#',             sub: 'Coming soon', dim: true },
    ],
  },
];

const STORAGE_KEY  = 'cpd_nav_mode';
const CLOSE_DELAY  = 220; // ms — matches CSS close transition

class IconRail {
  constructor() {
    this._panelOpen   = false;
    this._activeSection = null;
    this._mode        = localStorage.getItem(STORAGE_KEY) || 'top';
    this._currentPage = location.pathname.split('/').pop() || 'index.html';
    this._inject();
    this._applyMode(this._mode, false);
  }

  // ── Build & inject DOM ──────────────────────────────────────
  _inject() {
    /* Rail */
    const rail = document.createElement('div');
    rail.className = 'ir-rail';
    rail.id = 'irRail';
    rail.setAttribute('role', 'navigation');
    rail.setAttribute('aria-label', 'Icon rail navigation');

    // Logo
    rail.innerHTML = `<div class="ir-logo"><div class="ir-logo-monogram">VS</div></div>`;

    // Nav
    const nav = document.createElement('nav');
    nav.className = 'ir-nav';
    NAV.forEach(section => {
      if (section.id === 'admin') {
        const d = document.createElement('div');
        d.className = 'ir-divider';
        nav.appendChild(d);
      }
      const item = document.createElement('div');
      item.className = 'ir-item';
      item.dataset.section = section.id;
      item.dataset.tooltip = section.label;       // for CSS ::after tooltip
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', section.label);
      item.innerHTML = `
        <div class="ir-item-icon">${ms(section.icon, 22)}</div>
      `;
      item.addEventListener('click', () => this._toggleSection(section.id));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._toggleSection(section.id); }
      });
      nav.appendChild(item);
    });
    rail.appendChild(nav);

    // Bottom avatar
    const bottom = document.createElement('div');
    bottom.className = 'ir-bottom';
    bottom.innerHTML = `<div class="ir-avatar" title="My Account">AK</div>`;
    rail.appendChild(bottom);

    /* Sub-panel */
    const panel = document.createElement('div');
    panel.className = 'ir-panel';
    panel.id = 'irPanel';

    /* Overlay */
    const overlay = document.createElement('div');
    overlay.className = 'ir-overlay';
    overlay.id = 'irOverlay';
    overlay.addEventListener('click', () => this._closePanel());

    /* FAB toggle */
    const fab = document.createElement('button');
    fab.className = 'nav-toggle-fab';
    fab.id = 'navToggleFab';
    fab.setAttribute('aria-label', 'Toggle navigation style');
    fab.innerHTML = `
      <div class="nav-toggle-fab__icon" id="navFabIcon">${ms('view_sidebar', 20)}</div>
      <span class="nav-toggle-fab__label" id="navFabLabel">Icon Rail</span>
    `;
    fab.addEventListener('click', () => this._toggleMode());

    document.body.appendChild(rail);
    document.body.appendChild(panel);
    document.body.appendChild(overlay);
    document.body.appendChild(fab);

    this._rail    = rail;
    this._panel   = panel;
    this._overlay = overlay;

    this._highlightCurrentPage();

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._panelOpen) this._closePanel();
    });
  }

  // ── Highlight active based on URL ───────────────────────────
  _highlightCurrentPage() {
    const p = this._currentPage;
    let id = null;
    if (!p || p === 'index.html' || p === 'cpd-report.html') id = 'dashboard';
    else if (p === 'my-team.html' || p === 'team-management.html')  id = 'team';
    else if (p === 'vs-admin.html')                                   id = 'admin';
    if (id) {
      this._rail.querySelector(`[data-section="${id}"]`)?.classList.add('ir-item--active');
      this._activeSection = id;
    }
  }

  // ── Section toggle ──────────────────────────────────────────
  _toggleSection(id) {
    if (this._panelOpen && this._activeSection === id) {
      this._closePanel();
    } else {
      this._activeSection = id;
      this._buildPanel(id);
      this._openPanel();
      this._rail.querySelectorAll('.ir-item').forEach(el =>
        el.classList.toggle('ir-item--active', el.dataset.section === id));
    }
  }

  // ── Build panel HTML ────────────────────────────────────────
  _buildPanel(id) {
    const section = NAV.find(s => s.id === id);
    if (!section) return;
    const page = this._currentPage;

    this._panel.innerHTML = `
      <div class="ir-panel-header" style="position:relative">
        <div class="ir-panel-title">${section.headerLabel || section.label}</div>
        <button class="ir-panel-close" id="irPanelClose" aria-label="Close">${ms('close', 16)}</button>
      </div>
      <nav class="ir-panel-nav">
        ${section.items.map(item => `
          <a href="${item.href}"
             class="ir-panel-link${item.href === page || item.href.startsWith(page + '#') ? ' ir-panel-link--active' : ''}"
             ${item.dim ? 'aria-disabled="true"' : ''}>
            <div class="ir-panel-link-icon">${ms(item.icon, 16)}</div>
            <div class="ir-panel-link-body">
              <div class="ir-panel-link-title">${item.label}</div>
              <div class="ir-panel-link-sub">${item.sub}</div>
            </div>
          </a>
        `).join('')}
      </nav>
    `;

    this._panel.querySelector('#irPanelClose')?.addEventListener('click', () => this._closePanel());
  }

  // ── Open panel ──────────────────────────────────────────────
  _openPanel() {
    this._panel.classList.add('ir-panel--open');
    this._overlay.classList.add('ir-overlay--visible');
    document.body.classList.add('ir-panel-open');
    this._panelOpen = true;
  }

  // ── Close panel (fast ease out) ─────────────────────────────
  _closePanel() {
    // Trigger fast-close CSS transition by removing class
    this._panel.classList.remove('ir-panel--open');
    this._overlay.classList.remove('ir-overlay--visible');
    document.body.classList.remove('ir-panel-open');
    this._panelOpen = false;

    // Restore page-based active highlight after close animation
    setTimeout(() => {
      if (!this._panelOpen) {
        this._rail.querySelectorAll('.ir-item').forEach(el => el.classList.remove('ir-item--active'));
        this._highlightCurrentPage();
      }
    }, CLOSE_DELAY);
  }

  // ── Mode toggle ─────────────────────────────────────────────
  _toggleMode() {
    this._applyMode(this._mode === 'top' ? 'rail' : 'top', true);
  }

  _applyMode(mode, save) {
    this._mode = mode;
    if (save) localStorage.setItem(STORAGE_KEY, mode);

    const isRail = mode === 'rail';
    document.body.classList.toggle('ir-mode', isRail);

    const icon  = document.getElementById('navFabIcon');
    const label = document.getElementById('navFabLabel');
    if (icon)  icon.innerHTML    = isRail ? ms('view_quilt', 20) : ms('view_sidebar', 20);
    if (label) label.textContent = isRail ? 'Top Nav' : 'Icon Rail';

    if (!isRail) this._closePanel();
  }
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { window.iconRail = new IconRail(); });
} else {
  window.iconRail = new IconRail();
}

export { IconRail };
