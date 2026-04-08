"use client"

import { useState } from "react"
import { ShoppingCart, CheckCircle2, Trash2, Pencil, X } from "lucide-react"
import type { Produto } from "./cadastros"
import type { LancamentosData } from "./lancamentos"

// 1. Importação do Supabase
import { supabase } from "@/lib/supabase"

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

interface ComprasCMVProps {
  produtos: Produto[]
  data: LancamentosData
  onChange: (data?: any) => void
}

export function ComprasCMV({ produtos, data, onChange }: ComprasCMVProps) {
  const [produtoId, setProdutoId] = useState<string>("")
  const [quantidade, setQuantidade] = useState<string>("")
  const [valorUnitario, setValorUnitario] = useState<string>("")
  const [compraSalva, setCompraSalva] = useState(false)
  
  // Novo estado para saber se estamos a editar uma compra existente
  const [compraEditando, setCompraEditando] = useState<number | null>(null)

  const qtd = parseFloat(quantidade) || 0
  const vu = parseFloat(valorUnitario.replace(",", ".")) || 0
  const valorTotal = qtd * vu
  const produtoSelecionado = produtos.find((p) => String(p.id) === produtoId)
  const totalCompras = data.compras.reduce((a, c) => a + c.valorTotal, 0)

  // ==========================================
  // SALVAR OU ATUALIZAR COMPRA
  // ==========================================
  const handleRegistrarCompra = async () => {
    if (!produtoSelecionado || qtd <= 0 || vu <= 0) return

    if (compraEditando) {
      // 1. MODO EDIÇÃO: Atualiza a linha existente no Supabase
      const { error } = await supabase
        .from('compras')
        .update({
          produto_id: parseInt(produtoId),
          quantidade: qtd,
          valor_unitario: vu
        })
        .eq('id', compraEditando)

      if (error) {
        alert("Erro ao atualizar a compra: " + error.message)
        return
      }
    } else {
      // 2. MODO CRIAÇÃO: Insere uma nova linha
      const { error } = await supabase
        .from('compras')
        .insert([
          { 
            produto_id: parseInt(produtoId), 
            quantidade: qtd,
            valor_unitario: vu
          }
        ])

      if (error) {
        alert("Erro ao guardar a compra na base de dados: " + error.message)
        return
      }
    }

    // Limpa o formulário, sai do modo de edição e avisa a página principal para atualizar a lista
    setProdutoId("")
    setQuantidade("")
    setValorUnitario("")
    setCompraEditando(null)
    setCompraSalva(true)
    setTimeout(() => setCompraSalva(false), 2000)
    
    onChange() // Dispara o recarregamento no page.tsx
  }

  // ==========================================
  // APAGAR COMPRA
  // ==========================================
  const handleDeletarCompra = async (id: number, nomeProduto: string) => {
    // Pede confirmação para evitar cliques acidentais
    if (!window.confirm(`Tem a certeza que deseja apagar a compra de ${nomeProduto}?`)) {
      return
    }

    const { error } = await supabase
      .from('compras')
      .delete()
      .eq('id', id)

    if (error) {
      alert("Erro ao apagar: " + error.message)
      return
    }

    // Avisa a página principal para recarregar a lista
    onChange() 
  }

  // ==========================================
  // PREPARAR MODO DE EDIÇÃO
  // ==========================================
  const handleEditarCompra = (compra: any) => {
    // Procura o ID do produto baseado no nome para colocar no select
    const prod = produtos.find(p => p.nome === compra.produto)
    if (prod) {
      setProdutoId(String(prod.id))
    }
    setQuantidade(String(compra.quantidade))
    setValorUnitario(String(compra.valorUnitario))
    setCompraEditando(compra.id)
    
    // Faz scroll para o topo suavemente para a avó ver o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelarEdicao = () => {
    setProdutoId("")
    setQuantidade("")
    setValorUnitario("")
    setCompraEditando(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Compras (CMV)</h2>
        <p className="text-muted-foreground text-base">
          Registe aqui <strong>ingredientes e embalagens de pizza</strong> (caixas, sacos). Estes valores entram diretamente no cálculo do CMV.
        </p>
      </div>

      {/* Formulário */}
      <div className={`bg-card rounded-2xl border-2 p-6 shadow-sm space-y-5 transition-colors ${compraEditando ? "border-blue-400 bg-blue-50/30" : "border-border"}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">
            {compraEditando ? "Editar Compra de Insumo" : "Registar Nova Compra de Insumo"}
          </h3>
          {compraEditando && (
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
              Modo de Edição
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-base font-semibold text-foreground block">Produto / Ingrediente</label>
          <select
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            className="w-full text-lg px-4 py-3.5 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors appearance-none cursor-pointer"
          >
            <option value="">Escolha o produto...</option>
            {produtos.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.nome} ({p.unidade})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-base font-semibold text-foreground block">Quantidade Comprada</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="0"
              className="w-full text-xl px-4 py-4 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-base font-semibold text-foreground block">Valor Unitário (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorUnitario}
              onChange={(e) => setValorUnitario(e.target.value)}
              placeholder="0,00"
              className="w-full text-xl px-4 py-4 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border">
          <span className="text-base font-semibold text-muted-foreground">Valor Total (calculado)</span>
          <span className="text-2xl font-extrabold text-[#1E6B43]">{formatBRL(valorTotal)}</span>
        </div>

        <div className="flex gap-3">
          {compraEditando && (
            <button
              onClick={handleCancelarEdicao}
              className="flex-1 flex items-center justify-center gap-2 text-lg font-bold py-5 px-4 rounded-xl bg-muted text-muted-foreground hover:bg-border transition-all"
            >
              <X className="w-6 h-6" /> Cancelar
            </button>
          )}
          
          <button
            onClick={handleRegistrarCompra}
            disabled={!produtoSelecionado || qtd <= 0 || vu <= 0}
            className={`flex-[2] flex items-center justify-center gap-3 text-xl font-bold py-5 px-6 rounded-xl text-white active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              compraEditando ? "bg-blue-600 hover:bg-blue-700" : "bg-[#C0392B] hover:bg-[#9B2B1F]"
            }`}
          >
            {compraSalva ? (
              <><CheckCircle2 className="w-6 h-6" /> {compraEditando ? "Compra Atualizada!" : "Compra Registada!"}</>
            ) : (
              <>
                {compraEditando ? <Pencil className="w-6 h-6" /> : <ShoppingCart className="w-6 h-6" />}
                {compraEditando ? "Atualizar Compra" : "Registar Compra"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Histórico */}
      {data.compras.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-muted border-b border-border flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">Compras Registadas</h3>
            <span className="text-base font-bold text-[#1E6B43]">{formatBRL(totalCompras)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">Produto</th>
                  <th className="text-right px-4 py-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">Qtd</th>
                  <th className="text-right px-4 py-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">V. Unit.</th>
                  <th className="text-right px-6 py-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">V. Total</th>
                  <th className="text-center px-4 py-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.compras.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 text-base font-semibold text-foreground">{c.produto}</td>
                    <td className="px-4 py-4 text-base text-right text-foreground">{c.quantidade}</td>
                    <td className="px-4 py-4 text-base text-right text-foreground">{formatBRL(c.valorUnitario)}</td>
                    <td className="px-6 py-4 text-base font-bold text-right text-[#1E6B43]">{formatBRL(c.valorTotal)}</td>
                    <td className="px-4 py-4 text-center space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleEditarCompra(c)}
                        className="p-2 inline-flex items-center justify-center bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        title="Editar Compra"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeletarCompra(c.id, c.produto)}
                        className="p-2 inline-flex items-center justify-center bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        title="Apagar Compra"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}