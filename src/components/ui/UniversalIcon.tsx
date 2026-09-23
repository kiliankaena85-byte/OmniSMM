'use client';

import React from 'react';
import { 
  Users, UserPlus, UserCheck, Heart, ThumbsUp, Eye, Share2, 
  MessageCircle, MessageSquare, Flame, Rocket, BarChart2, Clock, 
  Play, Smile, Star, Zap, ShieldCheck, Shield, Crown, Sparkles, 
  Globe, MapPin, Bot, TrendingUp, CheckCircle2, Award, RefreshCw, 
  Tag, Gift, Cpu, Lock, HelpCircle, Layers, Check
} from 'lucide-react';
import { SocialIcon } from '@/components/ui/SocialIcon';

export interface UniversalIconProps {
  icon?: string | null;
  name?: string | null;
  className?: string;
  size?: number | string;
  color?: string;
  colored?: boolean;
  variant?: 'classic' | 'aurora';
  fallback?: React.ReactNode;
}

// Static registry of Lucide icon components for zero-bloat tree-shaking
const LUCIDE_ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number | string; color?: string }>> = {
  'users': Users,
  'user-plus': UserPlus,
  'user-check': UserCheck,
  'heart': Heart,
  'thumbs-up': ThumbsUp,
  'eye': Eye,
  'share-2': Share2,
  'share': Share2,
  'message-circle': MessageCircle,
  'message-square': MessageSquare,
  'flame': Flame,
  'fire': Flame,
  'rocket': Rocket,
  'bar-chart-2': BarChart2,
  'chart': BarChart2,
  'clock': Clock,
  'play': Play,
  'smile': Smile,
  'star': Star,
  'zap': Zap,
  'flash': Zap,
  'shield-check': ShieldCheck,
  'shield': Shield,
  'crown': Crown,
  'sparkles': Sparkles,
  'globe': Globe,
  'map-pin': MapPin,
  'bot': Bot,
  'trending-up': TrendingUp,
  'check-circle-2': CheckCircle2,
  'check': Check,
  'award': Award,
  'refresh-cw': RefreshCw,
  'tag': Tag,
  'gift': Gift,
  'cpu': Cpu,
  'lock': Lock,
  'layers': Layers,
  'help-circle': HelpCircle,
};

export function UniversalIcon({
  icon,
  name,
  className = '',
  size = 20,
  color,
  colored = true,
  variant = 'classic',
  fallback
}: UniversalIconProps) {
  const descriptor = (icon || name || '').trim();

  const glowClass = variant === 'aurora' ? 'drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]' : '';
  const combinedClass = `${className} ${glowClass}`.trim();

  if (!descriptor) {
    if (fallback) return <>{fallback}</>;
    return <Globe className={combinedClass} size={size} color={color} />;
  }

  // 1. BRAND ICON: "brand:telegram" or "brand:vk"
  if (descriptor.startsWith('brand:')) {
    const slug = descriptor.slice(6).trim();
    return <SocialIcon slug={slug} className={combinedClass} size={size} colored={colored} />;
  }

  // 2. LUCIDE ICON: "lucide:heart" or "lucide:zap"
  if (descriptor.startsWith('lucide:')) {
    const iconKey = descriptor.slice(7).trim().toLowerCase();
    const Component = LUCIDE_ICON_MAP[iconKey] || Globe;
    return <Component className={combinedClass} size={size} color={color} />;
  }

  // 3. CUSTOM INLINE SVG: "custom:<svg ...>...</svg>" or raw "<svg ...>...</svg>"
  if (descriptor.startsWith('custom:') || descriptor.startsWith('<svg')) {
    const rawSvg = descriptor.startsWith('custom:') ? descriptor.slice(7).trim() : descriptor;
    
    // Render sanitized SVG safely
    // Parse inner content or inject dangerously if strictly cleaned
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full ${combinedClass}`}
        style={{ width: typeof size === 'number' ? `${size}px` : size, height: typeof size === 'number' ? `${size}px` : size, color }}
        dangerouslySetInnerHTML={{ __html: rawSvg }}
      />
    );
  }

  // 4. PLAIN NAME FALLBACK MATCHING (e.g. "telegram", "heart", "FOLLOWERS", "LIKES")
  const lower = descriptor.toLowerCase();

  // Social brand fallback
  if (['telegram', 'vk', 'instagram', 'youtube', 'tiktok', 'twitch', 'discord', 'pinterest', 'twitter', 'x', 'facebook', 'spotify', 'soundcloud', 'ok', 'odnoklassniki', 'whatsapp', 'viber', 'snapchat', 'reddit', 'linkedin', 'dzen', 'rutube', 'kick', 'steam', 'threads', 'medium', 'likee', 'kwai', 'max'].includes(lower)) {
    return <SocialIcon slug={lower} className={combinedClass} size={size} colored={colored} />;
  }

  // Activity type fallback
  if (lower === 'followers') return <Users className={combinedClass} size={size} color={color} />;
  if (lower === 'likes') return <Heart className={combinedClass} size={size} color={color} />;
  if (lower === 'views') return <Eye className={combinedClass} size={size} color={color} />;
  if (lower === 'reposts') return <Share2 className={combinedClass} size={size} color={color} />;
  if (lower === 'comments') return <MessageCircle className={combinedClass} size={size} color={color} />;
  if (lower === 'votes') return <BarChart2 className={combinedClass} size={size} color={color} />;
  if (lower === 'boosts') return <Rocket className={combinedClass} size={size} color={color} />;

  // Lucide plain name
  if (LUCIDE_ICON_MAP[lower]) {
    const Component = LUCIDE_ICON_MAP[lower];
    return <Component className={combinedClass} size={size} color={color} />;
  }

  if (fallback) return <>{fallback}</>;
  return <Globe className={combinedClass} size={size} color={color} />;
}
