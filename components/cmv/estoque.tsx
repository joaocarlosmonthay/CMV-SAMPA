"use client"

import { useState, useEffect } from "react"
import { Package, ShoppingCart, DollarSign, Trash2, Save, CheckCircle2, ArrowDownToLine } from "lucide-react"
import type { Produto } from "@/components/cmv/cadastros"
import { supabase } from "@/lib/supabase"
import { toast } from "react-hot-toast"

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export type ContagemEstoque = Record<number, { qtd: string; valor: string }>

interface EstoqueProps {
  dataInicio: string
  dataFim: string
  produtos: Produto[]
  data: any
  contagemInicial: ContagemEstoque
  contagemFinal: ContagemEstoque
  onChange: () => void
  onSemanaFechada: () => void
}

export function Estoque({ dataInicio, dataFim, produtos, data, contagemInicial, contagemFinal, onChange, onSemanaFechada }: EstoqueProps) {
  const [aba, setAba] = useState<"inicial" | "compras" | "saidas" | "faturamento" | "final">("inicial")
  
  const [novoLancamento, setNovoLancamento] = useState({ produto: "", quantidade: "", valorTotal: "", motivo: "Quebra/Desperdício" })
  const [faturamento, setFaturamento] = useState(data.faturamento?.toString() || "")
  const [contagem, setContagem] = useState<ContagemEstoque>({})

  useEffect(() => {
    if (aba === "inicial") setContagem(contagemInicial)
    else if (aba === "final") setContagem(contagemFinal)
  }, [aba, contagemInicial, contagemFinal])

  useEffect(() => {
    setFaturamento(data.faturamento?.toString() || "")
  }, [data.faturamento])

  const handleSalvarCompra = async () => {
    if (!novoLancamento.produto || !novoLancamento.quantidade || !novoLancamento.valorTotal) return toast.error("Preencha todos os campos da compra!")
    const prod = produtos.find(p => p.nome === novoLancamento.produto)
    if (!prod) return
    
    const vTotal = parseFloat(novoLancamento.valorTotal.replace(',', '.'))
    const qtd = parseFloat(novoLancamento.quantidade.replace(',', '.'))
    const vUnit = vTotal / qtd

    const { error } = await supabase.from('compras').insert([{
      produto_id: prod.id,
      quantidade: qtd,
      valor_unitario: vUnit,
      data_compra: dataInicio
    }])
    
    if (error) toast.error("Erro ao salvar: " + error.message)
    else {
      toast.success("Compra Lançada com Sucesso!")
      setNovoLancamento({ produto: "", quantidade: "", valorTotal: "", motivo: "Quebra/Desperdício" })
      onChange()
    }
  }

  const handleSalvarSaida = async () => {
    if (!novoLancamento.produto || !novoLancamento.quantidade || !novoLancamento.motivo) return toast.error("Preencha todos os campos da saída!")
    const prod = produtos.find(p => p.nome === novoLancamento.produto)
    if (!prod) return

    const { error } = await supabase.from('saidas_avulsas').insert([{
      produto_id: prod.id,
      quantidade: parseFloat(novoLancamento.quantidade.replace(',', '.')),
      motivo: novoLancamento.motivo,
      data_saida: dataInicio
    }])

    if (error) toast.error("Erro ao salvar: " + error.message)
    else {
      toast.success("Saída Registrada com Sucesso!")
      setNovoLancamento({ produto: "", quantidade: "", valorTotal: "", motivo: "Quebra/Desperdício" })
      onChange()
    }
  }

  const handleExcluir = async (id: number, tabela: string) => {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return
    await supabase.from(tabela).delete().eq('id', id)
    toast.success("Lançamento removido.")
    onChange()
  }

  const handleSalvarContagem = async () => {
    const tipo = aba === "inicial" ? "Inicial" : "Final"
    await supabase.from('estoques').delete().eq('tipo_contagem', tipo).gte('data_contagem', dataInicio).lte('data_contagem', dataFim)

    const inserts = Object.entries(contagem).map(([prodId, dados]) => ({
      produto_id: parseInt(prodId),
      quantidade: parseFloat(dados.qtd.replace(',', '.')),
      valor_unitario: parseFloat(dados.valor.replace(',', '.')), 
      tipo_contagem: tipo,
      data_contagem: dataInicio
    })).filter(i => !isNaN(i.quantidade) && !isNaN(i.valor_unitario))

    if (inserts.length > 0) {
      const { error } = await supabase.from('estoques').insert(inserts)
      if (error) toast.error("Erro ao salvar estoque.")
      else {
        toast.success(`Estoque ${tipo} salvo com sucesso!`)
        onChange()
      }
    } else {
      toast.success(`Estoque ${tipo} limpo!`)
      onChange()
    }
  }

  // BOTÃO COM AUTO-SAVE: PUXA E JÁ ATUALIZA A DASHBOARD NO MESMO SEGUNDO
  const handlePuxarAnterior = async () => {
    const d = new Date(dataInicio + "T12:00:00")
    d.setDate(d.getDate() - 7)
    const semAnt = d.toISOString().split('T')[0]
    
    toast("Buscando fechamento anterior...", { icon: "⏳" })
    const { data: estAnterior } = await supabase.from('estoques').select('*').eq('tipo_contagem', 'Final').eq('data_contagem', semAnt)
    
    if (estAnterior && estAnterior.length > 0) {
        const novoEstoque = { ...contagem }
        const inserts: any[] = []

        estAnterior.forEach((e: any) => {
            novoEstoque[e.produto_id] = { qtd: e.quantidade.toString(), valor: e.valor_unitario.toString() }
            inserts.push({
              produto_id: e.produto_id,
              quantidade: e.quantidade,
              valor_unitario: e.valor_unitario,
              tipo_contagem: 'Inicial',
              data_contagem: dataInicio
            })
        })
        setContagem(novoEstoque)

        // Limpa o que tinha antes e força o salvamento automático
        await supabase.from('estoques').delete().eq('tipo_contagem', 'Inicial').gte('data_contagem', dataInicio).lte('data_contagem', dataFim)
        await supabase.from('estoques').insert(inserts)

        toast.success("Estoque Inicial importado e salvo automaticamente! 🚀")
        onChange() // Isso é o que atualiza a Dashboard instantaneamente
    } else {
        toast.error("Nenhum fechamento encontrado na semana anterior.")
    }
  }

  const handleSalvarFaturamento = async () => {
    const fatVal = parseFloat(faturamento.replace(',', '.')) || 0
    const { data: existente } = await supabase.from('financas_semanais').select('id').eq('data_inicio', dataInicio).eq('data_fim', dataFim).maybeSingle()
    if (existente) {
      await supabase.from('financas_semanais').update({ faturamento: fatVal }).eq('id', existente.id)
    } else {
      await supabase.from('financas_semanais').insert([{ data_inicio: dataInicio, data_fim: dataFim, faturamento: fatVal }])
    }
    toast.success("Faturamento salvo com sucesso!")
    onChange()
  }

  return (
    <div className="space-y-6 relative">
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

      {aba === "compras" && (
        <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-end bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
            <div className="flex-1 w-full space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase">Buscar Insumo</label>
              <select className="w-full p-3.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm" value={novoLancamento.produto} onChange={e => setNovoLancamento({...novoLancamento, produto: e.target.value})}>
                <option value="">Selecione o que foi comprado...</option>
                {produtos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
              </select>
            </div>
            <div className="w-full md:w-32 space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase">Quantidade</label>
              <input type="text" placeholder="0" className="w-full p-3.5 rounded-xl border border-slate-200 font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm" value={novoLancamento.quantidade} onChange={e => setNovoLancamento({...novoLancamento, quantidade: e.target.value})} />
            </div>
            <div className="w-full md:w-48 space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">Valor Total da Nota <span className="text-red-500">*</span></label>
              <input type="text" placeholder="R$ Total" className="w-full p-3.5 rounded-xl border border-slate-200 font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm bg-amber-50 focus:bg-white" value={novoLancamento.valorTotal} onChange={e => setNovoLancamento({...novoLancamento, valorTotal: e.target.value})} />
            </div>
            <button onClick={handleSalvarCompra} className="w-full md:w-auto bg-blue-600 text-white px-6 py-3.5 rounded-xl font-black hover:bg-blue-700 hover:scale-[1.02] transition-all flex justify-center items-center gap-2 shadow-md">
              <ShoppingCart className="w-5 h-5"/> Lançar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase font-black text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="pb-3 px-4">Item Comprado</th>
                  <th className="pb-3 px-4 text-center">Qtd</th>
                  <th className="pb-3 px-4 text-right">Custo Total</th>
                  <th className="pb-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.compras.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4 px-4 font-bold text-slate-700">{c.produto}</td>
                    <td className="py-4 px-4 font-bold text-slate-500 text-center">{c.quantidade}</td>
                    <td className="py-4 px-4 font-black text-blue-600 text-right">{formatBRL(c.valorTotal)}</td>
                    <td className="py-4 px-4 flex justify-end">
                      <button onClick={() => handleExcluir(c.id, 'compras')} className="p-2 text-slate-300 hover:text-red-600 bg-white shadow-sm border border-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === "saidas" && (
        <div className="bg-white p-8 rounded-[32px] shadow-sm border space-y-8">
           <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div className="flex-1 w-full space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase">Buscar Insumo</label>
              <select className="w-full p-3.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm" value={novoLancamento.produto} onChange={e => setNovoLancamento({...novoLancamento, produto: e.target.value})}>
                <option value="">Produto da Saída...</option>
                {produtos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
              </select>
            </div>
            <div className="w-full md:w-32 space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase">Qtd</label>
              <input type="text" placeholder="0" className="w-full p-3.5 rounded-xl border border-slate-200 font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm" value={novoLancamento.quantidade} onChange={e => setNovoLancamento({...novoLancamento, quantidade: e.target.value})} />
            </div>
            <div className="w-full md:w-56 space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase">Motivo</label>
              <select className="w-full p-3.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm" value={novoLancamento.motivo} onChange={e => setNovoLancamento({...novoLancamento, motivo: e.target.value})}>
                <option value="Quebra/Desperdício">Quebra/Desperdício</option>
                <option value="Refeição Funcionários">Refeição Funcionários</option>
                <option value="Vencido">Vencido</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <button onClick={handleSalvarSaida} className="w-full md:w-auto bg-amber-500 text-white px-6 py-3.5 rounded-xl font-black hover:bg-amber-600 hover:scale-[1.02] transition-all flex justify-center items-center gap-2 shadow-md">
              <Package className="w-5 h-5"/> Registrar
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase font-black text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="pb-3 px-4">Produto</th>
                  <th className="pb-3 px-4">Motivo</th>
                  <th className="pb-3 px-4 text-center">Qtd Perdida</th>
                  <th className="pb-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.saidas.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4 px-4 font-bold text-slate-700">{s.produto}</td>
                    <td className="py-4 px-4 font-bold text-slate-500">{s.motivo}</td>
                    <td className="py-4 px-4 font-black text-amber-600 text-center">{s.quantidade}</td>
                    <td className="py-4 px-4 flex justify-end">
                      <button onClick={() => handleExcluir(s.id, 'saidas_avulsas')} className="p-2 text-slate-300 hover:text-red-600 bg-white shadow-sm border border-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(aba === "inicial" || aba === "final") && (
        <div className="bg-white p-8 rounded-[32px] shadow-sm border space-y-6">
          <div className="flex flex-col md:flex-row justify-between md:items-center bg-slate-50 p-6 rounded-2xl border border-slate-200 gap-4">
             <div>
                <h3 className="font-black text-xl text-slate-800">Contagem {aba === "inicial" ? "Inicial" : "Final"}</h3>
             </div>
             <div className="flex gap-3">
               {aba === "inicial" && (
                 <button onClick={handlePuxarAnterior} className="bg-white border border-slate-300 text-slate-700 px-4 py-3 rounded-xl font-bold hover:bg-slate-200 flex items-center gap-2 shadow-sm transition-colors">
                   <ArrowDownToLine className="w-5 h-5"/> Puxar Fechamento Anterior
                 </button>
               )}
               <button onClick={handleSalvarContagem} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm"><Save className="w-5 h-5"/> Salvar Manual</button>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {produtos.map(p => (
              <div key={p.id} className="p-4 border border-slate-200 bg-white rounded-2xl flex flex-col gap-3 shadow-sm hover:border-blue-300 transition-colors">
                <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">{p.nome}</span>
                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{p.unidade}</span>
                </div>
                <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Qtd Real</label>
                      <input type="text" className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white" value={contagem[p.id]?.qtd || ""} onChange={e => setContagem({...contagem, [p.id]: { ...contagem[p.id], qtd: e.target.value }})} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Custo Unitário</label>
                      <input type="text" className="w-full p-2.5 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-blue-500 bg-slate-50 focus:bg-white" value={contagem[p.id]?.valor || ""} onChange={e => setContagem({...contagem, [p.id]: { ...contagem[p.id], valor: e.target.value }})} />
                    </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {aba === "faturamento" && (
        <div className="bg-white p-12 rounded-[40px] shadow-sm border flex flex-col items-center justify-center space-y-8 max-w-2xl mx-auto mt-4 relative">
           <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-600 mb-2">
             <DollarSign className="w-10 h-10" />
           </div>
           <div className="text-center">
             <h3 className="text-3xl font-black text-slate-800">Faturamento da Semana</h3>
           </div>
           
           <div className="w-full max-w-sm relative">
             <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">R$</span>
             <input type="text" value={faturamento} onChange={e => setFaturamento(e.target.value)} className="w-full pl-16 pr-6 py-5 text-4xl font-black text-slate-800 bg-slate-50 border-2 border-slate-200 rounded-3xl outline-none focus:border-emerald-500 text-center" placeholder="0.00" />
           </div>

           <button onClick={handleSalvarFaturamento} className="w-full max-w-sm bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-700 hover:scale-105 transition-all shadow-lg shadow-emerald-600/30">
             Salvar Faturamento
           </button>
           
           {dataFim === new Date().toISOString().split('T')[0] && (
             <div className="mt-12 pt-8 border-t border-slate-100 w-full">
               <button onClick={onSemanaFechada} className="w-full max-w-sm mx-auto bg-slate-900 text-white py-4 rounded-2xl font-black text-lg hover:bg-slate-800 transition-all flex justify-center items-center gap-2">
                 <CheckCircle2 className="w-6 h-6"/> Fechar Ciclo Oficial
               </button>
             </div>
           )}
        </div>
      )}
    </div>
  )
}