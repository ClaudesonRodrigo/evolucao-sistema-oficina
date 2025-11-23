// src/app/(dashboard)/produtos/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc 
} from "firebase/firestore"; 
import { db } from "@/lib/firebase";
import { Search, Edit, Trash2 } from "lucide-react"; 
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { maskCurrency, unmaskCurrency } from "@/lib/masks";

// Componentes Shadcn
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// --- ATUALIZAÇÃO: Importar o Skeleton ---
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

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

// --- SCHEMAS ZOD ---
const formSchema = z.object({
  nome: z.string().min(3, { message: "Mínimo 3 caracteres." }),
  codigoSku: z.string().optional(),
  tipo: z.enum(["peca", "servico"]),
  precoCusto: z.string().min(1, "Informe o custo"), 
  precoVenda: z.string().min(1, "Informe o valor de venda"), 
  estoqueAtual: z.coerce.number().int(),
  estoqueMinimo: z.coerce.number().int().min(0).default(3),
  monitorarEstoque: z.string().default("true"),
});

const editFormSchema = z.object({
  nome: z.string().min(3),
  precoCusto: z.string().min(1),
  precoVenda: z.string().min(1),
  estoqueMinimo: z.coerce.number().int().min(0),
  monitorarEstoque: z.string(),
});

export default function ProdutosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoParaEditar, setProdutoParaEditar] = useState<Produto | null>(null);
  const [produtoParaRelatorio, setProdutoParaRelatorio] = useState<Produto | null>(null);

  const [totalVendido, setTotalVendido] = useState<number | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  
  // Estado local de carregamento da página (para garantir que o Skeleton apareça)
  const [isLoadingData, setIsLoadingData] = useState(true);

  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- GUARDIÃO DE ROTA (ATUALIZADO COM SKELETON) ---
  // Se estiver carregando a auth OU os dados, mostra o Skeleton
  if (authLoading || isLoadingData) {
    // Apenas se já passou a auth e não é admin, redireciona. 
    // Se ainda está carregando auth, espera.
    if (!authLoading && userData && userData.role !== 'admin') {
       router.push('/');
       return null;
    }
    
    // Se ainda não tem userData (e não terminou auth), ou se é admin carregando dados:
    if (authLoading || (userData?.role === 'admin' && isLoadingData)) {
       // Se for a primeira carga, pode retornar o Skeleton direto
       // Mas precisamos da estrutura da página em volta (Título, Botão)
       // Então vamos deixar renderizar o return principal, e lá embaixo usamos o Skeleton.
    }
  }

  useEffect(() => {
    // Se não for admin e já carregou auth, sai.
    if (!authLoading && userData && userData.role !== 'admin') {
        router.push('/');
        return;
    }

    // Se for admin, busca os dados
    if (userData?.role === 'admin') {
        const unsub = onSnapshot(collection(db, "produtos"), (snapshot) => {
        setProdutos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto)));
        setIsLoadingData(false); // Dados carregados!
        });
        return () => unsub();
    }
  }, [userData, authLoading, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "", codigoSku: "", tipo: "peca", 
      precoCusto: "R$ 0,00", precoVenda: "R$ 0,00",
      estoqueAtual: 0, estoqueMinimo: 3, monitorarEstoque: "true",
    },
  });
  
  const editForm = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
    defaultValues: { 
      nome: "", precoCusto: "", precoVenda: "", 
      estoqueMinimo: 3, monitorarEstoque: "true" 
    },
  });

  const tipoProduto = form.watch("tipo");

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const dadosParaSalvar = {
        ...values,
        precoCusto: unmaskCurrency(values.precoCusto),
        precoVenda: unmaskCurrency(values.precoVenda),
        estoqueAtual: values.tipo === 'servico' ? 0 : values.estoqueAtual,
        estoqueMinimo: values.tipo === 'servico' ? 0 : values.estoqueMinimo,
        monitorarEstoque: values.monitorarEstoque === "true",
      };

      await addDoc(collection(db, "produtos"), dadosParaSalvar);
      toast.success("Produto salvo!");
      form.reset({ ...values, nome: "", codigoSku: "", estoqueAtual: 0, precoCusto: "R$ 0,00", precoVenda: "R$ 0,00" });
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Erro ao salvar.");
    }
  }
  
  async function onEditSubmit(values: z.infer<typeof editFormSchema>) {
    if (!produtoParaEditar) return;
    try {
      const docRef = doc(db, "produtos", produtoParaEditar.id);
      await updateDoc(docRef, {
        nome: values.nome,
        precoCusto: unmaskCurrency(values.precoCusto),
        precoVenda: unmaskCurrency(values.precoVenda),
        estoqueMinimo: values.estoqueMinimo,
        monitorarEstoque: values.monitorarEstoque === "true",
      });
      toast.success("Atualizado com sucesso!");
      setIsEditModalOpen(false);
      setProdutoParaEditar(null);
    } catch (error) {
      toast.error("Erro ao atualizar.");
    }
  }

  const handleDeleteProduto = async (produto: Produto) => {
    try {
      await deleteDoc(doc(db, "produtos", produto.id));
      toast.success("Produto excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir produto.");
    }
  };
  
  const handleEditarProduto = (produto: Produto) => {
    setProdutoParaEditar(produto);
    editForm.reset({
      nome: produto.nome,
      precoCusto: maskCurrency(produto.precoCusto),
      precoVenda: maskCurrency(produto.precoVenda),
      estoqueMinimo: produto.estoqueMinimo || 3,
      monitorarEstoque: produto.monitorarEstoque === false ? "false" : "true",
    });
    setIsEditModalOpen(true);
  };

  const handleVerRelatorio = async (produto: Produto) => {
    setProdutoParaRelatorio(produto);
    setIsReportModalOpen(true);
    setLoadingReport(true);
    setTotalVendido(null);
    // Em produção, aqui buscaria os dados reais.
    setLoadingReport(false); 
  };

  // --- RENDERIZAÇÃO ---
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Produtos e Peças</h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild><Button>Adicionar Novo</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Novo Item</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="nome" render={({ field }) => ( <FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder="Ex: Filtro" {...field} /></FormControl><FormMessage /></FormItem> )} />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="tipo" render={({ field }) => ( <FormItem><FormLabel>Tipo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="peca">Peça</SelectItem><SelectItem value="servico">Serviço</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="codigoSku" render={({ field }) => ( <FormItem><FormLabel>SKU</FormLabel><FormControl><Input placeholder="Opcional" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <FormField control={form.control} name="precoCusto" render={({ field }) => ( 
                     <FormItem>
                       <FormLabel>Custo (R$)</FormLabel>
                       <FormControl>
                         <Input {...field} onChange={(e) => field.onChange(maskCurrency(e.target.value))} />
                       </FormControl>
                       <FormMessage />
                     </FormItem> 
                   )} />
                  <FormField control={form.control} name="precoVenda" render={({ field }) => ( 
                    <FormItem>
                      <FormLabel>Venda (R$)</FormLabel>
                      <FormControl>
                        <Input {...field} onChange={(e) => field.onChange(maskCurrency(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem> 
                  )} />
                </div>
                
                {tipoProduto === 'peca' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="estoqueAtual" render={({ field }) => ( <FormItem><FormLabel>Estoque Atual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                      <FormField control={form.control} name="estoqueMinimo" render={({ field }) => ( <FormItem><FormLabel>Mínimo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="monitorarEstoque" render={({ field }) => ( <FormItem><FormLabel>Monitorar?</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Sim</SelectItem><SelectItem value="false">Não</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                  </>
                )}
                <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* --- ATUALIZAÇÃO: CONDICIONAL DE SKELETON --- */}
      {(authLoading || isLoadingData) ? (
        <TableSkeleton />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nome</TableHead><TableHead>Estoque</TableHead><TableHead>Custo</TableHead><TableHead>Venda</TableHead><TableHead>Ações</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((produto) => (
                <TableRow key={produto.id}>
                  <TableCell>{produto.nome}</TableCell>
                  <TableCell>
                    <span className={produto.tipo === 'peca' && produto.monitorarEstoque !== false && produto.estoqueAtual <= (produto.estoqueMinimo || 3) ? "text-red-600 font-bold" : ""}>
                      {produto.tipo === 'peca' ? produto.estoqueAtual : '-'}
                    </span>
                  </TableCell>
                  <TableCell>{maskCurrency(produto.precoCusto)}</TableCell>
                  <TableCell>{maskCurrency(produto.precoVenda)}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="ghost" size="icon-sm" onClick={() => handleEditarProduto(produto)} title="Editar"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleVerRelatorio(produto)} title="Relatório"><Search className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon-sm" title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteProduto(produto)} className="bg-red-600 hover:bg-red-700">Sim, excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      {/* Modal de Edição */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Editar Produto</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-4">
              <FormField control={editForm.control} name="nome" render={({ field }) => ( <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <div className="grid grid-cols-2 gap-4">
                 <FormField control={editForm.control} name="precoCusto" render={({ field }) => ( <FormItem><FormLabel>Custo</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(maskCurrency(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                 <FormField control={editForm.control} name="precoVenda" render={({ field }) => ( <FormItem><FormLabel>Venda</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(maskCurrency(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              {produtoParaEditar?.tipo === 'peca' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={editForm.control} name="estoqueMinimo" render={({ field }) => ( <FormItem><FormLabel>Mínimo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={editForm.control} name="monitorarEstoque" render={({ field }) => ( <FormItem><FormLabel>Monitorar?</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Sim</SelectItem><SelectItem value="false">Não</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                </div>
              )}
              <DialogFooter><Button type="submit">Salvar Alterações</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de Relatório */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Relatório de Produto</DialogTitle>
            <DialogDescription>{produtoParaRelatorio?.nome}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Estoque Atual:</span>
              <span className="text-2xl font-bold">
                {produtoParaRelatorio?.tipo === 'peca' ? produtoParaRelatorio?.estoqueAtual : 'N/A'}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}