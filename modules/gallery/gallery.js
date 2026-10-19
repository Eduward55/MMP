import { gallery, kv } from '../shared/store.js';
import { el, modal, prompt, confirmDialog, toast, formatDate, formatBytes } from '../shared/ui.js';
import { icon } from '../shared/icons.js';
import { createDuo } from '../shared/companion.js';

const TYPES = [
  { id: 'all', label: 'Tudo' },
  { id: 'audio', label: 'Áudio' },
  { id: 'video', label: 'Vídeo' },
  { id: 'beat', label: 'Beats' },
  { id: 'project', label: 'Projetos' }
];

const TYPE_INFO = {
  audio: { label: 'Áudio', icon: 'studio', color: '#8b5cf6' },
  video: { label: 'Vídeo', icon: 'gallery', color: '#a1a1aa' },
  beat: { label: 'Beat', icon: 'beatcats', color: '#a78bfa' },
  project: { label: 'Projeto', icon: 'studio', color: '#d4d4d8' }
};
const hasEvents = (item) => item.type === 'project' || item.type === 'beat' || Boolean(item.eventsFile);

const MODULE_NAMES = { beatcats: 'Beat Cats', studio: 'Studio', airpads: 'Air Pads', cattyping: 'Cat Typing', cantar: 'Cantar', tetris: 'Tetris', corrida: 'Corrida', mmp: 'MMP' };

export default {
  id: 'gallery',
  title: 'Galeria',
  icon: 'gallery',
  accent: '#ffd23f',
  desc: 'Seus áudios, vídeos e beats: abrir, renomear, exportar e apagar.',
  async mount(root) {
    const prefs = (await kv.get('gallery-prefs').catch(() => null)) || { filter: 'all', sort: 'new' };
    let filter = prefs.filter || 'all';
    let sort = prefs.sort || 'new';
    let query = '';
    let items = [];
    let state = 'loading';
    let error = '';

    const tabs = el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Filtrar por tipo' });
    const search = el('input', { class: 'input input--search', type: 'search', placeholder: 'Buscar pelo nome…', 'aria-label': 'Buscar' });
    const sortSel = el(
      'select',
      { class: 'input input--select', 'aria-label': 'Ordenar' },
      el('option', { value: 'new' }, 'Mais recentes'),
      el('option', { value: 'old' }, 'Mais antigos'),
      el('option', { value: 'name' }, 'Nome (A–Z)')
    );
    sortSel.value = sort;
    const count = el('span', { class: 'gallery__count' });
    const list = el('div', { class: 'gallery__grid' });

    function renderTabs() {
      tabs.innerHTML = '';
      TYPES.forEach((t) => {
        const n = t.id === 'all' ? items.length : items.filter((i) => i.type === t.id).length;
        tabs.append(
          el(
            'button',
            {
              class: `segmented__btn ${filter === t.id ? 'is-on' : ''}`,
              role: 'tab',
              'aria-selected': String(filter === t.id),
              onclick: () => {
                filter = t.id;
                render();
              }
            },
            `${t.label} `,
            el('small', {}, String(n))
          )
        );
      });
    }

    function visible() {
      const q = query.toLowerCase();
      const out = items.filter((i) => (filter === 'all' || i.type === filter) && (!q || i.name.toLowerCase().includes(q)));
      if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      else if (sort === 'old') out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      else out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return out;
    }

    function render() {
      renderTabs();
      list.innerHTML = '';
      if (state === 'loading') {
        list.append(el('div', { class: 'state' }, el('div', { class: 'boot__spinner' }), el('p', {}, 'Abrindo a gaveta de criações…')));
        count.textContent = '';
        return;
      }
      if (state === 'error') {
        list.append(
          el('div', { class: 'state state--error' }, el('h2', {}, 'Não consegui ler a Galeria'), el('p', {}, error), el('button', { class: 'btn btn--primary', onclick: load }, 'Tentar de novo'))
        );
        return;
      }
      const shown = visible();
      count.textContent = `${shown.length} de ${items.length}`;
      if (!items.length) {
        list.append(emptyState('Sua Galeria está vazia', 'Crie um beat no Beat Cats ou grave algo no Studio e aperte Salvar.'));
        return;
      }
      if (!shown.length) {
        list.append(emptyState('Nada com esse filtro', 'Tente outro tipo ou limpe a busca.'));
        return;
      }
      shown.forEach((item) => list.append(card(item)));
    }

    function emptyState(title, text) {
      return el(
        'div',
        { class: 'state state--empty' },
        createDuo({ size: 110, names: false }).el,
        el('h2', {}, title),
        el('p', {}, text),
        el('div', { class: 'row-actions' }, el('a', { class: 'btn btn--primary', href: '#/beatcats' }, 'Ir para Beat Cats'), el('a', { class: 'btn btn--ghost', href: '#/studio' }, 'Ir para o Studio'))
      );
    }

    function card(item) {
      const info = TYPE_INFO[item.type] || TYPE_INFO.audio;
      const meta = [];
      if (item.meta && item.meta.bpm) meta.push(`${item.meta.bpm} BPM`);
      if (item.meta && item.meta.seconds) meta.push(`${Math.round(item.meta.seconds)}s`);
      if (item.meta && item.meta.notes) meta.push(`${item.meta.notes} notas`);
      meta.push(formatBytes(item.size));
      return el(
        'article',
        { class: 'gcard', style: `--accent:${info.color}` },
        el(
          'button',
          { class: 'gcard__thumb', title: 'Abrir', onclick: () => open(item) },
          el('span', { html: icon(info.icon, 44) }),
          el('span', { class: 'gcard__type' }, info.label)
        ),
        el(
          'div',
          { class: 'gcard__body' },
          el('h3', { class: 'gcard__name', title: item.name }, item.name),
          el('p', { class: 'gcard__meta' }, `${MODULE_NAMES[item.module] || item.module} · ${formatDate(item.createdAt)}`),
          el('p', { class: 'gcard__meta' }, meta.join(' · '))
        ),
        el(
          'div',
          { class: 'gcard__actions' },
          el('button', { class: 'btn btn--sm btn--primary', onclick: () => open(item) }, 'Abrir'),
          hasEvents(item) && item.type !== 'project'
            ? el('a', { class: 'btn btn--sm btn--ghost gcard__studio', href: `#/studio?open=${encodeURIComponent(item.id)}`, title: 'Editar as notas no Studio' }, 'No Studio')
            : null,
          el('button', { class: 'btn btn--sm btn--ghost', onclick: () => rename(item) }, 'Renomear'),
          el('button', { class: 'btn btn--sm btn--ghost', onclick: () => exportItem(item) }, 'Exportar'),
          el('button', { class: 'btn btn--sm btn--danger', onclick: () => remove(item) }, 'Apagar')
        )
      );
    }

    async function open(item) {
      if (item.type === 'beat') {
        location.hash = `#/beatcats?open=${encodeURIComponent(item.id)}`;
        return;
      }
      if (item.type === 'project') {
        location.hash = `#/studio?open=${encodeURIComponent(item.id)}`;
        return;
      }
      try {
        const { data } = await gallery.read(item.id);
        const url = URL.createObjectURL(new Blob([data], { type: item.mime }));
        const media = el(item.type === 'video' ? 'video' : 'audio', { src: url, controls: true, autoplay: true, class: 'player' });
        modal({
          title: item.name,
          wide: item.type === 'video',
          body: el('div', { class: 'player-wrap' }, media, el('p', { class: 'muted' }, `${TYPE_INFO[item.type].label} · ${formatDate(item.createdAt)} · ${formatBytes(item.size)}`)),
          onClose: () => {
            media.pause();
            URL.revokeObjectURL(url);
          }
        });
      } catch (err) {
        toast(`Não abriu: ${err.message}`, 'error');
      }
    }

    async function rename(item) {
      const name = await prompt({ title: 'Renomear', label: 'Novo nome', value: item.name });
      if (!name || name === item.name) return;
      try {
        await gallery.rename(item.id, name);
        toast('Nome atualizado.', 'ok');
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function exportItem(item) {
      try {
        const res = await gallery.export(item.id);
        if (!res.canceled) toast(`Exportado para ${res.filePath}`, 'ok', 4000);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function remove(item) {
      const ok = await confirmDialog({ title: 'Apagar criação?', message: `“${item.name}” será apagado para sempre.`, confirm: 'Apagar', danger: true });
      if (!ok) return;
      try {
        await gallery.remove(item.id);
        toast('Apagado.', 'ok');
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    async function load() {
      state = 'loading';
      render();
      try {
        items = await gallery.list();
        state = 'ready';
      } catch (err) {
        state = 'error';
        error = err.message;
      }
      render();
    }

    search.addEventListener('input', () => {
      query = search.value.trim();
      render();
    });
    sortSel.addEventListener('change', () => {
      sort = sortSel.value;
      render();
    });

    root.append(
      el(
        'section',
        { class: 'gallery' },
        el('div', { class: 'gallery__toolbar' }, tabs, el('div', { class: 'gallery__tools' }, search, sortSel, count)),
        list
      )
    );

    const off = gallery.onChange(load);
    await load();

    return {
      async save() {
        await kv.set('gallery-prefs', { filter, sort });
        return 'Filtro e ordenação da Galeria salvos.';
      },
      unmount: off
    };
  }
};
