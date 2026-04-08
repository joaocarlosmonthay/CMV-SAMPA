"use client"

import { useState } from "react"
import { ShoppingCart, CheckCircle2, TrendingUp, PackageOpen, Box, Droplets, Trash2, Package } from "lucide-react"
import type { Produto } from "./cadastros"

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export interface OutrosCustos {
  embalagens: number
  consumoInterno: number
  testeMkt: number
  materialLimpeza: number
  desperdicios: number
}

export interface LancamentosData {
  faturamento: number
  compras: { id: number; produto: string; quantidade: number; valorUnitario: number; valorTotal: number }[]
  outrosCustos: OutrosCustos
}

interface LancamentosProps {
  produtos: Produto[]
  data: LancamentosData
  onChange: (data: LancamentosData) => void
}

type Aba = "faturamento" | "compras" | "outros"

const OUTROS_CAMPOS: { key: keyof OutrosCustos; label: string; icon: React.ElementType }[] = [
  { key: "embalagens", label: "Embalagens", icon: Box },
  { key: "consumoInterno", label: "Consumo Interno", icon: Droplets },
  { key: "testeMkt", label: "Teste / Mkt", icon: Package },
  { key: "materialLimpeza", label: "Material de Limpeza", icon: Package },
  { key: "desperdicios", label: "Desperdícios", icon: Trash2 },
]

export function Lancamentos({ produtos, data, onChange }: LancamentosProps) {
  const [aba, setAba] = useState<Aba>("faturamento")
  const [faturamentoInput, setFaturamentoInput] = useState<string>(
    data.faturamento > 0 ? String(data.faturamento) : ""
  )
  const [faturamentoSalvo, setFaturamentoSalvo] = useState(data.faturamento > 0)

  // Aba Compras
  const [produtoId, setProdutoId] = useState<string>("")
  const [quantidade, setQuantidade] = useState<string>("")
  const [valorUnitario, setValorUnitario] = useState<string>("")
  const [compraSalva, setCompraSalva] = useState(false)

  const qtd = parseFloat(quantidade) || 0
  const vu = parseFloat(valorUnitario.replace(",", ".")) || 0
  const valorTotal = qtd * vu
  const produtoSelecionado = produtos.find((p) => String(p.id) === produtoId)

  const handleSalvarFaturamento = () => {
    const val = parseFloat(faturamentoInput.replace(",", ".")) || 0
    onChange({ ...data, faturamento: val })
    setFaturamentoSalvo(true)
  }

  const handleRegistrarCompra = () => {
    if (!produtoSelecionado || qtd <= 0 || vu <= 0) return
    const novaCompra = {
      id: Date.now(),
      produto: produtoSelecionado.nome,
      quantidade: qtd,
      valorUnitario: vu,
      valorTotal,
    }
    onChange({ ...data, compras: [novaCompra, ...data.compras] })
    setProdutoId("")
    setQuantidade("")
    setValorUnitario("")
    setCompraSalva(true)
    setTimeout(() => setCompraSalva(false), 2000)
  }

  const handleOutrosCustos = (key: keyof OutrosCustos, val: string) => {
    onChange({
      ...data,
      outrosCustos: {
        ...data.outrosCustos,
        [key]: parseFloat(val.replace(",", ".")) || 0,
      },
    })
  }

  const totalOutros = Object.values(data.outrosCustos).reduce((a, b) => a + b, 0)
  const totalCompras = data.compras.reduce((a, c) => a + c.valorTotal, 0)

  const abas: { id: Aba; label: string; icon: React.ElementType }[] = [
    { id: "faturamento", label: "Faturamento", icon: TrendingUp },
    { id: "compras", label: "Compras", icon: ShoppingCart },
    { id: "outros", label: "Outros Custos", icon: PackageOpen },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Lançamentos da Semana</h2>
        <p className="text-muted-foreground text-base">Registre faturamento, compras e outros custos</p>
      </div>

      {/* Abas */}
      <div className="grid grid-cols-3 gap-2 bg-muted p-1.5 rounded-2xl">
        {abas.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${
              aba === id
                ? "bg-[#C0392B] text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-background"
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{id === "faturamento" ? "Fat." : id === "compras" ? "Compras" : "Outros"}</span>
          </button>
        ))}
      </div>

      {/* ABA: FATURAMENTO */}
      {aba === "faturamento" && (
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-[#C0392B]/10">
              <TrendingUp className="w-7 h-7 text-[#C0392B]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Faturamento da Semana</h3>
              <p className="text-sm text-muted-foreground">Necessário para calcular o CMV%</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-lg font-semibold text-foreground block">
              Faturamento da Semana (R$)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={faturamentoInput}
                onChange={(e) => { setFaturamentoInput(e.target.value); setFaturamentoSalvo(false) }}
                placeholder="0,00"
                className="w-full text-3xl font-extrabold pl-14 pr-4 py-5 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleSalvarFaturamento}
            disabled={!faturamentoInput || parseFloat(faturamentoInput) <= 0}
            className="w-full flex items-center justify-center gap-3 text-xl font-bold py-4 px-6 rounded-xl bg-[#C0392B] text-white hover:bg-[#9B2B1F] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {faturamentoSalvo ? (
              <><CheckCircle2 className="w-6 h-6" /> Faturamento Salvo!</>
            ) : (
              <><TrendingUp className="w-6 h-6" /> Salvar Faturamento</>
            )}
          </button>

          {faturamentoSalvo && data.faturamento > 0 && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#1E6B43]/10 border border-[#1E6B43]/25">
              <span className="text-base font-semibold text-[#1E6B43]">Faturamento registrado</span>
              <span className="text-2xl font-extrabold text-[#1E6B43]">{formatBRL(data.faturamento)}</span>
            </div>
          )}
        </div>
      )}

      {/* ABA: COMPRAS */}
      {aba === "compras" && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5">
            <h3 className="text-xl font-bold text-foreground">Registrar Nova Compra</h3>

            <div className="space-y-2">
              <label className="text-base font-semibold text-foreground block">Produto</label>
              <select
                value={produtoId}
                onChange={(e) => setProdutoId(e.target.value)}
                className="w-full text-lg px-4 py-3.5 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="">Escolha o produto...</option>
                {produtos.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nome} ({p.unidade})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-base font-semibold text-foreground block">Quantidade Comprada</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="0"
                  className="w-full text-xl px-4 py-4 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-base font-semibold text-foreground block">Valor Unitário (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorUnitario}
                  onChange={(e) => setValorUnitario(e.target.value)}
                  placeholder="0,00"
                  className="w-full text-xl px-4 py-4 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border">
              <span className="text-base font-semibold text-muted-foreground">Valor Total (calculado)</span>
              <span className="text-2xl font-extrabold text-[#1E6B43]">{formatBRL(valorTotal)}</span>
            </div>

            <button
              onClick={handleRegistrarCompra}
              disabled={!produtoSelecionado || qtd <= 0 || vu <= 0}
              className="w-full flex items-center justify-center gap-3 text-xl font-bold py-4 px-6 rounded-xl bg-[#C0392B] text-white hover:bg-[#9B2B1F] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {compraSalva ? (
                <><CheckCircle2 className="w-6 h-6" /> Compra Registrada!</>
              ) : (
                <><ShoppingCart className="w-6 h-6" /> Registrar Compra</>
              )}
            </button>
          </div>

          {/* Histórico de compras */}
          {data.compras.length > 0 && (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-muted border-b border-border flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground">Compras Registradas</h3>
                <span className="text-base font-bold text-[#1E6B43]">{formatBRL(totalCompras)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-6 py-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">Produto</th>
                      <th className="text-right px-6 py-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">Qtd</th>
                      <th className="text-right px-6 py-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">V. Unit.</th>
                      <th className="text-right px-6 py-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">V. Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.compras.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 text-base font-semibold text-foreground">{c.produto}</td>
                        <td className="px-6 py-4 text-base text-right text-foreground">{c.quantidade}</td>
                        <td className="px-6 py-4 text-base text-right text-foreground">{formatBRL(c.valorUnitario)}</td>
                        <td className="px-6 py-4 text-base font-bold text-right text-[#1E6B43]">{formatBRL(c.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA: OUTROS CUSTOS (DRE) */}
      {aba === "outros" && (
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-xl font-bold text-foreground">Outros Custos (DRE)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Estes valores entram no DRE mas <strong>não</strong> compõem o CMV.
            </p>
          </div>

          <div className="space-y-4">
            {OUTROS_CAMPOS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-muted border border-border flex-shrink-0">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <label className="text-base font-semibold text-foreground w-48 flex-shrink-0">{label}</label>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.outrosCustos[key] > 0 ? data.outrosCustos[key] : ""}
                    onChange={(e) => handleOutrosCustos(key, e.target.value)}
                    placeholder="0,00"
                    className="w-full text-xl font-bold pl-10 pr-4 py-3.5 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border mt-2">
            <span className="text-base font-semibold text-muted-foreground">Total Outros Custos (DRE)</span>
            <span className="text-2xl font-extrabold text-foreground">{formatBRL(totalOutros)}</span>
          </div>
        </div>
      )}
    </div>
  )
}