import type { LandingLanguage } from "./types";

export interface LandingStrings {
  formTitleOrder: string;
  formTitleLead: string;
  submitLead: string;
  sourceLabel: string;
  refLabel: string;
  fallbackTitle: string;
  fallbackText: string;
  copyNumber: string;
  copied: string;
  openWeb: string;
  closeLabel: string;
  benefitsTitle: string;
  faqTitle: string;
  priceLabel: string;
}

export interface LanguageMeta {
  id: LandingLanguage;
  /** Libellé affiché dans l'outil (interface en français). */
  label: string;
  htmlLang: string;
  dir: "ltr" | "rtl";
  /** Consigne de langue injectée dans le prompt ChatGPT Images. */
  promptInstruction: string;
  strings: LandingStrings;
}

export const languages: Record<LandingLanguage, LanguageMeta> = {
  fr: {
    id: "fr",
    label: "Français",
    htmlLang: "fr",
    dir: "ltr",
    promptInstruction:
      "Toute la page doit être écrite en français, sans faute d'orthographe, lecture de gauche à droite.",
    strings: {
      formTitleOrder: "Commander sur WhatsApp",
      formTitleLead: "Demande de contact",
      submitLead: "Envoyer ma demande",
      sourceLabel: "Vu sur",
      refLabel: "Réf",
      fallbackTitle: "WhatsApp ne s'est pas ouvert ?",
      fallbackText: "Enregistrez le numéro ou ouvrez WhatsApp Web pour envoyer votre message.",
      copyNumber: "Copier le numéro",
      copied: "Numéro copié",
      openWeb: "Ouvrir WhatsApp Web",
      closeLabel: "Fermer",
      benefitsTitle: "Points clés",
      faqTitle: "Questions fréquentes",
      priceLabel: "Prix",
    },
  },
  "darija-ar": {
    id: "darija-ar",
    label: "Darija (alphabet arabe)",
    htmlLang: "ary",
    dir: "rtl",
    promptInstruction:
      "Toute la page doit être écrite en darija marocaine, en alphabet arabe, avec une mise en page de droite à gauche (RTL). Aucun texte en français ni en anglais dans l'image.",
    strings: {
      formTitleOrder: "طلب عبر واتساب",
      formTitleLead: "طلب تواصل",
      submitLead: "صيفط الطلب",
      sourceLabel: "جا من",
      refLabel: "رقم الطلب",
      fallbackTitle: "واتساب ما تحلش؟",
      fallbackText: "نسخ الرقم ولا حل واتساب ويب باش تصيفط الرسالة ديالك.",
      copyNumber: "نسخ الرقم",
      copied: "الرقم تنسخ",
      openWeb: "حل واتساب ويب",
      closeLabel: "سد",
      benefitsTitle: "النقط المهمة",
      faqTitle: "أسئلة كثر مطروحة",
      priceLabel: "الثمن",
    },
  },
  "darija-lat": {
    id: "darija-lat",
    label: "Darija (alphabet latin)",
    htmlLang: "ary-Latn",
    dir: "ltr",
    promptInstruction:
      "Toute la page doit être écrite en darija marocaine transcrite en alphabet latin (style SMS marocain), lecture de gauche à droite. Aucun texte en arabe classique.",
    strings: {
      formTitleOrder: "Tleb 3la WhatsApp",
      formTitleLead: "Talab dyal tawasol",
      submitLead: "Sifet talab dyali",
      sourceLabel: "Ja men",
      refLabel: "Ref",
      fallbackTitle: "WhatsApp ma t7alch ?",
      fallbackText: "Copiti raqm wla 7el WhatsApp Web bach tsifet message dyalek.",
      copyNumber: "Copier raqm",
      copied: "Raqm tcopia",
      openWeb: "7el WhatsApp Web",
      closeLabel: "Sed",
      benefitsTitle: "Nqat mohimma",
      faqTitle: "As2ila kaytsalo bezzaf",
      priceLabel: "Taman",
    },
  },
  ar: {
    id: "ar",
    label: "Arabe standard",
    htmlLang: "ar",
    dir: "rtl",
    promptInstruction:
      "Toute la page doit être écrite en arabe standard moderne, avec une mise en page de droite à gauche (RTL). Aucun texte en français ni en anglais dans l'image.",
    strings: {
      formTitleOrder: "اطلب عبر واتساب",
      formTitleLead: "طلب تواصل",
      submitLead: "أرسل طلبي",
      sourceLabel: "المصدر",
      refLabel: "المرجع",
      fallbackTitle: "لم يفتح واتساب؟",
      fallbackText: "انسخ الرقم أو افتح واتساب ويب لإرسال رسالتك.",
      copyNumber: "نسخ الرقم",
      copied: "تم نسخ الرقم",
      openWeb: "فتح واتساب ويب",
      closeLabel: "إغلاق",
      benefitsTitle: "النقاط الأساسية",
      faqTitle: "الأسئلة الشائعة",
      priceLabel: "السعر",
    },
  },
  en: {
    id: "en",
    label: "English",
    htmlLang: "en",
    dir: "ltr",
    promptInstruction: "The whole page must be written in English, left to right, with no spelling mistakes.",
    strings: {
      formTitleOrder: "Order on WhatsApp",
      formTitleLead: "Contact request",
      submitLead: "Send my request",
      sourceLabel: "Came from",
      refLabel: "Ref",
      fallbackTitle: "WhatsApp did not open?",
      fallbackText: "Copy the number or open WhatsApp Web to send your message.",
      copyNumber: "Copy number",
      copied: "Number copied",
      openWeb: "Open WhatsApp Web",
      closeLabel: "Close",
      benefitsTitle: "Key points",
      faqTitle: "Frequently asked questions",
      priceLabel: "Price",
    },
  },
};

export const languageOrder: LandingLanguage[] = ["fr", "darija-ar", "darija-lat", "ar", "en"];

export function languageMeta(language: LandingLanguage): LanguageMeta {
  return languages[language] || languages.fr;
}
