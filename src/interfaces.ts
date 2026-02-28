/**
 * ESTE FICHEIRO É O CONTRATO DE DADOS DA APP.
 * QUALQUER ALTERAÇÃO AQUI DEVE SER REPLICADA NO FIRESTORE.
 */

export interface Loja {
  id: string;          // UID do Firebase Auth
  nomeLoja: string;
  email: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  cidade: string;
  telefone: string;
  atividade: string;   // Ex: Talho, Café, Restaurante
  percentualCB: number; // Ex: 10 para 10%
  ativo: boolean;      // Controlo do Administrador
}

export interface Cliente {
  id: string;          // UID do Firebase Auth ou Email
  nome: string;
  email: string;
  nif: string;         // Único e obrigatório
  codigoPostal: string;
  telefone: string;
  numCartao: string;   // 10 dígitos (gerado ou lido)
  ativo: boolean;
}

export interface Operador {
  id: string;
  nome: string;
  codigo: string;      // PIN de 5 dígitos (Pág. 6 do Checklist)
  lojaId: string;      // Vinculado à Loja mãe
}

export interface Movimento {
  id: string;
  tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO';
  valorVenda: number;     // Valor total da fatura
  valorCashback: number;  // Valor calculado com base na % da loja
  clienteId: string;      // ID do Cliente beneficiário
  lojaId: string;         // ID da Loja onde ocorreu
  nomeLoja: string;       // Facilitador para listagem do Cliente
  dataHora: string;       // ISO String para ordenação
  docOrigem?: string;     // Nº Fatura / Nota de Crédito
  operadorNome?: string;  // Nome do operador que validou com PIN
}