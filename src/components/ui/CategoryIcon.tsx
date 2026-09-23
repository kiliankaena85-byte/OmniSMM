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
 * Strips leading decorative emojis from category names
 * (to prevent duplicating the left-hand visual SVG icon)
 * while safely preserving inline reaction emojis (e.g. "Реакции (👍, ❤️, 🔥)"), Cyrillic text, numbers, and punctuation.
 */
export const cleanCategoryName = (rawName: string): string => {
  if (!rawName) return "";
  let stripped = rawName
    .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\u200d\uFE0E\uFE0F\u2700-\u27BF\uE000-\uF8FF\s]+/gu, '')
    .replace(/\s*\[(?:Сервер|Server|Srv|API|Провайдер)[\s:]*\d+\]/gi, '')
    .replace(/\s*\((?:vexboost live|vexboost|api\s*\d+|srv\s*\d+|сервер\s*\d+)\)/gi, '')
    .replace(/\bvexboost live\b/gi, 'Онлайн-просмотры')
    .replace(/\bvexboost\b/gi, '')
    .replace(/\s*♻️/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  // If the string consisted solely of emojis (e.g. "👍"), fallback to trimmed original
  return stripped.length > 0 ? stripped : rawName.trim();
};

