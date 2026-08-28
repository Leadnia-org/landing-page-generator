import { buildLandingFiles, buildStandaloneHtml } from "./export/templates";
import type { BriefData, Device, Hotspot, ImageSize, UploadedImage } from "./types";
import { escapeHtml } from "./utils/text";
import { imageFileToWebpDataUrl } from "./utils/images";

/**
 * Construit la vraie page finale en memoire et l'affiche dans une fenetre
 * avec bascule mobile / tablette / desktop. C'est le seul moyen de verifier
 * que les boutons tombent juste avant de livrer le ZIP.
 */
export async function renderPreviewInto(
  target: Window,
  brief: BriefData,
  hotspots: Record<Device, Hotspot[]>,
  uploads: Partial<Record<Device, UploadedImage>>
): Promise<void> {
  const desktop = uploads.desktop;
  const mobile = uploads.mobile;

  if (!desktop || !mobile) {
    throw new Error("Importez les images desktop et mobile avant de prévisualiser.");
  }

  const sizes: Partial<Record<Device, ImageSize>> = {
    desktop: { width: desktop.width, height: desktop.height },
    mobile: { width: mobile.width, height: mobile.height },
  };

  const [desktopData, mobileData] = await Promise.all([
    imageFileToWebpDataUrl(desktop.file),
    imageFileToWebpDataUrl(mobile.file),
  ]);

  const files = buildLandingFiles(brief, hotspots, sizes);
  const html = buildStandaloneHtml(files, { desktop: desktopData, mobile: mobileData });
  const landingUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));

  target.document.open();
  target.document.write(buildPreviewShell(landingUrl, brief.productName));
  target.document.close();
}

function buildPreviewShell(landingUrl: string, productName: string): string {
  const title = `Aperçu — ${escapeHtml(productName || "landing page")}`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0;height:100vh;display:flex;flex-direction:column;background:#1d2a20;color:#f6ecd8;font-family:Arial,Helvetica,sans-serif;}
  header{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 18px;background:#122117;border-bottom:1px solid rgba(246,236,216,.16);}
  h1{margin:0;font-size:1rem;font-weight:900;letter-spacing:.02em;}
  .spacer{flex:1;}
  .group{display:flex;gap:6px;background:rgba(246,236,216,.08);border-radius:999px;padding:4px;}
  button{min-height:36px;padding:0 14px;border:0;border-radius:999px;background:transparent;color:inherit;font:inherit;font-weight:800;cursor:pointer;}
  button[aria-pressed="true"]{background:#25d366;color:#06280f;}
  a.plain{color:#ffc529;font-weight:800;text-decoration:none;font-size:.9rem;}
  .note{width:100%;margin:0;color:rgba(246,236,216,.7);font-size:.82rem;line-height:1.4;}
  .stage{flex:1;display:flex;justify-content:safe center;padding:18px;overflow:auto;}
  .frame{width:390px;flex:0 0 auto;height:100%;background:#fff;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.45);overflow:hidden;transition:width .18s ease;}
  iframe{width:100%;height:100%;border:0;display:block;}
</style>
</head>
<body>
<header>
  <h1>Aperçu de la landing page</h1>
  <div class="group" role="group" aria-label="Largeur">
    <button type="button" data-width="390" aria-pressed="true">Mobile 390</button>
    <button type="button" data-width="768" aria-pressed="false">Tablette 768</button>
    <button type="button" data-width="1280" aria-pressed="false">Desktop 1280</button>
    <button type="button" data-width="full" aria-pressed="false">Pleine largeur</button>
  </div>
  <span class="spacer"></span>
  <a class="plain" href="${landingUrl}" target="_blank" rel="noopener">Ouvrir la page seule</a>
  <p class="note">Les boutons WhatsApp sont actifs : un clic ouvre une vraie conversation. Le message contient la source et la référence visiteur.</p>
</header>
<div class="stage"><div class="frame" id="frame"><iframe id="page" src="${landingUrl}" title="${title}"></iframe></div></div>
<script>
  var frame = document.getElementById("frame");
  var buttons = [].slice.call(document.querySelectorAll("button[data-width]"));
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      buttons.forEach(function (other) { other.setAttribute("aria-pressed", String(other === button)); });
      var value = button.getAttribute("data-width");
      frame.style.width = value === "full" ? "100%" : value + "px";
    });
  });
</` + `script>
</body>
</html>`;
}
