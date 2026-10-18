# Palavras do Termo

Arquivos gerados por `scripts/build-termo-words.mjs` (`npm run termo:words`). Não edite à mão: rode o script.

| Arquivo | Conteúdo |
| --- | --- |
| `answers.json` | palavras sorteáveis, cada uma com `word` (sem acento), `display` (forma acentuada mais usada) e `theme` (`psicologia`, `arte`, `historia`, `gerais`) |
| `valid.json` | todos os palpites aceitos (sem acento, ordem alfabética), incluindo as respostas |
| `build-report.json` | candidatas temáticas rejeitadas e o motivo, contagens por tema |

## Como uma palavra entra

Nenhuma palavra é escrita à mão direto na lista. Toda palavra vem de uma fonte real e passa por verificações:

1. **Palpites aceitos (`valid.json`)**: formas de 5 letras que aparecem pelo menos 2 vezes na lista de frequência
   e que o corretor Hunspell pt-BR reconhece, mais todos os lemas de 5 letras do próprio dicionário.
2. **Respostas temáticas**: candidatas de `scripts/termo-themes.mjs`, aceitas só se o Hunspell pt-BR reconhecer,
   se aparecerem 40+ vezes na lista de frequência e se não estiverem bloqueadas.
3. **Respostas gerais**: lemas do dicionário pt-BR, com as mesmas regras, que também precisam ser reconhecidos
   pelo dicionário pt-PT (um projeto independente). Isso corta nomes próprios e estrangeirismos.
   Se ainda faltar, entram plurais comuns de substantivos de 4 letras (casa → casas), com as mesmas verificações.

O jogo ignora acentos: `word` e `valid.json` usam a forma sem diacríticos (ç → c).

## Fontes e licenças

- Dicionário Hunspell pt-BR do LibreOffice (VERO), pacote npm `dictionary-pt`. Licença LGPL-3.0 / MPL-2.0.
- Dicionário Hunspell pt-PT da Universidade do Minho, pacote npm `dictionary-pt-pt`. Licença GPL-2.0 / LGPL-2.1 / MPL-1.1.
- Lista de frequência pt-BR de [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) (legendas do
  OpenSubtitles 2018). Licença CC-BY-SA-4.0. O script baixa a lista uma vez e guarda em `node_modules/.cache/mmp-termo/`.

O script usa o binário `hunspell` quando ele existe (`apt install hunspell`, leva menos de 2 segundos). Sem ele,
usa o `nspell` em JavaScript puro, que funciona mas leva muitos minutos para carregar o dicionário pt-BR.
