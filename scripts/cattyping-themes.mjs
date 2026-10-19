// Candidatas temáticas do Cat Typing (3–10 letras). Entram se o Hunspell pt-BR reconhecer.
// Termos históricos comuns passam mesmo sem aparecer na lista de frequência.
import { THEMES as TERMO, BLOCKLIST } from './termo-themes.mjs';
import { EXTRA_HISTORIA, EXTRA_PSICOLOGIA, EXTRA_ARTE } from './cattyping-extra.mjs';
import histCats from './conexoes-data/historia.mjs';
import arteCats from './conexoes-data/arte.mjs';
import psiCats from './conexoes-data/psicologia.mjs';
import musCats from './conexoes-data/musica.mjs';

const PT_WORD = /^[a-záàâãéêíóôõúüç]+$/i;

export const letters = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

function tokensFromText(str) {
  return String(str || '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokensFromConexoes(mod) {
  const out = [];
  for (const row of mod) {
    for (const part of String(row[3] || '').split(/[,;/]+/)) {
      const w = part.trim().toLowerCase();
      if (!w || /\s/.test(w) || w.includes('-')) continue;
      out.push(w);
    }
  }
  return out;
}

function pack(groups) {
  const byN = new Map();
  for (const raw of groups.flat()) {
    const token = String(raw).trim();
    if (!PT_WORD.test(token)) continue;
    const n = letters(token);
    if (n.length < 3 || n.length > 10) continue;
    const prev = byN.get(n);
    const hasMark = /[áàâãéêíóôõúüç]/i.test(token);
    const prevMark = prev && /[áàâãéêíóôõúüç]/i.test(prev);
    if (!prev || (hasMark && !prevMark)) byN.set(n, token.toLowerCase());
  }
  return [...byN.values()];
}

const extra = {
  psicologia: `ego self mente afeto apego trauma luto medo raiva calma crise surto sonho culpa animo humor fobia mania
    terapia clinica psicose neurose delirio memoria atencao vinculo estresse empatia libido pulsao recalque projecao
    negacao regressao autismo dislexia insonia pesadelo vigilia hipnose placebo hipotese amostra media validade teste
    escala traco fator desejo prazer sofrer temer sonhar dormir acordar lucido duvida crenca ilusao tensao alivio
    anseio terror horror alerta atento pranto chorar timido fragil gentil carente paixao saudade furia vigor zanga
    casal filho lacos falar ouvir ideal metas plano focar sabio curar sarar meigo cruel forca fraco agito apoio ajuda
    noivo viuvo orfao lazer folga dores febre aluno aulas rosto almas dogma certo erros fatos causa pleno ganho lutar
    exito turma rival calor medos risos zelar queixa manias apatia euforia disforia paranoia catatonia anedonia
    insight setting rapport holding alucinacao depressao ansiedade panico autoestima identidade caracter linguagem
    percepcao sublimacao aceitacao puberdade infancia velhice barganha duelo afasia toque afago timidez coragem
    emocao sintoma paciente clinico psicologo reflexo habito estimulo resposta reforco punicao esquema vinculos
    autoimagem autoconceito autoeficacia burnout assedio estigma resiliencia`,
  arte: `arte cor tom tinta museu matiz linha forma massa barro gesso pedra talha busto torso copia molde mural icone
    filme palco opera danca samba valsa tango forro frevo canto coral piano harpa viola banjo orgao surdo cuica baixo
    sopro corda tecla ritmo tempo clave pauta letra verso poema poeta prosa conto texto livro autor trama atriz fundo
    plano lente lapis salao disco vinil faixa album banda turne circo bloco folia dueto tenor agudo grave ruido suite
    rondo frase tecer renda trico marca fonte manga heroi vilao epico farsa lenda serie tocar criar atuar pintar
    cantar dancar compor gravar moldar bordar esboco croqui retrato pintura escultura estatua quadro moldura cenario
    figurino musica melodia harmonia acorde solista maestro batuta teatro cinema comico satira fabula ensaio novela
    atelie estudio galeria acervo mostra cartaz poster charge croche gravura sombra brilho pastel verniz guache carvao
    flauta tambor timbre refrao estrofe sonata hino salmo baiao lundu xaxado choro telas cores sepia lilas cinza preto
    negro creme verde jarro louca vidro folha obras pecas artes blues bossa vocal vozes notas remix mixar shows cenas
    traje roupa modas panos linho botao fotos flash close curta longa video audio ecoar luzes curva ponto lindo linda
    premio oscar rimas trova sarau capas lirico enredo climax musas expor poses posar nudez salsa rumba polca break
    passo giros salto pular conga bongo agogo bumbo caixa prato gongo sinos gaita trompa arcos trilha radio anime
    gibis cartum risco colar montar editar games pixel emoji memes tipos letras cordel soneto haicai bienal selfie
    elenco mimico magico truque cantor pintor estilo cubismo barroco gotico fresco oleo aquarela guache afresco
    popart collage mural grafite estencil xilogravura litografia serigrafia perspectiva sfumato claroescuro
    impressionismo cubismo surrealismo expressionismo futurismo dadaismo fauvismo abstracao romantismo realismo
    monalisa davinci picasso monet degas renoir cezanne rodin calder warhol portinari tarsila anita volpi niemeyer
    louvre prado uffizi masp orsay tate retrato paisagem natureza marinha vanitas vitral mosaico icone retabulo
    ceramica porcelana terracota tapeçaria bordado batik ourives filigrana esmalte camara plano close travelling
    montagem corte elipse palco plateia bastidores ribalta camarim cortina proscenio`,
  historia: `rei rainha imperio reino coroa trono corte nobre conde duque barao plebe servo feudo cetro manto lanca tropa
    golpe motim greve pacto tribo nacao terra porto navio barco frota costa prata cobre ferro ruina torre feira moeda
    clero bispo monge padre frade santo mouro arabe celta grego persa farao mumia tumba idolo deusa sabio licao epoca
    idade carta lasca arado foice trigo milho arroz major lider chefe junta poder censo edito exodo vapor motor usina
    bomba espada escudo flecha canhao brasao guerra aliado colono nativo aldeia patria pirata templo igreja capela
    burgo dizimo freira papiro seculo decada antigo relato diario fossil sertao martir tirano regime senado codigo
    exilio migrar tanque espiao rainha colonia batalha vitoria derrota tratado revolta castelo palacio muralha escravo
    senzala quilombo abolicao soldado general cruzada viking cangaco bandeira ferrovia fabrica operario damas armas
    elmos malha besta adaga sabre facao fuzil rifle tiros balas aviao naves muros queda tregua acordo votos votar
    urnas camara bulas papas altar missa herege bruxa bruxo indio lorde fosso ponte cerco sitio saque duelo legiao
    guarda ordens sagas anais datas ruinas ossos cripta anfora moedas selos mapas rotas remos velas ancora ilhas mares
    joias cofre pobre peste praga virus colera abolir trens trilho carro prensa runas cifra enigma atlas globo polos
    areia oasis grega latim romano ninja incas maias asteca mongol ritos culto agora forum praca vilas marco vinho
    oliva safra moinho rodas brasa tocha gruta cacar presa mamute xama egito roma grecia china india persia fenicia
    sumeria babilonia assiria nilo tigre eufrates piramide esfinge sarcofago hieroglifo cuneiforme zigurate polis
    atenas esparta hoplita falange senado consul aqueduto augusto nero trajano adriano constantino cesar feudo
    cavaleiro mosteiro cruzada peste negra senhorio saladino antioquia jerusalem humanismo mecenato imprensa florenca
    medici reforma lutero calvino indulgencia caravela astrolabio bussola cabral colombo magalhaes tordesilhas
    capitania engenho sesmaria bandeirante padroado trafico pelourinho alforria tiradentes derrama alferes conjuracao
    ipiranga bonifacio regencia paraguai encilhamento coronelismo tenentismo getulio vargas clt anistia diretas
    constituicao collor impeachment bastilha jacobinos terror robespierre waterloo austerlitz elba steam tear carvao
    fabrica luditas ferrovia lincoln gettysburg grant trincheira versalhes somme armisticio hitler stalin churchill
    normandia holocausto hiroshima otan berlim cuba marshall lenin trotsky soviete mao kuomintang mandela nkrumah
    apartheid descolonizacao maome meca medina califado hegira istambul sultao janizaro solimao xogunato samurai
    meiji edo daimio bushido mauria gupta moghul ashoka gandhi particao magna carta iluminismo voltaire rousseau
    diderot kant sindicato greve marx engels anarquismo acucar ouro cafe borracha cacau cabanagem balaiada sabinada
    farroupilha praieira canudos conselheiro jagunco zumbi palmares humaita caxias feb pracinhas`
};

export const THEME_TOKENS = {
  psicologia: pack([tokensFromText(TERMO.psicologia), tokensFromText(extra.psicologia), tokensFromText(EXTRA_PSICOLOGIA), tokensFromConexoes(psiCats)]),
  arte: pack([
    tokensFromText(TERMO.arte),
    tokensFromText(extra.arte),
    tokensFromText(EXTRA_ARTE),
    tokensFromConexoes(arteCats),
    tokensFromConexoes(musCats)
  ]),
  historia: pack([tokensFromText(TERMO.historia), tokensFromText(extra.historia), tokensFromText(EXTRA_HISTORIA), tokensFromConexoes(histCats)]),
  gerais: pack([tokensFromText(TERMO.gerais)])
};

export const THEMES = {
  psicologia: THEME_TOKENS.psicologia.join(' '),
  arte: THEME_TOKENS.arte.join(' '),
  historia: THEME_TOKENS.historia.join(' '),
  gerais: THEME_TOKENS.gerais.join(' ')
};

export { BLOCKLIST };
