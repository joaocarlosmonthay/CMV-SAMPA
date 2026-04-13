"use client"

import { ArrowDownRight, ArrowUpRight, DollarSign, Package, PackageMinus, PackagePlus, Percent, ReceiptText, TrendingDown, TrendingUp, ChevronRight, AlertTriangle, Info, ChefHat, Salad, HandPlatter } from "lucide-react"

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// COMPONENTES DE CARD SUBSTITUTOS (Para não depender de instação extra)
const Card = ({ children, className }: any) => <div className={`bg-white rounded-3xl ${className}`}>{children}</div>
const CardHeader = ({ children, className }: any) => <div className={`p-6 ${className}`}>{children}</div>
const CardTitle = ({ children, className }: any) => <h3 className={`font-semibold leading-none tracking-tight ${className}`}>{children}</h3>
const CardContent = ({ children, className }: any) => <div className={`p-6 pt-0 ${className}`}>{children}</div>

interface DashboardProps {
  dataInicio: string
  dataFim: string
  lancamentos: any
  contagemInicial: Record<number, { qtd: string; valor: string }>
  contagemFinal: Record<number, { qtd: string; valor: string }>
  produtos: any[]
  precosReferencia: Record<string, number>
  onChangeFaturamento?: () => void
}

export function Dashboard({ dataInicio, dataFim, lancamentos, contagemInicial, contagemFinal, produtos, precosReferencia }: DashboardProps) {
  
  // 1. Cálculos de Estoque
  let valorInicial = 0
  Object.values(contagemInicial).forEach((item) => {
    const qtd = parseFloat(item.qtd) || 0; const val = parseFloat(item.valor) || 0;
    valorInicial += (qtd * val)
  })

  let valorFinal = 0
  Object.values(contagemFinal).forEach((item) => {
    const qtd = parseFloat(item.qtd) || 0; const val = parseFloat(item.valor) || 0;
    valorFinal += (qtd * val)
  })

  // 2. Cálculos de Compras
  let comprasInsumos = 0
  if (lancamentos.compras) {
    lancamentos.compras.forEach((c: any) => { comprasInsumos += (c.quantidade * c.valorUnitario) })
  }

  // 3. CÁLCULO DE ABATIMENTOS
  let abatimentos = 0
  let custoDRETotal = (lancamentos.outrosCustos?.embalagens || 0) + (lancamentos.outrosCustos?.materialLimpeza || 0)

  if (lancamentos.saidas) {
    lancamentos.saidas.forEach((s: any) => {
      const prodEncontrado = produtos.find(p => p.nome === s.produto)
      const pId = prodEncontrado ? prodEncontrado.id : null

      let preco = 0

      if (pId && precosReferencia[String(pId)]) {
        preco = precosReferencia[String(pId)]
      } else if (pId && contagemInicial[pId] && parseFloat(contagemInicial[pId].valor) > 0) {
        preco = parseFloat(contagemInicial[pId].valor)
      } else if (lancamentos.compras) {
          const compraDesseProd = lancamentos.compras.find((c:any) => c.produto === s.produto)
          if(compraDesseProd) preco = compraDesseProd.valorUnitario
      }

      const valorAbatido = s.quantidade * preco

      if (s.motivo !== "Desperdício / Vencido") {
        abatimentos += valorAbatido
        if (s.motivo === "Teste / Marketing") custoDRETotal += valorAbatido
      }
    })
  }

  // 4. Cálculos Finais de CMV
  const fat = lancamentos.faturamento || 0
  const totalDisponivel = valorInicial + comprasInsumos
  const consumoRealBruto = totalDisponivel - valorFinal
  const consumoRealLiquido = consumoRealBruto - abatimentos

  const cmvPercentual = fat > 0 ? (consumoRealLiquido / fat) * 100 : 0
  
  const metaCMV = 29.0
  const cmvBom = cmvPercentual > 0 && cmvPercentual <= metaCMV

  const topProdutos = [...(lancamentos.compras || [])].sort((a, b) => (b.quantidade * b.valorUnitario) - (a.quantidade * a.valorUnitario)).slice(0, 5)

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-6 rounded-3xl border shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#1E3A8A]/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none"></div>
        <div>
          <h1 className="text-3xl font-black text-[#1E3A8A] tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground mt-1 font-medium flex items-center gap-2">
            Análise Financeira • {dataInicio.split('-').reverse().join('/')} a {dataFim.split('-').reverse().join('/')}
          </p>
        </div>
        <div className="bg-slate-50 px-6 py-4 rounded-2xl border-2 shadow-inner min-w-[200px]">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">Faturamento Bruto</span>
          <span className="text-3xl font-black text-green-600">{formatBRL(fat)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-3xl border-0 shadow-md bg-gradient-to-br from-[#1E3A8A] to-blue-800 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-20"><Percent className="w-24 h-24" /></div>
          <CardHeader className="pb-2 relative z-10"><CardTitle className="text-sm font-bold text-blue-200 uppercase tracking-wider">Índice CMV Real</CardTitle></CardHeader>
          <CardContent className="relative z-10">
            <div className="text-5xl font-black mb-2 flex items-baseline gap-1">{cmvPercentual.toFixed(2)}<span className="text-2xl text-blue-300">%</span></div>
            <div className="flex items-center gap-2 text-sm font-bold bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm">
              {fat === 0 ? (<><AlertTriangle className="w-4 h-4 text-amber-300" /> <span className="text-amber-100">Falta Faturamento</span></>) : 
               cmvBom ? (<><TrendingDown className="w-4 h-4 text-emerald-400" /> <span className="text-emerald-100">Abaixo da Meta ({metaCMV}%)</span></>) : 
               (<><TrendingUp className="w-4 h-4 text-red-400" /> <span className="text-red-100">Acima da Meta ({metaCMV}%)</span></>)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><ChefHat className="w-4 h-4 text-orange-500" /> Consumo Real</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-800">{formatBRL(consumoRealLiquido)}</div><p className="text-xs text-muted-foreground mt-2 font-medium flex items-center gap-1"><Info className="w-3 h-3"/> Custo líquido dos insumos vendidos</p></CardContent></Card>
        <Card className="rounded-3xl border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><PackageMinus className="w-4 h-4 text-amber-500" /> Abatimentos</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-800">{formatBRL(abatimentos)}</div><p className="text-xs text-muted-foreground mt-2 font-medium flex items-center gap-1"><Info className="w-3 h-3"/> Lanches, sócios e etc.</p></CardContent></Card>
        <Card className="rounded-3xl border-2 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><ReceiptText className="w-4 h-4 text-rose-500" /> Outros Custos DRE</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-800">{formatBRL(custoDRETotal)}</div><p className="text-xs text-muted-foreground mt-2 font-medium flex items-center gap-1"><Info className="w-3 h-3"/> Embalagens e Limpeza</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 rounded-3xl border-2 shadow-sm">
          <CardHeader className="border-b bg-slate-50/50 rounded-t-3xl pb-4">
            <CardTitle className="flex items-center gap-3 text-xl font-black text-slate-800"><DollarSign className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg w-8 h-8" /> Movimentação de Estoque</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border"><div className="flex items-center gap-4"><div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><PackagePlus className="w-6 h-6" /></div><div><p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Estoque Inicial</p><p className="text-2xl font-black text-slate-800">{formatBRL(valorInicial)}</p></div></div></div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-100"><div className="flex items-center gap-4"><div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><ArrowDownRight className="w-6 h-6" /></div><div><p className="text-sm font-bold text-emerald-800/70 uppercase tracking-wider">Compras na Semana</p><p className="text-2xl font-black text-emerald-700">+{formatBRL(comprasInsumos)}</p></div></div></div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-100"><div className="flex items-center gap-4"><div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><ArrowUpRight className="w-6 h-6" /></div><div><p className="text-sm font-bold text-amber-800/70 uppercase tracking-wider">Estoque Final (Sobrou)</p><p className="text-2xl font-black text-amber-700">-{formatBRL(valorFinal)}</p></div></div></div>
            </div>
            <div className="mt-6 pt-6 border-t-2 border-dashed flex items-center justify-between">
              <span className="text-lg font-black text-slate-500 uppercase">Consumo Bruto</span>
              <span className="text-3xl font-black text-slate-800">{formatBRL(consumoRealBruto)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-2 shadow-sm flex flex-col">
          <CardHeader className="border-b bg-slate-50/50 rounded-t-3xl pb-4">
            <CardTitle className="flex items-center gap-3 text-xl font-black text-slate-800"><Salad className="p-1.5 bg-orange-100 text-orange-600 rounded-lg w-8 h-8" /> Top Compras</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {topProdutos.length > 0 ? (
              <ul className="divide-y flex-1">
                {topProdutos.map((p, i) => (
                  <li key={i} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3"><span className="text-lg font-black text-slate-300 w-5">{i + 1}</span><div><p className="font-bold text-slate-700">{p.produto}</p><p className="text-xs font-semibold text-muted-foreground">{p.quantidade} itens</p></div></div>
                    <span className="font-black text-orange-600">{formatBRL(p.quantidade * p.valorUnitario)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <HandPlatter className="w-12 h-12 mb-3 opacity-20" />
                <p className="font-medium">Nenhuma compra registada esta semana.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}