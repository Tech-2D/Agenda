export type Year = 1 | 2 | 3;

export const YEARS: Year[] = [1, 2, 3];

/** Disciplinas pré-carregadas por ano. Anos sem lista começam vazios e você adiciona as suas. */
export const SUBJECTS_BY_YEAR: Record<Year, string[]> = {
  1: [],
  2: [
    "Desenvolvimento e Operações Ágeis",
    "Estatística",
    "Sociologia",
    "Desenvolvimento de Aplicativo Móvel",
    "Aulas Práticas Estágio - Tecnologia",
    "Desenvolvimento",
    "Desenvolvimento Aplicação Dinâmica",
    "Engenharia e Qualidade de Software",
    "Estatística 1-Business Intelligence",
    "Matemática 10-Modelagem de Dados",
    "Língua Portuguesa e suas Literaturas",
    "Matemática 9-Banco de Dados",
    "Língua Inglesa",
    "Biologia 2-ESG-Environment, Social and Governance",
    "Língua Portuguesa 2-Chefia e Liderança",
    "Matemática",
    "Matemática 14 - Inteligência Artificial",
    "UX",
  ],
  3: [],
};
