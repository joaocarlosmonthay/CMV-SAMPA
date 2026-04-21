"use client"

import { useState, useEffect } from "react"
import { CalendarDays, Search, LayoutList, FileText, ClipboardCheck, ArrowRightLeft, FileDown, Flame, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

const formatBRL = (v: any) => {
  try {
    if (v === null || v === undefined || isNaN(Number(v))) return "R$ 0,00"
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  } catch (e) {
    return "R$ 0,00";
  }
}

const formatPerc = (v: number) => {
  if (isNaN(v) || v === null || !isFinite(v)) return "0.00%"
  return `${v.toFixed(2)}%`
}

export function Relatorios({ produtos }: { produtos: any[] }) {
  const [filtroCategoria, setFiltroCategoria] = useState<"Geral" | "Cozinha" | "Bebidas">("Geral")
  const [modoVisao, setModoVisao] = useState<"resumo" | "comparacao" | "detalhado">("resumo")
  const [semanasData, setSemanasData] = useState<any[]>([])
  
  const [semanaSelecionadaModal, setSemanaSelecionadaModal] = useState<string>("")
  const [semanaComp1, setSemanaComp1] = useState<string>("")
  const [semanaComp2, setSemanaComp2] = useState<string>("")
  const [loading, setLoading] = useState(true)
  
  // ESTADO QUE CONTROLA O BOTÃO DO PDF
  const [pdfPronto, setPdfPronto] = useState(false)
  
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })

  // INJEÇÃO BLINDADA DO MOTOR DE PDF (Agora ele avisa quando está pronto)
  useEffect(() => {
    const carregarGeradorPDF = () => {
      // @ts-ignore
      if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) {
        setPdfPronto(true);
        return; 
      }
      
      const scriptPDF = document.createElement('script');
      scriptPDF.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      scriptPDF.async = true;
      document.body.appendChild(scriptPDF);

      scriptPDF.onload = () => {
        const scriptTable = document.createElement('script');
        scriptTable.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
        scriptTable.async = true;
        document.body.appendChild(scriptTable);

        scriptTable.onload = () => {
           // O motor terminou de montar as peças, libera o botão!
           setPdfPronto(true);
        }
      };
    };
    carregarGeradorPDF();
  }, []);

  useEffect(() => {
    const carregarDados = async () => {
      setLoading(true)

      const { data: todasFinancas } = await supabase.from('financas_semanais').select('*').order('data_inicio', { ascending: true })
      if (!todasFinancas || todasFinancas.length === 0) { setSemanasData([]); setLoading(false); return }

      const financasComNumeroMensal = todasFinancas.map(f => {
        const mesDoRegistro = f.data_inicio.substring(0, 7);
        const registrosDoMes = todasFinancas.filter(r => r.data_inicio.startsWith(mesDoRegistro));
        const indexNoMes = registrosDoMes.findIndex(r => r.id === f.id);
        return { ...f, numeroNoMes: indexNoMes + 1 };
      });

      const financasDoMes = financasComNumeroMensal.filter(f => f.data_inicio.startsWith(mesSelecionado))
      if (financasDoMes.length === 0) { setSemanasData([]); setLoading(false); return; }

      const oldestDate = financasDoMes[0].data_inicio
      const newestDate = financasDoMes[financasDoMes.length - 1].data_fim || financasDoMes[financasDoMes.length - 1].data_inicio

      const [dbCompras, dbEstoques, dbSaidas] = await Promise.all([
        supabase.from('compras').select('*').gte('data_compra', oldestDate).lte('data_compra', newestDate),
        supabase.from('estoques').select('*').gte('data_contagem', oldestDate).lte('data_contagem', newestDate),
        supabase.from('saidas_avulsas').select('*').gte('data_saida', oldestDate).lte('data_saida', newestDate)
      ])

      const semanasProcessadas = financasDoMes.map(f => {
        let comp = dbCompras.data?.filter(c => c.data_compra >= f.data_inicio && c.data_compra <= f.data_fim) || []
        let est = dbEstoques.data?.filter(e => e.data_contagem >= f.data_inicio && e.data_contagem <= f.data_fim) || []
        let saidas = dbSaidas.data?.filter(s => s.data_saida >= f.data_inicio && s.data_saida <= f.data_fim) || []

        let prodsFiltrados = produtos || []
        if (filtroCategoria === "Cozinha") prodsFiltrados = produtos.filter(p => p.grupo !== "Bebidas" && p.grupo !== "Embalagens" && p.grupo !== "Limpeza" && p.grupo !== "Outros")
        else if (filtroCategoria === "Bebidas") prodsFiltrados = produtos.filter(p => p.grupo === "Bebidas")

        const consumoDetalhado = prodsFiltrados.map(p => {
          const eI = est.find(e => e.produto_id === p.id && e.tipo_contagem === 'Inicial')
          const eF = est.find(e => e.produto_id === p.id && e.tipo_contagem === 'Final')
          const cP = comp.filter(c => c.produto_id === p.id)
          const qI = eI ? parseFloat(eI.quantidade) : 0, vI = eI ? parseFloat(eI.valor_unitario) : 0
          let qC = 0, vC = 0; cP.forEach(c => { qC += parseFloat(c.quantidade); vC += parseFloat(c.quantidade) * parseFloat(c.valor_unitario) })
          const qF = eF ? parseFloat(eF.quantidade) : 0, vF = eF ? parseFloat(eF.valor_unitario) : vI
          const custoConsumido = (p.producao_interna) ? 0 : ((qI * vI) + vC - (qF * vF))
          return { item: p.nome, unidade: p.unidade, grupo: p.grupo, producao_interna: p.producao_interna, qI, valorIni: qI * vI, qC, valorComp: vC, qF, valorFinal: qF * vF, qtdConsumida: (qI + qC - qF), valorConsumido: custoConsumido }
        }).filter(i => i.valorConsumido !== 0 || i.qtdConsumida !== 0 || i.qI > 0 || i.qF > 0 || i.qC > 0).sort((a,b) => b.valorConsumido - a.valorConsumido)

        const totalDed = saidas.reduce((a, s) => a + parseFloat(s.valor_total || 0), 0)
        let cmvValorReal = consumoDetalhado.reduce((acc, curr) => acc + curr.valorConsumido, 0)
        if (filtroCategoria === "Geral") cmvValorReal -= totalDed;

        const inicialVisual = est.filter(e => e.tipo_contagem === 'Inicial' && prodsFiltrados.find(p => p.id === e.produto_id)).reduce((acc, e) => acc + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)
        const finalVisual = est.filter(e => e.tipo_contagem === 'Final' && prodsFiltrados.find(p => p.id === e.produto_id)).reduce((acc, e) => acc + (parseFloat(e.quantidade) * parseFloat(e.valor_unitario)), 0)
        const comprasVisuais = comp.filter(c => prodsFiltrados.find(p => p.id === c.produto_id)).reduce((acc, c) => acc + (parseFloat(c.quantidade) * parseFloat(c.valor_unitario)), 0)
        const deducoesVisuais = filtroCategoria === "Geral" ? totalDed : 0

        const dFinal = new Date(f.data_inicio + "T12:00:00")
        dFinal.setDate(dFinal.getDate() + 6)
        const dataVisual = `${f.data_inicio.split('-')[2]}/${f.data_inicio.split('-')[1]} a ${dFinal.toISOString().split('T')[0].split('-')[2]}/${dFinal.toISOString().split('T')[0].split('-')[1]}`

        return { id: f.data_inicio, nome: `Semana ${f.numeroNoMes}`, periodo: dataVisual, faturamento: f.faturamento || 0, inicial: inicialVisual, compras: comprasVisuais, deducoes: deducoesVisuais, final: finalVisual, cmvValor: cmvValorReal, consumoDetalhado }
      })

      setSemanasData(semanasProcessadas)
      if (semanasProcessadas.length > 0) {
        setSemanaSelecionadaModal(semanasProcessadas[semanasProcessadas.length - 1].id)
        if (semanasProcessadas.length >= 2) {
          setSemanaComp1(semanasProcessadas[semanasProcessadas.length - 2].id)
          setSemanaComp2(semanasProcessadas[semanasProcessadas.length - 1].id)
        } else {
          setSemanaComp1(semanasProcessadas[0].id)
          setSemanaComp2(semanasProcessadas[0].id)
        }
      }
      setLoading(false)
    }

    if (produtos.length > 0) carregarDados()
  }, [filtroCategoria, produtos, mesSelecionado])

  const handleGerarPDFFoda = () => {
    try {
      // @ts-ignore
      const jsPDF = window.jspdf.jsPDF;
      const doc = new jsPDF('l', 'pt', 'a4'); 
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text("SAMPA VILHENA", 40, 50);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text(`Relatório Gerencial de CMV - ${modoVisao.toUpperCase()}`, 40, 70);
      doc.text(`Categoria de Auditoria: ${filtroCategoria.toUpperCase()} | Emitido em: ${new Date().toLocaleString('pt-BR')}`, 40, 85);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1.5);
      doc.line(40, 100, doc.internal.pageSize.width - 40, 100);

      const tableConfigPadrao = {
        startY: 120,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 8, textColor: [30, 41, 59] },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      };

      if (modoVisao === "resumo") {
        const head = [['Métricas Financeiras do Mês', ...semanasData.map(s => `${s.nome}\n(${s.periodo})`)]]
        const body = [
          ['Faturamento Global', ...semanasData.map(s => formatBRL(s.faturamento))],
          [`(+) Compras (${filtroCategoria})`, ...semanasData.map(s => formatBRL(s.compras))],
          ['(-) Deduções / Saídas', ...semanasData.map(s => formatBRL(s.deducoes))],
          ['(=) CMV LÍQUIDO', ...semanasData.map(s => formatBRL(s.cmvValor))],
          ['MARGEM CMV REAL (%)', ...semanasData.map(s => formatPerc(s.faturamento > 0 ? (s.cmvValor / s.faturamento) * 100 : 0))]
        ]
        
        // @ts-ignore
        doc.autoTable({
          ...tableConfigPadrao,
          head: head,
          body: body,
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 180 },
            1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }
          }
        })
        doc.save(`Sampa_CMV_Mensal_${mesSelecionado}.pdf`)
      } 
      else if (modoVisao === "detalhado") {
        const semana = semanasData.find(s => s.id === semanaSelecionadaModal)
        if (!semana) return;
        
        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 99, 235);
        doc.text(`Auditoria da ${semana.nome} (${semana.periodo})`, 40, 110);
        
        const head = [['Insumo / Produto', 'Tinha (Inicial)', '+ Comprou', '= Consumiu (CMV)', 'Sobrou (Final)']]
        const body = semana.consumoDetalhado.map((i: any) => [
          `${i.item} (${i.grupo})`,
          `${i.qtdIni} ${i.unidade}\n${formatBRL(i.valorIni)}`,
          `${i.qtdComp} ${i.unidade}\n${formatBRL(i.valorComp)}`,
          `${i.qtdConsumida} ${i.unidade}\n${i.producao_interna ? 'SUBPRODUTO (R$ 0,00)' : formatBRL(i.valorConsumido)}`,
          `${i.qtdFin} ${i.unidade}\n${formatBRL(i.valorFinal)}`
        ])
        
        // @ts-ignore
        doc.autoTable({
          ...tableConfigPadrao,
          startY: 125,
          head: head,
          body: body,
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 200 },
            1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', textColor: [225, 29, 72] }, 4: { halign: 'right', textColor: [37, 99, 235] }
          }
        })
        doc.save(`Sampa_Auditoria_${semana.nome.replace(' ', '_')}.pdf`)
      }
      else if (modoVisao === "comparacao") {
        const sem1 = semanasData.find(s => s.id === semanaComp1)
        const sem2 = semanasData.find(s => s.id === semanaComp2)
        if (!sem1 || !sem2) return;

        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 99, 235);
        doc.text(`Comparativo de Consumo: ${sem1.nome} vs ${sem2.nome}`, 40, 110);

        const todosItens = Array.from(new Set([...sem1.consumoDetalhado.map((i:any)=>i.item), ...sem2.consumoDetalhado.map((i:any)=>i.item)])).sort()
        
        const head = [['Insumo Auditorado', `Custo ${sem1.nome}`, `Custo ${sem2.nome}`, 'Diferença Custo (R$)']]
        const body = todosItens.map(nomeItem => {
          const item1 = sem1.consumoDetalhado.find((i:any) => i.item === nomeItem) || { qtdConsumida: 0, valorConsumido: 0, unidade: '' }
          const item2 = sem2.consumoDetalhado.find((i:any) => i.item === nomeItem) || { qtdConsumida: 0, valorConsumido: 0, unidade: '' }
          const diff = item2.valorConsumido - item1.valorConsumido;
          
          return [
            String(nomeItem),
            `${item1.qtdConsumida} ${item1.unidade}  |  ${formatBRL(item1.valorConsumido)}`,
            `${item2.qtdConsumida} ${item2.unidade}  |  ${formatBRL(item2.valorConsumido)}`,
            `${diff > 0 ? '+' : ''}${formatBRL(diff)}`
          ]
        })

        // @ts-ignore
        doc.autoTable({
          ...tableConfigPadrao,
          startY: 125,
          head: head,
          body: body,
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 250 },
            1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' }
          },
          // @ts-ignore
          didParseCell: function(data) {
             if (data.section === 'body' && data.column.index === 3) {
                 const diffValue = data.cell.raw.toString();
                 if (diffValue.startsWith('+')) data.cell.styles.textColor = [225, 29, 72]; 
                 else if (diffValue !== 'R$ 0,00') data.cell.styles.textColor = [16, 185, 129]; 
             }
          }
        })
        doc.save(`Sampa_Comparativo_${sem1.nome}_vs_${sem2.nome}.pdf`)
      }
    } catch (error: any) {
      console.error("Erro absoluto:", error);
      alert(`Erro no motor de PDF: ${error.message}. Recarregue a página.`);
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div></div>

  const anosMeses = []
  const dataLoop = new Date()
  for (let i = 0; i < 12; i++) {
    anosMeses.push({ value: `${dataLoop.getFullYear()}-${String(dataLoop.getMonth() + 1).padStart(2, '0')}`, label: dataLoop.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) })
    dataLoop.setMonth(dataLoop.getMonth() - 1)
  }

  const semanaSel = semanasData.find(s => s.id === semanaSelecionadaModal) || { consumoDetalhado: [] }
  const dComp1 = semanasData.find(s => s.id === semanaComp1)
  const dComp2 = semanasData.find(s => s.id === semanaComp2)

  return (
    <div className="space-y-6 pb-10 animate-in fade-in">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">Central de Relatórios</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
           <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl shadow-sm">
             <CalendarDays className="w-5 h-5 text-slate-400 ml-2" />
             <select value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none text-sm cursor-pointer pr-2 capitalize">
               {anosMeses.map(am => <option key={am.value} value={am.value}>{am.label}</option>)}
             </select>
           </div>
           <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
             {["Geral", "Cozinha", "Bebidas"].map(cat => (
               <button key={cat} onClick={() => setFiltroCategoria(cat as any)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filtroCategoria === cat ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}>{cat}</button>
             ))}
           </div>
           
           {/* BOTÃO DO PDF COM A TRAVA DE SEGURANÇA VISUAL */}
           <button 
             onClick={handleGerarPDFFoda} 
             disabled={!pdfPronto}
             className={`px-5 py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${pdfPronto ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-900/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
           >
              {pdfPronto ? (
                <><FileDown className="w-5 h-5"/> BAIXAR RELATÓRIO PDF</>
              ) : (
                <><Loader2 className="w-5 h-5 animate-spin"/> CARREGANDO MOTOR...</>
              )}
           </button>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex flex-wrap gap-2 bg-slate-200/50 p-1.5 rounded-2xl w-fit">
         <button onClick={() => setModoVisao("resumo")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${modoVisao === "resumo" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><LayoutList size={18}/> Resumo do Mês</button>
         <button onClick={() => setModoVisao("detalhado")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${modoVisao === "detalhado" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><ClipboardCheck size={18}/> Auditoria por Semana</button>
         <button onClick={() => setModoVisao("comparacao")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${modoVisao === "comparacao" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><ArrowRightLeft size={18}/> Comparação Lado a Lado</button>
      </div>

      {/* TELA 1: RESUMO DO MÊS */}
      {modoVisao === "resumo" && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in zoom-in-95">
          {semanasData.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold flex flex-col items-center"><Search className="w-12 h-12 text-slate-200 mb-4" />Nenhum dado neste mês.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b">
                  <tr><th className="p-5 text-left bg-slate-100/50">Métricas do Mês</th>{semanasData.map(s => <th key={s.id} className="p-5 min-w-[150px] border-l border-slate-100"><span className="block text-[14px] text-slate-800">{s.nome}</span><span className="block text-[10px] text-slate-400">{s.periodo}</span></th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-base">
                  <tr className="hover:bg-slate-50 transition-colors"><td className="p-5 text-left font-bold text-slate-500 bg-slate-50/30">Faturamento Global</td>{semanasData.map(s => <td key={s.id} className="p-5 font-black text-emerald-600 border-l border-slate-50">{formatBRL(s.faturamento)}</td>)}</tr>
                  <tr className="hover:bg-slate-50 transition-colors"><td className="p-5 text-left font-bold text-slate-500 bg-slate-50/30">Compras ({filtroCategoria})</td>{semanasData.map(s => <td key={s.id} className="p-5 text-amber-600 font-bold border-l border-slate-50">{formatBRL(s.compras)}</td>)}</tr>
                  <tr className="hover:bg-slate-50 transition-colors"><td className="p-5 text-left font-bold text-slate-500 bg-slate-50/30">Deduções / Saídas (-)</td>{semanasData.map(s => <td key={s.id} className="p-5 text-rose-500 font-bold border-l border-slate-50">{formatBRL(s.deducoes)}</td>)}</tr>
                  <tr className="bg-blue-50/10 hover:bg-blue-50/30 transition-colors"><td className="p-5 text-left font-black text-slate-800 bg-blue-50/20">CMV Líquido (R$)</td>{semanasData.map(s => <td key={s.id} className="p-5 font-black text-slate-800 border-l border-blue-50/30">{formatBRL(s.cmvValor)}</td>)}</tr>
                  <tr className="bg-slate-50/50"><td className="p-5 text-left font-black text-slate-700">Margem (%) do Faturamento</td>{semanasData.map(s => { const cmvP = s.faturamento > 0 ? (s.cmvValor / s.faturamento) * 100 : 0; return <td key={s.id} className="p-5 border-l border-slate-100"><span className={`px-4 py-2 rounded-xl font-black text-sm shadow-sm border ${cmvP > 35 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{formatPerc(cmvP)}</span></td> })}</tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TELA 2: AUDITORIA DETALHADA */}
      {modoVisao === "detalhado" && (
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px] animate-in slide-in-from-right-8">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
            <div><h4 className="font-black text-slate-800 text-lg flex items-center gap-2"><ClipboardCheck className="text-blue-500 w-5 h-5"/> Auditoria Completa</h4></div>
            <select className="p-3 rounded-xl border border-slate-200 text-sm font-bold bg-white shadow-sm outline-none focus:border-blue-500 cursor-pointer" value={semanaSelecionadaModal} onChange={e => setSemanaSelecionadaModal(e.target.value)}>
              {semanasData.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.periodo})</option>)}
            </select>
          </div>
          
          <div className="flex-1 p-6 space-y-4 bg-slate-50/30">
            {semanaSel.consumoDetalhado.length === 0 && <p className="text-center text-slate-400 font-bold mt-10">Nenhum consumo para a categoria {filtroCategoria} nessa semana.</p>}
            <div className="grid grid-cols-1 gap-4">
              {semanaSel.consumoDetalhado.map((item: any, i: number) => (
                <div key={i} className={`flex flex-col p-5 bg-white rounded-2xl border shadow-sm ${item.producao_interna ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full font-black flex items-center justify-center text-xs ${item.producao_interna ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{i + 1}º</div>
                      <div><p className="font-black text-slate-800 text-lg">{item.item}</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.grupo}</p></div>
                    </div>
                    <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo no CMV</p>{item.producao_interna ? <p className="font-black text-blue-500 text-sm bg-blue-50 px-2 py-1 rounded-md border border-blue-100">R$ 0,00 (Subproduto)</p> : <p className="font-black text-red-600 text-xl">{formatBRL(item.valorConsumido)}</p>}</div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 bg-slate-50 p-4 rounded-xl text-center border border-slate-200 shadow-inner">
                    <div className="flex flex-col border-r border-slate-200/60 p-1"><span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Inicial</span><span className="text-slate-700 font-black text-lg mt-1">{item.qtdIni} <span className="text-[10px] font-bold uppercase">{item.unidade}</span></span><span className="text-slate-500/80 text-[10px] font-bold mt-1.5">{formatBRL(item.valorIni)}</span></div>
                    <div className="flex flex-col border-r border-slate-200/60 p-1"><span className="text-amber-500/80 text-[10px] uppercase font-bold tracking-wider">+ Comprou</span><span className="text-amber-600 font-black text-lg mt-1">{item.qtdComp} <span className="text-[10px] font-bold uppercase">{item.unidade}</span></span><span className="text-amber-600/80 text-[10px] font-bold mt-1.5">{formatBRL(item.valorComp)}</span></div>
                    <div className="flex flex-col border-r border-slate-200/60 p-1"><span className="text-purple-500/80 text-[10px] uppercase font-bold tracking-wider">= Consumiu</span><span className="text-purple-600 font-black text-lg mt-1">{item.qtdConsumida} <span className="text-[10px] font-bold uppercase">{item.unidade}</span></span><span className="text-purple-600/80 text-[10px] font-bold mt-1.5">{item.producao_interna ? "R$ 0,00" : formatBRL(item.valorConsumido)}</span></div>
                    <div className="flex flex-col justify-center p-1 bg-blue-50/50 rounded-lg"><span className="text-blue-500/90 text-[10px] uppercase font-black tracking-wider">Sobrou (Final)</span><span className="text-blue-600 font-black text-lg mt-1">{item.qtdFin} <span className="text-[10px] font-bold uppercase">{item.unidade}</span></span><span className="text-blue-700/90 text-[11px] font-black mt-1.5 bg-blue-100/50 py-1 rounded-md">{formatBRL(item.valorFinal)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TELA 3: COMPARAÇÃO LADO A LADO */}
      {modoVisao === "comparacao" && (
        <div className="space-y-6 animate-in slide-in-from-left-8">
          <div className="bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 w-full"><label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Analisar Semana A:</label><select value={semanaComp1} onChange={e => setSemanaComp1(e.target.value)} className="w-full p-3 rounded-xl font-bold bg-white text-slate-900 outline-none">{semanasData.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.periodo})</option>)}</select></div>
              <div className="bg-slate-800 p-3 rounded-full mt-4 md:mt-0"><Flame className="w-6 h-6 text-rose-500"/></div>
              <div className="flex-1 w-full"><label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Contra Semana B:</label><select value={semanaComp2} onChange={e => setSemanaComp2(e.target.value)} className="w-full p-3 rounded-xl font-bold bg-white text-slate-900 outline-none">{semanasData.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.periodo})</option>)}</select></div>
          </div>

          {dComp1 && dComp2 && (
            <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b">
                      <tr>
                        <th className="p-5">Insumo / Produto</th>
                        <th className="p-5 border-l border-slate-200 text-center bg-slate-100/50">{dComp1.nome}</th>
                        <th className="p-5 border-l border-slate-200 text-center bg-slate-100/50">{dComp2.nome}</th>
                        <th className="p-5 border-l border-slate-200 text-right bg-blue-50/50 text-blue-600">Diferença Custo (B - A)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {Array.from(new Set([...dComp1.consumoDetalhado.map((i:any)=>i.item), ...dComp2.consumoDetalhado.map((i:any)=>i.item)])).sort().map((nomeItem: any, idx) => {
                        const item1 = dComp1.consumoDetalhado.find((i:any) => i.item === nomeItem) || { qtdConsumida: 0, valorConsumido: 0, unidade: '' }
                        const item2 = dComp2.consumoDetalhado.find((i:any) => i.item === nomeItem) || { qtdConsumida: 0, valorConsumido: 0, unidade: '' }
                        const diff = item2.valorConsumido - item1.valorConsumido;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-black text-slate-700">{nomeItem}</td>
                            <td className="p-4 border-l border-slate-100 text-center bg-slate-50/30">
                              <span className="block font-bold text-slate-800">{item1.qtdConsumida} {item1.unidade}</span>
                              <span className="block text-[10px] text-slate-400">{formatBRL(item1.valorConsumido)}</span>
                            </td>
                            <td className="p-4 border-l border-slate-100 text-center bg-slate-50/30">
                              <span className="block font-bold text-slate-800">{item2.qtdConsumida} {item2.unidade}</span>
                              <span className="block text-[10px] text-slate-400">{formatBRL(item2.valorConsumido)}</span>
                            </td>
                            <td className="p-4 border-l border-slate-100 text-right bg-blue-50/10">
                              <span className={`font-black text-lg ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {diff > 0 ? '+' : ''}{formatBRL(diff)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}