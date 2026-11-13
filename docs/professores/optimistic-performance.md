# Salvamento em segundo plano e responsáveis no Kanban

Atualização de 09/11/2026 para a Agenda e a API SQL. Firebase continua responsável apenas pela autenticação desses fluxos; não há fallback de gravação para o Firestore.

## Comportamento

- Mudanças nos quadros pessoais e compartilhados aparecem imediatamente e entram em uma fila de envio. Criar/editar atividades comuns sem novos arquivos também usa a fila.
- O aviso global diferencia pendência, envio e falha. A confirmação só aparece depois da resposta do servidor. Uma falha preserva o rascunho para copiar, revisar ou tentar novamente quando for um erro transitório.
- A fila fica **somente na memória desta página**. É necessário manter a página e a conta abertas até terminar. Fechar/recarregar pode perder rascunhos; o navegador recebe um aviso de saída. Não há promessa de persistência offline ou sincronização entre abas.
- Cada documento encadeia sua próxima alteração pela versão confirmada. Conflitos e falta de permissão pausam aquele documento, sem sobrescrever a edição de outra pessoa nem bloquear documentos independentes. Repetições de transporte usam o mesmo identificador de commit.
- A troca de conta descarta respostas antigas e cancela alterações ainda não iniciadas. Um pedido já enviado pode ter sido concluído antes da troca.
- Uploads, recorrências, criação de quadros compartilhados, exclusões e mudanças de acesso continuam aguardando confirmação.
- Tarefas compartilhadas podem ter um responsável entre o dono e os participantes aprovados. Todos os participantes continuam vendo a tarefa. A lista de seleção retorna somente identificador e nome; não divulga e-mails. Atribuições antigas são preservadas se alguém sair do quadro e passam a mostrar participante indisponível.

## API

Leituras privadas combinam estado da migração e perfil em uma consulta. As consultas auxiliares de permissão são memorizadas apenas dentro do pedido, nunca entre contas ou pedidos. A agenda pública reúne atividades e catálogo em uma consulta SQL com os limites existentes.

O commit pode solicitar `returnDocuments: true`: recebe documentos que o chamador tem permissão de ler e suas versões, evitando uma segunda leitura após salvar. Replays não retornam conteúdo privado. A fila consulta novamente nesse caso e exige a versão exata esperada, sem adotar silenciosamente alterações de outro editor.

Leituras idênticas simultâneas são agrupadas no cliente apenas durante a requisição. Notificações locais atualizam somente assinaturas dos caminhos afetados. O cache CORS de 10 minutos cobre apenas o preflight; autenticação e permissões continuam verificadas em cada operação real.

## Verificação e medida

Testes cobrem a fila, versões, coalescência de edições, isolamento de contas, troca durante leitura/retry, falhas de permissão, ausência de fallback, atribuição a participantes e não divulgação de dados privados. A verificação em produção cria um único quadro temporário da conta de teste e o remove, sem alterar quadros existentes.

Amostra pequena de cinco consultas por cenário, feita deste computador em 09/11/2026, antes/depois da publicação:

| Consulta | Mediana antes | Mediana depois |
| --- | ---: | ---: |
| Agenda pública da turma | 330 ms | 220 ms |
| Documento pessoal autenticado | 715 ms | 630 ms |

Esses números variam com rede, região e carga; não representam SLA. O ganho estrutural é reduzir viagens ao banco e leituras de confirmação. O bundle principal ainda contém o SDK existente e continua gerando o aviso de tamanho do Vite; esta mudança não afirma resolver todo o carregamento inicial.

Para repetir a medida, execute `node scripts/benchmark-api.js` na raiz de [Tech-2D/api](https://github.com/Tech-2D/api). Para incluir a leitura autenticada, defina `TEST_ADMIN_EMAIL` com a conta de teste. O script imprime as durações.
