/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Created by Artem (http://artmspektr.ru)
 * Unauthorized copying of this file is strictly prohibited.
 */

/**
 * Utility to clean up "garbage" from provider descriptions.
 * Handles HTML tags, encoding errors (Ã, Â), and redundant marketing.
 */
export class DescriptionSanitizer {
    /**
     * Cleans a description string.
     */
    static sanitize(text: string): string {
        if (!text) return '';

        let clean = text;

        // 1. Fix common UTF-8 encoding errors seen in SMM providers ( SocRocket, etc.)
        // These are often caused by double encoding or wrong charset interpretation.
        const encodingFixes: Record<string, string> = {
            'Ã ': ' ',
            'ÃÂ': ' ',
            'Ã–': 'Ö',
            'Ã ': 'à',
            'Ã¡': 'á',
            'Ã¢': 'â',
            'Ã£': 'ã',
            'Ã¤': 'ä',
            'Ã¥': 'å',
            'Ã¦': 'æ',
            'Ã§': 'ç',
            'Ã¨': 'è',
            'Ã©': 'é',
            'Ãª': 'ê',
            'Ã«': 'ë',
            'Ã¬': 'ì',
            'Ã­': 'í',
            'Ã®': 'î',
            'Ã¯': 'ï',
            'Ã°': 'ð',
            'Ã±': 'ñ',
            'Ã²': 'ò',
            'Ã³': 'ó',
            'Ã´': 'ô',
            'Ãµ': 'õ',
            'Ã¶': 'ö',
            'Ã¸': 'ø',
            'Ã¹': 'ù',
            'Ãº': 'ú',
            'Ã»': 'û',
            'Ã¼': 'ü',
            'Ã½': 'ý',
            'Ã¾': 'þ',
            'Ã¿': 'ÿ',
            'Â': '',
            'âœ…': '✅',
            'â­': '⭐',
            'âžб': '➡',
            'â': '⚡',
            'ð': '', // Garbage prefix for some emojis
        };

        for (const [key, value] of Object.entries(encodingFixes)) {
            clean = clean.split(key).join(value);
        }

        // 2. Strip HTML tags but try to preserve line breaks
        clean = clean.replace(/<br\s*\/?>/gi, '\n');
        clean = clean.replace(/&lt;br\s*\/?&gt;/gi, '\n');
        clean = clean.replace(/<\/p>/gi, '\n');
        clean = clean.replace(/<[^>]*>/g, '');

        // 3. Remove common provider marketing links and "trash"
        const marketingPatterns = [
            /https?:\/\/\S*socrocket\S*/gi,
            /socrocket\.ru/gi,
            /socrocket\.pro/gi,
            /soc-rocket/gi,
            /Заказывайте на нашем сайте/gi,
            /Best SMM Panel/gi,
            /Cheapest services/gi,
            /⚡️/g,
            /⭐/g,
            /✅/g,
            /[.]{5,}/g, // Remove long dots separator
            /[-]{5,}/g, // Remove long dashes separator
            /[_]{5,}/g, // Remove long underscores separator
        ];

        for (const pattern of marketingPatterns) {
            clean = clean.replace(pattern, '');
        }

        // 4. Normalize whitespace
        clean = clean.replace(/\n\s*\n/g, '\n\n'); // Max 2 newlines
        clean = clean.trim();

        return clean;
    }
}


