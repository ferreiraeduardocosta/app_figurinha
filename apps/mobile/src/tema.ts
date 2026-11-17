/** Cores e estilos do kit visual da Liga Aurora. */
export const cores = {
  fundo: '#F4F1EA',
  papel: '#FFFFFF',
  tinta: '#161A26',
  apagado: '#5B6070',
  borda: '#E3DED3',
  vazio: '#EDE8DD',
  vazioBorda: '#B9B09C',
  vazioTexto: '#5E5646',
  destaque: '#0B7A75',
  destaqueEscuro: '#075955',
  erro: '#B42318',
};

export type Raridade = 'COMUM' | 'RARA' | 'EPICA' | 'LENDARIA';

/** Estilo de cada raridade: moldura (gradiente), fundo interno, textos e losangos. */
export const estiloRaridade: Record<
  Raridade,
  { nome: string; moldura: string[]; interno: string; texto: string; sub: string; losangos: number; losango: string; linha: string }
> = {
  COMUM: { nome: 'Comum', moldura: ['#D5D9E0', '#D5D9E0'], interno: '#FFFFFF', texto: '#161A26', sub: '#5B6070', losangos: 1, losango: '#6B7280', linha: '#E5E7EB' },
  RARA: { nome: 'Rara', moldura: ['#F1F5F9', '#94A3B8', '#F8FAFC', '#7C8BA0', '#E2E8F0'], interno: '#F8FAFC', texto: '#161A26', sub: '#475569', losangos: 2, losango: '#64748B', linha: '#E2E8F0' },
  EPICA: { nome: 'Épica', moldura: ['#FDE68A', '#B7791F', '#FFF7D6', '#A16207', '#FCD34D'], interno: '#FFFBEB', texto: '#1C1405', sub: '#6B4E16', losangos: 3, losango: '#A16207', linha: '#F3E3B5' },
  LENDARIA: { nome: 'Lendária', moldura: ['#7C3AED', '#22D3EE', '#F59E0B', '#EC4899', '#7C3AED'], interno: '#17122E', texto: '#FFFFFF', sub: '#C4B5FD', losangos: 4, losango: '#FBBF24', linha: '#2E2654' },
};
