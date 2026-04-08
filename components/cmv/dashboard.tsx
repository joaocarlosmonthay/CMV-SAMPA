"use client"

import { useState } from "react"
import { TrendingUp, ShoppingCart, BarChart2, PackageOpen, Box, Droplets, Trash2, Package, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Layers, PenLine } from "lucide-react"
import type { LancamentosData } from "./lancamentos"
import type { ContagemEstoque } from "./estoque"
import type { Produto } from "./cadastros"
import { supabase } from "@/lib/supabase"

const META_CMV = 29

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const ACOES_CMV = [
  "Pese tudo ao receber: verifique se o fornecedor entregou o peso correto.",
  "Atenção às validades para evitar desperdício de insumos.",
  "Controle as porções: use balança na montagem de cada pizza.",
  "Negocie com fornecedores: compare preços semanalmente.",
  "Registre perdas e quebras na tela de Outros Custos (Desperdícios).",
]

const OUTROS_CAMPOS: { key: keyof LancamentosData["outrosCustos"]; label: string; icon: React.ElementType }[] = [
  { key: "embalagens", label: "Embalagens", icon: Box },
  { key: "consumoInterno", label: "Consumo Interno", icon: Droplets },
  { key: "testeMkt", label: "Teste / Mkt", icon: Package },
  { key: "materialLimpeza", label: "Material de Limpeza", icon: Package },
  { key: "desperdicios", label: "Desperdícios", icon: Trash2 },
]

interface DashboardProps {
  dataInicio: string
  dataFim: string
  lancamentos: LancamentosData
  contagemInicial: ContagemEstoque
  contagemFinal: ContagemEstoque
  produtos: Produto[]
  precosReferencia: Record<string, number> // Recebe os preços históricos!
  onChangeFaturamento: (faturamento: number) => void
}

// O MOTOR MATEMÁTICO ATUALIZADO
function calcularCustoContagem(contagem: ContagemEstoque, produtos: Produto[], compras: LancamentosData["compras"], precosReferencia: Record<string, number>): number {
  let total = 0
  for (const p of produtos) {
    const qtd = parseFloat(contagem[Number(p.id)] ?? "0") || 0
    if (qtd === 0) continue
    
    // Tenta encontrar o preço desta semana
    const comprasDoProduto = compras.filter((c) => c.produto === p.nome)
    
    // Se comprou esta semana faz a média, SENÃO, vai buscar o último preço conhecido na base de dados
    const custoUnitario = comprasDoProduto.length > 0 
      ? comprasDoProduto.reduce((s, c) => s + c.valorUnitario, 0) / comprasDoProduto.length 
      : (precosReferencia[p.id] || 0) // <--- O SEGREDO ESTÁ AQUI

    total += qtd * custoUnitario
  }
  return total
}

export function Dashboard({ dataInicio, dataFim, lancamentos, contagemInicial, contagemFinal, produtos, precosReferencia, onChangeFaturamento }: DashboardProps) {
  const [acoesAberto, setAcoesAberto] = useState(false)
  const [fatInput, setFatInput] = useState<string>(lancamentos.faturamento > 0 ? String(lancamentos.faturamento) : "")
  const [fatSalvo, setFatSalvo] = useState(lancamentos.faturamento > 0)
  const [salvandoFat, setSalvandoFat] = useState(false)

  const { faturamento, compras, outrosCustos } = lancamentos
  const totalCompras = compras.reduce((a, c) => a + c.valorTotal, 0)

  const handleSalvarFaturamento = async () => {
    const val = parseFloat(fatInput.replace(",", ".")) || 0
    if (val <= 0) return
    setSalvandoFat(true)

    await supabase.from('financas_semanais').delete().eq('data_inicio', dataInicio).eq('data_fim', dataFim)

    const { error } = await supabase.from('financas_semanais').insert([{
      data_inicio: dataInicio,
      data_fim: dataFim,
      faturamento: val,
      embalagens: outrosCustos.embalagens,
      consumo_interno: outrosCustos.consumoInterno,
      teste_mkt: outrosCustos.testeMkt,
      material_limpeza: outrosCustos.materialLimpeza,
      desperdicios: outrosCustos.desperdicios
    }])

    if (error) {
      alert("Erro ao gravar: " + error.message)
    } else {
      onChangeFaturamento(val)
      setFatSalvo(true)
    }
    setSalvandoFat(false)
  }

  // Usamos os preços de referência nos dois cálculos de estoque
  const custoInicial = calcularCustoContagem(contagemInicial, produtos, compras, precosReferencia)
  const custoFinal = calcularCustoContagem(contagemFinal, produtos, compras, precosReferencia)
  
  const cmvReais = custoInicial + totalCompras - custoFinal
  const cmvPct = faturamento > 0 ? ((cmvReais / faturamento) * 100).toFixed(1) : null
  const cmvNum = cmvPct ? parseFloat(cmvPct) : null
  const abaixoDaMeta = cmvNum !== null && cmvNum < META_CMV
  const totalOutros = Object.values(outrosCustos).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Dashboard — Resumo da Semana</h2>
        <p className="text-muted-foreground text-base">Analisando de {dataInicio.split('-').reverse().join('/')} até {dataFim.split('-').reverse().join('/')}</p>
      </div>

      {/* Registar Faturamento */}
      <div className="bg-card rounded-2xl border-2 border-[#C0392B]/40 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#C0392B]/10"><PenLine className="w-6 h-6 text-[#C0392B]" /></div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Registar Faturamento da Semana (R$)</h3>
            <p className="text-sm text-muted-foreground">Necessário para calcular o CMV%</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">R$</span>
            <input
              type="number" min="0" step="0.01" value={fatInput}
              onChange={(e) => { setFatInput(e.target.value); setFatSalvo(false) }}
              placeholder="0,00"
              className="w-full text-2xl font-extrabold pl-14 pr-4 py-4 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={handleSalvarFaturamento}
            disabled={!fatInput || parseFloat(fatInput) <= 0 || salvandoFat}
            className={`flex items-center justify-center gap-2 text-lg font-bold py-4 px-8 rounded-xl text-white transition-all whitespace-nowrap ${salvandoFat ? "bg-muted-foreground cursor-not-allowed" : fatSalvo ? "bg-[#1E6B43]" : "bg-[#C0392B] hover:bg-[#9B2B1F]"}`}
          >
            {salvandoFat ? <span>A Guardar...</span> : fatSalvo ? <><CheckCircle2 className="w-5 h-5" /> Salvo!</> : <><TrendingUp className="w-5 h-5" /> Salvar Faturamento</>}
          </button>
        </div>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-[#C0392B]/10"><TrendingUp className="w-7 h-7 text-[#C0392B]" /></div><span className="text-lg font-semibold text-muted-foreground">Faturamento</span></div>
          <p className="text-4xl font-extrabold text-foreground">{faturamento > 0 ? formatBRL(faturamento) : <span className="text-muted-foreground text-2xl">Não lançado</span>}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-orange-100"><Layers className="w-7 h-7 text-orange-600" /></div><span className="text-lg font-semibold text-muted-foreground">Est. Inicial</span></div>
          <p className="text-4xl font-extrabold text-foreground">{formatBRL(custoInicial)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-blue-100"><ShoppingCart className="w-7 h-7 text-blue-600" /></div><span className="text-lg font-semibold text-muted-foreground">Compras</span></div>
          <p className="text-4xl font-extrabold text-foreground">{formatBRL(totalCompras)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-purple-100"><PackageOpen className="w-7 h-7 text-purple-600" /></div><span className="text-lg font-semibold text-muted-foreground">Est. Final</span></div>
          <p className="text-4xl font-extrabold text-foreground">{formatBRL(custoFinal)}</p>
        </div>

        <div className={`rounded-2xl border p-6 flex flex-col gap-3 shadow-sm sm:col-span-2 xl:col-span-2 ${abaixoDaMeta ? "bg-[#1E6B43]/5 border-[#1E6B43]/30" : cmvNum !== null ? "bg-[#C0392B]/5 border-[#C0392B]/30" : "bg-card border-border"}`}>
          <div className="flex items-center gap-3"><div className={`p-3 rounded-xl ${abaixoDaMeta ? "bg-[#1E6B43]/15" : "bg-[#C0392B]/15"}`}><BarChart2 className={`w-7 h-7 ${abaixoDaMeta ? "text-[#1E6B43]" : "text-[#C0392B]"}`} /></div><span className="text-lg font-semibold text-muted-foreground">CMV% Atual</span></div>
          {cmvPct !== null ? (
            <><p className={`text-6xl font-extrabold ${abaixoDaMeta ? "text-[#1E6B43]" : "text-[#C0392B]"}`}>{cmvPct}%</p>
            <span className={`text-sm font-bold px-3 py-1.5 rounded-full text-white self-start ${abaixoDaMeta ? "bg-[#1E6B43]" : "bg-[#C0392B]"}`}>{abaixoDaMeta ? "Abaixo da meta de 29%" : "Acima da meta de 29%"}</span></>
          ) : (<div className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="w-5 h-5 text-orange-500" /><span>Lance o faturamento e estoques</span></div>)}
        </div>
      </div>
    </div>
  )
}