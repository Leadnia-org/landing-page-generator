import { languageMeta } from "./i18n";
import type { BriefData, Device, Hotspot } from "./types";
import { formatPrice } from "./utils/text";

/**
 * Le prompt ne depend PAS du type de landing page. L'image est toujours la
 * meme chose : un visuel avec des boutons d'action pleins, et jamais de
 * formulaire dessine. Le formulaire reel est ajoute en HTML sous l'image ;
 * en dessiner un dans l'image donnait deux formulaires dont un faux.
 */
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
    `Style visuel : ${brief.visualStyle}`,
    "",
    "Palette imposée, à respecter exactement :",
    `Fond de la page : ${brief.palette.background}`,
    `Texte courant : ${brief.palette.text}`,
    `Accent (titres, prix) : ${brief.palette.accent}`,
    `Boutons d'action : ${brief.palette.button}`,
    `Texte dans les boutons : ${brief.palette.buttonText}`,
    "N'utilise aucune autre couleur dominante que celles-ci, en dehors de la photo du produit.",
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
    buildButtonInstruction(brief, hotspots),
    "",
    "Ne dessine aucun formulaire : pas de champs de saisie, pas de cases à remplir, pas de bouton d'envoi de formulaire.",
    "Le formulaire réel sera ajouté en HTML sous l'image, donc un formulaire dessiné ferait doublon et ne serait pas utilisable.",
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

/**
 * Le relief et la detection tirent en sens inverse : l'outil retrouve un bouton
 * en propageant une couleur depuis un clic, donc la FACE doit rester d'un seul
 * ton reconnaissable. On autorise donc le volume par ce qui entoure la face
 * (ombre portee, arete claire) et on interdit ce qui la decoupe (degrade franc,
 * reflet brillant, texture).
 */
function buildButtonInstruction(brief: BriefData, hotspots: Hotspot[]): string {
  const look = [
    `Chaque bouton est un rectangle à coins bien arrondis, rempli de ${brief.palette.button}, avec le texte « ${brief.ctaText} » centré en ${brief.palette.buttonText}, en gras.`,
    "Les boutons doivent avoir l'air de vrais boutons cliquables, en relief, comme des touches physiques qui dépassent de la page :",
    `- une ombre portée nette sous le bouton, décalée vers le bas, sur le fond ${brief.palette.background} ;`,
    "- une fine arête plus claire sur le bord supérieur du bouton, comme une lumière venue d'en haut ;",
    "- un très léger dégradé vertical à l'intérieur, du haut à peine plus clair vers le bas à peine plus foncé.",
    // Sous ~70 en distance RGB, le remplissage par tolerance tient. Au-dela il casse.
    "Ce dégradé doit rester TRÈS discret : les deux tons restent presque identiques et clairement reconnaissables comme la même couleur.",
    "Interdits sur la face du bouton : reflet brillant ou glossy, bande lumineuse en diagonale, texture, motif, transparence, dégradé vers une autre teinte, bordure d'une couleur différente.",
    "La face du bouton doit rester une surface d'une seule couleur bien lisible : l'outil la scanne ensuite pour replacer les zones cliquables automatiquement.",
    `Aucun autre élément de l'image ne doit utiliser la couleur ${brief.palette.button} : elle est réservée aux boutons.`,
  ];

  if (!hotspots.length) {
    return [
      `Inclure des boutons d'action visibles portant le texte « ${brief.ctaText} », bien séparés verticalement.`,
      ...look,
    ].join("\n");
  }

  const positions = hotspots
    .map(
      (hotspot) =>
        `${hotspot.label} : environ ${Math.round(hotspot.left)}% depuis la gauche, ${Math.round(hotspot.top)}% depuis le haut, largeur environ ${Math.round(hotspot.width)}% de l'image`
    )
    .join(" ; ");

  return [
    `Inclure ${hotspots.length} bouton(s) d'action visibles, bien séparés verticalement, portant le texte « ${brief.ctaText} ».`,
    `Positions à respecter le plus possible : ${positions}.`,
    ...look,
  ].join("\n");
}
