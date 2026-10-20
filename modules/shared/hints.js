// Textos curtos de “como mexer”, um por módulo. Aparecem no botão Dicas da barra.
import { getLang } from './i18n.js';

const PT = {
  airpads: `Air Pads — como mexer
• Ative a câmera ou passe o mouse nos círculos (teclas A e L também valem).
• Círculo da esquerda = sua mão esquerda; o da direita = a direita.
• Cada fatia é uma nota da escala (na bateria: chimbal, caixa, bumbo).
• Tela cheia amplia o palco; Voltar, Sair ou Esc saem. Desligar câmera para o vídeo.
• Salvar guarda os instrumentos. Gravar manda o áudio pra Galeria.`,
  beatcats: `Beat Cats — como mexer
• Arraste um acessório até um gato: ele entra no loop cantando.
• Arraste para fora ou toque no gato para silenciar.
• Toque na lontra (ou tecla O) para o efeito especial.
• Salvar guarda o beat na Galeria.`,
  studio: `Studio — como mexer
• Piano roll: clique cria nota, arraste move, puxe a ponta estica, duplo clique apaga.
• Step sequencer: cada quadradinho é uma semicolcheia.
• Espaço toca/para. Delete apaga a nota selecionada.
• Salvar guarda o projeto (o nome começa em Projeto 1).`,
  gallery: `Galeria — como mexer
• Filtre por tipo, busque pelo nome e abra o que você salvou.
• Áudios, beats e projetos podem ir pro Studio.
• Exportar baixa o arquivo; apagar pede confirmação.`,
  termo: `Termo — como mexer
• Palavra de 5 letras. Clique numa casa para escrever só aquela letra.
• Espaço vai para a próxima casa; Backspace apaga a casa atual.
• Enter envia. Verde = certa, amarelo = existe, cinza = não tem.
• Cada vez que você abre o Termo começa uma partida nova.
• Temas e tentativas ficam no painel da esquerda. O histórico mostra só a data.`,
  conexoes: `Conexões — como mexer
• Encontre 4 grupos de 4 palavras que combinam.
• O 4º clique envia sozinho — não tem botão Enviar.
• Temos vidas (corações). Um palpite errado treme e desmarca as 4. Fica tranquila.
• Dica ilumina duas palavras do grupo mais fácil que resta.
• Embaralhar só muda a ordem.`,
  cattyping: `Cat Typing — como mexer
• Digite a palavra do asteroide (acentos não importam).
• Cada letra atira um laserzinho da nave.
• Tab ou Esc pausa.
• Palavras vêm com 3 a 7 letras, misturadas.`,
  cantar: `Cantar — como mexer
• Clique em Ligar microfone (ou num chip) e cante. O gato abre a boca no volume.
• Cada chip muda a voz de verdade: Agudo/Grave o tom, Alvinhos (esquilos), Transformers (robô metálico), Eco, Caverna…
• Nota inicial: um pitchzinho (Dó, Ré, Mi…) para você afinar. Tocar nota liga/desliga.
• Acompanhamento: Nenhum, Arpejo, Pad suave, Coro aahs, Beat simples, Baixo + click, ou um beat/áudio da Galeria.
• Lontrinha: Gravar frase abre embaixo — fale, Pausar, depois Play. Solo cala as outras. Resetar apaga.`,
  tetris: `Tetris — como mexer
• Setas ou WASD: A/D andam, W gira, S acelera.
• Espaço solta a peça. Esc pausa.
• Complete linhas para pontuar.
• Som liga/desliga a musiquinha; o slider abaixa o volume.`,
  corrida: `Corrida — como mexer
• A/D ou setas desviam o carrinho.
• W ou ↑ aumenta o ritmo da pista.
• Esc pausa. Desvie de cones, pedras e sacos.`,
  mycat: `Meu Gato — como mexer
• Escolha o gato ou a lontra em cima: pelagem e olhos são de cada um.
• Digite o nome nos campos Nome do gato / Nome da lontra.
• Um item por lugar: clique em outro para trocar. Tirar tudo remove.
• Tudo salva sozinho; o botão Salvar também confirma.
• Clique no bichinho para ver a carinha fofa.`
};

const EN = {
  airpads: `Air Pads — how to play
• Turn the camera on or move the mouse over the circles (A and L keys work too).
• Left circle = left hand; right circle = right hand.
• Each slice is a scale note (drums: hi-hat, snare, kick).
• Full screen grows the stage; Back, Exit or Esc leave. Turn the camera off to stop the video.
• Save keeps the instruments. Record sends audio to the Gallery.`,
  beatcats: `Beat Cats — how to play
• Drag an accessory onto a cat: it joins the loop singing.
• Drag out or tap the cat to silence it.
• Tap the otter (or press O) for the special effect.
• Save stores the beat in the Gallery.`,
  studio: `Studio — how to play
• Piano roll: click creates a note, drag moves, pull the end to stretch, double-click deletes.
• Step sequencer: each square is a sixteenth.
• Space plays/stops. Delete removes the selected note.
• Save stores the project (names start at Project 1).`,
  gallery: `Gallery — how to play
• Filter by type, search by name and open what you saved.
• Audio, beats and projects can go to the Studio.
• Export downloads the file; delete asks for confirmation.`,
  termo: `Termo — how to play
• 5-letter word. Click a cell to type just that letter.
• Space jumps to the next cell; Backspace clears the current one.
• Enter submits. Green = right, yellow = in the word, gray = not there.
• Opening Termo always starts a new round.
• Themes and attempts sit on the left. History shows the date only.`,
  conexoes: `Connections — how to play
• Find 4 groups of 4 words that belong together.
• The 4th click submits by itself — there is no Submit button.
• Heart lives. A wrong guess shakes and deselects all 4.
• Hint lights two words from the easiest remaining group.
• Shuffle only changes the order.`,
  cattyping: `Cat Typing — how to play
• Type the asteroid word (accents do not matter).
• Each letter fires a little laser from the ship.
• Tab or Esc pauses.
• Words are 3 to 7 letters, mixed.`,
  cantar: `Sing — how to play
• Click Turn mic on (or a chip) and sing. The cat opens its mouth with the volume.
• Each chip really changes the voice: High/Low pitch, Chipmunks, Transformers (metallic robot), Echo, Cave…
• Starting pitch: a little drone (C, D, E…) so you can tune. Playing the note toggles it.
• Backing: None, Arpeggio, Soft pad, Choir aahs, Simple beat, Bass + click, or a Gallery beat/audio.
• Otter: Record phrase opens below — speak, Pause, then Play. Solo mutes the others. Reset clears.`,
  tetris: `Tetris — how to play
• Arrows or WASD: A/D move, W rotates, S drops faster.
• Space hard-drops. Esc pauses.
• Clear lines to score.
• Sound toggles the tune; the slider lowers the volume.`,
  corrida: `Race — how to play
• A/D or arrows steer the kart.
• W or ↑ speeds up the track.
• Esc pauses. Dodge cones, rocks and sacks.`,
  mycat: `My Cat — how to play
• Pick the cat or the otter at the top: coat and eyes belong to each one.
• Type names in the Cat name / Otter name fields.
• One item per place: click another to swap. Strip all removes them.
• Everything auto-saves; Save also confirms.
• Click the critter for a cute face.`
};

export function getHint(id) {
  const pack = getLang() === 'en' ? EN : PT;
  return pack[id] || PT[id] || '';
}

export const HINTS = new Proxy(
  {},
  {
    get(_, id) {
      return getHint(id);
    }
  }
);
