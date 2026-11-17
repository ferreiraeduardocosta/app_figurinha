/** O "dia" do pacote grátis vira à meia-noite de Brasília (UTC-3, sem horário de verão). */
const FUSO = 'America/Sao_Paulo';

export const diaLocal = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d);

/** Próxima meia-noite de Brasília depois de `agora`. */
export function proximaMeiaNoite(agora: Date): Date {
  const hoje = new Date(`${diaLocal(agora)}T00:00:00-03:00`);
  return new Date(hoje.getTime() + 24 * 60 * 60 * 1000);
}
