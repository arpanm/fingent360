import { z } from 'zod';
import { MacroIndicatorSchema } from './macro.js';
export const AlertPreferenceUpdateSchema = z.strictObject({
  indicator: MacroIndicatorSchema,
  muted: z.boolean(),
});
export const AlertPreferencesSchema = z.strictObject({
  preferences: z.array(
    z.strictObject({
      indicator: MacroIndicatorSchema,
      muted: z.boolean(),
      updatedAt: z.iso.datetime().nullable(),
    }),
  ),
});
export type AlertPreferences = z.infer<typeof AlertPreferencesSchema>;
