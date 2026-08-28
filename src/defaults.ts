import type { BriefData, Device, Hotspot } from "./types";

export const defaultBrief: BriefData = {
  productName: "Amlou pour enfant",
  targetAudience: "Parents",
  price: "149",
  currency: "Dhs",
  language: "fr",
  landingMode: "hybrid",
  whatsappNumber: "2126XXXXXXXX",
  ctaText: "Commander sur WhatsApp",
  baseMessage: "Bonjour, je souhaite commander l'Amlou pour enfant à 149 Dhs.",
  heroTitle: "Un Amlou pensé pour votre enfant",
  subtitle:
    "Une offre simple pour les parents qui souhaitent commander un Amlou pour enfant directement via WhatsApp.",
  benefits: [
    { title: "Pensé pour les enfants", text: "Un Amlou proposé spécialement pour les enfants." },
    { title: "Prix clair : 149 Dhs", text: "Vous connaissez directement le prix : 149 Dhs." },
    {
      title: "Commande facile sur WhatsApp",
      text: "Contactez-nous directement sur WhatsApp pour envoyer votre demande.",
    },
  ],
  faqs: [
    { question: "Cet Amlou est destiné à qui ?", answer: "Cette offre concerne un Amlou pour enfant." },
    { question: "Quel est le prix ?", answer: "Le prix de l'Amlou est de 149 Dhs." },
    {
      question: "Comment passer ma demande ?",
      answer: "Cliquez sur le bouton WhatsApp et envoyez-nous directement votre demande.",
    },
  ],
  formFields: ["Nom", "Téléphone / WhatsApp", "Ville", "Quantité"],
  forbiddenClaims: ["healthy", "natural", "organic", "bien-être", "safe", "nutritious", "energy", "vitamins"],
  visualStyle:
    "Fond crème chaleureux, vert foncé, accents amande et brun, détails décoratifs inspirés du Maroc, style premium simple, cartes arrondies, photographie produit réaliste.",
};

export const defaultHotspots: Record<Device, Hotspot[]> = {
  desktop: [
    { id: "hero", label: "CTA héro", left: 9.65, top: 28.72, width: 28.8, height: 3.18, device: "desktop", message: "" },
    {
      id: "milieu",
      label: "CTA milieu",
      left: 53.04,
      top: 62.14,
      width: 28.55,
      height: 2.78,
      device: "desktop",
      message: "",
    },
    { id: "bas", label: "CTA bas", left: 30.05, top: 97.25, width: 39.65, height: 2.68, device: "desktop", message: "" },
  ],
  mobile: [
    { id: "hero", label: "CTA héro", left: 7.25, top: 23.42, width: 33.5, height: 2.25, device: "mobile", message: "" },
    {
      id: "formulaire",
      label: "CTA formulaire",
      left: 14.1,
      top: 82.38,
      width: 71.4,
      height: 1.95,
      device: "mobile",
      message: "",
    },
    { id: "bas", label: "CTA bas", left: 10.15, top: 94.88, width: 47.2, height: 2.25, device: "mobile", message: "" },
  ],
};

export const landingModeLabels = {
  whatsapp: "Commandes WhatsApp",
  leads: "Capture de leads",
  hybrid: "WhatsApp + formulaire",
} as const;

export const STICKY_LABEL_FALLBACK = "Bouton WhatsApp fixe";
