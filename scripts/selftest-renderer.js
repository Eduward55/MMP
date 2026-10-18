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

    for (const r of ['airpads', 'beatcats', 'studio', 'gallery', 'termo', 'conexoes', 'cattyping', 'mycat']) {
      await go(r);
      const bar = $('.topbar');
      const hasAll = bar && bar.querySelector('.topbar__back') && bar.querySelector('.topbar__save') && bar.querySelector('a[href="#/gallery"]');
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
    ok('renomear + ler beat', read.item.name === 'Ronron Funk' && read.json.version === 2 && read.json.cats.length === 6, read.item.name);

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
    $$('.outfit').find((c) => c.textContent.includes('Astronauta')).click();
    $('.topbar__save').click();
    await sleep(700);
    const prof = await window.mmp.store.read('profile');
    ok('Meu Gato salva perfil em JSON', prof.cat.name === 'Bolinha' && prof.cat.coat === 'tuxedo' && prof.cat.outfit.head === 'coroa' && prof.otter.outfit.body === 'astronauta', JSON.stringify(prof));

    await go('hub');
    ok('Hub reflete o gato salvo', $('.hub__greeting').textContent.includes('Bolinha') && $('.acc--coroa') && $('.acc--batuta'));

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
    ok('Air Pads: 2 círculos + HUD + gato maestro', $$('.air-circle').length === 2 && $$('.air-hud').length === 2 && $('.air-maestro svg.creature--cat .acc--batuta'));
    ok('Air Pads: HUD mostra os instrumentos', $('.air-hud--0').textContent.includes('Piano') && $('.air-hud--1').textContent.includes('Bateria'), $$('.air-hud').map((h) => h.textContent).join(' | '));
    await ap.ready();
    ap.tap(0, 0, -0.9);
    await sleep(150);
    let s = ap.state();
    ok('Air Pads: dedo entra no círculo da esquerda e toca piano', s.hits[0] === 1 && s.inside[0] && /^[A-G]#?\d$/.test(s.labels[0]), JSON.stringify(s.labels));
    ap.tap(1, 0, 0.8);
    await sleep(150);
    s = ap.state();
    ok('Air Pads: círculo da direita toca bateria (zona do bumbo)', s.hits[1] === 1 && s.labels[1] === 'Bumbo', s.labels[1]);
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

    await go('beatcats');
    const bc = window.__mmpBeatCats;
    const snd = bc.sounds();
    const count = (g) => snd.filter((x) => x.group === g).length;
    ok('Beat Cats: 24 sons (6 bateria, 5 baixo, 5 acordes, 4 melodia, 4 efeitos)', snd.length === 24 && count('drums') === 6 && count('bass') === 5 && count('chords') === 5 && count('melody') === 4 && count('fx') === 4 && new Set(snd.map((x) => x.outfit)).size === 24, snd.length);
    ok('Beat Cats: 6 gatos vazios no início', $$('.bc-cat').length === 6 && $$('.bc-cat.is-empty').length === 6 && bc.state().cats.every((c) => c === null));
    const looks = $$('.bc-cat svg.creature--cat').map((x) => x.innerHTML.replace(/aria-label="[^"]*"/, ''));
    ok('Beat Cats: 6 gatos com pelagens diferentes do Meu Gato', looks.length === 6 && new Set(looks).size === 6);
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
    ok('Beat Cats: Salvar guarda gatos, BPM e modo', savedJson && savedJson.bpm === 160 && savedJson.mode === 'round' && savedJson.cats.join() === ['bumbo', 'chimbal', null, null, 'arpejo', 'melodia-8bit'].join(), JSON.stringify(savedJson));
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
    const vid = await recOnce('Áudio + animação');
    ok('Beat Cats: gravar áudio + animação vai para a Galeria como vídeo', vid.during === 'video' && vid.item && vid.item.type === 'video' && /webm/.test(vid.item.mime) && vid.item.size > 1000, vid.item && `${vid.item.name} · ${vid.item.mime} · ${vid.item.size} B`);

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
