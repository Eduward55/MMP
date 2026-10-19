# Categorias do Conexões

A base `categories.json` não é um conjunto fixo de puzzles: cada partida **combina 4 categorias** cujas palavras não se cruzam e pega 4 palavras de cada uma. Isso gera centenas de milhões de tabuleiros distintos.

Fonte: `scripts/conexoes-data/` (psicologia, arte, história, música, gerais). Para remontar e validar:

```bash
npm run conexoes:check
```

O script exige:

- 400+ categorias
- 8 a 12 palavras por categoria
- temas reais (termos verificáveis, em português)
- gerador capaz de montar puzzles sem palavra ambígua (a mesma palavra não pode pertencer a duas das 4 categorias escolhidas)
- milhares (na prática, centenas de milhões) de combinações válidas de 4 categorias

O `meta.validFourTuples` no JSON é a contagem exata dessas combinações.
