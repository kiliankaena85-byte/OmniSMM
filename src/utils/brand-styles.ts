export interface BrandStyle {
  activeBg: string;
  activeShadow: string;
  activeText: string;
}

export function getBrandStyles(slug: string): BrandStyle {
  const norm = (slug || "").toLowerCase();
  
  if (norm.includes('telegram') || norm.includes('tg')) {
    return {
      activeBg: "bg-gradient-to-br from-[#2AABEE] to-[#229ED9]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(42,171,238,0.5)] shadow-[#2AABEE]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('vk') || norm.includes('vkontakte')) {
    return {
      activeBg: "bg-gradient-to-br from-[#0077FF] to-[#0055FF]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(0,119,255,0.5)] shadow-[#0077FF]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('instagram') || norm.includes('ig')) {
    return {
      activeBg: "bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(238,42,123,0.5)] shadow-[#ee2a7b]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('youtube') || norm.includes('yt')) {
    return {
      activeBg: "bg-gradient-to-br from-[#FF0000] to-[#CC0000]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(255,0,0,0.5)] shadow-[#FF0000]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('tiktok') || norm.includes('tt')) {
    return {
      activeBg: "bg-gradient-to-br from-[#0E0F12] to-[#1f2026] border border-[#25F4EE]/30",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(37,244,238,0.4)] shadow-[#25F4EE]/40",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('twitch')) {
    return {
      activeBg: "bg-gradient-to-br from-[#9146FF] to-[#6441A5]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(145,70,255,0.5)] shadow-[#9146FF]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('discord')) {
    return {
      activeBg: "bg-gradient-to-br from-[#5865F2] to-[#404eed]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(88,101,242,0.5)] shadow-[#5865F2]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('pinterest')) {
    return {
      activeBg: "bg-gradient-to-br from-[#E60023] to-[#B80018]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(230,0,35,0.5)] shadow-[#E60023]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('spotify')) {
    return {
      activeBg: "bg-gradient-to-br from-[#1DB954] to-[#1aa34a]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(29,185,84,0.5)] shadow-[#1DB954]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('soundcloud')) {
    return {
      activeBg: "bg-gradient-to-br from-[#FF3300] to-[#E62E00]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(255,51,0,0.5)] shadow-[#FF3300]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('likee')) {
    return {
      activeBg: "bg-gradient-to-br from-[#FF0050] to-[#D00040]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(255,0,80,0.5)] shadow-[#FF0050]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('whatsapp') || norm.includes('wa')) {
    return {
      activeBg: "bg-gradient-to-br from-[#25D366] to-[#128C7E]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(37,211,102,0.5)] shadow-[#25D366]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('viber')) {
    return {
      activeBg: "bg-gradient-to-br from-[#7360F2] to-[#5a48d4]",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(115,96,242,0.5)] shadow-[#7360F2]/50",
      activeText: "text-primary-foreground"
    };
  }
  if (norm.includes('snapchat')) {
    return {
      activeBg: "bg-gradient-to-br from-[#FFFC00] to-[#dcd800] border border-yellow-400",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(255,252,0,0.4)] shadow-[#FFFC00]/40",
      activeText: "text-black"
    };
  }
  if (norm.includes('twitter') || norm.includes('x')) {
    return {
      activeBg: "bg-gradient-to-br from-[#121212] to-[#000000] border border-zinc-800",
      activeShadow: "shadow-[0_8px_20px_-4px_rgba(255,255,255,0.15)] shadow-white/10",
      activeText: "text-primary-foreground"
    };
  }
  
  return {
    activeBg: "bg-gradient-to-br from-primary to-primary/80",
    activeShadow: "shadow-[0_8px_20px_-4px_rgba(3,105,161,0.5)] shadow-primary/50",
    activeText: "text-primary-foreground"
  };
}
