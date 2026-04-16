"use client"

import { useState, useEffect } from "react"
import { PlusCircle, CheckCircle2, Package, Pencil, Trash2, X, Tags, Upload, Beaker } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "react-hot-toast"

const UNIDADES = ["Kg", "Litro", "Unidade", "Pacote", "CX", "PCT"]

export type Produto = {
  id: number; nome: string; grupo: string; unidade: string; producao_interna: boolean;
}

interface CadastrosProps {
  produtos: Produto[]; 
  onRefresh: () => void;
  isReadOnly: boolean;
}

export function Cadastros({ produtos, onRefresh, isReadOnly }: CadastrosProps) {
  const [aba, setAba] = useState<"produtos" | "categorias">("produtos")
  const [gruposDB, setGruposDB] = useState<{id: number, nome: string}[]>([])
  
  const [nome, setNome] = useState("")
  const [grupoId, setGrupoId] = useState("")
  const [unidade, setUnidade] = useState("")
  const [producaoInterna, setProducaoInterna] = useState(false)
  
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState("")
  const [importando, setImportando] = useState(false)

  useEffect(() => { carregarCategorias() }, [])

  const carregarCategorias = async () => {
    const { data } = await supabase.from('grupos').select('*').order('nome')
    if (data) setGruposDB(data)
  }

  const resetForm = () => {
    setNome(""); setGrupoId(""); setUnidade(""); setProducaoInterna(false); setEditandoId(null); setSalvando(false);
  }

  const handleSalvarProduto = async () => {
    if (isReadOnly) return toast.error("Período bloqueado!")
    if (!nome.trim() || !grupoId || !unidade) return toast.error("Preencha os campos!")
    
    setSalvando(true)
    const payload = { nome: nome.trim(), unidade_medida: unidade, grupo_id: parseInt(grupoId), producao_interna: producaoInterna }

    if (editandoId) {
      await supabase.from('produtos').update(payload).eq('id', editandoId)
      toast.success("Atualizado!")
    } else {
      await supabase.from('produtos').insert([payload])
      toast.success("Salvo!")
    }
    
    resetForm()
    onRefresh()
  }

  const handleDeletarProduto = async (id: number, nomeProd: string) => {
    if (isReadOnly) return toast.error("Período bloqueado!")
    if (window.confirm(`Apagar o produto ${nomeProd} definitivamente?`)) {
      await supabase.from('produtos').delete().eq('id', id)
      toast.success("Deletado!")
      onRefresh()
    }
  }

  const handleSalvarCategoria = async () => {
    if (isReadOnly) return toast.error("Período bloqueado!")
    if (!novaCategoria.trim()) return
    await supabase.from('grupos').insert([{ nome: novaCategoria.trim() }])
    setNovaCategoria("")
    toast.success("Categoria salva!")
    carregarCategorias()
  }

  const handleDeletarCategoria = async (id: number, nomeCat: string) => {
    if (isReadOnly) return toast.error("Período bloqueado!")
    if (window.confirm(`ATENÇÃO: Apagar a categoria ${nomeCat} vai afetar os produtos dentro dela. Continuar?`)) {
      await supabase.from('grupos').delete().eq('id', id)
      toast.success("Categoria deletada!")
      carregarCategorias()
      onRefresh()
    }
  }

  // Importar CSV
  const handleImportarCSVProdutos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return toast.error("Período bloqueado!")
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
        const idIdx = headers.indexOf('id')
        const nomeIdx = headers.indexOf('nome')
        const unidIdx = headers.indexOf('unidade_medida')
        const grupoIdx = headers.indexOf('grupo_id')

        if (nomeIdx === -1) {
          alert("❌ CSV inválido! O ficheiro precisa ter no mínimo a coluna 'nome'.")
          setImportando(false); return
        }

        const produtosParaInserir = []
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i] || rows[i].length < 2) continue
          
          const idStr = idIdx !== -1 ? rows[i][idIdx]?.replace(/"/g, '') : null
          const nomeProd = rows[i][nomeIdx]?.replace(/"/g, '')
          const unid = unidIdx !== -1 ? rows[i][unidIdx]?.replace(/"/g, '') : 'Unidade'
          const grupo = grupoIdx !== -1 ? parseInt(rows[i][grupoIdx]?.replace(/"/g, '')) : null

          if (nomeProd) {
            const prod: any = { nome: nomeProd, unidade_medida: unid }
            if (grupo && !isNaN(grupo)) prod.grupo_id = grupo
            if (idStr && !isNaN(parseInt(idStr))) {
                prod.id = parseInt(idStr)
            }
            produtosParaInserir.push(prod)
          }
        }

        if (produtosParaInserir.length === 0) {
            alert("Nenhum produto encontrado no ficheiro."); setImportando(false); return
        }

        const { error } = await supabase.from('produtos').insert(produtosParaInserir)
        if (error) throw error

        alert(`✅ Sucesso! ${produtosParaInserir.length} produtos foram importados.`)
        onRefresh()
      } catch (error: any) {
        alert("Erro ao importar: " + error.message)
      } finally {
        setImportando(false)
        if(e.target) e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  const byGroup = gruposDB.reduce<Record<string, Produto[]>>((acc, g) => {
    acc[g.nome] = produtos.filter((p) => p.grupo === g.nome)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
        <button onClick={() => setAba("produtos")} className={`px-6 py-2.5 rounded-lg font-bold transition-all ${aba === "produtos" ? "bg-white text-[#C0392B] shadow" : "text-muted-foreground"}`}>Produtos</button>
        <button onClick={() => setAba("categorias")} className={`px-6 py-2.5 rounded-lg font-bold transition-all ${aba === "categorias" ? "bg-white text-[#C0392B] shadow" : "text-muted-foreground"}`}>Categorias</button>
      </div>

      {aba === "categorias" ? (
        <div className="bg-card p-6 rounded-2xl border shadow-sm space-y-5 animate-in fade-in">
          <h3 className="text-xl font-bold flex items-center gap-2"><Tags className="text-[#C0392B]" /> Gerir Categorias</h3>
          <div className="flex gap-3">
            <input disabled={isReadOnly} value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} placeholder="Ex: Bebidas" className="flex-1 p-4 text-lg border-2 rounded-xl focus:border-[#C0392B] outline-none disabled:opacity-50" />
            <button onClick={handleSalvarCategoria} disabled={!novaCategoria.trim() || isReadOnly} className="bg-[#1E6B43] text-white px-8 rounded-xl font-bold hover:bg-green-800 disabled:opacity-50">Adicionar</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {gruposDB.map(c => (
              <div key={c.id} className="p-4 bg-muted border rounded-xl flex justify-between items-center">
                <span className="font-bold text-lg">{c.nome}</span>
                <button disabled={isReadOnly} onClick={() => handleDeletarCategoria(c.id, c.nome)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg disabled:opacity-30"><Trash2 size={20}/></button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in">
          <div className={`bg-card rounded-2xl border-2 p-6 shadow-sm space-y-5 ${editandoId ? "border-orange-500 bg-orange-50/50" : "border-border"}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xl font-bold">{editandoId ? "Editar Produto" : "Novo Produto"}</h3>
              <div className="flex items-center gap-3">
                {!editandoId && (
                  <div>
                    <input type="file" accept=".csv" id="csv-produtos" className="hidden" onChange={handleImportarCSVProdutos} disabled={importando || isReadOnly} />
                    <label htmlFor="csv-produtos" className={`cursor-pointer px-4 py-2 rounded-lg font-bold text-sm border shadow-sm flex items-center gap-2 transition-all ${isReadOnly ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300'}`}>
                       <Upload className="w-4 h-4"/>
                       {importando ? "A ler..." : "📥 Importar Produtos"}
                    </label>
                  </div>
                )}
                {editandoId && <button onClick={resetForm} className="text-muted-foreground hover:text-red-500"><X /></button>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-semibold block">Nome do Produto</label>
              <input type="text" disabled={isReadOnly} value={nome} onChange={(e) => setNome(e.target.value)} className="w-full p-3.5 rounded-xl border-2 bg-background focus:border-[#C0392B] outline-none disabled:opacity-50" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="font-semibold block">Categoria Principal</label>
                <select disabled={isReadOnly} value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className="w-full p-3.5 rounded-xl border-2 bg-background focus:border-[#C0392B] outline-none disabled:opacity-50">
                  <option value="">Selecione...</option>
                  {gruposDB.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-semibold block">Unidade</label>
                <select disabled={isReadOnly} value={unidade} onChange={(e) => setUnidade(e.target.value)} className="w-full p-3.5 rounded-xl border-2 bg-background focus:border-[#C0392B] outline-none disabled:opacity-50">
                  <option value="">Selecione...</option>
                  {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* A NOVA CAIXINHA DE MÁGICA */}
            <div className="mt-4">
              <label className="flex items-center gap-3 p-4 border-2 rounded-xl bg-background cursor-pointer hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  disabled={isReadOnly} 
                  checked={producaoInterna} 
                  onChange={(e) => setProducaoInterna(e.target.checked)} 
                  className="w-5 h-5 accent-[#C0392B] cursor-pointer" 
                />
                <div>
                  <p className="font-bold text-slate-800 flex items-center gap-2">Produto Fabricado na Loja (Subproduto) <Beaker className="w-4 h-4 text-blue-500"/></p>
                  <p className="text-xs text-slate-500 font-medium">O sistema vai manter a contagem de estoque, mas ignorar o custo no CMV para evitar bitributação.</p>
                </div>
              </label>
            </div>

            <button onClick={handleSalvarProduto} disabled={!nome.trim() || !grupoId || !unidade || salvando || isReadOnly} className="w-full py-4 rounded-xl bg-[#C0392B] text-white font-bold disabled:opacity-50 flex justify-center gap-2">
              {salvando ? "A Guardar..." : editandoId ? <><CheckCircle2 /> Atualizar</> : <><PlusCircle /> Salvar</>}
            </button>
          </div>

          <div className="space-y-6">
            {gruposDB.map((g) => {
              const lista = byGroup[g.nome]
              if (!lista || lista.length === 0) return null
              return (
                <div key={g.id} className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-muted border-b flex items-center gap-2"><Package className="text-[#C0392B]" /><h4 className="text-lg font-bold">{g.nome}</h4><span className="ml-auto text-sm font-medium bg-background px-2 py-0.5 rounded-full border">{lista.length} itens</span></div>
                  <ul className="divide-y">
                    {lista.map((p) => (
                      <li key={p.id} className="flex items-center justify-between px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold block">{p.nome}</span>
                            {p.producao_interna && <span className="bg-blue-100 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Fabricado</span>}
                          </div>
                          <span className="text-xs text-muted-foreground uppercase">{p.unidade}</span>
                        </div>
                        <div className="flex gap-2">
                          <button disabled={isReadOnly} onClick={() => {setNome(p.nome); setGrupoId(String(g.id)); setUnidade(p.unidade); setProducaoInterna(p.producao_interna); setEditandoId(p.id); window.scrollTo(0,0)}} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30"><Pencil size={20}/></button>
                          <button disabled={isReadOnly} onClick={() => handleDeletarProduto(p.id, p.nome)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30"><Trash2 size={20}/></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}