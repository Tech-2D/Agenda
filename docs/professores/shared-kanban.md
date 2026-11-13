# Kanban compartilhado e arrastar animado

## Uso

Na Agenda, abra **Meu Kanban → Compartilhados → Novo compartilhado**. Qualquer conta Firebase Authentication pode criar um quadro; não é necessário ser representante. O dono usa **Compartilhar e acessos** para copiar um link e aprovar pedidos.

O convidado entra com sua própria conta, abre o link e pede acesso. O link sozinho não mostra tarefas. O dono confere a pessoa e aprova ou recusa; os aprovados podem editar cartões, colunas e configurações visuais. Só o dono gerencia acessos e exclui o quadro. Participantes podem sair e pedir nova aprovação posteriormente.

Quadros pessoais não são convertidos ou expostos. O compartilhado é criado explicitamente, com os mesmos modelos e personalizações. Cópias de modelos continuam copiando apenas estrutura e visual, sem tarefas. Cada quadro compartilhado admite 12 colunas e 200 tarefas.

## Dados e concorrência

- `sharedKanban/{id}`: dono, quadro, datas. Leitura só pelo dono ou membro aprovado; edição por ambos; exclusão só pelo dono.
- `kanbanRequests/{boardId}_{uid}`: pedido, identidade vinculada ao token, status e datas. Leitura pelo próprio solicitante ou dono do quadro.
- `kanbanMemberships/{boardId}_{uid}`: concessão imutável criada pelo dono a partir de um pedido autenticado. Removível pelo dono ou pelo próprio participante.
- Consultas exigem filtro pelo UID do solicitante/dono ou pelo quadro pertencente ao dono. Administradores globais e o serviço web não recebem acesso implícito. SQL usa as tabelas existentes, sem migração destrutiva.
- Aprovação/revogação usam lotes atômicos. Remover uma concessão bloqueia os próximos pedidos à API imediatamente. As telas verificam alterações periodicamente (30 segundos enquanto visíveis), como os demais recursos SQL.
- Formulários fixam a versão em que foram abertos (`updateDocAtVersion`). Uma leitura de fundo nunca promove silenciosamente essa versão. Sem edição/arraste em andamento, o quadro é atualizado; com edição, pede recarga explícita para impedir sobrescrita.

## Interação

O arrastar usa `@dnd-kit/core`, `sortable` e `utilities`, carregados com a página lazy do Kanban. Há prévia flutuante, deslocamento dos vizinhos, encaixe animado e destino destacado. Alças de seis pontos funcionam por ponteiro ou teclado; botões/setores de destino continuam disponíveis. Soltar fora ou usar Escape cancela sem gravar. A posição final aparece antes da confirmação SQL; falha volta ao estado confirmado. Preferência de movimento reduzido do sistema/site desativa transições decorativas.

Referências: [Sortable](https://dndkit.com/legacy/presets/sortable/overview/), [DragOverlay](https://dndkit.com/legacy/api-documentation/draggable/drag-overlay/).

## Verificação

Testes SQL cobrem conta comum, convite sem leitura, aprovação exclusiva do dono, autoaprovação/forja negadas, edição por membro, conflito de versão, consultas privadas, revogação, saída e exclusão. Testes frontend cobrem links, versão fixada, formulários, exclusão restrita e alças acessíveis. `verify-shared-kanban.js` é somente leitura por padrão; com `--execute`, testa criação/edição/conflito/exclusão em um único quadro temporário, sem tocar quadros existentes.

Na conferência das dependências, `npm audit` apontou 17 alertas no conjunto existente, incluindo Vitest/tinypool de desenvolvimento; nenhum apontamento em `@dnd-kit`. Não foi executado `audit fix --force` ou upgrade geral fora do escopo.

### Resultado da publicação

125 testes da Agenda e 69 da API aprovados; build SQL gerado e lint sem erros novos (permanece um aviso anterior de dependência de hook em `PollsDialog`). Frontend enviado à main da Agenda no commit `a0c3d42`.

Worker SQL publicado na conta Tech-2D confirmada, versão `dd030199-c7d9-45dc-8fe1-ca598029e99d`. Verificação em produção com `--execute`: consultas próprias permitidas, listagem não filtrada bloqueada, criação/edição de um quadro temporário aprovadas, edição com versão antiga recusada e leitura anônima bloqueada. O quadro de teste foi excluído ao concluir. Nenhum quadro existente ou senha foi alterado. Aprovação e revogação entre contas foram verificadas nos testes SQL isolados; não foram enviados convites a pessoas reais.
