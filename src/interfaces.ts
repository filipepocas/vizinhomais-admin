export interface Loja {
  id: string;
  nomeLoja: string;
  email: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  cidade: string;
  telefone: string;
  atividade: string; // talho, café, etc. [cite: 53]
  percentualCB: number;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  nif: string;
  codigoPostal: string;
  telefone: string;
  numCartao: string; // 10 dígitos [cite: 17]
  ativo: boolean;
}

export interface Operador {
  id: string;
  nome: string;
  codigo: string; // 5 dígitos [cite: 72]
  lojaId: string;
}

export interface Movimento {
  id: string;
  tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO'; [cite: 62]
  valorVenda: number;
  valorCashback: number;
  clienteId: string; // ID do Cliente
  lojaId: string;
  nomeLoja: string;
  dataHora: string; // ISO String [cite: 9, 70]
  docOrigem?: string; // Fatura/NC [cite: 8, 70]
  operadorId?: string; // Quem fez o movimento [cite: 72]
}