import type { BriefData, Device, Hotspot, UploadedImage } from "./types";
import { normalizeWhatsAppNumber } from "./utils/whatsapp";
import { normalizeSearchText } from "./utils/text";

export interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  /** Selecteur du champ a corriger : la ligne en echec devient cliquable. */
  target?: string;
}

/** Les zones cliquables existent dans les trois modes : seule leur action change. */
export function usesHotspots(): boolean {
  return true;
}

export function needsVisualWhatsApp(brief: BriefData): boolean {
  return brief.landingMode !== "leads";
}

export function defaultHotspotAction(brief: BriefData): "whatsapp" | "form" {
  return brief.landingMode === "leads" ? "form" : "whatsapp";
}

export function needsLeadForm(brief: BriefData): boolean {
  return brief.landingMode !== "whatsapp";
}

export function looksLikePlaceholderWhatsApp(number: string): boolean {
  return !normalizeWhatsAppNumber(number).valid;
}

export function findForbiddenTerms(brief: BriefData): string[] {
  const haystack = normalizeSearchText(
    [
      brief.productName,
      brief.targetAudience,
      brief.ctaText,
      brief.baseMessage,
      brief.heroTitle,
      brief.subtitle,
      brief.visualStyle,
      ...brief.benefits.flatMap((benefit) => [benefit.title, benefit.text]),
      ...brief.faqs.flatMap((faq) => [faq.question, faq.answer]),
    ].join(" ")
  );

  return brief.forbiddenClaims.filter((claim) => {
    const normalized = normalizeSearchText(claim);
    return normalized.length > 1 && haystack.includes(normalized);
  });
}

export function hotspotIsValid(hotspot: Hotspot): boolean {
  return (
    hotspot.left >= 0 &&
    hotspot.top >= 0 &&
    hotspot.width > 0 &&
    hotspot.height > 0 &&
    hotspot.left + hotspot.width <= 100.5 &&
    hotspot.top + hotspot.height <= 100.5
  );
}

/** Zones minuscules : le doigt les rate, même si le rectangle est bien placé. */
export function hotspotIsTiny(hotspot: Hotspot): boolean {
  return hotspot.width < 4 || hotspot.height < 0.4;
}

export function createChecklist(
  brief: BriefData,
  images: Partial<Record<Device, UploadedImage>>,
  hotspots: Record<Device, Hotspot[]>
): ChecklistItem[] {
  const forbiddenTerms = findForbiddenTerms(brief);
  const numberCheck = normalizeWhatsAppNumber(brief.whatsappNumber);
  const allHotspots = [...hotspots.desktop, ...hotspots.mobile];
  const visualWhatsApp = needsVisualWhatsApp(brief);
  const whatsappHotspots = allHotspots.filter((hotspot) => hotspot.action !== "form");

  return [
    {
      id: "desktop-image",
      target: "#desktopMockup",
      label: "Image desktop importée",
      passed: Boolean(images.desktop),
      blocking: true,
    },
    {
      id: "mobile-image",
      target: "#mobileMockup",
      label: "Image mobile importée",
      passed: Boolean(images.mobile),
      blocking: true,
    },
    {
      id: "whatsapp",
      target: "input[name=\"whatsappNumber\"]",
      label: numberCheck.valid
        ? `Numéro WhatsApp valide (wa.me/${numberCheck.digits})`
        : `Numéro WhatsApp : ${numberCheck.problem}`,
      passed: numberCheck.valid,
      blocking: true,
    },
    {
      id: "cta",
      target: "input[name=\"ctaText\"]",
      label: whatsappHotspots.length || visualWhatsApp ? "CTA et message WhatsApp renseignés" : "CTA renseigné",
      passed: Boolean(brief.ctaText.trim() && brief.baseMessage.trim()),
      blocking: true,
    },
    {
      id: "hotspot-count",
      target: "#hotspotEditor",
      label: "Au moins une zone cliquable par image",
      passed: hotspots.desktop.length > 0 && hotspots.mobile.length > 0,
      blocking: true,
    },
    {
      id: "hotspots",
      target: "#hotspotEditor",
      label: "Zones cliquables dans les limites de l'image",
      passed: allHotspots.every(hotspotIsValid),
      blocking: true,
    },
    {
      id: "hotspot-size",
      target: "#hotspotEditor",
      label: "Zones assez grandes pour être touchées au doigt",
      passed: !allHotspots.some(hotspotIsTiny),
      blocking: false,
    },
    {
      id: "claims",
      target: "textarea[name=\"forbiddenClaims\"]",
      label: forbiddenTerms.length
        ? `Mots interdits détectés : ${forbiddenTerms.join(", ")}`
        : "Aucun mot interdit détecté dans le brief",
      passed: forbiddenTerms.length === 0,
      blocking: true,
    },
  ];
}
