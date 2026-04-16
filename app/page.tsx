"use client"

import { useState, useEffect } from "react"
import { LayoutDashboard, ClipboardList, Package, Menu, Pizza, ReceiptText, LogOut, LineChart, CalendarDays, ShieldAlert, RefreshCw, ArrowRight, Lock, Edit3, Save, Unlock } from "lucide-react"
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
  const [modoAdminPassado, setModoAdminPassado] = useState(false)
  
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [semanaOficial, setSemanaOficial] = useState<string>("") 

  const [produtos, setProdutos] = useState<any[]>([])
  const [lancamentos, setLancamentos] = useState<any>({ faturamento: 0, compras: [], saidas: [], outrosCustos: {} })
  const [contagemInicial, setContagemInicial] = useState<ContagemEstoque>({})
  const [contagemFinal, setContagemFinal] = useState<ContagemEstoque>({})

  const isHistorico = dataInicio !== "" && semanaOficial !== "" && dataInicio !== semanaOficial
  const bloqueioAtivo = isHistorico && !modoAdminPassado

  useEffect(() => {
    const initApp = async () => {
      const { data } = await supabase.from('financas_semanais').select('*').order('data_inicio', { ascending: false }).limit(1)

      if (data && data.length > 0) {
        const ultima = data[0]
        if (ultima.status === 'Aberta') {
          setSemanaOficial(ultima.data_inicio)
          setDataInicio(ultima.data_inicio)
          setDataFim(ultima.data_fim)
          setSemanaAberta(true)
        } else {
          const d = new Date(ultima.data_inicio + "T12:00:00")
          d.setDate(d.getDate() + 7) 
          const proxima = d.toISOString().split('T')[0]
          
          setSemanaOficial(proxima)
          setDataInicio(proxima)
          setDataFim(calcularDataFim(proxima))
          setSemanaAberta(false)
        }
      } else {
        const proxima = getSegundaFeiraPassada()
        setSemanaOficial(proxima)
        setDataInicio(proxima)
        setDataFim(calcularDataFim(proxima))
        setSemanaAberta(false)
      }
      carregarProdutos()
    }
    initApp()
  }, [])

  useEffect(() => {
    if (dataInicio && dataFim && semanaAberta) {
      carregarDadosDoBanco()
    }
  }, [dataInicio, dataFim, semanaAberta])

  // --- BUSCA OS PRODUTOS AGORA TRAZENDO A "CAIXINHA" DE PRODUÇÃO INTERNA ---
  const carregarProdutos = async () => {
    const { data, error } = await supabase.from('produtos').select('*, grupos(nome)').order('nome')
    if (data) {
      setProdutos(data.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        unidade: p.unidade_medida, 
        grupo: p.grupos?.nome || 'Sem Grupo',
        grupo_id: p.grupo_id,
        producao_interna: p.producao_interna || false // Puxando o sinalizador!
      })))
    }
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
      outrosCustos: { embalagens: fRes.data?.embalagens || 0, materialLimpeza: fRes.data?.material_limpeza || 0, consumoSocios: fRes.data?.consumo_socios || 0 },
      compras: (cRes.data || []).map(c => ({ id: c.id, produto: c.produtos?.nome || "Insumo", quantidade: c.quantidade, valorUnitario: c.valor_unitario, valorTotal: c.quantidade * c.valor_unitario })),
      saidas: (sRes.data || []).map(s => ({ id: s.id, produto: s.produtos?.nome || "Insumo", quantidade: s.quantidade, motivo: s.motivo }))
    })
    setContagemInicial(inicial)
    setContagemFinal(final)
  }

  const iniciarSemana = async () => {
    toast.loading("Sincronizando...", { id: "sync" })
    const { data: existe } = await supabase.from('financas_semanais').select('id').eq('data_inicio', dataInicio).maybeSingle()

    if (!existe) {
      await supabase.from('financas_semanais').insert([{ data_inicio: dataInicio, data_fim: dataFim, status: 'Aberta' }])
    } else {
      await supabase.from('financas_semanais').update({ status: 'Aberta' }).eq('id', existe.id)
    }

    setSemanaAberta(true)
    toast.success("Ciclo destravado para todos!", { id: "sync" })
  }

  const handleSemanaFechada = async () => {
    setIsFechando(true)
    toast.loading("Fechando a semana...", { id: "fechamento" })
    await supabase.from('financas_semanais').update({ status: 'Fechada' }).eq('data_inicio', semanaOficial)

    setTimeout(() => {
      toast.success("Semana fechada!", { id: "fechamento" })
      window.location.reload()
    }, 1500)
  }

  const handleAtivarEdicaoPassado = () => {
    const senha = window.prompt("Digite a senha de autorização (1179):")
    if (senha === "1179") {
      setModoAdminPassado(true)
      toast.success("Modo Edição Liberado!")
    } else if (senha !== null) {
      toast.error("Senha incorreta!")
    }
  }

  const handleSairModoEdicao = () => {
    setModoAdminPassado(false)
    setDataInicio(semanaOficial)
    setDataFim(calcularDataFim(semanaOficial))
    toast.success("De volta à semana atual!")
  }

  if (!dataInicio) return null

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden font-sans">
      <Toaster position="bottom-right" />

      {isFechando && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white p-12 rounded-[40px] shadow-2xl flex flex-col items-center">
             <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
             <h3 className="text-2xl font-black text-slate-800">Processando Encerramento...</h3>
          </div>
        </div>
      )}

      {semanaAberta && (
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex flex-col h-full p-6">
            <div className="flex items-center gap-3 mb-10"><Pizza className="w-8 h-8 text-blue-500" /><h1 className="font-black text-xl text-white">Sampa Vilhena</h1></div>
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
              
              <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${isHistorico ? (modoAdminPassado ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200') : 'bg-slate-50 border-slate-200'}`}>
                {isHistorico ? (modoAdminPassado ? <Unlock className="w-5 h-5 text-amber-500" /> : <ShieldAlert className="w-5 h-5 text-red-500" />) : <CalendarDays className="w-5 h-5 text-blue-600" />}
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase ${isHistorico ? (modoAdminPassado ? 'text-amber-500' : 'text-red-500') : 'text-slate-400'}`}>
                    {isHistorico ? (modoAdminPassado ? 'Editando Passado (Admin)' : 'Auditando Passado') : 'Semana Atual'}
                  </span>
                  <input 
                    type="date" 
                    value={dataInicio} 
                    onChange={(e) => {
                      setDataInicio(e.target.value); 
                      setDataFim(calcularDataFim(e.target.value));
                      if (e.target.value === semanaOficial) setModoAdminPassado(false);
                    }} 
                    className="font-black text-sm bg-transparent outline-none cursor-pointer text-slate-800" 
                  />
                </div>
              </div>
              
              {isHistorico && !modoAdminPassado && (
                <div className="flex items-center gap-2">
                  <button onClick={() => {setDataInicio(semanaOficial); setDataFim(calcularDataFim(semanaOficial));}} className="bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-300 transition-colors">
                    Voltar p/ Atual <ArrowRight className="w-4 h-4"/>
                  </button>
                  <button onClick={handleAtivarEdicaoPassado} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-800 shadow-sm transition-all">
                    <Edit3 className="w-4 h-4"/> Editar Passado
                  </button>
                </div>
              )}

              {modoAdminPassado && (
                <button onClick={handleSairModoEdicao} className="bg-amber-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-amber-600 shadow-lg animate-pulse transition-all">
                  <Save className="w-4 h-4"/> Salvar e Voltar p/ Atual
                </button>
              )}

            </div>
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-md hidden md:flex">SV</div>
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
                  <p className="text-slate-500 mb-8 font-medium">Verifique a data. Ela será aberta para todos os usuários.</p>
                  
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
                  onRefresh={carregarProdutos} 
                  isReadOnly={bloqueioAtivo} 
                />
              )}
              
              {tela === "outros-custos" && <OutrosCustosDRE data={lancamentos} dataInicio={dataInicio} dataFim={dataFim} onChange={carregarDadosDoBanco} isReadOnly={bloqueioAtivo} />}
              {tela === "relatorios" && <Relatorios produtos={produtos} />}
              {tela === "estoque" && (
                <Estoque 
                  dataInicio={dataInicio} dataFim={dataFim} produtos={produtos} data={lancamentos} 
                  contagemInicial={contagemInicial} contagemFinal={contagemFinal} 
                  onChange={carregarDadosDoBanco} onSemanaFechada={handleSemanaFechada} 
                  isReadOnly={bloqueioAtivo} 
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}