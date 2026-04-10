"use client"

import { TrendingDown, TrendingUp, DollarSign, Package, ShoppingCart, AlertTriangle, Calculator } from "lucide-react"

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export function Dashboard({ dataInicio, dataFim, lancamentos, contagemInicial, contagemFinal, produtos, precosReferencia }: any) {
  // 1. Faturamento (Agora puxado automaticamente lá da Central)
  const faturamento = lancamentos?.faturamento || 0

  // 2. Compras
  const totalCompras = lancamentos?.compras?.reduce((acc: number, c: any) => acc + (c.valorTotal || (c.quantidade * c.valorUnitario)), 0) || 0

  // 3. Abatimentos (Custos DRE + As Novas Saídas Avulsas do Prensadao)
  const totalCustosDRE = (lancamentos?.outrosCustos?.embalagens || 0) +
                         (lancamentos?.outrosCustos?.materialLimpeza || 0) +
                         (lancamentos?.outrosCustos?.desperdicios || 0)

  // O sistema é inteligente: ele pega a quantidade da saída e multiplica pelo preço salvo no banco
  const totalSaidasAvulsas = lancamentos?.saidas?.reduce((acc: number, s: any) => {
     // Puxa o ID do produto usando o nome, para encontrar o preço de referência
     const prod = produtos?.find((p: any) => p.nome === s.produto)
     const preco = prod ? (precosReferencia[prod.id] || 0) : 0
     return acc + (s.quantidade * preco)
  }, 0) || 0

  const totalAbatimentos = totalCustosDRE + totalSaidasAvulsas

  // 4. Estoques (Lidando com a nova Mágica do Valor Unitário)
  const calcularValorEstoque = (contagem: any) => {
    let total = 0
    if (!contagem) return 0
    
    Object.entries(contagem).forEach(([id, data]: [string, any]) => {
      let qtd = 0;
      let valor = 0;
      
      // Checa se é a estrutura nova { qtd, valor } ou a antiga (só número)
      if (typeof data === 'object' && data !== null) {
        qtd = parseFloat(data.qtd?.toString().replace(",", ".") || "0")
        valor = parseFloat(data.valor?.toString().replace(",", ".") || "0")
      } else {
        qtd = parseFloat(data?.toString().replace(",", ".") || "0")
      }
      
      // Se o valor estiver zerado (ex: estoque final que o sistema calcula sozinho), ele usa o preço de referência/última compra
      if (valor === 0) valor = precosReferencia[id] || 0
      
      total += qtd * valor
    })
    return total
  }

  const totalInicial = calcularValorEstoque(contagemInicial)
  const totalFinal = calcularValorEstoque(contagemFinal)

  // 5. Matemática Sagrada do CMV
  const consumoReal = (totalInicial + totalCompras) - totalFinal - totalAbatimentos
  const cmvPercentual = faturamento > 0 ? (consumoReal / faturamento) * 100 : 0

  // Configuração dos Cards
  const cards = [
    { title: "Faturamento", value: faturamento, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100", desc: "Vendas totais da semana" },
    { title: "Est. Inicial", value: totalInicial, icon: Package, color: "text-orange-600", bg: "bg-orange-100", desc: "O que tínhamos no início" },
    { title: "Compras", value: totalCompras, icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-100", desc: "Tudo o que entrou" },
    { title: "Est. Final", value: totalFinal, icon: Package, color: "text-purple-600", bg: "bg-purple-100", desc: "O que sobrou no fim" },
    { title: "Abatimentos", value: totalAbatimentos, icon: AlertTriangle, color: "text-slate-600", bg: "bg-slate-100", desc: "Saídas Avulsas + Custos DRE" },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
       
       {/* HEADER */}
       <div>
          <h2 className="text-3xl font-black text-[#1E3A8A]">Visão Geral da Semana</h2>
       </div>

       {/* GRIDS DE CARDS */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((c, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
               <div className="flex items-center gap-3 mb-4">
                 <div className={`p-3 rounded-xl ${c.bg} ${c.color}`}><c.icon className="w-6 h-6" /></div>
                 <span className="font-bold text-slate-700 text-lg">{c.title}</span>
               </div>
               <div className="text-3xl font-black text-slate-800">
                 {c.value === 0 && c.title === "Faturamento" ? (
                   <span className="text-xl text-slate-400">Não lançado</span>
                 ) : (
                   formatBRL(c.value)
                 )}
               </div>
               <p className="text-xs text-muted-foreground mt-2 font-medium uppercase tracking-wider">{c.desc}</p>
            </div>
          ))}
       </div>

       {/* MEGA CARD DO CMV */}
       <div className={`mt-8 p-8 rounded-3xl border-4 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-8 transition-colors ${cmvPercentual > 35 ? 'bg-red-50 border-red-200' : cmvPercentual > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center gap-6 text-center lg:text-left flex-col lg:flex-row">
            <div className={`p-6 rounded-full shadow-inner ${cmvPercentual > 35 ? 'bg-red-200 text-red-700' : cmvPercentual > 0 ? 'bg-emerald-200 text-emerald-700' : 'bg-blue-200 text-blue-700'}`}>
               <Calculator className="w-12 h-12" />
            </div>
            <div>
               <h3 className="text-2xl font-black text-slate-800 uppercase tracking-wider">Custo da Mercadoria (CMV)</h3>
               <p className="text-sm font-bold text-slate-500 mt-1 bg-white/50 px-3 py-1 rounded-full inline-block">Fórmula: (Inicial + Compras) - Final - Abatimentos</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-8 text-center lg:text-right bg-white p-6 rounded-2xl shadow-sm border">
             <div>
                <span className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Consumo Real</span>
                <span className="text-3xl font-black text-slate-800">{formatBRL(consumoReal)}</span>
             </div>
             <div className="h-16 w-1 bg-slate-200 hidden sm:block"></div>
             <div className="w-full h-1 bg-slate-200 sm:hidden"></div>
             <div>
                <span className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Índice</span>
                <span className={`text-5xl font-black ${cmvPercentual > 35 ? 'text-red-600' : cmvPercentual > 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                   {cmvPercentual.toFixed(2).replace(".", ",")}%
                </span>
             </div>
          </div>
       </div>

    </div>
  )
}