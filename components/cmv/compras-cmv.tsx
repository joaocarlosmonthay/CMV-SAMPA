"use client"

import { useState } from "react"
import { ShoppingCart, CheckCircle2, Trash2, Pencil, X, Calendar } from "lucide-react"
import type { Produto } from "./cadastros"
import { supabase } from "@/lib/supabase"

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// MÁGICA DO TIO TIAGO: Mostrar até 5 casas decimais para itens como o Ketchup!
const formatUnitario = (v: number) => 
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 5 })

interface ComprasCMVProps {
  produtos: Produto[]
  data: any 
  onChange: (data?: any) => void
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
  
  const totalCompras = data.compras ? data.compras.reduce((a: any, c: any) => a + c.valorTotal, 0) : 0

  const handleRegistrarCompra = async () => {
    if (!produtoSelecionado || qtd <= 0 || vu <= 0) return

    if (compraEditando) {
      const { error } = await supabase
        .from('compras')
        .update({
          produto_id: parseInt(produtoId),
          quantidade: qtd,
          valor_unitario: vu
        })
        .eq('id', compraEditando)

      if (error) { alert("Erro ao atualizar: " + error.message); return }
    } else {
      const { error } = await supabase
        .from('compras')
        .insert([{ 
            produto_id: parseInt(produtoId), 
            quantidade: qtd,
            valor_unitario: vu
        }])

      if (error) { alert("Erro ao guardar: " + error.message); return }
    }

    setProdutoId("")
    setQuantidade("")
    setValorUnitario("")
    setCompraEditando(null)
    setCompraSalva(true)
    setTimeout(() => setCompraSalva(false), 2000)
    
    onChange() 
  }

  const handleDeletarCompra = async (id: number, nomeProduto: string) => {
    if (!window.confirm(`Tem a certeza que deseja apagar a compra de ${nomeProduto}?`)) return

    const { error } = await supabase.from('compras').delete().eq('id', id)
    if (error) { alert("Erro ao apagar: " + error.message); return }
    
    onChange() 
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
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Compras (CMV)</h2>
        <p className="text-muted-foreground text-base">Registe aqui ingredientes e embalagens.</p>
      </div>

      <div className={`bg-card rounded-2xl border-2 p-6 shadow-sm space-y-5 transition-colors ${compraEditando ? "border-blue-400 bg-blue-50/30" : "border-border"}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">
            {compraEditando ? "Editar Compra" : "Nova Compra"}
          </h3>
          {compraEditando && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">Modo de Edição</span>}
        </div>

        <div className="space-y-2">
          <label className="text-base font-semibold text-foreground block">Produto / Ingrediente</label>
          <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="w-full text-lg px-4 py-3.5 rounded-xl border-2 bg-background focus:border-[#2563EB] outline-none cursor-pointer">
            <option value="">Escolha o produto...</option>
            {produtos.map((p) => <option key={p.id} value={String(p.id)}>{p.nome} ({p.unidade})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-base font-semibold text-foreground block">Qtd (Ex: 0.150)</label>
            <input type="number" min="0" step="0.001" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0.000" className="w-full text-xl px-4 py-4 rounded-xl border-2 bg-background focus:border-[#2563EB] outline-none" />
          </div>
          <div className="space-y-2">
            {/* O SEGREDO DO KETCHUP: 5 CASAS DECIMAIS */}
            <label className="text-base font-semibold text-blue-600 block">Valor Unitário (R$ com até 5 casas)</label>
            <input type="number" min="0" step="0.00001" value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} placeholder="0,08224" className="w-full text-xl px-4 py-4 rounded-xl border-2 border-blue-200 bg-background focus:border-[#2563EB] outline-none" />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border">
          <span className="text-base font-semibold text-muted-foreground">Valor Total</span>
          <span className="text-2xl font-extrabold text-[#1E3A8A]">{formatBRL(valorTotal)}</span>
        </div>

        <div className="flex gap-3">
          {compraEditando && <button onClick={() => {setProdutoId(""); setQuantidade(""); setValorUnitario(""); setCompraEditando(null)}} className="flex-1 flex items-center justify-center gap-2 text-lg font-bold py-5 px-4 rounded-xl bg-muted text-muted-foreground hover:bg-border transition-all"><X className="w-6 h-6" /> Cancelar</button>}
          <button onClick={handleRegistrarCompra} disabled={!produtoSelecionado || qtd <= 0 || vu <= 0} className={`flex-[2] flex items-center justify-center gap-3 text-xl font-bold py-5 px-6 rounded-xl text-white transition-all disabled:opacity-40 ${compraEditando ? "bg-blue-600 hover:bg-blue-700" : "bg-[#2563EB] hover:bg-[#1E3A8A]"}`}>
            {compraSalva ? <><CheckCircle2 className="w-6 h-6" /> Registado!</> : <>{compraEditando ? <Pencil className="w-6 h-6" /> : <ShoppingCart className="w-6 h-6" />} {compraEditando ? "Atualizar" : "Registar"}</>}
          </button>
        </div>
      </div>

      {data.compras && data.compras.length > 0 && (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-muted border-b flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">Compras Registadas</h3>
            <span className="text-base font-bold text-[#1E3A8A]">{formatBRL(totalCompras)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-3 text-sm font-bold text-muted-foreground">Data</th>
                  <th className="text-left px-6 py-3 text-sm font-bold text-muted-foreground">Produto</th>
                  <th className="text-right px-4 py-3 text-sm font-bold text-muted-foreground">Qtd</th>
                  <th className="text-right px-4 py-3 text-sm font-bold text-muted-foreground">V. Unit</th>
                  <th className="text-right px-6 py-3 text-sm font-bold text-muted-foreground">Total</th>
                  <th className="text-center px-4 py-3 text-sm font-bold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* O (c: any) MATA O ERRO DO TYPESCRIPT */}
                {data.compras.map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/50">
                    <td className="px-4 py-4 text-sm font-medium text-muted-foreground whitespace-nowrap"><Calendar className="inline w-4 h-4 mr-1"/> {c.data_compra ? c.data_compra.split('-').reverse().join('/') : "Hoje"}</td>
                    <td className="px-6 py-4 text-base font-semibold">{c.produto}</td>
                    <td className="px-4 py-4 text-base text-right">{c.quantidade}</td>
                    <td className="px-4 py-4 text-base text-right font-mono text-blue-600">{formatUnitario(c.valorUnitario)}</td>
                    <td className="px-6 py-4 text-base font-bold text-right text-[#1E3A8A]">{formatBRL(c.valorTotal)}</td>
                    <td className="px-4 py-4 text-center space-x-2 whitespace-nowrap">
                      <button onClick={() => handleEditarCompra(c)} className="p-2 inline-flex items-center bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"><Pencil className="w-5 h-5" /></button>
                      <button onClick={() => handleDeletarCompra(c.id, c.produto)} className="p-2 inline-flex items-center bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><Trash2 className="w-5 h-5" /></button>
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