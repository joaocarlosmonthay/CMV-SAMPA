"use client"

import { useState } from "react"
import { Pizza, Mail, Lock, Loader2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react"
import { supabase } from "@/lib/supabase"

export function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError("Credenciais inválidas. Verifique os dados e tente novamente.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F1F5F9] relative overflow-hidden p-4">
      
      {/* BACKGROUND EFFECTS - Estilo Premium Apple/Vercel */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[100px] rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
      </div>

      <div className="w-full max-w-[440px] relative animate-in fade-in zoom-in-95 duration-700">
        
        {/* LOGO AREA EXTERNA */}
        <div className="flex flex-col items-center mb-8">
           <div className="bg-gradient-to-br from-[#1E3A8A] to-blue-600 p-4 rounded-[28px] shadow-2xl shadow-blue-500/30 mb-4 rotate-3 hover:rotate-0 transition-transform duration-500">
             <Pizza className="w-10 h-10 text-white" />
           </div>
           <h1 className="text-3xl font-black text-slate-800 tracking-tighter">CMV <span className="text-blue-600">Sampa</span></h1>
        </div>

        {/* LOGIN CARD - GLASSMORPHISM */}
        <div className="bg-white/80 backdrop-blur-2xl rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white p-8 sm:p-10 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative z-10">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Bem-vindo de volta</h2>
              <p className="text-slate-500 font-medium text-sm mt-1">Identifique-se para entrar no sistema.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-xs font-bold animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="group relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-100 p-1.5 rounded-lg group-focus-within:bg-blue-100 transition-colors">
                    <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Seu e-mail"
                    className="w-full pl-14 pr-4 py-4 rounded-2xl border-2 border-slate-100 bg-white/50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium"
                  />
                </div>

                <div className="group relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-100 p-1.5 rounded-lg group-focus-within:bg-blue-100 transition-colors">
                    <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full pl-14 pr-4 py-4 rounded-2xl border-2 border-slate-100 bg-white/50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-gradient-to-r from-[#1E3A8A] to-blue-600 text-white font-black text-lg shadow-[0_20px_40px_-12px_rgba(30,58,138,0.4)] hover:shadow-[0_20px_40px_-8px_rgba(30,58,138,0.6)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 group"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    Aceder ao Painel
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-center gap-2">
               <ShieldCheck className="w-4 h-4 text-emerald-500" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conexão encriptada e segura</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}