# My Music Place (MMP)

App desktop musical, fofo e **100% offline**, feito com **Electron + HTML/JS/CSS puro** (sem frameworks de UI, sem bundler). Tema escuro roxo e rosa neon, tudo em pixel art desenhada pelo próprio código, com um **gato maestro** e sua **lontra companheira** presentes em todos os módulos.

## Como rodar

Requisitos: Node.js 18+ (testado com Node 22).

```bash
npm install
npm start
```

Pronto. Tone.js, MediaPipe (wasm + modelo) e as fontes já estão versionados em `/vendor` e `/assets`, então o app funciona sem internet.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run start:local-data` | Roda salvando os dados em `./data/user` em vez do `userData` do Electron |
| `npm run check` | Autoteste ponta a ponta dentro do Electron (Galeria, Meu Gato, Air Pads, Beat Cats, eventos, Studio com export WAV/WebM e webcam falsa, MediaPipe local, rede bloqueada) |
| `npm run screenshots` | Gera PNGs do Hub, Meu Gato e Galeria em `out/screenshots/` |
| `npm run vendor` | Recria `/vendor` a partir de `node_modules` (e baixa o modelo do MediaPipe se faltar) |

Em Linux sem tela (CI/servidor), use o `xvfb`: `xvfb-run -a npm run check`.

## O que tem

- **Hub** — gato maestro animado (capa + batuta regendo), lontra dançando, notas flutuando e os cards dos módulos.
- **Meu Gato** — nome do gato e da lontra, 6 pelagens (tigresa, preto, frajola, branco, laranja, cinza), cor dos olhos (6 prontas + seletor livre) e **20 roupinhas/acessórios** que servem no gato e na lontra: astronauta, maid, suéter listrado, capa de maestro, cachecol, gravata borboleta, coleira com sininho, óculos redondos, óculos de coração, estrelinha, lacinho, florzinha, capacete espacial, chapéu de bruxa, coroa, fone de ouvido, chapéu de festa, boina, batuta e microfone. Um item por lugar (cabeça, orelha, rosto, pescoço, corpo, costas, patinha).
- **Galeria** — lista áudios, vídeos, beats e projetos do Studio, com filtro, busca, ordenação e ações de **abrir, renomear, exportar e apagar**. Itens que têm notas (gravações dos módulos, beats, projetos) ganham o botão **No Studio**.
- **Beat Cats** — beatbox em grupo com 6 gatos em pixel art (o seu gato + as outras 5 pelagens do Meu Gato), vazios no início. Arraste (mouse ou toque) um dos 24 acessórios sonoros sintetizados com Tone.js (6 bateria, 5 baixo, 5 acordes, 4 melodia, 4 efeitos) para um gato: ele entra no loop sincronizado no BPM, canta e dança. Arrastar para fora ou tocar no gato silencia. Modo contínuo (entra na hora) ou por rodada (entra na próxima rodada de 2 compassos). A lontra faz um *splash* especial (tecla O). Grava só áudio ou áudio + animação (vídeo webm) direto na Galeria; Salvar guarda gatos/camadas/BPM/modo e o beat reabre da Galeria.
- **Studio** — edita as notas tocadas nos módulos: **piano roll** (clicar cria, arrastar move, puxar a ponta estica, duplo clique apaga; fileiras fora da escala ficam escuras) e **step sequencer** (grade de semicolcheias com as notas da escala ou as peças da bateria). Muda BPM, escala/tônica (com “Encaixar na escala”), tamanho em compassos e o instrumento de cada faixa (11 instrumentos), quantiza, silencia faixas e grava pelo teclado do computador. **Exportar WAV** renderiza offline; **Exportar vídeo WebM** grava um canvas animado (linha do tempo, gato e lontra) + webcam opcional + áudio — sem webcam, sai só canvas + áudio. Tudo vai para a Galeria; **Salvar** guarda o projeto, que reabre da Galeria para continuar editando.
- **Air Pads** — MediaPipe Hand Landmarker local (2 mãos) com vídeo espelhado e **dois círculos grandes, um por mão**, cada um com seu instrumento: piano, bateria, synth, baixo ou theremin (X = nota, Y = volume). Quando a ponta do indicador entra no círculo, toca; a altura dentro do círculo escolhe a nota (na bateria: chimbal, caixa ou bumbo) e, segurando o dedo lá dentro, o som repete no BPM. O HUD mostra o instrumento de cada círculo e o seu gato (do Meu Gato) rege com a batuta apontando para o círculo tocado. Tem escala e tônica, BPM, metrônomo, efeitos visuais e **Gravar: Sim/Não** (a gravação vai para a Galeria como áudio). **Salvar** guarda a configuração (instrumentos, escala, tônica, BPM). Sem câmera: o mouse vale como ponta do dedo, as teclas **A** e **L** “encostam” nos círculos e **Simular dedos** move duas pontas virtuais sozinhas.
- **Termo** — adivinhe a palavra musical/felina de 5 letras.
- **Conexões** — agrupe 16 palavras em 4 grupos.
- **Cat Typing** — digite frases fofas; cada acerto toca uma nota; salva recordes.

Todo módulo tem a mesma barra superior: **◀ Hub**, **Salvar** (também `Ctrl+S`) e **Galeria**.

### Eventos: tudo que é tocado vira JSON

Air Pads, Beat Cats e Cat Typing registram cada nota em `modules/shared/events.js` (formato `mmp-events`):

```json
{ "kind": "mmp-events", "version": 1, "source": "airpads", "bpm": 96, "scale": "penta", "root": 0, "length": 8,
  "tracks": [{ "id": "circulo-1-piano", "name": "Mão esquerda · Piano", "inst": "piano" }],
  "events": [{ "time": 0.5, "dur": 0.5, "note": 64, "vel": 0.85, "inst": "piano", "track": "circulo-1-piano" }] }
```

`time` e `dur` em batidas; `note` em MIDI (na bateria, General MIDI: 36 bumbo, 38 caixa, 42 chimbal…). As gravações de áudio/vídeo dos módulos salvam os eventos num arquivo ao lado (`gallery/<id>.events.json`), então abrem no Studio. O botão **Editar no Studio** (Air Pads, Beat Cats) e **Melodia no Studio** (Cat Typing) leva tudo que foi tocado na sessão direto para o editor. No Beat Cats os 24 sons são capturados por um “grampo” nos sintetizadores do Tone.js, e um beat salvo vira faixas editáveis.

## Onde os dados ficam

Tudo é JSON local, gravado pelo processo principal via IPC:

```
<userData>/mmp-data/
  store/profile.json      ← gato + lontra (Meu Gato)
  store/<modulo>.json     ← configuração do Air Pads, progresso de Termo, Conexões, Cat Typing, preferências da Galeria
  gallery.json            ← índice da Galeria
  gallery/<id>.json|webm|wav  ← os arquivos de cada criação
  gallery/<id>.events.json    ← notas (nota, tempo, instrumento) de uma gravação
```

`<userData>` é, por exemplo, `~/.config/My Music Place` no Linux, `%APPDATA%\My Music Place` no Windows e `~/Library/Application Support/My Music Place` no macOS. O caminho exato aparece no rodapé do Hub. Dá para trocar com a variável `MMP_DATA_DIR` ou com `npm run start:local-data`.

No primeiro uso a Galeria ganha dois exemplos (um beat e um áudio).

## Estrutura

```
main.js              processo principal: janela, protocolo mmp:// local, IPC de store/galeria, bloqueio de rede
preload.js           ponte segura (contextIsolation) → window.mmp
index.html           casca do app
modules/
  app.js             roteador por hash (#/modulo)
  shared/            infraestrutura compartilhada
    pixel.js         motor de pixel art (grade → SVG)
    creatures.js     gato e lontra procedurais, pelagens, olhos
    outfits.js       os 20 acessórios
    companion.js     componente gato+lontra (Hub, Meu Gato e dock em todo módulo)
    topbar.js        barra superior padrão
    store.js         persistência (perfil, chave/valor, Galeria)
    audio.js         kit de sons Tone.js + gravação da saída
    events.js        captura de eventos (nota, tempo, instrumento), passagem para o Studio
    instruments.js   escalas e os 11 instrumentos do Studio (tocam ao vivo e no render offline)
    wav.js           AudioBuffer → WAV
    ui.js, icons.js  toasts, modais, ícones pixel
  hub/ mycat/ gallery/ beatcats/ studio/ airpads/ termo/ conexoes/ cattyping/
assets/              CSS e fontes pixel (Press Start 2P e VT323, licença OFL)
data/                padrões versionados (defaults/) e exemplos (demo/)
vendor/              Tone.js e MediaPipe locais (ver vendor/README.md)
scripts/             autoteste, screenshots, setup do vendor
```

## Offline de verdade

- Os arquivos são servidos por um protocolo próprio (`mmp://app/…`) direto da pasta do app.
- O processo principal **bloqueia qualquer requisição http(s)/ws(s)**; o `npm run check` falha se alguma acontecer.
- A CSP do `index.html` só permite recursos do próprio app (`'self'`, `blob:` e `data:`).
