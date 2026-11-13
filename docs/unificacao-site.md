# Site principal Tech 2D

O repositório Agenda passa a se chamar `Tech-2D/tech-2d.github.io` e publica um único site:

- `/`: agenda de atividades e recursos da turma.
- `/professores/`: horários, localização e administração de professores.
- `/pegaki/`: calculadora de médias, simulações e importação/exportação de boletim.
- `/Agenda/`: compatibilidade com os links antigos, preservando parâmetros e fragmentos de atividades, convites de Kanban e atalhos.

As três páginas usam uma instalação npm, um build Vite e o mesmo workflow de publicação. A navegação é interna, na mesma aba. Agenda e Professores compartilham Firebase, configuração de backend, aparência e atalhos de `src/`. As preferências de turma conservam as chaves de armazenamento existentes; cada área mantém seu catálogo, pois professores abrange turmas que ainda não têm agenda. Cada página carrega seus estilos específicos.

## Publicação e transição

1. Validar testes, lint e build antes da troca.
2. Preservar o histórico de `professores` como segundo ancestral da união e manter um backup local completo antes de retirar o repositório antigo.
3. Renomear o repositório Agenda para `tech-2d.github.io`; manter as variáveis e secrets existentes, especialmente `VITE_DATA_BACKEND=sql`.
4. Publicar pelo workflow existente na branch `main`.
5. Verificar a raiz, a página de professores e os links legados no site publicado.
6. Desativar o GitHub Pages do repositório `professores`: enquanto existir um projeto Pages nesse endereço, ele tem precedência sobre a pasta `/professores/` do site principal.
7. Retirar o repositório antigo somente depois dessas verificações.

O endereço de professores permanece igual. Não é necessária migração do banco ou mudança da origem no Firebase/Workers: todas as páginas continuam na origem `https://tech-2d.github.io` e usam o backend já existente. O GitHub redireciona links do repositório Agenda renomeado; o site conserva a pasta `/Agenda/` para os links públicos antigos.

## Desenvolvimento

Execute `npm ci` e `npm run dev`. Abra `/` para a agenda, `/professores/` para os professores e `/pegaki/` para as notas. `npm run build` gera as três páginas em `dist/`; nenhuma delas depende de compilar ou buscar outro repositório.

## Pegaki

O código de `Tech-2D/pegaki` foi incorporado em `src/pegaki/`, com os testes das fórmulas e da leitura de boletim integrados ao Vitest. O importador de PDF continua carregado sob demanda e funciona no navegador. Notas, pesos e ano selecionado continuam nas chaves `aprovae:*` do `localStorage`. Como o endereço permanece em `https://tech-2d.github.io/pegaki/`, as notas previamente salvas nesse domínio continuam disponíveis.

A paleta é compartilhada com a Agenda em `src/sitePalette.css`; o Pegaki lê as mesmas preferências de tema, neon e acessibilidade. Seu seletor independente de claro/escuro foi substituído por um link às configurações gerais. A preferência antiga `aprovae:theme` não sobrescreve mais as cores escolhidas no site.

O salvamento por conta fica atrás de `VITE_PEGAKI_CLOUD_GRADES` (desligado até a aplicação da migration 024 e publicação da API). Quando ativado, o usuário autenticado carrega um caderno por ano letivo, importa notas locais explicitamente e usa **Salvar na conta**. A API confirma versões para evitar sobrescritas e protege as notas por conta. Sem login, o modo local continua disponível. A estrutura SQL está documentada em `Tech-2D/modelagem-dados/docs/notas-pegaki.md`.

A navegação compartilhada mostra Agenda, Professores e Pegaki na mesma aba. O Pages separado de `Tech-2D/pegaki` deve ser desativado após a publicação para que `/pegaki/` seja servido pelo site principal. A integração não altera nem exclui o repositório pessoal do autor.
