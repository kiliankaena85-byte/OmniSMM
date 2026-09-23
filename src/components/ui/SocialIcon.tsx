'use client';

import React from "react";
import { 
  FaTelegramPlane, 
  FaVk, 
  FaInstagram, 
  FaYoutube, 
  FaTiktok, 
  FaTwitch, 
  FaDiscord,
  FaGlobe,
  FaFacebookF,
  FaOdnoklassniki,
  FaViber,
  FaWhatsapp,
  FaSnapchatGhost,
  FaRedditAlien,
  FaLinkedinIn,
  FaLine,
  FaPlay,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  FaYandex,
  FaSteam,
  FaMediumM,
  FaHeart,
  FaVideo
} from "react-icons/fa";
import { 
  SiPinterest, 
  SiX, 
  SiSpotify, 
  SiSoundcloud,
  SiWechat,
  SiKick,
  SiThreads
} from "react-icons/si";

interface SocialIconProps {
  slug: string;
  className?: string;
  size?: number | string;
  colored?: boolean;
}

export function SocialIcon({ slug, className = "", size = 24, colored = true }: SocialIconProps) {
  const norm = (slug || "").toLowerCase();
  
  const iconProps = (hex: string) => ({
    className,
    size,
    color: colored ? hex : undefined
  });

  if (norm.includes('telegram') || norm.includes('tg')) return <FaTelegramPlane {...iconProps('#2AABEE')} />;
  if (norm.includes('max')) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        xmlSpace="preserve" 
        viewBox="0 0 1000 1000" 
        className={className} 
        width={size} 
        height={size}
      >
        <defs>
          <linearGradient id="max-grad-b">
            <stop offset="0" stopColor="#00f"/>
            <stop offset="1" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="max-grad-a">
            <stop offset="0" stopColor="#4cf"/>
            <stop offset=".662" stopColor="#53e"/>
            <stop offset="1" stopColor="#93d"/>
          </linearGradient>
          <linearGradient id="max-grad-c" x1="117.847" x2="1000" y1="760.536" y2="500" gradientUnits="userSpaceOnUse" href="#max-grad-a"/>
          <radialGradient id="max-grad-d" cx="-87.392" cy="1166.116" r="500" fx="-87.392" fy="1166.116" gradientTransform="rotate(51.356 1551.478 559.3) scale(2.42703433 1)" gradientUnits="userSpaceOnUse" href="#max-grad-b"/>
        </defs>
        {colored ? (
          <>
            <rect width="1000" height="1000" fill="url(#max-grad-c)" ry="249.681"/>
            <rect width="1000" height="1000" fill="url(#max-grad-d)" ry="249.681"/>
            <path fill="#fff" fillRule="evenodd" d="M508.211 878.328c-75.007 0-109.864-10.95-170.453-54.75-38.325 49.275-159.686 87.783-164.979 21.9 0-49.456-10.95-91.248-23.36-136.873-14.782-56.21-31.572-118.807-31.572-209.508 0-216.626 177.754-379.597 388.357-379.597 210.785 0 375.947 171.001 375.947 381.604.707 207.346-166.595 376.118-373.94 377.224m3.103-571.585c-102.564-5.292-182.499 65.7-200.201 177.024-14.6 92.162 11.315 204.398 33.397 210.238 10.585 2.555 37.23-18.98 53.837-35.587a189.8 189.8 0 0 0 92.71 33.032c106.273 5.112 197.08-75.794 204.215-181.95 4.154-106.382-77.67-196.486-183.958-202.574Z" clipRule="evenodd"/>
          </>
        ) : (
          <path fill="currentColor" fillRule="evenodd" d="M508.211 878.328c-75.007 0-109.864-10.95-170.453-54.75-38.325 49.275-159.686 87.783-164.979 21.9 0-49.456-10.95-91.248-23.36-136.873-14.782-56.21-31.572-118.807-31.572-209.508 0-216.626 177.754-379.597 388.357-379.597 210.785 0 375.947 171.001 375.947 381.604.707 207.346-166.595 376.118-373.94 377.224m3.103-571.585c-102.564-5.292-182.499 65.7-200.201 177.024-14.6 92.162 11.315 204.398 33.397 210.238 10.585 2.555 37.23-18.98 53.837-35.587a189.8 189.8 0 0 0 92.71 33.032c106.273 5.112 197.08-75.794 204.215-181.95 4.154-106.382-77.67-196.486-183.958-202.574Z" clipRule="evenodd"/>
        )}
      </svg>
    );
  }
  if (norm.includes('vk') || norm.includes('vkontakte')) return <FaVk {...iconProps('#0077FF')} />;
  if (norm.includes('instagram') || norm.includes('ig')) return <FaInstagram {...iconProps('#E1306C')} />;
  if (norm.includes('youtube') || norm.includes('yt')) return <FaYoutube {...iconProps('#FF0000')} />;
  if (norm.includes('tiktok') || norm.includes('tt')) return <FaTiktok {...iconProps('#000000')} />;
  if (norm.includes('twitch')) return <FaTwitch {...iconProps('#9146FF')} />;
  if (norm.includes('discord')) return <FaDiscord {...iconProps('#5865F2')} />;
  if (norm.includes('pinterest')) return <SiPinterest {...iconProps('#E60023')} />;
  if (norm.includes('twitter') || norm.includes('x')) return <SiX {...iconProps('#000000')} />;
  if (norm.includes('facebook') || norm.includes('fb')) return <FaFacebookF {...iconProps('#1877F2')} />;
  if (norm.includes('spotify')) return <SiSpotify {...iconProps('#1DB954')} />;
  if (norm.includes('soundcloud')) return <SiSoundcloud {...iconProps('#FF3300')} />;
  if (norm.includes('odnoklassniki') || norm.includes('ok')) return <FaOdnoklassniki {...iconProps('#F58220')} />;
  
  // Additional popular networks
  if (norm.includes('whatsapp') || norm.includes('wa')) return <FaWhatsapp {...iconProps('#25D366')} />;
  if (norm.includes('viber')) return <FaViber {...iconProps('#7360F2')} />;
  if (norm.includes('snapchat') || norm.includes('sc')) return <FaSnapchatGhost {...iconProps('#FFFC00')} />;
  if (norm.includes('reddit')) return <FaRedditAlien {...iconProps('#FF4500')} />;
  if (norm.includes('linkedin')) return <FaLinkedinIn {...iconProps('#0A66C2')} />;
  if (norm.includes('line')) return <FaLine {...iconProps('#00C300')} />;
  if (norm.includes('wechat')) return <SiWechat {...iconProps('#07C160')} />;
  if (norm.includes('yandex') || norm.includes('dzen') || norm.includes('дзен')) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 100 100" 
        className={className} 
        width={size} 
        height={size}
      >
        <path d="M50 14c0 19.882 16.118 36 36 36-19.882 0-36 16.118-36 36 0-19.882-16.118-36-36-36 19.882 0 36-16.118 36-36z" fill={colored ? "#0E0F12" : "currentColor"} />
      </svg>
    );
  }
  if (norm.includes('rutube')) return <FaPlay {...iconProps('#00A6DF')} />;
  
  // Expanded Niche Networks
  if (norm.includes('kick')) return <SiKick {...iconProps('#53FC18')} />;
  if (norm.includes('steam')) return <FaSteam {...iconProps('#171A21')} />;
  if (norm.includes('threads')) return <SiThreads {...iconProps('#000000')} />;
  if (norm.includes('medium')) return <FaMediumM {...iconProps('#000000')} />;
  if (norm.includes('likee')) return <FaHeart {...iconProps('#FF0050')} />;
  if (norm.includes('kwai')) return <FaVideo {...iconProps('#FF7E00')} />;

  return <FaGlobe {...iconProps('#64748b')} />;
}
