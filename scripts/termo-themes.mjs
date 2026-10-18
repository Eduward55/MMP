// Candidatas temáticas do Termo. Não são aceitas direto: o build-termo-words.mjs só aproveita as que o
// dicionário Hunspell pt-BR reconhece e que aparecem na lista de frequência real (legendas em pt-BR).
export const THEMES = {
  psicologia: `mente afeto apego culpa sonho raiva ânimo humor fobia mania crise perda calma susto choro tédio ciúme
    vício ânsia temor pavor senso juízo razão ideia noção visão nervo manha birra teima drama mágoa valor moral ética
    traço etapa ciclo gesto olhar toque beijo grupo papel pausa lapso falha teste exame laudo surto calmo tenso feliz
    irado bravo manso dócil forte firme amigo afago louco vazio fugir negar cisma amado odiar pesar mudar jovem idoso
    velho outro droga fumar abuso abalo pulso tique regra norma doido gênio garra honra lúcido sentir pensar dúvida
    crença ilusão apatia prazer tensão alívio desejo anseio ímpeto timbre terror horror alerta atento pranto riso
    sorrir chorar sonhar dormir acordar tímido frágil gentil amável carente sofrer temer gostar amante paixão saudade
    fúria saúde sorte vigor zanga chato amiga casal filho filha laços falar ouvir ideal metas plano focar saber
    sábio burro fases curar sarar piada graça meigo cruel força fraco agito signo jogos mitos apoio ajuda noivo noiva
    viúvo órfão lazer folga dores febre dopar nível graus média dados aluno aluna aulas rosto lábio peito almas dogma
    certo erros fatos causa pleno louca ganho lutar êxito povos turma bando times rival sonsa tensa calor frias
    cisma mimos medos risos zelar pirar ninar sinto queixa manias afeta ânsias`,
  arte: `tinta museu matiz linha forma massa barro gesso pedra talha busto torso cópia molde mural ícone filme palco
    ópera dança samba valsa tango forró frevo canto coral piano harpa viola banjo órgão surdo cuíca baixo sopro corda
    tecla ritmo tempo clave pauta letra verso poema poeta prosa conto texto livro autor trama atriz fundo plano lente
    lápis salão disco vinil faixa álbum banda turnê circo bloco folia dueto tenor agudo grave ruído suíte rondó frase
    tecer renda tricô marca fonte mangá herói vilão épico farsa lenda série tocar criar atuar pintar cantar dançar
    compor gravar moldar bordar esboço croqui retrato pintura escultura estátua quadro moldura cenário figurino
    música melodia harmonia acorde solista maestro batuta teatro cinema cômico sátira fábula ensaio novela ateliê
    estúdio galeria acervo mostra cartaz pôster charge crochê gravura sombra brilho pastel verniz guache carvão
    flauta tambor timbre refrão estrofe sonata hino salmo baião lundu xaxado choro
    telas cores sépia lilás cinza preto negro creme verde jarro louça vidro folha obras peças artes blues bossa
    vocal vozes notas remix mixar shows cenas traje roupa modas panos linho botão fotos flash close curta longa
    vídeo áudio ecoar luzes curva ponto lindo linda prêmio oscar rimas trova sarau capas lírico enredo clímax musas
    expor poses posar nudez salsa rumba polca break passo giros salto pular conga bongô agogô bumbo caixa prato
    gongo sinos gaita trompa arcos trilha rádio anime gibis cartum risco colar montar editar games pixel emoji
    memes tipos letras cordel soneto haicai bienal selfie elenco mímico mágico truque cantor pintor estilo`,
  historia: `reino coroa trono corte nobre conde duque barão plebe servo feudo cetro manto lança tropa golpe motim
    greve pacto tribo nação terra porto navio barco frota costa prata cobre ferro ruína torre feira moeda clero bispo
    monge padre frade santo mouro árabe celta grego persa faraó múmia tumba ídolo deusa sábio lição época idade carta
    lasca arado foice trigo milho arroz major líder chefe junta poder censo édito êxodo vapor motor usina bomba
    espada escudo flecha canhão brasão guerra aliado colono nativo aldeia pátria pirata templo igreja capela burgo
    dízimo freira papiro século década antigo relato diário fóssil sertão mártir tirano regime senado código exílio
    migrar tanque espião rainha império colônia batalha vitória derrota tratado revolta castelo palácio muralha
    escravo senzala quilombo abolição soldado general cruzada viking faraó cangaço bandeira ferrovia fábrica operário
    damas armas elmos malha besta adaga sabre facão fuzil rifle tiros balas avião naves muros queda trégua
    acordo votos votar urnas câmara bulas papas altar missa herege bruxa bruxo índio lorde fosso ponte cerco sítio
    saque duelo legião guarda ordens sagas anais datas ruínas ossos cripta ânfora moedas selos mapas rotas remos
    velas âncora ilhas mares joias cofre pobre peste praga vírus cólera abolir trens trilho carro prensa runas
    cifra enigma atlas globo polos areia oásis grega latim romano ninja incas maias asteca mongol ritos culto ágora
    fórum praça vilas marco vinho oliva safra moinho rodas brasa tocha gruta caçar presa mamute xamã`,
  gerais: `gatas leite queijo arroz carne peixe frango ovos fruta frutas manga pêssego limão melão caqui ameixa banana
    pera maçã uvas suco sucos água chuva neve vento nuvem raios trovão sol lua estrela céu campo praia areia rio
    lago lagoa monte serra morro vale selva mata bosque árvore folha ramos raiz flor flores rosas cacau salada
    sopa molho bolo bolos doces torta pudim mingau feijão pão pães café chá açúcar mesa cadeira sofá cama quarto
    sala porta janela chave telha muro casa casas prédio escada chão teto parede tapete toalha sabão pente escova
    copo copos prato garfo faca colher panela forno fogão geladeira pia balde vassoura lixo cesta caixa saco bolsa
    mochila sapato meias calça saia vestido blusa camisa boné chapéu luvas óculos relógio anel colar brinco
    pulseira carro moto ônibus trem barco avião bicicleta pneu rodas volante motor posto cidade bairro rua ruas
    praça parque escola igreja loja lojas mercado feira banco hotel hospital museu cachorro cão cães cadela gato
    rato ratos coelho porco vaca touro cavalo égua burro ovelha cabra galinha galo pato patos ganso pombo corvo
    águia coruja peru tigre leão leoa zebra girafa macaco urso lobo raposa onça cobra sapo tubarão baleia polvo
    camarão siri lula foca pinguim abelha vespa formiga mosca barata aranha piolho pulga minhoca lesma tatu anta
    capivara jacaré cervo veado esquilo morcego dente dentes braço braços perna pernas joelho dedos unhas cabelo
    testa nariz orelha ombro costas barriga umbigo sangue ossos músculo tempo hora horas minuto manhã tarde noite
    verão outono inverno semana sábado domingo janeiro março abril maio junho julho agosto número zero dois três
    quatro cinco seis sete oito nove dez cem mil metro litro quilo grama preço conta troco dinheiro nota notas
    moeda cartão senha email site rede redes celular tablet piano bola bolas jogo time gol golos placar torcida
    campeão prova provas lápis caneta régua mapa globo aviso placa sinal fila festa presente cartas envelope selo
    pacote lenço carta sonho viagem passeio`
};

// Fora das respostas (continuam valendo como palpite se o dicionário aceitar).
export const BLOCKLIST = `porra merda bosta puta putas bunda trepa foder fodas fodeu viado bicha corno penis pênis vulva
  nazis xoxota piroca cuzão cuzao vadia safada safado tesão tesao pinto pirou otario otário idiota imbecil babaca
  buceta caralho punheta broxa gozar gozou peido peidar mijar cagar cagou estupro matar morte morto morta cagão cagona
  putos coito hímen mijão chupa fecal púbis fezes judeu judia`;

// Nomes próprios e estrangeirismos que o Hunspell aceita em minúsculas: continuam valendo como palpite,
// mas não são sorteados.
export const NAMES = `diana césar judas jesus zorro édipo ícaro curie babel pence bento lúcio mingo óscar fermi sidos
  vitae stops druso alter amaro gauss hindi nylon slide drive super ultra multi micro macro neuro retro intra
  supra watts volts hertz spray laser modem telex punks links bytes chips sites euros ienes`;
