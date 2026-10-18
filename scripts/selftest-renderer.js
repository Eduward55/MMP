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
    ok('renomear + ler beat', read.item.name === 'Ronron Funk' && read.json.tracks.kick.length === 16, read.item.name);

    await go(`beatcats?open=${beat.id}`);
    ok('abrir beat da Galeria no Beat Cats', $('.beatcats input.input').value === 'Ronron Funk');

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
