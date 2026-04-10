"use client"

import { useState, useEffect } from "react"
import { LayoutDashboard, ClipboardList, Package, Menu, Pizza, ReceiptText, LogOut, LineChart, Lock, Unlock, CalendarDays } from "lucide-react"
import { supabase } from "@/lib/supabase"

import { Login } from "@/components/cmv/login"
import { Dashboard } from "@/components/cmv/dashboard"
import { Cadastros, type Produto } from "@/components/cmv/cadastros"
import { type LancamentosData } from "@/components/cmv/lancamentos"
import { OutrosCustosDRE } from "@/components/cmv/outros-custos-dre"
import { Estoque, type ContagemEstoque } from "@/components/cmv/estoque"
import { Relatorios } from "@/components/cmv/relatorios"

// Motor do tempo 
const calcularDataFim = (inicio: string) => {
  if (!inicio) return ""
  const d = new Date(inicio + "T12:00:00") // Fix de timezone
  d.setDate(d.getDate() + 6) // Crava exatos 7 dias de semana (Ex: Seg a Dom)
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
  
  // O utilizador só mexe no Início. O Fim é Automático!
  const [dataInicio, setDataInicio] = useState<string>(getSegundaFeiraPassada())
  const dataFim = calcularDataFim(dataInicio)

  // --- ESTADOS DA SENHA MASTER ---
  const [semanaDesbloqueada, setSemanaDesbloqueada] = useState(false)
  const [senhaInput, setSenhaInput] = useState("")

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [lancamentos, setLancamentos] = useState<any>({
    faturamento: 0, compras: [], saidas: [], outrosCustos: { embalagens: 0, consumoInterno: 0, consumoSocios: 0, testeMkt: 0, materialLimpeza: 0, desperdicios: 0 },
  })
  const [contagemInicial, setContagemInicial] = useState<ContagemEstoque>({})
  const [contagemFinal, setContagemFinal] = useState<ContagemEstoque>({})
  const [precosReferencia, setPrecosReferencia] = useState<Record<string, number>>({})

  const carregarDadosDoBanco = async () => {
    if (!dataInicio || !dataFim) return

    const { data: gData } = await supabase.from('grupos').select('*')
    const tradutorGrupos: Record<number, string> = {}
    if (gData) gData.forEach(g => { tradutorGrupos[g.id] = g.nome })

    const { data: pData } = await supabase.from('produtos').select('*').order('nome')
    if (pData) {
      setProdutos(pData.map(p => ({ id: p.id, nome: p.nome, unidade: p.unidade_medida, grupo: tradutorGrupos[p.grupo_id] || "Outros" })))
    }

    const { data: cData } = await supabase.from('compras').select('*, produtos(nome)').gte('data_compra', dataInicio).lte('data_compra', dataFim)
    const { data: sData } = await supabase.from('saidas_avulsas').select('*, produtos(nome)').gte('data_saida', dataInicio).lte('data_saida', dataFim)
    
    // Puxa as compras e as novas "Saídas Avulsas"
    setLancamentos((prev: any) => ({ 
        ...prev, 
        compras: cData ? cData.map(c => ({ id: c.id, produto: c.produtos?.nome || "Desconhecido", quantidade: c.quantidade, valorUnitario: c.valor_unitario, valorTotal: c.valor_total, data_compra: c.data_compra })) : [],
        saidas: sData ? sData.map(s => ({ id: s.id, produto: s.produtos?.nome || "Desconhecido", quantidade: s.quantidade, motivo: s.motivo, data_saida: s.data_saida })) : []
    }))

    const { data: precosData } = await supabase.from('compras').select('produto_id, valor_unitario').order('data_compra', { ascending: false })
    if (precosData) {
      const mapa: any = {}
      precosData.forEach(c => { if (!mapa[c.produto_id]) mapa[c.produto_id] = c.valor_unitario })
      setPrecosReferencia(mapa)
    }

    const { data: fData } = await supabase.from('financas_semanais').select('*').eq('data_inicio', dataInicio).eq('data_fim', dataFim).maybeSingle()
    if (fData) {
      setLancamentos((prev: any) => ({ ...prev, faturamento: fData.faturamento || 0, outrosCustos: { embalagens: fData.embalagens || 0, materialLimpeza: fData.material_limpeza || 0, desperdicios: fData.desperdicios || 0 }}))
    } else {
      setLancamentos((prev: any) => ({ ...prev, faturamento: 0, outrosCustos: { embalagens: 0, materialLimpeza: 0, desperdicios: 0 } }))
    }

    const { data: eData } = await supabase.from('estoques').select('*').gte('data_contagem', dataInicio).lte('data_contagem', dataFim)
    if (eData) {
      const inicial: any = {}; const final: any = {}
      eData.forEach(item => {
        // Agora guarda objeto com quantidade e valor!
        const val = { qtd: item.quantidade.toString(), valor: item.valor_unitario ? item.valor_unitario.toString() : "0" }
        if (item.tipo_contagem === 'Inicial') inicial[item.produto_id] = val
        else final[item.produto_id] = val
      })
      setContagemInicial(inicial); setContagemFinal(final)
    }
  }

  useEffect(() => { 
    carregarDadosDoBanco() 
    setSemanaDesbloqueada(false)
    setSenhaInput("")
  }, [dataInicio])

  const handleSalvarProdutoNoBanco = async (p: Produto) => {
    const { data: gData } = await supabase.from('grupos').select('id').eq('nome', p.grupo).single()
    const grupoId = gData ? gData.id : 5
    await supabase.from('produtos').insert([{ nome: p.nome, unidade_medida: p.unidade, grupo_id: grupoId }])
    carregarDadosDoBanco()
  }

  // Avanço automático do tempo (Pula para a segunda-feira seguinte!)
  const avancaSemanaAutomatica = () => {
    const proximaSegunda = new Date(dataFim + "T12:00:00")
    proximaSegunda.setDate(proximaSegunda.getDate() + 1)
    setDataInicio(proximaSegunda.toISOString().split('T')[0])
    setTela("dashboard")
    alert("✅ Semana fechada!")
  }

  const handleDesbloquear = () => {
    if (senhaInput === "1179") setSemanaDesbloqueada(true)
    else { alert("❌ Senha Incorreta!"); setSenhaInput("") }
  }

  const isSemanaFechada = Object.keys(contagemFinal).length > 0
  const precisaDeSenha = isSemanaFechada && !semanaDesbloqueada && ["estoque", "outros-custos"].includes(tela)

  return (
    <div className="min-h-screen bg-background flex">
      <aside className={`fixed h-full w-72 z-50 flex flex-col transition-transform lg:static bg-[#1E3A8A] shadow-2xl ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="px-6 py-8 text-[#FACC15] font-black text-2xl border-b border-white/10 flex items-center gap-3 italic">
          <Pizza className="w-8 h-8" /> CMV SAMPA
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "cadastros", label: "Cadastros", icon: ClipboardList },
            { id: "estoque", label: "Lançamentos da Semana", icon: Package }, // O NOVO MEGA COMPONENTE
            { id: "outros-custos", label: "Custos DRE", icon: ReceiptText },
            { id: "relatorios", label: "Relatórios", icon: LineChart } 
          ].map((item: any) => (
            <button 
              key={item.id} 
              onClick={() => { setTela(item.id); setSidebarOpen(false); }} 
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl font-bold transition-all ${tela === item.id ? "bg-[#FACC15] text-[#1E3A8A] shadow-lg scale-105" : "text-white/80 hover:bg-white/10"}`}
            >
              <item.icon /> {item.label}
              {isSemanaFechada && !semanaDesbloqueada && ["estoque", "outros-custos"].includes(item.id) && <Lock className="w-4 h-4 ml-auto opacity-50" />}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-4 px-5 py-4 rounded-xl font-bold text-white/50 hover:text-white hover:bg-red-500/20 transition-all">
            <LogOut /> Sair do Sistema
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-[#1E3A8A] border rounded-lg"><Menu /></button>
          <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border-2 transition-colors ${isSemanaFechada ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-100"}`}>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Início da Semana</span>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={`bg-transparent font-black text-sm outline-none cursor-pointer ${isSemanaFechada ? "text-red-700" : "text-[#1E3A8A]"}`} />
            </div>
            <span className="opacity-50 font-black text-lg">➔</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Fim da semana</span>
              <span className={`font-black text-sm ${isSemanaFechada ? "text-red-700" : "text-[#1E3A8A]"}`}>{dataFim.split('-').reverse().join('/')}</span>
            </div>
            {isSemanaFechada && <Lock className="w-4 h-4 text-red-500 ml-2" />}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50">
          
          {precisaDeSenha ? (
             <div className="flex flex-col items-center justify-center h-[70vh] animate-in fade-in zoom-in duration-300">
               <div className="bg-white p-8 rounded-3xl border-2 border-red-100 shadow-xl text-center max-w-md w-full">
                 <div className="mx-auto w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-inner"><Lock className="w-10 h-10" /></div>
                 <h2 className="text-2xl font-black text-slate-800 mb-2">Semana Fechada 🔒</h2>
                 <p className="text-slate-500 mb-8 font-medium">A contagem final desta semana já foi registada. Digite a senha master para desbloquear a edição.</p>
                 <input type="password" value={senhaInput} onChange={e => setSenhaInput(e.target.value)} placeholder="****" className="w-full text-center text-3xl tracking-[1em] font-black px-4 py-4 rounded-xl border-2 bg-slate-50 focus:border-red-500 outline-none mb-6"/>
                 <button onClick={handleDesbloquear} className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-700 text-white font-black text-lg rounded-xl transition-all shadow-md"><Unlock className="w-5 h-5" /> Desbloquear Edição</button>
               </div>
             </div>
          ) : (
            <>
              {tela === "dashboard" && <Dashboard dataInicio={dataInicio} dataFim={dataFim} lancamentos={lancamentos} contagemInicial={contagemInicial} contagemFinal={contagemFinal} produtos={produtos} precosReferencia={precosReferencia} onChangeFaturamento={carregarDadosDoBanco} />}
              {tela === "cadastros" && <Cadastros produtos={produtos} onAddProduto={handleSalvarProdutoNoBanco} />}
              {tela === "outros-custos" && <OutrosCustosDRE data={lancamentos} dataInicio={dataInicio} dataFim={dataFim} onChange={carregarDadosDoBanco} />}
              {tela === "relatorios" && <Relatorios produtos={produtos} />}
              {tela === "estoque" && (
                <Estoque 
                  dataInicio={dataInicio} 
                  dataFim={dataFim} 
                  produtos={produtos} 
                  data={lancamentos}
                  contagemInicial={contagemInicial} 
                  contagemFinal={contagemFinal} 
                  onChange={carregarDadosDoBanco} 
                  onSemanaFechada={avancaSemanaAutomatica}
                />
              )}
            </>
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
  return !sessao ? <Login /> : <CMVApp />
}