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

const NEW_PROVIDERS: ProviderProfile[] = [
  {
    id: 'socialmatrix',
    name: 'SocialMatrix',
    website: 'https://socialmatrix.io',
    apiUrl: 'https://socialmatrix.io/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['TELEGRAM', 'INSTAGRAM', 'YOUTUBE', 'TIKTOK'],
    rating: 9.6,
    avgResponseMs: 145,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'sm_tg_boost',
        name: 'Telegram Channel Boost [Instant Level 1-10]',
        category: 'Telegram Boosts',
        rate: '0.19',
        min: '1',
        max: '500',
        network: 'TELEGRAM'
      },
      {
        service: 'sm_tg_views',
        name: 'Telegram Fast Post Views [Real Users]',
        category: 'Telegram Views',
        rate: '0.008',
        min: '100',
        max: '500000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'smmorange',
    name: 'SMM Orange',
    website: 'https://smmorange.com',
    apiUrl: 'https://smmorange.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TELEGRAM', 'TIKTOK', 'INSTAGRAM', 'YOUTUBE'],
    rating: 9.5,
    avgResponseMs: 160,
    features: {
      dripfeed: true,
      refill: true,
      cancel: false,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'sorg_tt_views',
        name: 'TikTok Video Views [Ultra Fast High Retention]',
        category: 'TikTok Views',
        rate: '0.012',
        min: '100',
        max: '10000000',
        network: 'TIKTOK'
      },
      {
        service: 'sorg_tg_members',
        name: 'Telegram Channel Members [Global Non-Drop]',
        category: 'Telegram Members',
        rate: '0.65',
        min: '50',
        max: '50000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'dreamsmmpanel',
    name: 'Dream SMM Panel',
    website: 'https://dreamsmmpanel.com',
    apiUrl: 'https://dreamsmmpanel.com/api/v2',
    tier: 2,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['YOUTUBE', 'TELEGRAM', 'FACEBOOK', 'INSTAGRAM'],
    rating: 9.3,
    avgResponseMs: 220,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'dream_yt_views',
        name: 'YouTube Watch Time Hours [Monetization Ready]',
        category: 'YouTube Watch Hours',
        rate: '1.95',
        min: '100',
        max: '4000',
        network: 'YOUTUBE'
      },
      {
        service: 'dream_yt_subs',
        name: 'YouTube Subscribers [Real Profiles Non-Drop]',
        category: 'YouTube Subscribers',
        rate: '4.80',
        min: '20',
        max: '10000',
        network: 'YOUTUBE'
      }
    ]
  },
  {
    id: 'liketide',
    name: 'LikeTide',
    website: 'https://liketide.com',
    apiUrl: 'https://liketide.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['TELEGRAM', 'INSTAGRAM', 'TIKTOK'],
    rating: 9.4,
    avgResponseMs: 130,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'lt_tg_reactions',
        name: 'Telegram Reactions Positive [Thumbs Up/Fire/Heart]',
        category: 'Telegram Reactions',
        rate: '0.04',
        min: '50',
        max: '100000',
        network: 'TELEGRAM'
      },
      {
        service: 'lt_ig_likes',
        name: 'Instagram Likes [High Speed No Drop]',
        category: 'Instagram Likes',
        rate: '0.12',
        min: '50',
        max: '50000',
        network: 'INSTAGRAM'
      }
    ]
  },
  {
    id: 'autosmo',
    name: 'AutoSMO',
    website: 'https://autosmo.com',
    apiUrl: 'https://autosmo.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance'],
    primaryNetworks: ['TELEGRAM', 'X', 'TWITCH', 'KICK'],
    rating: 9.4,
    avgResponseMs: 155,
    features: {
      dripfeed: true,
      refill: false,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'asmo_kick_views',
        name: 'Kick Live Stream Viewers [60 Minutes Dedicated]',
        category: 'Kick Stream',
        rate: '0.75',
        min: '10',
        max: '5000',
        network: 'KICK'
      }
    ]
  },
  {
    id: 'mitiklive',
    name: 'MitikLive',
    website: 'https://mitiklive.com',
    apiUrl: 'https://mitiklive.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TWITCH', 'KICK', 'YOUTUBE'],
    rating: 9.6,
    avgResponseMs: 140,
    features: {
      dripfeed: false,
      refill: true,
      cancel: true,
      channelBoosts: false,
      autoViews: false
    },
    benchmarkServices: [
      {
        service: 'mitik_twitch_1h',
        name: 'Twitch Live Stream Viewers [1 Hour Stable Chatters]',
        category: 'Twitch Stream',
        rate: '0.68',
        min: '20',
        max: '10000',
        network: 'TWITCH'
      }
    ]
  },
  {
    id: 'luvsmm',
    name: 'LuvSMM',
    website: 'https://luvsmm.com',
    apiUrl: 'https://luvsmm.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['INSTAGRAM', 'TIKTOK', 'TELEGRAM'],
    rating: 9.5,
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
        service: 'luv_ig_followers',
        name: 'Instagram Followers [HQ Real Looking Non-Drop 365d]',
        category: 'Instagram Followers',
        rate: '0.98',
        min: '50',
        max: '100000',
        network: 'INSTAGRAM'
      }
    ]
  },
  {
    id: 'smmhub_com',
    name: 'SMM-Hub.com',
    website: 'https://smm-hub.com',
    apiUrl: 'https://smm-hub.com/api/v2',
    tier: 2,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TELEGRAM', 'VK', 'YOUTUBE', 'TIKTOK'],
    rating: 9.3,
    avgResponseMs: 180,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'hub_tg_views',
        name: 'Telegram Auto Views on Last 10 Posts',
        category: 'Telegram Auto Views',
        rate: '0.045',
        min: '50',
        max: '100000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'smmpanelix',
    name: 'SMM Panelix',
    website: 'https://smmpanelix.com',
    apiUrl: 'https://smmpanelix.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TIKTOK', 'INSTAGRAM', 'TELEGRAM'],
    rating: 9.4,
    avgResponseMs: 175,
    features: {
      dripfeed: true,
      refill: true,
      cancel: false,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'plx_tt_likes',
        name: 'TikTok Likes [Real Active Users]',
        category: 'TikTok Likes',
        rate: '0.38',
        min: '50',
        max: '500000',
        network: 'TIKTOK'
      }
    ]
  },
  {
    id: 'iluvsmmpanel',
    name: 'iLuvSMMPanel',
    website: 'https://iluvsmmpanel.com',
    apiUrl: 'https://iluvsmmpanel.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TELEGRAM', 'YOUTUBE', 'INSTAGRAM'],
    rating: 9.4,
    avgResponseMs: 160,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'iluv_tg_boost',
        name: 'Telegram Level Boosts [Instant Activation]',
        category: 'Telegram Boosts',
        rate: '0.22',
        min: '1',
        max: '1000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'buildfollows',
    name: 'BuildFollows',
    website: 'https://buildfollows.com',
    apiUrl: 'https://buildfollows.com/api/v2',
    tier: 2,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['INSTAGRAM', 'TIKTOK', 'FACEBOOK'],
    rating: 9.3,
    avgResponseMs: 190,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: false,
      autoViews: false
    },
    benchmarkServices: [
      {
        service: 'bf_ig_followers',
        name: 'Instagram Non-Drop Followers [Refill 30 Days]',
        category: 'Instagram Followers',
        rate: '0.85',
        min: '50',
        max: '100000',
        network: 'INSTAGRAM'
      }
    ]
  },
  {
    id: 'getmyfollow',
    name: 'GetMyFollow',
    website: 'https://getmyfollow.com',
    apiUrl: 'https://getmyfollow.com/api/v2',
    tier: 2,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['YOUTUBE', 'TIKTOK', 'TELEGRAM'],
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
        service: 'gmf_yt_views',
        name: 'YouTube High Retention Views [Suggested Videos]',
        category: 'YouTube Views',
        rate: '1.20',
        min: '500',
        max: '5000000',
        network: 'YOUTUBE'
      }
    ]
  },
  {
    id: 'ceofame',
    name: 'CEOFame',
    website: 'https://ceofame.com',
    apiUrl: 'https://ceofame.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['TELEGRAM', 'INSTAGRAM', 'TIKTOK'],
    rating: 9.5,
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
        service: 'ceo_tg_stars',
        name: 'Telegram Star Reactions [Instant Verified]',
        category: 'Telegram Stars',
        rate: '0.018',
        min: '20',
        max: '50000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'smmpanelcimm',
    name: 'SMMPanelcimm (Turkey Hub)',
    website: 'https://smmpanelcimm.com.tr',
    apiUrl: 'https://smmpanelcimm.com.tr/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['INSTAGRAM', 'TIKTOK', 'TELEGRAM'],
    rating: 9.6,
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
        service: 'tr_ig_views',
        name: 'Instagram Reels Views [Turkish Direct Mobile Farm]',
        category: 'Instagram Views',
        rate: '0.025',
        min: '100',
        max: '10000000',
        network: 'INSTAGRAM'
      },
      {
        service: 'tr_tg_members',
        name: 'Telegram Real Turkish Members [High Retention]',
        category: 'Telegram Members',
        rate: '0.78',
        min: '50',
        max: '25000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'kliksosmed',
    name: 'KlikSosmed (Indonesia Hub)',
    website: 'https://kliksosmed.id',
    apiUrl: 'https://kliksosmed.id/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TIKTOK', 'FACEBOOK', 'TELEGRAM', 'YOUTUBE'],
    rating: 9.6,
    avgResponseMs: 165,
    features: {
      dripfeed: true,
      refill: true,
      cancel: false,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'id_tt_shares',
        name: 'TikTok Video Shares & Saves [Boost FYP Algorithm]',
        category: 'TikTok Engagement',
        rate: '0.045',
        min: '100',
        max: '500000',
        network: 'TIKTOK'
      },
      {
        service: 'id_fb_followers',
        name: 'Facebook Page Followers [Indonesian Farm]',
        category: 'Facebook Followers',
        rate: '0.62',
        min: '100',
        max: '50000',
        network: 'FACEBOOK'
      }
    ]
  },
  {
    id: 'buzzerpanel',
    name: 'BuzzerPanel (Indonesia Farm)',
    website: 'https://buzzerpanel.id',
    apiUrl: 'https://buzzerpanel.id/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TIKTOK', 'INSTAGRAM', 'TWITTER'],
    rating: 9.5,
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
        service: 'bp_tt_views',
        name: 'TikTok Views Direct Android Cluster [Instant]',
        category: 'TikTok Views',
        rate: '0.009',
        min: '100',
        max: '50000000',
        network: 'TIKTOK'
      }
    ]
  },
  {
    id: 'providersmm_id',
    name: 'ProviderSMM.id (Direct Indonesia)',
    website: 'https://providersmm.id',
    apiUrl: 'https://providersmm.id/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['TELEGRAM', 'TIKTOK', 'YOUTUBE', 'INSTAGRAM'],
    rating: 9.7,
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
        service: 'psmm_tg_views',
        name: 'Telegram Views [Direct Farm Cluster]',
        category: 'Telegram Views',
        rate: '0.006',
        min: '100',
        max: '1000000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'smmpanel_in',
    name: 'SMMPanel.in (India Hub)',
    website: 'https://smm-panel.in',
    apiUrl: 'https://smm-panel.in/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['YOUTUBE', 'TELEGRAM', 'INSTAGRAM'],
    rating: 9.5,
    avgResponseMs: 175,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'in_yt_views',
        name: 'YouTube Views [Fast Real Devices]',
        category: 'YouTube Views',
        rate: '0.85',
        min: '500',
        max: '1000000',
        network: 'YOUTUBE'
      }
    ]
  },
  {
    id: 'thesoulsmm',
    name: 'TheSoulSMM',
    website: 'https://thesoulsmm.in',
    apiUrl: 'https://thesoulsmm.in/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['YOUTUBE', 'TIKTOK', 'TELEGRAM'],
    rating: 9.4,
    avgResponseMs: 160,
    features: {
      dripfeed: true,
      refill: true,
      cancel: false,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'soul_yt_comments',
        name: 'YouTube Custom Comments [English/Multi-language]',
        category: 'YouTube Comments',
        rate: '3.40',
        min: '10',
        max: '5000',
        network: 'YOUTUBE'
      }
    ]
  },
  {
    id: 'ethicalsmm',
    name: 'EthicalSMM',
    website: 'https://ethicalsmm.in',
    apiUrl: 'https://ethicalsmm.in/api/v2',
    tier: 2,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['INSTAGRAM', 'TELEGRAM', 'LINKEDIN'],
    rating: 9.3,
    avgResponseMs: 190,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: false,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'eth_linkedin_followers',
        name: 'LinkedIn Company Page Followers [Safe Pace]',
        category: 'LinkedIn Followers',
        rate: '4.50',
        min: '50',
        max: '10000',
        network: 'OTHER'
      }
    ]
  },
  {
    id: 'followeran',
    name: 'Followeran',
    website: 'https://followeran.in',
    apiUrl: 'https://followeran.in/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['TELEGRAM', 'VK', 'INSTAGRAM', 'TIKTOK'],
    rating: 9.6,
    avgResponseMs: 145,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'flw_tg_boost',
        name: 'Telegram Boosts [7 Days Instant Delivery]',
        category: 'Telegram Boosts',
        rate: '0.17',
        min: '1',
        max: '500',
        network: 'TELEGRAM'
      },
      {
        service: 'flw_vk_followers',
        name: 'VK Community Followers [Non-Drop Safe]',
        category: 'VK Followers',
        rate: '1.45',
        min: '50',
        max: '50000',
        network: 'VK'
      }
    ]
  },
  {
    id: 'bzkj_io',
    name: 'BZKJ.io (Asian Farm Gateway)',
    website: 'https://bzkj.io',
    apiUrl: 'https://bzkj.io/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TELEGRAM', 'TIKTOK', 'TWITTER'],
    rating: 9.6,
    avgResponseMs: 135,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'bzkj_tg_views',
        name: 'Telegram Views [Ultra Cheap Volume Pipeline]',
        category: 'Telegram Views',
        rate: '0.005',
        min: '500',
        max: '5000000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'smmheavy',
    name: 'SMMHeavy',
    website: 'https://smmheavy.com',
    apiUrl: 'https://smmheavy.com/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['TELEGRAM', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE'],
    rating: 9.5,
    avgResponseMs: 150,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'heavy_tg_members',
        name: 'Telegram 0% Drop Channel Subscribers [30 Days Refill]',
        category: 'Telegram Members',
        rate: '0.72',
        min: '100',
        max: '100000',
        network: 'TELEGRAM'
      }
    ]
  },
  {
    id: 'socialboss_io',
    name: 'SocialBoss.io',
    website: 'https://socialboss.io',
    apiUrl: 'https://socialboss.io/api/v2',
    tier: 2,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill'],
    primaryNetworks: ['TELEGRAM', 'INSTAGRAM', 'YOUTUBE', 'SPOTIFY'],
    rating: 9.4,
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
        service: 'sb_spotify_plays',
        name: 'Spotify Track Streams [Premium USA/EU]',
        category: 'Spotify Streams',
        rate: '1.10',
        min: '1000',
        max: '1000000',
        network: 'OTHER'
      }
    ]
  },
  {
    id: 'boostgram_pro',
    name: 'BoostGram.pro',
    website: 'https://boostgram.pro',
    apiUrl: 'https://boostgram.pro/api/v2',
    tier: 1,
    currency: 'USD',
    supportedMethods: ['services', 'add', 'status', 'balance', 'refill', 'cancel'],
    primaryNetworks: ['TELEGRAM'],
    rating: 9.8,
    avgResponseMs: 110,
    features: {
      dripfeed: true,
      refill: true,
      cancel: true,
      channelBoosts: true,
      autoViews: true
    },
    benchmarkServices: [
      {
        service: 'bgp_boost_7d',
        name: 'Telegram Level Boost [7 Days Guaranteed]',
        category: 'Telegram Boosts',
        rate: '0.15',
        min: '1',
        max: '2000',
        network: 'TELEGRAM'
      },
      {
        service: 'bgp_boost_30d',
        name: 'Telegram Level Boost [30 Days Guaranteed]',
        category: 'Telegram Boosts',
        rate: '0.48',
        min: '1',
        max: '1000',
        network: 'TELEGRAM'
      }
    ]
  }
];

function main() {
  const filePath = path.resolve(__dirname, '../../src/data/providers/smm-direct-providers.json');
  const existing: ProviderProfile[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`[INFO] Текущих провайдеров в базе: ${existing.length}`);

  const existingIds = new Set(existing.map(p => p.id));
  let added = 0;

  for (const np of NEW_PROVIDERS) {
    if (!existingIds.has(np.id)) {
      existing.push(np);
      existingIds.add(np.id);
      added++;
      console.log(`  + Добавлен новый первоисточник: [${np.name}] (${np.apiUrl})`);
    } else {
      console.log(`  ! Пропущен дубликат: ${np.id}`);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
  console.log(`\n[SUCCESS] Успешно добавлено ${added} новых оптовых провайдеров!`);
  console.log(`[TOTAL] Всего провайдеров в реестре OmniSMM: ${existing.length}`);
}

main();
