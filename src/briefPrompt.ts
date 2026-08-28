import { languageMeta } from "./i18n";
import type { Benefit, BriefData, BriefSeed, FaqItem, LandingLanguage, Palette } from "./types";

/**
 * Remplir dix-huit champs a la main est le point le plus penible de l'outil.
 * On genere donc un prompt qui fait rediger le brief entier par ChatGPT, sous
 * forme de JSON, que l'outil reinjecte dans le formulaire.
 *
 * Le vendeur ne saisit que ce qu'il connait par coeur (produit, prix, ville,
 * cible). Tout ce qui est deja connu est injecte comme FAIT : on ne redemande
 * pas a ChatGPT d'inventer un prix que le vendeur vient de taper.
 */

/** Assez de matiere pour que ChatGPT produise autre chose que du remplissage. */
export function seedIsUsable(seed: BriefSeed): boolean {
  return seed.product.trim().length >= 3;
}

/**
 * Sans exemple dans la bonne graphie, ChatGPT glisse vers l'arabe classique
 * des qu'on lui demande de la darija.
 */
const languageHints: Record<LandingLanguage, string> = {
  fr: "Français courant du Maroc, tutoiement évité, phrases courtes.",
  "darija-ar":
    "Darija marocaine écrite en alphabet arabe, PAS d'arabe classique (fosha). Écris comme on parle à Casablanca. Exemple de ton : « سلام، بغيت نشري هاد المنتوج ».",
  "darija-lat":
    "Darija marocaine écrite en lettres latines (arabizi), les chiffres 3, 7 et 9 sont acceptés. PAS de français, PAS d'arabe classique. Exemple de ton : « Salam, bghit nechri had lproduit ».",
  ar: "Arabe standard moderne, lecture de droite à gauche.",
  en: "English, plain and direct, no marketing jargon.",
};

const modeHints: Record<BriefData["landingMode"], string> = {
  whatsapp: "La page ne contient aucun formulaire : tout passe par un bouton WhatsApp.",
  leads: "La page contient un vrai formulaire de contact : c'est lui qui reçoit les demandes.",
  hybrid: "La page contient un bouton WhatsApp ET un formulaire de contact.",
};

/** Exemple de FORME. Volontairement un autre produit, pour ne pas etre recopie. */
const shape = [
  "{",
  '  "productName": "Sac à dos scolaire renforcé",',
  '  "targetAudience": "Parents d\'élèves du primaire",',
  '  "heroTitle": "Un sac à dos qui tient toute l\'année",',
  '  "subtitle": "Un sac à dos scolaire renforcé, disponible à Rabat, commandé en deux minutes.",',
  '  "ctaText": "Commander maintenant",',
  '  "baseMessage": "Bonjour, je souhaite commander le sac à dos scolaire à 249 Dhs.",',
  '  "benefits": [',
  '    { "title": "Coutures renforcées", "text": "Les bretelles et le fond sont doublés." },',
  '    { "title": "Prix clair : 249 Dhs", "text": "Le prix affiché est le prix payé." },',
  '    { "title": "Livraison à Rabat", "text": "La commande se confirme directement par message." }',
  "  ],",
  '  "faqs": [',
  '    { "question": "Quelles tailles existent ?", "answer": "Le modèle est proposé en taille unique." },',
  '    { "question": "Quel est le prix ?", "answer": "Le sac à dos coûte 249 Dhs." },',
  '    { "question": "Comment commander ?", "answer": "Envoyez votre demande, on vous répond pour confirmer." }',
  "  ],",
  '  "formFields": ["Nom", "Téléphone / WhatsApp", "Ville", "Quantité"],',
  '  "forbiddenClaims": ["indestructible", "meilleur du maroc", "garanti à vie"],',
  '  "visualStyle": "Photographie produit réaliste, cartes arrondies, style simple et premium.",',
  '  "palette": {',
  '    "background": "#F3F6FA",',
  '    "text": "#12202E",',
  '    "accent": "#1B4F8A",',
  '    "button": "#F26B21",',
  '    "buttonText": "#FFFFFF"',
  "  }",
  "}",
].join("\n");

export function buildBriefPrompt(seed: BriefSeed, brief: BriefData): string {
  const language = languageMeta(brief.language);
  const withForm = brief.landingMode !== "whatsapp";
  const lines: string[] = [];

  lines.push("Tu prépares le contenu d'une landing page de vente au Maroc.");
  lines.push("");
  lines.push("CE QUE JE VENDS (ce sont des faits, ne les contredis pas) :");
  lines.push(`- Produit : ${seed.product.trim() || "(non précisé)"}`);

  if (seed.price.trim()) {
    lines.push(`- Prix : ${seed.price.trim()} ${seed.currency.trim() || "Dhs"}`);
  }
  if (seed.city.trim()) {
    lines.push(`- Ville ou zone de vente : ${seed.city.trim()}`);
  }
  if (seed.audience.trim()) {
    lines.push(`- À qui ça s'adresse : ${seed.audience.trim()}`);
  }
  if (seed.avoid.trim()) {
    lines.push(`- À ne surtout pas dire : ${seed.avoid.trim()}`);
  }
  if (seed.colors.trim()) {
    lines.push(`- Couleurs ou ambiance souhaitées : ${seed.colors.trim()}`);
  }
  if (seed.extra.trim()) {
    lines.push("- Autres précisions :");
    lines.push(seed.extra.trim());
  }

  lines.push("");
  lines.push(`LANGUE : ${languageHints[brief.language]}`);
  lines.push(`Toutes les valeurs textuelles doivent être écrites en ${language.label.toLowerCase()}.`);
  lines.push("");
  lines.push(`TYPE DE PAGE : ${modeHints[brief.landingMode]}`);
  lines.push("");
  lines.push("FORMAT DE RÉPONSE");
  lines.push("Réponds avec un seul bloc de code ```json contenant l'objet, et rien d'autre autour.");
  lines.push("Voici un exemple de la FORME attendue, pour un autre produit :");
  lines.push("");
  lines.push(withForm ? shape : shape.replace(/^ {2}"formFields".*\n/m, ""));
  lines.push("");
  lines.push("RÈGLES IMPÉRATIVES");
  lines.push(
    "N'invente aucune promesse absente de mes informations : ni garantie, ni délai de livraison, ni allégation de santé, ni chiffre, ni label, ni avis client."
  );
  lines.push("Si une information manque, reste factuel et reformule ce que je t'ai donné au lieu de combler le vide.");
  lines.push('"heroTitle" fait 8 mots maximum. "ctaText" fait 3 mots maximum.');
  lines.push('"benefits" et "faqs" contiennent exactement trois entrées chacun.');
  lines.push('"baseMessage" est écrit à la première personne, mentionne le produit et le prix, et reste court.');
  lines.push(
    '"forbiddenClaims" liste en minuscules les mots que l\'image ne devra jamais afficher : allégations de santé, superlatifs invérifiables, promesses réglementées.'
  );

  if (!withForm) {
    lines.push('Ne renvoie pas la clé "formFields" : cette page n\'a pas de formulaire.');
  }

  lines.push("Ne mets ni numéro de téléphone, ni lien, ni emoji dans les valeurs.");
  lines.push("");
  lines.push("COULEURS");
  lines.push(
    "Choisis la palette d'après CE produit et SON public : un cosmétique, une pièce auto et un jouet n'ont pas la même ambiance. N'applique aucune charte par défaut."
  );

  if (seed.colors.trim()) {
    lines.push("Respecte les couleurs demandées ci-dessus, et complète ce qui manque.");
  }

  lines.push("Les cinq valeurs sont des couleurs hexadécimales à 6 chiffres, en majuscules, précédées de #.");
  lines.push('"text" doit être parfaitement lisible sur "background" : vise un contraste fort, pas deux tons proches.');
  lines.push(
    '"button" est la couleur pleine du bouton d\'action. Elle doit être vive, saturée, et ne ressembler à aucune autre couleur de la page : c\'est à cette couleur que le bouton sera reconnu automatiquement dans l\'image.'
  );
  lines.push(
    '"button" doit trancher nettement sur "background" et sur "accent" : si les trois se ressemblent, le bouton devient introuvable.'
  );
  lines.push('"buttonText" est le texte dans le bouton, en général #FFFFFF sur un bouton foncé.');
  lines.push('"visualStyle" décrit la matière et la photo, PAS les couleurs : les couleurs vivent dans "palette".');

  return lines.join("\n");
}

interface RawBrief {
  productName?: unknown;
  targetAudience?: unknown;
  price?: unknown;
  currency?: unknown;
  heroTitle?: unknown;
  subtitle?: unknown;
  ctaText?: unknown;
  baseMessage?: unknown;
  benefits?: unknown;
  faqs?: unknown;
  formFields?: unknown;
  forbiddenClaims?: unknown;
  visualStyle?: unknown;
  palette?: unknown;
}

export interface ParsedBrief {
  brief: BriefData;
  /** Champs reellement ecrits par ChatGPT : sert a dire au vendeur ce qui a bouge. */
  filled: string[];
}

/**
 * ChatGPT ajoute souvent une phrase ou un bloc de code autour du JSON :
 * on isole le premier objet complet plutot que d'exiger une reponse parfaite.
 */
export function parseBriefResponse(text: string, current: BriefData, seed?: BriefSeed): ParsedBrief {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("Aucun objet JSON trouvé dans la réponse collée.");
  }

  const raw = parseRelaxed(text.slice(start, end + 1));

  if (!raw) {
    throw new Error("Le JSON collé est invalide : recopiez la réponse complète de ChatGPT.");
  }

  const filled: string[] = [];
  const take = (key: string, value: unknown, fallback: string): string => {
    const next = str(value, fallback);
    if (next !== fallback) filled.push(key);
    return next;
  };

  const merged: BriefData = {
    ...current,
    productName: take("nom du produit", raw.productName, current.productName),
    targetAudience: take("cible", raw.targetAudience, current.targetAudience),
    price: take("prix", seed?.price.trim() || raw.price, current.price),
    currency: take("devise", seed?.currency.trim() || raw.currency, current.currency),
    heroTitle: take("titre héro", raw.heroTitle, current.heroTitle),
    subtitle: take("sous-titre", raw.subtitle, current.subtitle),
    ctaText: take("texte du bouton", raw.ctaText, current.ctaText),
    baseMessage: take("message WhatsApp", raw.baseMessage, current.baseMessage),
    benefits: benefitList(raw.benefits, current.benefits),
    faqs: faqList(raw.faqs, current.faqs),
    formFields: strings(raw.formFields, current.formFields),
    forbiddenClaims: strings(raw.forbiddenClaims, current.forbiddenClaims),
    visualStyle: take("direction visuelle", raw.visualStyle, current.visualStyle),
    palette: paletteFrom(raw.palette, current.palette),
  };

  if (isRecord(raw.palette)) filled.push("couleurs");

  if (objects(raw.benefits).length) filled.push("bénéfices");
  if (objects(raw.faqs).length) filled.push("FAQ");

  if (!merged.productName.trim()) {
    throw new Error("La réponse ne contient pas de nom de produit exploitable.");
  }

  return { brief: merged, filled };
}

/**
 * ChatGPT rend parfois une virgule finale ou des guillemets courbes en guise de
 * delimiteurs : JSON.parse refuse les deux alors que l'intention est lisible.
 *
 * Les reparations vont de la plus sure a la plus agressive, et on s'arrete a la
 * premiere qui passe. On ne touche jamais aux chevrons francais : « » n'est
 * jamais un delimiteur JSON, seulement du contenu legitime.
 */
function parseRelaxed(body: string): RawBrief | null {
  const repairs: Array<(source: string) => string> = [
    (source) => source,
    (source) => source.replace(/,(\s*[}\]])/g, "$1"),
    (source) => source.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/,(\s*[}\]])/g, "$1"),
  ];

  for (const repair of repairs) {
    try {
      return JSON.parse(repair(body)) as RawBrief;
    } catch {
      /* on tente la reparation suivante */
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Une couleur invalide ne casse pas seulement l'affichage : c'est la cible que
 * la detection de boutons va chercher dans l'image. On refuse tout ce qui n'est
 * pas un hexadecimal franc, et on garde l'ancienne valeur.
 */
function paletteFrom(value: unknown, fallback: Palette): Palette {
  if (!isRecord(value)) return { ...fallback };

  return {
    background: hex(value.background, fallback.background),
    text: hex(value.text, fallback.text),
    accent: hex(value.accent, fallback.accent),
    button: hex(value.button, fallback.button),
    buttonText: hex(value.buttonText, fallback.buttonText),
  };
}

export function hex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  const short = /^#?([0-9a-fA-F]{3})$/.exec(trimmed);
  if (short) {
    // #abc est legitime mais <input type="color"> exige la forme longue.
    return `#${short[1]
      .split("")
      .map((char) => char + char)
      .join("")}`.toUpperCase();
  }

  const long = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  return long ? `#${long[1].toUpperCase()}` : fallback;
}

function str(value: unknown, fallback: string): string {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function strings(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const list = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return list.length ? list.map((item) => item.trim()) : fallback;
}

function objects(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

/** Le formulaire expose exactement trois blocs : on complete ou on tronque. */
function toThree<T>(list: T[], fallback: T[], empty: () => T): T[] {
  if (!list.length) return fallback;
  const result = list.slice(0, 3);
  while (result.length < 3) result.push(empty());
  return result;
}

function benefitList(value: unknown, fallback: Benefit[]): Benefit[] {
  const list = objects(value)
    .map((item) => ({ title: str(item.title, ""), text: str(item.text, "") }))
    .filter((item) => item.title || item.text);
  return toThree(list, fallback, () => ({ title: "", text: "" }));
}

function faqList(value: unknown, fallback: FaqItem[]): FaqItem[] {
  const list = objects(value)
    .map((item) => ({ question: str(item.question, ""), answer: str(item.answer, "") }))
    .filter((item) => item.question || item.answer);
  return toThree(list, fallback, () => ({ question: "", answer: "" }));
}
