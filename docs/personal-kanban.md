# Kanban pessoal — Agenda

Disponível em `Agenda/#kanban`, em **Ver mais opções → Meu Kanban**. O atalho pode ser fixado no menu lateral. Usa qualquer conta Firebase Authentication da Agenda, sem exigir papel administrativo ou turma selecionada.

## Organização

- Até 12 quadros por conta e 12 colunas por quadro; até 200 tarefas no total.
- Modelos Básico, Estudos, Minha semana e Do zero. Um quadro personalizado pode ser reutilizado como modelo, copiando apenas colunas, cores e densidade, sem tarefas.
- Nomes, cores, ordem das colunas e indicação de coluna concluída configuráveis. Uma coluna com tarefas não pode ser removida até que elas sejam movidas; a última coluna é preservada.
- Cartões com descrição, prioridade, prazo opcional, até 6 etiquetas e checklist com até 20 itens. Busca por título/descrição/etiqueta e filtro de prioridade.
- Arrastar entre colunas/ordenar no desktop; seleção de destino e botões de ordem acessíveis por teclado e no celular. Alterações são salvas após cada ação, sem necessidade de um botão global.

## Persistência e privacidade

O workspace fica em `personalKanban/{uid}` na tabela SQL `tech2d.app_documents`, com esquema validado no Worker. Não há gravação no Firestore e não é necessária migração de tabelas. Os quadros não são atividades públicas nem entram nos resumos da turma.

Leitura e gravação exigem UID igual ao ID do documento, inclusive antes de conferir existência ou versão. Não há listagem da coleção; representantes, superadmins e a chave interna da API web não recebem acesso. Autoria e data de criação são imutáveis. Limites de quantidade, tamanho e estrutura são impostos também no servidor.

Trocar de conta desmonta o workspace anterior e invalida respostas pendentes. Edições usam versões e recibos idempotentes da API SQL. Em conflito ou resultado de gravação incerto, a tela impede novas gravações e pede recarga explícita antes de continuar. Não há atualização periódica que sobrescreva silenciosamente um formulário aberto em outra aba.

Exclusões de quadros/tarefas exigem confirmação; não existe endpoint de exclusão completa do workspace. A auditoria SQL existente é mantida.
