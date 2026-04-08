"use client"

import { useState } from "react"
import { PlusCircle, CheckCircle2, Package } from "lucide-react"

const GRUPOS = ["Embalagens Pizza (CMV)", "Massas", "Laticínios", "Carnes", "Hortifruti"]
const UNIDADES = ["Kg", "Litro", "Unidade", "Pacote"]

export type Produto = {
  id: number
  nome: string
  grupo: string
  unidade: string
}

export const PRODUTOS_INICIAIS: Produto[] = [
  { id: 1, nome: "Queijo Mussarela", grupo: "Laticínios", unidade: "Kg" },
  { id: 2, nome: "Farinha de Trigo", grupo: "Massas", unidade: "Kg" },
  { id: 3, nome: "Tomate", grupo: "Hortifruti", unidade: "Kg" },
  { id: 4, nome: "Frango", grupo: "Carnes", unidade: "Kg" },
  { id: 5, nome: "Caixa de Pizza", grupo: "Embalagens Pizza (CMV)", unidade: "Unidade" },
  { id: 6, nome: "Saco para Pizza", grupo: "Embalagens Pizza (CMV)", unidade: "Unidade" },
]

interface CadastrosProps {
  produtos: Produto[]
  onAddProduto: (p: Produto) => void
}

export function Cadastros({ produtos, onAddProduto }: CadastrosProps) {
  const [nome, setNome] = useState("")
  const [grupo, setGrupo] = useState("")
  const [unidade, setUnidade] = useState("")
  const [saved, setSaved] = useState(false)

  const handleSalvar = () => {
    if (!nome.trim() || !grupo || !unidade) return
    onAddProduto({ id: Date.now(), nome: nome.trim(), grupo, unidade })
    setNome("")
    setGrupo("")
    setUnidade("")
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const byGroup = GRUPOS.reduce<Record<string, Produto[]>>((acc, g) => {
    acc[g] = produtos.filter((p) => p.grupo === g)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Cadastro de Produtos</h2>
        <p className="text-muted-foreground text-base">Adicione ingredientes ao banco de dados</p>
      </div>

      {/* Formulário */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5">
        <h3 className="text-xl font-bold text-foreground">Novo Produto</h3>

        <div className="space-y-2">
          <label className="text-base font-semibold text-foreground block">Nome do Produto</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Queijo Mussarela"
            className="w-full text-lg px-4 py-3.5 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-base font-semibold text-foreground block">Grupo</label>
            <select
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="w-full text-lg px-4 py-3.5 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="">Selecione o grupo</option>
              {GRUPOS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-base font-semibold text-foreground block">Unidade de Medida</label>
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="w-full text-lg px-4 py-3.5 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="">Selecione a unidade</option>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSalvar}
          disabled={!nome.trim() || !grupo || !unidade}
          className="w-full flex items-center justify-center gap-3 text-xl font-bold py-4 px-6 rounded-xl bg-[#C0392B] text-white hover:bg-[#9B2B1F] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saved ? (
            <><CheckCircle2 className="w-6 h-6" /> Produto Salvo!</>
          ) : (
            <><PlusCircle className="w-6 h-6" /> Salvar Produto</>
          )}
        </button>
      </div>

      {/* Lista de produtos por grupo */}
      <div className="space-y-6">
        {GRUPOS.map((g) => {
          const lista = byGroup[g]
          if (!lista || lista.length === 0) return null
          return (
            <div key={g} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-muted border-b border-border flex items-center gap-2">
                <Package className="w-5 h-5 text-[#C0392B]" />
                <h4 className="text-lg font-bold text-foreground">{g}</h4>
                <span className="ml-auto text-sm font-medium text-muted-foreground bg-background px-2.5 py-0.5 rounded-full border border-border">
                  {lista.length} {lista.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {lista.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-6 py-4">
                    <span className="text-base font-semibold text-foreground">{p.nome}</span>
                    <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      {p.unidade}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
