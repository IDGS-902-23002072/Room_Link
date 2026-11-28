const simbolosRestringidos = /['"`\\]|--|\/\*|\*\//u;
const inicioSentenciaSql = /(?:^|;)\s*(?:select\b[^;]*\bfrom\b|insert\s+into\b|update\s+\S+\s+set\b|delete\s+from\b|(?:drop|alter|truncate)\s+table\b)/iu;
const unionSql = /\bunion\s+(?:all\s+)?select\b/iu;

export const mensajeTextoRestringido =
  'Quita las comillas rectas, barras invertidas o secuencias de SQL. Puedes usar paréntesis y punto y coma.';

// Regla de entrada del cliente. El servidor debe seguir parametrizando sus consultas.
export function tieneTextoRestringido(valor: string) {
  return simbolosRestringidos.test(valor) || inicioSentenciaSql.test(valor) || unionSql.test(valor);
}

export function tieneCaracteresDeControl(valor: string, multilinea: boolean) {
  return /\p{Cc}/u.test(multilinea ? valor.replace(/[\r\n\t]/gu, '') : valor);
}

export function esEntradaTelefono(valor: string) {
  return /^[0-9]{0,10}$/u.test(valor);
}

export function esTelefonoNacional(valor: string) {
  return /^(?:[2-9][1-9][0-9]{8}|[89]00[0-9]{7})$/u.test(valor);
}

export function normalizarTelefonoGuardado(valor: string) {
  const nacional = valor.trim().replace(/^\+52\s*/u, '').replace(/[\s()-]/gu, '');
  return esTelefonoNacional(nacional) ? nacional : valor;
}
