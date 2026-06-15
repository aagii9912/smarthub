import { z } from 'zod';

/**
 * Create-body for a story → product link.
 *
 *   • Instagram — `story_media_id` is required (the reply_to.story.id the
 *     webhook will match against).
 *   • Facebook — `active_hours` is required (the pin window; FB has no story
 *     id, so the link applies to DMs received within the window).
 */
export const createStoryLinkSchema = z
    .object({
        product_id: z.string().uuid('product_id буруу байна'),
        platform: z.enum(['facebook', 'instagram']),
        story_media_id: z.string().trim().min(1).max(256).optional(),
        media_url: z.string().url().max(2048).optional(),
        caption: z.string().trim().max(500).optional(),
        // FB pin window length in hours (IG stories live ~24h; allow up to a week).
        active_hours: z.number().int().min(1).max(168).optional(),
    })
    .superRefine((val, ctx) => {
        if (val.platform === 'instagram' && !val.story_media_id) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['story_media_id'],
                message: 'Instagram-д story_media_id шаардлагатай',
            });
        }
        if (val.platform === 'facebook' && !val.active_hours) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['active_hours'],
                message: 'Facebook pin-д active_hours шаардлагатай',
            });
        }
    });

export type CreateStoryLinkInput = z.infer<typeof createStoryLinkSchema>;
