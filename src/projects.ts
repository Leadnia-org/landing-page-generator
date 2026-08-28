import { defaultBrief, defaultHotspots } from "./defaults";
import { cloneBrief, cloneHotspots } from "./storage";
import type { BriefData, Device, Hotspot, LandingProject } from "./types";

const PROJECTS_KEY = "landing-page-generator:projects:v1";

export function listProjects(): LandingProject[] {
  try {
    const stored = window.localStorage.getItem(PROJECTS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as LandingProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProject).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function findProject(id: string): LandingProject | undefined {
  return listProjects().find((project) => project.id === id);
}

export function upsertProject(project: LandingProject): LandingProject {
  const projects = listProjects().filter((item) => item.id !== project.id);
  const saved: LandingProject = { ...project, updatedAt: Date.now() };
  projects.push(saved);
  persist(projects);
  return saved;
}

export function createProject(
  name: string,
  brief: BriefData,
  hotspots: Record<Device, Hotspot[]>
): LandingProject {
  return upsertProject({
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || brief.productName.trim() || "Projet sans nom",
    updatedAt: Date.now(),
    brief: cloneBrief(brief),
    hotspots: cloneHotspots(hotspots),
  });
}

export function duplicateProject(id: string): LandingProject | null {
  const source = findProject(id);
  if (!source) return null;
  return createProject(`${source.name} (copie)`, source.brief, source.hotspots);
}

export function deleteProject(id: string): void {
  persist(listProjects().filter((project) => project.id !== id));
}

export function projectToJson(project: LandingProject): string {
  return JSON.stringify({ format: "landing-page-generator/project@1", project }, null, 2);
}

/** Import tolerant : on accepte un projet nu ou l'enveloppe exportee par l'outil. */
export function projectFromJson(text: string): LandingProject {
  const parsed = JSON.parse(text) as { project?: unknown } | unknown;
  const raw = (parsed as { project?: unknown }).project ?? parsed;

  if (!isProject(raw)) {
    throw new Error("Ce fichier ne contient pas un projet valide.");
  }

  const source = raw as LandingProject;
  const fallbackBrief = cloneBrief(defaultBrief);
  const fallbackHotspots = cloneHotspots(defaultHotspots);

  return {
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: String(source.name || "Projet importé"),
    updatedAt: Date.now(),
    brief: { ...fallbackBrief, ...source.brief },
    hotspots: {
      desktop: Array.isArray(source.hotspots?.desktop) ? source.hotspots.desktop : fallbackHotspots.desktop,
      mobile: Array.isArray(source.hotspots?.mobile) ? source.hotspots.mobile : fallbackHotspots.mobile,
    },
  };
}

function isProject(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LandingProject>;
  return Boolean(candidate.brief && candidate.hotspots && typeof candidate.name === "string");
}

function persist(projects: LandingProject[]): void {
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    /* quota plein : la liste reste en memoire pour cette session */
  }
}
