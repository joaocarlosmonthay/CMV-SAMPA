"use client"

import { useState, useEffect } from "react"
import { LayoutDashboard, ClipboardList, Package, Menu, Pizza, ReceiptText, LogOut, LineChart, CalendarDays, CheckCircle2, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react"
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

function CMVApp() {
  const [tela, setTela] = useState<string>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const [semanaAberta, setSemanaAberta] = useState(false)
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  
  // ESTADO PARA A TELA DE CARREGAMENTO PREMIUM
  const [isFechando, setIsFechando] = useState(false)

  const [produtos, setProdutos] = useState<any[]>([])
  const [lancamentos, setLancamentos] = useState<any>({ faturamento: 0, compras: [], saidas: [], outrosCustos: {} })
  const [contagemInicial, setContagemInicial] = useState<ContagemEstoque>({})
  const [contagemFinal, setContagemFinal] = useState<ContagemEstoque>({})

  useEffect(() => {
    const savedInicio = localStorage.getItem('sampa_dataInicio')
    const savedAberta = localStorage.getItem('sampa_semanaAberta')
    
    if (savedAberta === 'true' && savedInicio) {
      setDataInicio(savedInicio)
      setDataFim(calcularDataFim(savedInicio))
      setSemanaAberta(true)
    } else {
      const inicial = getSegundaFeiraPassada()
      setDataInicio(inicial)
      setDataFim(calcularDataFim(inicial))
    }
    carregarProdutos()
  }, [])

  useEffect(() => {
    if (semanaAberta && dataInicio && dataFim) {
      carregarDadosDoBanco()
    }
  }, [semanaAberta, dataInicio, dataFim])

  const carregarProdutos = async () => {
    const { data } = await supabase.from('produtos').select('*').order('nome')
    if (data) setProdutos(data)
  }

  const handleSalvarProdutoNoBanco = async (novoProd: any) => {
    const { error } = await supabase.from('produtos').insert([novoProd])
    if (error) {
      toast.error("Vixe, deu erro ao salvar: " + error.message)
    } else {
      toast.success("Boa! Ingrediente cadastrado no sistema.")
      carregarProdutos()
    }
  }

  const carregarDadosDoBanco = async () => {
    const [fRes, cRes, sRes, eRes] = await Promise.all([
      supabase.from('financas_semanais').select('*').eq('data_inicio', dataInicio).eq('data_fim', dataFim).maybeSingle(),
      supabase.from('compras').select('*, produtos(nome)').gte('data_compra', dataInicio).lte('data_compra', dataFim),
      supabase.from('saidas_avulsas').select('*, produtos(nome)').gte('data_saida', dataInicio).lte('data_saida', dataFim),
      supabase.from('estoques').select('*').gte('data_contagem', dataInicio).lte('data_contagem', dataFim)
    ])

    const inicial: ContagemEstoque = {}
    const final: ContagemEstoque = {}
    if (eRes.data) {
      eRes.data.forEach(item => {
        if (item.tipo_contagem === 'Inicial') inicial[item.produto_id] = { qtd: item.quantidade.toString(), valor: item.valor_unitario.toString() }
        else if (item.tipo_contagem === 'Final') final[item.produto_id] = { qtd: item.quantidade.toString(), valor: item.valor_unitario.toString() }
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
    toast.success("Sistema destravado! Excelente semana de vendas. 🚀")
  }

  // =======================================================================
  // A MÁGICA DA TRANSIÇÃO SUAVE (ANIMAÇÃO PREMIUM)
  // =======================================================================
  const handleSemanaFechada = () => {
    setIsFechando(true)

    setTimeout(() => {
      const dataAtual = new Date(dataInicio + "T12:00:00")
      dataAtual.setDate(dataAtual.getDate() + 7)
      const novaSegunda = dataAtual.toISOString().split('T')[0]

      localStorage.removeItem('sampa_semanaAberta')
      localStorage.removeItem('sampa_dataInicio')
      
      setDataInicio(novaSegunda)
      setDataFim(calcularDataFim(novaSegunda))
      setSemanaAberta(false)
      setTela("dashboard")
      
      setIsFechando(false)
      toast.success("Métrica cravada! O próximo ciclo já está pronto.", { duration: 5000 })
    }, 2500)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.clear()
  }

  const precosReferencia = lancamentos.compras.reduce((acc: any, c: any) => {
    const prod = produtos.find(p => p.nome === c.produto)
    if (prod) acc[String(prod.id)] = c.valorUnitario
    return acc
  }, {})

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden relative font-sans">
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: { background: '#0F172A', color: '#fff', borderRadius: '16px', fontWeight: 'bold', padding: '16px 24px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' },
          success: { style: { background: '#059669' } },
          error: { style: { background: '#E11D48' } },
        }} 
      />

      {/* OVERLAY DE CARREGAMENTO PREMIUM */}
      {isFechando && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-500">
          <div className="bg-white/90 backdrop-blur-xl p-12 rounded-[40px] shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center space-y-6 border border-white">
             <div className="w-24 h-24 relative flex items-center justify-center">
               <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
               <RefreshCw className="w-8 h-8 text-blue-600 absolute animate-pulse" />
             </div>
             <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Consolidando Dados</h3>
                <p className="text-slate-500 font-medium mt-2 leading-relaxed">Fechando o estoque e gerando o DRE oficial da semana...</p>
             </div>
          </div>
        </div>
      )}

      {/* SIDEBAR CORPORATIVA PREMIUM */}
      {semanaAberta && (
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-gradient-to-b from-[#1E3A8A] to-[#0B1736] text-slate-300 transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} shadow-2xl lg:shadow-none border-r border-blue-900/50`}>
          <div className="flex flex-col h-full p-6">
            {/* Logo Area */}
            <div className="flex items-center gap-3 mb-10 mt-2 px-2">
              <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-500/30">
                <Pizza className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-black text-2xl text-white tracking-tight leading-none">Pizzaria Sampa</h1>
                <span className="text-blue-300 font-bold text-xs tracking-[0.2em] uppercase"></span>
              </div>
            </div>

            {/* Navegação */}
            <nav className="flex-1 space-y-2">
              <p className="px-4 text-[10px] font-black tracking-widest text-blue-400/60 uppercase mb-4 mt-8">Menu Principal</p>
              {[
                { id: "dashboard", label: "Visão Geral", icon: LayoutDashboard },
                { id: "estoque", label: "Lançamentos", icon: ClipboardList },
                { id: "cadastros", label: "Cadastros", icon: Package },
                { id: "outros-custos", label: "DRE / Custos", icon: ReceiptText },
                { id: "relatorios", label: "Análise Mensal", icon: LineChart },
              ].map(item => (
                <button 
                  key={item.id} 
                  onClick={() => { setTela(item.id); setSidebarOpen(false); }} 
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold transition-all relative group ${tela === item.id ? "bg-blue-600/20 text-white" : "hover:bg-white/5 hover:text-white"}`}
                >
                  {/* Indicador Lateral Premium */}
                  {tela === item.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                  )}
                  <item.icon className={`w-5 h-5 transition-colors ${tela === item.id ? "text-blue-400" : "text-slate-400 group-hover:text-blue-300"}`} /> 
                  <span className="tracking-wide">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Rodapé / Sair */}
            <div className="mt-auto pt-6 border-t border-blue-800/50">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 font-bold hover:bg-red-500/10 hover:text-red-400 rounded-2xl transition-all group">
                <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform"/> 
                <span>Encerrar Sessão</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* HEADER GLASSMORPHISM */}
        {semanaAberta && (
          <header className="h-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-30 flex items-center justify-between px-8 shadow-sm">
            <div className="flex items-center gap-4">
               <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"><Menu /></button>
               
               {/* Selo de Segurança de Data */}
               <div className="hidden sm:flex items-center gap-4 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-200 shadow-inner">
                  <div className="bg-emerald-100 p-1.5 rounded-lg">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Semana Auditada</span>
                    <span className="font-black text-slate-800 text-sm mt-0.5">{dataInicio.split('-').reverse().join('/')} <span className="text-slate-300 font-normal mx-1">até</span> {dataFim.split('-').reverse().join('/')}</span>
                  </div>
               </div>
            </div>

            {/* Placeholder de Usuário Elegante */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-slate-800">VILHENA</p>
                <p className="text-[10px] font-bold text-slate-400">Pizzaria Sampa</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-white shadow-sm rounded-full flex items-center justify-center text-blue-700 font-black">
                PS
              </div>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50">
          {!semanaAberta ? (
            /* TELA INICIAL (O "UAU" FACTOR) */
            <div className="min-h-[80vh] flex flex-col items-center justify-center relative animate-in fade-in duration-700">
               
               {/* Efeitos de Luz de Fundo (Padrão Apple/Vercel) */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none"></div>
               <div className="absolute top-1/2 left-1/2 -translate-x-[10%] -translate-y-[80%] w-[400px] h-[400px] bg-emerald-400/10 blur-[100px] rounded-full pointer-events-none"></div>

               <div className="relative bg-white/80 backdrop-blur-2xl p-10 sm:p-14 rounded-[40px] shadow-2xl border border-white flex flex-col items-center text-center max-w-xl w-full mx-4">
                  
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-white mb-8 rotate-3 hover:rotate-0 transition-transform duration-300">
                    <CalendarDays className="w-10 h-10" />
                  </div>
                  
                  <h2 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight mb-4">Novo Ciclo Operacional</h2>
                  <p className="text-slate-500 font-medium text-lg mb-10 max-w-sm">O sistema já preparou as métricas e o calendário oficial para a sua próxima semana.</p>
                  
                  <div className="w-full bg-slate-50 rounded-3xl p-6 border border-slate-100 mb-10 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Período Selecionado</p>
                    <div className="flex items-center gap-4 text-2xl sm:text-3xl font-black text-[#1E3A8A]">
                      <span>{dataInicio.split('-').reverse().join('/')}</span>
                      <ArrowRight className="w-6 h-6 text-slate-300" />
                      <span>{dataFim.split('-').reverse().join('/')}</span>
                    </div>
                  </div>

                  <button 
                    onClick={iniciarSemana} 
                    className="w-full bg-gradient-to-r from-[#1E3A8A] to-blue-700 text-white py-6 rounded-2xl font-black text-xl shadow-[0_20px_40px_-15px_rgba(30,58,138,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(30,58,138,0.7)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                  >
                    Desbloquear Sistema
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </button>
                  
                  <div className="flex items-center gap-2 mt-6 text-xs text-slate-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    Auditoria de datas ativada e segura
                  </div>
               </div>
            </div>
          ) : (
            /* CONTEÚDO PRINCIPAL (DASHBOARDS E ABAS) */
            <div className="max-w-[1600px] mx-auto">
              {tela === "dashboard" && <Dashboard dataInicio={dataInicio} dataFim={dataFim} lancamentos={lancamentos} contagemInicial={contagemInicial} contagemFinal={contagemFinal} produtos={produtos} precosReferencia={precosReferencia} />}
              {tela === "cadastros" && <Cadastros produtos={produtos} onAddProduto={handleSalvarProdutoNoBanco} />}
              {tela === "outros-custos" && <OutrosCustosDRE data={lancamentos} dataInicio={dataInicio} dataFim={dataFim} onChange={carregarDadosDoBanco} />}
              {tela === "relatorios" && <Relatorios produtos={produtos} />}
              {tela === "estoque" && (
                <Estoque 
                  dataInicio={dataInicio} dataFim={dataFim} produtos={produtos} data={lancamentos} contagemInicial={contagemInicial} contagemFinal={contagemFinal} onChange={carregarDadosDoBanco} 
                  onSemanaFechada={handleSemanaFechada} 
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
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