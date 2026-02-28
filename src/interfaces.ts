export interface Loja {
  id: string;
  nome: string;
  nomeLoja: string;
  email: string;
  nif: string;
  percentualCB: number;
  ativo: boolean;
  morada?: string;
  codigoPostal?: string;
  cidade?: string;
  telefone?: string;
  atividade?: string;
}

export interface Movimento {
  id: string;
  tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO';
  valorVenda: number;
  valorCashback: number;
  clienteId: string; // Email do cliente
  lojaId: string;
  nomeLoja: string;
  dataHora: string;
  docOrigem?: string;
}