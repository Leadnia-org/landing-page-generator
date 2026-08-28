import "./styles.css";
import { applyGeneratedTexts, missingEssentials } from "./autofill";
import { buildBriefPrompt, hex, parseBriefResponse, seedIsUsable } from "./briefPrompt";
import { defaultHotspots, emptySeed, landingModeLabels } from "./defaults";
import { buildNetlifyZip } from "./export/exporter";
import { languageMeta, languageOrder, languages } from "./i18n";
import { buildImagePrompt } from "./prompts";
import { cloneHotspots, loadBrief, loadHotspots, loadSeed, resetSavedBrief, saveBrief, saveHotspots, saveSeed } from "./storage";
import type {
  BriefData,
  BriefSeed,
  DetectedRegion,
  Device,
  ImageSize,
  Hotspot,
  LandingLanguage,
  LandingMode,
  ScanImage,
  UploadedImage,
} from "./types";
import { WHATSAPP_GREENS, detectButtons, fileToScan, fitRegionAtPoint } from "./utils/detect";
import { hexToRgb } from "./utils/color";
import { readImageSize } from "./utils/images";
import { renderPreviewInto as renderLandingPreview } from "./preview";
import {
  createProject,
  deleteProject,
  duplicateProject,
  findProject,
  listProjects,
  projectFromJson,
  projectToJson,
  upsertProject,
} from "./projects";
import { escapeAttr, escapeHtml, linesToText, slugify, textToLines } from "./utils/text";
import { formatNumberForDisplay, normalizeWhatsAppNumber, whatsappLink } from "./utils/whatsapp";
import {
  createChecklist,
  defaultHotspotAction,
  findForbiddenTerms,
  hotspotIsTiny,
  needsLeadForm,
} from "./validation";

const appRootOrNull = document.querySelector<HTMLDivElement>("#app");

if (!appRootOrNull) {
  throw new Error("Element #app introuvable.");
}

const appRoot: HTMLDivElement = appRootOrNull;

interface DragState {
  device: Device;
  hotspotId: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
  surfaceWidth: number;
  surfaceHeight: number;
  moved: boolean;
  snapshot: string;
}

let brief = loadBrief();
let seed = loadSeed();

const seedFieldIds: Array<[string, keyof BriefSeed]> = [
  ["seedProduct", "product"],
  ["seedPrice", "price"],
  ["seedCurrency", "currency"],
  ["seedCity", "city"],
  ["seedAudience", "audience"],
  ["seedAvoid", "avoid"],
  ["seedColors", "colors"],
  ["seedExtra", "extra"],
];

let selectedDevice: Device = "desktop";
let selectedHotspotId = "";
let productImageName = "";
let quickMode = false;
/** Survit a rerenderBriefForm, qui remplace le formulaire d'un bloc. */
let generatedOpen = false;
/** Les coordonnees chiffrees sont un recours : le placement se fait sur l'image. */
let manualCoords = false;
let fitMode = false;
let tolerance = 70;
let dragState: DragState | null = null;
let currentProjectId = "";
let workspaceOpen = false;
let zoom = 1;
const hotspotHistory: string[] = [];

const uploads: Partial<Record<Device, UploadedImage>> = {};
const scans: Partial<Record<Device, ScanImage>> = {};
const candidates: Partial<Record<Device, DetectedRegion[]>> = {};
const hotspots: Record<Device, Hotspot[]> = loadHotspots();

renderApp();
bindEvents();
refreshAll();

function renderApp(): void {
  appRoot.innerHTML = `
    <header class="app-header">
      <div class="header-copy">
        <p class="eyebrow">Mini SaaS V1</p>
        <h1>Générateur de landing pages image-first</h1>
        <p>Brief produit, prompt ChatGPT Images, upload des visuels, export ZIP Netlify.</p>
      </div>
      <nav class="step-rail" aria-label="Étapes">
        <a href="#brief-panel">1. Brief</a>
        <a href="#prompt-panel">2. Prompt</a>
        <a href="#export-panel">3. Export</a>
      </nav>
    </header>

    <main class="app-main">
      <section id="brief-panel" class="panel brief-panel" aria-labelledby="brief-title">
        <div class="section-heading">
          <p class="eyebrow">Étape 1</p>
          <h2 id="brief-title">Informations du produit</h2>
        </div>
        <div class="project-bar">
          <label for="projectSelect">
            Projet
            <select id="projectSelect"></select>
          </label>
          <label for="projectName">
            Nom
            <input id="projectName" type="text" placeholder="Client, produit, campagne...">
          </label>
          <div class="project-actions">
            <button id="projectSave" class="mini-button" type="button">Enregistrer</button>
            <button id="projectNew" class="mini-button" type="button">Nouveau</button>
            <button id="projectDuplicate" class="mini-button" type="button">Dupliquer</button>
            <button id="projectExport" class="mini-button" type="button">Exporter JSON</button>
            <label class="mini-button file-button">
              Importer JSON
              <input id="projectImport" type="file" accept="application/json,.json">
            </label>
            <button id="projectDelete" class="mini-button danger" type="button">Supprimer</button>
          </div>
        </div>
        <div id="projectStatus" class="status" aria-live="polite"></div>
        ${renderAssistBlock()}
        <form id="briefForm" class="brief-form">
          ${renderBriefFields(brief)}
        </form>
        <div id="autofillStatus" class="status" aria-live="polite"></div>
      </section>

      <section id="prompt-panel" class="panel prompt-panel" aria-labelledby="prompt-title">
        <div class="section-heading">
          <p class="eyebrow">Étape 2</p>
          <h2 id="prompt-title">Prompts ChatGPT Images</h2>
        </div>
        <p class="panel-note" id="promptNote"></p>
        <div class="prompt-actions" role="group" aria-label="Actions prompt">
          <button class="ghost-button" type="button" data-copy-target="desktopPrompt">Copier desktop</button>
          <button class="ghost-button" type="button" data-copy-target="mobilePrompt">Copier mobile</button>
        </div>
        <label class="prompt-box" for="desktopPrompt">
          Prompt desktop
          <textarea id="desktopPrompt" readonly rows="13"></textarea>
        </label>
        <label class="prompt-box" for="mobilePrompt">
          Prompt mobile
          <textarea id="mobilePrompt" readonly rows="13"></textarea>
        </label>
        <div id="copyStatus" class="status" aria-live="polite"></div>
      </section>

      ${renderExportPanel()}
    </main>
    ${renderWorkspace()}
  `;
}

/**
 * Le chemin principal de l'etape 1 : le vendeur donne ce qu'il connait par
 * coeur, ChatGPT ecrit les dix-huit champs. Le formulaire dessous sert a
 * verifier, plus a saisir.
 */
function renderAssistBlock(): string {
  return `
        <section class="assist-block" aria-labelledby="assist-title">
          <div class="assist-head">
            <h3 id="assist-title">Laissez ChatGPT écrire le brief</h3>
            <p>Donnez ce que vous savez déjà sur le produit. L'outil fabrique le prompt, ChatGPT renvoie le texte, et le formulaire ci-dessous se remplit tout seul.</p>
          </div>
          <div class="seed-grid">
            ${seedField("seedProduct", "Produit", seed.product, "Amlou pour enfant, pot de 250 g", true)}
            ${seedField("seedPrice", "Prix", seed.price, "149", false)}
            ${seedField("seedCurrency", "Devise", seed.currency, "Dhs", false)}
            ${seedField("seedCity", "Ville ou zone", seed.city, "Casablanca", false)}
            ${seedField("seedAudience", "À qui ça s'adresse", seed.audience, "Parents d'enfants en bas âge", false)}
            ${seedField("seedAvoid", "À ne pas dire", seed.avoid, "bio, garanti, médical", false)}
            ${seedField("seedColors", "Couleurs souhaitées", seed.colors, "laisser ChatGPT décider", false)}
          </div>
          <label for="seedExtra">
            Autre chose à savoir (facultatif)
            <textarea id="seedExtra" rows="2" placeholder="Promotion, format, délai, ce qui rend l'offre différente...">${escapeHtml(seed.extra)}</textarea>
          </label>
          <div class="assist-actions">
            <button id="copyBriefPrompt" class="primary-button compact-button" type="button">Copier le prompt et ouvrir ChatGPT</button>
            <button id="togglePrompt" class="ghost-button compact-button" type="button" aria-expanded="false" aria-controls="briefPromptPreview">Voir le prompt</button>
          </div>
          <textarea id="briefPromptPreview" class="prompt-preview" rows="16" readonly hidden aria-label="Prompt envoyé à ChatGPT"></textarea>
          <label for="briefResponse">
            Collez ici la réponse de ChatGPT
            <textarea id="briefResponse" rows="3" placeholder="Collez le bloc renvoyé par ChatGPT : le brief se remplit tout seul."></textarea>
          </label>
          <div class="assist-actions">
            <button id="applyBriefResponse" class="ghost-button compact-button" type="button">Remplir le brief</button>
          </div>
          <div id="assistStatus" class="status" aria-live="polite"></div>
        </section>
  `;
}

/** Pastille + hexadecimal : on choisit a l'oeil, on corrige au code exact. */
function swatch(name: string, label: string, value: string): string {
  return `
    <label class="swatch">
      ${escapeHtml(label)}
      <span class="swatch-row">
        <input type="color" name="${escapeAttr(name)}" value="${escapeAttr(value)}" aria-label="${escapeAttr(label)}">
        <output>${escapeHtml(value.toUpperCase())}</output>
      </span>
    </label>
  `;
}

function seedField(id: string, label: string, value: string, placeholder: string, wide: boolean): string {
  return `
    <label for="${id}"${wide ? ' class="seed-wide"' : ""}>
      ${escapeHtml(label)}
      <input id="${id}" type="text" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}">
    </label>
  `;
}

function renderExportPanel(): string {
  return `
      <section id="export-panel" class="panel export-panel" aria-labelledby="export-title">
        <div class="section-heading export-heading">
          <div>
            <p class="eyebrow">Étape 3</p>
            <h2 id="export-title">Importer et exporter</h2>
          </div>
          <button id="resetBrief" class="ghost-button compact-button" type="button">Réinitialiser</button>
        </div>

        <div class="upload-grid">
          ${renderUploadCard("desktop", "Image desktop générée")}
          ${renderUploadCard("mobile", "Image mobile générée")}
        </div>

        <div class="guard-grid">
          <section class="guard-panel" aria-labelledby="checklist-title">
            <h3 id="checklist-title">Checklist avant export</h3>
            <ul id="checklist" class="checklist"></ul>
          </section>
          <section class="guard-panel" aria-labelledby="warnings-title">
            <h3 id="warnings-title">Garde-fous</h3>
            <div id="warnings" class="warning-list"></div>
          </section>
        </div>

        <div class="hotspot-toolbar">
          <div>
            <h3>Boutons WhatsApp</h3>
            <p>Activez « Viser un bouton » puis cliquez chaque bouton de l'image : la zone se cale dessus, quelle que soit sa couleur.</p>
          </div>
          <div class="hotspot-controls">
            <label for="hotspotDevice">
              Image
              <select id="hotspotDevice">
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
              </select>
            </label>
            <label for="tolerance">
              Tolérance couleur
              <input id="tolerance" type="range" min="25" max="130" step="5" value="${tolerance}">
            </label>
          </div>
        </div>
        <div class="hotspot-actions">
          <button id="detectHotspots" class="ghost-button compact-button" type="button">Proposer les boutons</button>
          <button id="fitToggle" class="ghost-button compact-button" type="button" data-fit-toggle aria-pressed="false">Viser un bouton</button>
          <button id="addHotspot" class="ghost-button compact-button" type="button">Ajouter une zone</button>
          <button id="openWorkspace" class="ghost-button compact-button" type="button">Atelier de placement</button>
          <button id="undoHotspots" class="ghost-button compact-button" type="button" disabled>Annuler</button>
          <button id="copyMessages" class="ghost-button compact-button" type="button">Reprendre les messages de l'autre image</button>
          <label class="switch compact-switch">
            <input id="manualCoords" type="checkbox">
            <span>Régler les coordonnées à la main</span>
          </label>
        </div>
        <div id="hotspotStatus" class="status" aria-live="polite"></div>
        <div id="candidateList" class="candidate-list" data-candidate-list hidden></div>
        <div id="hotspotEditor" class="hotspot-editor" data-hotspot-editor></div>

        <div class="export-actions">
          <button id="previewLanding" class="primary-button" type="button">Prévisualiser la landing</button>
          <button id="downloadZip" class="primary-button ghost-primary" type="button">Télécharger le ZIP Netlify</button>
          <label class="switch compact-switch">
            <input id="singleFile" type="checkbox">
            <span>Export en un seul fichier HTML</span>
          </label>
        </div>
        <div id="exportStatus" class="status" aria-live="polite"></div>
      </section>
  `;
}

/**
 * Deux blocs, selon une seule question : ChatGPT peut-il deviner ce champ ?
 * Non (langue, type de page, numero, image produit) : toujours visible.
 * Oui : replie, et on ne l'ouvre que pour verifier ou corriger.
 */
function renderBriefFields(data: BriefData): string {
  return `
    <div class="form-row three-cols">
      <label>
        Langue de la landing
        <select name="language" id="language">
          ${languageOrder.map((id) => renderLanguageOption(id, data.language)).join("")}
        </select>
      </label>
      <label>
        Type de landing page
        <select name="landingMode" id="landingMode">
          ${renderModeOption("whatsapp", data.landingMode)}
          ${renderModeOption("leads", data.landingMode)}
          ${renderModeOption("hybrid", data.landingMode)}
        </select>
      </label>
      ${field("whatsappNumber", "Numéro WhatsApp", data.whatsappNumber, "text", true)}
    </div>
    <div class="wa-preview" id="waPreview">
      <div>
        <span class="wa-preview-label">Lien généré</span>
        <code id="waPreviewLink">—</code>
      </div>
      <a id="waTestLink" class="ghost-button compact-button" href="#" target="_blank" rel="noopener">Tester le lien</a>
    </div>
    <label>
      Image produit à joindre dans ChatGPT Images
      <input id="productImage" name="productImage" type="file" accept="image/*">
      <span id="productImageHint" class="field-hint">Le prompt rappellera de joindre cette image dans ChatGPT Images.</span>
    </label>

    <details class="generated-block" id="generatedBlock"${generatedOpen ? " open" : ""}>
      <summary>
        <span class="generated-title">Textes écrits par ChatGPT</span>
        <span class="generated-hint">ouvrir pour vérifier ou corriger</span>
      </summary>
      <div class="brief-toolbar">
        <label class="switch">
          <input id="quickMode" type="checkbox"${quickMode ? " checked" : ""}>
          <span>Mode rapide (peu d'infos)</span>
        </label>
        <button id="autofillEmpty" class="ghost-button compact-button" type="button">Compléter les textes manquants</button>
        <button id="autofillAll" class="ghost-button compact-button" type="button">Tout réécrire dans la langue</button>
      </div>
      <div class="form-row three-cols">
        ${field("productName", "Nom du produit", data.productName, "text", true)}
        ${field("price", "Prix", data.price, "text", true)}
        ${field("currency", "Devise", data.currency, "text", true)}
      </div>
      <div class="form-row two-cols">
        ${field("targetAudience", "Cible", data.targetAudience, "text", false)}
        ${field("ctaText", "Texte du bouton principal", data.ctaText, "text", true)}
      </div>
      ${textarea("baseMessage", "Message WhatsApp par défaut", data.baseMessage, 2, true)}
      <div class="advanced-block"${quickMode ? " hidden" : ""}>
        <div class="form-row two-cols">
          ${field("heroTitle", "Titre héro", data.heroTitle, "text", false)}
          ${textarea("subtitle", "Sous-titre", data.subtitle, 3, false)}
        </div>
        <fieldset>
          <legend>Bénéfices</legend>
          <div class="repeat-grid">
            ${data.benefits.map((benefit, index) => renderBenefit(index, benefit.title, benefit.text)).join("")}
          </div>
        </fieldset>
        <fieldset>
          <legend>FAQ</legend>
          <div class="repeat-grid">
            ${data.faqs.map((faq, index) => renderFaq(index, faq.question, faq.answer)).join("")}
          </div>
        </fieldset>
        <div class="form-row two-cols">
          ${textarea("formFields", "Champs du formulaire réel", linesToText(data.formFields), 4, false)}
          ${textarea("forbiddenClaims", "Mots ou promesses interdits", linesToText(data.forbiddenClaims), 4, false)}
        </div>
        ${textarea("visualStyle", "Direction visuelle", data.visualStyle, 4, false)}
        <fieldset class="palette-fieldset">
          <legend>Couleurs de la landing</legend>
          <p class="field-hint">ChatGPT les choisit selon le produit. Elles pilotent l'image, la page exportée et la détection des boutons.</p>
          <div class="palette-grid">
            ${swatch("palette.background", "Fond", data.palette.background)}
            ${swatch("palette.text", "Texte", data.palette.text)}
            ${swatch("palette.accent", "Accent", data.palette.accent)}
            ${swatch("palette.button", "Bouton", data.palette.button)}
            ${swatch("palette.buttonText", "Texte du bouton", data.palette.buttonText)}
          </div>
        </fieldset>
      </div>
    </details>
  `;
}

function renderBenefit(index: number, title: string, text: string): string {
  return `
    <div class="repeat-item">
      ${field(`benefits.${index}.title`, `Bénéfice ${index + 1}`, title, "text", false)}
      ${textarea(`benefits.${index}.text`, "Texte", text, 2, false)}
    </div>
  `;
}

function renderFaq(index: number, question: string, answer: string): string {
  return `
    <div class="repeat-item">
      ${field(`faqs.${index}.question`, `Question ${index + 1}`, question, "text", false)}
      ${textarea(`faqs.${index}.answer`, "Réponse", answer, 2, false)}
    </div>
  `;
}

function field(name: string, label: string, value: string, type: string, required: boolean): string {
  return `
    <label>
      ${escapeHtml(label)}
      <input name="${escapeAttr(name)}" type="${escapeAttr(type)}" value="${escapeAttr(value)}"${required ? " required" : ""}>
    </label>
  `;
}

function textarea(name: string, label: string, value: string, rows: number, required: boolean): string {
  return `
    <label>
      ${escapeHtml(label)}
      <textarea name="${escapeAttr(name)}" rows="${rows}"${required ? " required" : ""}>${escapeHtml(value)}</textarea>
    </label>
  `;
}

function renderModeOption(mode: LandingMode, current: LandingMode): string {
  return `<option value="${mode}"${mode === current ? " selected" : ""}>${landingModeLabels[mode]}</option>`;
}

function renderLanguageOption(id: LandingLanguage, current: LandingLanguage): string {
  return `<option value="${id}"${id === current ? " selected" : ""}>${escapeHtml(languages[id].label)}</option>`;
}

function renderUploadCard(device: Device, label: string): string {
  return `
    <div class="upload-card">
      <label for="${device}Mockup">${label}</label>
      <input id="${device}Mockup" data-upload-device="${device}" type="file" accept="image/*">
      <div class="preview-frame" data-preview="${device}">
        <p>Prévisualisation ${device}</p>
      </div>
    </div>
  `;
}

function bindEvents(): void {
  getBriefForm().addEventListener("input", handleBriefInput);
  getBriefForm().addEventListener("change", handleBriefInput);
  getBriefForm().addEventListener("submit", (event) => event.preventDefault());
  bindFormControls();
  query<HTMLButtonElement>("#resetBrief").addEventListener("click", handleResetBrief);
  query<HTMLButtonElement>("#downloadZip").addEventListener("click", handleZipExport);
  query<HTMLButtonElement>("#previewLanding").addEventListener("click", handlePreview);
  query<HTMLButtonElement>("#detectHotspots").addEventListener("click", handleDetectHotspots);
  query<HTMLButtonElement>("#fitToggle").addEventListener("click", toggleFitMode);
  query<HTMLButtonElement>("#addHotspot").addEventListener("click", () => addHotspot(selectedDevice));
  query<HTMLButtonElement>("#copyMessages").addEventListener("click", copyMessagesFromOtherDevice);
  query<HTMLInputElement>("#manualCoords").addEventListener("change", (event) => {
    manualCoords = (event.currentTarget as HTMLInputElement).checked;
    renderHotspotEditor();
  });
  query<HTMLUListElement>("#checklist").addEventListener("click", handleChecklistJump);
  query<HTMLInputElement>("#tolerance").addEventListener("input", (event) => {
    tolerance = Number((event.currentTarget as HTMLInputElement).value) || 70;
  });
  query<HTMLSelectElement>("#hotspotDevice").addEventListener("change", (event) => {
    selectedDevice = (event.currentTarget as HTMLSelectElement).value as Device;
    selectedHotspotId = "";
    renderHotspotEditor();
    renderCandidates();
    renderPreviews();
  });
  document.addEventListener("input", (event) => {
    if ((event.target as HTMLElement).closest("[data-hotspot-editor]")) handleHotspotInput(event);
  });
  document.addEventListener("change", (event) => {
    const node = event.target as HTMLElement;
    if (node.closest("[data-hotspot-editor]") && node.matches("select[data-field]")) handleHotspotInput(event);
  });
  document.addEventListener("click", (event) => {
    const node = event.target as HTMLElement;
    if (node.closest("[data-hotspot-editor]")) handleHotspotAction(event);
    if (node.closest("[data-candidate-list]")) handleCandidateClick(event);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => copyPrompt(button.dataset.copyTarget || ""));
  });
  document.querySelectorAll<HTMLInputElement>("[data-upload-device]").forEach((input) => {
    input.addEventListener("change", () => handleMockupUpload(input));
  });
  const productImage = document.querySelector<HTMLInputElement>("#productImage");
  if (productImage) productImage.addEventListener("change", handleProductImageUpload);
  document.addEventListener("pointerdown", handleStagePointerDown);
  document.addEventListener("keydown", handleHotspotKeydown);
  window.addEventListener("pointermove", handleHotspotPointerMove);
  window.addEventListener("pointerup", handleHotspotPointerUp);
  bindWorkspaceEvents();
  bindProjectEvents();
  bindAssistEvents();
  renderProjectList();
}

function handleBriefInput(): void {
  const previousMode = brief.landingMode;
  brief = readBriefFromForm();
  if (brief.landingMode !== previousMode) normalizeHotspotActions();
  saveBrief(brief);
  refreshAll();
}

/**
 * Sans formulaire sur la page, une zone "formulaire" n'a nulle part ou aller ;
 * en mode leads, l'inverse. Seul le mode hybride laisse le choix zone par zone.
 */
function normalizeHotspotActions(): void {
  if (brief.landingMode === "hybrid") return;

  const action = defaultHotspotAction(brief);
  (["desktop", "mobile"] as Device[]).forEach((device) => {
    hotspots[device].forEach((hotspot) => {
      hotspot.action = action;
    });
  });
  saveHotspots(hotspots);
}

function handleQuickModeToggle(event: Event): void {
  quickMode = (event.currentTarget as HTMLInputElement).checked;
  rerenderBriefForm();
}

function rerenderBriefForm(): void {
  getBriefForm().innerHTML = renderBriefFields(brief);
  bindFormControls();
  refreshAll();
}

/**
 * Ces commandes vivent dans le formulaire, que rerenderBriefForm remplace
 * d'un bloc : il faut les relier a chaque rendu, pas seulement au demarrage.
 */
function bindFormControls(): void {
  query<HTMLInputElement>("#quickMode").addEventListener("change", handleQuickModeToggle);
  query<HTMLButtonElement>("#autofillEmpty").addEventListener("click", () => runAutofill("empty"));
  query<HTMLButtonElement>("#autofillAll").addEventListener("click", () => runAutofill("all"));
  query<HTMLDetailsElement>("#generatedBlock").addEventListener("toggle", (event) => {
    generatedOpen = (event.currentTarget as HTMLDetailsElement).open;
  });

  const productImage = document.querySelector<HTMLInputElement>("#productImage");
  if (productImage) productImage.addEventListener("change", handleProductImageUpload);
}

function runAutofill(mode: "empty" | "all"): void {
  brief = applyGeneratedTexts(brief, mode);
  saveBrief(brief);
  rerenderBriefForm();

  const missing = missingEssentials(brief);
  setStatus(
    "#autofillStatus",
    missing.length
      ? `Textes générés. Il manque encore : ${missing.join(", ")}.`
      : "Textes générés à partir des informations disponibles.",
    missing.length > 0
  );
}

function handleResetBrief(): void {
  brief = resetSavedBrief();
  seed = { ...emptySeed };
  Object.values(uploads).forEach((upload) => {
    if (upload) URL.revokeObjectURL(upload.url);
  });
  uploads.desktop = undefined;
  uploads.mobile = undefined;
  scans.desktop = undefined;
  scans.mobile = undefined;
  productImageName = "";
  selectedHotspotId = "";
  hotspots.desktop = cloneHotspots(defaultHotspots).desktop;
  hotspots.mobile = cloneHotspots(defaultHotspots).mobile;
  saveHotspots(hotspots);
  renderApp();
  bindEvents();
  refreshAll();
}

function readBriefFromForm(): BriefData {
  const formData = new FormData(getBriefForm());
  const read = (name: string) => String(formData.get(name) || "").trim();

  return {
    productName: read("productName"),
    targetAudience: read("targetAudience"),
    price: read("price"),
    currency: read("currency"),
    language: (read("language") || "fr") as LandingLanguage,
    landingMode: read("landingMode") as LandingMode,
    whatsappNumber: read("whatsappNumber"),
    ctaText: read("ctaText"),
    baseMessage: read("baseMessage"),
    heroTitle: read("heroTitle"),
    subtitle: read("subtitle"),
    benefits: [0, 1, 2].map((index) => ({
      title: read(`benefits.${index}.title`),
      text: read(`benefits.${index}.text`),
    })),
    faqs: [0, 1, 2].map((index) => ({
      question: read(`faqs.${index}.question`),
      answer: read(`faqs.${index}.answer`),
    })),
    formFields: textToLines(read("formFields")),
    forbiddenClaims: textToLines(read("forbiddenClaims")),
    visualStyle: read("visualStyle"),
    palette: {
      background: hex(read("palette.background"), brief.palette.background),
      text: hex(read("palette.text"), brief.palette.text),
      accent: hex(read("palette.accent"), brief.palette.accent),
      button: hex(read("palette.button"), brief.palette.button),
      buttonText: hex(read("palette.buttonText"), brief.palette.buttonText),
    },
  };
}

function refreshAll(): void {
  query<HTMLTextAreaElement>("#desktopPrompt").value = buildImagePrompt(
    brief,
    "desktop",
    hotspots.desktop,
    productImageName
  );
  query<HTMLTextAreaElement>("#mobilePrompt").value = buildImagePrompt(
    brief,
    "mobile",
    hotspots.mobile,
    productImageName
  );
  query<HTMLParagraphElement>("#promptNote").textContent = `Langue demandée à ChatGPT Images : ${languageMeta(brief.language).label}. Les positions des boutons suivent vos zones.`;
  renderWaPreview();
  syncSwatchLabels();
  refreshBriefPrompt();
  renderPreviews();
  renderHotspotEditor();
  renderChecklist();
  renderWarnings();
}

/** Le formulaire n'est pas reconstruit a chaque frappe : l'hexa affiche suivrait sinon d'un rendu. */
function syncSwatchLabels(): void {
  document.querySelectorAll<HTMLInputElement>('.swatch input[type="color"]').forEach((input) => {
    const label = input.parentElement?.querySelector("output");
    if (label) label.textContent = input.value.toUpperCase();
  });
}

function renderWaPreview(): void {
  const check = normalizeWhatsAppNumber(brief.whatsappNumber);
  const linkNode = document.querySelector<HTMLElement>("#waPreviewLink");
  const testNode = document.querySelector<HTMLAnchorElement>("#waTestLink");
  const wrapper = document.querySelector<HTMLElement>("#waPreview");
  if (!linkNode || !testNode || !wrapper) return;

  if (!check.valid) {
    linkNode.textContent = check.problem;
    wrapper.classList.add("is-invalid");
    testNode.removeAttribute("href");
    return;
  }

  wrapper.classList.remove("is-invalid");
  linkNode.textContent = `wa.me/${check.digits} — ${formatNumberForDisplay(brief.whatsappNumber)}`;
  testNode.href = whatsappLink(brief.whatsappNumber, brief.baseMessage);
}

function handleProductImageUpload(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  productImageName = file?.name || "";
  const hint = document.querySelector<HTMLSpanElement>("#productImageHint");
  if (hint) {
    hint.textContent = productImageName
      ? `Image sélectionnée : ${productImageName}`
      : "Le prompt rappellera de joindre cette image dans ChatGPT Images.";
  }
  refreshAll();
}

async function handleMockupUpload(input: HTMLInputElement): Promise<void> {
  const device = input.dataset.uploadDevice as Device;
  const file = input.files?.[0];

  if (!file) {
    clearUpload(device);
    renderPreviews();
    return;
  }

  if (!file.type.startsWith("image/")) {
    setStatus("#exportStatus", `Le fichier "${file.name}" n'est pas une image.`, true);
    input.value = "";
    clearUpload(device);
    renderPreviews();
    return;
  }

  clearUpload(device);
  uploads[device] = { file, url: URL.createObjectURL(file), width: 0, height: 0 };
  setStatus("#exportStatus", "");
  renderPreviews();
  renderChecklist();

  try {
    const [size, scan] = await Promise.all([readImageSize(file), fileToScan(file)]);
    const upload = uploads[device];
    if (upload) {
      upload.width = size.width;
      upload.height = size.height;
    }
    scans[device] = scan;
    setStatus(
      "#hotspotStatus",
      `Image ${device} analysée (${size.width} x ${size.height} px) : détection et visée disponibles.`
    );
  } catch (error) {
    scans[device] = undefined;
    setStatus("#hotspotStatus", error instanceof Error ? error.message : "Analyse de l'image impossible.", true);
  }
}

function clearUpload(device: Device): void {
  if (uploads[device]) {
    URL.revokeObjectURL(uploads[device].url);
  }
  uploads[device] = undefined;
  scans[device] = undefined;
}

function renderPreviews(): void {
  renderPreview("desktop");
  renderPreview("mobile");
}

function renderPreview(device: Device): void {
  document
    .querySelectorAll<HTMLDivElement>(`[data-preview="${device}"]`)
    .forEach((frame) => renderPreviewInto(frame, device));
}

function renderPreviewInto(frame: HTMLDivElement, device: Device): void {
  const upload = uploads[device];
  frame.innerHTML = "";
  frame.classList.toggle("has-image", Boolean(upload));

  if (!upload) {
    frame.innerHTML = `<p>Prévisualisation ${device}</p>`;
    return;
  }

  const stage = document.createElement("div");
  stage.className = "preview-stage";
  stage.dataset.device = device;
  stage.classList.toggle("is-fitting", fitMode && device === selectedDevice);

  const img = document.createElement("img");
  img.src = upload.url;
  img.alt = `Image ${device} générée pour ${brief.productName || "la landing page"}`;
  stage.append(img);

  hotspots[device].forEach((hotspot) => stage.append(createHotspotElement(hotspot)));
  if (device === selectedDevice) {
    (candidates[device] || []).forEach((region, index) => stage.append(createCandidateElement(region, index)));
  }

  frame.append(stage);
}

function createHotspotElement(hotspot: Hotspot): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "preview-hotspot";
  element.classList.toggle("is-selected", hotspot.id === selectedHotspotId);
  element.classList.toggle("is-tiny", hotspotIsTiny(hotspot));
  element.dataset.device = hotspot.device;
  element.dataset.hotspotId = hotspot.id;
  element.style.left = `${hotspot.left}%`;
  element.style.top = `${hotspot.top}%`;
  element.style.width = `${hotspot.width}%`;
  element.style.height = `${hotspot.height}%`;
  element.tabIndex = 0;
  element.setAttribute("role", "button");
  element.setAttribute("aria-label", `${hotspot.label} sur ${hotspot.device}`);
  element.innerHTML = `<span>${escapeHtml(hotspot.label)}</span><i class="resize-handle" aria-hidden="true"></i>`;
  return element;
}

function createCandidateElement(region: DetectedRegion, index: number): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "preview-candidate";
  element.dataset.candidateIndex = String(index);
  element.style.left = `${region.left}%`;
  element.style.top = `${region.top}%`;
  element.style.width = `${region.width}%`;
  element.style.height = `${region.height}%`;
  element.title = "Ajouter cette zone";
  element.setAttribute("aria-label", `Ajouter la proposition ${index + 1}`);
  element.innerHTML = `<span>#${index + 1}</span>`;
  return element;
}

function renderHotspotEditor(): void {
  const markup = hotspotEditorMarkup();
  document.querySelectorAll<HTMLDivElement>("[data-hotspot-editor]").forEach((editor) => {
    editor.innerHTML = markup;
  });
}

function hotspotEditorMarkup(): string {
  const list = hotspots[selectedDevice];

  if (!list.length) {
    return `<p class="empty-note">Aucune zone sur cette image. Utilisez « Proposer les boutons », « Viser un bouton » ou « Ajouter une zone ».</p>`;
  }

  return list.map((hotspot) => renderHotspotRow(hotspot)).join("");
}

/**
 * Le placement se fait sur l'image : viser un bouton, glisser la zone, la
 * pousser aux fleches. La liste ne sert donc qu'a nommer, ecrire le message et
 * supprimer. Une zone non selectionnee tient sur une ligne ; seule la zone
 * selectionnee ouvre ses reglages, et les coordonnees chiffrees restent un
 * recours volontaire.
 */
function renderHotspotRow(hotspot: Hotspot): string {
  const selected = hotspot.id === selectedHotspotId;
  const id = escapeAttr(hotspot.id);

  if (!selected) {
    return `
    <div class="hotspot-row is-compact" data-row-id="${id}">
      <button type="button" class="hotspot-pick" data-action="select" data-hotspot-id="${id}" aria-pressed="false">
        <span class="hotspot-name">${escapeHtml(hotspot.label)}</span>
        <span class="hotspot-pos">${formatPercent(hotspot.left)} · ${formatPercent(hotspot.top)}</span>
      </button>
      <button type="button" class="mini-button danger" data-action="delete" data-hotspot-id="${id}">Supprimer</button>
    </div>
  `;
  }

  return `
    <div class="hotspot-row is-selected" data-row-id="${id}">
      <div class="hotspot-row-head">
        <input class="hotspot-label" type="text" value="${escapeAttr(hotspot.label)}" data-hotspot-id="${id}" data-field="label" aria-label="Nom de la zone">
        <div class="hotspot-row-actions">
          <button type="button" class="mini-button" data-action="select" data-hotspot-id="${id}" aria-pressed="true">Fermer</button>
          <button type="button" class="mini-button" data-action="apply-size" data-hotspot-id="${id}">Même taille pour toutes</button>
          <button type="button" class="mini-button" data-action="duplicate" data-hotspot-id="${id}">Dupliquer</button>
          <button type="button" class="mini-button danger" data-action="delete" data-hotspot-id="${id}">Supprimer</button>
        </div>
      </div>
      ${renderHotspotAction(hotspot)}
      <label class="hotspot-message"${hotspot.action === "form" ? " hidden" : ""}>
        Message WhatsApp de ce bouton
        <textarea rows="2" data-hotspot-id="${id}" data-field="message" placeholder="Vide = message par défaut du brief">${escapeHtml(hotspot.message)}</textarea>
      </label>
      ${
        manualCoords
          ? `<div class="hotspot-coords">
        ${coordinateInput(hotspot, "left", "Gauche")}
        ${coordinateInput(hotspot, "top", "Haut")}
        ${coordinateInput(hotspot, "width", "Largeur")}
        ${coordinateInput(hotspot, "height", "Hauteur")}
      </div>`
          : `<p class="hotspot-hint">Glissez la zone sur l'image, ou poussez-la aux flèches. Maj + flèches pour la redimensionner.</p>`
      }
    </div>
  `;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} %`;
}

function renderHotspotAction(hotspot: Hotspot): string {
  if (!needsLeadForm(brief)) return "";

  return `
    <label class="hotspot-action">
      Ce bouton ouvre
      <select data-hotspot-id="${escapeAttr(hotspot.id)}" data-field="action">
        <option value="whatsapp"${hotspot.action === "whatsapp" ? " selected" : ""}>WhatsApp</option>
        <option value="form"${hotspot.action === "form" ? " selected" : ""}>Le formulaire de la page</option>
      </select>
    </label>
  `;
}

function coordinateInput(
  hotspot: Hotspot,
  key: keyof Pick<Hotspot, "left" | "top" | "width" | "height">,
  label: string
): string {
  return `
    <label>
      ${label} %
      <input type="number" step="0.05" min="0" max="100" value="${hotspot[key]}" data-hotspot-id="${escapeAttr(hotspot.id)}" data-field="${key}">
    </label>
  `;
}

function handleHotspotInput(event: Event): void {
  const input = (event.target as HTMLElement).closest<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "[data-hotspot-id][data-field]"
  );
  if (!input) return;

  const hotspot = findHotspot(selectedDevice, input.dataset.hotspotId || "");
  if (!hotspot) return;

  const fieldName = input.dataset.field || "";

  if (fieldName === "label") {
    hotspot.label = input.value;
  } else if (fieldName === "message") {
    hotspot.message = input.value;
  } else if (fieldName === "action") {
    hotspot.action = input.value === "form" ? "form" : "whatsapp";
    saveHotspots(hotspots);
    renderHotspotEditor();
    renderPreviews();
    return;
  } else {
    const key = fieldName as keyof Pick<Hotspot, "left" | "top" | "width" | "height">;
    hotspot[key] = clamp(Number(input.value), 0, 100);
    normalizeHotspot(hotspot);
  }

  saveHotspots(hotspots);
  renderPreview(selectedDevice);
  renderChecklist();
  if (fieldName === "label") refreshPrompts();
}

function handleHotspotAction(event: Event): void {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;

  const id = button.dataset.hotspotId || "";
  const action = button.dataset.action;

  if (action !== "select") pushHistory();

  if (action === "select") {
    selectedHotspotId = selectedHotspotId === id ? "" : id;
  } else if (action === "delete") {
    hotspots[selectedDevice] = hotspots[selectedDevice].filter((hotspot) => hotspot.id !== id);
    if (selectedHotspotId === id) selectedHotspotId = "";
  } else if (action === "duplicate") {
    const source = findHotspot(selectedDevice, id);
    if (source) {
      const copy: Hotspot = {
        ...source,
        id: nextHotspotId(selectedDevice),
        label: `${source.label} (copie)`,
        top: clamp(source.top + source.height + 1, 0, 100 - source.height),
      };
      hotspots[selectedDevice].push(copy);
      selectedHotspotId = copy.id;
    }
  } else if (action === "apply-size") {
    const source = findHotspot(selectedDevice, id);
    if (source) {
      hotspots[selectedDevice].forEach((hotspot) => {
        if (hotspot.id === source.id) return;
        hotspot.width = source.width;
        hotspot.height = source.height;
        normalizeHotspot(hotspot);
      });
      setHotspotStatus(`Taille de « ${source.label} » appliquée aux autres zones.`);
    }
  } else {
    return;
  }

  saveHotspots(hotspots);
  renderHotspotEditor();
  renderPreviews();
  renderChecklist();
  refreshPrompts();
  if (action === "select") syncSelectionIntoView("list");
}

function addHotspot(device: Device, region?: { left: number; top: number; width: number; height: number }): Hotspot {
  pushHistory();

  const hotspot: Hotspot = {
    id: nextHotspotId(device),
    label: `CTA ${hotspots[device].length + 1}`,
    left: region?.left ?? 25,
    top: region?.top ?? 45,
    width: region?.width ?? 50,
    height: region?.height ?? 4,
    device,
    message: "",
    action: defaultHotspotAction(brief),
  };

  normalizeHotspot(hotspot);
  hotspots[device].push(hotspot);
  selectedHotspotId = hotspot.id;
  saveHotspots(hotspots);
  renderHotspotEditor();
  renderPreviews();
  renderChecklist();
  refreshPrompts();
  return hotspot;
}

function nextHotspotId(device: Device): string {
  let index = hotspots[device].length + 1;
  let candidate = `zone-${index}`;
  while (hotspots[device].some((hotspot) => hotspot.id === candidate)) {
    index += 1;
    candidate = `zone-${index}`;
  }
  return candidate;
}

function handleDetectHotspots(): void {
  const scan = scans[selectedDevice];

  if (!scan) {
    setHotspotStatus(`Importez d'abord l'image ${selectedDevice}.`, true);
    return;
  }

  // La couleur des boutons vient du brief, pas d'une constante : l'outil sert
  // tous les produits, et le vert WhatsApp n'est plus qu'un cas parmi d'autres.
  const wanted = hexToRgb(brief.palette.button);
  const targets = wanted ? [wanted] : WHATSAPP_GREENS;

  const regions = detectButtons(scan, tolerance, targets);
  candidates[selectedDevice] = regions;
  renderCandidates();
  renderPreviews();

  setStatus(
    "#hotspotStatus",
    regions.length
      ? `${regions.length} zone(s) trouvée(s) à la couleur ${brief.palette.button}. Ajoutez celles qui sont de vrais boutons.`
      : `Aucune zone ${brief.palette.button} trouvée. Montez la tolérance, ou utilisez « Viser un bouton » et cliquez directement dessus.`,
    regions.length === 0
  );
}

/**
 * La détection par couleur ne sait pas distinguer un bouton d'un bandeau vert :
 * elle propose, l'utilisateur valide. Un bouton d'une autre couleur (doré,
 * noir) passe par « Viser un bouton ».
 */
function renderCandidates(): void {
  const list = candidates[selectedDevice] || [];
  const boxes = document.querySelectorAll<HTMLDivElement>("[data-candidate-list]");

  if (!list.length) {
    boxes.forEach((box) => {
      box.hidden = true;
      box.innerHTML = "";
    });
    return;
  }

  const markup = `
    <p class="candidate-note">${list.length} zone(s) verte(s) sur l'image ${selectedDevice}. Cliquez une proposition sur l'aperçu, ou ajoutez-la ici. Les bandeaux et badges verts sont détectés eux aussi : n'ajoutez que les vrais boutons.</p>
    ${list
      .map(
        (region, index) => `
      <div class="candidate-row">
        <span>#${index + 1} — ${region.left}% / ${region.top}% · ${region.width}% × ${region.height}%</span>
        <button type="button" class="mini-button" data-candidate="${index}">Ajouter</button>
      </div>`
      )
      .join("")}
    <div class="candidate-actions">
      <button type="button" class="mini-button" data-candidate-all>Tout ajouter</button>
      <button type="button" class="mini-button" data-candidate-clear>Effacer les propositions</button>
    </div>
  `;

  boxes.forEach((box) => {
    box.hidden = false;
    box.innerHTML = markup;
  });
}

function handleCandidateClick(event: Event): void {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!button) return;

  if (button.hasAttribute("data-candidate-clear")) {
    candidates[selectedDevice] = [];
    renderCandidates();
    renderPreviews();
    return;
  }

  if (button.hasAttribute("data-candidate-all")) {
    (candidates[selectedDevice] || []).forEach((region) => addHotspot(selectedDevice, region));
    candidates[selectedDevice] = [];
    renderCandidates();
    renderPreviews();
    return;
  }

  const index = Number(button.dataset.candidate);
  if (Number.isNaN(index)) return;
  acceptCandidate(selectedDevice, index);
}

function acceptCandidate(device: Device, index: number): void {
  const list = candidates[device] || [];
  const region = list[index];
  if (!region) return;

  candidates[device] = list.filter((_, position) => position !== index);
  const created = addHotspot(device, region);
  renderCandidates();
  renderPreviews();
  setHotspotStatus(`Zone « ${created.label} » ajoutée.`);
}

function toggleFitMode(): void {
  fitMode = !fitMode;
  document.querySelectorAll<HTMLButtonElement>("[data-fit-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(fitMode));
    button.classList.toggle("is-active", fitMode);
  });
  setStatus(
    "#hotspotStatus",
    fitMode
      ? "Cliquez un bouton dans l'aperçu : une zone est créée dessus. Cliquer dans une zone existante la recale."
      : "Visée désactivée."
  );
  renderPreviews();
}

function handleStagePointerDown(event: PointerEvent): void {
  const stage = (event.target as HTMLElement).closest<HTMLDivElement>(".preview-stage");
  if (!stage) return;

  const device = stage.dataset.device as Device;
  const stageRect = stage.getBoundingClientRect();

  if (fitMode && device === selectedDevice) {
    const xPct = ((event.clientX - stageRect.left) / stageRect.width) * 100;
    const yPct = ((event.clientY - stageRect.top) / stageRect.height) * 100;
    applyFit(device, xPct, yPct);
    event.preventDefault();
    return;
  }

  const candidate = (event.target as HTMLElement).closest<HTMLButtonElement>(".preview-candidate");
  if (candidate) {
    acceptCandidate(device, Number(candidate.dataset.candidateIndex));
    event.preventDefault();
    return;
  }

  const marker = (event.target as HTMLElement).closest<HTMLDivElement>(".preview-hotspot");
  if (!marker) return;

  const hotspot = findHotspot(device, marker.dataset.hotspotId || "");
  if (!hotspot) return;

  if (device === selectedDevice && selectedHotspotId !== hotspot.id) {
    selectedHotspotId = hotspot.id;
    renderHotspotEditor();
    document
      .querySelectorAll<HTMLDivElement>(".preview-hotspot")
      .forEach((node) => node.classList.toggle("is-selected", node.dataset.hotspotId === hotspot.id));
    syncSelectionIntoView("canvas");
  }

  dragState = {
    device,
    hotspotId: hotspot.id,
    mode: (event.target as HTMLElement).classList.contains("resize-handle") ? "resize" : "move",
    startX: event.clientX,
    startY: event.clientY,
    startLeft: hotspot.left,
    startTop: hotspot.top,
    startWidth: hotspot.width,
    startHeight: hotspot.height,
    surfaceWidth: stageRect.width,
    surfaceHeight: stageRect.height,
    moved: false,
    snapshot: JSON.stringify(hotspots),
  };
  marker.setPointerCapture(event.pointerId);
  event.preventDefault();
}

/** Cale la zone sur le bouton réellement dessiné sous le curseur. */
function applyFit(device: Device, xPct: number, yPct: number): void {
  const scan = scans[device];

  if (!scan) {
    setHotspotStatus(`Importez d'abord l'image ${device}.`, true);
    return;
  }

  const region = fitRegionAtPoint(scan, xPct, yPct, tolerance);

  if (!region) {
    setHotspotStatus("Zone introuvable à cet endroit. Cliquez au centre du bouton, ou ajustez la tolérance.", true);
    return;
  }

  // Cliquer dans une zone existante la recalibre ; cliquer ailleurs en cree une
  // nouvelle. Se baser sur la selection rendait le clic suivant imprevisible.
  const target = hotspots[device].find(
    (hotspot) =>
      xPct >= hotspot.left &&
      xPct <= hotspot.left + hotspot.width &&
      yPct >= hotspot.top &&
      yPct <= hotspot.top + hotspot.height
  );

  if (target) {
    pushHistory();
    target.left = region.left;
    target.top = region.top;
    target.width = region.width;
    target.height = region.height;
    normalizeHotspot(target);
    saveHotspots(hotspots);
    renderHotspotEditor();
    renderPreviews();
    renderChecklist();
    refreshPrompts();
    setHotspotStatus(`« ${target.label} » calée sur le bouton (${region.width}% x ${region.height}%).`);
    return;
  }

  const created = addHotspot(device, region);
  setHotspotStatus(`Nouvelle zone « ${created.label} » calée sur le bouton.`);
}

function handleHotspotPointerMove(event: PointerEvent): void {
  if (!dragState) return;

  const hotspot = findHotspot(dragState.device, dragState.hotspotId);
  if (!hotspot) return;

  const deltaX = ((event.clientX - dragState.startX) / dragState.surfaceWidth) * 100;
  const deltaY = ((event.clientY - dragState.startY) / dragState.surfaceHeight) * 100;
  dragState.moved = true;

  if (dragState.mode === "move") {
    hotspot.left = clamp(dragState.startLeft + deltaX, 0, 100 - hotspot.width);
    hotspot.top = clamp(dragState.startTop + deltaY, 0, 100 - hotspot.height);
  } else {
    hotspot.width = clamp(dragState.startWidth + deltaX, 1, 100 - hotspot.left);
    hotspot.height = clamp(dragState.startHeight + deltaY, 0.4, 100 - hotspot.top);
  }

  updateHotspotElement(hotspot);
  if (dragState.device === selectedDevice) syncHotspotInputs();
  renderChecklist();
}

function handleHotspotPointerUp(): void {
  if (dragState?.moved) {
    hotspotHistory.push(dragState.snapshot);
    if (hotspotHistory.length > 30) hotspotHistory.shift();
    refreshUndoButtons();
    saveHotspots(hotspots);
    refreshPrompts();
  }
  dragState = null;
}

function handleHotspotKeydown(event: KeyboardEvent): void {
  const marker = (event.target as HTMLElement).closest<HTMLDivElement>(".preview-hotspot");
  if (!marker) return;

  const device = marker.dataset.device as Device;
  const hotspot = findHotspot(device, marker.dataset.hotspotId || "");
  if (!hotspot) return;

  const step = event.altKey ? 0.05 : 0.25;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = moves[event.key];

  if (!move) return;
  if (!event.repeat) pushHistory();

  if (event.shiftKey) {
    hotspot.width = clamp(hotspot.width + move[0], 1, 100 - hotspot.left);
    hotspot.height = clamp(hotspot.height + move[1], 0.4, 100 - hotspot.top);
  } else {
    hotspot.left = clamp(hotspot.left + move[0], 0, 100 - hotspot.width);
    hotspot.top = clamp(hotspot.top + move[1], 0, 100 - hotspot.height);
  }

  normalizeHotspot(hotspot);
  updateHotspotElement(hotspot);
  if (device === selectedDevice) syncHotspotInputs();
  saveHotspots(hotspots);
  renderChecklist();
  event.preventDefault();
}

function updateHotspotElement(hotspot: Hotspot): void {
  document
    .querySelectorAll<HTMLDivElement>(
      `.preview-hotspot[data-device="${hotspot.device}"][data-hotspot-id="${hotspot.id}"]`
    )
    .forEach((element) => {
      element.style.left = `${hotspot.left}%`;
      element.style.top = `${hotspot.top}%`;
      element.style.width = `${hotspot.width}%`;
      element.style.height = `${hotspot.height}%`;
      element.classList.toggle("is-tiny", hotspotIsTiny(hotspot));
    });
}

function syncHotspotInputs(): void {
  hotspots[selectedDevice].forEach((hotspot) => {
    (["left", "top", "width", "height"] as const).forEach((key) => {
      document
        .querySelectorAll<HTMLInputElement>(
          `[data-hotspot-editor] input[data-hotspot-id="${hotspot.id}"][data-field="${key}"]`
        )
        .forEach((input) => {
          input.value = hotspot[key].toFixed(2);
        });
    });
  });
}

function findHotspot(device: Device, id: string): Hotspot | undefined {
  return hotspots[device].find((hotspot) => hotspot.id === id);
}

function normalizeHotspot(hotspot: Hotspot): void {
  hotspot.width = clamp(hotspot.width, 0.5, 100);
  hotspot.height = clamp(hotspot.height, 0.3, 100);
  hotspot.left = clamp(hotspot.left, 0, 100 - hotspot.width);
  hotspot.top = clamp(hotspot.top, 0, 100 - hotspot.height);
}

function refreshPrompts(): void {
  query<HTMLTextAreaElement>("#desktopPrompt").value = buildImagePrompt(
    brief,
    "desktop",
    hotspots.desktop,
    productImageName
  );
  query<HTMLTextAreaElement>("#mobilePrompt").value = buildImagePrompt(
    brief,
    "mobile",
    hotspots.mobile,
    productImageName
  );
}

function renderChecklist(): void {
  const list = query<HTMLUListElement>("#checklist");
  list.innerHTML = createChecklist(brief, uploads, hotspots)
    .map((item) => {
      const state = item.passed ? "passed" : item.blocking ? "failed" : "warned";
      const body = `<span aria-hidden="true">${item.passed ? "✓" : "!"}</span>${escapeHtml(item.label)}`;

      if (item.passed || !item.target) {
        return `<li class="${state}">${body}</li>`;
      }

      return `<li class="${state}"><button type="button" class="checklist-link" data-fix="${escapeAttr(item.target)}">${body}</button></li>`;
    })
    .join("");
}

function renderWarnings(): void {
  const warningBox = query<HTMLDivElement>("#warnings");
  const warnings: string[] = [];
  const forbiddenTerms = findForbiddenTerms(brief);
  const numberCheck = normalizeWhatsAppNumber(brief.whatsappNumber);
  const missing = missingEssentials(brief);

  if (missing.length) {
    warnings.push(`Informations manquantes : ${missing.join(", ")}.`);
  }

  if (!numberCheck.valid) {
    warnings.push(`Numéro WhatsApp : ${numberCheck.problem}`);
  } else if (numberCheck.corrected) {
    warnings.push(`Numéro corrigé automatiquement pour wa.me : ${numberCheck.digits}.`);
  }

  if (forbiddenTerms.length) {
    warnings.push(`Supprimez ces mots du brief avant export : ${forbiddenTerms.join(", ")}.`);
  }

  const tinyZones = [...hotspots.desktop, ...hotspots.mobile].filter(hotspotIsTiny);
  if (tinyZones.length) {
    warnings.push(`${tinyZones.length} zone(s) trop petite(s) pour un doigt : ${tinyZones.map((zone) => zone.label).join(", ")}.`);
  }

  if (!productImageName) {
    warnings.push("Aucune image produit n'est sélectionnée pour accompagner le prompt.");
  }

  warningBox.innerHTML = warnings.length
    ? warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")
    : "<p>Le brief est prêt pour générer les images.</p>";
}

async function copyPrompt(targetId: string): Promise<void> {
  const target = document.querySelector<HTMLTextAreaElement>(`#${targetId}`);
  if (!target) return;

  try {
    await navigator.clipboard.writeText(target.value);
    setStatus("#copyStatus", "Prompt copié.");
  } catch {
    target.focus();
    target.select();
    document.execCommand("copy");
    setStatus("#copyStatus", "Prompt sélectionné et copié.");
  }
}

function currentSizes(): Partial<Record<Device, ImageSize>> {
  const sizes: Partial<Record<Device, ImageSize>> = {};
  (["desktop", "mobile"] as Device[]).forEach((device) => {
    const upload = uploads[device];
    if (upload && upload.width && upload.height) {
      sizes[device] = { width: upload.width, height: upload.height };
    }
  });
  return sizes;
}

/**
 * La fenetre est ouverte avant tout traitement asynchrone : sinon le
 * navigateur considere que le geste utilisateur a expire et bloque le popup.
 */
async function handlePreview(): Promise<void> {
  if (!uploads.desktop || !uploads.mobile) {
    setStatus("#exportStatus", "Importez les images desktop et mobile avant de prévisualiser.", true);
    return;
  }

  const target = window.open("", "_blank");

  if (!target) {
    setStatus("#exportStatus", "La fenêtre d'aperçu a été bloquée. Autorisez les pop-ups pour ce site.", true);
    return;
  }

  target.document.write("<p style=\"font-family:Arial;padding:24px\">Préparation de l'aperçu...</p>");
  setStatus("#exportStatus", "Aperçu en préparation...");

  try {
    await renderLandingPreview(target, brief, hotspots, uploads);
    setStatus("#exportStatus", "Aperçu ouvert dans un nouvel onglet.");
  } catch (error) {
    target.close();
    setStatus("#exportStatus", error instanceof Error ? error.message : "Aperçu impossible.", true);
  }
}

async function handleZipExport(): Promise<void> {
  setStatus("#exportStatus", "Préparation du ZIP...");

  try {
    const desktopFile = uploads.desktop?.file;
    const mobileFile = uploads.mobile?.file;

    if (!desktopFile || !mobileFile) {
      throw new Error("Importez les images desktop et mobile avant de télécharger le ZIP.");
    }

    const { blob, filename } = await buildNetlifyZip({
      brief,
      images: { desktop: desktopFile, mobile: mobileFile },
      hotspots,
      sizes: currentSizes(),
      singleFile: query<HTMLInputElement>("#singleFile").checked,
    });

    downloadBlob(blob, filename);
    setStatus("#exportStatus", `ZIP généré : ${filename}`);
  } catch (error) {
    setStatus("#exportStatus", error instanceof Error ? error.message : "Export impossible.", true);
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setStatus(selector: string, message: string, isError = false): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function getBriefForm(): HTMLFormElement {
  return query<HTMLFormElement>("#briefForm");
}

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Sélecteur introuvable : ${selector}`);
  }
  return element;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function renderWorkspace(): string {
  return `
    <div id="workspace" class="workspace" role="dialog" aria-label="Atelier de placement" hidden>
      <header class="workspace-bar">
        <strong>Atelier de placement</strong>
        <div class="group" role="group" aria-label="Image">
          <button type="button" class="mini-button" data-ws-device="desktop">Desktop</button>
          <button type="button" class="mini-button" data-ws-device="mobile">Mobile</button>
        </div>
        <div class="group" role="group" aria-label="Zoom">
          <button type="button" class="mini-button" data-zoom="out" aria-label="Dézoomer">−</button>
          <span id="zoomValue" class="zoom-value">100 %</span>
          <button type="button" class="mini-button" data-zoom="in" aria-label="Zoomer">+</button>
          <button type="button" class="mini-button" data-zoom="reset">Ajuster</button>
        </div>
        <div class="group" role="group" aria-label="Zones">
          <button type="button" class="mini-button" data-ws-action="detect">Proposer les boutons</button>
          <button type="button" class="mini-button" data-ws-action="fit" data-fit-toggle aria-pressed="false">Viser un bouton</button>
          <button type="button" class="mini-button" data-ws-action="add">Ajouter</button>
          <button type="button" class="mini-button" data-ws-action="undo">Annuler</button>
        </div>
        <span class="workspace-spacer"></span>
        <button type="button" class="mini-button" data-ws-action="close">Fermer</button>
      </header>
      <p class="workspace-hint">Flèches : déplacer la zone sélectionnée · Maj + flèches : redimensionner · Alt : pas fin · Ctrl+Z : annuler</p>
      <div class="workspace-body">
        <div class="workspace-canvas" id="wsCanvas">
          <div class="preview-frame" id="wsFrame"></div>
        </div>
        <aside class="workspace-side">
          <div class="status" id="wsStatus" aria-live="polite"></div>
          <div class="candidate-list" data-candidate-list hidden></div>
          <div class="hotspot-editor" data-hotspot-editor></div>
        </aside>
      </div>
    </div>
  `;
}

function openWorkspace(): void {
  if (!uploads[selectedDevice]) {
    setHotspotStatus(`Importez d'abord l'image ${selectedDevice}.`, true);
    return;
  }

  workspaceOpen = true;
  const workspace = query<HTMLDivElement>("#workspace");
  workspace.hidden = false;
  document.body.classList.add("workspace-open");
  applyWorkspaceDevice();
  setZoom(1);
}

function closeWorkspace(): void {
  workspaceOpen = false;
  query<HTMLDivElement>("#workspace").hidden = true;
  document.body.classList.remove("workspace-open");
  const frame = query<HTMLDivElement>("#wsFrame");
  frame.removeAttribute("data-preview");
  frame.innerHTML = "";
}

/** Le cadre de l'atelier prend l'attribut du device courant : les rendus existants s'y appliquent sans duplication. */
function applyWorkspaceDevice(): void {
  const frame = query<HTMLDivElement>("#wsFrame");
  frame.dataset.preview = selectedDevice;
  document.querySelectorAll<HTMLButtonElement>("[data-ws-device]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.wsDevice === selectedDevice));
  });
  renderPreviews();
  renderHotspotEditor();
  renderCandidates();
}

function setZoom(value: number): void {
  zoom = clamp(value, 1, 4);
  query<HTMLDivElement>("#wsCanvas").style.setProperty("--zoom", String(zoom));
  query<HTMLSpanElement>("#zoomValue").textContent = `${Math.round(zoom * 100)} %`;
}

function pushHistory(): void {
  hotspotHistory.push(JSON.stringify(hotspots));
  if (hotspotHistory.length > 30) hotspotHistory.shift();
  refreshUndoButtons();
}

function refreshUndoButtons(): void {
  const disabled = hotspotHistory.length === 0;
  const undoButton = document.querySelector<HTMLButtonElement>("#undoHotspots");
  if (undoButton) undoButton.disabled = disabled;
  const workspaceUndo = document.querySelector<HTMLButtonElement>('[data-ws-action="undo"]');
  if (workspaceUndo) workspaceUndo.disabled = disabled;
}

function undoHotspots(): void {
  const previous = hotspotHistory.pop();

  if (!previous) {
    setHotspotStatus("Rien à annuler.", true);
    return;
  }

  const parsed = JSON.parse(previous) as Record<Device, Hotspot[]>;
  hotspots.desktop = parsed.desktop;
  hotspots.mobile = parsed.mobile;
  selectedHotspotId = "";
  saveHotspots(hotspots);
  renderHotspotEditor();
  renderPreviews();
  renderChecklist();
  refreshPrompts();
  refreshUndoButtons();
  setHotspotStatus("Dernière modification annulée.");
}

/** Les messages doivent apparaitre dans le panneau ET dans l'atelier. */
function setHotspotStatus(message: string, isError = false): void {
  setStatus("#hotspotStatus", message, isError);
  setStatus("#wsStatus", message, isError);
}

function syncSelectionIntoView(source: "list" | "canvas"): void {
  if (!selectedHotspotId) return;

  if (source === "canvas") {
    const row = document.querySelector<HTMLElement>(".workspace-side .hotspot-row.is-selected");
    if (row) row.scrollIntoView({ block: "nearest" });
    return;
  }

  // Les fleches n'agissent que sur la zone qui a le focus DOM. Choisir dans la
  // liste doit donc donner le focus au reperage sur l'image, sinon le clavier
  // ne repond pas alors qu'on vient justement de designer la zone.
  const scope = workspaceOpen ? "#wsFrame" : `[data-preview="${selectedDevice}"]`;
  const marker = document.querySelector<HTMLElement>(
    `${scope} .preview-hotspot[data-hotspot-id="${selectedHotspotId}"]`
  );

  if (marker) {
    marker.scrollIntoView({ block: "center", inline: "center" });
    marker.focus({ preventScroll: true });
  }
}

function bindWorkspaceEvents(): void {
  query<HTMLButtonElement>("#openWorkspace").addEventListener("click", openWorkspace);
  query<HTMLButtonElement>("#undoHotspots").addEventListener("click", undoHotspots);

  query<HTMLElement>("#workspace").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;

    if (button.dataset.wsDevice) {
      selectedDevice = button.dataset.wsDevice as Device;
      selectedHotspotId = "";
      query<HTMLSelectElement>("#hotspotDevice").value = selectedDevice;
      applyWorkspaceDevice();
      return;
    }

    if (button.dataset.zoom === "in") setZoom(zoom + 0.25);
    if (button.dataset.zoom === "out") setZoom(zoom - 0.25);
    if (button.dataset.zoom === "reset") setZoom(1);

    const action = button.dataset.wsAction;
    if (action === "detect") handleDetectHotspots();
    if (action === "fit") toggleFitMode();
    if (action === "add") addHotspot(selectedDevice);
    if (action === "undo") undoHotspots();
    if (action === "close") closeWorkspace();
  });

  document.addEventListener("keydown", (event) => {
    const node = event.target as HTMLElement;
    const typing = node.matches("input, textarea, select");

    if (event.key === "Escape" && workspaceOpen && !typing) {
      closeWorkspace();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !typing) {
      event.preventDefault();
      undoHotspots();
    }
  });
}

function renderProjectList(): void {
  const select = query<HTMLSelectElement>("#projectSelect");
  const projects = listProjects();

  select.innerHTML = [
    `<option value="">— Brouillon en cours —</option>`,
    ...projects.map(
      (project) =>
        `<option value="${escapeAttr(project.id)}"${project.id === currentProjectId ? " selected" : ""}>${escapeHtml(project.name)}</option>`
    ),
  ].join("");

  const deleteButton = query<HTMLButtonElement>("#projectDelete");
  const duplicateButton = query<HTMLButtonElement>("#projectDuplicate");
  deleteButton.disabled = !currentProjectId;
  duplicateButton.disabled = !currentProjectId;
}

function bindProjectEvents(): void {
  query<HTMLSelectElement>("#projectSelect").addEventListener("change", (event) => {
    const id = (event.currentTarget as HTMLSelectElement).value;
    if (!id) {
      currentProjectId = "";
      query<HTMLInputElement>("#projectName").value = "";
      renderProjectList();
      setStatus("#projectStatus", "Brouillon en cours : les modifications ne sont pas rattachées à un projet.");
      return;
    }
    loadProject(id);
  });

  query<HTMLButtonElement>("#projectSave").addEventListener("click", handleProjectSave);
  query<HTMLButtonElement>("#projectNew").addEventListener("click", handleProjectNew);
  query<HTMLButtonElement>("#projectDuplicate").addEventListener("click", handleProjectDuplicate);
  query<HTMLButtonElement>("#projectDelete").addEventListener("click", handleProjectDelete);
  query<HTMLButtonElement>("#projectExport").addEventListener("click", handleProjectExport);
  query<HTMLInputElement>("#projectImport").addEventListener("change", handleProjectImport);
}

function loadProject(id: string): void {
  const project = findProject(id);

  if (!project) {
    setStatus("#projectStatus", "Projet introuvable.", true);
    return;
  }

  currentProjectId = project.id;
  brief = project.brief;
  hotspots.desktop = project.hotspots.desktop;
  hotspots.mobile = project.hotspots.mobile;
  selectedHotspotId = "";
  candidates.desktop = [];
  candidates.mobile = [];
  saveBrief(brief);
  saveHotspots(hotspots);
  rerenderBriefForm();
  renderProjectList();
  query<HTMLInputElement>("#projectName").value = project.name;
  setStatus("#projectStatus", `Projet « ${project.name} » chargé. Les images restent à importer.`);
}

function handleProjectSave(): void {
  const name = query<HTMLInputElement>("#projectName").value.trim();

  if (currentProjectId) {
    const existing = findProject(currentProjectId);
    if (existing) {
      const saved = upsertProject({ ...existing, name: name || existing.name, brief, hotspots });
      renderProjectList();
      setStatus("#projectStatus", `Projet « ${saved.name} » mis à jour.`);
      return;
    }
  }

  const created = createProject(name, brief, hotspots);
  currentProjectId = created.id;
  query<HTMLInputElement>("#projectName").value = created.name;
  renderProjectList();
  setStatus("#projectStatus", `Projet « ${created.name} » enregistré.`);
}

function handleProjectNew(): void {
  currentProjectId = "";
  query<HTMLInputElement>("#projectName").value = "";
  renderProjectList();
  setStatus("#projectStatus", "Nouveau projet : renseignez le brief puis enregistrez.");
}

function handleProjectDuplicate(): void {
  const copy = duplicateProject(currentProjectId);

  if (!copy) {
    setStatus("#projectStatus", "Sélectionnez d'abord un projet à dupliquer.", true);
    return;
  }

  loadProject(copy.id);
  setStatus("#projectStatus", `Copie créée : « ${copy.name} ».`);
}

function handleProjectDelete(): void {
  const project = findProject(currentProjectId);
  if (!project) return;
  if (!window.confirm(`Supprimer définitivement le projet « ${project.name} » ?`)) return;

  deleteProject(project.id);
  currentProjectId = "";
  query<HTMLInputElement>("#projectName").value = "";
  renderProjectList();
  setStatus("#projectStatus", `Projet « ${project.name} » supprimé.`);
}

function handleProjectExport(): void {
  const project = findProject(currentProjectId) || {
    id: "brouillon",
    name: query<HTMLInputElement>("#projectName").value.trim() || brief.productName || "brouillon",
    updatedAt: Date.now(),
    brief,
    hotspots,
  };

  const blob = new Blob([projectToJson(project)], { type: "application/json" });
  downloadBlob(blob, `${slugify(project.name)}.json`);
  setStatus("#projectStatus", "Projet exporté en JSON.");
}

async function handleProjectImport(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const imported = projectFromJson(await file.text());
    const saved = upsertProject(imported);
    loadProject(saved.id);
    setStatus("#projectStatus", `Projet « ${saved.name} » importé.`);
  } catch (error) {
    setStatus("#projectStatus", error instanceof Error ? error.message : "Import impossible.", true);
  } finally {
    input.value = "";
  }
}

/** Une ligne de checklist en echec renvoie directement au champ a corriger. */
function handleChecklistJump(event: Event): void {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-fix]");
  if (!button) return;

  const target = document.querySelector<HTMLElement>(button.dataset.fix || "");
  if (!target) return;

  // Un champ a corriger peut vivre dans le bloc replie : l'y envoyer ferme ne sert a rien.
  const holder = target.closest<HTMLDetailsElement>("details");
  if (holder && !holder.open) {
    holder.open = true;
    generatedOpen = true;
  }

  target.scrollIntoView({ behavior: "smooth", block: "center" });
  if (target.matches("input, textarea, select")) {
    window.setTimeout(() => target.focus(), 350);
  }
  target.classList.add("is-highlighted");
  window.setTimeout(() => target.classList.remove("is-highlighted"), 1600);
}

/** Les positions different entre desktop et mobile, mais les libelles et les messages sont les memes. */
function copyMessagesFromOtherDevice(): void {
  const source: Device = selectedDevice === "desktop" ? "mobile" : "desktop";
  const sourceList = hotspots[source];
  const targetList = hotspots[selectedDevice];

  if (!sourceList.length || !targetList.length) {
    setHotspotStatus("Il faut des zones sur les deux images pour reprendre les messages.", true);
    return;
  }

  pushHistory();
  targetList.forEach((hotspot, index) => {
    const model = sourceList[index];
    if (!model) return;
    hotspot.label = model.label;
    hotspot.message = model.message;
  });

  saveHotspots(hotspots);
  renderHotspotEditor();
  renderPreviews();
  refreshPrompts();
  setHotspotStatus(`Libellés et messages repris depuis l'image ${source}.`);
}

function bindAssistEvents(): void {
  seedFieldIds.forEach(([id]) => {
    query<HTMLInputElement | HTMLTextAreaElement>(`#${id}`).addEventListener("input", handleSeedInput);
  });
  query<HTMLButtonElement>("#copyBriefPrompt").addEventListener("click", handleCopyAndOpen);
  query<HTMLButtonElement>("#togglePrompt").addEventListener("click", togglePromptPreview);
  query<HTMLButtonElement>("#applyBriefResponse").addEventListener("click", applyBriefResponse);

  // Coller la reponse suffit : un bouton de plus n'apporte rien a ce stade.
  query<HTMLTextAreaElement>("#briefResponse").addEventListener("paste", () => {
    window.setTimeout(() => applyBriefResponse(), 0);
  });

  refreshBriefPrompt();
}

function handleSeedInput(): void {
  seedFieldIds.forEach(([id, key]) => {
    seed[key] = query<HTMLInputElement | HTMLTextAreaElement>(`#${id}`).value;
  });
  saveSeed(seed);
  refreshBriefPrompt();
}

function refreshBriefPrompt(): void {
  query<HTMLTextAreaElement>("#briefPromptPreview").value = buildBriefPrompt(seed, brief);

  const usable = seedIsUsable(seed);
  const copyButton = query<HTMLButtonElement>("#copyBriefPrompt");
  copyButton.disabled = !usable;
  copyButton.title = usable ? "" : "Indiquez d'abord le produit.";
}

/**
 * Copier puis ouvrir dans le meme geste : l'aller-retour vers ChatGPT est la
 * seule etape ou le vendeur peut se perdre.
 */
async function handleCopyAndOpen(): Promise<void> {
  if (!seedIsUsable(seed)) {
    setStatus("#assistStatus", "Indiquez d'abord le produit que vous vendez.", true);
    query<HTMLInputElement>("#seedProduct").focus();
    return;
  }

  refreshBriefPrompt();
  // Ouvrir avant le presse-papiers : l'attente asynchrone perdrait le geste utilisateur.
  const opened = window.open("https://chatgpt.com/", "_blank", "noopener");
  await copyPrompt("briefPromptPreview");

  setStatus(
    "#assistStatus",
    opened
      ? "Prompt copié et ChatGPT ouvert. Collez-le là-bas, puis ramenez sa réponse ci-dessous."
      : "Prompt copié. Ouvrez ChatGPT, collez-le, puis ramenez sa réponse ci-dessous."
  );
}

function togglePromptPreview(event: Event): void {
  const button = event.currentTarget as HTMLButtonElement;
  const preview = query<HTMLTextAreaElement>("#briefPromptPreview");
  const show = preview.hidden;

  preview.hidden = !show;
  button.setAttribute("aria-expanded", String(show));
  button.textContent = show ? "Masquer le prompt" : "Voir le prompt";
}

function applyBriefResponse(): void {
  const response = query<HTMLTextAreaElement>("#briefResponse").value;

  if (!response.trim()) {
    setStatus("#assistStatus", "Collez d'abord la réponse de ChatGPT.", true);
    return;
  }

  try {
    const parsed = parseBriefResponse(response, brief, seed);
    brief = parsed.brief;
    saveBrief(brief);
    rerenderBriefForm();
    highlightFilledFields();

    const missing = missingEssentials(brief);
    const count = parsed.filled.length;
    setStatus(
      "#assistStatus",
      missing.length
        ? `${count} champ(s) rempli(s). À compléter à la main : ${missing.join(", ")}.`
        : `${count} champ(s) rempli(s). Vérifiez le numéro WhatsApp et le prix avant de générer les images.`,
      missing.length > 0
    );
  } catch (error) {
    setStatus("#assistStatus", error instanceof Error ? error.message : "Réponse illisible.", true);
  }
}

/** Le formulaire est reconstruit d'un bloc : sans signal, on ne voit pas qu'il a bouge. */
function highlightFilledFields(): void {
  const form = getBriefForm();
  form.classList.remove("just-filled");
  void form.offsetWidth;
  form.classList.add("just-filled");
  window.setTimeout(() => form.classList.remove("just-filled"), 1400);
}
