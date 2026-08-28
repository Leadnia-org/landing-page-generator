export type LandingMode = "whatsapp" | "leads" | "hybrid";

export type Device = "desktop" | "mobile";

export type LandingLanguage = "fr" | "darija-ar" | "darija-lat" | "ar" | "en";

export interface Benefit {
  title: string;
  text: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface Palette {
  /** Fond principal de la page. */
  background: string;
  /** Couleur du texte courant. */
  text: string;
  /** Accent : titres, prix, details. */
  accent: string;
  /** Aplat des boutons d'action. C'est aussi ce que la detection va chercher. */
  button: string;
  /** Texte a l'interieur des boutons. */
  buttonText: string;
}

export interface BriefData {
  productName: string;
  targetAudience: string;
  price: string;
  currency: string;
  language: LandingLanguage;
  landingMode: LandingMode;
  whatsappNumber: string;
  ctaText: string;
  baseMessage: string;
  heroTitle: string;
  subtitle: string;
  benefits: Benefit[];
  faqs: FaqItem[];
  formFields: string[];
  forbiddenClaims: string[];
  visualStyle: string;
  palette: Palette;
}

export type HotspotAction = "whatsapp" | "form";

export interface Hotspot {
  id: string;
  /** WhatsApp, ou defilement vers le vrai formulaire HTML. */
  action: HotspotAction;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  device: Device;
  /** Message WhatsApp propre à ce bouton. Vide = message de base du brief. */
  message: string;
}

export interface UploadedImage {
  file: File;
  url: string;
  width: number;
  height: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export interface ExportOptions {
  brief: BriefData;
  images: Record<Device, File>;
  hotspots: Record<Device, Hotspot[]>;
  sizes?: Partial<Record<Device, ImageSize>>;
  /** Une seule page HTML avec CSS et JS integres, au lieu de trois fichiers. */
  singleFile?: boolean;
}

export interface LandingProject {
  id: string;
  name: string;
  updatedAt: number;
  brief: BriefData;
  hotspots: Record<Device, Hotspot[]>;
}

export interface LandingFiles {
  indexHtml: string;
  styleCss: string;
  scriptJs: string;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface ScanImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface DetectedRegion {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Part de pixels réellement colorés dans la boîte : 1 = rectangle plein. */
  fill: number;
}

/**
 * Ce que le vendeur sait deja sans reflechir : la matiere premiere du prompt.
 * Le prix et la devise sont injectes comme faits, pas demandes a ChatGPT.
 */
export interface BriefSeed {
  product: string;
  price: string;
  currency: string;
  city: string;
  audience: string;
  avoid: string;
  colors: string;
  extra: string;
}
