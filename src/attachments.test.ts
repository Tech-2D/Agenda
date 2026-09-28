import { describe, expect, it } from 'vitest'
import { MAX_ATTACHMENTS, validateAttachment } from './attachments'

describe('anexos da agenda', () => {
  it('aceita documentos e imagens pequenos', () => {
    expect(validateAttachment(new File(['pdf'], 'revisao.pdf', { type: 'application/pdf' }))).toBe('application/pdf')
    expect(validateAttachment(new File(['zip'], 'aula.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))).toContain('wordprocessingml')
    expect(MAX_ATTACHMENTS).toBe(5)
  })
  it('bloqueia vídeo, tipo incompatível e arquivo vazio', () => {
    expect(() => validateAttachment(new File(['x'], 'video.mp4', { type: 'video/mp4' }))).toThrow()
    expect(() => validateAttachment(new File(['x'], 'arquivo.pdf', { type: 'text/html' }))).toThrow()
    expect(() => validateAttachment(new File([], 'vazio.pdf', { type: 'application/pdf' }))).toThrow()
  })
  it('aceita ZIP e normaliza os tipos usados pelos navegadores', () => {
    for (const type of ['application/zip', 'application/x-zip-compressed', 'application/octet-stream', '']) {
      expect(validateAttachment(new File(['zip'], 'materiais.ZIP', { type }))).toBe('application/zip')
    }
    expect(() => validateAttachment(new File(['x'], 'arquivo.zip', { type: 'text/html' }))).toThrow()
    expect(() => validateAttachment(new File([], 'vazio.zip', { type: 'application/zip' }))).toThrow()
    expect(() => validateAttachment(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'grande.zip', { type: 'application/zip' }))).toThrow()
  })
})
