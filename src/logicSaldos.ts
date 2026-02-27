// src/logicSaldos.ts
import { Movimento } from './types';

export const calcularSaldos = (movimentos: Movimento[]) => {
  const agora = new Date().getTime();

  return movimentos.reduce(
    (acc, mov) => {
      const valor = mov.valorCashback;
      const dataDisponivel = new Date(mov.disponivelEm).getTime();
      const estaDisponivel = agora >= dataDisponivel;

      if (mov.tipo === 'ADICIONAR') {
        acc.totalTeorico += valor;
        if (estaDisponivel) {
          acc.totalDisponivel += valor;
        }
      } else if (mov.tipo === 'DESCONTAR' || mov.tipo === 'SUBTRAIR') {
        // Regra do Checklist: descontar primeiro do disponível [cite: 31, 65]
        acc.totalTeorico -= valor;
        acc.totalDisponivel -= valor;
      }

      return acc;
    },
    { totalTeorico: 0, totalDisponivel: 0 }
  );
};