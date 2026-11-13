# Site principal Tech 2D

O repositório Agenda passa a se chamar `Tech-2D/tech-2d.github.io` e publica um único site:

- `/`: agenda de atividades e recursos da turma.
- `/professores/`: horários, localização e administração de professores.
- `/Agenda/`: compatibilidade com os links antigos, preservando parâmetros e fragmentos de atividades, convites de Kanban e atalhos.

As duas páginas usam uma instalação npm, um build Vite e o mesmo workflow de publicação. A navegação é interna, na mesma aba. Firebase, configuração de backend, aparência e atalhos usam as implementações compartilhadas de `src/`. As preferências de turma conservam as chaves de armazenamento existentes; cada área mantém seu catálogo, pois professores abrange turmas que ainda não têm agenda. Os estilos específicos dos professores são carregados somente nessa página.

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

Execute `npm ci` e `npm run dev`. Abra `/` para a agenda e `/professores/` para os professores. `npm run build` gera as duas páginas em `dist/`; nenhuma delas depende de compilar ou buscar outro repositório.
