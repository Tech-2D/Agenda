// Lista fixa de matérias. Editar aqui se as matérias mudarem.
export const SUBJECTS = [
  'Desenvolvimento de Aplicativo Móvel',
  'Matemática 9-Banco de Dados',
  'Estatística',
  'Língua Inglesa',
  'Educação Física',
  'Engenharia e Qualidade de Software',
  'Língua Portuguesa e suas Literaturas',
  'Biologia 2-ESG-Environment, Social and Governance',
  'Matemática 10-Modelagem de Dados',
  'Desenvolvimento',
  'Desenvolvimento Aplicação Dinâmica',
  'Desenvolvimento e Operações Ágeis',
  'Sociologia',
  'Língua Portuguesa 2-Chefia e Liderança',
  'UX',
  'Matemática 14 - Inteligência Artificial',
  'Matemática',
  'Estatística 1-Business Intelligence',
] as const

export type Subject = (typeof SUBJECTS)[number]
