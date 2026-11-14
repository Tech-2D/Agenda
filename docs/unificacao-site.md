# Site principal Tech 2D

O repositório `Tech-2D/web` publica o site em [tech-2d.github.io/web/](https://tech-2d.github.io/web/). Os caminhos abaixo são relativos ao caminho base configurado pelo GitHub Pages.

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

O GitHub Pages informa o caminho base durante a publicação. O build usa esse caminho para os arquivos e a navegação interna. Todas as páginas compartilham a origem `https://tech-2d.github.io`, que o Firebase e a API usam.

## Desenvolvimento

Execute `npm ci` e `npm run dev`. Abra `/` para a agenda, `/professores/` para os professores e `/pegaki/` para as notas. `npm run build` gera as três páginas em `dist/`; nenhuma delas depende de compilar ou buscar outro repositório.

## Notaki

O código de `Tech-2D/pegaki` foi incorporado em `src/pegaki/`, com os testes das fórmulas e da leitura de boletim integrados ao Vitest. O importador de PDF carrega sob demanda e funciona no navegador. Notas, pesos e ano selecionado usam as chaves `aprovae:*` do `localStorage`. O endereço `https://tech-2d.github.io/web/pegaki/` tem a mesma origem do endereço antigo e pode acessar as notas salvas nesse domínio.

A paleta é compartilhada com a Agenda em `src/sitePalette.css`; o Notaki lê as mesmas preferências de tema, neon e acessibilidade. Seu seletor independente de claro/escuro foi substituído por um link às configurações gerais. A preferência antiga `aprovae:theme` não sobrescreve mais as cores escolhidas no site.

O salvamento por conta é controlado por `VITE_PEGAKI_CLOUD_GRADES`, ativado em produção após aplicar a migration 024 e publicar a API. O usuário autenticado carrega um caderno por ano letivo, importa notas locais explicitamente e usa **Salvar na conta**. A API confirma versões para evitar sobrescritas e protege as notas por conta. Sem login, o modo local continua disponível. A estrutura SQL está documentada em `Tech-2D/modelagem-dados/docs/notas-pegaki.md`.

A ativação foi validada em 13/11/2026 na API publicada: duas contas temporárias confirmaram gravação e leitura, isolamento entre contas, rejeição de acesso anônimo, conflitos de versão, autoria forjada e limpeza de notas. As contas e os cadernos de teste foram removidos ao terminar. Nenhuma nota foi enviada à IA.

A navegação compartilhada mostra Agenda, Professores e Notaki na mesma aba. O Pages separado de `Tech-2D/pegaki` deve ser desativado após a publicação para que `/pegaki/` seja servido pelo site principal. A integração não altera nem exclui o repositório pessoal do autor.
