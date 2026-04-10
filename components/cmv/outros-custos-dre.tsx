"use client"

import { useState, useEffect } from "react"
import { ReceiptText, CheckCircle2, Package, Trash2, Box } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface OutrosCustasProps {
  data: any
  dataInicio: string
  dataFim: string
  onChange: () => void
}

const OUTROS_CAMPOS = [
  { key: "embalagens", label: "Embalagens", desc: "Caixas, sacos, etc.", icon: Box },
  { key: "materialLimpeza", label: "Material de Limpeza", desc: "Detergente, cloro, etc.", icon: Package },
  { key: "desperdicios", label: "Desperdícios", desc: "Queimas, erros (que não são insumos)", icon: Trash2 },
]

export function OutrosCustosDRE({ data, dataInicio, dataFim, onChange }: OutrosCustasProps) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    setValores({
      embalagens: String(data.outrosCustos.embalagens || ""),
      materialLimpeza: String(data.outrosCustos.materialLimpeza || ""),
      desperdicios: String(data.outrosCustos.desperdicios || "")
    })
  }, [data.outrosCustos])

  const handleSalvar = async () => {
    setSalvando(true)
    
    // Atualiza apenas os campos desta tela, preservando o faturamento e os consumos antigos se houver
    const payload = {
      data_inicio: dataInicio,
      data_fim: dataFim,
      embalagens: parseFloat(valores.embalagens.replace(",", ".")) || 0,
      material_limpeza: parseFloat(valores.materialLimpeza.replace(",", ".")) || 0,
      desperdicios: parseFloat(valores.desperdicios.replace(",", ".")) || 0
    }

    const { data: fData } = await supabase.from('financas_semanais').select('id').eq('data_inicio', dataInicio).eq('data_fim', dataFim).maybeSingle()

    let error;
    if (fData) {
      const res = await supabase.from('financas_semanais').update(payload).eq('id', fData.id)
      error = res.error
    } else {
      const res = await supabase.from('financas_semanais').insert([payload])
      error = res.error
    }

    if (!error) {
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
      onChange()
    } else {
      alert("Erro ao salvar: " + error.message)
    }
    setSalvando(false)
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Custos Operacionais (DRE)</h2>
        <p className="text-muted-foreground text-base">Registe apenas despesas com materiais não comestíveis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {OUTROS_CAMPOS.map(({ key, label, desc, icon: Icon }) => (
          <div key={key} className="bg-card rounded-2xl border-2 p-5 shadow-sm hover:border-[#C0392B]/50 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-muted rounded-xl text-muted-foreground"><Icon className="w-6 h-6" /></div>
              <div><h4 className="font-bold text-foreground">{label}</h4><p className="text-xs text-muted-foreground">{desc}</p></div>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">R$</span>
              <input 
                type="number" min="0" step="0.01" placeholder="0,00"
                value={valores[key] || ""}
                onChange={(e) => setValores({ ...valores, [key]: e.target.value })}
                className="w-full text-xl font-bold pl-12 pr-4 py-3 rounded-xl border-2 bg-background focus:border-[#C0392B] outline-none" 
              />
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50">
        <button onClick={handleSalvar} disabled={salvando} className={`flex items-center justify-center gap-3 text-xl font-extrabold py-5 px-8 rounded-2xl shadow-2xl w-full max-w-lg transition-all ${salvo ? "bg-[#1E6B43] text-white" : "bg-[#C0392B] text-white hover:bg-[#9B2B1F]"}`}>
          {salvando ? "A Guardar..." : salvo ? <><CheckCircle2 className="w-7 h-7" /> Salvo com Sucesso!</> : <><ReceiptText className="w-7 h-7" /> Guardar Custos</>}
        </button>
      </div>
    </div>
  )
}