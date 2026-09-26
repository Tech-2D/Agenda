import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { Notice } from './notices'

export function useTurmaNotices(turmaId: string | null) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setNotices([])
    setError('')
    if (!turmaId) { setLoading(false); return }
    setLoading(true)
    return onSnapshot(query(collection(db, 'boardNotices'), where('turmaId', '==', turmaId)), (snapshot) => {
      setNotices(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Notice))
      setLoading(false)
    }, () => {
      setLoading(false)
      setError('Não foi possível carregar o quadro de avisos.')
    })
  }, [turmaId])

  return { notices, loading, error }
}

// Um "agora" que só avança a cada minuto, para avisos expirarem sem recarregar a página.
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}
