"use client"

import { useState } from "react"
import { ShoppingCart, CheckCircle2, Trash2, Pencil, X, Calendar } from "lucide-react"
import type { Produto } from "./cadastros"
import type { LancamentosData } from "./lancamentos"
import { supabase } from "@/lib/supabase"

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

interface ComprasCMVProps {
  produtos: Produto[]
  data: LancamentosData & { compras: any[] }
  onChange: () => void
}

export function ComprasCMV({ produtos, data, onChange }: ComprasCMVProps) {
  const [produtoId, setProdutoId] = useState<string>("")
  const [quantidade, setQuantidade] = useState<string>("")
  const [valorUnitario, setValorUnitario] = useState<string>("")
  const [compraSalva, setCompraSalva] = useState(false)
  const [compraEditando, setCompraEditando] = useState<number | null>(null)

  const qtd = parseFloat(quantidade.replace(",", ".")) || 0
  const vu = parseFloat(valorUnitario.replace(",", ".")) || 0
  const valorTotal = qtd * vu
  const produtoSelecionado = produtos.find((p) => String(p.id) === produtoId)
  const totalCompras = data.compras.reduce((a, c) => a + c.valorTotal, 0)

  const handleRegistrarCompra = async () => {
    if (!produtoSelecionado || qtd <= 0 || vu <= 0) return
    if (compraEditando) {
      await supabase.from('compras').update({ produto_id: parseInt(produtoId), quantidade: qtd, valor_unitario: vu }).eq('id', compraEditando)
    } else {
      await supabase.from('compras').insert([{ produto_id: parseInt(produtoId), quantidade: qtd, valor_unitario: vu }])
    }
    setProdutoId(""); setQuantidade(""); setValorUnitario(""); setCompraEditando(null)
    setCompraSalva(true); setTimeout(() => setCompraSalva(false), 2000)
    onChange() 
  }

  const handleDeletarCompra = async (id: number, nomeProduto: string) => {
    if (window.confirm(`Apagar a compra de ${nomeProduto}?`)) {
      await supabase.from('compras').delete().eq('id', id)
      onChange() 
    }
  }

  const handleEditarCompra = (compra: any) => {
    const prod = produtos.find(p => p.nome === compra.produto)
    if (prod) setProdutoId(String(prod.id))
    setQuantidade(String(compra.quantidade))
    setValorUnitario(String(compra.valorUnitario))
    setCompraEditando(compra.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6 pb-20">
      <div><h2 className="text-2xl font-bold text-foreground mb-1">Compras (CMV)</h2><p className="text-muted-foreground text-base">Registe ingredientes e embalagens.</p></div>

      <div className={`bg-card rounded-2xl border-2 p-6 shadow-sm space-y-5 transition-colors ${compraEditando ? "border-blue-400 bg-blue-50/30" : "border-border"}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{compraEditando ? "Editar Compra" : "Nova Compra"}</h3>
          {compraEditando && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">Editando</span>}
        </div>

        <div className="space-y-2">
          <label className="font-semibold block">Produto</label>
          <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="w-full text-lg p-4 rounded-xl border-2 bg-background focus:border-[#C0392B] outline-none">
            <option value="">Escolha...</option>
            {produtos.map((p) => <option key={p.id} value={String(p.id)}>{p.nome} ({p.unidade})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="font-semibold block">Qtd (Ex: 0.150)</label>
            <input type="number" min="0" step="0.001" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0.000" className="w-full text-xl p-4 rounded-xl border-2 focus:border-[#C0392B] outline-none" />
          </div>
          <div className="space-y-2">
            <label className="font-semibold block">Valor Unitário R$</label>
            <input type="number" min="0" step="0.01" value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} placeholder="0,00" className="w-full text-xl p-4 rounded-xl border-2 focus:border-[#C0392B] outline-none" />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-muted border">
          <span className="font-semibold text-muted-foreground">Valor Total</span>
          <span className="text-2xl font-extrabold text-[#1E6B43]">{formatBRL(valorTotal)}</span>
        </div>

        <div className="flex gap-3">
          {compraEditando && <button onClick={() => {setProdutoId(""); setQuantidade(""); setValorUnitario(""); setCompraEditando(null)}} className="flex-1 py-4 bg-muted text-muted-foreground rounded-xl font-bold hover:bg-border"><X className="inline" /> Cancelar</button>}
          <button onClick={handleRegistrarCompra} disabled={!produtoSelecionado || qtd <= 0 || vu <= 0} className={`flex-[2] py-4 rounded-xl text-white font-bold disabled:opacity-50 ${compraEditando ? "bg-blue-600 hover:bg-blue-700" : "bg-[#C0392B] hover:bg-[#9B2B1F]"}`}>
            {compraSalva ? <CheckCircle2 className="inline" /> : compraEditando ? <Pencil className="inline" /> : <ShoppingCart className="inline" />} {compraEditando ? "Atualizar" : "Registar"}
          </button>
        </div>
      </div>

      {data.compras.length > 0 && (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 bg-muted border-b flex justify-between"><h3 className="text-xl font-bold">Histórico</h3><span className="font-bold text-[#1E6B43]">{formatBRL(totalCompras)}</span></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 text-sm text-muted-foreground">Data</th>
                  <th className="text-left p-4 text-sm text-muted-foreground">Produto</th>
                  <th className="text-right p-4 text-sm text-muted-foreground">Qtd</th>
                  <th className="text-right p-4 text-sm text-muted-foreground">Total</th>
                  <th className="text-center p-4 text-sm text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.compras.map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="p-4 text-sm font-medium whitespace-nowrap"><Calendar className="inline w-4 h-4 mr-1 text-muted-foreground"/> {c.data_compra ? c.data_compra.split('-').reverse().join('/') : "Hoje"}</td>
                    <td className="p-4 font-semibold">{c.produto}</td>
                    <td className="p-4 text-right font-medium">{c.quantidade}</td>
                    <td className="p-4 text-right font-bold text-[#1E6B43]">{formatBRL(c.valorTotal)}</td>
                    <td className="p-4 text-center space-x-2 whitespace-nowrap">
                      <button onClick={() => handleEditarCompra(c)} className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDeletarCompra(c.id, c.produto)} className="p-2 bg-red-100 text-red-700 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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