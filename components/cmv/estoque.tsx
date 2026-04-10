"use client"

import { useState, useEffect } from "react"
import { ClipboardCheck, CheckCircle2, Package, ShoppingCart, ArrowUpRight, DollarSign, Trash2 } from "lucide-react"
import type { Produto } from "./cadastros"
import { supabase } from "@/lib/supabase"

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

interface EstoqueProps {
  dataInicio: string
  dataFim: string
  produtos: Produto[]
  data: any
  contagemInicial: Record<number, { qtd: string; valor: string }>
  contagemFinal: Record<number, { qtd: string; valor: string }>
  onChange: () => void
  onSemanaFechada: () => void
}

export function Estoque({ dataInicio, dataFim, produtos, data, contagemInicial, contagemFinal, onChange, onSemanaFechada }: EstoqueProps) {
  const [aba, setAba] = useState<"inicial" | "compras" | "saidas" | "faturamento" | "final">("inicial")
  const [contagem, setContagem] = useState<Record<number, { qtd: string; valor: string }>>({})
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [importando, setImportando] = useState(false)

  const [compraProd, setCompraProd] = useState("")
  const [compraQtd, setCompraQtd] = useState("")
  const [compraValor, setCompraValor] = useState("")

  const [saidaProd, setSaidaProd] = useState("")
  const [saidaQtd, setSaidaQtd] = useState("")
  const [saidaMotivo, setSaidaMotivo] = useState("")

  const [faturamentoInput, setFaturamentoInput] = useState("")

  const gruposDinamicos = Array.from(new Set(produtos.map((p) => p.grupo))).sort()

  useEffect(() => {
    if (aba === "inicial") setContagem(contagemInicial || {})
    else if (aba === "final") setContagem(contagemFinal || {})
    else if (aba === "faturamento") setFaturamentoInput(String(data.faturamento || ""))
  }, [aba, contagemInicial, contagemFinal, data.faturamento])

  const handleContagemChange = (id: number, campo: "qtd" | "valor", val: string) => {
    setContagem((prev) => ({
      ...prev,
      [id]: { ...prev[id], qtd: campo === "qtd" ? val : prev[id]?.qtd || "", valor: campo === "valor" ? val : prev[id]?.valor || "0" }
    }))
  }

  const handleSalvarEstoque = async () => {
    setSalvando(true)
    const tipo = aba === "inicial" ? "Inicial" : "Final"
    const itensParaSalvar = Object.entries(contagem)
      .filter(([id, val]) => val.qtd !== "" && parseFloat(val.qtd) >= 0)
      .map(([id, val]) => ({
        produto_id: parseInt(id), tipo_contagem: tipo, quantidade: parseFloat(val.qtd.replace(",", ".")), valor_unitario: val.valor ? parseFloat(val.valor.replace(",", ".")) : 0, data_contagem: tipo === "Inicial" ? dataInicio : dataFim
      }))

    if (itensParaSalvar.length === 0) { alert("Preencha pelo menos um item!"); setSalvando(false); return }

    await supabase.from('estoques').delete().eq('tipo_contagem', tipo).gte('data_contagem', dataInicio).lte('data_contagem', dataFim)
    const { error } = await supabase.from('estoques').insert(itensParaSalvar)
    
    if (error) { alert("Erro: " + error.message); setSalvando(false); return }

    setSalvo(true); setTimeout(() => setSalvo(false), 2000); setSalvando(false); onChange()
    if (aba === "final") onSemanaFechada()
  }

  const handlePuxarAnterior = async () => {
    const { data: eData } = await supabase.from('estoques').select('*').eq('tipo_contagem', 'Final').lt('data_contagem', dataInicio).order('data_contagem', { ascending: false })
    if (eData && eData.length > 0) {
      const ultimaData = eData[0].data_contagem
      const heranca: any = {}
      eData.filter(d => d.data_contagem === ultimaData).forEach(item => { heranca[item.produto_id] = { qtd: item.quantidade.toString(), valor: item.valor_unitario ? item.valor_unitario.toString() : "0" } })
      setContagem(heranca)
      alert("✅ Estoque final puxado com sucesso!")
    } else { alert("❌ Nenhum estoque anterior encontrado.") }
  }

  // ============================================================================
  // IMPORTADOR DE CSV PARA ESTOQUE INICIAL
  // ============================================================================
  const handleImportarCSVEstoqueInicial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportando(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const delimitador = text.includes(';') ? ';' : ','
        const rows = text.split('\n').map(row => row.split(delimitador))

        const headers = rows[0].map(h => h.trim().replace(/"/g, ''))
        const prodIdx = headers.indexOf('produto_id')
        const qtdIdx = headers.indexOf('quantidade')
        const valorIdx = headers.indexOf('valor_unitario')
        const tipoIdx = headers.indexOf('tipo_contagem')

        if (prodIdx === -1 || qtdIdx === -1) {
          alert("❌ CSV inválido! Faltam as colunas produto_id e quantidade.")
          setImportando(false); return
        }

        const novaContagem: Record<number, { qtd: string; valor: string }> = { ...contagem }
        let importados = 0

        for (let i = 1; i < rows.length; i++) {
          if (!rows[i] || rows[i].length < 2) continue

          const tipo = tipoIdx !== -1 ? rows[i][tipoIdx]?.replace(/"/g, '') : 'Inicial'
          // Se tiver a coluna tipo e não for Inicial, ignora
          if (tipoIdx !== -1 && tipo !== 'Inicial') continue

          const pId = parseInt(rows[i][prodIdx]?.replace(/"/g, ''))
          const qtd = parseFloat(rows[i][qtdIdx]?.replace(/"/g, ''))
          const vu = valorIdx !== -1 ? parseFloat(rows[i][valorIdx]?.replace(/"/g, '')) : 0

          if (!isNaN(pId) && !isNaN(qtd)) {
            novaContagem[pId] = {
              qtd: qtd.toString(),
              valor: isNaN(vu) || vu === 0 ? "" : vu.toString()
            }
            importados++
          }
        }

        if (importados === 0) {
           alert("Nenhuma contagem 'Inicial' encontrada neste arquivo.")
        } else {
           setContagem(novaContagem)
           alert(`✅ Sucesso! ${importados} produtos foram preenchidos no Estoque Inicial. Confira os números e clique em "Guardar" para salvar!`)
        }
      } catch (error: any) {
        alert("Erro ao importar: " + error.message)
      } finally {
        setImportando(false)
        e.target.value = '' 
      }
    }
    reader.readAsText(file)
  }

  // ============================================================================
  // IMPORTADOR DE CSV PARA O ESTOQUE FINAL
  // ============================================================================
  const handleImportarCSVEstoqueFinal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportando(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const delimitador = text.includes(';') ? ';' : ','
        const rows = text.split('\n').map(row => row.split(delimitador))

        const headers = rows[0].map(h => h.trim().replace(/"/g, ''))
        const prodIdx = headers.indexOf('produto_id')
        const qtdIdx = headers.indexOf('quantidade')
        const valorIdx = headers.indexOf('valor_unitario')
        const tipoIdx = headers.indexOf('tipo_contagem')

        if (prodIdx === -1 || qtdIdx === -1) {
          alert("❌ CSV inválido! Faltam as colunas produto_id e quantidade.")
          setImportando(false); return
        }

        const novaContagem: Record<number, { qtd: string; valor: string }> = { ...contagem }
        let importados = 0

        for (let i = 1; i < rows.length; i++) {
          if (!rows[i] || rows[i].length < 2) continue

          const tipo = tipoIdx !== -1 ? rows[i][tipoIdx]?.replace(/"/g, '') : 'Final'
          if (tipo !== 'Final') continue

          const pId = parseInt(rows[i][prodIdx]?.replace(/"/g, ''))
          const qtd = parseFloat(rows[i][qtdIdx]?.replace(/"/g, ''))
          const vu = valorIdx !== -1 ? parseFloat(rows[i][valorIdx]?.replace(/"/g, '')) : 0

          if (!isNaN(pId) && !isNaN(qtd)) {
            novaContagem[pId] = {
              qtd: qtd.toString(),
              valor: isNaN(vu) || vu === 0 ? "" : vu.toString()
            }
            importados++
          }
        }

        if (importados === 0) {
           alert("Nenhuma contagem 'Final' encontrada neste arquivo.")
        } else {
           setContagem(novaContagem)
           alert(`✅ Sucesso! ${importados} produtos foram preenchidos na tela. Confira os números e clique em "Fechar Semana" para salvar!`)
        }
      } catch (error: any) {
        alert("Erro ao importar: " + error.message)
      } finally {
        setImportando(false)
        e.target.value = '' 
      }
    }
    reader.readAsText(file)
  }

  // ============================================================================
  // IMPORTADOR DE CSV PARA COMPRAS
  // ============================================================================
  const handleImportarCSVCompras = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportando(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const delimitador = text.includes(';') ? ';' : ','
        const rows = text.split('\n').map(row => row.split(delimitador))

        const headers = rows[0].map(h => h.trim().replace(/"/g, ''))
        const prodIdx = headers.indexOf('produto_id')
        const qtdIdx = headers.indexOf('quantidade')
        const valIdx = headers.indexOf('valor_unitario')

        if (prodIdx === -1 || qtdIdx === -1 || valIdx === -1) {
          alert("❌ CSV inválido! Faltam colunas: produto_id, quantidade ou valor_unitario")
          setImportando(false); return
        }

        const comprasParaInserir = []
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i] || rows[i].length < 3) continue
          const pId = parseInt(rows[i][prodIdx]?.replace(/"/g, ''))
          const qtd = parseFloat(rows[i][qtdIdx]?.replace(/"/g, ''))
          const vu = parseFloat(rows[i][valIdx]?.replace(/"/g, ''))

          if (!isNaN(pId) && !isNaN(qtd) && !isNaN(vu)) {
            comprasParaInserir.push({ produto_id: pId, quantidade: qtd, valor_unitario: vu, data_compra: dataInicio })
          }
        }

        if (comprasParaInserir.length === 0) { alert("Nenhuma compra encontrada."); setImportando(false); return }

        const { error } = await supabase.from('compras').insert(comprasParaInserir)
        if (error) throw error

        alert(`✅ Sucesso! ${comprasParaInserir.length} compras foram importadas.`)
        onChange()
      } catch (error: any) { alert("Erro ao importar: " + error.message) } 
      finally { setImportando(false); e.target.value = '' }
    }
    reader.readAsText(file)
  }

  const handleRegistrarCompra = async () => {
    const qtd = parseFloat(compraQtd.replace(",", ".")) || 0
    const vu = parseFloat(compraValor.replace(",", ".")) || 0
    if (!compraProd || qtd <= 0 || vu <= 0) return
    setSalvando(true)
    const { error } = await supabase.from('compras').insert([{ produto_id: parseInt(compraProd), quantidade: qtd, valor_unitario: vu, data_compra: dataInicio }])
    if (error) alert("Erro: " + error.message)
    else { setCompraProd(""); setCompraQtd(""); setCompraValor(""); onChange() }
    setSalvando(false)
  }

  const handleDeletarRegistro = async (tabela: string, id: number) => {
    if (!window.confirm("Apagar este registro?")) return
    await supabase.from(tabela).delete().eq('id', id); onChange()
  }

  const handleRegistrarSaida = async () => {
    const qtd = parseFloat(saidaQtd.replace(",", ".")) || 0
    if (!saidaProd || qtd <= 0 || !saidaMotivo) return
    setSalvando(true)
    const { error } = await supabase.from('saidas_avulsas').insert([{ produto_id: parseInt(saidaProd), quantidade: qtd, motivo: saidaMotivo, data_saida: dataInicio }])
    if (error) alert("Erro: " + error.message)
    else { setSaidaProd(""); setSaidaQtd(""); setSaidaMotivo(""); onChange() }
    setSalvando(false)
  }

  const handleSalvarFaturamento = async () => {
    setSalvando(true)
    const fat = parseFloat(faturamentoInput.replace(",", ".")) || 0
    const { data: fData } = await supabase.from('financas_semanais').select('id').eq('data_inicio', dataInicio).eq('data_fim', dataFim).maybeSingle()
    let error;
    if (fData) { const res = await supabase.from('financas_semanais').update({ faturamento: fat }).eq('id', fData.id); error = res.error } 
    else { const res = await supabase.from('financas_semanais').insert([{ data_inicio: dataInicio, data_fim: dataFim, faturamento: fat }]); error = res.error }

    if (error) alert("Erro: " + error.message)
    else { setSalvo(true); setTimeout(() => setSalvo(false), 2000); onChange() }
    setSalvando(false)
  }

  return (
    <div className="pb-36 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-[#1E3A8A] mb-1">Painel da Semana</h2>
        <p className="text-muted-foreground text-base">Siga os passos para um fechamento de CMV perfeito.</p>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
        {[
          { id: "inicial", label: "Estoque Inicial", icon: Package, color: "bg-[#2563EB]" },
          { id: "compras", label: "Compras", icon: ShoppingCart, color: "bg-emerald-600" },
          { id: "saidas", label: "Saídas Avulsas", icon: ArrowUpRight, color: "bg-amber-500" },
          { id: "faturamento", label: "Faturamento", icon: DollarSign, color: "bg-green-600" },
          { id: "final", label: "Estoque Final", icon: ClipboardCheck, color: "bg-[#FACC15]" }
        ].map(item => (
          <button key={item.id} onClick={() => setAba(item.id as any)} className={`flex items-center gap-2 px-5 py-3.5 rounded-xl font-bold whitespace-nowrap transition-all border-2 ${aba === item.id ? `${item.color} text-white border-transparent shadow-md scale-105` : "bg-card text-muted-foreground border-border hover:bg-muted"}`}>
            <item.icon className={`w-5 h-5 ${aba === item.id && item.id === "final" ? "text-[#1E3A8A]" : ""}`} /> 
            <span className={aba === item.id && item.id === "final" ? "text-[#1E3A8A]" : ""}>{item.label}</span>
          </button>
        ))}
      </div>

      {(aba === "inicial" || aba === "final") && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm flex-wrap gap-4">
             <div><h3 className="font-bold text-lg text-foreground">{aba === "inicial" ? "1. Contagem Inicial" : "5. Fechamento Final"}</h3><p className="text-sm text-muted-foreground">{aba === "inicial" ? "Adicione os preços para corrigir o CMV." : "Conte o que sobrou. O sistema fará a matemática."}</p></div>
             
             <div className="flex flex-wrap gap-2">
               {aba === "inicial" && (<button onClick={handlePuxarAnterior} className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-bold text-sm hover:bg-blue-200 border border-blue-300 shadow-sm flex items-center gap-2 transition-all"><Package className="w-4 h-4"/> Puxar Anterior</button>)}
               
               {/* BOTÃO MÁGICO DE IMPORTAÇÃO PARA ESTOQUE INICIAL */}
               {aba === "inicial" && (
                 <div>
                   <input type="file" accept=".csv" id="csv-estoque-inicial" className="hidden" onChange={handleImportarCSVEstoqueInicial} disabled={importando} />
                   <label htmlFor="csv-estoque-inicial" className="cursor-pointer bg-[#2563EB] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-600 border border-blue-700 shadow-sm flex items-center gap-2 transition-all">
                      {importando ? "A ler..." : "📥 Importar CSV Inicial"}
                   </label>
                 </div>
               )}

               {/* BOTÃO MÁGICO DE IMPORTAÇÃO PARA ESTOQUE FINAL */}
               {aba === "final" && (
                 <div>
                   <input type="file" accept=".csv" id="csv-estoque-final" className="hidden" onChange={handleImportarCSVEstoqueFinal} disabled={importando} />
                   <label htmlFor="csv-estoque-final" className="cursor-pointer bg-[#FACC15] text-[#1E3A8A] px-4 py-2 rounded-lg font-bold text-sm hover:bg-yellow-400 border border-yellow-500 shadow-sm flex items-center gap-2 transition-all">
                      {importando ? "A ler..." : "📥 Importar CSV Final"}
                   </label>
                 </div>
               )}
             </div>
          </div>

          <div className="space-y-5">
            {gruposDinamicos.map((grupo) => {
              const lista = produtos.filter((p) => p.grupo === grupo)
              if (lista.length === 0) return null
              return (
                <div key={grupo} className="bg-card rounded-2xl border overflow-hidden shadow-sm">
                  <div className={`px-6 py-3 flex items-center gap-2 font-bold ${aba === "inicial" ? "bg-[#2563EB] text-white" : "bg-[#FACC15] text-[#1E3A8A]"}`}>{grupo}</div>
                  <ul className="divide-y divide-border">
                    {lista.map((produto) => (
                      <li key={produto.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-center px-5 py-4">
                        <div><span className="text-base font-semibold block">{produto.nome}</span><span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase">{produto.unidade}</span></div>
                        <div className="flex gap-3 mt-2 md:mt-0">
                          <div className="flex flex-col w-28"><label className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Quantidade</label><input type="number" min="0" step="0.001" value={contagem[Number(produto.id)]?.qtd || ""} onChange={(e) => handleContagemChange(Number(produto.id), "qtd", e.target.value)} placeholder="0" className="w-full text-lg font-black text-center p-2 rounded-xl border-2 bg-background focus:border-amber-400 outline-none text-[#1E3A8A]" /></div>
                          {aba === "inicial" && (<div className="flex flex-col w-32"><label className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Preço/Unit (R$)</label><input type="number" min="0" step="0.00001" value={contagem[Number(produto.id)]?.valor || ""} onChange={(e) => handleContagemChange(Number(produto.id), "valor", e.target.value)} placeholder="0,00" className="w-full text-base font-bold text-center p-2.5 rounded-xl border-2 bg-background focus:border-[#2563EB] outline-none" /></div>)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50">
            <button onClick={handleSalvarEstoque} disabled={salvando} className={`flex items-center justify-center gap-3 text-xl font-extrabold py-5 px-8 rounded-2xl shadow-2xl w-full max-w-lg ${salvo ? "bg-[#1E6B43] text-white" : aba === "inicial" ? "bg-[#2563EB] text-white" : "bg-[#FACC15] text-[#1E3A8A]"} ${salvando ? "opacity-70 cursor-not-allowed" : ""}`}>
              {salvando ? "A Guardar..." : salvo ? <><CheckCircle2 className="w-7 h-7" /> Salvo!</> : <><ClipboardCheck className="w-7 h-7" /> {aba === "inicial" ? "Guardar Estoque Inicial" : "Fechar Semana Automática"}</>}
            </button>
          </div>
        </div>
      )}

      {aba === "compras" && (
        <div className="space-y-6 animate-in fade-in duration-200">
           <div className="bg-card rounded-2xl border-2 border-emerald-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-emerald-800 flex items-center gap-2"><ShoppingCart /> Nova Compra</h3>
                <div>
                  <input type="file" accept=".csv" id="csv-compras" className="hidden" onChange={handleImportarCSVCompras} disabled={importando} />
                  <label htmlFor="csv-compras" className="cursor-pointer bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-200 border border-emerald-300 shadow-sm flex items-center gap-2 transition-all">
                     {importando ? "A ler..." : "📥 Importar CSV"}
                  </label>
                </div>
              </div>
              <div className="space-y-2"><label className="text-sm font-semibold">Produto</label><select value={compraProd} onChange={e => setCompraProd(e.target.value)} className="w-full text-base p-3 rounded-xl border-2 bg-background focus:border-emerald-500 outline-none"><option value="">Selecione...</option>{produtos.map(p => <option key={p.id} value={String(p.id)}>{p.nome} ({p.unidade})</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-semibold">Qtd (Ex: 2.500)</label><input type="number" step="0.001" value={compraQtd} onChange={e => setCompraQtd(e.target.value)} className="w-full text-lg p-3 rounded-xl border-2 focus:border-emerald-500 outline-none" /></div>
                <div className="space-y-2"><label className="text-sm font-semibold text-emerald-600">Valor Unitário (5 casas)</label><input type="number" step="0.00001" value={compraValor} onChange={e => setCompraValor(e.target.value)} className="w-full text-lg p-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none" /></div>
              </div>
              <button onClick={handleRegistrarCompra} disabled={salvando || !compraProd} className="w-full py-4 rounded-xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 disabled:opacity-50">Registar Compra</button>
           </div>
           {data.compras && data.compras.length > 0 && (
             <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
               <div className="px-5 py-3 bg-slate-50 border-b font-bold text-slate-700">Compras Lançadas</div>
               <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-muted-foreground text-left"><tr><th className="p-3">Produto</th><th className="p-3">Qtd</th><th className="p-3">Total</th><th className="p-3 text-center">Apagar</th></tr></thead><tbody className="divide-y">{data.compras.map((c: any) => (<tr key={c.id}><td className="p-3 font-semibold">{c.produto}</td><td className="p-3">{c.quantidade}</td><td className="p-3 font-bold text-emerald-700">{formatBRL(c.valorTotal)}</td><td className="p-3 text-center"><button onClick={() => handleDeletarRegistro('compras', c.id)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 className="w-4 h-4"/></button></td></tr>))}</tbody></table></div>
             </div>
           )}
        </div>
      )}

      {aba === "saidas" && (
        <div className="space-y-6 animate-in fade-in duration-200">
           <div className="bg-card rounded-2xl border-2 border-amber-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xl font-bold text-amber-800 flex items-center gap-2"><ArrowUpRight /> Registar Saída</h3>
              <p className="text-sm text-amber-700">Abata do CMV ingredientes usados para lanches, funcionários ou perdas.</p>
              <div className="space-y-2"><label className="text-sm font-semibold">Produto Subtraído</label><select value={saidaProd} onChange={e => setSaidaProd(e.target.value)} className="w-full text-base p-3 rounded-xl border-2 bg-background focus:border-amber-500 outline-none"><option value="">Selecione o ingrediente...</option>{produtos.map(p => <option key={p.id} value={String(p.id)}>{p.nome} ({p.unidade})</option>)}</select></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-semibold">Quantidade que saiu</label><input type="number" step="0.001" value={saidaQtd} onChange={e => setSaidaQtd(e.target.value)} className="w-full text-lg p-3 rounded-xl border-2 focus:border-amber-500 outline-none" /></div>
                <div className="space-y-2"><label className="text-sm font-semibold text-amber-800">Motivo da Saída</label><select value={saidaMotivo} onChange={e => setSaidaMotivo(e.target.value)} className="w-full text-lg p-3 rounded-xl border-2 border-amber-300 focus:border-amber-500 outline-none"><option value="">Qual o motivo?</option><option value="Prensadao (Lanches)">Prensadao (Lanches)</option><option value="Consumo Funcionários">Consumo Funcionários</option><option value="Consumo Sócios">Consumo Sócios</option><option value="Teste / Marketing">Teste / Marketing</option><option value="Desperdício / Vencido">Desperdício / Vencido</option></select></div>
              </div>
              <button onClick={handleRegistrarSaida} disabled={salvando || !saidaProd || !saidaMotivo} className="w-full py-4 rounded-xl bg-amber-500 text-white font-bold text-lg hover:bg-amber-600 disabled:opacity-50">Registar Saída</button>
           </div>
           {data.saidas && data.saidas.length > 0 && (
             <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
               <div className="px-5 py-3 bg-slate-50 border-b font-bold text-slate-700">Histórico de Saídas</div>
               <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-muted-foreground text-left"><tr><th className="p-3">Produto</th><th className="p-3">Qtd</th><th className="p-3">Motivo</th><th className="p-3 text-center">Apagar</th></tr></thead><tbody className="divide-y">{data.saidas.map((s: any) => (<tr key={s.id}><td className="p-3 font-semibold">{s.produto}</td><td className="p-3 text-red-600 font-bold">- {s.quantidade}</td><td className="p-3"><span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">{s.motivo}</span></td><td className="p-3 text-center"><button onClick={() => handleDeletarRegistro('saidas_avulsas', s.id)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 className="w-4 h-4"/></button></td></tr>))}</tbody></table></div>
             </div>
           )}
        </div>
      )}

      {aba === "faturamento" && (
        <div className="space-y-6 animate-in fade-in duration-200">
           <div className="bg-card rounded-2xl border-2 border-green-200 p-8 shadow-sm space-y-6 text-center max-w-md mx-auto mt-10">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><DollarSign className="w-10 h-10" /></div>
              <div><h3 className="text-2xl font-black text-green-800">Faturamento da Semana</h3><p className="text-sm text-green-700 mt-2">Introduza o valor total de vendas bruto.</p></div>
              <div className="relative"><span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-green-600/50">R$</span><input type="number" step="0.01" value={faturamentoInput} onChange={e => setFaturamentoInput(e.target.value)} placeholder="0.00" className="w-full text-4xl font-black text-center py-5 pl-12 pr-4 rounded-2xl border-4 border-green-100 focus:border-green-500 outline-none text-green-700" /></div>
              <button onClick={handleSalvarFaturamento} disabled={salvando} className="w-full py-5 rounded-2xl bg-green-600 text-white font-black text-xl hover:bg-green-700 shadow-xl shadow-green-600/20 disabled:opacity-50 transition-all">{salvo ? "Guardado!" : "Salvar Faturamento"}</button>
           </div>
        </div>
      )}

    </div>
  )
}