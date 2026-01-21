import { TEMPLATES } from "../constants/ai-setup";

/**
 * Generates a simulated AI welcome message based on the selected template and emotion.
 * @param templateKey - The key of the selected template (e.g., 'restaurant')
 * @param emotionKey - The key of the selected emotion (e.g., 'professional')
 * @returns A string containing the simulated greeting message.
 */
export function getAIWelcomeMessage(templateKey: string, emotionKey: string): string {
    const templ = TEMPLATES[templateKey as keyof typeof TEMPLATES];
    if (!templ) return '';

    let msg = templ.greeting;

    switch (emotionKey) {
        case 'professional':
            // Remove emojis and make it formal
            msg = msg.replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
                .replace('Сайн байна уу!', 'Сайн байна уу, эрхэм хэрэглэгч ээ.')
                .trim();
            if (!msg.endsWith('.')) msg += '.';
            break;

        case 'enthusiastic':
            // Add excitement
            msg = msg.replace('Сайн байна уу!', 'Сайн байна уу! 🔥')
                .replace('?', '? 🤩');
            if (!msg.includes('!!!')) msg += ' !!!';
            break;

        case 'calm':
            // Softer tone
            msg = msg.replace('!', '.')
                .replace('😊', '🌿')
                .replace('🔥', '');
            break;

        case 'playful':
            // Fun tone
            msg = msg.replace('Сайн байна уу!', 'Хөөх, Сайн уу! 👋')
                .replace('?', '? 🎲');
            break;

        case 'friendly':
        default:
            // Default template greeting is already friendly
            break;
    }

    return msg;
}
