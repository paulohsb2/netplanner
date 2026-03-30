import { X } from "lucide-react";

const T = {
  white: "#ffffff", border: "#dfe3ea",
  text: "#1a2332", textMuted: "#5f6b7a", textDim: "#9ca3af",
  accent: "#2563eb", shadow: "0 4px 24px rgba(0,0,0,0.14)",
};

const Section = ({ title, children }) => (
  <div style={{ marginBottom: "20px" }}>
    <h3 style={{ fontSize: "14px", fontWeight: 700, color: T.text, margin: "0 0 8px" }}>{title}</h3>
    <p style={{ fontSize: "13px", color: T.textMuted, lineHeight: "1.7", margin: 0 }}>{children}</p>
  </div>
);

export default function TermosModal({ tab = "termos", onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999999, backdropFilter: "blur(4px)", padding: "16px" }}>
      <div style={{ background: T.white, borderRadius: "16px", width: "560px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: T.shadow, position: "relative" }}>

        <div style={{ padding: "24px 28px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: T.text }}>
            {tab === "privacidade" ? "Política de Privacidade" : "Termos de Uso"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "24px 28px", overflowY: "auto" }}>
          {tab === "termos" ? (<>
            <Section title="1. Aceitação dos Termos">
              Ao criar uma conta e utilizar o NetPlanner, você concorda com estes Termos de Uso. Caso não concorde, não utilize o serviço.
            </Section>
            <Section title="2. Descrição do Serviço">
              O NetPlanner é uma ferramenta SaaS para planejamento de redes CFTV e infraestrutura de rede. O acesso é concedido mediante assinatura de um dos planos disponíveis (Básico, Pro ou Empresa), com período de teste gratuito de 7 dias.
            </Section>
            <Section title="3. Assinatura e Pagamento">
              As assinaturas são cobradas mensalmente em Reais (BRL) via cartão de crédito através da plataforma Stripe. O valor é debitado automaticamente a cada mês após o término do período de teste. Não há reembolso proporcional por cancelamento antecipado dentro do período já pago.
            </Section>
            <Section title="4. Cancelamento">
              Você pode cancelar sua assinatura a qualquer momento. O acesso permanece ativo até o fim do período já pago. Após o cancelamento, os projetos armazenados na nuvem ficam inacessíveis, mas podem ser exportados em JSON antes do cancelamento.
            </Section>
            <Section title="5. Uso Permitido">
              O NetPlanner destina-se a uso profissional e empresarial legítimo. É proibido: compartilhar credenciais entre múltiplos usuários não autorizados, realizar engenharia reversa do software, ou utilizar o serviço para fins ilegais.
            </Section>
            <Section title="6. Disponibilidade">
              O serviço é fornecido "como está". Não garantimos disponibilidade ininterrupta, embora nos esforcemos para manter uptime máximo. Manutenções programadas serão comunicadas com antecedência.
            </Section>
            <Section title="7. Alterações">
              Estes termos podem ser atualizados a qualquer momento. Mudanças significativas serão comunicadas por e-mail com no mínimo 15 dias de antecedência.
            </Section>
            <Section title="8. Contato">
              Dúvidas sobre os termos: suporte@netplanner.com.br
            </Section>
          </>) : (<>
            <Section title="1. Dados Coletados">
              Coletamos: endereço de e-mail (para autenticação e comunicação), dados dos projetos criados (armazenados de forma segura no Supabase), e informações de pagamento (gerenciadas pelo Stripe — não armazenamos dados de cartão).
            </Section>
            <Section title="2. Uso dos Dados">
              Seus dados são usados exclusivamente para: operar e melhorar o NetPlanner, processar pagamentos de assinatura, enviar comunicações sobre o serviço (atualizações, faturas). Não vendemos ou compartilhamos seus dados com terceiros para fins de marketing.
            </Section>
            <Section title="3. Armazenamento e Segurança">
              Dados armazenados no Supabase (PostgreSQL com RLS — Row Level Security). Cada usuário acessa apenas seus próprios projetos. Conexões protegidas por TLS/HTTPS.
            </Section>
            <Section title="4. Seus Direitos (LGPD)">
              Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a: acessar seus dados, corrigir dados incorretos, solicitar exclusão da conta e dados, e portabilidade dos dados em formato JSON.
            </Section>
            <Section title="5. Retenção de Dados">
              Dados de projetos são mantidos enquanto a conta estiver ativa. Após exclusão da conta, os dados são removidos em até 30 dias.
            </Section>
            <Section title="6. Cookies">
              Utilizamos apenas cookies essenciais para autenticação de sessão. Não utilizamos cookies de rastreamento ou publicidade.
            </Section>
            <Section title="7. Contato">
              Para exercer seus direitos ou tirar dúvidas sobre privacidade: privacidade@netplanner.com.br
            </Section>
          </>)}

          <p style={{ fontSize: "11px", color: T.textDim, marginTop: "8px" }}>Última atualização: março de 2026</p>
        </div>

      </div>
    </div>
  );
}
