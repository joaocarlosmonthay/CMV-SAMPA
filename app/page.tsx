"use client"

import { useState, useEffect } from "react"
import { LayoutDashboard, ClipboardList, ShoppingCart, Package, Menu, X, Pizza, ReceiptText, LogOut, LineChart } from "lucide-react"
import { supabase } from "@/lib/supabase"

// Importações blindadas
import { Login } from "@/components/cmv/login"
import { Dashboard } from "@/components/cmv/dashboard"
import { Cadastros, type Produto } from "@/components/cmv/cadastros"
import { type LancamentosData } from "@/components/cmv/lancamentos"
import { ComprasCMV } from "@/components/cmv/compras-cmv"
import { OutrosCustosDRE } from "@/components/cmv/outros-custos-dre"
import { Estoque, type ContagemEstoque } from "@/components/cmv/estoque"
import { Relatorios } from "@/components/cmv/relatorios"

const getHoje = () => new Date().toISOString().split('T')[0]
const getSeteDiasAtras = () => {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

function CMVApp() {
  const [tela, setTela] = useState<string>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dataInicio, setDataInicio] = useState(getSeteDiasAtras())
  const [dataFim, setDataFim] = useState(getHoje())

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [lancamentos, setLancamentos] = useState<any>({
    faturamento: 0, compras: [], outrosCustos: { embalagens: 0, consumoInterno: 0, consumoSocios: 0, testeMkt: 0, materialLimpeza: 0, desperdicios: 0 },
  })
  const [contagemInicial, setContagemInicial] = useState<ContagemEstoque>({})
  const [contagemFinal, setContagemFinal] = useState<ContagemEstoque>({})
  const [precosReferencia, setPrecosReferencia] = useState<Record<string, number>>({})

  const carregarDadosDoBanco = async () => {
    const { data: gData } = await supabase.from('grupos').select('*')
    const tradutorGrupos: Record<number, string> = {}
    if (gData) gData.forEach(g => { tradutorGrupos[g.id] = g.nome })

    const { data: pData } = await supabase.from('produtos').select('*').order('nome')
    if (pData) {
      setProdutos(pData.map(p => ({ 
        id: p.id,
        nome: p.nome, 
        unidade: p.unidade_medida, 
        grupo: tradutorGrupos[p.grupo_id] || "Outros" 
      })))
    }

    const { data: cData } = await supabase.from('compras').select('*, produtos(nome)').gte('data_compra', dataInicio).lte('data_compra', dataFim)
    if (cData) {
      setLancamentos((prev: any) => ({ 
        ...prev, 
        compras: cData.map(c => ({ 
          id: c.id, 
          produto: c.produtos?.nome || "Desconhecido", 
          quantidade: c.quantidade, 
          valorUnitario: c.valor_unitario, 
          valorTotal: c.valor_total,
          data_compra: c.data_compra 
        }))
      }))
    }

    const { data: precosData } = await supabase.from('compras').select('produto_id, valor_unitario').order('data_compra', { ascending: false })
    if (precosData) {
      const mapa: any = {}
      precosData.forEach(c => { if (!mapa[c.produto_id]) mapa[c.produto_id] = c.valor_unitario })
      setPrecosReferencia(mapa)
    }

    const { data: fData } = await supabase.from('financas_semanais').select('*').eq('data_inicio', dataInicio).eq('data_fim', dataFim).maybeSingle()
    if (fData) {
      setLancamentos((prev: any) => ({ ...prev, faturamento: fData.faturamento || 0, outrosCustos: { embalagens: fData.embalagens || 0, consumoInterno: fData.consumo_interno || 0, consumoSocios: fData.consumo_socios || 0, testeMkt: fData.teste_mkt || 0, materialLimpeza: fData.material_limpeza || 0, desperdicios: fData.desperdicios || 0 }}))
    } else {
      setLancamentos((prev: any) => ({ ...prev, faturamento: 0, outrosCustos: { embalagens: 0, consumoInterno: 0, consumoSocios: 0, testeMkt: 0, materialLimpeza: 0, desperdicios: 0 } }))
    }

    const { data: eData } = await supabase.from('estoques').select('*').gte('data_contagem', dataInicio).lte('data_contagem', dataFim)
    if (eData) {
      const inicial: any = {}; const final: any = {}
      eData.forEach(item => {
        if (item.tipo_contagem === 'Inicial') inicial[item.produto_id] = item.quantidade.toString()
        else final[item.produto_id] = item.quantidade.toString()
      })
      setContagemInicial(inicial); setContagemFinal(final)
    }
  }

  useEffect(() => { carregarDadosDoBanco() }, [dataInicio, dataFim])

  const handleSalvarProdutoNoBanco = async (p: Produto) => {
    const { data: gData } = await supabase.from('grupos').select('id').eq('nome', p.grupo).single()
    const grupoId = gData ? gData.id : 5
    await supabase.from('produtos').insert([{ nome: p.nome, unidade_medida: p.unidade, grupo_id: grupoId }])
    carregarDadosDoBanco()
  }

  const handlePuxarEstoqueAnterior = async () => {
    const { data } = await supabase.from('estoques').select('*').eq('tipo_contagem', 'Final').lt('data_contagem', dataInicio).order('data_contagem', { ascending: false })
    if (data && data.length > 0) {
      const heranca: any = {}; const ultimaData = data[0].data_contagem
      data.filter(d => d.data_contagem === ultimaData).forEach(item => { heranca[item.produto_id] = item.quantidade.toString() })
      setContagemInicial(heranca)
      return true
    }
    return false
  }

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
            { id: "compras", label: "Compras", icon: ShoppingCart },
            { id: "outros-custos", label: "Custos DRE", icon: ReceiptText },
            { id: "estoque", label: "Estoque", icon: Package },
            { id: "relatorios", label: "Relatórios", icon: LineChart } 
          ].map((item: any) => (
            <button 
              key={item.id} 
              onClick={() => { setTela(item.id); setSidebarOpen(false); }} 
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl font-bold transition-all ${tela === item.id ? "bg-[#FACC15] text-[#1E3A8A] shadow-lg scale-105" : "text-white/80 hover:bg-white/10"}`}
            >
              <item.icon /> {item.label}
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
          <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border-2 border-blue-100">
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-transparent font-black text-[#1E3A8A] text-sm outline-none cursor-pointer" />
            <span className="text-blue-300 font-bold">➔</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-transparent font-black text-[#1E3A8A] text-sm outline-none cursor-pointer" />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50">
          {tela === "dashboard" && <Dashboard dataInicio={dataInicio} dataFim={dataFim} lancamentos={lancamentos} contagemInicial={contagemInicial} contagemFinal={contagemFinal} produtos={produtos} precosReferencia={precosReferencia} onChangeFaturamento={carregarDadosDoBanco} />}
          {tela === "cadastros" && <Cadastros produtos={produtos} onAddProduto={handleSalvarProdutoNoBanco} />}
          {tela === "compras" && <ComprasCMV produtos={produtos} data={lancamentos} onChange={carregarDadosDoBanco} />}
          {tela === "outros-custos" && <OutrosCustosDRE data={lancamentos} dataInicio={dataInicio} dataFim={dataFim} onChange={carregarDadosDoBanco} />}
          {tela === "estoque" && <Estoque dataInicio={dataInicio} dataFim={dataFim} produtos={produtos} contagemInicial={contagemInicial} contagemFinal={contagemFinal} onSalvarInicial={carregarDadosDoBanco} onSalvarFinal={carregarDadosDoBanco} onPuxarAnterior={handlePuxarEstoqueAnterior} />}
          {tela === "relatorios" && <Relatorios produtos={produtos} />}
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