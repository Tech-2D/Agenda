export function activitySaveError(error: unknown, attachmentsOnly = false): string {
  const details = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown; message?: unknown } : {}
  const code = typeof details.code === 'string' ? details.code.split('/').pop() : ''
  let message: string
  if (code === 'permission-denied' || details.status === 403) {
    message = 'Falta de permissão: o acesso foi recusado. Isso não significa que você preencheu algo errado. Representantes só podem gerenciar atividades da própria turma. Atualize a página e entre novamente; se continuar, peça ao administrador para conferir seu acesso e as regras do sistema.'
  } else if (code === 'unauthenticated' || details.status === 401) {
    message = 'Sessão não autorizada: entre novamente na sua conta antes de salvar.'
  } else if (code === 'invalid-argument' || details.status === 400) {
    message = 'Dados inválidos: confira os campos e os arquivos selecionados. Se estiverem corretos, avise o administrador; pode haver uma incompatibilidade no sistema.'
  } else if (code === 'resource-exhausted' || details.status === 429) {
    message = 'Limite do serviço atingido: o sistema está temporariamente sem cota. Não é um erro no preenchimento. Tente mais tarde ou avise o administrador.'
  } else if (['unavailable', 'deadline-exceeded'].includes(code || '') || (error instanceof TypeError && /fetch|network|load failed/i.test(error.message))) {
    message = 'Falha de conexão ou serviço indisponível: confira sua internet e tente novamente. Se continuar, avise o administrador.'
  } else if (typeof details.status === 'number' && details.status >= 500) {
    message = 'Falha no serviço de anexos: o servidor não conseguiu concluir o pedido. Não é possível resolver isso alterando os campos. Tente novamente mais tarde ou avise o administrador.'
  } else {
    message = 'Falha ao salvar: não foi possível identificar se a causa é o serviço ou o acesso. Tente novamente e, se continuar, envie esta mensagem ao administrador.'
    if (error instanceof Error && error.message) message += ` Detalhe: ${error.message}`
  }
  return attachmentsOnly
    ? `A atividade foi salva, mas os anexos não foram concluídos. ${message} Tente enviar os arquivos restantes neste formulário, sem criar outra atividade.`
    : message
}
