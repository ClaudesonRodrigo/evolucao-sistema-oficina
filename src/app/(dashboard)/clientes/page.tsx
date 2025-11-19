// src/app/(dashboard)/clientes/page.tsx
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

// Importações dos componentes Shadcn
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

interface Cliente {
  id: string; 
  nome: string;
  telefone?: string;
  cpfCnpj?: string;
  ownerId?: string;
}

const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  telefone: z.string().optional(),
  cpfCnpj: z.string().optional(),
});

export default function ClientesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // --- NOVOS STATES PARA EDIÇÃO ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [clienteParaEditar, setClienteParaEditar] = useState<Cliente | null>(null);
  
  const [clientes, setClientes] = useState<Cliente[]>([]);
  
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
      const clientesRef = collection(db, "clientes");
      
      let q: Query;

      if (isAdmin) {
        q = query(clientesRef);
      } else {
        q = query(clientesRef, where("ownerId", "==", userData.id));
      }
      
      const unsub = onSnapshot(q, (querySnapshot) => {
        const listaDeClientes: Cliente[] = [];
        querySnapshot.forEach((doc) => {
          listaDeClientes.push({
            id: doc.id,
            ...doc.data()
          } as Cliente);
        });
        setClientes(listaDeClientes); 
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
      cpfCnpj: "",
    },
  });

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      cpfCnpj: "",
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
      
      await addDoc(collection(db, "clientes"), docParaSalvar);
      
      form.reset();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar cliente: ", error);
    }
  }

  // --- FUNÇÃO EDITAR ---
  const handleEditarCliente = (cliente: Cliente) => {
    setClienteParaEditar(cliente);
    editForm.reset({
      nome: cliente.nome,
      telefone: cliente.telefone || "",
      cpfCnpj: cliente.cpfCnpj || "",
    });
    setIsEditModalOpen(true);
  };

  async function onEditSubmit(values: z.infer<typeof formSchema>) {
    if (!clienteParaEditar) return;

    try {
      const docRef = doc(db, "clientes", clienteParaEditar.id);
      await updateDoc(docRef, {
        nome: values.nome,
        telefone: values.telefone,
        cpfCnpj: values.cpfCnpj,
      });

      console.log("Cliente atualizado!");
      setIsEditModalOpen(false);
      setClienteParaEditar(null);
    } catch (error) {
      console.error("Erro ao atualizar cliente: ", error);
      alert("Erro ao atualizar cliente.");
    }
  }

  // --- FUNÇÃO EXCLUIR ---
  const handleDeleteCliente = async (cliente: Cliente) => {
    if (confirm(`Tem certeza que deseja excluir o cliente "${cliente.nome}"?`)) {
      try {
        await deleteDoc(doc(db, "clientes", cliente.id));
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir cliente. Verifique se você tem permissão.");
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Clientes</h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Adicionar Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Cliente</DialogTitle>
              <DialogDescription>
                Preencha as informações do novo cliente.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Cliente</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Rodrigo Borges" {...field} />
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
                  name="cpfCnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF ou CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 123.456.789-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Cliente"}
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
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>CPF / CNPJ</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((cliente) => (
              <TableRow key={cliente.id}>
                <TableCell className="font-medium">{cliente.nome}</TableCell>
                <TableCell>{cliente.telefone}</TableCell>
                <TableCell>{cliente.cpfCnpj}</TableCell>
                <TableCell className="flex gap-2">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleEditarCliente(cliente)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon-sm" onClick={() => handleDeleteCliente(cliente)}>
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
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Cliente</FormLabel>
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
                name="cpfCnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF ou CNPJ</FormLabel>
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