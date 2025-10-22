import { z } from "zod";

export const IncomeSchema = z.object({
  state: z.string(),
  year: z.number(),
  has_income_tax: z.boolean(),
  standard_deduction: z.number().nullable(),
  flat: z.number().nullable(),
  brackets: z
    .array(z.object({ up_to: z.number().nullable(), rate: z.number() }))
    .nullable(),
});
/* Define Sales/Property/Fuel/Excise/Federal/Context schemas similarly as needed. */
