"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Calculator, Pizza, PackageOpen, List, X, CalendarDays, Search, ReceiptText, Filter, Flame } from "lucide-react"
import { supabase } from "@/lib/supabase"

const formatBRL = (v: number) => {
  if (isNaN(v) || v === null) return "R$ 0,00"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
const formatPerc = (v: number) => {
  if (isNaN(v) || v === null || !isFinite(v)) return "0.00%"
  return `${v.toFixed(2)}%`
}

export function Relatorios({ produtos }: { produtos: any[] }) {
  const [filtroCategoria, setFiltroCategoria] = useState<"Geral" | "Cozinha" | "Bebidas">("Geral")
  const [semanasData, setSemanasData] = useState<any[]>([])
  const [semanaSelecionadaModal, setSemanaSelecionadaModal] = useState<string>("")
  const [loading, setLoading] = useState(true)
  
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    const carregarDados = async () => {
      setLoading(true)

      const { data: todasFinancas } = await supabase.from('financas_semanais').select('*').order('data_inicio', { ascending: true })

      if (!todasFinancas || todasFinancas.length === 0) {
        setSemanasData([])
        setLoading(false)
        return
      }

      const financasNumeradas = todasFinancas.map((f, i) => ({ ...f, numeroAbsoluto: i + 1 }))
      const financasDoMes = financasNumeradas.filter(f => f.data_inicio.startsWith(mesSelecionado))

      if (financasDoMes.length === 0) {
        setSemanasData([])
        setLoading(false)
        return
      }

      const oldestDate = financasDoMes[0].data_inicio
      const newestDate = financasDoMes[financasDoMes.length - 1].data_fim || financasDoMes[financasDoMes.length - 1].data_inicio

      const { data: dbCompras } = await supabase.from('compras').select('*').gte('data_compra', oldestDate).lte('data_compra', newestDate)
      const { data: dbEstoques } = await supabase.from('estoques').select('*').gte('data_contagem', oldestDate).lte('data_contagem', newestDate)
      const { data: dbSaidas } = await supabase.from('saidas_avulsas').select('*').gte('data_saida', oldestDate).lte('data_saida', newestDate)

      const semanasProcessadas = financasDoMes.map(f => {
        let comp = dbCompras?.filter(c => c.data_compra >= f.data_inicio && c.data_compra <= f.data_fim) || []
        let est = dbEstoques?.filter(e => e.data_contagem >= f.data_inicio && e.data_contagem <= f.data_fim) || []
        let saidas = dbSaidas?.filter(s => s.data_saida >= f.data_inicio && s.data_saida <= f.data_fim) || []

        let prodsFiltrados = produtos || []
        if (filtroCategoria === "Cozinha") {
          prodsFiltrados = produtos.filter(p => p.grupo !== "Bebidas" && p.grupo !== "Embalagens" && p.grupo !== "Limpeza" && p.grupo !== "Outros")
        } else if (filtroCategoria === "Bebidas") {
          prodsFiltrados = produtos.filter(p => p.grupo === "Bebidas")
        }

        const consumoDetalhado = prodsFiltrados.map(p => {
          const eI = est.find(e => e.produto_id === p.id && e.tipo_contagem === 'Inicial')
          const eF = est.find(e => e.produto_id === p.id && e.tipo_contagem === 'Final')
          const cP = comp.filter(c => c.produto_id === p.id)
          
          const qtdIni = eI ? parseFloat(eI.quantidade) : 0
          const valIni = eI ? parseFloat(eI.valor_unitario) : 0
          
          let qtdComp = 0, custoComp = 0
          cP.forEach(c => {
            qtdComp += parseFloat(c.quantidade)
            custoComp += parseFloat(c.quantidade) * parseFloat(c.valor_unitario)
          })

          const qtdFin = eF ? parseFloat(eF.quantidade) : 0
          const valFin = eF ? parseFloat(eF.valor_unitario) : valIni
          
          let custoConsumido = (qtdIni * valIni) + custoComp - (qtdFin * valFin)
          const qtdConsumida = qtdIni + qtdComp - qtdFin

          if (p.producao_interna) {
             custoConsumido = 0;
          }

          return { 
            item: p.nome, 
            unidade: p.unidade, 
            grupo: p.grupo,
            producao_interna: p.producao_interna,
            qtdIni, qtdComp, qtdFin, qtdConsumida,
            valorConsumido: custoConsumido > 0 ? custoConsumido : 0 
          }
        }).filter(i => i.valorConsumido > 0 || i.qtdConsumida > 0).sort((a, b) => b.valorConsumido - a.valorConsumido)

        const totalDed = saidas.reduce((a, s) => a + parseFloat(s.valor_total || 0), 0)
        let cmvValorReal = consumoDetalhado.reduce((acc, curr) => acc + curr.valorConsumido, 0)
        
        // Se for o painel Geral, abater as deduções
        if (filtroCategoria === "Geral") {
          cmvValorReal -= totalDed;
        }

        const inicialVisual = est.filter(e => e.tipo_contagem === 'Inicial' && prodsFiltrados.find(p => p.id === e.produto_id)).reduce((acc, e) => acc + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)
        const comprasVisuais = comp.filter(c => prodsFiltrados.find(p => p.id === c.produto_id)).reduce((acc, c) => acc + (parseFloat(c.quantidade) * parseFloat(c.valor_unitario)), 0)
        const deducoesVisuais = filtroCategoria === "Geral" ? totalDed : 0

        const dFinal = new Date(f.data_inicio + "T12:00:00")
        dFinal.setDate(dFinal.getDate() + 6)
        const strFim = dFinal.toISOString().split('T')[0]
        const dataVisual = `${f.data_inicio.split('-')[2]}/${f.data_inicio.split('-')[1]} a ${strFim.split('-')[2]}/${strFim.split('-')[1]}`

        return { 
          id: f.data_inicio, 
          nome: `Semana ${f.numeroAbsoluto}`,
          periodo: dataVisual, 
          faturamento: f.faturamento, 
          inicial: inicialVisual, 
          compras: comprasVisuais, 
          deducoes: deducoesVisuais,
          cmvValor: cmvValorReal,
          consumoDetalhado 
        }
      })

      setSemanasData(semanasProcessadas)
      
      if (!semanaSelecionadaModal || !semanasProcessadas.find(s => s.id === semanaSelecionadaModal)) {
        if (semanasProcessadas.length > 0) {
          setSemanaSelecionadaModal(semanasProcessadas[semanasProcessadas.length - 1].id)
        }
      }
      setLoading(false)
    }

    if (produtos.length > 0) {
      carregarDados()
    }
  }, [filtroCategoria, produtos, mesSelecionado])

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div></div>
  }

  const anosMeses = []
  const dataLoop = new Date()
  for (let i = 0; i < 12; i++) {
    anosMeses.push({
      value: `${dataLoop.getFullYear()}-${String(dataLoop.getMonth() + 1).padStart(2, '0')}`,
      label: dataLoop.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
    })
    dataLoop.setMonth(dataLoop.getMonth() - 1)
  }

  const semanaSel = semanasData.find(s => s.id === semanaSelecionadaModal) || { consumoDetalhado: [] }

  return (
    <div className="space-y-8 pb-10 animate-in fade-in">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><PackageOpen className="text-blue-600"/> Relatórios Financeiros</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Análise de fechamentos e ranqueamento de consumo.</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4">
           <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl shadow-sm">
             <CalendarDays className="w-5 h-5 text-slate-400 ml-2" />
             <select 
               value={mesSelecionado} 
               onChange={(e) => setMesSelecionado(e.target.value)}
               className="bg-transparent font-bold text-slate-700 outline-none text-sm cursor-pointer pr-2 capitalize"
             >
               {anosMeses.map(am => <option key={am.value} value={am.value}>{am.label}</option>)}
             </select>
           </div>

           <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
             {["Geral", "Cozinha", "Bebidas"].map(cat => (
               <button 
                 key={cat} 
                 onClick={() => setFiltroCategoria(cat as any)} 
                 className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filtroCategoria === cat ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
               >
                 {cat}
               </button>
             ))}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        {semanasData.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold flex flex-col items-center">
            <Search className="w-12 h-12 text-slate-200 mb-4" />
            Nenhum fechamento encontrado neste mês.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b">
                <tr>
                  <th className="p-5 text-left bg-slate-100">Métricas do Mês</th>
                  {semanasData.map(s => (
                    <th key={s.id} className="p-5 min-w-[120px]">
                      <span className="block text-[13px] text-slate-800">{s.nome}</span>
                      <span className="block text-[10px] text-slate-400 mt-1">{s.periodo}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="p-4 text-left font-bold text-slate-500 bg-slate-50/50">Faturamento Global</td>
                  {semanasData.map(s => <td key={s.id} className="p-4 font-black text-emerald-600">{formatBRL(s.faturamento)}</td>)}
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-4 text-left font-bold text-slate-500 bg-slate-50/50">Deduções / Saídas (-)</td>
                  {semanasData.map(s => <td key={s.id} className="p-4 text-rose-500 font-bold">{formatBRL(s.deducoes)}</td>)}
                </tr>
                <tr className="bg-blue-50/20 hover:bg-blue-50/40">
                  <td className="p-4 text-left font-bold text-slate-700 bg-blue-50/30 flex flex-col">
                     CMV Líquido (R$)
                     <span className="text-[9px] font-black text-blue-500">*Ignora Subprodutos e Abate Saídas</span>
                  </td>
                  {semanasData.map(s => <td key={s.id} className="p-4 font-black text-slate-800">{formatBRL(s.cmvValor)}</td>)}
                </tr>
                <tr>
                  <td className="p-5 text-left font-bold text-slate-700 bg-slate-50/50">Margem (%) do Faturamento</td>
                  {semanasData.map(s => {
                    const cmvP = s.faturamento > 0 ? (s.cmvValor / s.faturamento) * 100 : 0;
                    return (
                      <td key={s.id} className="p-5">
                        <span className={`px-3 py-1.5 rounded-lg font-black text-sm shadow-sm ${cmvP > 35 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          {formatPerc(cmvP)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
          <div>
            <h4 className="font-black text-slate-800 text-lg flex items-center gap-2"><Flame className="text-red-500 w-5 h-5"/> Ranking de Consumo ({filtroCategoria})</h4>
            <p className="text-xs font-medium text-slate-500 mt-1">Veja o que entrou, saiu e o custo exato (Fabricados não geram custo duplo).</p>
          </div>
          <select className="p-3 rounded-xl border border-slate-200 text-sm font-bold bg-white shadow-sm outline-none focus:border-red-500 cursor-pointer" value={semanaSelecionadaModal} onChange={e => setSemanaSelecionadaModal(e.target.value)}>
            {semanasData.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.periodo})</option>)}
          </select>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {semanaSel.consumoDetalhado.length === 0 && <p className="text-center text-slate-400 font-bold mt-10">Nenhum consumo para a categoria {filtroCategoria} nessa semana.</p>}
          
          {semanaSel.consumoDetalhado.map((item: any, i: number) => (
            <div key={i} className={`flex flex-col p-5 bg-white hover:bg-slate-50 transition-colors rounded-2xl border shadow-sm ${item.producao_interna ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200'}`}>
              
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full font-black flex items-center justify-center text-xs ${item.producao_interna ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{i + 1}º</div>
                  <div>
                    <p className="font-black text-slate-800 text-lg">{item.item}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.grupo}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo Total Usado</p>
                  {item.producao_interna ? (
                     <p className="font-black text-blue-500 text-sm bg-blue-50 px-2 py-1 rounded-md border border-blue-100">R$ 0,00 (Subproduto)</p>
                  ) : (
                     <p className="font-black text-red-600 text-xl">{formatBRL(item.valorConsumido)}</p>
                  )}
                </div>
              </div>

              {/* A ORDEM DO TIO TIAGO COM FONTES GIGANTES */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-4 rounded-xl text-center border border-slate-200 shadow-inner">
                
                <div className="flex flex-col border-r border-slate-200/60">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Tinha (Inicial)</span>
                  <span className="text-slate-700 font-black text-xl md:text-2xl mt-1">{item.qtdIni} <span className="text-[10px] font-bold uppercase">{item.unidade}</span></span>
                </div>
                
                <div className="flex flex-col border-r border-slate-200/60">
                  <span className="text-amber-500/80 text-[10px] uppercase font-bold tracking-wider">+ Comprou</span>
                  <span className="text-amber-600 font-black text-xl md:text-2xl mt-1">{item.qtdComp} <span className="text-[10px] font-bold uppercase">{item.unidade}</span></span>
                </div>
                
                <div className="flex flex-col border-r border-slate-200/60">
                  <span className="text-purple-500/80 text-[10px] uppercase font-bold tracking-wider">= Consumiu</span>
                  <span className="text-purple-600 font-black text-xl md:text-2xl mt-1">{item.qtdConsumida} <span className="text-[10px] font-bold uppercase">{item.unidade}</span></span>
                </div>
                
                <div className="flex flex-col justify-center">
                  <span className="text-blue-400/80 text-[10px] uppercase font-bold tracking-wider">Sobrou (Final)</span>
                  <span className="text-blue-600 font-black text-xl md:text-2xl mt-1">{item.qtdFin} <span className="text-[10px] font-bold uppercase">{item.unidade}</span></span>
                </div>
                
              </div>

            </div>
          ))}
        </div>
      </div>

    </div>
  )
} 