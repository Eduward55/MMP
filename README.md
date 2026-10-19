# My Music Place (MMP)

App desktop musical, fofo e **100% offline**, feito com **Electron + HTML/JS/CSS puro** (sem frameworks de UI, sem bundler). Tema minimalista escuro (fundo `#0f0f12`, roxo `#8b5cf6` só em bordas finas, títulos e o botão principal). Os gatos em pixel art continuam; as cores ficam em `assets/css/theme.css`. Um **gato maestro** e sua **lontra companheira** aparecem em todos os módulos.

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
| `npm run check` | Autoteste ponta a ponta dentro do Electron (Galeria, Meu Gato, Air Pads, Beat Cats, eventos, Studio com export WAV/WebM e webcam falsa, Termo, Conexões, Cat Typing, MediaPipe local, rede bloqueada) |
| `npm run screenshots` | Gera PNGs do Hub, Meu Gato e Galeria em `out/screenshots/` |
| `npm run termo:words` | Regera `data/termo/answers.json` e `valid.json` a partir de dicionários Hunspell e da lista de frequência (ver `data/termo/README.md`) |
| `npm run conexoes:check` | Valida `data/conexoes/categories.json` (400+ categorias, 8–12 palavras, gerador sem sobreposição) e conta as combinações válidas |
| `npm run cattyping:words` | Regenera `data/cattyping/words.json` (5.000+ palavras reais de 3–10 letras; cada tema com 800+) a partir do Hunspell pt-BR, com termos históricos comuns mesmo fora da frequência |
| `npm run vendor` | Recria `/vendor` a partir de `node_modules` (e baixa o modelo do MediaPipe se faltar) |
| `npm run icon` | Gera `build/icon.png` e `build/icon.ico` (gato pixel) |
| `npm run dist:win` | Instalador Windows `.exe` (NSIS) via electron-builder |
| `npm run dist:mac` | Disco macOS `.dmg` via electron-builder (precisa rodar no macOS) |

Em Linux sem tela (CI/servidor), use o `xvfb`: `xvfb-run -a npm run check`.

## Pacote desktop (.exe e .dmg)

O app se chama **My Music Place**, usa o **ícone do gato** em `build/icon.png` e pede **permissão de câmera** (Air Pads e webcam do Studio). No macOS isso vai no `Info.plist` (`NSCameraUsageDescription`) e nos entitlements; no Windows o Chromium pergunta na hora, e o processo principal autoriza `camera` / `media`.

```bash
npm run dist:win   # MyMusicPlace-0.1.0-win-x64-Setup.exe
npm run dist:mac   # MyMusicPlace-0.1.0-mac-universal.dmg  (só no macOS)
```

Os artefatos saem em `dist/`. O instalador Windows cria atalho “My Music Place”; o DMG monta com o mesmo nome.

### Release no GitHub (repo privado)

A Action `.github/workflows/release.yml` empacota Windows e macOS e anexa o `.exe` e o `.dmg` num Release quando você publica uma tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

O repositório precisa ser **privado** no GitHub (a Action usa `GITHUB_TOKEN` com `contents: write`). Sem certificado Apple o DMG sai sem notarização; o .exe NSIS também é sem assinatura de código.

## O que tem

- **Hub** — gato maestro animado (capa + batuta regendo), lontra dançando e os cards dos módulos (borda roxa fina, bastante espaço).
- **Meu Gato** — nome do gato e da lontra, 6 pelagens (tigresa, preto, frajola, branco, laranja, cinza), cor dos olhos (6 prontas + seletor livre) e **20 roupinhas/acessórios** que servem no gato e na lontra: astronauta, maid, suéter listrado, capa de maestro, cachecol, gravata borboleta, coleira com sininho, óculos redondos, óculos de coração, estrelinha, lacinho, florzinha, capacete espacial, chapéu de bruxa, coroa, fone de ouvido, chapéu de festa, boina, batuta e microfone. Um item por lugar (cabeça, orelha, rosto, pescoço, corpo, costas, patinha).
- **Galeria** — lista áudios, vídeos, beats e projetos do Studio, com filtro, busca, ordenação e ações de **abrir, renomear, exportar e apagar**. Itens que têm notas (gravações dos módulos, beats, projetos) ganham o botão **No Studio**.
- **Beat Cats** — beatbox em grupo com 6 gatos em pixel art (o seu gato + as outras 5 pelagens do Meu Gato), vazios no início. Arraste (mouse ou toque) um dos 24 acessórios sonoros sintetizados com Tone.js (6 bateria, 5 baixo, 5 acordes, 4 melodia, 4 efeitos) para um gato: ele entra no loop sincronizado no BPM, canta e dança. Arrastar para fora ou tocar no gato silencia. Modo contínuo (entra na hora) ou por rodada (entra na próxima rodada de 2 compassos). A lontra faz um *splash* especial (tecla O). Grava só áudio ou áudio + animação (vídeo webm) direto na Galeria; Salvar guarda gatos/camadas/BPM/modo e o beat reabre da Galeria.
- **Studio** — edita as notas tocadas nos módulos: **piano roll** (clicar cria, arrastar move, puxar a ponta estica, duplo clique apaga; fileiras fora da escala ficam escuras) e **step sequencer** (grade de semicolcheias com as notas da escala ou as peças da bateria). Muda BPM, escala/tônica (com “Encaixar na escala”), tamanho em compassos e o instrumento de cada faixa (11 instrumentos), quantiza, silencia faixas e grava pelo teclado do computador. **Exportar WAV** renderiza offline; **Exportar vídeo WebM** grava um canvas animado (linha do tempo, gato e lontra) + webcam opcional + áudio — sem webcam, sai só canvas + áudio. Tudo vai para a Galeria; **Salvar** guarda o projeto, que reabre da Galeria para continuar editando.
- **Air Pads** — MediaPipe Hand Landmarker local (2 mãos) com vídeo espelhado e **dois círculos grandes, um por mão**, cada um com seu instrumento: piano, bateria, synth, baixo ou theremin (X = nota, Y = volume). Quando a ponta do indicador entra no círculo, toca; a altura dentro do círculo escolhe a nota (na bateria: chimbal, caixa ou bumbo) e, segurando o dedo lá dentro, o som repete no BPM. O HUD mostra o instrumento de cada círculo e o seu gato (do Meu Gato) rege com a batuta apontando para o círculo tocado. Tem escala e tônica, BPM, metrônomo, efeitos visuais e **Gravar: Sim/Não** (a gravação vai para a Galeria como áudio). **Salvar** guarda a configuração (instrumentos, escala, tônica, BPM). Sem câmera: o mouse vale como ponta do dedo, as teclas **A** e **L** “encostam” nos círculos e **Simular dedos** move duas pontas virtuais sozinhas.
- **Termo** — palavras de 5 letras em português, **ignorando acentos** (digite `acao` ou `ação`, tanto faz; o teclado físico normaliza Á, Ç…). Modos **Simples** (1 tabuleiro), **Dueto** (2) e **Quarteto** (4), todos com **10 tentativas** por padrão (configurável de 4 a 15). Escolha o tema: psicologia, arte, história, gerais ou todos. Cores verde/amarelo/cinza com letras repetidas tratadas certinho; nos modos com vários tabuleiros cada tecla é pintada por pedaço (metades ou quadrantes). Animações de digitar, virar, balançar (palavra fora da lista) e pular ao acertar. O sorteio **não repete palavras** até esgotar o tema. Estatísticas locais por modo (jogos, % de vitórias, sequência, recorde, distribuição de tentativas), partida em andamento continua de onde parou, e o seu gato **comemora** (pulos, corações, confete) ou **chora** (lágrimas) no fim. Ao terminar aparece a forma acentuada (ÂNIMO, ÉPOCA).
- **Conexões** — jogo de 16 palavras em **4 grupos de 4**, no espírito do Connections. O tabuleiro é gerado na hora a partir de **400+ categorias** reais (`data/conexoes/categories.json`: psicologia, arte, história, música e gerais, 8 a 12 palavras cada). O gerador escolhe 4 categorias **sem palavras ambíguas** (uma palavra não pode pertencer a duas das quatro) e pega 4 palavras de cada; isso dá **centenas de milhões** de combinações. Você seleciona 4 e manda **Enviar**: acertou, o grupo revela a categoria e a cor (amarelo/verde/azul/roxo, do mais direto ao mais obscuro); **4 erros e perde**. Tem **embaralhar**, **dica** (ilumina duas palavras do grupo mais fácil que resta), **histórico** e **recorde local** (vitórias, sequência, menos erros). O gato e a lontra do Meu Gato reagem a acerto, erro, vitória e derrota. **Salvar** guarda a partida em andamento.
- **Cat Typing** — o gato espacial (com a pelagem e as roupas atuais do Meu Gato) fica embaixo da tela e a lontra vai de copiloto. Asteroides descem com palavras de 3 a 10 letras; você digita a palavra no teclado físico (acentos não importam) e o gato atira um laser 8-bit. Velocidade sobe a cada nível, há 3 vidas, pontos, pausa (Espaço ou P) e recorde local. A lista tem **5.000+ palavras reais** de psicologia, arte, história e gerais (**800+ em cada tema**, `data/cattyping/words.json`), embaralhadas a cada partida. **Salvar** guarda a missão em andamento e o recorde.

Todo módulo tem a mesma barra superior: **◀ Hub**, **Salvar** (também `Ctrl+S`) e **Galeria**.

### Tema visual

Toda a paleta fica em `assets/css/theme.css`. Troque só esse arquivo para mudar o app:

| Variável | Uso |
|---|---|
| `--bg` | Fundo da janela (`#0f0f12`) |
| `--surface` | Cards e palcos, um tom acima do fundo |
| `--border` / `--accent` | Detalhe roxo: borda 1px, título, ícone ativo, botão principal (`#8b5cf6`) |
| `--text` | Texto em cinza claro (`#e4e4e7`) |

Tipografia sem serifa (fonte do sistema). Animações só de fade e leve elevação. Os gatos pixel art não têm fundo colorido atrás.

### Eventos: tudo que é tocado vira JSON

Air Pads e Beat Cats registram cada nota em `modules/shared/events.js` (formato `mmp-events`):

```json
{ "kind": "mmp-events", "version": 1, "source": "airpads", "bpm": 96, "scale": "penta", "root": 0, "length": 8,
  "tracks": [{ "id": "circulo-1-piano", "name": "Mão esquerda · Piano", "inst": "piano" }],
  "events": [{ "time": 0.5, "dur": 0.5, "note": 64, "vel": 0.85, "inst": "piano", "track": "circulo-1-piano" }] }
```

`time` e `dur` em batidas; `note` em MIDI (na bateria, General MIDI: 36 bumbo, 38 caixa, 42 chimbal…). As gravações de áudio/vídeo dos módulos salvam os eventos num arquivo ao lado (`gallery/<id>.events.json`), então abrem no Studio. O botão **Editar no Studio** (Air Pads, Beat Cats) leva tudo que foi tocado na sessão direto para o editor. No Beat Cats os 24 sons são capturados por um “grampo” nos sintetizadores do Tone.js, e um beat salvo vira faixas editáveis.

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
    ui.js, icons.js, theme.js  toasts, modais, ícones pixel, leitura das variáveis de theme.css
  hub/ mycat/ gallery/ beatcats/ studio/ airpads/ termo/ conexoes/ cattyping/
                 conexoes/engine.js  gerador de puzzles (4 categorias sem palavras em comum)
assets/              theme.css (paleta) + CSS dos módulos; fontes pixel OFL ainda no repo, não usadas no tema atual
data/                padrões versionados (defaults/), exemplos (demo/), palavras do Termo (termo/), categorias do Conexões (conexoes/) e palavras do Cat Typing (cattyping/)
vendor/              Tone.js e MediaPipe locais (ver vendor/README.md)
scripts/             autoteste, screenshots, setup do vendor, geradores do Termo, do Conexões, do Cat Typing e do ícone
build/               ícone do gato (png/ico) e entitlements da câmera no macOS
.github/workflows/   Action de release (tag v* → .exe + .dmg)
```

## Offline de verdade

- Os arquivos são servidos por um protocolo próprio (`mmp://app/…`) direto da pasta do app.
- O processo principal **bloqueia qualquer requisição http(s)/ws(s)**; o `npm run check` falha se alguma acontecer.
- A CSP do `index.html` só permite recursos do próprio app (`'self'`, `blob:` e `data:`).

## Categorias do Conexões

`data/conexoes/categories.json` (400+ categorias, 8 a 12 palavras cada, nos temas psicologia, arte, história, música e gerais) é montado por `npm run conexoes:check` a partir de `scripts/conexoes-data/`. O gerador só junta 4 categorias cujas palavras **não se sobrepõem**; o script conta as combinações válidas (são centenas de milhões). Detalhes em `data/conexoes/README.md`.

## Palavras do Cat Typing

`data/cattyping/words.json` (**5.200** palavras de 3 a 10 letras: psicologia, arte, história e gerais, **800+ cada**) sai de `npm run cattyping:words`. Toda palavra é curada e conferida no Hunspell pt-BR. Termos históricos comuns entram mesmo se a lista de frequência (OpenSubtitles) os cortar. Nada é inventado. Candidatas em `scripts/cattyping-themes.mjs` e `scripts/cattyping-extra.mjs`; rejeitadas no `data/cattyping/build-report.json`. Detalhes em `data/cattyping/README.md`.

## Palavras do Termo

`data/termo/answers.json` (1.547 respostas: 171 de psicologia, 162 de arte, 151 de história e 1.063 gerais) e `data/termo/valid.json` (12.502 palpites aceitos) **não foram escritos à mão**: saem de `npm run termo:words`. Toda palavra passa pelo corretor Hunspell pt-BR do LibreOffice e precisa aparecer na lista de frequência real do português brasileiro (legendas do OpenSubtitles). As respostas gerais também precisam ser reconhecidas pelo dicionário pt-PT, que é independente. As candidatas temáticas ficam em `scripts/termo-themes.mjs`, e o `build-report.json` lista as que foram recusadas e o motivo. Fontes e licenças estão em `data/termo/README.md`.
