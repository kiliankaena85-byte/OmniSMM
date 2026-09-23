---
name: design-for-trust
description: "Privacy + Security UX: transparent data handling, trust signals, GDPR/CCPA compliance UX, security indicators. Активировать при проектировании форм сбора данных, privacy flows, при compliance. ALWAYS activate for privacy UX, trust signals, data collection forms, GDPR/CCPA compliance, security indicators. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Design for Trust — Privacy + Security = конверсионный фактор

## When to activate

- Проектируются формы сбора персональных данных
- Нужен privacy flow (cookie consent, data deletion)
- GDPR/CCPA compliance requirements
- Нужны trust signals рядом с конверсионными точками
- Пользователь спрашивает про privacy, trust, data security

## Trust Architecture

### Уровень 1: Visual Trust
- Professional design = trustworthy (94% first impressions = design)
- Real photos > stock photos
- Specific numbers > vague claims
- Client logos with permission

### Уровень 2: Security Trust
- SSL certificate (lock icon)
- Security badges near forms
- Two-factor authentication option
- Password strength indicators

### Уровень 3: Privacy Trust
- Clear cookie consent (no dark patterns)
- Transparent data usage explanations
- Easy data export / deletion
- Privacy policy in plain language

### Уровень 4: Process Trust
- Money-back guarantee
- Free trial without credit card
- Clear cancellation process
- Responsive customer support

## GDPR/CCPA UX Checklist

- [ ] Cookie consent: granular choices (not just «Accept all»)
- [ ] Privacy policy: plain language, not legalese
- [ ] Data collection: explain WHY for each field
- [ ] Right to deletion: easy to find and execute
- [ ] Data export: one-click export in standard format
- [ ] Consent withdrawal: as easy as giving consent

## Trust Signals Placement

```text
NEAR FORMS:
- SSL icon + «Ваши данные защищены»
- «Мы не передаём ваши данные третьим лицам»
- Specific: «2,847 компаний доверяют нам» > «Thousands trust us»

NEAR CHECKOUT:
- Security badges (PCI DSS, Verified)
- Money-back guarantee
- Secure payment icons

NEAR SIGNUP:
- «Без кредитной карты»
- «Отмена в любое время»
- Real testimonials с фото и должностью
```

## Step-by-step execution protocol

1. **Audit trust signals**: Проверить наличие trust signals на всех конверсионных точках
2. **Map data collection**: Определить какие данные собираются и зачем
3. **Design privacy flow**: Спроектировать cookie consent и data management
4. **Add security indicators**: Разместить SSL/security badges рядом с формами
5. **Implement GDPR checklist**: Пройти GDPR/CCPA UX checklist
6. **Write plain-language explanations**: Заменить legalese на понятные объяснения
7. **Test trust perception**: Проверить с реальными пользователями
8. **Monitor**: Настроить метрики доверия (form completion rate, consent rate)

## Scope boundaries

### DOES
- Проектировать trust architecture для конверсионных точек
- Создавать privacy UX flows
- Аудитить GDPR/CCPA compliance на уровне UX
- Размещать trust signals стратегически

### DOES NOT
- Заменять юридический GDPR/CCPA audit
- Создавать privacy policy тексты (только UX для их отображения)
- Настраивать SSL/TLS certificates
- Проводить penetration testing

## Error handling

| Scenario | Response |
|----------|----------|
| Cookie consent снижает конверсию | Предложить gradual engagement: essential only → full later |
| Клиент хочет pre-checked consent | Отказать, объяснить GDPR нарушение, предложить opt-in |
| Нет budget на security badges | Использовать free trust signals: specific numbers, real testimonials |
| Privacy policy слишком длинная | Предложить layered approach: summary → details по клику |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)