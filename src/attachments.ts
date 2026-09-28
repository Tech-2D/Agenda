import { auth } from './firebase'
import type { ActivityAttachment } from './types'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS = 5
export const ATTACHMENTS_ENABLED = import.meta.env.VITE_ATTACHMENTS_ENABLED === 'true'
const API = import.meta.env.VITE_STORAGE_API_URL?.trim() || 'https://tech-2d-auth-email.vercel.app/api/storage'
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export function validateAttachment(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const expected = MIME_BY_EXTENSION[extension]
  if (!expected || !file.name || file.name.length > 180 || /[\\/]/.test(file.name) || Array.from(file.name).some(character => character.charCodeAt(0) < 32)) throw new Error('Escolha um PDF, DOCX, PPTX, ZIP, JPG, PNG ou WebP.')
  const zipAlias = extension === 'zip' && ['application/x-zip-compressed', 'application/octet-stream'].includes(file.type)
  if (file.type && file.type !== expected && !zipAlias) throw new Error('A extensão e o tipo do arquivo não correspondem.')
  if (file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) throw new Error('Cada arquivo deve ter até 10 MB e não pode estar vazio.')
  return expected
}

async function request(action: string, payload: Record<string, unknown> = {}, authenticated = true) {
  const token = authenticated ? await auth.currentUser?.getIdToken() : null
  if (authenticated && !token) throw new Error('Entre como representante ou administrador para gerenciar anexos.')
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Não foi possível acessar o anexo. Tente novamente.')
  return data
}

export async function uploadAttachment(activityId: string, file: File): Promise<ActivityAttachment> {
  const contentType = validateAttachment(file)
  const signed = await request('sign', { activityId, name: file.name, contentType, size: file.size }) as { uploadId: string; uploadUrl: string }
  const uploaded = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
  if (!uploaded.ok) throw new Error('O arquivo não foi enviado ao armazenamento. Tente novamente.')
  const completed = await request('complete', { activityId, uploadId: signed.uploadId }) as { attachment: ActivityAttachment }
  return completed.attachment
}

export async function attachmentDownloadUrl(activityId: string, attachmentId: string): Promise<string> {
  const url = new URL(API)
  url.searchParams.set('activityId', activityId)
  url.searchParams.set('attachmentId', attachmentId)
  const response = await fetch(url)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Não foi possível abrir o anexo.')
  return data.url
}

export async function removeAttachment(activityId: string, attachmentId: string) {
  await request('remove', { activityId, attachmentId })
}

export async function deleteActivityWithAttachments(activityId: string) {
  await request('delete-activity', { activityId })
}

export function formatAttachmentSize(size: number): string {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}
