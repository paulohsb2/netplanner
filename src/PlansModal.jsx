import { useState } from "react";
import { X, Check, Zap } from "lucide-react";

const T = {
  white: "#ffffff", border: "#dfe3ea", borderLight: "#edf0f4",
  accent: "#2563eb", accentLight: "#dbeafe",
  text: "#1a2332", textMuted: "#5f6b7a", textDim: "#9ca3af",
  shadow: "0 4px 24px rgba(0,0,0,0.14)",
};

const PLANS = [
  {
    id: "free",
    name: "Grátis",
    price: 0,
    period: "",
    color: "#64748b",
    features: ["2 projetos na nuvem", "Exportação PDF e PNG", "Visualizador 3D", "Cálculo DORI"],
    cta: "Plano atual",
    disabled: true,
  },
  {
    id: "basic",
    name: "Básico",
    price: 79,
    period: "/mês",
    color: "#2563eb",
    features: ["10 projetos na nuvem", "Tudo do Grátis", "Lista de Materiais (BOM)", "Logomarca própria no PDF", "Suporte por e-mail"],
    cta: "Assinar Básico",
    highlight: false,
    priceId: "price_basic",
  },
  {
    id: "pro",
    name: "Pro",
    price: 149,
    period: "/mês",
    color: "#7c3aed",
    features: ["Projetos ilimitados", "Tudo do Básico", "Exportação HTML 3D ilimitada", "Subtipo de câmera avançado", "Prioridade no suporte"],
    cta: "Assinar Pro",
    highlight: true,
    priceId: "price_pro",
  },
  {
    id: "enterprise",
    name: "Empresa",
    price: 299,
    period: "/mês",
    color: "#059669",
    features: ["Tudo do Pro", "Multi-usuário (até 5)", "White-label (remover marca)", "Relatórios avançados", "Suporte prioritário via WhatsApp"],
    cta: "Assinar Empresa",
    highlight: false,
    priceId: "price_enterprise",
  },
];

export default function PlansModal({ currentPlan = "free", user, onClose, onSubscribe }) {
  const [loading, setLoading] = useState(null);

  const handleSubscribe = async (plan) => {
    if (!user) { onClose(); return; }
    if (plan.disabled || plan.id === currentPlan) return;
    setLoading(plan.id);
    try {
      await onSubscribe(plan.priceId);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, backdropFilter: "blur(4px)", padding: "16px" }}>
      <div style={{ background: "#f8fafc", borderRadius: "20px", padding: "32px", maxWidth: "900px", width: "100%", boxShadow: T.shadow, position: "relative", maxHeight: "90vh", overflow: "auto" }}>

        <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: T.textDim }}>
          <X size={20} />
        </button>

        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: T.accentLight, border: "1px solid #bfdbfe", borderRadius: "20px", padding: "4px 12px", fontSize: "11px", fontWeight: 700, color: T.accent, marginBottom: "10px" }}>
            <Zap size={12} /> PLANOS NETPLANNER
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: T.text }}>Escolha o plano ideal</div>
          <div style={{ fontSize: "13px", color: T.textMuted, marginTop: "6px" }}>7 dias grátis em todos os planos · Cartão de crédito · Cancele quando quiser</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan;
            const isHighlight = plan.highlight;
            return (
              <div key={plan.id} style={{ background: T.white, borderRadius: "14px", padding: "20px 16px", border: isHighlight ? `2px solid ${plan.color}` : `1px solid ${T.border}`, position: "relative", boxShadow: isHighlight ? `0 4px 20px ${plan.color}25` : T.shadow }}>
                {isHighlight && (
                  <div style={{ position: "absolute", top: "-11px", left: "50%", transform: "translateX(-50%)", background: plan.color, color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 12px", borderRadius: "20px", whiteSpace: "nowrap", letterSpacing: "0.5px" }}>
                    MAIS POPULAR
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position: "absolute", top: "-11px", left: "50%", transform: "translateX(-50%)", background: "#64748b", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 12px", borderRadius: "20px", whiteSpace: "nowrap" }}>
                    SEU PLANO
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: plan.color }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{plan.name}</span>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 800, color: T.text }}>
                    {plan.price === 0 ? "Grátis" : `R$${plan.price}`}
                  </span>
                  <span style={{ fontSize: "12px", color: T.textDim }}>{plan.period}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "18px" }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "11px", color: T.textMuted }}>
                      <Check size={12} color={plan.color} style={{ flexShrink: 0, marginTop: "1px" }} />
                      {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrent || loading === plan.id}
                  style={{
                    width: "100%", padding: "9px", borderRadius: "8px", border: "none", cursor: (isCurrent || loading === plan.id) ? "not-allowed" : "pointer",
                    background: isCurrent ? "#f1f5f9" : plan.color, color: isCurrent ? T.textDim : "#fff",
                    fontSize: "12px", fontWeight: 700, transition: "all .15s",
                    opacity: loading === plan.id ? 0.7 : 1,
                  }}
                >
                  {loading === plan.id ? "Aguarde..." : isCurrent ? "Plano atual" : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "11px", color: T.textDim }}>
          Os planos pagos incluem 7 dias de teste grátis. Cobrança automática mensal em BRL via cartão de crédito. Cancele quando quiser.
        </div>
      </div>
    </div>
  );
}
