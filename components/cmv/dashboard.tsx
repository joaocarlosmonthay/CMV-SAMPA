"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, DollarSign, Calculator, Pizza, Coffee, List, X, BarChart3, Search, CalendarDays, Package, Warehouse, History, ShoppingCart, ReceiptText, PieChart } from "lucide-react"
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

  // --- CÁLCULOS DA SEMANA ATUAL ---
  const faturamentoAtual = lancamentos?.faturamento || 0
  const comprasAtual = (lancamentos?.compras || []).reduce((acc: number, c: any) => acc + parseFloat(c.valorTotal || 0), 0)

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

  let cmvCozinhaRS = 0, cmvBebidasRS = 0
  let percCozinha = 0, percBebidas = 0

  if (produtos?.length > 0) {
    const calcCmvPorGrupo = (isBebida: boolean) => {
      const ids = produtos.filter((p: any) => isBebida ? p.grupo === "Bebidas" : (p.grupo !== "Bebidas" && p.grupo !== "Embalagens" && p.grupo !== "Limpeza")).map((p: any) => p.id)
      const init = Object.entries(contagemInicial || {}).reduce((acc, [id, item]: any) => ids.includes(Number(id)) ? acc + (parseFloat(item.qtd||0) * parseFloat(item.valor||0)) : acc, 0)
      const fin = Object.entries(contagemFinal || {}).reduce((acc, [id, item]: any) => ids.includes(Number(id)) ? acc + (parseFloat(item.qtd||0) * parseFloat(item.valor||0)) : acc, 0)
      const comp = (lancamentos?.compras || []).reduce((acc: number, c: any) => {
        const prod = produtos.find((p:any) => p.nome === c.produto)
        return prod && ids.includes(prod.id) ? acc + parseFloat(c.valorTotal) : acc
      }, 0)
      return init + comp - fin
    }
    cmvCozinhaRS = calcCmvPorGrupo(false)
    cmvBebidasRS = calcCmvPorGrupo(true)
    percCozinha = faturamentoAtual > 0 ? (cmvCozinhaRS / faturamentoAtual) * 100 : 0
    percBebidas = faturamentoAtual > 0 ? (cmvBebidasRS / faturamentoAtual) * 100 : 0
  }

  // --- BUSCA DO HISTÓRICO (CORRIGIDO E SINCRONIZADO) ---
  useEffect(() => {
    const buscarHistorico = async () => {
      setLoadingHistorico(true)
      const { data: financas } = await supabase.from('financas_semanais').select('*').order('data_inicio', { ascending: false }).limit(5)
      if (!financas || financas.length === 0) { setLoadingHistorico(false); return }

      const datas = financas.map(f => f.data_inicio)
      const { data: dbCompras } = await supabase.from('compras').select('*').in('data_compra', datas)
      const { data: dbEstoques } = await supabase.from('estoques').select('*').in('data_contagem', datas)

      const historyData = financas.reverse().map((f, index) => {
        // Se a data do loop for igual à data que o usuário está vendo na tela, USAMOS OS DADOS VIVOS DA TELA
        if (f.data_inicio === dataInicio) {
          return {
            id: f.data_inicio,
            semana: `Sem. ${index + 1}`,
            periodo: `${f.data_inicio.split('-')[2]}/${f.data_inicio.split('-')[1]} a ${dataFim.split('-')[2]}/${dataFim.split('-')[1]}`,
            faturamento: faturamentoAtual,
            compras: comprasAtual,
            estoqueInicial: estInicialAtual,
            estoqueFinal: estFinalAtual,
            cmvValor: cmvRealR$,
            cmvPerc: cmvRealPerc
          }
        }

        // Se for de semanas anteriores, usamos o banco de dados puro, mas multiplicando Qtd * Unitário
        const myCompras = dbCompras?.filter(c => c.data_compra === f.data_inicio) || []
        const myEst = dbEstoques?.filter(e => e.data_contagem === f.data_inicio) || []
        
        const totComp = myCompras.reduce((a, c) => a + (parseFloat(c.quantidade) * parseFloat(c.valor_unitario)), 0)
        const eIni = myEst.filter(e => e.tipo_contagem === 'Inicial').reduce((a, e) => a + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)
        const eFin = myEst.filter(e => e.tipo_contagem === 'Final').reduce((a, e) => a + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)
        const cmvRS = eIni + totComp - eFin

        const dFinal = new Date(f.data_inicio + "T12:00:00")
        dFinal.setDate(dFinal.getDate() + 6)
        const strFim = dFinal.toISOString().split('T')[0]

        return {
          id: f.data_inicio,
          semana: `Sem. ${index + 1}`,
          periodo: `${f.data_inicio.split('-')[2]}/${f.data_inicio.split('-')[1]} a ${strFim.split('-')[2]}/${strFim.split('-')[1]}`,
          faturamento: f.faturamento || 0,
          compras: totComp,
          estoqueInicial: eIni,
          estoqueFinal: eFin,
          cmvValor: cmvRS,
          cmvPerc: f.faturamento > 0 ? (cmvRS / f.faturamento) * 100 : 0
        }
      })
      setHistoricoSemanas(historyData)
      setLoadingHistorico(false)
    }
    
    // O useEffect agora reage a TUDO: data, lançamentos e estoques
    if (dataInicio) buscarHistorico()
  }, [dataInicio, dataFim, lancamentos, contagemInicial, contagemFinal])

  const chartData = historicoSemanas.map(s => ({
    name: s.semana,
    Vendas: s.faturamento,
    Compras: s.compras
  }))

  return (
    <div className="space-y-6 font-sans pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 className="text-blue-600"/> Painel de Controle
          </h2>
          <p className="text-slate-500 font-medium text-sm">Resumo operacional da semana selecionada.</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período de Auditoria</span>
          <div className="text-slate-700 font-black text-lg">{dataInicio.split('-').reverse().join('/')} <span className="text-slate-300 mx-1">➜</span> {dataFim.split('-').reverse().join('/')}</div>
        </div>
      </div>

      {/* FLUXO DO ESTOQUE */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1"><Warehouse className="w-3 h-3"/> Estoque Inicial</p>
          <p className="text-2xl font-black text-slate-700">{formatBRL(estInicialAtual)}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1"><ShoppingCart className="w-3 h-3 text-amber-500"/> (+) Compras</p>
          <p className="text-2xl font-black text-slate-700">{formatBRL(comprasAtual)}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1"><Package className="w-3 h-3 text-blue-500"/> (-) Estoque Final</p>
          <p className="text-2xl font-black text-slate-700">{formatBRL(estFinalAtual)}</p>
        </div>
        <div className="bg-blue-600 p-5 rounded-3xl shadow-blue-200 shadow-lg text-white">
          <p className="text-[10px] font-black text-blue-100 uppercase mb-1">(=) CMV Realizado</p>
          <p className="text-2xl font-black">{formatBRL(cmvRealR$)}</p>
        </div>
      </div>

      {/* INDICADORES PRINCIPAIS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><DollarSign className="w-24 h-24"/></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Venda Bruta</p>
          <h3 className="text-4xl font-black text-emerald-600">{formatBRL(faturamentoAtual)}</h3>
          <div className="mt-4 flex items-center gap-2 text-slate-500 text-sm font-bold">
            <ReceiptText className="w-4 h-4"/> Seleção atual
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Margem CMV</p>
          <div className="flex items-end gap-3">
            <h3 className={`text-4xl font-black ${cmvRealPerc > 35 ? 'text-red-500' : 'text-slate-800'}`}>
              {formatPerc(cmvRealPerc)}
            </h3>
            <span className="text-slate-400 font-bold mb-1 text-sm">do faturamento</span>
          </div>
          <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${cmvRealPerc > 35 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${Math.min(cmvRealPerc, 100)}%`}}></div>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[32px] shadow-xl text-white">
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Divisão de Custo</p>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-xl"><Pizza className="text-orange-400 w-5 h-5"/></div>
                <span className="font-bold text-slate-300">Cozinha</span>
              </div>
              <div className="text-right">
                <p className="font-black text-lg">{formatPerc(percCozinha)}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">{formatBRL(cmvCozinhaRS)}</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-xl"><Coffee className="text-purple-400 w-5 h-5"/></div>
                <span className="font-bold text-slate-300">Bebidas</span>
              </div>
              <div className="text-right">
                <p className="font-black text-lg">{formatPerc(percBebidas)}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">{formatBRL(cmvBebidasRS)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EVOLUÇÃO SEMANAL */}
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-blue-600"/> Evolução das Últimas 5 Semanas</h3>
          {loadingHistorico && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-black tracking-wider uppercase">
                <th className="py-4 px-6 text-left text-[10px]">Métricas</th>
                {historicoSemanas.map(s => (
                  <th key={s.id} className="py-3 px-6 text-right whitespace-nowrap min-w-[100px]">
                    <span className="block text-[12px] text-slate-800">{s.semana}</span>
                    <span className="block text-[9px] text-slate-400 mt-0.5">{s.periodo}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              <tr>
                <td className="py-4 px-6 text-slate-500">Faturamento</td>
                {historicoSemanas.map(s => <td key={s.id} className="py-4 px-6 text-right font-black text-emerald-600">{formatBRL(s.faturamento)}</td>)}
              </tr>
              <tr>
                <td className="py-4 px-6 text-slate-500">Estoque Inicial (+)</td>
                {historicoSemanas.map(s => <td key={s.id} className="py-4 px-6 text-right text-slate-400">{formatBRL(s.estoqueInicial)}</td>)}
              </tr>
              <tr>
                <td className="py-4 px-6 text-slate-500">Compras (+)</td>
                {historicoSemanas.map(s => <td key={s.id} className="py-4 px-6 text-right text-amber-600">{formatBRL(s.compras)}</td>)}
              </tr>
              <tr>
                <td className="py-4 px-6 text-slate-500">Estoque Final (-)</td>
                {historicoSemanas.map(s => <td key={s.id} className="py-4 px-6 text-right text-slate-400">{formatBRL(s.estoqueFinal)}</td>)}
              </tr>
              <tr className="bg-blue-50/30">
                <td className="py-4 px-6 font-bold text-slate-700">CMV Realizado (R$)</td>
                {historicoSemanas.map(s => <td key={s.id} className="py-4 px-6 text-right font-black text-slate-800">{formatBRL(s.cmvValor)}</td>)}
              </tr>
              <tr className="bg-slate-50">
                <td className="py-5 px-6 font-black text-slate-800">Margem CMV (%)</td>
                {historicoSemanas.map(s => (
                  <td key={s.id} className="py-5 px-6 text-right">
                    <span className={`px-3 py-1.5 rounded-lg font-black text-sm ${s.cmvPerc > 35 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      {formatPerc(s.cmvPerc)}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* GRÁFICO E RANKING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-black text-slate-800 flex items-center gap-2"><ShoppingCart className="text-amber-500 w-5 h-5"/> Entradas de Insumos</h4>
            <button onClick={() => setModalAberto("compras")} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-blue-600"><Search className="w-5 h-5"/></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {lancamentos?.compras?.length === 0 && <p className="text-center text-slate-400 mt-10 font-bold italic text-sm">Nenhuma nota fiscal lançada.</p>}
            {[...(lancamentos?.compras || [])].sort((a,b) => b.valorTotal - a.valorTotal).slice(0,10).map((c, i) => (
              <div key={i} className="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0">
                <div><p className="font-bold text-slate-700 text-sm">{c.produto}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{c.quantidade} unidades</p></div>
                <p className="font-black text-slate-800">{formatBRL(c.valorTotal)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="mb-6">
             <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><BarChart3 className="text-blue-600 w-5 h-5"/> Vendas x Compras</h3>
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
      </div>

      {/* MODAL AUDITORIA */}
      {modalAberto === "compras" && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-800">Listagem Completa de Notas</h3>
              <button onClick={() => setModalAberto(null)} className="p-2 bg-white hover:bg-red-50 rounded-full border transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="overflow-y-auto p-0">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-white shadow-sm font-black text-[10px] uppercase text-slate-400">
                  <tr><th className="py-4 px-6">Produto</th><th className="py-4 px-6 text-center">Quantidade</th><th className="py-4 px-6 text-right">Valor Pago</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lancamentos?.compras?.map((c: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-700">{c.produto}</td>
                      <td className="py-4 px-6 text-center font-bold text-slate-500">{c.quantidade}</td>
                      <td className="py-4 px-6 font-black text-slate-800 text-right">{formatBRL(c.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}