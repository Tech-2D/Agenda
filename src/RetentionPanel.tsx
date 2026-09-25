import { type FormEvent, useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { dateKey } from './calendar'
import { countExpiredActivities, MAX_RETENTION_DAYS, MIN_RETENTION_DAYS } from './retention'

type Props = {
  turmaId: string
  userId: string
  activityDates: string[]
}

export function RetentionPanel({ turmaId, userId, activityDates }: Props) {
  const [days, setDays] = useState(180)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => onSnapshot(doc(db, 'activityRetention', turmaId), (snapshot) => {
    const value = snapshot.data()
    setDays(typeof value?.days === 'number' ? value.days : 180)
    setEnabled(value?.enabled === true)
    setLoading(false)
  }, () => {
    setLoading(false)
    setMessage('Não foi possível carregar a regra desta turma. Confira as permissões do Firestore.')
  }), [turmaId])

  const validDays = Number.isInteger(days) && days >= MIN_RETENTION_DAYS && days <= MAX_RETENTION_DAYS
  const estimate = validDays ? countExpiredActivities(activityDates, dateKey(new Date()), days) : 0

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validDays) return
    if (enabled && !window.confirm(`Ativar o expurgo de ${turmaId}? Após 24 horas, atividades com mais de ${days} dias sairão da Agenda. ${estimate} atividade(s) atual(is) já se enquadram. Uma cópia será arquivada antes da remoção.`)) return
    setSaving(true)
    setMessage('')
    try {
      await setDoc(doc(db, 'activityRetention', turmaId), {
        turmaId,
        days,
        enabled,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      })
      setMessage(enabled ? 'Regra salva. Você tem 24 horas para desativá-la antes do primeiro expurgo.' : 'Expurgo desativado para esta turma.')
    } catch {
      setMessage('Não foi possível salvar a regra. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="retention-panel" aria-labelledby="retention-title">
      <div className="admin-list-heading"><strong id="retention-title">Limpeza automática da turma</strong></div>
      <p>Defina por quanto tempo as atividades antigas de <strong>{turmaId}</strong> continuam na Agenda. Tarefas, lições, trabalhos, provas e eventos da turma entram nessa regra. Eventos gerais e outras turmas não são afetados.</p>
      {loading ? <p>Carregando regra…</p> : (
        <form onSubmit={save}>
          <label>Manter atividades por
            <span className="retention-number"><input type="number" min={MIN_RETENTION_DAYS} max={MAX_RETENTION_DAYS} step="1" value={days} onChange={(event) => setDays(Number(event.target.value))} required /> dias</span>
          </label>
          <label className="retention-checkbox"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Ativar expurgo automático</label>
          <div className="retention-preview"><strong>{estimate} atividade{estimate === 1 ? '' : 's'} antiga{estimate === 1 ? '' : 's'}</strong><span>se enquadra{estimate === 1 ? '' : 'm'} no prazo escolhido hoje</span></div>
          <p className="config-hint">Uma regra nova ou alterada só começa a apagar após 24 horas. Antes de remover, a automação salva uma cópia em <code>purgedActivities</code>. O expurgo roda diariamente.</p>
          <button type="submit" className="primary-button compact" disabled={saving || !validDays}>{saving ? 'Salvando…' : 'Salvar regra'}</button>
          {message && <p className="retention-message" role="status">{message}</p>}
        </form>
      )}
    </section>
  )
}
