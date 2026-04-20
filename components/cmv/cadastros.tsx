"use client"

import { useState } from "react"
import { Package, Plus, Search, Tag, Layers, Edit2, Trash2, X, Save, FolderTree, Beaker } from "lucide-react"
import { toast } from "react-hot-toast"

export function Cadastros({ produtos, categorias, onAddProduto, onEditProduto, onDeleteProduto, onAddCategoria, onDeleteCategoria, isReadOnly }: any) {
  const [abaCadastros, setAbaCadastros] = useState<"insumos" | "categorias">("insumos")
  
  // Estados para Insumos (Base Vilhena)
  const [nome, setNome] = useState("")
  const [unidade, setUnidade] = useState("KG")
  const [grupoId, setGrupoId] = useState(categorias?.[0]?.id?.toString() || "")
  const [producaoInterna, setProducaoInterna] = useState(false)
  const [busca, setBusca] = useState("")
  const [editandoId, setEditandoId] = useState<number | null>(null)

  // Estados para Categorias
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("")

  const handleSalvarInsumo = () => {
    if (isReadOnly) return toast.error("Período bloqueado!")
    if (!nome.trim() || !grupoId) return toast.error("Preencha todos os campos e certifique-se de ter um grupo!")

    const dados = { 
      nome: nome.trim(), 
      unidade_medida: unidade, 
      grupo_id: parseInt(grupoId),
      producao_interna: producaoInterna 
    }

    if (editandoId) {
      onEditProduto(editandoId, dados)
      setEditandoId(null)
    } else {
      onAddProduto(dados)
    }

    setNome("")
    setUnidade("KG")
    setProducaoInterna(false)
  }

  const iniciarEdicao = (p: any) => {
    setEditandoId(p.id)
    setNome(p.nome)
    setUnidade(p.unidade)
    setGrupoId(p.grupo_id?.toString() || "")
    setProducaoInterna(p.producao_interna)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setNome("")
    setUnidade("KG")
    setProducaoInterna(false)
  }

  const handleSalvarNovaCategoria = () => {
    if (isReadOnly) return toast.error("Período bloqueado!")
    if (!novaCategoriaNome.trim()) return toast.error("Digite o nome da categoria!")
    onAddCategoria(novaCategoriaNome.trim())
    setNovaCategoriaNome("")
  }

  const produtosFiltrados = produtos?.filter((p: any) => p.nome.toLowerCase().includes(busca.toLowerCase())) || []

  return (
    <div className="space-y-6 font-sans pb-10">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Package className="w-6 h-6 text-blue-600"/> Base de Cadastros</h2>
          <p className="text-slate-500 text-sm font-medium">Gestão de ingredientes e suas classificações.</p>
        </div>
      </div>

      <div className="flex bg-white p-2 rounded-2xl shadow-sm border overflow-x-auto w-fit">
        <button onClick={() => setAbaCadastros("insumos")} className={`flex items-center gap-2 min-w-[140px] justify-center py-3 px-6 rounded-xl font-bold text-sm transition-all ${abaCadastros === "insumos" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"}`}>
          <Layers className="w-4 h-4"/> Insumos
        </button>
        <button onClick={() => setAbaCadastros("categorias")} className={`flex items-center gap-2 min-w-[140px] justify-center py-3 px-6 rounded-xl font-bold text-sm transition-all ${abaCadastros === "categorias" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"}`}>
          <FolderTree className="w-4 h-4"/> Categorias
        </button>
      </div>

      {abaCadastros === "insumos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className={`bg-white p-8 rounded-3xl border-2 h-fit sticky top-6 transition-all ${editandoId ? 'border-blue-500 shadow-xl' : 'border-slate-100 shadow-sm'}`}>
            <h3 className="font-black text-lg text-slate-800 mb-6 flex items-center gap-2">
              {editandoId ? <Edit2 className="w-5 h-5 text-blue-500"/> : <Plus className="w-5 h-5 text-emerald-500"/>}
              {editandoId ? "Editar Produto" : "Adicionar Novo"}
            </h3>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Nome</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500" placeholder="Ex: Queijo Mussarela" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Unidade</label>
                  <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none">
                    <option value="KG">KG</option><option value="UN">UN</option><option value="L">L</option><option value="CX">CX</option><option value="PCT">PCT</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Categoria</label>
                  <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none">
                    {categorias?.length === 0 && <option value="">Cadastre um grupo antes...</option>}
                    {categorias?.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-center gap-3 p-4 border-2 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input 
                    type="checkbox" 
                    disabled={isReadOnly} 
                    checked={producaoInterna} 
                    onChange={(e) => setProducaoInterna(e.target.checked)} 
                    className="w-5 h-5 accent-blue-600 cursor-pointer" 
                  />
                  <div>
                    <p className="font-bold text-slate-800 flex items-center gap-2 text-sm">Fabricado na Loja <Beaker className="w-4 h-4 text-blue-500"/></p>
                    <p className="text-[10px] text-slate-500 font-medium">Não gera custo duplo no CMV.</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-2 mt-4">
                {editandoId && (
                  <button onClick={cancelarEdicao} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"><X className="w-4 h-4"/> CANCELAR</button>
                )}
                <button onClick={handleSalvarInsumo} className={`flex-[2] py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all shadow-lg ${editandoId ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                  {editandoId ? <Save className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
                  {editandoId ? "SALVAR ALTERAÇÃO" : "CADASTRAR"}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center gap-4">
               <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><Layers className="w-5 h-5 text-blue-600"/> Insumos Cadastrados</h3>
               <div className="relative w-64">
                 <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/><input type="text" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-blue-500 shadow-sm" />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-white shadow-sm font-black text-[10px] uppercase text-slate-400 z-10">
                  <tr><th className="py-4 px-6">Produto</th><th className="py-4 px-6">Categoria</th><th className="py-4 px-6 text-center">Unidade</th><th className="py-4 px-6 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {produtosFiltrados.length === 0 ? (
                    <tr><td colSpan={4} className="py-10 text-center text-slate-400 font-bold">Nenhum produto cadastrado.</td></tr>
                  ) : (
                    produtosFiltrados.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-4 px-6 font-bold text-slate-700">
                          {p.nome}
                          {p.producao_interna && <span className="ml-2 bg-blue-100 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Fabricado</span>}
                        </td>
                        <td className="py-4 px-6"><span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">{p.grupo}</span></td>
                        <td className="py-4 px-6 text-center font-black text-slate-400">{p.unidade}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => iniciarEdicao(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                            <button onClick={() => onDeleteProduto(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {abaCadastros === "categorias" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl border shadow-sm h-fit">
             <h3 className="font-black text-lg text-slate-800 mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500"/> Nova Categoria
             </h3>
             <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Nome do Grupo</label>
                  <input type="text" value={novaCategoriaNome} onChange={(e) => setNovaCategoriaNome(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500" placeholder="Ex: Queijos Finos" />
                </div>
                <button onClick={handleSalvarNovaCategoria} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4"/> ADICIONAR GRUPO
                </button>
             </div>
          </div>

          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col h-[500px]">
             <div className="p-6 border-b bg-slate-50">
               <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><FolderTree className="w-5 h-5 text-blue-600"/> Grupos Ativos</h3>
             </div>
             <div className="flex-1 overflow-y-auto">
               <table className="w-full text-sm text-left">
                 <thead className="sticky top-0 bg-white shadow-sm font-black text-[10px] uppercase text-slate-400">
                   <tr><th className="py-4 px-6">Nome do Grupo</th><th className="py-4 px-6 text-right">Ação</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {categorias?.map((cat: any) => (
                     <tr key={cat.id} className="hover:bg-slate-50 transition-colors group">
                       <td className="py-4 px-6 font-bold text-slate-700"><Tag className="w-3 h-3 inline-block mr-2 text-slate-400"/>{cat.nome}</td>
                       <td className="py-4 px-6 text-right">
                         <button onClick={() => onDeleteCategoria(cat.id)} className="p-2 text-slate-300 hover:text-red-600 bg-white shadow-sm border border-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}