import { z } from "zod";
import { validateProhibitedContent } from "./prohibited-content";

export const orderFormSchema = z.object({
  link: z.string()
    .min(3, "Ссылка слишком короткая")
    .refine(val => !val.includes(' '), "Ссылка не должна содержать пробелов")
    .refine(val => val.includes('.') || val.includes('t.me/'), "Ссылка должна быть корректным URL или username"),
  quantity: z.number()
    .min(10, "Минимум 10 штук")
    .max(1000000, "Максимум 1,000,000 штук за один заказ"),
  email: z.string()
    .email("Введите корректный Email для получения чека"),
  serviceId: z.string().min(1, "Пожалуйста, выберите услугу"),
  customData: z.string().max(5000, "Слишком много текста (макс. 5000 символов)").optional()
}).refine(data => {
  const check = validateProhibitedContent(data.link, data.customData);
  return check.isAllowed;
}, {
  message: "Продвижение государственных служб, органов власти, политической агитации и выборов строго запрещено правилами сервиса (п. 2.1 Регламента)",
  path: ["link"]
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type OrderFormData = z.infer<typeof orderFormSchema>;
