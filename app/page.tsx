"use client"

import { useState, useEffect } from "react"
import { LayoutDashboard, ClipboardList, Package, Menu, Pizza, ReceiptText, LogOut, LineChart, CalendarDays, ShieldAlert, RefreshCw, ArrowRight, Lock, Edit3 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Toaster, toast } from 'react-hot-toast'

import { Login } from "@/components/cmv/login"
import { Dashboard } from "@/components/cmv/dashboard"
import { Cadastros } from "@/components/cmv/cadastros"
import { OutrosCustosDRE } from "@/components/cmv/outros-custos-dre"
import { Estoque, type ContagemEstoque } from "@/components/cmv/estoque"
import { Relatorios } from "@/components/cmv/relatorios"

const calcularDataFim = (inicio: string) => {
  if (!inicio) return ""
  const d = new Date(inicio + "T12:00:00")
  d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}

const getSegundaFeiraPassada = () => {
  const d = new Date()
  const dia = d.getDay()
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1) - 7
  return new Date(d.setDate(diff)).toISOString().split('T')[0]
}

export default function Page() {
  const [sessao, setSessao] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSessao(session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSessao(session))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null
  return sessao ? <CMVApp /> : <Login />
}

function CMVApp() {
  const [tela, setTela] = useState<string>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isFechando, setIsFechando] = useState(false)
  
  const [semanaAberta, setSemanaAberta] = useState(false) 
  
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [semanaOficial, setSemanaOficial] = useState<string>("") 

  const [produtos, setProdutos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([]) 
  const [lancamentos, setLancamentos] = useState<any>({ faturamento: 0, compras: [], saidas: [], outrosCustos: {} })
  const [contagemInicial, setContagemInicial] = useState<ContagemEstoque>({})
  const [contagemFinal, setContagemFinal] = useState<ContagemEstoque>({})

  const isReadOnly = dataInicio !== "" && semanaOficial !== "" && dataInicio !== semanaOficial

  useEffect(() => {
    const initApp = async () => {
      const savedInicio = localStorage.getItem('sampa_dataInicio')
      const savedAberta = localStorage.getItem('sampa_semanaAberta')
      
      if (savedAberta === 'true' && savedInicio) {
        setSemanaOficial(savedInicio)
        setDataInicio(savedInicio)
        setDataFim(calcularDataFim(savedInicio))
        setSemanaAberta(true)
      } else {
        const { data } = await supabase.from('financas_semanais').select('data_inicio').order('data_inicio', { ascending: false }).limit(1)
        let dataSugerida = ""

        if (data && data.length > 0) {
           const ultimaFechada = data[0].data_inicio
           const d = new Date(ultimaFechada + "T12:00:00")
           d.setDate(d.getDate() + 7) 
           dataSugerida = d.toISOString().split('T')[0]
        } else {
           dataSugerida = getSegundaFeiraPassada()
        }
        
        setSemanaOficial(dataSugerida)
        setDataInicio(dataSugerida)
        setDataFim(calcularDataFim(dataSugerida))
        setSemanaAberta(false)
      }
      carregarTudo()
    }
    initApp()
  }, [])

  useEffect(() => {
    if (dataInicio && dataFim && semanaAberta) {
      carregarDadosDoBanco()
    }
  }, [dataInicio, dataFim, semanaAberta])

  const carregarTudo = async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('produtos').select('*').order('nome'),
      supabase.from('categorias').select('*').order('nome')
    ])
    if (prods) setProdutos(prods)
    if (cats) setCategorias(cats)
  }

  const handleSalvarCategoria = async (nome: string) => {
    if (isReadOnly) return toast.error("Período travado!")
    const { error } = await supabase.from('categorias').insert([{ nome }])
    if (error) toast.error("Erro ao salvar categoria. Pode já existir.")
    else { toast.success("Categoria salva!"); carregarTudo(); }
  }

  const handleExcluirCategoria = async (id: number) => {
    if (isReadOnly) return toast.error("Período travado!")
    if (!confirm("Excluir esta categoria?")) return
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) toast.error("Erro ao excluir!")
    else { toast.success("Categoria removida!"); carregarTudo(); }
  }

  const handleSalvarProdutoNoBanco = async (novoProd: any) => {
    if (isReadOnly) return toast.error("Período travado!")
    const { id, ...produtoLimpo } = novoProd
    const { error } = await supabase.from('produtos').insert([produtoLimpo])
    if (error) toast.error("Erro ao salvar: " + error.message)
    else { toast.success("Produto salvo!"); carregarTudo(); }
  }

  const handleEditarProdutoNoBanco = async (id: number, dadosEditados: any) => {
    if (isReadOnly) return toast.error("Período travado!")
    const { error } = await supabase.from('produtos').update(dadosEditados).eq('id', id)
    if (error) toast.error("Erro ao atualizar: " + error.message)
    else { toast.success("Produto atualizado!"); carregarTudo(); }
  }

  const handleExcluirProdutoNoBanco = async (id: number) => {
    if (isReadOnly) return toast.error("Período travado!")
    if (!confirm("Tem certeza que deseja excluir este produto?")) return
    const { error } = await supabase.from('produtos').delete().eq('id', id)
    if (error) toast.error("Erro ao excluir!")
    else { toast.success("Produto removido!"); carregarTudo(); }
  }

  const carregarDadosDoBanco = async () => {
    const [fRes, cRes, sRes, eRes] = await Promise.all([
      supabase.from('financas_semanais').select('*').eq('data_inicio', dataInicio).maybeSingle(),
      supabase.from('compras').select('*, produtos(nome)').gte('data_compra', dataInicio).lte('data_compra', dataFim),
      supabase.from('saidas_avulsas').select('*, produtos(nome)').gte('data_saida', dataInicio).lte('data_saida', dataFim),
      supabase.from('estoques').select('*').gte('data_contagem', dataInicio).lte('data_contagem', dataFim)
    ])

    const inicial: ContagemEstoque = {}
    const final: ContagemEstoque = {}
    if (eRes.data) {
      eRes.data.forEach(item => {
        const val = { qtd: item.quantidade.toString(), valor: item.valor_unitario.toString() }
        if (item.tipo_contagem === 'Inicial') inicial[item.produto_id] = val
        else if (item.tipo_contagem === 'Final') final[item.produto_id] = val
      })
    }

    setLancamentos({
      faturamento: fRes.data?.faturamento || 0,
      outrosCustos: { embalagens: fRes.data?.embalagens || 0, materialLimpeza: fRes.data?.material_limpeza || 0 },
      compras: (cRes.data || []).map(c => ({ id: c.id, produto: c.produtos?.nome || "Insumo", quantidade: c.quantidade, valorUnitario: c.valor_unitario, valorTotal: c.quantidade * c.valor_unitario })),
      saidas: (sRes.data || []).map(s => ({ id: s.id, produto: s.produtos?.nome || "Insumo", quantidade: s.quantidade, motivo: s.motivo }))
    })
    setContagemInicial(inicial)
    setContagemFinal(final)
  }

  const iniciarSemana = () => {
    setSemanaAberta(true)
    localStorage.setItem('sampa_semanaAberta', 'true')
    localStorage.setItem('sampa_dataInicio', dataInicio)
    toast.success("Ciclo iniciado!")
  }

  const handleSemanaFechada = () => {
    setIsFechando(true)
    setTimeout(() => {
      const d = new Date(semanaOficial + "T12:00:00")
      d.setDate(d.getDate() + 7)
      const novaSegunda = d.toISOString().split('T')[0]
      
      setSemanaOficial(novaSegunda)
      setDataInicio(novaSegunda)
      setDataFim(calcularDataFim(novaSegunda))
      
      localStorage.removeItem('sampa_semanaAberta')
      localStorage.removeItem('sampa_dataInicio')
      setSemanaAberta(false) 
      
      setIsFechando(false)
      setTela("dashboard")
    }, 1500)
  }

  if (!dataInicio) return null

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden font-sans">
      <Toaster position="bottom-right" />

      {isFechando && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-12 rounded-[40px] shadow-2xl flex flex-col items-center">
             <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
             <h3 className="text-2xl font-black text-slate-800">Iniciando Próximo Ciclo...</h3>
          </div>
        </div>
      )}

      {semanaAberta && (
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex flex-col h-full p-6">
            <div className="flex items-center gap-3 mb-10"><Pizza className="w-8 h-8 text-blue-500" /><h1 className="font-black text-xl text-white">Sampa Cacoal</h1></div>
            <nav className="flex-1 space-y-2">
              {[
                { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                { id: "estoque", label: "Estoque/Compras", icon: ClipboardList },
                { id: "cadastros", label: "Produtos", icon: Package },
                { id: "outros-custos", label: "DRE Mensal", icon: ReceiptText },
                { id: "relatorios", label: "Relatórios", icon: LineChart },
              ].map(item => (
                <button key={item.id} onClick={() => {setTela(item.id); setSidebarOpen(false)}} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all ${tela === item.id ? "bg-blue-600 text-white" : "hover:bg-white/10"}`}>
                  <item.icon className="w-5 h-5" /> {item.label}
                </button>
              ))}
            </nav>
            <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-400"><LogOut className="w-5 h-5"/> Sair</button>
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {semanaAberta && (
          <header className="h-20 bg-white border-b flex items-center justify-between px-8 shadow-sm">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-500"><Menu /></button>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${isReadOnly ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                {isReadOnly ? <ShieldAlert className="w-5 h-5 text-red-500" /> : <CalendarDays className="w-5 h-5 text-blue-600" />}
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase ${isReadOnly ? 'text-red-500' : 'text-slate-400'}`}>{isReadOnly ? 'Auditando Passado' : 'Semana Atual'}</span>
                  <input type="date" value={dataInicio} onChange={(e) => {setDataInicio(e.target.value); setDataFim(calcularDataFim(e.target.value));}} className="font-black text-sm bg-transparent outline-none cursor-pointer text-slate-800" />
                </div>
              </div>
              
              {/* O CÓDIGO DA VACINA ESTÁ AQUI NESTE BOTÃO 👇 */}
              {isReadOnly && (
                <button 
                  onClick={() => {
                    setDataInicio(semanaOficial); 
                    setDataFim(calcularDataFim(semanaOficial)); 
                    localStorage.setItem('sampa_dataInicio', semanaOficial); // Isso apaga a memória errada do PC dele!
                    toast.success("Sincronizado! O sistema voltou ao normal.");
                  }} 
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                  Voltar p/ Atual <ArrowRight className="w-4 h-4"/>
                </button>
              )}
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
          {!semanaAberta ? (
            <div className="min-h-[80vh] flex flex-col items-center justify-center">
               <div className="bg-white p-12 rounded-[40px] shadow-2xl border flex flex-col items-center text-center max-w-md w-full animate-in fade-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                    <Lock className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-800 mb-2">Iniciar Novo Ciclo</h2>
                  <p className="text-slate-500 mb-8 font-medium">Sugerimos a data abaixo, mas você pode ajustá-la se necessário.</p>
                  
                  <div className="w-full text-left mb-8 group">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4 flex items-center gap-1">
                      Data de Início <Edit3 className="w-3 h-3"/>
                    </label>
                    <input 
                      type="date" 
                      value={dataInicio} 
                      onChange={(e) => {
                        setDataInicio(e.target.value); 
                        setDataFim(calcularDataFim(e.target.value));
                      }} 
                      className="w-full p-4 rounded-2xl bg-white border-2 border-slate-200 font-black text-2xl text-center outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all mt-1 text-slate-800" 
                    />
                  </div>

                  <button onClick={iniciarSemana} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg hover:scale-[1.02] hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
                    Confirmar e Acessar <ArrowRight className="w-5 h-5"/>
                  </button>
               </div> 
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">
              {tela === "dashboard" && <Dashboard dataInicio={dataInicio} dataFim={dataFim} lancamentos={lancamentos} contagemInicial={contagemInicial} contagemFinal={contagemFinal} produtos={produtos} />}
              
              {tela === "cadastros" && (
                <Cadastros 
                  produtos={produtos} 
                  categorias={categorias} 
                  onAddProduto={handleSalvarProdutoNoBanco} 
                  onEditProduto={handleEditarProdutoNoBanco} 
                  onDeleteProduto={handleExcluirProdutoNoBanco} 
                  onAddCategoria={handleSalvarCategoria} 
                  onDeleteCategoria={handleExcluirCategoria} 
                  isReadOnly={isReadOnly} 
                />
              )}
              
              {tela === "outros-custos" && <OutrosCustosDRE data={lancamentos} dataInicio={dataInicio} dataFim={dataFim} onChange={carregarDadosDoBanco} isReadOnly={isReadOnly} />}
              {tela === "relatorios" && <Relatorios produtos={produtos} />}
              {tela === "estoque" && (
                <Estoque 
                  dataInicio={dataInicio} dataFim={dataFim} produtos={produtos} data={lancamentos} 
                  contagemInicial={contagemInicial} contagemFinal={contagemFinal} 
                  onChange={carregarDadosDoBanco} onSemanaFechada={handleSemanaFechada} 
                  isReadOnly={isReadOnly} 
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}