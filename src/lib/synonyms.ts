/**
 * The scheme corpus is English. Rural users ask in Hindi (Devanagari) or Hinglish,
 * so map common words to English search terms before hitting the index.
 * The AI agent translates queries itself; this keeps plain search useful without an LLM.
 */
const SYNONYMS: Record<string, string> = {
  // farming
  किसान: "farmer agriculture", kisan: "farmer agriculture", kisaan: "farmer agriculture",
  खेती: "agriculture farming crop", kheti: "agriculture farming crop", फसल: "crop", fasal: "crop",
  बीमा: "insurance", bima: "insurance", beema: "insurance",
  पशु: "animal livestock", pashu: "animal livestock", गाय: "cow dairy", gaay: "cow dairy", dairy: "dairy",
  मछली: "fish fisheries", machli: "fish fisheries", machhli: "fish fisheries",
  बीज: "seed", beej: "seed", खाद: "fertilizer", khad: "fertilizer", सिंचाई: "irrigation", sinchai: "irrigation",
  ट्रैक्टर: "tractor machinery", tractor: "tractor machinery",
  // money / work
  पेंशन: "pension", pension: "pension", 
  लोन: "loan credit", loan: "loan credit", ऋण: "loan credit", karz: "loan", कर्ज: "loan",
  रोजगार: "employment job", rozgar: "employment job", rojgar: "employment job", नौकरी: "employment job", naukri: "employment job",
  मजदूर: "labourer worker unorganised", mazdoor: "labourer worker unorganised", majdoor: "labourer worker unorganised",
  व्यापार: "business entrepreneur", vyapar: "business entrepreneur", dukan: "shop business", दुकान: "shop business",
  सब्सिडी: "subsidy", subsidy: "subsidy", अनुदान: "grant subsidy", anudan: "grant subsidy",
  कारीगर: "artisan", karigar: "artisan", बुनकर: "weaver handloom", bunkar: "weaver handloom",
  ठेला: "street vendor", thela: "street vendor", rehdi: "street vendor",
  // people
  महिला: "women woman", mahila: "women woman", औरत: "women", aurat: "women", बेटी: "girl child daughter", beti: "girl child daughter",
  लड़की: "girl", ladki: "girl", कन्या: "girl", kanya: "girl", विधवा: "widow", vidhwa: "widow", vidhva: "widow",
  गर्भवती: "pregnant maternity", garbhvati: "pregnant maternity", maa: "mother", माँ: "mother",
  बुजुर्ग: "senior citizen old age", buzurg: "senior citizen old age", bujurg: "senior citizen old age", वृद्ध: "old age",
  vridha: "old age", vriddha: "old age", बच्चे: "child children", bacche: "child children",
  छात्र: "student", chhatra: "student", vidyarthi: "student", विद्यार्थी: "student",
  विकलांग: "disability disabled divyang", viklang: "disability disabled", दिव्यांग: "disability divyang", divyang: "disability divyang",
  अनुसूचित: "scheduled caste tribe", dalit: "scheduled caste", दलित: "scheduled caste", आदिवासी: "tribal scheduled tribe", adivasi: "tribal scheduled tribe",
  पिछड़ा: "backward class obc", pichda: "backward class obc", अल्पसंख्यक: "minority", alpsankhyak: "minority",
  गरीब: "poor bpl below poverty line", garib: "poor bpl", gareeb: "poor bpl",
  // needs
  घर: "house housing", ghar: "house housing", मकान: "house housing", makan: "house housing", awas: "housing", आवास: "housing",
  शौचालय: "toilet sanitation", shauchalay: "toilet sanitation",
  इलाज: "treatment health medical", ilaj: "treatment health medical", ilaaj: "treatment health medical",
  अस्पताल: "hospital health", aspatal: "hospital health", स्वास्थ्य: "health", swasthya: "health", dawai: "medicine", दवाई: "medicine",
  पढ़ाई: "education study", padhai: "education study", शिक्षा: "education", shiksha: "education",
  छात्रवृत्ति: "scholarship", chhatravritti: "scholarship", scholarship: "scholarship", vazifa: "scholarship",
  शादी: "marriage", shadi: "marriage", shaadi: "marriage", विवाह: "marriage", vivah: "marriage",
  गैस: "gas lpg cylinder", gas: "gas lpg", सिलेंडर: "lpg cylinder", cylinder: "lpg cylinder",
  बिजली: "electricity power", bijli: "electricity power", पानी: "water", pani: "water",
  राशन: "ration food", ration: "ration food", खाना: "food nutrition", khana: "food nutrition",
  ट्रेनिंग: "training skill", training: "training skill", कौशल: "skill", kaushal: "skill",
  मृत्यु: "death", mrityu: "death", दुर्घटना: "accident", durghatna: "accident",
  // common scheme short names
  "ayushman": "ayushman jan arogya health insurance", आयुष्मान: "ayushman jan arogya health insurance",
  ujjwala: "ujjwala lpg", उज्ज्वला: "ujjwala lpg", मनरेगा: "mgnrega rural employment", manrega: "mgnrega rural employment",
  narega: "mgnrega rural employment", nrega: "mgnrega rural employment",
  sukanya: "sukanya samriddhi girl", सुकन्या: "sukanya samriddhi girl", mudra: "mudra loan", मुद्रा: "mudra loan",
};

// Filler words that only add noise to keyword search.
const STOP = new Set(
  "का की के को से में है हैं कैसे क्या कब कौन मुझे मेरे मेरी हम मैं और या भी लिए ke ki ka ko se me mein hai hain kaise kya kab kaun mujhe mere meri hum main aur ya bhi liye milega milegi milta chahiye karna kare yojana yojna scheme sarkari sarkar paisa paise पैसा पैसे मिलेगा मिलेगी".split(
    " ",
  ),
);

const VOWELS: Record<string, string> = {
  अ: "a", आ: "aa", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au",
};
const MATRAS: Record<string, string> = {
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};
const CONSONANTS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n", ट: "t", ठ: "th", ड: "d",
  ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n", प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y",
  र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h", क़: "q", ख़: "kh", ग़: "g", ज़: "z", ड़: "r", ढ़: "rh", फ़: "f",
};

/** Rough Hindi → Roman transliteration so scheme names ("सम्मान निधि" → "samman nidhi") can match. */
export function transliterate(word: string) {
  const chars = [...word.normalize("NFC")];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const next = chars[i + 1];
    if (CONSONANTS[c]) {
      out += CONSONANTS[c];
      // Inherent "a" unless followed by a matra or virama, and dropped at the end of a word (schwa deletion).
      if (next && !MATRAS[next] && next !== "्" && next !== "़" && i + 1 < chars.length) out += "a";
    } else if (MATRAS[c]) out += MATRAS[c];
    else if (VOWELS[c]) out += VOWELS[c];
    else if (c === "ं" || c === "ँ") out += "n";
    else if (c === "ः") out += "h";
  }
  return out;
}

export function expandQuery(query: string) {
  const words = query.toLowerCase().split(/[\s,.?!।]+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (SYNONYMS[w]) out.push(/[a-z]/.test(w) ? `${w} ${SYNONYMS[w]}` : SYNONYMS[w]);
    else if (STOP.has(w)) continue;
    else if (/[ऀ-ॿ]/.test(w)) {
      const roman = transliterate(w);
      if (roman.length > 2) out.push(roman);
    } else out.push(w);
  }
  return out.join(" ");
}
