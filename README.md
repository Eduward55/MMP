# My Music Place (MMP)

App desktop musical, fofo e **100% offline**, feito com **Electron + HTML/JS/CSS puro** (sem frameworks de UI, sem bundler). Tema padrão **Noite** (fundo `#0f0f12`, bordas zinco, acento azul). O ícone de paleta no Hub e na barra de cima abre as paletas (Noite, Oceano, Dia, Floresta, Creme, Rosa, Menta, Uva, Dourado, Pôr do sol, Praia). As cores ficam em `assets/css/theme.css`. A gata **Pirrinha** e a lontra **Manhoso** aparecem em todos os módulos.

## Como jogar — só dois arquivos para clicar

1. **No Linux (Lenovo):** clique em `entrega/juntar.sh`  
   **No Windows (para juntar os pedaços):** clique em `entrega/juntar.bat`

   Isso monta `MyMusicPlace-Windows.zip` (~118 MB). Extraia a pasta inteira.

2. **No Windows, depois de extrair:** clique em **My Music Place.exe** (ícone do gato Pirrinha).

Só esses dois. Sem navegador, sem endereço de servidor.

Atualizar o Lenovo se o jogo já está clonado:

```bash
cd ~/MMP && git pull && cd entrega && bash juntar.sh
```

Primeira vez (clone novo):

```bash
rm -rf ~/MMP && git clone https://github.com/Eduward55/MMP.git ~/MMP && cd ~/MMP/entrega && bash juntar.sh
```

## O que tem

- **Hub** — Pirrinha e Manhoso no palco (clique para a carinha fofa). O tema fica num **ícone pequeno** que expande as paletas. Ao lado: **English | Português** (padrão português) e o **volume da trilha**. Os cards dos módulos ficam embaixo.
- **Meu Gato** — nomes padrão **Pirrinha** (gato) e **Manhoso** (lontra). Pelagem e olhos **separados** para cada um (12 pelagens no gato, 8 na lontra) e **20 roupinhas** filtradas por categoria (cabeça, pescoço, corpo…). As mudanças **salvam sozinhas**. Clique no bichinho anima a roupinha, sem tirar a roupa. Um item por lugar (cabeça, orelha, rosto, pescoço, corpo, costas, patinha).
- **Galeria** — lista áudios, vídeos, beats e projetos do Studio, com filtro, busca, ordenação e ações de **abrir, renomear, exportar e apagar**. Itens que têm notas (gravações dos módulos, beats, projetos) ganham o botão **No Studio**.
- **Beat Cats** — palco dos **8 gatos** em cima (grade 2×4) + a lontra; tocar/BPM no meio; **acessórios sonoros embaixo** em grelha larga. Arraste um dos **28** acessórios para um gato: ele entra no loop, canta e dança. **Limpar todos os beats** silencia a linha. A lontra faz um *splash* especial (tecla O). Grava só áudio ou áudio + animação (vídeo webm) direto na Galeria.
- **Studio** — edita as notas tocadas nos módulos: **piano roll** e **step sequencer**. Projeto novo nasce como **Projeto 1** (sem data no nome). Dicas na barra de cima. **Exportar WAV** / **WebM**; **Salvar** guarda na Galeria.
- **Air Pads** — duas mãos, dois discos em fatias (vinil em **anel**: círculo menos o furo do centro). O **furo** (e a bolinha no meio do palco) é **neutro**: não faz barulho. Juntar as mãos no meio faz **palmas**. Instrumentos: piano, bateria, synth, baixo, theremin, bloco, sinos, harpa e flauta. A bolinha e a nota **seguem o mouse/dedo**. **Tela cheia** amplia o palco. Sem câmera: mouse, teclas **A** e **L**, ou **Simular dedos**.
- **Termo** — palavras de 5 letras mais cotidianas. **Cada vez que você abre o jogo começa uma partida nova** (não reabre puzzle já resolvido). Clique numa casa, **espaço** pula para a próxima, Backspace apaga a casa atual. Histórico só com **data** (sem hora).
- **Conexões** — jogo de 16 palavras em **4 grupos de 4**, no espírito do Connections. O tabuleiro é gerado na hora a partir de **400+ categorias** reais (`data/conexoes/categories.json`: psicologia, arte, história, música e gerais, 8 a 12 palavras cada). O gerador escolhe 4 categorias **sem palavras ambíguas** (uma palavra não pode pertencer a duas das quatro) e pega 4 palavras de cada; isso dá **centenas de milhões** de combinações. O **4º clique envia sozinho**. Acertou, o grupo revela a categoria e a cor; **4 erros (corações) e perde**. Tem **embaralhar**, **dica**, **histórico só com data** e **recorde local**.
- **Cat Typing** — Pirrinha e Manhoso **dentro da nave**, sem vidro na frente. Vidas em coração. Asteroides com crateras e **vários bosses** (dragão, lula, disco, cristal, baleia). Customiza a nave no próprio jogo. **Tab** ou **Esc** pausa. Lista com 5.000+ palavras reais.
- **Cantar** — microfone ao vivo (sem eco-cancel matando o efeito). Chips mudam a voz de verdade (agudo, grave, robô, eco, autotune, rádio, caverna, **Alvinhos/esquilos**, **Transformers**…). **Nota inicial** (pitchzinho em Dó/Ré/Mi) para afinar; acompanhamento em arpejo ou beat/áudio da Galeria. Cada lontrinha grava **embaixo do card**: falar → Pausar → Play; Solo deixa só ela; Resetar apaga a take.
- **Tetris** — peças caindo com peça-fantasma, combo e partículas. Musiquinha chiptune baixinha e efeitos (Som / volume, como no Cat Typing). Setas ou WASD.
- **Corrida** — carrinho com o **bico para cima da pista**, gato no volante (a lontra torce do lado). Sacos, cones e pedras bem visíveis na pista. Tem musiquinha e som de motor. WASD ou setas.

Todo módulo tem a mesma barra: **◀ Hub**, **Dicas** (o manual), **Salvar** (`Ctrl+S`), **Galeria** e o **ícone de tema**. Idioma e volume da trilha ficam **só no Hub**. Os bichinhos no canto da tela podem ser **arrastados**. Trilhas procedurais de ~2 min (Hub calmo, Termo/Conexões suaves, Cat Typing espacial, Tetris chiptune, Corrida) sobem no primeiro clique.

### Tema visual

Toda a paleta fica em `assets/css/theme.css`. Troque só esse arquivo para mudar o app:

| Variável | Uso |
|---|---|
| `--bg` | Fundo da janela (`#0f0f12`) |
| `--surface` | Cards e palcos, um tom acima do fundo |
| `--border` / `--accent` | Borda discreta (zinco no tema Noite) e acento do botão/logo |
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

## Desenvolvimento no repositório

Para quem clona o código e vai mexer nele (Node.js 18+, testado com Node 22): `npm ci` e `npm start`. Tone.js, MediaPipe e fontes já estão em `/vendor` e `/assets` (funciona sem internet). Autoteste: `npm run check` (em Linux sem tela, `xvfb-run -a npm run check`). Outros scripts: `start:local-data`, `preview`, `screenshots`, `termo:words`, `conexoes:check`, `cattyping:words`, `vendor`, `icon`, `dist:win`, `dist:mac`.
