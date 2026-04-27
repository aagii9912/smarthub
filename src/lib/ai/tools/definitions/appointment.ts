import { z } from 'zod';
import { ToolDefinition } from './core';

export const BookAppointmentSchema = z.object({
    product_name: z.string(),
    scheduled_at: z.string().describe('ISO 8601 timestamp, e.g. "2026-04-30T14:00:00+08:00"'),
    notes: z.string().optional()
});
export type BookAppointmentArgs = z.infer<typeof BookAppointmentSchema>;

export const ListAppointmentsSchema = z.object({});
export type ListAppointmentsArgs = z.infer<typeof ListAppointmentsSchema>;

export const CancelAppointmentSchema = z.object({
    appointment_id: z.string().optional().describe('UUID of the appointment to cancel. If omitted, cancels the customer\'s most recent upcoming appointment.')
});
export type CancelAppointmentArgs = z.infer<typeof CancelAppointmentSchema>;

export const APPOINTMENT_TOOLS: ToolDefinition[] = [
    {
        name: 'book_appointment',
        description: 'Book a time slot for an appointment-type product (e.g. haircut, consultation, salon visit). Use this when the customer asks to schedule, reserve a time, book an appointment, or "цаг авах". The scheduled_at must be a future ISO 8601 timestamp inside the product\'s available days and working hours. Reject past times.',
        parameters: {
            type: 'object',
            properties: {
                product_name: { type: 'string', description: 'Name of the appointment service (fuzzy match against products of type=appointment)' },
                scheduled_at: { type: 'string', description: 'ISO 8601 timestamp of the requested slot, including timezone offset (e.g. "2026-05-02T10:00:00+08:00")' },
                notes: { type: 'string', description: 'Customer notes for the appointment (optional)' }
            },
            required: ['product_name', 'scheduled_at']
        }
    },
    {
        name: 'list_appointments',
        description: 'List the customer\'s upcoming appointments at this shop. Use when they ask "what appointments do I have", "миний цаг", etc.',
        parameters: { type: 'object', properties: {}, required: [] }
    },
    {
        name: 'cancel_appointment',
        description: 'Cancel an appointment. If appointment_id is not given, cancels the customer\'s most recent upcoming appointment. Use when customer says "цуцал", "cancel my appointment", etc.',
        parameters: {
            type: 'object',
            properties: {
                appointment_id: { type: 'string', description: 'UUID of the appointment to cancel (optional)' }
            },
            required: []
        }
    }
];
