import fs from 'node:fs';
import path from 'node:path';

interface ProviderProfile {
  id: string;
  name: string;
  website: string;
  apiUrl: string;
  tier: number;
  currency: 'USD' | 'RUB' | 'EUR';
  supportedMethods: string[];
  primaryNetworks: string[];
  rating: number;
  avgResponseMs: number;
  features: {
    dripfeed: boolean;
    refill: boolean;
    cancel: boolean;
    channelBoosts: boolean;
    autoViews: boolean;
  };
  benchmarkServices: Array<{
    service: string;
    name: string;
    category: string;
    rate: string;
    min: string;
    max: string;
    network: string;
  }>;
}

const NEW_PROVIDERS_V7: ProviderProfile[] = [
  {
    id: 'palladium_smm',
    name: 'Palladium SMM',
    website: 'https://palladium-smm.com',
    apiUrl: 'https://palladium-smm.com/api/v2',
    tier: 1,
    currency: 'RUB',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['VKONTAKTE', 'TELEGRAM', 'YOUTUBE'],
    rating: 9.7,
    avgResponseMs: 125,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'pal_vk_followers',
        name: 'VKontakte Subscribers [Real CIS Profiles, High Retention]',
        category: 'VKontakte Followers',
        rate: '89.00',
        min: '50',
        max: '100000',
        network: 'VKONTAKTE'
      },
      {
        service: 'pal_vk_views',
        name: 'VKontakte Post & Clips Views [Instant Delivery]',
        category: 'VKontakte Views',
        rate: '0.85',
        min: '100',
        max: '1000000',
        network: 'VKONTAKTE'
      }
    ]
  },
  {
    id: 'smmflow_app',
    name: 'SMMflow App',
    website: 'https://smmflow.app',
    apiUrl: 'https://smmflow.app/api/v2',
    tier: 1,
    currency: 'RUB',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TELEGRAM', 'VKONTAKTE'],
    rating: 9.5,
    avgResponseMs: 140,
    features: {
      dripfeed: true,
      refill: true,
      cancel: false,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'flow_tg_premium',
        name: 'Telegram Premium Members [Non-Drop 30D]',
        category: 'Telegram Members',
        rate: '120.00',
        min: '10',
        max: '50000',
        network: 'TELEGRAM'
      },
      {
        service: 'flow_vk_likes',
        name: 'VKontakte Fast Likes [Active Russian Accounts]',
        category: 'VKontakte Likes',
        rate: '15.50',
        min: '20',
        max: '50000',
        network: 'VKONTAKTE'
      }
    ]
  },
  {
    id: 'mrpopular_net',
    name: 'MrPopular API',
    website: 'https://mrpopular.net',
    apiUrl: 'https://mrpopular.net/api/v2',
    tier: 1,
    currency: 'RUB',
    supportedMethods: ['services', 'add', 'status', 'balance'],
    primaryNetworks: ['VKONTAKTE', 'TELEGRAM', 'YOUTUBE', 'TIKTOK'],
    rating: 9.6,
    avgResponseMs: 165,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'mrpop_tg_views',
        name: 'Telegram Post Views Real Mix',
        category: 'Telegram Views',
        rate: '1.20',
        min: '100',
        max: '500000',
        network: 'TELEGRAM'
      },
      {
        service: 'mrpop_vk_reposts',
        name: 'VKontakte Real Wall Shares',
        category: 'VKontakte Shares',
        rate: '45.00',
        min: '10',
        max: '10000',
        network: 'VKONTAKTE'
      }
    ]
  },
  {
    id: 'engagegate_app',
    name: 'EngageGate',
    website: 'https://engagegate.app',
    apiUrl: 'https://engagegate.app/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['TELEGRAM', 'INSTAGRAM', 'TIKTOK'],
    rating: 9.4,
    avgResponseMs: 115,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'eg_tg_reactions',
        name: 'Telegram Custom Emoji Reactions Positive/Negative',
        category: 'Telegram Reactions',
        rate: '0.015',
        min: '50',
        max: '50000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'vnsmm_net',
    name: 'VNSMM Vietnam',
    website: 'https://vnsmm.net',
    apiUrl: 'https://vnsmm.net/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TIKTOK', 'YOUTUBE', 'INSTAGRAM'],
    rating: 9.6,
    avgResponseMs: 180,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'vnsmm_tt_views',
        name: 'TikTok Video Views [Ultra Fast Asian Farm]',
        category: 'TikTok Views',
        rate: '0.007',
        min: '500',
        max: '10000000',
        network: 'TIKTOK'
      },
      {
        service: 'vnsmm_tt_followers',
        name: 'TikTok High Quality Followers [Organic Drip]',
        category: 'TikTok Followers',
        rate: '0.35',
        min: '50',
        max: '100000',
        network: 'TIKTOK'
      }
    ]
  },
  {
    id: 'autolike_vn',
    name: 'AutoLike VN',
    website: 'https://autolike.com.vn',
    apiUrl: 'https://autolike.com.vn/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance'],
    primaryNetworks: ['TIKTOK', 'YOUTUBE', 'INSTAGRAM'],
    rating: 9.3,
    avgResponseMs: 195,
    features: {
      dripfeed: true,
      refill: true,
      cancel: false,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'alvn_yt_shorts',
        name: 'YouTube Shorts Instant Views [Real Asian Traffic]',
        category: 'YouTube Views',
        rate: '0.12',
        min: '100',
        max: '5000000',
        network: 'YOUTUBE'
      }
    ]
  },
  {
    id: 'tangtuongtac_mxh',
    name: 'TangTuongTac MXH',
    website: 'https://tangtuongtacmxh.vn',
    apiUrl: 'https://tangtuongtacmxh.vn/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TIKTOK', 'INSTAGRAM', 'TELEGRAM'],
    rating: 9.2,
    avgResponseMs: 210,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'ttt_tt_saves',
        name: 'TikTok Video Saves & Shares Farm Hub',
        category: 'TikTok Engagement',
        rate: '0.025',
        min: '100',
        max: '2000000',
        network: 'TIKTOK'
      }
    ]
  },
  {
    id: 'bulkfollow_br',
    name: 'BulkFollow Brasil',
    website: 'https://bulkfollow.com',
    apiUrl: 'https://bulkfollow.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'],
    rating: 9.6,
    avgResponseMs: 155,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'bfbr_ig_likes',
        name: 'Instagram High Retention Likes [Real Brazil IP]',
        category: 'Instagram Likes',
        rate: '0.025',
        min: '50',
        max: '1000000',
        network: 'INSTAGRAM'
      },
      {
        service: 'bfbr_ig_reels',
        name: 'Instagram Reels Viral Views [Fast Start]',
        category: 'Instagram Views',
        rate: '0.009',
        min: '100',
        max: '10000000',
        network: 'INSTAGRAM'
      }
    ]
  },
  {
    id: 'gramlikes_br',
    name: 'GramLikes Brasil',
    website: 'https://gramlikes.com.br',
    apiUrl: 'https://gramlikes.com.br/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['INSTAGRAM', 'TIKTOK'],
    rating: 9.3,
    avgResponseMs: 170,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'glbr_ig_followers',
        name: 'Instagram Real Followers [Brazil Geo Mixed]',
        category: 'Instagram Followers',
        rate: '0.45',
        min: '20',
        max: '50000',
        network: 'INSTAGRAM'
      }
    ]
  },
  {
    id: 'topfama_smm',
    name: 'Top Fama SMM',
    website: 'https://topfama.com',
    apiUrl: 'https://topfama.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance'],
    primaryNetworks: ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'],
    rating: 9.1,
    avgResponseMs: 185,
    features: {
      dripfeed: true,
      refill: false,
      cancel: true,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'tf_tt_likes',
        name: 'TikTok Real Latin Likes [Fast Flow]',
        category: 'TikTok Likes',
        rate: '0.065',
        min: '50',
        max: '500000',
        network: 'TIKTOK'
      }
    ]
  },
  {
    id: 'hypesmm_com',
    name: 'HypeSMM',
    website: 'https://hypesmm.com',
    apiUrl: 'https://hypesmm.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['TELEGRAM', 'INSTAGRAM', 'TIKTOK'],
    rating: 9.8,
    avgResponseMs: 105,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'hype_tg_boost',
        name: 'Telegram Channel Level Boost [Story Unlocking, 30D]',
        category: 'Telegram Boosts',
        rate: '0.14',
        min: '1',
        max: '1000',
        network: 'TELEGRAM'
      },
      {
        service: 'hype_tg_views',
        name: 'Telegram Auto-Post Views [Super High Speed]',
        category: 'Telegram Views',
        rate: '0.005',
        min: '100',
        max: '2000000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'smmsoc_com',
    name: 'SMMSoc Direct',
    website: 'https://smmsoc.com',
    apiUrl: 'https://smmsoc.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TELEGRAM'],
    rating: 9.5,
    avgResponseMs: 130,
    features: {
      dripfeed: true,
      refill: true,
      cancel: false,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'soc_tg_boost_7d',
        name: 'Telegram Boost Level 1-5 [7 Days Fast Delivery]',
        category: 'Telegram Boosts',
        rate: '0.12',
        min: '1',
        max: '500',
        network: 'TELEGRAM'
      },
      {
        service: 'soc_tg_members',
        name: 'Telegram Channel Members [Premium Avatars]',
        category: 'Telegram Members',
        rate: '0.65',
        min: '100',
        max: '200000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'followdeh_com',
    name: 'Followdeh',
    website: 'https://followdeh.com',
    apiUrl: 'https://followdeh.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['TELEGRAM', 'INSTAGRAM'],
    rating: 9.4,
    avgResponseMs: 140,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'fdeh_tg_members',
        name: 'Telegram Global Channel Members [Low Drop]',
        category: 'Telegram Members',
        rate: '0.38',
        min: '100',
        max: '100000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'smmraja_com',
    name: 'SMM Raja',
    website: 'https://smmraja.com',
    apiUrl: 'https://smmraja.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['YOUTUBE', 'INSTAGRAM', 'TELEGRAM'],
    rating: 9.6,
    avgResponseMs: 150,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'raja_yt_hours',
        name: 'YouTube 4000 Hours Monetization Pack [Non-Drop Watchtime]',
        category: 'YouTube Watch Hours',
        rate: '1.85',
        min: '100',
        max: '4000',
        network: 'YOUTUBE'
      },
      {
        service: 'raja_yt_subs',
        name: 'YouTube Real Subscribers [Lifetime Refill]',
        category: 'YouTube Subscribers',
        rate: '3.10',
        min: '50',
        max: '100000',
        network: 'YOUTUBE'
      }
    ]
  },
  {
    id: 'sosyalbayiniz_net',
    name: 'SosyalBayiniz Turkey',
    website: 'https://sosyalbayiniz.net',
    apiUrl: 'https://sosyalbayiniz.net/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['INSTAGRAM', 'TIKTOK', 'TELEGRAM'],
    rating: 9.5,
    avgResponseMs: 120,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'sb_ig_views',
        name: 'Instagram Reel Views [Turkish Direct Mobile Pool]',
        category: 'Instagram Views',
        rate: '0.018',
        min: '100',
        max: '5000000',
        network: 'INSTAGRAM'
      },
      {
        service: 'sb_tg_boost',
        name: 'Telegram Channel Boost Instant [Turkish SIMs]',
        category: 'Telegram Boosts',
        rate: '0.15',
        min: '1',
        max: '500',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'growtak_com',
    name: 'Growtak',
    website: 'https://growtak.com',
    apiUrl: 'https://growtak.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['YOUTUBE', 'TIKTOK'],
    rating: 9.4,
    avgResponseMs: 160,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'gt_yt_high_retention',
        name: 'YouTube High Retention Suggested Video Views',
        category: 'YouTube Views',
        rate: '0.45',
        min: '500',
        max: '5000000',
        network: 'YOUTUBE'
      },
      {
        service: 'gt_tt_livestream',
        name: 'TikTok Live Stream Concurrent Viewers [60 Mins]',
        category: 'TikTok Live',
        rate: '0.85',
        min: '10',
        max: '50000',
        network: 'TIKTOK'
      }
    ]
  }
];

function main() {
  const providersPath = path.resolve('src/data/providers/smm-direct-providers.json');
  const existing: ProviderProfile[] = JSON.parse(fs.readFileSync(providersPath, 'utf8'));

  const existingIds = new Set(existing.map(p => p.id));
  const toAdd = NEW_PROVIDERS_V7.filter(p => !existingIds.has(p.id));

  console.log(`Current provider count: ${existing.length}`);
  console.log(`New providers to add: ${toAdd.length}`);

  if (toAdd.length === 0) {
    console.log('No new unique providers to append.');
    return;
  }

  const updated = [...existing, ...toAdd];
  fs.writeFileSync(providersPath, JSON.stringify(updated, null, 2), 'utf8');
  console.log(`Updated providers count: ${updated.length} saved to ${providersPath}`);
}

main();
