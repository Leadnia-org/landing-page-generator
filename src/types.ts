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
}

export interface Hotspot {
  id: string;
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
