"use client"

import { useState, useEffect } from "react"
import { Package, ShoppingCart, DollarSign, Trash2, Save, CheckCircle2, ArrowDownToLine, Lock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "react-hot-toast"

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export type ContagemEstoque = Record<number, { qtd: string; valor: string }>

interface EstoqueProps {
  dataInicio: string
  dataFim: string
  produtos: any[]
  data: any
  contagemInicial: ContagemEstoque
  contagemFinal: ContagemEstoque
  onChange: () => Promise<void>
  onSemanaFechada: () => void
  isReadOnly: boolean
}

export function Estoque({ dataInicio, dataFim, produtos, data, contagemInicial, contagemFinal, onChange, onSemanaFechada, isReadOnly }: EstoqueProps) {
  const [aba, setAba] = useState<"inicial" | "compras" | "saidas" | "faturamento" | "final">("inicial")
  const [novoLancamento, setNovoLancamento] = useState({ produto: "", quantidade: "", valorTotal: "", motivo: "Quebra/Desperdício" })
  const [faturamento, setFaturamento] = useState(data.faturamento?.toString() || "")
  const [contagem, setContagem] = useState<ContagemEstoque>({})

  useEffect(() => {
    setContagem(aba === "inicial" ? contagemInicial : contagemFinal)
  }, [aba, contagemInicial, contagemFinal])

  useEffect(() => {
    setFaturamento(data.faturamento?.toString() || "")
  }, [data.faturamento])

  const handleSalvarCompra = async () => {
    if (isReadOnly) return toast.error("Período travado para edições!")
    if (!novoLancamento.produto || !novoLancamento.quantidade || !novoLancamento.valorTotal) return toast.error("Preencha todos os campos!")
    const prod = produtos.find((p: any) => p.nome === novoLancamento.produto)
    const vTotal = parseFloat(novoLancamento.valorTotal.replace(',', '.')), qtd = parseFloat(novoLancamento.quantidade.replace(',', '.'))
    await supabase.from('compras').insert([{ produto_id: prod.id, quantidade: qtd, valor_unitario: vTotal / qtd, data_compra: dataInicio }])
    toast.success("Compra salva!"); setNovoLancamento({ produto: "", quantidade: "", valorTotal: "", motivo: "Quebra/Desperdício" }); onChange();
  }

  const handleSalvarSaida = async () => {
    if (isReadOnly) return toast.error("Período travado para edições!")
    if (!novoLancamento.produto || !novoLancamento.quantidade || !novoLancamento.motivo) return toast.error("Preencha todos os campos!")
    const prod = produtos.find((p: any) => p.nome === novoLancamento.produto)
    await supabase.from('saidas_avulsas').insert([{ produto_id: prod.id, quantidade: parseFloat(novoLancamento.quantidade.replace(',', '.')), motivo: novoLancamento.motivo, data_saida: dataInicio }])
    toast.success("Saída salva!"); setNovoLancamento({ produto: "", quantidade: "", valorTotal: "", motivo: "Quebra/Desperdício" }); onChange();
  }

  const handleExcluir = async (id: number, tabela: string) => {
    if (isReadOnly) return toast.error("Período travado para edições!")
    if (!confirm("Apagar lançamento?")) return
    await supabase.from(tabela).delete().eq('id', id)
    toast.success("Removido com sucesso!"); onChange();
  }

  const handleSalvarContagem = async () => {
    if (isReadOnly) return toast.error("Período travado para edições!")
    const tipo = aba === "inicial" ? "Inicial" : "Final"
    await supabase.from('estoques').delete().eq('tipo_contagem', tipo).gte('data_contagem', dataInicio).lte('data_contagem', dataFim)
    
    const inserts = Object.entries(contagem).map(([id, d]) => {
      // Se for Estoque Final, ele espelha o custo que estava no Estoque Inicial automaticamente
      const valorCorreto = tipo === "Final" ? (contagemInicial[parseInt(id)]?.valor || "0") : d.valor;
      
      return {
        produto_id: parseInt(id), 
        quantidade: parseFloat(d.qtd.replace(',', '.')), 
        valor_unitario: parseFloat(valorCorreto.replace(',', '.')), 
        tipo_contagem: tipo, 
        data_contagem: dataInicio 
      }
    }).filter(i => !isNaN(i.quantidade) && !isNaN(i.valor_unitario))
    
    if (inserts.length > 0) {
      await supabase.from('estoques').insert(inserts)
      toast.success(`Estoque ${tipo} salvo!`); onChange();
    } else {
      toast.success(`Estoque limpo!`); onChange();
    }
  }

  const handlePuxarAnterior = async () => {
    if (isReadOnly) return toast.error("Período travado!")
    const d = new Date(dataInicio + "T12:00:00")
    d.setDate(d.getDate() - 7)
    const semAnt = d.toISOString().split('T')[0]

    toast("Buscando fechamento anterior...", { icon: "⏳" })
    const { data: estAnterior } = await supabase.from('estoques').select('*').eq('tipo_contagem', 'Final').eq('data_contagem', semAnt)

    if (estAnterior && estAnterior.length > 0) {
      const novoEstoque = { ...contagem }
      estAnterior.forEach((e: any) => {
        novoEstoque[e.produto_id] = { qtd: e.quantidade.toString(), valor: e.valor_unitario.toString() }
      })
      setContagem(novoEstoque)
      toast.success("Dados carregados na tela! Clique em SALVAR MANUALMENTE para confirmar.")
    } else {
      toast.error("Nenhum fechamento encontrado na semana anterior.")
    }
  }

  const handleSalvarFaturamento = async () => {
    if (isReadOnly) return toast.error("Período travado para edições!")
    const fatVal = parseFloat(faturamento.replace(',', '.')) || 0
    const { data: ex } = await supabase.from('financas_semanais').select('id').eq('data_inicio', dataInicio).maybeSingle()
    if (ex) await supabase.from('financas_semanais').update({ faturamento: fatVal }).eq('id', ex.id)
    else await supabase.from('financas_semanais').insert([{ data_inicio: dataInicio, data_fim: dataFim, faturamento: fatVal }])
    toast.success("Faturamento salvo!"); onChange();
  }

  return (
    <div className="space-y-6 relative">
      {isReadOnly && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-xl flex items-center gap-3 shadow-sm">
          <Lock className="w-5 h-5" />
          <p className="font-bold text-sm">PERÍODO ENCERRADO: Este ciclo já foi fechado. Os dados estão bloqueados para evitar alterações no histórico.</p>
        </div>
      )}

      <div className="flex bg-white p-2 rounded-2xl shadow-sm border overflow-x-auto no-scrollbar">
        {[
          { id: "inicial", label: "Estoque Inicial" },
          { id: "compras", label: "Compras" },
          { id: "saidas", label: "Saídas Avulsas" },
          { id: "faturamento", label: "Faturamento" },
          { id: "final", label: "Estoque Final" }
        ].map(t => (
          <button key={t.id} onClick={() => setAba(t.id as any)} className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-bold text-sm transition-all ${aba === t.id ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white p-8 rounded-[32px] shadow-sm border">

        {aba === "compras" && (
          <div className="space-y-6">
            {!isReadOnly && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-6 rounded-2xl border">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Insumo</label>
                  <select className="p-3 rounded-xl border font-bold outline-none focus:border-blue-500" value={novoLancamento.produto} onChange={e => setNovoLancamento({ ...novoLancamento, produto: e.target.value })}>
                    <option value="">Selecione...</option>{produtos.map((p: any) => <option key={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Qtd Comprada</label>
                  <input type="text" placeholder="0" className="p-3 rounded-xl border font-bold outline-none focus:border-blue-500" value={novoLancamento.quantidade} onChange={e => setNovoLancamento({ ...novoLancamento, quantidade: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">R$ Total da Nota</label>
                  <input type="text" placeholder="0,00" className="p-3 rounded-xl border font-bold bg-amber-50 outline-none focus:border-amber-500" value={novoLancamento.valorTotal} onChange={e => setNovoLancamento({ ...novoLancamento, valorTotal: e.target.value })} />
                </div>
                <button onClick={handleSalvarCompra} className="bg-blue-600 text-white p-3 rounded-xl font-black hover:bg-blue-700 transition-colors flex justify-center items-center gap-2"><ShoppingCart className="w-5 h-5" /> LANÇAR</button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-slate-400 font-black uppercase text-[10px]"><tr><th className="pb-3 text-left">Item Comprado</th><th className="pb-3 text-center">Quantidade</th><th className="pb-3 text-right">Valor Total</th>{!isReadOnly && <th className="pb-3 text-right">Ação</th>}</tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {data.compras.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group"><td className="py-4 font-bold text-slate-700">{c.produto}</td><td className="py-4 text-center font-bold text-slate-500">{c.quantidade}</td><td className="py-4 text-right font-black text-blue-600">{formatBRL(c.valorTotal)}</td>{!isReadOnly && <td className="py-4 text-right"><button onClick={() => handleExcluir(c.id, 'compras')} className="p-2 text-slate-300 hover:text-red-600 bg-white shadow-sm border border-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button></td>}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aba === "saidas" && (
          <div className="space-y-6">
            {!isReadOnly && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-6 rounded-2xl border">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Insumo Perdido</label>
                  <select className="p-3 rounded-xl border font-bold outline-none focus:border-amber-500" value={novoLancamento.produto} onChange={e => setNovoLancamento({ ...novoLancamento, produto: e.target.value })}>
                    <option value="">Selecione...</option>{produtos.map((p: any) => <option key={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Qtd Descartada</label>
                  <input type="text" placeholder="0" className="p-3 rounded-xl border font-bold outline-none focus:border-amber-500" value={novoLancamento.quantidade} onChange={e => setNovoLancamento({ ...novoLancamento, quantidade: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Motivo</label>
                  <select className="p-3 rounded-xl border font-bold outline-none focus:border-amber-500" value={novoLancamento.motivo} onChange={e => setNovoLancamento({ ...novoLancamento, motivo: e.target.value })}>
                    <option value="Quebra/Desperdício">Prensadão</option>
                    <option value="Quebra/Desperdício">Desperdicio</option>
                    <option value="Refeição Funcionários">Refeição Funcionários</option>
                    <option value="Vencido">Vencido</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <button onClick={handleSalvarSaida} className="bg-amber-500 text-white p-3 rounded-xl font-black hover:bg-amber-600 transition-colors flex justify-center items-center gap-2"><Package className="w-5 h-5" /> REGISTRAR</button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-slate-400 font-black uppercase text-[10px]"><tr><th className="pb-3 text-left">Item Descartado</th><th className="pb-3 text-left">Motivo</th><th className="pb-3 text-center">Quantidade</th>{!isReadOnly && <th className="pb-3 text-right">Ação</th>}</tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {data.saidas.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors group"><td className="py-4 font-bold text-slate-700">{s.produto}</td><td className="py-4 font-bold text-slate-500">{s.motivo}</td><td className="py-4 text-center font-black text-amber-600">{s.quantidade}</td>{!isReadOnly && <td className="py-4 text-right"><button onClick={() => handleExcluir(s.id, 'saidas_avulsas')} className="p-2 text-slate-300 hover:text-red-600 bg-white shadow-sm border border-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button></td>}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(aba === "inicial" || aba === "final") && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center bg-slate-50 p-6 rounded-2xl border border-slate-200 gap-4">
              <h3 className="font-black text-xl text-slate-800">Contagem {aba.toUpperCase()}</h3>
              <div className="flex gap-3">
                {aba === "inicial" && !isReadOnly && (
                  <button onClick={handlePuxarAnterior} className="bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-100 transition-colors shadow-sm"><ArrowDownToLine className="w-4 h-4" /> PUXAR ANTERIOR</button>
                )}
                {!isReadOnly && <button onClick={handleSalvarContagem} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"><Save className="w-4 h-4" /> SALVAR CONTAGEM</button>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {produtos.map((p: any) => (
                <div key={p.id} className={`p-4 border rounded-2xl ${isReadOnly ? 'bg-slate-50 opacity-70' : 'bg-white hover:border-blue-300 transition-colors'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-bold text-slate-700">{p.nome}</p>
                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{p.unidade}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Qtd Real</label>
                      <input type="text" disabled={isReadOnly} className="w-full p-2 border rounded-lg text-sm font-bold disabled:bg-slate-100 outline-none focus:border-blue-500" value={contagem[p.id]?.qtd || ""} onChange={e => setContagem({ ...contagem, [p.id]: { ...contagem[p.id], qtd: e.target.value } })} />
                    </div>
                    
                    {aba === "inicial" ? (
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">R$ Unitário</label>
                        <input type="text" disabled={isReadOnly} className="w-full p-2 border rounded-lg text-sm font-bold disabled:bg-slate-100 outline-none focus:border-blue-500" value={contagem[p.id]?.valor || ""} onChange={e => setContagem({ ...contagem, [p.id]: { ...contagem[p.id], valor: e.target.value } })} />
                      </div>
                    ) : (
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Custo Aplicado</label>
                        <div className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-400 flex items-center h-[38px] overflow-hidden">
                          {formatBRL(parseFloat(contagemInicial[p.id]?.valor?.replace(',', '.') || "0"))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>

            {/* BOTÃO DE ENCERRAR SEMANA AGORA FICA AQUI NO ESTOQUE FINAL */}
            {aba === "final" && !isReadOnly && (
              <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col items-center">
                <h4 className="text-lg font-black text-slate-800 mb-2">Finalizou a contagem?</h4>
                <p className="text-sm text-slate-500 font-medium mb-6 text-center max-w-md">Lembre-se de salvar a contagem acima antes de encerrar o ciclo. O encerramento trava esta semana contra novas edições.</p>
                <button onClick={onSemanaFechada} className="w-full max-w-sm bg-slate-900 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-transform hover:scale-105 shadow-xl">
                  <CheckCircle2 className="w-6 h-6" /> ENCERRAR SEMANA OFICIALMENTE
                </button>
              </div>
            )}
          </div>
        )}

        {aba === "faturamento" && (
          <div className="flex flex-col items-center py-12 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
              <DollarSign className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-6">Faturamento Bruto</h3>
            <div className="relative w-64 mb-6">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">R$</span>
              <input type="text" disabled={isReadOnly} value={faturamento} onChange={e => setFaturamento(e.target.value)} className="w-full pl-16 pr-6 py-5 text-3xl font-black border-2 border-slate-200 rounded-3xl disabled:bg-slate-100 outline-none focus:border-emerald-500 text-center" placeholder="0.00" />
            </div>
            {!isReadOnly && (
              <button onClick={handleSalvarFaturamento} className="w-64 bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-colors">SALVAR VENDAS</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}