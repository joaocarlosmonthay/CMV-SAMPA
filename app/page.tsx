"use client"

import { useState, useEffect } from "react"
import { LayoutDashboard, ClipboardList, ShoppingCart, Package, Menu, X, Pizza, ReceiptText, LogOut } from "lucide-react"

import { supabase } from "@/lib/supabase"

import { Login } from "@/components/cmv/login"
import { Dashboard } from "@/components/cmv/dashboard"
import { Cadastros, type Produto } from "@/components/cmv/cadastros"
import { type LancamentosData } from "@/components/cmv/lancamentos"
import { ComprasCMV } from "@/components/cmv/compras-cmv"
import { OutrosCustasDRE } from "@/components/cmv/outros-custos-dre"
import { Estoque, type ContagemEstoque } from "@/components/cmv/estoque"

type Tela = "dashboard" | "cadastros" | "compras" | "outros-custos" | "estoque"

const navItems: { id: Tela; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "cadastros", label: "Cadastros", icon: ClipboardList },
  { id: "compras", label: "Compras (CMV)", icon: ShoppingCart },
  { id: "outros-custos", label: "Outros Custos (DRE)", icon: ReceiptText },
  { id: "estoque", label: "Estoque", icon: Package },
]

const getHoje = () => new Date().toISOString().split('T')[0]
const getSeteDiasAtras = () => {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

// ========================================================
// 1. O NOSSO APLICATIVO PRINCIPAL (ESCONDIDO ATRÁS DO LOGIN)
// ========================================================
function CMVApp() {
  const [tela, setTela] = useState<Tela>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const [dataInicio, setDataInicio] = useState(getSeteDiasAtras())
  const [dataFim, setDataFim] = useState(getHoje())

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentosData>({
    faturamento: 0, compras: [], outrosCustos: { embalagens: 0, consumoInterno: 0, testeMkt: 0, materialLimpeza: 0, desperdicios: 0 },
  })
  const [contagemInicial, setContagemInicial] = useState<ContagemEstoque>({})
  const [contagemFinal, setContagemFinal] = useState<ContagemEstoque>({})
  const [precosReferencia, setPrecosReferencia] = useState<Record<string, number>>({})

  const carregarDadosDoBanco = async () => {
    // Busca tudo do Supabase (código intocável que já tínhamos)
    const { data: pData } = await supabase.from('produtos').select('*').order('nome')
    if (pData) {
      const tradutor: any = { 1: "Carnes", 2: "Laticínios", 3: "Massas", 4: "Hortifruti", 5: "Outros" }
      setProdutos(pData.map(p => ({ id: p.id.toString(), nome: p.nome, unidade: p.unidade_medida, grupo: tradutor[p.grupo_id] || "Outros" })))
    }

    const { data: cData } = await supabase.from('compras').select('*, produtos(nome)').gte('data_compra', dataInicio).lte('data_compra', dataFim)
    if (cData) {
      setLancamentos(prev => ({ ...prev, compras: cData.map(c => ({ id: c.id, produto: c.produtos?.nome || "Desconhecido", quantidade: c.quantidade, valorUnitario: c.valor_unitario, valorTotal: c.valor_total }))}))
    }

    const { data: precosData } = await supabase.from('compras').select('produto_id, valor_unitario, data_compra').order('data_compra', { ascending: false })
    if (precosData) {
      const mapaPrecos: Record<string, number> = {}
      precosData.forEach(c => { const idStr = c.produto_id.toString(); if (!mapaPrecos[idStr]) mapaPrecos[idStr] = c.valor_unitario })
      setPrecosReferencia(mapaPrecos)
    }

    const { data: fData } = await supabase.from('financas_semanais').select('*').eq('data_inicio', dataInicio).eq('data_fim', dataFim).maybeSingle()
    if (fData) {
      setLancamentos(prev => ({ ...prev, faturamento: fData.faturamento || 0, outrosCustos: { embalagens: fData.embalagens || 0, consumoInterno: fData.consumo_interno || 0, testeMkt: fData.teste_mkt || 0, materialLimpeza: fData.material_limpeza || 0, desperdicios: fData.desperdicios || 0 }}))
    } else {
      setLancamentos(prev => ({ ...prev, faturamento: 0, outrosCustos: { embalagens: 0, consumoInterno: 0, testeMkt: 0, materialLimpeza: 0, desperdicios: 0 } }))
    }

    const { data: eData } = await supabase.from('estoques').select('*').gte('data_contagem', dataInicio).lte('data_contagem', dataFim)
    if (eData) {
      const inicial: ContagemEstoque = {}; const final: ContagemEstoque = {}
      eData.forEach(item => { if (item.tipo_contagem === 'Inicial') inicial[item.produto_id] = item.quantidade.toString(); else final[item.produto_id] = item.quantidade.toString() })
      setContagemInicial(inicial); setContagemFinal(final)
    }
  }

  const handlePuxarEstoqueAnterior = async () => {
    const { data } = await supabase.from('estoques').select('*').eq('tipo_contagem', 'Final').lt('data_contagem', dataInicio).order('data_contagem', { ascending: false })
    if (data && data.length > 0) {
      const heranca: ContagemEstoque = {}; const ultimaData = data[0].data_contagem
      data.filter(d => d.data_contagem === ultimaData).forEach(item => { heranca[item.produto_id] = item.quantidade.toString() })
      setContagemInicial(heranca)
      return true
    }
    return false
  }

  useEffect(() => { carregarDadosDoBanco() }, [dataInicio, dataFim])

  const handleSalvarProdutoNoBanco = async (novoProduto: Produto) => {
    let idDoGrupo = 5; const nomeG = (novoProduto as any).grupo || "";
    if (nomeG.includes("Carne")) idDoGrupo = 1; else if (nomeG.includes("Latic")) idDoGrupo = 2; else if (nomeG.includes("Massa")) idDoGrupo = 3; else if (nomeG.includes("Horti")) idDoGrupo = 4;
    const { error } = await supabase.from('produtos').insert([{ nome: novoProduto.nome, unidade_medida: (novoProduto as any).unidade, grupo_id: idDoGrupo }])
    if (!error) { alert("Produto Salvo!"); carregarDadosDoBanco(); }
  }

  const telaAtual = navItems.find((n) => n.id === tela)

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`} style={{ backgroundColor: "#9B2B1F" }}>
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/15">
          <div className="p-2 rounded-xl bg-white/20"><Pizza className="w-7 h-7 text-white" /></div>
          <div><p className="text-white font-extrabold text-lg leading-tight">CMV SAMPA</p></div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden p-2 text-white"><X className="w-5 h-5" /></button>
        </div>
        
        {/* Menu Late al */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setTela(id); setSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left font-semibold ${tela === id ? "bg-white text-[#9B2B1F]" : "text-white/85 hover:bg-white/15"}`}>
              <Icon className="w-6 h-6" /> {label}
            </button>
          ))}
        </nav>

        {/* Botão de Sair no fundo do menu */}
        <div className="p-4 border-t border-white/15">
          <button 
            onClick={() => supabase.auth.signOut()} 
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left font-semibold text-white/80 hover:bg-white/15 transition-colors"
          >
            <LogOut className="w-6 h-6" /> Sair do Sistema
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-card border-b px-4 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 border-2 rounded-xl"><Menu className="w-6 h-6" /></button>
            {telaAtual && <div className="hidden sm:flex items-center gap-2"><telaAtual.icon className="w-6 h-6 text-[#C0392B]" /><span className="text-xl font-bold">{telaAtual.label}</span></div>}
          </div>
          
          <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-xl border-2 border-border shadow-inner">
            <span className="text-sm font-bold text-muted-foreground hidden md:block">Semana de:</span>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-transparent font-bold text-sm text-[#C0392B] outline-none" />
            <span className="text-muted-foreground font-semibold">até</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-transparent font-bold text-sm text-[#C0392B] outline-none" />
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-8 overflow-y-auto">
          {tela === "dashboard" && <Dashboard dataInicio={dataInicio} dataFim={dataFim} lancamentos={lancamentos} contagemInicial={contagemInicial} contagemFinal={contagemFinal} produtos={produtos} precosReferencia={precosReferencia} onChangeFaturamento={() => carregarDadosDoBanco()} />}
          {tela === "cadastros" && <Cadastros produtos={produtos} onAddProduto={handleSalvarProdutoNoBanco} />}
          {tela === "compras" && <ComprasCMV produtos={produtos} data={lancamentos} onChange={() => carregarDadosDoBanco()} />}
          {tela === "outros-custos" && <OutrosCustasDRE data={lancamentos} onChange={() => carregarDadosDoBanco()} />}
          {tela === "estoque" && <Estoque dataInicio={dataInicio} dataFim={dataFim} produtos={produtos} contagemInicial={contagemInicial} contagemFinal={contagemFinal} onSalvarInicial={() => carregarDadosDoBanco()} onSalvarFinal={() => carregarDadosDoBanco()} onPuxarAnterior={handlePuxarEstoqueAnterior} />}
        </main>
      </div>
    </div>
  )
}

// ========================================================
// 2. O PORTEIRO (VERIFICA QUEM ESTÁ A ENTRAR)
// ========================================================
export default function Page() {
  const [sessao, setSessao] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // 1. Vê se já há alguém logado quando a página abre
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session)
      setCarregando(false)
    })

    // 2. Fica a "ouvir" mudanças (quando faz login ou quando clica em Sair)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#9B2B1F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white">
          <Pizza className="w-12 h-12 animate-bounce" />
          <p className="font-bold text-xl">A preparar o forno...</p>
        </div>
      </div>
    )
  }

  // Se não tem sessão, mostra o nosso ecrã de Login
  if (!sessao) {
    return <Login />
  }

  // Se tem sessão, mostra a aplicação inteira!
  return <CMVApp />
}