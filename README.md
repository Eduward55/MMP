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
| `npm run check` | Autoteste ponta a ponta dentro do Electron (Galeria, Meu Gato, Beat Cats, MediaPipe local, rede bloqueada) |
| `npm run screenshots` | Gera PNGs do Hub, Meu Gato e Galeria em `out/screenshots/` |
| `npm run vendor` | Recria `/vendor` a partir de `node_modules` (e baixa o modelo do MediaPipe se faltar) |

Em Linux sem tela (CI/servidor), use o `xvfb`: `xvfb-run -a npm run check`.

## O que tem

- **Hub** — gato maestro animado (capa + batuta regendo), lontra dançando, notas flutuando e os cards dos módulos.
- **Meu Gato** — nome do gato e da lontra, 6 pelagens (tigresa, preto, frajola, branco, laranja, cinza), cor dos olhos (6 prontas + seletor livre) e **20 roupinhas/acessórios** que servem no gato e na lontra: astronauta, maid, suéter listrado, capa de maestro, cachecol, gravata borboleta, coleira com sininho, óculos redondos, óculos de coração, estrelinha, lacinho, florzinha, capacete espacial, chapéu de bruxa, coroa, fone de ouvido, chapéu de festa, boina, batuta e microfone. Um item por lugar (cabeça, orelha, rosto, pescoço, corpo, costas, patinha).
- **Galeria** — lista áudios, vídeos e beats salvos, com filtro, busca, ordenação e ações de **abrir, renomear, exportar e apagar**.
- **Beat Cats** — sequenciador de 16 passos com 4 gatos (bumbo, caixa, chimbal, miau), BPM, aleatório; salva o beat na Galeria e também grava 2 compassos como áudio.
- **Studio** — teclado sintetizador (mouse ou teclado do computador), microfone e câmera; grava e salva áudio/vídeo na Galeria.
- **Air Pads** — MediaPipe Hand Landmarker local (2 mãos) com vídeo espelhado e **dois círculos grandes, um por mão**, cada um com seu instrumento: piano, bateria, synth, baixo ou theremin (X = nota, Y = volume). Quando a ponta do indicador entra no círculo, toca; a altura dentro do círculo escolhe a nota (na bateria: chimbal, caixa ou bumbo) e, segurando o dedo lá dentro, o som repete no BPM. O HUD mostra o instrumento de cada círculo e o seu gato (do Meu Gato) rege com a batuta apontando para o círculo tocado. Tem escala e tônica, BPM, metrônomo, efeitos visuais e **Gravar: Sim/Não** (a gravação vai para a Galeria como áudio). **Salvar** guarda a configuração (instrumentos, escala, tônica, BPM). Sem câmera: o mouse vale como ponta do dedo, as teclas **A** e **L** “encostam” nos círculos e **Simular dedos** move duas pontas virtuais sozinhas.
- **Termo** — adivinhe a palavra musical/felina de 5 letras.
- **Conexões** — agrupe 16 palavras em 4 grupos.
- **Cat Typing** — digite frases fofas; cada acerto toca uma nota; salva recordes.

Todo módulo tem a mesma barra superior: **◀ Hub**, **Salvar** (também `Ctrl+S`) e **Galeria**.

## Onde os dados ficam

Tudo é JSON local, gravado pelo processo principal via IPC:

```
<userData>/mmp-data/
  store/profile.json      ← gato + lontra (Meu Gato)
  store/<modulo>.json     ← configuração do Air Pads, progresso de Termo, Conexões, Cat Typing, preferências da Galeria
  gallery.json            ← índice da Galeria
  gallery/<id>.json|webm|wav  ← os arquivos de cada criação
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
