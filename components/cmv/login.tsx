"use client"

import { useState } from "react"
import { Pizza, Mail, Lock, Loader2, AlertCircle } from "lucide-react"
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
      setError("E-mail ou palavra-passe incorretos.")
      setLoading(false)
    }
    // Se der sucesso, o nosso page.tsx vai detetar automaticamente e mudar de ecrã!
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-xl overflow-hidden border border-border">
        {/* Cabeçalho Vermelho */}
        <div className="bg-[#9B2B1F] px-8 py-10 flex flex-col items-center text-white">
          <div className="p-4 bg-white/20 rounded-full mb-4">
            <Pizza className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">CMV SAMPA</h1>
          <p className="text-white/80 text-sm mt-2">Acesso restrito à gestão</p>
        </div>

        {/* Formulário */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-semibold">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu e-mail"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors font-medium"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua palavra-passe"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-input bg-background focus:border-[#C0392B] focus:outline-none transition-colors font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center py-4 rounded-xl bg-[#C0392B] text-white font-bold text-lg hover:bg-[#9B2B1F] transition-all disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Entrar no Sistema"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}