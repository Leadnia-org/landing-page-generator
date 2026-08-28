import type { BriefData } from "../types";
import { whatsappLink } from "./whatsapp";

export function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttr(value: string | number): string {
  return escapeHtml(value).replaceAll("\n", " ");
}

export function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "landing-page"
  );
}

export function formatPrice(brief: BriefData): string {
  return `${brief.price} ${brief.currency}`.trim();
}

export function fieldName(label: string, index: number): string {
  const slug = slugify(label).replaceAll("-", "_");
  return slug || `champ_${index + 1}`;
}

export function fieldType(label: string): "email" | "number" | "tel" | "text" {
  const normalized = slugify(label);
  if (normalized.includes("mail")) return "email";
  if (normalized.includes("telephone") || normalized.includes("whatsapp") || normalized.includes("phone")) return "tel";
  if (normalized.includes("quantite") || normalized.includes("quantity")) return "number";
  return "text";
}

export function whatsappUrl(brief: BriefData, message: string): string {
  return whatsappLink(brief.whatsappNumber, message);
}

export function linesToText(lines: string[]): string {
  return lines.join("\n");
}

export function textToLines(text: string): string[] {
  return text
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
