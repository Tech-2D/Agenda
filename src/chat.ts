export function prepareChatMessage(value: string): string {
  const message = value.trim()
  if (!message) throw new Error('Escreva uma mensagem antes de enviar.')
  if (message.length > 2000) throw new Error('A mensagem pode ter no máximo 2.000 caracteres.')
  return message
}
