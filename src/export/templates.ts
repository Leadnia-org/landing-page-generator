import { languageMeta } from "../i18n";
import type { BriefData, Device, Hotspot, ImageSize, LandingFiles } from "../types";
import { escapeAttr, escapeHtml, fieldName, fieldType, formatPrice, slugify } from "../utils/text";
import { formatNumberForDisplay, normalizeWhatsAppNumber, whatsappLink } from "../utils/whatsapp";
import { needsLeadForm, needsVisualWhatsApp } from "../validation";

export function buildLandingFiles(
  brief: BriefData,
  hotspots: Record<Device, Hotspot[]>,
  sizes: Partial<Record<Device, ImageSize>> = {}
): LandingFiles {
  return {
    indexHtml: buildIndexHtml(brief, hotspots, sizes),
    styleCss: buildStyleCss(brief, hotspots),
    scriptJs: buildScriptJs(brief),
  };
}

function hotspotClass(hotspot: Hotspot): string {
  return `hotspot-${hotspot.device}-${slugify(hotspot.id)}`;
}

function sizeAttributes(size?: ImageSize): string {
  // Sans width/height le navigateur ne connait pas le ratio avant le telechargement
  // de l'image : la page saute au chargement, ce que Google penalise.
  return size && size.width > 0 && size.height > 0 ? ` width="${size.width}" height="${size.height}"` : "";
}

function buildIndexHtml(
  brief: BriefData,
  hotspots: Record<Device, Hotspot[]>,
  sizes: Partial<Record<Device, ImageSize>>
): string {
  const language = languageMeta(brief.language);
  const visualWhatsApp = needsVisualWhatsApp(brief);
  const hotspotHtml = visualWhatsApp
    ? [...hotspots.desktop, ...hotspots.mobile].map((hotspot) => buildHotspotLink(brief, hotspot)).join("\n")
    : "";
  const formHtml = needsLeadForm(brief) ? buildFormSection(brief) : "";
  const stickyHtml = visualWhatsApp ? buildSticky(brief) : "";
  const fallbackHtml = visualWhatsApp || needsLeadForm(brief) ? buildFallback(brief) : "";

  return `<!doctype html>
<html lang="${language.htmlLang}" dir="${language.dir}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${escapeHtml(brief.productName)} - ${escapeHtml(formatPrice(brief))}</title>
    <meta name="description" content="${escapeAttr(`${brief.productName} - ${formatPrice(brief)}. ${brief.subtitle}`)}">
    <meta property="og:title" content="${escapeAttr(brief.heroTitle || brief.productName)}">
    <meta property="og:description" content="${escapeAttr(brief.subtitle)}">
    <meta property="og:type" content="product">
    <link rel="preload" href="assets/landing-desktop.webp" as="image" media="(min-width: 768px)">
    <link rel="preload" href="assets/landing-mobile.webp" as="image" media="(max-width: 767px)">
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <main>
      <h1 class="sr-only">${escapeHtml(brief.heroTitle)}</h1>
      <p class="sr-only">${escapeHtml(brief.subtitle)} ${escapeHtml(language.strings.priceLabel)} : ${escapeHtml(formatPrice(brief))}.</p>

      <section class="visual-wrap" aria-label="${escapeAttr(brief.productName)}">
        <picture>
          <source srcset="assets/landing-mobile.webp" media="(max-width: 767px)" type="image/webp"${sizeAttributes(sizes.mobile)}>
          <source srcset="assets/landing-desktop.webp" type="image/webp"${sizeAttributes(sizes.desktop)}>
          <img class="landing-image" src="assets/landing-desktop.webp" alt="${escapeAttr(`${brief.productName} - ${formatPrice(brief)}`)}"${sizeAttributes(sizes.desktop)} fetchpriority="high" decoding="async">
        </picture>
${hotspotHtml}
      </section>
${formHtml}
${buildSeoContent(brief)}
    </main>
${stickyHtml}
${fallbackHtml}
    <script src="script.js" defer></script>
  </body>
</html>
`;
}

function buildHotspotLink(brief: BriefData, hotspot: Hotspot): string {
  const message = hotspot.message.trim() || brief.baseMessage;
  const href = escapeAttr(whatsappLink(brief.whatsappNumber, message));
  const messageAttr = hotspot.message.trim() ? ` data-wa-message="${escapeAttr(hotspot.message.trim())}"` : "";

  return `        <a class="hotspot hotspot-${hotspot.device} ${hotspotClass(hotspot)}" href="${href}" target="_blank" rel="noopener" data-wa data-wa-label="${escapeAttr(hotspot.label)}"${messageAttr} aria-label="${escapeAttr(`${hotspot.label} - ${brief.ctaText}`)}"></a>`;
}

function buildSticky(brief: BriefData): string {
  const href = escapeAttr(whatsappLink(brief.whatsappNumber, brief.baseMessage));

  return `    <a class="wa-sticky" href="${href}" target="_blank" rel="noopener" data-wa data-wa-label="Sticky" aria-label="${escapeAttr(brief.ctaText)}">
      <span class="wa-sticky-icon" aria-hidden="true"></span>
      <span class="wa-sticky-text">${escapeHtml(brief.ctaText)}</span>
    </a>`;
}

function buildFallback(brief: BriefData): string {
  const strings = languageMeta(brief.language).strings;
  const digits = normalizeWhatsAppNumber(brief.whatsappNumber).digits;

  return `    <div class="wa-fallback" id="waFallback" role="dialog" aria-live="polite" aria-label="${escapeAttr(strings.fallbackTitle)}" hidden>
      <button class="wa-fallback-close" type="button" data-wa-close aria-label="${escapeAttr(strings.closeLabel)}">&times;</button>
      <strong>${escapeHtml(strings.fallbackTitle)}</strong>
      <p>${escapeHtml(strings.fallbackText)}</p>
      <p class="wa-fallback-number" data-wa-number="${escapeAttr(digits)}">${escapeHtml(formatNumberForDisplay(brief.whatsappNumber))}</p>
      <div class="wa-fallback-actions">
        <button class="wa-fallback-copy" type="button" data-wa-copy data-copied-label="${escapeAttr(strings.copied)}">${escapeHtml(strings.copyNumber)}</button>
        <a class="wa-fallback-web" href="https://web.whatsapp.com/send?phone=${escapeAttr(digits)}" target="_blank" rel="noopener">${escapeHtml(strings.openWeb)}</a>
      </div>
    </div>`;
}

/** Texte réel derrière l'image : sans lui, la page n'a aucun contenu indexable. */
function buildSeoContent(brief: BriefData): string {
  const strings = languageMeta(brief.language).strings;
  const benefits = brief.benefits.filter((benefit) => benefit.title.trim() || benefit.text.trim());
  const faqs = brief.faqs.filter((faq) => faq.question.trim() || faq.answer.trim());

  if (!benefits.length && !faqs.length) return "";

  const benefitBlock = benefits.length
    ? `        <h2>${escapeHtml(strings.benefitsTitle)}</h2>
        <ul>
${benefits.map((benefit) => `          <li><strong>${escapeHtml(benefit.title)}</strong> ${escapeHtml(benefit.text)}</li>`).join("\n")}
        </ul>`
    : "";

  const faqBlock = faqs.length
    ? `        <h2>${escapeHtml(strings.faqTitle)}</h2>
        <dl>
${faqs.map((faq) => `          <dt>${escapeHtml(faq.question)}</dt>\n          <dd>${escapeHtml(faq.answer)}</dd>`).join("\n")}
        </dl>`
    : "";

  return `      <section class="sr-only">
${[benefitBlock, faqBlock].filter(Boolean).join("\n")}
      </section>`;
}

function buildFormSection(brief: BriefData): string {
  const strings = languageMeta(brief.language).strings;
  const fields = brief.formFields.length ? brief.formFields : ["Nom", "Téléphone / WhatsApp", "Ville", "Quantité"];
  const title = brief.landingMode === "leads" ? strings.formTitleLead : strings.formTitleOrder;
  const submit = brief.landingMode === "leads" ? strings.submitLead : brief.ctaText;

  return `
      <section class="form-section" aria-labelledby="lead-title">
        <form class="lead-form js-whatsapp-form" novalidate>
          <h2 id="lead-title">${escapeHtml(title)}</h2>
          <p>${escapeHtml(brief.productName)} - ${escapeHtml(formatPrice(brief))}</p>
          <div class="form-grid">
${fields.map((field, index) => buildFormField(field, index)).join("\n")}
          </div>
          <button type="submit" data-wa-label="Formulaire">${escapeHtml(submit)}</button>
        </form>
      </section>
`;
}

function buildFormField(label: string, index: number): string {
  const id = `field-${index + 1}`;
  const type = fieldType(label);
  const min = type === "number" ? ' min="1" step="1"' : "";
  const mode = type === "tel" ? ' inputmode="tel"' : type === "number" ? ' inputmode="numeric"' : "";

  return `            <label for="${id}">
              ${escapeHtml(label)}
              <input id="${id}" name="${fieldName(label, index)}" type="${type}"${min}${mode} required>
            </label>`;
}

function buildStyleCss(brief: BriefData, hotspots: Record<Device, Hotspot[]>): string {
  const visualWhatsApp = needsVisualWhatsApp(brief);
  const positions = [...hotspots.desktop, ...hotspots.mobile]
    .map(
      (hotspot) =>
        `.${hotspotClass(hotspot)}{left:${hotspot.left}%;top:${hotspot.top}%;width:${hotspot.width}%;height:${hotspot.height}%;}`
    )
    .join("\n");
  const mobilePadding = visualWhatsApp ? "body{padding-bottom:calc(84px + env(safe-area-inset-bottom,0px));}" : "";

  return `:root{--cream:#f7eddc;--green:#105421;--green-dark:#062f16;--wa:#25d366;--line:rgba(106,61,28,.24);--focus:#ffc529;--error:#a4281f;}
*{box-sizing:border-box;}
html{background:var(--cream);}
body{margin:0;min-width:320px;overflow-x:hidden;background:var(--cream);color:var(--green-dark);font-family:Arial,Helvetica,sans-serif;}
button,input{font:inherit;}
.visual-wrap{position:relative;width:100%;max-width:1440px;margin:0 auto;line-height:0;background:var(--cream);}
.landing-image{display:block;width:100%;height:auto;}
.hotspot{position:absolute;z-index:5;display:block;border-radius:999px;background:rgba(255,255,255,0);text-decoration:none;-webkit-tap-highlight-color:transparent;transition:background .12s ease,box-shadow .12s ease;}
/* Zone tactile d'au moins 44px centree sur le bouton dessine, sans deplacer la zone visible. */
.hotspot::after{content:"";position:absolute;left:0;right:0;top:50%;height:100%;min-height:44px;transform:translateY(-50%);}
.hotspot:active{background:rgba(255,255,255,.24);box-shadow:inset 0 0 0 2px rgba(255,255,255,.65);}
.hotspot:focus-visible,.wa-sticky:focus-visible,button:focus-visible,input:focus-visible,a:focus-visible{outline:4px solid var(--focus);outline-offset:4px;}
.hotspot-mobile{display:none;}
${positions}
.form-section{padding:42px 16px 52px;background:linear-gradient(180deg,#fff6e6 0%,#f3e3c8 100%);}
.lead-form{width:min(720px,100%);margin:0 auto;padding:24px;border:1px solid var(--line);border-radius:20px;background:#fffaf0;box-shadow:0 18px 44px rgba(54,34,13,.14);}
.lead-form h2{margin:0;color:var(--green);font-size:clamp(1.6rem,4vw,2.5rem);line-height:1.08;text-align:center;text-transform:uppercase;}
.lead-form p{margin:10px 0 22px;text-align:center;font-weight:900;color:#6a3d1c;}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}
.form-grid label{display:block;color:var(--green-dark);font-weight:900;}
.form-grid input{width:100%;min-height:48px;margin-top:8px;border:1px solid var(--line);border-radius:12px;background:#fffef8;padding:0 14px;color:var(--green-dark);}
.form-grid input.is-invalid{border-color:var(--error);box-shadow:0 0 0 3px rgba(164,40,31,.13);}
.lead-form button{display:block;width:min(360px,100%);min-height:52px;margin:20px auto 0;border:0;border-radius:999px;background:linear-gradient(180deg,#168533 0%,#0a4a1d 100%);color:#fff;font-weight:900;text-transform:uppercase;cursor:pointer;}
.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
.wa-sticky{position:fixed;z-index:20;display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;padding:0 20px;border-radius:999px;background:linear-gradient(180deg,#25d366 0%,#128c3d 100%);color:#fff;font-weight:900;text-align:center;text-decoration:none;box-shadow:0 14px 30px rgba(9,75,31,.34);opacity:0;visibility:hidden;transform:translateY(16px);transition:opacity .18s ease,transform .18s ease;}
.wa-sticky.is-visible{opacity:1;visibility:visible;transform:none;}
.wa-sticky:active{transform:scale(.98);}
.wa-sticky-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.wa-sticky-icon{flex:0 0 auto;width:22px;height:22px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.6 0-1.2.6-1.8.9-2.1.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.2.4-.2.6-.1l1.8.9c.5.2.6.4.6.5.1.2.1.7-.1 1.3z'/%3E%3C/svg%3E") center/contain no-repeat;}
.wa-fallback{position:fixed;z-index:30;left:50%;bottom:16px;width:min(420px,calc(100% - 24px));transform:translateX(-50%);padding:18px 18px 16px;border:1px solid var(--line);border-radius:18px;background:#fffaf0;box-shadow:0 20px 50px rgba(20,12,4,.28);}
.wa-fallback[hidden]{display:none;}
.wa-fallback strong{display:block;color:var(--green);font-size:1.05rem;}
.wa-fallback p{margin:8px 0 0;font-size:.95rem;line-height:1.4;}
.wa-fallback-number{font-weight:900;font-size:1.15rem;letter-spacing:.02em;direction:ltr;}
.wa-fallback-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;}
.wa-fallback-actions button,.wa-fallback-actions a{flex:1 1 140px;min-height:46px;display:flex;align-items:center;justify-content:center;border:0;border-radius:999px;background:var(--green);color:#fff;font-weight:900;text-decoration:none;cursor:pointer;}
.wa-fallback-actions a{background:#128c3d;}
.wa-fallback-close{position:absolute;top:8px;inset-inline-end:10px;width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:var(--green-dark);font-size:1.4rem;line-height:1;cursor:pointer;}
[dir="rtl"] .form-grid label,[dir="rtl"] .wa-fallback{text-align:right;}
@media(min-width:768px){.wa-sticky{inset-inline-end:22px;bottom:22px;}}
@media(max-width:767px){${mobilePadding}.hotspot-desktop{display:none;}.hotspot-mobile{display:block;}.form-section{padding:40px 16px 34px;}.lead-form{padding:20px;border-radius:18px;}.form-grid{grid-template-columns:1fr;}.form-grid input{min-height:52px;}.lead-form button{min-height:56px;}.wa-sticky{left:14px;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));padding:0 16px;font-size:.95rem;text-transform:uppercase;}.wa-fallback{bottom:calc(84px + env(safe-area-inset-bottom,0px));}}
@media(prefers-reduced-motion:reduce){.wa-sticky{transition:none;}}
`;
}

function buildScriptJs(brief: BriefData): string {
  const strings = languageMeta(brief.language).strings;
  const digits = normalizeWhatsAppNumber(brief.whatsappNumber).digits;

  return `(function(){
"use strict";
var NUMBER=${JSON.stringify(digits)};
var BASE=${JSON.stringify(brief.baseMessage)};
var SOURCE_LABEL=${JSON.stringify(strings.sourceLabel)};
var REF_LABEL=${JSON.stringify(strings.refLabel)};

function clean(value){return String(value||"").replace(/[^\\w .\\-\\/]/g,"").slice(0,60);}

function readRef(){
  var code=Math.random().toString(36).slice(2,6).toUpperCase();
  try{
    var stored=sessionStorage.getItem("wa-ref");
    if(stored) return stored;
    sessionStorage.setItem("wa-ref",code);
  }catch(error){}
  return code;
}

function readSource(){
  var parts=[];
  try{
    var params=new URLSearchParams(location.search);
    ["utm_source","utm_campaign","utm_medium","source"].forEach(function(key){
      var value=params.get(key);
      if(value) parts.push(clean(value));
    });
    if(!parts.length&&params.get("fbclid")) parts.push("facebook");
    if(!parts.length&&params.get("ttclid")) parts.push("tiktok");
    if(!parts.length&&document.referrer){
      var host=new URL(document.referrer).hostname.replace(/^www\\./,"");
      if(host&&host!==location.hostname) parts.push(host);
    }
  }catch(error){}
  return parts.join(" / ");
}

var REF=readRef();
var SOURCE=readSource();

function compose(custom,extraLines){
  var lines=[custom||BASE];
  if(extraLines&&extraLines.length){lines.push("");lines=lines.concat(extraLines);}
  lines.push("");
  if(SOURCE) lines.push(SOURCE_LABEL+" : "+SOURCE);
  lines.push(REF_LABEL+" : "+REF);
  return lines.join("\\n");
}

function waUrl(message){return "https://wa.me/"+NUMBER+"?text="+encodeURIComponent(message);}

function track(label){
  var detail={label:label||"WhatsApp",ref:REF,source:SOURCE};
  try{window.dispatchEvent(new CustomEvent("whatsapp:click",{detail:detail}));}catch(error){}
  if(window.dataLayer&&typeof window.dataLayer.push==="function"){
    window.dataLayer.push({event:"whatsapp_click",wa_label:detail.label,wa_ref:REF,wa_source:SOURCE});
  }
  if(typeof window.onWhatsAppClick==="function"){try{window.onWhatsAppClick(detail);}catch(error){}}
}

var fallback=document.getElementById("waFallback");
var fallbackTimer=null;

function armFallback(){
  if(!fallback) return;
  clearTimeout(fallbackTimer);
  fallbackTimer=setTimeout(function(){
    if(document.visibilityState==="visible") fallback.hidden=false;
  },1800);
}

["visibilitychange","pagehide","blur"].forEach(function(name){
  window.addEventListener(name,function(){clearTimeout(fallbackTimer);},{passive:true});
});

if(fallback){
  var closeButton=fallback.querySelector("[data-wa-close]");
  if(closeButton) closeButton.addEventListener("click",function(){fallback.hidden=true;});
  var copyButton=fallback.querySelector("[data-wa-copy]");
  var numberNode=fallback.querySelector("[data-wa-number]");
  if(copyButton&&numberNode){
    copyButton.addEventListener("click",function(){
      var value=numberNode.getAttribute("data-wa-number")||numberNode.textContent;
      var original=copyButton.textContent;
      var confirmCopy=function(){
        copyButton.textContent=copyButton.getAttribute("data-copied-label")||original;
        setTimeout(function(){copyButton.textContent=original;},1800);
      };
      var legacyCopy=function(){
        var input=document.createElement("input");
        input.value=value;
        document.body.appendChild(input);
        input.select();
        try{document.execCommand("copy");confirmCopy();}catch(error){}
        input.remove();
      };
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(value).then(confirmCopy,legacyCopy);
      }else{
        legacyCopy();
      }
    });
  }
}

var waLinks=[].slice.call(document.querySelectorAll("[data-wa]"));

function refreshLinks(){
  waLinks.forEach(function(link){
    link.href=waUrl(compose(link.getAttribute("data-wa-message")));
  });
}

refreshLinks();

waLinks.forEach(function(link){
  link.addEventListener("click",function(){
    link.href=waUrl(compose(link.getAttribute("data-wa-message")));
    track(link.getAttribute("data-wa-label"));
    armFallback();
  });
});

var sticky=document.querySelector(".wa-sticky");
if(sticky){
  var hotspotNodes=[].slice.call(document.querySelectorAll(".hotspot"));
  var ticking=false;
  var updateSticky=function(){
    ticking=false;
    var scrolled=window.scrollY>Math.min(320,window.innerHeight*0.5);
    // On ne masque le bouton fixe que s'il recouvrirait un CTA de l'image.
    var bandTop=window.innerHeight-170;
    var conflict=hotspotNodes.some(function(node){
      if(!node.offsetParent) return false;
      var rect=node.getBoundingClientRect();
      return rect.bottom>bandTop&&rect.top<window.innerHeight;
    });
    sticky.classList.toggle("is-visible",scrolled&&!conflict);
  };
  var onScroll=function(){
    if(ticking) return;
    ticking=true;
    window.requestAnimationFrame(updateSticky);
  };
  window.addEventListener("scroll",onScroll,{passive:true});
  window.addEventListener("resize",onScroll,{passive:true});
  updateSticky();
}

[].slice.call(document.querySelectorAll(".js-whatsapp-form")).forEach(function(form){
  form.addEventListener("input",function(){
    [].slice.call(form.elements).forEach(function(field){
      if(field.tagName==="INPUT") field.classList.toggle("is-invalid",!field.validity.valid);
    });
  });
  form.addEventListener("submit",function(event){
    event.preventDefault();
    if(!form.checkValidity()){form.reportValidity();return;}
    var lines=[];
    [].slice.call(form.elements).forEach(function(field){
      if(field.tagName!=="INPUT"||!field.name) return;
      var label=form.querySelector('label[for="'+field.id+'"]');
      var text=label&&label.childNodes[0]?String(label.childNodes[0].textContent).trim():field.name;
      lines.push(text+" : "+String(field.value).trim());
    });
    var url=waUrl(compose("",lines));
    track("Formulaire");
    armFallback();
    var opened=window.open(url,"_blank","noopener");
    if(!opened) window.location.href=url;
  });
});
})();
`;
}

const CLOSING_SCRIPT = "</" + "script>";
const ESCAPED_CLOSING_SCRIPT = "<" + String.fromCharCode(92) + "/script>";

/**
 * Assemble une page unique : CSS et JS integres, images en data URI si
 * fournies. Sert la previsualisation (aucun fichier a ecrire sur le disque)
 * et l'export "un seul fichier".
 */
export function buildStandaloneHtml(
  files: LandingFiles,
  assets: Partial<Record<Device, string>> = {}
): string {
  let html = files.indexHtml;

  html = html.replace(
    '<link rel="stylesheet" href="style.css">',
    `<style>\n${files.styleCss}\n</style>`
  );

  const inlineScript = files.scriptJs.split(CLOSING_SCRIPT).join(ESCAPED_CLOSING_SCRIPT);
  html = html.replace(
    '<script src="script.js" defer></' + "script>",
    `<script>\n${inlineScript}\n</` + "script>"
  );

  (["desktop", "mobile"] as Device[]).forEach((device) => {
    const dataUrl = assets[device];
    if (!dataUrl) return;
    html = html.split(`assets/landing-${device}.webp`).join(dataUrl);
  });

  if (assets.desktop || assets.mobile) {
    // Precharger une data URI n'a aucun sens : la ressource est deja dans le HTML.
    html = html.replace(/\n\s*<link rel="preload"[^>]*>/g, "");
  }

  return html;
}
