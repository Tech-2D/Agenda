import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { LoaderCircle, UserRound } from 'lucide-react'
import { db } from './firebase'
import { filterRepresentatives, type ApprovedRepresentative } from './representatives'

export function RepresentativesPanel() {
  const [items, setItems] = useState<ApprovedRepresentative[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const visible = useMemo(() => filterRepresentatives(items, search), [items, search])

  useEffect(() => onSnapshot(collection(db, 'representativeInvites'), snapshot => {
    setItems(snapshot.docs.map(item => {
      const data = item.data()
      return {
        id: item.id,
        email: typeof data.email === 'string' ? data.email : item.id,
        turmaId: typeof data.turmaId === 'string' ? data.turmaId : 'Turma não informada',
        approvedAt: data.approvedAt && typeof data.approvedAt.toDate === 'function' ? data.approvedAt.toDate() : null,
      }
    }))
    setError('')
    setLoading(false)
  }, () => {
    setItems([])
    setLoading(false)
    setError('Não foi possível carregar os representantes. Confira sua permissão de administrador e tente abrir esta aba novamente.')
  }), [])

  return (
    <section className="representatives-panel" aria-labelledby="approved-representatives-title">
      <div className="admin-list-heading">
        <strong id="approved-representatives-title">Representantes aprovados</strong>
        {!loading && !error && <span>{items.length} aprovado(s)</span>}
      </div>
      <p className="representative-hint">E-mails liberados para representar as turmas. A aprovação não confirma que a pessoa já criou uma conta ou entrou no sistema.</p>
      <div className="admin-list-heading">
        <label htmlFor="representatives-search">Buscar por e-mail ou turma</label>
        <input id="representatives-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite o e-mail ou a turma" />
      </div>
      {loading ? <p className="admin-empty" role="status"><LoaderCircle size={18} /> Carregando representantes...</p>
        : error ? <p role="alert">{error}</p>
          : <div className="admin-list">
            {visible.length === 0 ? <p className="admin-empty">{items.length ? 'Nenhum representante corresponde à busca.' : 'Nenhum representante aprovado ainda.'}</p>
              : visible.map(item => (
                <article key={item.id} className="admin-row compact representative-row">
                  <div className="avatar"><UserRound /></div>
                  <div className="admin-row-main"><strong>{item.email}</strong><span>{item.turmaId}</span></div>
                  <div className="admin-row-meta"><span>Aprovado em</span><strong>{item.approvedAt ? item.approvedAt.toLocaleDateString('pt-BR') : 'Não informado'}</strong></div>
                </article>
              ))}
          </div>}
    </section>
  )
}
