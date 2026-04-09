"use client"

import { useState, useEffect } from "react"
import { ClipboardCheck, CheckCircle2, Package } from "lucide-react"
import type { Produto } from "./cadastros"
import { supabase } from "@/lib/supabase"

type TipoContagem = "inicial" | "final"
export type ContagemEstoque = Record<number, string>

interface EstoqueProps {
  dataInicio: string
  dataFim: string
  produtos: Produto[]
  contagemInicial: ContagemEstoque
  contagemFinal: ContagemEstoque
  onSalvarInicial: (c: ContagemEstoque) => void
  onSalvarFinal: (c: ContagemEstoque) => void
  onPuxarAnterior: () => Promise<boolean>
  onSemanaFechada?: () => void // <-- NOVA PROP PARA RESETAR A DATA
}

export function Estoque({ dataInicio, dataFim, produtos, contagemInicial, contagemFinal, onSalvarInicial, onSalvarFinal, onPuxarAnterior, onSemanaFechada }: EstoqueProps) {
  const [tipo, setTipo] = useState<TipoContagem>("inicial")
  const [contagem, setContagem] = useState<ContagemEstoque>(tipo === "inicial" ? { ...contagemInicial } : { ...contagemFinal })
  const [salvo, setSalvo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const gruposDinamicos = Array.from(new Set(produtos.map((p) => p.grupo))).sort()

  const handleTipoChange = (t: TipoContagem) => {
    setTipo(t)
    setSalvo(false)
    setContagem(t === "inicial" ? { ...contagemInicial } : { ...contagemFinal })
  }

  const handleChange = (id: number, val: string) => {
    setContagem((prev) => ({ ...prev, [id]: val }))
  }

  const handleSalvar = async () => {
    setSalvando(true)
    const itensParaSalvar = Object.entries(contagem)
      .filter(([id, val]) => val !== "" && parseFloat(val) >= 0)
      .map(([id, val]) => ({
        produto_id: parseInt(id),
        tipo_contagem: tipo === "inicial" ? "Inicial" : "Final",
        quantidade: parseFloat(val.replace(",", ".")),
        data_contagem: tipo === "inicial" ? dataInicio : dataFim
      }))

    if (itensParaSalvar.length === 0) {
      alert("Por favor, preencha pelo menos um item!")
      setSalvando(false)
      return
    }

    const { error } = await supabase.from('estoques').insert(itensParaSalvar)
    if (error) {
      alert("Erro ao guardar contagem na nuvem: " + error.message)
      setSalvando(false)
      return
    }

    if (tipo === "inicial") {
      onSalvarInicial({ ...contagem })
      setSalvando(false)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 3000)
    } else {
      // SE FOR A CONTAGEM FINAL, CHAMA A FUNÇÃO QUE ZERA AS DATAS!
      onSalvarFinal({ ...contagem })
      setSalvando(false)
      if (onSemanaFechada) onSemanaFechada()
    }
  }

  return (
    <div className="pb-36 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Contagem de Estoque</h2>
        <p className="text-muted-foreground text-base">Referente a {tipo === 'inicial' ? dataInicio : dataFim}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => handleTipoChange("inicial")} className={`flex flex-col items-center justify-center gap-1.5 py-5 px-4 rounded-2xl border-2 font-bold transition-all ${tipo === "inicial" ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-border bg-card"}`}>
          <ClipboardCheck className="w-7 h-7" /><span>Contagem Inicial</span>
        </button>
        <button onClick={() => handleTipoChange("final")} className={`flex flex-col items-center justify-center gap-1.5 py-5 px-4 rounded-2xl border-2 font-bold transition-all ${tipo === "final" ? "border-[#FACC15] bg-[#FACC15] text-[#1E3A8A]" : "border-border bg-card"}`}>
          <ClipboardCheck className="w-7 h-7" /><span>Contagem Final</span>
        </button>
      </div>

      {tipo === "inicial" && (
        <button
          onClick={async () => {
            const sucesso = await onPuxarAnterior()
            if (sucesso) {
                alert("Estoque inicial preenchido com o fechamento da semana passada! 🧀")
                handleTipoChange("inicial") 
            } else {
                alert("Não encontrámos nenhum stock final registado antes desta data.")
            }
          }}
          className="w-full mt-2 py-4 px-4 bg-amber-100 border-2 border-amber-300 text-amber-800 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-200 transition-all shadow-sm"
        >
          <Package className="w-5 h-5" /> Puxar quantidades do último fechamento
        </button>
      )}

      <div className="space-y-5">
        {gruposDinamicos.map((grupo) => {
          const lista = produtos.filter((p) => p.grupo === grupo)
          if (lista.length === 0) return null
          
          return (
            <div key={grupo} className="bg-card rounded-2xl border overflow-hidden shadow-sm">
              <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: tipo === "inicial" ? "#2563EB" : "#FACC15", color: tipo === "inicial" ? "#ffffff" : "#1E3A8A" }}>
                <h3 className="text-lg font-bold">{grupo}</h3>
              </div>
              <ul className="divide-y divide-border">
                {lista.map((produto) => (
                  <li key={produto.id} className="grid grid-cols-[1fr_72px_140px] gap-3 items-center px-5 py-4">
                    <span className="text-base font-semibold">{produto.nome}</span>
                    <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full text-center">{produto.unidade}</span>
                    <input type="number" min="0" step="0.001" value={contagem[Number(produto.id)] ?? ""} onChange={(e) => handleChange(Number(produto.id), e.target.value)} placeholder="0" className="w-full text-xl font-bold text-center px-3 py-3 rounded-xl border-2 bg-background focus:border-[#2563EB] outline-none transition-colors" />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50">
        <button onClick={handleSalvar} disabled={salvando} className={`flex items-center justify-center gap-3 text-xl font-extrabold py-5 px-8 rounded-2xl shadow-2xl w-full max-w-lg ${salvo ? "bg-[#FACC15] text-[#1E3A8A]" : tipo === "inicial" ? "bg-[#2563EB] text-white" : "bg-[#FACC15] text-[#1E3A8A]"} ${salvando ? "opacity-70 cursor-not-allowed" : ""}`}>
          {salvando ? <span>A Guardar...</span> : salvo ? <><CheckCircle2 className="w-7 h-7" /> Salvo!</> : <><ClipboardCheck className="w-7 h-7" /> Salvar Contagem</>}
        </button>
      </div>
    </div>
  )
}