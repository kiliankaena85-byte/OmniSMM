import React from "react";
import { 
  Heart, Eye, Users, MessageCircle, ThumbsUp, Share, RefreshCw, 
  TrendingUp, BarChart2, History, Bot, Link, UserPlus, 
  PlayCircle, Globe, ThumbsDown, Star, Bookmark, AlertTriangle, 
  Radio, Crown, RotateCcw, Box
} from "lucide-react";
import { UniversalIcon } from "@/components/ui/UniversalIcon";

export interface CategoryIconProps {
  name?: string;
  icon?: string | null;
  className?: string;
  size?: number;
}

export const CategoryIcon = ({ name = "", icon, className, size = 20 }: CategoryIconProps) => {
  if (icon) {
    return <UniversalIcon icon={icon} className={className} size={size} />;
  }

  const norm = (name || "").toLowerCase();
  
  let IconCmp = Box;
  
  if (norm.includes('лайк') || norm.includes('нравится')) IconCmp = Heart;
  else if (norm.includes('просмотр') || norm.includes('охват')) IconCmp = Eye;
  else if (norm.includes('подписч') || norm.includes('участник')) IconCmp = Users;
  else if (norm.includes('вступление') || norm.includes('группы')) IconCmp = UserPlus;
  else if (norm.includes('коммент') || norm.includes('отзыв')) IconCmp = MessageCircle;
  else if (norm.includes('реакц') || norm.includes('эмодзи')) IconCmp = ThumbsUp;
  else if (norm.includes('репост') || norm.includes('поделит')) IconCmp = Share;
  else if (norm.includes('авто')) IconCmp = RefreshCw;
  else if (norm.includes('буст') || norm.includes('уровен')) IconCmp = TrendingUp;
  else if (norm.includes('опрос') || norm.includes('голос')) IconCmp = BarChart2;
  else if (norm.includes('истори') || norm.includes('стори')) IconCmp = History;
  else if (norm.includes('бот')) IconCmp = Bot;
  else if (norm.includes('реферал')) IconCmp = Link;
  else if (norm.includes('друзья')) IconCmp = UserPlus;
  else if (norm.includes('прослуш') || norm.includes('плейлист') || norm.includes('plays')) IconCmp = PlayCircle;
  else if (norm.includes('трафик') || norm.includes('посещен')) IconCmp = Globe;
  else if (norm.includes('дизлайк')) IconCmp = ThumbsDown;
  else if (norm.includes('звезд') || norm.includes('star')) IconCmp = Star;
  else if (norm.includes('сохранен')) IconCmp = Bookmark;
  else if (norm.includes('жалоб') || norm.includes('report')) IconCmp = AlertTriangle;
  else if (norm.includes('стрим') || norm.includes('эфир') || norm.includes('зрител')) IconCmp = Radio;
  else if (norm.includes('премиум') || norm.includes('premium')) IconCmp = Crown;
  else if (norm.includes('докрут') || norm.includes('восстанов')) IconCmp = RotateCcw;

  return <IconCmp className={className} strokeWidth={1.5} size={size} />;
};

/**
 * Strips leading decorative emojis, technical tags, and redundant social network prefixes
 * from category names to ensure a clean, minimalist storefront hierarchy.
 * E.g. "Telegram — Подписчики (Обычные)" -> "Подписчики (Обычные)"
 * E.g. "TikTok > Лайки" -> "Лайки"
 * E.g. "VK — Просмотры видео" -> "Просмотры видео"
 */
export const cleanCategoryName = (rawName?: string | null, networkName?: string | null): string => {
  if (!rawName) return "";
  let stripped = rawName
    // 1. Strip leading decorative emojis
    .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\u200d\uFE0E\uFE0F\u2700-\u27BF\uE000-\uF8FF\s]+/gu, '')
    // 2. Strip technical tags & provider artifacts
    .replace(/\s*\[(?:Сервер|Server|Srv|API|Провайдер)[\s:]*\d+\]/gi, '')
    .replace(/\s*\((?:vexboost live|vexboost|api\s*\d+|srv\s*\d+|сервер\s*\d+)\)/gi, '')
    .replace(/\bvexboost live\b/gi, 'Онлайн-просмотры')
    .replace(/\bvexboost\b/gi, '')
    .replace(/\s*♻️/gu, '')
    // Strip trailing warranty / guarantee badges in category titles
    .replace(/\s*\|?\s*[\p{Extended_Pictographic}\p{Emoji_Presentation}\u200d\uFE0E\uFE0F]*\s*(?:С гарантией|Без гарантии)/gui, '')
    .replace(/\s*\|\s*$/g, '')
    .trim();

  // 3. Strip dynamic network prefix if networkName is provided
  if (networkName && networkName.trim()) {
    const escapedNet = networkName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dynamicNetRegex = new RegExp(`^${escapedNet}\\s*(?:—|–|-|>|:|\/|\\s)\\s*`, 'i');
    stripped = stripped.replace(dynamicNetRegex, '').trim();
  }

  // 4. Strip known hardcoded network prefixes (Telegram, VK, TikTok, YouTube, etc.)
  const knownNetworksRegex = /^(?:Telegram\s+Premium|Telegram|ВКонтакте|Вконтакте|VK|YouTube|Youtube|TikTok|Tiktok|Instagram|Insta|Rutube|Twitch|Facebook|Twitter|Discord)\s*(?:—|–|-|>|:|\/|\s)\s*/i;
  stripped = stripped.replace(knownNetworksRegex, '').trim();

  // 5. Clean up duplicate spaces and symbols
  stripped = stripped
    .replace(/^[—–\-:>\/\s]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 6. Fallback if stripping emptied the string (e.g. if the category was just named "Telegram")
  if (!stripped || stripped.length === 0) {
    return rawName.trim();
  }

  // Capitalize first character
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
};


