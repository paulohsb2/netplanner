import { useState } from "react";
import { X } from "lucide-react";
import { signInWithEmail, signUpWithEmail, signInWithGoogle, supabase } from "./supabase";

const T = {
  bg: "#f5f6f8", white: "#ffffff", border: "#dfe3ea", borderLight: "#edf0f4",
  accent: "#2563eb", accentLight: "#dbeafe",
  text: "#1a2332", textMuted: "#5f6b7a", textDim: "#9ca3af",
  danger: "#dc2626", dangerLight: "#fef2f2",
  shadow: "0 4px 24px rgba(0,0,0,0.12)",
};

const inpS = {
  width: "100%", padding: "10px 12px", borderRadius: "8px",
  border: `1px solid ${T.border}`, background: T.white, color: T.text,
  fontSize: "13px", outline: "none", boxSizing: "border-box",
};

const ERR_MSGS = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "User already registered": "Este e-mail já está cadastrado.",
  "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar.",
  "For security purposes, you can only request this after": "Aguarde um momento antes de tentar novamente.",
  "Rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos.",
  "User not found": "E-mail não encontrado.",
};

export default function AuthModal({ onClose, onShowTermos }) {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "reset" | "reset-sent" | "signup-sent"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (m) => { setMode(m); setError(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
        onClose();
      } else if (mode === "signup") {
        const { error } = await signUpWithEmail(email, password);
        if (error) throw error;
        setMode("signup-sent");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMode("reset-sent");
      }
    } catch (err) {
      setError(ERR_MSGS[err.message] || "Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(""); setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) { setError(ERR_MSGS[error.message] || error.message); setLoading(false); }
  };

  const handleResend = async () => {
    setLoading(true);
    await supabase.auth.resend({ type: "signup", email });
    setLoading(false);
  };

  const subtitle = {
    login: "Entrar na sua conta",
    signup: "Criar nova conta",
    reset: "Recuperar senha",
    "reset-sent": "E-mail enviado",
    "signup-sent": "Confirme seu e-mail",
  }[mode];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, backdropFilter: "blur(4px)" }}>
      <div style={{ background: T.white, borderRadius: "16px", padding: "32px", width: "380px", boxShadow: T.shadow, position: "relative" }}>

        <button onClick={onClose} style={{ position: "absolute", top: "14px", right: "14px", background: "none", border: "none", cursor: "pointer", color: T.textDim }}>
          <X size={18} />
        </button>

        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "24px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: T.text }}>NetPlanner</div>
          <div style={{ fontSize: "12px", color: T.textDim, marginTop: "2px" }}>{subtitle}</div>
        </div>

        {/* ── Tela de confirmação de signup ── */}
        {mode === "signup-sent" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>✉️</div>
            <p style={{ fontSize: "14px", color: T.text, fontWeight: 600, margin: "0 0 8px" }}>Verifique seu e-mail</p>
            <p style={{ fontSize: "13px", color: T.textMuted, margin: "0 0 20px" }}>
              Enviamos um link de confirmação para <strong>{email}</strong>. Clique no link para ativar sua conta.
            </p>
            <button onClick={handleResend} disabled={loading} style={{ width: "100%", padding: "10px", borderRadius: "9px", border: `1.5px solid ${T.border}`, background: T.white, cursor: "pointer", fontSize: "13px", color: T.textMuted, marginBottom: "10px" }}>
              {loading ? "Reenviando..." : "Reenviar e-mail"}
            </button>
            <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", cursor: "pointer", color: T.accent, fontWeight: 600, fontSize: "13px" }}>
              Voltar ao login
            </button>
          </div>
        )}

        {/* ── Tela de reset enviado ── */}
        {mode === "reset-sent" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔑</div>
            <p style={{ fontSize: "14px", color: T.text, fontWeight: 600, margin: "0 0 8px" }}>Link enviado!</p>
            <p style={{ fontSize: "13px", color: T.textMuted, margin: "0 0 20px" }}>
              Enviamos um link de redefinição para <strong>{email}</strong>. Verifique sua caixa de entrada.
            </p>
            <button onClick={() => switchMode("login")} style={{ width: "100%", padding: "10px", borderRadius: "9px", border: "none", background: T.accent, color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
              Voltar ao login
            </button>
          </div>
        )}

        {/* ── Formulários ── */}
        {(mode === "login" || mode === "signup" || mode === "reset") && (<>
          {mode !== "reset" && (
            <>
              <button onClick={handleGoogle} disabled={loading} style={{ width: "100%", padding: "10px", borderRadius: "9px", border: `1.5px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "13px", fontWeight: 600, background: T.white, color: T.text, marginBottom: "16px" }}>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16.2 18.9 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.2 26.8 36 24 36c-5.3 0-9.7-2.9-11.3-7H6c3.3 6.3 10 10.3 18 10.3z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.2 5.2C40.5 36.1 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
                Continuar com Google
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{ flex: 1, height: "1px", background: T.borderLight }} />
                <span style={{ fontSize: "11px", color: T.textDim }}>ou com e-mail</span>
                <div style={{ flex: 1, height: "1px", background: T.borderLight }} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required style={inpS} />
            {mode !== "reset" && (
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha (mínimo 6 caracteres)" required minLength={6} style={inpS} />
            )}

            {error && (
              <div style={{ background: T.dangerLight, border: `1px solid ${T.danger}30`, borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: T.danger }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !email || (mode !== "reset" && !password)} style={{ padding: "11px", borderRadius: "9px", border: "none", cursor: loading ? "not-allowed" : "pointer", background: T.accent, color: "#fff", fontSize: "13px", fontWeight: 700, marginTop: "4px", opacity: loading ? 0.7 : 1, boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link de recuperação"}
            </button>
          </form>

          {/* Links de navegação */}
          <div style={{ textAlign: "center", marginTop: "14px", fontSize: "12px", color: T.textDim, display: "flex", flexDirection: "column", gap: "6px" }}>
            {mode === "login" && (<>
              <div>
                <button onClick={() => switchMode("reset")} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "12px" }}>
                  Esqueci minha senha
                </button>
              </div>
              <div>Não tem conta?{" "}
                <button onClick={() => switchMode("signup")} style={{ background: "none", border: "none", cursor: "pointer", color: T.accent, fontWeight: 600, fontSize: "12px" }}>
                  Cadastre-se
                </button>
              </div>
            </>)}
            {mode === "signup" && (
              <div>Já tem conta?{" "}
                <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", cursor: "pointer", color: T.accent, fontWeight: 600, fontSize: "12px" }}>
                  Entrar
                </button>
              </div>
            )}
            {mode === "reset" && (
              <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "12px" }}>
                ← Voltar ao login
              </button>
            )}
          </div>

          {/* Termos */}
          <div style={{ textAlign: "center", marginTop: "14px", fontSize: "10px", color: T.textDim }}>
            Ao continuar você concorda com os{" "}
            <button onClick={() => onShowTermos && onShowTermos()} style={{ background: "none", border: "none", cursor: "pointer", color: T.accent, fontSize: "10px", padding: 0, textDecoration: "underline" }}>
              Termos de Uso
            </button>
            {" "}e a{" "}
            <button onClick={() => onShowTermos && onShowTermos("privacidade")} style={{ background: "none", border: "none", cursor: "pointer", color: T.accent, fontSize: "10px", padding: 0, textDecoration: "underline" }}>
              Política de Privacidade
            </button>
          </div>
        </>)}

      </div>
    </div>
  );
}
