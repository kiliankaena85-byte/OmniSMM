# Handoff Report: Support Ticket & SSE Flow Investigation

## 1. Observation

During our codebase and configuration scan, we examined the routing, server actions, services, and UI components governing the Support Ticket and real-time live chat functionality. The following key observations were recorded:

### A. Client Ticket Routing and Form Selectors
- **Page Routing**: 
  - File: `src/app/dashboard/tickets/page.tsx`
  - When a user visits `/dashboard/tickets`, they are automatically redirected to a specific active ticket room:
    ```typescript
    // Retrieve or create active (non-CLOSED) support live-chat session for the client
    const ticket = await ticketService.getOrCreateTicket(
      session.userId,
      'Чат с поддержкой',
      'WEB'
    );
    // Instantly redirect client to the active chat room
    redirect(`/dashboard/tickets/${ticket.id}`);
    ```
  - This indicates **no intermediate ticket creation forms are visible to logged-in users**; they are immediately placed in their active chat room.
- **Client Chat Interface**:
  - File: `src/app/dashboard/tickets/[id]/page.tsx`
  - It renders a `ChatWindow` component (`src/components/support/ChatWindow.tsx`), which includes the message list and `ChatInput` (`src/components/support/chat/ChatInput.tsx`).
- **Client Input and Submission Selectors**:
  - Textarea: Located in `src/components/support/chat/ChatInput.tsx` (lines 628-636):
    ```tsx
    <textarea
      ref={textareaRef}
      value={text}
      onChange={handleTextChange}
      onKeyDown={handleKeyDown}
      placeholder={isStaff ? "Введите ответ или выберите шаблон (напишите /)..." : "Опишите вашу проблему..."}
      className="..."
      rows={1}
    />
    ```
    *Playwright selector*: `page.getByPlaceholder('Опишите вашу проблему...')`
  - Submit Button: Located in `src/components/support/chat/ChatInput.tsx` (lines 638-645):
    ```tsx
    <button
      type="submit"
      disabled={(!text.trim() && !file) || sending}
      className="..."
      aria-label="Отправить сообщение"
    >
      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
    </button>
    ```
    *Playwright selector*: `page.getByRole('button', { name: 'Отправить сообщение' })` or `button[type="submit"]`

---

### B. Support Operator Workspace and Login Selectors
- **Operator Page URL**: `http://localhost:3000/operator/tickets`
- **Access Enforcement**:
  - File: `src/app/operator/tickets/page.tsx` (line 20) calls `enforceOperatorAccess()` from `src/lib/operator/rbac.ts`.
  - If a user is not authenticated or lacks the staff role (`OWNER`, `ADMIN`, `MANAGER`, or `SUPPORT`), they are redirected to `/login`.
- **Login Selectors**:
  - File: `src/app/(auth)/login/login-form.tsx`
  - Password Tab Button: `page.getByRole('button', { name: 'Войти по паролю' })` (lines 123-133)
  - Email Field: `<input id="login-email" type="email" ... />` (lines 167-176). *Playwright selector*: `page.locator('#login-email')`
  - Password Field: `<input id="login-password" type="password" ... />` (lines 188-197). *Playwright selector*: `page.locator('#login-password')`
  - Submit Button: `<button type="submit" ...>Войти в кабинет ...</button>` (lines 209-225). *Playwright selector*: `page.getByRole('button', { name: 'Войти в кабинет' })`

---

### C. Real-Time SSE (Server-Sent Events) Mechanism
- **Client Connection**:
  - File: `src/components/support/chat/useChatSSE.ts`
  - Establishes a client-side listener pointing to the stream endpoint:
    ```typescript
    eventSource = new EventSource(`/api/support/chat/stream?ticketId=${ticketId}`);
    ```
- **SSE Stream Endpoint**:
  - File: `src/app/api/support/chat/stream/route.ts` (lines 76-123)
  - Constructs a `ReadableStream` that returns a `Response` with headers:
    ```typescript
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Content-Encoding': 'none',
    ```
  - Pushes real-time messages by subscribing a listener to the in-memory pub/sub engine:
    ```typescript
    const unsubscribe = sseBroadcaster.subscribe(ticketId, listener);
    ```
- **Broadcasting Operator Replies**:
  - File: `src/actions/operator/tickets/reply-ticket.action.ts` (lines 68-71)
  - When the operator sends a message, `replyTicketAction` saves it in the database and calls the broadcasting utility (only if it is a client-facing staff message, not an internal note):
    ```typescript
    if (sender === 'STAFF' && savedMsg?.id) {
      await publishMessageSSE(ticketId, savedMsg.id);
    }
    ```
  - File: `src/services/support/sse.service.ts` fetches the message from the DB and publishes it via `sseBroadcaster.publish(ticketId, payload)`.

---

### D. Ticket Closure State transitions
- **Prisma Schema**:
  - File: `prisma/schema.prisma` (lines 537-568)
  - `Ticket` model contains `status: TicketStatus` (enum `OPEN | PENDING | CLOSED`) and `resolvedAt: DateTime?`.
- **UI Interaction (Operator Chat)**:
  - File: `src/app/operator/tickets/components/ticket-chat.tsx` (lines 123-133)
  - Renders a closure button if the ticket is open:
    ```tsx
    <Button
      size="sm"
      intent="ghost"
      disabled={isPending}
      onClick={() => handleStatusChange('CLOSED')}
      className="h-8 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg flex items-center gap-1 font-bold"
    >
      <X className="w-3.5 h-3.5" />
      Закрыть тикет
    </Button>
    ```
  - Clicking this button invokes `changeTicketStatusAction({ ticketId, status: 'CLOSED' })`.
- **DB Transition (Server Action)**:
  - File: `src/actions/operator/tickets/change-status.action.ts` (lines 36-54)
    ```typescript
    await db.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        ...(status === 'CLOSED' ? { resolvedAt: new Date() } : {}),
      },
    });
    ```
  - An audit log is also saved: `auditAdmin({ action: 'TICKET_STATUS_CHANGE', newValue: 'CLOSED', ... })`.
- **UI Interaction (Client Chat)**:
  - When `isClosed` is true, the `ChatInput` is disabled and replaced by a banner message:
    ```tsx
    <span>Тикет закрыт. Создайте новое обращение если нужна помощь.</span>
    ```

---

## 2. Logic Chain

Based on our observations, we have formulated the following E2E testing strategy:

1. **Auto-redirection Verification**: Visiting `/dashboard/tickets` triggers a 307 redirect or Next.js router transition to a specific chat ID. To test this, Playwright must wait for the URL to contain a `/dashboard/tickets/` ID suffix.
2. **Double Browser Context Setup**: To verify real-time, bi-directional message delivery via SSE, we must open **two distinct browser contexts** (Client and Operator) to prevent cookies/session pollution.
3. **SSE Connection Capture**: Playwright can monitor the GET request to `/api/support/chat/stream?ticketId=*` via `page.waitForRequest` to ensure the EventSource connection opens properly.
4. **Optimistic UI vs Persisted Updates**: When the client clicks submit, the message must appear instantly on the client UI. The operator context must receive this message shortly after without manual refresh.
5. **Closure Logic Verification**: When the operator clicks the "Закрыть тикет" button:
   - The operator's chat actions update to show "Открыть заново".
   - The client's chat interface hides the textarea and displays the closed ticket banner.
   - The Prisma DB state resolves status to `CLOSED` and sets `resolvedAt` to a valid timestamp.

This chain of reasoning guarantees all 4 components of the support ticket flow are tested and validated in our drafted spec file.

---

## 3. Caveats

- **Database Hashing Compatibility**: To register a test operator dynamically in `beforeAll`, we must hash the operator password using the native `hashPassword` function from `src/lib/auth/password.ts`.
- **SSE Connection Timing**: SSE depends on keeping active socket connections. In slow CI environments, there could be slight latency, which we account for using Playwright's dynamic timeouts (`{ timeout: 10000 }` on visibility checks).
- **Environment Isolation**: In some local environments, test files are written to `.env.test`. We assume database connection string is properly configured to a test DB during testing to avoid polluting actual production data.

---

## 4. Conclusion

The support ticket lifecycle, real-time message broadcasting via SSE, operator workspace access, and DB ticket closure are tightly integrated using Next.js Server Actions, in-memory SSE broadcasters, and Prisma ORM updates. 

We have drafted a complete Playwright test suite in our workspace directory:
- Path: `d:\SMM_plan_2\.agents\teamwork_preview_explorer_testing_m1_2\proposed_sse_tickets.spec.ts`

This test suite covers the complete workflow: client login and redirection, client message submission, operator login, workspace loading, real-time SSE propagation of responses, operator closure of tickets, UI feedback changes on both sides, and database record verification.

---

## 5. Verification Method

To execute and verify the drafted Playwright test specification:

1. Move the drafted test file to the project's E2E tests folder:
   ```bash
   cp d:/SMM_plan_2/.agents/teamwork_preview_explorer_testing_m1_2/proposed_sse_tickets.spec.ts d:/SMM_plan_2/e2e/sse_tickets.spec.ts
   ```
2. Execute the test command using Playwright:
   ```bash
   npx playwright test e2e/sse_tickets.spec.ts
   ```
3. **Invalidation conditions**:
   - If the E2E test fails to detect the redirection from `/dashboard/tickets` to `/dashboard/tickets/[id]`.
   - If the client's `EventSource` connection is blocked or returns non-200 responses.
   - If the operator's response does not appear on the client's screen automatically (indicating a breakdown in the SSE pub/sub system).
   - If the status transition fails to propagate `status: 'CLOSED'` to the database.
