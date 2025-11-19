// src/app/(dashboard)/fornecedores/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { db } from "@/lib/firebase";
// ATUALIZADO: Importações para Edição e Exclusão
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  Query, 
  doc, 
  updateDoc, 
  deleteDoc 
} from "firebase/firestore"; 
// ATUALIZADO: Ícones
import { Edit, Trash2 } from "lucide-react";

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

interface Fornecedor {
  id: string; 
  nome: string;
  telefone?: string;
  cnpj?: string;
  vendedor?: string; 
  ownerId?: string;
}

const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  telefone: z.string().optional(),
  cnpj: z.string().optional(),
  vendedor: z.string().optional(),
});

export default function FornecedoresPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // --- NOVOS STATES PARA EDIÇÃO ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fornecedorParaEditar, setFornecedorParaEditar] = useState<Fornecedor | null>(null);

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- GUARDIÃO DE ROTA ---
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando permissões...
      </div>
    );
  }
  if (!userData) { 
    router.push('/login');
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Redirecionando...
       </div>
    );
  }
  
  // --- BUSCA DE DADOS ---
  useEffect(() => {
    if (userData) {
      const isAdmin = userData.role === 'admin';
      const fornecedoresRef = collection(db, "fornecedores");

      let q: Query;

      if (isAdmin) {
        q = query(fornecedoresRef);
      } else {
        q = query(fornecedoresRef, where("ownerId", "==", userData.id));
      }
      
      const unsub = onSnapshot(q, (querySnapshot) => {
        const listaDeFornecedores: Fornecedor[] = [];
        querySnapshot.forEach((doc) => {
          listaDeFornecedores.push({
            id: doc.id,
            ...doc.data()
          } as Fornecedor);
        });
        setFornecedores(listaDeFornecedores); 
      });

      return () => unsub();
    }
  }, [userData]);

  // --- FORMULÁRIOS ---
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      cnpj: "",
      vendedor: "",
    },
  });

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      cnpj: "",
      vendedor: "",
    },
  });

  // --- FUNÇÃO CRIAR ---
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userData) {
      alert("Erro: Usuário não autenticado.");
      return;
    }

    try {
      const docParaSalvar = {
        ...values,
        ownerId: userData.id
      };
      
      await addDoc(collection(db, "fornecedores"), docParaSalvar);
      
      form.reset();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar fornecedor: ", error);
    }
  }

  // --- FUNÇÃO EDITAR ---
  const handleEditarFornecedor = (fornecedor: Fornecedor) => {
    setFornecedorParaEditar(fornecedor);
    editForm.reset({
      nome: fornecedor.nome,
      telefone: fornecedor.telefone || "",
      cnpj: fornecedor.cnpj || "",
      vendedor: fornecedor.vendedor || "",
    });
    setIsEditModalOpen(true);
  };

  async function onEditSubmit(values: z.infer<typeof formSchema>) {
    if (!fornecedorParaEditar) return;

    try {
      const docRef = doc(db, "fornecedores", fornecedorParaEditar.id);
      await updateDoc(docRef, {
        nome: values.nome,
        telefone: values.telefone,
        cnpj: values.cnpj,
        vendedor: values.vendedor,
      });

      console.log("Fornecedor atualizado!");
      setIsEditModalOpen(false);
      setFornecedorParaEditar(null);
    } catch (error) {
      console.error("Erro ao atualizar fornecedor: ", error);
      alert("Erro ao atualizar fornecedor.");
    }
  }

  // --- FUNÇÃO EXCLUIR ---
  const handleDeleteFornecedor = async (fornecedor: Fornecedor) => {
    if (confirm(`Tem certeza que deseja excluir o fornecedor "${fornecedor.nome}"?`)) {
      try {
        await deleteDoc(doc(db, "fornecedores", fornecedor.id));
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir fornecedor. Verifique se você tem permissão.");
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Fornecedores</h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Adicionar Novo Fornecedor</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Fornecedor</DialogTitle>
              <DialogDescription>
                Preencha as informações do novo fornecedor.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Auto Peças Sergipe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                 <FormField
                  control={form.control}
                  name="vendedor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Vendedor (Contato)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Carlos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 79 99999-8888" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Fornecedor"}
                  </Button>
                </DialogFooter>

              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome da Empresa</TableHead>
              <TableHead>Vendedor (Contato)</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornecedores.map((fornecedor) => (
              <TableRow key={fornecedor.id}>
                <TableCell className="font-medium">{fornecedor.nome}</TableCell>
                <TableCell>{fornecedor.vendedor}</TableCell>
                <TableCell>{fornecedor.telefone}</TableCell>
                <TableCell>{fornecedor.cnpj}</TableCell>
                <TableCell className="flex gap-2">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleEditarFornecedor(fornecedor)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon-sm" onClick={() => handleDeleteFornecedor(fornecedor)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* --- MODAL DE EDIÇÃO --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Fornecedor</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                  control={editForm.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Empresa</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={editForm.control}
                  name="vendedor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Vendedor (Contato)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <DialogFooter>
                <Button type="submit" disabled={editForm.formState.isSubmitting}>
                  {editForm.formState.isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}