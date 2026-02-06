
export enum AppMode {
  CONVERSATION = 'CONVERSATION',
  CHAT = 'CHAT',
  IMAGE_GEN = 'IMAGE_GEN',
  IMAGE_ANALYSIS = 'IMAGE_ANALYSIS',
  MAPS = 'MAPS',
  TERMUX = 'TERMUX',
  HACKING = 'HACKING',
  SETTINGS = 'SETTINGS'
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'location' | 'terminal';
  imageUrl?: string;
  terminalOutput?: string;
  location?: { lat: number; lng: number; title?: string };
}

export interface ImageGenConfig {
  prompt: string;
  aspectRatio: '1:1' | '2:3' | '3:2' | '4:3' | '9:16' | '16:9';
  imageSize: '1K' | '2K' | '4K';
}
