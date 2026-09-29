// Lista fixa de turmas. O texto de cada item precisa ser IDÊNTICO ao valor de
// turmaId que você digitar manualmente no documento do representante em admins/{uid}
// no Firestore — qualquer diferença de acento/maiúscula quebra essa correspondência.
export const CLASS_NAMES = [
  '2° TECH D', '2° TECH E', '2° TECH F', '2° TECH G', '2° TECH H', '2° TECH I',
  '3° TECH AD H', '3° TECH AD I', '3° TECH DS E', '3° TECH DS F', '3° TECH DS G',
] as const
