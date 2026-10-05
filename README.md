# Agenda da turma

Calendário mensal com tarefas, lições, trabalhos e eventos por turma. A leitura é pública (sem login); representantes e o super-admin autenticam para criar, editar e excluir atividades.

Passe o mouse sobre um dia com atividades (ou foque nele pelo teclado) para ler o conteúdo completo sem sair do calendário. No celular, toque no dia para abrir os detalhes.

Depois de entrar como representante ou super-admin, abra um dia no calendário e clique em **Editar atividade**. O representante pode alterar atividades da própria turma, inclusive as publicadas por outro representante da mesma turma. Somente o super-admin pode editar outras turmas e eventos gerais. Ao salvar, a tela volta ao calendário. Editar uma ocorrência semanal não modifica o modelo das próximas semanas.

## Tecnologias

- React + TypeScript + Vite
- Firebase Authentication
- Cloud Firestore

## Tarefas que se repetem

Na área do representante, marque **Repetir toda semana** ao cadastrar uma atividade. A data escolhida vira a primeira ocorrência; o campo **Repetir até** é opcional. A aba **Repetições** mostra os agendamentos da turma e permite pausá-los, reativá-los ou excluí-los. Excluir encerra a série e remove imediatamente as ocorrências de hoje em diante, preservando o histórico anterior. O modelo fica marcado como excluído, sem opção de reativar; se a limpeza falhar, ele permanece pausado na lista para uma nova tentativa. Cada ocorrência pode ser editada individualmente em **Atividades**, mas o modelo semanal permanece igual.

A automação fica no repositório privado [`Tech-2D/agenda-recorrencias`](https://github.com/Tech-2D/agenda-recorrencias). Ela roda a cada seis horas, gera até oito semanas à frente e não duplica atividades. Quando um agendamento é pausado, a próxima execução remove suas ocorrências de hoje em diante, mantendo as anteriores. A automação depende do secret `FIREBASE_SERVICE_ACCOUNT` configurado nesse repositório e das regras atualizadas do Firestore.

## Chat dos representantes

A aba **Chat** no painel é um grupo privado para representantes aprovados e super-admin. As mensagens aparecem em tempo real com e-mail e turma do autor. Alunos e visitantes não podem ler ou enviar mensagens. O histórico exibe as últimas 100 mensagens; o autor ou o super-admin podem remover uma mensagem, mas não editar nem alterar a identidade do remetente. Não há chatbot ou respostas automáticas.

As mensagens ficam em `representativeChat`. Publique as regras atualizadas do Firestore antes de usar o chat. Este histórico não entra no expurgo de atividades.

## Expurgo de atividades antigas

Na aba **Expurgo**, o representante define um prazo de 30 a 730 dias para a própria turma ou mantém a limpeza desligada. A regra abrange tarefas, lições, trabalhos, provas e eventos da turma; eventos gerais e outras turmas não são afetados. A tela mostra uma estimativa das atividades que já se enquadram no prazo e pede confirmação para ativar. Toda regra nova ou alterada espera 24 horas antes da primeira exclusão.

O cron diário fica no repositório privado [`Tech-2D/agenda-expurgo`](https://github.com/Tech-2D/agenda-expurgo). Antes de remover cada atividade do calendário, ele salva uma cópia completa em `purgedActivities`. Os backups só podem ser lidos com o Admin SDK. O cron exige o secret `FIREBASE_SERVICE_ACCOUNT` nesse repositório e as regras atualizadas do Firestore. Veja o README da automação para os limites, a simulação e a recuperação manual.

## Configurar o Firebase

Os sites **Agenda** e **Cadê o professor?** usam o mesmo projeto Firebase central, `d-tech-8555e`, mantendo coleções separadas no mesmo Firestore.

1. No Console do Firebase, abra **Authentication > Sign-in method** e habilite **E-mail/senha**.
2. Crie a conta do super-admin em **Authentication > Users**. No Firestore, crie `admins/{uid}` com `{ "role": "superadmin" }` (o UID é o ID da conta). Representantes não precisam mais ser cadastrados manualmente.
3. Publique as regras deste repositório com `firebase deploy --only firestore:rules` ou cole o conteúdo de [`firestore.rules`](firestore.rules) no Console do Firebase. Os dois sites compartilham o mesmo Firestore; mantenha as regras também sincronizadas com o repositório **professores**. **Sempre que `firestore.rules` mudar**, republique.
4. Na Agenda, o interessado entra em **Sou representante > Solicitar acesso**, informa e-mail e turma e guarda o código da solicitação. O super-admin analisa na aba **Representantes** e aprova ou recusa. Depois de aprovado, o interessado cria a conta com o mesmo e-mail e uma senha; o documento `admins/{uid}` é criado automaticamente para a turma aprovada, sem etapa de confirmação por e-mail.
5. O valor de `turmaId` precisa ser **idêntico, caractere a caractere**, a um dos valores de [`src/classNames.ts`](src/classNames.ts). Se as turmas mudarem, atualize também a lista em `firestore.rules`.
6. Configure o TTL da coleção `suggestions` para expirar sugestões com mais de 30 dias: **Firestore Database > TTL** no Console, crie uma política apontando para o campo `createdAt` da coleção `suggestions`. Sem isso, as sugestões continuam funcionando normalmente — só não são apagadas sozinhas depois de 30 dias.

> Variáveis `VITE_*` são incorporadas ao JavaScript público. Por isso, nunca coloque senhas em `.env`, no Firestore ou nos secrets do GitHub. O site pede e-mail e senha, valida pelo Firebase Authentication e só libera o painel se o UID autenticado tiver um documento em `admins` com `role` igual a `representante` ou `superadmin`.
>
> **Atenção:** sem confirmação por e-mail, quem souber um endereço aprovado pode cadastrar uma senha para esse endereço antes do titular. Aprove solicitações somente quando você conhece e confia em quem as enviou. Para comprovar a posse do endereço, é necessário voltar a exigir a verificação por e-mail.

## Rodar localmente

```bash
npm install
npm run dev
```

O arquivo `.env.local` (baseado em `.env.example`) é opcional e serve só para sobrescrever a configuração pública do Firebase já embutida em `src/firebase.ts`.

A leitura pública (agenda, horários, atualizações) passa por uma API própria em Cloudflare Workers, não mais por Firestore direto — veja `src/catalogTransport.ts`. Essa API só libera CORS para a origem de produção, então rodando via `npm run dev` a agenda não carrega nada por padrão. Para contornar isso em desenvolvimento, adicione ao `.env.local`:

```
VITE_PUBLIC_QUERY_API_URL=/api/catalog
```

Isso faz o navegador enxergar `/api/catalog` como mesma origem; o proxy configurado em `vite.config.ts` repassa a chamada pro Worker por fora do navegador, sem o bloqueio de CORS.

## Estrutura dos dados

### `activities/{activityId}`

```json
{
  "title": "Prova de Matemática",
  "description": "Capítulos 3 a 5",
  "type": "trabalho",
  "subject": "Matemática",
  "date": "2026-09-25",
  "time": "14:00",
  "turmaId": "2° TECH D",
  "createdByEmail": "representante@escola.com"
}
```

- `type`: `"tarefa"` | `"licao"` | `"trabalho"` | `"prova"` | `"evento"`
- `subject`: matéria (string) ou `null` — opcional, lista fixa em [`src/subjects.ts`](src/subjects.ts). Usado no filtro "Todas as matérias" do calendário público.
- `date`: data específica no formato `YYYY-MM-DD`
- `time`: horário opcional no formato `HH:MM`, ou `null`
- `turmaId`: string da turma, ou `null` para **evento geral** (aparece no calendário de todas as turmas). Pode ser alterado depois, editando a atividade e marcando/desmarcando "Evento geral" — assim dá pra converter entre turma específica e geral.
- `createdByEmail`: e-mail de quem criou, guardado só na criação (não muda se outra pessoa editar depois). Mostrado publicamente no card da atividade. Atividades criadas antes dessa mudança não têm esse campo e simplesmente não mostram autor.
- Qualquer representante (de qualquer turma) ou o super-admin pode criar um evento geral. Somente o super-admin pode editá-lo; a exclusão continua disponível para o autor ou super-admin. Atividades de turma podem ser editadas pelos representantes daquela turma ou pelo super-admin.
- Ocorrências de tarefas semanais incluem `recurringId`; o cron cria cada uma com ID fixo (`{recurringId}_{YYYY-MM-DD}`). Para parar a repetição, pause o modelo na aba **Repetições**, não exclua uma ocorrência isolada.

### `recurringActivities/{id}`

Modelo de atividade semanal criado por um representante da turma ou pelo super-admin. Guarda os mesmos campos de título, tipo, matéria, descrição e horário de uma atividade, além de `turmaId`, `startDate`, `endDate` (opcional), `active`, `createdBy`, `createdByEmail` e `createdAt`. O navegador só pode mudar `active` depois da criação; a automação com Admin SDK gera e remove as ocorrências em `activities`.

### `admins/{uid}`

Documento de permissão. O super-admin inicial é criado manualmente no Console. Para um representante, o app cria o documento automaticamente quando há convite aprovado para o e-mail autenticado.

```json
{ "role": "representante", "turmaId": "2° TECH D" }
```
ou
```json
{ "role": "superadmin" }
```

A lista de turmas é fixa em [`src/classNames.ts`](src/classNames.ts) — edite ali se as turmas mudarem.

### `representativeRequests/{requestId}` e `representativeInvites/{email}`

`representativeRequests` guarda e-mail, turma, status (`pendente`, `aprovada` ou `rejeitada`) e datas de criação/análise. Qualquer visitante pode enviar um pedido e consultar **somente pelo ID aleatório** que recebeu; a listagem é exclusiva do super-admin. Evite enviar dados sensíveis além do e-mail.

Ao aprovar, o app cria `representativeInvites/{email}` com a turma autorizada e atualiza o pedido na mesma gravação atômica. Apenas o super-admin pode criar ou apagar convites. O representante só consegue criar `admins/{uid}` se estiver autenticado com aquele e-mail e a turma for exatamente a do convite. Contas criadas antes da aprovação podem receber acesso ao entrar novamente depois da aprovação.

### `suggestions/{suggestionId}`

Sugestão de atividade enviada por um aluno (sem login), pendente de avaliação do representante. Mesmo formato de `activities`, mais o campo `status`:

```json
{
  "title": "Revisão para a prova de POO",
  "description": "",
  "type": "tarefa",
  "date": "2026-09-25",
  "time": null,
  "turmaId": "2° TECH D",
  "status": "pendente"
}
```

- `status`: `"pendente"` | `"aprovada"` | `"rejeitada"` — só pode ser alterado pelo representante/superadmin daquela turma, nunca pelo autor da sugestão.
- Ao aprovar, o app cria automaticamente um documento em `activities` com os mesmos dados e marca a sugestão como `"aprovada"`.
- Expira sozinha 30 dias após a criação (ver TTL na configuração do Firebase acima).
- O aluno acompanha o status das próprias sugestões via um ID salvo no `localStorage` do navegador (tela "Minhas sugestões") — não há login nem outra forma de "dono" do documento.

### `feedback/{feedbackId}`

Comentário de melhoria sobre o site (não é por turma). Para enviar, a pessoa precisa entrar ou criar uma conta com e-mail e senha. O documento guarda o UID e o e-mail da conta autenticada; somente o super-admin vê o comentário e o autor na área administrativa. Comentários antigos continuam visíveis, mas aparecem sem identificação. O Firebase Authentication não comprova a posse do e-mail sem uma etapa de verificação.

```json
{
  "message": "Seria legal ter uma visão semanal também",
  "turmaId": "2° TECH D",
  "createdBy": "uid-da-conta",
  "createdByEmail": "aluno@exemplo.com",
  "createdAt": "2026-09-25T14:00:00Z"
}
```

- `turmaId`: turma que a pessoa tinha selecionada ao enviar (contexto), ou `null`.
- Representantes (não super-admin) não têm acesso a essa tela — é sobre o site inteiro, não sobre uma turma.

### `announcement/latest`

Documento único (ID fixo `latest`) com o aviso atual mostrado para todo mundo — um modal "O que mudou" que aparece uma vez por pessoa (controlado por `localStorage`) sempre que o super-admin publica uma mensagem nova. Leitura pública; só o super-admin publica, edita ou remove, pela aba **Site** da área administrativa.

```json
{
  "message": "Agora dá pra sugerir atividades! Toca no ícone de lâmpada no topo da agenda.",
  "updatedAt": "2026-09-25T14:00:00Z"
}
```

### `boardNotices/{noticeId}`

Post-its do quadro de avisos de uma turma. Leitura pública (sem login); só os representantes da própria turma e o super-admin criam, editam e apagam. Representantes de outras turmas não podem alterar o quadro.

```json
{
  "turmaId": "2° TECH D",
  "title": "Prova de Estatística",
  "body": "Trazer calculadora científica.",
  "type": "urgente",
  "expiresAt": "2026-10-26T12:00:00Z",
  "purgeAt": "2026-11-25T12:00:00Z",
  "createdBy": "uid-do-autor",
  "authorEmail": "representante@exemplo.com",
  "createdAt": "2026-09-26T12:00:00Z",
  "updatedAt": "2026-09-26T12:00:00Z"
}
```

- `type`: `urgente`, `aviso` ou `lembrete`. `title` até 60 caracteres e `body` até 500.
- `expiresAt` é obrigatório (padrão de 30 dias, máximo de 365). Depois dele o aviso some da home e do quadro público, mas continua na aba do painel como "expirado".
- `purgeAt` é sempre `expiresAt` + 30 dias (as regras conferem). **Configure uma política de TTL do Firestore** na coleção `boardNotices` sobre o campo `purgeAt` (Console > Firestore > TTL). Sem ela, os avisos não são apagados. Este expurgo não passa pelo repositório `agenda-expurgo`.
- `authorEmail` é gravado e lido publicamente, por decisão do produto. `turmaId`, `createdBy`, `authorEmail` e `createdAt` não mudam depois da criação.
- Republique as regras do Firestore antes de usar o quadro.

## Publicar no GitHub Pages

### Anexos de atividades

O formulário pode anexar até cinco PDF, DOCX, PPTX, ZIP ou imagens de até 50 MB cada. Os arquivos ficam no bucket R2 privado `tech-2d-agenda`; a atividade guarda apenas `attachments` com nome, tipo, tamanho, caminho e data. Qualquer visitante pode baixar anexos por URL temporária, enquanto somente o representante da turma ou o super-admin pode enviar/remover. Anexos de repetições ainda não são suportados. ZIPs não são descompactados no servidor.

O recurso foi ativado em produção após publicar as regras e validar envio, download e remoção. Em novos ambientes continua **desligado por padrão**. Para ativá-lo com segurança: (1) publique `firestore.rules` para impedir alterações diretas dos metadados; (2) confira os secrets `R2_*` e `CRON_SECRET` no backend Vercel e `R2_*` no cron de expurgo; (3) ative `R2_UPLOAD_ENABLED=true` na Vercel e republique a API, mantendo a interface oculta durante o teste; (4) teste upload, abertura e exclusão com atividade de teste; (5) defina a variável de repositório `VITE_ATTACHMENTS_ENABLED=true` e execute o workflow de publicação. Se as regras ainda não foram publicadas, **não ative** a opção no site.

1. Em **Settings > Pages**, selecione **GitHub Actions** como fonte de publicação.
2. Envie as alterações para a branch `main`. O workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) faz a publicação automaticamente.

## Comandos

```bash
npm run dev        # desenvolvimento
npm run test       # testes
npm run lint        # análise estática
npm run typecheck   # checagem de tipos
npm run build       # build de produção
```
