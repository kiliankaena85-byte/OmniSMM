import { chromium } from 'playwright';
import path from 'path';

async function inspectImage() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();

  const imgPath = 'file:///C:/Users/Артем/.gemini/antigravity/brain/649413b5-d403-4baa-baa8-c7005bc1923b/.user_uploaded/media_1790714444842.png';

  await page.setContent(`
    <html>
      <body style="margin:0; background:black;">
        <canvas id="canvas"></canvas>
        <img id="img" src="${imgPath}" style="display:none;" />
      </body>
    </html>
  `);

  await page.waitForTimeout(500);

  const colors = await page.evaluate(async () => {
    const img = document.getElementById('img') as HTMLImageElement;
    await new Promise((resolve) => {
      if (img.complete) resolve(null);
      else img.onload = () => resolve(null);
    });

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const getPixel = (x: number, y: number) => {
      const data = ctx.getImageData(x, y, 1, 1).data;
      return `rgb(${data[0]}, ${data[1]}, ${data[2]}) hex: #${((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1)}`;
    };

    const w = canvas.width;
    const h = canvas.height;

    return {
      dimensions: { width: w, height: h },
      topLeftCorner: getPixel(50, 50),
      midLeftEdge: getPixel(50, Math.floor(h * 0.45)),
      midRightEdge: getPixel(w - 50, Math.floor(h * 0.45)),
      centerTop: getPixel(Math.floor(w * 0.5), Math.floor(h * 0.1)),
      centerHero: getPixel(Math.floor(w * 0.5), Math.floor(h * 0.38)),
      bottomCenter: getPixel(Math.floor(w * 0.5), h - 50),
      bottomLeft: getPixel(Math.floor(w * 0.2), h - 50),
      bottomRight: getPixel(Math.floor(w * 0.8), h - 50),
      nearCardShadow: getPixel(Math.floor(w * 0.5), Math.floor(h * 0.67)),
    };
  });

  console.log('Sampled colors from Lovable image:', JSON.stringify(colors, null, 2));
  await browser.close();
}

inspectImage().catch(console.error);
