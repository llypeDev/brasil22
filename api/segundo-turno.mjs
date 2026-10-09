// Função independente: não inicializa simulação nem banco para consultar a apuração.
import { criarRotaSegundoTurno } from '../server/segundo-turno.mjs';
const tratar = criarRotaSegundoTurno();
export default async function segundoTurno(req, res) {
  const url = new URL(req.url ?? '/', 'http://local');
  const rel = url.pathname.replace(/^\/feed\/oficial-2t\//, '');
  return tratar(req, res, rel);
}
