export interface Loja {
  id: string;
  nomeLoja: string;
  email: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  cidade: string;
  telefone: string;
  atividade: string; // [cite: 53]
  percentualCB: number; // [cite: 55]
  ativo: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  nif: string;
  codigoPostal: string;
  telefone: string;
  numCartao: string; // [cite: 17]
  ativo: boolean;
}

export interface Movimento {
  id: string;
  tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO'; // [cite: 62, 63]
  valorVenda: number;
  valorCashback: number;
  clienteId: string; // Email ou ID do Cliente
  lojaId: string;
  nomeLoja: string;
  dataHora: string; // [cite: 9, 70]
  docOrigem?: string; // [cite: 8, 70]
  operadorCod?: string; // [cite: 72]
}