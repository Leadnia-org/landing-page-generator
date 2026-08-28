export const DEFAULT_COUNTRY_CODE = "212";

export interface NumberCheck {
  /** Numéro nettoyé, prêt pour wa.me (chiffres uniquement, indicatif inclus). */
  digits: string;
  valid: boolean;
  /** Explication courte quand le numéro n'est pas exploitable. */
  problem: string;
  /** Vrai quand la saisie a été corrigée (0612… -> 212612…). */
  corrected: boolean;
}

/**
 * wa.me n'accepte que des chiffres avec indicatif pays : ni "+", ni espaces,
 * ni "00", ni le 0 initial marocain. Un numéro brut casse tous les CTA sans
 * message d'erreur visible, d'où le nettoyage systématique avant export.
 */
export function normalizeWhatsAppNumber(raw: string, countryCode = DEFAULT_COUNTRY_CODE): NumberCheck {
  const input = String(raw || "").trim();

  if (!input) {
    return { digits: "", valid: false, problem: "Numéro WhatsApp vide.", corrected: false };
  }

  if (/x/i.test(input)) {
    return { digits: "", valid: false, problem: "Le numéro contient encore des X de placeholder.", corrected: false };
  }

  let digits = input.replace(/\D/g, "");

  if (!digits) {
    return { digits: "", valid: false, problem: "Le numéro ne contient aucun chiffre.", corrected: false };
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = countryCode + digits.slice(1);
  } else if (digits.length <= 9 && !digits.startsWith(countryCode)) {
    digits = countryCode + digits;
  }

  const corrected = digits !== input.replace(/\D/g, "");

  if (digits.length < 10) {
    return { digits, valid: false, problem: "Numéro trop court pour un numéro international.", corrected };
  }

  if (digits.length > 15) {
    return { digits, valid: false, problem: "Numéro trop long (15 chiffres maximum).", corrected };
  }

  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && !/^212[5-7]\d{8}$/.test(digits)) {
    return {
      digits,
      valid: false,
      problem: "Numéro marocain attendu au format 212 puis 9 chiffres commençant par 5, 6 ou 7.",
      corrected,
    };
  }

  return { digits, valid: true, problem: "", corrected };
}

export function whatsappLink(rawNumber: string, message: string): string {
  const { digits } = normalizeWhatsAppNumber(rawNumber);
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Affichage lisible : 212 6 12 34 56 78. */
export function formatNumberForDisplay(rawNumber: string): string {
  const { digits, valid } = normalizeWhatsAppNumber(rawNumber);
  if (!valid) return digits || "—";
  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    const rest = digits.slice(3);
    return `+${DEFAULT_COUNTRY_CODE} ${rest.slice(0, 1)} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`.trim();
  }
  return `+${digits}`;
}
