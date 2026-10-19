# Palavras do Cat Typing

Geradas por `npm run cattyping:words`. Nenhuma palavra é inventada: lista curada (temas do Termo, extras em `scripts/cattyping-extra.mjs`, palavras soltas do Conexões) e depois cada item conferido no Hunspell pt-BR (`dictionary-pt`).

Termos históricos comuns (império, feudal, revolução, monarquia, colônia, faraó, dinastia, medieval, cruzada, renascença…) entram **mesmo se a lista de frequência os cortar**. `renascimento` é palavra real e passa no Hunspell, mas tem 12 letras — fora da faixa 3–10 do jogo; no dicionário entra a forma curta `renascença`.

## Contagens finais (2026-10-19)

| Tema | Candidatas | Hunspell ok | No `words.json` | Sem frequência | Mínimo |
| --- | ---: | ---: | ---: | ---: | ---: |
| psicologia | 921 | 852 | **814** | 43 | 800 |
| arte | 1140 | 867 | **843** | 118 | 800 |
| história | 1182 | 1078 | **1085** | 139 | 800 |
| gerais | 323 | 321 | **2458** | 0 | 800 |
| **total** | | | **5200** | 300 | 5000 |

Por tamanho (letras, sem acento): 3→152, 4→443, 5→1068, 6→945, 7→925, 8→795, 9→521, 10→351.

A coluna Hunspell ok é o poço temático (a mesma grafia pode aparecer em dois temas nas candidatas). No JSON final cada forma entra numa só cota.

Candidatas temáticas recusadas pelo Hunspell (nomes próprios, siglas, grafia estrangeira): psicologia 69, arte 273, história 104, gerais 2. Lista completa em `build-report.json`.

A lista final foi revalidada: **0** palavras fora do Hunspell.
