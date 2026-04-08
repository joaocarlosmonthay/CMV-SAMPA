"use client"

import { useState, useEffect } from "react"
import { FileSpreadsheet, Search, CalendarDays, Calculator } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Produto } from "./cadastros"

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const formatData = (dataStr: string) => {
  if (!dataStr) return ""
  const [ano, mes, dia] = dataStr.split("-")
  return `${dia}/${mes}`
}
const fmtQtd = (v: number) => v % 1 === 0 ? v.toString() : v.toFixed(3)

const getNomeMes = (mesStr: string) => {
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
  return meses[parseInt(mesStr, 10) - 1]
}

interface RelatoriosProps {
  produtos: Produto[]
}

export function Relatorios({ produtos }: RelatoriosProps) {
  const [todasSemanas, setTodasSemanas] = useState<any[]>([])
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([])
  const [mesSelecionado, setMesSelecionado] = useState<string>("")
  const [semanasFiltradas, setSemanasFiltradas] = useState<any[]>([])
  
  const [comprasHist, setComprasHist] = useState<any[]>([])
  const [estoquesHist, setEstoquesHist] = useState<any[]>([])
  const [precosRef, setPrecosRef] = useState<Record<string, number>>({})
  
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState("")

  // 1. CARREGA O HISTÓRICO GERAL (Semanas e Preços Base)
  useEffect(() => {
    const carregarTudo = async () => {
      setCarregando(true)
      
      // Busca semanas
      const { data } = await supabase.from('financas_semanais').select('*').order('data_inicio', { ascending: true })
      
      // Busca o último preço pago por cada produto para valorar o estoque
      const { data: precos } = await supabase.from('compras').select('produto_id, valor_unitario').order('data_compra', { ascending: false })
      const mapaPrecos: Record<string, number> = {}
      if (precos) {
        precos.forEach(p => { if (!mapaPrecos[p.produto_id]) mapaPrecos[p.produto_id] = p.valor_unitario })
        setPrecosRef(mapaPrecos)
      }

      if (data && data.length > 0) {
        setTodasSemanas(data)
        const mesesSet = new Set<string>()
        data.forEach(s => { mesesSet.add(s.data_inicio.substring(0, 7)) })
        const mesesArray = Array.from(mesesSet).sort().reverse() 
        setMesesDisponiveis(mesesArray)
        setMesSelecionado(mesesArray[0])
      }
      setCarregando(false)
    }
    carregarTudo()
  }, [])

  // 2. FILTRA AS SEMANAS DO MÊS E PUXA AS COMPRAS E ESTOQUES DESSE PERÍODO
  useEffect(() => {
    const atualizarMes = async () => {
      if (!mesSelecionado || todasSemanas.length === 0) return
      
      setCarregando(true)
      const semanasDoMes = todasSemanas.filter(s => s.data_inicio.startsWith(mesSelecionado))
      setSemanasFiltradas(semanasDoMes)

      if (semanasDoMes.length > 0) {
        const minDate = semanasDoMes[0].data_inicio
        const maxDate = semanasDoMes[semanasDoMes.length - 1].data_fim

        const [cRes, eRes] = await Promise.all([
          supabase.from('compras').select('*').gte('data_compra', minDate).lte('data_compra', maxDate),
          supabase.from('estoques').select('*').gte('data_contagem', minDate).lte('data_contagem', maxDate)
        ])
        
        if (cRes.data) setComprasHist(cRes.data)
        if (eRes.data) setEstoquesHist(eRes.data)
      } else {
        setComprasHist([]); setEstoquesHist([])
      }
      setCarregando(false)
    }
    atualizarMes()
  }, [mesSelecionado, todasSemanas])


  if (carregando && todasSemanas.length === 0) {
    return <div className="flex justify-center py-20 font-bold text-muted-foreground animate-pulse">A processar o fechamento mensal...</div>
  }

  if (todasSemanas.length === 0) {
    return (
      <div className="bg-card p-10 rounded-2xl border text-center space-y-3">
        <FileSpreadsheet className="w-12 h-12 text-[#2563EB] mx-auto opacity-50" />
        <h3 className="text-xl font-bold">Nenhum Fechamento Encontrado</h3>
        <p className="text-muted-foreground">Salve pelo menos uma semana no Dashboard para gerar o relatório mensal.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
            <FileSpreadsheet className="text-[#2563EB]" /> Fechamento Mensal
          </h2>
          <p className="text-muted-foreground text-base">Selecione o mês para ver o comparativo semanal.</p>
        </div>

        <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border-2 border-[#2563EB]/20 shadow-sm w-fit">
          <CalendarDays className="text-[#2563EB] w-6 h-6" />
          <span className="font-semibold text-muted-foreground hidden sm:block">Mês de:</span>
          <select 
            value={mesSelecionado} 
            onChange={e => setMesSelecionado(e.target.value)}
            className="font-black text-xl text-[#1E3A8A] outline-none bg-transparent cursor-pointer"
          >
            {mesesDisponiveis.map(m => {
              const [ano, mes] = m.split('-')
              return <option key={m} value={m} className="font-bold text-foreground">{getNomeMes(mes)} {ano}</option>
            })}
          </select>
        </div>
      </div>

      {carregando && semanasFiltradas.length === 0 ? (
        <div className="py-10 text-center font-bold text-muted-foreground animate-pulse">A carregar os dados deste mês...</div>
      ) : (
        <>
          {/* TABELA 1: DRE DA COZINHA */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="bg-[#1E3A8A] px-6 py-4 border-b border-[#1e40af] flex justify-between items-center">
              <h3 className="text-xl font-bold text-white tracking-wider">DRE DA COZINHA</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm sm:text-base">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-4 font-bold text-muted-foreground w-1/4 sticky left-0 bg-muted/95 shadow-[1px_0_0_0_#e2e8f0]">INDICADOR</th>
                    {semanasFiltradas.map((s, i) => (
                      <th key={i} className="text-right p-4 font-black text-foreground whitespace-nowrap">
                        Semana {i + 1}
                        <span className="block text-xs font-semibold text-muted-foreground mt-0.5">
                          ({formatData(s.data_inicio)} a {formatData(s.data_fim)})
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="hover:bg-muted/30">
                    <td className="p-4 font-bold text-foreground sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0]">Faturamento</td>
                    {semanasFiltradas.map((s, i) => <td key={i} className="p-4 text-right font-semibold">{formatBRL(s.faturamento)}</td>)}
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="p-4 font-bold text-blue-700 sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0]">Compras (Insumos)</td>
                    {semanasFiltradas.map((s, i) => {
                      const comprasDaSemana = comprasHist.filter(c => c.data_compra >= s.data_inicio && c.data_compra <= s.data_fim).reduce((a, b) => a + Number(b.valor_total), 0)
                      return <td key={i} className="p-4 text-right font-semibold text-blue-700">{formatBRL(comprasDaSemana)}</td>
                    })}
                  </tr>
                  <tr className="hover:bg-muted/30 bg-orange-50/30">
                    <td className="p-4 font-bold text-orange-700 sticky left-0 bg-orange-50/95 shadow-[1px_0_0_0_#e2e8f0]">Deduções (Não Vendido)</td>
                    {semanasFiltradas.map((s, i) => {
                      const deducoes = Number(s.consumo_interno) + Number(s.consumo_socios) + Number(s.teste_mkt) + Number(s.desperdicios)
                      return <td key={i} className="p-4 text-right font-semibold text-orange-700">- {formatBRL(deducoes)}</td>
                    })}
                  </tr>
                  <tr className="hover:bg-muted/30 bg-muted/20">
                    <td className="p-4 font-black text-foreground sticky left-0 bg-muted/90 shadow-[1px_0_0_0_#e2e8f0]">Custo Aprox. (CMV R$)</td>
                    {semanasFiltradas.map((s, i) => {
                      const comprasDaSemana = comprasHist.filter(c => c.data_compra >= s.data_inicio && c.data_compra <= s.data_fim).reduce((a, b) => a + Number(b.valor_total), 0)
                      const deducoes = Number(s.consumo_interno) + Number(s.consumo_socios) + Number(s.teste_mkt) + Number(s.desperdicios)
                      const cmvAproximado = comprasDaSemana - deducoes 
                      return <td key={i} className="p-4 text-right font-black">{formatBRL(cmvAproximado > 0 ? cmvAproximado : 0)}</td>
                    })}
                  </tr>
                  <tr className="bg-slate-900 text-white">
                    <td className="p-4 font-black uppercase tracking-widest text-[#FACC15] sticky left-0 bg-slate-900 shadow-[1px_0_0_0_#0f172a]">CMV % (Cozinha)</td>
                    {semanasFiltradas.map((s, i) => {
                      const comprasDaSemana = comprasHist.filter(c => c.data_compra >= s.data_inicio && c.data_compra <= s.data_fim).reduce((a, b) => a + Number(b.valor_total), 0)
                      const deducoes = Number(s.consumo_interno) + Number(s.consumo_socios) + Number(s.teste_mkt) + Number(s.desperdicios)
                      const cmvAproximado = comprasDaSemana - deducoes
                      const pct = s.faturamento > 0 ? ((cmvAproximado / s.faturamento) * 100).toFixed(1) : "0.0"
                      const atingiuMeta = Number(pct) <= 29 && Number(pct) > 0
                      
                      return (
                        <td key={i} className="p-4 text-right font-black text-xl">
                          <span className={atingiuMeta ? "text-[#4ade80]" : "text-[#f87171]"}>{pct}%</span>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABELA 2: A LUPA DE CONSUMO DO TIO TIAGO */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-8">
             <div className="bg-[#2563EB] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-white tracking-wider flex items-center gap-2"><Calculator className="w-6 h-6"/> LUPA DE CONSUMO REAL (Insumos)</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1E3A8A]" />
                <input 
                  type="text" 
                  placeholder="Buscar insumo..." 
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-xl bg-white border-none text-[#1E3A8A] focus:ring-4 focus:ring-[#FACC15] outline-none font-bold text-sm w-full sm:w-64"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-4 font-bold text-muted-foreground sticky left-0 bg-muted/95 shadow-[1px_0_0_0_#e2e8f0] z-10">PRODUTO</th>
                    {semanasFiltradas.map((s, i) => (
                      <th key={i} className="text-right p-4 font-bold text-muted-foreground whitespace-nowrap">
                        Semana {i+1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {produtos
                    .filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))
                    .map((produto) => {
                      // Verifica se teve alguma movimentação (compra ou estoque) neste mês
                      const teveMovimento = comprasHist.some(c => c.produto_id === produto.id) || estoquesHist.some(e => e.produto_id === produto.id)
                      if (!teveMovimento && busca === "") return null

                      return (
                        <tr key={produto.id} className="hover:bg-muted/30">
                          <td className="p-4 font-semibold text-foreground sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0] z-10">
                            {produto.nome}
                          </td>
                          {semanasFiltradas.map((s, i) => {
                            // A MATEMÁTICA REAL DE CONSUMO: (Inicial + Compras - Final)
                            const estIni = Number(estoquesHist.find(e => e.produto_id === produto.id && e.tipo_contagem === 'Inicial' && e.data_contagem === s.data_inicio)?.quantidade || 0)
                            const estFin = Number(estoquesHist.find(e => e.produto_id === produto.id && e.tipo_contagem === 'Final' && e.data_contagem === s.data_fim)?.quantidade || 0)
                            
                            const comprasSemana = comprasHist.filter(c => c.produto_id === produto.id && c.data_compra >= s.data_inicio && c.data_compra <= s.data_fim)
                            const compQtd = comprasSemana.reduce((a, b) => a + Number(b.quantidade), 0)
                            const compValor = comprasSemana.reduce((a, b) => a + Number(b.valor_total), 0)

                            const consumoQtd = (estIni + compQtd) - estFin
                            
                            // Calcula o preço médio desta semana, ou pega a última referência conhecida se não comprou
                            const precoMedio = compQtd > 0 ? (compValor / compQtd) : (precosRef[produto.id] || 0)
                            const consumoValor = consumoQtd * precoMedio

                            if (estIni === 0 && compQtd === 0 && estFin === 0 && consumoQtd === 0) {
                                return <td key={i} className="p-4 text-right text-muted-foreground/30">-</td>
                            }

                            return (
                              <td key={i} className="p-4 text-right whitespace-nowrap">
                                <span className={`block font-black ${consumoValor < 0 ? "text-red-500" : "text-[#1E3A8A]"}`}>
                                    {formatBRL(consumoValor)}
                                </span>
                                <span className={`block text-sm font-bold ${consumoQtd < 0 ? "text-red-500" : "text-[#2563EB]"}`}>
                                    {fmtQtd(consumoQtd)} {produto.unidade}
                                </span>
                                <span className="block text-[10px] font-medium text-muted-foreground mt-1 tracking-tighter bg-muted px-1 py-0.5 rounded-md w-fit ml-auto">
                                  In: {fmtQtd(estIni)} | Cp: {fmtQtd(compQtd)} | Fn: {fmtQtd(estFin)}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}