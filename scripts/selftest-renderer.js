// Executado dentro do renderer pelo modo MMP_SELFTEST (ver main.js). Retorna um relatório JSON.
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const go = async (route) => {
    location.hash = `#/${route}`;
    await sleep(900);
  };
  const ok = (name, pass, detail = '') => results.push({ name, pass: Boolean(pass), detail: String(detail) });
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  try {
    const initial = await window.mmp.gallery.list();
    ok('galeria semeada no primeiro uso', initial.length === 2, `${initial.length} itens`);
    ok('Tone.js carregado de /vendor', window.Tone && window.Tone.version, window.Tone && window.Tone.version);

    await go('hub');
    ok(
      'Hub: nomes padrão Pirrinha e Manhoso',
      $('.hub__greeting') && $('.hub__greeting').textContent.includes('Pirrinha') && $('.hub__greeting').textContent.includes('Manhoso'),
      $('.hub__greeting') && $('.hub__greeting').textContent
    );
    ok('Hub: seletor de tema compacto', $('.theme-fab') && $$('.theme-swatch').length >= 8, String($$('.theme-swatch').length));

    for (const r of ['airpads', 'beatcats', 'studio', 'cantar', 'gallery', 'termo', 'conexoes', 'cattyping', 'tetris', 'corrida', 'mycat']) {
      await go(r);
      const bar = $('.topbar');
      const hasAll = bar && bar.querySelector('.topbar__back') && bar.querySelector('.topbar__save') && bar.querySelector('a[href="#/gallery"]') && bar.querySelector('.topbar__hint');
      ok(`barra superior em ${r}`, hasAll);
      ok(`gato+lontra visíveis em ${r}`, $$('svg.creature--cat').length && $$('svg.creature--otter').length);
    }

    await go('beatcats');
    $('.topbar__save').click();
    await sleep(800);
    let list = await window.mmp.gallery.list();
    const beat = list.find((i) => i.type === 'beat' && i.name.startsWith('Beat '));
    ok('Beat Cats salva beat na Galeria', beat, beat && beat.name);

    await window.mmp.gallery.rename(beat.id, 'Ronron Funk');
    const read = await window.mmp.gallery.read(beat.id);
    ok('renomear + ler beat', read.item.name === 'Ronron Funk' && read.json.version === 2 && read.json.cats.length === 8, read.item.name);

    await go(`beatcats?open=${beat.id}`);
    ok('abrir beat da Galeria no Beat Cats', $('.beatcats input.input').value === 'Ronron Funk');
    const demo = list.find((i) => i.name.startsWith('Miau Groove'));
    await go(`beatcats?open=${demo.id}`);
    ok('beat de exemplo abre com 5 gatos ativos', $$('.bc-cat.is-active').length === 5, $$('.bc-cat.is-active').length);

    await go('mycat');
    const nameInput = $('input[aria-label="Nome do gato"]');
    nameInput.value = 'Bolinha';
    nameInput.dispatchEvent(new Event('input'));
    $$('.chip').find((c) => c.textContent.includes('Frajola')).click();
    $$('.outfit').find((c) => c.textContent.includes('Coroa')).click();
    $$('.segmented__btn')[1].click();
    const otterCoat = $$('.chip').find((c) => c.textContent.includes('Mel'));
    if (otterCoat) otterCoat.click();
    $$('.eye-dot')[1].click();
    $$('.outfit').find((c) => c.textContent.includes('Astronauta')).click();
    $('.topbar__save').click();
    await sleep(700);
    const prof = await window.mmp.store.read('profile');
    ok(
      'Meu Gato salva perfil em JSON',
      prof.cat.name === 'Bolinha' &&
        prof.cat.coat === 'tuxedo' &&
        prof.cat.outfit.head === 'coroa' &&
        prof.otter.outfit.body === 'astronauta' &&
        prof.otter.coat === 'honey' &&
        prof.otter.eyes,
      JSON.stringify(prof)
    );
    ok('Meu Gato: olhos da lontra não copiam os do gato', prof.otter.eyes.toLowerCase() !== prof.cat.eyes.toLowerCase(), `${prof.cat.eyes} vs ${prof.otter.eyes}`);

    await go('hub');
    ok('Hub reflete o gato salvo', $('.hub__greeting').textContent.includes('Bolinha') && $('.acc--coroa') && !$('.acc--batuta'));

    await go('gallery');
    ok('Galeria lista 3 cards', $$('.gcard').length === 3, $$('.gcard').length);
    $$('.gcard').find((c) => c.textContent.includes('Ronron Funk')).querySelector('.btn--danger').click();
    await sleep(200);
    $('.modal .btn--danger').click();
    await sleep(700);
    list = await window.mmp.gallery.list();
    ok('apagar item da Galeria', list.length === 2 && $$('.gcard').length === 2, list.length);

    await go('airpads');
    const ap = window.__mmpAirPads;
    ok('Air Pads: 2 círculos + HUD + gato maestro', $$('.air-circle').length === 2 && $$('.air-hud').length === 2 && $('.air-maestro svg.creature--cat'));
    ok('Air Pads: círculos em fatias com as notas', $$('.air-slice').length >= 6, String($$('.air-slice').length));
    ok('Air Pads: HUD mostra os instrumentos', $('.air-hud--0').textContent.includes('Piano') && $('.air-hud--1').textContent.includes('Bateria'), $$('.air-hud').map((h) => h.textContent).join(' | '));
    {
      const dock = $('.dock');
      const toggle = $('.dock__toggle');
      const dockRoot = document.getElementById('dock-root');
      ok('Air Pads: dock visível fora da tela cheia', dock && toggle && !dock.hidden && getComputedStyle(dockRoot).display !== 'none' && $$('#dock-root svg.creature--otter').length);
      dock.style.left = '1023px';
      dock.style.top = '40px';
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
      toggle.click();
      await sleep(40);
      const tr = toggle.getBoundingClientRect();
      ok(
        'Air Pads: + colapsado no canto inferior direito',
        dock.classList.contains('is-collapsed') &&
          toggle.textContent.trim() === '+' &&
          tr.width >= 40 &&
          tr.left > window.innerWidth - 90 &&
          tr.bottom > window.innerHeight - 90,
        JSON.stringify({ left: Math.round(tr.left), top: Math.round(tr.top), w: Math.round(tr.width), iw: window.innerWidth, ih: window.innerHeight })
      );
      toggle.click();
      await sleep(40);
      const fsBtn = $$('button').find((b) => /Tela cheia|Encolher palco/.test(b.textContent));
      fsBtn.click();
      await sleep(200);
      const hiddenInFs =
        dock.hidden ||
        getComputedStyle(dockRoot).display === 'none' ||
        getComputedStyle(dock).display === 'none' ||
        getComputedStyle(toggle).display === 'none';
      ok(
        'Air Pads: dock some na tela cheia',
        hiddenInFs && document.documentElement.classList.contains('is-airpads-fs') && $('.airx')?.classList.contains('is-arena-fs'),
        `hidden=${dock.hidden} rootDisplay=${getComputedStyle(dockRoot).display}`
      );
      const back = $('.airx__fs-back');
      const exit = $('.airx__fs-exit');
      const bar = $('.airx__fsbar');
      const br = back && back.getBoundingClientRect();
      const barZ = Number(getComputedStyle(bar).zIndex);
      const vidZ = Number(getComputedStyle($('.airx__video')).zIndex);
      ok(
        'Air Pads: Voltar e Sair visíveis na tela cheia',
        bar &&
          !bar.hidden &&
          back &&
          exit &&
          /Voltar/i.test(back.textContent) &&
          /Sair da tela cheia/i.test(exit.textContent) &&
          br &&
          br.height > 0 &&
          getComputedStyle(bar).display !== 'none' &&
          barZ >= 50 &&
          (Number.isNaN(vidZ) || barZ > vidZ),
        bar && `${bar.hidden} ${getComputedStyle(bar).display} z=${barZ}/${vidZ} ${back && back.textContent}`
      );
      const camOffIdle = $('.airx__fs-cam');
      ok(
        'Air Pads: Desligar some na tela cheia sem câmera',
        camOffIdle &&
          (camOffIdle.hidden || getComputedStyle(camOffIdle).display === 'none') &&
          camOffIdle.getBoundingClientRect().height === 0,
        camOffIdle && `${camOffIdle.hidden} ${getComputedStyle(camOffIdle).display} h=${Math.round(camOffIdle.getBoundingClientRect().height)}`
      );
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
      await sleep(200);
      const camBtn = $$('.airx__stage .toolbar button').find((b) => /Ativar câmera|Desligar câmera/.test(b.textContent));
      const camRect = camBtn && camBtn.getBoundingClientRect();
      ok(
        'Air Pads: Esc sai da tela cheia e devolve a toolbar',
        !$('.airx__arena')?.classList.contains('is-fs') &&
          !document.documentElement.classList.contains('is-airpads-fs') &&
          camBtn &&
          /Ativar câmera/.test(camBtn.textContent) &&
          camRect &&
          camRect.height > 0,
        camBtn && `${camBtn.textContent} h=${camRect && Math.round(camRect.height)} fs=${$('.airx__arena')?.classList.contains('is-fs')}`
      );
      ok(
        'Air Pads: dock volta ao sair da tela cheia',
        !dock.hidden && getComputedStyle(dockRoot).display !== 'none' && !document.documentElement.classList.contains('is-airpads-fs')
      );
      ap.setArenaSize(true);
      ap.simulateCamera(true);
      await sleep(80);
      const camOff = $('.airx__fs-cam');
      const back2 = $('.airx__fs-back');
      ok(
        'Air Pads: Voltar visível com câmera em tela cheia',
        $('.airx__arena')?.classList.contains('is-fs') &&
          $('.airx__arena')?.classList.contains('has-camera') &&
          back2 &&
          /Voltar/i.test(back2.textContent) &&
          back2.getBoundingClientRect().height > 0 &&
          camOff &&
          !camOff.hidden &&
          /Desligar câmera/.test(camOff.textContent) &&
          getComputedStyle(camOff).display !== 'none' &&
          camOff.getBoundingClientRect().height > 0,
        back2 && `${back2.textContent} camOff=${camOff && camOff.hidden} ${camOff && getComputedStyle(camOff).display} ${camOff && camOff.textContent}`
      );
      $('.airx__fs-exit').click();
      await sleep(120);
      const camAfter = $$('.airx__stage .toolbar button').find((b) => /Ativar câmera|Desligar câmera/.test(b.textContent));
      ok(
        'Air Pads: Sair devolve a toolbar da câmera',
        !$('.airx__arena')?.classList.contains('is-fs') && camAfter && camAfter.getBoundingClientRect().height > 0,
        camAfter && camAfter.textContent
      );
      camAfter.click();
      await sleep(80);
      ok(
        'Air Pads: Desligar câmera restaura Ativar câmera',
        /Ativar câmera/.test(camAfter.textContent) && !$('.airx__arena')?.classList.contains('has-camera'),
        camAfter.textContent
      );
      ap.simulateCamera(true);
      await sleep(40);
      ok(
        'Air Pads: câmera não entra em tela cheia sozinha',
        !$('.airx__arena')?.classList.contains('is-fs') &&
          $('.airx__arena')?.classList.contains('has-camera') &&
          $('.topbar__back') &&
          $('.topbar__back').getBoundingClientRect().height > 0 &&
          /Desligar câmera/.test(camAfter.textContent),
        camAfter && `${camAfter.textContent} fs=${$('.airx__arena')?.classList.contains('is-fs')}`
      );
      ap.simulateCamera(false);
    }
    await ap.ready();
    ap.tap(0, 0, -0.9);
    await sleep(150);
    let s = ap.state();
    ok('Air Pads: dedo entra no círculo da esquerda e toca piano', s.hits[0] === 1 && s.inside[0] && /^[A-G]#?\d$/.test(s.labels[0]), JSON.stringify(s.labels));
    ap.tap(1, 0, 0.8);
    await sleep(150);
    s = ap.state();
    ap.release();
    await sleep(80);
    ap.tap(1, -0.75, -0.4);
    await sleep(150);
    s = ap.state();
    ok('Air Pads: círculo da direita toca bateria (zona do bumbo)', s.hits[1] >= 1 && s.labels[1] === 'Bumbo', s.labels[1]);
    ok('Air Pads: maestro aponta para o círculo tocado', $('.air-maestro').classList.contains('is-right'));
    ap.release();
    await sleep(120);
    ap.tap(0, 0, 0);
    await sleep(120);
    ok('Air Pads: sair e entrar de novo toca de novo', ap.state().hits[0] === 2);
    ap.release();
    ap.setInstrument(1, 'theremin');
    await sleep(60);
    ap.tap(1, -0.6, -0.6);
    await sleep(150);
    const low = ap.state().theremin[1];
    ap.tap(1, 0.6, 0.6);
    await sleep(150);
    const high = ap.state().theremin[1];
    ok('Theremin: X = nota, Y = volume', low && high && high.midi > low.midi && low.vol > high.vol, JSON.stringify({ low, high }));
    ap.release();
    $$('.airx__pick .field')[0].querySelectorAll('.chip')[2].click();
    $('select[aria-label="Escala"]').value = 'blues';
    $('select[aria-label="Escala"]').dispatchEvent(new Event('change'));
    $('input[aria-label="BPM"]').value = '132';
    $('input[aria-label="BPM"]').dispatchEvent(new Event('input'));
    $('.topbar__save').click();
    await sleep(500);
    const apCfg = await window.mmp.store.read('airpads');
    ok('Air Pads: Salvar guarda instrumentos, escala e BPM', apCfg.instruments.join() === 'synth,theremin' && apCfg.scale === 'blues' && apCfg.bpm === 132, JSON.stringify(apCfg));
    const before = (await window.mmp.gallery.list()).length;
    const recBtn = $$('.airx .btn--rec')[0];
    recBtn.click();
    await sleep(500);
    ok('Air Pads: Gravar: Sim', ap.state().recording && recBtn.textContent.includes('Sim'));
    ap.tap(0, 0, -0.5);
    await sleep(700);
    ap.release();
    recBtn.click();
    await sleep(1200);
    const after = await window.mmp.gallery.list();
    const take = after.find((i) => i.module === 'airpads');
    ok('Air Pads: gravação vai para a Galeria como áudio', after.length === before + 1 && take && take.type === 'audio' && take.size > 0, take && `${take.name} · ${take.mime} · ${take.size} B`);
    const apEv = take && take.eventsFile ? (await window.mmp.gallery.readEvents(take.id)).json : null;
    ok('Air Pads: gravação salva também os eventos JSON (nota, tempo, instrumento)', apEv && apEv.kind === 'mmp-events' && apEv.events.length >= 1 && apEv.events.every((e) => Number.isFinite(e.time) && Number.isFinite(e.note) && e.inst === 'synth') && take.meta.notes === apEv.events.length, apEv && JSON.stringify(apEv.events.slice(0, 2)));
    const apAll = ap.events();
    ok('Air Pads: tudo que foi tocado vira evento (piano, bateria, theremin)', apAll && ['piano', 'drums', 'theremin', 'synth'].every((i) => apAll.events.some((e) => e.inst === i)) && apAll.events.some((e) => e.inst === 'drums' && e.note === 36), apAll && `${apAll.events.length} eventos · ${[...new Set(apAll.events.map((e) => e.inst))].join(',')}`);
    {
      const moveMouse = (x, y) =>
        window.dispatchEvent(
          new PointerEvent('pointermove', { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true })
        );
      const assertBead = async (sel, label) => {
        const pad = $(sel);
        const r = pad.getBoundingClientRect();
        const samples = [
          [r.left + r.width / 2, r.top + r.height / 2, 'centro'],
          [r.left + r.width * 0.7, r.top + r.height * 0.38, 'fatia']
        ];
        for (const [x, y, where] of samples) {
          moveMouse(x, y);
          await sleep(80);
          const bead = pad.querySelector('.air-bead');
          const br = bead && bead.getBoundingClientRect();
          const d = br ? Math.hypot(br.left + br.width / 2 - x, br.top + br.height / 2 - y) : 99;
          const i = sel.includes('--0') ? 0 : 1;
          ok(
            `Air Pads: mouse ${where} em ${label} captura e a bolinha segue`,
            ap.state().inside[i] && bead && bead.classList.contains('is-on') && d <= 16,
            `d=${d.toFixed(1)} inside=${JSON.stringify(ap.state().inside)}`
          );
        }
      };
      ap.release();
      await assertBead('.air-circle--0', 'esquerda');
      await assertBead('.air-circle--1', 'direita');
      ap.setArenaSize(true);
      await sleep(200);
      await assertBead('.air-circle--0', 'tela cheia esquerda');
      await assertBead('.air-circle--1', 'tela cheia direita');
      ap.setArenaSize(false);
      moveMouse(0, 0);
      await sleep(80);
    }
    const apSent = ap.events();
    ap.sendToStudio();
    await sleep(900);
    ok('Air Pads: “Editar no Studio” abre o que foi tocado no Studio', location.hash.startsWith('#/studio') && window.__mmpStudio && window.__mmpStudio.state().notes === apSent.events.length && window.__mmpStudio.state().origin.includes('Air Pads'), window.__mmpStudio && JSON.stringify(window.__mmpStudio.state().tracks.map((t) => `${t.name}:${t.inst}:${t.notes}`)));

    await go('beatcats');
    const bc = window.__mmpBeatCats;
    const snd = bc.sounds();
    const count = (g) => snd.filter((x) => x.group === g).length;
    ok('Beat Cats: 28 sons (6 bateria, 5 baixo, 5 acordes, 6 melodia, 6 efeitos)', snd.length === 28 && count('drums') === 6 && count('bass') === 5 && count('chords') === 5 && count('melody') === 6 && count('fx') === 6 && new Set(snd.map((x) => x.outfit)).size === 28, snd.length);
    ok('Beat Cats: 8 gatos vazios no início + lontra na linha', $$('.bc-cat').length === 8 && $$('.bc-cat.is-empty').length === 8 && bc.state().cats.every((c) => c === null) && $('.bc-line .bc-otter'), $$('.bc-cat').length);
    ok('Beat Cats: botão para limpar todos os beats', $$('button').some((b) => /Limpar todos os beats/.test(b.textContent)));
    const looks = $$('.bc-cat svg.creature--cat').map((x) => x.innerHTML.replace(/aria-label="[^"]*"/, ''));
    ok('Beat Cats: 8 gatos com pelagens diferentes do Meu Gato', looks.length === 8 && new Set(looks).size === 8);
    await bc.ready();
    const drag = async (soundId, catIdx, pointerType, fromCat = false) => {
      const src = fromCat ? $$('.bc-cat')[fromCat.index] : $(`.bc-token[data-sound="${soundId}"]`);
      src.scrollIntoView({ block: 'center' });
      const a = src.getBoundingClientRect();
      const opts = (x, y) => ({ bubbles: true, cancelable: true, pointerId: 7, pointerType, isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y });
      src.dispatchEvent(new PointerEvent('pointerdown', opts(a.left + a.width / 2, a.top + a.height / 2)));
      let tx;
      let ty;
      if (catIdx === null) {
        tx = 4;
        ty = 4;
      } else {
        const cat = $$('.bc-cat')[catIdx];
        cat.scrollIntoView({ block: 'center' });
        const b = cat.getBoundingClientRect();
        tx = b.left + b.width / 2;
        ty = b.top + b.height / 2;
      }
      for (let k = 1; k <= 5; k++) window.dispatchEvent(new PointerEvent('pointermove', opts(a.left + ((tx - a.left) * k) / 5, a.top + ((ty - a.top) * k) / 5)));
      await sleep(30);
      const ghost = Boolean($('.bc-ghost'));
      window.dispatchEvent(new PointerEvent('pointerup', { ...opts(tx, ty), buttons: 0 }));
      await sleep(120);
      return ghost;
    };
    const ghostMouse = await drag('bumbo', 0, 'mouse');
    let st = bc.state();
    ok('Beat Cats: arrastar com mouse ativa camada no gato', ghostMouse && st.cats[0] === 'bumbo' && $$('.bc-cat')[0].classList.contains('is-active') && $$('.bc-cat')[0].querySelector('.acc--capacete'), JSON.stringify(st.cats));
    await sleep(400);
    ok('Beat Cats: loop toca sozinho ao vestir o primeiro gato', bc.state().playing && bc.state().step > 0, bc.state().step);
    const ghostTouch = await drag('baixo-pulso', 2, 'touch');
    st = bc.state();
    ok('Beat Cats: arrastar com toque ativa camada', ghostTouch && st.cats[2] === 'baixo-pulso' && $(`.bc-token[data-sound="baixo-pulso"]`).classList.contains('is-used'), JSON.stringify(st.cats));
    bc.assign(1, 'chimbal');
    bc.assign(3, 'pad-neon');
    let sang = false;
    for (let k = 0; k < 30 && !sang; k++) {
      await sleep(40);
      sang = $$('.bc-cat.is-sing').length > 0;
    }
    ok('Beat Cats: gato canta (boca) no ritmo', sang && $('.bc-cat.is-sing .bc-mouth'));
    await drag('baixo-pulso', 5, 'touch', { index: 2 });
    st = bc.state();
    ok('Beat Cats: arrastar acessório de um gato para outro move o som', st.cats[2] === null && st.cats[5] === 'baixo-pulso', JSON.stringify(st.cats));
    await drag('baixo-pulso', null, 'mouse', { index: 5 });
    st = bc.state();
    ok('Beat Cats: arrastar para fora tira o acessório e silencia', st.cats[5] === null && !st.voices[5] && $$('.bc-cat')[5].classList.contains('is-empty'), JSON.stringify(st.cats));
    const catEl = $$('.bc-cat')[3];
    const r3 = catEl.getBoundingClientRect();
    const tap = { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0, clientX: r3.left + 20, clientY: r3.top + 20 };
    catEl.dispatchEvent(new PointerEvent('pointerdown', tap));
    window.dispatchEvent(new PointerEvent('pointerup', tap));
    await sleep(80);
    ok('Beat Cats: tocar no gato ativo tira o acessório', bc.state().cats[3] === null);
    $(`.bc-token[data-sound="arpejo"]`).dispatchEvent(new PointerEvent('pointerdown', { ...tap, clientX: 0, clientY: 0 }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...tap, clientX: 0, clientY: 0 }));
    await sleep(40);
    $$('.bc-cat')[4].click();
    await sleep(80);
    ok('Beat Cats: tocar acessório e depois gato também veste', bc.state().cats[4] === 'arpejo');

    $('.bc-otter').click();
    let splash = false;
    for (let k = 0; k < 40 && !splash; k++) {
      await sleep(40);
      splash = $('.bc-stage').classList.contains('is-splash') && $$('.bc-bubble').length > 0;
    }
    ok('Beat Cats: lontra faz o efeito especial (splash)', splash && $('.bc-otter').classList.contains('is-diving'));

    $('.beatcats input[aria-label="BPM"]').value = '160';
    $('.beatcats input[aria-label="BPM"]').dispatchEvent(new Event('input'));
    bc.setMode('round');
    await sleep(60);
    bc.assign(5, 'melodia-8bit');
    st = bc.state();
    ok('Beat Cats: modo por rodada deixa a camada pendente', st.mode === 'round' && st.cats[5] === null && st.pending[5] === 'melodia-8bit' && $$('.bc-cat')[5].classList.contains('is-pending') && !$('.bc-round').hidden, JSON.stringify(st.pending));
    let applied = false;
    for (let k = 0; k < 60 && !applied; k++) {
      await sleep(100);
      applied = bc.state().cats[5] === 'melodia-8bit';
    }
    ok('Beat Cats: camada entra na próxima rodada', applied && !Object.keys(bc.state().pending).length && bc.state().voices[5], JSON.stringify(bc.state()));

    $('.beatcats input.input').value = 'Gatos de Rodada';
    $('.topbar__save').click();
    await sleep(600);
    const saved = (await window.mmp.gallery.list()).find((i) => i.name === 'Gatos de Rodada');
    const savedJson = saved && (await window.mmp.gallery.read(saved.id)).json;
    ok('Beat Cats: Salvar guarda gatos, BPM e modo', savedJson && savedJson.bpm === 160 && savedJson.mode === 'round' && savedJson.cats.join() === ['bumbo', 'chimbal', null, null, 'arpejo', 'melodia-8bit', null, null].join(), JSON.stringify(savedJson));
    await go(`beatcats?open=${saved.id}`);
    st = window.__mmpBeatCats.state();
    ok('Beat Cats: beat reabre da Galeria igualzinho', st.bpm === 160 && st.mode === 'round' && st.cats[0] === 'bumbo' && st.cats[5] === 'melodia-8bit' && $$('.bc-cat.is-active').length === 4 && $('.beatcats input.input').value === 'Gatos de Rodada', JSON.stringify(st));
    window.__mmpBeatCats.setMode('continuous');

    const recOnce = async (label) => {
      const ids = new Set((await window.mmp.gallery.list()).map((i) => i.id));
      [...$$('.beatcats .segmented__btn')].find((b) => b.textContent === label).click();
      await sleep(50);
      $('.beatcats .btn--rec').click();
      await sleep(400);
      const during = window.__mmpBeatCats.state().recording;
      await sleep(1600);
      $('.beatcats .btn--rec').click();
      for (let k = 0; k < 50; k++) {
        await sleep(100);
        const item = (await window.mmp.gallery.list()).find((i) => !ids.has(i.id));
        if (item) return { item, during };
      }
      return { item: null, during };
    };
    await window.__mmpBeatCats.ready();
    const aud = await recOnce('Só áudio');
    ok('Beat Cats: gravar só áudio vai para a Galeria', aud.during === 'audio' && aud.item && aud.item.type === 'audio' && aud.item.module === 'beatcats' && aud.item.size > 0, aud.item && `${aud.item.name} · ${aud.item.mime} · ${aud.item.size} B`);
    const bcEv = aud.item && aud.item.eventsFile ? (await window.mmp.gallery.readEvents(aud.item.id)).json : null;
    const kicks = bcEv ? bcEv.events.filter((e) => e.track === 'bumbo') : [];
    ok('Beat Cats: gravação salva os eventos de cada gato (bumbo = nota 36 na bateria, no tempo)', bcEv && kicks.length >= 2 && kicks.every((e) => e.note === 36 && e.inst === 'drums') && kicks.every((e) => Math.abs(e.time * 4 - Math.round(e.time * 4)) < 0.2) && bcEv.tracks.some((t) => t.id === 'melodia-8bit' && t.inst === 'chip'), bcEv && `${bcEv.events.length} eventos · bumbo em ${kicks.map((e) => e.time).join(', ')}`);
    const vid = await recOnce('Áudio + animação');
    ok('Beat Cats: gravar áudio + animação vai para a Galeria como vídeo', vid.during === 'video' && vid.item && vid.item.type === 'video' && /webm/.test(vid.item.mime) && vid.item.size > 1000, vid.item && `${vid.item.name} · ${vid.item.mime} · ${vid.item.size} B`);
    [...$$('.beatcats .btn')].find((b) => b.textContent === 'Editar no Studio').click();
    await sleep(900);
    let sst = window.__mmpStudio && window.__mmpStudio.state();
    ok('Beat Cats: “Editar no Studio” leva as camadas como faixas', sst && sst.notes > 10 && sst.tracks.some((t) => t.id === 'bumbo' && t.inst === 'drums') && sst.origin.includes('Beat Cats'), sst && JSON.stringify(sst.tracks.map((t) => `${t.id}:${t.notes}`)));

    await go('cattyping');
    let CT = null;
    for (let i = 0; i < 50 && !window.__mmpCatTyping; i++) await sleep(100);
    CT = window.__mmpCatTyping;
    ok('Cat Typing: módulo carregou o dicionário', CT, CT ? 'ok' : 'sem __mmpCatTyping');
    const ctd = CT && CT.data();
    ok(
      'Cat Typing: 5000+ palavras, 3–10 letras, 4 temas',
      ctd &&
        ctd.words >= 5000 &&
        ctd.minLen === 3 &&
        ctd.maxLen === 10 &&
        ['psicologia', 'arte', 'historia', 'gerais'].every((t) => ctd.themes[t] >= 800) &&
        [3, 4, 5, 6, 7, 8, 9, 10].every((n) => ctd.byLen[n] > 0),
      ctd && JSON.stringify({ words: ctd.words, themes: ctd.themes, byLen: ctd.byLen })
    );
    ok(
      'Cat Typing: nave de costas com orelhas e a roupa do Meu Gato',
      CT &&
        $('.ct-ship__hull') &&
        $$('.ct-ship__gun').length >= 2 &&
        $('.ct-ship__cat svg.creature--cat.creature--rear') &&
        $('.ct-ship__otter svg.creature--otter.creature--rear') &&
        $('.ct-ship__cat .acc--coroa') &&
        $('.ct-ship__otter .acc--astronauta'),
      $$('.ct-ship .acc').map((a) => a.className).join(' | ')
    );
    if (!CT) throw new Error('Cat Typing não montou');
    CT.newGame(1);
    const deckA = CT.deckPreview().join('|');
    CT.newGame(2);
    const deckB = CT.deckPreview().join('|');
    ok('Cat Typing: palavras embaralhadas a cada partida', deckA && deckB && deckA !== deckB, `${deckA} vs ${deckB}`);
    CT.lock(true);
    CT.clear();
    CT.setLevel(1);
    const slow = CT.spawn({ word: 'sol', y: 0.3, vy: undefined });
    CT.clear();
    CT.setLevel(6);
    const fast = CT.spawn({ word: 'planeta', y: 0.3 });
    ok('Cat Typing: velocidade sobe com o nível', slow && fast && fast.vy > slow.vy, slow && fast && `${slow.vy} → ${fast.vy}`);
    CT.setLevel(1);
    CT.clear();
    CT.spawn({ word: 'gato', display: 'GATO', y: 0.4, vy: 0 });
    for (const ch of 'gato') CT.type(ch);
    let cts = CT.state();
    ok(
      'Cat Typing: digitar a palavra atira laser e destrói o asteroide',
      cts.destroyed === 1 && cts.score > 0 && cts.lasers >= 1 && cts.rocks.length === 0 && cts.lastShotAt > 0,
      JSON.stringify(cts)
    );
    CT.clear();
    CT.spawn({ word: 'acao', display: 'AÇÃO', y: 0.35, vy: 0 });
    for (const ch of ['Á', 'c', 'ã', 'O']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
    }
    await sleep(40);
    cts = CT.state();
    ok('Cat Typing: teclado físico ignora acentos', cts.destroyed === 2 && cts.typing === '', cts.typing + ' · ' + cts.destroyed);
    CT.pause();
    ok('Cat Typing: pausa', CT.state().paused && $('.ct-overlay h2') && $('.ct-overlay h2').textContent.includes('Pausa'));
    ok('Cat Typing: não atira pausado', CT.type('x') === false);
    CT.resume();
    ok('Cat Typing: continua depois da pausa', !CT.state().paused);
    CT.lock(true);
    CT.clear();
    CT.spawn({ word: 'pato', display: 'PATO', y: 0.4, vy: 0 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true }));
    cts = CT.state();
    ok('Cat Typing: P escreve a letra e não pausa', !cts.paused && cts.typing === 'p' && cts.lasers >= 1, JSON.stringify({ paused: cts.paused, typing: cts.typing, lasers: cts.lasers }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    ok('Cat Typing: Tab pausa', CT.state().paused && $('.ct-overlay h2') && $('.ct-overlay h2').textContent.includes('Pausa'));
    CT.resume();
    ok('Cat Typing: Esc/Tab continua', !CT.state().paused);
    CT.lock(true);
    const livesBefore = CT.state().lives;
    CT.spawn({ word: 'fim', y: 0.95, vy: 2 });
    CT.tick(1);
    cts = CT.state();
    ok(
      'Cat Typing: asteroide que chega embaixo tira vida e a nave treme',
      cts.lives === livesBefore - 1 && cts.lives >= 0 && $('.ct-ship').classList.contains('is-hit') && $$('.ct-lives i.is-lost').length >= 1,
      `${livesBefore} → ${cts.lives}`
    );
    ok('Cat Typing: dica não fala que P escreve P', !$('.ct-hint').textContent.includes('escreve P'), $('.ct-hint').textContent);
    CT.clear();
    CT.spawn({ word: 'lua', y: 0.3, vy: 0 });
    for (const ch of 'lua') CT.type(ch);
    $('.topbar__save').click();
    await sleep(400);
    const savedCt = await window.mmp.store.read('cattyping');
    ok(
      'Cat Typing: Salvar persiste pontos e recorde',
      savedCt && savedCt.version === 2 && savedCt.game && savedCt.game.destroyed >= 1 && savedCt.best >= savedCt.game.score,
      JSON.stringify(savedCt && { best: savedCt.best, score: savedCt.game && savedCt.game.score, destroyed: savedCt.game && savedCt.game.destroyed })
    );
    CT.pause();
    await go('hub');
    await go('cattyping');
    for (let i = 0; i < 50 && !window.__mmpCatTyping; i++) await sleep(100);
    cts = window.__mmpCatTyping && window.__mmpCatTyping.state();
    ok('Cat Typing: partida em andamento continua ao voltar', cts && !cts.over && cts.destroyed >= 1 && cts.score > 0, cts && JSON.stringify(cts));

    await go('cantar');
    const CG = window.__mmpCantar;
    ok('Cantar: palco com gato no microfone e 3 lontrinhas', $$('.cantar__cat svg.creature--cat').length === 1 && $$('.cantar__otter').length === 3 && $$('.cantar__otter svg.creature--otter').length === 3);
    ok('Cantar: modificadores de voz', CG && ['natural', 'autotune', 'agudo', 'grave', 'robo', 'eco'].every((id) => $$(`.cantar .chip`).some((c) => c.textContent.toLowerCase().includes(id === 'robo' ? 'robô' : id === 'autotune' ? 'autotune' : id === 'agudo' ? 'agudo' : id === 'grave' ? 'grave' : id === 'eco' ? 'eco' : 'natural'))), CG && JSON.stringify(CG.state()));
    CG.setFx('agudo');
    CG.setRms(0.2);
    ok('Cantar: gato abre a boca com volume', $('.cantar__cat svg.creature.is-sing-open') && CG.state().fx === 'agudo');

    ok('Cantar: botão Gravar frase nas 3 lontrinhas', $$('.cantar__otter .btn--primary').length === 3);
    $$('.cantar__otter')[2].querySelector('.btn--primary').click();
    await sleep(250);
    const durDlg = $('.modal');
    const durInput = durDlg && durDlg.querySelector('input[type="range"], input[type="number"]');
    ok(
      'Cantar: Gravar frase abre diálogo de duração',
      durDlg && durInput && /lontrinha 3|gravar frase/i.test(durDlg.textContent),
      durDlg && durDlg.textContent.replace(/\s+/g, ' ').slice(0, 160)
    );
    if (durDlg) {
      const x = durDlg.querySelector('.icon-btn');
      if (x) x.click();
    }
    await sleep(150);
    ok('Cantar: diálogo de duração fecha no cancelar', !$('.modal'));
    if (CG.setOtterClip) {
      await CG.setOtterClip(0, { duration: 0.2, interval: 1, freq: 392 });
      await CG.setOtterClip(1, { duration: 0.2, interval: 2, freq: 494 });
      await CG.setOtterClip(2, { duration: 0.2, interval: 3, freq: 587 });
      await sleep(280);
      const loops = CG.state().otterLoops || [];
      ok(
        'Cantar: 3 lontrinhas loopam em paralelo com intervalos diferentes',
        CG.state().otters === 3 && loops.length === 3 && loops.every((o) => o.hasClip && o.looping) && new Set(loops.map((o) => o.interval)).size === 3,
        JSON.stringify(loops)
      );
      ok(
        'Cantar: intervalo visível no card',
        $$('.cantar__otter-interval-num').length === 3 && $$('.cantar__otter.is-looping').length === 3,
        String($$('.cantar__otter-interval-num').length)
      );
      await CG.setOtterInterval(0, 4);
      ok('Cantar: muda o intervalo da lontrinha', CG.state().otterLoops[0].interval === 4 && CG.state().otterLoops[0].looping, JSON.stringify(CG.state().otterLoops[0]));
      CG.clearOtter(1);
      ok(
        'Cantar: parar uma lontrinha não derruba as outras',
        CG.state().otterLoops[0].looping && !CG.state().otterLoops[1].hasClip && CG.state().otterLoops[2].looping
      );
      CG.setFx('eco');
      ok('Cantar: chips de FX seguem depois do loop', CG.state().fx === 'eco' && $$('.cantar .chip.is-on').some((c) => /eco/i.test(c.textContent)));
      CG.setFx('agudo');
    }

    await go('tetris');
    const TZ = window.__mmpTetris;
    ok('Tetris: tabuleiro e bichinhos', TZ && $('.tz-canvas') && $$('.tz-mascot svg.creature--cat').length && $$('.tz-mascot svg.creature--otter').length);
    TZ.move(-1, 0);
    TZ.rotate();
    ok('Tetris: peça responde ao movimento', TZ.state().piece && TZ.state().piece.id, JSON.stringify(TZ.state().piece));

    await go('corrida');
    const CR = window.__mmpCorrida;
    ok('Corrida: pista com gato no carrinho e lontra na arquibancada', CR && $('.cr-canvas') && $('.cr-car__pilot svg.creature--cat') && $('.cr-fan svg.creature--otter'));
    const x0 = CR.state().x;
    CR.input('arrowleft', true);
    CR.tick(0.4);
    CR.input('arrowleft', false);
    ok('Corrida: seta esquerda desvia', CR.state().x < x0, `${x0} → ${CR.state().x}`);

    /* ---------- Studio ---------- */
    await go('studio?demo=1');
    const S = window.__mmpStudio;
    await S.ready();
    sst = S.state();
    ok('Studio: projeto de exemplo com 4 faixas', sst.tracks.length === 4 && sst.notes > 60 && $$('.st-track').length === 4, `${sst.notes} notas`);
    S.selectTrack('bateria');
    S.setView('steps');
    await sleep(50);
    const kickRow = S.rows().indexOf(36);
    const n0 = S.state().notes;
    const cell = () => $(`.st-cell[data-row="${kickRow}"][data-step="1"]`);
    ok('Step sequencer: grade com as peças da bateria', $$('.st-cell').length === S.rows().length * 64 && kickRow >= 0, `${S.rows().length} fileiras`);
    cell().click();
    await sleep(30);
    const on1 = S.state().notes === n0 + 1 && cell().classList.contains('is-on');
    cell().click();
    await sleep(30);
    ok('Step sequencer: clicar liga e desliga a semicolcheia', on1 && S.state().notes === n0 && !cell().classList.contains('is-on'));
    S.selectTrack('melodia');
    S.setView('roll');
    await sleep(50);
    $('.st-scroll').scrollIntoView({ block: 'center' });
    await sleep(30);
    $('.st-scroll').scrollLeft = 40 * 22;
    $('.st-scroll').scrollTop = 0;
    await sleep(30);
    let lr = $('.st-lanes').getBoundingClientRect();
    const pev = (type, x, y) => {
      const lanes = $('.st-lanes');
      lr = lanes.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: lr.left + x, clientY: lr.top + y };
      const target = type === 'pointerdown' ? document.elementFromPoint(opts.clientX, opts.clientY) : lanes;
      if (type === 'pointerdown') window.__lastHit = `${target && target.className}@${Math.round(x)},${Math.round(y)}`;
      (target && lanes.contains(target) ? target : lanes).dispatchEvent(new PointerEvent(type, opts));
    };
    const melody = () => S.json().events.filter((e) => e.track === 'melodia');
    const m0 = melody().length;
    const rowY = 4 * 16 + 8;
    pev('pointerdown', 53 * 22 + 5, rowY);
    pev('pointermove', 55 * 22 + 5, rowY);
    pev('pointerup', 55 * 22 + 5, rowY);
    await sleep(50);
    const created = melody().find((e) => e.time === 13.25);
    ok('Piano roll: clicar e arrastar cria nota com duração', melody().length === m0 + 1 && created && created.dur >= 0.5 && created.note === S.rows()[4], created && JSON.stringify(created));
    const noteEl = [...$$('.st-note')].find((n) => Math.round(parseFloat(n.style.left) / 22) === 53);
    lr = $('.st-lanes').getBoundingClientRect();
    const nb = noteEl.getBoundingClientRect();
    const nx = nb.left - lr.left + 4;
    pev('pointerdown', nx, rowY);
    pev('pointermove', nx + 2 * 22, rowY + 32);
    pev('pointerup', nx + 2 * 22, rowY + 32);
    await sleep(50);
    const moved = melody().find((e) => e.time === 13.75);
    ok('Piano roll: arrastar move a nota no tempo e na altura', moved && moved.note === S.rows()[6] && !melody().some((e) => e.time === 13.25), moved && JSON.stringify(moved));
    const mEl = [...$$('.st-note')].find((n) => Math.round(parseFloat(n.style.left) / 22) === 55);
    lr = $('.st-lanes').getBoundingClientRect();
    const mb = mEl.getBoundingClientRect();
    pev('pointerdown', mb.right - lr.left - 3, rowY + 32);
    pev('pointermove', mb.right - lr.left - 3 + 4 * 22, rowY + 32);
    pev('pointerup', mb.right - lr.left - 3 + 4 * 22, rowY + 32);
    await sleep(50);
    const resized = melody().find((e) => e.time === 13.75);
    ok('Piano roll: puxar a ponta muda a duração', resized && resized.dur === moved.dur + 1, resized && `${moved.dur} → ${resized.dur} · alvo ${window.__lastHit} · nota ${Math.round(mb.left - lr.left)}-${Math.round(mb.right - lr.left)}`);
    [...$$('.st-note')].find((n) => Math.round(parseFloat(n.style.left) / 22) === 55).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await sleep(50);
    ok('Piano roll: duplo clique apaga', melody().length === m0 && !melody().some((e) => e.time === 13.75));

    const setVal = (sel, v, evn = 'change') => {
      $(sel).value = v;
      $(sel).dispatchEvent(new Event(evn));
    };
    setVal('.st input[aria-label="BPM"]', '140', 'input');
    setVal('.st select[aria-label="Escala"]', 'major');
    setVal('.st select[aria-label="Tônica"]', '2');
    [...$$('.st .btn')].find((b) => b.textContent === 'Encaixar na escala').click();
    await sleep(50);
    const major = [0, 2, 4, 5, 7, 9, 11];
    const melodic = S.json().events.filter((e) => e.inst !== 'drums');
    ok('Studio: muda BPM e escala (notas encaixadas em Ré maior)', S.state().bpm === 140 && window.Tone.Transport.bpm.value > 139 && melodic.every((e) => major.includes((((e.note - 2) % 12) + 12) % 12)), `${S.state().bpm} BPM · ${melodic.length} notas`);
    setVal('.st select[aria-label="Instrumento de Acordes"]', 'pad');
    await sleep(50);
    ok('Studio: troca o instrumento da faixa', S.state().tracks.find((t) => t.id === 'acordes').inst === 'pad' && S.json().events.filter((e) => e.track === 'acordes').every((e) => e.inst === 'pad'));
    $('.st-bar .btn--primary').click();
    await sleep(700);
    ok('Studio: tocar move a agulha no BPM', S.state().playing && S.beat() > 0.5 && !$('.st-playhead').hidden, S.beat().toFixed(2));
    $('.st-bar .btn--primary').click();

    $('.st input[aria-label="Nome do projeto"]').value = 'Projeto Teste';
    $('.st input[aria-label="Nome do projeto"]').dispatchEvent(new Event('input'));
    $('.topbar__save').click();
    await sleep(600);
    const proj = (await window.mmp.gallery.list()).find((i) => i.type === 'project' && i.name === 'Projeto Teste');
    const notesSaved = S.state().notes;
    ok('Studio: Salvar guarda o projeto na Galeria', proj && proj.meta.notes === notesSaved && proj.meta.bpm === 140, proj && JSON.stringify(proj.meta));
    await go('gallery');
    const projCard = $$('.gcard').find((c) => c.textContent.includes('Projeto Teste'));
    ok('Galeria: projeto do Studio aparece com filtro Projetos', projCard && [...$$('.gallery .segmented__btn')].some((b) => b.textContent.startsWith('Projetos')) && $$('.gcard__studio').length >= 2);
    projCard.querySelector('.btn--primary').click();
    await sleep(900);
    sst = window.__mmpStudio.state();
    ok('Studio: reabre da Galeria para continuar editando', location.hash.includes(proj.id) && sst.opened === proj.id && sst.notes === notesSaved && sst.bpm === 140 && sst.scale === 'major' && sst.root === 2 && sst.tracks.find((t) => t.id === 'acordes').inst === 'pad', JSON.stringify({ notes: sst.notes, bpm: sst.bpm }));
    const S2 = window.__mmpStudio;
    S2.addTrack('bells');
    const nGal = (await window.mmp.gallery.list()).length;
    $('.topbar__save').click();
    await sleep(600);
    const reread = await window.mmp.gallery.read(proj.id);
    ok('Studio: Salvar de novo atualiza o mesmo projeto', (await window.mmp.gallery.list()).length === nGal && reread.json.tracks.length === 5);

    setVal('.st select[aria-label="Compassos"]', '1');
    setVal('.st input[aria-label="BPM"]', '200', 'input');
    await S2.ready();
    const wav = await S2.exportWav();
    const wavData = wav && (await window.mmp.gallery.read(wav.id)).data;
    const riff = wavData && String.fromCharCode(...new Uint8Array(wavData.buffer || wavData, 0, 4));
    ok('Studio: exportar WAV (render offline) vai para a Galeria', wav && wav.mime === 'audio/wav' && wav.ext === 'wav' && riff === 'RIFF' && wav.size > 44 + 44100 * 2 * 2, wav && `${wav.name} · ${wav.size} B · ${wav.meta.seconds.toFixed(2)}s`);
    const vid1 = await S2.exportVideo({ webcam: true });
    ok('Studio: exportar vídeo WebM com webcam + canvas + áudio', vid1 && vid1.webcam && vid1.item.type === 'video' && /webm/.test(vid1.item.mime) && vid1.item.size > 2000 && vid1.item.meta.webcam === true, vid1 && `${vid1.item.name} · ${vid1.item.mime} · ${vid1.item.size} B`);
    const gum = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('sem câmera', 'NotFoundError'));
    const vid2 = await S2.exportVideo({ webcam: true }).finally(() => (navigator.mediaDevices.getUserMedia = gum));
    ok('Studio: sem webcam o vídeo sai só com canvas + áudio', vid2 && !vid2.webcam && vid2.note.includes('Webcam indisponível') && vid2.item.size > 2000 && $('.st-export__preview video'), vid2 && `${vid2.item.size} B · ${vid2.note.trim()}`);
    await go(`studio?open=${wav.id}`);
    sst = window.__mmpStudio.state();
    ok('Studio: o WAV exportado reabre com as notas', sst.notes > 0 && sst.origin.includes('Gravação'), `${sst.notes} notas`);
    const demoBeat = (await window.mmp.gallery.list()).find((i) => i.type === 'beat');
    await go(`studio?open=${demoBeat.id}`);
    sst = window.__mmpStudio.state();
    ok('Studio: beat do Beat Cats abre como faixas editáveis', sst.tracks.length >= 3 && sst.tracks.some((t) => t.id === 'bumbo') && sst.notes > 20 && sst.length === 16, `${sst.notes} notas · ${sst.tracks.map((t) => t.id).join(',')}`);

    await go('termo');
    await sleep(400);
    const T = window.__mmpTermo;
    const tw = T.words();
    ok('Termo: listas geradas (1.500+ respostas, 5.000+ aceitas, 4 temas)', tw.answers >= 1500 && tw.valid >= 5000 && ['psicologia', 'arte', 'historia', 'gerais'].every((t) => tw.themes[t] > 50), JSON.stringify(tw));
    ok('Termo: pontuação com letras repetidas', JSON.stringify(T.score('ossos', 'sopas')) === JSON.stringify(['present', 'present', 'absent', 'absent', 'correct']));
    ok('Termo: acentos e maiúsculas não importam', T.isValid('ânimo') && T.isValid('ANIMO') && T.isValid('Época') && T.isValid('epoca') && !T.isValid('zzzzz'));
    let ts = T.state();
    ok('Termo: Simples com 10 tentativas por padrão', ts.settings.mode === 'simples' && ts.game.attempts === 10 && $$('.tm-board').length === 1 && $$('.tm-board .tm-row').length === 10, `${$$('.tm-board .tm-row').length} linhas`);
    const fillers = ['muito', 'fazer', 'sobre', 'mundo', 'gente', 'tempo', 'noite', 'festa', 'falar', 'livro', 'carta', 'nuvem'];
    const wrong = (n) => fillers.filter((w) => !T.answers().includes(w) && T.isValid(w)).slice(0, n);
    T.type('zzzzz');
    T.press('enter');
    ts = T.state();
    ok('Termo: palavra fora da lista balança e não conta', ts.game.guesses.length === 0 && ts.typing === 'zzzzz' && $('.tm-row.is-current.is-shake'));
    for (let i = 0; i < 5; i++) T.press('backspace');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Á', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ç', bubbles: true }));
    ts = T.state();
    ok('Termo: teclado físico normaliza Á e ç', ts.typing === 'ac', ts.typing);
    T.press('backspace');
    T.press('backspace');
    T.press('m');
    T.press('space');
    T.press('u');
    ts = T.state();
    ok(
      'Termo: clique/espaço monta letra no meio da palavra',
      ts.slots && ts.slots[0] === 'm' && ts.slots[1] === '' && ts.slots[2] === 'u' && ts.cursor === 3 && $('.tm-tile.is-cursor'),
      JSON.stringify({ slots: ts.slots, cursor: ts.cursor, typing: ts.typing })
    );
    for (let i = 0; i < 6; i++) T.press('backspace');
    const [w1] = wrong(1);
    T.type(w1);
    $('.tm-key[data-key="enter"]').click();
    await sleep(150);
    ts = T.state();
    const scored = $$('.tm-board .tm-row')[0].querySelectorAll('.tm-tile--correct, .tm-tile--present, .tm-tile--absent').length;
    const flipping = $$('.tm-board .tm-row')[0].querySelectorAll('.tm-tile.is-reveal').length;
    ok('Termo: palpite válido vira verde/amarelo/cinza com animação', ts.game.guesses[0] === w1 && scored === 5 && flipping === 5 && $$('.tm-key.tm-key--absent, .tm-key.tm-key--present, .tm-key.tm-key--correct').length > 0, w1);
    const answer = T.answers()[0];
    T.type(answer);
    T.press('enter');
    await sleep(1100);
    ts = T.state();
    ok('Termo: acertar vence e o gato comemora', ts.game.done && ts.game.won && ts.mood === 'win' && $('.tm-stage[data-mood="win"] .tm-heart') && !$('.tm-result').hidden, answer);
    ok('Termo: estatísticas do Simples', ts.stats.simples.played === 1 && ts.stats.simples.wins === 1 && ts.stats.simples.dist['2'] === 1 && $('.tm-dist__row.is-last'), JSON.stringify(ts.stats.simples));
    const savedTermo = await window.mmp.store.read('termo');
    ok('Termo: estatísticas salvas localmente', savedTermo && savedTermo.stats.simples.wins === 1 && savedTermo.used.includes(answer));

    await T.setMode('dueto');
    T.changeAttempts(-10);
    ts = T.state();
    ok('Termo: Dueto com 2 tabuleiros e tentativas configuráveis', ts.game.answers.length === 2 && ts.game.answers[0].word !== ts.game.answers[1].word && ts.game.attempts === 4 && $$('.tm-board').length === 2 && $$('.tm-board')[0].querySelectorAll('.tm-row').length === 4, `${ts.game.attempts} tentativas`);
    T.type(T.answers()[1]);
    T.press('enter');
    await sleep(150);
    const duetKey = $(`.tm-key[data-key="${wrong(1)[0][0]}"]`);
    ok('Termo: Dueto resolve um tabuleiro por vez', T.state().game.solvedAt[1] === 0 && T.state().game.solvedAt[0] === null && $$('.tm-board')[1].classList.contains('is-solved'));
    for (const w of wrong(3)) {
      T.type(w);
      T.press('enter');
    }
    await sleep(1100);
    ts = T.state();
    const tear = $('.tm-tear');
    ok('Termo: perder mostra as palavras e o gato chora', ts.game.done && !ts.game.won && ts.mood === 'lose' && tear && getComputedStyle(tear).display === 'block' && $$('.tm-answer').length === 2, ts.game.answers.map((a) => a.display).join(','));
    ok('Termo: derrota zera a sequência do Dueto', ts.stats.dueto.played === 1 && ts.stats.dueto.losses === 1 && ts.stats.dueto.streak === 0 && ts.stats.simples.streak === 1);
    ok('Termo: teclado do Dueto pinta cada metade', duetKey && /linear-gradient/.test(duetKey.getAttribute('style') || ''));

    await T.setMode('quarteto');
    T.changeAttempts(6);
    ts = T.state();
    ok('Termo: Quarteto com 4 tabuleiros', ts.game.answers.length === 4 && new Set(ts.game.answers.map((a) => a.word)).size === 4 && $$('.tm-board').length === 4 && ts.game.attempts === 10, `${ts.game.attempts} tentativas`);
    const seen = new Set(T.state().used);
    let repeats = 0;
    for (let i = 0; i < 25; i++) {
      T.newGame();
      T.answers().forEach((w) => {
        if (seen.has(w)) repeats++;
        seen.add(w);
      });
    }
    ok('Termo: sorteio sem repetição', repeats === 0 && T.state().used.length === seen.size, `${seen.size} palavras sorteadas, ${repeats} repetidas`);
    await T.setMode('simples');
    T.newGame();
    T.type(wrong(1)[0]);
    T.press('enter');
    await go('hub');
    await go('termo');
    await sleep(400);
    ts = window.__mmpTermo.state();
    ok('Termo: partida em andamento continua ao voltar', ts.settings.mode === 'simples' && ts.game.guesses.length === 1 && !ts.game.done && $$('.tm-board .tm-row')[0].querySelectorAll('.tm-tile--absent, .tm-tile--present, .tm-tile--correct').length === 5);

    await go('conexoes');
    await sleep(500);
    const C = window.__mmpConexoes;
    const cd = C.data();
    ok(
      'Conexões: 400+ categorias, 5 temas, 8–12 palavras',
      cd.categories >= 400 &&
        cd.wordsMin >= 8 &&
        cd.wordsMax <= 12 &&
        ['psicologia', 'arte', 'historia', 'musica', 'gerais'].every((t) => cd.themes[t] >= 50),
      JSON.stringify(cd)
    );
    ok('Conexões: milhares de combinações válidas', cd.combos >= 1000, String(cd.combos));
    let disjointOk = 0;
    for (let i = 0; i < 24; i++) {
      const p = C.generate(1000 + i);
      if (!p || p.groups.length !== 4) continue;
      const keys = p.groups.flatMap((g) =>
        g.words.map((w) =>
          w
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9]/g, '')
            .toUpperCase()
        )
      );
      if (keys.length === 16 && new Set(keys).size === 16) disjointOk++;
    }
    ok('Conexões: gerador sem palavras ambíguas entre as 4 categorias', disjointOk === 24, `${disjointOk}/24`);
    C.newGame();
    let cs = C.state();
    ok('Conexões: 16 cartas e 4 erros', $$('.cn-tile').length === 16 && $$('.cn-pip').length === 4 && !cs.game.done, `${$$('.cn-tile').length} cartas`);
    ok('Conexões: gato e lontra no palco', $$('.cn-stage svg.creature--cat').length && $$('.cn-stage svg.creature--otter').length);
    const g0 = cs.game.groups[0];
    g0.words.forEach((w) => C.select(w));
    ok('Conexões: seleciona até 4', C.state().selected.length === 4);
    C.submit();
    await sleep(80);
    cs = C.state();
    ok(
      'Conexões: acerto revela categoria e cor',
      cs.game.solved[0] === g0.id && $(`.cn-group[data-color="${g0.color}"]`) && $('.cn-group b').textContent === g0.title && cs.mood === 'yay',
      $('.cn-group') && $('.cn-group').textContent
    );
    const cnBefore = $$('.cn-tile').map((t) => t.textContent).join('|');
    let cnAfter = cnBefore;
    for (let i = 0; i < 10 && cnAfter === cnBefore; i++) {
      C.shuffle();
      cnAfter = $$('.cn-tile').map((t) => t.textContent).join('|');
    }
    ok('Conexões: embaralhar muda a ordem, não as palavras', cnBefore !== cnAfter && cnBefore.split('|').sort().join() === cnAfter.split('|').sort().join());
    C.hint();
    cs = C.state();
    ok('Conexões: dica marca 2 palavras do mesmo grupo', cs.game.hintUsed && cs.game.hinted.length === 2 && $$('.cn-tile.is-hint').length === 2, JSON.stringify(cs.game.hinted));
    for (const g of C.state().game.groups) {
      if (C.state().game.solved.includes(g.id)) continue;
      C.clear();
      g.words.forEach((w) => C.select(w));
      C.submit();
    }
    await sleep(400);
    cs = C.state();
    ok('Conexões: vitória e o gato comemora', cs.game.done && cs.game.won && cs.mood === 'win' && $('.cn-stage[data-mood="win"] .cn-heart') && !$('.cn-result').hidden);
    ok('Conexões: recorde local', cs.stats.played === 1 && cs.stats.wins === 1 && cs.stats.streak === 1 && cs.history[0].won, JSON.stringify(cs.stats));
    C.newGame();
    C.state().game.groups.forEach((g) => C.select(g.words[0]));
    for (let i = 0; i < 4; i++) C.submit();
    await sleep(400);
    cs = C.state();
    const cnTear = $('.cn-tear');
    ok('Conexões: 4 erros = derrota e o gato chora', cs.game.done && !cs.game.won && cs.mood === 'lose' && cnTear && getComputedStyle(cnTear).display === 'block' && $$('.cn-group').length === 4);
    C.newGame();
    C.state().game.groups[0].words.forEach((w) => C.select(w));
    C.submit();
    await go('hub');
    await go('conexoes');
    await sleep(400);
    cs = window.__mmpConexoes.state();
    ok('Conexões: partida em andamento continua ao voltar', !cs.game.done && cs.game.solved.length === 1);
    $('.topbar__save').click();
    await sleep(400);
    const savedConn = await window.mmp.store.read('conexoes');
    ok('Conexões: Salvar persiste a partida', savedConn && savedConn.game.solved.length === 1 && savedConn.stats.wins === 1);

    const base = new URL('vendor/mediapipe/', location.href).href;
    const vision = await import(`${base}vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${base}wasm`);
    const hl = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${base}models/hand_landmarker.task`, delegate: 'CPU' },
      runningMode: 'IMAGE',
      numHands: 1
    });
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const res = hl.detect(canvas);
    ok('MediaPipe HandLandmarker local (wasm + modelo)', Array.isArray(res.landmarks), `mãos: ${res.landmarks.length}`);
    hl.close();
  } catch (err) {
    ok('exceção', false, err && err.stack ? err.stack : err);
  }
  ok('sem erros não tratados no renderer', !(window.__mmpErrors || []).length, (window.__mmpErrors || []).join(' | '));
  return JSON.stringify(results);
})();
