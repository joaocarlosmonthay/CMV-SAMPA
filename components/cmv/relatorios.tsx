"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Calculator, Pizza, PackageOpen, List, X, CalendarDays, Search, ReceiptText, Filter } from "lucide-react"
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
  
  // FILTRO DE MÊS: Por padrão pega o mês atual
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })

  const carregarDados = async () => {
    // Pega as datas do mês selecionado para filtrar
    const ano = parseInt(mesSelecionado.split('-')[0])
    const mes = parseInt(mesSelecionado.split('-')[1]) - 1
    const startDate = new Date(ano, mes, 1).toISOString().split('T')[0]
    const endDate = new Date(ano, mes + 1, 0).toISOString().split('T')[0]

    // Busca apenas as semanas que caem dentro deste mês
    const { data: financas } = await supabase.from('financas_semanais')
        .select('*')
        .gte('data_fim', startDate)
        .lte('data_inicio', endDate)
        .order('data_inicio', { ascending: true }) // Ascending para a Semana 1 ser a primeira da tabela

    if (!financas || financas.length === 0) {
      setSemanasData([])
      return
    }

    const oDate = financas[0].data_inicio
    const nDate = financas[financas.length - 1].data_fim

    const { data: compras } = await supabase.from('compras').select('*').gte('data_compra', oDate).lte('data_compra', nDate)
    const { data: estoques } = await supabase.from('estoques').select('*').gte('data_contagem', oDate).lte('data_contagem', nDate)

    const semanasProcessadas = financas.map((f, index) => {
        let comp = compras?.filter(c => c.data_compra >= f.data_inicio && c.data_compra <= f.data_fim) || []
        let est = estoques?.filter(e => e.data_contagem >= f.data_inicio && e.data_contagem <= f.data_fim) || []

        let prodsFiltrados = produtos || []
        if (filtroCategoria === "Cozinha") prodsFiltrados = produtos.filter(p => p.grupo !== "Bebidas" && p.grupo !== "Embalagens" && p.grupo !== "Limpeza")
        else if (filtroCategoria === "Bebidas") prodsFiltrados = produtos.filter(p => p.grupo === "Bebidas")

        comp = comp.filter(c => prodsFiltrados.find(p => p.id === c.produto_id))
        est = est.filter(e => prodsFiltrados.find(p => p.id === e.produto_id))

        const totalCompras = comp.reduce((acc, c) => acc + parseFloat(c.valor_unitario), 0)
        const inicial = est.filter(e => e.tipo_contagem === 'Inicial').reduce((acc, e) => acc + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)
        const final = est.filter(e => e.tipo_contagem === 'Final').reduce((acc, e) => acc + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)

        const consumoDetalhado = prodsFiltrados.map(p => {
          const eI = est.find(e => e.produto_id === p.id && e.tipo_contagem === 'Inicial')
          const eF = est.find(e => e.produto_id === p.id && e.tipo_contagem === 'Final')
          const cP = comp.filter(c => c.produto_id === p.id)
          const qI = eI ? parseFloat(eI.quantidade) : 0, vI = eI ? parseFloat(eI.valor_unitario) : 0, qF = eF ? parseFloat(eF.quantidade) : 0
          const cQ = cP.reduce((a, c) => a + parseFloat(c.quantidade), 0), cT = cP.reduce((a, c) => a + parseFloat(c.valor_unitario), 0)
          const qC = (qI + cQ) - qF, pM = cQ > 0 ? (cT / cQ) : vI
          return { item: p.nome, unidade: p.unidade, qtdConsumida: qC, valorConsumido: qC * pM }
        }).filter(i => i.valorConsumido > 0).sort((a, b) => b.valorConsumido - a.valorConsumido)

        const dFinal = new Date(f.data_inicio + "T12:00:00")
        dFinal.setDate(dFinal.getDate() + 6)
        const strFim = dFinal.toISOString().split('T')[0]
        const dataVisual = `${f.data_inicio.split('-')[2]}/${f.data_inicio.split('-')[1]} a ${strFim.split('-')[2]}/${strFim.split('-')[1]}`

        return { id: f.data_inicio, nome: `Semana ${index + 1}`, periodo: dataVisual, faturamento: f.faturamento, inicial, compras: totalCompras, final, consumoDetalhado, comprasDetalhadas: comp }
    })
    setSemanasData(semanasProcessadas)
    
    // Seleciona a última semana do mês por padrão no dropdown do Modal
    if (semanasProcessadas.length > 0) {
        setSemanaSelecionadaModal(semanasProcessadas[semanasProcessadas.length - 1].id)
    }
  }

  useEffect(() => { carregarDados() }, [filtroCategoria, produtos, mesSelecionado])

  const ultimaSemana = semanasData.length > 0 ? semanasData[semanasData.length - 1] : { comprasDetalhadas: [], consumoDetalhado: [] }
  const semanaSel = semanasData.find(s => s.id === semanaSelecionadaModal) || { comprasDetalhadas: [], consumoDetalhado: [] }

  return (
    <div className="space-y-8 pb-10">
      
      {/* HEADER E FILTRO DE MÊS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Relatórios Financeiros</h2>
          <p className="text-sm text-slate-500 font-medium">Análise de fechamentos por período.</p>
        </div>
        
        <div className="flex items-center gap-4">
           {/* NOVO: SELETOR DE MÊS */}
           <div className="flex items-center gap-2 bg-slate-50 border p-2 rounded-xl">
             <Filter className="w-4 h-4 text-slate-400" />
             <input 
               type="month" 
               value={mesSelecionado} 
               onChange={(e) => setMesSelecionado(e.target.value)}
               className="bg-transparent font-bold text-slate-700 outline-none text-sm cursor-pointer"
             />
           </div>

           <div className="flex bg-slate-100 p-1 rounded-xl">
             {["Geral", "Cozinha", "Bebidas"].map(cat => (
               <button key={cat} onClick={() => setFiltroCategoria(cat as any)} className={`px-4 py-2 rounded-lg font-bold text-sm ${filtroCategoria === cat ? "bg-white shadow-sm text-blue-600" : "text-slate-500"}`}>{cat}</button>
             ))}
           </div>
        </div>
      </div>

      {/* TABELA LADO A LADO DO MÊS */}
      <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
        {semanasData.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold">Nenhum fechamento encontrado neste mês.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b">
                <tr>
                  <th className="p-4 text-left">Métricas ({mesSelecionado.split('-').reverse().join('/')})</th>
                  {semanasData.map(s => (
                    <th key={s.id} className="p-4">
                      <span className="block text-[11px] text-slate-700">{s.nome}</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5">{s.periodo}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50"><td className="p-4 text-left font-bold text-slate-500">Faturamento</td>{semanasData.map(s => <td key={s.id} className="p-4 font-black text-emerald-600">{formatBRL(s.faturamento)}</td>)}</tr>
                <tr className="hover:bg-slate-50"><td className="p-4 text-left font-bold text-slate-500">Compras</td>{semanasData.map(s => <td key={s.id} className="p-4 text-amber-600 font-bold">{formatBRL(s.compras)}</td>)}</tr>
                <tr className="bg-blue-50/20 hover:bg-blue-50/30"><td className="p-4 text-left font-bold text-slate-700">CMV Real (R$)</td>{semanasData.map(s => <td key={s.id} className="p-4 font-black text-slate-800">{formatBRL(s.inicial + s.compras - s.final)}</td>)}</tr>
                <tr>
                  <td className="p-4 text-left font-bold text-slate-700">Margem (%)</td>
                  {semanasData.map(s => {
                    const cmvP = s.faturamento > 0 ? ((s.inicial + s.compras - s.final) / s.faturamento) * 100 : 0;
                    return (
                      <td key={s.id} className="p-4">
                        <span className={`px-2.5 py-1 rounded-md font-black text-xs ${cmvP > 35 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
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

      {/* CARDS DE CONSUMO */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col h-[500px]">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <div>
            <h4 className="font-black text-slate-800 text-lg flex items-center gap-2"><TrendingDown className="text-red-500 w-5 h-5"/> Ranking de Consumo</h4>
            <p className="text-xs font-medium text-slate-500 mt-1">Quais insumos pesaram mais no CMV da semana selecionada.</p>
          </div>
          <select className="p-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 outline-none focus:border-blue-500 cursor-pointer" value={semanaSelecionadaModal} onChange={e => setSemanaSelecionadaModal(e.target.value)}>
            {semanasData.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.periodo})</option>)}
          </select>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {semanaSel.consumoDetalhado.length === 0 && <p className="text-center text-slate-400 font-bold mt-10">Nenhum consumo registrado ou estoque final pendente.</p>}
          {semanaSel.consumoDetalhado.map((item: any, i: number) => (
            <div key={i} className="flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors rounded-2xl border border-slate-100">
              <div>
                <p className="font-bold text-sm text-slate-700">{item.item}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.qtdConsumida.toFixed(2)} {item.unidade} Consumidos</p>
              </div>
              <p className="font-black text-red-600 text-lg">{formatBRL(item.valorConsumido)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}