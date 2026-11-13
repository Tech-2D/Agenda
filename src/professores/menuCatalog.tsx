import type { ReactNode } from 'react'
import { Bell, BookOpen, Calculator, CalendarClock, History, KeyRound, LayoutGrid, Lightbulb, ListChecks, MapPin, MessageSquarePlus, Plus, Settings, StickyNote, UserRound, Vote } from 'lucide-react'
import type { MenuShortcutId } from './menuShortcuts'

export type MoreOption = {
  id: MenuShortcutId
  title: string
  description: string
  icon: ReactNode
  onClick?: () => void
  href?: string
  disabled?: boolean
}

export type MoreOptionSection = { title: string; description: string; items: MoreOption[] }

export function menuOptionSections({ hasTurma, actions, todayClassesUrl }: {
  hasTurma: boolean
  actions: Partial<Record<MenuShortcutId, () => void>>
  todayClassesUrl?: string
}): MoreOptionSection[] {
  const needsTurma = !hasTurma
  return [
    {
      title: 'Acompanhar a turma',
      description: 'Avisos e atividades da turma selecionada.',
      items: [
        { id: 'pegaki', title: 'Pegaki', description: 'Calcule suas médias e simule notas do Tech.', icon: <Calculator />, href: '/pegaki/' },
        { id: 'teachers', title: 'Cadê o professor?', description: 'Pesquise professores, matérias e salas.', icon: <MapPin />, href: '/professores/' },
        { id: 'notifications', title: 'Notificações', description: 'Veja atividades adicionadas ou alteradas recentemente.', icon: <Bell />, onClick: actions.notifications },
        { id: 'updates', title: 'Atualizações', description: 'Confira o que mudou no sistema da Agenda.', icon: <History />, onClick: actions.updates },
        { id: 'polls', title: 'Enquetes da turma', description: needsTurma ? 'Escolha uma turma para ver e responder enquetes.' : 'Acompanhe votações e participe das decisões.', icon: <Vote />, onClick: actions.polls, disabled: needsTurma },
        { id: 'notices', title: 'Quadro de avisos', description: needsTurma ? 'Escolha uma turma para abrir os avisos.' : 'Consulte comunicados importantes da turma.', icon: <StickyNote />, onClick: actions.notices, disabled: needsTurma },
        { id: 'suggestActivity', title: 'Sugerir atividade', description: needsTurma ? 'Escolha uma turma antes de enviar uma sugestão.' : 'Peça para incluir uma atividade na agenda.', icon: <Lightbulb />, onClick: actions.suggestActivity, disabled: needsTurma },
        { id: 'todayClasses', title: 'Aulas de hoje', description: needsTurma ? 'Escolha uma turma para consultar as aulas.' : 'Abra a localização das aulas de hoje.', icon: <CalendarClock />, href: todayClassesUrl, disabled: needsTurma },
      ],
    },
    {
      title: 'Participar e colaborar',
      description: 'Ajude a melhorar e ampliar a Agenda.',
      items: [
        { id: 'requestClass', title: 'Pedir agenda para minha turma', description: 'Solicite a criação de uma agenda para outra sala.', icon: <Plus />, onClick: actions.requestClass },
        { id: 'feedback', title: 'Comentar melhoria', description: 'Converse com a equipe sobre uma ideia para o sistema.', icon: <MessageSquarePlus />, onClick: actions.feedback },
        { id: 'mySuggestions', title: 'Minhas sugestões', description: 'Acompanhe o andamento das ideias que você enviou.', icon: <ListChecks />, onClick: actions.mySuggestions },
        { id: 'admin', title: 'Sou representante', description: 'Acesse as ferramentas para representantes de turma.', icon: <KeyRound />, onClick: actions.admin },
      ],
    },
    {
      title: 'Conta e ajuda',
      description: 'Personalize sua experiência e encontre orientações.',
      items: [
        { id: 'kanban', title: 'Meu Kanban', description: 'Entre com sua conta para organizar tarefas em quadros privados e personalizáveis.', icon: <LayoutGrid />, onClick: actions.kanban },
        { id: 'settings', title: 'Configurações', description: 'Ajuste tema, tamanho do texto e acessibilidade.', icon: <Settings />, onClick: actions.settings },
        { id: 'profiles', title: 'Perfis da comunidade', description: 'Edite seu perfil e conheça outras pessoas.', icon: <UserRound />, onClick: actions.profiles },
        { id: 'help', title: 'Como funciona', description: 'Entenda os recursos e como usar a Agenda.', icon: <BookOpen />, onClick: actions.help },
      ],
    },
    {
      title: 'Outros projetos',
      description: 'Acesse outras ferramentas da comunidade 2ºD Tech.',
      items: [
        { id: 'pong', title: 'Liga Germinare Pong', description: 'Acesse a liga de tênis de mesa.', icon: <TableTennisPaddle />, href: 'https://ligagerminare-pong.vercel.app/' },
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
