import "server-only";

export type ParsedListing = {
  title: string;
  transactionType: string;
  propertyType: string;
  bhk: string;
  city: string;
  locality: string;
  landmark: string;
  carpetArea: string;
  builtUpArea: string;
  furnishing: string;
  floor: string;
  amenities: string[];
  price: string;
  rent: string;
  deposit: string;
  availability: string;
  tenantPreference: string;
  contactNumbers: string[];
  description: string;
  sourceText: string;
};

const EMPTY: ParsedListing = {
  title: "", transactionType: "", propertyType: "", bhk: "", city: "", locality: "", landmark: "", carpetArea: "", builtUpArea: "", furnishing: "NOT_SPECIFIED", floor: "", amenities: [], price: "", rent: "", deposit: "", availability: "", tenantPreference: "", contactNumbers: [], description: "", sourceText: ""
};
const knownLocalities = ["Mira Road", "Bhayandar", "Naya Nagar", "Shivar Garden", "Kanakia", "Dahisar", "Borivali", "Kandivali", "Malad", "Goregaon", "Andheri", "Vasai", "Virar", "Naigaon"];
const cityNames = ["Mira Bhayandar", "Mumbai", "Thane", "Vasai-Virar", "Navi Mumbai", "Pune", "Mira Road", "Bhayandar", "Vasai", "Virar"];

function clean(value: unknown, max = 180): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function amountText(value: string): string {
  const m = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(cr|crore|k|thousand|l|lac|lakh)?/i);
  if (!m) return "";
  let n = Number(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (["k", "thousand"].includes(unit)) n *= 1000;
  if (["l", "lac", "lakh"].includes(unit)) n *= 100000;
  if (["cr", "crore"].includes(unit)) n *= 10000000;
  return Number.isFinite(n) ? String(Math.round(n)) : "";
}
function textMatch(text: string, regex: RegExp) { const m = text.match(regex); return m ? clean(m[1] || m[0], 90) : ""; }
function parseSegment(segment: string): ParsedListing {
  const lower = segment.toLowerCase();
  const out: ParsedListing = { ...EMPTY, sourceText: segment.trim() };

  const bhk = lower.match(/\b(\d+(?:\.\d+)?\s*(?:bhk\+?|bed(?:room)?s?|rk))\b/i) || lower.match(/\b(studio|penthouse|duplex|bungalow|villa|row\s*house)\b/i);
  if (bhk) out.bhk = bhk[1].replace(/\s+/g, "").toUpperCase();

  const typeRules: [RegExp, string][] = [
    [/\b1\s*rk\b|\b1rk\b/, "1RK"], [/\b(?:studio|स्टूडियो)\b/, "Studio"], [/\b(?:penthouse|पेंटहाउस)\b/, "Penthouse"], [/\b(?:duplex|डुप्लेक्स)\b/, "Duplex"], [/\b(?:bungalow|बंगला)\b/, "Bungalow"], [/\b(?:villa|विला)\b/, "Villa"], [/\b(?:row\s*house|rowhouse)\b/, "Row House"], [/\b(?:shop|दुकान|शॉप)\b/, "Shop"], [/\b(?:showroom|शोरूम)\b/, "Showroom"], [/\b(?:warehouse|गोदाम|godown)\b/, "Warehouse"], [/\b(?:industrial\s*unit|factory)\b/, "Industrial Unit"], [/\b(?:office|ऑफिस)\b/, "Office"], [/\b(?:commercial\s*building)\b/, "Commercial Building"], [/\b(?:plot|land|प्लॉट|जमीन)\b/, "Plot"], [/\b(?:hostel|हॉस्टल)\b/, "Hostel"], [/\b(?:co.?living)\b/, "Co-living"], [/\b(?:pg|paying\s*guest)\b/, "PG"], [/\b(?:flat|apartment|अपार्टमेंट|फ्लैट)\b/, "Apartment"]
  ];
  for (const [pattern, type] of typeRules) if (pattern.test(lower)) { out.propertyType = type; break; }
  if (!out.propertyType && out.bhk) out.propertyType = out.bhk === "STUDIO" ? "Studio" : out.bhk;

  if (/\b(?:heavy\s*deposit|heavy\s*dep(?:o|i)sit|hd\s*flat)\b|भारी\s*डिपॉजिट/.test(lower)) out.transactionType = "HEAVY_DEPOSIT";
  else if (/\b(?:resale|re\s*sale|resell)\b|रीसेल/.test(lower)) out.transactionType = "RESALE";
  else if (/\b(?:lease|leased|लीज)\b/.test(lower)) out.transactionType = "LEASE";
  else if (/\b(?:sale|sell|for\s+sale|विक्री|बिक्री)\b/.test(lower)) out.transactionType = "SALE";
  else if (/\b(?:rent|rental|to\s+let|भाड़ा|किराया|भाडे|भाडं)\b/.test(lower)) out.transactionType = "RENT";
  if (out.propertyType && ["Shop", "Office", "Showroom", "Warehouse", "Industrial Unit", "Commercial Building"].includes(out.propertyType)) {
    if (["RENT", "HEAVY_DEPOSIT", "LEASE"].includes(out.transactionType)) out.transactionType = "COMMERCIAL_RENT";
    if (["SALE", "RESALE"].includes(out.transactionType)) out.transactionType = "COMMERCIAL_SALE";
  }

  const locality = knownLocalities.find((name) => lower.includes(name.toLowerCase()));
  if (locality) { out.locality = locality; out.city = ["Mira Road", "Bhayandar", "Naya Nagar", "Shivar Garden", "Kanakia"].includes(locality) ? "Mira Bhayandar" : ["Dahisar", "Borivali", "Kandivali", "Malad", "Goregaon", "Andheri"].includes(locality) ? "Mumbai" : "Vasai-Virar"; }
  const city = cityNames.find((name) => lower.includes(name.toLowerCase()));
  if (city && !out.city) out.city = city;
  out.landmark = textMatch(segment, /(?:near|opp\.?|opposite|behind|landmark|close to|नजदीक|पास में|समोर)\s+([^,\n;]+)/i);

  const carpet = segment.match(/(?:carpet|carpet\s*area|कारपेट)\s*[:\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|sq\s*ft|square\s*feet)?/i);
  const built = segment.match(/(?:built[\s-]*up|builtup|built\s*area)\s*[:\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|sq\s*ft|square\s*feet)?/i);
  if (carpet) out.carpetArea = carpet[1].replace(/,/g, "") + (carpet[2] ? " sq ft" : "");
  if (built) out.builtUpArea = built[1].replace(/,/g, "") + (built[2] ? " sq ft" : "");
  if (!out.carpetArea && !out.builtUpArea) { const area=segment.match(/(\d[\d,]*(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|sq\s*ft|square\s*feet)/i); if(area) out.carpetArea=area[1].replace(/,/g, "")+" sq ft"; }

  if (/\bfully\s*furnished|\bfurnished\b|सुसज्जित/.test(lower)) out.furnishing = "FURNISHED";
  else if (/\bsemi[\s-]*furnished\b/.test(lower)) out.furnishing = "SEMI_FURNISHED";
  else if (/\bunfurnished\b|बिना\s*फर्नीचर/.test(lower)) out.furnishing = "UNFURNISHED";
  const floor = textMatch(segment, /\b(ground|\d+(?:st|nd|rd|th)?)(?:\s*(?:floor|flr))\b/i);
  if (floor) out.floor = floor.replace(/\s+/g, " ");
  const amenityTerms: [RegExp, string][] = [[/parking/,"Parking"],[/lift|elevator/,"Lift"],[/gym|fitness/,"Gym"],[/swimming\s*pool|pool/,"Swimming pool"],[/balcony/,"Balcony"],[/security|cctv/,"Security"],[/garden|park/,"Garden"],[/club\s*house/,"Clubhouse"],[/power\s*backup/,"Power backup"],[/children.?s?\s*play/,"Children's play area"]];
  out.amenities=amenityTerms.filter(([regex])=>regex.test(lower)).map(([,name])=>name);

  const rent = textMatch(segment, /(?:rent|भाड़ा|किराया|भाडे)\s*[:\-]?\s*(?:₹|rs\.?\s*)?([\d,.]+\s*(?:k|thousand|lac|lakh|l|cr|crore)?)/i);
  const deposit = textMatch(segment, /(?:deposit|डिपॉजिट)\s*[:\-]?\s*(?:₹|rs\.?\s*)?([\d,.]+\s*(?:k|thousand|lac|lakh|l|cr|crore)?)/i);
  const sale = textMatch(segment, /(?:price|sale|asking|budget|विक्री|बिक्री)\s*[:\-]?\s*(?:₹|rs\.?\s*)?([\d,.]+\s*(?:k|thousand|lac|lakh|l|cr|crore)?)/i);
  if (rent) out.rent = amountText(rent);
  if (deposit) out.deposit = amountText(deposit);
  if (sale) out.price = amountText(sale);
  if (out.transactionType === "RENT" || out.transactionType === "COMMERCIAL_RENT" || out.transactionType === "HEAVY_DEPOSIT" || out.transactionType === "LEASE") {
    if (!out.rent) { const shorthand=segment.match(/(?:₹|rs\.?\s*)?(\d[\d,.]*\s*(?:k|thousand|lac|lakh|l|cr|crore))\s*(?:rent|per\s*month|pm|monthly|भाड़ा|किराया)/i); if(shorthand) out.rent=amountText(shorthand[1]); }
    if (!out.deposit) { const shorthand=segment.match(/(?:₹|rs\.?\s*)?(\d[\d,.]*\s*(?:k|thousand|lac|lakh|l|cr|crore))\s*(?:deposit|डिपॉजिट)/i); if(shorthand) out.deposit=amountText(shorthand[1]); }
  } else if (!out.price) { const shorthand=segment.match(/(?:₹|rs\.?\s*)?(\d[\d,.]*\s*(?:k|thousand|lac|lakh|l|cr|crore))/i); if(shorthand) out.price=amountText(shorthand[1]); }

  if (/immediate|ready\s*to\s*move|vacant\s*now|immediately/.test(lower)) out.availability = "Immediate";
  else out.availability = textMatch(segment, /(?:available\s*(?:from|by)?|possession\s*(?:from|by)?|availability)\s*[:\-]?\s*([^,\n;]+)/i);
  if (/family|families|कुटुंब|family\s*only/.test(lower)) out.tenantPreference = "Family";
  else if (/bachelor|bachelors|students|स्टूडेंट/.test(lower)) out.tenantPreference = "Bachelors / students";
  else if (/company|corporate/.test(lower)) out.tenantPreference = "Company / corporate";
  const phones = segment.match(/(?:\+?91[\s-]?)?[6-9]\d{9}\b/g) || [];
  out.contactNumbers = [...new Set(phones.map((p) => p.replace(/[\s-]/g, "")))].slice(0, 10);
  const mainType = out.propertyType || "property";
  const areaTitle = [out.bhk, mainType].filter(Boolean).join(" ");
  out.title = [areaTitle, out.locality || out.city].filter(Boolean).join(" · ").slice(0, 140);
  out.description = "";
  return out;
}

function segmentsFor(text: string): string[] {
  const separators = /\n\s*(?:[-_=*]{3,}|\d+[.)]\s+|(?:property\s*\d+\s*[:\-]?\s*))/i;
  let segments = text.split(separators).map((s) => s.trim()).filter((s) => s.length >= 12);
  if (segments.length <= 1) {
    const starts: number[] = [];
    const marker = /(?:^|[\n|;])\s*(?=(?:\d+\s*(?:bhk|rk)\b|(?:shop|office|warehouse|godown|plot|villa|bungalow|studio)\b))/gim;
    let m: RegExpExecArray | null;
    while ((m = marker.exec(text)) !== null) starts.push(m.index + (m[0].length - m[0].trimStart().length));
    if (starts.length >= 2) segments = starts.map((s, i) => text.slice(s, starts[i + 1] ?? text.length).trim()).filter((s) => s.length >= 12);
  }
  if (segments.length <= 1) {
    const matches = [...text.matchAll(/\b\d+\s*(?:bhk|rk)\b/gi)];
    if (matches.length >= 2) {
      const chunks: string[] = [];
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index ?? 0;
        const end = matches[i + 1]?.index ?? text.length;
        chunks.push(text.slice(start, end).trim());
      }
      segments = chunks.filter((s) => s.length >= 12);
    }
  }
  return (segments.length ? segments : [text]).slice(0, 10);
}

function normalizeAIListing(value: unknown, sourceText: string): ParsedListing {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const out: ParsedListing = { ...EMPTY };
  for (const key of Object.keys(EMPTY) as (keyof ParsedListing)[]) {
    if (key === "amenities" || key === "contactNumbers") continue;
    if (key === "sourceText") continue;
    (out[key] as string) = clean(v[key], key === "description" ? 2000 : 180);
  }
  out.transactionType = ["RENT", "SALE", "RESALE", "HEAVY_DEPOSIT", "LEASE", "COMMERCIAL_RENT", "COMMERCIAL_SALE"].includes(out.transactionType) ? out.transactionType : "";
  out.furnishing = ["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED", "NOT_SPECIFIED"].includes(out.furnishing) ? out.furnishing : "NOT_SPECIFIED";
  out.amenities = Array.isArray(v.amenities) ? v.amenities.map((x) => clean(x, 60)).filter(Boolean).slice(0, 30) : [];
  out.contactNumbers = Array.isArray(v.contactNumbers) ? v.contactNumbers.map((x) => clean(x, 24)).filter((x) => /^[+0-9 ()-]{8,20}$/.test(x)).slice(0, 10) : [];
  out.sourceText = sourceText;
  // Empty values stay empty; the model may not add a fact that the original text did not contain.
  return out;
}

export function ruleBasedConvert(text: string) {
  const listings = segmentsFor(text).map(parseSegment).filter((listing) => listing.sourceText.length > 0);
  return { listings, mode: "RULE_BASED" as const, providerMessage: "Rule-based extraction used. Review every field before saving." };
}

const SYSTEM_PROMPT = `You extract real-estate listing details from broker messages. The source can contain English, Hindi, Hinglish, abbreviations, spelling mistakes and multiple listings. Output ONLY valid JSON with shape {"listings":[{...}]}. Extract facts only when present; use empty strings for missing scalar values and [] for missing arrays. Never infer a price, locality, BHK, amenity, availability, tenant preference, contact, transaction type or any other missing fact. Preserve numbers and distinctions. Map transactionType to one of RENT, SALE, RESALE, HEAVY_DEPOSIT, LEASE, COMMERCIAL_RENT, COMMERCIAL_SALE. Map furnishing to FURNISHED, SEMI_FURNISHED, UNFURNISHED or NOT_SPECIFIED. Use propertyType as a short label; preserve BHK separately. Include title, transactionType, propertyType, bhk, city, locality, landmark, carpetArea, builtUpArea, furnishing, floor, amenities, price, rent, deposit, availability, tenantPreference, contactNumbers, description. Return at most 10 listings. The caller will preserve the original message separately.`;

export async function convertPropertyText(text: string, aiConfig: { provider?: string; model?: string } | null) {
  const provider = aiConfig?.provider || process.env.AI_PROVIDER || "rule-based";
  const key = process.env.AI_API_KEY;
  const model = aiConfig?.model || process.env.AI_MODEL || "";
  const endpoint = process.env.AI_BASE_URL || "https://api.openai.com/v1/chat/completions";
  if (provider !== "openai-compatible" || !key || !model) return ruleBasedConvert(text);
  let url: URL;
  try { url = new URL(endpoint); } catch { return ruleBasedConvert(text); }
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) return ruleBasedConvert(text);
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, temperature: 0, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }] }), cache: "no-store", signal: AbortSignal.timeout(25000) });
    if (!response.ok) return ruleBasedConvert(text);
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content || "";
    const json = content.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return ruleBasedConvert(text);
    const parsed = JSON.parse(json) as { listings?: unknown[] };
    if (!Array.isArray(parsed.listings)) return ruleBasedConvert(text);
    const sources = segmentsFor(text);
    const listings = parsed.listings.slice(0, 10).map((listing, i) => normalizeAIListing(listing, sources[i] || text));
    return { listings, mode: "AI" as const, providerMessage: "AI-assisted extraction used. Review every field and confirm accuracy before saving." };
  } catch {
    return ruleBasedConvert(text);
  }
}
