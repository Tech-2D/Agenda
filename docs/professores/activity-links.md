# Links diretos de atividades

Na Agenda, o botão **Copiar link** aparece nos detalhes do dia e nas visões de dia e semana. O endereço tem o formato `https://tech-2d.github.io/Agenda/#atividade=ID` e identifica a atividade, sem incluir e-mail, sessão, filtros ou dados do formulário.

Quem recebe abre os detalhes públicos sem login, mesmo sem uma turma salva ou com outra turma selecionada. O popup informa turma, data, horário, matéria, descrição e anexos. A opção **Ver na agenda** seleciona explicitamente a turma/data correspondente. A abertura do link por si só não muda a turma preferida.

O ID permanece igual ao editar o título ou a data. Links de atividades excluídas/arquivadas exibem indisponibilidade. Falhas de rede têm mensagem e botão para tentar novamente. Uma atividade recém-criada na fila só permite copiar o link depois da confirmação do salvamento.

A API `GET /api/catalog/activities/:id` consulta uma atividade por ID e usa exatamente a mesma projeção pública do calendário. Não retorna autor, e-mail, caminho interno do storage ou credenciais. Não aceita gravações nem acesso a coleções arbitrárias. Os endpoints de documentos e gerenciamento mantêm suas permissões anteriores.

O popup carrega apenas a atividade solicitada; a consulta completa do calendário começa ao fechar ou escolher **Ver na agenda**. As respostas usam `no-store`, para que o link consulte os dados atuais.
