import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Personal Access Token from environment or fallback to empty string
const FIGMA_TOKEN = process.env.FIGMA_TOKEN || '';
const FILE_KEY = '7azOKtbxkL1bE4hHDLOV09';
const NODE_ID = '935:0';
const FILE_KEY_SECONDARY = 'FsZmyCD3vp46lnR9Jt1LDQ';
const NODE_ID_SECONDARY = '26:1081';

// Convert float RGB values [0-1] from Figma API to hex color string #RRGGBB
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (val: number) => {
    const hex = Math.round(val * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Recursively traverse the Figma node document tree
function walkNode(node: any, callback: (node: any) => void) {
  callback(node);
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      walkNode(child, callback);
    }
  }
}

async function main() {
  console.log('Starting Figma Design System variables extraction...');
  
  const targetDir = path.resolve(__dirname, '../src/utils');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const outputPath = path.join(targetDir, 'figma-styles.json');

  // High-fidelity standard Telegram design variables to ensure robust, complete coverage
  const fallbackStyles = {
    theme: "telegram-community",
    colors: {
      primary: "#2481cc",
      primaryHover: "#2072b8",
      primaryForeground: "#ffffff",
      background: "#0e1621",
      backgroundCard: "#17212b",
      backgroundCardHover: "#202b36",
      text: "#ffffff",
      textMuted: "#7f8c9a",
      textSelected: "#ffffff",
      border: "#24303f",
      chatBubbleSent: "#2b5278",
      chatBubbleReceived: "#182533",
      chatBubbleSentText: "#ffffff",
      chatBubbleReceivedText: "#f5f5f5",
      destructive: "#ec3b3b",
      destructiveHover: "#d32f2f",
      miniAppHeaderBackground: {
        light: "#2481cc",
        dark: "#182533"
      },
      miniAppHeaderTextColor: "#ffffff",
      miniAppInputBackground: {
        light: "#ffffff",
        dark: "#17212b"
      },
      miniAppCardBackground: {
        light: "#ffffff",
        dark: "#17212b"
      }
    },
    layout: {
      borderRadiusBubble: "12px",
      borderRadiusCard: "16px",
      borderRadiusButton: "10px",
      paddingBubble: "12px 16px",
      paddingCard: "16px",
      marginChatGap: "8px",
      miniAppButtonRadius: "8px",
      miniAppButtonPadding: "10px 16px"
    },
    typography: {
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      fontSizeChat: "14px",
      fontSizeTitle: "16px",
      fontWeightNormal: "400",
      fontWeightBold: "600"
    }
  };

  // Clone fallback styles as our base
  const styles = JSON.parse(JSON.stringify(fallbackStyles));

  try {
    const url1 = `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${NODE_ID}`;
    console.log(`Fetching from Figma API: ${url1}`);
    
    const response1 = await fetch(url1, {
      method: 'GET',
      headers: {
        'X-Figma-Token': FIGMA_TOKEN
      }
    });

    if (!response1.ok) {
      throw new Error(`Figma API responded with HTTP status ${response1.status} for primary node`);
    }

    const data1 = (await response1.json()) as any;
    console.log('Successfully fetched primary node from Figma REST API!');

    const node1 = data1.nodes?.[NODE_ID]?.document;
    if (node1) {
      console.log(`Parsing node 1: ${node1.name} (${node1.type})`);
      walkNode(node1, (child) => {
        const name = child.name?.toLowerCase() || '';
        
        // 1. Dynamic Color extraction from SOLID fills
        if (child.fills && child.fills[0] && child.fills[0].color && child.fills[0].type === 'SOLID') {
          const color = child.fills[0].color;
          const hex = rgbToHex(color.r, color.g, color.b);
          
          if (name.includes('bubble-sent') || name.includes('sent-bubble') || name.includes('bubble_sent')) {
            styles.colors.chatBubbleSent = hex;
          } else if (name.includes('bubble-received') || name.includes('received-bubble') || name.includes('bubble_recv')) {
            styles.colors.chatBubbleReceived = hex;
          } else if (name.includes('primary') || name.includes('accent')) {
            styles.colors.primary = hex;
          } else if (name.includes('card') && name.includes('bg')) {
            styles.colors.backgroundCard = hex;
          } else if (name.includes('background') && !name.includes('card')) {
            styles.colors.background = hex;
          }
        }
        
        // 2. Dynamic Corner Radius extraction
        if (child.cornerRadius !== undefined) {
          const radiusStr = `${child.cornerRadius}px`;
          if (name.includes('bubble')) {
            styles.layout.borderRadiusBubble = radiusStr;
          } else if (name.includes('card')) {
            styles.layout.borderRadiusCard = radiusStr;
          } else if (name.includes('button')) {
            styles.layout.borderRadiusButton = radiusStr;
            styles.layout.miniAppButtonRadius = radiusStr;
          }
        }
        
        // 3. Dynamic Typography extraction
        if (child.style && child.style.fontFamily) {
          if (name.includes('chat') || name.includes('message')) {
            styles.typography.fontFamily = child.style.fontFamily;
            if (child.style.fontSize) {
              styles.typography.fontSizeChat = `${child.style.fontSize}px`;
            }
          }
        }
      });
    }

    const url2 = `https://api.figma.com/v1/files/${FILE_KEY_SECONDARY}/nodes?ids=${NODE_ID_SECONDARY}`;
    console.log(`Fetching from Figma API: ${url2}`);
    
    const response2 = await fetch(url2, {
      method: 'GET',
      headers: {
        'X-Figma-Token': FIGMA_TOKEN
      }
    });

    if (!response2.ok) {
      throw new Error(`Figma API responded with HTTP status ${response2.status} for secondary node`);
    }

    const data2 = (await response2.json()) as any;
    console.log('Successfully fetched secondary node from Figma REST API!');

    const node2 = data2.nodes?.[NODE_ID_SECONDARY]?.document;
    if (node2) {
      console.log(`Parsing node 2: ${node2.name} (${node2.type})`);
      walkNode(node2, (child) => {
        const name = child.name?.toLowerCase() || '';
        
        // 1. Corner radius for Mini App elements
        if (child.cornerRadius !== undefined && name.includes('button')) {
          styles.layout.miniAppButtonRadius = `${child.cornerRadius}px`;
        }
        
        // 2. Color extraction for Mini App custom states
        if (child.fills && child.fills[0] && child.fills[0].color && child.fills[0].type === 'SOLID') {
          const color = child.fills[0].color;
          const hex = rgbToHex(color.r, color.g, color.b);
          
          if (name.includes('header')) {
            styles.colors.miniAppHeaderBackground.dark = hex;
            styles.colors.miniAppHeaderBackground.light = hex;
          } else if (name.includes('input')) {
            styles.colors.miniAppInputBackground.dark = hex;
            styles.colors.miniAppInputBackground.light = hex;
          } else if (name.includes('card') || name.includes('wrapper')) {
            styles.colors.miniAppCardBackground.dark = hex;
            styles.colors.miniAppCardBackground.light = hex;
          }
        }
      });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(styles, null, 2), 'utf-8');
    console.log(`Figma design styles successfully written to ${outputPath}`);

  } catch (error: any) {
    console.warn(`[WARNING] Figma extraction failed or was offline: ${error.message}`);
    console.log('Falling back to high-fidelity Telegram Design System (Community) static tokens.');
    
    fs.writeFileSync(outputPath, JSON.stringify(fallbackStyles, null, 2), 'utf-8');
    console.log(`Fallback design styles successfully written to ${outputPath}`);
  }
}

main().catch((err) => {
  console.error('Fatal error in Figma layout extractor:', err);
  process.exit(1);
});
