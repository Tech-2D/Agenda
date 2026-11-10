export type QueueKind = 'personal' | 'shared' | 'activity-create' | 'activity-update'
export type QueueDocument = {path:string;id:string;data:Record<string,unknown>;version:string | null}
export type QueueFailure = {code:string;message:string;retryable:boolean}
export type QueueView = {key:string;path:string;kind:QueueKind;value:QueueDocument;confirmed:QueueDocument | null;pending:number;failed:QueueFailure | null;label:string;sending:boolean}
type Job = {id:string;data:Record<string,unknown>;label:string;sequence:number;bytes:number;prepared?:unknown}
type Resource = {session:object;kind:QueueKind;path:string;base:QueueDocument | null;jobs:Job[];failure:QueueFailure | null;sending:boolean;view:QueueView}
type QueueOptions = {session:()=>object | null;prepare:(kind:QueueKind,path:string,data:Record<string,unknown>,base:QueueDocument | null,id:string)=>unknown;send:(request:unknown,session:object)=>Promise<QueueDocument>;project:(kind:QueueKind,path:string,base:QueueDocument | null,data:Record<string,unknown>)=>QueueDocument;failure:(error:unknown)=>QueueFailure;delay?:(ms:number)=>Promise<void>;changed?:(path:string)=>void}

// Memory-only, serialized writes. A failed resource is paused; unrelated resources can continue.
export class WriteQueue {
  private resources=new Map<string,Resource>()
  private listeners=new Set<()=>void>()
  private sequence=0
  private running=false
  private timer:ReturnType<typeof setTimeout> | undefined
  constructor(private options:QueueOptions){}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
  get=(key:string)=>this.resources.get(key)?.view
  pending=()=>[...this.resources.values()].filter(r=>r.jobs.length).map(r=>r.view)
  private notify(){for(const listener of this.listeners)listener()}
  private publish(key:string,r:Resource) {
    let value=r.base
    for(const job of r.jobs)value=this.options.project(r.kind,r.path,value,job.data)
    if(!value)return
    r.view={key,path:r.path,kind:r.kind,value,confirmed:r.base,pending:r.jobs.length,failed:r.failure,label:r.jobs.at(-1)?.label || r.view?.label || 'Salvar alteração',sending:r.sending}
    this.notify();this.options.changed?.(r.path)
  }
  seed(key:string,kind:QueueKind,path:string,base:QueueDocument | null) {
    const session=this.options.session(),old=this.resources.get(key)
    if(!session || old?.jobs.length)return
    if(!base){this.resources.delete(key);this.notify();return}
    const r:Resource={session,kind,path,base:structuredClone(base),jobs:[],failure:null,sending:false,view:null as unknown as QueueView}
    this.resources.set(key,r);this.publish(key,r)
  }
  enqueue(key:string,kind:QueueKind,path:string,base:QueueDocument | null,data:Record<string,unknown>,label:string,expectedVersion?:string | null) {
    const session=this.options.session()
    if(!session)throw Object.assign(Error('Entre novamente para salvar.'),{code:'unauthenticated'})
    let r=this.resources.get(key)
    if(r && r.session!==session){this.resources.delete(key);r=undefined}
    if(r?.failure)throw Object.assign(Error('Revise a pendência antes de continuar.'),{code:r.failure.code})
    if(!r?.jobs.length && expectedVersion!==undefined && expectedVersion!==(base?.version ?? null))throw Object.assign(Error('O quadro mudou. Atualize antes de salvar.'),{code:'aborted'})
    const count=this.pending().reduce((n,s)=>n+s.pending,0)
    if(count>=100)throw Object.assign(Error('Aguarde o envio das alterações pendentes.'),{code:'resource-exhausted'})
    const copy=structuredClone(data)
    const bytes=new TextEncoder().encode(JSON.stringify(copy)).length
    if(bytes>850000)throw Object.assign(Error('Alteração muito grande para a fila.'),{code:'invalid-argument'})
    const previous=r?.jobs.at(-1),coalesce=previous && !previous.prepared && !(r?.sending && previous===r.jobs[0]) && ['personal','shared'].includes(kind)
    const used=[...this.resources.values()].reduce((total,item)=>total+item.jobs.reduce((n,job)=>n+job.bytes,0),0)
    if(used+bytes-(coalesce ? previous.bytes : 0)>8*1024*1024)throw Object.assign(Error('Aguarde o envio das pendências antes de adicionar mais.'),{code:'resource-exhausted'})
    if(!r || !r.jobs.length) {
      r={session,kind,path,base:base ? structuredClone(base) : null,jobs:[],failure:null,sending:false,view:null as unknown as QueueView}
      this.resources.set(key,r)
    }
    const last=r.jobs.at(-1)
    if(last && coalesce){last.data=copy;last.label=label;last.bytes=bytes}
    else r.jobs.push({id:crypto.randomUUID(),data:copy,label,sequence:++this.sequence,bytes})
    this.publish(key,r)
    if(!this.timer)this.timer=setTimeout(()=>{this.timer=undefined;void this.drain()},35)
  }
  retry(key:string) {
    const r=this.resources.get(key)
    if(!r?.failure?.retryable || r.session!==this.options.session())return false
    r.failure=null;this.publish(key,r);void this.drain();return true
  }
  discard(key:string) {
    const r=this.resources.get(key)
    if(r?.sending)return false
    this.resources.delete(key);this.notify();this.options.changed?.(r?.path || '');return true
  }
  clearSession() {if(this.timer)clearTimeout(this.timer);this.timer=undefined;this.resources.clear();this.notify()}
  async flush(){if(this.timer)clearTimeout(this.timer);this.timer=undefined;await this.drain()}
  private async drain() {
    if(this.running)return
    this.running=true
    try {
      while(true) {
        const entry=[...this.resources.entries()].filter(([,r])=>r.jobs.length && !r.failure).sort((a,b)=>a[1].jobs[0].sequence-b[1].jobs[0].sequence)[0]
        if(!entry)return
        const [key,r]=entry,job=r.jobs[0]
        if(r.session!==this.options.session()){this.resources.delete(key);this.notify();continue}
        r.sending=true;this.publish(key,r)
        try {
          job.prepared ??= this.options.prepare(r.kind,r.path,job.data,r.base,job.id)
          let result:QueueDocument | undefined
          for(let attempt=0;attempt<3;attempt++) {
            if(r.session!==this.options.session())throw Object.assign(Error('A conta mudou.'),{code:'cancelled'})
            try{result=await this.options.send(job.prepared,r.session);break}
            catch(error){const failure=this.options.failure(error);if(!failure.retryable || attempt===2)throw error;await (this.options.delay || (ms=>new Promise(resolve=>setTimeout(resolve,ms))))(500*(attempt+1))}
          }
          if(r.session!==this.options.session() || this.resources.get(key)!==r)continue
          if(!result)throw Error('CONFIRMATION_MISSING')
          r.base=result;r.jobs.shift();r.failure=null
        } catch(error) {
          if(r.session===this.options.session() && this.resources.get(key)===r)r.failure=this.options.failure(error)
        } finally {
          r.sending=false
          if(this.resources.get(key)===r && r.session===this.options.session())this.publish(key,r)
        }
      }
    } finally {this.running=false}
  }
}
