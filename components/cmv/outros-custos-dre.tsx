"use client"

import { useState } from "react"
import { Box, Droplets, Trash2, Package, CheckCircle2, AlertTriangle } from "lucide-react"
import type { LancamentosData, OutrosCustos } from "./lancamentos"

// 1. Importação do Supabase
import { supabase } from "@/lib/supabase"

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const OUTROS_CAMPOS: { key: keyof OutrosCustos; label: string; sublabel?: string; icon: React.ElementType }[] = [
  { key: "embalagens", label: "Outras Embalagens", sublabel: "Excl. caixas/sacos de pizza", icon: Box },
  { key: "consumoInterno", label: "Consumo Interno", icon: Droplets },
  { key: "testeMkt", label: "Teste / Mkt", icon: Package },
  { key: "materialLimpeza", label: "Material de Limpeza", icon: Package },
  { key: "desperdicios", label: "Desperdícios", icon: Trash2 },
]

interface OutrosCustasDREProps {
  data: LancamentosData
  onChange: (data: LancamentosData) => void
}

export function OutrosCustasDRE({ data, onChange }: OutrosCustasDREProps) {
  const [salvo, setSalvo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const handleChange = (key: keyof OutrosCustos, val: string) => {
    setSalvo(false)
    onChange({
      ...data,
      outrosCustos: {
        ...data.outrosCustos,
        [key]: parseFloat(val.replace(",", ".")) || 0,
      },
    })
  }

  // ==========================================
  // 2. FUNÇÃO QUE SALVA O DRE NO SUPABASE
  // ==========================================
  const handleSalvar = async () => {
    setSalvando(true)

    // Pega a data de hoje para preencher as datas obrigatórias da tabela
    const dataHoje = new Date().toISOString().split('T')[0]

    // Envia os dados para a tabela 'financas_semanais'
    const { error } = await supabase
      .from('financas_semanais')
      .insert([
        {
          data_inicio: dataHoje,
          data_fim: dataHoje,
          embalagens: data.outrosCustos.embalagens || 0,
          consumo_interno: data.outrosCustos.consumoInterno || 0,
          teste_mkt: data.outrosCustos.testeMkt || 0,
          material_limpeza: data.outrosCustos.materialLimpeza || 0,
          desperdicios: data.outrosCustos.desperdicios || 0
        }
      ])

    if (error) {
      alert("Erro ao gravar custos na base de dados: " + error.message)
      setSalvando(false)
      return
    }

    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 3000)
  }

  const totalOutros = Object.values(data.outrosCustos).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Outros Custos (DRE)</h2>
        <p className="text-muted-foreground text-base">Custos operacionais da semana</p>
      </div>

      {/* Aviso de destaque */}
      <div className="flex items-start gap-4 p-5 rounded-2xl border-2 border-amber-400 bg-amber-50">
        <AlertTriangle className="w-7 h-7 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-base font-extrabold text-amber-800">
            Atenção: Estes gastos NÃO entram na conta do CMV.
          </p>
          <p className="text-sm text-amber-700 mt-1 leading-relaxed">
            Servem apenas para o controlo de caixa (DRE). O CMV é calculado exclusivamente com os ingredientes e <strong>embalagens de pizza</strong> lançados em <strong>Compras (CMV)</strong>.
          </p>
        </div>
      </div>

      {/* Campos */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-bold text-foreground">Registar Valores da Semana</h3>

        <div className="space-y-4">
          {OUTROS_CAMPOS.map(({ key, label, sublabel, icon: Icon }) => (
            <div key={key} className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-muted border border-border flex-shrink-0 hidden sm:block">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="w-40 sm:w-52 flex-shrink-0">
                <p className="text-base font-semibold text-foreground leading-tight">{label}</p>
                {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
              </div>
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
                  R$
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={data.outrosCustos[key] > 0 ? data.outrosCustos[key] : ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder="0,00"
                  className="w-full text-xl font-bold pl-12 pr-4 py-4 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border mt-2">
          <span className="text-base font-semibold text-muted-foreground">Total Outros Custos (DRE)</span>
          <span className="text-2xl font-extrabold text-foreground">{formatBRL(totalOutros)}</span>
        </div>

        {/* Botão */}
        <button
          onClick={handleSalvar}
          disabled={totalOutros === 0 || salvando}
          className={`w-full flex items-center justify-center gap-3 text-xl font-bold py-5 px-6 rounded-xl text-white active:scale-[0.98] transition-all max-w-2xl mx-auto ${
            salvando ? "bg-muted-foreground cursor-not-allowed" : 
            salvo ? "bg-[#1E6B43]" : "bg-[#1E6B43] hover:bg-[#155233]"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {salvando ? (
            <span>A Guardar na Nuvem...</span>
          ) : salvo ? (
            <><CheckCircle2 className="w-6 h-6" /> Custos Registados!</>
          ) : (
            <><CheckCircle2 className="w-6 h-6" /> Registar Custos Operacionais</>
          )}
        </button>
      </div>
    </div>
  )
}