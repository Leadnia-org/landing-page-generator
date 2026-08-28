import { defaultBrief, defaultHotspots, emptySeed } from "./defaults";
import { languages } from "./i18n";
import type { BriefData, BriefSeed, Device, Hotspot } from "./types";

const STORAGE_KEY = "landing-page-generator:brief:v2";
const HOTSPOT_KEY = "landing-page-generator:hotspots:v2";
const SEED_KEY = "landing-page-generator:seed:v1";

export function loadBrief(): BriefData {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return cloneBrief(defaultBrief);

    const parsed = JSON.parse(stored) as Partial<BriefData>;
    const fallback = cloneBrief(defaultBrief);

    return {
      ...fallback,
      ...parsed,
      language: parsed.language && languages[parsed.language] ? parsed.language : fallback.language,
      benefits: parsed.benefits?.length ? parsed.benefits : fallback.benefits,
      faqs: parsed.faqs?.length ? parsed.faqs : fallback.faqs,
      formFields: parsed.formFields?.length ? parsed.formFields : fallback.formFields,
      forbiddenClaims: parsed.forbiddenClaims?.length ? parsed.forbiddenClaims : fallback.forbiddenClaims,
    };
  } catch {
    return cloneBrief(defaultBrief);
  }
}

export function saveBrief(brief: BriefData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(brief));
  } catch {
    /* quota plein ou navigation privée : la sauvegarde locale est un confort, pas une dépendance */
  }
}

export function resetSavedBrief(): BriefData {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(HOTSPOT_KEY);
  window.localStorage.removeItem(SEED_KEY);
  return cloneBrief(defaultBrief);
}

export function loadHotspots(): Record<Device, Hotspot[]> {
  try {
    const stored = window.localStorage.getItem(HOTSPOT_KEY);
    if (!stored) return cloneHotspots(defaultHotspots);

    const parsed = JSON.parse(stored) as Partial<Record<Device, Hotspot[]>>;
    const result = cloneHotspots(defaultHotspots);

    (["desktop", "mobile"] as Device[]).forEach((device) => {
      const list = parsed[device];
      if (!Array.isArray(list)) return;
      result[device] = list.map((hotspot, index) => ({
        id: String(hotspot.id || `zone-${index + 1}`),
        label: String(hotspot.label || `CTA ${index + 1}`),
        left: Number(hotspot.left) || 0,
        top: Number(hotspot.top) || 0,
        width: Number(hotspot.width) || 10,
        height: Number(hotspot.height) || 2,
        device,
        message: String(hotspot.message || ""),
        action: hotspot.action === "form" ? "form" : "whatsapp",
      }));
    });

    return result;
  } catch {
    return cloneHotspots(defaultHotspots);
  }
}

export function saveHotspots(hotspots: Record<Device, Hotspot[]>): void {
  try {
    window.localStorage.setItem(HOTSPOT_KEY, JSON.stringify(hotspots));
  } catch {
    /* voir saveBrief */
  }
}

export function cloneBrief(brief: BriefData): BriefData {
  return JSON.parse(JSON.stringify(brief)) as BriefData;
}

export function cloneHotspots(source: Record<Device, Hotspot[]>): Record<Device, Hotspot[]> {
  return JSON.parse(JSON.stringify(source)) as Record<Device, Hotspot[]>;
}

export function loadSeed(): BriefSeed {
  try {
    const stored = window.localStorage.getItem(SEED_KEY);
    if (!stored) return { ...emptySeed };
    const parsed = JSON.parse(stored) as Partial<BriefSeed>;
    return { ...emptySeed, ...parsed };
  } catch {
    return { ...emptySeed };
  }
}

export function saveSeed(seed: BriefSeed): void {
  try {
    window.localStorage.setItem(SEED_KEY, JSON.stringify(seed));
  } catch {
    /* voir saveBrief */
  }
}
