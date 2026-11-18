import { BadRequestException } from '@nestjs/common';

export interface NovoCupom {
  codigo?: string;
  pacotes: number;
  descricao?: string;
  destinatarios: string[];
  maxUsos?: number;
  validoAte?: Date;
}

function invalido(campo: string, mensagem: string): never {
  throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo, mensagem });
}

export function codigoCupom(v: unknown, campo = 'codigo'): string {
  if (typeof v !== 'string') invalido(campo, 'Informe o código do cupom.');
  const c = v.trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,20}$/.test(c)) invalido(campo, 'O código tem de 4 a 20 letras, números ou hífen.');
  return c;
}

function inteiro(v: unknown, campo: string, min: number, max: number, nome: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) invalido(campo, `${nome} deve ser um número de ${min} a ${max}.`);
  return v;
}

/** Valida o corpo de criação de cupom vindo do painel. */
export function validarNovoCupom(corpo: unknown, agora = new Date()): NovoCupom {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) invalido('corpo', 'Envie um objeto JSON.');
  const c = corpo as Record<string, unknown>;
  const vazio = (x: unknown) => x === undefined || x === null || x === '';

  const codigo = vazio(c.codigo) ? undefined : codigoCupom(c.codigo);
  const pacotes = inteiro(c.pacotes, 'pacotes', 1, 50, 'Pacotes');

  let descricao: string | undefined;
  if (!vazio(c.descricao)) {
    if (typeof c.descricao !== 'string' || c.descricao.trim().length > 80) invalido('descricao', 'A descrição tem no máximo 80 caracteres.');
    descricao = c.descricao.trim();
  }

  let destinatarios: string[] = [];
  if (!vazio(c.destinatarios)) {
    if (!Array.isArray(c.destinatarios) || c.destinatarios.some((d) => typeof d !== 'string')) {
      invalido('destinatarios', 'Destinatários deve ser uma lista de apelidos ou e-mails.');
    }
    destinatarios = [...new Set((c.destinatarios as string[]).map((d) => d.trim()).filter(Boolean))];
    if (destinatarios.length > 500) invalido('destinatarios', 'No máximo 500 destinatários por cupom.');
    if (destinatarios.some((d) => d.length > 254)) invalido('destinatarios', 'Apelido ou e-mail grande demais.');
  }

  const maxUsos = vazio(c.maxUsos) ? undefined : inteiro(c.maxUsos, 'maxUsos', 1, 100_000, 'Limite de usos');

  let validoAte: Date | undefined;
  if (!vazio(c.validoAte)) {
    // Data do painel (AAAA-MM-DD): vale até o fim desse dia no horário de Brasília.
    if (typeof c.validoAte !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.validoAte)) invalido('validoAte', 'Data inválida (use AAAA-MM-DD).');
    validoAte = new Date(`${c.validoAte}T23:59:59.999-03:00`);
    if (Number.isNaN(validoAte.getTime())) invalido('validoAte', 'Data inválida.');
    if (validoAte <= agora) invalido('validoAte', 'A validade precisa ser uma data futura.');
  }

  return { codigo, pacotes, descricao, destinatarios, maxUsos, validoAte };
}
