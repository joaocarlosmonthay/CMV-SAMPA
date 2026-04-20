"use client"

import { useState, useEffect } from "react"
import { Package, ShoppingCart, DollarSign, Trash2, Save, CheckCircle2, ArrowDownToLine, Lock, Pencil, X, MinusCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "react-hot-toast"

// PROTEÇÃO BLINDADA: Tenta converter e formata. Se tudo falhar, devolve R$ 0,00 e NUNCA QUEBRA A TELA.
const formatBRL = (v: any) => {
  try {
    if (v === null || v === undefined || v === "") return "R$ 0,00";
    const num = Number(v);
    if (isNaN(num)) return "R$ 0,00";
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch (error) {
    return "R$ 0,00";
  }
}

export type ContagemEstoque = Record<number, { qtd: string; valor: string }>

export function Estoque({ dataInicio, dataFim, produtos, data, contagemInicial, contagemFinal, onChange, onSemanaFechada, isReadOnly }: any) {
  const [aba, setAba] = useState<"inicial" | "compras" | "saidas" | "faturamento" | "final">("inicial")
  const [novoLancamento, setNovoLancamento] = useState({ produto: "", quantidade: "", valorTotal: "", motivo: "Quebra/Desperdício", descricaoManual: "", modoManual: false })
  const [faturamento, setFaturamento] = useState(data.faturamento?.toString() || "")
  const [contagem, setContagem] = useState<ContagemEstoque>({})
  
  const [editandoCompraId, setEditandoCompraId] = useState<number | null>(null)

  useEffect(() => { setContagem(aba === "inicial" ? contagemInicial : contagemFinal) }, [aba, contagemInicial, contagemFinal])
  useEffect(() => { setFaturamento(data.faturamento?.toString() || "") }, [data.faturamento])

  const handleSalvarCompra = async () => {
    if (isReadOnly) return toast.error("Período travado para edições!")
    if (!novoLancamento.produto || !novoLancamento.quantidade || !novoLancamento.valorTotal) return toast.error("Preencha todos os campos!")
    
    const prod = produtos.find((p: any) => p.nome === novoLancamento.produto)
    if (!prod) return toast.error("Produto inválido!")

    const vTotal = parseFloat(novoLancamento.valorTotal.replace(',', '.')), qtd = parseFloat(novoLancamento.quantidade.replace(',', '.'))
    
    const precoUnitarioHires = vTotal / qtd;

    if (editandoCompraId) {
      const { error } = await supabase.from('compras').update({ 
        produto_id: prod.id, 
        quantidade: qtd, 
        valor_unitario: precoUnitarioHires 
      }).eq('id', editandoCompraId)
      if (error) return toast.error("Erro: " + error.message)
      toast.success("Compra atualizada!")
      setEditandoCompraId(null)
    } else {
      const { error } = await supabase.from('compras').insert([{ 
        produto_id: prod.id, 
        quantidade: qtd, 
        valor_unitario: precoUnitarioHires, 
        data_compra: dataInicio 
      }])
      if (error) return toast.error("Erro: " + error.message)
      toast.success("Compra salva!")
    }

    setNovoLancamento({ ...novoLancamento, produto: "", quantidade: "", valorTotal: "", motivo: "Quebra/Desperdício" })
    onChange()
  }

  const cancelarEdicaoCompra = () => {
    setEditandoCompraId(null)
    setNovoLancamento({ ...novoLancamento, produto: "", quantidade: "", valorTotal: "", motivo: "Quebra/Desperdício" })
  }

  const handleSalvarSaida = async () => {
    if (isReadOnly) return toast.error("Período travado para edições!")
    
    let erroBanco = null;

    if (novoLancamento.modoManual) {
      if (!novoLancamento.descricaoManual || !novoLancamento.valorTotal) return toast.error("Preencha descrição e valor!")
      const { error } = await supabase.from('saidas_avulsas').insert([{ 
        descricao_manual: novoLancamento.descricaoManual, 
        valor_total: parseFloat(novoLancamento.valorTotal.replace(',', '.')), 
        motivo: "Dedução Manual CMV", 
        data_saida: dataInicio,
        quantidade: 1 
      }])
      erroBanco = error;
    } else {
      if (!novoLancamento.produto || !novoLancamento.quantidade) return toast.error("Preencha produto e qtd!")
      const prod = produtos.find((p: any) => p.nome === novoLancamento.produto)
      const valUnit = parseFloat(contagemInicial[prod.id]?.valor || "0")
      const { error } = await supabase.from('saidas_avulsas').insert([{ 
        produto_id: prod.id, 
        quantidade: parseFloat(novoLancamento.quantidade.replace(',', '.')), 
        valor_total: parseFloat(novoLancamento.quantidade.replace(',', '.')) * valUnit,
        motivo: novoLancamento.motivo, 
        data_saida: dataInicio 
      }])
      erroBanco = error;
    }

    if (erroBanco) {
      console.error(erroBanco);
      return toast.error("Erro no BD (Verifique o Cache): " + erroBanco.message);
    }

    toast.success("Dedução/Saída registrada!"); 
    setNovoLancamento({ ...novoLancamento, produto: "", quantidade: "", valorTotal: "", descricaoManual: "" }); 
    onChange();
  }

  const handleExcluir = async (id: number, tabela: string) => {
    if (isReadOnly) return toast.error("Período travado para edições!")
    if (!confirm("Apagar lançamento?")) return
    const { error } = await supabase.from(tabela).delete().eq('id', id)
    if (error) return toast.error("Erro: " + error.message)
    toast.success("Removido com sucesso!"); onChange();
  }

  const handleSalvarContagem = async () => {
    if (isReadOnly) return toast.error("Período travado para edições!")
    const tipo = aba === "inicial" ? "Inicial" : "Final"

    toast.loading(`Salvando Estoque ${tipo}...`, { id: "salva-estoque" })

    try {
      const { error: errDel } = await supabase.from('estoques').delete().eq('tipo_contagem', tipo).gte('data_contagem', dataInicio).lte('data_contagem', dataFim)
      if (errDel) throw errDel;

      const inserts = Object.entries(contagem).map(([id, d]) => {
        const qtdStr = d && d.qtd ? String(d.qtd).trim() : "";
        let valStr = d && d.valor ? String(d.valor).trim() : "";

        if (tipo === "Final") {
          valStr = contagemInicial[parseInt(id)]?.valor ? String(contagemInicial[parseInt(id)].valor).trim() : "0";
        }

        const q = parseFloat(qtdStr.replace(',', '.'));
        const v = parseFloat(valStr.replace(',', '.'));

        return {
          produto_id: parseInt(id),
          quantidade: isNaN(q) ? null : q,
          valor_unitario: isNaN(v) ? 0 : v,
          tipo_contagem: tipo,
          data_contagem: dataInicio
        }
      }).filter(i => i.quantidade !== null)

      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from('estoques').insert(inserts)
        if (insErr) throw insErr;
        toast.success(`Estoque ${tipo} salvo com sucesso!`, { id: "salva-estoque" });
      } else {
        toast.success(`Estoque ${tipo} atualizado (Vazio)!`, { id: "salva-estoque" });
      }
      
      await onChange();

    } catch (error: any) {
      toast.error("Erro no sistema ao salvar: " + error.message, { id: "salva-estoque", duration: 5000 });
    }
  }

  const handlePuxarAnterior = async () => {
    if (isReadOnly) return toast.error("Período travado!")
    const d = new Date(dataInicio + "T12:00:00")
    d.setDate(d.getDate() - 7)
    const semAnt = d.toISOString().split('T')[0]

    toast("Buscando fechamento anterior...", { icon: "⏳" })
    const { data: estAnterior } = await supabase.from('estoques').select('*').eq('tipo_contagem', 'Final').eq('data_contagem', semAnt)

    if (estAnterior && estAnterior.length > 0) {
      const novoEstoque = { ...contagem }
      estAnterior.forEach((e: any) => {
        novoEstoque[e.produto_id] = { qtd: e.quantidade.toString(), valor: e.valor_unitario.toString() }
      })
      setContagem(novoEstoque)
      toast.success("Dados carregados na tela! Clique em SALVAR CONTAGEM lá embaixo para confirmar.")
    } else {
      toast.error("Nenhum fechamento encontrado na semana anterior.")
    }
  }

  const handleSalvarFaturamento = async () => {
    if (isReadOnly) return toast.error("Período travado para edições!")
    const fatVal = parseFloat(faturamento.replace(',', '.')) || 0
    const { data: ex } = await supabase.from('financas_semanais').select('id').eq('data_inicio', dataInicio).maybeSingle()
    if (ex) await supabase.from('financas_semanais').update({ faturamento: fatVal }).eq('id', ex.id)
    else await supabase.from('financas_semanais').insert([{ data_inicio: dataInicio, data_fim: dataFim, faturamento: fatVal }])
    toast.success("Faturamento salvo!"); onChange();
  }

  return (
    <div className="space-y-6 relative pb-32">
      {isReadOnly && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-xl flex items-center gap-3 shadow-sm">
          <Lock className="w-5 h-5" />
          <p className="font-bold text-sm">PERÍODO ENCERRADO: Este ciclo já foi fechado. Os dados estão bloqueados para evitar alterações no histórico.</p>
        </div>
      )}

      <div className="flex bg-white p-2 rounded-2xl shadow-sm border overflow-x-auto no-scrollbar">
        {[
          { id: "inicial", label: "Estoque Inicial" },
          { id: "compras", label: "Compras" },
          { id: "saidas", label: "Deduções/Saídas" },
          { id: "faturamento", label: "Faturamento" },
          { id: "final", label: "Estoque Final" }
        ].map(t => (
          <button key={t.id} onClick={() => {setAba(t.id as any); cancelarEdicaoCompra()}} className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-bold text-sm transition-all ${aba === t.id ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white p-8 rounded-[32px] shadow-sm border">

        {aba === "compras" && (
          <div className="space-y-6">
            {!isReadOnly && (
              <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-6 rounded-2xl border relative ${editandoCompraId ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                
                {editandoCompraId && (
                  <div className="absolute -top-3 left-4 bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                    Editando Compra Existente
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className={`text-[10px] font-black uppercase ${editandoCompraId ? 'text-blue-600' : 'text-slate-500'}`}>Insumo</label>
                  <select className={`p-3 rounded-xl border font-bold outline-none ${editandoCompraId ? 'border-blue-300 focus:border-blue-600' : 'focus:border-blue-500'}`} value={novoLancamento.produto} onChange={e => setNovoLancamento({ ...novoLancamento, produto: e.target.value })}>
                    <option value="">Selecione...</option>{produtos.map((p: any) => <option key={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={`text-[10px] font-black uppercase ${editandoCompraId ? 'text-blue-600' : 'text-slate-500'}`}>Qtd Comprada</label>
                  <input type="text" placeholder="0" className={`p-3 rounded-xl border font-bold outline-none ${editandoCompraId ? 'border-blue-300 focus:border-blue-600' : 'focus:border-blue-500'}`} value={novoLancamento.quantidade} onChange={e => setNovoLancamento({ ...novoLancamento, quantidade: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={`text-[10px] font-black uppercase flex items-center gap-1 ${editandoCompraId ? 'text-blue-600' : 'text-slate-500'}`}>R$ Total da Nota</label>
                  <input type="text" placeholder="0,00" className="p-3 rounded-xl border font-bold bg-amber-50 outline-none focus:border-amber-500" value={novoLancamento.valorTotal} onChange={e => setNovoLancamento({ ...novoLancamento, valorTotal: e.target.value })} />
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={handleSalvarCompra} className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-black hover:bg-blue-700 transition-colors flex justify-center items-center gap-2">
                    <ShoppingCart className="w-5 h-5" /> {editandoCompraId ? "ATUALIZAR" : "LANÇAR"}
                  </button>
                  {editandoCompraId && (
                    <button onClick={cancelarEdicaoCompra} className="p-3 bg-white border border-slate-300 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all" title="Cancelar Edição">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-slate-400 font-black uppercase text-[10px]">
                  <tr>
                    <th className="pb-3 text-left">Item Comprado</th>
                    <th className="pb-3 text-center">Quantidade</th>
                    <th className="pb-3 text-right">Valor Total</th>
                    {!isReadOnly && <th className="pb-3 text-right">Ação</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.compras.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-4 font-bold text-slate-700">{c.produto}</td>
                      <td className="py-4 text-center font-bold text-slate-500">{c.quantidade}</td>
                      <td className="py-4 text-right font-black text-blue-600">{formatBRL(c.valorTotal)}</td>
                      {!isReadOnly && (
                        <td className="py-4 text-right flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setEditandoCompraId(c.id);
                              setNovoLancamento({ ...novoLancamento, produto: c.produto, quantidade: c.quantidade.toString(), valorTotal: c.valorTotal.toFixed(2), motivo: "Quebra/Desperdício" });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }} 
                            className="p-2 text-slate-300 hover:text-blue-600 bg-white shadow-sm border border-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Editar Compra"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleExcluir(c.id, 'compras')} 
                            className="p-2 text-slate-300 hover:text-red-600 bg-white shadow-sm border border-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Apagar Compra"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aba === "saidas" && (
          <div className="space-y-6">
            {!isReadOnly && (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex justify-center mb-2">
                  <button onClick={() => setNovoLancamento({...novoLancamento, modoManual: !novoLancamento.modoManual})} className={`px-4 py-2 rounded-full font-black text-[10px] uppercase border transition-all ${novoLancamento.modoManual ? 'bg-rose-500 text-white border-rose-600 shadow-md' : 'bg-white text-slate-400 border-slate-200'}`}>
                    {novoLancamento.modoManual ? '✓ Modo Manual: Dedução por Texto/Valor' : 'Modo Padrão: Abate por Insumo'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  {novoLancamento.modoManual ? (
                    <div className="md:col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição da Saída</label>
                      <input type="text" placeholder="Ex: Strogonoff p/ Prensadão..." className="p-3 rounded-xl border font-bold bg-white outline-none focus:border-rose-500" value={novoLancamento.descricaoManual} onChange={e => setNovoLancamento({ ...novoLancamento, descricaoManual: e.target.value })} />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Escolha o Insumo</label>
                      <select className="p-3 rounded-xl border font-bold bg-white outline-none focus:border-rose-500" value={novoLancamento.produto} onChange={e => setNovoLancamento({ ...novoLancamento, produto: e.target.value })}>
                        <option value="">Selecione...</option>{produtos.map((p: any) => <option key={p.id}>{p.nome}</option>)}
                      </select>
                    </div>
                  )}

                  {!novoLancamento.modoManual && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Qtd</label>
                      <input type="text" placeholder="0" className="p-3 rounded-xl border font-bold outline-none focus:border-rose-500" value={novoLancamento.quantidade} onChange={e => setNovoLancamento({ ...novoLancamento, quantidade: e.target.value })} />
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{novoLancamento.modoManual ? 'Valor em Reais (R$)' : 'Motivo'}</label>
                    {novoLancamento.modoManual ? (
                      <input type="text" placeholder="0,00" className="p-3 rounded-xl border font-bold bg-rose-50 outline-none focus:border-rose-500" value={novoLancamento.valorTotal} onChange={e => setNovoLancamento({ ...novoLancamento, valorTotal: e.target.value })} />
                    ) : (
                      <select className="p-3 rounded-xl border font-bold outline-none focus:border-rose-500" value={novoLancamento.motivo} onChange={e => setNovoLancamento({ ...novoLancamento, motivo: e.target.value })}>
                        <option value="Quebra/Desperdício">Quebra/Desperdício</option>
                        <option value="Alimentação Funcionário">Alimentação Funcionário</option>
                        <option value="Retirada Sócio">Retirada Sócio</option>
                      </select>
                    )}
                  </div>

                  <button onClick={handleSalvarSaida} className="bg-rose-500 text-white p-3 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-rose-600 transition-all shadow-md shadow-rose-200">
                    <MinusCircle size={18}/> DEDUZIR DO CMV
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-slate-400 font-black uppercase text-[10px]"><tr><th className="pb-3 text-left">Lançamento</th><th className="pb-3 text-left">Motivo / Descrição</th><th className="pb-3 text-right">Abate (R$)</th>{!isReadOnly && <th className="pb-3 text-right">Ação</th>}</tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {data.saidas.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-4 font-bold text-slate-700">{s.descricaoManual || s.produto}</td>
                      <td className="py-4 font-medium italic text-slate-500">{s.motivo}</td>
                      <td className="py-4 text-right font-black text-rose-600">{formatBRL(s.valorTotal)}</td>
                      {!isReadOnly && <td className="py-4 text-right"><button onClick={() => handleExcluir(s.id, 'saidas_avulsas')} className="p-2 text-slate-300 hover:text-red-600 bg-white shadow-sm border border-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(aba === "inicial" || aba === "final") && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center bg-slate-50 p-6 rounded-2xl border border-slate-200 gap-4">
              <h3 className="font-black text-xl text-slate-800">Contagem {aba.toUpperCase()}</h3>
              <div className="flex gap-3">
                {aba === "inicial" && !isReadOnly && (
                  <button onClick={handlePuxarAnterior} className="bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-100 transition-colors shadow-sm"><ArrowDownToLine className="w-4 h-4" /> PUXAR ANTERIOR</button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {produtos.map((p: any) => (
                <div key={p.id} className={`p-4 border rounded-2xl ${isReadOnly ? 'bg-slate-50 opacity-70' : 'bg-white hover:border-blue-300 transition-colors'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-bold text-slate-700">{p.nome}</p>
                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{p.unidade}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Qtd Real</label>
                      <input type="text" disabled={isReadOnly} className="w-full p-2 border rounded-lg text-sm font-bold disabled:bg-slate-100 outline-none focus:border-blue-500" value={contagem[p.id]?.qtd || ""} onChange={e => setContagem({ ...contagem, [p.id]: { ...contagem[p.id], qtd: e.target.value } })} />
                    </div>
                    
                    {aba === "inicial" ? (
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">R$ Unitário</label>
                        <input type="text" disabled={isReadOnly} className="w-full p-2 border rounded-lg text-sm font-bold disabled:bg-slate-100 outline-none focus:border-blue-500" value={contagem[p.id]?.valor || ""} onChange={e => setContagem({ ...contagem, [p.id]: { ...contagem[p.id], valor: e.target.value } })} />
                      </div>
                    ) : (
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Custo Aplicado</label>
                        <div className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-400 flex items-center h-[38px] overflow-hidden">
                          {formatBRL(parseFloat(contagemInicial[p.id]?.valor?.replace(',', '.') || "0"))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}

        {aba === "faturamento" && (
          <div className="flex flex-col items-center py-12 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
              <DollarSign className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-6">Faturamento Bruto</h3>
            <div className="relative w-64 mb-6">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">R$</span>
              <input type="text" disabled={isReadOnly} value={faturamento} onChange={e => setFaturamento(e.target.value)} className="w-full pl-16 pr-6 py-5 text-3xl font-black border-2 border-slate-200 rounded-3xl disabled:bg-slate-100 outline-none focus:border-emerald-500 text-center" placeholder="0.00" />
            </div>
            {!isReadOnly && (
              <button onClick={handleSalvarFaturamento} className="w-64 bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-colors">SALVAR VENDAS</button>
            )}
          </div>
        )}
      </div>

      {/* ÁREA DOS BOTÕES FIXOS NO RODAPÉ */}
      {!isReadOnly && (aba === "inicial" || aba === "final") && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-72 bg-white/80 backdrop-blur-md p-6 border-t flex flex-col sm:flex-row gap-4 justify-center items-center shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] z-30">
            <button onClick={handleSalvarContagem} className="w-full max-w-md bg-blue-600 text-white py-6 rounded-3xl font-black text-xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-2xl shadow-blue-500/40 transform hover:scale-[1.02]">
               <Save size={28}/> SALVAR CONTAGEM {aba.toUpperCase()}
            </button>
            {aba === "final" && (
              <button onClick={onSemanaFechada} className="w-full max-w-xs bg-slate-900 text-white py-6 rounded-3xl font-black text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl">
                 <CheckCircle2 size={24}/> ENCERRAR CICLO
              </button>
            )}
        </div>
      )}

    </div>
  )
}