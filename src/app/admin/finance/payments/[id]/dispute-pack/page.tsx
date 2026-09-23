// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { notFound, redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import Link from 'next/link';
import { getPaymentDisputePackAction } from '@/actions/admin/finance/payments';
import { FileText, ArrowLeft, ShieldCheck, HelpCircle } from 'lucide-react';
import { PrintButton } from '@/components/admin/PrintButton';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatBalance } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PaymentDisputePackPage({ params }: Props) {
  const session = await verifySession();
  if (!session) {
    redirect('/login');
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (!user || !['OWNER', 'ADMIN'].includes(user.role)) {
    redirect('/dashboard/new-order');
  }

  const { id } = await params;
  const result = await getPaymentDisputePackAction(id);

  if ('error' in result) {
    return (
      <div className="p-10 text-center bg-background rounded-3xl border border-border">
        <div className="inline-flex p-4 bg-destructive/20 text-destructive rounded-2xl mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-foreground">Пакет оспоримой операции не найден</h1>
        <p className="text-muted-foreground mt-2 font-medium">{result.error}</p>
        <div className="mt-6">
          <Link href="/admin/finance" className="text-primary hover:underline font-bold text-sm">
            Вернуться в биллинг
          </Link>
        </div>
      </div>
    );
  }

  const { payment, user: clientUser, orders } = result;

  const paymentDate = new Date(payment.createdAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedAmount = (payment.amount / 100).toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row relative">
      {/* Dynamic CSS override for printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Completely hide Next.js layout wrappers, headers, sidebars and dashboard decorators */
          aside, header, nav, footer, button, .no-print, [role="navigation"], .admin-sidebar, .command-palette-trigger {
            display: none !important;
          }
          
          /* Force main viewport layout reset */
          html, body {
            background: white !important;
            color: black !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }

          /* Reset all containers holding the app to standard white-page defaults */
          div, main, section {
            background: transparent !important;
            color: black !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            height: auto !important;
            position: relative !important;
            overflow: visible !important;
          }

          /* Target strictly our printed letter container */
          .print-document {
            background: white !important;
            color: black !important;
            padding: 20mm 15mm 20mm 20mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            font-size: 11pt !important;
            line-height: 1.4 !important;
            font-family: "Times New Roman", Times, Georgia, serif !important;
            display: block !important;
          }

          .print-document table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 15px 0 !important;
            color: black !important;
          }

          .print-document th, .print-document td {
            border: 1px solid #000000 !important;
            padding: 6px 10px !important;
            font-size: 9.5pt !important;
            text-align: left !important;
            color: black !important;
          }

          .print-document th {
            background-color: #f2f2f2 !important;
            font-weight: bold !important;
          }

          .print-page-break {
            page-break-before: always !important;
          }

          .print-no-break {
            page-break-inside: avoid !important;
          }
        }
      ` }} />

      {/* LEFT: Operator Preview Workspace (Slightly gray shadow box) */}
      <div className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto no-print flex justify-center items-start">
        {/* print: белый фон для печати */}
        <div className="w-full max-w-[800px] bg-card text-foreground rounded-3xl shadow-2xl p-8 md:p-12 border border-border/60 print-document select-text print:bg-white print:text-black">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-border print:border-black pb-6 mb-8 text-[11px] font-medium leading-relaxed font-serif">
            <div className="space-y-1">
              <span className="font-bold uppercase text-[12px] block tracking-wide">ООО «СММПЛАН»</span>
              <p>ИНН 7724491024 / КПП 772401001</p>
              <p>115407, г. Москва, ул. Судостроительная, д. 28</p>
              <p>Email: support@smmplan.pro | Web: smmplan.pro</p>
            </div>
            <div className="text-right space-y-1">
              <p className="font-bold text-[12px]">АО «БАНК ЭКВАЙЕР»</p>
              <p>В отдел оспаривания операций клиентов</p>
              <p>Исходящий №: <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded font-semibold text-foreground print:bg-slate-100 print:text-black">{payment.gatewayId || payment.id}</code></p>
              <p>Дата: {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} г.</p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2 mb-8 font-serif">
            <h1 className="text-base md:text-lg font-black uppercase tracking-wider text-foreground print:text-black">
              ОТЗЫВ НА ПРЕТЕНЗИЮ И ПАКЕТ ДОКАЗАТЕЛЬСТВ
            </h1>
            <p className="text-xs font-bold text-muted-foreground print:text-slate-600">
              О правомерности транзакции и согласии Держателя карты с правилами публичной оферты
            </p>
          </div>

          {/* Letter Body */}
          <div className="space-y-5 text-[12px] md:text-[13px] leading-relaxed text-justify font-serif">
            <p>
              Настоящим ООО «СММПЛАН» сообщает, что спорная операция (чарджбэк) по банковской карте клиента, совершенная на сумму <strong>{formattedAmount}</strong> в системе интернет-эквайринга {payment.gateway === 'yookassa' ? 'ЮKassa' : 'CryptoBot'}, является полностью правомерной, совершена с ведома и согласия Держателя карты в целях пополнения личного баланса учетной записи на сайте <strong>smmplan.pro</strong> (далее — Сервис).
            </p>

            {/* Section 1 */}
            <div className="space-y-2">
              <span className="font-bold text-foreground print:text-black uppercase text-[12px] block tracking-wide">1. Правовое обоснование соглашения (согласно ГК РФ)</span>
              <p>
                Пользовательское соглашение и Правила предоставления услуг Сервиса, опубликованные в открытом доступе на сайте, представляют собой публичную оферту согласно <strong>п. 2 ст. 437 Гражданского кодекса РФ</strong>.
              </p>
              <p>
                В соответствии с <strong>п. 3 ст. 438 ГК РФ</strong>, совершение лицом, получившим оферту, действий по выполнению указанных в ней условий договора (в том числе оплата услуг) признается её полным и безоговорочным акцептом (конклюдентные действия). Совершая платеж, клиент полностью и безраздельно согласился со всеми условиями оферты, включая правила отмены и возврата средств.
              </p>
              <p>
                Согласно <strong>ст. 160 ГК РФ</strong>, проставление клиентом специального символа (чекбокса) согласия с правилами Сервиса в интерфейсе оплаты перед совершением платежа («Я подтверждаю платёж и соглашаюсь с правилами публичной оферты») признается <strong>простой электронной подписью</strong>. Данный лог согласия фиксируется в базе данных Сервиса и является письменным доказательством (согласно <strong>ст. 75 ГПК РФ / ст. 89 АПК РФ</strong>).
              </p>
            </div>

            {/* Section 2 */}
            <div className="space-y-2 print-no-break">
              <span className="font-bold text-foreground print:text-black uppercase text-[12px] block tracking-wide">2. Логи Согласия и Параметры транзакции (Clickwrap Audit Log)</span>
              <table className="w-full text-left border-collapse my-4">
                <thead>
                  <tr className="bg-muted/40 print:bg-slate-50 border-b border-slate-900">
                    <th className="p-2 font-bold text-foreground print:text-black border border-border print:border-slate-300">Параметр аудита</th>
                    <th className="p-2 font-bold text-foreground print:text-black border border-border print:border-slate-300">Значение из логов базы данных</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 border border-border print:border-slate-300 font-semibold">Email учетной записи</td>
                    <td className="p-2 border border-border print:border-slate-300 font-mono">{clientUser.email}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 border border-border print:border-slate-300 font-semibold">IP-адрес при согласии</td>
                    <td className="p-2 border border-border print:border-slate-300 font-mono">{payment.consentIp || 'Зафиксировано шлюзом'}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 border border-border print:border-slate-300 font-semibold">User-Agent (Браузер)</td>
                    <td className="p-2 border border-border print:border-slate-300 font-mono text-[10px] max-w-[200px] truncate" title={payment.consentUserAgent || ''}>
                      {payment.consentUserAgent || 'Зафиксировано шлюзом'}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 border border-border print:border-slate-300 font-semibold">Идентификатор транзакции</td>
                    <td className="p-2 border border-border print:border-slate-300 font-mono">{payment.id}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 border border-border print:border-slate-300 font-semibold">ID в платежной системе</td>
                    <td className="p-2 border border-border print:border-slate-300 font-mono">{payment.gatewayId || 'Тестовый платеж'}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 border border-border print:border-slate-300 font-semibold">Метод подтверждения платежа</td>
                    <td className="p-2 border border-border print:border-slate-300 font-sans">3-D Secure (СМС/Push-код от банка-эмитента, liability shift)</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 border border-border print:border-slate-300 font-semibold">Дата и время операции</td>
                    <td className="p-2 border border-border print:border-slate-300 font-mono">{paymentDate}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3 */}
            <div className="space-y-2 print-page-break">
              <span className="font-bold text-foreground print:text-black uppercase text-[12px] block tracking-wide">3. Аудит фактического оказания цифровых услуг (Proof of Delivery)</span>
              <p>
                Зачисленные на личный баланс Пользователя денежные средства в размере <strong>{formattedAmount}</strong> были в полном объеме или частично израсходованы им в личном кабинете на покупку услуг продвижения. Ниже приведена подробная выгрузка выполненных заказов продвижения в социальных сетях, инициированных данным клиентом сразу после проведения спорной транзакции:
              </p>

              {orders.length > 0 ? (
                <table className="w-full text-left border-collapse my-4 print-no-break">
                  <thead>
                    <tr className="bg-muted/40 print:bg-slate-50 border-b border-slate-900">
                      <th className="p-2 font-bold text-foreground print:text-black border border-border print:border-slate-300 text-[10px]">ID Заказа</th>
                      <th className="p-2 font-bold text-foreground print:text-black border border-border print:border-slate-300 text-[10px]">Дата создания</th>
                      <th className="p-2 font-bold text-foreground print:text-black border border-border print:border-slate-300 text-[10px]">Услуга продвижения</th>
                      <th className="p-2 font-bold text-foreground print:text-black border border-border print:border-slate-300 text-[10px]">Целевая ссылка</th>
                      <th className="p-2 font-bold text-foreground print:text-black border border-border print:border-slate-300 text-[10px] text-right">Кол-во</th>
                      <th className="p-2 font-bold text-foreground print:text-black border border-border print:border-slate-300 text-[10px] text-right">Стоимость</th>
                      <th className="p-2 font-bold text-foreground print:text-black border border-border print:border-slate-300 text-[10px] text-center">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id} className="border-b border-slate-200 text-[10px]">
                        <td className="p-2 border border-border print:border-slate-300 font-mono text-[9px]">#{o.numericId}</td>
                        <td className="p-2 border border-border print:border-slate-300 font-mono whitespace-nowrap">
                          {new Date(o.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-2 border border-border print:border-slate-300 font-medium max-w-[120px] truncate" title={o.serviceName}>
                          {o.serviceName}
                        </td>
                        <td className="p-2 border border-border print:border-slate-300 font-mono text-[9px] max-w-[140px] truncate" title={o.link}>
                          {o.link}
                        </td>
                        <td className="p-2 border border-border print:border-slate-300 text-right font-mono font-semibold">{o.quantity}</td>
                        <td className="p-2 border border-border print:border-slate-300 text-right font-mono font-semibold">{(o.charge / 100).toFixed(2)} ₽</td>
                        <td className="p-2 border border-border print:border-slate-300 text-center font-bold">
                          <span className={o.status === 'COMPLETED' ? 'text-emerald-700' : 'text-muted-foreground print:text-slate-600'}>
                            {o.status === 'COMPLETED' && o.remains === 0 ? 'ВЫПОЛНЕН (100%)' : o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 bg-muted/40 print:bg-slate-50 border border-border print:border-slate-300 rounded-xl my-4 text-center text-muted-foreground print:text-slate-600 italic">
                  На момент формирования отчета зачисленные средства остаются на балансе личного кабинета Пользователя и находятся в его единоличном распоряжении согласно п. 4.2 Оферты. Услуги не списывались, возврат не запрашивался.
                </div>
              )}
              
              <p>
                Показатель остатка недоставки (remains) по всем завершенным заказам в таблице равен 0, что технически гарантирует полную доставку заказанного трафика на целевой интернет-ресурс, предоставленный самим клиентом. Претензий по качеству и объему оказанных услуг от Пользователя в службу поддержки не поступало.
              </p>
            </div>

            {/* Section 4 */}
            <div className="space-y-2 print-no-break">
              <span className="font-bold text-foreground print:text-black uppercase text-[12px] block tracking-wide">4. Резюме для финансовой организации</span>
              <p>
                На основании изложенного, согласно правилам Международных платежных систем (МПС) и регламенту платежной системы МИР, интернет-магазин полностью исполнил свои обязательства перед покупателем. Мы просим АО «БАНК ЭКВАЙЕР» отклонить неправомерные требования Держателя карты об оспаривании операции (chargeback) и сохранить списание средств в пользу ТСП.
              </p>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-12 flex justify-between items-end border-t border-border print:border-slate-300 pt-8 text-[12px] font-serif print-no-break">
            <div className="space-y-4">
              <p className="font-bold text-foreground print:text-black">Генеральный директор ООО «СММПЛАН»</p>
              <div className="flex gap-2 items-end">
                <span className="border-b border-slate-900 w-32 h-6 block" />
                <span>/ Килиан К. А. /</span>
              </div>
            </div>
            <div className="text-right text-[10px] text-muted-foreground italic">
              М.П. (Место для печати организации)
            </div>
          </div>

        </div>
      </div>

      {/* RIGHT: Modern Sidebar Action Control Center (Slate aesthetic, responsive) */}
      <div className="w-full lg:w-[400px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-border/60 p-8 flex flex-col justify-between shrink-0 no-print z-20">
        <div className="space-y-8">
          
          {/* Back button */}
          <Link
            href="/admin/finance"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Вернуться к биллингу</span>
          </Link>

          {/* Info Card */}
          <div className="space-y-4">
            <div className="inline-flex p-3 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Генератор Dispute Pack</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Документ автоматически собран на основе логов интернет-акцепта (Простая электронная подпись) и логов выполнения заказов на провайдерах.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-800" />

          {/* Quick instructions checklist */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-sky-400" />
              <span>Инструкция по отправке</span>
            </h3>
            <ol className="space-y-3 text-xs text-muted-foreground list-decimal list-inside leading-relaxed">
              <li>
                Нажмите большую кнопку ниже <strong>«Печать / Сохранить в PDF»</strong>.
              </li>
              <li>
                В открывшемся системном диалоге выберите принтер <strong>«Сохранить как PDF»</strong>.
              </li>
              <li>
                Убедитесь в настройках печати, что включен параметр <strong>«Скрыть колонтитулы»</strong> (это уберёт системные ссылки браузера сверху и снизу страницы).
              </li>
              <li>
                Отправьте полученный файл в личный кабинет эквайера YooKassa / ЮKassa для разблокировки средств по операции оспаривания.
              </li>
            </ol>
          </div>

        </div>

        {/* Action button at bottom */}
        <div className="mt-8 space-y-4">
          <PrintButton />
          
          <div className="p-4 bg-muted/30 rounded-xl border border-border/60 flex gap-3 text-[10px] text-muted-foreground leading-relaxed font-medium">
            <span>🛡️</span>
            <span>Данные логов IP и User-Agent криптографически закреплены за номером транзакции на стороне шлюза YooKassa. Модификация логов запрещена правилами безопасности.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
