"use client"

import React, { useState } from "react"
import { TrendingUp, ShoppingCart, BarChart2, PackageOpen, AlertTriangle, CheckCircle2, Layers, PenLine, Lock, Unlock } from "lucide-react"
import { supabase } from "@/lib/supabase"

const META_CMV = 29
const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export function Dashboard({ dataInicio, dataFim, lancamentos, contagemInicial, contagemFinal, produtos, precosReferencia, onChangeFaturamento }: any) {
  const [fatInput, setFatInput] = useState<string>(lancamentos.faturamento > 0 ? String(lancamentos.faturamento) : "")
  const [fatSalvo, setFatSalvo] = useState(lancamentos.faturamento > 0)
  const [salvandoFat, setSalvandoFat] = useState(false)
  const [trancado, setTrancado] = useState(lancamentos.faturamento > 0)

  const { faturamento, compras, outrosCustos } = lancamentos
  const totalCompras = compras.reduce((a: any, c: any) => a + c.valorTotal, 0)

  const handleSalvarFaturamento = async () => {
    const val = parseFloat(fatInput.replace(",", ".")) || 0
    if (val <= 0) return
    setSalvandoFat(true)
    await supabase.from('financas_semanais').delete().eq('data_inicio', dataInicio).eq('data_fim', dataFim)
    const { error } = await supabase.from('financas_semanais').insert([{
      data_inicio: dataInicio, data_fim: dataFim, faturamento: val, embalagens: outrosCustos.embalagens, consumo_interno: outrosCustos.consumoInterno, consumo_socios: outrosCustos.consumoSocios, teste_mkt: outrosCustos.testeMkt, material_limpeza: outrosCustos.materialLimpeza, desperdicios: outrosCustos.desperdicios
    }])
    if (!error) { onChangeFaturamento(val); setFatSalvo(true); setTrancado(true); }
    setSalvandoFat(false)
  }

  // Lógica matemática
  const calcularCusto = (contagem: any) => {
    return produtos.reduce((total: number, p: any) => {
      const qtd = parseFloat(contagem[p.id] ?? "0") || 0
      if (qtd === 0) return total
      const comprasDoProduto = compras.filter((c: any) => c.produto === p.nome)
      const custoUnitario = comprasDoProduto.length > 0 ? comprasDoProduto.reduce((s: number, c: any) => s + c.valorUnitario, 0) / comprasDoProduto.length : (precosReferencia[p.id] || 0)
      return total + (qtd * custoUnitario)
    }, 0)
  }

  const custoInicial = calcularCusto(contagemInicial)
  const custoFinal = calcularCusto(contagemFinal)
  
  // A MATEMÁTICA DO TIO TIAGO AQUI:
  const custoGastoBruto = custoInicial + totalCompras - custoFinal;
  
  // Subtrair o que NÃO foi vendido (para não culpar o CMV da cozinha)
  const deduzirDoCMV = 
    (outrosCustos.consumoInterno || 0) + 
    (outrosCustos.consumoSocios || 0) + 
    (outrosCustos.testeMkt || 0) + 
    (outrosCustos.desperdicios || 0);

  const cmvReais = custoGastoBruto - deduzirDoCMV;
  const cmvPct = faturamento > 0 ? ((cmvReais / faturamento) * 100).toFixed(1) : null;
  const abaixoDaMeta = cmvPct !== null && parseFloat(cmvPct) < META_CMV;

  return (
    <div className="space-y-8 pb-20">
      <div><h2 className="text-2xl font-bold text-foreground mb-1">Dashboard — Resumo da Semana</h2><p className="text-muted-foreground text-base">Analisando de {dataInicio.split('-').reverse().join('/')} até {dataFim.split('-').reverse().join('/')}</p></div>

      <div className="bg-card rounded-2xl border-2 border-[#C0392B]/40 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#C0392B]/10"><PenLine className="w-6 h-6 text-[#C0392B]" /></div>
            <div><h3 className="text-lg font-bold text-foreground">Registar Faturamento da Semana (R$)</h3></div>
          </div>
          <button onClick={() => setTrancado(!trancado)} className="p-3 rounded-full bg-muted hover:bg-border transition-colors">
            {trancado ? <Lock className="w-6 h-6 text-[#C0392B]" /> : <Unlock className="w-6 h-6 text-[#1E6B43]" />}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">R$</span>
            <input type="number" min="0" step="0.01" value={fatInput} onChange={(e) => { setFatInput(e.target.value); setFatSalvo(false) }} disabled={trancado} placeholder="0,00" className="w-full text-2xl font-extrabold pl-14 pr-4 py-4 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors disabled:opacity-50 disabled:bg-muted" />
          </div>
          {!trancado && (
            <button onClick={handleSalvarFaturamento} disabled={!fatInput || parseFloat(fatInput) <= 0 || salvandoFat} className="flex items-center justify-center gap-2 text-lg font-bold py-4 px-8 rounded-xl text-white bg-[#C0392B] hover:bg-[#9B2B1F] transition-all whitespace-nowrap">
              {salvandoFat ? "A Guardar..." : "Salvar Faturamento"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        <div className="bg-card rounded-2xl border p-6 flex flex-col gap-3 shadow-sm"><div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-[#C0392B]/10"><TrendingUp className="w-7 h-7 text-[#C0392B]" /></div><span className="text-lg font-semibold text-muted-foreground">Faturamento</span></div><p className="text-4xl font-extrabold">{faturamento > 0 ? formatBRL(faturamento) : <span className="text-muted-foreground text-2xl">Não lançado</span>}</p></div>
        <div className="bg-card rounded-2xl border p-6 flex flex-col gap-3 shadow-sm"><div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-orange-100"><Layers className="w-7 h-7 text-orange-600" /></div><span className="text-lg font-semibold text-muted-foreground">Est. Inicial</span></div><p className="text-4xl font-extrabold">{formatBRL(custoInicial)}</p></div>
        <div className="bg-card rounded-2xl border p-6 flex flex-col gap-3 shadow-sm"><div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-blue-100"><ShoppingCart className="w-7 h-7 text-blue-600" /></div><span className="text-lg font-semibold text-muted-foreground">Compras</span></div><p className="text-4xl font-extrabold">{formatBRL(totalCompras)}</p></div>
        <div className="bg-card rounded-2xl border p-6 flex flex-col gap-3 shadow-sm"><div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-purple-100"><PackageOpen className="w-7 h-7 text-purple-600" /></div><span className="text-lg font-semibold text-muted-foreground">Est. Final</span></div><p className="text-4xl font-extrabold">{formatBRL(custoFinal)}</p></div>
        
        {/* Mostrando os Abatimentos do CMV */}
        <div className="bg-card rounded-2xl border p-6 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-gray-100"><AlertTriangle className="w-7 h-7 text-gray-600" /></div><span className="text-lg font-semibold text-muted-foreground">Abatimentos (Não vendidos)</span></div>
          <p className="text-4xl font-extrabold text-gray-700">{formatBRL(deduzirDoCMV)}</p>
          <span className="text-xs text-muted-foreground">Sócios + Funcionários + Desperdício + Mkt</span>
        </div>

        <div className={`rounded-2xl border p-6 flex flex-col gap-3 shadow-sm sm:col-span-2 xl:col-span-3 ${abaixoDaMeta ? "bg-[#1E6B43]/5 border-[#1E6B43]/30" : cmvPct !== null ? "bg-[#C0392B]/5 border-[#C0392B]/30" : "bg-card border-border"}`}>
          <div className="flex items-center gap-3"><div className={`p-3 rounded-xl ${abaixoDaMeta ? "bg-[#1E6B43]/15" : "bg-[#C0392B]/15"}`}><BarChart2 className={`w-7 h-7 ${abaixoDaMeta ? "text-[#1E6B43]" : "text-[#C0392B]"}`} /></div><span className="text-lg font-semibold text-muted-foreground">CMV% Real da Cozinha</span></div>
          {cmvPct !== null ? (<><p className={`text-6xl font-extrabold ${abaixoDaMeta ? "text-[#1E6B43]" : "text-[#C0392B]"}`}>{cmvPct}%</p><span className={`text-sm font-bold px-3 py-1.5 rounded-full text-white self-start ${abaixoDaMeta ? "bg-[#1E6B43]" : "bg-[#C0392B]"}`}>{abaixoDaMeta ? "Abaixo da meta" : "Acima da meta"}</span></>) : (<div className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="w-5 h-5 text-orange-500" /><span>Lance o faturamento e estoques</span></div>)}
        </div>
      </div>
    </div>
  )
}