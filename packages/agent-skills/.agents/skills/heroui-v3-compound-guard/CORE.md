# heroui-v3-compound-guard (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Strict Dot-Notation API:** Запрещены устаревшие плоские компоненты HeroUI v2 (`<TableHeader>`, `<TableColumn>`, `<TableRow>`, `<TableCell>`, `<ModalContent>`). Разрешены строго Compound-компоненты: `<Table.Header>`, `<Table.Column>`, `<Table.Row>`, `<Table.Cell>`, `<Modal.Content>`.
2. **Controlled Set Selection:** `selectedKeys` обязан обрабатываться как `new Set([...])` с безопасным извлечением `Array.from(keys)[0]`.
3. **Double-Submit Protection:** Кнопки при отправке (`isLoading={true}`) обязаны получать `isDisabled={true}` и блокировать повторные клики.
4. **Empty State Requirement:** Каждая таблица HeroUI обязана иметь явный проп `emptyContent={<EmptyState />}`.
5. **No Hydration State Mismatch in Inputs:** HeroUI компоненты ввода не должны инициализироваться с `undefined` значением в контролируемом режиме.

## ⚡ FAST RULES & FORMULAS
- HeroUI Table: `<Table.Header><Table.Column>ID</Table.Column></Table.Header>` с обязательным `emptyContent`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Использован ли синтаксис через точку (`<Table.Header>`)?
- [ ] Есть ли `emptyContent` в таблице?
- [ ] Блокируется ли кнопка при загрузке?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*\n