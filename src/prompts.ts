import { landingModeLabels } from "./defaults";
import { languageMeta } from "./i18n";
import type { BriefData, Device, Hotspot } from "./types";
import { formatPrice } from "./utils/text";
import { needsLeadForm, needsVisualWhatsApp } from "./validation";

export function buildImagePrompt(
  brief: BriefData,
  device: Device,
  hotspots: Hotspot[],
  productImageName?: string
): string {
  const language = languageMeta(brief.language);
  const isMobile = device === "mobile";
  const dimensions = isMobile
    ? "Format mobile vertical, ratio proche de 9:20, environ 840 x 1880 px."
    : "Format desktop vertical, ratio 2:3, environ 1024 x 1536 px.";
  const layout = isMobile
    ? "Mise en page mobile en une seule colonne, grands visuels, texte lisible, boutons larges et faciles à toucher."
    : "Mise en page desktop premium, héro en haut avec produit fort, sections claires, beaucoup d'espace et hiérarchie visuelle nette.";
  const referenceLine = productImageName
    ? `Le client joindra l'image produit nommée "${productImageName}". Utilise cette image comme référence principale du produit.`
    : "Le client joindra une image produit dans ChatGPT Images. Utilise cette image comme référence principale du produit.";
  const formInstruction = needsLeadForm(brief)
    ? `Prévoir une section formulaire visuelle simple, mais le vrai formulaire sera ajouté en HTML. Champs prévus : ${brief.formFields.join(", ")}.`
    : "Ne pas créer de formulaire principal. La conversion se fait par les boutons WhatsApp.";
  const forbidden = brief.forbiddenClaims.length
    ? `Ne pas ajouter ces mots ou promesses : ${brief.forbiddenClaims.join(", ")}.`
    : "Ne pas inventer de promesses non fournies.";

  return [
    "Crée une image de landing page complète.",
    language.promptInstruction,
    dimensions,
    layout,
    "",
    referenceLine,
    "",
    `Produit : ${brief.productName}`,
    `Prix : ${formatPrice(brief)}`,
    `Cible : ${brief.targetAudience}`,
    `Type de landing page : ${landingModeLabels[brief.landingMode]}`,
    `Style visuel : ${brief.visualStyle}`,
    "",
    "Texte exact à utiliser :",
    `Titre héro : ${brief.heroTitle}`,
    `Sous-titre : ${brief.subtitle}`,
    `Prix visible : ${formatPrice(brief)}`,
    `Bouton principal : ${brief.ctaText}`,
    "",
    "Bénéfices :",
    ...brief.benefits.map((benefit, index) => `${index + 1}. ${benefit.title} - ${benefit.text}`),
    "",
    "FAQ :",
    ...brief.faqs.flatMap((faq, index) => [`Q${index + 1} : ${faq.question}`, `R${index + 1} : ${faq.answer}`]),
    "",
    buildWhatsAppInstruction(brief, hotspots),
    formInstruction,
    "",
    "Contraintes importantes :",
    "Utiliser uniquement les informations fournies ci-dessus.",
    forbidden,
    "Ne pas inventer de bénéfices, chiffres, labels, garanties ou promesses.",
    "Tous les textes doivent être nets, lisibles et correctement orthographiés.",
    "Ne pas afficher d'interface de navigateur, ni de barre d'adresse, ni de mockup d'ordinateur.",
    "Livrer une seule image finale propre pour ce format.",
  ].join("\n");
}

function buildWhatsAppInstruction(brief: BriefData, hotspots: Hotspot[]): string {
  if (!needsVisualWhatsApp(brief)) {
    return "Ne pas inclure de boutons WhatsApp dans l'image. Prévoir plutôt une zone visuelle qui introduit un formulaire de contact réel.";
  }

  if (!hotspots.length) {
    return "Inclure des boutons WhatsApp visibles dans l'image, bien séparés verticalement.";
  }

  const positions = hotspots
    .map(
      (hotspot) =>
        `${hotspot.label} : environ ${Math.round(hotspot.left)}% depuis la gauche, ${Math.round(hotspot.top)}% depuis le haut, largeur environ ${Math.round(hotspot.width)}% de l'image`
    )
    .join(" ; ");

  return [
    `Inclure ${hotspots.length} bouton(s) WhatsApp visibles dans l'image, bien séparés verticalement.`,
    `Positions à respecter le plus possible : ${positions}.`,
    // Un aplat de couleur unie est indispensable : c'est ce que l'outil scanne
    // ensuite pour retrouver les boutons automatiquement dans l'image.
    "Chaque bouton doit être un rectangle à coins arrondis rempli d'un vert WhatsApp uni (#25D366), sans dégradé, sans transparence, sans ombre portée forte, avec un texte blanc centré.",
    "Ne pas dessiner de bordure d'une autre couleur autour des boutons.",
  ].join("\n");
}
