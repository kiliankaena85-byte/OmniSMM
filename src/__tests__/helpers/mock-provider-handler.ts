import { NextRequest, NextResponse } from 'next/server';

export async function mockProviderPost(request: NextRequest) {
  let body: Record<string, string> = {};
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    params.forEach((value, key) => {
      body[key] = value;
    });
  } else {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }
  }

  const { action, service, quantity, runs } = body;

  if (action === 'services') {
    return NextResponse.json([
      { service: 100, name: 'Telegram Subscribers', min: 10, max: 50000, dripfeed: true, rate: 0.15 },
      { service: 500, name: 'VK Likes Instant', min: 20, max: 10000, dripfeed: false, rate: 0.05 }
    ]);
  }

  if (action === 'add') {
    const qty = parseInt(quantity || '0', 10);
    if (service === '100' && qty < 10) {
      return NextResponse.json({ error: 'Quantity must be at least 10' });
    }
    if (service === '100' && qty > 50000) {
      return NextResponse.json({ error: 'Quantity must not exceed 50000' });
    }
    if (service === '500' && runs) {
      return NextResponse.json({ error: 'Drip-feed is not supported for this service' });
    }
    return NextResponse.json({ order: 'mock_std_' + Date.now() });
  }

  if (action === 'status') {
    return NextResponse.json({
      charge: '15.00',
      start_count: '100',
      status: 'In progress',
      remains: '200',
      currency: 'RUB'
    });
  }

  return NextResponse.json({ error: 'Unknown action' });
}
