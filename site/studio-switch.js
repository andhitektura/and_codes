/* studio-switch.js — the studio's app switcher, the same file in every studio app
 * (and_org, and_projects, and_atlas, and_codes). Change it in one, copy it to the others.
 *
 * Put a placeholder in the app's navigation bar where the links go:
 *   <span data-studio-switch></span>
 * It becomes the row of app links (the current one marked) and a small button with the rest (all tools, the
 * public site). When the bar is too narrow for the links (a phone, a small window), only the button stays and the
 * links move into it.
 * and load this file after it:
 *   <script src="studio-switch.js" data-app="atlas" data-staff="1" defer></script>
 *
 * data-app    which app this is (atlas | org | projects | codes): it is marked as the current one
 * data-wide   optional: below this window width (px) only the button is shown
 * data-staff  "1" shows the staff-only apps (org, atlas, the team page); "0" leaves them out. An app that only
 *             learns who is signed in later calls  window.studioSwitch.setStaff(true|false).
 *
 * The language follows <html lang>, which every app already sets when its EN/MK button is pressed.
 */
(() => {
  if (window.studioSwitch) return;
  const me = document.currentScript;
  const current = me?.dataset.app || '';
  let staff = me?.dataset.staff === '1';
  const wide = Number(me?.dataset.wide) || 0;

  // The apps, in the same order and colours as the cards on andhitektura.com/team/.
  const APPS = [
    { id: 'org', href: 'https://org.andhitektura.com/', mark: 'or', accent: '#f0c84b', staff: true,
      en: ['and_org', 'Team hub: news, forum, chat'], mk: ['and_org', 'Тимски центар: вести, форум, разговор'] },
    { id: 'projects', href: 'https://projects.andhitektura.com/', mark: 'pr', accent: '#64aaaa', staff: false,
      en: ['and_projects', 'Project boards and timelines'], mk: ['and_projects', 'Табли и рокови на проектите'] },
    { id: 'atlas', href: 'https://atlas.andhitektura.com/', mark: 'at', accent: '#46a064', staff: true,
      en: ['and_atlas', 'The studio’s encyclopedia'], mk: ['and_atlas', 'Енциклопедија на студиото'] },
    { id: 'codes', href: 'https://andhitektura.github.io/and_codes/', mark: '§', accent: '#e14b4b', staff: false,
      en: ['and_codes', 'Building regulations, consolidated'], mk: ['and_codes', 'Градежни прописи, консолидирани'] },
  ];
  const T = {
    en: { label: 'Studio apps', head: 'studio ANDhitektura', all: 'All tools', site: 'andhitektura.com', here: 'you are here' },
    mk: { label: 'Апликации на студиото', head: 'студио ANDhitektura', all: 'Сите алатки', site: 'andhitektura.com', here: 'тука сте' },
  };
  const lang = () => ((document.documentElement.lang || 'en').toLowerCase().startsWith('mk') ? 'mk' : 'en');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const css = `
.ss-wrap{display:inline-flex;align-items:center;gap:6px;flex:none;min-width:0}
.ss-links{display:flex;align-items:center;gap:2px;font-size:14px;line-height:1}
.ss-wrap.ss-compact .ss-links{display:none}
.ss-link{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border-radius:999px;color:#a0a0a0;text-decoration:none;white-space:nowrap;letter-spacing:.02em;transition:color .15s,background .15s}
.ss-link::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--ss-accent);flex:none}
.ss-link:hover,.ss-link:focus-visible{color:#e1e1e1;background:#2c2c2c;outline:none}
.ss-link[aria-current="page"]{color:#e1e1e1;font-weight:700;box-shadow:inset 0 0 0 1.5px var(--ss-accent)}
.ss-btn{all:unset;box-sizing:border-box;flex:none;display:inline-grid;place-items:center;width:34px;height:34px;border:1.5px solid #555;border-radius:8px;color:#e1e1e1;cursor:pointer;transition:border-color .15s,background .15s}
.ss-btn:hover,.ss-btn[aria-expanded="true"]{border-color:#e1e1e1;background:#2c2c2c}
.ss-btn:focus-visible{outline:2px solid #f0c84b;outline-offset:3px}
.ss-btn svg{width:16px;height:16px;display:block}
.ss-pop{position:fixed;z-index:1000;box-sizing:border-box;width:300px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;padding:8px;background:#1c1c1c;border:2px solid #555;border-radius:12px;box-shadow:0 10px 32px rgb(0 0 0 / .5);color:#e1e1e1;font-family:inherit;font-size:14px;line-height:1.3;text-align:left}
.ss-pop[hidden]{display:none}
.ss-head{padding:4px 8px 8px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8c8c8c}
.ss-list{list-style:none;margin:0;padding:0}
.ss-item{display:grid;grid-template-columns:32px minmax(0,1fr);gap:10px;align-items:center;padding:7px 8px;border-radius:8px;color:inherit;text-decoration:none}
.ss-item:hover,.ss-item:focus-visible{background:#2c2c2c;outline:none}
.ss-item[aria-current="page"]{background:#2c2c2c}
.ss-mark{box-sizing:border-box;width:32px;height:32px;display:grid;place-items:center;border:2px solid var(--ss-accent);border-radius:6px;color:var(--ss-accent);font-weight:700;font-size:13px;letter-spacing:.02em}
.ss-name{display:block;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-text{display:block;font-size:12px;color:#a0a0a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-here{color:var(--ss-accent);font-weight:400;font-size:11px;margin-left:6px}
.ss-foot{display:flex;gap:6px;margin-top:6px;padding-top:8px;border-top:1px solid #3a3a3a}
.ss-foot a{flex:1;padding:7px 8px;border-radius:8px;color:#c8c8c8;text-decoration:none;font-size:13px;white-space:nowrap;text-align:center;border:1.5px solid #3a3a3a}
.ss-foot a:hover,.ss-foot a:focus-visible{border-color:#e1e1e1;color:#e1e1e1;outline:none}
`;
  const icon = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><rect x="1" y="1" width="4" height="4" rx=".6"/><rect x="6" y="1" width="4" height="4" rx=".6"/><rect x="11" y="1" width="4" height="4" rx=".6"/><rect x="1" y="6" width="4" height="4" rx=".6"/><rect x="6" y="6" width="4" height="4" rx=".6"/><rect x="11" y="6" width="4" height="4" rx=".6"/><rect x="1" y="11" width="4" height="4" rx=".6"/><rect x="6" y="11" width="4" height="4" rx=".6"/><circle cx="13" cy="13" r="2.1" fill="#e14b4b"/></svg>';

  let wrap, links, btn, pop;

  function render() {
    const L = lang(), t = T[L];
    btn.setAttribute('aria-label', t.label);
    btn.title = t.label;
    const apps = APPS.filter((a) => staff || !a.staff || a.id === current);
    links.setAttribute('aria-label', t.label);
    links.innerHTML = apps.map((a) => `<a class="ss-link" href="${a.href}" style="--ss-accent:${a.accent}" title="${esc(a[L][1])}"${a.id === current ? ' aria-current="page"' : ''}>${esc(a.id)}</a>`).join('');
    const team = L === 'mk' ? 'https://andhitektura.com/mk/team/' : 'https://andhitektura.com/team/';
    const site = L === 'mk' ? 'https://andhitektura.com/mk/' : 'https://andhitektura.com/';
    pop.innerHTML = `<div class="ss-head">${esc(t.head)}</div><ul class="ss-list">${apps.map((a) => {
      const [name, text] = a[L];
      const here = a.id === current;
      return `<li><a class="ss-item" href="${a.href}" style="--ss-accent:${a.accent}"${here ? ' aria-current="page"' : ''}>`
        + `<span class="ss-mark" aria-hidden="true">${esc(a.mark)}</span>`
        + `<span><span class="ss-name">${esc(name)}${here ? `<span class="ss-here">${esc(t.here)}</span>` : ''}</span><span class="ss-text">${esc(text)}</span></span></a></li>`;
    }).join('')}</ul><div class="ss-foot">${staff ? `<a href="${team}">${esc(t.all)}</a>` : ''}<a href="${site}">${esc(t.site)}</a></div>`;
  }

  // Show the row of links only when the bar has room for it; otherwise leave just the button.
  function fit() {
    wrap.classList.remove('ss-compact');
    if (window.innerWidth < wide) return wrap.classList.add('ss-compact');
    const out = (el) => {
      if (!el) return false;
      const a = el.getBoundingClientRect(), b = wrap.getBoundingClientRect();
      return el.scrollWidth > el.clientWidth + 1 || b.left < a.left - 1 || b.right > a.right + 1;
    };
    if (out(wrap.parentElement) || out(wrap.closest('header'))) wrap.classList.add('ss-compact');
  }

  function place() {
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth;
    pop.style.top = Math.round(r.bottom + 8) + 'px';
    pop.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - w - 8))) + 'px';
  }
  function open() { render(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); place(); }
  function close(focus) { if (pop.hidden) return; pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (focus) btn.focus(); }

  function mount() {
    const slot = document.querySelector('[data-studio-switch]');
    if (!slot) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ss-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'studio-switch');
    btn.innerHTML = icon;
    pop = document.createElement('nav');
    pop.className = 'ss-pop';
    pop.id = 'studio-switch';
    pop.hidden = true;
    wrap = document.createElement('span');
    wrap.className = 'ss-wrap';
    links = document.createElement('nav');
    links.className = 'ss-links';
    wrap.append(links, btn);
    slot.replaceWith(wrap);
    document.body.appendChild(pop);
    render();
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(wrap.parentElement);
    const bar = wrap.closest('header');
    if (bar && bar !== wrap.parentElement) ro.observe(bar);

    btn.addEventListener('click', (e) => { e.stopPropagation(); pop.hidden ? open() : close(); });
    document.addEventListener('click', (e) => { if (!pop.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); close(true); } }, true);
    window.addEventListener('resize', () => { if (!pop.hidden) place(); });
    new MutationObserver(() => { render(); fit(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  window.studioSwitch = {
    setStaff(v) { staff = !!v; if (pop) { render(); fit(); } },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
