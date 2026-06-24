import { z } from 'zod';

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export const PAYMENT_STATUSES = ['paid', 'unpaid', 'partial'] as const;

export const updateAppointmentSchema = z.object({
    status: z.enum(APPOINTMENT_STATUSES).optional(),
    payment_status: z.enum(PAYMENT_STATUSES).optional(),
    price: z.number().min(0).max(999999999).nullable().optional(),
    staff_id: z.string().uuid().nullable().optional(),
    scheduled_at: z.string().datetime().optional(),
    notes: z.string().max(2000).nullable().optional(),
});

export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
