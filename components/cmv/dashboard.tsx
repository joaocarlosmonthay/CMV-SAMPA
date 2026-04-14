"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, DollarSign, Calculator, Pizza, Coffee, List, X, BarChart3, Search, CalendarDays, ReceiptText, PieChart, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const formatBRL = (v: number) => {
  if (isNaN(v) || v === null) return "R$ 0,00"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
const formatPerc = (v: number) => {
  if (isNaN(v) || v === null || !isFinite(v)) return "0.0%"
  return `${v.toFixed(1)}%`
}

export function Dashboard({ dataInicio, dataFim, lancamentos, contagemInicial, contagemFinal, produtos }: any) {
  const [loadingHistorico, setLoadingHistorico] = useState(true)
  const [historicoSemanas, setHistoricoSemanas] = useState<any[]>([])
  const [modalAberto, setModalAberto] = useState<"compras" | "consumo" | null>(null)

  const faturamentoAtual = lancamentos?.faturamento || 0
  
  // SOMA BLINDADA: Qtd * Valor Unitário
  const comprasAtual = (lancamentos?.compras || []).reduce((acc: number, c: any) => {
    return acc + (parseFloat(c.quantidade) * parseFloat(c.valorUnitario))
  }, 0)

  const getValorEstoque = (contagem: any) => {
    if (!contagem) return 0
    return Object.values(contagem).reduce((acc: number, item: any) => {
      return acc + (parseFloat(item.qtd || 0) * parseFloat(item.valor || 0))
    }, 0)
  }
  const estInicialAtual = getValorEstoque(contagemInicial)
  const estFinalAtual = getValorEstoque(contagemFinal)

  const cmvRealR$ = estInicialAtual + comprasAtual - estFinalAtual
  const cmvRealPerc = faturamentoAtual > 0 ? (cmvRealR$ / faturamentoAtual) * 100 : 0

  let cmvCozinhaRS = 0
  let cmvBebidasRS = 0

  if (produtos && produtos.length > 0) {
    const idsBebidas = produtos.filter((p: any) => p.grupo === "Bebidas").map((p: any) => p.id)
    const idsCozinha = produtos.filter((p: any) => p.grupo !== "Bebidas" && p.grupo !== "Embalagens" && p.grupo !== "Limpeza").map((p: any) => p.id)

    const calcCmvPorGrupo = (idsPermitidos: number[]) => {
      const init = Object.entries(contagemInicial || {}).reduce((acc, [id, item]: any) => idsPermitidos.includes(Number(id)) ? acc + (parseFloat(item.qtd||0) * parseFloat(item.valor||0)) : acc, 0)
      const fin = Object.entries(contagemFinal || {}).reduce((acc, [id, item]: any) => idsPermitidos.includes(Number(id)) ? acc + (parseFloat(item.qtd||0) * parseFloat(item.valor||0)) : acc, 0)
      const comp = (lancamentos?.compras || []).reduce((acc: number, c: any) => {
        const prod = produtos.find((p:any) => p.nome === c.produto)
        return prod && idsPermitidos.includes(prod.id) ? acc + (parseFloat(c.quantidade) * parseFloat(c.valorUnitario)) : acc
      }, 0)
      return init + comp - fin
    }

    cmvCozinhaRS = calcCmvPorGrupo(idsCozinha)
    cmvBebidasRS = calcCmvPorGrupo(idsBebidas)
  }
  
  const percCozinha = faturamentoAtual > 0 ? (cmvCozinhaRS / faturamentoAtual) * 100 : 0
  const percBebidas = faturamentoAtual > 0 ? (cmvBebidasRS / faturamentoAtual) * 100 : 0

  const listaConsumo = produtos?.map((p: any) => {
    const qtdIni = parseFloat(contagemInicial?.[p.id]?.qtd || 0)
    const valIni = parseFloat(contagemInicial?.[p.id]?.valor || 0)
    const qtdFin = parseFloat(contagemFinal?.[p.id]?.qtd || 0)
    
    const compQtd = (lancamentos?.compras || []).filter((c:any) => c.produto === p.nome).reduce((a:number, c:any) => a + parseFloat(c.quantidade), 0)
    const compTotalRS = (lancamentos?.compras || []).filter((c:any) => c.produto === p.nome).reduce((a:number, c:any) => a + (parseFloat(c.quantidade) * parseFloat(c.valorUnitario)), 0)
    
    const qtdConsumida = (qtdIni + compQtd) - qtdFin
    const precoMedio = compQtd > 0 ? (compTotalRS / compQtd) : valIni
    const valorConsumido = qtdConsumida * precoMedio

    return { item: p.nome, unidade: p.unidade, qtdConsumida, valorConsumido }
  }).filter((i: any) => i.valorConsumido > 0).sort((a: any, b: any) => b.valorConsumido - a.valorConsumido) || []


  useEffect(() => {
    const buscarHistorico = async () => {
      setLoadingHistorico(true)
      const { data: financas } = await supabase.from('financas_semanais').select('*').order('data_inicio', { ascending: false }).limit(5)
      
      if (!financas || financas.length === 0) {
        setLoadingHistorico(false)
        return
      }

      const datas = financas.map(f => f.data_inicio)
      // Buscamos estritamente as compras e estoques das datas de início para não haver escape
      const { data: dbCompras } = await supabase.from('compras').select('*').in('data_compra', datas)
      const { data: dbEstoques } = await supabase.from('estoques').select('*').in('data_contagem', datas)

      const historyData = financas.reverse().map((f, index) => {
        const dFinal = new Date(f.data_inicio + "T12:00:00")
        dFinal.setDate(dFinal.getDate() + 6)
        const rotuloData = `${f.data_inicio.split('-')[2]}/${f.data_inicio.split('-')[1]} a ${dFinal.toISOString().split('T')[0].split('-')[2]}/${dFinal.toISOString().split('T')[0].split('-')[1]}`

        const myCompras = dbCompras?.filter(c => c.data_compra === f.data_inicio) || []
        const myEst = dbEstoques?.filter(e => e.data_contagem === f.data_inicio) || []

        // MATEMÁTICA REAL HISTÓRICA: Qtd * Valor
        const totComp = myCompras.reduce((a, c) => a + (parseFloat(c.quantidade) * parseFloat(c.valor_unitario)), 0)
        const eIni = myEst.filter(e => e.tipo_contagem === 'Inicial').reduce((a, e) => a + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)
        const eFin = myEst.filter(e => e.tipo_contagem === 'Final').reduce((a, e) => a + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)

        const cmvRS = eIni + totComp - eFin
        const cmvP = f.faturamento > 0 ? (cmvRS / f.faturamento) * 100 : 0

        return {
          id: f.data_inicio,
          semana: `Semana ${index + 1}`,
          periodo: rotuloData,
          faturamento: parseFloat(f.faturamento || 0),
          compras: totComp,
          cmvValor: cmvRS,
          cmvPerc: cmvP,
          faltaEstoqueFinal: eFin === 0 // VERIFICADOR
        }
      })

      setHistoricoSemanas(historyData)
      setLoadingHistorico(false)
    }

    if (dataInicio) buscarHistorico()
  }, [dataInicio])

  const chartData = historicoSemanas.map(s => ({
    name: s.semana,
    Vendas: s.faturamento,
    Compras: s.compras
  }))

  return (
    <div className="space-y-8 font-sans">
      
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel Executivo</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Análise de performance e custos em tempo real.</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2.5 rounded-xl border border-blue-100">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-blue-800 text-sm">
             Auditando: {dataInicio.split('-').reverse().join('/')} a {dataFim.split('-').reverse().join('/')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturamento Bruto</p>
              <h3 className="text-3xl font-black text-emerald-600">{formatBRL(faturamentoAtual)}</h3>
            </div>
            <div className="bg-emerald-50 p-3 rounded-2xl"><DollarSign className="w-5 h-5 text-emerald-600"/></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo Total (CMV)</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-slate-800">{formatPerc(cmvRealPerc)}</h3>
              </div>
              <p className="text-sm font-bold text-slate-500 mt-1">{formatBRL(cmvRealR$)}</p>
            </div>
            <div className={`p-3 rounded-2xl ${cmvRealPerc > 35 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
              <Calculator className="w-5 h-5"/>
            </div>
          </div>
          {/* ALERTA INTELIGENTE */}
          {estFinalAtual === 0 && comprasAtual > 0 && (
             <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100">
               <AlertTriangle className="w-3 h-3"/> Aguardando Estoque Final (CMV Inflado)
             </div>
          )}
        </div>

        <div className="bg-slate-900 lg:col-span-2 p-6 rounded-3xl shadow-lg border border-slate-800 text-white relative flex flex-col justify-center">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
             <PieChart className="w-4 h-4"/> Detalhamento do CMV (%)
          </p>
          <div className="grid grid-cols-2 gap-6">
             <div className="flex items-center gap-4">
               <div className="bg-white/10 p-3 rounded-2xl"><Pizza className="w-6 h-6 text-orange-400"/></div>
               <div>
                 <p className="text-xs text-slate-300 font-bold uppercase">Cozinha (Alimentação)</p>
                 <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-2xl font-black text-white">{formatPerc(percCozinha)}</p>
                    <p className="text-xs font-medium text-slate-400">({formatBRL(cmvCozinhaRS)})</p>
                 </div>
               </div>
             </div>
             <div className="flex items-center gap-4 border-l border-slate-700 pl-6">
               <div className="bg-white/10 p-3 rounded-2xl"><Coffee className="w-6 h-6 text-purple-400"/></div>
               <div>
                 <p className="text-xs text-slate-300 font-bold uppercase">Bebidas</p>
                 <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-2xl font-black text-white">{formatPerc(percBebidas)}</p>
                    <p className="text-xs font-medium text-slate-400">({formatBRL(cmvBebidasRS)})</p>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <h3 className="font-black text-lg text-slate-800">Evolução Semanal</h3>
          </div>
          {loadingHistorico && <span className="text-xs font-bold text-blue-600 animate-pulse">Sincronizando...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-black tracking-wider uppercase border-b border-slate-100">
                <th className="py-4 px-6 text-left text-[10px]">Métricas Financeiras</th>
                {historicoSemanas.map(s => (
                  <th key={s.id} className="py-3 px-6 text-right whitespace-nowrap min-w-[120px]">
                    <span className="block text-[12px] text-slate-800">{s.semana}</span>
                    <span className="block text-[9px] text-slate-400 mt-0.5">{s.periodo}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 font-bold text-slate-500">Faturamento Bruto</td>
                {historicoSemanas.map(s => <td key={s.id} className="py-4 px-6 text-right font-black text-emerald-600">{formatBRL(s.faturamento)}</td>)}
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 font-bold text-slate-500">Compras (Entradas)</td>
                {historicoSemanas.map(s => <td key={s.id} className="py-4 px-6 text-right font-bold text-amber-600">{formatBRL(s.compras)}</td>)}
              </tr>
              <tr className="hover:bg-slate-50 transition-colors bg-blue-50/20">
                <td className="py-4 px-6 font-bold text-slate-700">CMV Realizado (R$)</td>
                {historicoSemanas.map(s => <td key={s.id} className="py-4 px-6 text-right font-black text-slate-800">{formatBRL(s.cmvValor)}</td>)}
              </tr>
              <tr className="bg-slate-100/50">
                <td className="py-5 px-6 font-black text-slate-800">Margem CMV (%)</td>
                {historicoSemanas.map(s => {
                  const danger = s.cmvPerc > 35
                  return (
                    <td key={s.id} className="py-5 px-6 text-right">
                      {s.faltaEstoqueFinal && s.cmvPerc > 0 && (
                        <div className="text-[9px] text-amber-500 font-bold mb-1 uppercase tracking-wider flex items-center justify-end gap-1"><AlertTriangle className="w-2 h-2"/> Sem Fechamento</div>
                      )}
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-black text-sm shadow-sm ${danger ? 'bg-red-600 text-white' : 'bg-white text-slate-800 border'}`}>
                        {danger ? <TrendingUp className="w-4 h-4"/> : <TrendingDown className="w-4 h-4 text-emerald-500"/>}
                        {formatPerc(s.cmvPerc)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="mb-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><BarChart3 className="text-blue-600 w-5 h-5"/> Vendas x Compras</h3>
             <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">Tendência de Caixa</p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value: number) => formatBRL(value)} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 'bold', paddingTop: '10px'}} />
                <Bar dataKey="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Compras" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[380px]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><ReceiptText className="text-amber-500 w-5 h-5"/> Entradas / Compras</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Maiores gastos (Semana Atual)</p>
              </div>
              <button onClick={() => setModalAberto("compras")} className="text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors uppercase tracking-wider flex items-center gap-1">
                <Search className="w-3 h-3"/> Ver Tudo
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {(!lancamentos?.compras || lancamentos.compras.length === 0) && <p className="text-sm text-slate-400 font-medium text-center mt-10">Nenhuma compra registrada.</p>}
              {[...(lancamentos?.compras || [])]
                .sort((a, b) => (parseFloat(b.quantidade) * parseFloat(b.valorUnitario)) - (parseFloat(a.quantidade) * parseFloat(a.valorUnitario)))
                .slice(0, 5)
                .map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0">
                  <div className="truncate pr-2">
                    <p className="font-bold text-sm text-slate-700 truncate">{item.produto}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{item.quantidade} Comprados</p>
                  </div>
                  <p className="font-black text-slate-800 text-sm whitespace-nowrap">{formatBRL(parseFloat(item.quantidade) * parseFloat(item.valorUnitario))}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[380px]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><TrendingDown className="text-red-500 w-5 h-5"/> Top Consumo</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Baixas de Estoque (Semana Atual)</p>
              </div>
              <button onClick={() => setModalAberto("consumo")} className="text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors uppercase tracking-wider flex items-center gap-1">
                <Search className="w-3 h-3"/> Ver Tudo
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {listaConsumo.length === 0 && <p className="text-sm text-slate-400 font-medium text-center mt-10">Feche o estoque para ver o consumo.</p>}
              {listaConsumo.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0">
                  <div className="truncate pr-2">
                    <p className="font-bold text-sm text-slate-700 truncate">{item.item}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{item.qtdConsumida.toFixed(2)} {item.unidade} Consumidos</p>
                  </div>
                  <p className="font-black text-red-600 text-sm whitespace-nowrap">{formatBRL(item.valorConsumido)}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <List className="text-blue-600"/> 
                  {modalAberto === "compras" ? "Auditoria: Todas as Compras" : "Auditoria: Consumo Total"}
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Período atual auditado</p>
              </div>
              <button onClick={() => setModalAberto(null)} className="p-2 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full shadow-sm transition-colors border">
                <X className="w-5 h-5"/>
              </button>
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
                    [...(lancamentos?.compras || [])]
                      .sort((a, b) => (parseFloat(b.quantidade) * parseFloat(b.valorUnitario)) - (parseFloat(a.quantidade) * parseFloat(a.valorUnitario)))
                      .map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-700">{c.produto}</td>
                        <td className="py-4 px-6 font-bold text-slate-500 text-center">{c.quantidade}</td>
                        <td className="py-4 px-6 font-black text-slate-800 text-right">{formatBRL(parseFloat(c.quantidade) * parseFloat(c.valorUnitario))}</td>
                      </tr>
                    ))
                  )}

                  {modalAberto === "consumo" && (
                    listaConsumo.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-700">{item.item}</td>
                        <td className="py-4 px-6 font-bold text-slate-500 text-center">{item.qtdConsumida.toFixed(2)} {item.unidade}</td>
                        <td className="py-4 px-6 font-black text-red-600 text-right">{formatBRL(item.valorConsumido)}</td>
                      </tr>
                    ))
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