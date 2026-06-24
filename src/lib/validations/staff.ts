import { z } from 'zod';

/** A single weekday's open/close window (or marked closed). */
export const dayHoursSchema = z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    close: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    closed: z.boolean().optional(),
});

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Per-staff weekly schedule: { mon: {open,close,closed?}, … }. */
export const workingHoursSchema = z
    .object({
        mon: dayHoursSchema.optional(),
        tue: dayHoursSchema.optional(),
        wed: dayHoursSchema.optional(),
        thu: dayHoursSchema.optional(),
        fri: dayHoursSchema.optional(),
        sat: dayHoursSchema.optional(),
        sun: dayHoursSchema.optional(),
    })
    .nullable();

export const createStaffSchema = z.object({
    name: z.string().min(1, 'Нэр шаардлагатай').max(100),
    specialty: z.string().max(100).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Өнгө #RRGGBB форматтай байх ёстой')
        .optional(),
    is_active: z.boolean().optional(),
    working_hours: workingHoursSchema.optional(),
    sort_order: z.number().int().min(0).max(9999).optional(),
});

export const updateStaffSchema = createStaffSchema.partial();

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type WorkingHours = z.infer<typeof workingHoursSchema>;
