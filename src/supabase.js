import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ─── Plan limits ─── */
export const PLAN_LIMITS = {
  free:       { projects: 2,  label: "Grátis",      price: 0 },
  basic:      { projects: 10, label: "Básico",       price: 79 },
  pro:        { projects: Infinity, label: "Pro",    price: 149 },
  enterprise: { projects: Infinity, label: "Empresa",price: 299 },
};

/* ─── Auth helpers ─── */
export async function signInWithEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return { data, error };
}

/* ─── Project CRUD ─── */
export async function listProjects(userId) {
  return supabase
    .from("projects")
    .select("id, name, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
}

export async function loadProject(id) {
  return supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
}

export async function saveProject(userId, projectName, projectData, existingId = null) {
  const payload = {
    user_id: userId,
    name: projectName,
    data: projectData,
    updated_at: new Date().toISOString(),
  };
  if (existingId) {
    return supabase
      .from("projects")
      .update(payload)
      .eq("id", existingId)
      .eq("user_id", userId)
      .select()
      .single();
  }
  return supabase
    .from("projects")
    .insert({ ...payload })
    .select()
    .single();
}

export async function deleteProject(id, userId) {
  return supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
}
