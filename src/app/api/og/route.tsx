import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const title = searchParams.get('title') || 'Продвижение в соцсетях';
    const subtitle = searchParams.get('subtitle') || 'Оптовые тарифы от 1 штуки • Моментальный автозапуск';
    const price = searchParams.get('price') || '0.01 ₽ / шт';
    const network = searchParams.get('network') || 'SMMplan';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#090d16',
            backgroundImage: 'radial-gradient(circle at 25px 25px, #1a2234 2%, transparent 0%), radial-gradient(circle at 75px 75px, #1a2234 2%, transparent 0%)',
            backgroundSize: '100px 100px',
            padding: '60px 80px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '24px',
                }}
              >
                S
              </div>
              <span style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.02em' }}>
                SMMplan
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '8px 20px',
                borderRadius: '100px',
                color: '#60a5fa',
                fontSize: '20px',
                fontWeight: '700',
              }}
            >
              {network}
            </div>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px' }}>
            <div
              style={{
                fontSize: '56px',
                fontWeight: '900',
                color: '#ffffff',
                lineHeight: '1.1',
                letterSpacing: '-0.03em',
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: '24px', color: '#94a3b8', lineHeight: '1.4', fontWeight: '500' }}>
              {subtitle}
            </div>
          </div>

          {/* Footer badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '28px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px', color: '#64748b' }}>Цены от</span>
              <span style={{ fontSize: '32px', fontWeight: '900', color: '#38bdf8', fontFamily: 'monospace' }}>
                {price}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', color: '#10b981', fontSize: '18px', fontWeight: 'bold' }}>
              <span>✓ Гарантия Refill</span>
              <span>✓ Без пароля</span>
              <span>✓ Чек 54-ФЗ</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(`Failed to generate the image: ${errorMsg}`, {
      status: 500,
    });
  }
}
