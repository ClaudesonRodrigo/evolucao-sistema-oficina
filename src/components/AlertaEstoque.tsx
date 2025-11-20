// src/components/AlertaEstoque.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy } from "lucide-react"; 
import { toast } from "sonner"; // Se não tiver sonner, pode usar alert() simples

interface ProdutoBaixoEstoque {
  id: string;
  nome: string;
  estoqueAtual: number;
  estoqueMinimo?: number; // Agora opcional
}

export default function AlertaEstoque() {
  const [produtos, setProdutos] = useState<ProdutoBaixoEstoque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Busca peças que tenham estoque baixo (usamos um limite alto na query para filtrar no client)
    // Idealmente: Se a lista for gigante, precisamos de uma query melhor, 
    // mas para oficinas pequenas/médias, baixar as peças e filtrar é rápido.
    const q = query(
      collection(db, "produtos"),
      where("tipo", "==", "peca"),
      where("estoqueAtual", "<=", 10) // Traz tudo que tem menos de 10 para garantir
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const lista: ProdutoBaixoEstoque[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const minimo = data.estoqueMinimo || 3; // Usa o mínimo do produto ou 3 padrão
        
        // Filtra aqui: só adiciona se for menor ou igual ao mínimo DESTE produto
        if (data.estoqueAtual <= minimo) {
          lista.push({
            id: doc.id,
            nome: data.nome,
            estoqueAtual: data.estoqueAtual,
            estoqueMinimo: minimo,
          });
        }
      });
      setProdutos(lista);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const copiarListaCompras = () => {
    if (produtos.length === 0) return;

    let texto = "*LISTA DE COMPRAS URGENTE - OFICINA*\n\n";
    produtos.forEach(p => {
      const falta = (p.estoqueMinimo || 3) * 2 - p.estoqueAtual; // Sugere comprar o dobro do mínimo
      texto += `- ${p.nome}: Estoque ${p.estoqueAtual} (Comprar +${falta > 0 ? falta : 5})\n`;
    });
    
    navigator.clipboard.writeText(texto);
    alert("Lista copiada para a área de transferência!");
  };

  if (loading || produtos.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6 border-destructive bg-destructive/10">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex items-center gap-2">
           <AlertTriangle className="h-5 w-5 text-destructive" />
           <CardTitle className="text-destructive text-lg">
             Reposição de Estoque Necessária
           </CardTitle>
        </div>
        <Button variant="outline" size="sm" onClick={copiarListaCompras} className="bg-white border-destructive text-destructive hover:bg-destructive hover:text-white">
          <Copy className="mr-2 h-4 w-4" />
          Copiar Lista
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
          {produtos.map((produto) => (
            <div key={produto.id} className="flex justify-between items-center bg-white p-2 rounded border border-destructive/20 shadow-sm">
              <span className="font-medium truncate mr-2">{produto.nome}</span>
              <span className="text-xs font-bold px-2 py-1 rounded bg-destructive/20 text-destructive-foreground">
                {produto.estoqueAtual} / {produto.estoqueMinimo || 3}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}