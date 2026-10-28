export type RuleField =
  | "age"
  | "income"
  | "category"
  | "occupation"
  | "gender"
  | "disability"
  | "bpl"
  | "maritalStatus"
  | "minority"
  | "area"
  | "state"
  | "incomeTaxPayer"
  | "govtEmployee"
  | "hasPuccaHouse"
  | "pregnant";

export type Rule = {
  field: RuleField;
  op: "gte" | "lte" | "eq" | "in";
  value: number | boolean | string[];
  source?: string;
};

export type Scheme = {
  slug: string;
  name: string;
  level: "central" | "state";
  state: string | null;
  ministry: string | null;
  tags: string[];
  details: string;
  benefits: string;
  eligibility: string;
  exclusions: string;
  applicationProcess: string;
  documents: string;
  faq: string;
  sources: string[];
  officialUrl: string;
  rules: Rule[];
  reviewed?: boolean;
};

export const CATEGORIES = ["GEN", "OBC", "SC", "ST", "EWS"] as const;
export const GENDERS = ["male", "female", "transgender"] as const;
export const OCCUPATIONS = [
  "farmer",
  "unorganised_worker",
  "construction_worker",
  "student",
  "fisherman",
  "artisan",
  "street_vendor",
  "entrepreneur",
  "ex_serviceman",
  "sports_person",
  "other",
] as const;
export const MARITAL = ["single", "married", "widowed", "divorced"] as const;

export type Profile = Partial<{
  age: number;
  gender: (typeof GENDERS)[number];
  category: (typeof CATEGORIES)[number];
  state: string;
  area: "rural" | "urban";
  occupation: (typeof OCCUPATIONS)[number][];
  income: number; // annual family income in ₹
  disability: number; // percent; 0 = no disability
  bpl: boolean;
  maritalStatus: (typeof MARITAL)[number];
  minority: boolean;
  incomeTaxPayer: boolean;
  govtEmployee: boolean;
  hasPuccaHouse: boolean;
  pregnant: boolean;
}>;

export type MatchStatus = "eligible" | "maybe" | "ineligible";

export type MatchResult = {
  slug: string;
  name: string;
  level: Scheme["level"];
  state: string | null;
  tags: string[];
  summary: string;
  status: MatchStatus;
  /** Number of targeted (non-state) rules the profile satisfied. */
  specificity: number;
  matched: Rule[];
  failed: Rule[];
  unknown: RuleField[];
  reviewed: boolean;
};
