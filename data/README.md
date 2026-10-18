# /data

- `defaults/` — valores padrão versionados (ex.: `profile.json`, o gato e a lontra iniciais). Lidos quando ainda não existe um arquivo salvo pelo usuário.
- `termo/` — listas de palavras do Termo, geradas por `npm run termo:words` (veja `termo/README.md`).
- `demo/` — conteúdo de exemplo colocado na Galeria no primeiro uso.
- `user/` — usado somente quando o app roda com `npm run start:local-data` (salva tudo aqui em vez do `userData` do Electron). Ignorado pelo git.
