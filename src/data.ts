import { generatedAssets } from "./assets";

export type Host = {
  id: string;
  name: string;
  voice: string;
  tone: string;
  color: string;
  image: string;
  live?: boolean;
};

export type Program = {
  id: string;
  time: string;
  title: string;
  host: string;
  style: string;
};

export type HistoryItem = {
  id: string;
  title: string;
  host: string;
  date: string;
  duration: string;
  color: string;
  image: string;
};

export type Track = {
  id: string;
  title: string;
  host: string;
  duration: number;
  color: string;
  audioUrl: string;
  image: string;
  playlist?: Array<{
    type: string;
    albumAudioId?: number;
    albumId?: number;
    title: string;
    artist?: string;
    hash?: string;
    host?: string;
    text?: string;
    lyrics?: string;
    audioUrl?: string | null;
    duration?: number;
    coverUrl?: string;
  }>;
};

export const navItems = ["首页", "发现", "乐库"];

export const hosts: Host[] = [
  {
    id: "xingyao",
    name: "星遥",
    voice: "温柔治愈音",
    tone: "轻松 · 治愈 · 陪伴",
    color: "#9b6cff",
    image: generatedAssets.hosts[0],
    live: true,
  },
  { id: "yuxuan", name: "宇轩", voice: "磁性暖男音", tone: "低频 · 稳定 · 深夜", color: "#6f8cff", image: generatedAssets.hosts[1] },
  { id: "ruoxi", name: "若曦", voice: "清澈灵动音", tone: "清透 · 元气 · 故事", color: "#ff88b7", image: generatedAssets.hosts[2] },
  { id: "mobei", name: "墨白", voice: "沉稳知性音", tone: "冷静 · 叙事 · 爵士", color: "#536d95", image: generatedAssets.hosts[3] },
  { id: "xiaoya", name: "小雅", voice: "甜美元气音", tone: "明亮 · 流行 · 电子", color: "#ffb05c", image: generatedAssets.hosts[4] },
];

export const lyrics = [
  { time: "10:42", text: "今夜的风 轻轻吹过" },
  { time: "10:44", text: "带来一首温柔的歌" },
  { time: "10:47", text: "在星空下 我们相遇" },
  { time: "10:51", text: "每颗心 都值得被温柔以待" },
  { time: "10:55", text: "黑夜很长 我一直都在" },
  { time: "10:59", text: "让旋律陪你到未来" },
  { time: "11:03", text: "梦不会走散 我们都在" },
];

export const schedules: Program[] = [
  { id: "p1", time: "13:00", title: "午后慵懒时光", host: "若曦", style: "轻音乐" },
  { id: "p2", time: "15:00", title: "漫步爵士街区", host: "墨白", style: "爵士" },
  { id: "p3", time: "17:00", title: "日落海湾线", host: "宇轩", style: "流行" },
  { id: "p4", time: "19:00", title: "夜色电台故事", host: "星遥", style: "情感" },
  { id: "p5", time: "21:00", title: "未来之声计划", host: "小雅", style: "电子" },
];

export const historyPrograms: HistoryItem[] = [
  {
    id: "h1",
    title: "雨后城市漫步",
    host: "墨白",
    date: "2024-05-20",
    duration: "48:32",
    color: "#9db8ff",
    image: generatedAssets.thumbs.rainyCity,
  },
  {
    id: "h2",
    title: "夏日微风与吉他",
    host: "宇轩",
    date: "2024-05-19",
    duration: "52:11",
    color: "#9bdcff",
    image: generatedAssets.thumbs.summerLake,
  },
  {
    id: "h3",
    title: "寂寞星的温柔告白",
    host: "星遥",
    date: "2024-05-18",
    duration: "50:07",
    color: "#9572ff",
    image: generatedAssets.thumbs.warmStar,
  },
];

export const tracks: Track[] = [
  {
    id: "t1",
    title: "银河与晚风",
    host: "墨白",
    duration: 272,
    color: "#8e6cff",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    image: generatedAssets.thumbs.galaxyBreeze,
  },
  {
    id: "t2",
    title: "云端漫游",
    host: "若曦",
    duration: 238,
    color: "#74c7ff",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    image: generatedAssets.thumbs.cloudJourney,
  },
  {
    id: "t3",
    title: "午后咖啡馆",
    host: "宇轩",
    duration: 281,
    color: "#d8a057",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    image: generatedAssets.thumbs.afternoonCafe,
  },
  {
    id: "t4",
    title: "霓近心跳",
    host: "星遥",
    duration: 245,
    color: "#536dff",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    image: generatedAssets.thumbs.neonHeart,
  },
];
