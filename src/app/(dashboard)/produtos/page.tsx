// src/app/(dashboard)/produtos/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
// Importar deleteDoc
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc 
} from "firebase/firestore"; 
import { db } from "@/lib/firebase";
// Importar Trash2
import { Search, Edit, Trash2 } from "lucide-react"; 

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Componentes Shadcn
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- INTERFACES ---
interface Produto {
  id: string; 
  nome: string;
  codigoSku?: string;
  precoCusto: number;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo?: number;
  monitorarEstoque?: boolean;
  tipo: "peca" | "servico";
}
interface ItemOS {
  id: string;
  qtde: number;
}

// --- SCHEMA DE CRIAÇÃO ---
const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  codigoSku: z.string().optional(),
  tipo: z.enum(["peca", "servico"]),
  precoCusto: z.coerce.number().min(0, { message: "O custo deve ser positivo." }),
  precoVenda: z.coerce.number().min(0, { message: "O preço deve ser positivo." }),
  estoqueAtual: z.coerce.number().int({ message: "O estoque deve ser um número inteiro." }),
  estoqueMinimo: z.coerce.number().int().min(0).default(3),
  monitorarEstoque: z.string().default("true"), 
}).refine((data) => {
  if (data.tipo === 'peca') {
    return data.estoqueAtual >= 0;
  }
  return true;
}, {
  message: "Estoque deve ser 0 ou mais para peças.",
  path: ["estoqueAtual"],
});

// --- SCHEMA DE EDIÇÃO (ATUALIZADO COM PREÇO DE CUSTO) ---
const editFormSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  precoCusto: z.coerce.number().min(0, { message: "O custo deve ser positivo." }), // <-- NOVO
  precoVenda: z.coerce.number().min(0, { message: "O preço deve ser positivo." }),
  estoqueMinimo: z.coerce.number().int().min(0),
  monitorarEstoque: z.string(),
});


export default function ProdutosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  
  // States dos Modais
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // States para seleção
  const [produtoParaRelatorio, setProdutoParaRelatorio] = useState<Produto | null>(null);
  const [produtoParaEditar, setProdutoParaEditar] = useState<Produto | null>(null);

  const [totalVendido, setTotalVendido] = useState<number | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Guardião de Rota
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando permissões...
      </div>
    );
  }

  if (!userData || userData.role !== 'admin') {
    router.push('/');
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Acesso negado. Redirecionando...
       </div>
    );
  }

  // Busca Produtos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "produtos"), (querySnapshot) => {
      const listaDeProdutos: Produto[] = [];
      querySnapshot.forEach((doc) => {
        listaDeProdutos.push({
          id: doc.id,
          ...doc.data()
        } as Produto); 
      });
      setProdutos(listaDeProdutos);
    });
    return () => unsub();
  }, []);

  // Formulário de CRIAÇÃO
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      codigoSku: "",
      tipo: "peca",
      precoCusto: 0,
      precoVenda: 0,
      estoqueAtual: 0,
      estoqueMinimo: 3,
      monitorarEstoque: "true",
    },
  });
  
  // Formulário de EDIÇÃO
  const editForm = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      nome: "",
      precoCusto: 0, // <-- NOVO
      precoVenda: 0,
      estoqueMinimo: 3,
      monitorarEstoque: "true",
    },
  });

  const tipoProduto = form.watch("tipo");

  // Função de CRIAR
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const dadosParaSalvar = {
        ...values,
        estoqueAtual: values.tipo === 'servico' ? 0 : values.estoqueAtual,
        estoqueMinimo: values.tipo === 'servico' ? 0 : values.estoqueMinimo,
        monitorarEstoque: values.monitorarEstoque === "true",
      };

      const docRef = await addDoc(collection(db, "produtos"), dadosParaSalvar);
      console.log("Produto salvo com ID: ", docRef.id);
      
      form.reset();
      setIsModalOpen(false);

    } catch (error) {
      console.error("Erro ao salvar produto: ", error);
    }
  }
  
  // Função de EDITAR
  async function onEditSubmit(values: z.infer<typeof editFormSchema>) {
    if (!produtoParaEditar) return;

    try {
      const docRef = doc(db, "produtos", produtoParaEditar.id);
      await updateDoc(docRef, {
        nome: values.nome,
        precoCusto: values.precoCusto, // <-- ATUALIZA NO BANCO
        precoVenda: values.precoVenda,
        estoqueMinimo: values.estoqueMinimo,
        monitorarEstoque: values.monitorarEstoque === "true",
      });

      console.log("Produto atualizado com ID: ", produtoParaEditar.id);
      editForm.reset();
      setIsEditModalOpen(false);
      setProdutoParaEditar(null);

    } catch (error) {
      console.error("Erro ao atualizar produto: ", error);
      alert("Erro ao atualizar produto.");
    }
  }

  // Função de EXCLUIR
  const handleDeleteProduto = async (produto: Produto) => {
    if (confirm(`Tem certeza que deseja excluir "${produto.nome}"? Isso não pode ser desfeito.`)) {
      try {
        await deleteDoc(doc(db, "produtos", produto.id));
        console.log("Produto excluído:", produto.id);
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir produto.");
      }
    }
  };

  // Abre modal de Relatório
  const handleVerRelatorio = async (produto: Produto) => {
    setProdutoParaRelatorio(produto);
    setIsReportModalOpen(true);
    setLoadingReport(true);
    setTotalVendido(null);

    try {
      const osRef = collection(db, "ordensDeServico");
      const q = query(osRef, where("status", "==", "finalizada"));
      const querySnapshot = await getDocs(q);

      let total = 0;
      querySnapshot.forEach((doc) => {
        const os = doc.data();
        const itens = os.itens as ItemOS[];
        
        if (itens && itens.length > 0) {
          itens.forEach((item) => {
            if (item.id === produto.id) {
              total += item.qtde;
            }
          });
        }
      });
      
      setTotalVendido(total);
    } catch (error) {
      console.error("Erro ao calcular total vendido: ", error);
      setTotalVendido(0); 
    } finally {
      setLoadingReport(false);
    }
  };
  
  // Abre modal de Edição
  const handleEditarProduto = (produto: Produto) => {
    setProdutoParaEditar(produto);
    editForm.reset({
      nome: produto.nome,
      precoCusto: produto.precoCusto || 0, // <-- CARREGA VALOR ATUAL
      precoVenda: produto.precoVenda,
      estoqueMinimo: produto.estoqueMinimo || 3,
      monitorarEstoque: produto.monitorarEstoque === false ? "false" : "true",
    });
    setIsEditModalOpen(true);
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Produtos e Peças</h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Adicionar Novo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Item</DialogTitle>
              <DialogDescription>
                Preencha as informações da nova peça ou serviço.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Item</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Filtro de Ar ou Troca de Óleo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione se é peça ou serviço" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="peca">Peça</SelectItem>
                          <SelectItem value="servico">Serviço</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="codigoSku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código (SKU)</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                   <FormField
                    control={form.control}
                    name="precoCusto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor de Custo (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="precoVenda"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor de Venda (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {tipoProduto === 'peca' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="estoqueAtual"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estoque Atual</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="estoqueMinimo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estoque Mínimo</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {/* CAMPO DE MONITORAMENTO NA CRIAÇÃO */}
                    <FormField
                      control={form.control}
                      name="monitorarEstoque"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monitorar Estoque?</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="true">Sim (Avisar se acabar)</SelectItem>
                              <SelectItem value="false">Não (Peça única/usada)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Item"}
                  </Button>
                </DialogFooter>

              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* --- TABELA DE PRODUTOS --- */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Mínimo</TableHead> 
              <TableHead>Custo (R$)</TableHead>
              <TableHead>Venda (R$)</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtos.map((produto) => (
              <TableRow key={produto.id}>
                <TableCell className="font-medium">{produto.nome}</TableCell>
                <TableCell className="capitalize">{produto.tipo}</TableCell>
                <TableCell>
                  <span className={
                    produto.tipo === 'peca' && 
                    produto.monitorarEstoque !== false && 
                    produto.estoqueAtual <= (produto.estoqueMinimo || 3) 
                      ? "text-red-600 font-bold" : ""
                  }>
                    {produto.tipo === 'peca' ? produto.estoqueAtual : '-'}
                  </span>
                </TableCell>
                <TableCell>
                  {produto.tipo === 'peca' 
                    ? (produto.monitorarEstoque === false ? 'Não monitorado' : (produto.estoqueMinimo || 3)) 
                    : '-'}
                </TableCell>
                <TableCell>{produto.precoCusto?.toFixed(2)}</TableCell>
                <TableCell>{produto.precoVenda.toFixed(2)}</TableCell>
                
                <TableCell className="flex gap-2">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleEditarProduto(produto)} title="Editar">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleVerRelatorio(produto)} title="Relatório">
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon-sm" onClick={() => handleDeleteProduto(produto)} title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* --- MODAL DE EDIÇÃO (ATUALIZADO) --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>
              {produtoParaEditar?.nome}
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-4">
              
              <FormField
                control={editForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Item</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Filtro de Ar" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CAMPO NOVO DE PREÇO DE CUSTO NA EDIÇÃO */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="precoCusto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Custo (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="precoVenda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Venda (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* CAMPOS DE ESTOQUE PARA PEÇAS */}
              {produtoParaEditar?.tipo === 'peca' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="estoqueMinimo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estoque Mínimo</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="monitorarEstoque"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monitorar Estoque?</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="true">Sim (Avisar se acabar)</SelectItem>
                            <SelectItem value="false">Não (Peça única/usada)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={editForm.formState.isSubmitting}
                >
                  {editForm.formState.isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>

            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* --- MODAL DE RELATÓRIO (COMPLETO E RESTAURADO) --- */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Relatório de Produto</DialogTitle>
            <DialogDescription>
              {produtoParaRelatorio?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Estoque Atual:</span>
              <span className="text-2xl font-bold">
                {produtoParaRelatorio?.tipo === 'peca' ? produtoParaRelatorio?.estoqueAtual : 'N/A (Serviço)'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Vendido (em OS Finalizadas):</span>
              <span className="text-2xl font-bold">
                {loadingReport ? 'Calculando...' : totalVendido}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}