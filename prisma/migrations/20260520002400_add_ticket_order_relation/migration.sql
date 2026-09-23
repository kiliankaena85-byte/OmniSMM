-- AlterTable: Add orderId column to Ticket for live chat order context binding
ALTER TABLE "Ticket" ADD COLUMN "orderId" TEXT;

-- AddForeignKey: Link Ticket.orderId to Order.id (SetNull on delete)
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: Fast lookup for tickets by order
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");
