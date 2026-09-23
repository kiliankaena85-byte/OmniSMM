import fs from 'fs';
import path from 'path';

const filePath = path.resolve('src/components/admin/catalog-table-v2.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Target the start of ServiceFormSheet and the end of EditServiceModal
const startMarker = '// ─── Sub-component: Service Form Sheet ──────────────────────────────────';
const endMarker = 'function CatalogTableRow({';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find markers', { startIndex, endIndex });
  process.exit(1);
}

const replacement = `// ─── Sub-component: Create Service Button (Full Page Link) ───────────────────
export function CreateServiceButton() {
  return (
    <Link
      href="/admin/catalog/new"
      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-200 cursor-pointer shadow-xs active:scale-95 text-xs"
    >
      <Plus className="w-4 h-4" />
      Создать услугу
    </Link>
  );
}

// ─── Sub-component: Edit Service Actions (Full Page Link) ─────────────────────
export function EditServiceModal({
  service,
}: {
  service: CatalogServiceDTO;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providers?: any[];
  onSuccess?: () => void;
  usdToRub?: number;
}) {
  const [openPricingModal, setOpenPricingModal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpenPricingModal(true)}
          title="ML Обоснование наценки и юнит-экономика"
          aria-label={\`ML Обоснование наценки для \${service.name}\`}
          className="h-10 w-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-all duration-200 cursor-pointer"
        >
          <span className="text-base">🧠</span>
        </button>

        <Link
          href={\`/admin/catalog/\${service.id}\`}
          aria-label={\`Редактировать услугу \${service.name}\`}
          className="h-10 w-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200 cursor-pointer"
        >
          <Pencil className="w-4 h-4" />
        </Link>
      </div>

      {openPricingModal && (
        <AdminPricingIntelligenceModal
          serviceId={service.id}
          isOpen={openPricingModal}
          onClose={() => setOpenPricingModal(false)}
        />
      )}
    </>
  );
}

`;

content = content.slice(0, startIndex) + replacement + content.slice(endIndex);

// Also replace <CreateServiceModal in header
content = content.replace(
  /<CreateServiceModal\s+categories=\{categories\}\s+providers=\{providers\}\s+onSuccess=\{[^}]+\}\s+usdToRub=\{usdToRub\}\s*\/>/,
  '<CreateServiceButton />'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully replaced ServiceFormSheet with full-page navigation in catalog-table-v2.tsx!');
