import { BadRequestException } from '@nestjs/common';

/** Validação simples de entrada. Cada erro devolve { codigo, campo, mensagem }. */
function invalido(campo: string, mensagem: string): never {
  throw new BadRequestException({ codigo: 'ENTRADA_INVALIDA', campo, mensagem });
}

export function objeto(corpo: unknown): Record<string, unknown> {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) invalido('corpo', 'Envie um objeto JSON.');
  return corpo as Record<string, unknown>;
}

export function texto(corpo: Record<string, unknown>, campo: string, min: number, max: number): string {
  const v = corpo[campo];
  if (typeof v !== 'string') invalido(campo, `Informe ${campo}.`);
  const t = v.trim();
  if (t.length < min || t.length > max) invalido(campo, `${campo} deve ter entre ${min} e ${max} caracteres.`);
  return t;
}

export function apelido(corpo: Record<string, unknown>): string {
  const a = texto(corpo, 'apelido', 3, 20);
  if (!/^[A-Za-z0-9_.-]+$/.test(a)) invalido('apelido', 'Use só letras sem acento, números, ponto, hífen ou sublinhado.');
  return a;
}

export function email(corpo: Record<string, unknown>): string {
  const e = texto(corpo, 'email', 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) invalido('email', 'E-mail inválido.');
  return e;
}

export function senha(corpo: Record<string, unknown>): string {
  const v = corpo.senha;
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) invalido('senha', 'A senha deve ter entre 8 e 128 caracteres.');
  return v;
}

export function codigoFigurinha(corpo: Record<string, unknown>): string {
  const c = texto(corpo, 'codigo', 5, 10).toUpperCase();
  if (!/^[A-Z]{3}-\d{2}$/.test(c)) invalido('codigo', 'Código de figurinha inválido (ex.: UNI-05).');
  return c;
}
