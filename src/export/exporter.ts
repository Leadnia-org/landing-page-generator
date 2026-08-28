import type { Device, ExportOptions } from "../types";
import { buildLandingFiles, buildStandaloneHtml } from "./templates";
import { imageFileToWebpBytes } from "../utils/images";
import { slugify } from "../utils/text";
import { makeZip, textEntry } from "../utils/zip";
import { createChecklist } from "../validation";

export async function buildNetlifyZip(options: ExportOptions): Promise<{ blob: Blob; filename: string }> {
  const fauxUploads = {
    desktop: { file: options.images.desktop, url: "", width: 0, height: 0 },
    mobile: { file: options.images.mobile, url: "", width: 0, height: 0 },
  };
  const failingItems = createChecklist(options.brief, fauxUploads, options.hotspots).filter(
    (item) => item.blocking && !item.passed
  );

  if (failingItems.length) {
    throw new Error(`Impossible d'exporter : ${failingItems.map((item) => item.label).join(", ")}.`);
  }

  const landingFiles = buildLandingFiles(options.brief, options.hotspots, options.sizes || {});
  const imageBytes: Record<Device, Uint8Array> = {
    desktop: await imageFileToWebpBytes(options.images.desktop),
    mobile: await imageFileToWebpBytes(options.images.mobile),
  };

  // Les images restent des fichiers separes meme en mode "un seul fichier" :
  // en data URI elles pesent 33% de plus et bloquent l'affichage progressif.
  const documents = options.singleFile
    ? [textEntry("index.html", buildStandaloneHtml(landingFiles))]
    : [
        textEntry("index.html", landingFiles.indexHtml),
        textEntry("style.css", landingFiles.styleCss),
        textEntry("script.js", landingFiles.scriptJs),
      ];

  const blob = makeZip([
    ...documents,
    {
      name: "assets/landing-desktop.webp",
      data: imageBytes.desktop,
    },
    {
      name: "assets/landing-mobile.webp",
      data: imageBytes.mobile,
    },
  ]);

  return {
    blob,
    filename: `${slugify(options.brief.productName)}.zip`,
  };
}
