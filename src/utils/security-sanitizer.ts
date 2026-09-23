/**
 * (c) 2026 SMMplan. All rights reserved.
 * CyberAegis OSAD-V2 Guardian Layer
 */

export class SecuritySanitizer {
  /**
   * Sanitizes external inputs to prevent Prompt Injection 
   * or RAG Poisoning attacks when processed by AI or regex parsers.
   */
  static sanitizePromptInjection(input: string | undefined | null): string {
    if (!input) return '';
    
    // List of common prompt injection phrases (Bilingual EN/RU + LLM Delimiters)
    const injectionPatterns = [
      // English injection primitives
      /ignore (all )?(previous )?instructions/i,
      /disregard (all )?(previous )?instructions/i,
      /forget (all )?(previous )?instructions/i,
      /system prompt/i,
      /you are now/i,
      /mark price as/i,
      /set markup to/i,
      /bypass rules/i,
      /drop table/i, // Basic SQLi guard
      /admin role/i,
      
      // Russian injection primitives
      /проигнорируй (все )?(предыдущие )?инструкции/i,
      /забудь (все )?(предыдущие )?инструкции/i,
      /системный промпт/i,
      /ты теперь/i,
      /установи цену/i,
      /установи наценку/i,
      /обойти правила/i,
      /роль администратора/i,

      // LLM boundary tokens & instruction delimiters
      /<\|im_start\|>/i,
      /<\|im_end\|>/i,
      /\[INST\]/i,
      /\[\/INST\]/i,
      /<<SYS>>/i,
      /<<\/SYS>>/i,
      /```/i, // Prevent markdown fence escapes
      /<script[\s>]/i, // Prevent embedded script tags
    ];

    let safeString = input;
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(safeString)) {
         safeString = safeString.replace(pattern, '[REDACTED_INJECTION_ATTEMPT]');
      }
    }

    // Strip out excessively long inputs (often used in buffer overflow or long prompt injections)
    if (safeString.length > 500) {
       safeString = safeString.substring(0, 500) + '...';
    }

    return safeString.trim();
  }
}
