// src/lib/masks.ts

// Telefone: (00) 00000-0000
export const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/g, "($1) $2")
    .replace(/(\d)(\d{4})$/, "$1-$2")
    .slice(0, 15);
};

// CPF: 000.000.000-00 ou CNPJ: 00.000.000/0000-00
export const maskCpfCnpj = (value: string) => {
  const v = value.replace(/\D/g, "");
  
  if (v.length <= 11) {
    // CPF pattern
    return v
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  } else {
    // CNPJ pattern
    return v
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1")
      .slice(0, 18);
  }
};

// Placa: AAA-1234 (Padrão e Mercosul com hífen para facilitar leitura)
export const maskPlate = (value: string) => {
  // Força maiúsculas e remove caracteres especiais (exceto traço se quiser manter)
  let v = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  // Adiciona hífen após as 3 letras iniciais
  if (v.length > 3) {
    v = v.replace(/^([A-Z]{3})([A-Z0-9])/, "$1-$2");
  }
  return v.slice(0, 8);
};

// Moeda: R$ 1.250,00
export const maskCurrency = (value: string | number) => {
  // Remove tudo que não é dígito
  const v = String(value).replace(/\D/g, "");
  const numberValue = Number(v) / 100;
  
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numberValue);
};

// Remove a formatação de moeda para salvar no banco (R$ 1.000,00 -> 1000.00)
export const unmaskCurrency = (value: string) => {
  if (typeof value === "number") return value;
  const cleanValue = value.replace(/[^\d,]/g, "").replace(",", ".");
  return Number(cleanValue) || 0;
};