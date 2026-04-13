"use client"

import { useState, useEffect } from "react"
import { FileSpreadsheet, Search, CalendarDays, Calculator, TrendingUp, TrendingDown, DollarSign, AlertTriangle, PieChart, BarChart3, PackageOpen } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Produto } from "@/components/cmv/cadastros"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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
  const [saidasHist, setSaidasHist] = useState<any[]>([])
  const [precosRef, setPrecosRef] = useState<Record<string, number>>({})
  
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState("")

  useEffect(() => {
    const carregarTudo = async () => {
      setCarregando(true)
      const { data } = await supabase.from('financas_semanais').select('*').order('data_inicio', { ascending: true })
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

  useEffect(() => {
    const atualizarMes = async () => {
      if (!mesSelecionado || todasSemanas.length === 0) return
      setCarregando(true)
      const semanasDoMes = todasSemanas.filter(s => s.data_inicio.startsWith(mesSelecionado))
      setSemanasFiltradas(semanasDoMes)

      if (semanasDoMes.length > 0) {
        const minDate = semanasDoMes[0].data_inicio
        const maxDate = semanasDoMes[semanasDoMes.length - 1].data_fim

        const [cRes, eRes, sRes] = await Promise.all([
          supabase.from('compras').select('*').gte('data_compra', minDate).lte('data_compra', maxDate),
          supabase.from('estoques').select('*').gte('data_contagem', minDate).lte('data_contagem', maxDate),
          supabase.from('saidas_avulsas').select('*').gte('data_saida', minDate).lte('data_saida', maxDate)
        ])
        
        if (cRes.data) setComprasHist(cRes.data)
        if (eRes.data) setEstoquesHist(eRes.data)
        if (sRes.data) setSaidasHist(sRes.data)
      } else {
        setComprasHist([]); setEstoquesHist([]); setSaidasHist([])
      }
      setCarregando(false)
    }
    atualizarMes()
  }, [mesSelecionado, todasSemanas])


  // =========================================================================
  // MOTOR DE INTELIGÊNCIA: CÁLCULOS DO MÊS E TIPAGEM RESOLVIDA
  // =========================================================================
  let faturamentoTotal = 0
  let custoTotal = 0
  let desperdicioTotal = 0
  const dadosGrafico: { name: string, Faturamento: number, Custo: number, CMV: string | number }[] = []
  const analiseProdutos: any[] = []

  if (semanasFiltradas.length > 0 && !carregando) {
    // 1. DADOS DAS SEMANAS PARA O GRÁFICO E RESUMO
    semanasFiltradas.forEach((s, i) => {
      faturamentoTotal += Number(s.faturamento || 0)
      
      const comprasDaSemana = comprasHist.filter(c => c.data_compra >= s.data_inicio && c.data_compra <= s.data_fim).reduce((a, b) => a + Number(b.quantidade * b.valor_unitario), 0)
      
      const deducoes = Number(s.consumo_interno || 0) + Number(s.consumo_socios || 0) + Number(s.teste_mkt || 0) + Number(s.desperdicios || 0)
      const custoReal = comprasDaSemana - deducoes
      custoTotal += (custoReal > 0 ? custoReal : 0)

      dadosGrafico.push({
        name: `Sem ${i+1}`,
        Faturamento: Number(s.faturamento || 0),
        Custo: (custoReal > 0 ? custoReal : 0),
        CMV: s.faturamento > 0 ? ((custoReal / s.faturamento) * 100).toFixed(1) : 0
      })
    })

    // 2. CÁLCULO DE DESPERDÍCIOS
    desperdicioTotal = saidasHist.filter(s => s.motivo === 'Desperdício / Vencido').reduce((acc, s) => {
      const preco = precosRef[s.produto_id] || 0
      return acc + (Number(s.quantidade) * preco)
    }, 0)

    // 3. CURVA ABC (Ouro do Sistema)
    produtos.forEach(p => {
      let custoInsumo = 0
      let qtdConsumida = 0
      semanasFiltradas.forEach(s => {
        const estIni = Number(estoquesHist.find(e => e.produto_id === p.id && e.tipo_contagem === 'Inicial' && e.data_contagem === s.data_inicio)?.quantidade || 0)
        const estFin = Number(estoquesHist.find(e => e.produto_id === p.id && e.tipo_contagem === 'Final' && e.data_contagem === s.data_fim)?.quantidade || 0)
        const comprasSemana = comprasHist.filter(c => c.produto_id === p.id && c.data_compra >= s.data_inicio && c.data_compra <= s.data_fim)
        const compQtd = comprasSemana.reduce((a, b) => a + Number(b.quantidade), 0)
        const compValor = comprasSemana.reduce((a, b) => a + Number(b.quantidade * b.valor_unitario), 0)

        const consumoQtdSemana = (estIni + compQtd) - estFin
        const precoMedio = compQtd > 0 ? (compValor / compQtd) : (precosRef[p.id] || 0)
        
        qtdConsumida += consumoQtdSemana
        custoInsumo += (consumoQtdSemana * precoMedio)
      })

      if (custoInsumo > 0) {
        analiseProdutos.push({ id: p.id, nome: p.nome, unidade: p.unidade, custo: custoInsumo, qtd: qtdConsumida })
      }
    })

    // Ordena do maior custo para o menor (Curva ABC)
    analiseProdutos.sort((a, b) => b.custo - a.custo)
    
    // Calcula % Acumulada
    const custoTotalInsumos = analiseProdutos.reduce((a, b) => a + b.custo, 0)
    let acumulado = 0
    analiseProdutos.forEach(p => {
      acumulado += p.custo
      p.pct = (p.custo / custoTotalInsumos) * 100
      p.pctAcumulado = (acumulado / custoTotalInsumos) * 100
      
      if (p.pctAcumulado <= 80) p.curva = 'A' // 80% do valor
      else if (p.pctAcumulado <= 95) p.curva = 'B' // 15% do valor
      else p.curva = 'C' // 5% do valor
    })
  }

  const cmvMedio = faturamentoTotal > 0 ? ((custoTotal / faturamentoTotal) * 100).toFixed(1) : "0.0"

  if (carregando && todasSemanas.length === 0) return <div className="flex justify-center py-20 font-bold text-muted-foreground animate-pulse">A carregar a inteligência financeira...</div>

  if (todasSemanas.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border text-center space-y-4 shadow-sm max-w-2xl mx-auto mt-10">
        <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto"><BarChart3 className="w-12 h-12" /></div>
        <h3 className="text-2xl font-black text-slate-800">Seu Cofre está Vazio</h3>
        <p className="text-slate-500 font-medium">Você precisa fechar pelo menos uma semana no sistema para que eu possa gerar análises profissionais e a Curva ABC de insumos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-500">
      
      {/* HEADER DE COMANDO */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <PieChart className="text-[#1E3A8A] w-8 h-8" /> Central de Inteligência
          </h2>
          <p className="text-slate-500 font-medium mt-1">Análise de rentabilidade e Curva ABC.</p>
        </div>

        <div className="flex items-center gap-3 bg-blue-50 px-6 py-4 rounded-2xl border border-blue-100 transition-all hover:shadow-md">
          <CalendarDays className="text-blue-600 w-6 h-6" />
          <span className="font-bold text-blue-900 hidden sm:block uppercase tracking-wider text-xs">Competência:</span>
          <select 
            value={mesSelecionado} 
            onChange={e => setMesSelecionado(e.target.value)}
            className="font-black text-xl text-blue-700 outline-none bg-transparent cursor-pointer hover:text-blue-800"
          >
            {mesesDisponiveis.map(m => {
              const [ano, mes] = m.split('-')
              return <option key={m} value={m} className="font-bold">{getNomeMes(mes)} {ano}</option>
            })}
          </select>
        </div>
      </div>

      {carregando && semanasFiltradas.length === 0 ? (
        <div className="py-20 text-center font-bold text-blue-600 animate-pulse text-xl">A calcular métricas avançadas...</div>
      ) : (
        <>
          {/* CARDS DE RESUMO EXECUTIVO (O que os sócios querem ver) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><DollarSign className="w-20 h-20" /></div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Vendas (Mês)</p>
               <h3 className="text-3xl font-black text-slate-800">{formatBRL(faturamentoTotal)}</h3>
               <div className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-full"><TrendingUp className="w-4 h-4"/> Receita Bruta</div>
            </div>

            <div className="bg-[#1E3A8A] p-6 rounded-3xl border border-blue-900 shadow-lg relative overflow-hidden group hover:shadow-xl transition-all">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><PieChart className="w-20 h-20 text-white" /></div>
               <p className="text-xs font-black text-blue-300 uppercase tracking-widest mb-1">CMV Acumulado</p>
               <div className="flex items-end gap-3">
                 <h3 className="text-4xl font-black text-white">{cmvMedio}%</h3>
                 <span className="text-blue-200 font-bold mb-1 opacity-80">{formatBRL(custoTotal)}</span>
               </div>
               <div className="mt-4 flex items-center gap-2 text-sm font-bold text-white bg-white/20 w-fit px-3 py-1 rounded-full">
                 {Number(cmvMedio) <= 29 ? "🎯 Dentro da Meta" : "⚠️ Acima da Meta"}
               </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><TrendingDown className="w-20 h-20" /></div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Custo Insumos</p>
               <h3 className="text-3xl font-black text-slate-800">{formatBRL(custoTotal)}</h3>
               <div className="mt-4 flex items-center gap-2 text-sm font-bold text-amber-600 bg-amber-50 w-fit px-3 py-1 rounded-full"><Calculator className="w-4 h-4"/> Após deduções</div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform text-red-500"><AlertTriangle className="w-20 h-20" /></div>
               <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-1">Termômetro de Perdas</p>
               <h3 className="text-3xl font-black text-red-600">{formatBRL(desperdicioTotal)}</h3>
               <div className="mt-4 flex items-center gap-2 text-sm font-bold text-red-600 bg-red-50 w-fit px-3 py-1 rounded-full"><TrendingDown className="w-4 h-4"/> Lixo / Vencidos</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* GRÁFICO DE EVOLUÇÃO (2 colunas) */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border shadow-sm flex flex-col">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6"><TrendingUp className="text-blue-600"/> Evolução Receita vs Custo</h3>
              <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dadosGrafico} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600, fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600, fontSize: 12}} tickFormatter={(value) => `R$ ${value/1000}k`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => formatBRL(value)}
                    />
                    <Area type="monotone" dataKey="Faturamento" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorFat)" />
                    <Area type="monotone" dataKey="Custo" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorCusto)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CURVA ABC - ONDE ESTÁ O DINHEIRO */}
            <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><PackageOpen className="text-[#1E3A8A]"/> Curva ABC (Top 5)</h3>
                <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">80% do Custo</span>
              </div>
              
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  {analiseProdutos.filter(p => p.curva === 'A').slice(0, 5).map((p, idx) => (
                    <div key={p.id} className="group">
                      <div className="flex justify-between items-end mb-1">
                        <span className="font-bold text-slate-700 text-sm">{idx + 1}. {p.nome}</span>
                        <span className="font-black text-[#1E3A8A] text-sm">{formatBRL(p.custo)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-[#1E3A8A] h-2 rounded-full transition-all duration-1000" style={{ width: `${p.pct}%` }}></div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 text-right">{p.pct.toFixed(1)}% do caixa</p>
                    </div>
                  ))}
                </div>
                {analiseProdutos.length === 0 && <p className="text-slate-400 text-center font-medium my-auto">Nenhum consumo registrado.</p>}
              </div>
            </div>

          </div>

          {/* TABELA DRE */}
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden mt-6">
            <div className="bg-[#1E3A8A] px-8 py-5 flex justify-between items-center">
              <h3 className="text-xl font-black text-white tracking-wider flex items-center gap-2"><FileSpreadsheet /> DRE DA COZINHA</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm sm:text-base">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left p-5 font-black text-slate-500 uppercase text-xs tracking-widest w-1/4 sticky left-0 bg-slate-50 z-10">Indicador</th>
                    {semanasFiltradas.map((s, i) => (
                      <th key={i} className="text-right p-5 font-black text-slate-800 whitespace-nowrap">
                        Semana {i + 1}
                        <span className="block text-[10px] uppercase font-bold text-slate-400 mt-1">{formatData(s.data_inicio)} a {formatData(s.data_fim)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="p-5 font-bold text-slate-700 sticky left-0 bg-white z-10">1. Faturamento Bruto</td>
                    {semanasFiltradas.map((s, i) => <td key={i} className="p-5 text-right font-black text-emerald-600">{formatBRL(s.faturamento)}</td>)}
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="p-5 font-bold text-slate-700 sticky left-0 bg-white z-10">2. Compras (Insumos)</td>
                    {semanasFiltradas.map((s, i) => {
                      const comprasDaSemana = comprasHist.filter(c => c.data_compra >= s.data_inicio && c.data_compra <= s.data_fim).reduce((a, b) => a + Number(b.quantidade * b.valor_unitario), 0)
                      return <td key={i} className="p-5 text-right font-semibold text-slate-600">{formatBRL(comprasDaSemana)}</td>
                    })}
                  </tr>
                  <tr className="hover:bg-amber-50/50 transition-colors bg-amber-50/30">
                    <td className="p-5 font-bold text-amber-700 sticky left-0 bg-amber-50/95 z-10 flex items-center gap-2">3. Deduções (Consumo/Lixo)</td>
                    {semanasFiltradas.map((s, i) => {
                      const deducoes = Number(s.consumo_interno || 0) + Number(s.consumo_socios || 0) + Number(s.teste_mkt || 0) + Number(s.desperdicios || 0)
                      return <td key={i} className="p-5 text-right font-bold text-amber-600">- {formatBRL(deducoes)}</td>
                    })}
                  </tr>
                  <tr className="bg-slate-900 text-white">
                    <td className="p-5 font-black uppercase tracking-widest text-blue-400 sticky left-0 bg-slate-900 z-10">CMV % (Resultado)</td>
                    {semanasFiltradas.map((s, i) => {
                      const comprasDaSemana = comprasHist.filter(c => c.data_compra >= s.data_inicio && c.data_compra <= s.data_fim).reduce((a, b) => a + Number(b.quantidade * b.valor_unitario), 0)
                      const deducoes = Number(s.consumo_interno || 0) + Number(s.consumo_socios || 0) + Number(s.teste_mkt || 0) + Number(s.desperdicios || 0)
                      const cmvR = comprasDaSemana - deducoes
                      const pct = s.faturamento > 0 ? ((cmvR / s.faturamento) * 100).toFixed(1) : "0.0"
                      const atingiuMeta = Number(pct) <= 29 && Number(pct) > 0
                      return (
                        <td key={i} className="p-5 text-right font-black text-2xl">
                          <span className={atingiuMeta ? "text-[#4ade80]" : "text-[#f87171]"}>{pct}%</span>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* LUPA DE CONSUMO RENOVADA */}
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden mt-8">
             <div className="bg-slate-50 border-b px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Search className="w-5 h-5 text-blue-600"/> LUPA DE CONSUMO (Insumos)</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Acompanhe a variação de custo item a item.</p>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar insumo..." 
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10 pr-4 py-3 rounded-2xl bg-white border-2 focus:border-blue-500 outline-none font-bold text-sm w-full sm:w-72 transition-all shadow-sm"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white border-b">
                    <th className="text-left p-5 font-black text-slate-400 uppercase text-xs tracking-widest sticky left-0 bg-white shadow-[1px_0_0_0_#f1f5f9] z-10">Produto</th>
                    <th className="text-center p-5 font-black text-blue-600 uppercase text-xs tracking-widest bg-blue-50/50">Curva ABC</th>
                    {semanasFiltradas.map((s, i) => (
                      <th key={i} className="text-right p-5 font-black text-slate-400 uppercase text-xs tracking-widest whitespace-nowrap">Semana {i+1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {produtos
                    .filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))
                    .map((produto) => {
                      const dadosABC = analiseProdutos.find(a => a.id === produto.id)
                      const teveMovimento = comprasHist.some(c => c.produto_id === produto.id) || estoquesHist.some(e => e.produto_id === produto.id)
                      
                      if (!teveMovimento && busca === "") return null

                      return (
                        <tr key={produto.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-5 font-bold text-slate-800 sticky left-0 bg-white shadow-[1px_0_0_0_#f1f5f9] z-10">
                            {produto.nome}
                          </td>
                          <td className="p-5 text-center bg-blue-50/20">
                             {dadosABC ? (
                               <span className={`px-3 py-1 rounded-lg font-black text-xs ${dadosABC.curva === 'A' ? 'bg-red-100 text-red-700' : dadosABC.curva === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                 Classe {dadosABC.curva}
                               </span>
                             ) : <span className="text-slate-300">-</span>}
                          </td>
                          {semanasFiltradas.map((s, i) => {
                            const estIni = Number(estoquesHist.find(e => e.produto_id === produto.id && e.tipo_contagem === 'Inicial' && e.data_contagem === s.data_inicio)?.quantidade || 0)
                            const estFin = Number(estoquesHist.find(e => e.produto_id === produto.id && e.tipo_contagem === 'Final' && e.data_contagem === s.data_fim)?.quantidade || 0)
                            
                            const comprasSemana = comprasHist.filter(c => c.produto_id === produto.id && c.data_compra >= s.data_inicio && c.data_compra <= s.data_fim)
                            const compQtd = comprasSemana.reduce((a, b) => a + Number(b.quantidade), 0)
                            const compValor = comprasSemana.reduce((a, b) => a + Number(b.quantidade * b.valor_unitario), 0)

                            const consumoQtd = (estIni + compQtd) - estFin
                            const precoMedio = compQtd > 0 ? (compValor / compQtd) : (precosRef[produto.id] || 0)
                            const consumoValor = consumoQtd * precoMedio

                            if (estIni === 0 && compQtd === 0 && estFin === 0 && consumoQtd === 0) {
                                return <td key={i} className="p-5 text-right text-slate-300 font-medium">-</td>
                            }

                            return (
                              <td key={i} className="p-5 text-right whitespace-nowrap">
                                <span className="block font-black text-slate-800 text-base">{formatBRL(consumoValor)}</span>
                                <span className="block text-xs font-bold text-blue-600 mt-0.5">{fmtQtd(consumoQtd)} {produto.unidade}</span>
                                <span className="block text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
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