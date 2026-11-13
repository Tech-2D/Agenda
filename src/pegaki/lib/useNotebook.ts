import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import type { Grades } from '../components/SubjectRow'
import type { Year } from '../data/subjects'
import type { Modes } from './grades'
import { notebookRequest, NotebookError } from './notebook'

type Draft = { grades: Record<string, Grades>; modes: Modes }
function localDraft(year: Year): Draft {
  try {
    const legacy = JSON.parse(localStorage.getItem('aprovae:mode') || 'null')
    return { grades: JSON.parse(localStorage.getItem(`aprovae:v4:grades:${year}`) || '{}'), modes: JSON.parse(localStorage.getItem('aprovae:modes') || 'null') || { s1: legacy === 'media' ? 'media' : 'notas', s2: legacy === 'media' ? 'media' : 'notas' } }
  } catch { return { grades: {}, modes: { s1: 'notas', s2: 'notas' } } }
}
const empty = (): Draft => ({grades:{}, modes:{s1:'notas',s2:'notas'}})
export function useNotebook(user: User | null, year: Year, academicYear: number) {
  const [draft,setDraft] = useState<Draft>(() => user ? empty() : localDraft(year))
  const [saved,setSaved] = useState(() => JSON.stringify(draft))
  const [loading,setLoading] = useState(Boolean(user))
  const [saving,setSaving] = useState(false)
  const [ready,setReady] = useState(!user)
  const [error,setError] = useState('')
  const [conflict,setConflict] = useState(false)
  const [reload,setReload] = useState(0)
  const version = useRef(0)
  const alive = useRef(true)
  useEffect(() => { alive.current=true; return () => {alive.current=false} },[])
  useEffect(() => {
    if (!user) return
    let active=true
    setLoading(true);setReady(false);setError('');setConflict(false)
    notebookRequest(user,academicYear,year).then(notebook => {
      if(!active)return
      const next=notebook ? {grades:notebook.grades,modes:notebook.modes} : empty()
      version.current=notebook?.version??0
      setDraft(next);setSaved(JSON.stringify(next))
      setReady(true)
    }).catch(e=>{if(active)setError(e.message || 'Não foi possível carregar as notas.')}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[user,academicYear,year,reload])
  const dirty=Boolean(user) && JSON.stringify(draft)!==saved
  useEffect(()=>{
    if(user)return
    try {localStorage.setItem(`aprovae:v4:grades:${year}`,JSON.stringify(draft.grades));localStorage.setItem('aprovae:modes',JSON.stringify(draft.modes))}catch{/* local mode remains usable */}
  },[user,year,draft])
  useEffect(()=>{
    if(!dirty)return
    const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''}
    window.addEventListener('beforeunload',guard)
    return ()=>window.removeEventListener('beforeunload',guard)
  },[dirty])
  async function save() {
    if(!user || !ready || loading || saving || conflict)return
    const snapshot=draft
    setSaving(true);setError('')
    try {
      const result=await notebookRequest(user,academicYear,year,{...snapshot,version:version.current})
      if(!alive.current)return
      version.current=result!.version;setSaved(JSON.stringify(snapshot))
    }catch(e){if(alive.current){setError(e instanceof Error?e.message:'Não foi possível salvar.');setConflict(e instanceof NotebookError && e.status===409)}}
    finally{if(alive.current)setSaving(false)}
  }
  return {grades:draft.grades,modes:draft.modes,
    setGrades:(value:React.SetStateAction<Record<string,Grades>>)=>setDraft(d=>({...d,grades:typeof value==='function'?value(d.grades):value})),
    setModes:(value:React.SetStateAction<Modes>)=>setDraft(d=>({...d,modes:typeof value==='function'?value(d.modes):value})),
    dirty,loading,ready,saving,error,conflict,save,reload:()=>setReload(x=>x+1),
    canImport:Boolean(user) && !loading && !error && !dirty && Object.keys(draft.grades).length===0 && Object.keys(localDraft(year).grades).length>0,
    importLocal:()=>setDraft(localDraft(year)),
  }
}
