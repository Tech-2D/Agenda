import { sitePaths } from './sitePaths'
import type { ReactNode } from 'react'
import { Bell, BookOpen, Calculator, CalendarClock, History, KeyRound, LayoutGrid, Lightbulb, ListChecks, MapPin, MessageSquarePlus, Plus, Settings, StickyNote, UserRound } from 'lucide-react'
import type { MenuShortcutId } from './menuShortcuts'

export type MoreOption = {
  id: MenuShortcutId
  title: string
  description: string
  icon: ReactNode
  onClick?: () => void
  href?: string
  disabled?: boolean
  pendingLabel?: string
}

export type MoreOptionSection = {
  id: 'estudos' | 'turma' | 'conta' | 'ajuda' | 'outros'
  title: string
  items: MoreOption[]
}

export function menuOptionSections({ hasTurma, actions, todayClassesUrl, unreadCount, hasUnseenUpdate }: {
  hasTurma: boolean
  actions: Partial<Record<MenuShortcutId, () => void>>
  todayClassesUrl?: string
  unreadCount: number
  hasUnseenUpdate: boolean
}): MoreOptionSection[] {
  const notificationsBadge = unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? 'não lida' : 'não lidas'}` : undefined
  return [
    {
      id: 'estudos',
      title: 'Estudos',
      items: [
        { id: 'teachers', title: 'Professores', description: 'Busque professores, matérias e salas.', icon: <MapPin />, href: sitePaths.professores },
        { id: 'todayClasses', title: 'Aulas de hoje', description: hasTurma ? 'Consulte os horários e salas de hoje.' : 'Defina a turma padrão em “Minha turma”.', icon: <CalendarClock />, href: todayClassesUrl, disabled: !hasTurma },
        { id: 'pegaki', title: 'Notaki', description: 'Calcule médias e simule notas.', icon: <Calculator />, href: sitePaths.pegaki },
        { id: 'kanban', title: 'Kanban', description: 'Organize suas tarefas em quadros privados.', icon: <LayoutGrid />, onClick: actions.kanban },
      ],
    },
    {
      id: 'turma',
      title: 'Minha turma',
      items: [
        { id: 'notifications', title: 'Notificações da turma', description: 'Veja atividades novas ou alteradas.', icon: <Bell />, onClick: actions.notifications, pendingLabel: notificationsBadge },
        { id: 'notices', title: 'Quadro de avisos', description: hasTurma ? 'Consulte os comunicados da turma.' : 'Selecione sua turma para ver os comunicados.', icon: <StickyNote />, onClick: actions.notices, disabled: !hasTurma },
        { id: 'suggestActivity', title: 'Sugerir atividade', description: hasTurma ? 'Peça para incluir uma atividade na Agenda.' : 'Selecione sua turma para sugerir uma atividade.', icon: <Lightbulb />, onClick: actions.suggestActivity, disabled: !hasTurma },
        { id: 'requestClass', title: 'Pedir agenda para minha turma', description: 'Solicite uma agenda para uma turma que ainda não aparece.', icon: <Plus />, onClick: actions.requestClass },
      ],
    },
    {
      id: 'conta',
      title: 'Conta e atalhos',
      items: [
        { id: 'settings', title: 'Configurações', description: 'Ajuste o tema, o tamanho do texto e a acessibilidade.', icon: <Settings />, onClick: actions.settings },
        { id: 'profiles', title: 'Perfis da comunidade', description: 'Edite seu perfil e conheça outras pessoas.', icon: <UserRound />, onClick: actions.profiles },
      ],
    },
    {
      id: 'ajuda',
      title: 'Ajuda e sugestões',
      items: [
        { id: 'help', title: 'Como funciona', description: 'Veja como usar a Agenda.', icon: <BookOpen />, onClick: actions.help },
        { id: 'updates', title: 'Histórico de atualizações', description: 'Confira as mudanças recentes no portal.', icon: <History />, onClick: actions.updates, pendingLabel: hasUnseenUpdate ? 'Nova atualização' : undefined },
        { id: 'feedback', title: 'Comentar melhoria', description: 'Envie uma ideia para a equipe.', icon: <MessageSquarePlus />, onClick: actions.feedback },
        { id: 'mySuggestions', title: 'Minhas sugestões', description: 'Acompanhe as ideias que você enviou.', icon: <ListChecks />, onClick: actions.mySuggestions },
      ],
    },
    {
      id: 'outros',
      title: 'Outros recursos',
      items: [
        { id: 'admin', title: 'Painel da Agenda', description: 'Acesse o painel ou solicite acesso de representante.', icon: <KeyRound />, href: sitePaths.admin },
        { id: 'pong', title: 'Liga Germinare Pong', description: 'Conheça a liga de tênis de mesa.', icon: <TableTennisPaddle />, href: 'https://ligagerminare-pong.vercel.app/' },
      ],
    },
  ]

}

function TableTennisPaddle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <path d="m13.3 14.2 6.2 7" strokeWidth="3.2" />
      <ellipse cx="9.2" cy="9.1" rx="5.7" ry="7" transform="rotate(-38 9.2 9.1)" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="2.2" strokeWidth="1.8" />
    </svg>
  )
}
