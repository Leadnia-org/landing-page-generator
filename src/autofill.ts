import type { Benefit, BriefData, FaqItem, LandingLanguage } from "./types";

export interface GeneratedTexts {
  ctaText: string;
  baseMessage: string;
  heroTitle: string;
  subtitle: string;
  benefits: Benefit[];
  faqs: FaqItem[];
  formFields: string[];
  hotspotMessages: { order: string; question: string; delivery: string };
}

interface Seed {
  product: string;
  price: string;
  audience: string;
}

type Pack = (seed: Seed) => GeneratedTexts;

/**
 * Remplissage pour les briefs pauvres en informations : on ne fabrique aucune
 * promesse (livraison, qualité, garantie), uniquement des phrases qui
 * reformulent ce que le client a déjà donné.
 */
const packs: Record<LandingLanguage, Pack> = {
  fr: ({ product, price, audience }) => ({
    ctaText: "Commander sur WhatsApp",
    baseMessage: `Bonjour, je souhaite commander ${product} (${price}).`,
    heroTitle: `${product} — ${price}`,
    subtitle: `Commandez ${product} à ${price} directement sur WhatsApp.`,
    benefits: [
      { title: `Prix clair : ${price}`, text: `Le prix affiché est ${price}.` },
      { title: "Commande sur WhatsApp", text: "Vous envoyez votre demande en un clic, sans créer de compte." },
      { title: `Pour ${audience}`, text: `Cette offre s'adresse à ${audience}.` },
    ],
    faqs: [
      { question: "Quel est le prix ?", answer: `Le prix est de ${price}.` },
      {
        question: "Comment passer commande ?",
        answer: "Cliquez sur le bouton WhatsApp et envoyez-nous votre demande.",
      },
      { question: "À qui s'adresse cette offre ?", answer: `Cette offre s'adresse à ${audience}.` },
    ],
    formFields: ["Nom", "Téléphone / WhatsApp", "Ville", "Quantité"],
    hotspotMessages: {
      order: `Bonjour, je souhaite commander ${product} (${price}).`,
      question: `Bonjour, j'ai une question sur ${product}.`,
      delivery: `Bonjour, je voudrais des informations sur la livraison de ${product}.`,
    },
  }),
  en: ({ product, price, audience }) => ({
    ctaText: "Order on WhatsApp",
    baseMessage: `Hello, I would like to order ${product} (${price}).`,
    heroTitle: `${product} — ${price}`,
    subtitle: `Order ${product} at ${price} directly on WhatsApp.`,
    benefits: [
      { title: `Clear price: ${price}`, text: `The listed price is ${price}.` },
      { title: "Order on WhatsApp", text: "Send your request in one tap, no account needed." },
      { title: `For ${audience}`, text: `This offer is meant for ${audience}.` },
    ],
    faqs: [
      { question: "What is the price?", answer: `The price is ${price}.` },
      { question: "How do I order?", answer: "Tap the WhatsApp button and send us your request." },
      { question: "Who is this for?", answer: `This offer is meant for ${audience}.` },
    ],
    formFields: ["Name", "Phone / WhatsApp", "City", "Quantity"],
    hotspotMessages: {
      order: `Hello, I would like to order ${product} (${price}).`,
      question: `Hello, I have a question about ${product}.`,
      delivery: `Hello, I would like delivery details for ${product}.`,
    },
  }),
  "darija-lat": ({ product, price, audience }) => ({
    ctaText: "Tleb 3la WhatsApp",
    baseMessage: `Salam, bghit ntleb ${product} (${price}).`,
    heroTitle: `${product} — ${price}`,
    subtitle: `Tleb ${product} b ${price} direct 3la WhatsApp.`,
    benefits: [
      { title: `Taman wade7 : ${price}`, text: `Taman li kayn howa ${price}.` },
      { title: "Talab 3la WhatsApp", text: "Kat sifet talab dyalek b klik wa7da, bla ma t compte." },
      { title: `L ${audience}`, text: `Had l3ard mwajah l ${audience}.` },
    ],
    faqs: [
      { question: "Ch7al taman ?", answer: `Taman howa ${price}.` },
      { question: "Kifach ntleb ?", answer: "Kliki 3la boutton WhatsApp o sifet lina talab dyalek." },
      { question: "L mn mwajah had l3ard ?", answer: `Had l3ard mwajah l ${audience}.` },
    ],
    formFields: ["Smiya", "Telephone / WhatsApp", "Mdina", "Chi7al men wa7ed"],
    hotspotMessages: {
      order: `Salam, bghit ntleb ${product} (${price}).`,
      question: `Salam, 3endi so2al 3la ${product}.`,
      delivery: `Salam, bghit n3ref 3la livraison dyal ${product}.`,
    },
  }),
  "darija-ar": ({ product, price, audience }) => ({
    ctaText: "طلب عبر واتساب",
    baseMessage: `السلام، بغيت نطلب ${product} (${price}).`,
    heroTitle: `${product} — ${price}`,
    subtitle: `طلب ${product} ب ${price} ديريكت عبر واتساب.`,
    benefits: [
      { title: `الثمن واضح : ${price}`, text: `الثمن هو ${price}.` },
      { title: "الطلب عبر واتساب", text: "كتصيفط الطلب ديالك بكليك واحد، بلا ما تكري حساب." },
      { title: `ل${audience}`, text: `هاد العرض موجه ل${audience}.` },
    ],
    faqs: [
      { question: "شحال الثمن ؟", answer: `الثمن هو ${price}.` },
      { question: "كيفاش نطلب ؟", answer: "كليكي على بوطون واتساب وصيفط لينا الطلب ديالك." },
      { question: "لمن موجه هاد العرض ؟", answer: `هاد العرض موجه ل${audience}.` },
    ],
    formFields: ["السمية", "الهاتف / واتساب", "المدينة", "الكمية"],
    hotspotMessages: {
      order: `السلام، بغيت نطلب ${product} (${price}).`,
      question: `السلام، عندي سؤال على ${product}.`,
      delivery: `السلام، بغيت نعرف على التوصيل ديال ${product}.`,
    },
  }),
  ar: ({ product, price, audience }) => ({
    ctaText: "اطلب عبر واتساب",
    baseMessage: `مرحبا، أرغب في طلب ${product} (${price}).`,
    heroTitle: `${product} — ${price}`,
    subtitle: `اطلب ${product} بسعر ${price} مباشرة عبر واتساب.`,
    benefits: [
      { title: `سعر واضح : ${price}`, text: `السعر المعروض هو ${price}.` },
      { title: "الطلب عبر واتساب", text: "أرسل طلبك بنقرة واحدة، دون إنشاء حساب." },
      { title: `موجه إلى ${audience}`, text: `هذا العرض موجه إلى ${audience}.` },
    ],
    faqs: [
      { question: "ما هو السعر ؟", answer: `السعر هو ${price}.` },
      { question: "كيف أطلب ؟", answer: "اضغط على زر واتساب وأرسل لنا طلبك." },
      { question: "لمن هذا العرض ؟", answer: `هذا العرض موجه إلى ${audience}.` },
    ],
    formFields: ["الاسم", "الهاتف / واتساب", "المدينة", "الكمية"],
    hotspotMessages: {
      order: `مرحبا، أرغب في طلب ${product} (${price}).`,
      question: `مرحبا، لدي سؤال حول ${product}.`,
      delivery: `مرحبا، أريد معلومات عن توصيل ${product}.`,
    },
  }),
};

function seedFrom(brief: BriefData): Seed {
  const product = brief.productName.trim() || "ce produit";
  const price = `${brief.price} ${brief.currency}`.trim() || "prix à confirmer";
  const audience = brief.targetAudience.trim() || "vos clients";
  return { product, price, audience };
}

export function generateTexts(brief: BriefData): GeneratedTexts {
  const pack = packs[brief.language] || packs.fr;
  return pack(seedFrom(brief));
}

/**
 * `mode: "empty"` ne touche qu'aux champs laissés vides — c'est le cas
 * « je n'ai que le nom, le prix et le numéro ». `mode: "all"` réécrit tout,
 * utile après un changement de langue.
 */
export function applyGeneratedTexts(brief: BriefData, mode: "empty" | "all"): BriefData {
  const generated = generateTexts(brief);
  const keep = (current: string, fallback: string): string =>
    mode === "all" || !current.trim() ? fallback : current;

  const benefitsEmpty = brief.benefits.every((benefit) => !benefit.title.trim() && !benefit.text.trim());
  const faqsEmpty = brief.faqs.every((faq) => !faq.question.trim() && !faq.answer.trim());

  return {
    ...brief,
    ctaText: keep(brief.ctaText, generated.ctaText),
    baseMessage: keep(brief.baseMessage, generated.baseMessage),
    heroTitle: keep(brief.heroTitle, generated.heroTitle),
    subtitle: keep(brief.subtitle, generated.subtitle),
    benefits: mode === "all" || benefitsEmpty ? generated.benefits : brief.benefits,
    faqs: mode === "all" || faqsEmpty ? generated.faqs : brief.faqs,
    formFields: mode === "all" || !brief.formFields.length ? generated.formFields : brief.formFields,
  };
}

/** Champs strictement nécessaires pour produire une landing page utilisable. */
export function missingEssentials(brief: BriefData): string[] {
  const missing: string[] = [];
  if (!brief.productName.trim()) missing.push("nom du produit");
  if (!brief.price.trim()) missing.push("prix");
  if (!brief.whatsappNumber.trim()) missing.push("numéro WhatsApp");
  return missing;
}
