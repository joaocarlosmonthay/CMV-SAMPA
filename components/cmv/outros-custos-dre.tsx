"use client"

import { useState, useEffect } from "react"
import { Save, Receipt, Truck, Calculator, Package, Lock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "react-hot-toast"

const formatBRL = (v: number) => {
  if (isNaN(v) || v === null) return "R$ 0,00"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
const formatPerc = (v: number) => {
  if (isNaN(v) || v === null || !isFinite(v)) return "0.0%"
  return `${v.toFixed(1)}%`
}

export function OutrosCustosDRE({ data, dataInicio, dataFim, onChange, isReadOnly }: any) {
  // A FUNÇÃO BLINDADA: Lê com segurança ou retorna "0"
  const getVal = (val: any) => val ? val.toString() : "0"
  
  const [embalagens, setEmbalagens] = useState("0")
  const [limpeza, setLimpeza] = useState("0")

  useEffect(() => {
    // Agora nunca mais crasha mesmo se o objeto inteiro for undefined
    if (data && data.outrosCustos) {
      setEmbalagens(getVal(data.outrosCustos.embalagens))
      setLimpeza(getVal(data.outrosCustos.materialLimpeza))
    } else {
      setEmbalagens("0")
      setLimpeza("0")
    }
  }, [data])

  const handleSalvar = async () => {
    if (isReadOnly) return toast.error("Este período já foi encerrado. Edições bloqueadas.")

    const valEmb = parseFloat(embalagens.replace(',', '.')) || 0
    const valLimp = parseFloat(limpeza.replace(',', '.')) || 0

    const { data: existente } = await supabase.from('financas_semanais').select('id').eq('data_inicio', dataInicio).maybeSingle()
    
    let error;
    if (existente) {
      const { error: err } = await supabase.from('financas_semanais').update({ embalagens: valEmb, material_limpeza: valLimp }).eq('id', existente.id)
      error = err;
    } else {
      const { error: err } = await supabase.from('financas_semanais').insert([{ data_inicio: dataInicio, data_fim: dataFim, embalagens: valEmb, material_limpeza: valLimp, faturamento: 0 }])
      error = err;
    }

    if (error) toast.error("Erro ao salvar custos.")
    else {
      toast.success("Custos atualizados com sucesso!")
      onChange()
    }
  }

  const fat = data?.faturamento || 0
  const vEmb = parseFloat(embalagens.replace(',', '.')) || 0
  const vLimp = parseFloat(limpeza.replace(',', '.')) || 0
  const totalCustos = vEmb + vLimp
  const percCustos = fat > 0 ? (totalCustos / fat) * 100 : 0

  return (
    <div className="space-y-6">
      
      {isReadOnly && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <Lock className="w-5 h-5"/>
          <p className="font-bold text-sm">MODO VISUALIZAÇÃO: Este período já foi encerrado e os dados estão protegidos contra alterações.</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Receipt className="w-6 h-6 text-blue-600"/> Outros Custos (DRE)</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Lançamento de custos operacionais paralelos ao CMV da semana.</p>
        </div>
        {!isReadOnly && (
          <button onClick={handleSalvar} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2 transition-all hover:scale-105">
            <Save className="w-4 h-4"/> Salvar Custos
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border shadow-sm space-y-6">
           <h3 className="font-black text-lg text-slate-800 border-b border-slate-100 pb-4">Despesas da Semana</h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Package className="w-3 h-3 text-amber-500"/> Embalagens (Caixas, sacolas)</label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">R$</span>
                   <input type="text" disabled={isReadOnly} value={embalagens} onChange={e => setEmbalagens(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500 disabled:opacity-60 disabled:cursor-not-allowed" />
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Truck className="w-3 h-3 text-emerald-500"/> Material de Limpeza</label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">R$</span>
                   <input type="text" disabled={isReadOnly} value={limpeza} onChange={e => setLimpeza(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed" />
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg flex flex-col justify-center">
           <p className="text-[10px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Calculator className="w-4 h-4"/> Impacto no Faturamento</p>
           
           <div className="space-y-4">
             <div className="flex justify-between items-center border-b border-white/10 pb-4">
               <span className="font-bold text-slate-300">Faturamento da Semana</span>
               <span className="font-black text-emerald-400">{formatBRL(fat)}</span>
             </div>
             <div className="flex justify-between items-center border-b border-white/10 pb-4">
               <span className="font-bold text-slate-300">Total Outros Custos</span>
               <span className="font-black text-red-400">{formatBRL(totalCustos)}</span>
             </div>
             <div className="flex justify-between items-center pt-2">
               <span className="text-xs font-black text-slate-400 uppercase">Impacto Final (%)</span>
               <span className="text-3xl font-black text-white">{formatPerc(percCustos)}</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  )
}