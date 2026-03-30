import { useState, useEffect } from "react";
import { X, Plus, Trash2, FolderOpen, Cloud, Clock } from "lucide-react";
import { listProjects, deleteProject, PLAN_LIMITS } from "./supabase";

const T = {
  white: "#ffffff", bg: "#f5f6f8", border: "#dfe3ea", borderLight: "#edf0f4",
  accent: "#2563eb", accentLight: "#dbeafe",
  text: "#1a2332", textMuted: "#5f6b7a", textDim: "#9ca3af",
  danger: "#dc2626", dangerLight: "#fef2f2",
  shadow: "0 4px 24px rgba(0,0,0,0.12)",
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ProjectsModal({ user, profile, onClose, onLoad, onNew, currentProjectId }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const plan = profile?.plan || "free";
  const limit = PLAN_LIMITS[plan]?.projects ?? 2;
  const atLimit = projects.length >= limit;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    listProjects(user.id).then(({ data, error }) => {
      if (!error && data) setProjects(data);
      setLoading(false);
    });
  }, [user]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Excluir este projeto? Esta ação não pode ser desfeita.")) return;
    setDeleting(id);
    await deleteProject(id, user.id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, backdropFilter: "blur(4px)" }}>
      <div style={{ background: T.white, borderRadius: "16px", padding: "28px", width: "520px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: T.shadow, position: "relative" }}>

        <button onClick={onClose} style={{ position: "absolute", top: "14px", right: "14px", background: "none", border: "none", cursor: "pointer", color: T.textDim }}>
          <X size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <Cloud size={20} color={T.accent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>Projetos na nuvem</div>
            <div style={{ fontSize: "11px", color: T.textDim }}>
              {projects.length} / {limit === Infinity ? "∞" : limit} projeto(s) · Plano {PLAN_LIMITS[plan]?.label}
            </div>
          </div>
          <button
            onClick={() => { if (!atLimit) { onNew(); onClose(); } }}
            disabled={atLimit}
            style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px", border: "none", cursor: atLimit ? "not-allowed" : "pointer", background: atLimit ? T.bg : T.accent, color: atLimit ? T.textDim : "#fff", fontSize: "12px", fontWeight: 600, opacity: atLimit ? 0.7 : 1 }}
          >
            <Plus size={13} /> Novo projeto
          </button>
        </div>

        {atLimit && (
          <div style={{ background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: "8px", padding: "10px 14px", fontSize: "11px", color: "#92400e", marginBottom: "14px" }}>
            Limite de projetos atingido no plano {PLAN_LIMITS[plan]?.label}. Faça upgrade para criar mais projetos.
          </div>
        )}

        {/* Projects list */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "32px", color: T.textDim, fontSize: "13px" }}>Carregando projetos...</div>
          ) : projects.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: T.textDim }}>
              <Cloud size={36} color={T.border} style={{ marginBottom: "10px" }} />
              <div style={{ fontSize: "13px", fontWeight: 600, color: T.textMuted }}>Nenhum projeto salvo</div>
              <div style={{ fontSize: "11px", marginTop: "4px" }}>Crie um novo projeto para começar</div>
            </div>
          ) : projects.map(p => {
            const isCurrent = p.id === currentProjectId;
            return (
              <div
                key={p.id}
                onClick={() => { onLoad(p.id); onClose(); }}
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "10px", border: `1px solid ${isCurrent ? T.accent + "50" : T.borderLight}`, cursor: "pointer", background: isCurrent ? T.accentLight : T.white, transition: "all .15s" }}
              >
                <FolderOpen size={18} color={isCurrent ? T.accent : T.textDim} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: "10px", color: T.textDim, display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                    <Clock size={9} />
                    Atualizado {formatDate(p.updated_at)}
                  </div>
                </div>
                {isCurrent && <span style={{ fontSize: "9px", fontWeight: 700, color: T.accent, background: T.accentLight, padding: "2px 7px", borderRadius: "4px", border: `1px solid ${T.accent}30` }}>ABERTO</span>}
                <button
                  onClick={(e) => handleDelete(p.id, e)}
                  disabled={deleting === p.id}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: "4px", borderRadius: "5px", display: "flex" }}
                  title="Excluir projeto"
                >
                  <Trash2 size={14} color={T.danger} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
