import {signOut as nativeSignOut,type Auth} from 'firebase/auth'
import {queuedWrites} from './queuedWrites'
export async function signOut(auth:Auth) {
  const pending=queuedWrites.pending()
  if(pending.length && !window.confirm('Ainda há alterações sem confirmação. Cancele para aguardar ou copiar os rascunhos na fila. Sair agora cancela os envios não iniciados. Deseja sair mesmo assim?'))return
  await nativeSignOut(auth)
}
