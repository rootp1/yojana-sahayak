import { z } from "zod";
import { CATEGORIES, GENDERS, MARITAL, OCCUPATIONS } from "./types";

export const profileSchema = z.object({
  age: z.number().int().min(0).max(120).optional().describe("Age in years"),
  gender: z.enum(GENDERS).optional(),
  category: z.enum(CATEGORIES).optional().describe("Social category: GEN, OBC, SC, ST or EWS"),
  state: z.string().optional().describe("State/UT name exactly as in the scheme list, e.g. 'Uttar Pradesh'"),
  area: z.enum(["rural", "urban"]).optional(),
  occupation: z.array(z.enum(OCCUPATIONS)).optional(),
  income: z.number().min(0).optional().describe("Annual family income in rupees"),
  disability: z.number().min(0).max(100).optional().describe("Disability percent, 0 if none"),
  bpl: z.boolean().optional().describe("Has BPL/Antyodaya ration card"),
  maritalStatus: z.enum(MARITAL).optional(),
  minority: z.boolean().optional(),
  incomeTaxPayer: z.boolean().optional(),
  govtEmployee: z.boolean().optional(),
  hasPuccaHouse: z.boolean().optional(),
  pregnant: z.boolean().optional().describe("Pregnant or breastfeeding mother"),
});
