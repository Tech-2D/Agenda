# Agenda da turma

Calendário mensal com tarefas, lições, trabalhos e eventos por turma. A leitura é pública (sem login); representantes e o super-admin autenticam para criar, editar e excluir atividades.

Passe o mouse sobre um dia com atividades (ou foque nele pelo teclado) para ler o conteúdo completo sem sair do calendário. No celular, toque no dia para abrir os detalhes.

## Tecnologias

- React + TypeScript + Vite
- Firebase Authentication
- Cloud Firestore

## Configurar o Firebase

Os sites **Agenda** e **Cadê o professor?** usam o mesmo projeto Firebase central, `d-tech-56a76`, mantendo coleções separadas no mesmo Firestore.

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
- Qualquer representante (de qualquer turma) ou o super-admin pode criar um evento geral. Só quem criou ou o super-admin pode editar/excluir um evento geral depois — diferente das atividades de turma, que qualquer representante daquela turma específica pode gerenciar.

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

## Publicar no GitHub Pages

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
