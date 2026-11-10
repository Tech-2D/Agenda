import { useEffect } from 'react'
import { ArrowRight, CalendarDays, LayoutGrid, Settings, StickyNote, Users, X } from 'lucide-react'
import { SQL_ENABLED } from './dataBackend'

export type GuideFeature = 'kanban' | 'settings' | 'admin' | 'notices'

export function AgendaGuide({ hasClass, onClose, onCalendar, onFeature }: {
  hasClass: boolean
  onClose: () => void
  onCalendar: () => void
  onFeature: (feature: GuideFeature) => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="admin-dialog agenda-guide" role="dialog" aria-modal="true" aria-labelledby="agenda-guide-title">
        <div className="dialog-header">
          <div><p className="eyebrow">GUIA DA AGENDA</p><h2 id="agenda-guide-title">Comece por aqui</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar guia" autoFocus><X /></button>
        </div>
        <div className="config-content agenda-guide-content">
          <section className="agenda-guide-start" aria-labelledby="agenda-guide-start-title">
            <div className="agenda-guide-start-heading"><CalendarDays size={21} aria-hidden="true" /><h3 id="agenda-guide-start-title">Consulte sua turma</h3><span className="agenda-guide-badge">Sem login</span></div>
            <ol>
              <li><strong>Escolha sua turma.</strong> O navegador lembra a sua escolha.</li>
              <li><strong>Veja o dia, a semana ou o mês.</strong> Use <b>Hoje</b> para voltar à data atual e o filtro para ver uma matéria de cada vez.</li>
              <li><strong>Abra a atividade.</strong> Clique no dia ou em <b>Ver detalhes</b> para ler as orientações e abrir os anexos. Use <b>Copiar link</b> para enviar a atividade a alguém.</li>
            </ol>
            <button type="button" className="primary-button" onClick={onCalendar}>{hasClass ? 'Ver calendário' : 'Escolher minha turma'} <ArrowRight size={16} aria-hidden="true" /></button>
          </section>
          <div className="agenda-guide-grid">
            <section className="agenda-guide-card">
              <StickyNote size={18} aria-hidden="true" /><h3>Acompanhar a turma</h3>
              <p>Veja comunicados no <b>Quadro de avisos</b> e alterações recentes em <b>Notificações</b>. Para votar em enquetes, entre com sua conta e peça aprovação ao representante.</p>
              {hasClass && <button type="button" className="text-button" onClick={() => onFeature('notices')}>Abrir quadro de avisos</button>}
            </section>
            <section className="agenda-guide-card">
              <LayoutGrid size={18} aria-hidden="true" /><h3>Organizar tarefas em grupo</h3>
              <p>Entre com sua conta em <b>Meu Kanban</b> para criar quadros pessoais ou compartilhados. Ao receber um convite, abra o link e peça acesso.</p>
              <p>Se você criou o quadro, abra <b>Compartilhados → Compartilhar e acessos</b> para aprovar os pedidos.</p>
              <button type="button" className="text-button" onClick={() => onFeature('kanban')}>Abrir Meu Kanban</button>
            </section>
            <section className="agenda-guide-card">
              <Settings size={18} aria-hidden="true" /><h3>Ajustar a Agenda ao seu jeito</h3>
              <p>Mude o tema, aumente a fonte ou reduza as animações nas <b>Configurações</b>. Também dá para personalizar o menu e ativar o resumo semanal por e-mail com sua conta.</p>
              <button type="button" className="text-button" onClick={() => onFeature('settings')}>Abrir configurações</button>
            </section>
            <section className="agenda-guide-card">
              <Users size={18} aria-hidden="true" /><h3>Publicar atividades da turma</h3>
              <p>Representantes aprovados podem cadastrar e editar atividades da própria turma. Para sugerir uma atividade, abra <b>Sugerir atividade</b> em <b>Ver mais opções</b>.</p>
              <button type="button" className="text-button" onClick={() => onFeature('admin')}>Sou representante</button>
            </section>
          </div>
          <details className="agenda-guide-data">
            <summary>Seus dados</summary>
            <p>O navegador guarda preferências como a turma selecionada, o tema e os ajustes de acessibilidade.</p>
            {SQL_ENABLED && <>
              <p>Para medir o uso da Agenda, registramos o ID da conta em acessos com login. Em visitas anônimas, registramos um código diário derivado do IP.</p>
              <p>Superadministradores podem consultar o último acesso de contas, incluindo e-mail e UID, e gerenciar bloqueios por e-mail ou rede. O IP é convertido em um código. Os registros de acesso são removidos após 90 dias, e os bloqueios ficam ativos até serem removidos.</p>
            </>}
          </details>
        </div>
      </section>
    </div>
  )
}
