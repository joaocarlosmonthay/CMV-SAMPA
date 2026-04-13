"use client"

import { useState, useEffect } from "react"
import { ClipboardCheck, CheckCircle2, Package, ShoppingCart, ArrowUpRight, DollarSign, Trash2 } from "lucide-react"
import type { Produto } from "@/components/cmv/cadastros"
import { supabase } from "@/lib/supabase"
import { toast } from "react-hot-toast"

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export type ContagemEstoque = Record<number, { qtd: string; valor: string }>

interface EstoqueProps {
  dataInicio: string
  dataFim: string
  produtos: Produto[]
  data: any
  contagemInicial: ContagemEstoque
  contagemFinal: ContagemEstoque
  onChange: () => void
  onSemanaFechada: () => void
}

export function Estoque({ dataInicio, dataFim, produtos, data, contagemInicial, contagemFinal, onChange, onSemanaFechada }: EstoqueProps) {
  const [aba, setAba] = useState<"inicial" | "compras" | "saidas" | "faturamento" | "final">("inicial")
  const [contagem, setContagem] = useState<ContagemEstoque>({})
  const [salvando, setSalvando] = useState(false)
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

  const handlePuxarAnterior = async () => {
    const { data: eData } = await supabase.from('estoques').select('*').eq('tipo_contagem', 'Final').lt('data_contagem', dataInicio).order('data_contagem', { ascending: false })
    if (eData && eData.length > 0) {
      const ultimaData = eData[0].data_contagem
      const heranca: any = {}
      eData.filter(d => d.data_contagem === ultimaData).forEach(item => { heranca[item.produto_id] = { qtd: item.quantidade.toString(), valor: item.valor_unitario ? item.valor_unitario.toString() : "0" } })
      setContagem(heranca)
      toast.success("Massa! Estoque final anterior puxado com sucesso.")
    } else { 
      toast.error("Nenhum estoque anterior encontrado.") 
    }
  }

  const handleDeletarRegistro = async (tabela: string, id: number) => {
    if (!window.confirm("Certeza que quer apagar isso permanentemente?")) return
    const { error } = await supabase.from(tabela).delete().eq('id', id)
    if (error) {
        toast.error("Ih, não deu pra apagar: " + error.message)
    } else {
        toast.success("Apagado com sucesso!")
        onChange()
    }
  }

  const handleSalvarEstoque = async () => {
    setSalvando(true)
    const tipo = aba === "inicial" ? "Inicial" : "Final"
    const itensParaSalvar = Object.entries(contagem)
      .filter(([id, val]) => val.qtd !== "" && parseFloat(val.qtd) >= 0)
      .map(([id, val]) => ({
        produto_id: parseInt(id), tipo_contagem: tipo, quantidade: parseFloat(val.qtd.replace(",", ".")), valor_unitario: val.valor ? parseFloat(val.valor.replace(",", ".")) : 0, data_contagem: tipo === "Inicial" ? dataInicio : dataFim
      }))

    if (itensParaSalvar.length === 0) { 
        toast.error("Opa, lança pelo menos um produto na lista antes de salvar!")
        setSalvando(false)
        return 
    }

    await supabase.from('estoques').delete().eq('tipo_contagem', tipo).gte('data_contagem', dataInicio).lte('data_contagem', dataFim)
    const { error } = await supabase.from('estoques').insert(itensParaSalvar)
    
    if (error) { 
        toast.error("Deu ruim ao salvar: " + error.message)
        setSalvando(false)
        return 
    }

    toast.success(`${tipo === "Inicial" ? "Estoque Inicial" : "Fechamento de Estoque"} salvo com sucesso! 📦`)
    setSalvando(false)
    onChange()
    if (aba === "final") onSemanaFechada()
  }

  const handleImportarCSVEstoque = async (e: React.ChangeEvent<HTMLInputElement>, tipo: "Inicial" | "Final") => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const rows = text.split(/\r?\n/).map(row => row.split(text.includes(';') ? ';' : ','))
        const headers = rows[0].map(h => h.trim().replace(/"/g, ''))
        const pIdx = headers.indexOf('produto_id'); const qIdx = headers.indexOf('quantidade'); const vIdx = headers.indexOf('valor_unitario'); const tIdx = headers.indexOf('tipo_contagem')

        if (pIdx === -1 || qIdx === -1) { 
            toast.error("CSV inválido! Faltam as colunas produto_id e quantidade.")
            setImportando(false)
            return 
        }

        const novaContagem: ContagemEstoque = { ...contagem }
        let importados = 0
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i] || rows[i].length < 2) continue
          const tipoLinha = tIdx !== -1 ? rows[i][tIdx]?.replace(/"/g, '').trim() : tipo
          if (tIdx !== -1 && tipoLinha !== tipo) continue

          const pId = parseInt(rows[i][pIdx]?.replace(/"/g, '').trim())
          const qtd = parseFloat(rows[i][qIdx]?.replace(/"/g, '').trim())
          const vu = vIdx !== -1 ? parseFloat(rows[i][vIdx]?.replace(/"/g, '').trim()) : 0

          if (!isNaN(pId) && !isNaN(qtd)) { novaContagem[pId] = { qtd: qtd.toString(), valor: isNaN(vu) || vu === 0 ? "" : vu.toString() }; importados++ }
        }
        if (importados > 0) { 
            setContagem(novaContagem)
            toast.success(`Pronto! ${importados} produtos importados do CSV.`)
        } else {
            toast.error(`Nenhuma contagem do tipo '${tipo}' encontrada.`)
        }
      } catch (err: any) { toast.error("Ops, falha ao ler o arquivo: " + err.message) } finally { setImportando(false); e.target.value = '' }
    }
    reader.readAsText(file)
  }

  const handleImportarCSVCompras = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const rows = text.split(/\r?\n/).map(row => row.split(text.includes(';') ? ';' : ','))
        const headers = rows[0].map(h => h.trim().replace(/"/g, ''))
        const pIdx = headers.indexOf('produto_id'); const qIdx = headers.indexOf('quantidade'); const vIdx = headers.indexOf('valor_unitario')

        if (pIdx === -1 || qIdx === -1 || vIdx === -1) { 
            toast.error("CSV inválido! Faltam colunas de produto, qtd ou valor.")
            setImportando(false)
            return 
        }

        const comprasParaInserir = []
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i] || rows[i].length < 3) continue
          const pId = parseInt(rows[i][pIdx]?.replace(/"/g, '').trim())
          const qtd = parseFloat(rows[i][qIdx]?.replace(/"/g, '').trim())
          const vu = parseFloat(rows[i][vIdx]?.replace(/"/g, '').trim())
          if (!isNaN(pId) && !isNaN(qtd) && !isNaN(vu)) comprasParaInserir.push({ produto_id: pId, quantidade: qtd, valor_unitario: vu, data_compra: dataInicio })
        }
        if (comprasParaInserir.length > 0) { 
            await supabase.from('compras').insert(comprasParaInserir)
            toast.success(`Massa! ${comprasParaInserir.length} compras importadas.`)
            onChange() 
        } else {
            toast.error("Nenhuma compra válida encontrada no arquivo.")
        }
      } catch (err: any) { toast.error("Erro ao importar: " + err.message) } finally { setImportando(false); e.target.value = '' }
    }
    reader.readAsText(file)
  }

  const handleRegistrarCompra = async () => {
    const qtd = parseFloat(compraQtd.replace(",", ".")) || 0; const vu = parseFloat(compraValor.replace(",", ".")) || 0
    if (!compraProd || qtd <= 0 || vu <= 0) {
        toast.error("Preenche a quantidade e o valor direito aí!")
        return
    }
    setSalvando(true)
    const { error } = await supabase.from('compras').insert([{ produto_id: parseInt(compraProd), quantidade: qtd, valor_unitario: vu, data_compra: dataInicio }])
    if (error) { toast.error("Falha ao salvar a compra: " + error.message) } else {
        toast.success("Compra anotada! 🛒")
        setCompraProd(""); setCompraQtd(""); setCompraValor(""); onChange()
    }
    setSalvando(false)
  }

  const handleRegistrarSaida = async () => {
    const qtd = parseFloat(saidaQtd.replace(",", ".")) || 0
    if (!saidaProd || qtd <= 0 || !saidaMotivo) {
        toast.error("Preenche o produto, a quantidade e o motivo!")
        return
    }
    setSalvando(true)
    const { error } = await supabase.from('saidas_avulsas').insert([{ produto_id: parseInt(saidaProd), quantidade: qtd, motivo: saidaMotivo, data_saida: dataInicio }])
    if (error) { toast.error("Deu ruim na saída: " + error.message) } else {
        toast.success("Saída registrada! Seu CMV agradece.")
        setSaidaProd(""); setSaidaQtd(""); setSaidaMotivo(""); onChange()
    }
    setSalvando(false)
  }

  const handleSalvarFaturamento = async () => {
    setSalvando(true)
    const fat = parseFloat(faturamentoInput.replace(",", ".")) || 0
    const { data: fData } = await supabase.from('financas_semanais').select('id').eq('data_inicio', dataInicio).eq('data_fim', dataFim).maybeSingle()
    if (fData) await supabase.from('financas_semanais').update({ faturamento: fat }).eq('id', fData.id)
    else await supabase.from('financas_semanais').insert([{ data_inicio: dataInicio, data_fim: dataFim, faturamento: fat }])
    
    toast.success("Dinheiro na conta! Faturamento atualizado. 💸")
    setSalvando(false)
    onChange()
  }

  return (
    <div className="space-y-6">
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
           <div className="flex flex-wrap items-center justify-between bg-white p-6 rounded-2xl border shadow-sm gap-4">
              <div>
                 <h3 className="font-bold text-xl">{aba === "inicial" ? "1. Contagem Inicial" : "5. Contagem Final"}</h3>
                 <p className="text-slate-500 text-sm mt-1">{aba === "inicial" ? "Adicione os preços para corrigir o CMV." : "Conte o que sobrou. O sistema fará a matemática."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                 {aba === "inicial" && (
                     <button onClick={handlePuxarAnterior} className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-bold text-sm hover:bg-blue-200 border border-blue-300 shadow-sm flex items-center gap-2 transition-all">
                        <Package className="w-4 h-4"/> Puxar Anterior
                     </button>
                 )}
                 <div className="relative overflow-hidden">
                   <input type="file" accept=".csv" onChange={(e) => handleImportarCSVEstoque(e, aba === "inicial" ? "Inicial" : "Final")} className="absolute inset-0 opacity-0 cursor-pointer" />
                   <button className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 transition-all ${aba === "inicial" ? "bg-[#2563EB] text-white hover:bg-blue-600 border border-blue-700" : "bg-[#FACC15] text-[#1E3A8A] hover:bg-yellow-400 border border-yellow-500"}`}>
                       📥 Importar CSV {aba === "inicial" ? "Inicial" : "Final"}
                   </button>
                 </div>
              </div>
           </div>
           
           <div className="space-y-4">
             {gruposDinamicos.map(grupo => {
               const lista = produtos.filter((p) => p.grupo === grupo)
               if (lista.length === 0) return null
               return (
                   <div key={grupo} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                      <div className={`px-6 py-3 font-bold flex items-center gap-2 tracking-wide border-b ${aba === "inicial" ? "bg-[#2563EB] text-white" : "bg-[#FACC15] text-[#1E3A8A]"}`}>{grupo}</div>
                      <div className="divide-y">
                        {lista.map(p => (
                          <div key={p.id} className="p-4 flex flex-col md:flex-row md:justify-between md:items-center hover:bg-slate-50 transition-colors gap-3">
                            <div><span className="font-semibold text-slate-800 text-base">{p.nome}</span> <span className="text-xs text-slate-400 font-bold ml-1 uppercase bg-slate-100 px-2 py-0.5 rounded-full">{p.unidade}</span></div>
                            <div className="flex gap-3">
                               <div className="flex flex-col w-28"><label className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Quantidade</label><input type="number" step="0.001" min="0" value={contagem[p.id]?.qtd || ""} onChange={e => handleContagemChange(p.id, "qtd", e.target.value)} className="w-full p-2 border-2 rounded-xl text-center font-black focus:border-blue-500 outline-none text-[#1E3A8A] text-lg" placeholder="0" /></div>
                               {aba === "inicial" && <div className="flex flex-col w-32"><label className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Preço/Unit (R$)</label><input type="number" step="0.00001" min="0" value={contagem[p.id]?.valor || ""} onChange={e => handleContagemChange(p.id, "valor", e.target.value)} className="w-full p-2.5 border-2 rounded-xl text-center font-bold focus:border-blue-500 outline-none text-base" placeholder="0,00" /></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
               )
             })}
           </div>

           {/* ESPAÇADOR MÁGICO PARA O BOTÃO NÃO TAPAR O ÚLTIMO ITEM */}
           <div className="h-32 w-full"></div>
           
           <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50 pointer-events-none">
               <button onClick={handleSalvarEstoque} disabled={salvando} className={`pointer-events-auto flex items-center justify-center gap-3 text-xl font-extrabold py-5 px-8 rounded-2xl shadow-2xl w-full max-w-lg transition-all hover:scale-[1.02] active:scale-95 ${salvando ? "opacity-70 cursor-not-allowed" : ""} ${aba === "inicial" ? "bg-[#2563EB] text-white hover:bg-blue-600" : "bg-[#FACC15] text-[#1E3A8A] hover:bg-yellow-400"}`}>
                 {salvando ? "A Guardar..." : <><ClipboardCheck className="w-7 h-7" /> {aba === "inicial" ? "Guardar Estoque Inicial" : "Fechar Semana Automática"}</>}
               </button>
           </div>
        </div>
      )}

      {aba === "compras" && (
        <div className="space-y-6 animate-in fade-in duration-200 pb-24">
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4 border-emerald-100">
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                   <h3 className="font-bold text-xl text-emerald-800 flex items-center gap-2"><ShoppingCart /> Registar Compra</h3>
                   <div className="relative overflow-hidden">
                     <input type="file" accept=".csv" onChange={handleImportarCSVCompras} className="absolute inset-0 opacity-0 cursor-pointer" />
                     <button className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded-xl font-bold text-sm transition-all border border-emerald-300 shadow-sm">📥 Importar CSV</button>
                   </div>
                </div>
                
                <div className="space-y-2"><label className="text-sm font-semibold">Produto</label><select value={compraProd} onChange={e => setCompraProd(e.target.value)} className="w-full p-3 border-2 rounded-xl text-base focus:border-emerald-500 outline-none"><option value="">Selecione...</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-sm font-semibold">Qtd (Ex: 2.500)</label><input type="number" step="0.001" value={compraQtd} onChange={e => setCompraQtd(e.target.value)} className="w-full p-3 border-2 rounded-xl text-lg focus:border-emerald-500 outline-none" placeholder="Qtd" /></div>
                    <div className="space-y-2"><label className="text-sm font-semibold text-emerald-600">Valor Unitário</label><input type="number" step="0.00001" value={compraValor} onChange={e => setCompraValor(e.target.value)} className="w-full p-3 border-2 border-emerald-200 rounded-xl text-lg focus:border-emerald-500 outline-none" placeholder="R$" /></div>
                </div>
                <button onClick={handleRegistrarCompra} disabled={salvando || !compraProd} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-lg transition-all disabled:opacity-50">Registar Compra</button>
            </div>

            {data.compras?.length > 0 && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b font-bold text-slate-700">Compras Lançadas</div>
                  <div className="overflow-x-auto"><table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="p-3">Produto</th><th className="p-3">Qtd</th><th className="p-3">Total</th><th className="p-3 text-center">Apagar</th></tr></thead>
                      <tbody className="divide-y">
                          {data.compras.map((c:any) => (
                              <tr key={c.id} className="hover:bg-slate-50"><td className="p-3 font-semibold">{c.produto}</td><td className="p-3">{c.quantidade}</td><td className="p-3 font-black text-emerald-700">{formatBRL(c.valorTotal)}</td><td className="p-3 text-center"><button onClick={() => handleDeletarRegistro('compras', c.id)} className="p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-600"/></button></td></tr>
                          ))}
                      </tbody>
                  </table></div>
              </div>
            )}
        </div>
      )}

      {aba === "saidas" && (
        <div className="space-y-6 animate-in fade-in duration-200 pb-24">
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4 border-amber-200">
                <h3 className="text-xl font-bold text-amber-800 flex items-center gap-2"><ArrowUpRight /> Registar Saída</h3>
                <p className="text-sm text-amber-700">Abata do CMV ingredientes usados para lanches, funcionários ou perdas.</p>
                
                <div className="space-y-2"><label className="text-sm font-semibold">Produto Subtraído</label><select value={saidaProd} onChange={e => setSaidaProd(e.target.value)} className="w-full p-3 border-2 rounded-xl text-base focus:border-amber-500 outline-none"><option value="">Selecione o ingrediente...</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}</select></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-sm font-semibold">Quantidade que saiu</label><input type="number" step="0.001" value={saidaQtd} onChange={e => setSaidaQtd(e.target.value)} className="w-full p-3 border-2 rounded-xl text-lg focus:border-amber-500 outline-none" placeholder="Qtd" /></div>
                    <div className="space-y-2"><label className="text-sm font-semibold text-amber-800">Motivo da Saída</label><select value={saidaMotivo} onChange={e => setSaidaMotivo(e.target.value)} className="w-full p-3 border-2 border-amber-300 rounded-xl text-lg focus:border-amber-500 outline-none"><option value="">Qual o motivo?</option><option value="Prensadao (Lanches)">Prensadao (Lanches)</option><option value="Consumo Funcionários">Consumo Funcionários</option><option value="Consumo Sócios">Consumo Sócios</option><option value="Teste / Marketing">Teste / Marketing</option><option value="Desperdício / Vencido">Desperdício / Vencido</option></select></div>
                </div>
                <button onClick={handleRegistrarSaida} disabled={salvando || !saidaProd || !saidaMotivo} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-lg transition-all disabled:opacity-50">Registar Saída</button>
            </div>

            {data.saidas?.length > 0 && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b font-bold text-slate-700">Histórico de Saídas</div>
                  <div className="overflow-x-auto"><table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="p-3">Produto</th><th className="p-3">Qtd</th><th className="p-3">Motivo</th><th className="p-3 text-center">Apagar</th></tr></thead>
                      <tbody className="divide-y">
                          {data.saidas.map((s:any) => (
                              <tr key={s.id} className="hover:bg-slate-50"><td className="p-3 font-semibold">{s.produto}</td><td className="p-3 font-black text-red-600">- {s.quantidade}</td><td className="p-3"><span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">{s.motivo}</span></td><td className="p-3 text-center"><button onClick={() => handleDeletarRegistro('saidas_avulsas', s.id)} className="p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-600"/></button></td></tr>
                          ))}
                      </tbody>
                  </table></div>
              </div>
            )}
        </div>
      )}

      {aba === "faturamento" && (
          <div className="bg-white p-10 rounded-2xl border-2 shadow-sm text-center space-y-6 max-w-md mx-auto mt-10 border-green-200 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><DollarSign className="w-10 h-10" /></div>
              <div><h3 className="font-black text-2xl text-green-800">Faturamento da Semana</h3><p className="text-sm text-green-700 mt-2">Introduza o valor total de vendas bruto.</p></div>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-green-600/50">R$</span>
                <input type="number" step="0.01" value={faturamentoInput} onChange={e => setFaturamentoInput(e.target.value)} className="w-full py-5 pl-12 pr-4 text-4xl font-black text-center text-green-700 bg-white border-4 border-green-100 rounded-2xl focus:border-green-500 outline-none transition-all" placeholder="0.00" />
              </div>
              <button onClick={handleSalvarFaturamento} disabled={salvando} className="w-full py-5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-green-600/20 disabled:opacity-50 transition-all">
                {salvando ? "A salvar..." : "Salvar Faturamento"}
              </button>
          </div>
      )}
    </div>
  )
}