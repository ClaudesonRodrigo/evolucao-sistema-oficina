// src/components/MainLayout.tsx
"use client"; 

import React, { useState } from 'react';
import Image from 'next/image'; 
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';
import { auth } from '@/lib/firebase';
import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link'; 
import { cn } from '@/lib/utils';

// --- ATUALIZAÇÃO: Item "Veículos" adicionado ---
const menuItens = [
  { nome: 'Dashboard', href: '/', adminOnly: false },
  { nome: 'Ordens de Serviço', href: '/os', adminOnly: false },
  { nome: 'Frente de Caixa', href: '/caixa', adminOnly: false }, 
  { nome: 'Relatórios', href: '/relatorios', adminOnly: true },
  { nome: 'Lançar Despesas', href: '/despesas', adminOnly: true },
  { nome: 'Entrada de Estoque', href: '/entrada-estoque', adminOnly: true },
  { nome: 'Clientes', href: '/clientes', adminOnly: false },
  { nome: 'Veículos', href: '/carros', adminOnly: false }, // <-- NOVO ITEM
  { nome: 'Fornecedores', href: '/fornecedores', adminOnly: false },
  { nome: 'Produtos (Peças)', href: '/produtos', adminOnly: true },
  { nome: 'Gerenciar Usuários', href: '/usuarios', adminOnly: true },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- Componente de Menu reutilizável ---
  const MenuNavegacao = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <>
      {/* Logo da Empresa */}
      <div className="p-5 text-center border-b border-gray-700">
        <Link href="/" onClick={onLinkClick}>
          <Image
            src="/logo.png" 
            alt="Logo Rodrigo Skaps"
            width={180} 
            height={50} 
            style={{ objectFit: 'contain', margin: '0 auto' }} 
            priority 
          />
        </Link>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItens.map((item) => {
          if (!item.adminOnly) {
            return (
              <Link
                key={item.nome}
                href={item.href}
                className="block px-4 py-2 rounded text-lg hover:bg-gray-700 transition-colors"
                onClick={onLinkClick} 
              >
                {item.nome}
              </Link>
            );
          }
          if (item.adminOnly && isAdmin) {
            return (
              <Link
                key={item.nome}
                href={item.href}
                className="block px-4 py-2 rounded text-lg hover:bg-gray-700 transition-colors"
                onClick={onLinkClick} 
              >
                {item.nome}
              </Link>
            );
          }
          return null; 
        })}
      </nav>
      <div className='p-4 border-t border-gray-700'>
        <p className='text-sm text-gray-400 mb-2'>Logado como: {userData?.nome}</p>
        <Button 
          variant="destructive" 
          className='w-full'
          onClick={() => auth.signOut()}
        >
          <LogOut className='mr-2 h-4 w-4' />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <div className="relative min-h-screen md:flex">
      
      {/* --- Overlay do Menu Mobile --- */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden" 
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* --- Sidebar Mobile (Flutuante) --- */}
      <aside 
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-gray-900 text-white flex flex-col z-50 transition-transform duration-300 ease-in-out md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setMobileMenuOpen(false)} 
          className="absolute top-3 right-3 text-white hover:text-white hover:bg-gray-700"
        >
            <X className="h-6 w-6" />
        </Button>
        <MenuNavegacao onLinkClick={() => setMobileMenuOpen(false)} />
      </aside>

      {/* ===== SIDEBAR (Desktop - Fixo) ===== */}
      <aside className="w-64 bg-gray-900 text-white flex-col hidden md:flex">
        <MenuNavegacao />
      </aside>

      {/* ===== ÁREA DE CONTEÚDO PRINCIPAL ===== */}
      <div className="flex-1 flex flex-col w-full md:w-auto">
        
        {/* --- Header Mobile --- */}
        <header className="md:hidden bg-gray-800 text-white p-4 flex items-center shadow-md sticky top-0 z-30">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setMobileMenuOpen(true)}
            className="text-white hover:text-white hover:bg-gray-700"
          >
            <Menu className="h-6 w-6" />
          </Button>
          {/* Logo no Header Mobile */}
          <div className="ml-4">
            <Image
              src="/logo.png" 
              alt="Logo Rodrigo Skaps"
              width={130} 
              height={36} 
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto bg-gray-100">
          {children} 
        </main>
      </div>
    </div>
  );
}