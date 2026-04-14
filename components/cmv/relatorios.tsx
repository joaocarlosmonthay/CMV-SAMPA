"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, DollarSign, Calculator, Pizza, PackageOpen, List, X, CalendarDays, Search, ReceiptText } from "lucide-react"
import { supabase } from "@/lib/supabase"

const formatBRL = (v: number) => {
  if (isNaN(v) || v === null) return "R$ 0,00"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
const formatPerc = (v: number) => {
  if (isNaN(v) || v === null || !isFinite(v)) return "0.0%"
  return `${v.toFixed(1)}%`
}

export function Relatorios({ produtos }: { produtos: any[] }) {
  const [filtroCategoria, setFiltroCategoria] = useState<"Geral" | "Cozinha" | "Bebidas">("Geral")
  const [modalAberto, setModalAberto] = useState<"compras" | "consumo" | null>(null)
  
  const [semanasData, setSemanasData] = useState<any[]>([])
  const [semanaSelecionadaModal, setSemanaSelecionadaModal] = useState<string>("")

  const carregarDados = async () => {
    const { data: financas } = await supabase.from('financas_semanais').select('*').order('data_inicio', { ascending: false }).limit(5)
    if (!financas || financas.length === 0) return

    const oldestDate = financas[financas.length - 1].data_inicio
    const newestDate = financas[0].data_fim

    const { data: compras } = await supabase.from('compras').select('*').gte('data_compra', oldestDate).lte('data_compra', newestDate)
    const { data: estoques } = await supabase.from('estoques').select('*').gte('data_contagem', oldestDate).lte('data_contagem', newestDate)

    const semanasProcessadas = financas.reverse().map((f, index) => {
        let comp = compras?.filter(c => c.data_compra >= f.data_inicio && c.data_compra <= f.data_fim) || []
        let est = estoques?.filter(e => e.data_contagem >= f.data_inicio && e.data_contagem <= f.data_fim) || []

        let prodsFiltrados = produtos || []

        if (filtroCategoria === "Cozinha") {
            prodsFiltrados = produtos.filter(p => p.grupo !== "Bebidas" && p.grupo !== "Embalagens" && p.grupo !== "Limpeza")
            comp = comp.filter(c => prodsFiltrados.find(p => p.id === c.produto_id))
            est = est.filter(e => prodsFiltrados.find(p => p.id === e.produto_id))
        } else if (filtroCategoria === "Bebidas") {
            prodsFiltrados = produtos.filter(p => p.grupo === "Bebidas")
            comp = comp.filter(c => prodsFiltrados.find(p => p.id === c.produto_id))
            est = est.filter(e => prodsFiltrados.find(p => p.id === e.produto_id))
        }

        // CÁLCULO DE COMPRAS E CMV
        const totalCompras = comp.reduce((acc, c) => acc + parseFloat(c.valor_unitario), 0)
        const inicial = est.filter(e => e.tipo_contagem === 'Inicial').reduce((acc, e) => acc + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)
        const final = est.filter(e => e.tipo_contagem === 'Final').reduce((acc, e) => acc + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)

        // CÁLCULO DO TOP CONSUMO DA SEMANA
        const consumoDetalhado = prodsFiltrados.map(p => {
          const eI = est.find(e => e.produto_id === p.id && e.tipo_contagem === 'Inicial')
          const eF = est.find(e => e.produto_id === p.id && e.tipo_contagem === 'Final')
          const cP = comp.filter(c => c.produto_id === p.id)

          const qtdIni = eI ? parseFloat(eI.quantidade) : 0
          const valIni = eI ? parseFloat(eI.valor_unitario) : 0
          const qtdFin = eF ? parseFloat(eF.quantidade) : 0

          const compQtd = cP.reduce((a, c) => a + parseFloat(c.quantidade), 0)
          const compTotalRS = cP.reduce((a, c) => a + parseFloat(c.valor_unitario), 0)

          const qtdConsumida = (qtdIni + compQtd) - qtdFin
          const precoMedio = compQtd > 0 ? (compTotalRS / compQtd) : valIni
          const valorConsumido = qtdConsumida * precoMedio

          return { item: p.nome, unidade: p.unidade, qtdConsumida, valorConsumido }
        }).filter(i => i.valorConsumido > 0).sort((a, b) => b.valorConsumido - a.valorConsumido)

        const dFinal = new Date(f.data_inicio + "T12:00:00")
        dFinal.setDate(dFinal.getDate() + 6)
        const strFim = dFinal.toISOString().split('T')[0]
        const dataVisual = `${f.data_inicio.split('-')[2]}/${f.data_inicio.split('-')[1]} a ${strFim.split('-')[2]}/${strFim.split('-')[1]}`

        return {
            id: f.data_inicio,
            nome: `Semana ${index + 1}`,
            periodo: dataVisual,
            faturamento: f.faturamento,
            inicial,
            compras: totalCompras,
            final,
            comprasDetalhadas: comp,
            consumoDetalhado: consumoDetalhado
        }
    })

    setSemanasData(semanasProcessadas)
    
    if (!semanaSelecionadaModal && semanasProcessadas.length > 0) {
        setSemanaSelecionadaModal(semanasProcessadas[semanasProcessadas.length - 1].id)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [filtroCategoria, produtos])

  // DADOS DA SEMANA MAIS RECENTE PARA OS CARDS
  const ultimaSemana = semanasData.length > 0 ? semanasData[semanasData.length - 1] : { comprasDetalhadas: [], consumoDetalhado: [] }
  
  const top3ComprasPreview = [...(ultimaSemana.comprasDetalhadas || [])]
    .sort((a, b) => b.valor_unitario - a.valor_unitario)
    .slice(0, 3)
    .map(c => {
       const prod = produtos.find(p => p.id === c.produto_id)
       return { item: prod?.nome || "Insumo", qtd: c.quantidade, unidade: prod?.unidade || "UN", valor: c.valor_unitario }
    })

  const top3ConsumoPreview = [...(ultimaSemana.consumoDetalhado || [])].slice(0, 3)

  // DADOS PARA O MODAL (BASEADO NA SEMANA SELECIONADA NO DROPDOWN)
  const semanaSelecionada = semanasData.find(s => s.id === semanaSelecionadaModal) || { comprasDetalhadas: [], consumoDetalhado: [] }
  
  const listaModalCompras = [...(semanaSelecionada.comprasDetalhadas || [])]
    .sort((a, b) => b.valor_unitario - a.valor_unitario)
    .map(c => {
       const prod = produtos.find(p => p.id === c.produto_id)
       return { item: prod?.nome || "Insumo", qtd: c.quantidade, unidade: prod?.unidade || "UN", valor: c.valor_unitario }
    })

  const listaModalConsumo = [...(semanaSelecionada.consumoDetalhado || [])]

  return (
    <div className="space-y-8 font-sans">
      {/* CABEÇALHO E FILTROS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Análise de DRE e CMV</h2>
          <p className="text-slate-500 font-medium text-sm">Acompanhamento lado a lado da evolução semanal.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button onClick={() => setFiltroCategoria("Geral")} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${filtroCategoria === "Geral" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}><Calculator className="w-4 h-4"/> Geral</button>
          <button onClick={() => setFiltroCategoria("Cozinha")} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${filtroCategoria === "Cozinha" ? "bg-white text-orange-500 shadow-sm" : "text-slate-500"}`}><Pizza className="w-4 h-4"/> Cozinha</button>
          <button onClick={() => setFiltroCategoria("Bebidas")} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${filtroCategoria === "Bebidas" ? "bg-white text-purple-600 shadow-sm" : "text-slate-500"}`}><PackageOpen className="w-4 h-4"/> Bebidas</button>
        </div>
      </div>

      {/* TABELA DE VISÃO GERAL LADO A LADO */}
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          <h3 className="font-black text-lg text-slate-800">Evolução de Custos - {filtroCategoria}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-black tracking-wider uppercase border-b border-slate-100">
                <th className="py-4 px-6 text-left text-[10px]">Métricas</th>
                {semanasData.map(s => (
                  <th key={s.id} className="py-3 px-6 text-right whitespace-nowrap">
                    <span className="block text-[11px] text-slate-700">{s.nome}</span>
                    <span className="block text-[9px] text-slate-400 mt-0.5">{s.periodo}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50"><td className="py-4 px-6 font-bold text-slate-700">Faturamento Bruto</td>{semanasData.map(s => <td key={s.id} className="py-4 px-6 text-right font-black text-emerald-600">{formatBRL(s.faturamento)}</td>)}</tr>
              <tr className="hover:bg-slate-50"><td className="py-4 px-6 font-bold text-slate-600">Estoque Inicial</td>{semanasData.map(s => <td key={s.id} className="py-4 px-6 text-right font-medium text-slate-500">{formatBRL(s.inicial)}</td>)}</tr>
              <tr className="hover:bg-slate-50"><td className="py-4 px-6 font-bold text-slate-600">Compras do Período</td>{semanasData.map(s => <td key={s.id} className="py-4 px-6 text-right font-medium text-amber-600">{formatBRL(s.compras)}</td>)}</tr>
              <tr className="hover:bg-slate-50"><td className="py-4 px-6 font-bold text-slate-600">Estoque Final</td>{semanasData.map(s => <td key={s.id} className="py-4 px-6 text-right font-medium text-slate-500">{formatBRL(s.final)}</td>)}</tr>
              <tr className="bg-blue-50/30"><td className="py-4 px-6 font-black text-slate-800">CMV Real (R$)</td>{semanasData.map(s => <td key={s.id} className="py-4 px-6 text-right font-black text-slate-800">{formatBRL(s.inicial + s.compras - s.final)}</td>)}</tr>
              <tr className="bg-blue-50/50"><td className="py-5 px-6 font-black text-slate-800 text-base">CMV Real (%)</td>{semanasData.map(s => {
                  const cmvPerc = s.faturamento > 0 ? ((s.inicial + s.compras - s.final) / s.faturamento) * 100 : 0
                  const colorClass = cmvPerc > 35 ? "text-red-600 bg-red-100" : "text-blue-700 bg-blue-100"
                  return (
                    <td key={s.id} className="py-5 px-6 text-right">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-black text-sm ${colorClass}`}>
                        {cmvPerc > 35 ? <TrendingUp className="w-4 h-4"/> : <TrendingDown className="w-4 h-4"/>}{formatPerc(cmvPerc)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CARDS INFERIORES: COMPRAS E CONSUMO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARD: TOP COMPRAS */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[320px]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h4 className="font-black text-slate-800 flex items-center gap-2"><ReceiptText className="text-amber-500 w-5 h-5"/> Entradas / Compras</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Maiores Gastos ({ultimaSemana.nome || "Semana"})</p>
            </div>
            <button onClick={() => setModalAberto("compras")} className="text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl flex items-center gap-1 transition-colors uppercase tracking-wider">
              <Search className="w-3 h-3"/> Ver Todas
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {top3ComprasPreview.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">Nenhuma compra registrada.</p> : null}
            {top3ComprasPreview.map((item, i) => (
              <div key={i} className="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="truncate pr-2">
                  <p className="font-bold text-sm text-slate-700 truncate">{item.item}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{item.qtd} {item.unidade} Comprados</p>
                </div>
                <p className="font-black text-slate-800 text-sm">{formatBRL(item.valor)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CARD NOVO: TOP CONSUMO */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[320px]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h4 className="font-black text-slate-800 flex items-center gap-2"><TrendingDown className="text-red-500 w-5 h-5"/> Top Consumo</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Baixas de Estoque ({ultimaSemana.nome || "Semana"})</p>
            </div>
            <button onClick={() => setModalAberto("consumo")} className="text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl flex items-center gap-1 transition-colors uppercase tracking-wider">
              <Search className="w-3 h-3"/> Ver Tudo
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {top3ConsumoPreview.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">Feche o estoque para ver o consumo.</p> : null}
            {top3ConsumoPreview.map((item, i) => (
              <div key={i} className="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="truncate pr-2">
                  <p className="font-bold text-sm text-slate-700 truncate">{item.item}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{item.qtdConsumida.toFixed(2)} {item.unidade} Consumidos</p>
                </div>
                <p className="font-black text-red-600 text-sm">{formatBRL(item.valorConsumido)}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* MODAL DE DRILL-DOWN */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            
            <div className="p-6 border-b border-slate-100 flex flex-col gap-4 bg-slate-50 rounded-t-[32px]">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <List className="text-blue-600"/> 
                    {modalAberto === "compras" ? "Auditoria: Todas as Compras" : "Auditoria: Consumo Total"}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Selecione a semana para ver o detalhamento.</p>
                </div>
                <button onClick={() => setModalAberto(null)} className="p-2 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full shadow-sm transition-colors border"><X className="w-5 h-5"/></button>
              </div>
              
              <select 
                className="w-full md:w-80 p-3 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm"
                value={semanaSelecionadaModal}
                onChange={e => setSemanaSelecionadaModal(e.target.value)}
              >
                {semanasData.map(s => (
                  <option key={s.id} value={s.id}>{s.nome} ({s.periodo})</option>
                ))}
              </select>
            </div>

            <div className="p-0 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase font-black text-slate-400 bg-white sticky top-0 border-b border-slate-100 shadow-sm">
                  <tr>
                    <th className="py-4 px-6">Insumo</th>
                    <th className="py-4 px-6 text-center">Quantidade</th>
                    <th className="py-4 px-6 text-right">Valor Total (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {modalAberto === "compras" && (
                    listaModalCompras.length === 0 ? (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-400 font-bold">Nenhuma compra registrada nesse período.</td></tr>
                    ) : (
                      listaModalCompras.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-700">{item.item}</td>
                          <td className="py-4 px-6 font-bold text-slate-500 text-center">{item.qtd} {item.unidade}</td>
                          <td className="py-4 px-6 font-black text-slate-800 text-right">{formatBRL(item.valor)}</td>
                        </tr>
                      ))
                    )
                  )}

                  {modalAberto === "consumo" && (
                    listaModalConsumo.length === 0 ? (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-400 font-bold">Feche o estoque para ver o consumo desse período.</td></tr>
                    ) : (
                      listaModalConsumo.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-700">{item.item}</td>
                          <td className="py-4 px-6 font-bold text-slate-500 text-center">{item.qtdConsumida.toFixed(2)} {item.unidade}</td>
                          <td className="py-4 px-6 font-black text-red-600 text-right">{formatBRL(item.valorConsumido)}</td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}