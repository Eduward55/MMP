import { createDuo } from '../shared/companion.js';
import { COATS, COAT_BY_ID, OTTER_COATS, OTTER_COAT_BY_ID, EYE_COLORS, creatureSVG } from '../shared/creatures.js';
import { OUTFITS, SLOTS } from '../shared/outfits.js';
import { getProfile, saveProfile } from '../shared/store.js';
import { el, esc, toast } from '../shared/ui.js';

const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.id, s.label]));

// Recortes do viewBox para as miniaturas destacarem a área do acessório.
const CROP = {
  head: '5 0 30 30',
  ear: '7 3 26 26',
  face: '8 7 24 24',
  neck: '7 13 26 26',
  body: '2 4 36 36',
  back: '2 4 36 36',
  hand: '6 8 32 32'
};

export default {
  id: 'mycat',
  title: 'Meu Gato',
  icon: 'mycat',
  accent: '#f28a3b',
  desc: 'Pelagem, olhos, nomes e 20 roupinhas para o gato e a lontra — cada um com a sua cor.',
  hideDock: true,
  async mount(root) {
    let draft = structuredClone(getProfile());
    let saved = JSON.stringify(draft);
    const revertTo = saved;
    let target = 'cat';
    let saveTimer = 0;
    let ready = false;

    const preview = el('div', { class: 'mycat__preview' });
    const dirtyFlag = el('span', { class: 'pill pill--warn', hidden: true }, 'Alterações não salvas');
    const wearing = el('ul', { class: 'wearing' });

    const catName = el('input', { class: 'input', type: 'text', maxlength: '24', value: draft.cat.name, 'aria-label': 'Nome do gato' });
    const otterName = el('input', { class: 'input', type: 'text', maxlength: '24', value: draft.otter.name, 'aria-label': 'Nome da lontra' });
    const coats = el('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Pelagem' });
    const eyes = el('div', { class: 'chips chips--eyes', role: 'radiogroup', 'aria-label': 'Cor dos olhos' });
    const eyeCustom = el('input', { class: 'color-input', type: 'color', value: draft.cat.eyes, title: 'Escolher outra cor' });
    const coatLabel = el('span', { class: 'field__label' }, 'Pelagem do gato');
    const eyeLabel = el('span', { class: 'field__label' }, 'Olhos do gato');
    const targetTabs = el('div', { class: 'segmented', role: 'tablist' });
    const slotTabs = el('div', { class: 'outfit-tabs', role: 'tablist', 'aria-label': 'Categoria da roupa' });
    const outfitGrid = el('div', { class: 'outfits' });
    let slotFilter = 'all';

    function dirty() {
      return JSON.stringify(draft) !== saved;
    }

    async function persistDraft() {
      if (!COAT_BY_ID[draft.cat.coat]) draft.cat.coat = 'tabby';
      if (!OTTER_COAT_BY_ID[draft.otter.coat]) draft.otter.coat = 'chocolate';
      if (!draft.otter.eyes) draft.otter.eyes = '#93c5fd';
      await saveProfile(draft);
      saved = JSON.stringify(draft);
      dirtyFlag.hidden = true;
      dirtyFlag.textContent = 'Salvo';
    }

    function scheduleSave() {
      dirtyFlag.hidden = false;
      dirtyFlag.textContent = 'Salvando…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        persistDraft().catch((err) => {
          console.error(err);
          dirtyFlag.textContent = 'Não salvou';
          dirtyFlag.hidden = false;
        });
      }, 280);
    }

    function refresh({ outfits = true } = {}) {
      preview.innerHTML = '';
      preview.append(createDuo({ size: 230, profile: draft, live: false, catClass: 'is-idle', otterClass: 'is-idle' }).el);
      dirtyFlag.hidden = !dirty();
      if (dirty()) dirtyFlag.textContent = 'Salvando…';
      renderWearing();
      renderCoats();
      renderEyes();
      if (outfits) renderOutfits();
      if (ready) scheduleSave();
    }

    function renderWearing() {
      const items = [];
      for (const who of ['cat', 'otter']) {
        for (const [slot, id] of Object.entries(draft[who].outfit)) {
          const def = OUTFITS.find((o) => o.id === id);
          if (def) items.push(`<li><b>${esc(who === 'cat' ? draft.cat.name : draft.otter.name)}</b> ${esc(def.name)} <small>${esc(SLOT_LABEL[slot])}</small></li>`);
        }
      }
      wearing.innerHTML = items.length ? items.join('') : '<li class="muted">Ninguém está vestindo nada… ainda!</li>';
    }

    function palettes() {
      return target === 'otter' ? OTTER_COATS : COATS;
    }

    function whoEyes() {
      return (draft[target].eyes || (target === 'otter' ? '#93c5fd' : '#4ade80')).toLowerCase();
    }

    function renderCoats() {
      coats.innerHTML = '';
      coats.setAttribute('aria-label', target === 'otter' ? 'Pelagem da lontra' : 'Pelagem do gato');
      coatLabel.textContent = target === 'otter' ? `Pelagem de ${draft.otter.name}` : `Pelagem de ${draft.cat.name}`;
      palettes().forEach((c) => {
        const on = draft[target].coat === c.id;
        const b = c.stripe || c.dark || c.light;
        coats.append(
          el(
            'button',
            {
              class: `chip ${on ? 'is-on' : ''}`,
              role: 'radio',
              'aria-checked': String(on),
              onclick: () => {
                draft[target].coat = c.id;
                refresh();
              }
            },
            el('span', { class: 'swatch', style: `--a:${c.fur};--b:${c.stripes ? c.stripe : b}` }),
            c.name
          )
        );
      });
    }

    function renderEyes() {
      eyes.innerHTML = '';
      eyes.setAttribute('aria-label', target === 'otter' ? 'Olhos da lontra' : 'Olhos do gato');
      eyeLabel.textContent = target === 'otter' ? `Olhos de ${draft.otter.name}` : `Olhos de ${draft.cat.name}`;
      const current = whoEyes();
      eyeCustom.value = draft[target].eyes || (target === 'otter' ? '#93c5fd' : '#4ade80');
      EYE_COLORS.forEach((c) => {
        const on = current === c.id.toLowerCase();
        eyes.append(
          el('button', {
            class: `eye-dot ${on ? 'is-on' : ''}`,
            style: `--c:${c.id}`,
            role: 'radio',
            'aria-checked': String(on),
            title: c.name,
            'aria-label': c.name,
            onclick: () => {
              draft[target].eyes = c.id;
              eyeCustom.value = c.id;
              refresh({ outfits: false });
            }
          })
        );
      });
      eyes.append(eyeCustom);
    }

    function renderTabs() {
      targetTabs.innerHTML = '';
      [
        ['cat', `Gato · ${draft.cat.name}`],
        ['otter', `Lontra · ${draft.otter.name}`]
      ].forEach(([id, label]) => {
        targetTabs.append(
          el(
            'button',
            {
              class: `segmented__btn ${target === id ? 'is-on' : ''}`,
              role: 'tab',
              'aria-selected': String(target === id),
              onclick: () => {
                target = id;
                renderTabs();
                renderCoats();
                renderEyes();
                renderOutfits();
              }
            },
            label
          )
        );
      });
    }

    function renderSlotTabs() {
      slotTabs.innerHTML = '';
      [['all', 'Tudo'], ...SLOTS.map((s) => [s.id, s.label])].forEach(([id, label]) => {
        slotTabs.append(
          el(
            'button',
            {
              class: `outfit-tab ${slotFilter === id ? 'is-on' : ''}`,
              type: 'button',
              role: 'tab',
              'aria-selected': String(slotFilter === id),
              onclick: () => {
                slotFilter = id;
                renderSlotTabs();
                renderOutfits();
              }
            },
            label
          )
        );
      });
    }

    function renderOutfits() {
      outfitGrid.innerHTML = '';
      const who = draft[target];
      const baseLook = { coat: who.coat, eyes: who.eyes };
      OUTFITS.filter((o) => slotFilter === 'all' || o.slot === slotFilter).forEach((o) => {
        const on = who.outfit[o.slot] === o.id;
        outfitGrid.append(
          el(
            'button',
            {
              class: `outfit ${on ? 'is-on' : ''}`,
              'aria-pressed': String(on),
              title: `${o.name} (${SLOT_LABEL[o.slot]})`,
              onclick: () => {
                if (on) delete who.outfit[o.slot];
                else who.outfit[o.slot] = o.id;
                refresh();
              }
            },
            el('span', { class: 'outfit__art', html: creatureSVG(target, { ...baseLook, outfit: { [o.slot]: o.id } }, { size: 80, label: o.name, viewBox: CROP[o.slot] || CROP.body }) }),
            el('span', { class: 'outfit__name' }, o.name),
            el('span', { class: 'outfit__slot' }, SLOT_LABEL[o.slot])
          )
        );
      });
    }

    catName.addEventListener('input', () => {
      draft.cat.name = catName.value.trim() || 'Gato';
      refresh({ outfits: false });
      renderTabs();
    });
    otterName.addEventListener('input', () => {
      draft.otter.name = otterName.value.trim() || 'Lontra';
      refresh({ outfits: false });
      renderTabs();
    });
    eyeCustom.addEventListener('input', () => {
      draft[target].eyes = eyeCustom.value;
      refresh({ outfits: false });
    });

    const actions = el(
      'div',
      { class: 'row-actions' },
      el('button', {
        class: 'btn btn--ghost',
        onclick: () => {
          draft[target].outfit = {};
          refresh();
        }
      }, 'Tirar tudo'),
      el('button', {
        class: 'btn btn--ghost',
        onclick: () => {
          const bySlot = {};
          OUTFITS.forEach((o) => (bySlot[o.slot] = bySlot[o.slot] || []).push(o));
          const outfit = {};
          Object.entries(bySlot).forEach(([slot, list]) => {
            if (Math.random() < 0.45) outfit[slot] = list[Math.floor(Math.random() * list.length)].id;
          });
          draft[target].outfit = outfit;
          const coatsFor = target === 'otter' ? OTTER_COATS : COATS;
          if (Math.random() < 0.7) draft[target].coat = coatsFor[Math.floor(Math.random() * coatsFor.length)].id;
          draft[target].eyes = EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)].id;
          refresh();
        }
      }, 'Surpresa!'),
      el('button', {
        class: 'btn btn--ghost',
        onclick: () => {
          draft = JSON.parse(revertTo);
          catName.value = draft.cat.name;
          otterName.value = draft.otter.name;
          renderTabs();
          refresh();
          toast('Voltamos para como estava quando você abriu.');
        }
      }, 'Desfazer')
    );

    root.append(
      el(
        'div',
        { class: 'mycat' },
        el(
          'section',
          { class: 'panel mycat__stage' },
          el('div', { class: 'panel__head' }, el('h2', {}, 'Camarim'), dirtyFlag),
          preview,
          el('h3', { class: 'subhead' }, 'Vestindo agora'),
          wearing
        ),
        el(
          'section',
          { class: 'panel mycat__form' },
          el(
            'div',
            { class: 'form-grid' },
            el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Nome do gato'), catName),
            el('label', { class: 'field' }, el('span', { class: 'field__label' }, 'Nome da lontra'), otterName)
          ),
          el('div', { class: 'field' }, el('div', { class: 'field__row' }, el('span', { class: 'field__label' }, 'Quem você está editando'), targetTabs)),
          el('div', { class: 'field' }, coatLabel, el('p', { class: 'hint' }, 'A pelagem e os olhos valem só para o bichinho escolhido em cima.'), coats),
          el('div', { class: 'field' }, eyeLabel, eyes),
          el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Roupinhas e acessórios'), el('p', { class: 'hint' }, 'Separe por cabeça, pescoço, corpo… um item por lugar, então nada se sobrepõe no mesmo sítio. Clique de novo para tirar.'), slotTabs, outfitGrid),
          actions
        )
      )
    );

    renderTabs();
    renderSlotTabs();
    refresh();
    ready = true;

    const beforeUnload = (e) => {
      if (dirty()) toast(`${draft.cat.name} lembra: você saiu sem salvar o Meu Gato.`, 'warn', 3600);
      return e;
    };

    return {
      async save() {
        clearTimeout(saveTimer);
        await persistDraft();
        return `${draft.cat.name} e ${draft.otter.name} foram salvos!`;
      },
      unmount() {
        clearTimeout(saveTimer);
        if (dirty()) persistDraft().catch(() => beforeUnload());
        else beforeUnload();
      }
    };
  }
};
