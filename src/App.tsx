import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  Bell,
  Bot,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Database,
  Disc3,
  FileAudio,
  Flame,
  Globe2,
  HardDrive,
  Headphones,
  Heart,
  History,
  KeyRound,
  ListMusic,
  Loader2,
  LogIn,
  LogOut,
  Mic2,
  Music2,
  Moon,
  Newspaper,
  Pause,
  PenLine,
  Play,
  Plus,
  Puzzle,
  QrCode,
  Radio,
  RefreshCw,
  Save,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserPlus,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generatedAssets } from "./assets";
import { ThreeHeroBackground } from "./components/ThreeHeroBackground";
import { historyPrograms, hosts, lyrics, navItems, schedules, tracks, type Track } from "./data";
import { formatDuration } from "./utils";

type ModalType = "register" | "login" | null;

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  maxTokens: number;
  model: string;
  provider: string;
  systemPrompt: string;
  temperature: number;
};

type TtsConfig = {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  engine: string;
  format: string;
  hostVoices: Record<string, string>;
  model: string;
  provider: string;
  speed: number;
  defaultStylePrompt: string;
  stylePresets: string[];
  voiceId: string;
};

type SunoConfig = {
  baseUrl: string;
  captchaKey: string;
  cookie: string;
  defaultPrompt: string;
  enabled: boolean;
  instrumental: boolean;
  model: string;
  negativeTags: string;
  style: string;
};

type AudioMixConfig = {
  enabled: boolean;
  effectIds: string[];
  leadSeconds: number;
  loopMode: "single" | "sequence";
  startMode: "voice-first" | "effect-first";
  volume: number;
};

type MusicProvider = "auto" | "kugou" | "netease" | "qq";

type PluginsConfig = {
  dailyBriefing: {
    apiBaseUrl: string;
    audioMix: AudioMixConfig;
    enabled: boolean;
    hostId: string;
    maxItems: number;
    name: string;
    playbackSpeed: number;
    token: string;
  };
  hotTopics: {
    apiBaseUrl: string;
    audioMix: AudioMixConfig;
    enabled: boolean;
    hostId: string;
    maxItems: number;
    name: string;
    playbackSpeed: number;
    token: string;
    type: string;
  };
  customProgram: {
    audioMix: AudioMixConfig;
  };
  kugouMusic: {
    apiEnabled: boolean;
    cardId: number;
    cookie: string;
    enabled: boolean;
    hostId: string;
    maxSongs: number;
    name: string;
    provider: MusicProvider;
    quality: string;
    rankType: number;
    searchKeywords: string;
    source: string;
    useAiScript: boolean;
  };
  neteaseMusic: {
    cookie: string;
    enabled: boolean;
  };
  qqMusic: {
    cookie: string;
    enabled: boolean;
  };
};

type AdminConfig = {
  llm: LlmConfig;
  plugins: PluginsConfig;
  suno: SunoConfig;
  tts: TtsConfig;
};

type SystemSettings = {
  appName: string;
  autoThemeByTime: boolean;
  footerText: string;
  logoUrl: string;
  subtitle: string;
  templates: ThemeTemplate[];
  themeTemplateId: string;
};

type ThemeTemplate = {
  description: string;
  id: string;
  mode: "light" | "dark";
  name: string;
};

type ServiceKey = keyof AdminConfig;

type ProgramRecord = {
  audioPath?: string | null;
  audioUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  createdAt: string;
  errorMessage?: string | null;
  fillerTimeline?: Array<{
    effectiveFillerElapsed: number;
    previousSongCount: number;
    publishDate: string;
    songCount: number;
  }>;
  host: string;
  id: string;
  llmModel?: string | null;
  musicPlaylistId?: string | null;
  playbackMode?: MusicPlaybackMode;
  playbackResetAt?: string | null;
  playbackSpeed?: number | null;
  programPresetId?: string | null;
  restartFromBeginning?: boolean;
  prompt: string;
  pluginId?: string | null;
  playlist?: ProgramPlaylistItem[];
  publishDate?: string | null;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  script: string;
  segments?: Array<{
    audioPath?: string | null;
    audioUrl?: string | null;
    duration?: number;
    hostId: string;
    hostName: string;
    style?: string;
    text: string;
  }>;
  status: string;
  sortOrder?: number | null;
  sourceType?: string | null;
  title: string;
  ttsModel?: string | null;
  updatedAt: string;
};

type ProgramPlaylistItem = {
  albumAudioId?: number;
  albumId?: number;
  artist?: string;
  audioPath?: string | null;
  audioUrl?: string | null;
  coverUrl?: string;
  duration?: number;
  hash?: string;
  host?: string;
  items?: Array<{
    audioUrl: string;
    categoryName?: string | null;
    id: string;
    name: string;
  }>;
  leadSeconds?: number;
  loopMode?: "single" | "sequence";
  lyrics?: string;
  mediaId?: string;
  originalUrl?: string;
  role?: "background" | "transition" | string;
  source?: string;
  sourceId?: string;
  startMode?: "voice-first" | "effect-first";
  text?: string;
  title: string;
  type: "song" | "talk" | "transition" | string;
  volume?: number;
};

type MusicCandidate = {
  albumAudioId?: number;
  albumId?: number;
  artist?: string;
  audioUrl?: string;
  coverUrl?: string;
  duration?: number;
  hash?: string;
  lyrics?: string;
  mediaId?: string;
  source?: MusicProvider;
  sourceId?: string;
  title: string;
};

type MusicPlaybackMode = "sequential" | "shuffle";

type SavedMusicPlaylist = {
  createdAt: string;
  id: string;
  name: string;
  playbackMode: MusicPlaybackMode;
  songs: MusicCandidate[];
  updatedAt: string;
};

type ProgramCategory = {
  createdAt: string;
  id: string;
  name: string;
  sortOrder?: number | null;
  updatedAt: string;
};

type SoundEffect = {
  audioPath?: string | null;
  audioUrl: string;
  categoryId: string;
  categoryName?: string | null;
  createdAt: string;
  fileName: string;
  id: string;
  mimeType?: string | null;
  name: string;
  sizeBytes: number;
  updatedAt: string;
};

type SoundEffectCategory = {
  createdAt: string;
  effects: SoundEffect[];
  id: string;
  name: string;
  sortOrder?: number | null;
  updatedAt: string;
};

type ProgramArchiveRecord = {
  archiveDate: string;
  archivedAt: string;
  audioUrl?: string | null;
  categoryName?: string | null;
  host: string;
  id: string;
  programId: string;
  playlist?: ProgramPlaylistItem[];
  script: string;
  segments?: ProgramRecord["segments"];
  title: string;
};

type SubtitleLine = {
  start: number;
  text: string;
  time: string;
};

type ProgramType = "custom" | "daily-briefing" | "hot-topics" | "kugou" | "media" | "suno";
type CustomContentMode = "ai" | "direct";
type MediaIntroMode = "ai" | "direct" | "none";
type MediaProgramInput = {
  creator: string;
  durationMinutes: number;
  introMode: MediaIntroMode;
  introPrompt: string;
  introText: string;
  localCopy: boolean;
  mediaUrl: string;
  siteCookie: string;
  title: string;
};
type MediaProbeResult = {
  codec: string;
  creator: string;
  duration: number;
  format: string;
  mediaUrl: string;
  originalUrl: string;
  resolver: string;
  title: string;
};
type AiMusicMode = "auto" | "manual";
type AiMusicPlan = {
  lyrics: string;
  negativeTags: string;
  style: string;
  title: string;
  voiceGender: "female" | "male" | "random";
};
type AiMusicInput = AiMusicPlan & {
  brief: string;
  instrumental: boolean;
  mode: AiMusicMode;
  quantity: number;
};
type SunoCandidate = {
  audioUrl: string;
  id: string;
  imageUrl?: string;
  selected: boolean;
  slotIndex: number;
  status: string;
  title: string;
  variantIndex: number;
};

type ProgramPreset = {
  categoryId?: string | null;
  contentMode?: CustomContentMode;
  createdAt: string;
  hostId?: string | null;
  hostIds: string[];
  id: string;
  kugou?: Partial<PluginsConfig["kugouMusic"]> | null;
  name: string;
  playbackSpeed?: number | null;
  pluginKind?: ProgramType | null;
  prompt: string;
  songs?: MusicCandidate[];
  title: string;
  type: ProgramType;
  updatedAt: string;
};

type FlowScheduledKind = "custom" | "daily-briefing" | "hot-topics" | "kugou" | "media" | "suno" | "existing" | "preset";
type FlowFillerKind = "kugou-random" | "custom-audio" | "silence";

type FlowTransitionNode = {
  effectId: string;
  effectName?: string;
  volume: number;
};

type FlowScheduledNode = {
  id: string;
  type: "scheduled";
  kind: FlowScheduledKind;
  title: string;
  startTime: string; // "HH:MM"
  prompt?: string;
  hostId?: string;
  categoryId?: string;
  programId?: string; // 引用的已有节目（作为配置模板，运行时重新生成内容）
  programTitle?: string;
  transitionBefore?: FlowTransitionNode | null;
};

type FlowFillerNode = {
  id: string;
  type: "filler";
  kind: FlowFillerKind;
  title: string;
  endTime?: string; // "HH:MM" 截止时刻
  audioUrl?: string;
  keywords?: string;
  songs?: MusicCandidate[];
  transitionBefore?: FlowTransitionNode | null;
};

type FlowNode = FlowScheduledNode | FlowFillerNode;

// 节点可编辑字段的宽松 patch 类型：合并两种节点的字段，kind 用宽联合，避免交叉产生 never。
type FlowNodePatch = Partial<{
  title: string;
  startTime: string;
  endTime: string;
  prompt: string;
  hostId: string;
  categoryId: string;
  audioUrl: string;
  keywords: string;
  kind: FlowScheduledKind | FlowFillerKind;
  programId: string;
  programTitle: string;
}>;

type FlowPreset = {
  autoFillEnabled: boolean;
  autoFillKeywords?: string | null;
  autoFillProvider?: MusicProvider;
  autoFillRestartFromBeginning?: boolean;
  autoFillPlaybackMode?: MusicPlaybackMode;
  autoFillPlaylistId?: string | null;
  autoFillSongs?: MusicCandidate[];
  id: string;
  name: string;
  nodes: FlowNode[];
  publishDate?: string | null;
  scheduledTime?: string | null;
  enabled: boolean;
  lastRunAt?: string | null;
  lastRunSummary?: {
    runAt: string;
    startedAt?: string;
    updatedAt?: string;
    finishedAt?: string | null;
    publishDate: string;
    status?: string;
    total: number;
    done?: number;
    ready: number;
    partial: number;
    skipped: number;
    failed: number;
    elapsedSeconds?: number;
    currentStage?: string;
    currentMessage?: string;
    currentNode?: {
      index?: number;
      total?: number;
      title?: string;
      kind?: string;
      startTime?: string | null;
    } | null;
    items: Array<{ title: string; kind: string; startTime: string | null; status: string; message: string; programId: string | null }>;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type FlowPresetsResponse = { presets: FlowPreset[] };
type MusicPlaylistsResponse = { playlists: SavedMusicPlaylist[] };
type MusicPlaylistResponse = { playlist: SavedMusicPlaylist; message: string };
type FlowPresetResponse = { preset: FlowPreset; message: string };
type ProgramPresetsResponse = { presets: ProgramPreset[] };
type ProgramPresetResponse = { preset: ProgramPreset; message: string };
type FlowRunResponse = {
  summary: FlowPreset["lastRunSummary"];
  programs: ProgramRecord[];
  running?: boolean;
  message: string;
};

type LivePlaybackState = {
  elapsedSeconds: number;
  queueIndex: number;
  seekSeconds: number;
  track: Track;
};
type LiveInterruptedFillerState = {
  dateKey: string;
  entryIndex: number;
  interruptedAt: number;
  nextEntryIndex: number;
  queueIndex: number;
  scheduledTrackId?: string;
  trackId: string;
};
type FlowRunStatusResponse = {
  lastRunAt?: string | null;
  running?: boolean;
  summary: FlowPreset["lastRunSummary"];
};
type FlowAutoFillApplyResponse = {
  message: string;
  preset: FlowPreset;
  program: ProgramRecord | null;
  programs: ProgramRecord[];
  songs?: MusicCandidate[];
};

const oldDefaultSystemPrompt = "你是星声电台的AI节目策划，负责生成温柔、适合电台播出的节目文案。";
const defaultSystemPrompt =
  "你是星声电台的多主播节目导演和脚本策划。你了解每位AI主播的人设、声线和说话习惯，但正文台词里不要让主播说出自己的名字，也不要出现“星遥：”“墨白：”这类说话人前缀。";
const defaultAiHotSongPrompt =
  "生成适合后台音乐连播的歌曲清单，覆盖华语流行、港台金曲、欧美流行、日韩流行、网络热歌和经典高传唱度作品；歌名和歌手要准确，避免重复、纯音乐和白噪音。";
const defaultVoiceStylePresets = [
  "自然、清晰、亲切，适合电台直播",
  "沉稳、专业、节奏清晰的新闻播报",
  "温柔、治愈、富有陪伴感的深夜电台",
  "轻快、活力、有感染力的音乐节目",
];
const defaultHostVoices: Record<string, string> = {
  xingyao: "茉莉",
  yuxuan: "白桦",
  ruoxi: "冰糖",
  mobei: "苏打",
  xiaoya: "冰糖",
};
const mimoVoiceOptions = ["冰糖", "茉莉", "苏打", "白桦", "Mia", "Chloe", "Milo", "Dean"];
const ttsEnginePresets = [
  {
    baseUrl: "https://api.openai.com/v1/audio/speech",
    engine: "openai-compatible",
    format: "mp3",
    label: "通用接口",
    model: "tts-1-hd",
    provider: "OpenAI / 网关兼容",
    voiceId: "alloy",
  },
  {
    baseUrl: "https://api.openai.com/v1",
    engine: "mimo",
    format: "wav",
    label: "小米 MiMo",
    model: "mimo-v2.5-tts",
    provider: "小米 MiMo TTS",
    voiceId: "茉莉",
  },
  {
    baseUrl: "https://YOUR_REGION.tts.speech.microsoft.com/cognitiveservices/v1",
    engine: "azure",
    format: "mp3",
    label: "Azure Speech",
    model: "audio-24khz-96kbitrate-mono-mp3",
    provider: "Azure Speech",
    voiceId: "zh-CN-XiaoxiaoNeural",
  },
  {
    baseUrl: "https://texttospeech.googleapis.com/v1/text:synthesize",
    engine: "google",
    format: "mp3",
    label: "Google Cloud",
    model: "MP3",
    provider: "Google Cloud TTS",
    voiceId: "cmn-CN-Wavenet-A",
  },
  {
    baseUrl: "https://api.elevenlabs.io",
    engine: "elevenlabs",
    format: "mp3",
    label: "ElevenLabs",
    model: "eleven_multilingual_v2",
    provider: "ElevenLabs",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
  },
  {
    baseUrl: "http://127.0.0.1:5050/audio/speech",
    engine: "openai-compatible",
    format: "mp3",
    label: "本地语音网关",
    model: "edge-tts",
    provider: "Edge TTS Gateway",
    voiceId: "zh-CN-XiaoxiaoNeural",
  },
  {
    baseUrl: "https://your-tts-gateway.example.com/audio/speech",
    engine: "openai-compatible",
    format: "mp3",
    label: "云厂商网关",
    model: "speech-tts",
    provider: "Cloud TTS Gateway",
    voiceId: "zh-CN-XiaoxiaoNeural",
  },
] as const;

type ConfigResponse = {
  config: AdminConfig;
  message?: string;
  savedAt: string;
};

type SystemSettingsResponse = {
  message?: string;
  settings: SystemSettings;
};

type ProgramGenerateResponse = {
  error?: string;
  message?: string;
  program?: ProgramRecord;
};

type ProgramReorderResponse = {
  message?: string;
  programs: ProgramRecord[];
};

type ProgramListResponse = {
  programs: ProgramRecord[];
};

type ProgramCategoryResponse = {
  categories: ProgramCategory[];
  message?: string;
};

type ProgramArchiveResponse = {
  archives: Array<{
    date: string;
    programs: ProgramArchiveRecord[];
  }>;
  message?: string;
};

type SoundEffectsResponse = {
  categories: SoundEffectCategory[];
  message?: string;
};

type StorageAudioFileType = "host-preview" | "program" | "segment";

type StorageAudioFile = {
  mtime: string;
  name: string;
  referenced: boolean;
  size: number;
  type: StorageAudioFileType;
};

type StorageConfig = {
  autoCleanupEnabled: boolean;
  autoCleanupKeepProgramAudio: boolean;
  autoCleanupLastRun?: string;
  autoCleanupMaxAgeDays: number;
};

type StorageFilesResponse = {
  byType?: Partial<Record<StorageAudioFileType, number>>;
  count: number;
  deleted?: string[];
  failed?: string[];
  files: StorageAudioFile[];
  message?: string;
  totalSize: number;
};

type StorageConfigResponse = {
  message?: string;
  storage: StorageConfig;
};

type ProgramMetadataPatch = {
  categoryId?: string | null;
  playbackSpeed?: number;
  scheduledAt?: string | null;
  title?: string;
};

type AdminLoginResponse = {
  expiresAt: string;
  token: string;
  user: {
    username: string;
  };
};

type AdminSection = "archive" | "dashboard" | "effects" | "filler" | "flow" | "music" | "storage" | "studio" | "timeline" | "settings" | "plugins" | "system";
type AdminNotice = {
  message: string;
  tone: "error" | "info" | "success";
} | null;

const ADMIN_GUIDE_DISMISSED_KEY = "star-radio.admin-guide-dismissed";

const defaultAudioMix: AudioMixConfig = {
  enabled: false,
  effectIds: [],
  leadSeconds: 0,
  loopMode: "single",
  startMode: "voice-first",
  volume: 0.28,
};

const defaultAdminConfig: AdminConfig = {
  llm: {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    enabled: true,
    maxTokens: 1200,
    model: "gpt-4o-mini",
    provider: "OpenAI Compatible",
    systemPrompt: defaultSystemPrompt,
    temperature: 0.7,
  },
  tts: {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1/audio/speech",
    enabled: true,
    engine: "openai-compatible",
    format: "mp3",
    hostVoices: defaultHostVoices,
    model: "tts-1-hd",
    provider: "OpenAI / 网关兼容",
    speed: 1,
    defaultStylePrompt: defaultVoiceStylePresets[0],
    stylePresets: defaultVoiceStylePresets,
    voiceId: "alloy",
  },
  suno: {
    baseUrl: "http://127.0.0.1:3010",
    captchaKey: "",
    cookie: "",
    defaultPrompt: "星夜、湖面、柔和人声、治愈电子氛围",
    enabled: true,
    instrumental: false,
    model: "auto",
    negativeTags: "harsh noise, distorted vocals, low quality",
    style: "ambient pop, chill, cinematic",
  },
  plugins: {
    dailyBriefing: {
      apiBaseUrl: "https://v2.alapi.cn/api/zaobao",
      audioMix: defaultAudioMix,
      enabled: true,
      hostId: "xingyao",
      maxItems: 12,
      name: "每日早报",
      playbackSpeed: 1,
      token: "",
    },
    hotTopics: {
      apiBaseUrl: "https://v3.alapi.cn/api/tophub",
      audioMix: defaultAudioMix,
      enabled: true,
      hostId: "ruoxi",
      maxItems: 10,
      name: "今日热榜",
      playbackSpeed: 1,
      token: "",
      type: "weibo",
    },
    customProgram: {
      audioMix: defaultAudioMix,
    },
    kugouMusic: {
      apiEnabled: true,
      cardId: 2,
      cookie: "",
      enabled: true,
      hostId: "xiaoya",
      maxSongs: 5,
      name: "音乐联播节目",
      provider: "auto",
      quality: "128",
      rankType: 21608,
      searchKeywords: "新歌",
      source: "new",
      useAiScript: true,
    },
    neteaseMusic: {
      cookie: "",
      enabled: true,
    },
    qqMusic: {
      cookie: "",
      enabled: true,
    },
  },
};

const defaultSystemSettings: SystemSettings = {
  appName: "星声电台",
  autoThemeByTime: false,
  footerText: "https://github.com/moli-xia/AIradio",
  logoUrl: "",
  subtitle: "AI音乐 · 24H LIVE",
  templates: [
    {
      description: "当前浅色模板，适合日间运营和后台管理。",
      id: "default",
      mode: "light",
      name: "默认模板",
    },
    {
      description: "暗色主题模板，适合夜间直播监看和低亮度环境。",
      id: "dark",
      mode: "dark",
      name: "暗色主题",
    },
  ],
  themeTemplateId: "default",
};

function readSavedIds(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeSavedIds(key: string, value: string[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function normalizeAudioMix(input?: Partial<AudioMixConfig> | null): AudioMixConfig {
  const effectIds = Array.isArray(input?.effectIds)
    ? [...new Set(input.effectIds.map((id) => String(id ?? "").trim()).filter(Boolean))]
    : [];
  return {
    enabled: Boolean(input?.enabled || effectIds.length),
    effectIds,
    leadSeconds: clampNumber(input?.leadSeconds, 0, 30, defaultAudioMix.leadSeconds),
    loopMode: input?.loopMode === "sequence" ? "sequence" : "single",
    startMode: input?.startMode === "effect-first" ? "effect-first" : "voice-first",
    volume: clampNumber(input?.volume, 0, 1, defaultAudioMix.volume),
  };
}

function readAdminConfig() {
  try {
    const raw = window.localStorage.getItem("star-radio.admin-config");
    const parsed = raw ? JSON.parse(raw) : {};
    const llm = { ...defaultAdminConfig.llm, ...(parsed.llm ?? {}) };
    const tts = { ...defaultAdminConfig.tts, ...(parsed.tts ?? {}) };
    if (!llm.systemPrompt || llm.systemPrompt === oldDefaultSystemPrompt) {
      llm.systemPrompt = defaultSystemPrompt;
    }
    tts.hostVoices = {
      ...defaultHostVoices,
      ...(tts.hostVoices ?? {}),
    };
    if (String(tts.engine).toLowerCase() === "local") {
      Object.assign(tts, {
        engine: defaultAdminConfig.tts.engine,
        provider: defaultAdminConfig.tts.provider,
        baseUrl: tts.baseUrl || defaultAdminConfig.tts.baseUrl,
        model: tts.model === "linux-system-speech" ? defaultAdminConfig.tts.model : tts.model,
        voiceId: tts.voiceId || defaultAdminConfig.tts.voiceId,
      });
    }
    tts.defaultStylePrompt = String(tts.defaultStylePrompt || defaultAdminConfig.tts.defaultStylePrompt).trim();
    tts.stylePresets = Array.from(new Set(
      (Array.isArray(tts.stylePresets) ? tts.stylePresets : defaultVoiceStylePresets)
        .map((item: unknown) => String(item ?? "").trim())
        .filter(Boolean),
    ));
    return {
      llm,
      plugins: {
        dailyBriefing: {
          ...defaultAdminConfig.plugins.dailyBriefing,
          ...(parsed.plugins?.dailyBriefing ?? {}),
          audioMix: normalizeAudioMix(parsed.plugins?.dailyBriefing?.audioMix),
          playbackSpeed: clampNumber(parsed.plugins?.dailyBriefing?.playbackSpeed, 0.5, 2, defaultAdminConfig.plugins.dailyBriefing.playbackSpeed),
        },
        hotTopics: {
          ...defaultAdminConfig.plugins.hotTopics,
          ...(parsed.plugins?.hotTopics ?? {}),
          audioMix: normalizeAudioMix(parsed.plugins?.hotTopics?.audioMix),
          playbackSpeed: clampNumber(parsed.plugins?.hotTopics?.playbackSpeed, 0.5, 2, defaultAdminConfig.plugins.hotTopics.playbackSpeed),
          token:
            parsed.plugins?.hotTopics?.token ||
            parsed.plugins?.dailyBriefing?.token ||
            defaultAdminConfig.plugins.hotTopics.token,
        },
        customProgram: {
          ...defaultAdminConfig.plugins.customProgram,
          ...(parsed.plugins?.customProgram ?? {}),
          audioMix: normalizeAudioMix(parsed.plugins?.customProgram?.audioMix),
        },
        kugouMusic: {
          ...defaultAdminConfig.plugins.kugouMusic,
          ...(parsed.plugins?.kugouMusic ?? {}),
        },
        neteaseMusic: {
          ...defaultAdminConfig.plugins.neteaseMusic,
          ...(parsed.plugins?.neteaseMusic ?? {}),
        },
        qqMusic: {
          ...defaultAdminConfig.plugins.qqMusic,
          ...(parsed.plugins?.qqMusic ?? {}),
        },
      },
      tts,
      suno: {
        ...defaultAdminConfig.suno,
        ...(parsed.suno ?? {}),
        baseUrl: /sunoapi\.org/iu.test(String(parsed.suno?.baseUrl ?? ""))
          ? defaultAdminConfig.suno.baseUrl
          : String(parsed.suno?.baseUrl ?? defaultAdminConfig.suno.baseUrl),
        captchaKey: String(parsed.suno?.captchaKey ?? ""),
        cookie: String(parsed.suno?.cookie ?? ""),
        model: ["", "chirp-v3-5"].includes(String(parsed.suno?.model ?? "").trim())
          ? "auto"
          : String(parsed.suno?.model ?? defaultAdminConfig.suno.model),
        negativeTags: String(parsed.suno?.negativeTags ?? defaultAdminConfig.suno.negativeTags),
      },
    };
  } catch {
    return defaultAdminConfig;
  }
}

function writeAdminConfig(value: AdminConfig) {
  window.localStorage.setItem("star-radio.admin-config", JSON.stringify(value));
  window.localStorage.setItem("star-radio.admin-config.saved-at", new Date().toISOString());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMessage(value: unknown, fallback: string) {
  if (!isRecord(value)) {
    return fallback;
  }

  const message = value.message;
  const error = value.error;
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (typeof message === "string" && message.trim()) {
    return message;
  }
  return fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createCaptchaCode(length = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function ttsApiKeyOptional(config: TtsConfig) {
  const marker = `${config.engine} ${config.provider} ${config.baseUrl}`.toLowerCase();
  return (
    marker.includes("gateway") ||
    marker.includes("edge") ||
    marker.includes("local") ||
    marker.includes("本地") ||
    marker.includes("通用") ||
    /^https?:\/\/(?:127\.0\.0\.1|localhost|\[?::1\]?)(?::\d+)?/iu.test(config.baseUrl.trim())
  );
}

function cleanAudienceCopy(value?: string | null) {
  return String(value ?? "")
    .replace(/酷狗/gu, "")
    .replace(/《音乐[联连]播兜底》/gu, "《音乐连播》")
    .replace(/音乐[联连]播兜底/gu, "音乐连播")
    .replace(/\s{2,}/gu, " ")
    .replace(/·\s*连播/u, "· 歌单连播")
    .trim();
}

function isAutoFillerProgram(program?: ProgramRecord | null) {
  const title = String(program?.title ?? "");
  const prompt = String(program?.prompt ?? "");
  return (
    program?.sourceType === "flow-filler" ||
    (
      program?.pluginId === "kugou-music" &&
      !program?.scheduledAt &&
      (/音乐[联连]播兜底/u.test(title) || prompt === "流程编排 · 音乐连播")
    )
  );
}

function normalizeMusicProviderClient(value?: string | null): MusicProvider {
  return value === "netease" || value === "qq" || value === "auto" ? value : "kugou";
}

function musicProviderLabel(value?: string | null) {
  const provider = normalizeMusicProviderClient(value);
  return provider === "netease" ? "网易云" : provider === "qq" ? "QQ 音乐" : provider === "auto" ? "智能混合" : "酷狗";
}

function songKey(song?: MusicCandidate | ProgramPlaylistItem | null) {
  return String(`${song?.source ?? "kugou"}:${song?.sourceId || song?.hash || song?.albumAudioId || `${song?.artist ?? ""}-${song?.title ?? ""}`}`).trim();
}

function songsFromProgram(program?: ProgramRecord | null): MusicCandidate[] {
  return primaryPlaylistItems(program?.playlist)
    .filter((item) => item.type === "song" && item.audioUrl)
    .map((item) => ({
      albumAudioId: item.albumAudioId,
      albumId: item.albumId,
      artist: item.artist,
      audioUrl: item.audioUrl ?? undefined,
      coverUrl: item.coverUrl,
      duration: item.duration,
      hash: item.hash,
      lyrics: item.lyrics,
      mediaId: item.mediaId,
      source: normalizeMusicProviderClient(item.source),
      sourceId: item.sourceId,
      title: item.title,
    }));
}

const LIVE_FILLER_CURSOR_KEY = "star-radio.live-filler-cursor";
const LIVE_FILLER_RESET_STATE_KEY = "star-radio.live-filler-reset-state";
const AUDIENCE_THEME_KEY = "star-radio.audience-theme";
type AudienceTheme = "light" | "dark";

function readLiveFillerCursor() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LIVE_FILLER_CURSOR_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

function writeLiveFillerCursor(value: Record<string, number>) {
  window.localStorage.setItem(LIVE_FILLER_CURSOR_KEY, JSON.stringify(value));
}

function readLiveFillerResetState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LIVE_FILLER_RESET_STATE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function writeLiveFillerResetState(value: Record<string, string>) {
  window.localStorage.setItem(LIVE_FILLER_RESET_STATE_KEY, JSON.stringify(value));
}

function readAudienceTheme(): AudienceTheme | null {
  const value = window.localStorage.getItem(AUDIENCE_THEME_KEY);
  return value === "light" || value === "dark" ? value : null;
}

function toDatetimeLocalValue(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = shanghaiParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hours}:${parts.minutes}`;
}

// 将 Date 分解为上海时间（UTC+8）的各部分。电台面向中文听众，
// 所有墙上时间都按上海时间显示，与浏览器本地时区无关。
function shanghaiParts(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 3600 * 1000);
  const hoursNum = shifted.getUTCHours();
  const minutesNum = shifted.getUTCMinutes();
  const secondsNum = shifted.getUTCSeconds();
  return {
    year: shifted.getUTCFullYear(),
    month: String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    day: String(shifted.getUTCDate()).padStart(2, "0"),
    hours: String(hoursNum).padStart(2, "0"),
    minutes: String(minutesNum).padStart(2, "0"),
    hoursNum,
    minutesNum,
    secondsNum,
  };
}

function localDateKey(value = new Date()) {
  const parts = shanghaiParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function scheduledAtFromDateAndTime(dateKey: string, timeValue: string) {
  if (!/^\d{2}:\d{2}$/u.test(timeValue)) {
    return null;
  }
  // 显式指定 +08:00，确保无论浏览器在哪个时区，"08:00" 始终被解释为上海时间。
  const date = new Date(`${dateKey}T${timeValue}:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function scheduledAtFromDatetimeLocal(value: string) {
  if (!value) {
    return null;
  }
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(value) ? `${value}:00` : value;
  const date = new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/u.test(normalized) ? normalized : `${normalized}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function timeInputValueFromDate(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = shanghaiParts(date);
  return `${parts.hours}:${parts.minutes}`;
}

const DAY_SECONDS = 24 * 60 * 60;
const DAY_TIMELINE_MARKS = ["00:00", "06:00", "12:00", "18:00", "24:00"];
const FILLER_TOP_UP_THRESHOLD = 10;
const FILLER_TOP_UP_BATCH_SIZE = 30;
const FILLER_MAX_SONGS = 150;
const PUBLIC_PROGRAM_LIST_LIMIT = 6;
const DAY_TIMELINE_TICKS = Array.from({ length: 25 }, (_, index) => index);

function secondsSinceLocalMidnight(value = new Date()) {
  const parts = shanghaiParts(value);
  return parts.hoursNum * 3600 + parts.minutesNum * 60 + parts.secondsNum;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

// 直播进度条端点标签：MM-DD 00:00。
function timelineDateLabel(value: Date) {
  const parts = shanghaiParts(value);
  return `${parts.month}-${parts.day} 00:00`;
}

function liveClockLabel(value: Date) {
  const parts = shanghaiParts(value);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hours}:${parts.minutes}:${pad2(parts.secondsNum)}`;
}

function scheduledSecond(program: ProgramRecord) {
  if (!program.scheduledAt) {
    return null;
  }
  const date = new Date(program.scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return secondsSinceLocalMidnight(date);
}

function trackHasPlayableAudio(track: Track) {
  return Boolean(track.audioUrl || track.playlist?.some((item) => item.audioUrl));
}

function isBackgroundPlaylistItem(item?: ProgramPlaylistItem | null) {
  return item?.type === "background" || item?.role === "background";
}

function primaryPlaylistItems(items?: ProgramPlaylistItem[]) {
  return (items ?? []).filter((item) => !isBackgroundPlaylistItem(item));
}

function backgroundPlaylistItems(program?: ProgramRecord) {
  return (program?.playlist ?? []).filter(isBackgroundPlaylistItem);
}

function playlistItemDuration(item: ProgramPlaylistItem, fallback = 180) {
  const duration = Number(item.duration);
  if (Number.isFinite(duration) && duration > 0) {
    return Math.max(1, duration);
  }
  if (item.type === "talk") {
    return Math.max(18, Math.round(String(item.text ?? item.title ?? "").length / 4.2));
  }
  if (item.type === "transition" || item.role === "transition") {
    return 8;
  }
  return Math.max(1, fallback);
}

function contentDurationForTrack(track: Track) {
  const queue = playbackQueueForTrack(track);
  if (queue.length) {
    return queue.reduce((total, item) => total + playlistItemDuration(item, track.duration || 240), 0);
  }
  return Math.max(1, Math.round(track.duration || 180));
}

function queuePositionForElapsed(track: Track, elapsedSeconds: number) {
  const queue = playbackQueueForTrack(track);
  const totalDuration = contentDurationForTrack(track);
  const normalizedElapsed = ((elapsedSeconds % totalDuration) + totalDuration) % totalDuration;
  if (!queue.length) {
    return { queueIndex: 0, seekSeconds: normalizedElapsed };
  }

  let cursor = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const duration = playlistItemDuration(queue[index], track.duration || 240);
    if (normalizedElapsed < cursor + duration) {
      return { queueIndex: index, seekSeconds: Math.max(0, normalizedElapsed - cursor) };
    }
    cursor += duration;
  }
  return { queueIndex: 0, seekSeconds: 0 };
}

function nextSongQueuePosition(track: Track, avoidQueueIndex?: number | null) {
  const queue = playbackQueueForTrack(track);
  if (!queue.length) {
    return { queueIndex: 0, seekSeconds: 0 };
  }
  const songIndexes = queue
    .map((item, index) => (item.type === "song" && item.audioUrl ? index : -1))
    .filter((index) => index >= 0);
  if (!songIndexes.length) {
    return { queueIndex: 0, seekSeconds: 0 };
  }
  if (typeof avoidQueueIndex !== "number" || avoidQueueIndex < 0) {
    return { queueIndex: songIndexes[0], seekSeconds: 0 };
  }
  const currentSongOffset = songIndexes.findIndex((index) => index === avoidQueueIndex);
  const nextOffset = currentSongOffset >= 0 ? (currentSongOffset + 1) % songIndexes.length : 0;
  return { queueIndex: songIndexes[nextOffset], seekSeconds: 0 };
}

function programForTrack(trackOrId: Track | string, programs: ProgramRecord[]) {
  const trackId = typeof trackOrId === "string" ? trackOrId : trackOrId.id;
  if (!trackId.startsWith("program-")) {
    return undefined;
  }
  const programId = trackId.replace(/^program-/u, "");
  return programs.find((program) => program.id === programId);
}

function mergeProgramSnapshots(current: ProgramRecord[], incoming: ProgramRecord[]) {
  const currentById = new Map(current.map((program) => [program.id, program]));
  const merged = incoming.map((program) => {
    const existing = currentById.get(program.id);
    return existing && JSON.stringify(existing) === JSON.stringify(program) ? existing : program;
  });
  return merged.length === current.length && merged.every((program, index) => program === current[index])
    ? current
    : merged;
}

function fillerSongEntriesForDate(tracks: Track[], programs: ProgramRecord[], dateKey: string) {
  const playableTracks = tracks.filter(trackHasPlayableAudio);
  if (!playableTracks.length) {
    return [];
  }

  const programByTrackId = new Map(programs.map((program) => [`program-${program.id}`, program]));
  const publishedTodayIds = new Set(
    programs.filter((program) => program.publishDate === dateKey).map((program) => program.id),
  );
  const candidateTracks = publishedTodayIds.size
    ? playableTracks.filter((track) => {
        const program = programByTrackId.get(track.id);
        return program ? publishedTodayIds.has(program.id) : false;
      })
    : playableTracks;
  const autoFillerTracks = candidateTracks.filter((track) => isAutoFillerProgram(programByTrackId.get(track.id)));
  const fillerTracks = autoFillerTracks.length ? autoFillerTracks : candidateTracks;

  return fillerTracks.flatMap((track) => {
    const program = programByTrackId.get(track.id);
    if (!program || program.scheduledAt) {
      return [];
    }
    const queue = playbackQueueForTrack(track);
    if (!queue.length) {
      return track.audioUrl ? [{ queueIndex: 0, track }] : [];
    }
    return queue
      .map((item, queueIndex) => (item.type === "song" && item.audioUrl ? { queueIndex, track } : null))
      .filter((entry): entry is { queueIndex: number; track: Track } => Boolean(entry));
  });
}

function fillerEntryIndexForState(
  entries: Array<{ queueIndex: number; track: Track }>,
  state?: LivePlaybackState | null,
) {
  if (!state) {
    return -1;
  }
  return entries.findIndex((entry) => entry.track.id === state.track.id && entry.queueIndex === state.queueIndex);
}

function nextFillerCursorAfterInterruptedEntry(
  entries: Array<{ queueIndex: number; track: Track }>,
  interrupted?: LiveInterruptedFillerState | null,
) {
  if (!entries.length || !interrupted) {
    return null;
  }
  const currentEntryIndex = entries.findIndex(
    (entry) => entry.track.id === interrupted.trackId && entry.queueIndex === interrupted.queueIndex,
  );
  if (currentEntryIndex >= 0) {
    return (currentEntryIndex + 1) % entries.length;
  }
  if (Number.isFinite(interrupted.nextEntryIndex)) {
    return ((interrupted.nextEntryIndex % entries.length) + entries.length) % entries.length;
  }
  return null;
}

function fillerDurationsForEntries(entries: Array<{ queueIndex: number; track: Track }>) {
  return entries.map((entry) => {
    const queue = playbackQueueForTrack(entry.track);
    const item = queue[entry.queueIndex];
    return Math.max(1, Math.round(item ? playlistItemDuration(item, entry.track.duration || 240) : entry.track.duration || 240));
  });
}

function fillerTimelineForElapsed(
  entries: Array<{ queueIndex: number; track: Track }>,
  programs: ProgramRecord[],
  dateKey: string,
  elapsedSeconds: number,
) {
  if (!entries.length) {
    return { durations: [] as number[], entries, position: 0 };
  }
  const program = programForTrack(entries[0].track, programs);
  const revisions = (program?.fillerTimeline ?? [])
    .filter((revision) =>
      revision.publishDate === dateKey &&
      Number.isFinite(revision.effectiveFillerElapsed) &&
      revision.previousSongCount > 0 &&
      revision.songCount > revision.previousSongCount,
    )
    .sort((a, b) => a.effectiveFillerElapsed - b.effectiveFillerElapsed);
  let activeCount = Math.min(entries.length, Math.max(1, revisions[0]?.previousSongCount ?? entries.length));
  let activeEntries = entries.slice(0, activeCount);
  let durations = fillerDurationsForEntries(activeEntries);
  let totalDuration = Math.max(1, durations.reduce((total, duration) => total + duration, 0));
  let position = ((elapsedSeconds % totalDuration) + totalDuration) % totalDuration;

  for (const revision of revisions) {
    if (elapsedSeconds < revision.effectiveFillerElapsed) {
      break;
    }
    activeCount = Math.min(entries.length, Math.max(1, revision.songCount));
    activeEntries = entries.slice(0, activeCount);
    durations = fillerDurationsForEntries(activeEntries);
    totalDuration = Math.max(1, durations.reduce((total, duration) => total + duration, 0));
    const previousCount = Math.min(activeCount, Math.max(1, revision.previousSongCount));
    const appendedStart = durations.slice(0, previousCount).reduce((total, duration) => total + duration, 0);
    position = ((appendedStart + elapsedSeconds - revision.effectiveFillerElapsed) % totalDuration + totalDuration) % totalDuration;
  }

  return { durations, entries: activeEntries, position };
}

function fillerEntryIndexByElapsed(entries: Array<{ queueIndex: number; track: Track }>, elapsedSeconds: number) {
  if (!entries.length) {
    return -1;
  }
  const durations = fillerDurationsForEntries(entries);
  const totalDuration = durations.reduce((total, duration) => total + duration, 0);
  const position = ((elapsedSeconds % Math.max(1, totalDuration)) + Math.max(1, totalDuration)) % Math.max(1, totalDuration);
  let cursor = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const nextCursor = cursor + durations[index];
    if (position < nextCursor) {
      return index;
    }
    cursor = nextCursor;
  }
  return 0;
}

function truncateScheduledBlocksAtNextStart<T extends { duration: number; start: number }>(blocks: T[]) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  return sorted.map((block, index) => {
    const nextBlock = sorted.slice(index + 1).find((item) => item.start > block.start);
    if (!nextBlock) {
      return block;
    }
    return {
      ...block,
      duration: Math.max(0, Math.min(block.duration, nextBlock.start - block.start)),
    };
  });
}

function scheduledBlocksForDate(tracks: Track[], programs: ProgramRecord[], dateKey: string) {
  const playableTrackIds = new Set(tracks.filter(trackHasPlayableAudio).map((track) => track.id));
  const blocks = programs
    .filter((program) => {
      if (!program.scheduledAt || (program.publishDate && program.publishDate !== dateKey)) {
        return false;
      }
      return playableTrackIds.has(`program-${program.id}`);
    })
    .map((program) => {
      const start = scheduledSecond(program);
      const track = tracks.find((item) => item.id === `program-${program.id}`);
      return start === null || !track ? null : {
        duration: Math.max(60, Math.round(contentDurationForTrack(track))),
        program,
        start,
        track,
      };
    })
    .filter((entry): entry is { duration: number; program: ProgramRecord; start: number; track: Track } => Boolean(entry))
    .sort((a, b) => a.start - b.start);
  return truncateScheduledBlocksAtNextStart(blocks);
}

function scheduledBlockedSecondsBefore(
  blocks: Array<{ duration: number; start: number }>,
  targetSecond: number,
) {
  let blockedSeconds = 0;
  let blockedUntil = 0;
  for (const block of blocks) {
    const blockStart = Math.max(0, block.start);
    const blockEnd = Math.min(targetSecond, block.start + block.duration);
    if (blockEnd <= blockStart) {
      continue;
    }
    const mergedStart = Math.max(blockStart, blockedUntil);
    if (blockEnd > mergedStart) {
      blockedSeconds += blockEnd - mergedStart;
      blockedUntil = Math.max(blockedUntil, blockEnd);
    }
  }
  return blockedSeconds;
}

function fillerElapsedForTime(tracks: Track[], programs: ProgramRecord[], now: Date) {
  const dateKey = localDateKey(now);
  const daySecond = secondsSinceLocalMidnight(now);
  const blocks = scheduledBlocksForDate(tracks, programs, dateKey);
  return Math.max(0, daySecond - scheduledBlockedSecondsBefore(blocks, daySecond));
}

function nextFillerCursorAfterScheduledProgram(
  tracks: Track[],
  programs: ProgramRecord[],
  now: Date,
  scheduledTrack?: Track | null,
) {
  const dateKey = localDateKey(now);
  const entries = fillerSongEntriesForDate(tracks, programs, dateKey);
  if (!entries.length || !scheduledTrack) {
    return null;
  }
  const scheduledProgram = programForTrack(scheduledTrack, programs);
  const scheduledStart = scheduledProgram ? scheduledSecond(scheduledProgram) : null;
  if (scheduledStart === null) {
    return null;
  }
  const blocks = scheduledBlocksForDate(tracks, programs, dateKey);
  const fillerElapsedAtScheduledStart = Math.max(
    0,
    scheduledStart - scheduledBlockedSecondsBefore(blocks, scheduledStart),
  );
  const interruptedIndex = fillerEntryIndexByElapsed(entries, fillerElapsedAtScheduledStart);
  return interruptedIndex >= 0 ? (interruptedIndex + 1) % entries.length : null;
}

function nextScheduledStartState(tracks: Track[], programs: ProgramRecord[], now: Date) {
  const dateKey = localDateKey(now);
  const daySecond = secondsSinceLocalMidnight(now);
  const playableTrackIds = new Set(tracks.filter(trackHasPlayableAudio).map((track) => track.id));
  const scheduledEntries = programs
    .filter((program) => {
      if (!program.scheduledAt || (program.publishDate && program.publishDate !== dateKey)) {
        return false;
      }
      return playableTrackIds.has(`program-${program.id}`);
    })
    .map((program) => {
      const start = scheduledSecond(program);
      const track = tracks.find((item) => item.id === `program-${program.id}`);
      return start === null || !track ? null : { program, start, track };
    })
    .filter((entry): entry is { program: ProgramRecord; start: number; track: Track } => Boolean(entry))
    .filter((entry) => entry.start > daySecond)
    .sort((a, b) => a.start - b.start);

  return scheduledEntries[0] ?? null;
}

function liveStateForTime(
  tracks: Track[],
  programs: ProgramRecord[],
  now: Date,
  avoidFiller?: { queueIndex?: number | null; trackId: string } | null,
) {
  const playableTracks = tracks.filter(trackHasPlayableAudio);
  if (!playableTracks.length) {
    const fallbackTrack = tracks[0];
    return fallbackTrack ? { elapsedSeconds: 0, queueIndex: 0, seekSeconds: 0, track: fallbackTrack } : null;
  }

  const programByTrackId = new Map(programs.map((program) => [`program-${program.id}`, program]));
  // 直播队列优先限定在「今日已发布」的节目内：发布接口只给当日节目盖 publish_date，
  // 若不限定，下面的轮询会把历史音乐节目也混进来，导致首页播放的不是当天编排的内容。
  const today = localDateKey(now);
  const publishedTodayIds = new Set(
    programs.filter((program) => program.publishDate === today).map((program) => program.id),
  );
  const liveTracks = publishedTodayIds.size
    ? playableTracks.filter((track) => {
        const program = programByTrackId.get(track.id);
        return program ? publishedTodayIds.has(program.id) : false;
      })
    : playableTracks;
  // 当天有发布节目时只在其中选取；否则回退到全部可播音轨（保留原有兜底行为）。
  const candidateTracks = liveTracks.length ? liveTracks : playableTracks;

  const scheduledEntries = candidateTracks
    .map((track, index) => {
      const program = programByTrackId.get(track.id);
      const start = program ? scheduledSecond(program) : null;
      return start === null ? null : { index, start, track };
    })
    .filter((entry): entry is { index: number; start: number; track: Track } => Boolean(entry))
    .sort((a, b) => a.start - b.start || a.index - b.index);

  const daySecond = secondsSinceLocalMidnight(now);
  const fillerEntries = fillerSongEntriesForDate(candidateTracks, programs, today);
  const selectFillerByElapsed = (elapsedSeconds: number) => {
    if (!fillerEntries.length) {
      return null;
    }
    const timeline = fillerTimelineForElapsed(fillerEntries, programs, today, elapsedSeconds);
    const activeEntries = timeline.entries;
    const fillerDurations = timeline.durations;
    const positionInFillers = timeline.position;
    let cursor = 0;
    for (let index = 0; index < activeEntries.length; index += 1) {
      const nextCursor = cursor + fillerDurations[index];
      if (positionInFillers < nextCursor) {
        const selectedIndex =
          avoidFiller?.trackId === activeEntries[index].track.id && avoidFiller.queueIndex === activeEntries[index].queueIndex
            ? (index + 1) % activeEntries.length
            : index;
        const selectedCursor = selectedIndex === index ? cursor : 0;
        const seekSeconds = selectedIndex === index ? Math.max(0, positionInFillers - selectedCursor) : 0;
        const entry = activeEntries[selectedIndex];
        return {
          elapsedSeconds: seekSeconds,
          queueIndex: entry.queueIndex,
          seekSeconds,
          track: entry.track,
        };
      }
      cursor = nextCursor;
    }
    const entry = activeEntries[0];
    return { elapsedSeconds: 0, queueIndex: entry.queueIndex, seekSeconds: 0, track: entry.track };
  };

  if (scheduledEntries.length) {
    const scheduledBlocks = truncateScheduledBlocksAtNextStart(
      scheduledEntries.map((entry) => ({
        ...entry,
        duration: Math.max(60, Math.round(contentDurationForTrack(entry.track))),
      })),
    );
    const activeScheduled = scheduledBlocks
      .filter((entry) => entry.start <= daySecond && daySecond < entry.start + entry.duration)
      .sort((a, b) => b.start - a.start || b.index - a.index)[0];
    if (activeScheduled) {
      const elapsedSeconds = daySecond - activeScheduled.start;
      const position = queuePositionForElapsed(activeScheduled.track, elapsedSeconds);
      return {
        elapsedSeconds,
        ...position,
        track: activeScheduled.track,
      };
    }

    if (fillerEntries.length) {
      let blockedSeconds = 0;
      let blockedUntil = 0;
      for (const block of scheduledBlocks.sort((a, b) => a.start - b.start)) {
        const blockStart = Math.max(0, block.start);
        const blockEnd = Math.min(daySecond, block.start + block.duration);
        if (blockEnd <= blockStart) {
          continue;
        }
        const mergedStart = Math.max(blockStart, blockedUntil);
        if (blockEnd > mergedStart) {
          blockedSeconds += blockEnd - mergedStart;
          blockedUntil = Math.max(blockedUntil, blockEnd);
        }
      }
      const fillerElapsed = Math.max(0, daySecond - blockedSeconds);
      const fillerState = selectFillerByElapsed(fillerElapsed);
      if (fillerState) {
        return fillerState;
      }
    }

    const previousScheduled = scheduledBlocks
      .filter((entry) => entry.start <= daySecond)
      .sort((a, b) => b.start - a.start || b.index - a.index)[0] ?? scheduledBlocks[scheduledBlocks.length - 1];
    const elapsedSeconds = previousScheduled.start <= daySecond
      ? daySecond - previousScheduled.start
      : daySecond + DAY_SECONDS - previousScheduled.start;
    const position = queuePositionForElapsed(previousScheduled.track, elapsedSeconds);
    return { elapsedSeconds, ...position, track: previousScheduled.track };
  }

  if (fillerEntries.length) {
    const fillerState = selectFillerByElapsed(daySecond);
    if (fillerState) {
      return fillerState;
    }
  }

  const durations = candidateTracks.map((track) => Math.max(60, Math.round(contentDurationForTrack(track))));
  const totalDuration = durations.reduce((total, duration) => total + duration, 0);
  const position = daySecond % Math.max(1, totalDuration);
  let cursor = 0;
  for (let index = 0; index < candidateTracks.length; index += 1) {
    const nextCursor = cursor + durations[index];
    if (position < nextCursor) {
      const elapsedSeconds = position - cursor;
      return {
        elapsedSeconds,
        ...queuePositionForElapsed(candidateTracks[index], elapsedSeconds),
        track: candidateTracks[index],
      };
    }
    cursor = nextCursor;
  }
  return { elapsedSeconds: 0, queueIndex: 0, seekSeconds: 0, track: candidateTracks[0] };
}

function rotatingStateForTracks(tracks: Track[], now: Date) {
  const playableTracks = tracks.filter(trackHasPlayableAudio);
  if (!playableTracks.length) {
    return null;
  }

  const durations = playableTracks.map((track) => Math.max(60, Math.round(contentDurationForTrack(track))));
  const totalDuration = durations.reduce((total, duration) => total + duration, 0);
  const position = secondsSinceLocalMidnight(now) % Math.max(1, totalDuration);
  let cursor = 0;
  for (let index = 0; index < playableTracks.length; index += 1) {
    const nextCursor = cursor + durations[index];
    if (position < nextCursor) {
      const elapsedSeconds = position - cursor;
      return {
        elapsedSeconds,
        ...queuePositionForElapsed(playableTracks[index], elapsedSeconds),
        track: playableTracks[index],
      };
    }
    cursor = nextCursor;
  }
  return { elapsedSeconds: 0, queueIndex: 0, seekSeconds: 0, track: playableTracks[0] };
}

function selectLiveTrackForTime(tracks: Track[], programs: ProgramRecord[], now: Date) {
  return liveStateForTime(tracks, programs, now)?.track;
}

function programTimeLabel(program: ProgramRecord) {
  // 仅当用户设置了"定时播放"时才显示时间；未设定则用 --:-- 占位。
  if (!program.scheduledAt) {
    return "--:--";
  }
  const date = new Date(program.scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  const parts = shanghaiParts(date);
  return `${parts.hours}:${parts.minutes}`;
}

function programDateLabel(program: ProgramRecord) {
  const raw = program.publishDate || program.publishedAt || program.createdAt;
  const date = program.publishDate ? new Date(`${program.publishDate}T00:00:00+08:00`) : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = shanghaiParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function programTimelineDate(program: ProgramRecord) {
  if (program.publishDate && /^\d{4}-\d{2}-\d{2}$/u.test(program.publishDate)) {
    return program.publishDate;
  }
  const raw = program.scheduledAt || program.publishedAt || program.createdAt;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? localDateKey() : localDateKey(date);
}

function sortOrderValue(program: ProgramRecord) {
  const value = Number(program.sortOrder);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function scheduledTimeValue(program: ProgramRecord) {
  if (!program.scheduledAt) {
    return null;
  }
  const value = new Date(program.scheduledAt).getTime();
  return Number.isFinite(value) ? value : null;
}

function createdTimeValue(program: ProgramRecord) {
  const value = new Date(program.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function compareProgramsByAirOrder(a: ProgramRecord, b: ProgramRecord) {
  const scheduledA = scheduledTimeValue(a);
  const scheduledB = scheduledTimeValue(b);
  if (scheduledA !== null && scheduledB !== null && scheduledA !== scheduledB) {
    return scheduledA - scheduledB;
  }
  if (scheduledA !== null || scheduledB !== null) {
    return scheduledA !== null ? -1 : 1;
  }

  const orderA = sortOrderValue(a);
  const orderB = sortOrderValue(b);
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return createdTimeValue(a) - createdTimeValue(b);
}

function sortProgramsByAirOrder(programs: ProgramRecord[]) {
  return [...programs].sort(compareProgramsByAirOrder);
}

function programsForTimelineDate(programs: ProgramRecord[], date: string) {
  return programs
    .filter((program) => programTimelineDate(program) === date)
    .sort(compareProgramsByAirOrder);
}

function programFinishTimestamp(program: ProgramRecord) {
  if (!program.scheduledAt) {
    return null;
  }
  const startedAt = new Date(program.scheduledAt).getTime();
  if (!Number.isFinite(startedAt)) {
    return null;
  }
  return startedAt + Math.max(1, estimateProgramDuration(program)) * 1000;
}

function programHasFinished(program: ProgramRecord, now = new Date()) {
  const finishedAt = programFinishTimestamp(program);
  return finishedAt !== null && finishedAt <= now.getTime();
}

function estimateProgramDuration(program: ProgramRecord) {
  const playableItems = primaryPlaylistItems(program.playlist).filter((item) => item.audioUrl);
  const contentItems = playableItems.filter((item) => item.type !== "transition" && item.role !== "transition");
  if (contentItems.length) {
    return playableItems.reduce((total, item) => {
      const fallback = item.type === "talk"
        ? Math.max(18, Math.round(String(item.text ?? "").length / 4.2))
        : item.type === "transition" || item.role === "transition"
          ? 8
          : 240;
      return total + Math.max(1, Number(item.duration ?? fallback));
    }, 0);
  }

  const textLength = String(program.script ?? "").replace(/\s+/g, "").length;
  const estimated = Math.max(90, Math.round((textLength / 4.6) * 1.2));
  return Math.min(900, estimated);
}

function programArtwork(index: number) {
  const images = [
    generatedAssets.thumbs.rainyCity,
    generatedAssets.thumbs.warmStar,
    generatedAssets.thumbs.galaxyBreeze,
    generatedAssets.thumbs.cloudJourney,
    generatedAssets.thumbs.afternoonCafe,
    generatedAssets.thumbs.neonHeart,
  ];
  return images[index % images.length];
}

function programToTrack(program: ProgramRecord, index: number): Track {
  const basePlaylist = program.playlist?.length ? primaryPlaylistItems(program.playlist) : undefined;
  const hasPrimaryContent = basePlaylist?.some(
    (item) => item.audioUrl && item.type !== "transition" && item.role !== "transition",
  );
  const fullProgramPlaylist =
    !hasPrimaryContent && program.audioUrl
      ? ([
          {
            audioPath: program.audioPath ?? null,
            audioUrl: program.audioUrl,
            duration: estimateProgramDuration(program),
            host: program.host,
            text: program.script,
            title: cleanAudienceCopy(program.title),
            type: "talk",
          },
        ] satisfies ProgramPlaylistItem[])
      : undefined;
  // 当节目没有显式 playlist（如每日早报/今日热榜），但各口播段已各自配音时，
  // 且没有完整节目配音时，由 segments 构造 talk 播放队列作为兜底。
  const segmentPlaylist =
    !basePlaylist?.length &&
    !fullProgramPlaylist?.length &&
    Array.isArray(program.segments) &&
    program.segments.some((segment) => segment.audioUrl)
      ? program.segments
          .filter((segment) => segment.audioUrl)
          .map((segment, segmentIndex) => ({
            audioPath: segment.audioPath ?? null,
            audioUrl: segment.audioUrl ?? "",
            duration: Math.max(3, Math.round(Number(segment.duration) || segment.text.length / 4.2 || 18)),
            host: segment.hostName || program.host,
            text: segment.text,
            title: `${segment.hostName || program.host} · 第 ${segmentIndex + 1} 段`,
            type: "talk",
          }) satisfies ProgramPlaylistItem)
      : undefined;
  const playlist = basePlaylist?.length
    ? [...basePlaylist, ...(fullProgramPlaylist ?? segmentPlaylist ?? [])]
    : fullProgramPlaylist ?? segmentPlaylist;
  const firstPlaylistAudio = playlist?.find((item) => item.audioUrl)?.audioUrl ?? "";
  return {
    id: `program-${program.id}`,
    title: cleanAudienceCopy(program.title),
    host: program.host,
    duration: estimateProgramDuration(program),
    color: "#7b61ff",
    audioUrl: firstPlaylistAudio || program.audioUrl || "",
    image: programArtwork(index),
    playlist,
  };
}

function splitSpokenText(text: string) {
  const cleaned = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return [];
  }

  const sentences = cleaned
    .split(/(?<=[。！？!?])\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of sentences.length ? sentences : [cleaned]) {
    if (sentence.length <= 72) {
      chunks.push(sentence);
      continue;
    }
    for (let index = 0; index < sentence.length; index += 64) {
      chunks.push(sentence.slice(index, index + 64));
    }
  }
  return chunks;
}

function distributeSubtitleLines(lines: string[], duration: number): SubtitleLine[] {
  const safeDuration = Math.max(1, duration);
  const safeLines = lines.length ? lines : ["欢迎收听星声电台。"];
  // 按字数加权分配每行起始时间（长句给更长窗口），比均分更贴合口播节奏。
  const weights = safeLines.map((text) => Math.max(1, String(text).length));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0) || safeLines.length;
  let elapsed = 0;
  return safeLines.map((text, index) => {
    const start = Math.min(safeDuration, (elapsed / totalWeight) * safeDuration);
    elapsed += weights[index];
    return {
      start,
      time: formatDuration(Math.floor(start)),
      text,
    };
  });
}

function parseTimedLyrics(lyricsText?: string | null) {
  const lines: SubtitleLine[] = [];
  const timePattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/gu;

  for (const rawLine of String(lyricsText ?? "").split(/\r?\n/u)) {
    const matches = Array.from(rawLine.matchAll(timePattern));
    const text = rawLine.replace(timePattern, "").replace(/\s+/g, " ").trim();
    if (!matches.length || !text || /^\[(?:ar|ti|al|by|offset):/iu.test(rawLine)) {
      continue;
    }

    for (const match of matches) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = match[3] ? Number(`0.${match[3].padEnd(3, "0").slice(0, 3)}`) : 0;
      const start = minutes * 60 + seconds + fraction;
      if (Number.isFinite(start)) {
        lines.push({
          start,
          time: formatDuration(Math.floor(start)),
          text,
        });
      }
    }
  }

  return lines.sort((a, b) => a.start - b.start);
}

function subtitleLinesForProgram(program: ProgramRecord | undefined, fallbackDuration: number, playlistItem?: ProgramPlaylistItem) {
  if (playlistItem) {
    const lyricLines = playlistItem.type === "song" ? parseTimedLyrics(playlistItem.lyrics) : [];
    if (lyricLines.length) {
      return lyricLines;
    }

    const text =
      playlistItem.type === "song"
        ? `正在播放：${playlistItem.artist ? `${playlistItem.artist}《${playlistItem.title}》` : playlistItem.title}`
        : playlistItem.text || playlistItem.title;
    return distributeSubtitleLines(splitSpokenText(text), fallbackDuration);
  }

  if (!program) {
    return distributeSubtitleLines(
      lyrics.map((line) => line.text),
      fallbackDuration,
    );
  }

  const segmentTexts = program.segments?.length
    ? program.segments.map((segment) => segment.text)
    : String(program.script ?? "")
        .split(/\n{2,}/u)
        .map((item) => item.trim());
  const lines = segmentTexts.flatMap(splitSpokenText).filter(Boolean);
  const safeLines = lines.length ? lines : splitSpokenText(program.prompt || program.title);
  const duration = Math.max(60, fallbackDuration || estimateProgramDuration(program));

  return distributeSubtitleLines(safeLines, duration);
}

function subtitleIndexForTime(lines: SubtitleLine[], time: number) {
  if (!lines.length) {
    return -1;
  }
  let index = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (time >= lines[lineIndex].start) {
      index = lineIndex;
    }
  }
  return Math.max(0, index);
}

function programHostIdsForProgram(program: ProgramRecord | null) {
  const segmentIds = program?.segments
    ?.map((segment) => segment.hostId)
    .filter((id): id is string => Boolean(id && hosts.some((host) => host.id === id)));
  if (segmentIds?.length) {
    return Array.from(new Set(segmentIds));
  }

  const hostIds = String(program?.host ?? "")
    .split("/")
    .map((name) => hosts.find((host) => host.name === name.trim())?.id)
    .filter((id): id is string => Boolean(id));
  return hostIds.length ? Array.from(new Set(hostIds)) : [hosts[0].id];
}

function latestProgramForPreset(programs: ProgramRecord[], preset: ProgramPreset) {
  const newest = (items: ProgramRecord[]) =>
    [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  const exactMatch = newest(programs.filter((program) => program.programPresetId === preset.id));
  if (exactMatch) {
    return exactMatch;
  }

  // 旧节目尚未保存 programPresetId：按模板类型及核心配置回退匹配，
  // 让升级前已生成的文案和音频也能在预设编辑页正确显示。
  const pluginKind = preset.pluginKind || preset.type;
  if (pluginKind === "daily-briefing") {
    return newest(programs.filter((program) => program.pluginId === "daily-briefing"));
  }
  if (pluginKind === "hot-topics") {
    return newest(programs.filter((program) => program.pluginId === "hot-topics"));
  }
  if (pluginKind === "kugou") {
    return newest(
      programs.filter(
        (program) => program.pluginId === "kugou-music" && program.sourceType !== "flow-filler",
      ),
    );
  }

  const prompt = String(preset.prompt ?? "").trim();
  const titles = new Set([preset.name, preset.title].map((value) => String(value ?? "").trim()).filter(Boolean));
  return newest(
    programs.filter(
      (program) =>
        program.sourceType === "flow-preset" &&
        ((prompt && String(program.prompt ?? "").trim() === prompt) || titles.has(String(program.title ?? "").trim())),
    ),
  );
}

function draftSegmentsForHosts(script: string, hostIds: string[], sourceType?: string | null, voicePrompt = "") {
  const selectedHosts = hosts.filter((host) => hostIds.includes(host.id));
  const safeHosts = selectedHosts.length ? selectedHosts : [hosts[0]];
  const paragraphs = String(script ?? "")
    .split(/\n{2,}/u)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const lines = paragraphs.length ? paragraphs : splitSpokenText(script);

  return lines.map((text, index) => {
    const host = safeHosts[index % safeHosts.length];
    return {
      hostId: host.id,
      hostName: host.name,
      style: voicePrompt.trim() || (sourceType === "plugin" ? "新闻播报，清晰自然，有真人播报感" : host.tone),
      text,
    };
  });
}

function isProgramPlayable(program: ProgramRecord) {
  return program.status === "ready" && (Boolean(program.audioUrl) || Boolean(primaryPlaylistItems(program.playlist).some((item) => item.audioUrl)));
}

function playbackQueueForTrack(track: Track) {
  const queue = primaryPlaylistItems(track.playlist).filter((item) => item.audioUrl);
  if (queue?.length) {
    return queue;
  }
  return track.audioUrl
    ? [
        {
          audioUrl: track.audioUrl,
          duration: track.duration,
          title: track.title,
          type: "song",
        } satisfies ProgramPlaylistItem,
      ]
    : [];
}

function playlistItemKey(item?: ProgramPlaylistItem) {
  if (!item) {
    return "";
  }
  return `${item.source ?? "kugou"}:${item.sourceId || item.hash || `${item.artist ?? ""}-${item.title}`.trim()}`;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = window.localStorage.getItem("star-radio.admin-token");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers,
  });
  const text = await response.text();
  let data: unknown = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error(readMessage(data, `${response.status} ${response.statusText}`)) as Error & {
      data?: unknown;
    };
    error.data = data;
    throw error;
  }

  return data as T;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("音效文件读取失败"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function formatStorageSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function formatAdminDateTime(value?: string | null) {
  if (!value) {
    return "暂无";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "暂无";
  }
  return date.toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}

function footerLinkText(value?: string | null) {
  const text = String(value ?? "").trim();
  return text && text !== "AI Radio Admin" ? text : defaultSystemSettings.footerText;
}

function normalizeThemeTemplates(templates?: ThemeTemplate[]) {
  const templateMap = new Map(defaultSystemSettings.templates.map((template) => [template.id, template]));
  (templates ?? []).forEach((template) => {
    if (!template?.id || !template.name) {
      return;
    }
    templateMap.set(template.id, {
      description: template.description ?? "",
      id: template.id,
      mode: template.mode === "dark" ? "dark" : "light",
      name: template.name,
    });
  });
  return Array.from(templateMap.values());
}

function normalizeSystemSettings(settings?: Partial<SystemSettings> | null): SystemSettings {
  const templates = normalizeThemeTemplates(settings?.templates);
  const themeTemplateId = templates.some((template) => template.id === settings?.themeTemplateId)
    ? String(settings?.themeTemplateId)
    : defaultSystemSettings.themeTemplateId;
  return {
    appName: String(settings?.appName ?? defaultSystemSettings.appName),
    autoThemeByTime: Boolean(settings?.autoThemeByTime),
    footerText: footerLinkText(settings?.footerText),
    logoUrl: String(settings?.logoUrl ?? ""),
    subtitle: String(settings?.subtitle ?? defaultSystemSettings.subtitle),
    templates,
    themeTemplateId,
  };
}

function resolveThemeTemplate(settings: SystemSettings, now = new Date()) {
  const templates = normalizeThemeTemplates(settings.templates);
  if (settings.autoThemeByTime) {
    const hour = shanghaiParts(now).hoursNum;
    const night = hour >= 19 || hour < 7;
    return templates.find((template) => template.mode === (night ? "dark" : "light")) ?? templates[0];
  }
  return templates.find((template) => template.id === settings.themeTemplateId) ?? templates[0];
}

function applyThemeToDocument(settings: SystemSettings, overrideMode?: AudienceTheme | null) {
  const template = resolveThemeTemplate(settings);
  document.documentElement.dataset.theme = overrideMode ?? template.mode;
  document.documentElement.dataset.themeTemplate = overrideMode ? `audience-${overrideMode}` : template.id;
}

export function App() {
  const isAdminRoute = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
  const [adminToken, setAdminToken] = useState(() => window.localStorage.getItem("star-radio.admin-token") ?? "");
  const [adminUser, setAdminUser] = useState(() => window.localStorage.getItem("star-radio.admin-user") ?? "");
  const [adminLoginStatus, setAdminLoginStatus] = useState(isAdminRoute ? "请输入后台账号登录" : "");
  const [adminSection, setAdminSection] = useState<AdminSection>("dashboard");
  const [activeNav, setActiveNav] = useState(navItems[0]);
  const [activeHostId, setActiveHostId] = useState(hosts[0].id);
  const [previewingHostId, setPreviewingHostId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [liveProgress, setLiveProgress] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(tracks[0].duration);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [volume, setVolume] = useState(0.8);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [userLoggedIn, setUserLoggedIn] = useState(() => window.localStorage.getItem("star-radio.user-logged-in") === "true");
  const [query, setQuery] = useState("");
  const [currentTrack, setCurrentTrack] = useState<Track>(tracks[0]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [backgroundEffectIndex, setBackgroundEffectIndex] = useState(0);
  const [programPreviewBackgroundIndex, setProgramPreviewBackgroundIndex] = useState(0);
  const [pendingAudioSeek, setPendingAudioSeek] = useState<{
    audioUrl: string;
    queueIndex: number;
    requestId: number;
    seconds: number;
    trackId: string;
  } | null>(null);
  const [mainPlaybackLeadEnabled, setMainPlaybackLeadEnabled] = useState(false);
  const livePlaybackStartedRef = useRef(false);
  const [runtimeLyrics, setRuntimeLyrics] = useState<Record<string, string>>({});
  const [runtimeAudioUrls, setRuntimeAudioUrls] = useState<Record<string, { resolvedAt: number; url: string }>>({});
  const [favorites, setFavorites] = useState<string[]>(() => readSavedIds("star-radio.favorites"));
  const [reminders, setReminders] = useState<string[]>(() => readSavedIds("star-radio.reminders"));
  const [manualMusicQuery, setManualMusicQuery] = useState("");
  const [manualMusicResults, setManualMusicResults] = useState<MusicCandidate[]>([]);
  const [manualMusicSelected, setManualMusicSelected] = useState<MusicCandidate[]>([]);
  const [manualMusicSearchBusy, setManualMusicSearchBusy] = useState(false);
  const [manualMusicStatus, setManualMusicStatus] = useState("");
  const [adminConfig, setAdminConfig] = useState<AdminConfig>(() => readAdminConfig());
  const [configSavedAt, setConfigSavedAt] = useState(() => window.localStorage.getItem("star-radio.admin-config.saved-at") ?? "");
  const [configTestStatus, setConfigTestStatus] = useState<Record<ServiceKey, string>>({
    llm: "未检测",
    plugins: "未检测",
    suno: "未检测",
    tts: "未检测",
  });
  const [backendStatus, setBackendStatus] = useState("正在连接后台数据库");
  const [programPrompt, setProgramPrompt] = useState("今晚的城市下着微雨，请生成一段适合夜间直播的治愈系 AI 电台节目。");
  const [customContentMode, setCustomContentMode] = useState<CustomContentMode>("ai");
  const [programTitle, setProgramTitle] = useState("星夜漫游 · 今晚的风");
  const [programType, setProgramType] = useState<ProgramType>("custom");
  const [programStatus, setProgramStatus] = useState("等待生成节目文案");
  const [programBusy, setProgramBusy] = useState(false);
  const [programPresetBusy, setProgramPresetBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [programPushBusyId, setProgramPushBusyId] = useState("");
  const [dailyBriefingBusy, setDailyBriefingBusy] = useState(false);
  const [hotTopicsBusy, setHotTopicsBusy] = useState(false);
  const [kugouProgramBusy, setKugouProgramBusy] = useState(false);
  const [mediaProgramBusy, setMediaProgramBusy] = useState(false);
  const [sunoMusicBusy, setSunoMusicBusy] = useState(false);
  const [sunoCandidates, setSunoCandidates] = useState<SunoCandidate[]>([]);
  const [kugouLoginBusy, setKugouLoginBusy] = useState(false);
  const [kugouQr, setKugouQr] = useState<{ key: string; qrImage: string; qrUrl: string } | null>(null);
  const [kugouStatus, setKugouStatus] = useState("酷狗状态未检测");
  const [kugouApiName, setKugouApiName] = useState("search");
  const [kugouApiParams, setKugouApiParams] = useState("{\"keywords\":\"周杰伦\",\"pagesize\":3}");
  const [kugouApiResult, setKugouApiResult] = useState("");
  const [kugouApiBusy, setKugouApiBusy] = useState(false);
  const [generatedProgram, setGeneratedProgram] = useState<ProgramRecord | null>(null);
  const [selectedTimelineDate, setSelectedTimelineDate] = useState(() => localDateKey());
  const [programDraft, setProgramDraft] = useState("");
  const [programPlaybackSpeed, setProgramPlaybackSpeed] = useState(1);
  const [programScheduledTime, setProgramScheduledTime] = useState("");
  const [programRewriteBusy, setProgramRewriteBusy] = useState(false);
  const [programTtsBusy, setProgramTtsBusy] = useState(false);
  const [programArchives, setProgramArchives] = useState<ProgramArchiveResponse["archives"]>([]);
  const [programCategoryId, setProgramCategoryId] = useState("");
  const [programCategories, setProgramCategories] = useState<ProgramCategory[]>([]);
  const [programHistory, setProgramHistory] = useState<ProgramRecord[]>([]);
  const [programHostIds, setProgramHostIds] = useState<string[]>([hosts[0].id, hosts[3].id]);
  const [programPresets, setProgramPresets] = useState<ProgramPreset[]>([]);
  const [editingProgramPresetId, setEditingProgramPresetId] = useState("");
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});
  const [soundEffectCategories, setSoundEffectCategories] = useState<SoundEffectCategory[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(defaultSystemSettings);
  const [audienceTheme, setAudienceTheme] = useState<AudienceTheme | null>(() => readAudienceTheme());
  const [adminNotice, setAdminNotice] = useState<AdminNotice>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement>(null);
  const programAudioRef = useRef<HTMLAudioElement>(null);
  const programPreviewBackgroundAudioRef = useRef<HTMLAudioElement>(null);
  const lyricListRef = useRef<HTMLDivElement>(null);
  const volumeCloseTimerRef = useRef<number | null>(null);
  const hostPreviewTimerRef = useRef<number | null>(null);
  const liveEndedTrackRef = useRef<{ dateKey: string; trackId: string } | null>(null);
  const liveInterruptedFillerRef = useRef<LiveInterruptedFillerState | null>(null);
  const liveFillerCursorRef = useRef<Record<string, number>>(readLiveFillerCursor());
  const liveFillerResetStateRef = useRef<Record<string, string>>(readLiveFillerResetState());
  const fillerTopUpInFlightRef = useRef<Set<string>>(new Set());
  const fillerTopUpAttemptRef = useRef<Set<string>>(new Set());

  const adminLoggedIn = Boolean(adminToken);
  const currentThemeMode = audienceTheme ?? resolveThemeTemplate(systemSettings, clockNow).mode;

  const activeHost = hosts.find((host) => host.id === activeHostId) ?? hosts[0];
  const playablePrograms = useMemo(() => {
    const today = localDateKey();
    const readyPrograms = programHistory.filter(isProgramPlayable);
    const eligiblePrograms = readyPrograms.filter((program) => !program.publishDate || program.publishDate <= today);
    const publishedToday = eligiblePrograms.filter((program) => program.publishDate === today);
    if (!publishedToday.length) {
      return sortProgramsByAirOrder(eligiblePrograms);
    }
    const publishedIds = new Set(publishedToday.map((program) => program.id));
    return [
      ...sortProgramsByAirOrder(publishedToday),
      ...sortProgramsByAirOrder(eligiblePrograms.filter((program) => !publishedIds.has(program.id))),
    ];
  }, [programHistory]);
  const backendTracks = useMemo(() => playablePrograms.map(programToTrack), [playablePrograms]);
  const publicTrackCatalog = backendTracks;
  const onDemandTrackCatalog = useMemo(
    () => publicTrackCatalog.filter((track) => {
      const program = programForTrack(track, playablePrograms);
      return program && !isAutoFillerProgram(program) && programHasFinished(program, clockNow);
    }),
    [clockNow, playablePrograms, publicTrackCatalog],
  );
  const libraryTrackCatalog = useMemo(
    () => onDemandTrackCatalog
      .filter((track) => track.playlist?.some((item) => item.type === "song" && item.audioUrl))
      .sort((a, b) => {
        const programA = programForTrack(a, playablePrograms);
        const programB = programForTrack(b, playablePrograms);
        return (programB ? programFinishTimestamp(programB) ?? 0 : 0) - (programA ? programFinishTimestamp(programA) ?? 0 : 0);
      })
      .slice(0, PUBLIC_PROGRAM_LIST_LIMIT),
    [onDemandTrackCatalog, playablePrograms],
  );
  const getSequentialFillerState = useCallback(
    (
      now = new Date(),
      advance = false,
      options: { afterScheduledTrack?: Track | null; seedFromTimeline?: boolean } = {},
    ): LivePlaybackState | null => {
      const dateKey = localDateKey(now);
      const entries = fillerSongEntriesForDate(publicTrackCatalog, playablePrograms, dateKey);
      if (!entries.length) {
        return null;
      }
      const storedCursor = liveFillerCursorRef.current[dateKey];
      const exactInterruptedCursor =
        options.afterScheduledTrack &&
        liveInterruptedFillerRef.current?.dateKey === dateKey &&
        liveInterruptedFillerRef.current
          ? nextFillerCursorAfterInterruptedEntry(entries, liveInterruptedFillerRef.current)
          : null;
      const afterScheduledCursor = exactInterruptedCursor ?? nextFillerCursorAfterScheduledProgram(
        publicTrackCatalog,
        playablePrograms,
        now,
        options.afterScheduledTrack,
      );
      const timelineState =
        (options.seedFromTimeline && afterScheduledCursor === null) || !Number.isFinite(storedCursor)
          ? liveStateForTime(publicTrackCatalog, playablePrograms, now, null)
          : null;
      const timelineIndex = fillerEntryIndexForState(entries, timelineState);
      const currentCursor =
        afterScheduledCursor !== null
          ? afterScheduledCursor
          : options.seedFromTimeline && timelineIndex >= 0
          ? timelineIndex + 1
          : Number.isFinite(storedCursor)
            ? storedCursor
            : timelineIndex >= 0
              ? timelineIndex
              : 0;
      const normalizedIndex = ((currentCursor % entries.length) + entries.length) % entries.length;
      const entry = entries[normalizedIndex];
      if (advance) {
        liveFillerCursorRef.current[dateKey] = (normalizedIndex + 1) % entries.length;
        writeLiveFillerCursor(liveFillerCursorRef.current);
        liveInterruptedFillerRef.current = null;
      }
      return {
        elapsedSeconds: 0,
        queueIndex: entry.queueIndex,
        seekSeconds: 0,
        track: entry.track,
      };
    },
    [playablePrograms, publicTrackCatalog],
  );
  const getLivePlaybackStateForTime = useCallback(
    (now = new Date(), advanceFiller = false): LivePlaybackState | null => {
      const timelineState = liveStateForTime(publicTrackCatalog, playablePrograms, now, null);
      const targetProgram = timelineState ? programForTrack(timelineState.track, playablePrograms) : undefined;
      if (targetProgram && !targetProgram.scheduledAt) {
        return advanceFiller ? getSequentialFillerState(now, true) ?? timelineState : timelineState;
      }
      return timelineState;
    },
    [getSequentialFillerState, playablePrograms, publicTrackCatalog],
  );
  const applyLivePlaybackState = useCallback((targetLiveState: LivePlaybackState, play = true) => {
    const targetTrack = targetLiveState.track;
    const targetQueue = playbackQueueForTrack(targetTrack);
    const targetQueueItem = targetQueue[Math.min(targetLiveState.queueIndex, Math.max(0, targetQueue.length - 1))];
    const targetAudioUrl = targetQueueItem?.audioUrl || targetTrack.audioUrl;
    if (!targetAudioUrl) {
      return false;
    }

    // 从转场开始播放时，转场结束后仍需执行“背景/人声谁先播”的间隔设置。
    // 若直接定位到节目中段，则不再补播开场间隔。
    setMainPlaybackLeadEnabled(
      targetQueueItem?.type === "transition" || targetQueueItem?.role === "transition",
    );
    setCurrentTrack(targetTrack);
    setCurrentQueueIndex(targetLiveState.queueIndex);
    setPendingAudioSeek({
      audioUrl: targetAudioUrl,
      queueIndex: targetLiveState.queueIndex,
      requestId: Date.now(),
      seconds: targetLiveState.seekSeconds,
      trackId: targetTrack.id,
    });
    setPlaybackTime(targetLiveState.seekSeconds);
    setPlaybackDuration(targetQueueItem?.duration || targetTrack.duration || 1);
    setLiveProgress(0);
    setPlaying(play);
    return true;
  }, []);
  const liveState = useMemo(
    () => getLivePlaybackStateForTime(clockNow, false),
    [clockNow, getLivePlaybackStateForTime],
  );
  const liveTrack = liveState?.track ?? publicTrackCatalog[0];
  const liveButtonPlaying = Boolean(playing && livePlaybackStartedRef.current && trackHasPlayableAudio(currentTrack));
  const dayProgress = Math.min(100, Math.max(0, (secondsSinceLocalMidnight(clockNow) / DAY_SECONDS) * 100));
  // 进度条两端标记：当天 00:00 与次日 00:00，带月-日，明确起止位置。
  const timelineStartDateLabel = `${timelineDateLabel(clockNow)}`;
  const timelineEndDateLabel = `${timelineDateLabel(new Date(clockNow.getTime() + DAY_SECONDS * 1000))}`;
  const currentLiveClock = liveClockLabel(clockNow);
  const currentProgram = useMemo(() => {
    if (!currentTrack.id.startsWith("program-")) {
      return undefined;
    }
    const id = currentTrack.id.replace(/^program-/u, "");
    return programHistory.find((program) => program.id === id);
  }, [currentTrack.id, programHistory]);
  const currentBackgroundItem = useMemo(() => backgroundPlaylistItems(currentProgram)[0], [currentProgram]);
  const currentBackgroundEffects = currentBackgroundItem?.items?.filter((item) => item.audioUrl) ?? [];
  const currentBackgroundEffect =
    currentBackgroundEffects.length > 0
      ? currentBackgroundEffects[
          currentBackgroundItem?.loopMode === "sequence"
            ? backgroundEffectIndex % currentBackgroundEffects.length
            : 0
        ]
      : undefined;
  const backgroundLeadSeconds = Math.max(0, Number(currentBackgroundItem?.leadSeconds ?? 0) || 0);
  const programPreviewBackgroundItem = useMemo(() => backgroundPlaylistItems(generatedProgram ?? undefined)[0], [generatedProgram]);
  const programPreviewBackgroundEffects = programPreviewBackgroundItem?.items?.filter((item) => item.audioUrl) ?? [];
  const programPreviewBackgroundEffect =
    programPreviewBackgroundEffects.length > 0
      ? programPreviewBackgroundEffects[
          programPreviewBackgroundItem?.loopMode === "sequence"
            ? programPreviewBackgroundIndex % programPreviewBackgroundEffects.length
            : 0
        ]
      : undefined;
  const programPreviewBackgroundLeadSeconds = Math.max(0, Number(programPreviewBackgroundItem?.leadSeconds ?? 0) || 0);
  const currentTrackQueue = useMemo(() => playbackQueueForTrack(currentTrack), [currentTrack]);
  const currentQueueItem = currentTrackQueue[Math.min(currentQueueIndex, Math.max(0, currentTrackQueue.length - 1))];
  const isTransitionQueueItem = currentQueueItem?.type === "transition" || currentQueueItem?.role === "transition";
  const currentMainVolume = Math.min(
    1,
    Math.max(0, volume * (isTransitionQueueItem ? Number(currentQueueItem?.volume ?? 1) : 1)),
  );
  const mainPlaybackDelayMs =
    !isTransitionQueueItem && mainPlaybackLeadEnabled && currentBackgroundItem?.startMode === "effect-first"
      ? backgroundLeadSeconds * 1000
      : 0;
  const currentQueueItemKey = playlistItemKey(currentQueueItem);
  const currentQueueItemWithLyrics = currentQueueItem
    ? {
        ...currentQueueItem,
        lyrics: currentQueueItem.lyrics || runtimeLyrics[currentQueueItemKey],
      }
    : undefined;
  const remoteSongResolutionKey = currentProgram && currentQueueItem?.type === "song" && ["kugou", "netease", "qq"].includes(String(currentQueueItem.source ?? ""))
    ? `${currentProgram.id}:${currentQueueIndex}:${currentQueueItem.source}:${currentQueueItem.sourceId || currentQueueItem.hash || currentQueueItem.mediaId || currentQueueItem.title}`
    : "";
  const resolvedAudioEntry = remoteSongResolutionKey ? runtimeAudioUrls[remoteSongResolutionKey] : undefined;
  const resolvedAudioUrl = resolvedAudioEntry?.url ?? "";
  const currentAudioUrl = remoteSongResolutionKey
    ? resolvedAudioUrl
    : currentQueueItemWithLyrics?.audioUrl || currentTrack.audioUrl;
  const requestFillerTopUpIfNeeded = useCallback(async (
    program: ProgramRecord,
    queue: ProgramPlaylistItem[],
    queueIndex: number,
    effectiveFillerElapsed: number,
  ) => {
    if (!program.id || !isAutoFillerProgram(program) || program.musicPlaylistId) {
      return;
    }
    const songIndexes = queue
      .map((item, index) => (item.type === "song" && item.audioUrl ? index : -1))
      .filter((index) => index >= 0);
    if (!songIndexes.length || songIndexes.length >= FILLER_MAX_SONGS) {
      return;
    }
    const currentSongOffset = songIndexes.findIndex((index) => index === queueIndex);
    const remainingSongs = currentSongOffset >= 0 ? songIndexes.length - currentSongOffset - 1 : songIndexes.length;
    if (remainingSongs > FILLER_TOP_UP_THRESHOLD) {
      return;
    }

    const key = `${program.id}:${songIndexes.length}`;
    if (fillerTopUpInFlightRef.current.has(key) || fillerTopUpAttemptRef.current.has(key)) {
      return;
    }
    fillerTopUpInFlightRef.current.add(key);
    fillerTopUpAttemptRef.current.add(key);
    try {
      const result = await apiJson<ProgramListResponse & { program?: ProgramRecord | null }>(
        `/api/programs/${program.id}/filler/top-up`,
        {
          body: JSON.stringify({
            batchSize: FILLER_TOP_UP_BATCH_SIZE,
            effectiveFillerElapsed,
            maxSongs: FILLER_MAX_SONGS,
            remainingSongs,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      setProgramHistory((current) => mergeProgramSnapshots(current, result.programs));
      if (result.program) {
        setGeneratedProgram((current) => current?.id === result.program?.id ? result.program as ProgramRecord : current);
      }
    } catch {
      window.setTimeout(() => fillerTopUpAttemptRef.current.delete(key), 60_000);
    } finally {
      fillerTopUpInFlightRef.current.delete(key);
    }
  }, []);
  const currentDisplayTitle =
    currentQueueItemWithLyrics?.type === "song" ? currentQueueItemWithLyrics.title : cleanAudienceCopy(currentTrack.title);
  const currentDisplayHost =
    currentQueueItemWithLyrics?.type === "song"
      ? currentQueueItemWithLyrics.artist || "音乐人"
      : currentQueueItemWithLyrics?.host || currentTrack.host || activeHost.name;
  const effectivePlaybackDuration = Math.max(1, playbackDuration || currentTrack.duration || 1);
  const hasBackendData = backendTracks.length > 0;
  const heroDescription = !hasBackendData
    ? "电台节目编排中，节目上线后将自动开始播出。"
    : currentQueueItemWithLyrics?.type === "song"
      ? `歌单连播进行中，当前曲目来自《${cleanAudienceCopy(currentTrack.title)}》。`
      : currentProgram
        ? `${currentProgram.categoryName ?? "直播节目"}正在播出，节目会按编排自动接续。`
        : "24小时节目流正在播出，当前时段会自动进入下一档。";
  const currentSubtitleLines = useMemo(
    () => subtitleLinesForProgram(currentProgram, effectivePlaybackDuration, currentTrack.playlist?.length ? currentQueueItemWithLyrics : undefined),
    [currentProgram, currentQueueItemWithLyrics, currentTrack.playlist, effectivePlaybackDuration],
  );
  const activeLyric = subtitleIndexForTime(currentSubtitleLines, playbackTime);
  const timelineMarkLabels = DAY_TIMELINE_MARKS;
  const favoriteTracks = useMemo(
    () => onDemandTrackCatalog.filter((track) => favorites.includes(track.id)),
    [favorites, onDemandTrackCatalog],
  );
  const rankedTracks = useMemo(() => [...onDemandTrackCatalog].sort((a, b) => b.duration - a.duration), [onDemandTrackCatalog]);
  const publicScheduleItems = useMemo(() => {
    const today = localDateKey();
    const seen = new Set<string>();
    return programHistory
      .filter((program) => {
        if (program.publishDate !== today || !program.scheduledAt) {
          return false;
        }
        const finishedAt = programFinishTimestamp(program);
        return finishedAt !== null && finishedAt > clockNow.getTime();
      })
      .sort((a, b) => {
        const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        return at - bt;
      })
      .filter((program) => {
        const time = programTimeLabel(program);
        const dedupeKey = `${time}|${program.title}`;
        if (seen.has(dedupeKey)) {
          return false;
        }
        seen.add(dedupeKey);
        return true;
      })
      .slice(0, PUBLIC_PROGRAM_LIST_LIMIT)
      .map((program) => ({
        id: program.id,
        time: programTimeLabel(program),
        title: cleanAudienceCopy(program.title),
        host: program.host,
        style: `${program.categoryName ?? "节目"} · ${new Date(program.scheduledAt || 0).getTime() <= clockNow.getTime() ? "正在播出" : program.status === "ready" ? "可播" : "待配音"}`,
      }));
  }, [clockNow, programHistory]);
  const publicHistoryItems = useMemo(() => {
    const today = localDateKey();
    const seen = new Set<string>();
    return programHistory
      .filter((program) =>
        program.publishDate === today &&
        isProgramPlayable(program) &&
        !isAutoFillerProgram(program) &&
        programHasFinished(program, clockNow),
      )
      .sort((a, b) => (programFinishTimestamp(b) ?? 0) - (programFinishTimestamp(a) ?? 0))
      .filter((program) => {
        if (seen.has(program.id)) {
          return false;
        }
        seen.add(program.id);
        return true;
      })
      .slice(0, PUBLIC_PROGRAM_LIST_LIMIT)
      .map((program, index) => ({
        id: program.id,
        title: cleanAudienceCopy(program.title),
        host: program.host,
        date: programDateLabel(program),
        duration: program.audioUrl ? formatDuration(estimateProgramDuration(program)) : "待配音",
        color: "#7b61ff",
        image: programArtwork(index),
      }));
  }, [clockNow, programHistory]);
  const timelinePrograms = useMemo(
    () => programsForTimelineDate(programHistory, selectedTimelineDate),
    [programHistory, selectedTimelineDate],
  );

  const programScheduledAtForRequest = () => scheduledAtFromDateAndTime(selectedTimelineDate, programScheduledTime);

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 12);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  useEffect(() => {
    if (!isAdminRoute || !adminToken) {
      return;
    }

    let cancelled = false;
    const verifySession = async () => {
      try {
        const session = await apiJson<{ ok: boolean; user: { username: string } }>("/api/admin/session");
        if (!cancelled) {
          setAdminUser(session.user.username);
          window.localStorage.setItem("star-radio.admin-user", session.user.username);
          setAdminLoginStatus("后台已登录");
        }
      } catch (error) {
        if (!cancelled) {
          window.localStorage.removeItem("star-radio.admin-token");
          window.localStorage.removeItem("star-radio.admin-user");
          setAdminToken("");
          setAdminUser("");
          setAdminLoginStatus(`登录状态已失效：${errorMessage(error)}`);
        }
      }
    };

    void verifySession();
    return () => {
      cancelled = true;
    };
  }, [adminToken, isAdminRoute]);

  useEffect(() => {
    let cancelled = false;

    const syncBackend = async () => {
      try {
        if (isAdminRoute) {
          if (!adminToken) {
            setBackendStatus("请先登录后台管理");
            return;
          }

          const serverData = await apiJson<ConfigResponse>("/api/config");
          const localSavedAt = window.localStorage.getItem("star-radio.admin-config.saved-at") ?? "";
          const shouldUseServer =
            Boolean(serverData.savedAt) &&
            (!localSavedAt || new Date(serverData.savedAt).getTime() > new Date(localSavedAt).getTime());

          if (cancelled) {
            return;
          }

          if (shouldUseServer) {
            setAdminConfig(serverData.config);
            writeAdminConfig(serverData.config);
            window.localStorage.setItem("star-radio.admin-config.saved-at", serverData.savedAt);
            setConfigSavedAt(serverData.savedAt);
            setBackendStatus("已读取后台数据库配置");
          } else if (localSavedAt) {
            const saved = await apiJson<ConfigResponse>("/api/config", {
              body: JSON.stringify({ config: adminConfig }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            });
            if (!cancelled) {
              setConfigSavedAt(saved.savedAt);
              setBackendStatus("已同步本地配置到后台数据库");
            }
          } else {
            setBackendStatus("后台数据库已连接，等待保存配置");
          }
        } else {
          setBackendStatus("前台已连接后台节目库");
        }

        const systemData = await apiJson<SystemSettingsResponse>("/api/system-settings");
        const programData = await apiJson<ProgramListResponse>("/api/programs");
        const categoryData = await apiJson<ProgramCategoryResponse>("/api/program-categories");
        const archiveData = isAdminRoute && adminToken ? await apiJson<ProgramArchiveResponse>("/api/program-archives") : null;
        const soundData = isAdminRoute && adminToken ? await apiJson<SoundEffectsResponse>("/api/sound-effects") : null;
        const presetData = isAdminRoute && adminToken ? await apiJson<ProgramPresetsResponse>("/api/program-presets") : null;
        if (!cancelled) {
          setSystemSettings(normalizeSystemSettings(systemData.settings));
          setProgramHistory(programData.programs);
          setGeneratedProgram(programData.programs[0] ?? null);
          setProgramCategories(categoryData.categories);
          if (archiveData) {
            setProgramArchives(archiveData.archives);
          }
          if (soundData) {
            setSoundEffectCategories(soundData.categories);
          }
          if (presetData) {
            setProgramPresets(presetData.presets);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setBackendStatus(`后台未连接：${errorMessage(error)}`);
        }
      }
    };

    void syncBackend();

    return () => {
      cancelled = true;
    };
  }, [adminToken, isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute) {
      return;
    }
    let cancelled = false;
    const refreshPrograms = async () => {
      try {
        const data = await apiJson<ProgramListResponse>("/api/programs");
        if (!cancelled) {
          setProgramHistory((current) => mergeProgramSnapshots(current, data.programs));
        }
      } catch {
        // 前台轮询失败时保留当前节目，下一轮自动重试。
      }
    };
    const timer = window.setInterval(() => void refreshPrograms(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute) {
      return;
    }
    const dateKey = localDateKey(clockNow);
    const resetProgram = [...playablePrograms]
      .filter((program) =>
        program.publishDate === dateKey &&
        isAutoFillerProgram(program) &&
        program.playbackMode === "sequential" &&
        program.restartFromBeginning &&
        Boolean(program.playbackResetAt),
      )
      .sort((a, b) => new Date(b.playbackResetAt || 0).getTime() - new Date(a.playbackResetAt || 0).getTime())[0];
    const resetToken = resetProgram?.playbackResetAt ?? "";
    if (!resetProgram || !resetToken || liveFillerResetStateRef.current[resetProgram.id] === resetToken) {
      return;
    }

    liveFillerResetStateRef.current[resetProgram.id] = resetToken;
    writeLiveFillerResetState(liveFillerResetStateRef.current);
    liveFillerCursorRef.current[dateKey] = 0;
    writeLiveFillerCursor(liveFillerCursorRef.current);
    liveInterruptedFillerRef.current = null;

    const currentProgram = programForTrack(currentTrack, playablePrograms);
    if (!playing || !currentProgram || !isAutoFillerProgram(currentProgram)) {
      return;
    }
    const firstEntry = fillerSongEntriesForDate(publicTrackCatalog, playablePrograms, dateKey)[0];
    if (!firstEntry) {
      return;
    }
    const queue = playbackQueueForTrack(firstEntry.track);
    const item = queue[firstEntry.queueIndex];
    const audioUrl = item?.audioUrl || firstEntry.track.audioUrl;
    setCurrentTrack(firstEntry.track);
    setCurrentQueueIndex(firstEntry.queueIndex);
    setPlaybackTime(0);
    setLiveProgress(0);
    setPlaybackDuration(item?.duration || firstEntry.track.duration || 1);
    if (audioUrl) {
      setPendingAudioSeek({
        audioUrl,
        queueIndex: firstEntry.queueIndex,
        requestId: Date.now(),
        seconds: 0,
        trackId: firstEntry.track.id,
      });
    }
  }, [clockNow, currentTrack, isAdminRoute, playablePrograms, playing, publicTrackCatalog]);

  useEffect(() => {
    document.title = systemSettings.appName || defaultSystemSettings.appName;
  }, [systemSettings.appName]);

  useEffect(() => {
    const applyTheme = () => {
      applyThemeToDocument(systemSettings, audienceTheme);
    };
    applyTheme();
    if (audienceTheme || !systemSettings.autoThemeByTime) {
      return undefined;
    }
    const timer = window.setInterval(applyTheme, 60_000);
    return () => window.clearInterval(timer);
  }, [audienceTheme, systemSettings]);

  useEffect(() => {
    if (!backendTracks.length) {
      return;
    }
    const targetLiveState = getLivePlaybackStateForTime(new Date(), false);
    const currentInBackend = backendTracks.some((track) => track.id === currentTrack.id);
    if (!currentInBackend && targetLiveState) {
      const targetQueue = playbackQueueForTrack(targetLiveState.track);
      const targetQueueItem = targetQueue[Math.min(targetLiveState.queueIndex, Math.max(0, targetQueue.length - 1))];
      setCurrentQueueIndex(targetLiveState.queueIndex);
      setPlaybackTime(targetLiveState.seekSeconds);
      setPlaybackDuration(targetQueueItem?.duration || targetLiveState.track.duration || 1);
    }
    setCurrentTrack((current) => {
      const refreshedTrack = backendTracks.find((track) => track.id === current.id);
      if (refreshedTrack) {
        return refreshedTrack;
      }
      return targetLiveState?.track ?? selectLiveTrackForTime(backendTracks, playablePrograms, new Date()) ?? backendTracks[0];
    });
  }, [backendTracks, currentTrack.id, getLivePlaybackStateForTime, playablePrograms]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!playing || !livePlaybackStartedRef.current) {
      return;
    }
    const program = programForTrack(currentTrack, playablePrograms);
    if (!program || !isAutoFillerProgram(program) || program.musicPlaylistId) {
      return;
    }
    const songIndexes = currentTrackQueue
      .map((item, index) => item.type === "song" && item.audioUrl ? index : -1)
      .filter((index) => index >= 0);
    const currentSongOffset = songIndexes.findIndex((index) => index === currentQueueIndex);
    if (currentSongOffset < 0 || songIndexes.length - currentSongOffset - 1 > FILLER_TOP_UP_THRESHOLD) {
      return;
    }
    const remainingSeconds = songIndexes.slice(currentSongOffset).reduce((total, index, offset) => {
      const duration = playlistItemDuration(currentTrackQueue[index], currentTrack.duration || 240);
      return total + (offset === 0 ? Math.max(1, duration - playbackTime) : duration);
    }, 0);
    const effectiveFillerElapsed = fillerElapsedForTime(publicTrackCatalog, playablePrograms, new Date()) + remainingSeconds;
    void requestFillerTopUpIfNeeded(
      program,
      currentTrackQueue,
      currentQueueIndex,
      effectiveFillerElapsed,
    );
  }, [
    currentQueueIndex,
    currentTrack,
    currentTrackQueue,
    playablePrograms,
    playbackTime,
    playing,
    publicTrackCatalog,
    requestFillerTopUpIfNeeded,
  ]);

  // 直播播放模式下持续跟随时间线：定时节目到点即切换，错过页面刷新窗口也按当前时间定位。
  useEffect(() => {
    if (!playing || !livePlaybackStartedRef.current || !liveState?.track) {
      return;
    }

    const targetTrack = liveState.track;
    const endedTrack = liveEndedTrackRef.current;
    if (endedTrack && endedTrack.dateKey === localDateKey(clockNow) && endedTrack.trackId === targetTrack.id) {
      return;
    }
    if (endedTrack && endedTrack.trackId !== targetTrack.id) {
      liveEndedTrackRef.current = null;
    }
    const currentProgramForLive = currentTrack.id.startsWith("program-")
      ? playablePrograms.find((program) => `program-${program.id}` === currentTrack.id)
      : undefined;
    const targetProgramForLive = targetTrack.id.startsWith("program-")
      ? playablePrograms.find((program) => `program-${program.id}` === targetTrack.id)
      : undefined;

    // 当前定时节目音频尚未播完时，不要被 liveState 时间线估算提前切走；
    // 等 markEnded 自然触发后再衔接下一首。
    if (currentProgramForLive?.scheduledAt && !targetProgramForLive?.scheduledAt) {
      return;
    }
    // 同一节目内不要用时间线估算重载 queue；真实音频 ended 事件会推进下一段。
    // 估算时长略短时，提前重载会表现为节目/AI 配音最后几秒卡顿或被切断。
    if (targetTrack.id === currentTrack.id) {
      return;
    }

    applyLivePlaybackState(liveState, true);
  }, [applyLivePlaybackState, clockNow, currentTrack.id, liveState, playablePrograms, playing]);

  useEffect(() => {
    if (!playing || !livePlaybackStartedRef.current) {
      return;
    }
    const currentProgramForLive = programForTrack(currentTrack, playablePrograms);
    if (!currentProgramForLive || currentProgramForLive.scheduledAt) {
      return;
    }

    const now = new Date();
    const nextScheduled = nextScheduledStartState(publicTrackCatalog, playablePrograms, now);
    if (!nextScheduled) {
      return;
    }

    const deltaSeconds = nextScheduled.start - secondsSinceLocalMidnight(now);
    const switchDelayMs = Math.max(0, deltaSeconds * 1000);
    let fadeTimer: number | null = null;
    let switchTimer: number | null = null;
    let fadeFrame: number | null = null;
    let switched = false;

    const stopFade = () => {
      if (fadeFrame !== null) {
        window.cancelAnimationFrame(fadeFrame);
        fadeFrame = null;
      }
    };
    const restoreVolume = () => {
      const audio = audioRef.current;
      if (audio) {
        audio.volume = volume;
      }
    };
    const switchToScheduled = () => {
      switched = true;
      stopFade();
      const switchNow = new Date();
      const currentFillerProgram = programForTrack(currentTrack, playablePrograms);
      if (currentFillerProgram && !currentFillerProgram.scheduledAt) {
        const dateKey = localDateKey(switchNow);
        const entries = fillerSongEntriesForDate(publicTrackCatalog, playablePrograms, dateKey);
        const currentEntryIndex = entries.findIndex(
          (entry) => entry.track.id === currentTrack.id && entry.queueIndex === currentQueueIndex,
        );
        if (currentEntryIndex >= 0) {
          const nextEntryIndex = (currentEntryIndex + 1) % entries.length;
          liveInterruptedFillerRef.current = {
            dateKey,
            entryIndex: currentEntryIndex,
            interruptedAt: switchNow.getTime(),
            nextEntryIndex,
            queueIndex: currentQueueIndex,
            scheduledTrackId: nextScheduled.track.id,
            trackId: currentTrack.id,
          };
          liveFillerCursorRef.current[dateKey] = nextEntryIndex;
          writeLiveFillerCursor(liveFillerCursorRef.current);
        }
      }
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.volume = volume;
      }
      const elapsedSeconds = Math.max(0, secondsSinceLocalMidnight(switchNow) - nextScheduled.start);
      const position = queuePositionForElapsed(nextScheduled.track, elapsedSeconds);
      liveEndedTrackRef.current = null;
      applyLivePlaybackState({
        elapsedSeconds,
        ...position,
        track: nextScheduled.track,
      }, true);
    };
    const startFade = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused || audio.ended) {
        return;
      }
      const startVolume = audio.volume;
      const startedAt = performance.now();
      const fadeDurationMs = Math.min(2000, Math.max(0, switchDelayMs));
      const step = (timestamp: number) => {
        const progress = fadeDurationMs ? Math.min(1, (timestamp - startedAt) / fadeDurationMs) : 1;
        audio.volume = Math.max(0, startVolume * (1 - progress));
        if (progress < 1 && !switched) {
          fadeFrame = window.requestAnimationFrame(step);
        }
      };
      fadeFrame = window.requestAnimationFrame(step);
    };

    const fadeDelayMs = Math.max(0, switchDelayMs - 2000);
    fadeTimer = window.setTimeout(startFade, fadeDelayMs);
    switchTimer = window.setTimeout(switchToScheduled, switchDelayMs);

    return () => {
      if (fadeTimer !== null) {
        window.clearTimeout(fadeTimer);
      }
      if (switchTimer !== null) {
        window.clearTimeout(switchTimer);
      }
      stopFade();
      if (!switched) {
        restoreVolume();
      }
    };
  }, [applyLivePlaybackState, currentQueueIndex, currentTrack, playablePrograms, playing, publicTrackCatalog, volume]);
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    return [
      ...hosts
        .filter((host) => [host.name, host.voice, host.tone].some((value) => value.toLowerCase().includes(normalized)))
        .map((host) => ({ kind: "host" as const, id: host.id, title: host.name, meta: host.voice })),
      ...onDemandTrackCatalog
        .filter((track) => [track.title, track.host].some((value) => value.toLowerCase().includes(normalized)))
        .map((track) => ({ kind: "track" as const, id: track.id, title: track.title, meta: `AI主播 · ${track.host}` })),
      ...publicScheduleItems
        .filter((program) =>
          [program.title, program.host, program.style].some((value) => value.toLowerCase().includes(normalized)),
        )
        .map((program) => ({ kind: "program" as const, id: program.id, title: program.title, meta: program.time })),
    ].slice(0, 6);
  }, [onDemandTrackCatalog, publicScheduleItems, query]);

  useEffect(() => {
    writeSavedIds("star-radio.favorites", favorites);
  }, [favorites]);

  useEffect(() => {
    writeSavedIds("star-radio.reminders", reminders);
  }, [reminders]);

  useEffect(() => {
    if (!adminNotice) {
      return;
    }
    const timer = window.setTimeout(() => setAdminNotice(null), 4800);
    return () => window.clearTimeout(timer);
  }, [adminNotice]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        return;
      }
      const duration = Math.max(1, playbackDuration || currentTrack.duration || 1);
      setPlaybackTime((value) => {
        const nextTime = value >= duration ? 0 : Math.min(duration, value + 0.9);
        setLiveProgress(Math.min(100, Math.max(0, (nextTime / duration) * 100)));
        return nextTime;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [currentTrack.duration, playbackDuration, playing]);

  useEffect(() => {
    if (!autoScroll) {
      return;
    }
    const lyricList = lyricListRef.current;
    const activeLine = lyricList?.querySelector<HTMLElement>(".lyric-line.is-active");
    if (!lyricList || !activeLine) {
      return;
    }

    const scrollTop = activeLine.offsetTop - lyricList.clientHeight / 2 + activeLine.clientHeight / 2;
    lyricList.scrollTo({ behavior: "smooth", top: Math.max(0, scrollTop) });
  }, [activeLyric, autoScroll, currentSubtitleLines.length, currentTrack.id]);

  useEffect(() => {
    setProgramDraft(generatedProgram?.script ?? "");
    setProgramPlaybackSpeed(generatedProgram?.playbackSpeed ?? adminConfig.tts.speed ?? 1);
    setProgramHostIds(programHostIdsForProgram(generatedProgram));
    if (generatedProgram?.categoryId) {
      setProgramCategoryId(generatedProgram.categoryId);
    }
    setProgramScheduledTime(timeInputValueFromDate(generatedProgram?.scheduledAt));
    setProgramPreviewBackgroundIndex(0);
  }, [adminConfig.tts.speed, generatedProgram?.categoryId, generatedProgram?.host, generatedProgram?.id, generatedProgram?.scheduledAt, generatedProgram?.script]);

  useEffect(() => {
    if (!programCategoryId && programCategories[0]?.id) {
      setProgramCategoryId(programCategories[0].id);
    }
  }, [programCategories, programCategoryId]);

  useEffect(() => {
    setBackgroundEffectIndex(0);
  }, [currentTrack.id]);

  useEffect(() => {
    const audio = backgroundAudioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = Math.min(1, Math.max(0, volume * Number(currentBackgroundItem?.volume ?? 0.28)));
  }, [currentBackgroundItem?.volume, volume]);

  useEffect(() => {
    const audio = backgroundAudioRef.current;
    if (!audio) {
      return;
    }

    const onEnded = () => {
      if (currentBackgroundItem?.loopMode === "sequence" && currentBackgroundEffects.length > 1) {
        setBackgroundEffectIndex((index) => (index + 1) % currentBackgroundEffects.length);
      }
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [currentBackgroundEffects.length, currentBackgroundItem?.loopMode]);

  useEffect(() => {
    const audio = backgroundAudioRef.current;
    if (!audio) {
      return;
    }

    const audioUrl = currentBackgroundEffect?.audioUrl ?? "";
    audio.pause();
    audio.loop = currentBackgroundItem?.loopMode !== "sequence" || currentBackgroundEffects.length <= 1;
    audio.src = audioUrl;
    audio.load();

    if (!playing || !audioUrl || !currentBackgroundItem || isTransitionQueueItem) {
      return;
    }

    const startBackground = () => {
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
    };
    const delayMs = currentBackgroundItem.startMode === "voice-first" ? backgroundLeadSeconds * 1000 : 0;
    const timer = delayMs > 0 ? window.setTimeout(startBackground, delayMs) : null;
    if (!timer) {
      startBackground();
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
      audio.pause();
    };
  }, [
    backgroundLeadSeconds,
    currentBackgroundEffect?.audioUrl,
    currentBackgroundEffects.length,
    currentBackgroundItem,
    currentTrack.id,
    isTransitionQueueItem,
    playing,
  ]);

  useEffect(() => {
    const audio = programPreviewBackgroundAudioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = Math.min(1, Math.max(0, volume * Number(programPreviewBackgroundItem?.volume ?? 0.28)));
  }, [programPreviewBackgroundItem?.volume, volume]);

  useEffect(() => {
    const audio = programPreviewBackgroundAudioRef.current;
    if (!audio) {
      return;
    }

    const onEnded = () => {
      if (programPreviewBackgroundItem?.loopMode === "sequence" && programPreviewBackgroundEffects.length > 1) {
        setProgramPreviewBackgroundIndex((index) => (index + 1) % programPreviewBackgroundEffects.length);
      }
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [programPreviewBackgroundEffects.length, programPreviewBackgroundItem?.loopMode]);

  useEffect(() => {
    const mainAudio = programAudioRef.current;
    const backgroundAudio = programPreviewBackgroundAudioRef.current;
    if (!mainAudio || !backgroundAudio) {
      return;
    }

    const backgroundUrl = programPreviewBackgroundEffect?.audioUrl ?? "";
    let startTimer: number | null = null;
    backgroundAudio.pause();
    backgroundAudio.loop = programPreviewBackgroundItem?.loopMode !== "sequence" || programPreviewBackgroundEffects.length <= 1;
    backgroundAudio.src = backgroundUrl;
    if (backgroundUrl) {
      backgroundAudio.load();
    }

    const clearStartTimer = () => {
      if (startTimer) {
        window.clearTimeout(startTimer);
        startTimer = null;
      }
    };
    const startBackground = () => {
      if (!backgroundUrl || !programPreviewBackgroundItem) {
        return;
      }
      clearStartTimer();
      const play = () => {
        try {
          backgroundAudio.currentTime = 0;
        } catch {
          // Remote audio can reject a seek before metadata is available.
        }
        backgroundAudio.play().catch(() => undefined);
      };
      const delayMs = programPreviewBackgroundItem.startMode === "voice-first" ? programPreviewBackgroundLeadSeconds * 1000 : 0;
      startTimer = delayMs > 0 ? window.setTimeout(play, delayMs) : null;
      if (!startTimer) {
        play();
      }
    };
    const pauseBackground = () => {
      clearStartTimer();
      backgroundAudio.pause();
    };
    const stopBackground = () => {
      pauseBackground();
      try {
        backgroundAudio.currentTime = 0;
      } catch {
        // Keep preview cleanup best-effort.
      }
    };

    mainAudio.addEventListener("play", startBackground);
    mainAudio.addEventListener("pause", pauseBackground);
    mainAudio.addEventListener("ended", stopBackground);
    if (!mainAudio.paused && !mainAudio.ended) {
      startBackground();
    }

    return () => {
      clearStartTimer();
      mainAudio.removeEventListener("play", startBackground);
      mainAudio.removeEventListener("pause", pauseBackground);
      mainAudio.removeEventListener("ended", stopBackground);
      backgroundAudio.pause();
    };
  }, [
    generatedProgram?.id,
    programPreviewBackgroundEffect?.audioUrl,
    programPreviewBackgroundEffects.length,
    programPreviewBackgroundItem,
    programPreviewBackgroundLeadSeconds,
  ]);

  useEffect(() => {
    if (!currentQueueItem || currentQueueItem.type !== "song" || currentQueueItem.lyrics || (!currentQueueItem.hash && !currentQueueItem.sourceId)) {
      return;
    }
    const key = playlistItemKey(currentQueueItem);
    if (!key || runtimeLyrics[key] !== undefined) {
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({
      artist: currentQueueItem.artist ?? "",
      duration: String(currentQueueItem.duration ?? 0),
      hash: currentQueueItem.hash ?? "",
      mediaId: currentQueueItem.mediaId ?? "",
      source: currentQueueItem.source ?? "kugou",
      sourceId: currentQueueItem.sourceId ?? "",
      title: currentQueueItem.title,
    });
    if (currentQueueItem.albumAudioId) {
      params.set("albumAudioId", String(currentQueueItem.albumAudioId));
    }

    void apiJson<{ lyrics?: string }>(`/api/music/lyrics?${params.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setRuntimeLyrics((current) => ({
            ...current,
            [key]: result.lyrics ?? "",
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRuntimeLyrics((current) => ({
            ...current,
            [key]: "",
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentQueueItem, runtimeLyrics]);

  useEffect(() => {
    const localAudioUrls = currentTrackQueue
      .map((item) => item.audioUrl ?? "")
      .filter((url) => url.startsWith("/storage/audio/"));
    localAudioUrls.forEach((url) => {
      void fetch(url, { cache: "force-cache" }).catch(() => undefined);
    });
  }, [currentTrack.id, currentTrackQueue]);

  useEffect(() => {
    if (!remoteSongResolutionKey || !currentProgram || !currentQueueItem) {
      return;
    }
    let cancelled = false;
    setRuntimeAudioUrls((current) => ({
      ...current,
      [remoteSongResolutionKey]: { resolvedAt: 0, url: "" },
    }));
    const expectedSource = String(currentQueueItem.source ?? "");
    const expectedSourceId = String(currentQueueItem.sourceId ?? currentQueueItem.hash ?? "");
    const expectedTitle = currentQueueItem.title;
    void apiJson<{ audioUrl: string; source?: string; sourceId?: string; title?: string }>(
      `/api/programs/${currentProgram.id}/playlist/${currentQueueIndex}/resolve-audio`,
      {
        body: JSON.stringify({ expectedSource, expectedSourceId, expectedTitle }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    )
      .then((result) => {
        if (cancelled || !result.audioUrl) {
          return;
        }
        if (
          (expectedSourceId && result.sourceId && expectedSourceId !== String(result.sourceId)) ||
          (expectedSource && result.source && expectedSource !== result.source) ||
          (!expectedSourceId && result.title && expectedTitle !== result.title)
        ) {
          throw new Error("音乐地址与当前显示歌曲不一致");
        }
        setRuntimeAudioUrls((current) => ({
          ...current,
          [remoteSongResolutionKey]: { resolvedAt: Date.now(), url: result.audioUrl },
        }));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setRuntimeAudioUrls((current) => ({
          ...current,
          [remoteSongResolutionKey]: { resolvedAt: Date.now(), url: "" },
        }));
        // 单曲地址失效时跳过该曲，避免定时节目结束后停在无声状态。
        window.setTimeout(() => audioRef.current?.dispatchEvent(new Event("ended")), 250);
      });

    return () => {
      cancelled = true;
    };
  }, [currentProgram?.id, currentQueueIndex, remoteSongResolutionKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const hasRequestedSeek = Boolean(
      pendingAudioSeek &&
      pendingAudioSeek.trackId === currentTrack.id &&
      pendingAudioSeek.queueIndex === currentQueueIndex &&
      (pendingAudioSeek.audioUrl === currentAudioUrl || Boolean(remoteSongResolutionKey)),
    );
    const requestedSeek = hasRequestedSeek ? Math.max(0, pendingAudioSeek?.seconds ?? 0) : 0;
    const applyRequestedSeek = () => {
      if (!hasRequestedSeek) {
        return;
      }
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : currentQueueItem?.duration || currentTrack.duration || 1;
      try {
        audio.currentTime = Math.min(Math.max(0, duration - 0.35), requestedSeek);
      } catch {
        // Some remote audio URLs can reject seeking before metadata is ready.
      }
    };
    setLiveProgress(0);
    setPlaybackTime(requestedSeek);
    setPlaybackDuration(currentQueueItem?.duration || currentTrack.duration || 1);
    const targetAudioSrc = currentAudioUrl ? new URL(currentAudioUrl, window.location.href).href : "";
    const currentAudioSrc = audio.currentSrc || audio.src || "";
    const sourceChanged = currentAudioSrc !== targetAudioSrc;

    audio.addEventListener("loadedmetadata", applyRequestedSeek, { once: true });
    if (sourceChanged) {
      audio.src = currentAudioUrl || "";
      audio.load();
    }
    applyRequestedSeek();
    return () => {
      audio.removeEventListener("loadedmetadata", applyRequestedSeek);
    };
  }, [currentAudioUrl, currentQueueItem?.duration, currentTrack.duration, pendingAudioSeek]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (playing && currentAudioUrl) {
      let cancelled = false;
      let requested = false;
      let playTimer: number | null = null;
      let bufferFallbackTimer: number | null = null;
      const effectStartedAt = performance.now();
      const playWhenReady = () => {
        if (cancelled || requested) {
          return;
        }
        requested = true;
        const start = () => {
          if (mainPlaybackDelayMs > 0) {
            setMainPlaybackLeadEnabled(false);
          }
          audio.play().catch(() => {
            if (!cancelled) {
              setPlaying(false);
            }
          });
        };
        const remainingDelayMs = Math.max(0, mainPlaybackDelayMs - (performance.now() - effectStartedAt));
        if (remainingDelayMs > 0) {
          playTimer = window.setTimeout(start, remainingDelayMs);
        } else {
          start();
        }
      };

      const localGeneratedAudio = currentAudioUrl.startsWith("/storage/audio/") || currentAudioUrl.includes("/storage/audio/");
      const scheduleBufferedFallback = () => {
        if (!bufferFallbackTimer) {
          bufferFallbackTimer = window.setTimeout(playWhenReady, 4000);
        }
      };
      if (localGeneratedAudio && audio.readyState < 4) {
        audio.addEventListener("canplaythrough", playWhenReady, { once: true });
        audio.addEventListener("loadeddata", scheduleBufferedFallback, { once: true });
      } else if (audio.readyState >= 2) {
        playWhenReady();
      } else {
        audio.addEventListener("loadeddata", playWhenReady, { once: true });
        audio.addEventListener("canplay", playWhenReady, { once: true });
      }

      return () => {
        cancelled = true;
        if (playTimer) {
          window.clearTimeout(playTimer);
        }
        if (bufferFallbackTimer) {
          window.clearTimeout(bufferFallbackTimer);
        }
        audio.removeEventListener("loadeddata", playWhenReady);
        audio.removeEventListener("canplay", playWhenReady);
        audio.removeEventListener("canplaythrough", playWhenReady);
        audio.removeEventListener("loadeddata", scheduleBufferedFallback);
      };
    }
    audio.pause();
  }, [currentAudioUrl, currentTrack.id, mainPlaybackDelayMs, pendingAudioSeek, playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = currentMainVolume;
  }, [currentMainVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const updateProgress = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : currentTrack.duration || 1;
      const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      setPlaybackDuration(duration);
      setPlaybackTime(Math.min(duration, Math.max(0, currentTime)));
      setLiveProgress(Math.min(100, Math.max(0, (currentTime / duration) * 100)));
    };
    const markEnded = () => {
      const currentProgramForEnded = programForTrack(currentTrack, playablePrograms);
      if (currentTrackQueue.length && currentQueueIndex < currentTrackQueue.length - 1) {
        const nextQueueIndex = Math.min(currentQueueIndex + 1, currentTrackQueue.length - 1);
        const nextQueueItem = currentTrackQueue[nextQueueIndex];
        const nextAudioUrl = nextQueueItem?.audioUrl || currentTrack.audioUrl;
        if (livePlaybackStartedRef.current && currentProgramForEnded && !currentProgramForEnded.scheduledAt) {
          const dateKey = localDateKey();
          const entries = fillerSongEntriesForDate(publicTrackCatalog, playablePrograms, dateKey);
          const nextEntryIndex = entries.findIndex(
            (entry) => entry.track.id === currentTrack.id && entry.queueIndex === nextQueueIndex,
          );
          if (nextEntryIndex >= 0) {
            liveFillerCursorRef.current[dateKey] = (nextEntryIndex + 1) % entries.length;
            writeLiveFillerCursor(liveFillerCursorRef.current);
          }
        }
        setCurrentQueueIndex(nextQueueIndex);
        setPlaybackTime(0);
        setLiveProgress(0);
        setPlaybackDuration(nextQueueItem?.duration || currentTrack.duration || 1);
        if (nextAudioUrl) {
          setPendingAudioSeek({
            audioUrl: nextAudioUrl,
            queueIndex: nextQueueIndex,
            requestId: Date.now(),
            seconds: 0,
            trackId: currentTrack.id,
          });
        }
        setPlaying(true);
        return;
      }

      if (livePlaybackStartedRef.current) {
        const now = new Date();
        const dateKey = localDateKey(now);
        liveEndedTrackRef.current = { dateKey, trackId: currentTrack.id };

        const currentTimelineState = liveStateForTime(publicTrackCatalog, playablePrograms, now, null);
        if (currentTimelineState && currentTimelineState.track.id !== currentTrack.id) {
          applyLivePlaybackState(currentTimelineState, true);
          return;
        }

        const fillerState = getSequentialFillerState(now, true, {
          afterScheduledTrack: currentProgramForEnded?.scheduledAt ? currentTrack : null,
          seedFromTimeline: Boolean(currentProgramForEnded?.scheduledAt),
        });
        if (fillerState) {
          applyLivePlaybackState(fillerState, true);
          return;
        }

        // 没有兜底节目时保持直播模式待命，由时钟驱动在下一档定时节目到点后切换。
        setPlaybackTime(currentTrack.duration || 0);
        setLiveProgress(100);
        setPlaying(true);
        return;
      }
      const nextCatalog = (backendTracks.length ? backendTracks : publicTrackCatalog).filter(trackHasPlayableAudio);
      if (!nextCatalog.length) {
        setPlaying(false);
        return;
      }

      const currentIndex = nextCatalog.findIndex((track) => track.id === currentTrack.id);
      const nextTrack = nextCatalog[(currentIndex + 1 + nextCatalog.length) % nextCatalog.length];
      setPlaybackTime(0);
      setLiveProgress(0);

      if (nextTrack.id === currentTrack.id) {
        audio.currentTime = 0;
        setPlaying(true);
        audio.play().catch(() => setPlaying(false));
        return;
      }

      setCurrentTrack(nextTrack);
      setCurrentQueueIndex(0);
      setPlaying(true);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateProgress);
    audio.addEventListener("ended", markEnded);
    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateProgress);
      audio.removeEventListener("ended", markEnded);
    };
  }, [applyLivePlaybackState, backendTracks, currentQueueIndex, currentTrack, currentTrackQueue, getSequentialFillerState, playablePrograms, publicTrackCatalog]);

  useEffect(
    () => () => {
      if (volumeCloseTimerRef.current) {
        window.clearTimeout(volumeCloseTimerRef.current);
      }
      if (hostPreviewTimerRef.current) {
        window.clearTimeout(hostPreviewTimerRef.current);
      }
    },
    [],
  );

  const scheduleVolumeClose = () => {
    if (volumeCloseTimerRef.current) {
      window.clearTimeout(volumeCloseTimerRef.current);
    }
    volumeCloseTimerRef.current = window.setTimeout(() => {
      setVolumeOpen(false);
      volumeCloseTimerRef.current = null;
    }, 1100);
  };

  const toggleVolumeOpen = () => {
    if (volumeCloseTimerRef.current) {
      window.clearTimeout(volumeCloseTimerRef.current);
      volumeCloseTimerRef.current = null;
    }
    setVolumeOpen((value) => !value);
  };

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    scheduleVolumeClose();
  };

  const toggleAudienceTheme = () => {
    const nextTheme: AudienceTheme = currentThemeMode === "dark" ? "light" : "dark";
    setAudienceTheme(nextTheme);
    window.localStorage.setItem(AUDIENCE_THEME_KEY, nextTheme);
    applyThemeToDocument(systemSettings, nextTheme);
  };

  const toggleFavorite = (trackId: string) => {
    setFavorites((value) =>
      value.includes(trackId) ? value.filter((item) => item !== trackId) : [...value, trackId],
    );
  };

  const toggleReminder = (programId: string) => {
    setReminders((value) =>
      value.includes(programId) ? value.filter((item) => item !== programId) : [...value, programId],
    );
  };

  const playTrack = (track: Track) => {
    livePlaybackStartedRef.current = false;
    liveEndedTrackRef.current = null;
    liveInterruptedFillerRef.current = null;
    if (track.id === currentTrack.id && playing) {
      setMainPlaybackLeadEnabled(false);
      setPlaying(false);
      return;
    }

    const targetQueue = playbackQueueForTrack(track);
    const targetQueueItem = targetQueue[0];
    const targetAudioUrl = targetQueueItem?.audioUrl || track.audioUrl;

    // “今日已播”和点播列表每次从暂停状态重新播放时，都从整档节目开头开始：
    // 转场 -> 按设置先播背景或人声 -> 背景与人声持续混音。
    setMainPlaybackLeadEnabled(true);
    setCurrentTrack(track);
    setCurrentQueueIndex(0);
    setPlaying(Boolean(targetAudioUrl));
    setLiveProgress(0);
    setPlaybackTime(0);
    setPlaybackDuration(targetQueueItem?.duration || track.duration || 1);
    if (targetAudioUrl) {
      setPendingAudioSeek({
        audioUrl: targetAudioUrl,
        queueIndex: 0,
        requestId: Date.now(),
        seconds: 0,
        trackId: track.id,
      });
    }
  };

  const playLiveProgram = () => {
    if (playing && livePlaybackStartedRef.current) {
      audioRef.current?.pause();
      setMainPlaybackLeadEnabled(false);
      setPlaying(false);
      return;
    }
    liveEndedTrackRef.current = null;
    liveInterruptedFillerRef.current = null;
    const targetLiveState = getLivePlaybackStateForTime(new Date(), false);
    const targetTrack = targetLiveState?.track ?? liveTrack ?? publicTrackCatalog[0];
    if (!targetTrack || !targetLiveState) {
      return;
    }
    const targetQueue = playbackQueueForTrack(targetTrack);
    const targetQueueItem = targetQueue[Math.min(targetLiveState.queueIndex, Math.max(0, targetQueue.length - 1))];
    const targetAudioUrl = targetQueueItem?.audioUrl || targetTrack.audioUrl;
    const audio = audioRef.current;
    if (targetTrack.id === currentTrack.id) {
      if (playing && audio && !audio.paused && !audio.ended) {
        livePlaybackStartedRef.current = true;
        setMainPlaybackLeadEnabled(false);
        setPlaying(false);
        return;
      }
      setMainPlaybackLeadEnabled(false);
      // 直播电台：每次点击播放都重新定位到当前直播时间点，
      // 避免“暂停后继续”从暂停位置接着播（直播流已经推进）。
      if (targetAudioUrl) {
        setCurrentQueueIndex(targetLiveState.queueIndex);
        setPendingAudioSeek({
          audioUrl: targetAudioUrl,
          queueIndex: targetLiveState.queueIndex,
          requestId: Date.now(),
          seconds: targetLiveState.seekSeconds,
          trackId: targetTrack.id,
        });
        setPlaybackTime(targetLiveState.seekSeconds);
        setPlaybackDuration(targetQueueItem?.duration || targetTrack.duration || 1);
      }
      livePlaybackStartedRef.current = true;
      setPlaying(Boolean(targetAudioUrl));
      return;
    }
    setMainPlaybackLeadEnabled(false);
    livePlaybackStartedRef.current = true;
    applyLivePlaybackState(targetLiveState, Boolean(targetAudioUrl));
  };

  const previewHostVoice = async (host: (typeof hosts)[number]) => {
    setActiveHostId(host.id);
    if (hostPreviewTimerRef.current) {
      window.clearTimeout(hostPreviewTimerRef.current);
    }
    setPreviewingHostId(host.id);
    hostPreviewTimerRef.current = window.setTimeout(() => setPreviewingHostId(null), 3600);
    try {
      const result = await apiJson<{ audioUrl: string; message?: string }>(`/api/hosts/${encodeURIComponent(host.id)}/voice-preview`, {
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const previewAudio = new Audio(`${result.audioUrl}${result.audioUrl.includes("?") ? "&" : "?"}v=${Date.now()}`);
      previewAudio.volume = volume;
      previewAudio.onended = () => setPreviewingHostId((current) => (current === host.id ? null : current));
      previewAudio.onerror = () => setPreviewingHostId((current) => (current === host.id ? null : current));
      await previewAudio.play();
    } catch {
      setPreviewingHostId(null);
    }
  };

  const completeUserLogin = () => {
    window.localStorage.setItem("star-radio.user-logged-in", "true");
    setUserLoggedIn(true);
    setActiveNav("个人中心");
  };

  const logoutUser = () => {
    window.localStorage.removeItem("star-radio.user-logged-in");
    window.localStorage.removeItem("star-radio.user-account");
    setUserLoggedIn(false);
    setActiveNav("首页");
  };

  const handleSearchPick = (result: (typeof searchResults)[number]) => {
    if (result.kind === "host") {
      setActiveHostId(result.id);
    }
    if (result.kind === "track") {
      const track = publicTrackCatalog.find((item) => item.id === result.id);
      if (track) {
        playTrack(track);
      }
    }
    if (result.kind === "program") {
      const track = publicTrackCatalog.find((item) => item.id === `program-${result.id}`);
      if (track) {
        playTrack(track);
      }
    }
    setQuery("");
  };

  const updateAdminConfig = <T extends ServiceKey, K extends keyof AdminConfig[T]>(
    service: T,
    key: K,
    value: AdminConfig[T][K],
  ) => {
    setAdminConfig((current) => ({
      ...current,
      [service]: {
        ...current[service],
        [key]: value,
      },
    }));
  };

  const notifyAdmin = (message: string, tone: NonNullable<AdminNotice>["tone"] = "info") => {
    setAdminNotice({ message, tone });
  };

  const saveAdminConfig = async () => {
    writeAdminConfig(adminConfig);
    const localSavedAt = window.localStorage.getItem("star-radio.admin-config.saved-at") ?? "";
    setConfigSavedAt(localSavedAt);

    try {
      const saved = await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setConfigSavedAt(saved.savedAt);
      const message = saved.message ?? "配置已保存到后台数据库";
      setBackendStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `本地已保存，后台写入失败：${errorMessage(error)}`;
      setBackendStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const saveSystemSettings = async (settings: SystemSettings) => {
    try {
      const result = await apiJson<SystemSettingsResponse>("/api/system-settings", {
        body: JSON.stringify({ settings }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const nextSettings = normalizeSystemSettings(result.settings);
      setSystemSettings(nextSettings);
      applyThemeToDocument(nextSettings, audienceTheme);
      const message = result.message ?? "系统设置已保存";
      notifyAdmin(message, "success");
      return nextSettings;
    } catch (error) {
      const message = `系统设置保存失败：${errorMessage(error)}`;
      notifyAdmin(message, "error");
      throw error;
    }
  };

  const reloadProgramPresets = async (showNotice = false) => {
    try {
      const result = await apiJson<ProgramPresetsResponse>("/api/program-presets");
      setProgramPresets(result.presets);
      if (showNotice) {
        notifyAdmin("预设节目列表已刷新", "success");
      }
      return result.presets;
    } catch (error) {
      const message = `预设节目加载失败：${errorMessage(error)}`;
      setProgramStatus(message);
      if (showNotice) {
        notifyAdmin(message, "error");
      }
      return [];
    }
  };

  const saveProgramPreset = async () => {
    if (programPresetBusy) {
      return;
    }

    const title = programTitle.trim() || "未命名节目预设";
    const kugou = adminConfig.plugins.kugouMusic;
    const hostId =
      programType === "daily-briefing"
        ? adminConfig.plugins.dailyBriefing.hostId
        : programType === "hot-topics"
          ? adminConfig.plugins.hotTopics.hostId
          : programType === "kugou"
            ? kugou.hostId
            : programHostIds[0] ?? hosts[0].id;
    const presetPlaybackSpeed =
      programType === "daily-briefing"
        ? adminConfig.plugins.dailyBriefing.playbackSpeed
        : programType === "hot-topics"
          ? adminConfig.plugins.hotTopics.playbackSpeed
          : programPlaybackSpeed;

    setProgramPresetBusy(true);
    setProgramStatus(editingProgramPresetId ? "正在更新节目预设..." : "正在保存节目预设...");
    try {
      const result = await apiJson<ProgramPresetResponse>("/api/program-presets", {
        body: JSON.stringify({
          id: editingProgramPresetId || undefined,
          name: title,
          type: programType,
          title,
          categoryId: programCategoryId || null,
          contentMode: programType === "custom" ? customContentMode : "ai",
          prompt: programPrompt,
          hostId,
          hostIds: programHostIds,
          pluginKind: programType === "custom" ? null : programType,
          playbackSpeed: presetPlaybackSpeed,
          kugou:
            programType === "kugou"
              ? {
                  cardId: kugou.cardId,
                  enabled: kugou.enabled,
                  hostId: kugou.hostId,
                  maxSongs: kugou.maxSongs,
                  name: kugou.name,
                  provider: kugou.provider,
                  quality: kugou.quality,
                  rankType: kugou.rankType,
                  searchKeywords: kugou.searchKeywords,
                  source: kugou.source,
                  useAiScript: kugou.useAiScript,
                }
              : null,
          songs: programType === "kugou" ? manualMusicSelected : [],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setEditingProgramPresetId(result.preset.id);
      setProgramPresets((current) => {
        const others = current.filter((item) => item.id !== result.preset.id);
        return [result.preset, ...others];
      });
      setProgramStatus(result.message ?? "节目预设已保存");
      notifyAdmin(result.message ?? "节目预设已保存", "success");
    } catch (error) {
      const message = `节目预设保存失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    } finally {
      setProgramPresetBusy(false);
    }
  };

  const editProgramPreset = (preset: ProgramPreset) => {
    const presetProgram = latestProgramForPreset(programHistory, preset);
    setEditingProgramPresetId(preset.id);
    setProgramType(preset.type);
    setCustomContentMode(preset.contentMode === "direct" ? "direct" : "ai");
    setProgramTitle(preset.title || preset.name);
    setProgramPrompt(preset.prompt || "");
    setProgramCategoryId(preset.categoryId ?? "");
    setProgramPlaybackSpeed(presetProgram?.playbackSpeed ?? preset.playbackSpeed ?? adminConfig.tts.speed ?? 1);
    setProgramHostIds(preset.hostIds.length ? preset.hostIds : preset.hostId ? [preset.hostId] : [hosts[0].id]);
    setManualMusicSelected(preset.type === "kugou" ? preset.songs ?? [] : []);
    setGeneratedProgram(presetProgram);
    setProgramDraft(presetProgram?.script ?? "");
    if (presetProgram?.publishDate) {
      setSelectedTimelineDate(presetProgram.publishDate);
    }

    if (preset.type === "daily-briefing" && preset.hostId) {
      setAdminConfig((current) => ({
        ...current,
        plugins: {
          ...current.plugins,
          dailyBriefing: {
            ...current.plugins.dailyBriefing,
            hostId: preset.hostId as string,
            playbackSpeed: clampNumber(preset.playbackSpeed, 0.5, 2, current.plugins.dailyBriefing.playbackSpeed),
          },
        },
      }));
    }
    if (preset.type === "hot-topics" && preset.hostId) {
      setAdminConfig((current) => ({
        ...current,
        plugins: {
          ...current.plugins,
          hotTopics: {
            ...current.plugins.hotTopics,
            hostId: preset.hostId as string,
            playbackSpeed: clampNumber(preset.playbackSpeed, 0.5, 2, current.plugins.hotTopics.playbackSpeed),
          },
        },
      }));
    }
    if (preset.type === "kugou" && preset.kugou) {
      setAdminConfig((current) => ({
        ...current,
        plugins: {
          ...current.plugins,
          kugouMusic: {
            ...current.plugins.kugouMusic,
            ...preset.kugou,
            cookie: current.plugins.kugouMusic.cookie,
          },
        },
      }));
    }

    setAdminSection("studio");
    setProgramStatus(
      presetProgram
        ? `已载入预设「${preset.name}」及其最近生成的文案和声音内容。`
        : `已载入预设「${preset.name}」；该预设暂无已生成的文案和声音内容。`,
    );
    notifyAdmin(`正在编辑预设：${preset.name}`, "info");
  };

  const deleteProgramPreset = async (presetId: string) => {
    try {
      await apiJson(`/api/program-presets/${presetId}`, { method: "DELETE" });
      setProgramPresets((current) => current.filter((item) => item.id !== presetId));
      if (editingProgramPresetId === presetId) {
        setEditingProgramPresetId("");
      }
      const message = "节目预设已删除";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `删除节目预设失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const testServiceConfig = async (service: ServiceKey) => {
    const config = adminConfig[service];
    if (service === "plugins") {
      const dailyBriefing = adminConfig.plugins.dailyBriefing;
      const hotTopics = adminConfig.plugins.hotTopics;
      const kugouMusic = adminConfig.plugins.kugouMusic;
      const neteaseMusic = adminConfig.plugins.neteaseMusic;
      const qqMusic = adminConfig.plugins.qqMusic;
      const hotTopicsToken = hotTopics.token.trim() || dailyBriefing.token.trim();
      const dailyReady =
        !dailyBriefing.enabled || (dailyBriefing.apiBaseUrl.trim().length > 0 && dailyBriefing.token.trim().length > 0);
      const hotTopicsReady =
        !hotTopics.enabled || (hotTopics.apiBaseUrl.trim().length > 0 && hotTopicsToken.length > 0);
      const musicReady = kugouMusic.apiEnabled || neteaseMusic.enabled || qqMusic.enabled;
      const enabledPlugins = [
        dailyBriefing.enabled ? "每日早报" : "",
        hotTopics.enabled ? "今日热榜" : "",
        kugouMusic.apiEnabled ? "酷狗音乐" : "",
        neteaseMusic.enabled ? "网易云音乐" : "",
        qqMusic.enabled ? "QQ 音乐" : "",
      ].filter(Boolean);
      setConfigTestStatus((current) => ({
        ...current,
        plugins: dailyReady && hotTopicsReady && musicReady
          ? `${enabledPlugins.join("、") || "接口 API"}配置完整，可调用`
          : "接口 API 缺少必要连接配置，或没有启用音乐 API",
      }));
      notifyAdmin(
        dailyReady && hotTopicsReady && musicReady
          ? `${enabledPlugins.join("、") || "接口 API"}配置完整，可调用`
          : "接口 API 缺少必要连接配置，或没有启用音乐 API",
        dailyReady && hotTopicsReady && musicReady ? "success" : "error",
      );
      return;
    }
    const hasBaseUrl = "baseUrl" in config && String(config.baseUrl).trim().length > 0;
    const hasApiKey =
      service === "tts" && ttsApiKeyOptional(adminConfig.tts)
        ? true
        : "apiKey" in config && String(config.apiKey).trim().length > 0;
    const hasModel = "model" in config && String(config.model).trim().length > 0;
    const hasEndpoint = hasBaseUrl;

    if (!hasEndpoint || !hasApiKey || !hasModel) {
      const message = "缺少 endpoint / key / model";
      setConfigTestStatus((current) => ({
        ...current,
        [service]: message,
      }));
      notifyAdmin(`${service.toUpperCase()} ${message}`, "error");
      return;
    }

    try {
      const result = await apiJson<{ message: string }>("/api/config/" + service + "/test", {
        body: JSON.stringify({ config }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setConfigTestStatus((current) => ({
        ...current,
        [service]: result.message,
      }));
      notifyAdmin(result.message, /缺少|失败|异常/u.test(result.message) ? "error" : "success");
    } catch (error) {
      const message = `后台检测失败：${errorMessage(error)}`;
      setConfigTestStatus((current) => ({
        ...current,
        [service]: message,
      }));
      notifyAdmin(message, "error");
    }
  };

  const refreshProgramArchives = async (showNotice = true, sync = showNotice) => {
    try {
      const result = await apiJson<ProgramArchiveResponse>(sync ? "/api/program-archives/sync" : "/api/program-archives", {
        method: sync ? "POST" : "GET",
      });
      setProgramArchives(result.archives);
      if (showNotice) {
        const message = result.message ?? "节目归档已同步";
        setProgramStatus(message);
        notifyAdmin(message, "success");
      }
    } catch (error) {
      if (showNotice) {
        const message = `节目归档同步失败：${errorMessage(error)}`;
        setProgramStatus(message);
        notifyAdmin(message, "error");
      }
    }
  };

  const deleteProgramArchive = async (archiveId: string) => {
    try {
      const result = await apiJson<ProgramArchiveResponse>(`/api/program-archives/${archiveId}`, {
        method: "DELETE",
      });
      setProgramArchives(result.archives);
      const message = result.message ?? "归档节目已删除";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `删除归档失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const deleteProgramArchivesByDate = async (date: string) => {
    if (!date) {
      notifyAdmin("请选择要清理的归档日期", "error");
      return;
    }
    if (!window.confirm(`确定清理 ${date} 的所有归档节目？`)) {
      return;
    }
    try {
      const result = await apiJson<ProgramArchiveResponse>(`/api/program-archives/by-date/${encodeURIComponent(date)}`, {
        method: "DELETE",
      });
      setProgramArchives(result.archives);
      const message = result.message ?? `${date} 归档已清理`;
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `清理归档失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const selectProgram = (program: ProgramRecord) => {
    setGeneratedProgram(program);
    setSunoCandidates([]);
    setProgramHostIds(programHostIdsForProgram(program));
    setProgramScheduledTime(timeInputValueFromDate(program.scheduledAt));
    if (!isProgramPlayable(program)) {
      notifyAdmin("当前节目还没有生成语音，请先重新配音。", "error");
      return;
    }
    notifyAdmin(`正在预听：${program.title}`, "info");
    window.setTimeout(() => {
      programAudioRef.current?.play().catch(() => notifyAdmin("浏览器阻止了自动播放，请手动点击播放器。", "error"));
    }, 80);
  };

  const generateProgram = async (voicePrompt = "") => {
    if (programBusy) {
      return;
    }

    const selectedProgramHosts = hosts
      .filter((host) => programHostIds.includes(host.id))
      .map((host) => ({
        id: host.id,
        name: host.name,
        tone: host.tone,
        voice: host.voice,
      }));

    setProgramBusy(true);
    setProgramStatus("正在同步配置到后台数据库...");
    setPlaying(false);

    try {
      writeAdminConfig(adminConfig);
      const saved = await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setConfigSavedAt(saved.savedAt);
      setBackendStatus(customContentMode === "direct" ? "配置已同步，正在生成原文配音..." : "配置已同步，正在生成节目文案...");
      setProgramStatus(
        customContentMode === "direct"
          ? "正在按原文生成配音，原文不会经过大模型改写..."
          : "正在生成节目文案，生成后会立即写入数据库...",
      );

      const result = await apiJson<ProgramGenerateResponse>("/api/programs/generate", {
        body: JSON.stringify({
          categoryId: programCategoryId || undefined,
          contentMode: customContentMode,
          host: activeHost.name,
          hosts: selectedProgramHosts.length ? selectedProgramHosts : [activeHost],
          playbackSpeed: programPlaybackSpeed,
          publishDate: selectedTimelineDate,
          prompt: programPrompt,
          scheduledAt: programScheduledAtForRequest(),
          title: programTitle,
          voicePrompt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (result.program) {
        setGeneratedProgram(result.program);
        setProgramHistory((current) => [
          result.program as ProgramRecord,
          ...current.filter((program) => program.id !== result.program?.id),
        ]);
        setProgramStatus(result.message ?? "节目文案已入库，语音已生成");
        window.setTimeout(() => {
          programAudioRef.current?.play().catch(() => undefined);
        }, 80);
        void refreshProgramArchives(false);
      }
    } catch (error) {
      const data = (error as Error & { data?: ProgramGenerateResponse }).data;
      if (data?.program) {
        setGeneratedProgram(data.program);
        setProgramHistory((current) => [
          data.program as ProgramRecord,
          ...current.filter((program) => program.id !== data.program?.id),
        ]);
        setProgramStatus(`${data.message ?? "文案已入库，但语音合成失败"}：${data.error ?? errorMessage(error)}`);
      } else {
        setProgramStatus(`生成失败：${errorMessage(error)}`);
      }
    } finally {
      setProgramBusy(false);
    }
  };

  const toggleProgramHost = (hostId: string) => {
    setProgramHostIds((current) => {
      if (current.includes(hostId)) {
        return current.length > 1 ? current.filter((item) => item !== hostId) : current;
      }
      return [...current, hostId];
    });
  };

  const generateDailyBriefing = async (voicePrompt = "") => {
    if (dailyBriefingBusy) {
      return;
    }

    setDailyBriefingBusy(true);
    setProgramStatus("正在采集每日早报，并准备语音播报...");

    try {
      writeAdminConfig(adminConfig);
      await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiJson<ProgramGenerateResponse>("/api/plugins/daily-briefing/generate", {
        body: JSON.stringify({
          categoryId: programCategoryId || undefined,
          playbackSpeed: adminConfig.plugins.dailyBriefing.playbackSpeed,
          publishDate: selectedTimelineDate,
          scheduledAt: programScheduledAtForRequest(),
          title: programTitle,
          voicePrompt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (result.program) {
        setGeneratedProgram(result.program);
        setProgramHistory((current) => [
          result.program as ProgramRecord,
          ...current.filter((program) => program.id !== result.program?.id),
        ]);
        setProgramStatus(result.message ?? "每日早报已采集并生成语音");
        window.setTimeout(() => {
          programAudioRef.current?.play().catch(() => undefined);
        }, 80);
        void refreshProgramArchives(false);
      }
    } catch (error) {
      const data = (error as Error & { data?: ProgramGenerateResponse }).data;
      if (data?.program) {
        setGeneratedProgram(data.program);
        setProgramHistory((current) => [
          data.program as ProgramRecord,
          ...current.filter((program) => program.id !== data.program?.id),
        ]);
        setProgramStatus(`${data.message ?? "每日早报已入库，但语音失败"}：${data.error ?? errorMessage(error)}`);
      } else {
        setProgramStatus(`每日早报采集失败：${errorMessage(error)}`);
      }
    } finally {
      setDailyBriefingBusy(false);
    }
  };

  const generateHotTopics = async (voicePrompt = "") => {
    if (hotTopicsBusy) {
      return;
    }

    setHotTopicsBusy(true);
    setProgramStatus("正在采集今日热榜，并准备语音播报...");

    try {
      writeAdminConfig(adminConfig);
      await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiJson<ProgramGenerateResponse>("/api/plugins/hot-topics/generate", {
        body: JSON.stringify({
          categoryId: programCategoryId || undefined,
          playbackSpeed: adminConfig.plugins.hotTopics.playbackSpeed,
          publishDate: selectedTimelineDate,
          scheduledAt: programScheduledAtForRequest(),
          title: programTitle,
          voicePrompt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (result.program) {
        setGeneratedProgram(result.program);
        setProgramHistory((current) => [
          result.program as ProgramRecord,
          ...current.filter((program) => program.id !== result.program?.id),
        ]);
        setProgramStatus(result.message ?? "今日热榜已采集并生成语音");
        window.setTimeout(() => {
          programAudioRef.current?.play().catch(() => undefined);
        }, 80);
        void refreshProgramArchives(false);
      }
    } catch (error) {
      const data = (error as Error & { data?: ProgramGenerateResponse }).data;
      if (data?.program) {
        setGeneratedProgram(data.program);
        setProgramHistory((current) => [
          data.program as ProgramRecord,
          ...current.filter((program) => program.id !== data.program?.id),
        ]);
        setProgramStatus(`${data.message ?? "今日热榜已入库，但语音失败"}：${data.error ?? errorMessage(error)}`);
      } else {
        setProgramStatus(`今日热榜采集失败：${errorMessage(error)}`);
      }
    } finally {
      setHotTopicsBusy(false);
    }
  };

  const refreshKugouStatus = async () => {
    try {
      const result = await apiJson<{ loggedIn: boolean; message?: string; moduleCount?: number; userId?: string }>("/api/plugins/kugou/status");
      setKugouStatus(
        `${result.message ?? (result.loggedIn ? "酷狗登录态已保存" : "酷狗尚未扫码登录")}${result.moduleCount ? ` · ${result.moduleCount} 个 API` : ""}`,
      );
    } catch (error) {
      setKugouStatus(`酷狗状态读取失败：${errorMessage(error)}`);
    }
  };

  const createKugouQr = async () => {
    if (kugouLoginBusy) {
      return;
    }
    setKugouLoginBusy(true);
    setKugouStatus("正在生成酷狗扫码二维码...");
    try {
      writeAdminConfig(adminConfig);
      await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiJson<{ key: string; message?: string; qrImage: string; qrUrl: string }>("/api/plugins/kugou/login/qr", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setKugouQr({ key: result.key, qrImage: result.qrImage, qrUrl: result.qrUrl });
      setKugouStatus(result.message ?? "酷狗扫码二维码已生成");
      notifyAdmin(result.message ?? "酷狗扫码二维码已生成", "success");
    } catch (error) {
      const message = `酷狗二维码生成失败：${errorMessage(error)}`;
      setKugouStatus(message);
      notifyAdmin(message, "error");
    } finally {
      setKugouLoginBusy(false);
    }
  };

  useEffect(() => {
    if (!kugouQr) {
      return;
    }

    let stopped = false;
    let retryTimer = 0;
    const qrKey = kugouQr.key;

    const pollKugouQr = async () => {
      try {
        const result = await apiJson<{
          config?: AdminConfig;
          cookie?: string;
          message?: string;
          savedAt?: string;
          status: number;
        }>("/api/plugins/kugou/login/check", {
          body: JSON.stringify({ key: qrKey }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (stopped) {
          return;
        }
        if (result.status === 4) {
          if (result.config) {
            setAdminConfig(result.config);
            writeAdminConfig(result.config);
          } else if (result.cookie) {
            setAdminConfig((current) => {
              const nextConfig = {
                ...current,
                plugins: {
                  ...current.plugins,
                  kugouMusic: {
                    ...current.plugins.kugouMusic,
                    cookie: result.cookie ?? current.plugins.kugouMusic.cookie,
                  },
                },
              };
              writeAdminConfig(nextConfig);
              return nextConfig;
            });
          }
          if (result.savedAt) {
            window.localStorage.setItem("star-radio.admin-config.saved-at", result.savedAt);
            setConfigSavedAt(result.savedAt);
          }
          const message = result.message ?? "酷狗登录成功，Cookie 已自动填入并保存";
          setKugouStatus(message);
          notifyAdmin(message, "success");
          setKugouQr(null);
          return;
        }
        if (result.status === 0) {
          const message = result.message ?? "二维码已过期，请重新扫码";
          setKugouStatus(message);
          notifyAdmin(message, "info");
          setKugouQr(null);
          return;
        }
        setKugouStatus(`${result.message ?? "等待扫码"} · 正在自动检测`);
      } catch (error) {
        if (!stopped) {
          setKugouStatus(`扫码状态自动检测暂时失败，将继续重试：${errorMessage(error)}`);
        }
      }
      if (!stopped) {
        retryTimer = window.setTimeout(() => void pollKugouQr(), 1800);
      }
    };

    setKugouStatus("二维码已生成，等待扫码 · 正在自动检测");
    retryTimer = window.setTimeout(() => void pollKugouQr(), 800);
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
    };
    // The QR key starts and stops one self-scheduling polling cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kugouQr?.key]);

  const generateKugouProgram = async (voicePrompt = "") => {
    if (kugouProgramBusy) {
      return;
    }

    setKugouProgramBusy(true);
    setProgramStatus("正在从所选音乐来源编排联播节目...");
    setPlaying(false);

    try {
      writeAdminConfig(adminConfig);
      await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiJson<ProgramGenerateResponse>("/api/plugins/music/generate", {
        body: JSON.stringify({
          categoryId: programCategoryId || undefined,
          playbackSpeed: programPlaybackSpeed,
          plugin: adminConfig.plugins.kugouMusic,
          publishDate: selectedTimelineDate,
          scheduledAt: programScheduledAtForRequest(),
          songs: manualMusicSelected,
          title: adminConfig.plugins.kugouMusic.name,
          voicePrompt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (result.program) {
        setGeneratedProgram(result.program);
        setProgramHistory((current) => [
          result.program as ProgramRecord,
          ...current.filter((program) => program.id !== result.program?.id),
        ]);
        setProgramStatus(result.message ?? "音乐联播节目已生成");
        notifyAdmin(result.message ?? "音乐联播节目已生成", "success");
        void refreshProgramArchives(false);
      }
    } catch (error) {
      const data = (error as Error & { data?: ProgramGenerateResponse }).data;
      const message = `${data?.message ?? "音乐联播节目生成失败"}：${data?.error ?? errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    } finally {
      setKugouProgramBusy(false);
    }
  };

  const probeMediaProgram = async (input: Pick<MediaProgramInput, "mediaUrl" | "siteCookie">) => {
    if (mediaProgramBusy) {
      return null;
    }
    setMediaProgramBusy(true);
    setProgramStatus("正在检测媒体链接、音轨格式和时长...");
    try {
      const result = await apiJson<{ message?: string; probe: MediaProbeResult }>("/api/media-programs/probe", {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setProgramStatus(result.message ?? "媒体链接检测成功");
      notifyAdmin(result.message ?? "媒体链接检测成功", "success");
      return result.probe;
    } catch (error) {
      const message = `媒体链接检测失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
      return null;
    } finally {
      setMediaProgramBusy(false);
    }
  };

  const monitorMediaProgramJob = async (jobId: string) => {
    for (let attempt = 0; attempt < 720; attempt += 1) {
      await wait(5_000);
      try {
        const result = await apiJson<{ message?: string; program: ProgramRecord }>(`/api/media-programs/jobs/${jobId}`);
        setProgramHistory((current) => [
          result.program,
          ...current.filter((program) => program.id !== result.program.id),
        ]);
        setGeneratedProgram((current) => current?.id === jobId ? result.program : current);
        if (result.program.status === "ready") {
          setProgramStatus(result.message ?? "网络媒体节目后台生成完成");
          notifyAdmin(result.message ?? "网络媒体节目后台生成完成", "success");
          void refreshProgramArchives(false);
          return;
        }
        if (result.program.status === "failed") {
          const message = result.message ?? `网络媒体节目后台生成失败：${result.program.errorMessage || "未知错误"}`;
          setProgramStatus(message);
          notifyAdmin(message, "error");
          return;
        }
      } catch {
        // 短暂断网或页面切换不终止服务端任务，下一轮继续读取状态。
      }
    }
  };

  const generateMediaProgram = async (input: MediaProgramInput, voicePrompt = "", background = false) => {
    if (mediaProgramBusy) {
      return null;
    }
    setMediaProgramBusy(true);
    setPlaying(false);
    setProgramStatus(background
      ? "正在保存网络媒体节目后台任务..."
      : input.localCopy ? "正在检测链接并提取媒体音轨，请保持页面打开..." : "正在检测链接并生成媒体节目...");
    try {
      await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const selectedProgramHosts = hosts
        .filter((hostItem) => programHostIds.includes(hostItem.id))
        .map((hostItem) => ({ id: hostItem.id, name: hostItem.name, tone: hostItem.tone, voice: hostItem.voice }));
      const result = await apiJson<ProgramListResponse & {
        message?: string;
        probe?: MediaProbeResult;
        program: ProgramRecord;
      }>(background ? "/api/media-programs/generate-background" : "/api/media-programs/generate", {
        body: JSON.stringify({
          ...input,
          categoryId: programCategoryId || undefined,
          hosts: selectedProgramHosts.length ? selectedProgramHosts : [activeHost],
          playbackSpeed: programPlaybackSpeed,
          publishDate: selectedTimelineDate,
          scheduledAt: programScheduledAtForRequest(),
          voicePrompt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setGeneratedProgram(result.program);
      setProgramHistory(result.programs);
      setProgramDraft(result.program.script);
      setProgramTitle(result.program.title);
      setProgramPrompt(input.introMode === "direct" ? input.introText : input.introPrompt);
      setProgramStatus(result.message ?? (background ? "网络媒体节目已保存并转入后台生成" : "网络媒体节目已生成"));
      notifyAdmin(result.message ?? (background ? "网络媒体节目已保存并转入后台生成" : "网络媒体节目已生成"), "success");
      if (background) {
        void monitorMediaProgramJob(result.program.id);
        return null;
      }
      void refreshProgramArchives(false);
      return result.probe ?? null;
    } catch (error) {
      const message = `网络媒体节目生成失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
      return null;
    } finally {
      setMediaProgramBusy(false);
    }
  };

  const generateSunoPlan = async (input: AiMusicInput) => {
    if (sunoMusicBusy) {
      return null;
    }
    setSunoMusicBusy(true);
    setProgramStatus("正在调用大模型创作 Suno 提示词与原创歌词...");
    try {
      const result = await apiJson<{ message?: string; plan: AiMusicPlan }>("/api/suno/plan", {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setProgramTitle(result.plan.title);
      setProgramPrompt(input.brief);
      setProgramStatus(result.message ?? "AI 音乐方案已生成");
      notifyAdmin(result.message ?? "AI 音乐方案已生成", "success");
      return result.plan;
    } catch (error) {
      const message = `AI 音乐方案生成失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
      return null;
    } finally {
      setSunoMusicBusy(false);
    }
  };

  const generateSunoMusic = async (input: AiMusicInput) => {
    if (sunoMusicBusy) {
      return null;
    }
    setSunoMusicBusy(true);
    setPlaying(false);
    setProgramStatus(input.mode === "auto" ? "正在全自动创作并生成 AI 音乐，这通常需要 1 到 3 分钟..." : "正在使用手动歌词与提示词生成 AI 音乐...");
    try {
      await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiJson<ProgramListResponse & {
        alternatives: SunoCandidate[];
        message?: string;
        plan: AiMusicPlan;
        program: ProgramRecord;
      }>("/api/suno/generate", {
        body: JSON.stringify({
          ...input,
          categoryId: programCategoryId || undefined,
          publishDate: selectedTimelineDate,
          scheduledAt: programScheduledAtForRequest(),
          title: input.title || programTitle,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setGeneratedProgram(result.program);
      setProgramHistory(result.programs);
      setSunoCandidates(result.alternatives ?? []);
      setProgramDraft(result.program.script);
      setProgramTitle(result.program.title);
      setProgramPrompt(input.brief);
      setProgramStatus(result.message ?? "AI 音乐已生成");
      notifyAdmin(result.message ?? "AI 音乐已生成", "success");
      void refreshProgramArchives(false);
      return result.plan;
    } catch (error) {
      const message = `AI 音乐生成失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
      return null;
    } finally {
      setSunoMusicBusy(false);
    }
  };

  const selectSunoCandidate = async (candidate: SunoCandidate) => {
    if (!generatedProgram || generatedProgram.sourceType !== "suno" || sunoMusicBusy) {
      return;
    }
    setSunoMusicBusy(true);
    setProgramStatus(`正在为第 ${candidate.slotIndex + 1} 首歌曲切换版本...`);
    try {
      const result = await apiJson<ProgramListResponse & { message?: string; program: ProgramRecord }>("/api/suno/select", {
        body: JSON.stringify({
          clipId: candidate.id,
          programId: generatedProgram.id,
          slotIndex: candidate.slotIndex,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setGeneratedProgram(result.program);
      setProgramHistory(result.programs);
      setSunoCandidates((current) => current.map((item) => ({
        ...item,
        selected: item.slotIndex === candidate.slotIndex ? item.id === candidate.id : item.selected,
      })));
      setProgramStatus(result.message ?? "Suno 歌曲版本已切换");
      notifyAdmin(result.message ?? "Suno 歌曲版本已切换", "success");
    } catch (error) {
      const message = `切换 Suno 歌曲版本失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    } finally {
      setSunoMusicBusy(false);
    }
  };

  // 统一入口：按节目类型分发到对应生成逻辑。
  const generateProgramNow = (voicePrompt = "") => {
    if (
      programType !== "suno" &&
      generatedProgram &&
      programDraft.trim() &&
      (programDraft.trim() !== generatedProgram.script.trim() || generatedProgram.status !== "ready")
    ) {
      return regenerateProgramTts(voicePrompt);
    }
    if (programType === "daily-briefing") {
      return generateDailyBriefing(voicePrompt);
    }
    if (programType === "hot-topics") {
      return generateHotTopics(voicePrompt);
    }
    if (programType === "kugou") {
      return generateKugouProgram(voicePrompt);
    }
    if (programType === "suno") {
      return Promise.resolve();
    }
    return generateProgram(voicePrompt);
  };

  const searchManualMusic = async () => {
    const keywords = manualMusicQuery.trim() || adminConfig.plugins.kugouMusic.searchKeywords.trim();
    if (!keywords || manualMusicSearchBusy) {
      setManualMusicStatus(keywords ? manualMusicStatus : "请输入要搜索的歌曲或歌手。");
      return;
    }

    setManualMusicSearchBusy(true);
    setManualMusicStatus("正在搜索音乐...");
    try {
      writeAdminConfig(adminConfig);
      await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiJson<{ message?: string; songs: MusicCandidate[] }>("/api/plugins/music/search", {
        body: JSON.stringify({ keywords, limit: 12, provider: adminConfig.plugins.kugouMusic.provider }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setManualMusicResults(result.songs ?? []);
      setManualMusicStatus(result.message ?? "音乐搜索完成");
    } catch (error) {
      setManualMusicStatus(`音乐搜索失败：${errorMessage(error)}`);
    } finally {
      setManualMusicSearchBusy(false);
    }
  };

  const addManualMusicSong = (song: MusicCandidate) => {
    const key = songKey(song);
    setManualMusicSelected((current) => {
      if (current.some((item) => songKey(item) === key)) {
        return current;
      }
      return [...current, song];
    });
  };

  const removeManualMusicSong = (index: number) => {
    setManualMusicSelected((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const reorderManualMusicSong = (index: number, direction: -1 | 1) => {
    setManualMusicSelected((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const callKugouApiModule = async () => {
    if (kugouApiBusy) {
      return;
    }
    setKugouApiBusy(true);
    setKugouApiResult("正在调用 KuGouMusicApi...");
    try {
      const params = kugouApiParams.trim() ? JSON.parse(kugouApiParams) : {};
      const result = await apiJson<{ body: unknown; message?: string }>("/api/kugou/call/" + encodeURIComponent(kugouApiName.trim()), {
        body: JSON.stringify({ params }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setKugouApiResult(JSON.stringify(result.body, null, 2).slice(0, 5000));
      notifyAdmin(result.message ?? "KuGouMusicApi 调用完成", "success");
    } catch (error) {
      const message = `KuGouMusicApi 调用失败：${errorMessage(error)}`;
      setKugouApiResult(message);
      notifyAdmin(message, "error");
    } finally {
      setKugouApiBusy(false);
    }
  };

  const reorderProgram = async (programId: string, direction: -1 | 1) => {
    const scopedPrograms = programsForTimelineDate(programHistory, selectedTimelineDate);
    const index = scopedPrograms.findIndex((program) => program.id === programId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= scopedPrograms.length) {
      return;
    }

    const next = [...scopedPrograms];
    [next[index], next[target]] = [next[target], next[index]];
    setProgramHistory((current) => current.map((program) => next.find((item) => item.id === program.id) ?? program));

    try {
      const result = await apiJson<ProgramReorderResponse>("/api/programs/reorder", {
        body: JSON.stringify({ ids: next.map((program) => program.id), publishDate: selectedTimelineDate }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setProgramHistory(result.programs);
      setProgramStatus(result.message ?? `${selectedTimelineDate} 节目排序已保存`);
    } catch (error) {
      setProgramStatus(`节目排序保存失败：${errorMessage(error)}`);
    }
  };

  const updateScheduleDraft = (programId: string, value: string) => {
    setScheduleDrafts((current) => ({
      ...current,
      [programId]: value,
    }));
  };

  const saveProgramSchedule = async (programId: string) => {
    const value = scheduleDrafts[programId] ?? "";
    try {
      const result = await apiJson<{ message?: string; program: ProgramRecord }>(`/api/programs/${programId}/schedule`, {
        body: JSON.stringify({ scheduledAt: value ? scheduledAtFromDatetimeLocal(value) : "" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setProgramHistory((current) => current.map((program) => (program.id === programId ? result.program : program)));
      if (generatedProgram?.id === programId) {
        setGeneratedProgram(result.program);
      }
      const message = result.message ?? "定时播放时间已保存";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `定时播放保存失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const saveProgramDraft = async (voicePrompt = "") => {
    if (!generatedProgram) {
      return;
    }

    try {
      const segments = draftSegmentsForHosts(programDraft, programHostIds, generatedProgram.sourceType, voicePrompt);
      const metadata = await apiJson<{ message?: string; program: ProgramRecord }>(`/api/programs/${generatedProgram.id}`, {
        body: JSON.stringify({ playbackSpeed: programPlaybackSpeed, title: generatedProgram.title }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const result = await apiJson<{ message?: string; program: ProgramRecord }>(`/api/programs/${generatedProgram.id}/script`, {
        body: JSON.stringify({ script: programDraft, segments }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const program = { ...metadata.program, ...result.program, playbackSpeed: metadata.program.playbackSpeed };
      setGeneratedProgram(program);
      setProgramHistory((current) => current.map((item) => (item.id === program.id ? program : item)));
      setProgramStatus(result.message ?? "节目文稿已保存");
      void refreshProgramArchives(false);
    } catch (error) {
      setProgramStatus(`保存节目文稿失败：${errorMessage(error)}`);
    }
  };

  const regenerateProgramTts = async (voicePrompt = "") => {
    if (!generatedProgram || programTtsBusy) {
      return;
    }

    setProgramTtsBusy(true);
    setProgramStatus("正在根据最新文稿重新生成语音...");
    try {
      const segments = draftSegmentsForHosts(programDraft, programHostIds, generatedProgram.sourceType, voicePrompt);
      await apiJson<{ program: ProgramRecord }>(`/api/programs/${generatedProgram.id}`, {
        body: JSON.stringify({ playbackSpeed: programPlaybackSpeed, title: generatedProgram.title }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const saved = await apiJson<{ program: ProgramRecord }>(`/api/programs/${generatedProgram.id}/script`, {
        body: JSON.stringify({ script: programDraft, segments }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiJson<ProgramGenerateResponse>(`/api/programs/${generatedProgram.id}/regenerate-tts`, {
        body: JSON.stringify({ voicePrompt }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const program = result.program ?? saved.program;
      setGeneratedProgram(program);
      setProgramHistory((current) => current.map((item) => (item.id === program.id ? program : item)));
      setProgramStatus(result.message ?? "语音已重新生成");
      window.setTimeout(() => {
        programAudioRef.current?.play().catch(() => undefined);
      }, 80);
      void refreshProgramArchives(false);
    } catch (error) {
      const data = (error as Error & { data?: ProgramGenerateResponse }).data;
      if (data?.program) {
        setGeneratedProgram(data.program);
        setProgramHistory((current) => current.map((item) => (item.id === data.program?.id ? data.program as ProgramRecord : item)));
        setProgramStatus(`${data.message ?? "重新生成语音失败"}：${data.error ?? errorMessage(error)}`);
      } else {
        setProgramStatus(`重新生成语音失败：${errorMessage(error)}`);
      }
    } finally {
      setProgramTtsBusy(false);
    }
  };

  const rewriteProgramScript = async () => {
    if (!generatedProgram || programRewriteBusy) {
      return;
    }

    setProgramRewriteBusy(true);
    setProgramStatus("正在让 AI 重新编排当前节目文稿...");
    try {
      const result = await apiJson<{ message?: string; program: ProgramRecord }>(`/api/programs/${generatedProgram.id}/rewrite-script`, {
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setGeneratedProgram(result.program);
      setProgramHistory((current) => current.map((program) => (program.id === result.program.id ? result.program : program)));
      setProgramStatus(result.message ?? "节目文稿已由 AI 重新编排");
    } catch (error) {
      const data = (error as Error & { data?: { message?: string; error?: string } }).data;
      setProgramStatus(`${data?.message ?? "AI 重编节目文稿失败"}：${data?.error ?? errorMessage(error)}`);
    } finally {
      setProgramRewriteBusy(false);
    }
  };

  const deleteProgram = async (programId: string) => {
    try {
      const result = await apiJson<{ message?: string }>(`/api/programs/${programId}`, {
        method: "DELETE",
      });
      setProgramHistory((current) => current.filter((program) => program.id !== programId));
      if (generatedProgram?.id === programId) {
        const next = programHistory.find((program) => program.id !== programId) ?? null;
        setGeneratedProgram(next);
      }
      setProgramStatus(result.message ?? "节目已删除");
    } catch (error) {
      setProgramStatus(`删除节目失败：${errorMessage(error)}`);
    }
  };

  const clearProgramsByDate = async (date: string, pluginId?: string) => {
    if (!date) {
      notifyAdmin("请选择要清理的日期", "error");
      return;
    }
    const label = pluginId === "kugou-music" ? "音乐联播节目" : "节目";
    if (!window.confirm(`确定清理 ${date} 的所有${label}？音频文件也会同步删除。`)) {
      return;
    }
    try {
      const params = pluginId ? `?pluginId=${encodeURIComponent(pluginId)}` : "";
      const result = await apiJson<ProgramListResponse & { message?: string }>(`/api/programs/by-date/${encodeURIComponent(date)}${params}`, {
        method: "DELETE",
      });
      setProgramHistory(result.programs);
      setGeneratedProgram((current) => result.programs.find((program) => program.id === current?.id) ?? result.programs[0] ?? null);
      const message = result.message ?? `${date} ${label}已清理`;
      setProgramStatus(message);
      notifyAdmin(message, "success");
      void refreshProgramArchives(false);
    } catch (error) {
      const message = `清理节目失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const saveProgramMetadata = async (programId: string, patch: ProgramMetadataPatch) => {
    try {
      const result = await apiJson<{ message?: string; program: ProgramRecord }>(`/api/programs/${programId}`, {
        body: JSON.stringify(patch),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setProgramHistory((current) => current.map((program) => (program.id === programId ? result.program : program)));
      if (generatedProgram?.id === programId) {
        setGeneratedProgram(result.program);
      }
      const message = result.message ?? "节目管理信息已保存";
      setProgramStatus(message);
      notifyAdmin(message, "success");
      void refreshProgramArchives(false);
    } catch (error) {
      const message = `节目管理信息保存失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const pushProgramToHome = async (programId: string, voicePrompt = "") => {
    if (programPushBusyId) {
      return;
    }
    setProgramPushBusyId(programId);
    setProgramStatus("正在保存最新内容、更新单节目配音并推送...");
    try {
      const selected = generatedProgram?.id === programId ? generatedProgram : null;
      const nextSegments = selected
        ? draftSegmentsForHosts(programDraft, programHostIds, selected.sourceType, voicePrompt)
        : [];
      const segmentStylesChanged = selected && voicePrompt.trim()
        ? selected.segments?.some((segment) => String(segment.style ?? "").trim() !== voicePrompt.trim()) !== false
        : false;
      const shouldUpdateContent = Boolean(
        selected && (
          programDraft.trim() !== selected.script.trim() ||
          selected.status !== "ready" ||
          !selected.audioUrl ||
          segmentStylesChanged
        ),
      );
      const result = await apiJson<ProgramListResponse & { message?: string; program: ProgramRecord; publishDate?: string }>(
        `/api/programs/${programId}/push-home`,
        {
          body: JSON.stringify({
            publishDate: selectedTimelineDate,
            playbackSpeed: selected ? programPlaybackSpeed : undefined,
            script: shouldUpdateContent ? programDraft : undefined,
            segments: shouldUpdateContent ? nextSegments : undefined,
            voicePrompt: shouldUpdateContent ? voicePrompt : undefined,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      setProgramHistory(result.programs);
      setGeneratedProgram(result.program);
      setProgramStatus(result.message ?? "节目内容已更新，原播出时间与排序保持不变");
      notifyAdmin(result.message ?? "节目内容已更新，原播出时间与排序保持不变", "success");
      void refreshProgramArchives(false);
    } catch (error) {
      const failedProgram = (error as Error & { data?: { program?: ProgramRecord } }).data?.program;
      if (failedProgram) {
        setGeneratedProgram(failedProgram);
        setProgramHistory((current) => current.map((program) => program.id === failedProgram.id ? failedProgram : program));
      }
      const message = `立即推送失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    } finally {
      setProgramPushBusyId("");
    }
  };

  // 流程编排生成后刷新节目列表。
  const reloadProgramsAfterFlow = async () => {
    try {
      const programData = await apiJson<ProgramListResponse>("/api/programs");
      setProgramHistory(programData.programs);
      if (!generatedProgram) {
        setGeneratedProgram(programData.programs[0] ?? null);
      }
      void refreshProgramArchives(false);
    } catch {
      // 刷新失败不阻断流程编排的主流程
    }
  };

  const createProgramCategory = async (name: string) => {
    try {
      const result = await apiJson<ProgramCategoryResponse>("/api/program-categories", {
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setProgramCategories(result.categories);
      const message = result.message ?? "节目分类已新增";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `新增节目分类失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const renameProgramCategory = async (categoryId: string, name: string) => {
    try {
      const result = await apiJson<ProgramCategoryResponse>(`/api/program-categories/${categoryId}`, {
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setProgramCategories(result.categories);
      const message = result.message ?? "节目分类已更新";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `更新节目分类失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const deleteProgramCategory = async (categoryId: string) => {
    try {
      const result = await apiJson<ProgramCategoryResponse>(`/api/program-categories/${categoryId}`, {
        method: "DELETE",
      });
      setProgramCategories(result.categories);
      const programData = await apiJson<ProgramListResponse>("/api/programs");
      setProgramHistory(programData.programs);
      const message = result.message ?? "节目分类已删除";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `删除节目分类失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const createSoundEffectCategory = async (name: string) => {
    try {
      const result = await apiJson<SoundEffectsResponse>("/api/sound-effect-categories", {
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setSoundEffectCategories(result.categories);
      const message = result.message ?? "音效分类已新增";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `新增音效分类失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const renameSoundEffectCategory = async (categoryId: string, name: string) => {
    try {
      const result = await apiJson<SoundEffectsResponse>(`/api/sound-effect-categories/${categoryId}`, {
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      setSoundEffectCategories(result.categories);
      const message = result.message ?? "音效分类已更新";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `更新音效分类失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const deleteSoundEffectCategory = async (categoryId: string) => {
    try {
      const result = await apiJson<SoundEffectsResponse>(`/api/sound-effect-categories/${categoryId}`, {
        method: "DELETE",
      });
      setSoundEffectCategories(result.categories);
      const message = result.message ?? "音效分类已删除";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `删除音效分类失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const uploadSoundEffect = async (categoryId: string, file: File, name: string) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await apiJson<SoundEffectsResponse>("/api/sound-effects", {
        body: JSON.stringify({
          categoryId,
          dataUrl,
          fileName: file.name,
          name: name.trim() || file.name.replace(/\.[a-z0-9]+$/iu, ""),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setSoundEffectCategories(result.categories);
      const message = result.message ?? "音效已上传";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `上传音效失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const deleteSoundEffect = async (effectId: string) => {
    try {
      const result = await apiJson<SoundEffectsResponse>(`/api/sound-effects/${effectId}`, {
        method: "DELETE",
      });
      setSoundEffectCategories(result.categories);
      const nextEffectIds = new Set(result.categories.flatMap((category) => category.effects.map((effect) => effect.id)));
      setAdminConfig((current) => ({
        ...current,
        plugins: {
          ...current.plugins,
          dailyBriefing: {
            ...current.plugins.dailyBriefing,
            audioMix: {
              ...current.plugins.dailyBriefing.audioMix,
              effectIds: current.plugins.dailyBriefing.audioMix.effectIds.filter((id) => nextEffectIds.has(id)),
            },
          },
          hotTopics: {
            ...current.plugins.hotTopics,
            audioMix: {
              ...current.plugins.hotTopics.audioMix,
              effectIds: current.plugins.hotTopics.audioMix.effectIds.filter((id) => nextEffectIds.has(id)),
            },
          },
        },
      }));
      const message = result.message ?? "音效已删除";
      setProgramStatus(message);
      notifyAdmin(message, "success");
    } catch (error) {
      const message = `删除音效失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    }
  };

  const publishNextDayPrograms = async () => {
    if (publishBusy) {
      return;
    }

    const scopedPrograms = programsForTimelineDate(programHistory, selectedTimelineDate);
    if (!scopedPrograms.length) {
      const message = `${selectedTimelineDate} 还没有节目可发布`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
      return;
    }

    setPublishBusy(true);
    setProgramStatus(`正在发布 ${selectedTimelineDate} 节目...`);
    try {
      const result = await apiJson<ProgramReorderResponse & { publishDate?: string }>("/api/programs/publish-next-day", {
        body: JSON.stringify({ ids: scopedPrograms.map((program) => program.id), publishDate: selectedTimelineDate }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setProgramHistory(result.programs);
      setGeneratedProgram((current) => result.programs.find((program) => program.id === current?.id) ?? result.programs[0] ?? null);
      const message = result.message ?? `${selectedTimelineDate} 节目已发布`;
      setProgramStatus(message);
      notifyAdmin(message, "success");
      void refreshProgramArchives(false);
    } catch (error) {
      const message = `发布失败：${errorMessage(error)}`;
      setProgramStatus(message);
      notifyAdmin(message, "error");
    } finally {
      setPublishBusy(false);
    }
  };

  const loginAdmin = async (username: string, password: string) => {
    setAdminLoginStatus("正在登录后台...");
    try {
      const result = await apiJson<AdminLoginResponse>("/api/admin/login", {
        body: JSON.stringify({ password, username }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      window.localStorage.setItem("star-radio.admin-token", result.token);
      window.localStorage.setItem("star-radio.admin-user", result.user.username);
      setAdminToken(result.token);
      setAdminUser(result.user.username);
      setAdminLoginStatus(`登录成功，有效期至 ${new Date(result.expiresAt).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" })}`);
    } catch (error) {
      setAdminLoginStatus(`登录失败：${errorMessage(error)}`);
    }
  };

  const logoutAdmin = async () => {
    try {
      await apiJson<{ message?: string }>("/api/admin/logout", { method: "POST" });
    } catch {
      // Local cleanup still matters if the session has already expired.
    }
    window.localStorage.removeItem("star-radio.admin-token");
    window.localStorage.removeItem("star-radio.admin-user");
    setAdminToken("");
    setAdminUser("");
    setAdminLoginStatus("已退出后台管理");
  };

  if (isAdminRoute) {
    if (!adminLoggedIn) {
      return <AdminLoginPage status={adminLoginStatus} onLogin={loginAdmin} />;
    }

    return (
      <>
      <audio ref={programPreviewBackgroundAudioRef} />
      <AdminShell
        adminConfig={adminConfig}
        adminNotice={adminNotice}
        adminSection={adminSection}
        adminUser={adminUser}
        backendStatus={backendStatus}
        configSavedAt={configSavedAt}
        configTestStatus={configTestStatus}
        customContentMode={customContentMode}
        dailyBriefingBusy={dailyBriefingBusy}
        generatedProgram={generatedProgram}
        hotTopicsBusy={hotTopicsBusy}
        kugouApiBusy={kugouApiBusy}
        kugouApiName={kugouApiName}
        kugouApiParams={kugouApiParams}
        kugouApiResult={kugouApiResult}
        kugouLoginBusy={kugouLoginBusy}
        kugouProgramBusy={kugouProgramBusy}
        kugouQr={kugouQr}
        kugouStatus={kugouStatus}
        manualMusicQuery={manualMusicQuery}
        manualMusicResults={manualMusicResults}
        manualMusicSearchBusy={manualMusicSearchBusy}
        manualMusicSelected={manualMusicSelected}
        manualMusicStatus={manualMusicStatus}
        mediaProgramBusy={mediaProgramBusy}
        onAdminConfigChange={updateAdminConfig}
        onAdminConfigSave={saveAdminConfig}
        onDailyBriefingGenerate={generateDailyBriefing}
        onDeleteProgram={deleteProgram}
        onGenerateProgram={generateProgramNow}
        onGenerateProgramPreset={saveProgramPreset}
        onHotTopicsGenerate={generateHotTopics}
        onKugouApiCall={callKugouApiModule}
        onKugouApiNameChange={setKugouApiName}
        onKugouApiParamsChange={setKugouApiParams}
        onKugouGenerate={generateKugouProgram}
        onKugouQrCreate={createKugouQr}
        onKugouStatusRefresh={refreshKugouStatus}
        onManualMusicAdd={addManualMusicSong}
        onManualMusicQueryChange={setManualMusicQuery}
        onManualMusicRemove={removeManualMusicSong}
        onManualMusicReorder={reorderManualMusicSong}
        onManualMusicSearch={searchManualMusic}
        onMediaGenerate={generateMediaProgram}
        onMediaProbe={probeMediaProgram}
        onSunoGenerate={generateSunoMusic}
        onSunoPlan={generateSunoPlan}
        onSunoSelect={selectSunoCandidate}
        onLogout={logoutAdmin}
        onProgramsChanged={reloadProgramsAfterFlow}
        onProgramArchiveDelete={deleteProgramArchive}
        onProgramArchiveDeleteDate={deleteProgramArchivesByDate}
        onProgramArchiveRefresh={refreshProgramArchives}
        onProgramCategoryChange={setProgramCategoryId}
        onProgramCategoryCreate={createProgramCategory}
        onProgramCategoryDelete={deleteProgramCategory}
        onProgramCategoryRename={renameProgramCategory}
        onCustomContentModeChange={setCustomContentMode}
        onProgramDraftChange={setProgramDraft}
        onProgramHostToggle={toggleProgramHost}
        onProgramMetadataSave={saveProgramMetadata}
        onProgramPlaybackSpeedChange={setProgramPlaybackSpeed}
        onProgramPromptChange={setProgramPrompt}
        onProgramPublishNextDay={publishNextDayPrograms}
        onProgramClearDate={clearProgramsByDate}
        onProgramPushHome={pushProgramToHome}
        onProgramPresetDelete={deleteProgramPreset}
        onProgramPresetEdit={editProgramPreset}
        onProgramRegenerateTts={regenerateProgramTts}
        onProgramReorder={reorderProgram}
        onProgramRewriteScript={rewriteProgramScript}
        onProgramSaveDraft={saveProgramDraft}
        onProgramScheduledTimeChange={setProgramScheduledTime}
        onProgramScheduleDraftChange={updateScheduleDraft}
        onProgramScheduleSave={saveProgramSchedule}
        onProgramSelect={selectProgram}
        onProgramTitleChange={setProgramTitle}
        onProgramTypeChange={setProgramType}
        onSectionChange={setAdminSection}
        onSoundEffectCategoryCreate={createSoundEffectCategory}
        onSoundEffectCategoryDelete={deleteSoundEffectCategory}
        onSoundEffectCategoryRename={renameSoundEffectCategory}
        onSoundEffectDelete={deleteSoundEffect}
        onSoundEffectUpload={uploadSoundEffect}
        onSystemSettingsSave={saveSystemSettings}
        onTestService={testServiceConfig}
        onTimelineDateChange={setSelectedTimelineDate}
        programAudioRef={programAudioRef}
        programArchives={programArchives}
        programBusy={programBusy}
        programCategoryId={programCategoryId}
        programCategories={programCategories}
        programDraft={programDraft}
        programHistory={programHistory}
        programHostIds={programHostIds}
        programPlaybackSpeed={programPlaybackSpeed}
        programPresetBusy={programPresetBusy}
        programPresets={programPresets}
        programPushBusyId={programPushBusyId}
        programPrompt={programPrompt}
        programScheduledTime={programScheduledTime}
        programRewriteBusy={programRewriteBusy}
        programStatus={programStatus}
        programTitle={programTitle}
        programType={programType}
        programTtsBusy={programTtsBusy}
        publishBusy={publishBusy}
        scheduleDrafts={scheduleDrafts}
        selectedTimelineDate={selectedTimelineDate}
        soundEffectCategories={soundEffectCategories}
        sunoMusicBusy={sunoMusicBusy}
        sunoCandidates={sunoCandidates}
        systemSettings={systemSettings}
        timelinePrograms={timelinePrograms}
      />
      </>
    );
  }

  return (
    <div className="app-shell">
      <audio preload="auto" ref={audioRef} />
      <audio preload="auto" ref={backgroundAudioRef} />
      <header className={`topbar ${scrolled ? "topbar--scrolled" : ""}`}>
        <button className="brand" onClick={() => setActiveNav("首页")} type="button">
          <img alt="" className="brand-icon" src={systemSettings.logoUrl || generatedAssets.icons.waveLogo} />
          <span>
            <strong>{systemSettings.appName || defaultSystemSettings.appName}</strong>
            <small>{systemSettings.subtitle || defaultSystemSettings.subtitle}</small>
          </span>
        </button>

        <nav className="nav-tabs" aria-label="主导航">
          {navItems.map((item) => (
            <button
              className={activeNav === item ? "is-active" : ""}
              key={item}
              onClick={(event) => {
                setActiveNav(item);
                event.currentTarget.scrollIntoView({ block: "nearest", inline: "center" });
              }}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="search-wrap">
          <label className="search-box">
            <Search size={19} />
            <input
              aria-label="搜索节目、歌曲或主播"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索节目 / 歌曲 / 主播"
              value={query}
            />
            {query ? (
              <button aria-label="清空搜索" onClick={() => setQuery("")} type="button">
                <X size={16} />
              </button>
            ) : null}
          </label>
          {searchResults.length ? (
            <div className="search-popover">
              {searchResults.map((result) => (
                <button key={`${result.kind}-${result.id}`} onClick={() => handleSearchPick(result)} type="button">
                  <strong>{result.title}</strong>
                  <span>{result.meta}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="account-actions">
          <button className="theme-toggle-button" onClick={toggleAudienceTheme} title={currentThemeMode === "dark" ? "切换浅色主题" : "切换深色主题"} type="button">
            {currentThemeMode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {userLoggedIn ? (
            <button className="login-button" onClick={() => setActiveNav("个人中心")} type="button">
              <Headphones size={18} />
              <span>个人中心</span>
            </button>
          ) : (
            <button className="login-button" onClick={() => setModal("login")} type="button">
              <LogIn size={18} />
              <span>登录</span>
            </button>
          )}
        </div>
      </header>

      <main className={`dashboard ${activeNav === "首页" ? "" : "dashboard--page"} ${activeNav === "个人中心" ? "dashboard--account" : ""}`}>
        {activeNav === "首页" ? (
          <>
        <section className="hero-card">
          <div className="hero-copy">
            <div className="live-row">
              <span className="live-pill">
                <span className="online-dot" />
                24H LIVE
              </span>
              <time className="live-clock" dateTime={clockNow.toISOString()}>{currentLiveClock}</time>
              <span>{hasBackendData ? "电台直播中" : "电台准备中"}</span>
            </div>
            <h1>{hasBackendData ? currentDisplayTitle : "星声电台"}</h1>
            <p className="host-line">
              {hasBackendData ? (
                <>
                  {currentQueueItemWithLyrics?.type === "song" ? "正在播放" : "AI主播"}：<strong>{currentDisplayHost}</strong>
                  <span />
                  {currentQueueItemWithLyrics?.type === "song" ? currentTrack.title : currentProgram?.categoryName ?? activeHost.tone}
                </>
              ) : (
                <>
                  AI主播：<strong>{activeHost.name}</strong>
                  <span />
                  {activeHost.tone}
                </>
              )}
            </p>
            <p className="hero-description">
              {heroDescription}
            </p>
          </div>

          <ThreeHeroBackground imageSrc={generatedAssets.heroImage} progress={dayProgress} />

          <button className="hero-play" onClick={playLiveProgram} title={liveButtonPlaying ? "暂停直播" : "播放当前直播"} type="button">
            {liveButtonPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>

          <div className={`hero-volume ${volumeOpen ? "is-open" : ""}`}>
            <button
              onClick={toggleVolumeOpen}
              title={volumeOpen ? "收起音量" : "调整音量"}
              type="button"
            >
              {volume > 0 ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <div className="hero-volume__controls">
              <input
                aria-label="播放音量"
                max={1}
                min={0}
                onChange={(event) => handleVolumeChange(Number(event.target.value))}
                onInput={(event) => handleVolumeChange(Number(event.currentTarget.value))}
                step={0.01}
                type="range"
                value={volume}
              />
              <span>{Math.round(volume * 100)}%</span>
            </div>
          </div>

          <div className="live-timeline">
            <div className="timeline-top">
              <span className="timeline-end">{timelineStartDateLabel}</span>
              <div aria-label="24小时直播进度" className="timeline-progress" role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(dayProgress)}>
                <i style={{ width: `${dayProgress}%` }} />
                {DAY_TIMELINE_TICKS.map((hour) => (
                  <span
                    aria-hidden="true"
                    className={`timeline-tick ${hour % 6 === 0 ? "is-major" : ""}`}
                    key={hour}
                    style={{ left: `${(hour / 24) * 100}%` }}
                  />
                ))}
                <b className="timeline-bead" style={{ left: `${dayProgress}%` }} />
              </div>
              <span className="timeline-end">{timelineEndDateLabel}</span>
            </div>
            <div className="timeline-marks">
              {timelineMarkLabels.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="lyric-card">
          <div className="card-title-row">
            <h2>字幕</h2>
            <button className={`switch ${autoScroll ? "is-on" : ""}`} onClick={() => setAutoScroll((value) => !value)} type="button">
              <span>自动滚动</span>
              <i />
            </button>
          </div>
          <div className="lyric-list" ref={lyricListRef}>
            {hasBackendData && currentSubtitleLines.length ? (
              currentSubtitleLines.map((line, index) => (
                <div className={`lyric-line ${index === activeLyric ? "is-active" : ""}`} key={`${line.time}-${line.text}`}>
                  <time>{line.time}</time>
                  <strong>{line.text}</strong>
                </div>
              ))
            ) : (
              <div className="empty-state">节目上线后将显示字幕</div>
            )}
          </div>
          <div className="equalizer" aria-hidden="true">
            {Array.from({ length: 70 }).map((_, index) => (
              <i key={index} style={{ height: `${5 + ((index * 11) % 34)}px` }} />
            ))}
          </div>
        </section>

        <section className="panel schedule-card">
          <PanelTitle icon={<CalendarDays size={21} />} title="节目预告" />
          <div className="schedule-list">
            {publicScheduleItems.length ? (
              publicScheduleItems.map((program) => (
                <div className="schedule-row" key={program.id}>
                  <time>{program.time}</time>
                  <strong>{program.title}</strong>
                  <span>AI主播：{program.host}</span>
                  <small>{program.style}</small>
                  <button
                    className={reminders.includes(program.id) ? "is-active" : ""}
                    onClick={() => toggleReminder(program.id)}
                    title={reminders.includes(program.id) ? "取消提醒" : "提醒我"}
                    type="button"
                  >
                    <Bell size={20} />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">今日暂无节目预告</div>
            )}
          </div>
        </section>

        <section className="panel history-card">
          <PanelTitle icon={<History size={21} />} title="今日已播" />
          <div className="history-list">
            {publicHistoryItems.length ? (
              publicHistoryItems.map((program) => (
                <button
                  className="history-row"
                  key={program.id}
                  onClick={() => {
                    const track = publicTrackCatalog.find((item) => item.id === `program-${program.id}` || item.id === program.id);
                    if (track) {
                      playTrack(track);
                    }
                  }}
                  type="button"
                >
                  <img alt="" className="thumb" src={program.image} />
                  <span>
                    <strong>{program.title}</strong>
                    <small>AI主播：{program.host} · {program.date}</small>
                  </span>
                  <time>{program.duration}</time>
                  <i>
                    {currentTrack.id === `program-${program.id}` && playing ? (
                      <Pause size={20} fill="currentColor" />
                    ) : (
                      <Play size={20} fill="currentColor" />
                    )}
                  </i>
                </button>
              ))
            ) : (
              <div className="empty-state">今日暂无已播节目</div>
            )}
          </div>
        </section>

        <section className="panel track-card">
          <PanelTitle
            icon={<img alt="" className="panel-image-icon" src={generatedAssets.icons.musicNote} />}
            title="音乐节目点播"
          />
          <div className="track-list">
            {libraryTrackCatalog.length ? (
              libraryTrackCatalog.map((track) => (
                <div className={`track-row ${track.id === currentTrack.id ? "is-current" : ""}`} key={track.id}>
                  <img alt="" className="track-art" src={track.image} />
                  <span>
                    <strong>{track.title}</strong>
                    <small>AI主播：{track.host}</small>
                  </span>
                  <time>{formatDuration(track.duration)}</time>
                  <button onClick={() => playTrack(track)} title={track.id === currentTrack.id && playing ? "暂停" : "播放"} type="button">
                    {track.id === currentTrack.id && playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>
                  <button
                    className={`favorite-button ${favorites.includes(track.id) ? "is-active" : ""}`}
                    onClick={() => toggleFavorite(track.id)}
                    title={favorites.includes(track.id) ? "取消收藏" : "加入收藏"}
                    type="button"
                  >
                    {favorites.includes(track.id) ? (
                      <Heart size={20} fill="currentColor" />
                    ) : (
                      <Plus size={20} />
                    )}
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">暂无已播完的音乐节目</div>
            )}
          </div>
        </section>
          </>
        ) : (
          <SecondaryPage
            adminConfig={adminConfig}
            activeNav={activeNav}
            backendStatus={backendStatus}
            configSavedAt={configSavedAt}
            configTestStatus={configTestStatus}
            customContentMode={customContentMode}
            dailyBriefingBusy={dailyBriefingBusy}
            favoriteTracks={favoriteTracks}
            favorites={favorites}
            generatedProgram={generatedProgram}
            hotTopicsBusy={hotTopicsBusy}
            kugouApiBusy={kugouApiBusy}
            kugouApiName={kugouApiName}
            kugouApiParams={kugouApiParams}
            kugouApiResult={kugouApiResult}
            kugouLoginBusy={kugouLoginBusy}
            kugouProgramBusy={kugouProgramBusy}
            kugouQr={kugouQr}
            kugouStatus={kugouStatus}
            libraryTracks={libraryTrackCatalog}
            manualMusicQuery={manualMusicQuery}
            manualMusicResults={manualMusicResults}
            manualMusicSearchBusy={manualMusicSearchBusy}
            manualMusicSelected={manualMusicSelected}
            manualMusicStatus={manualMusicStatus}
            mediaProgramBusy={mediaProgramBusy}
            currentTrackId={currentTrack.id}
            programDraft={programDraft}
            reminders={reminders}
            userLoggedIn={userLoggedIn}
            onFavorite={toggleFavorite}
            onAdminConfigChange={updateAdminConfig}
            onAdminConfigSave={saveAdminConfig}
            onDailyBriefingGenerate={generateDailyBriefing}
            onDeleteProgram={deleteProgram}
            onGenerateProgram={generateProgramNow}
            onGenerateProgramPreset={saveProgramPreset}
            onHotTopicsGenerate={generateHotTopics}
            onKugouApiCall={callKugouApiModule}
            onKugouApiNameChange={setKugouApiName}
            onKugouApiParamsChange={setKugouApiParams}
            onKugouGenerate={generateKugouProgram}
            onKugouQrCreate={createKugouQr}
            onKugouStatusRefresh={refreshKugouStatus}
            onManualMusicAdd={addManualMusicSong}
            onManualMusicQueryChange={setManualMusicQuery}
            onManualMusicRemove={removeManualMusicSong}
            onManualMusicReorder={reorderManualMusicSong}
            onManualMusicSearch={searchManualMusic}
            onMediaGenerate={generateMediaProgram}
            onMediaProbe={probeMediaProgram}
            onSunoGenerate={generateSunoMusic}
            onSunoPlan={generateSunoPlan}
            onSunoSelect={selectSunoCandidate}
            onPlay={playTrack}
            onProgramArchiveDelete={deleteProgramArchive}
            onProgramArchiveDeleteDate={deleteProgramArchivesByDate}
            onProgramArchiveRefresh={refreshProgramArchives}
            onProgramCategoryChange={setProgramCategoryId}
            onProgramCategoryCreate={createProgramCategory}
            onProgramCategoryDelete={deleteProgramCategory}
            onProgramCategoryRename={renameProgramCategory}
            onCustomContentModeChange={setCustomContentMode}
            onProgramDraftChange={setProgramDraft}
            onProgramHostToggle={toggleProgramHost}
            onProgramMetadataSave={saveProgramMetadata}
            onProgramPlaybackSpeedChange={setProgramPlaybackSpeed}
            onProgramPromptChange={setProgramPrompt}
            onProgramPublishNextDay={publishNextDayPrograms}
            onProgramClearDate={clearProgramsByDate}
            onProgramPushHome={pushProgramToHome}
            onProgramPresetDelete={deleteProgramPreset}
            onProgramPresetEdit={editProgramPreset}
            onProgramRegenerateTts={regenerateProgramTts}
            onProgramReorder={reorderProgram}
            onProgramRewriteScript={rewriteProgramScript}
            onProgramSaveDraft={saveProgramDraft}
            onProgramScheduledTimeChange={setProgramScheduledTime}
            onProgramScheduleDraftChange={updateScheduleDraft}
            onProgramScheduleSave={saveProgramSchedule}
            onProgramSelect={selectProgram}
            onProgramTitleChange={setProgramTitle}
            onProgramTypeChange={setProgramType}
            onSelectNav={setActiveNav}
            onSoundEffectCategoryCreate={createSoundEffectCategory}
            onSoundEffectCategoryDelete={deleteSoundEffectCategory}
            onSoundEffectCategoryRename={renameSoundEffectCategory}
            onSoundEffectDelete={deleteSoundEffect}
            onSoundEffectUpload={uploadSoundEffect}
            onSystemSettingsSave={saveSystemSettings}
            onTestService={testServiceConfig}
            onTimelineDateChange={setSelectedTimelineDate}
            onUserLogout={logoutUser}
            programAudioRef={programAudioRef}
            programArchives={programArchives}
            programBusy={programBusy}
            programCategoryId={programCategoryId}
            programCategories={programCategories}
            programHostIds={programHostIds}
            programHistory={programHistory}
            programPlaybackSpeed={programPlaybackSpeed}
            programPresetBusy={programPresetBusy}
            programPresets={programPresets}
            programPushBusyId={programPushBusyId}
            programPrompt={programPrompt}
            programScheduledTime={programScheduledTime}
            playing={playing}
            publishBusy={publishBusy}
            programStatus={programStatus}
            programRewriteBusy={programRewriteBusy}
            programTtsBusy={programTtsBusy}
            programTitle={programTitle}
            programType={programType}
            rankedTracks={rankedTracks}
            scheduleDrafts={scheduleDrafts}
            selectedTimelineDate={selectedTimelineDate}
            soundEffectCategories={soundEffectCategories}
            sunoMusicBusy={sunoMusicBusy}
            sunoCandidates={sunoCandidates}
            systemSettings={systemSettings}
            timelinePrograms={timelinePrograms}
          />
        )}
      </main>

      <footer className="radio-footer">
        <span />
        <Radio size={20} />
        <strong>
          <a href="https://github.com/moli-xia/AIradio" target="_blank" rel="noreferrer">
            {footerLinkText(systemSettings.footerText)}
          </a>
        </strong>
        <Volume2 size={20} />
        <span />
      </footer>

      {modal ? <AccountModal modal={modal} onAuthSuccess={completeUserLogin} onClose={() => setModal(null)} onSwitch={setModal} /> : null}
    </div>
  );
}

type SecondaryPageProps = {
  adminConfig: AdminConfig;
  adminNotice?: AdminNotice;
  activeNav: string;
  backendStatus: string;
  configSavedAt: string;
  configTestStatus: Record<ServiceKey, string>;
  customContentMode: CustomContentMode;
  currentTrackId: string;
  dailyBriefingBusy: boolean;
  favoriteTracks: Track[];
  favorites: string[];
  generatedProgram: ProgramRecord | null;
  hotTopicsBusy: boolean;
  kugouApiBusy: boolean;
  kugouApiName: string;
  kugouApiParams: string;
  kugouApiResult: string;
  kugouLoginBusy: boolean;
  kugouProgramBusy: boolean;
  kugouQr: { key: string; qrImage: string; qrUrl: string } | null;
  kugouStatus: string;
  libraryTracks: Track[];
  manualMusicQuery: string;
  manualMusicResults: MusicCandidate[];
  manualMusicSearchBusy: boolean;
  manualMusicSelected: MusicCandidate[];
  manualMusicStatus: string;
  mediaProgramBusy: boolean;
  programDraft: string;
  onAdminConfigChange: <T extends ServiceKey, K extends keyof AdminConfig[T]>(
    service: T,
    key: K,
    value: AdminConfig[T][K],
  ) => void;
  onAdminConfigSave: () => void | Promise<void>;
  onDailyBriefingGenerate: () => void | Promise<void>;
  onDeleteProgram: (programId: string) => void | Promise<void>;
  onFavorite: (trackId: string) => void;
  onGenerateProgram: (voicePrompt?: string) => void | Promise<void>;
  onGenerateProgramPreset: () => void | Promise<void>;
  onHotTopicsGenerate: () => void | Promise<void>;
  onKugouApiCall: () => void | Promise<void>;
  onKugouApiNameChange: (value: string) => void;
  onKugouApiParamsChange: (value: string) => void;
  onKugouGenerate: (voicePrompt?: string) => void | Promise<void>;
  onKugouQrCreate: () => void | Promise<void>;
  onKugouStatusRefresh: () => void | Promise<void>;
  onManualMusicAdd: (song: MusicCandidate) => void;
  onManualMusicQueryChange: (value: string) => void;
  onManualMusicRemove: (index: number) => void;
  onManualMusicReorder: (index: number, direction: -1 | 1) => void;
  onManualMusicSearch: () => void | Promise<void>;
  onMediaGenerate: (input: MediaProgramInput, voicePrompt?: string, background?: boolean) => Promise<MediaProbeResult | null>;
  onMediaProbe: (input: Pick<MediaProgramInput, "mediaUrl" | "siteCookie">) => Promise<MediaProbeResult | null>;
  onSunoGenerate: (input: AiMusicInput) => Promise<AiMusicPlan | null>;
  onSunoPlan: (input: AiMusicInput) => Promise<AiMusicPlan | null>;
  onSunoSelect: (candidate: SunoCandidate) => void | Promise<void>;
  onPlay: (track: Track) => void;
  onProgramArchiveDelete: (archiveId: string) => void | Promise<void>;
  onProgramArchiveDeleteDate: (date: string) => void | Promise<void>;
  onProgramArchiveRefresh: () => void | Promise<void>;
  onProgramCategoryChange: (categoryId: string) => void;
  onProgramCategoryCreate: (name: string) => void | Promise<void>;
  onProgramCategoryDelete: (categoryId: string) => void | Promise<void>;
  onProgramCategoryRename: (categoryId: string, name: string) => void | Promise<void>;
  onCustomContentModeChange: (value: CustomContentMode) => void;
  onProgramDraftChange: (value: string) => void;
  onProgramHostToggle: (hostId: string) => void;
  onProgramMetadataSave: (programId: string, patch: ProgramMetadataPatch) => void | Promise<void>;
  onProgramPlaybackSpeedChange: (value: number) => void;
  onProgramPromptChange: (value: string) => void;
  onProgramPublishNextDay: () => void | Promise<void>;
  onProgramClearDate: (date: string, pluginId?: string) => void | Promise<void>;
  onProgramPushHome: (programId: string, voicePrompt?: string) => void | Promise<void>;
  onProgramPresetDelete: (presetId: string) => void | Promise<void>;
  onProgramPresetEdit: (preset: ProgramPreset) => void;
  onProgramsChanged?: () => void | Promise<void>;
  onProgramRegenerateTts: (voicePrompt?: string) => void | Promise<void>;
  onProgramReorder: (programId: string, direction: -1 | 1) => void | Promise<void>;
  onProgramRewriteScript: () => void | Promise<void>;
  onProgramSaveDraft: (voicePrompt?: string) => void | Promise<void>;
  onProgramScheduledTimeChange: (value: string) => void;
  onProgramScheduleDraftChange: (programId: string, value: string) => void;
  onProgramScheduleSave: (programId: string) => void | Promise<void>;
  onProgramSelect: (program: ProgramRecord) => void;
  onProgramTitleChange: (value: string) => void;
  onProgramTypeChange: (value: ProgramType) => void;
  onSelectNav: (nav: string) => void;
  onSoundEffectCategoryCreate: (name: string) => void | Promise<void>;
  onSoundEffectCategoryDelete: (categoryId: string) => void | Promise<void>;
  onSoundEffectCategoryRename: (categoryId: string, name: string) => void | Promise<void>;
  onSoundEffectDelete: (effectId: string) => void | Promise<void>;
  onSoundEffectUpload: (categoryId: string, file: File, name: string) => void | Promise<void>;
  onSystemSettingsSave: (settings: SystemSettings) => Promise<SystemSettings>;
  onTestService: (service: ServiceKey) => void | Promise<void>;
  onTimelineDateChange: (value: string) => void;
  onUserLogout: () => void;
  programAudioRef: React.RefObject<HTMLAudioElement>;
  programArchives: ProgramArchiveResponse["archives"];
  programBusy: boolean;
  programCategoryId: string;
  programCategories: ProgramCategory[];
  programHostIds: string[];
  programHistory: ProgramRecord[];
  programPlaybackSpeed: number;
  programPresetBusy: boolean;
  programPresets: ProgramPreset[];
  programPushBusyId: string;
  programPrompt: string;
  programScheduledTime: string;
  programType: ProgramType;
  playing: boolean;
  reminders: string[];
  programRewriteBusy: boolean;
  programStatus: string;
  programTtsBusy: boolean;
  programTitle: string;
  publishBusy: boolean;
  rankedTracks: Track[];
  scheduleDrafts: Record<string, string>;
  selectedTimelineDate: string;
  soundEffectCategories: SoundEffectCategory[];
  sunoMusicBusy: boolean;
  sunoCandidates: SunoCandidate[];
  systemSettings: SystemSettings;
  timelinePrograms: ProgramRecord[];
  userLoggedIn: boolean;
};

type AdminShellProps = Omit<
  SecondaryPageProps,
  | "activeNav"
  | "currentTrackId"
  | "favoriteTracks"
  | "favorites"
  | "libraryTracks"
  | "onFavorite"
  | "onPlay"
  | "onSelectNav"
  | "onUserLogout"
  | "playing"
  | "rankedTracks"
  | "reminders"
  | "userLoggedIn"
> & {
  adminSection: AdminSection;
  adminUser: string;
  onLogout: () => void | Promise<void>;
  onSectionChange: (section: AdminSection) => void;
};

type FlowOrchestratorProps = {
  adminConfig: AdminConfig;
  programCategories: ProgramCategory[];
  programHistory: ProgramRecord[];
  programPresets: ProgramPreset[];
  soundEffectCategories: SoundEffectCategory[];
  onProgramPresetDelete: (presetId: string) => void | Promise<void>;
  onProgramPresetEdit: (preset: ProgramPreset) => void;
  onProgramsChanged?: () => void | Promise<void>;
};

const FLOW_SCHEDULED_KIND_LABEL: Record<FlowScheduledKind, string> = {
  custom: "自定义节目",
  "daily-briefing": "每日早报",
  "hot-topics": "今日热榜",
  kugou: "音乐联播",
  media: "网络媒体节目",
  suno: "AI音乐",
  existing: "引用已有节目",
  preset: "预设节目",
};

const FLOW_FILLER_KIND_LABEL: Record<FlowFillerKind, string> = {
  "kugou-random": "音乐联播",
  "custom-audio": "自定义音频链接",
  silence: "静音留白",
};

function flowNodeId() {
  return `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptyScheduledNode(kind: FlowScheduledKind = "custom"): FlowScheduledNode {
  return {
    id: flowNodeId(),
    type: "scheduled",
    kind,
    title: FLOW_SCHEDULED_KIND_LABEL[kind],
    startTime: "08:00",
    prompt: "",
    hostId: hosts[0].id,
    transitionBefore: null,
  };
}

function emptyTransition(): FlowTransitionNode {
  return { effectId: "", effectName: "", volume: 1 };
}

function sortFlowNodes(nodes: FlowNode[]): FlowNode[] {
  // 新版流程只展示定时节目；旧数据中的手动填充由自动兜底开关替代。
  return nodes
    .filter((node) => node.type === "scheduled")
    .map((node, idx) => {
      return { node, sortKey: node.startTime || "", idx };
    })
    .sort((a, b) => {
      const timeDiff = a.sortKey.localeCompare(b.sortKey);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.idx - b.idx;
    })
    .map((entry) => entry.node);
}

function allFlowEffects(categories: SoundEffectCategory[]): SoundEffect[] {
  return categories.flatMap((category) => category.effects);
}

function FlowOrchestrator(props: FlowOrchestratorProps) {
  const {
    adminConfig,
    programCategories,
    programHistory,
    programPresets,
    soundEffectCategories,
    onProgramPresetDelete,
    onProgramPresetEdit,
    onProgramsChanged,
  } = props;
  const effects = useMemo(() => allFlowEffects(soundEffectCategories), [soundEffectCategories]);
  const [presets, setPresets] = useState<FlowPreset[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<SavedMusicPlaylist[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [presetName, setPresetName] = useState("全天节目流程");
  const [publishDate, setPublishDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);
  const [autoFillKeywords, setAutoFillKeywords] = useState("");
  const [autoFillPlaybackMode, setAutoFillPlaybackMode] = useState<MusicPlaybackMode>("sequential");
  const [autoFillPlaylistId, setAutoFillPlaylistId] = useState("");
  const [autoFillSongs, setAutoFillSongs] = useState<MusicCandidate[]>([]);
  const [autoFillSearchQuery, setAutoFillSearchQuery] = useState("");
  const [autoFillSearchResults, setAutoFillSearchResults] = useState<MusicCandidate[]>([]);
  const [autoFillSearchBusy, setAutoFillSearchBusy] = useState(false);
  const [autoFillStatus, setAutoFillStatus] = useState("未手动选择时会按默认关键词生成音乐连播歌单");
  const [autoFillReplaceIndex, setAutoFillReplaceIndex] = useState<number | null>(null);
  const [autoFillTouched, setAutoFillTouched] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [status, setStatus] = useState<string>("添加节点来编排全天节目流程");
  const [runResult, setRunResult] = useState<FlowRunResponse | null>(null);

  const loadPresets = useCallback(async () => {
    try {
      const data = await apiJson<FlowPresetsResponse>("/api/flow-presets");
      setPresets(data.presets);
      if (data.presets.length && !activeId) {
        selectPreset(data.presets[0]);
      } else if (!data.presets.length) {
        setActiveId("");
        setNodes([]);
      }
    } catch (error) {
      setStatus(`加载流程预设失败：${errorMessage(error)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFlowPlaylists = useCallback(async () => {
    try {
      const data = await apiJson<MusicPlaylistsResponse>("/api/music-playlists");
      setSavedPlaylists(data.playlists);
    } catch (error) {
      setAutoFillStatus(`加载自定义歌单失败：${errorMessage(error)}`);
    }
  }, []);

  useEffect(() => {
    void loadPresets();
    void loadFlowPlaylists();
  }, [loadFlowPlaylists, loadPresets]);

  // 默认播出日期：当天
  useEffect(() => {
    if (!publishDate) {
      setPublishDate(localDateKey());
    }
  }, [publishDate]);

  function selectPreset(preset: FlowPreset) {
    setActiveId(preset.id);
    setNodes(sortFlowNodes(preset.nodes));
    setPresetName(preset.name);
    setScheduledTime(preset.scheduledTime ?? "");
    setAutoFillEnabled(preset.autoFillEnabled !== false);
    setAutoFillKeywords(preset.autoFillKeywords ?? "");
    setAutoFillPlaybackMode(preset.autoFillPlaybackMode === "shuffle" ? "shuffle" : "sequential");
    setAutoFillPlaylistId(preset.autoFillPlaylistId ?? "");
    setAutoFillSongs(preset.autoFillSongs ?? []);
    setAutoFillSearchQuery(preset.autoFillKeywords ?? "");
    setAutoFillSearchResults([]);
    setAutoFillStatus(
      preset.autoFillSongs?.length
        ? `已加载 ${preset.autoFillSongs.length} 首音乐连播歌曲`
        : "未手动选择时会按默认关键词生成音乐连播歌单",
    );
    setAutoFillReplaceIndex(null);
    setAutoFillTouched(false);
    setEnabled(preset.enabled);
    setRunResult(null);
    setStatus(`已加载流程「${preset.name}」`);
  }

  function startNewPreset() {
    setActiveId("");
    setNodes([]);
    setPresetName("全天节目流程");
    setScheduledTime("");
    setAutoFillEnabled(true);
    setAutoFillKeywords("");
    setAutoFillPlaybackMode("sequential");
    setAutoFillPlaylistId("");
    setAutoFillSongs([]);
    setAutoFillSearchQuery("");
    setAutoFillSearchResults([]);
    setAutoFillStatus("未手动选择时会按默认关键词生成音乐连播歌单");
    setAutoFillReplaceIndex(null);
    setAutoFillTouched(false);
    setEnabled(true);
    setRunResult(null);
    setStatus("新建流程：先添加一个定时节目节点");
  }

  function previewRunPreset() {
    if (!activeId) {
      setStatus("请先保存流程后再生成");
      return;
    }
    if (!nodes.length) {
      setStatus("流程为空，请先添加节点");
      return;
    }
    setPreviewOpen(true);
  }

  async function persistCurrentFlowPreset() {
    const data = await apiJson<FlowPresetResponse>("/api/flow-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: activeId || undefined,
        autoFillEnabled,
        autoFillKeywords: "",
        autoFillPlaybackMode,
        autoFillPlaylistId: autoFillPlaylistId || null,
        autoFillSongs,
        name: presetName.trim() || "未命名流程",
        nodes: sortFlowNodes(nodes),
        publishDate,
        scheduledTime: scheduledTime || null,
        enabled,
      }),
    });
    setActiveId(data.preset.id);
    setPresets((current) => {
      const others = current.filter((item) => item.id !== data.preset.id);
      return [data.preset, ...others];
    });
    setAutoFillTouched(false);
    return data;
  }

  async function savePreset() {
    setBusy(true);
    setStatus("正在保存流程…");
    try {
      const data = await persistCurrentFlowPreset();
      setStatus(data.message);
    } catch (error) {
      setStatus(`保存失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deletePreset() {
    if (!activeId) {
      return;
    }
    setBusy(true);
    try {
      await apiJson(`/api/flow-presets/${activeId}`, { method: "DELETE" });
      setPresets((current) => current.filter((item) => item.id !== activeId));
      startNewPreset();
      setStatus("流程预设已删除");
    } catch (error) {
      setStatus(`删除失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function searchAutoFillMusic() {
    const keywords = autoFillSearchQuery.trim() || autoFillKeywords.trim() || adminConfig.plugins.kugouMusic.searchKeywords.trim();
    if (!keywords || autoFillSearchBusy) {
      setAutoFillStatus(keywords ? autoFillStatus : "请输入要搜索的歌曲或歌手");
      return;
    }

    setAutoFillSearchBusy(true);
    setAutoFillStatus("正在搜索音乐连播歌曲...");
    try {
      writeAdminConfig(adminConfig);
      await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiJson<{ message?: string; songs: MusicCandidate[] }>("/api/plugins/music/search", {
        body: JSON.stringify({ keywords, limit: 18, provider: adminConfig.plugins.kugouMusic.provider }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setAutoFillKeywords(keywords);
      setAutoFillSearchResults(result.songs ?? []);
      setAutoFillStatus(result.message ?? `已找到 ${result.songs?.length ?? 0} 首候选歌曲`);
    } catch (error) {
      setAutoFillStatus(`音乐连播歌曲搜索失败：${errorMessage(error)}`);
    } finally {
      setAutoFillSearchBusy(false);
    }
  }

  function addAutoFillSong(song: MusicCandidate) {
    const key = songKey(song);
    setAutoFillSongs((current) => {
      if (autoFillReplaceIndex !== null) {
        return current.map((item, index) => (index === autoFillReplaceIndex ? song : item));
      }
      if (current.some((item) => songKey(item) === key)) {
        return current;
      }
      return [...current, song];
    });
    setAutoFillTouched(true);
    if (autoFillReplaceIndex !== null) {
      setAutoFillStatus(`已替换第 ${autoFillReplaceIndex + 1} 首：${song.title}`);
      setAutoFillReplaceIndex(null);
    }
  }

  function removeAutoFillSong(index: number) {
    setAutoFillSongs((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setAutoFillTouched(true);
    setAutoFillReplaceIndex((current) => (current === null ? null : current === index ? null : current > index ? current - 1 : current));
  }

  function reorderAutoFillSong(index: number, direction: -1 | 1) {
    setAutoFillSongs((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setAutoFillTouched(true);
  }

  async function applyAutoFillSongs() {
    if (!activeId) {
      setAutoFillStatus("请先保存流程后再应用音乐连播");
      return;
    }
    if (!autoFillEnabled) {
      setAutoFillStatus("音乐连播已关闭，无需应用到直播");
      return;
    }

    setBusy(true);
    setAutoFillStatus("正在应用音乐连播歌单到直播...");
    try {
      const data = await apiJson<FlowAutoFillApplyResponse>(`/api/flow-presets/${activeId}/auto-fill/apply`, {
        body: JSON.stringify({
          autoFillEnabled,
          autoFillKeywords: "",
          autoFillPlaybackMode,
          autoFillPlaylistId: autoFillPlaylistId || null,
          autoFillSongs,
          publishDate: publishDate || localDateKey(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const nextSongs = data.songs?.length ? data.songs : data.preset.autoFillSongs ?? autoFillSongs;
      setAutoFillSongs(nextSongs);
      setAutoFillReplaceIndex(null);
      setAutoFillTouched(false);
      setPresets((current) => {
        const others = current.filter((item) => item.id !== data.preset.id);
        return [data.preset, ...others];
      });
      setStatus(data.message);
      setAutoFillStatus(`${data.message}，已同步 ${nextSongs.length} 首`);
      await onProgramsChanged?.();
      void loadPresets();
    } catch (error) {
      setAutoFillStatus(`音乐连播应用失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function flowSummaryMessage(summary: FlowPreset["lastRunSummary"]) {
    if (!summary) {
      return "流程已开始生成，等待运行结果…";
    }
    if (summary.status === "running") {
      return summary.currentMessage || `正在生成全天节目：${summary.currentStage || "已进入队列"}，播出日期 ${summary.publishDate}`;
    }
    if (summary.status === "failed" && summary.currentMessage) {
      return `流程生成失败：${summary.currentMessage}`;
    }
    return `流程已执行：成功 ${summary.ready}，部分 ${summary.partial}，跳过 ${summary.skipped}，失败 ${summary.failed}`;
  }

  function flowRunTimeLabel(value?: string | null) {
    if (!value) {
      return "--";
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "--"
      : date.toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
  }

  async function runPreset() {
    if (!activeId) {
      setStatus("请先保存流程后再生成");
      return;
    }
    if (!nodes.length) {
      setStatus("流程为空，请先添加节点");
      return;
    }
    setBusy(true);
    setPreviewOpen(false);
    setRunResult(null);
    setStatus("正在保存当前流程，并自动准备全天节目和音乐连播歌单…");
    try {
      const saved = await persistCurrentFlowPreset();
      const runPresetId = saved.preset.id;
      const data = await apiJson<FlowRunResponse>(`/api/flow-presets/${runPresetId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishDate, refreshAutoFillSongs: true }),
      });
      setRunResult(data);
      setStatus(data.running ? flowSummaryMessage(data.summary) : data.message);

      if (!data.running) {
        onProgramsChanged?.();
        loadPresets();
        return;
      }

      for (let attempt = 0; attempt < 240; attempt += 1) {
        await wait(3000);
        const runData = await apiJson<FlowRunStatusResponse>(`/api/flow-presets/${runPresetId}/runs`);
        setRunResult({
          summary: runData.summary,
          programs: [],
          running: runData.running,
          message: flowSummaryMessage(runData.summary),
        });

        if (!runData.running && runData.summary?.status !== "running") {
          setStatus(flowSummaryMessage(runData.summary));
          onProgramsChanged?.();
          loadPresets();
          return;
        }

        setStatus(flowSummaryMessage(runData.summary));
      }

      setStatus("流程仍在后台生成，可稍后查看最近运行结果");
    } catch (error) {
      setStatus(`生成失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function addScheduledNode(afterId?: string) {
    const node = emptyScheduledNode(programPresets.length ? "preset" : "custom");
    if (programPresets[0]) {
      node.programId = programPresets[0].id;
      node.programTitle = programPresets[0].name;
      node.title = programPresets[0].title || programPresets[0].name;
    }
    insertNodeAfter(node, afterId);
    setEditingNodeId(node.id);
  }

  function insertNodeAfter(node: FlowNode, afterId?: string) {
    setNodes((current) => {
      if (!afterId) {
        return sortFlowNodes([...current, node]);
      }
      const next: FlowNode[] = [];
      for (const item of current) {
        next.push(item);
        if (item.id === afterId) {
          next.push(node);
        }
      }
      return sortFlowNodes(next);
    });
  }

  function removeNode(id: string) {
    setNodes((current) => current.filter((item) => item.id !== id));
  }

  function updateNode(id: string, patch: FlowNodePatch) {
    setNodes((current) =>
      current.map((item) => (item.id === id ? ({ ...item, ...patch } as FlowNode) : item)),
    );
  }

  function toggleTransition(nodeId: string, on: boolean) {
    setNodes((current) =>
      current.map((item) =>
        item.id === nodeId
          ? ({ ...item, transitionBefore: on ? emptyTransition() : null } as FlowNode)
          : item,
      ),
    );
  }

  function updateTransition(nodeId: string, patch: Partial<FlowTransitionNode>) {
    setNodes((current) =>
      current.map((item) => {
        if (item.id !== nodeId || !item.transitionBefore) {
          return item;
        }
        return { ...item, transitionBefore: { ...item.transitionBefore, ...patch } } as FlowNode;
      }),
    );
  }

  const sortedNodes = useMemo(() => sortFlowNodes(nodes), [nodes]);
  const editingNode = sortedNodes.find((node) => node.id === editingNodeId) || null;
  const scheduledNodes = sortedNodes.filter((node): node is FlowScheduledNode => node.type === "scheduled");
  const runSummary = runResult?.summary;
  const plannedRunTotal = sortedNodes.length + (autoFillEnabled ? 1 : 0);
  const runTotal = runSummary?.total || plannedRunTotal || 1;
  const runDone = runSummary?.done ?? runSummary?.items?.length ?? 0;
  const runProgress = busy
    ? Math.max(4, Math.min(98, (runDone / Math.max(1, runTotal)) * 100))
    : runSummary && runSummary.status !== "running"
      ? 100
      : 0;
  const runElapsedSeconds = runSummary?.elapsedSeconds ?? 0;
  const runTimeStats = runSummary
    ? [
        `开始 ${flowRunTimeLabel(runSummary.startedAt || runSummary.runAt)}`,
        runSummary.updatedAt ? `更新 ${flowRunTimeLabel(runSummary.updatedAt)}` : "",
        runSummary.finishedAt ? `完成 ${flowRunTimeLabel(runSummary.finishedAt)}` : "",
        `耗时 ${formatDuration(runElapsedSeconds)}`,
      ].filter(Boolean)
    : [];
  const activePreset = presets.find((preset) => preset.id === activeId) ?? null;
  const currentAutoFillProgram = useMemo(() => {
    const targetDate = publishDate || localDateKey();
    return programHistory.find((program) => program.publishDate === targetDate && isAutoFillerProgram(program)) ?? null;
  }, [programHistory, publishDate]);
  const generatedAutoFillSongs = useMemo(() => songsFromProgram(currentAutoFillProgram), [currentAutoFillProgram]);
  const presetMeta = (preset: ProgramPreset) =>
    [
      FLOW_SCHEDULED_KIND_LABEL[preset.type === "custom" ? "custom" : preset.type],
      preset.type === "custom" ? (preset.contentMode === "direct" ? "原文直出" : "AI 生成") : "",
      preset.categoryId ? programCategories.find((category) => category.id === preset.categoryId)?.name : "",
      preset.playbackSpeed ? `${Number(preset.playbackSpeed).toFixed(2)}x` : "",
      preset.type === "kugou" && preset.songs?.length ? `${preset.songs.length} 首手选歌曲` : "",
    ].filter(Boolean).join(" · ");

  useEffect(() => {
    if (!activeId || autoFillTouched || autoFillSongs.length || !generatedAutoFillSongs.length) {
      return;
    }
    setAutoFillSongs(generatedAutoFillSongs);
    setAutoFillStatus(`已载入 ${generatedAutoFillSongs.length} 首已生成音乐连播歌曲`);
  }, [activeId, autoFillSongs.length, autoFillTouched, generatedAutoFillSongs]);

  return (
    <section className="admin-page flow-orchestration">
      <div className="admin-page-title admin-page-title--with-action">
        <div>
          <span>流程编排</span>
          <h1>一键生成全天 24 小时节目</h1>
          <p>{status}</p>
        </div>
        <div className="flow-toolbar">
          <select
            onChange={(event) => {
              const preset = presets.find((item) => item.id === event.target.value);
              if (preset) {
                selectPreset(preset);
              }
            }}
            value={activeId}
          >
            <option value="">— 选择已保存流程 —</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
                {preset.scheduledTime ? ` · 每日 ${preset.scheduledTime}` : ""}
                {preset.enabled ? "" : "（已停用）"}
              </option>
            ))}
          </select>
          <button onClick={startNewPreset} type="button">
            <Plus size={16} />
            <span>新建</span>
          </button>
          <button className="admin-primary-button" disabled={busy} onClick={savePreset} type="button">
            <Save size={16} />
            <span>保存流程</span>
          </button>
        </div>
      </div>

      <section className="admin-card flow-meta-card">
        <label>
          <span>流程名称</span>
          <input onChange={(event) => setPresetName(event.target.value)} value={presetName} placeholder="给这套播出方案起个名字" />
        </label>
        <label>
          <span>播出日期</span>
          <ProgramDateInput
            hasTodayPrograms={programHistory.some((program) => programTimelineDate(program) === localDateKey())}
            onChange={setPublishDate}
            value={publishDate}
          />
        </label>
        <label>
          <span>每日定时生成</span>
          <input onChange={(event) => setScheduledTime(event.target.value)} type="time" value={scheduledTime} />
          <small>{scheduledTime ? `每日 ${scheduledTime} 自动生成当天节目` : "留空则不自动生成"}</small>
        </label>
        <label className="flow-check">
          <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
          <span>启用此预设</span>
        </label>
        <label className="flow-check">
          <input checked={autoFillEnabled} onChange={(event) => setAutoFillEnabled(event.target.checked)} type="checkbox" />
          <span>空闲时段自动用音乐连播</span>
        </label>
      </section>

      <section className="admin-card flow-filler-summary">
        <div className="flow-section-head">
          <div>
            <h2>音乐连播</h2>
            <p>生成全天节目时自动准备歌单，也可以固定使用已保存的自定义歌单。</p>
          </div>
          <span>{autoFillEnabled ? (autoFillPlaylistId ? `${autoFillSongs.length} 首自定义` : "运行时自动生成") : "已关闭"}</span>
        </div>
        <div className="flow-filler-settings">
          <label>
            <span>歌单来源</span>
            <select
              onChange={(event) => {
                const playlist = savedPlaylists.find((item) => item.id === event.target.value);
                if (playlist) {
                  setAutoFillPlaylistId(playlist.id);
                  setAutoFillSongs(playlist.songs);
                  setAutoFillPlaybackMode(playlist.playbackMode);
                  setAutoFillStatus(`已选择自定义歌单「${playlist.name}」：${playlist.songs.length} 首`);
                } else {
                  setAutoFillPlaylistId("");
                  setAutoFillSongs([]);
                  setAutoFillStatus("将于每次生成全天节目时自动生成音乐连播歌单");
                }
                setAutoFillTouched(true);
              }}
              value={autoFillPlaylistId}
            >
              <option value="">运行流程时自动生成歌单</option>
              {savedPlaylists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name} · {playlist.songs.length} 首
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>播放方式</span>
            <select
              onChange={(event) => {
                setAutoFillPlaybackMode(event.target.value === "shuffle" ? "shuffle" : "sequential");
                setAutoFillTouched(true);
              }}
              value={autoFillPlaybackMode}
            >
              <option value="sequential">顺序播放</option>
              <option value="shuffle">按日期稳定随机</option>
            </select>
          </label>
        </div>
        <p className="flow-hint">{autoFillPlaylistId
          ? "流程会直接应用所选自定义歌单，不会被自动选歌覆盖。"
          : "无需先到音乐连播页面点击生成；本流程运行时会自动生成、解析并应用歌单。"}</p>
      </section>

      <section className="admin-card flow-program-presets">
        <div className="flow-section-head">
          <div>
            <h2>预设节目</h2>
            <p>这些是节目配置模板，可在定时节目节点中引用。</p>
          </div>
          <span>{programPresets.length} 个预设</span>
        </div>
        {programPresets.length ? (
          <div className="flow-program-preset-list">
            {programPresets.map((preset) => (
              <article key={preset.id} className="flow-program-preset">
                <span>
                  <strong>{preset.name}</strong>
                  <small>{presetMeta(preset) || "自定义节目配置"}</small>
                </span>
                <div>
                  <button onClick={() => onProgramPresetEdit(preset)} type="button">编辑</button>
                  <button className="is-danger" onClick={() => onProgramPresetDelete(preset.id)} type="button">删除</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="flow-hint">还没有预设节目。先到“节目制作”里设置节目参数，再点击“生成节目预设”。</p>
        )}
      </section>

      <div className="flow-board">
        <div className="flow-rail-label">00:00 —— 24:00 时间轴</div>
        {sortedNodes.length === 0 ? (
          <div className="flow-empty">
            <p>还没有节目节点。</p>
            <button className="flow-add-btn flow-add-btn--scheduled" onClick={() => addScheduledNode()} type="button">
              <Plus size={18} />
              <span>添加第一个定时节目</span>
            </button>
          </div>
        ) : (
          <ol className="flow-timeline">
            {sortedNodes.map((node, index) => (
              <li key={node.id} className={`flow-node flow-node--${node.type}`}>
                {node.type === "scheduled" ? (
                  <div className="flow-node-card">
                    <div className="flow-node-time">{node.startTime}</div>
                    <div className="flow-node-body">
                      <strong>{node.title || FLOW_SCHEDULED_KIND_LABEL[node.kind]}</strong>
                      <small>
                        {node.kind === "preset" && node.programTitle
                          ? `预设：${node.programTitle}`
                          : node.kind === "existing" && node.programTitle
                            ? `引用：${node.programTitle}`
                          : FLOW_SCHEDULED_KIND_LABEL[node.kind]}
                      </small>
                      {node.transitionBefore ? (
                        <em className="flow-tag flow-tag--transition">
                          {node.transitionBefore.effectName || "转场音效"} · 音量 {Math.round((node.transitionBefore.volume ?? 1) * 100)}%
                        </em>
                      ) : null}
                    </div>
                    <div className="flow-node-actions">
                      <button onClick={() => setEditingNodeId(node.id)} type="button">编辑</button>
                      <button onClick={() => toggleTransition(node.id, !node.transitionBefore)} type="button">
                        {node.transitionBefore ? "移除转场" : "加转场"}
                      </button>
                      <button onClick={() => removeNode(node.id)} type="button">删除</button>
                    </div>
                  </div>
                ) : (
                  <div className="flow-node-card flow-node-card--filler">
                    <div className="flow-node-time">空闲</div>
                    <div className="flow-node-body">
                      <strong>{node.title || FLOW_FILLER_KIND_LABEL[node.kind]}</strong>
                      <small>
                        {FLOW_FILLER_KIND_LABEL[node.kind]}
                        {node.endTime ? ` · 至 ${node.endTime}` : " · 空档备用"}
                      </small>
                      {node.transitionBefore ? (
                        <em className="flow-tag flow-tag--transition">
                          {node.transitionBefore.effectName || "转场音效"} · 音量 {Math.round((node.transitionBefore.volume ?? 1) * 100)}%
                        </em>
                      ) : null}
                    </div>
                    <div className="flow-node-actions">
                      <button onClick={() => setEditingNodeId(node.id)} type="button">编辑</button>
                      <button onClick={() => toggleTransition(node.id, !node.transitionBefore)} type="button">
                        {node.transitionBefore ? "移除转场" : "加转场"}
                      </button>
                      <button onClick={() => removeNode(node.id)} type="button">删除</button>
                    </div>
                  </div>
                )}

                {/* 节点之间的加号：定时节目之间可加转场或下一个节目。 */}
                <div className="flow-add-row">
                  <button className="flow-add-btn flow-add-btn--transition" onClick={() => toggleTransition(node.id, !node.transitionBefore)} title="为该节点添加转场音效" type="button">
                    <Plus size={14} />
                    <span>转场</span>
                  </button>
                  {index < scheduledNodes.length - 1 || node.type === "scheduled" ? (
                    <button className="flow-add-btn flow-add-btn--scheduled" onClick={() => addScheduledNode(node.id)} title="在该节目后添加定时节目" type="button">
                      <Plus size={14} />
                      <span>定时节目</span>
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {editingNode ? (
        <FlowNodeEditor
          node={editingNode}
          effects={effects}
          categories={programCategories}
          programs={programHistory}
          programPresets={programPresets}
          onChange={(patch) => updateNode(editingNode.id, patch)}
          onTransitionToggle={(on) => toggleTransition(editingNode.id, on)}
          onTransitionChange={(patch) => updateTransition(editingNode.id, patch)}
          onClose={() => setEditingNodeId(null)}
        />
      ) : null}

      <section className="admin-card flow-run-bar">
        <div className="flow-run-summary">
          <span>
            共 {scheduledNodes.length} 个定时节目 · 音乐连播{autoFillEnabled ? "已启用" : "已关闭"}
            {autoFillEnabled && autoFillSongs.length
              ? ` · ${autoFillSongs.length} 首 · ${autoFillPlaybackMode === "shuffle" ? "随机" : "顺序"}`
              : ""}
          </span>
          <span>播出日期：{publishDate || "未设置"}</span>
          {activePreset?.scheduledTime ? (
            <span className="flow-run-result">
              已设定每日 {activePreset.scheduledTime} 自动生成当天节目{activePreset.enabled ? "" : "（预设已停用）"}
            </span>
          ) : (
            <span>未设定自动生成</span>
          )}
          {activePreset?.lastRunAt ? (
            <span>最近运行：{new Date(activePreset.lastRunAt).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" })}</span>
          ) : null}
          {runResult?.summary ? (
            <span className="flow-run-result">
              {runResult.summary.status === "running"
                ? "本次：生成中"
                : `本次：成功 ${runResult.summary.ready} · 部分 ${runResult.summary.partial} · 跳过 ${runResult.summary.skipped} · 失败 ${runResult.summary.failed}`}
            </span>
          ) : null}
        </div>
        <button className="admin-primary-button" disabled={busy || !activeId || !nodes.length} onClick={previewRunPreset} type="button">
          {busy ? <Loader2 className="spin-icon" size={18} /> : <WandSparkles size={18} />}
          <span>{busy ? "生成中" : "立即生成全天节目"}</span>
        </button>
      </section>

      {busy || runProgress > 0 ? (
        <section className="admin-card flow-progress-card">
          <div className="flow-progress-head">
            <strong>{busy ? "正在生成全天节目" : "生成完成"}</strong>
            <span>{Math.round(runProgress)}%</span>
          </div>
          <div className="flow-progress-track">
            <i style={{ width: `${runProgress}%` }} />
          </div>
          <div className="flow-progress-detail">
            <strong>{runSummary?.currentStage || (runSummary ? "生成任务运行中" : "正在启动生成任务")}</strong>
            <span>{runSummary?.currentMessage || (runSummary ? `${runDone}/${runTotal} 个节点已处理` : "等待后台返回运行状态")}</span>
            {runSummary?.currentNode ? (
              <em>
                当前节点 {runSummary.currentNode.index ?? runDone + 1}/{runSummary.currentNode.total ?? runTotal}：
                {runSummary.currentNode.startTime ? `${runSummary.currentNode.startTime} · ` : ""}
                {runSummary.currentNode.title || runSummary.currentNode.kind || "未命名节点"}
              </em>
            ) : null}
          </div>
          {runSummary ? (
            <div className="flow-progress-stats">
              <span>{runDone}/{runTotal} 个节点已处理</span>
              <span>成功 {runSummary.ready}</span>
              <span>部分 {runSummary.partial}</span>
              <span>跳过 {runSummary.skipped}</span>
              <span>失败 {runSummary.failed}</span>
              {runTimeStats.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ) : (
            <small>正在启动生成任务...</small>
          )}
        </section>
      ) : null}

      {previewOpen ? (
        <FlowRunPreviewModal
          autoFillEnabled={autoFillEnabled}
          autoFillPlaylistId={autoFillPlaylistId}
          autoFillPlaybackMode={autoFillPlaybackMode}
          autoFillSongs={autoFillSongs}
          nodes={sortedNodes}
          publishDate={publishDate || localDateKey()}
          onClose={() => setPreviewOpen(false)}
          onConfirm={runPreset}
        />
      ) : null}

      {runResult?.summary?.items?.length ? (
        <section className="admin-card flow-result-card">
          <h2>{runResult.summary.status === "running" ? "已处理节点" : "生成结果明细"}</h2>
          <ul className="flow-result-list">
            {runResult.summary.items.map((item, index) => (
              <li key={`${item.title}-${index}`} className={`flow-result-item flow-result-item--${item.status}`}>
                <span className="flow-result-time">{item.startTime || "空闲"}</span>
                <span className="flow-result-title">{item.title}</span>
                <span className={`flow-result-status flow-result-status--${item.status}`}>
                  {item.status === "ready" ? "成功" : item.status === "partial" ? "部分" : item.status === "skipped" ? "跳过" : "失败"}
                </span>
                <span className="flow-result-message">{item.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function MusicCarouselManager({
  adminConfig,
  programHistory,
  onProgramsChanged,
}: {
  adminConfig: AdminConfig;
  programHistory: ProgramRecord[];
  onProgramsChanged?: () => void | Promise<void>;
}) {
  const [presets, setPresets] = useState<FlowPreset[]>([]);
  const [activeId, setActiveId] = useState("");
  const [publishDate, setPublishDate] = useState(localDateKey());
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);
  const [autoFillKeywords, setAutoFillKeywords] = useState("");
  const [autoFillProvider, setAutoFillProvider] = useState<MusicProvider>(adminConfig.plugins.kugouMusic.provider);
  const [autoFillPlaybackMode, setAutoFillPlaybackMode] = useState<MusicPlaybackMode>("sequential");
  const [autoFillRestartFromBeginning, setAutoFillRestartFromBeginning] = useState(false);
  const [autoFillPlaylistId, setAutoFillPlaylistId] = useState("");
  const [autoFillSongs, setAutoFillSongs] = useState<MusicCandidate[]>([]);
  const [sourceMode, setSourceMode] = useState<"automatic" | "custom">("automatic");
  const [savedPlaylists, setSavedPlaylists] = useState<SavedMusicPlaylist[]>([]);
  const [playlistName, setPlaylistName] = useState("我的音乐歌单");
  const [autoFillTouched, setAutoFillTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiGenerateBusy, setAiGenerateBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(defaultAiHotSongPrompt);
  const [aiSongCount, setAiSongCount] = useState(30);
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [manualSearchResults, setManualSearchResults] = useState<MusicCandidate[]>([]);
  const [manualSearchBusy, setManualSearchBusy] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [status, setStatus] = useState("正在加载音乐连播清单...");

  const activePreset = presets.find((preset) => preset.id === activeId) ?? null;
  const currentAutoFillProgram = useMemo(() => {
    const targetDate = publishDate || localDateKey();
    return [...programHistory]
      .filter((program) => program.publishDate === targetDate && isAutoFillerProgram(program))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0] ?? null;
  }, [programHistory, publishDate]);
  const generatedAutoFillSongs = useMemo(() => songsFromProgram(currentAutoFillProgram), [currentAutoFillProgram]);

  function selectPresetForCarousel(preset: FlowPreset) {
    setActiveId(preset.id);
    setPublishDate(preset.publishDate || localDateKey());
    setAutoFillEnabled(preset.autoFillEnabled !== false);
    setAutoFillKeywords(preset.autoFillKeywords ?? "");
    setAutoFillProvider(preset.autoFillProvider ?? adminConfig.plugins.kugouMusic.provider);
    setAutoFillPlaybackMode(preset.autoFillPlaybackMode === "shuffle" ? "shuffle" : "sequential");
    setAutoFillRestartFromBeginning(Boolean(preset.autoFillRestartFromBeginning));
    setAutoFillPlaylistId(preset.autoFillPlaylistId ?? "");
    setSourceMode(preset.autoFillPlaylistId ? "custom" : "automatic");
    setAutoFillSongs(preset.autoFillSongs ?? []);
    setManualSearchQuery("");
    setManualSearchResults([]);
    setListSearchQuery("");
    setAutoFillTouched(false);
    setStatus(
      preset.autoFillSongs?.length
        ? `已加载流程「${preset.name}」的 ${preset.autoFillSongs.length} 首音乐连播歌曲`
        : `已加载流程「${preset.name}」，可载入当天已生成清单或用 AI 生成歌曲`,
    );
  }

  const loadPresets = useCallback(async (preferredId?: string) => {
    try {
      const data = await apiJson<FlowPresetsResponse>("/api/flow-presets");
      setPresets(data.presets);
      const nextPreset = data.presets.find((preset) => preset.id === (preferredId || activeId)) ?? data.presets[0] ?? null;
      if (nextPreset) {
        selectPresetForCarousel(nextPreset);
      } else {
        setActiveId("");
        setAutoFillSongs([]);
        setStatus("还没有流程预设，请先到“运营概览”保存一套流程");
      }
    } catch (error) {
      setStatus(`加载音乐连播失败：${errorMessage(error)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const loadSavedPlaylists = useCallback(async () => {
    try {
      const data = await apiJson<MusicPlaylistsResponse>("/api/music-playlists");
      setSavedPlaylists(data.playlists);
    } catch (error) {
      setStatus(`加载自定义歌单失败：${errorMessage(error)}`);
    }
  }, []);

  useEffect(() => {
    void loadPresets();
    void loadSavedPlaylists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const playlist = savedPlaylists.find((item) => item.id === autoFillPlaylistId);
    if (playlist) {
      setPlaylistName(playlist.name);
    }
  }, [autoFillPlaylistId, savedPlaylists]);

  useEffect(() => {
    if (!generatedAutoFillSongs.length || autoFillTouched || sourceMode !== "automatic") {
      return;
    }
    setAutoFillSongs(generatedAutoFillSongs);
    setStatus(`已载入 ${publishDate || localDateKey()} 生成好的音乐连播清单：${generatedAutoFillSongs.length} 首`);
  }, [autoFillTouched, generatedAutoFillSongs, publishDate, sourceMode]);

  function selectSavedPlaylist(playlist: SavedMusicPlaylist) {
    setSourceMode("custom");
    setAutoFillPlaylistId(playlist.id);
    setPlaylistName(playlist.name);
    setAutoFillPlaybackMode(playlist.playbackMode);
    setAutoFillSongs(playlist.songs);
    setAutoFillTouched(true);
    setListSearchQuery("");
    setStatus(`已载入自定义歌单「${playlist.name}」：${playlist.songs.length} 首，${playlist.playbackMode === "shuffle" ? "随机播放" : "顺序播放"}`);
  }

  function startNewSavedPlaylist() {
    setSourceMode("custom");
    setAutoFillPlaylistId("");
    setPlaylistName("新建音乐歌单");
    setAutoFillTouched(true);
    setStatus("已进入新建歌单模式，当前歌曲不会丢失；修改名称后保存即可另存为新歌单");
  }

  async function persistSavedPlaylist() {
    const name = playlistName.trim();
    if (!name) {
      throw new Error("请填写歌单名称");
    }
    if (!autoFillSongs.length) {
      throw new Error("歌单中至少需要一首歌曲");
    }
    const data = await apiJson<MusicPlaylistResponse>("/api/music-playlists", {
      body: JSON.stringify({
        id: autoFillPlaylistId || undefined,
        name,
        playbackMode: autoFillPlaybackMode,
        songs: autoFillSongs,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setSavedPlaylists((current) => [data.playlist, ...current.filter((item) => item.id !== data.playlist.id)]);
    setAutoFillPlaylistId(data.playlist.id);
    setPlaylistName(data.playlist.name);
    setAutoFillPlaybackMode(data.playlist.playbackMode);
    setAutoFillSongs(data.playlist.songs);
    setAutoFillTouched(false);
    return data.playlist;
  }

  async function saveCustomPlaylist() {
    if (busy) {
      return;
    }
    setBusy(true);
    setStatus("正在保存自定义歌单...");
    try {
      const playlist = await persistSavedPlaylist();
      if (activePreset) {
        await persistCarouselPreset(
          `自定义歌单「${playlist.name}」和当前流程设置已保存`,
          playlist.id,
          playlist.playbackMode,
          playlist.songs,
        );
      } else {
        setStatus(`自定义歌单「${playlist.name}」已保存：${playlist.songs.length} 首`);
      }
    } catch (error) {
      setStatus(`保存自定义歌单失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCustomPlaylist() {
    if (!autoFillPlaylistId || busy) {
      return;
    }
    const playlist = savedPlaylists.find((item) => item.id === autoFillPlaylistId);
    if (!window.confirm(`确定删除歌单「${playlist?.name ?? playlistName}」吗？歌曲本身不会从第三方音乐平台删除。`)) {
      return;
    }
    setBusy(true);
    try {
      await apiJson(`/api/music-playlists/${autoFillPlaylistId}`, { method: "DELETE" });
      setSavedPlaylists((current) => current.filter((item) => item.id !== autoFillPlaylistId));
      setAutoFillPlaylistId("");
      setPlaylistName("新建音乐歌单");
      setAutoFillTouched(true);
      setStatus("自定义歌单已删除；当前编辑区歌曲仍保留，可另存为新歌单");
    } catch (error) {
      setStatus(`删除自定义歌单失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function generateAiHotSongs() {
    if (aiGenerateBusy) {
      return;
    }
    const requestedCount = Math.max(1, Math.min(100, Math.round(Number(aiSongCount) || 30)));
    const prompt = aiPrompt.trim() || defaultAiHotSongPrompt;

    setAiGenerateBusy(true);
    setStatus(`正在调用大模型生成 ${requestedCount} 首歌曲...`);
    try {
      writeAdminConfig(adminConfig);
      await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiJson<{ message?: string; songs: MusicCandidate[] }>("/api/plugins/kugou/ai-hot-songs", {
        body: JSON.stringify({ limit: requestedCount, prompt, provider: autoFillProvider, resolve: false }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setAutoFillSongs(result.songs ?? []);
      setAutoFillTouched(true);
      setStatus(result.message ?? `AI 已生成 ${result.songs?.length ?? 0} 首歌曲`);
    } catch (error) {
      setStatus(`AI 生成失败：${errorMessage(error)}`);
    } finally {
      setAiGenerateBusy(false);
    }
  }

  async function searchCarouselMusic() {
    const keywords = manualSearchQuery.trim();
    if (!keywords || manualSearchBusy) {
      setStatus(keywords ? status : "请输入要搜索的歌曲或歌手");
      return;
    }

    setManualSearchBusy(true);
    setStatus("正在搜索可加入音乐连播的歌曲...");
    try {
      writeAdminConfig(adminConfig);
      await apiJson<ConfigResponse>("/api/config", {
        body: JSON.stringify({ config: adminConfig }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiJson<{ message?: string; songs: MusicCandidate[] }>("/api/plugins/music/search", {
        body: JSON.stringify({ keywords, limit: 30, provider: autoFillProvider }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setManualSearchResults(result.songs ?? []);
      setStatus(result.message ?? `已找到 ${result.songs?.length ?? 0} 首候选歌曲`);
    } catch (error) {
      setStatus(`搜索失败：${errorMessage(error)}`);
    } finally {
      setManualSearchBusy(false);
    }
  }

  function addCarouselSong(song: MusicCandidate) {
    const key = songKey(song);
    setAutoFillSongs((current) => {
      const withoutDuplicate = current.filter((item) => songKey(item) !== key);
      return [song, ...withoutDuplicate];
    });
    setAutoFillTouched(true);
    setStatus(`已加入并置顶：${song.title}`);
  }

  function removeCarouselSong(index: number) {
    setAutoFillSongs((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setAutoFillTouched(true);
  }

  function clearCarouselSongs() {
    if (!autoFillSongs.length || !window.confirm(`确定移除当前播放顺序中的 ${autoFillSongs.length} 首歌曲吗？`)) {
      return;
    }
    setAutoFillSongs([]);
    setListSearchQuery("");
    setAutoFillTouched(true);
    setStatus("当前播放顺序已清空；保存流程或自定义歌单后生效");
  }

  function reorderCarouselSong(index: number, direction: -1 | 1) {
    setAutoFillSongs((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setAutoFillTouched(true);
  }

  function pinCarouselSong(index: number) {
    if (index <= 0) {
      return;
    }
    setAutoFillSongs((current) => {
      const next = [...current];
      const [song] = next.splice(index, 1);
      if (song) {
        next.unshift(song);
      }
      return next;
    });
    setAutoFillTouched(true);
  }

  async function persistCarouselPreset(
    message = "音乐连播设置已保存",
    playlistId = autoFillPlaylistId,
    playbackMode = autoFillPlaybackMode,
    songs = autoFillSongs,
  ) {
    if (!activePreset) {
      setStatus("请先选择一个流程预设");
      return null;
    }
    const data = await apiJson<FlowPresetResponse>("/api/flow-presets", {
      body: JSON.stringify({
        id: activePreset.id,
        autoFillEnabled,
        autoFillKeywords: "",
        autoFillProvider,
        autoFillRestartFromBeginning,
        autoFillPlaybackMode: playbackMode,
        autoFillPlaylistId: playlistId || null,
        autoFillSongs: songs,
        name: activePreset.name || "全天节目流程",
        nodes: sortFlowNodes(activePreset.nodes ?? []),
        publishDate: publishDate || localDateKey(),
        scheduledTime: activePreset.scheduledTime || null,
        enabled: activePreset.enabled !== false,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    setPresets((current) => {
      const others = current.filter((preset) => preset.id !== data.preset.id);
      return [data.preset, ...others];
    });
    setActiveId(data.preset.id);
    setAutoFillPlaybackMode(data.preset.autoFillPlaybackMode === "shuffle" ? "shuffle" : playbackMode);
    setAutoFillPlaylistId(data.preset.autoFillPlaylistId ?? playlistId);
    setAutoFillTouched(false);
    setStatus(`${message}：${songs.length} 首`);
    return data.preset;
  }

  async function saveCarouselSettings() {
    if (!activePreset || busy) {
      setStatus(activePreset ? status : "请先选择一个流程预设");
      return;
    }
    if (sourceMode === "custom" && !autoFillPlaylistId) {
      setStatus("当前是新建自定义歌单，请先保存歌单再保存流程设置");
      return;
    }
    setBusy(true);
    setStatus("正在保存音乐连播流程设置...");
    try {
      await persistCarouselPreset(
        sourceMode === "custom" ? "自定义歌单已绑定到流程" : "自动生成歌单已设为流程默认来源",
        sourceMode === "custom" ? autoFillPlaylistId : "",
        autoFillPlaybackMode,
        sourceMode === "custom" ? autoFillSongs : [],
      );
    } catch (error) {
      setStatus(`保存流程设置失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function applyCarouselSongs() {
    if (!activePreset) {
      setStatus("请先选择一个流程预设");
      return;
    }
    if (!autoFillEnabled) {
      setStatus("音乐连播已关闭，请先启用后再应用");
      return;
    }

    setBusy(true);
    setStatus(sourceMode === "custom" ? "正在保存自定义歌单并应用到直播..." : "正在生成自动歌单并应用到直播...");
    try {
      let playlistId = "";
      let playbackMode = autoFillPlaybackMode;
      let songs = sourceMode === "automatic" ? [] : autoFillSongs;
      let sourceLabel = "自动生成歌单";
      if (sourceMode === "custom") {
        const savedPlaylist = await persistSavedPlaylist();
        playlistId = savedPlaylist.id;
        playbackMode = savedPlaylist.playbackMode;
        songs = savedPlaylist.songs;
        sourceLabel = `自定义歌单「${savedPlaylist.name}」`;
      }
      const savedPreset = await persistCarouselPreset(
        `${sourceLabel}设置已保存，正在应用到直播`,
        playlistId,
        playbackMode,
        songs,
      );
      if (!savedPreset) {
        return;
      }
      const data = await apiJson<FlowAutoFillApplyResponse>(`/api/flow-presets/${savedPreset.id}/auto-fill/apply`, {
        body: JSON.stringify({
          autoFillEnabled,
          autoFillKeywords: "",
          autoFillProvider,
          autoFillRestartFromBeginning,
          autoFillPlaybackMode: playbackMode,
          autoFillPlaylistId: playlistId || null,
          autoFillSongs: songs,
          publishDate: publishDate || localDateKey(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const nextSongs = data.songs?.length ? data.songs : data.preset.autoFillSongs ?? autoFillSongs;
      setAutoFillSongs(nextSongs);
      setAutoFillPlaybackMode(data.preset.autoFillPlaybackMode === "shuffle" ? "shuffle" : "sequential");
      setAutoFillProvider(data.preset.autoFillProvider ?? autoFillProvider);
      setAutoFillRestartFromBeginning(Boolean(data.preset.autoFillRestartFromBeginning));
      setAutoFillPlaylistId(data.preset.autoFillPlaylistId ?? playlistId);
      setSourceMode(data.preset.autoFillPlaylistId ? "custom" : "automatic");
      setPresets((current) => {
        const others = current.filter((preset) => preset.id !== data.preset.id);
        return [data.preset, ...others];
      });
      setAutoFillTouched(false);
      setStatus(`${data.message}，当前清单 ${nextSongs.length} 首`);
      await onProgramsChanged?.();
    } catch (error) {
      setStatus(`应用失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const totalDurationSeconds = autoFillSongs.reduce((total, song) => total + Math.max(0, Math.round(song.duration || 0)), 0);
  const playableCount = autoFillSongs.filter((song) => song.audioUrl).length;
  const filteredAutoFillSongs = useMemo(() => {
    const keyword = listSearchQuery.trim().toLowerCase();
    return autoFillSongs
      .map((song, index) => ({ index, song }))
      .filter(({ song }) => {
        if (!keyword) {
          return true;
        }
        return [song.title, song.artist, song.hash].some((value) => String(value ?? "").toLowerCase().includes(keyword));
      });
  }, [autoFillSongs, listSearchQuery]);

  return (
    <section className="admin-page filler-page">
      <div className="admin-page-title admin-page-title--with-action">
        <div>
          <span>音乐连播</span>
          <h1>空闲时段播放清单</h1>
          <p>{status}</p>
        </div>
        <div className="flow-toolbar">
          <button disabled={busy || !activePreset} onClick={saveCarouselSettings} type="button">
            {busy ? <Loader2 className="spin-icon" size={16} /> : <Save size={16} />}
            <span>保存流程设置</span>
          </button>
          <button className="admin-primary-button" disabled={busy || !activePreset || !autoFillEnabled} onClick={applyCarouselSongs} type="button">
            {busy ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
            <span>{sourceMode === "automatic" ? "生成并立即应用" : "保存歌单并应用"}</span>
          </button>
        </div>
      </div>

      <div className="admin-metric-grid admin-metric-grid--compact">
        <AdminMetric label="清单歌曲" value={String(autoFillSongs.length)} />
        <AdminMetric label="可播放" value={String(playableCount)} />
        <AdminMetric label="预计时长" value={formatDuration(totalDurationSeconds)} />
        <AdminMetric label="播放模式" value={autoFillPlaybackMode === "shuffle" ? "随机" : "顺序"} />
        <AdminMetric label="已存歌单" value={String(savedPlaylists.length)} />
        <AdminMetric label="歌单来源" value={sourceMode === "custom" ? "自定义" : "自动生成"} />
      </div>

      <section className="admin-card filler-setup-card">
        <div className="flow-section-head">
          <div>
            <h2>运行设置</h2>
            <p>先绑定流程和日期，再明确选择自动生成或自定义歌单。</p>
          </div>
          <span>{autoFillEnabled ? "音乐连播已启用" : "音乐连播已关闭"}</span>
        </div>

        <div className="filler-workflow-grid">
          <label className="filler-step-field">
            <strong><i>1</i>绑定全天流程</strong>
            <select
              onChange={(event) => {
                const preset = presets.find((item) => item.id === event.target.value);
                if (preset) {
                  selectPresetForCarousel(preset);
                }
              }}
              value={activeId}
            >
              <option value="">— 选择流程预设 —</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}{preset.enabled ? "" : "（已停用）"}
                </option>
              ))}
            </select>
            <small>音乐连播会填充这套流程中没有定时节目的时段。</small>
          </label>
          <label className="filler-step-field">
            <strong><i>2</i>选择播出日期</strong>
            <ProgramDateInput
              hasTodayPrograms={programHistory.some((program) => programTimelineDate(program) === localDateKey())}
              onChange={setPublishDate}
              value={publishDate}
            />
            <small>立即应用时只更新这个日期的音乐连播节目。</small>
          </label>
          <label className="filler-step-field">
            <strong><i>3</i>选择音乐来源</strong>
            <select
              onChange={(event) => {
                setAutoFillProvider(event.target.value as MusicProvider);
                setManualSearchResults([]);
                setAutoFillTouched(true);
                setStatus(`音乐连播将按${musicProviderLabel(event.target.value)}生成和搜索歌曲`);
              }}
              value={autoFillProvider}
            >
              <option value="auto">智能混合（推荐）</option>
              <option value="kugou">仅酷狗音乐</option>
              <option value="netease">仅网易云音乐</option>
              <option value="qq">仅 QQ 音乐</option>
            </select>
            <small>自动生成、手动搜索和全天流程都会遵守这里保存的来源。</small>
          </label>
          <label className="filler-step-field">
            <strong><i>4</i>设置播放方式</strong>
            <select
              onChange={(event) => {
                setAutoFillPlaybackMode(event.target.value === "shuffle" ? "shuffle" : "sequential");
                setAutoFillTouched(true);
              }}
              value={autoFillPlaybackMode}
            >
              <option value="sequential">按清单顺序播放</option>
              <option value="shuffle">按日期稳定随机播放</option>
            </select>
            <small>随机顺序当天保持稳定，刷新页面不会重新打乱。</small>
          </label>
          {autoFillPlaybackMode === "sequential" ? (
            <label className="flow-check filler-enable-check filler-step-toggle">
              <input
                checked={autoFillRestartFromBeginning}
                onChange={(event) => {
                  setAutoFillRestartFromBeginning(event.target.checked);
                  setAutoFillTouched(true);
                }}
                type="checkbox"
              />
              <span>
                <strong>应用或推送时从第一首开始</strong>
                <small>保存歌单并应用，或在播出排期点击“立即推送”时，顺序歌单会重置到第一首。</small>
              </span>
            </label>
          ) : null}
          <label className="flow-check filler-enable-check filler-step-toggle">
            <input
              checked={autoFillEnabled}
              onChange={(event) => {
                setAutoFillEnabled(event.target.checked);
                setAutoFillTouched(true);
              }}
              type="checkbox"
            />
            <span><strong>启用空闲时段音乐连播</strong><small>关闭后流程只生成定时节目。</small></span>
          </label>
        </div>

        <div className="filler-source-options" aria-label="歌单来源">
          <button
            className={sourceMode === "automatic" ? "is-selected" : ""}
            onClick={() => {
              setSourceMode("automatic");
              setAutoFillPlaylistId("");
              setAutoFillSongs(generatedAutoFillSongs);
              setAutoFillTouched(true);
              setStatus("已选择自动生成：每次生成全天节目时会自动准备新的音乐连播歌单");
            }}
            type="button"
          >
            <WandSparkles size={21} />
            <span><strong>流程运行时自动生成</strong><small>无需提前生成歌单；每次全天流程运行时自动准备歌曲。</small></span>
          </button>
          <button
            className={sourceMode === "custom" ? "is-selected" : ""}
            onClick={() => {
              const firstPlaylist = savedPlaylists[0];
              if (firstPlaylist) {
                selectSavedPlaylist(firstPlaylist);
              } else {
                startNewSavedPlaylist();
              }
            }}
            type="button"
          >
            <ListMusic size={21} />
            <span><strong>使用保存的自定义歌单</strong><small>固定使用你维护的歌曲和顺序，不会被自动生成覆盖。</small></span>
          </button>
        </div>

        {sourceMode === "custom" ? (
          <div className="filler-custom-source">
            <label>
              <span>选择自定义歌单</span>
              <select
                onChange={(event) => {
                  const playlist = savedPlaylists.find((item) => item.id === event.target.value);
                  if (playlist) {
                    selectSavedPlaylist(playlist);
                  } else {
                    startNewSavedPlaylist();
                  }
                }}
                value={autoFillPlaylistId}
              >
                <option value="">— 新建自定义歌单 —</option>
                {savedPlaylists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name} · {playlist.songs.length} 首 · {playlist.playbackMode === "shuffle" ? "随机" : "顺序"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>歌单名称</span>
              <input
                onChange={(event) => {
                  setPlaylistName(event.target.value);
                  setAutoFillTouched(true);
                }}
                placeholder="例如：深夜华语精选"
                value={playlistName}
              />
            </label>
            <div className="filler-playlist-library-actions">
              <button disabled={busy || !autoFillSongs.length || !playlistName.trim()} onClick={saveCustomPlaylist} type="button">
                <Save size={16} /><span>保存此歌单</span>
              </button>
              <button onClick={startNewSavedPlaylist} type="button">
                <Plus size={16} /><span>新建歌单</span>
              </button>
              <button disabled={!autoFillPlaylistId || busy} className="is-danger" onClick={deleteCustomPlaylist} type="button">
                <Trash2 size={16} /><span>删除当前歌单</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="filler-auto-note">
            <WandSparkles size={19} />
            <span><strong>全自动模式 · {musicProviderLabel(autoFillProvider)}</strong><small>保存设置后，生成全天节目会严格按这里选择的音乐来源准备歌单；下方清单仅用于预览和手动微调。</small></span>
          </div>
        )}
      </section>

      <section className="admin-card filler-builder-card">
        <div className="flow-section-head">
          <div>
            <h2>歌单编辑器</h2>
            <p>AI 助手默认生成 30 首，并在应用时按“{musicProviderLabel(autoFillProvider)}”解析歌曲；也可以手动搜索、排序和删除。</p>
          </div>
          <span>{autoFillSongs.length} 首</span>
        </div>
        <div className="filler-control-actions">
          <label className="filler-ai-prompt">
            <span>AI 选歌要求</span>
            <textarea onChange={(event) => setAiPrompt(event.target.value)} rows={3} value={aiPrompt} />
          </label>
          <label className="filler-ai-count">
            <span>生成数量</span>
            <input
              max={100}
              min={1}
              onChange={(event) => {
                const value = Number(event.target.value);
                setAiSongCount(Number.isFinite(value) ? Math.max(1, Math.min(100, Math.round(value))) : 30);
              }}
              type="number"
              value={aiSongCount}
            />
          </label>
          <button className="admin-primary-button" disabled={aiGenerateBusy || busy} onClick={generateAiHotSongs} type="button">
            {aiGenerateBusy ? <Loader2 className="spin-icon" size={17} /> : <WandSparkles size={17} />}
            <span>{aiGenerateBusy ? "AI 生成中" : `AI 生成 ${aiSongCount} 首`}</span>
          </button>
          {generatedAutoFillSongs.length ? (
            <button
              className="filler-load-generated"
              onClick={() => {
                setAutoFillSongs(generatedAutoFillSongs);
                setAutoFillTouched(true);
                setStatus(`已载入直播生成清单：${generatedAutoFillSongs.length} 首`);
              }}
              type="button"
            >
              <ListMusic size={17} />
              <span>载入当天已播清单（{generatedAutoFillSongs.length} 首）</span>
            </button>
          ) : null}
        </div>
      </section>

      <div className="filler-manager-layout">
        <section className="admin-card filler-search-panel">
          <div className="flow-section-head">
            <div>
              <h2>手动添加</h2>
              <p>搜索后加入清单，新增歌曲会排在最前面。</p>
            </div>
          </div>
          <div className="manual-music-search filler-search-box">
            <input
              onChange={(event) => setManualSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchCarouselMusic();
                }
              }}
              placeholder="搜索歌曲 / 歌手"
              value={manualSearchQuery}
            />
            <button disabled={manualSearchBusy} onClick={searchCarouselMusic} type="button">
              {manualSearchBusy ? <Loader2 className="spin-icon" size={18} /> : <Search size={18} />}
              <span>{manualSearchBusy ? "搜索中" : "搜索"}</span>
            </button>
          </div>
          <div className="filler-search-results">
            {manualSearchResults.length ? (
              manualSearchResults.map((song) => (
                <button
                  key={songKey(song)}
                  onClick={() => addCarouselSong(song)}
                  type="button"
                >
                  {song.coverUrl ? <img alt="" src={song.coverUrl} /> : <span className="filler-song-cover"><ListMusic size={18} /></span>}
                  <span>
                    <b>{song.title}</b>
                    <small>{song.artist || "未知歌手"} · {musicProviderLabel(song.source)}{song.duration ? ` · ${formatDuration(song.duration)}` : ""}</small>
                  </span>
                  <ArrowUpToLine size={17} />
                </button>
              ))
            ) : (
              <p className="flow-hint">搜索歌曲或歌手后，可将结果直接加入并置顶到播放清单。</p>
            )}
          </div>
        </section>

        <section className="admin-card filler-playlist-panel">
          <div className="flow-section-head">
            <div>
              <h2>播放顺序</h2>
              <p>定时节目结束后会从被中断歌曲的下一首继续播放，不续播原歌曲。</p>
            </div>
            <span>{listSearchQuery.trim() ? `${filteredAutoFillSongs.length}/${autoFillSongs.length} 首` : `${autoFillSongs.length} 首`}</span>
          </div>
          <div className="filler-list-tools">
            <label className="filler-list-search">
              <Search size={16} />
              <input
                onChange={(event) => setListSearchQuery(event.target.value)}
                placeholder="在当前清单中搜索歌曲 / 歌手"
                value={listSearchQuery}
              />
            </label>
            <button className="is-danger filler-clear-list" disabled={!autoFillSongs.length} onClick={clearCarouselSongs} type="button">
              <Trash2 size={16} />
              <span>一键移除全部</span>
            </button>
          </div>
          <div className="filler-song-table" role="table" aria-label="音乐连播歌曲清单">
            <div className="filler-song-row filler-song-row--head" role="row">
              <span>#</span>
              <span>歌曲</span>
              <span>歌手</span>
              <span>时长</span>
              <span>操作</span>
            </div>
            <div className="filler-song-scroll">
              {filteredAutoFillSongs.length ? (
                filteredAutoFillSongs.map(({ song, index }) => (
                  <div className="filler-song-row" key={`${songKey(song)}-${index}`} role="row">
                    <span className="filler-song-number">{String(index + 1).padStart(3, "0")}</span>
                    <span className="filler-song-title">
                      <strong>{song.title}</strong>
                      <small>{musicProviderLabel(song.source)} · {song.audioUrl ? "可播放" : song.hash || song.sourceId ? "待应用解析" : "待搜索解析"}</small>
                    </span>
                    <span>{song.artist || "未知歌手"}</span>
                    <span>{song.duration ? formatDuration(song.duration) : "--:--"}</span>
                    <span className="filler-song-actions">
                      <button disabled={index === 0} onClick={() => pinCarouselSong(index)} title="置顶" type="button">
                        <ArrowUpToLine size={15} />
                      </button>
                      <button disabled={index === 0} onClick={() => reorderCarouselSong(index, -1)} title="上移" type="button">
                        <ArrowUp size={15} />
                      </button>
                      <button disabled={index === autoFillSongs.length - 1} onClick={() => reorderCarouselSong(index, 1)} title="下移" type="button">
                        <ArrowDown size={15} />
                      </button>
                      <button className="is-danger" onClick={() => removeCarouselSong(index)} title="删除" type="button">
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </div>
                ))
              ) : (
                <div className="program-empty program-empty--compact">
                  {autoFillSongs.length ? "当前搜索没有匹配歌曲。" : "当前没有歌曲。请使用 AI 生成歌曲，或手动搜索添加。"}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function FlowNodeEditor(props: {
  node: FlowNode;
  effects: SoundEffect[];
  categories: ProgramCategory[];
  programs: ProgramRecord[];
  programPresets: ProgramPreset[];
  onChange: (patch: FlowNodePatch) => void;
  onTransitionToggle: (on: boolean) => void;
  onTransitionChange: (patch: Partial<FlowTransitionNode>) => void;
  onClose: () => void;
}) {
  const { node, effects, categories, programs, programPresets, onChange, onTransitionToggle, onTransitionChange, onClose } = props;
  const isScheduled = node.type === "scheduled";

  return (
    <section className="admin-card flow-editor">
      <div className="flow-editor-head">
        <h2>编辑节点 · {isScheduled ? "定时节目" : "音乐连播"}</h2>
        <button onClick={onClose} type="button">
          <X size={16} />
          <span>收起</span>
        </button>
      </div>

      <label>
        <span>标题</span>
        <input onChange={(event) => onChange({ title: event.target.value })} value={node.title} />
      </label>

      {isScheduled ? (
        <>
          <label>
            <span>节目类型</span>
            <select
              onChange={(event) => {
                const kind = event.target.value as FlowScheduledKind;
                onChange({
                  kind,
                  programId: "",
                  programTitle: "",
                  title: FLOW_SCHEDULED_KIND_LABEL[kind],
                });
              }}
              value={node.kind}
            >
              <option value="preset">预设节目</option>
              <option value="existing">引用已有节目</option>
              <option value="custom">自定义节目</option>
              <option value="daily-briefing">每日早报</option>
              <option value="hot-topics">今日热榜</option>
              <option value="kugou">音乐联播</option>
            </select>
          </label>
          <label>
            <span>播出时间</span>
            <input onChange={(event) => onChange({ startTime: event.target.value })} type="time" value={node.startTime} />
          </label>
          {node.kind === "custom" ? (
            <>
              <label>
                <span>主播</span>
                <select onChange={(event) => onChange({ hostId: event.target.value })} value={node.hostId ?? hosts[0].id}>
                  {hosts.map((host) => (
                    <option key={host.id} value={host.id}>{host.name} · {host.voice}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>节目分类</span>
                <select onChange={(event) => onChange({ categoryId: event.target.value })} value={node.categoryId ?? ""}>
                  <option value="">默认分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>节目提示词（留空使用默认氛围）</span>
                <textarea onChange={(event) => onChange({ prompt: event.target.value })} rows={3} value={node.prompt ?? ""} />
              </label>
            </>
          ) : null}
          {node.kind === "preset" ? (
            <>
              <label>
                <span>选择预设节目</span>
                <select
                  onChange={(event) => {
                    const preset = programPresets.find((item) => item.id === event.target.value);
                    onChange({
                      programId: event.target.value,
                      programTitle: preset?.name ?? "",
                      title: preset?.title || preset?.name || node.title,
                    });
                  }}
                  value={node.programId ?? ""}
                >
                  <option value="">— 选择预设节目 —</option>
                  {programPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} · {FLOW_SCHEDULED_KIND_LABEL[preset.type === "custom" ? "custom" : preset.type]}
                    </option>
                  ))}
                </select>
              </label>
              {node.programId ? (
                <p className="flow-hint">运行流程时会读取该预设的节目配置，按播出日期重新生成节目内容。</p>
              ) : (
                <p className="flow-hint">请先在上方“预设节目”列表确认已有模板，或到“节目制作”保存一个节目预设。</p>
              )}
            </>
          ) : null}
          {node.kind === "existing" ? (
            <>
              <label>
                <span>选择已有节目（复用其配置，每次重新生成内容）</span>
                <select
                  onChange={(event) => {
                    const program = programs.find((item) => item.id === event.target.value);
                    onChange({
                      programId: event.target.value,
                      programTitle: program?.title ?? "",
                      title: program?.title ?? node.title,
                    });
                  }}
                  value={node.programId ?? ""}
                >
                  <option value="">— 选择节目 —</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.title} · {program.host}{program.status === "ready" ? "" : "（未配音）"}
                    </option>
                  ))}
                </select>
              </label>
              {node.programId ? (
                <p className="flow-hint">
                  将复用该节目的提示词、主播、分类和播放速度，到点重新生成当天的新内容（保证内容不重复）。
                </p>
              ) : (
                <p className="flow-hint">请先在「节目制作」里创建好节目，再回到这里选择。</p>
              )}
            </>
          ) : null}
        </>
      ) : (
        <>
          <label>
            <span>填充类型</span>
            <select onChange={(event) => onChange({ kind: event.target.value as FlowFillerKind })} value={node.kind}>
              <option value="kugou-random">音乐联播</option>
              <option value="custom-audio">自定义音频链接</option>
              <option value="silence">静音留白</option>
            </select>
          </label>
          <label>
            <span>结束时间（留空则作为定时节目空档备用）</span>
            <input onChange={(event) => onChange({ endTime: event.target.value })} type="time" value={node.endTime ?? ""} />
          </label>
          {node.kind === "custom-audio" ? (
            <label>
              <span>音频播放链接</span>
              <input onChange={(event) => onChange({ audioUrl: event.target.value })} value={node.audioUrl ?? ""} placeholder="https://.../audio.mp3" />
            </label>
          ) : null}
          {node.kind === "kugou-random" ? (
            <label>
              <span>搜索关键词（留空使用插件默认）</span>
              <input onChange={(event) => onChange({ keywords: event.target.value })} value={node.keywords ?? ""} placeholder="例如：华语流行 / 治愈钢琴" />
            </label>
          ) : null}
        </>
      )}

      <div className="flow-editor-transition">
        <label className="flow-check">
          <input checked={Boolean(node.transitionBefore)} onChange={(event) => onTransitionToggle(event.target.checked)} type="checkbox" />
          <span>节目播放前插入转场音效</span>
        </label>
        {node.transitionBefore ? (
          <>
            <label>
              <span>转场音效</span>
              <select
                onChange={(event) => {
                  const effect = effects.find((item) => item.id === event.target.value);
                  onTransitionChange({ effectId: event.target.value, effectName: effect?.name ?? "" });
                }}
                value={node.transitionBefore.effectId}
              >
                <option value="">— 选择音效 —</option>
                {effects.map((effect) => (
                  <option key={effect.id} value={effect.id}>{effect.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>转场音量</span>
              <input
                max="1"
                min="0"
                onChange={(event) => onTransitionChange({ volume: Number(event.target.value) })}
                step="0.05"
                type="range"
                value={node.transitionBefore.volume}
              />
              <small>{Math.round(node.transitionBefore.volume * 100)}%</small>
            </label>
          </>
        ) : null}
      </div>

      {node.transitionBefore?.effectId
        ? (() => {
            const effect = effects.find((item) => item.id === node.transitionBefore!.effectId);
            return effect ? <audio controls src={effect.audioUrl} /> : null;
          })()
        : null}
    </section>
  );
}

function AdminLoginPage({
  onLogin,
  status,
}: {
  onLogin: (username: string, password: string) => void | Promise<void>;
  status: string;
}) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");

  return (
    <main className="admin-login-screen">
      <section className="admin-login-panel">
        <div className="admin-login-brand">
          <img alt="" src={generatedAssets.icons.waveLogo} />
          <span>
            <strong>星声电台后台</strong>
            <small>节目生产、编排、接口与采集管理</small>
          </span>
        </div>
        <div className="admin-login-form">
          <label>
            <span>管理员账号</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            <span>密码</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void onLogin(username, password);
                }
              }}
            />
          </label>
          <button onClick={() => onLogin(username, password)} type="button">
            <LogIn size={19} />
            <span>登录后台</span>
          </button>
          <p>{status}</p>
        </div>
      </section>
    </main>
  );
}

function FlowRunPreviewModal({
  autoFillEnabled,
  autoFillPlaylistId,
  autoFillPlaybackMode,
  autoFillSongs,
  nodes,
  onClose,
  onConfirm,
  publishDate,
}: {
  autoFillEnabled: boolean;
  autoFillPlaylistId: string;
  autoFillPlaybackMode: MusicPlaybackMode;
  autoFillSongs: MusicCandidate[];
  nodes: FlowNode[];
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  publishDate: string;
}) {
  return (
    <div className="flow-preview-backdrop" role="dialog" aria-modal="true" aria-label="预览全天节目编排">
      <section className="flow-preview-modal">
        <div className="flow-preview-head">
          <span>即将生成的播出日期</span>
          <strong>{publishDate}</strong>
          <p>请确认以下节目编排。点击确定后才会开始生成，并显示进度条。</p>
        </div>
        <div className="flow-preview-list">
          {nodes.map((node, index) => (
            <article key={node.id} className={`flow-preview-row flow-preview-row--${node.type}`}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <span>{node.type === "scheduled" ? node.startTime : "空闲"}</span>
              <div>
                <strong>{node.title || (node.type === "scheduled" ? FLOW_SCHEDULED_KIND_LABEL[node.kind] : FLOW_FILLER_KIND_LABEL[node.kind])}</strong>
                <small>
                  {node.type === "scheduled"
                    ? FLOW_SCHEDULED_KIND_LABEL[node.kind]
                    : `${FLOW_FILLER_KIND_LABEL[node.kind]}${node.endTime ? ` · 至 ${node.endTime}` : ""}`}
                  {node.transitionBefore ? " · 含转场" : ""}
                </small>
              </div>
            </article>
          ))}
          {autoFillEnabled ? (
            <article className="flow-preview-row flow-preview-row--filler">
              <b>{String(nodes.length + 1).padStart(2, "0")}</b>
              <span>空闲</span>
              <div>
                <strong>音乐连播</strong>
                <small>
                  {autoFillPlaylistId
                    ? `${autoFillSongs.length} 首自定义歌曲，${autoFillPlaybackMode === "shuffle" ? "随机播放" : "顺序播放"}`
                    : "运行流程时会自动生成并应用歌曲清单"}
                </small>
              </div>
            </article>
          ) : null}
        </div>
        <div className="flow-preview-actions">
          <button onClick={onClose} type="button">取消</button>
          <button className="admin-primary-button" onClick={onConfirm} type="button">
            <WandSparkles size={18} />
            <span>确定生成</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function AdminShell(props: AdminShellProps) {
  const {
    adminConfig,
    adminNotice,
    adminSection,
    adminUser,
    backendStatus,
    configSavedAt,
    configTestStatus,
    generatedProgram,
    onLogout,
    onProgramsChanged,
    onSectionChange,
    programCategories,
    programHistory,
    programStatus,
    soundEffectCategories,
    systemSettings,
  } = props;
  const readyCount = programHistory.filter((program) => program.status === "ready").length;
  const tomorrowPublished = programHistory.filter((program) => program.publishDate).length;
  const serviceHealth = (service: "llm" | "tts" | "suno") => {
    const config = adminConfig[service];
    const status = configTestStatus[service];
    const missingApiKey = service === "suno"
      ? !String(adminConfig.suno.cookie ?? "").trim()
      : service === "tts" && ttsApiKeyOptional(adminConfig.tts)
        ? false
        : !String((config as LlmConfig | TtsConfig).apiKey ?? "").trim();
    const missingEndpoint = !String(config.baseUrl ?? "").trim();
    const missingConfig =
      missingEndpoint ||
      missingApiKey ||
      !String(config.model ?? "").trim() ||
      !config.enabled;
    return missingConfig || /失败|缺少|异常|停用/u.test(status) ? "bad" : "good";
  };
  const menuGroups: Array<{
    label: string;
    items: Array<{ icon: React.ReactNode; id: AdminSection; label: string }>;
  }> = [
    {
      label: "工作台",
      items: [
        { icon: <Database size={19} />, id: "dashboard", label: "运营概览" },
        { icon: <Radio size={19} />, id: "flow", label: "全天流程" },
      ],
    },
    {
      label: "节目运营",
      items: [
        { icon: <WandSparkles size={19} />, id: "studio", label: "节目制作" },
        { icon: <CalendarDays size={19} />, id: "timeline", label: "播出排期" },
        { icon: <ListMusic size={19} />, id: "filler", label: "音乐连播" },
      ],
    },
    {
      label: "内容资源",
      items: [
        { icon: <Disc3 size={19} />, id: "music", label: "点播节目" },
        { icon: <Archive size={19} />, id: "archive", label: "节目归档" },
        { icon: <FileAudio size={19} />, id: "effects", label: "音效素材" },
        { icon: <HardDrive size={19} />, id: "storage", label: "附件存储" },
      ],
    },
    {
      label: "系统配置",
      items: [
        { icon: <BrainCircuit size={19} />, id: "settings", label: "模型配置" },
        { icon: <ServerCog size={19} />, id: "plugins", label: "接口 API" },
        { icon: <ShieldCheck size={19} />, id: "system", label: "站点设置" },
      ],
    },
  ];
  const currentMenu = menuGroups.flatMap((group) => group.items).find((item) => item.id === adminSection);
  const [showGuide, setShowGuide] = useState(() => window.localStorage.getItem(ADMIN_GUIDE_DISMISSED_KEY) !== "1");
  const [guideDismissed, setGuideDismissed] = useState(false);
  const closeGuide = () => {
    if (guideDismissed) {
      window.localStorage.setItem(ADMIN_GUIDE_DISMISSED_KEY, "1");
    } else {
      window.localStorage.removeItem(ADMIN_GUIDE_DISMISSED_KEY);
    }
    setShowGuide(false);
  };
  const openGuide = () => {
    setGuideDismissed(window.localStorage.getItem(ADMIN_GUIDE_DISMISSED_KEY) === "1");
    setShowGuide(true);
  };
  const jumpFromGuide = (section: AdminSection) => {
    if (guideDismissed) {
      window.localStorage.setItem(ADMIN_GUIDE_DISMISSED_KEY, "1");
    } else {
      window.localStorage.removeItem(ADMIN_GUIDE_DISMISSED_KEY);
    }
    setShowGuide(false);
    onSectionChange(section);
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button className="admin-sidebar-brand" onClick={() => (window.location.href = "/")} type="button">
          <img alt="" src={systemSettings.logoUrl || generatedAssets.icons.waveLogo} />
          <span>
            <strong>{systemSettings.appName || "星声后台"}</strong>
            <small>{systemSettings.footerText || "AI Radio Admin"}</small>
          </span>
        </button>
        <nav className="admin-menu" aria-label="后台管理菜单">
          {menuGroups.map((group) => (
            <div className="admin-menu-group" key={group.label}>
              <small>{group.label}</small>
              {group.items.map((item) => (
                <button
                  className={adminSection === item.id ? "is-active" : ""}
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  type="button"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button onClick={onLogout} type="button">
            <LogOut size={18} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-main-header">
          <div>
            <strong>{currentMenu?.label ?? "后台管理中心"}</strong>
            <small>后台管理中心 · {backendStatus}</small>
          </div>
          <div className="admin-header-actions">
            <span>{adminUser || "管理员"}</span>
            <button onClick={openGuide} type="button">
              <CircleHelp size={17} />
              操作指引
            </button>
            <button onClick={() => (window.location.href = "/")} type="button">
              前台预览
            </button>
          </div>
        </header>

        {adminNotice ? <div className={`admin-notice admin-notice--${adminNotice.tone}`}>{adminNotice.message}</div> : null}

        {adminSection === "dashboard" ? (
          <section className="admin-page">
            <div className="admin-page-title">
              <span>运营概览</span>
              <h1>今天的节目生产状态</h1>
              <p>{programStatus}</p>
            </div>
            <div className="admin-metric-grid">
              <AdminMetric label="节目总数" value={String(programHistory.length)} />
              <AdminMetric label="可播节目" value={String(readyCount)} />
              <AdminMetric label="节目分类" value={String(programCategories.length)} />
              <AdminMetric label="已发布编排" value={String(tomorrowPublished)} />
            </div>
            <div className="admin-dashboard-grid">
              <section className="admin-card">
                <h2>服务状态</h2>
                <div className="admin-health-list">
                  <span>
                    <i className={`status-dot status-dot--${serviceHealth("llm")}`} />
                    大模型：{adminConfig.llm.model || "未配置"}
                  </span>
                  <span>
                    <i className={`status-dot status-dot--${serviceHealth("tts")}`} />
                    通用语音：{adminConfig.tts.model || "未配置"}
                  </span>
                  <span>
                    <i className={`status-dot status-dot--${serviceHealth("suno")}`} />
                    SUNO：{adminConfig.suno.model || "未配置"}
                  </span>
                </div>
              </section>
              <section className="admin-card">
                <h2>当前编辑节目</h2>
                {generatedProgram ? (
                  <div className="admin-current-program">
                    <strong>{generatedProgram.title}</strong>
                    <small>{generatedProgram.host} · {generatedProgram.status === "ready" ? "语音已生成" : generatedProgram.status === "generating" ? "后台生成中" : generatedProgram.status === "failed" ? "生成失败" : "仅文案"}</small>
                    {generatedProgram.audioUrl ? <audio controls src={generatedProgram.audioUrl} /> : null}
                  </div>
                ) : (
                  <p>还没有选中的节目。</p>
                )}
              </section>
            </div>
            <section className="admin-card admin-quick-actions">
              <h2>常用操作</h2>
              <div>
                <button onClick={() => onSectionChange("studio")} type="button"><WandSparkles size={18} /><span>制作节目</span></button>
                <button onClick={() => onSectionChange("flow")} type="button"><Radio size={18} /><span>编排全天流程</span></button>
                <button onClick={() => onSectionChange("filler")} type="button"><ListMusic size={18} /><span>维护音乐歌单</span></button>
                <button onClick={() => onSectionChange("plugins")} type="button"><ServerCog size={18} /><span>检查接口 API</span></button>
              </div>
            </section>
          </section>
        ) : null}

        {adminSection === "flow" ? (
          <FlowOrchestrator
            adminConfig={adminConfig}
            programCategories={programCategories}
            programHistory={programHistory}
            programPresets={props.programPresets}
            soundEffectCategories={soundEffectCategories}
            onProgramPresetDelete={props.onProgramPresetDelete}
            onProgramPresetEdit={props.onProgramPresetEdit}
            onProgramsChanged={onProgramsChanged}
          />
        ) : null}

        {adminSection === "studio" ? <AdminStudioPage {...props} /> : null}
        {adminSection === "timeline" ? <AdminTimelinePage {...props} /> : null}
        {adminSection === "filler" ? (
          <MusicCarouselManager
            adminConfig={adminConfig}
            programHistory={programHistory}
            onProgramsChanged={onProgramsChanged}
          />
        ) : null}
        {adminSection === "archive" ? <AdminArchivePage {...props} /> : null}
        {adminSection === "music" ? <AdminMusicPage {...props} /> : null}
        {adminSection === "effects" ? <AdminEffectsPage {...props} /> : null}
        {adminSection === "storage" ? <StorageManager /> : null}
        {adminSection === "system" ? <SystemSettingsPage settings={systemSettings} onSave={props.onSystemSettingsSave} /> : null}
        {adminSection === "settings" ? (
          <AdminConfigPage
            config={adminConfig}
            savedAt={configSavedAt}
            status={configTestStatus}
            onChange={props.onAdminConfigChange}
            onSave={props.onAdminConfigSave}
            onTest={props.onTestService}
          />
        ) : null}
        {adminSection === "plugins" ? <AdminPluginPage {...props} /> : null}
      </main>
      {showGuide ? (
        <AdminGuideModal
          dismissed={guideDismissed}
          onDismissedChange={setGuideDismissed}
          onClose={closeGuide}
          onJump={jumpFromGuide}
        />
      ) : null}
    </div>
  );
}

function AdminGuideModal({
  dismissed,
  onClose,
  onDismissedChange,
  onJump,
}: {
  dismissed: boolean;
  onClose: () => void;
  onDismissedChange: (value: boolean) => void;
  onJump: (section: AdminSection) => void;
}) {
  const steps: Array<{
    actionLabel: string;
    description: string;
    id: string;
    section: AdminSection;
    title: string;
    tips: string[];
  }> = [
    {
      actionLabel: "配置模型",
      description: "先在“模型配置”完成大模型、通用语音和 Suno 三组配置，再到“接口 API”维护早报、热榜和三种音乐 API 连接。",
      id: "config",
      section: "settings",
      title: "1. 完成模型与接口配置",
      tips: [
        "模型配置分三个标签页：大模型生成节目脚本与歌单、通用语音负责配音、Suno 负责 AI 原创音乐。",
        "通用语音用于把节目文案转换为音频；本机语音仅适合作为临时兜底。",
        "Suno 需要填写账号 Cookie，并在“接口 API → 本地 suno-api”配置 2Captcha API Key 以通过 hCaptcha。",
        "每日早报、今日热榜和酷狗、网易云、QQ 音乐的连接凭据统一放在“接口 API”，节目业务参数在节目制作维护。",
      ],
    },
    {
      actionLabel: "进入节目制作",
      description: "在节目制作页先生成单条节目，确认脚本、主播、音色、背景音和语速都符合预期。",
      id: "studio",
      section: "studio",
      title: "2. 制作并校验单条节目",
      tips: [
        "选择节目类型：自定义节目、每日早报、今日热榜、音乐连播、Suno AI 音乐或点播节目。",
        "点播节目支持直链音频、视频音轨、HLS 地址和 yt-dlp 可解析的播放页面，长内容可保存后后台转码。",
        "填写节目标题、播出时间、主题提示词，选择一个或多个 AI 主播。",
        "生成后先试听音频；必要时修改文案，再点“重新生成语音”，正常后再保存为节目预设。",
      ],
    },
    {
      actionLabel: "查看音乐连播",
      description: "保存一份命名歌单并选择顺序或随机模式，再把它应用到空闲时段连播。",
      id: "filler",
      section: "filler",
      title: "3. 准备音乐连播",
      tips: [
        "流程里的空闲时段会由“音乐连播”补齐，不必把每个小时都做成口播节目。",
        "自定义歌单会严格使用保存内容；顺序模式按表格次序播放，随机模式按播出日期稳定洗牌。",
        "如果某首歌无播放链接，可在音乐连播或节目列表中替换、删除或重新搜索。",
      ],
    },
    {
      actionLabel: "开始流程编排",
      description: "在独立的“全天流程”页面，把早报、热榜、自定义节目和音乐连播组成一天的播出结构。",
      id: "flow",
      section: "flow",
      title: "4. 编排全天流程",
      tips: [
        "新建流程预设，设置名称、目标日期和每天自动生成时间，例如 03:00。",
        "添加定时节点：早报通常放在清晨，热榜可放在午间或傍晚，自定义节目用于固定栏目。",
        "启用自动补齐音乐连播，让未安排口播的时间段自动播放歌曲。",
        "保存后点“预览全天节目”，确认节点顺序、空档和生成数量。",
      ],
    },
    {
      actionLabel: "进入播出排期",
      description: "生成完成后，到播出排期页面检查当天节目队列，调整时间、顺序、分类并发布。",
      id: "timeline",
      section: "timeline",
      title: "5. 检查、发布与归档",
      tips: [
        "选择当天日期，确认节目都已生成，状态为可播，音频能正常试听。",
        "手动保存时间线后，点击发布，让前台按当天节目队列播放。",
        "发布后可到前台预览，检查当前直播、节目预告、今日已播和字幕显示。",
        "必要时同步节目归档，方便后续按日期回看或清理。",
      ],
    },
    {
      actionLabel: "查看附件",
      description: "生成失败时优先看运行进度和失败节点，再检查接口、音频附件和存储空间。",
      id: "troubleshoot",
      section: "storage",
      title: "6. 失败排查顺序",
      tips: [
        "流程卡住时先看进度卡片：当前节点、已处理数量、耗时和失败提示。",
        "0/4 长时间不动通常是接口未配置、后台任务异常或前一个运行状态未正确结束。",
        "TTS 失败先检查语音接口配置；音乐失败先检查所选平台 Cookie、版权状态和歌曲播放链接。",
        "生成音频很多时，到附件管理清理未引用文件，避免磁盘占满。",
      ],
    },
  ];

  return (
    <div className="admin-guide-backdrop" role="presentation">
      <section aria-modal="true" className="admin-guide-modal" role="dialog" aria-labelledby="admin-guide-title">
        <header className="admin-guide-head">
          <span>后台操作指引</span>
          <h2 id="admin-guide-title">从节目制作到全天流程编排</h2>
          <p>按下面顺序操作：先完成模型与接口配置，再跑通单条节目，保存预设并编排全天流程，最后检查时间线和前台播放。</p>
        </header>

        <div className="admin-guide-flow">
          {steps.map((step) => (
            <article className="admin-guide-step" key={step.id}>
              <div>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
                <ul>
                  {step.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
              <button onClick={() => onJump(step.section)} type="button">
                {step.actionLabel}
              </button>
            </article>
          ))}
        </div>

        <div className="admin-guide-checklist">
          <strong>上线前快速检查</strong>
          <span>接口测试通过</span>
          <span>单条节目可试听</span>
          <span>流程预览无空档异常</span>
          <span>定时任务已启用</span>
          <span>前台预览能播放</span>
        </div>

        <footer className="admin-guide-actions">
          <label>
            <input checked={dismissed} onChange={(event) => onDismissedChange(event.target.checked)} type="checkbox" />
            <span>不再自动提示</span>
          </label>
          <button onClick={onClose} type="button">关闭</button>
        </footer>
      </section>
    </div>
  );
}

function AdminMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ProgramDateInput({
  hasTodayPrograms,
  onChange,
  value,
}: {
  hasTodayPrograms: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const today = localDateKey();
  return (
    <span className={`program-date-input ${hasTodayPrograms ? "has-today-programs" : ""} ${value === today && hasTodayPrograms ? "is-today" : ""}`}>
      <input onChange={(event) => onChange(event.target.value)} type="date" value={value} />
      {hasTodayPrograms ? <em><i />今日有节目</em> : null}
    </span>
  );
}

function StudioApiReference({
  description,
  enabled,
  name,
  onOpen,
}: {
  description: string;
  enabled: boolean;
  name: string;
  onOpen: () => void;
}) {
  return (
    <div className="studio-api-reference">
      <span className={`status-dot status-dot--${enabled ? "good" : "bad"}`} />
      <div>
        <strong>{name}</strong>
        <p>{description}</p>
      </div>
      <button onClick={onOpen} type="button">前往接口 API</button>
    </div>
  );
}

function AdminStudioPage({
  adminConfig,
  customContentMode,
  dailyBriefingBusy,
  generatedProgram,
  hotTopicsBusy,
  kugouApiBusy,
  kugouApiName,
  kugouApiParams,
  kugouApiResult,
  kugouLoginBusy,
  kugouProgramBusy,
  kugouQr,
  kugouStatus,
  manualMusicQuery,
  manualMusicResults,
  manualMusicSearchBusy,
  manualMusicSelected,
  manualMusicStatus,
  mediaProgramBusy,
  onAdminConfigChange,
  onAdminConfigSave,
  onDeleteProgram,
  onGenerateProgram,
  onGenerateProgramPreset,
  onKugouApiCall,
  onKugouApiNameChange,
  onKugouApiParamsChange,
  onKugouGenerate,
  onKugouQrCreate,
  onKugouStatusRefresh,
  onManualMusicAdd,
  onManualMusicQueryChange,
  onManualMusicRemove,
  onManualMusicReorder,
  onManualMusicSearch,
  onMediaGenerate,
  onMediaProbe,
  onSunoGenerate,
  onSunoPlan,
  onSunoSelect,
  onProgramDraftChange,
  onProgramCategoryChange,
  onCustomContentModeChange,
  onProgramHostToggle,
  onProgramPlaybackSpeedChange,
  onProgramPromptChange,
  onProgramRegenerateTts,
  onProgramPushHome,
  onProgramRewriteScript,
  onProgramSaveDraft,
  onProgramTitleChange,
  onProgramTypeChange,
  onSectionChange,
  onTimelineDateChange,
  programAudioRef,
  programBusy,
  programCategoryId,
  programCategories,
  programDraft,
  programHostIds,
  programHistory,
  programPlaybackSpeed,
  programPresetBusy,
  programPushBusyId,
  programPrompt,
  programRewriteBusy,
  programStatus,
  programTitle,
  programTtsBusy,
  programType,
  publishBusy,
  selectedTimelineDate,
  soundEffectCategories,
  sunoMusicBusy,
  sunoCandidates,
}: AdminShellProps) {
  const [voicePrompt, setVoicePrompt] = useState(adminConfig.tts.defaultStylePrompt);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaSiteCookie, setMediaSiteCookie] = useState("");
  const [mediaTitle, setMediaTitle] = useState("");
  const [mediaCreator, setMediaCreator] = useState("");
  const [mediaIntroMode, setMediaIntroMode] = useState<MediaIntroMode>("ai");
  const [mediaIntroPrompt, setMediaIntroPrompt] = useState("自然介绍内容来源、主题和推荐理由，并顺畅引出接下来的节目内容。");
  const [mediaIntroText, setMediaIntroText] = useState("");
  const [mediaLocalCopy, setMediaLocalCopy] = useState(true);
  const [mediaDurationMinutes, setMediaDurationMinutes] = useState(30);
  const [mediaProbe, setMediaProbe] = useState<MediaProbeResult | null>(null);
  const mediaProgramInput = (): MediaProgramInput => ({
    creator: mediaCreator,
    durationMinutes: mediaDurationMinutes,
    introMode: mediaIntroMode,
    introPrompt: mediaIntroPrompt,
    introText: mediaIntroText,
    localCopy: mediaLocalCopy,
    mediaUrl,
    siteCookie: mediaSiteCookie,
    title: mediaTitle || programTitle,
  });
  const [aiMusicMode, setAiMusicMode] = useState<AiMusicMode>("auto");
  const [aiMusicBrief, setAiMusicBrief] = useState(adminConfig.suno.defaultPrompt);
  const [aiMusicLyrics, setAiMusicLyrics] = useState("");
  const [aiMusicStyle, setAiMusicStyle] = useState(adminConfig.suno.style);
  const [aiMusicQuantity, setAiMusicQuantity] = useState(1);
  const [aiMusicVoiceGender, setAiMusicVoiceGender] = useState<AiMusicPlan["voiceGender"]>("random");
  const aiMusicInput = (): AiMusicInput => ({
    brief: aiMusicBrief,
    instrumental: false,
    lyrics: aiMusicLyrics,
    mode: aiMusicMode,
    negativeTags: "",
    quantity: aiMusicQuantity,
    style: aiMusicStyle,
    title: programTitle,
    voiceGender: aiMusicVoiceGender,
  });
  const applyAiMusicPlan = (plan: AiMusicPlan | null) => {
    if (!plan) {
      return;
    }
    onProgramTitleChange(plan.title);
    setAiMusicLyrics(plan.lyrics);
    setAiMusicStyle(plan.style);
    setAiMusicVoiceGender(plan.voiceGender);
  };
  useEffect(() => {
    const segmentStyles = (generatedProgram?.segments ?? [])
      .map((segment) => String(segment.style ?? "").trim())
      .filter(Boolean);
    const sharedStyle = segmentStyles.length && segmentStyles.every((style) => style === segmentStyles[0])
      ? segmentStyles[0]
      : "";
    setVoicePrompt(sharedStyle || adminConfig.tts.defaultStylePrompt || defaultVoiceStylePresets[0]);
  }, [adminConfig.tts.defaultStylePrompt, generatedProgram?.id]);
  const generateBusy =
    programType === "daily-briefing"
      ? dailyBriefingBusy
      : programType === "hot-topics"
        ? hotTopicsBusy
        : programType === "kugou"
          ? kugouProgramBusy
          : programType === "media"
            ? mediaProgramBusy
          : programType === "suno"
            ? sunoMusicBusy
        : programBusy;
  const updatesCurrentProgram = Boolean(
    generatedProgram && programDraft.trim() &&
    (programDraft.trim() !== generatedProgram.script.trim() || generatedProgram.status !== "ready"),
  );
  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <span>节目制作</span>
        <h1>生成、改稿和配音集中处理</h1>
        <p>{programStatus}</p>
      </div>
      <div className="admin-work-grid">
        <section className="admin-card">
          <h2>生成设置</h2>
          <div className="ai-input-stack">
            <div className="studio-grid studio-grid--2">
              <label className="studio-date-field">
                <span>生成到日期</span>
                <ProgramDateInput
                  hasTodayPrograms={programHistory.some((program) => programTimelineDate(program) === localDateKey())}
                  onChange={onTimelineDateChange}
                  value={selectedTimelineDate}
                />
              </label>
              <label>
                <span>节目名称</span>
                <input value={programTitle} onChange={(event) => {
                  const value = event.target.value;
                  onProgramTitleChange(value);
                  if (programType === "daily-briefing") onAdminConfigChange("plugins", "dailyBriefing", { ...adminConfig.plugins.dailyBriefing, name: value });
                  if (programType === "hot-topics") onAdminConfigChange("plugins", "hotTopics", { ...adminConfig.plugins.hotTopics, name: value });
                  if (programType === "kugou") onAdminConfigChange("plugins", "kugouMusic", { ...adminConfig.plugins.kugouMusic, name: value });
                }} />
              </label>
              <label>
                <span>节目类型</span>
                <select className="admin-studio-type-select" value={programType} onChange={(event) => {
                  const nextType = event.target.value as ProgramType;
                  onProgramTypeChange(nextType);
                  if (nextType === "daily-briefing") onProgramTitleChange(adminConfig.plugins.dailyBriefing.name);
                  if (nextType === "hot-topics") onProgramTitleChange(adminConfig.plugins.hotTopics.name);
                  if (nextType === "kugou") onProgramTitleChange(adminConfig.plugins.kugouMusic.name);
                  if (nextType === "media") onProgramTitleChange(mediaTitle || "网络媒体节目");
                  if (nextType === "suno") onProgramTitleChange("AI原创音乐");
                }}>
                  <option value="custom">自定义节目</option>
                  <option value="daily-briefing">每日早报</option>
                  <option value="hot-topics">今日热榜</option>
                  <option value="kugou">音乐节目（多音乐源）</option>
                  <option value="media">网络媒体节目</option>
                  <option value="suno">AI音乐（Suno）</option>
                </select>
              </label>
              <label>
                <span>节目分类</span>
                <select value={programCategoryId} onChange={(event) => onProgramCategoryChange(event.target.value)}>
                  <option value="">选择分类</option>
                  {programCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {programType === "custom" ? (
              <div className="studio-plugin-panel">
                <div className="studio-content-mode" role="group" aria-label="自定义内容处理方式">
                  <button
                    className={customContentMode === "ai" ? "is-active" : ""}
                    onClick={() => onCustomContentModeChange("ai")}
                    type="button"
                  >
                    <WandSparkles size={17} />
                    <span>AI 生成内容</span>
                  </button>
                  <button
                    className={customContentMode === "direct" ? "is-active" : ""}
                    onClick={() => onCustomContentModeChange("direct")}
                    type="button"
                  >
                    <Volume2 size={17} />
                    <span>原文直出配音</span>
                  </button>
                </div>
                <label>
                  <span>{customContentMode === "direct" ? "配音原文" : "AI 内容提示词"}</span>
                  <textarea
                    placeholder={
                      customContentMode === "direct"
                        ? "粘贴需要直接配音的完整原文；系统不会调用大模型改写。"
                        : "描述节目主题、语气、结构和需要涵盖的内容。"
                    }
                    value={programPrompt}
                    onChange={(event) => onProgramPromptChange(event.target.value)}
                  />
                  <small>
                    {customContentMode === "direct"
                      ? "原文按段落分配给所选主播，直接进入语音合成。"
                      : "系统根据提示词调用大模型生成可播出的节目文案。"}
                  </small>
                </label>
                <div className="ai-host-selector">
                  <span>参与主播</span>
                  <div>
                    {hosts.map((host) => (
                      <button
                        className={programHostIds.includes(host.id) ? "is-active" : ""}
                        key={host.id}
                        onClick={() => onProgramHostToggle(host.id)}
                        type="button"
                      >
                        <img alt="" src={host.image} />
                        <strong>{host.name}</strong>
                        <small>{adminConfig.tts.hostVoices?.[host.id] ?? "默认音色"}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <AudioMixEditor
                  audioMix={adminConfig.plugins.customProgram.audioMix}
                  onChange={(audioMix) =>
                    onAdminConfigChange("plugins", "customProgram", {
                      ...adminConfig.plugins.customProgram,
                      audioMix,
                    })
                  }
                  soundEffectCategories={soundEffectCategories}
                  title="自定义节目背景音"
                />
              </div>
            ) : null}

            {programType === "media" ? (
              <div className="studio-plugin-panel media-program-panel">
                <div className="media-program-notice">
                  <FileAudio size={20} />
                  <p>支持音频、视频、HLS（m3u8）直链，也支持 yt-dlp 可识别的 Bilibili、YouTube 等播放页面。需要登录的页面可临时提供站点 Cookie；DRM 内容仍无法提取。请确认你拥有播放和使用该内容的权利。</p>
                </div>
                <label>
                  <span>多媒体播放地址</span>
                  <div className="media-url-row">
                    <input
                      onChange={(event) => {
                        setMediaUrl(event.target.value);
                        setMediaProbe(null);
                      }}
                      placeholder="媒体直链，或 https://www.bilibili.com/video/BV... 等播放页面"
                      type="url"
                      value={mediaUrl}
                    />
                    <button
                      disabled={mediaProgramBusy || !mediaUrl.trim()}
                      onClick={async () => {
                        const probe = await onMediaProbe({ mediaUrl, siteCookie: mediaSiteCookie });
                        if (!probe) return;
                        setMediaProbe(probe);
                        if (!mediaTitle.trim() && probe.title) {
                          setMediaTitle(probe.title);
                          onProgramTitleChange(probe.title);
                        }
                        if (!mediaCreator.trim() && probe.creator) {
                          setMediaCreator(probe.creator);
                        }
                        if (probe.resolver !== "direct") {
                          setMediaLocalCopy(true);
                        }
                        if (probe.duration > 0) {
                          setMediaDurationMinutes(Math.max(0.5, Math.round((probe.duration / 60) * 10) / 10));
                        }
                      }}
                      type="button"
                    >
                      {mediaProgramBusy ? <Loader2 className="spin-icon" size={16} /> : <Search size={16} />}
                      <span>检测链接</span>
                    </button>
                  </div>
                </label>
                <label>
                  <span>站点 Cookie（选填）</span>
                  <input
                    autoComplete="off"
                    onChange={(event) => { setMediaSiteCookie(event.target.value); setMediaProbe(null); }}
                    placeholder="公开页面通常不需要；会员、登录或地区受限内容可填写当前站点 Cookie"
                    type="password"
                    value={mediaSiteCookie}
                  />
                  <small>只在本次页面解析和下载中使用，不写入节目、归档或后台配置。Cookie 等同账号凭据，请谨慎使用。</small>
                </label>
                {mediaProbe ? (
                  <div className="media-probe-result">
                    <ShieldCheck size={18} />
                    <span><strong>{mediaProbe.resolver === "direct" ? "媒体直链可用" : "播放页面已解析"}</strong><small>{mediaProbe.resolver} · {mediaProbe.format} · {mediaProbe.codec}{mediaProbe.duration ? ` · ${formatDuration(mediaProbe.duration)}` : " · 流媒体时长未知"}</small></span>
                  </div>
                ) : null}
                <div className="studio-grid studio-grid--2">
                  <label>
                    <span>节目 / 内容名称</span>
                    <input onChange={(event) => { setMediaTitle(event.target.value); onProgramTitleChange(event.target.value); }} placeholder="例如：城市声音纪录片" value={mediaTitle} />
                  </label>
                  <label>
                    <span>作者或内容来源（选填）</span>
                    <input onChange={(event) => setMediaCreator(event.target.value)} placeholder="用于节目署名和 AI 介绍" value={mediaCreator} />
                  </label>
                  <label>
                    <span>节目时长（分钟）</span>
                    <input max={360} min={0.5} onChange={(event) => setMediaDurationMinutes(clampNumber(event.target.value, 0.5, 360, 30))} step={0.5} type="number" value={mediaDurationMinutes} />
                    <small>检测到固定时长时会自动填写；直播流按这里的时长截取。</small>
                  </label>
                  <label className="media-local-copy-toggle">
                    <span>播放稳定性</span>
                    <span className="admin-switch">
                      <input checked={mediaLocalCopy} onChange={(event) => setMediaLocalCopy(event.target.checked)} type="checkbox" />
                      <span>{mediaLocalCopy ? "下载并提取音轨到本地" : "直接使用原始链接"}</span>
                    </span>
                    <small>本地化可避免链接过期、视频格式或浏览器兼容问题，但生成时间和存储占用会增加。</small>
                  </label>
                </div>
                <div className="studio-content-mode" role="group" aria-label="媒体节目介绍方式">
                  <button className={mediaIntroMode === "ai" ? "is-active" : ""} onClick={() => setMediaIntroMode("ai")} type="button"><WandSparkles size={17} /><span>AI 生成介绍并配音</span></button>
                  <button className={mediaIntroMode === "direct" ? "is-active" : ""} onClick={() => setMediaIntroMode("direct")} type="button"><PenLine size={17} /><span>原文介绍并配音</span></button>
                  <button className={mediaIntroMode === "none" ? "is-active" : ""} onClick={() => setMediaIntroMode("none")} type="button"><VolumeX size={17} /><span>不添加介绍</span></button>
                </div>
                {mediaIntroMode === "ai" ? <label>
                  <span>AI 介绍要求</span>
                  <textarea onChange={(event) => setMediaIntroPrompt(event.target.value)} rows={4} value={mediaIntroPrompt} />
                  <small>大模型只根据名称、来源和这里的要求创作介绍，不会凭空分析媒体内容。</small>
                </label> : null}
                {mediaIntroMode === "direct" ? <label>
                  <span>介绍词原文</span>
                  <textarea onChange={(event) => setMediaIntroText(event.target.value)} placeholder="填写播放媒体前由主播直接配音的介绍词。" rows={6} value={mediaIntroText} />
                </label> : null}
                {mediaIntroMode !== "none" ? <div className="ai-host-selector ai-host-selector--compact">
                  <span>介绍主播</span>
                  <div>
                    {hosts.map((hostItem) => (
                      <button className={programHostIds.includes(hostItem.id) ? "is-active" : ""} key={hostItem.id} onClick={() => onProgramHostToggle(hostItem.id)} type="button">
                        <img alt="" src={hostItem.image} /><strong>{hostItem.name}</strong><small>{adminConfig.tts.hostVoices?.[hostItem.id] ?? "默认音色"}</small>
                      </button>
                    ))}
                  </div>
                </div> : null}
              </div>
            ) : null}

            {programType === "suno" ? (
              <div className="studio-plugin-panel studio-plugin-panel--suno">
                <StudioApiReference
                  description="模型配置页维护本地 suno-api 地址、Suno Cookie 和默认模型。"
                  enabled={adminConfig.suno.enabled && Boolean(adminConfig.suno.cookie) && Boolean(adminConfig.suno.captchaKey)}
                  name="本地 suno-api 连接"
                  onOpen={() => onSectionChange("settings")}
                />
                <div className="studio-content-mode" role="group" aria-label="AI音乐制作方式">
                  <button className={aiMusicMode === "auto" ? "is-active" : ""} onClick={() => setAiMusicMode("auto")} type="button">
                    <WandSparkles size={17} /><span>AI 全自动创作</span>
                  </button>
                  <button className={aiMusicMode === "manual" ? "is-active" : ""} onClick={() => setAiMusicMode("manual")} type="button">
                    <PenLine size={17} /><span>手动歌词与提示词</span>
                  </button>
                </div>
                {aiMusicMode === "auto" ? (
                  <div className="suno-auto-settings">
                    <p>无需填写歌词或 Styles。每次点击后，大模型会为每首歌随机创作不同题材、歌词和曲风，再直接提交 Suno 生成。</p>
                    <div className="studio-grid studio-grid--2">
                      <label>
                        <span>本次生成歌曲数量</span>
                        <input max={5} min={1} onChange={(event) => setAiMusicQuantity(clampNumber(event.target.value, 1, 5, 1))} type="number" value={aiMusicQuantity} />
                        <small>Suno 每次请求会返回两个版本；系统按这里的数量发起创作，并默认选用每组第一版。</small>
                      </label>
                      <label>
                        <span>主唱性别</span>
                        <select onChange={(event) => setAiMusicVoiceGender(event.target.value as AiMusicPlan["voiceGender"])} value={aiMusicVoiceGender}>
                          <option value="random">每首随机男女声</option>
                          <option value="female">女声</option>
                          <option value="male">男声</option>
                        </select>
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="studio-grid studio-grid--2 suno-studio-grid">
                      <label>
                        <span>Styles</span>
                        <textarea onChange={(event) => setAiMusicStyle(event.target.value)} placeholder="mandopop, cinematic, 92 bpm" rows={5} value={aiMusicStyle} />
                      </label>
                      <label>
                        <span>主唱性别</span>
                        <select onChange={(event) => setAiMusicVoiceGender(event.target.value as AiMusicPlan["voiceGender"])} value={aiMusicVoiceGender}>
                          <option value="random">随机</option>
                          <option value="female">女声</option>
                          <option value="male">男声</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      <span>Lyrics</span>
                      <textarea
                        className="suno-lyrics-input"
                        onChange={(event) => setAiMusicLyrics(event.target.value)}
                        placeholder="支持 [Verse]、[Pre-Chorus]、[Chorus]、[Bridge]、[Outro] 等结构标记。"
                        rows={14}
                        value={aiMusicLyrics}
                      />
                    </label>
                    <div className="suno-studio-actions">
                      <button
                        disabled={sunoMusicBusy}
                        onClick={async () => applyAiMusicPlan(await onSunoPlan({ ...aiMusicInput(), mode: "auto" }))}
                        type="button"
                      >
                        {sunoMusicBusy ? <Loader2 className="spin-icon" size={17} /> : <WandSparkles size={17} />}
                        <span>大模型随机填入一份</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {programType === "daily-briefing" ? (
              <div className="studio-plugin-panel">
                <StudioApiReference description="接口页只维护 ALAPI Endpoint 和 Token。" enabled={adminConfig.plugins.dailyBriefing.enabled} name="每日早报 API 连接" onOpen={() => onSectionChange("plugins")} />
                <div className="studio-grid studio-grid--2">
                  <label><span>最多采集条数</span><input max={30} min={3} type="number" value={adminConfig.plugins.dailyBriefing.maxItems} onChange={(event) => onAdminConfigChange("plugins", "dailyBriefing", { ...adminConfig.plugins.dailyBriefing, maxItems: Number(event.target.value) })} /></label>
                  <label><span>播报主播</span><select value={adminConfig.plugins.dailyBriefing.hostId} onChange={(event) => onAdminConfigChange("plugins", "dailyBriefing", { ...adminConfig.plugins.dailyBriefing, hostId: event.target.value })}>{hosts.map((host) => <option key={host.id} value={host.id}>{host.name}</option>)}</select></label>
                  <label><span>播报速度</span><input max={2} min={0.5} step={0.05} type="number" value={adminConfig.plugins.dailyBriefing.playbackSpeed} onChange={(event) => onAdminConfigChange("plugins", "dailyBriefing", { ...adminConfig.plugins.dailyBriefing, playbackSpeed: clampNumber(event.target.value, 0.5, 2, 1) })} /></label>
                </div>
                <AudioMixEditor audioMix={adminConfig.plugins.dailyBriefing.audioMix} onChange={(audioMix) => onAdminConfigChange("plugins", "dailyBriefing", { ...adminConfig.plugins.dailyBriefing, audioMix })} soundEffectCategories={soundEffectCategories} title="每日早报背景音" />
              </div>
            ) : null}

            {programType === "hot-topics" ? (
              <div className="studio-plugin-panel">
                <StudioApiReference description="接口页只维护 ALAPI Endpoint 和 Token。" enabled={adminConfig.plugins.hotTopics.enabled} name="今日热榜 API 连接" onOpen={() => onSectionChange("plugins")} />
                <div className="studio-grid studio-grid--2">
                  <label><span>热榜类型</span><input placeholder="weibo" value={adminConfig.plugins.hotTopics.type} onChange={(event) => onAdminConfigChange("plugins", "hotTopics", { ...adminConfig.plugins.hotTopics, type: event.target.value })} /></label>
                  <label><span>最多采集条数</span><input max={30} min={3} type="number" value={adminConfig.plugins.hotTopics.maxItems} onChange={(event) => onAdminConfigChange("plugins", "hotTopics", { ...adminConfig.plugins.hotTopics, maxItems: Number(event.target.value) })} /></label>
                  <label><span>播报主播</span><select value={adminConfig.plugins.hotTopics.hostId} onChange={(event) => onAdminConfigChange("plugins", "hotTopics", { ...adminConfig.plugins.hotTopics, hostId: event.target.value })}>{hosts.map((host) => <option key={host.id} value={host.id}>{host.name}</option>)}</select></label>
                  <label><span>播报速度</span><input max={2} min={0.5} step={0.05} type="number" value={adminConfig.plugins.hotTopics.playbackSpeed} onChange={(event) => onAdminConfigChange("plugins", "hotTopics", { ...adminConfig.plugins.hotTopics, playbackSpeed: clampNumber(event.target.value, 0.5, 2, 1) })} /></label>
                </div>
                <AudioMixEditor audioMix={adminConfig.plugins.hotTopics.audioMix} onChange={(audioMix) => onAdminConfigChange("plugins", "hotTopics", { ...adminConfig.plugins.hotTopics, audioMix })} soundEffectCategories={soundEffectCategories} title="今日热榜背景音" />
              </div>
            ) : null}

            {programType === "kugou" ? (
              <div className="studio-plugin-panel studio-plugin-panel--kugou">
                <StudioApiReference
                  description="接口页只维护酷狗、网易云和 QQ 音乐的启用状态与 Cookie。"
                  enabled={adminConfig.plugins.kugouMusic.apiEnabled || adminConfig.plugins.neteaseMusic.enabled || adminConfig.plugins.qqMusic.enabled}
                  name="多音乐源 API 连接"
                  onOpen={() => onSectionChange("plugins")}
                />
                <div className="studio-grid studio-grid--2">
                  <label><span>音乐来源</span><select value={adminConfig.plugins.kugouMusic.provider} onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...adminConfig.plugins.kugouMusic, provider: event.target.value as MusicProvider })}><option value="auto">智能混合（推荐）</option><option value="kugou">仅酷狗音乐</option><option value="netease">仅网易云音乐</option><option value="qq">仅 QQ 音乐</option></select></label>
                  <label><span>选歌类型</span><select value={adminConfig.plugins.kugouMusic.source} onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...adminConfig.plugins.kugouMusic, source: event.target.value })}><option value="new">新歌速递</option><option value="hot">热门好歌</option><option value="classic">经典老歌</option><option value="treasure">小众宝藏</option><option value="search">关键词搜索</option></select></label>
                  <label><span>搜索关键词</span><input value={adminConfig.plugins.kugouMusic.searchKeywords} onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...adminConfig.plugins.kugouMusic, searchKeywords: event.target.value })} /></label>
                  <label><span>歌曲数量</span><input max={100} min={1} type="number" value={adminConfig.plugins.kugouMusic.maxSongs} onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...adminConfig.plugins.kugouMusic, maxSongs: Math.max(1, Math.min(100, Number(event.target.value) || 1)) })} /></label>
                  <label><span>音质</span><select value={adminConfig.plugins.kugouMusic.quality} onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...adminConfig.plugins.kugouMusic, quality: event.target.value })}><option value="128">标准 128k</option><option value="320">高品 320k</option><option value="flac">无损 FLAC</option></select></label>
                  <label><span>串场主播</span><select value={adminConfig.plugins.kugouMusic.hostId} onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...adminConfig.plugins.kugouMusic, hostId: event.target.value })}>{hosts.map((host) => <option key={host.id} value={host.id}>{host.name}</option>)}</select></label>
                  <label className="flow-check filler-enable-check"><input checked={adminConfig.plugins.kugouMusic.enabled} onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...adminConfig.plugins.kugouMusic, enabled: event.target.checked })} type="checkbox" /><span>启用音乐节目功能</span></label>
                  <label className="flow-check filler-enable-check"><input checked={adminConfig.plugins.kugouMusic.useAiScript} onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...adminConfig.plugins.kugouMusic, useAiScript: event.target.checked })} type="checkbox" /><span>生成 AI 串场和配音</span></label>
                </div>
                <div className="manual-music-builder">
                  <div className="manual-music-search">
                    <input value={manualMusicQuery} onChange={(event) => onManualMusicQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void onManualMusicSearch(); } }} placeholder="搜索歌曲 / 歌手" />
                    <button disabled={manualMusicSearchBusy} onClick={onManualMusicSearch} type="button">{manualMusicSearchBusy ? <Loader2 className="spin-icon" size={18} /> : <Search size={18} />}<span>{manualMusicSearchBusy ? "搜索中" : "多源搜索"}</span></button>
                  </div>
                  <div className="manual-music-list">
                    <strong>搜索结果</strong>
                    {manualMusicResults.length ? manualMusicResults.map((song) => <button key={songKey(song)} onClick={() => onManualMusicAdd(song)} type="button"><span><b>{song.title}</b><small>{song.artist || "未知歌手"} · {song.source === "netease" ? "网易云" : song.source === "qq" ? "QQ 音乐" : "酷狗"}</small></span><Plus size={16} /></button>) : <p>按当前音乐来源搜索后，可加入右侧手动播放清单。</p>}
                  </div>
                  <div className="manual-music-list manual-music-list--selected">
                    <strong>手动播放顺序</strong>
                    {manualMusicSelected.length ? manualMusicSelected.map((song, index) => <div key={`${songKey(song)}-${index}`}><span className="manual-music-index">{String(index + 1).padStart(2, "0")}</span><span><b>{song.title}</b><small>{song.artist || "未知歌手"} · {song.source === "netease" ? "网易云" : song.source === "qq" ? "QQ 音乐" : "酷狗"}</small></span><button disabled={index === 0} onClick={() => onManualMusicReorder(index, -1)} title="上移" type="button"><ArrowUp size={16} /></button><button disabled={index === manualMusicSelected.length - 1} onClick={() => onManualMusicReorder(index, 1)} title="下移" type="button"><ArrowDown size={16} /></button><button onClick={() => onManualMusicRemove(index)} title="移除" type="button"><Trash2 size={16} /></button></div>) : <p>不手动选择时，系统按上方来源和选歌类型自动取歌。</p>}
                  </div>
                </div>
                {manualMusicStatus ? <p className="kugou-status">{manualMusicStatus}</p> : null}
              </div>
            ) : null}

            {programType !== "suno" && !(programType === "media" && mediaIntroMode === "none") ? <div className="studio-voice-prompt">
              <div>
                <span><Mic2 size={18} />配音语气提示词</span>
                <small>用于当前节目全部配音片段；可选择预设后继续手动修改。</small>
              </div>
              <select
                aria-label="配音语气预设"
                onChange={(event) => setVoicePrompt(event.target.value)}
                value={(adminConfig.tts.stylePresets ?? []).includes(voicePrompt) ? voicePrompt : ""}
              >
                <option value="">自定义语气</option>
                {(adminConfig.tts.stylePresets ?? defaultVoiceStylePresets).map((prompt) => (
                  <option key={prompt} value={prompt}>{prompt}</option>
                ))}
              </select>
              <textarea
                onChange={(event) => setVoicePrompt(event.target.value)}
                placeholder="例如：温柔、放松、像深夜陪伴型电台主播，停顿自然，语速舒缓。"
                rows={3}
                value={voicePrompt}
              />
              <button
                onClick={() => onAdminConfigChange("tts", "defaultStylePrompt", voicePrompt.trim() || defaultVoiceStylePresets[0])}
                type="button"
              >
                <Save size={16} /><span>设为默认语气</span>
              </button>
            </div> : null}

            <div className="ai-action-row">
              {programType !== "suno" && programType !== "media" ? <button className="admin-primary-button" disabled={programPresetBusy} onClick={onGenerateProgramPreset} type="button">
                {programPresetBusy ? <Loader2 className="spin-icon" size={20} /> : <Save size={20} />}
                <span>{programPresetBusy ? "保存中" : "生成节目预设"}</span>
              </button> : null}
              <button
                disabled={generateBusy}
                onClick={async () => {
                  if (programType === "suno") {
                    const plan = await onSunoGenerate(aiMusicInput());
                    if (aiMusicMode === "manual") {
                      applyAiMusicPlan(plan);
                    }
                    return;
                  }
                  if (programType === "media") {
                    const probe = await onMediaGenerate(mediaProgramInput(), voicePrompt);
                    if (probe) {
                      setMediaProbe(probe);
                    }
                    return;
                  }
                  await onGenerateProgram(voicePrompt);
                }}
                type="button"
              >
                {generateBusy ? <Loader2 className="spin-icon" size={18} /> : customContentMode === "direct" && programType === "custom" ? <Volume2 size={18} /> : <WandSparkles size={18} />}
                <span>{generateBusy ? (programType === "suno" ? "AI音乐生成中" : programType === "media" ? (mediaLocalCopy ? "音轨提取中" : "媒体节目生成中") : "生成中") : programType === "suno" ? (aiMusicMode === "auto" ? "全自动生成 AI 音乐" : "使用当前歌词生成 AI 音乐") : programType === "media" ? "生成网络媒体节目" : updatesCurrentProgram ? "更新当前节目" : customContentMode === "direct" && programType === "custom" ? "原文生成配音" : "立即生成节目"}</span>
              </button>
              {programType === "media" ? <button
                disabled={generateBusy}
                onClick={() => void onMediaGenerate(mediaProgramInput(), voicePrompt, true)}
                type="button"
              >
                <Save size={18} />
                <span>保存节目后台生成</span>
              </button> : null}
            </div>
          </div>
        </section>

        <section className="admin-card">
          <h2>人工编辑</h2>
          {generatedProgram ? (
            <article className="program-record program-record--admin">
              <div className="program-record__head">
                <span>
                  <strong>{generatedProgram.title}</strong>
                  <small>{generatedProgram.host} · {new Date(generatedProgram.createdAt).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" })}</small>
                </span>
                <em>{generatedProgram.sourceType === "suno" ? "AI音乐已生成" : generatedProgram.sourceType === "media-link" ? (generatedProgram.status === "generating" ? "后台生成中" : generatedProgram.status === "failed" ? "生成失败" : "网络媒体已生成") : generatedProgram.status === "ready" ? "已配音" : "待配音"}</em>
              </div>
              {!['suno', 'media-link'].includes(String(generatedProgram.sourceType)) ? <label className="program-speed-control">
                <span>播报速度 {programPlaybackSpeed.toFixed(2)}x</span>
                <input
                  max={2}
                  min={0.5}
                  onChange={(event) => onProgramPlaybackSpeedChange(Number(event.target.value))}
                  step={0.05}
                  type="range"
                  value={programPlaybackSpeed}
                />
              </label> : null}
              {!['suno', 'media-link'].includes(String(generatedProgram.sourceType)) ? <div className="ai-host-selector ai-host-selector--compact">
                <span>重配音主播</span>
                <div>
                  {hosts.map((host) => (
                    <button
                      className={programHostIds.includes(host.id) ? "is-active" : ""}
                      key={host.id}
                      onClick={() => onProgramHostToggle(host.id)}
                      type="button"
                    >
                      <img alt="" src={host.image} />
                      <strong>{host.name}</strong>
                      <small>{adminConfig.tts.hostVoices?.[host.id] ?? "默认音色"}</small>
                    </button>
                  ))}
                </div>
              </div> : null}
              <textarea readOnly={['suno', 'media-link'].includes(String(generatedProgram.sourceType))} value={programDraft} onChange={(event) => onProgramDraftChange(event.target.value)} />
              <div className="program-edit-actions">
                {!['suno', 'media-link'].includes(String(generatedProgram.sourceType)) ? <button onClick={() => onProgramSaveDraft(voicePrompt)} type="button">
                  <Save size={18} />
                  <span>保存改稿</span>
                </button> : null}
                {!['suno', 'media-link'].includes(String(generatedProgram.sourceType)) ? <button className="is-ai" disabled={programRewriteBusy} onClick={onProgramRewriteScript} type="button">
                  {programRewriteBusy ? <Loader2 className="spin-icon" size={18} /> : <Sparkles size={18} />}
                  <span>{programRewriteBusy ? "重编中" : "AI重编"}</span>
                </button> : null}
                {!['suno', 'media-link'].includes(String(generatedProgram.sourceType)) ? <button className="is-primary" disabled={programTtsBusy} onClick={() => onProgramRegenerateTts(voicePrompt)} type="button">
                  {programTtsBusy ? <Loader2 className="spin-icon" size={18} /> : <RefreshCw size={18} />}
                  <span>{programTtsBusy ? "配音中" : "重新配音"}</span>
                </button> : null}
                <button
                  disabled={programPushBusyId === generatedProgram.id}
                  onClick={() => onProgramPushHome(generatedProgram.id, voicePrompt)}
                  type="button"
                >
                  {programPushBusyId === generatedProgram.id ? <Loader2 className="spin-icon" size={18} /> : <Radio size={18} />}
                  <span>{programPushBusyId === generatedProgram.id ? "更新并推送中" : "立即推送"}</span>
                </button>
                <button className="is-danger" onClick={() => onDeleteProgram(generatedProgram.id)} type="button">
                  <Trash2 size={18} />
                  <span>删除节目</span>
                </button>
              </div>
              {generatedProgram.audioUrl ? <audio ref={programAudioRef} className="program-audio" controls src={generatedProgram.audioUrl} /> : null}
              {generatedProgram.sourceType === "suno" && sunoCandidates.length ? (
                <div className="suno-candidate-panel">
                  <div className="program-songs-header">Suno 双版本试听与选用</div>
                  <p>每次 Suno 创作会返回两个版本。系统默认使用第一版；试听后可以为节目中的每首歌单独切换。</p>
                  <div className="suno-candidate-grid">
                    {sunoCandidates.map((candidate) => (
                      <article className={candidate.selected ? "is-selected" : ""} key={`${candidate.slotIndex}-${candidate.id}`}>
                        <span>
                          <strong>第 {candidate.slotIndex + 1} 首 · 版本 {candidate.variantIndex === 0 ? "A" : "B"}</strong>
                          <small>{candidate.title}</small>
                        </span>
                        <audio controls preload="none" src={candidate.audioUrl} />
                        <button disabled={candidate.selected || sunoMusicBusy} onClick={() => onSunoSelect(candidate)} type="button">
                          {candidate.selected ? "节目正在使用" : "选用此版本"}
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
              {generatedProgram.segments?.length ? (
                <div className="program-segments program-segments--admin">
                  {generatedProgram.segments.map((segment, index) => (
                    <div key={`${segment.hostId ?? segment.audioUrl ?? ""}-${index}`}>
                      <span>
                        <strong>{String(index + 1).padStart(2, "0")} · {segment.hostName || generatedProgram.host}</strong>
                        <small>{segment.style || "AI 配音片段"}</small>
                      </span>
                      <p>{segment.text}</p>
                      {segment.audioUrl ? <audio controls src={segment.audioUrl} /> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {generatedProgram.playlist?.some((item) => item.type === "song") ? (
                <div className="program-segments program-segments--admin">
                  <div className="program-songs-header">{generatedProgram.sourceType === "media-link" ? "媒体内容" : `歌曲列表（${generatedProgram.playlist.filter((item) => item.type === "song").length} 首）`}</div>
                  {generatedProgram.playlist
                    .filter((item) => item.type === "song")
                    .map((song, index) => (
                      <div key={`${songKey(song)}-${index}`}>
                        <span>
                          <strong>{String(index + 1).padStart(2, "0")} · {song.title}</strong>
                          <small>{song.artist || "未知歌手"}{song.duration ? ` · ${formatDuration(song.duration)}` : ""}</small>
                        </span>
                        {song.audioUrl ? <audio controls src={song.audioUrl} /> : <small className="program-hint">无可播放链接</small>}
                      </div>
                    ))}
                </div>
              ) : null}
            </article>
          ) : (
            <div className="program-empty program-empty--compact">还没有节目，先生成或采集一条节目。</div>
          )}
        </section>
      </div>
    </section>
  );
}

type KugouConfigPanelProps = {
  adminConfig: AdminConfig;
  kugou: AdminConfig["plugins"]["kugouMusic"];
  onAdminConfigChange: <T extends keyof AdminConfig, K extends keyof AdminConfig[T]>(
    service: T,
    key: K,
    value: AdminConfig[T][K],
  ) => void;
  kugouApiBusy: boolean;
  kugouApiName: string;
  kugouApiParams: string;
  kugouApiResult: string;
  kugouLoginBusy: boolean;
  kugouQr: { key: string; qrImage: string; qrUrl: string } | null;
  kugouStatus: string;
  manualMusicQuery: string;
  manualMusicResults: MusicCandidate[];
  manualMusicSearchBusy: boolean;
  manualMusicSelected: MusicCandidate[];
  manualMusicStatus: string;
  onKugouApiCall: () => void | Promise<void>;
  onKugouApiNameChange: (value: string) => void;
  onKugouApiParamsChange: (value: string) => void;
  onKugouQrCreate: () => void | Promise<void>;
  onKugouStatusRefresh: () => void | Promise<void>;
  onManualMusicAdd: (song: MusicCandidate) => void;
  onManualMusicQueryChange: (value: string) => void;
  onManualMusicRemove: (index: number) => void;
  onManualMusicReorder: (index: number, direction: -1 | 1) => void;
  onManualMusicSearch: () => void | Promise<void>;
};

function KugouConfigPanel(props: KugouConfigPanelProps) {
  const {
    kugou,
    onAdminConfigChange,
    kugouApiBusy,
    kugouApiName,
    kugouApiParams,
    kugouApiResult,
    kugouLoginBusy,
    kugouQr,
    kugouStatus,
    manualMusicQuery,
    manualMusicResults,
    manualMusicSearchBusy,
    manualMusicSelected,
    manualMusicStatus,
    onKugouApiCall,
    onKugouApiNameChange,
    onKugouApiParamsChange,
    onKugouQrCreate,
    onKugouStatusRefresh,
    onManualMusicAdd,
    onManualMusicQueryChange,
    onManualMusicRemove,
    onManualMusicReorder,
    onManualMusicSearch,
  } = props;

  return (
    <>
      <div className="config-grid config-grid--compact">
        <ConfigField label="启用插件">
          <label className="admin-switch">
            <input
              checked={kugou.enabled}
              onChange={(event) =>
                onAdminConfigChange("plugins", "kugouMusic", { ...kugou, enabled: event.target.checked })
              }
              type="checkbox"
            />
            <span>{kugou.enabled ? "已启用" : "已停用"}</span>
          </label>
        </ConfigField>
        <ConfigField label="节目名称">
          <input
            value={kugou.name}
            onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...kugou, name: event.target.value })}
          />
        </ConfigField>
        <ConfigField label="节目类型">
          <select
            value={kugou.source}
            onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...kugou, source: event.target.value })}
          >
            <option value="new">新歌速递</option>
            <option value="classic">经典老歌</option>
            <option value="hot">热门好歌</option>
            <option value="treasure">小众宝藏</option>
            <option value="search">关键词搜索</option>
          </select>
        </ConfigField>
        <ConfigField label="搜索关键词">
          <input
            value={kugou.searchKeywords}
            onChange={(event) =>
              onAdminConfigChange("plugins", "kugouMusic", { ...kugou, searchKeywords: event.target.value })
            }
          />
        </ConfigField>
        <ConfigField label="播报主播">
          <select
            value={kugou.hostId}
            onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...kugou, hostId: event.target.value })}
          >
            {hosts.map((host) => (
              <option key={host.id} value={host.id}>
                {host.name}
              </option>
            ))}
          </select>
        </ConfigField>
        <ConfigField label="歌曲数量">
          <input
            max={12}
            min={1}
            type="number"
            value={kugou.maxSongs}
            onChange={(event) =>
              onAdminConfigChange("plugins", "kugouMusic", { ...kugou, maxSongs: Number(event.target.value) })
            }
          />
        </ConfigField>
        <ConfigField label="推荐卡片 ID">
          <input
            min={1}
            type="number"
            value={kugou.cardId}
            onChange={(event) =>
              onAdminConfigChange("plugins", "kugouMusic", { ...kugou, cardId: Number(event.target.value) })
            }
          />
        </ConfigField>
        <ConfigField label="榜单 ID">
          <input
            min={1}
            type="number"
            value={kugou.rankType}
            onChange={(event) =>
              onAdminConfigChange("plugins", "kugouMusic", { ...kugou, rankType: Number(event.target.value) })
            }
          />
        </ConfigField>
        <ConfigField label="音质">
          <select
            value={kugou.quality}
            onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...kugou, quality: event.target.value })}
          >
            <option value="128">标准 128k</option>
            <option value="320">高品 320k</option>
            <option value="flac">无损 FLAC</option>
          </select>
        </ConfigField>
        <ConfigField label="AI 串场">
          <label className="admin-switch">
            <input
              checked={kugou.useAiScript}
              onChange={(event) =>
                onAdminConfigChange("plugins", "kugouMusic", { ...kugou, useAiScript: event.target.checked })
              }
              type="checkbox"
            />
            <span>{kugou.useAiScript ? "AI 编排" : "规则编排"}</span>
          </label>
        </ConfigField>
        <ConfigField label="酷狗 Cookie">
          <textarea
            value={kugou.cookie}
            onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...kugou, cookie: event.target.value })}
          />
        </ConfigField>
      </div>

      <div className="manual-music-builder">
        <div className="manual-music-search">
          <input
            onChange={(event) => onManualMusicQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onManualMusicSearch();
              }
            }}
            placeholder="手动搜索歌曲 / 歌手"
            value={manualMusicQuery}
          />
          <button disabled={manualMusicSearchBusy} onClick={onManualMusicSearch} type="button">
            {manualMusicSearchBusy ? <Loader2 className="spin-icon" size={18} /> : <Search size={18} />}
            <span>{manualMusicSearchBusy ? "搜索中" : "搜索音乐"}</span>
          </button>
        </div>
        <div className="manual-music-columns">
          <div className="manual-music-list">
            <strong>搜索结果</strong>
            {manualMusicResults.length ? (
              manualMusicResults.map((song) => (
                <button
                  key={songKey(song)}
                  onClick={() => onManualMusicAdd(song)}
                  type="button"
                >
                  <span>
                    <b>{song.title}</b>
                    <small>{song.artist || "未知歌手"}{song.duration ? ` · ${formatDuration(song.duration)}` : ""}</small>
                  </span>
                  <Heart size={17} />
                </button>
              ))
            ) : (
              <p>搜索后可勾选歌曲加入右侧队列。</p>
            )}
          </div>
          <div className="manual-music-list manual-music-list--selected">
            <strong>手动播放顺序</strong>
            {manualMusicSelected.length ? (
              manualMusicSelected.map((song, index) => (
                <div key={`${songKey(song)}-${index}`}>
                  <span className="manual-music-index">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <b>{song.title}</b>
                    <small>{song.artist || "未知歌手"}</small>
                  </span>
                  <button disabled={index === 0} onClick={() => onManualMusicReorder(index, -1)} title="上移" type="button">
                    <ArrowUp size={16} />
                  </button>
                  <button
                    disabled={index === manualMusicSelected.length - 1}
                    onClick={() => onManualMusicReorder(index, 1)}
                    title="下移"
                    type="button"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button onClick={() => onManualMusicRemove(index)} title="移除" type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              <p>未手动选择时，会按上方节目类型自动采集。</p>
            )}
          </div>
        </div>
        {manualMusicStatus ? <p className="kugou-status">{manualMusicStatus}</p> : null}
      </div>

      <div className="kugou-action-row">
        <button type="button" onClick={onKugouStatusRefresh}>
          <RefreshCw size={18} />
          <span>检测状态</span>
        </button>
        <button disabled={kugouLoginBusy} type="button" onClick={onKugouQrCreate}>
          {kugouLoginBusy ? <Loader2 className="spin-icon" size={18} /> : <QrCode size={18} />}
          <span>扫码登录</span>
        </button>
        {kugouQr ? (
          <span className="kugou-auto-check">
            <Loader2 className="spin-icon" size={17} />
            自动检测扫码状态
          </span>
        ) : null}
      </div>

      {kugouQr ? (
        <div className="kugou-qr-panel">
          {kugouQr.qrImage ? <img alt="酷狗扫码登录二维码" src={kugouQr.qrImage} /> : null}
          <span>
            <strong>二维码已生成</strong>
            {kugouQr.qrUrl ? (
              <a href={kugouQr.qrUrl} target="_blank" rel="noreferrer">
                打开扫码链接
              </a>
            ) : null}
          </span>
        </div>
      ) : null}
      <p className="kugou-status">{kugouStatus}</p>

      <section className="admin-card admin-card--wide kugou-api-card">
        <h2>KuGouMusicApi 高级调用</h2>
        <div className="config-grid config-grid--compact">
          <ConfigField label="模块名">
            <input value={kugouApiName} onChange={(event) => onKugouApiNameChange(event.target.value)} />
          </ConfigField>
          <ConfigField label="参数 JSON">
            <textarea value={kugouApiParams} onChange={(event) => onKugouApiParamsChange(event.target.value)} />
          </ConfigField>
        </div>
        <button
          className="admin-primary-button"
          disabled={kugouApiBusy || !kugouApiName.trim()}
          onClick={onKugouApiCall}
          type="button"
        >
          {kugouApiBusy ? <Loader2 className="spin-icon" size={18} /> : <ServerCog size={18} />}
          <span>{kugouApiBusy ? "调用中" : "调用 API"}</span>
        </button>
        {kugouApiResult ? <pre className="kugou-api-result">{kugouApiResult}</pre> : null}
      </section>
    </>
  );
}

function AdminTimelinePage({
  generatedProgram,
  onDeleteProgram,
  onProgramCategoryCreate,
  onProgramCategoryDelete,
  onProgramCategoryRename,
  onProgramClearDate,
  onProgramMetadataSave,
  onProgramPublishNextDay,
  onProgramPushHome,
  onProgramReorder,
  onProgramScheduleDraftChange,
  onProgramScheduleSave,
  onProgramSelect,
  onTimelineDateChange,
  programAudioRef,
  programCategories,
  programHistory,
  programPushBusyId,
  publishBusy,
  scheduleDrafts,
  selectedTimelineDate,
  timelinePrograms,
}: AdminShellProps) {
  return (
    <section className="admin-page">
      <div className="admin-page-title admin-page-title--with-action">
        <div>
          <span>播出排期</span>
          <h1>按固定日期编排节目</h1>
          <p>选择日期后，生成、排序和发布都会围绕该日期的节目队列进行。</p>
        </div>
        <button className="admin-primary-button" disabled={publishBusy || !timelinePrograms.length} onClick={onProgramPublishNextDay} type="button">
          {publishBusy ? <Loader2 className="spin-icon" size={19} /> : <Radio size={19} />}
          <span>{publishBusy ? "发布中" : "发布当前日期"}</span>
        </button>
      </div>
      <section className="admin-card timeline-date-card">
        <label>
          <span>编排日期</span>
          <ProgramDateInput
            hasTodayPrograms={programHistory.some((program) => programTimelineDate(program) === localDateKey())}
            onChange={onTimelineDateChange}
            value={selectedTimelineDate}
          />
        </label>
        <div>
          <strong>{selectedTimelineDate}</strong>
          <small>{timelinePrograms.length} 条节目 · 排序、定时和发布只影响该日期</small>
        </div>
        <button className="is-danger archive-program-delete" disabled={!timelinePrograms.length} onClick={() => onProgramClearDate(selectedTimelineDate)} type="button">
          <Trash2 size={16} />
          <span>清理所有</span>
        </button>
      </section>
      {generatedProgram?.audioUrl ? (
        <section className="admin-card admin-preview-player">
          <span>
            <strong>当前预听</strong>
            <small>{generatedProgram.title} · {generatedProgram.host}</small>
          </span>
          <audio ref={programAudioRef} controls src={generatedProgram.audioUrl} />
        </section>
      ) : null}
      <section className="admin-card">
        <h2>节目分类</h2>
        <ProgramCategoryManager
          categories={programCategories}
          onCreate={onProgramCategoryCreate}
          onDelete={onProgramCategoryDelete}
          onRename={onProgramCategoryRename}
        />
      </section>
      <section className="admin-card">
        <h2>{selectedTimelineDate} 时间线队列</h2>
        <div className="program-history-list">
          {timelinePrograms.length ? (
            timelinePrograms.map((program, index) => (
              <ProgramTimelineRow
                categories={programCategories}
                index={index}
                isLast={index === timelinePrograms.length - 1}
                key={program.id}
                onDelete={onDeleteProgram}
                onMetadataSave={onProgramMetadataSave}
                onPushHome={onProgramPushHome}
                onReorder={onProgramReorder}
                onScheduleDraftChange={onProgramScheduleDraftChange}
                onScheduleSave={onProgramScheduleSave}
                onSelect={onProgramSelect}
                program={program}
                pushBusy={programPushBusyId === program.id}
                scheduleDraft={scheduleDrafts[program.id] ?? toDatetimeLocalValue(program.scheduledAt)}
              />
            ))
          ) : (
            <div className="program-empty program-empty--compact">该日期还没有节目。请先在“节目制作”或“接口 API”生成内容。</div>
          )}
        </div>
      </section>
    </section>
  );
}

function AdminArchivePage({
  onProgramArchiveDelete,
  onProgramArchiveDeleteDate,
  onProgramArchiveRefresh,
  programArchives,
  programHistory,
}: AdminShellProps) {
  const [selectedArchiveDate, setSelectedArchiveDate] = useState(localDateKey());
  const totalCount = programArchives.reduce((sum, group) => sum + group.programs.length, 0);
  const visibleGroups = selectedArchiveDate
    ? programArchives.filter((group) => group.date === selectedArchiveDate)
    : [];

  return (
    <section className="admin-page">
      <div className="admin-page-title admin-page-title--with-action">
        <div>
          <span>节目归档</span>
          <h1>按日期保存每天的节目内容</h1>
          <p>选择日期查看当天的节目，也可以手动同步历史节目。</p>
        </div>
        <div className="admin-archive-actions">
          <label className="admin-date-field">
            <span>日期</span>
            <ProgramDateInput
              hasTodayPrograms={programHistory.some((program) => programTimelineDate(program) === localDateKey()) || programArchives.some((group) => group.date === localDateKey() && group.programs.length > 0)}
              onChange={setSelectedArchiveDate}
              value={selectedArchiveDate}
            />
          </label>
          <button className="admin-primary-button" onClick={onProgramArchiveRefresh} type="button">
            <Archive size={19} />
            <span>同步归档</span>
          </button>
          <button className="is-danger archive-program-delete" disabled={!selectedArchiveDate || !visibleGroups.length} onClick={() => onProgramArchiveDeleteDate(selectedArchiveDate)} type="button">
            <Trash2 size={16} />
            <span>清理所有</span>
          </button>
        </div>
      </div>

      <section className="admin-card">
        <h2>归档概览</h2>
        <div className="admin-metric-grid admin-metric-grid--compact">
          <AdminMetric label="归档日期" value={String(programArchives.length)} />
          <AdminMetric label="归档节目" value={String(totalCount)} />
          <AdminMetric label="最新日期" value={programArchives[0]?.date ?? "暂无"} />
        </div>
      </section>

      <div className="archive-date-list">
        {!selectedArchiveDate ? (
          <section className="admin-card">
            <div className="program-empty program-empty--compact">请选择日期查看当天的归档节目。</div>
          </section>
        ) : visibleGroups.length ? (
          visibleGroups.map((group) => (
            <section className="admin-card archive-date-card" key={group.date}>
              <div className="archive-date-head">
                <span>
                  <CalendarDays size={20} />
                  <strong>{group.date}</strong>
                </span>
                <small>{group.programs.length} 条节目</small>
              </div>
              <div className="archive-program-list">
                {group.programs.map((program, index) => (
                  <article className="archive-program-row" key={program.id}>
                    <div className="archive-program-index">{String(index + 1).padStart(2, "0")}</div>
                    <div>
                      <strong>{program.title}</strong>
                      <small>
                        {program.host} · {program.categoryName ?? "未分类"} · {new Date(program.archivedAt).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" })}
                      </small>
                      <p className="archive-script">{program.script}</p>
                      {program.audioUrl ? (
                        <a href={program.audioUrl} target="_blank" rel="noreferrer">
                          打开音频
                        </a>
                      ) : null}
                    </div>
                    <button
                      className="is-danger archive-program-delete"
                      onClick={() => onProgramArchiveDelete(program.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                      <span>删除</span>
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className="admin-card">
            <div className="program-empty program-empty--compact">{selectedArchiveDate} 当天暂无归档节目，可点击同步归档或更换日期。</div>
          </section>
        )}
      </div>
    </section>
  );
}

function AdminMusicPage({
  onDeleteProgram,
  onProgramClearDate,
  programHistory,
}: AdminShellProps) {
  const [cleanupDate, setCleanupDate] = useState(localDateKey());
  const musicPrograms = programHistory.filter((program) => program.pluginId === "kugou-music");
  const cleanupDatePrograms = musicPrograms.filter((program) => programTimelineDate(program) === cleanupDate);

  return (
    <section className="admin-page">
      <div className="admin-page-title admin-page-title--with-action">
        <div>
          <span>音乐点播</span>
          <h1>管理“音乐节目点播”的节目</h1>
          <p>这里列出所有音乐联播节目，可删除不再需要的节目（同步从前台点播列表移除）。</p>
        </div>
        <div className="admin-archive-actions">
          <label className="admin-date-field">
            <span>日期</span>
            <ProgramDateInput
              hasTodayPrograms={programHistory.some((program) => programTimelineDate(program) === localDateKey())}
              onChange={setCleanupDate}
              value={cleanupDate}
            />
          </label>
          <button className="is-danger archive-program-delete" disabled={!cleanupDatePrograms.length} onClick={() => onProgramClearDate(cleanupDate, "kugou-music")} type="button">
            <Trash2 size={16} />
            <span>清理所有</span>
          </button>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-metric-grid admin-metric-grid--compact">
          <AdminMetric label="音乐节目" value={String(musicPrograms.length)} />
          <AdminMetric label="选中日期" value={String(cleanupDatePrograms.length)} />
        </div>
      </section>

      <div className="archive-date-list">
        {musicPrograms.length ? (
          <section className="admin-card archive-date-card">
            <div className="archive-date-head">
              <span>
                <Disc3 size={20} />
                <strong>音乐联播节目</strong>
              </span>
              <small>{musicPrograms.length} 条节目</small>
            </div>
            <div className="archive-program-list">
              {musicPrograms.map((program, index) => {
                const songCount = program.playlist?.filter((item) => item.type === "song").length ?? 0;
                return (
                  <article className="archive-program-row" key={program.id}>
                    <div className="archive-program-index">{String(index + 1).padStart(2, "0")}</div>
                    <div>
                      <strong>{program.title}</strong>
                      <small>
                        {program.host} · {songCount ? `${songCount} 首歌曲` : "无歌曲"} · {program.status === "ready" ? "可播" : "待配音"}
                      </small>
                      {program.audioUrl ? (
                        <a href={program.audioUrl} target="_blank" rel="noreferrer">
                          打开音频
                        </a>
                      ) : null}
                    </div>
                    <button
                      className="is-danger archive-program-delete"
                      onClick={() => onDeleteProgram(program.id)}
                      title="删除该音乐节目"
                      type="button"
                    >
                      <Trash2 size={16} />
                      <span>删除</span>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="admin-card">
            <div className="program-empty program-empty--compact">
              暂无音乐节目，请到「接口 API」启用音乐来源，再在「节目制作」生成音乐节目。
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

function AdminEffectsPage({
  onSoundEffectCategoryCreate,
  onSoundEffectCategoryDelete,
  onSoundEffectCategoryRename,
  onSoundEffectDelete,
  onSoundEffectUpload,
  soundEffectCategories,
}: AdminShellProps) {
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(soundEffectCategories[0]?.id ?? "");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const totalEffects = soundEffectCategories.reduce((sum, category) => sum + category.effects.length, 0);

  useEffect(() => {
    if (!selectedCategoryId && soundEffectCategories[0]?.id) {
      setSelectedCategoryId(soundEffectCategories[0].id);
    }
  }, [selectedCategoryId, soundEffectCategories]);

  const createCategory = async () => {
    if (!newCategoryName.trim()) {
      return;
    }
    await onSoundEffectCategoryCreate(newCategoryName);
    setNewCategoryName("");
  };

  const uploadEffect = async () => {
    if (!selectedCategoryId || !uploadFile || uploadBusy) {
      return;
    }
    setUploadBusy(true);
    try {
      await onSoundEffectUpload(selectedCategoryId, uploadFile, uploadName);
      setUploadName("");
      setUploadFile(null);
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <span>音效管理</span>
        <h1>管理 AI 配音背景音效</h1>
        <p>上传后的音效可在每日早报、今日热榜里作为背景音循环播放。</p>
      </div>

      <section className="admin-card">
        <div className="admin-metric-grid admin-metric-grid--compact">
          <AdminMetric label="音效分类" value={String(soundEffectCategories.length)} />
          <AdminMetric label="可用音效" value={String(totalEffects)} />
        </div>
      </section>

      <div className="sound-effect-layout">
        <section className="admin-card">
          <h2>音效分类</h2>
          <div className="sound-category-create">
            <input
              placeholder="新分类名称"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
            />
            <button onClick={createCategory} type="button">
              <Plus size={17} />
              <span>新增</span>
            </button>
          </div>
          <div className="sound-category-list">
            {soundEffectCategories.map((category) => (
              <div className="sound-category-row" key={category.id}>
                <input
                  value={categoryDrafts[category.id] ?? category.name}
                  onChange={(event) =>
                    setCategoryDrafts((current) => ({
                      ...current,
                      [category.id]: event.target.value,
                    }))
                  }
                />
                <button
                  onClick={() => onSoundEffectCategoryRename(category.id, categoryDrafts[category.id] ?? category.name)}
                  type="button"
                >
                  保存
                </button>
                <button className="is-danger" onClick={() => onSoundEffectCategoryDelete(category.id)} type="button">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {!soundEffectCategories.length ? (
              <div className="program-empty program-empty--compact">暂无音效分类。</div>
            ) : null}
          </div>
        </section>

        <section className="admin-card">
          <h2>上传音效</h2>
          <div className="config-grid config-grid--compact">
            <ConfigField label="分类">
              <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
                {soundEffectCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </ConfigField>
            <ConfigField label="音效名称">
              <input value={uploadName} onChange={(event) => setUploadName(event.target.value)} />
            </ConfigField>
            <ConfigField label="音频文件">
              <input accept="audio/*" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} type="file" />
            </ConfigField>
          </div>
          <button className="admin-primary-button" disabled={!selectedCategoryId || !uploadFile || uploadBusy} onClick={uploadEffect} type="button">
            {uploadBusy ? <Loader2 className="spin-icon" size={18} /> : <FileAudio size={18} />}
            <span>{uploadBusy ? "上传中" : "上传音效"}</span>
          </button>
        </section>
      </div>

      <section className="admin-card">
        <h2>音效库</h2>
        <div className="sound-effect-library">
          {soundEffectCategories.map((category) => (
            <div className="sound-effect-group" key={category.id}>
              <div className="archive-date-head">
                <span>
                  <FileAudio size={20} />
                  <strong>{category.name}</strong>
                </span>
                <small>{category.effects.length} 条音效</small>
              </div>
              <div className="sound-effect-list">
                {category.effects.map((effect) => (
                  <article className="sound-effect-row" key={effect.id}>
                    <span>
                      <strong>{effect.name}</strong>
                      <small>{Math.max(1, Math.round(effect.sizeBytes / 1024))} KB</small>
                    </span>
                    <audio controls src={effect.audioUrl} />
                    <button className="is-danger" onClick={() => onSoundEffectDelete(effect.id)} type="button">
                      <Trash2 size={16} />
                      <span>删除</span>
                    </button>
                  </article>
                ))}
                {!category.effects.length ? <p>暂无音效。</p> : null}
              </div>
            </div>
          ))}
          {!soundEffectCategories.length ? (
            <div className="program-empty program-empty--compact">暂无音效分类，请先新增分类。</div>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function SystemSettingsPage({
  onSave,
  settings,
}: {
  onSave: (settings: SystemSettings) => Promise<SystemSettings>;
  settings: SystemSettings;
}) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("系统设置会影响前台品牌展示和后台侧边栏。");

  useEffect(() => {
    setDraft(normalizeSystemSettings(settings));
  }, [settings]);

  const updateDraft = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const templates = normalizeThemeTemplates(draft.templates);
  const activeTemplate = resolveThemeTemplate(draft);

  const uploadLogo = async (file?: File | null) => {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus("请选择图片文件作为 Logo。");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    updateDraft("logoUrl", dataUrl);
    setStatus("Logo 已载入，保存后生效。");
  };

  const submit = async (
    nextDraft = draft,
    messages: { saving: string; success: string } = {
      saving: "正在保存系统设置...",
      success: "系统设置已保存。",
    },
  ) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setStatus(messages.saving);
    applyThemeToDocument(normalizeSystemSettings(nextDraft));
    try {
      const saved = await onSave(nextDraft);
      setDraft(saved);
      setStatus(messages.success);
    } catch (error) {
      const previous = normalizeSystemSettings(settings);
      setDraft(previous);
      applyThemeToDocument(previous);
      setStatus(`保存失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveTemplateDraft = (patch: Partial<SystemSettings>) => {
    const nextDraft = normalizeSystemSettings({ ...draft, ...patch });
    setDraft(nextDraft);
    void submit(nextDraft, {
      saving: "正在保存模板设置...",
      success: "模板设置已保存并生效。",
    });
  };

  return (
    <section className="admin-page">
      <div className="admin-page-title">
        <span>系统设置</span>
        <h1>配置应用基础信息</h1>
        <p>{status}</p>
      </div>

      <section className="admin-card system-settings-card">
        <h2>站点品牌</h2>
        <div className="system-settings-layout">
          <div className="config-grid config-grid--compact">
            <ConfigField label="应用名称">
              <input value={draft.appName} onChange={(event) => updateDraft("appName", event.target.value)} />
            </ConfigField>
            <ConfigField label="副标题">
              <input value={draft.subtitle} onChange={(event) => updateDraft("subtitle", event.target.value)} />
            </ConfigField>
            <ConfigField label="页脚文案">
              <input value={draft.footerText} onChange={(event) => updateDraft("footerText", event.target.value)} />
              <small>请保留开源地址链接：https://github.com/moli-xia/AIradio</small>
            </ConfigField>
            <ConfigField label="Logo 图片">
              <input accept="image/*" onChange={(event) => void uploadLogo(event.target.files?.[0])} type="file" />
            </ConfigField>
          </div>
          <div className="system-logo-preview">
            <span>
              <img alt="" src={draft.logoUrl || generatedAssets.icons.waveLogo} />
            </span>
            <strong>{draft.appName || defaultSystemSettings.appName}</strong>
            <small>{draft.subtitle || defaultSystemSettings.subtitle}</small>
            <button onClick={() => updateDraft("logoUrl", "")} type="button">
              移除自定义 Logo
            </button>
          </div>
        </div>
        <button className="admin-primary-button" disabled={busy} onClick={() => void submit()} type="button">
          {busy ? <Loader2 className="spin-icon" size={18} /> : <Save size={18} />}
          <span>{busy ? "保存中" : "保存系统设置"}</span>
        </button>
      </section>

      <section className="admin-card system-settings-card">
        <h2>模板管理</h2>
        <div className="config-grid config-grid--compact">
          <ConfigField label="当前模板">
            <select
              disabled={draft.autoThemeByTime}
              onChange={(event) => saveTemplateDraft({ themeTemplateId: event.target.value })}
              value={draft.themeTemplateId}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <small>{draft.autoThemeByTime ? "已启用按时间自动切换，白天默认模板，夜间暗色模板。" : `当前生效：${activeTemplate.name}`}</small>
          </ConfigField>
          <ConfigField label="自动按时间切换">
            <label className="admin-switch">
              <input
                checked={draft.autoThemeByTime}
                onChange={(event) => saveTemplateDraft({ autoThemeByTime: event.target.checked })}
                type="checkbox"
              />
              <span>{draft.autoThemeByTime ? "已启用" : "已关闭"}</span>
            </label>
            <small>19:00 至次日 07:00 使用暗色主题，其余时间使用默认模板。</small>
          </ConfigField>
        </div>
        <div className="theme-template-list">
          {templates.map((template) => (
            <article key={template.id} className={`theme-template-card ${activeTemplate.id === template.id ? "is-active" : ""}`}>
              <span className={`theme-template-swatch theme-template-swatch--${template.mode}`} />
              <div>
                <strong>{template.name}</strong>
                <small>{template.description}</small>
              </div>
              <button
                disabled={draft.autoThemeByTime || draft.themeTemplateId === template.id}
                onClick={() => saveTemplateDraft({ themeTemplateId: template.id })}
                type="button"
              >
                {draft.themeTemplateId === template.id ? "当前模板" : "设为当前"}
              </button>
            </article>
          ))}
        </div>
        <button className="admin-primary-button" disabled={busy} onClick={() => void submit()} type="button">
          {busy ? <Loader2 className="spin-icon" size={18} /> : <Save size={18} />}
          <span>{busy ? "保存中" : "保存模板设置"}</span>
        </button>
      </section>
    </section>
  );
}

const STORAGE_FILE_TYPE_LABEL: Record<StorageAudioFileType, string> = {
  "host-preview": "主播试听",
  program: "节目主音频",
  segment: "节目分段",
};

const STORAGE_CLEANUP_OPTIONS = [
  { description: "删除数据库中没有任何节目引用的音频。", label: "孤立文件", mode: "orphaned" },
  { description: "删除主播试听时生成的临时音频。", label: "主播试听", mode: "previews" },
  { description: "按保存的天数阈值清理过期音频。", label: "过期文件", mode: "old" },
] as const;

function StorageManager() {
  const [busy, setBusy] = useState(false);
  const [cleanupMode, setCleanupMode] = useState<(typeof STORAGE_CLEANUP_OPTIONS)[number]["mode"]>("orphaned");
  const [config, setConfig] = useState<StorageConfig>({
    autoCleanupEnabled: false,
    autoCleanupKeepProgramAudio: true,
    autoCleanupLastRun: "",
    autoCleanupMaxAgeDays: 7,
  });
  const [files, setFiles] = useState<StorageAudioFile[]>([]);
  const [query, setQuery] = useState("");
  const [referenceFilter, setReferenceFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("正在加载附件列表...");
  const [typeFilter, setTypeFilter] = useState<"all" | StorageAudioFileType>("all");

  const loadStorage = useCallback(async () => {
    setBusy(true);
    try {
      const [fileData, configData] = await Promise.all([
        apiJson<StorageFilesResponse>("/api/storage/audio-files"),
        apiJson<StorageConfigResponse>("/api/storage/config"),
      ]);
      setFiles(fileData.files);
      setConfig(configData.storage);
      setStatus(fileData.files.length ? "附件列表已更新" : "暂无音频附件");
    } catch (error) {
      setStatus(`加载附件失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadStorage();
  }, [loadStorage]);

  const visibleFiles = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return files.filter((file) => {
      if (typeFilter !== "all" && file.type !== typeFilter) {
        return false;
      }
      if (referenceFilter === "linked" && !file.referenced) {
        return false;
      }
      if (referenceFilter === "unlinked" && file.referenced) {
        return false;
      }
      return !keyword || file.name.toLowerCase().includes(keyword);
    });
  }, [files, query, referenceFilter, typeFilter]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedSize = files.filter((file) => selectedSet.has(file.name)).reduce((sum, file) => sum + file.size, 0);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const linkedCount = files.filter((file) => file.referenced).length;
  const unlinkedCount = files.length - linkedCount;
  const visibleSelected = visibleFiles.length > 0 && visibleFiles.every((file) => selectedSet.has(file.name));

  const refreshAfterMutation = (data: StorageFilesResponse, fallback: string) => {
    setFiles(data.files);
    setSelected([]);
    setStatus(data.message ?? fallback);
  };

  const deleteSelected = async () => {
    if (!selected.length || busy) {
      return;
    }
    const referencedCount = files.filter((file) => selectedSet.has(file.name) && file.referenced).length;
    const confirmMessage = referencedCount
      ? `已选 ${selected.length} 个文件，其中 ${referencedCount} 个仍被节目引用。系统会保留引用文件，只删除未引用文件。继续？`
      : `确定删除已选的 ${selected.length} 个音频文件？`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setBusy(true);
    try {
      const result = await apiJson<StorageFilesResponse>("/api/storage/audio-files", {
        body: JSON.stringify({ files: selected }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      refreshAfterMutation(result, "已删除选中的附件");
    } catch (error) {
      setStatus(`删除失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const runCleanup = async () => {
    if (busy) {
      return;
    }
    const option = STORAGE_CLEANUP_OPTIONS.find((item) => item.mode === cleanupMode);
    if (!window.confirm(`确定执行「${option?.label ?? "清理"}」？`)) {
      return;
    }
    setBusy(true);
    try {
      const result = await apiJson<StorageFilesResponse>("/api/storage/cleanup", {
        body: JSON.stringify({
          keepProgramAudio: config.autoCleanupKeepProgramAudio,
          maxAgeDays: config.autoCleanupMaxAgeDays,
          mode: cleanupMode,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      refreshAfterMutation(result, "附件清理已完成");
    } catch (error) {
      setStatus(`清理失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const result = await apiJson<StorageConfigResponse>("/api/storage/config", {
        body: JSON.stringify(config),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      setConfig(result.storage);
      setStatus(result.message ?? "自动清理配置已保存");
    } catch (error) {
      setStatus(`保存配置失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleVisible = () => {
    if (visibleSelected) {
      const visibleNames = new Set(visibleFiles.map((file) => file.name));
      setSelected((current) => current.filter((name) => !visibleNames.has(name)));
      return;
    }
    setSelected((current) => [...new Set([...current, ...visibleFiles.map((file) => file.name)])]);
  };

  const typeCounts = files.reduce<Record<StorageAudioFileType, number>>(
    (counts, file) => {
      counts[file.type] += 1;
      return counts;
    },
    { "host-preview": 0, program: 0, segment: 0 },
  );

  return (
    <section className="admin-page storage-page">
      <div className="admin-page-title admin-page-title--with-action">
        <div>
          <span>附件管理</span>
          <h1>管理服务端音频附件</h1>
          <p>查看节目音频、分段文件和主播试听文件，支持批量删除未引用附件与自动清理。</p>
        </div>
        <button className="admin-primary-button" disabled={busy} onClick={loadStorage} type="button">
          {busy ? <Loader2 className="spin-icon" size={19} /> : <RefreshCw size={19} />}
          <span>{busy ? "处理中" : "刷新"}</span>
        </button>
      </div>

      <section className="admin-card">
        <div className="admin-metric-grid">
          <AdminMetric label="附件总数" value={String(files.length)} />
          <AdminMetric label="占用空间" value={formatStorageSize(totalSize)} />
          <AdminMetric label="已引用" value={String(linkedCount)} />
          <AdminMetric label="可清理" value={String(unlinkedCount)} />
        </div>
      </section>

      <section className="admin-card storage-controls">
        <div className="storage-filter-row">
          <label className="config-field">
            <span>搜索文件</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入文件名关键字" />
          </label>
          <label className="config-field">
            <span>文件类型</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
              <option value="all">全部类型</option>
              {Object.entries(STORAGE_FILE_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}（{typeCounts[value as StorageAudioFileType]}）
                </option>
              ))}
            </select>
          </label>
          <label className="config-field">
            <span>引用状态</span>
            <select value={referenceFilter} onChange={(event) => setReferenceFilter(event.target.value as typeof referenceFilter)}>
              <option value="all">全部状态</option>
              <option value="linked">已引用</option>
              <option value="unlinked">未引用</option>
            </select>
          </label>
        </div>
        <div className="storage-action-row">
          <button disabled={!visibleFiles.length} onClick={toggleVisible} type="button">
            {visibleSelected ? "取消当前列表" : "选择当前列表"}
          </button>
          <button disabled={!selected.length} onClick={() => setSelected([])} type="button">
            清空选择
          </button>
          <button className="is-danger" disabled={!selected.length || busy} onClick={deleteSelected} type="button">
            <Trash2 size={16} />
            <span>删除所选</span>
          </button>
          <small>
            已选 {selected.length} 个，约 {formatStorageSize(selectedSize)}
          </small>
        </div>
      </section>

      <section className="admin-card storage-file-card">
        <h2>音频附件</h2>
        <div className="storage-file-list">
          {visibleFiles.map((file) => (
            <article className="storage-file-row" key={file.name}>
              <label className="storage-file-check" title={file.referenced ? "仍被节目引用，默认不会删除" : "未引用，可清理"}>
                <input
                  checked={selectedSet.has(file.name)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked ? [...new Set([...current, file.name])] : current.filter((name) => name !== file.name),
                    )
                  }
                  type="checkbox"
                />
              </label>
              <span className="storage-file-icon">
                <FileAudio size={18} />
              </span>
              <div className="storage-file-main">
                <strong>{file.name}</strong>
                <small>
                  {STORAGE_FILE_TYPE_LABEL[file.type]} · {formatStorageSize(file.size)} · {formatAdminDateTime(file.mtime)}
                </small>
              </div>
              <span className={file.referenced ? "storage-badge storage-badge--linked" : "storage-badge"}>{file.referenced ? "已引用" : "未引用"}</span>
              <a href={`/storage/audio/${encodeURIComponent(file.name)}`} target="_blank" rel="noreferrer">
                打开
              </a>
            </article>
          ))}
          {!visibleFiles.length ? <div className="program-empty program-empty--compact">没有符合条件的附件。</div> : null}
        </div>
      </section>

      <div className="storage-bottom-grid">
        <section className="admin-card storage-cleanup-card">
          <h2>手动清理</h2>
          <div className="storage-cleanup-options">
            {STORAGE_CLEANUP_OPTIONS.map((option) => (
              <button
                className={cleanupMode === option.mode ? "is-active" : ""}
                key={option.mode}
                onClick={() => setCleanupMode(option.mode)}
                type="button"
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
          <button className="admin-primary-button" disabled={busy} onClick={runCleanup} type="button">
            {busy ? <Loader2 className="spin-icon" size={18} /> : <Trash2 size={18} />}
            <span>执行清理</span>
          </button>
        </section>

        <section className="admin-card storage-cleanup-card">
          <h2>自动清理</h2>
          <div className="config-grid config-grid--compact">
            <label className="admin-switch">
              <input
                checked={config.autoCleanupEnabled}
                onChange={(event) => setConfig((current) => ({ ...current, autoCleanupEnabled: event.target.checked }))}
                type="checkbox"
              />
              <span>启用每日自动清理</span>
            </label>
            <label className="admin-switch">
              <input
                checked={config.autoCleanupKeepProgramAudio}
                onChange={(event) => setConfig((current) => ({ ...current, autoCleanupKeepProgramAudio: event.target.checked }))}
                type="checkbox"
              />
              <span>保留已引用音频</span>
            </label>
            <label className="config-field">
              <span>过期天数</span>
              <input
                min={1}
                max={365}
                type="number"
                value={config.autoCleanupMaxAgeDays}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    autoCleanupMaxAgeDays: clampNumber(event.target.value, 1, 365, current.autoCleanupMaxAgeDays),
                  }))
                }
              />
            </label>
            <label className="config-field">
              <span>上次自动清理</span>
              <input readOnly value={formatAdminDateTime(config.autoCleanupLastRun)} />
            </label>
          </div>
          <button className="admin-primary-button" disabled={busy} onClick={saveConfig} type="button">
            {busy ? <Loader2 className="spin-icon" size={18} /> : <Save size={18} />}
            <span>保存配置</span>
          </button>
        </section>
      </div>

      <div className="storage-status">{status}</div>
    </section>
  );
}

function AudioMixEditor({
  audioMix,
  onChange,
  soundEffectCategories,
  title,
}: {
  audioMix: AudioMixConfig;
  onChange: (value: AudioMixConfig) => void;
  soundEffectCategories: SoundEffectCategory[];
  title: string;
}) {
  const effects = soundEffectCategories.flatMap((category) =>
    category.effects.map((effect) => ({
      ...effect,
      categoryName: category.name,
    })),
  );
  const selectedIds = new Set(audioMix.effectIds);
  const update = (patch: Partial<AudioMixConfig>) => onChange(normalizeAudioMix({ ...audioMix, ...patch }));
  const toggleEffect = (effectId: string) => {
    const nextEffectIds = selectedIds.has(effectId)
      ? audioMix.effectIds.filter((id) => id !== effectId)
      : [...audioMix.effectIds, effectId];
    update({
      effectIds: nextEffectIds,
      enabled: nextEffectIds.length > 0,
    });
  };

  return (
    <div className="audio-mix-editor">
      <div className="audio-mix-editor__head">
        <strong>{title}</strong>
        <label className="admin-switch">
          <input
            checked={audioMix.enabled}
            onChange={(event) =>
              update(event.target.checked ? { enabled: true } : { effectIds: [], enabled: false })
            }
            type="checkbox"
          />
          <span>{audioMix.enabled ? "已启用" : "已停用"}</span>
        </label>
      </div>
      <div className="sound-effect-picker" role="list">
        {effects.length ? (
          effects.map((effect) => (
            <label className={selectedIds.has(effect.id) ? "is-active" : ""} key={effect.id} role="listitem">
              <input checked={selectedIds.has(effect.id)} onChange={() => toggleEffect(effect.id)} type="checkbox" />
              <span>
                <strong>{effect.name}</strong>
                <small>{effect.categoryName}</small>
              </span>
              <em>{selectedIds.has(effect.id) ? "已选择" : "选择"}</em>
            </label>
          ))
        ) : (
          <p>暂无可用音效。</p>
        )}
      </div>
      <div className="config-grid config-grid--compact audio-mix-grid">
        <ConfigField label="循环方式">
          <select value={audioMix.loopMode} onChange={(event) => update({ loopMode: event.target.value as AudioMixConfig["loopMode"] })}>
            <option value="single">单条循环</option>
            <option value="sequence">多条循环</option>
          </select>
        </ConfigField>
        <ConfigField label="播放顺序">
          <select value={audioMix.startMode} onChange={(event) => update({ startMode: event.target.value as AudioMixConfig["startMode"] })}>
            <option value="voice-first">先播 AI 配音</option>
            <option value="effect-first">先播背景音效</option>
          </select>
        </ConfigField>
        <ConfigField label="间隔秒数">
          <input
            min={0}
            max={30}
            step={1}
            type="number"
            value={audioMix.leadSeconds}
            onChange={(event) => update({ leadSeconds: Number(event.target.value) })}
          />
        </ConfigField>
        <ConfigField label={`背景音量 ${Math.round(audioMix.volume * 100)}%`}>
          <input
            min={0}
            max={1}
            step={0.05}
            type="range"
            value={audioMix.volume}
            onChange={(event) => update({ volume: Number(event.target.value) })}
          />
        </ConfigField>
      </div>
    </div>
  );
}

function MusicSourceQrLogin({
  onCookie,
  onLoggedIn,
  provider,
}: {
  onCookie: (cookie: string) => void;
  onLoggedIn?: () => void | Promise<void>;
  provider: "netease" | "qq";
}) {
  const label = provider === "netease" ? "网易云音乐" : "QQ 音乐";
  const [busy, setBusy] = useState(false);
  const [loginType, setLoginType] = useState<"qq" | "wx">("wx");
  const [qr, setQr] = useState<{ key: string; loginType?: "qq" | "wx"; qrImage: string; qrUrl: string } | null>(null);
  const [status, setStatus] = useState(`${label}尚未扫码登录`);

  const createQr = async (nextLoginType: "qq" | "wx" = loginType) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setStatus(`正在生成${label}二维码...`);
    try {
      const result = await apiJson<{ key: string; message?: string; qrImage: string; qrUrl: string }>(
        `/api/plugins/music/${provider}/login/qr`,
        {
          body: JSON.stringify(provider === "qq" ? { type: nextLoginType } : {}),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      setLoginType(nextLoginType);
      setQr({ key: result.key, loginType: nextLoginType, qrImage: result.qrImage, qrUrl: result.qrUrl });
      setStatus(result.message ?? `${label}二维码已生成`);
    } catch (error) {
      setStatus(`${label}二维码生成失败：${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!qr?.key) {
      return;
    }
    let stopped = false;
    let timer = 0;
    const key = qr.key;
    const poll = async () => {
      try {
        const result = await apiJson<{ cookie?: string; message?: string; status: number }>(
          `/api/plugins/music/${provider}/login/check`,
          {
            body: JSON.stringify({ key }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
        );
        if (stopped) {
          return;
        }
        if (result.status === 4) {
          if (result.cookie) {
            onCookie(result.cookie);
          }
          setStatus(result.message ?? `${label}登录成功，Cookie 已自动填入并保存`);
          setQr(null);
          await onLoggedIn?.();
          return;
        }
        if (result.status === 0) {
          setStatus(result.message ?? `${label}二维码已过期，请重新扫码`);
          setQr(null);
          return;
        }
        setStatus(`${result.message ?? "等待扫码"} · 正在自动检测`);
      } catch (error) {
        if (!stopped) {
          setStatus(`扫码状态检测暂时失败，将继续重试：${errorMessage(error)}`);
        }
      }
      if (!stopped) {
        timer = window.setTimeout(() => void poll(), 1800);
      }
    };
    timer = window.setTimeout(() => void poll(), 700);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [label, onCookie, onLoggedIn, provider, qr?.key]);

  return (
    <>
      <div className="kugou-action-row">
        <button disabled={busy} onClick={() => void createQr(provider === "qq" ? "wx" : "wx")} type="button">
          {busy ? <Loader2 className="spin-icon" size={18} /> : <QrCode size={18} />}
          <span>{provider === "qq" ? "微信扫码登录（推荐）" : "扫码登录"}</span>
        </button>
        {provider === "qq" ? (
          <button disabled={busy} onClick={() => void createQr("qq")} type="button">
            <QrCode size={18} />
            <span>QQ 扫码登录</span>
          </button>
        ) : null}
        {qr ? <span className="kugou-auto-check"><Loader2 className="spin-icon" size={17} />自动检测扫码状态</span> : null}
      </div>
      {qr ? (
        <div className="kugou-qr-panel">
          {qr.qrImage ? <img alt={`${label}扫码登录二维码`} src={qr.qrImage} /> : null}
          <span>
            <strong>二维码已生成</strong>
            <small>{provider === "qq"
              ? qr.loginType === "qq"
                ? "请使用 QQ App 内置“扫一扫”，不要使用系统相机"
                : "请使用微信“扫一扫”并在手机端确认"
              : "请使用网易云音乐 App 扫码并确认"}</small>
            {qr.qrUrl ? <a href={qr.qrUrl} rel="noreferrer" target="_blank">打开扫码链接</a> : null}
          </span>
        </div>
      ) : null}
      <p className="kugou-status">{status}</p>
    </>
  );
}

function MusicCookieHelp({ provider }: { provider: "netease" | "qq" }) {
  const netease = provider === "netease";
  return (
    <details className="music-cookie-help">
      <summary>扫码受限？查看手动获取 Cookie 方法</summary>
      <div>
        <p>
          {netease
            ? "网易云可能按账号或设备触发风控。遇到“设备环境异常”时，可直接使用已登录浏览器的 Cookie。"
            : "扫码无法完成时，可从已登录 QQ 音乐网页版复制 Cookie，不需要打开二维码里的下载页。"}
        </p>
        <ol>
          <li>在电脑浏览器打开并登录 <a href={netease ? "https://music.163.com/" : "https://y.qq.com/"} rel="noreferrer" target="_blank">{netease ? "网易云音乐网页版" : "QQ 音乐网页版"}</a>。</li>
          <li>按 F12 打开开发者工具，在“网络 / Network”中刷新页面，点开任意 music 请求。</li>
          <li>复制“请求标头 / Request Headers”里的完整 Cookie，粘贴到上方 Cookie 输入框，再保存接口配置。</li>
        </ol>
        <small>
          {netease
            ? "至少应包含 MUSIC_U；建议保留 __csrf、NMTID 等同域字段。"
            : "至少应包含 uin，以及 qm_keyst 或 qqmusic_key；请勿把 Cookie 发给他人。"}
        </small>
      </div>
    </details>
  );
}

function AdminPluginPage(props: AdminShellProps) {
  const {
    adminConfig,
    configTestStatus,
    kugouLoginBusy,
    kugouQr,
    kugouStatus,
    onAdminConfigChange,
    onAdminConfigSave,
    onKugouQrCreate,
    onKugouStatusRefresh,
    onSectionChange,
    onTestService,
  } = props;
  const daily = adminConfig.plugins.dailyBriefing;
  const hot = adminConfig.plugins.hotTopics;
  const kugou = adminConfig.plugins.kugouMusic;
  const netease = adminConfig.plugins.neteaseMusic;
  const qq = adminConfig.plugins.qqMusic;
  const [musicApiStatus, setMusicApiStatus] = useState<Array<{
    authenticated: boolean;
    enabled: boolean;
    id: string;
    installed: boolean;
    message: string;
    name: string;
  }>>([]);

  const refreshMusicApiStatus = useCallback(async () => {
    try {
      const data = await apiJson<{ sources: typeof musicApiStatus }>("/api/plugins/music/status");
      setMusicApiStatus(data.sources ?? []);
    } catch {
      setMusicApiStatus([]);
    }
  }, []);

  useEffect(() => {
    void refreshMusicApiStatus();
  }, [refreshMusicApiStatus]);

  const sourceStatus = (id: string) => musicApiStatus.find((source) => source.id === id);
  const saveAndRefresh = async () => {
    await onAdminConfigSave();
    await refreshMusicApiStatus();
  };

  return (
    <section className="admin-page">
      <div className="admin-page-title admin-page-title--with-action">
        <div>
          <span>接口 API</span>
          <h1>只管理接口连接与凭据</h1>
          <p>节目名称、主播、条数、榜单类型、选歌和混音等业务设置已移到“节目制作”。{configTestStatus.plugins ? ` 当前状态：${configTestStatus.plugins}` : ""}</p>
        </div>
        <div className="api-page-actions">
          <button onClick={() => onTestService("plugins")} type="button"><ShieldCheck size={17} /><span>检查完整性</span></button>
          <button className="admin-primary-button" onClick={saveAndRefresh} type="button"><Save size={18} /><span>保存接口配置</span></button>
        </div>
      </div>

      <div className="api-config-grid">
        <section className="admin-card api-config-section">
          <div className="api-config-head">
            <span><Newspaper size={21} /></span>
            <div><h2>每日早报 API</h2><p>ALAPI 连接地址与访问令牌。</p></div>
            <i className={`status-dot status-dot--${daily.enabled ? "good" : "bad"}`} />
          </div>
          <div className="config-grid config-grid--compact">
            <ConfigField label="启用接口"><label className="admin-switch"><input checked={daily.enabled} onChange={(event) => onAdminConfigChange("plugins", "dailyBriefing", { ...daily, enabled: event.target.checked })} type="checkbox" /><span>{daily.enabled ? "已启用" : "已停用"}</span></label></ConfigField>
            <ConfigField label="API Endpoint"><input value={daily.apiBaseUrl} onChange={(event) => onAdminConfigChange("plugins", "dailyBriefing", { ...daily, apiBaseUrl: event.target.value })} /></ConfigField>
            <ConfigField hint="凭据保存在服务端 SQLite。" label="ALAPI Token"><input autoComplete="off" type="password" value={daily.token} onChange={(event) => onAdminConfigChange("plugins", "dailyBriefing", { ...daily, token: event.target.value })} /></ConfigField>
          </div>
        </section>

        <section className="admin-card api-config-section">
          <div className="api-config-head">
            <span><Flame size={21} /></span>
            <div><h2>今日热榜 API</h2><p>ALAPI 连接地址与访问令牌。</p></div>
            <i className={`status-dot status-dot--${hot.enabled ? "good" : "bad"}`} />
          </div>
          <div className="config-grid config-grid--compact">
            <ConfigField label="启用接口"><label className="admin-switch"><input checked={hot.enabled} onChange={(event) => onAdminConfigChange("plugins", "hotTopics", { ...hot, enabled: event.target.checked })} type="checkbox" /><span>{hot.enabled ? "已启用" : "已停用"}</span></label></ConfigField>
            <ConfigField label="API Endpoint"><input value={hot.apiBaseUrl} onChange={(event) => onAdminConfigChange("plugins", "hotTopics", { ...hot, apiBaseUrl: event.target.value })} /></ConfigField>
            <ConfigField hint="留空时沿用每日早报 Token。" label="ALAPI Token"><input autoComplete="off" placeholder="留空沿用早报 Token" type="password" value={hot.token} onChange={(event) => onAdminConfigChange("plugins", "hotTopics", { ...hot, token: event.target.value })} /></ConfigField>
          </div>
        </section>
      </div>

      <div className="music-api-grid">
        <section className="admin-card api-config-section music-api-card">
          <div className="api-config-head">
            <span><Disc3 size={21} /></span>
            <div><h2>酷狗音乐 API</h2><p>本地模块 KuGouMusicApi · 支持扫码登录。</p></div>
            <i className={`status-dot status-dot--${sourceStatus("kugou")?.installed && kugou.apiEnabled ? "good" : "bad"}`} />
          </div>
          <div className="config-grid config-grid--compact">
            <ConfigField label="启用接口"><label className="admin-switch"><input checked={kugou.apiEnabled} onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...kugou, apiEnabled: event.target.checked })} type="checkbox" /><span>{kugou.apiEnabled ? "已启用" : "已停用"}</span></label></ConfigField>
            <ConfigField label="本地模块"><input readOnly value="KuGouMusicApi/main.js" /></ConfigField>
            <ConfigField label="酷狗 Cookie"><input autoComplete="off" type="password" value={kugou.cookie} onChange={(event) => onAdminConfigChange("plugins", "kugouMusic", { ...kugou, cookie: event.target.value })} /></ConfigField>
          </div>
          <div className="kugou-action-row">
            <button type="button" onClick={onKugouStatusRefresh}><RefreshCw size={18} /><span>检测登录态</span></button>
            <button disabled={kugouLoginBusy} type="button" onClick={onKugouQrCreate}>{kugouLoginBusy ? <Loader2 className="spin-icon" size={18} /> : <QrCode size={18} />}<span>扫码登录</span></button>
            {kugouQr ? <span className="kugou-auto-check"><Loader2 className="spin-icon" size={17} />自动检测扫码状态</span> : null}
          </div>
          {kugouQr ? <div className="kugou-qr-panel">{kugouQr.qrImage ? <img alt="酷狗扫码登录二维码" src={kugouQr.qrImage} /> : null}<span><strong>二维码已生成</strong>{kugouQr.qrUrl ? <a href={kugouQr.qrUrl} target="_blank" rel="noreferrer">打开扫码链接</a> : null}</span></div> : null}
          <p className="kugou-status">{kugouStatus}</p>
        </section>

        <section className="admin-card api-config-section music-api-card">
          <div className="api-config-head">
            <span><Music2 size={21} /></span>
            <div><h2>网易云音乐 API</h2><p>本地模块 NeteaseCloudMusicApi · 支持扫码自动获取 Cookie。</p></div>
            <i className={`status-dot status-dot--${sourceStatus("netease")?.installed && netease.enabled ? "good" : "bad"}`} />
          </div>
          <div className="config-grid config-grid--compact">
            <ConfigField label="启用接口"><label className="admin-switch"><input checked={netease.enabled} onChange={(event) => onAdminConfigChange("plugins", "neteaseMusic", { ...netease, enabled: event.target.checked })} type="checkbox" /><span>{netease.enabled ? "已启用" : "已停用"}</span></label></ConfigField>
            <ConfigField label="本地模块"><input readOnly value="NeteaseCloudMusicApi/main.js" /></ConfigField>
            <ConfigField hint="扫码成功后自动回填并保存；也支持手动填写。" label="网易云 Cookie"><input autoComplete="off" type="password" value={netease.cookie} onChange={(event) => onAdminConfigChange("plugins", "neteaseMusic", { ...netease, cookie: event.target.value })} /></ConfigField>
          </div>
          <MusicSourceQrLogin
            onCookie={(cookie) => onAdminConfigChange("plugins", "neteaseMusic", { ...netease, cookie })}
            onLoggedIn={refreshMusicApiStatus}
            provider="netease"
          />
          <MusicCookieHelp provider="netease" />
          <p className="kugou-status">模块状态：{sourceStatus("netease")?.message ?? "等待检测本地 API"}</p>
        </section>

        <section className="admin-card api-config-section music-api-card">
          <div className="api-config-head">
            <span><Headphones size={21} /></span>
            <div><h2>QQ 音乐 API</h2><p>本地模块 QQMusicApi · 支持微信或 QQ 扫码自动获取 Cookie。</p></div>
            <i className={`status-dot status-dot--${sourceStatus("qq")?.installed && qq.enabled ? "good" : "bad"}`} />
          </div>
          <div className="config-grid config-grid--compact">
            <ConfigField label="启用接口"><label className="admin-switch"><input checked={qq.enabled} onChange={(event) => onAdminConfigChange("plugins", "qqMusic", { ...qq, enabled: event.target.checked })} type="checkbox" /><span>{qq.enabled ? "已启用" : "已停用"}</span></label></ConfigField>
            <ConfigField label="本地模块"><input readOnly value="QQMusicApi/node/index.js" /></ConfigField>
            <ConfigField hint="扫码成功后自动回填并保存；付费歌曲仍受账号权益限制。" label="QQ 音乐 Cookie"><input autoComplete="off" type="password" value={qq.cookie} onChange={(event) => onAdminConfigChange("plugins", "qqMusic", { ...qq, cookie: event.target.value })} /></ConfigField>
          </div>
          <MusicSourceQrLogin
            onCookie={(cookie) => onAdminConfigChange("plugins", "qqMusic", { ...qq, cookie })}
            onLoggedIn={refreshMusicApiStatus}
            provider="qq"
          />
          <MusicCookieHelp provider="qq" />
          <p className="kugou-status">模块状态：{sourceStatus("qq")?.message ?? "等待检测本地 API"}</p>
        </section>
      </div>

      <section className="admin-card api-page-footer">
        <span>接口页只负责连接与凭据；节目内容、主播、条数、音乐来源和选歌规则请在节目制作设置。</span>
        <button onClick={() => onSectionChange("studio")} type="button"><WandSparkles size={16} /><span>前往节目制作</span></button>
      </section>
    </section>
  );
}

function LegacyAdminPluginPage(props: AdminShellProps) {
  const {
    adminConfig,
    configTestStatus,
    kugouApiBusy,
    kugouApiName,
    kugouApiParams,
    kugouApiResult,
    kugouLoginBusy,
    kugouQr,
    kugouStatus,
    manualMusicQuery,
    manualMusicResults,
    manualMusicSearchBusy,
    manualMusicSelected,
    manualMusicStatus,
    onAdminConfigChange,
    onAdminConfigSave,
    onKugouApiCall,
    onKugouApiNameChange,
    onKugouApiParamsChange,
    onKugouQrCreate,
    onKugouStatusRefresh,
    onManualMusicAdd,
    onManualMusicQueryChange,
    onManualMusicRemove,
    onManualMusicReorder,
    onManualMusicSearch,
    onSectionChange,
    onTestService,
    soundEffectCategories,
  } = props;
  const dailyBriefing = adminConfig.plugins.dailyBriefing;
  const hotTopics = adminConfig.plugins.hotTopics;
  const kugou = adminConfig.plugins.kugouMusic;
  const updateDaily = (patch: Partial<typeof dailyBriefing>) =>
    onAdminConfigChange("plugins", "dailyBriefing", { ...dailyBriefing, ...patch });
  const updateHotTopics = (patch: Partial<typeof hotTopics>) =>
    onAdminConfigChange("plugins", "hotTopics", { ...hotTopics, ...patch });

  return (
    <section className="admin-page">
      <div className="admin-page-title admin-page-title--with-action">
        <div>
          <span>接口 API</span>
          <h1>内容数据与音乐接口</h1>
          <p>每日早报、今日热榜和酷狗音乐的连接、凭据与高级调用统一在这里维护。{configTestStatus.plugins ? ` 当前状态：${configTestStatus.plugins}` : ""}</p>
        </div>
        <div className="api-page-actions">
          <button onClick={() => onTestService("plugins")} type="button"><ShieldCheck size={17} /><span>检查完整性</span></button>
          <button className="admin-primary-button" onClick={onAdminConfigSave} type="button"><Save size={18} /><span>保存接口配置</span></button>
        </div>
      </div>

      <div className="api-config-grid">
        <section className="admin-card api-config-section">
          <div className="api-config-head">
            <span><Newspaper size={21} /></span>
            <div><h2>每日早报 API</h2><p>ALAPI 早报内容采集及播报参数。</p></div>
            <i className={`status-dot status-dot--${dailyBriefing.enabled ? "good" : "bad"}`} />
          </div>
          <div className="config-grid config-grid--compact">
            <ConfigField label="启用接口"><label className="admin-switch"><input checked={dailyBriefing.enabled} onChange={(event) => updateDaily({ enabled: event.target.checked })} type="checkbox" /><span>{dailyBriefing.enabled ? "已启用" : "已停用"}</span></label></ConfigField>
            <ConfigField label="节目名称"><input value={dailyBriefing.name} onChange={(event) => updateDaily({ name: event.target.value })} /></ConfigField>
            <ConfigField label="API Endpoint"><input value={dailyBriefing.apiBaseUrl} onChange={(event) => updateDaily({ apiBaseUrl: event.target.value })} /></ConfigField>
            <ConfigField hint="凭据仅保存在服务端 SQLite。" label="ALAPI Token"><input autoComplete="off" type="password" value={dailyBriefing.token} onChange={(event) => updateDaily({ token: event.target.value })} /></ConfigField>
            <ConfigField label="播报主播"><select value={dailyBriefing.hostId} onChange={(event) => updateDaily({ hostId: event.target.value })}>{hosts.map((host) => <option key={host.id} value={host.id}>{host.name}</option>)}</select></ConfigField>
            <ConfigField label="最多条数"><input max={30} min={3} type="number" value={dailyBriefing.maxItems} onChange={(event) => updateDaily({ maxItems: Number(event.target.value) })} /></ConfigField>
            <ConfigField label="播报速度"><input max={2} min={0.5} step={0.05} type="number" value={dailyBriefing.playbackSpeed} onChange={(event) => updateDaily({ playbackSpeed: clampNumber(event.target.value, 0.5, 2, 1) })} /></ConfigField>
          </div>
          <AudioMixEditor audioMix={dailyBriefing.audioMix} onChange={(audioMix) => updateDaily({ audioMix })} soundEffectCategories={soundEffectCategories} title="每日早报背景音" />
        </section>

        <section className="admin-card api-config-section">
          <div className="api-config-head">
            <span><Flame size={21} /></span>
            <div><h2>今日热榜 API</h2><p>ALAPI 热榜数据采集、榜单类型及播报参数。</p></div>
            <i className={`status-dot status-dot--${hotTopics.enabled ? "good" : "bad"}`} />
          </div>
          <div className="config-grid config-grid--compact">
            <ConfigField label="启用接口"><label className="admin-switch"><input checked={hotTopics.enabled} onChange={(event) => updateHotTopics({ enabled: event.target.checked })} type="checkbox" /><span>{hotTopics.enabled ? "已启用" : "已停用"}</span></label></ConfigField>
            <ConfigField label="节目名称"><input value={hotTopics.name} onChange={(event) => updateHotTopics({ name: event.target.value })} /></ConfigField>
            <ConfigField label="API Endpoint"><input value={hotTopics.apiBaseUrl} onChange={(event) => updateHotTopics({ apiBaseUrl: event.target.value })} /></ConfigField>
            <ConfigField hint="留空时沿用每日早报 Token。" label="ALAPI Token"><input autoComplete="off" placeholder="留空沿用早报 Token" type="password" value={hotTopics.token} onChange={(event) => updateHotTopics({ token: event.target.value })} /></ConfigField>
            <ConfigField label="热榜类型"><input placeholder="weibo" value={hotTopics.type} onChange={(event) => updateHotTopics({ type: event.target.value })} /></ConfigField>
            <ConfigField label="播报主播"><select value={hotTopics.hostId} onChange={(event) => updateHotTopics({ hostId: event.target.value })}>{hosts.map((host) => <option key={host.id} value={host.id}>{host.name}</option>)}</select></ConfigField>
            <ConfigField label="最多条数"><input max={30} min={3} type="number" value={hotTopics.maxItems} onChange={(event) => updateHotTopics({ maxItems: Number(event.target.value) })} /></ConfigField>
            <ConfigField label="播报速度"><input max={2} min={0.5} step={0.05} type="number" value={hotTopics.playbackSpeed} onChange={(event) => updateHotTopics({ playbackSpeed: clampNumber(event.target.value, 0.5, 2, 1) })} /></ConfigField>
          </div>
          <AudioMixEditor audioMix={hotTopics.audioMix} onChange={(audioMix) => updateHotTopics({ audioMix })} soundEffectCategories={soundEffectCategories} title="今日热榜背景音" />
        </section>
      </div>

      <section className="admin-card api-config-section api-config-section--kugou">
        <div className="api-config-head">
          <span><Disc3 size={21} /></span>
          <div><h2>酷狗音乐 API</h2><p>音乐来源、登录 Cookie、扫码登录、歌曲搜索与高级 API 调用。</p></div>
          <i className={`status-dot status-dot--${kugou.enabled ? "good" : "bad"}`} />
        </div>
        <KugouConfigPanel
          adminConfig={adminConfig}
          kugou={kugou}
          onAdminConfigChange={onAdminConfigChange}
          kugouApiBusy={kugouApiBusy}
          kugouApiName={kugouApiName}
          kugouApiParams={kugouApiParams}
          kugouApiResult={kugouApiResult}
          kugouLoginBusy={kugouLoginBusy}
          kugouQr={kugouQr}
          kugouStatus={kugouStatus}
          manualMusicQuery={manualMusicQuery}
          manualMusicResults={manualMusicResults}
          manualMusicSearchBusy={manualMusicSearchBusy}
          manualMusicSelected={manualMusicSelected}
          manualMusicStatus={manualMusicStatus}
          onKugouApiCall={onKugouApiCall}
          onKugouApiNameChange={onKugouApiNameChange}
          onKugouApiParamsChange={onKugouApiParamsChange}
          onKugouQrCreate={onKugouQrCreate}
          onKugouStatusRefresh={onKugouStatusRefresh}
          onManualMusicAdd={onManualMusicAdd}
          onManualMusicQueryChange={onManualMusicQueryChange}
          onManualMusicRemove={onManualMusicRemove}
          onManualMusicReorder={onManualMusicReorder}
          onManualMusicSearch={onManualMusicSearch}
        />
      </section>

      <section className="admin-card api-page-footer">
        <span>接口保存后，到节目制作选择对应节目类型即可生成；自定义音乐歌单请在“音乐连播”管理。</span>
        <button onClick={() => onSectionChange("studio")} type="button"><WandSparkles size={16} /><span>前往节目制作</span></button>
      </section>
    </section>
  );
}

function TrackActionButtons({
  currentTrackId,
  favorites,
  onFavorite,
  onPlay,
  playing,
  track,
}: {
  currentTrackId: string;
  favorites: string[];
  onFavorite: (trackId: string) => void;
  onPlay: (track: Track) => void;
  playing: boolean;
  track: Track;
}) {
  const active = favorites.includes(track.id);
  const isCurrentPlaying = currentTrackId === track.id && playing;

  return (
    <span className="inline-track-actions">
      <button className="track-icon-button" onClick={() => onPlay(track)} title={isCurrentPlaying ? "暂停" : "播放"} type="button">
        {isCurrentPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>
      <button
        className={`track-icon-button favorite-button ${active ? "is-active" : ""}`}
        onClick={() => onFavorite(track.id)}
        title={active ? "取消收藏" : "加入收藏"}
        type="button"
      >
        {active ? <Heart size={20} fill="currentColor" /> : <Plus size={20} />}
      </button>
    </span>
  );
}

function SecondaryPage({
  adminConfig,
  activeNav,
  backendStatus,
  configSavedAt,
  configTestStatus,
  currentTrackId,
  dailyBriefingBusy,
  favoriteTracks,
  favorites,
  generatedProgram,
  hotTopicsBusy,
  libraryTracks,
  manualMusicQuery,
  manualMusicResults,
  manualMusicSearchBusy,
  manualMusicSelected,
  manualMusicStatus,
  programDraft,
  reminders,
  onAdminConfigChange,
  onAdminConfigSave,
  onDailyBriefingGenerate,
  onDeleteProgram,
  onFavorite,
  onGenerateProgram,
  onHotTopicsGenerate,
  onManualMusicAdd,
  onManualMusicQueryChange,
  onManualMusicRemove,
  onManualMusicReorder,
  onManualMusicSearch,
  onPlay,
  onProgramCategoryCreate,
  onProgramCategoryDelete,
  onProgramCategoryRename,
  onProgramDraftChange,
  onProgramHostToggle,
  onProgramMetadataSave,
  onProgramPlaybackSpeedChange,
  onProgramPromptChange,
  onProgramPublishNextDay,
  onProgramPushHome,
  onProgramRegenerateTts,
  onProgramReorder,
  onProgramRewriteScript,
  onProgramSaveDraft,
  onProgramScheduledTimeChange,
  onProgramScheduleDraftChange,
  onProgramScheduleSave,
  onProgramSelect,
  onProgramTitleChange,
  onSelectNav,
  onTestService,
  onUserLogout,
  programAudioRef,
  programBusy,
  programCategories,
  programHostIds,
  programHistory,
  programPlaybackSpeed,
  programPushBusyId,
  programPrompt,
  programScheduledTime,
  playing,
  userLoggedIn,
  programRewriteBusy,
  programStatus,
  programTtsBusy,
  programTitle,
  publishBusy,
  rankedTracks,
  scheduleDrafts,
}: SecondaryPageProps) {
  const serviceHealth = (service: "llm" | "tts" | "suno") => {
    const config = adminConfig[service];
    const status = configTestStatus[service];
    const missingApiKey = service === "suno"
      ? !String(adminConfig.suno.cookie ?? "").trim()
      : service === "tts" && ttsApiKeyOptional(adminConfig.tts)
        ? false
        : !String((config as LlmConfig | TtsConfig).apiKey ?? "").trim();
    const missingEndpoint = !String(config.baseUrl ?? "").trim();
    const missingConfig =
      missingEndpoint ||
      missingApiKey ||
      !String(config.model ?? "").trim() ||
      !config.enabled;
    const abnormal = missingConfig || /失败|缺少|异常|停用/u.test(status);
    return abnormal ? "bad" : "good";
  };
  const discoverFeaturedTrack = rankedTracks[0];
  const discoverFeaturedPlaying = Boolean(discoverFeaturedTrack && discoverFeaturedTrack.id === currentTrackId && playing);
  const firstLibraryTrack = libraryTracks[0];
  const firstLibraryPlaying = Boolean(firstLibraryTrack && firstLibraryTrack.id === currentTrackId && playing);
  const libraryTrackIds = new Set(libraryTracks.map((track) => track.id));
  const libraryFavoriteTracks = favoriteTracks.filter((track) => libraryTrackIds.has(track.id));
  const reminderPrograms = programHistory.filter((program) => reminders.includes(program.id)).slice(0, 5);
  const accountRecentTracks = (favoriteTracks.length ? favoriteTracks : rankedTracks).slice(0, 4);
  const discoveryScenes = [
    { id: "new-songs", title: "新歌速递", copy: "适合快速听到今日新增歌曲和轻量推荐。", target: "乐库" },
    { id: "classic", title: "经典老歌", copy: "把耐听旋律整理成一组连续直播歌单。", target: "乐库" },
    { id: "commute", title: "通勤加油站", copy: "节奏更明快，适合路上或工作前打开。", target: "首页" },
    { id: "night", title: "深夜陪伴", copy: "降低信息密度，让声音和音乐自然过渡。", target: "首页" },
  ];

  if (activeNav === "后台配置") {
    return (
      <AdminConfigPage
        config={adminConfig}
        savedAt={configSavedAt}
        status={configTestStatus}
        onChange={onAdminConfigChange}
        onSave={onAdminConfigSave}
        onTest={onTestService}
      />
    );
  }

  if (activeNav === "发现") {
    return (
      <>
        <section className="page-hero page-hero--discover">
          <div>
            <span className="page-kicker">
              <Sparkles size={18} />
              今日发现
            </span>
            <h1>把夜色、城市和人声重新混成一段旅程</h1>
            <p>精选节目、直播主题和情绪歌单在这里聚合，适合快速进入新的收听场景。</p>
          </div>
          <button className="page-primary-action" disabled={!discoverFeaturedTrack} onClick={() => discoverFeaturedTrack && onPlay(discoverFeaturedTrack)} type="button">
            {discoverFeaturedPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            <span>{discoverFeaturedPlaying ? "暂停精选" : "播放精选"}</span>
          </button>
        </section>

        <section className="panel page-panel page-panel--wide">
          <PanelTitle icon={<Disc3 size={21} />} title="情绪漫游" />
          <div className="discover-grid">
            {rankedTracks.length ? (
              rankedTracks.map((track) => (
                <article className="discover-card" key={track.id}>
                  <img alt="" src={track.image} />
                  <span>
                    <strong>{track.title}</strong>
                    <small>直播节目 · {formatDuration(track.duration)}</small>
                  </span>
                  <TrackActionButtons
                    currentTrackId={currentTrackId}
                    favorites={favorites}
                    onFavorite={onFavorite}
                    onPlay={onPlay}
                    playing={playing}
                    track={track}
                  />
                </article>
              ))
            ) : (
              <div className="empty-state">暂无AI音乐节目</div>
            )}
          </div>
        </section>

        <section className="panel page-panel">
          <PanelTitle icon={<Radio size={21} />} title="节目主题" />
          <div className="voice-grid">
            {discoveryScenes.map((scene) => (
              <button className="voice-card scene-card" key={scene.id} onClick={() => onSelectNav(scene.target)} type="button">
                <span className="scene-icon">
                  <Sparkles size={22} />
                </span>
                <span>
                  <strong>{scene.title}</strong>
                  <small>{scene.copy}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </>
    );
  }

  if (activeNav === "乐库") {
    return (
      <>
        <section className="page-hero page-hero--ranking">
          <div>
            <span className="page-kicker">
              <ListMusic size={18} />
              乐库
            </span>
            <h1>歌单连播</h1>
            <p>这里只保留含歌曲队列的连播节目，点击播放后按歌单顺序连续播出。</p>
          </div>
          <button className="page-primary-action" disabled={!firstLibraryTrack} onClick={() => firstLibraryTrack && onPlay(firstLibraryTrack)} type="button">
            {firstLibraryPlaying ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}
            <span>{firstLibraryPlaying ? "暂停第一首" : "播放第一首"}</span>
          </button>
        </section>

        <section className="panel page-panel page-panel--wide">
          <PanelTitle icon={<ListMusic size={21} />} title="歌单连播" />
          <div className="rank-list">
            {libraryTracks.length ? (
              libraryTracks.map((track, index) => (
                <div className="rank-row library-row" key={track.id}>
                  <strong className="rank-index">{String(index + 1).padStart(2, "0")}</strong>
                  <img alt="" src={track.image} />
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.playlist?.filter((item) => item.type === "song").length ?? 0} 首歌 · {formatDuration(track.duration)}</small>
                  </span>
                  <TrackActionButtons
                    currentTrackId={currentTrackId}
                    favorites={favorites}
                    onFavorite={onFavorite}
                    onPlay={onPlay}
                    playing={playing}
                    track={track}
                  />
                </div>
              ))
            ) : (
              <div className="empty-state">还没有可播的歌单连播节目，请先在后台“接口 API”配置音乐来源并生成。</div>
            )}
          </div>
        </section>

        <section className="panel page-panel">
          <PanelTitle icon={<Heart size={21} />} title="收藏预览" />
          <div className="trend-list">
            {(libraryFavoriteTracks.length ? libraryFavoriteTracks : libraryTracks.slice(0, 4)).map((track) => (
              <div key={track.id}>
                <time>{formatDuration(track.duration)}</time>
                <span>
                  <strong>{track.title}</strong>
                  <small>AI主播：{track.host}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  if (activeNav === "AI音乐") {
    return (
      <>
        <section className="page-hero page-hero--studio">
          <div>
            <span className="page-kicker">
              <WandSparkles size={18} />
              AI 音乐工作台
            </span>
            <h1>编排节目时间线，发布下一日播出单</h1>
            <p>生成、人工改稿、分类管理和发布时间线都在这里完成；发布会把当前节目队列标记为下一日节目。</p>
          </div>
          <button
            className="page-primary-action ai-generate-button"
            data-testid="publish-programs"
            disabled={publishBusy || !programHistory.length}
            onClick={onProgramPublishNextDay}
            type="button"
          >
            {publishBusy ? <Loader2 className="spin-icon" size={24} /> : <Radio size={24} />}
            <span>{publishBusy ? "发布中" : "发布"}</span>
          </button>
        </section>

        <section className="ai-config-strip">
          <span>
            <Database size={18} />
            {backendStatus}
          </span>
          <span>
            <i className={`status-dot status-dot--${serviceHealth("llm")}`} />
            大模型：{adminConfig.llm.model || "未配置"}
          </span>
          <span>
            <i className={`status-dot status-dot--${serviceHealth("tts")}`} />
            通用语音：{adminConfig.tts.model || "未配置"}
          </span>
          <span>
            <i className={`status-dot status-dot--${serviceHealth("suno")}`} />
            SUNO：{adminConfig.suno.model || "未配置"}
          </span>
        </section>

        <section className="panel page-panel page-panel--wide ai-producer-panel">
          <PanelTitle icon={<WandSparkles size={21} />} title="节目生成与人工编辑" />
          <div className="ai-producer-grid">
            <div className="ai-input-stack">
              <label>
                <span>节目名称</span>
                <input value={programTitle} onChange={(event) => onProgramTitleChange(event.target.value)} />
              </label>
              <label>
                <span>预计播放时间</span>
                <input value={programScheduledTime} onChange={(event) => onProgramScheduledTimeChange(event.target.value)} type="time" />
              </label>
              <label>
                <span>节目主题 / 情绪设定</span>
                <textarea
                  value={programPrompt}
                  onChange={(event) => onProgramPromptChange(event.target.value)}
                />
              </label>
              <div className="ai-host-selector">
                <span>参与主播</span>
                <div>
                  {hosts.map((host) => (
                    <button
                      className={programHostIds.includes(host.id) ? "is-active" : ""}
                      key={host.id}
                      onClick={() => onProgramHostToggle(host.id)}
                      type="button"
                    >
                      <img alt="" src={host.image} />
                      <strong>{host.name}</strong>
                      <small>{adminConfig.tts.hostVoices?.[host.id] ?? "默认音色"}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="studio-grid">
                {["星夜", "城市微雨", "治愈", "爵士", "电子氛围", "故事感"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onProgramPromptChange(`${programPrompt.trim()} ${tag}`.trim())}
                    type="button"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="ai-action-row">
                <button disabled={programBusy} onClick={() => onGenerateProgram()} type="button">
                  {programBusy ? <Loader2 className="spin-icon" size={20} /> : <FileAudio size={20} />}
                  <span>{programBusy ? "正在生成" : "生成节目"}</span>
                </button>
                <button onClick={() => onSelectNav("后台配置")} type="button">
                  <ServerCog size={20} />
                  <span>检查后台配置</span>
                </button>
                <button disabled={dailyBriefingBusy} onClick={onDailyBriefingGenerate} type="button">
                  {dailyBriefingBusy ? <Loader2 className="spin-icon" size={20} /> : <Newspaper size={20} />}
                  <span>{dailyBriefingBusy ? "采集中" : "采集每日早报"}</span>
                </button>
                <button disabled={hotTopicsBusy} onClick={onHotTopicsGenerate} type="button">
                  {hotTopicsBusy ? <Loader2 className="spin-icon" size={20} /> : <ListMusic size={20} />}
                  <span>{hotTopicsBusy ? "采集中" : "采集今日热榜"}</span>
                </button>
              </div>
            </div>

            <div className="program-output" data-testid="program-output">
              <div className="program-status-line">
                <span className={programBusy ? "is-busy" : ""}>
                  {programBusy ? <Loader2 className="spin-icon" size={18} /> : <ShieldCheck size={18} />}
                  {programStatus}
                </span>
              </div>
              {generatedProgram ? (
                <article className="program-record">
                  <div className="program-record__head">
                    <span>
                      <strong>{generatedProgram.title}</strong>
                      <small>
                        {generatedProgram.host} · {new Date(generatedProgram.createdAt).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" })}
                      </small>
                    </span>
                    <em>{generatedProgram.status === "ready" ? "已播出" : "已入库"}</em>
                  </div>
                  <label className="program-speed-control">
                    <span>播报速度 {programPlaybackSpeed.toFixed(2)}x</span>
                    <input
                      max={2}
                      min={0.5}
                      onChange={(event) => onProgramPlaybackSpeedChange(Number(event.target.value))}
                      step={0.05}
                      type="range"
                      value={programPlaybackSpeed}
                    />
                  </label>
                  <div className="ai-host-selector ai-host-selector--compact">
                    <span>重配音主播</span>
                    <div>
                      {hosts.map((host) => (
                        <button
                          className={programHostIds.includes(host.id) ? "is-active" : ""}
                          key={host.id}
                          onClick={() => onProgramHostToggle(host.id)}
                          type="button"
                        >
                          <img alt="" src={host.image} />
                          <strong>{host.name}</strong>
                          <small>{adminConfig.tts.hostVoices?.[host.id] ?? "默认音色"}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={programDraft}
                    onChange={(event) => onProgramDraftChange(event.target.value)}
                  />
                  <div className="program-edit-actions">
                    <button onClick={() => onProgramSaveDraft()} type="button">
                      <Save size={18} />
                      <span>保存改稿</span>
                    </button>
                    <button className="is-ai" disabled={programRewriteBusy} onClick={onProgramRewriteScript} type="button">
                      {programRewriteBusy ? <Loader2 className="spin-icon" size={18} /> : <Sparkles size={18} />}
                      <span>{programRewriteBusy ? "重编中" : "AI重编早报"}</span>
                    </button>
                    <button className="is-primary" disabled={programTtsBusy} onClick={() => onProgramRegenerateTts()} type="button">
                      {programTtsBusy ? <Loader2 className="spin-icon" size={18} /> : <RefreshCw size={18} />}
                      <span>{programTtsBusy ? "重配音中" : "重新生成语音"}</span>
                    </button>
                    <button
                      disabled={programPushBusyId === generatedProgram.id}
                      onClick={() => onProgramPushHome(generatedProgram.id)}
                      type="button"
                    >
                      {programPushBusyId === generatedProgram.id ? <Loader2 className="spin-icon" size={18} /> : <Radio size={18} />}
                      <span>{programPushBusyId === generatedProgram.id ? "更新并推送中" : "立即推送"}</span>
                    </button>
                    <button className="is-danger" onClick={() => onDeleteProgram(generatedProgram.id)} type="button">
                      <Trash2 size={18} />
                      <span>删除节目</span>
                    </button>
                  </div>
                  {generatedProgram.segments?.length ? (
                    <div className="program-segments">
                      {generatedProgram.segments.map((segment, index) => (
                        <div key={`${segment.hostId}-${index}`}>
                          <span>{segment.hostName}</span>
                          <p>{segment.text}</p>
                          {segment.audioUrl ? <audio controls src={segment.audioUrl} /> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {generatedProgram.playlist?.some((item) => item.type === "song") ? (
                    <div className="program-segments">
                      <div className="program-songs-header">歌曲列表（{generatedProgram.playlist.filter((item) => item.type === "song").length} 首）</div>
                      {generatedProgram.playlist
                        .filter((item) => item.type === "song")
                        .map((song, index) => (
                          <div key={`${song.hash ?? song.albumAudioId ?? song.title}-${index}`}>
                            <span>
                              <strong>{String(index + 1).padStart(2, "0")} · {song.title}</strong>
                              <small>{song.artist || "未知歌手"}{song.duration ? ` · ${formatDuration(song.duration)}` : ""}</small>
                            </span>
                            {song.audioUrl ? <audio controls src={song.audioUrl} /> : <small className="program-hint">无可播放链接</small>}
                          </div>
                        ))}
                    </div>
                  ) : null}
                  {generatedProgram.audioUrl ? (
                    <audio
                      ref={programAudioRef}
                      className="program-audio"
                      controls
                      src={generatedProgram.audioUrl}
                    />
                  ) : (
                    <p className="program-hint">
                      文案已经保存到数据库，语音文件暂未生成。{generatedProgram.errorMessage ?? "请检查通用语音接口配置。"}
                    </p>
                  )}
                </article>
              ) : (
                <div className="program-empty">还没有生成节目。点击“生成节目”后，这里会显示入库文案和语音播放器。</div>
              )}
            </div>
          </div>
        </section>

        <section className="panel page-panel">
          <PanelTitle icon={<Database size={21} />} title="节目分类与时间线" />
          <ProgramCategoryManager
            categories={programCategories}
            onCreate={onProgramCategoryCreate}
            onDelete={onProgramCategoryDelete}
            onRename={onProgramCategoryRename}
          />
          <div className="program-history-list">
            {programHistory.length ? (
              programHistory.slice(0, 8).map((program, index) => (
                <ProgramTimelineRow
                  categories={programCategories}
                  index={index}
                  isLast={index === programHistory.length - 1}
                  key={program.id}
                  onDelete={onDeleteProgram}
                  onMetadataSave={onProgramMetadataSave}
                  onPushHome={onProgramPushHome}
                  onReorder={onProgramReorder}
                  onScheduleDraftChange={onProgramScheduleDraftChange}
                  onScheduleSave={onProgramScheduleSave}
                  onSelect={onProgramSelect}
                  program={program}
                  pushBusy={programPushBusyId === program.id}
                  scheduleDraft={scheduleDrafts[program.id] ?? toDatetimeLocalValue(program.scheduledAt)}
                />
              ))
            ) : (
              <div className="program-empty program-empty--compact">数据库里还没有节目记录。</div>
            )}
          </div>

          <PanelTitle icon={<Mic2 size={21} />} title="当前主播" />
          <div className="host-mix-list">
            {hosts.slice(0, 3).map((host) => (
              <div key={host.id}>
                <img alt="" src={host.image} />
                <span>
                  <strong>{host.name}</strong>
                  <small>{host.tone}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  if (activeNav === "个人中心") {
    return (
    <>
      <section className="page-hero page-hero--favorites">
        <div>
          <span className="page-kicker">
            <Heart size={18} fill="currentColor" />
            个人中心
          </span>
          <h1>{userLoggedIn ? "你的24小时收听中心" : "登录后开启个人收听中心"}</h1>
          <p>这里集中管理收藏、节目提醒和最近常听内容，直播继续按时间线自动轮转。</p>
        </div>
        <button className="page-primary-action" onClick={() => onSelectNav("乐库")} type="button">
          <ListMusic size={23} />
          <span>去乐库</span>
        </button>
      </section>

      <section className="account-overview-grid">
        <article className="account-stat-card account-stat-card--profile">
          <span><ShieldCheck size={22} /></span>
          <strong>{userLoggedIn ? "已登录" : "未登录"}</strong>
          <small>{userLoggedIn ? "星声听友 · 本机同步" : "登录后同步收藏和提醒"}</small>
        </article>
        <article className="account-stat-card">
          <span><Heart size={22} /></span>
          <strong>{favoriteTracks.length}</strong>
          <small>收藏节目</small>
        </article>
        <article className="account-stat-card">
          <span><Bell size={22} /></span>
          <strong>{reminderPrograms.length}</strong>
          <small>节目提醒</small>
        </article>
        <article className="account-stat-card">
          <span><ListMusic size={22} /></span>
          <strong>{libraryTracks.length}</strong>
          <small>连播歌单</small>
        </article>
      </section>

      <section className="panel page-panel account-profile-panel">
        <PanelTitle icon={<Headphones size={21} />} title="账号概览" />
        <div className="account-profile-row">
          <img alt="" src={hosts[0].image} />
          <span>
            <strong>{userLoggedIn ? "星声听友" : "访客模式"}</strong>
            <small>{userLoggedIn ? "收藏、提醒和偏好已在本机保存。" : "当前可以试听直播，登录后保留个人偏好。"}</small>
          </span>
        </div>
        <div className="account-quick-grid">
          <button onClick={() => onSelectNav("首页")} type="button">
            <Radio size={18} />
            <span>回到直播</span>
          </button>
          <button onClick={() => onSelectNav("乐库")} type="button">
            <ListMusic size={18} />
            <span>管理歌单</span>
          </button>
          <button className="account-logout-button" onClick={onUserLogout} type="button">
            <LogOut size={18} />
            <span>退出登录</span>
          </button>
        </div>
      </section>

      <section className="panel page-panel page-panel--wide">
        <PanelTitle icon={<Heart size={21} />} title="我的收藏" />
        {favoriteTracks.length ? (
          <div className="favorite-grid">
            {favoriteTracks.map((track) => (
              <article className="favorite-card" key={track.id}>
                <img alt="" src={track.image} />
                <span>
                  <strong>{track.title}</strong>
                  <small>AI主播：{track.host} · {formatDuration(track.duration)}</small>
                </span>
                <TrackActionButtons
                  currentTrackId={currentTrackId}
                  favorites={favorites}
                  onFavorite={onFavorite}
                  onPlay={onPlay}
                  playing={playing}
                  track={track}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="favorite-grid">
            {rankedTracks.slice(0, 3).map((track) => (
              <article className="favorite-card" key={track.id}>
                <img alt="" src={track.image} />
                <span>
                  <strong>{track.title}</strong>
                  <small>AI主播：{track.host}</small>
                </span>
                <TrackActionButtons
                  currentTrackId={currentTrackId}
                  favorites={favorites}
                  onFavorite={onFavorite}
                  onPlay={onPlay}
                  playing={playing}
                  track={track}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel page-panel">
        <PanelTitle icon={<Bell size={21} />} title="节目提醒" />
        {reminderPrograms.length ? (
          <div className="account-list">
            {reminderPrograms.map((program) => (
              <div key={program.id}>
                <time>{programTimeLabel(program)}</time>
                <span>
                  <strong>{cleanAudienceCopy(program.title)}</strong>
                  <small>{program.categoryName ?? "直播节目"} · {program.host}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">还没有设置节目提醒，可以在首页节目预告中开启。</div>
        )}
      </section>

      <section className="panel page-panel">
        <PanelTitle icon={<History size={21} />} title="最近常听" />
        <div className="account-list">
          {accountRecentTracks.map((track) => (
            <button key={track.id} onClick={() => onPlay(track)} type="button">
              <time>{formatDuration(track.duration)}</time>
              <span>
                <strong>{track.title}</strong>
                <small>{track.playlist?.some((item) => item.type === "song") ? "歌单连播" : "直播节目"}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
    );
  }

  return null;
}

function ProgramCategoryManager({
  categories,
  onCreate,
  onDelete,
  onRename,
}: {
  categories: ProgramCategory[];
  onCreate: (name: string) => void | Promise<void>;
  onDelete: (categoryId: string) => void | Promise<void>;
  onRename: (categoryId: string, name: string) => void | Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(categories.map((category) => [category.id, category.name])));
  }, [categories]);

  const create = () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    void onCreate(name);
    setNewName("");
  };

  return (
    <div className="program-category-manager">
      <div className="program-category-create">
        <input
          aria-label="新增节目分类"
          placeholder="新增节目分类"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <button onClick={create} type="button">
          新增
        </button>
      </div>
      <div className="program-category-list">
        {categories.map((category) => (
          <div key={category.id}>
            <input
              aria-label={`节目分类 ${category.name}`}
              value={drafts[category.id] ?? category.name}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [category.id]: event.target.value,
                }))
              }
            />
            <button onClick={() => onRename(category.id, drafts[category.id] ?? category.name)} type="button">
              保存
            </button>
            <button className="is-danger" onClick={() => onDelete(category.id)} type="button">
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgramTimelineRow({
  categories,
  index,
  isLast,
  onDelete,
  onMetadataSave,
  onPushHome,
  onReorder,
  onScheduleDraftChange,
  onScheduleSave,
  onSelect,
  program,
  pushBusy,
  scheduleDraft,
}: {
  categories: ProgramCategory[];
  index: number;
  isLast: boolean;
  onDelete: (programId: string) => void | Promise<void>;
  onMetadataSave: (programId: string, patch: ProgramMetadataPatch) => void | Promise<void>;
  onPushHome: (programId: string) => void | Promise<void>;
  onReorder: (programId: string, direction: -1 | 1) => void | Promise<void>;
  onScheduleDraftChange: (programId: string, value: string) => void;
  onScheduleSave: (programId: string) => void | Promise<void>;
  onSelect: (program: ProgramRecord) => void;
  program: ProgramRecord;
  pushBusy: boolean;
  scheduleDraft: string;
}) {
  const [title, setTitle] = useState(program.title);
  const [categoryId, setCategoryId] = useState(program.categoryId ?? categories[0]?.id ?? "");
  const [playbackSpeed, setPlaybackSpeed] = useState(program.playbackSpeed ?? 1);

  useEffect(() => {
    setTitle(program.title);
    setCategoryId(program.categoryId ?? categories[0]?.id ?? "");
    setPlaybackSpeed(program.playbackSpeed ?? 1);
  }, [categories, program.categoryId, program.id, program.playbackSpeed, program.title]);

  const saveMetadata = () => {
    // datetime-local 返回无时区的 "YYYY-MM-DDTHH:MM"，按上海时间（UTC+8）提交。
    const scheduledAt = scheduleDraft ? scheduledAtFromDatetimeLocal(scheduleDraft) : null;
    void onMetadataSave(program.id, {
      categoryId,
      playbackSpeed,
      scheduledAt,
      title,
    });
  };

  return (
    <div className="program-queue-row">
      <button className="program-queue-main" onClick={() => onSelect(program)} type="button">
        <span>
          <strong>{program.title}</strong>
          <small>
            {program.categoryName ?? "未分类"} · {program.host} · {program.status === "ready" ? "语音已生成" : program.status === "generating" ? "后台生成中" : program.status === "failed" ? "生成失败" : "仅文案"} ·{" "}
            {program.publishDate ? `已发布 ${program.publishDate} · ` : ""}
            {program.scheduledAt
              ? `时间线 ${new Date(program.scheduledAt).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" })}`
              : new Date(program.createdAt).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" })}
          </small>
        </span>
        <Play size={24} fill="currentColor" />
      </button>
      <div className="program-queue-editor">
        <input aria-label="节目名称" value={title} onChange={(event) => setTitle(event.target.value)} />
        <select aria-label="节目分类" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          aria-label={`${program.title} 时间线`}
          type="datetime-local"
          value={scheduleDraft}
          onChange={(event) => onScheduleDraftChange(program.id, event.target.value)}
        />
        <label>
          <span>{playbackSpeed.toFixed(2)}x</span>
          <input
            max={2}
            min={0.5}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
            step={0.05}
            type="range"
            value={playbackSpeed}
          />
        </label>
      </div>
      <div className="program-queue-tools">
        <button disabled={index === 0} onClick={() => onReorder(program.id, -1)} title="上移" type="button">
          <ArrowUp size={17} />
        </button>
        <button disabled={isLast} onClick={() => onReorder(program.id, 1)} title="下移" type="button">
          <ArrowDown size={17} />
        </button>
        <button onClick={saveMetadata} type="button">
          保存
        </button>
        <button onClick={() => onScheduleSave(program.id)} type="button">
          定时
        </button>
        <button disabled={pushBusy} onClick={() => onPushHome(program.id)} type="button">
          {pushBusy ? "更新并推送中" : "立即推送"}
        </button>
        <button className="is-danger" onClick={() => onDelete(program.id)} title="删除节目" type="button">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function ConfigField({
  children,
  hint,
  label,
}: {
  children: React.ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <label className="config-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function ServiceStatusCard({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
}) {
  const ready = ["完整", "写入", "可用于", "已保存"].some((keyword) => status.includes(keyword));

  return (
    <div className={`service-status ${ready ? "is-ready" : ""}`}>
      <span>{icon}</span>
      <strong>{label}</strong>
      <small>{status}</small>
    </div>
  );
}

function AdminConfigPage({
  config,
  onChange,
  onSave,
  onTest,
  savedAt,
  status,
}: {
  config: AdminConfig;
  onChange: <T extends ServiceKey, K extends keyof AdminConfig[T]>(
    service: T,
    key: K,
    value: AdminConfig[T][K],
  ) => void;
  onSave: () => void | Promise<void>;
  onTest: (service: ServiceKey) => void | Promise<void>;
  savedAt: string;
  status: Record<ServiceKey, string>;
}) {
  const savedLabel = savedAt ? new Date(savedAt).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }) : "尚未保存";
  const [activeModelSection, setActiveModelSection] = useState<"llm" | "tts" | "suno">("llm");
  const applyTtsPreset = (preset: (typeof ttsEnginePresets)[number]) => {
    onChange("tts", "engine", preset.engine);
    onChange("tts", "provider", preset.provider);
    onChange("tts", "baseUrl", preset.baseUrl);
    onChange("tts", "model", preset.model);
    onChange("tts", "voiceId", preset.voiceId);
    onChange("tts", "format", preset.format);
  };

  return (
    <>
      <section className="page-hero page-hero--admin">
        <div>
          <span className="page-kicker">
            <BrainCircuit size={18} />
            模型配置
          </span>
          <h1>统一管理内容、语音与音乐生成模型</h1>
          <p>按“内容生成 → 语音合成 → 音乐生成”分区配置。每个分区独立检测，确认后统一保存。</p>
        </div>
        <button className="page-primary-action" onClick={onSave} type="button">
          <Save size={22} />
          <span>保存配置</span>
        </button>
      </section>

      <section className="admin-status-bar">
        <ServiceStatusCard icon={<BrainCircuit size={21} />} label="大模型 API" status={status.llm} />
        <ServiceStatusCard icon={<Bot size={21} />} label="通用语音接口" status={status.tts} />
        <ServiceStatusCard icon={<Globe2 size={21} />} label="SUNO 生成 API" status={status.suno} />
        <div className="service-status service-status--saved">
          <span>
            <ShieldCheck size={21} />
          </span>
          <strong>保存状态</strong>
          <small>{savedLabel}</small>
        </div>
      </section>

      <section className="model-config-tabs" aria-label="模型配置分区">
        <button className={activeModelSection === "llm" ? "is-active" : ""} onClick={() => setActiveModelSection("llm")} type="button">
          <BrainCircuit size={19} /><span><strong>1. 内容生成</strong><small>文案模型、参数与系统提示词</small></span>
        </button>
        <button className={activeModelSection === "tts" ? "is-active" : ""} onClick={() => setActiveModelSection("tts")} type="button">
          <Bot size={19} /><span><strong>2. 语音合成</strong><small>服务适配、音色与默认语气</small></span>
        </button>
        <button className={activeModelSection === "suno" ? "is-active" : ""} onClick={() => setActiveModelSection("suno")} type="button">
          <Globe2 size={19} /><span><strong>3. 音乐生成</strong><small>SUNO 连接与生成默认值</small></span>
        </button>
      </section>

      {activeModelSection === "llm" ? <section className="panel admin-panel admin-panel--wide model-config-panel">
        <div className="admin-panel-title">
          <h2>
            <BrainCircuit size={22} />
            大模型 API 配置
          </h2>
          <button onClick={() => onTest("llm")} type="button">
            检测配置
          </button>
        </div>
        <div className="config-grid">
          <ConfigField label="启用服务">
            <label className="admin-switch">
              <input
                checked={config.llm.enabled}
                onChange={(event) => onChange("llm", "enabled", event.target.checked)}
                type="checkbox"
              />
              <span>{config.llm.enabled ? "已启用" : "已停用"}</span>
            </label>
          </ConfigField>
          <ConfigField label="服务商">
            <select value={config.llm.provider} onChange={(event) => onChange("llm", "provider", event.target.value)}>
              <option>OpenAI Compatible</option>
              <option>OpenAI</option>
              <option>Azure OpenAI</option>
              <option>DeepSeek</option>
              <option>通义千问</option>
              <option>智谱 GLM</option>
            </select>
          </ConfigField>
          <ConfigField label="API Base URL">
            <input value={config.llm.baseUrl} onChange={(event) => onChange("llm", "baseUrl", event.target.value)} />
          </ConfigField>
          <ConfigField hint="仅保存在本地，不会写入源码。" label="API Key">
            <input
              autoComplete="off"
              placeholder="sk-..."
              type="password"
              value={config.llm.apiKey}
              onChange={(event) => onChange("llm", "apiKey", event.target.value)}
            />
          </ConfigField>
          <ConfigField label="模型">
            <input value={config.llm.model} onChange={(event) => onChange("llm", "model", event.target.value)} />
          </ConfigField>
          <ConfigField label="Temperature">
            <input
              max={2}
              min={0}
              step={0.1}
              type="number"
              value={config.llm.temperature}
              onChange={(event) => onChange("llm", "temperature", Number(event.target.value))}
            />
          </ConfigField>
          <ConfigField label="最大 Tokens">
            <input
              min={128}
              step={128}
              type="number"
              value={config.llm.maxTokens}
              onChange={(event) => onChange("llm", "maxTokens", Number(event.target.value))}
            />
          </ConfigField>
          <ConfigField hint="用于节目文案、搜索建议和主播口播生成。" label="系统提示词">
            <textarea
              value={config.llm.systemPrompt}
              onChange={(event) => onChange("llm", "systemPrompt", event.target.value)}
            />
          </ConfigField>
        </div>
      </section> : null}

      {activeModelSection === "tts" ? <section className="panel admin-panel model-config-panel">
        <div className="admin-panel-title">
          <h2>
            <Bot size={22} />
            通用语音接口配置
          </h2>
          <button onClick={() => onTest("tts")} type="button">
            检测配置
          </button>
        </div>
        <div className="tts-engine-grid">
          {ttsEnginePresets.map((preset) => (
            <button
              className={config.tts.engine === preset.engine && config.tts.provider === preset.provider ? "is-active" : ""}
              key={`${preset.engine}-${preset.provider}-${preset.label}`}
              onClick={() => applyTtsPreset(preset)}
              type="button"
            >
              <strong>{preset.label}</strong>
              <small>{preset.provider}</small>
            </button>
          ))}
        </div>
        <div className="config-grid config-grid--compact">
          <ConfigField label="启用服务">
            <label className="admin-switch">
              <input
                checked={config.tts.enabled}
                onChange={(event) => onChange("tts", "enabled", event.target.checked)}
                type="checkbox"
              />
              <span>{config.tts.enabled ? "已启用" : "已停用"}</span>
            </label>
          </ConfigField>
          <ConfigField hint="不同引擎请求格式不同，需选择对应适配器。" label="引擎类型">
            <select value={config.tts.engine} onChange={(event) => onChange("tts", "engine", event.target.value)}>
              <option value="openai-compatible">通用 / OpenAI 兼容</option>
              <option value="mimo">小米 MiMo</option>
              <option value="azure">Azure Speech</option>
              <option value="google">Google Cloud TTS</option>
              <option value="elevenlabs">ElevenLabs</option>
            </select>
          </ConfigField>
          <ConfigField label="服务商">
            <select value={config.tts.provider} onChange={(event) => onChange("tts", "provider", event.target.value)}>
              <option>OpenAI / 网关兼容</option>
              <option>通用语音接口</option>
              <option>OpenAI TTS Compatible</option>
              <option>小米 MiMo TTS</option>
              <option>OpenAI TTS</option>
              <option>Azure Speech</option>
              <option>Google Cloud TTS</option>
              <option>ElevenLabs</option>
              <option>火山引擎语音</option>
              <option>腾讯云语音</option>
              <option>阿里云智能语音</option>
              <option>百度智能云语音</option>
              <option>Edge TTS Gateway</option>
            </select>
          </ConfigField>
          <ConfigField label="语音接口 Endpoint">
            <input value={config.tts.baseUrl} onChange={(event) => onChange("tts", "baseUrl", event.target.value)} />
          </ConfigField>
          <ConfigField label="API Key">
            <input
              autoComplete="off"
              type="password"
              value={config.tts.apiKey}
              onChange={(event) => onChange("tts", "apiKey", event.target.value)}
            />
          </ConfigField>
          <ConfigField label="语音模型">
            <input value={config.tts.model} onChange={(event) => onChange("tts", "model", event.target.value)} />
          </ConfigField>
          <ConfigField label="默认音色 / Voice ID">
            <input value={config.tts.voiceId} onChange={(event) => onChange("tts", "voiceId", event.target.value)} />
          </ConfigField>
          <ConfigField label="音频格式">
            <select value={config.tts.format} onChange={(event) => onChange("tts", "format", event.target.value)}>
              <option>mp3</option>
              <option>wav</option>
              <option>opus</option>
              <option>aac</option>
            </select>
          </ConfigField>
          <ConfigField label="语速">
            <input
              max={2}
              min={0.5}
              step={0.05}
              type="number"
              value={config.tts.speed}
              onChange={(event) => onChange("tts", "speed", Number(event.target.value))}
            />
          </ConfigField>
          <ConfigField hint="节目制作页面会默认带入，单次制作时仍可修改。" label="默认配音语气">
            <textarea
              rows={3}
              value={config.tts.defaultStylePrompt}
              onChange={(event) => onChange("tts", "defaultStylePrompt", event.target.value)}
            />
          </ConfigField>
          <ConfigField hint="每行一条；会显示在节目制作的语气预设下拉框中。" label="配音语气预设">
            <textarea
              rows={6}
              value={(config.tts.stylePresets ?? []).join("\n")}
              onChange={(event) => onChange(
                "tts",
                "stylePresets",
                event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
              )}
            />
          </ConfigField>
        </div>
        <div className="voice-map-panel">
          <div className="voice-map-title">
            <strong>AI主播与小米预置音色映射</strong>
            <small>根据小米 MiMo TTS 文档，预置音色可选冰糖、茉莉、苏打、白桦、Mia、Chloe、Milo、Dean。</small>
          </div>
          <div className="voice-map-grid">
            {hosts.map((host) => (
              <label key={host.id}>
                <span>
                  <img alt="" src={host.image} />
                  <strong>{host.name}</strong>
                  <small>{host.voice}</small>
                </span>
                <select
                  value={config.tts.hostVoices?.[host.id] ?? defaultHostVoices[host.id] ?? "茉莉"}
                  onChange={(event) =>
                    onChange("tts", "hostVoices", {
                      ...config.tts.hostVoices,
                      [host.id]: event.target.value,
                    })
                  }
                >
                  {mimoVoiceOptions.map((voice) => (
                    <option key={voice}>{voice}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      </section> : null}

      {activeModelSection === "suno" ? <section className="panel admin-panel model-config-panel">
        <div className="admin-panel-title">
          <h2>
            <Globe2 size={22} />
            本地 suno-api
          </h2>
          <button onClick={() => onTest("suno")} type="button">
            检测 Cookie 与配额
          </button>
        </div>
        <p className="model-config-description">
          使用项目目录中的 suno-api 对接 Suno Custom Mode，支持原创歌曲生成、歌词生成、任务查询、续写、分轨和歌词时间轴等主要能力。
        </p>
        <div className="config-grid config-grid--compact">
          <ConfigField label="启用服务">
            <label className="admin-switch">
              <input
                checked={config.suno.enabled}
                onChange={(event) => onChange("suno", "enabled", event.target.checked)}
                type="checkbox"
              />
              <span>{config.suno.enabled ? "已启用" : "已停用"}</span>
            </label>
          </ConfigField>
          <ConfigField hint="本机 3000 端口已被占用，Suno 服务固定使用 3010。" label="本地服务地址">
            <input value={config.suno.baseUrl} onChange={(event) => onChange("suno", "baseUrl", event.target.value)} />
          </ConfigField>
          <ConfigField hint="可粘贴 Request Cookie，也可直接粘贴四段 Set-Cookie；保存时会自动去除 Path、Secure、SameSite 等属性。" label="Suno Cookie">
            <textarea
              autoComplete="off"
              placeholder="__client=...; __client_uat=...; ..."
              rows={5}
              value={config.suno.cookie}
              onChange={(event) => onChange("suno", "cookie", event.target.value)}
            />
          </ConfigField>
          <ConfigField hint="Suno 当前生成请求会触发 hCaptcha；本地 suno-api 必须通过 2Captcha 获取一次性验证 token。" label="2Captcha API Key（生成必需）">
            <input
              autoComplete="off"
              placeholder="可先留空；出现 CAPTCHA 提示时必须填写"
              type="password"
              value={config.suno.captchaKey}
              onChange={(event) => onChange("suno", "captchaKey", event.target.value)}
            />
          </ConfigField>
          <ConfigField label="模型 / 版本">
            <select value={config.suno.model} onChange={(event) => onChange("suno", "model", event.target.value)}>
              <option value="auto">自动匹配账号（付费 v5.5 / 免费 v4.5）</option>
              <option value="chirp-fenix">v5.5 · Pro / Premier（chirp-fenix）</option>
              <option value="chirp-auk">v4.5 · Free（chirp-auk）</option>
            </select>
          </ConfigField>
        </div>
        <details className="music-cookie-help suno-cookie-help">
          <summary>如何获取 Suno Cookie</summary>
          <div>
            <ol>
              <li>在电脑浏览器打开 <a href="https://suno.com/" rel="noreferrer" target="_blank">Suno</a> 并登录账号。</li>
              <li>按 F12 打开开发者工具，进入“网络 / Network”，然后刷新页面。</li>
              <li>搜索并打开 <code>client?__clerk_api_version=2025-11-10&amp;_clerk_js_version=5.117.0</code> 请求。</li>
              <li>优先复制“请求标头 / Request Headers”中的完整 Cookie；也可以把响应中的四段 <code>Set-Cookie</code> 全部复制到输入框。</li>
            </ol>
            <small>系统会自动合并四段 Cookie 并过滤 <code>Path</code>、<code>Secure</code> 等属性，最终内容必须包含 <code>__client</code>。Cookie 等同登录凭据，请勿发送给他人。</small>
          </div>
        </details>
        <details className="music-cookie-help suno-cookie-help">
          <summary>如何获取 2Captcha API Key</summary>
          <div>
            <ol>
              <li>打开 <a href="https://2captcha.com/enterpage" rel="noreferrer" target="_blank">2Captcha</a>，注册 Customer 账号。</li>
              <li>充值少量余额；验证码识别由第三方人工服务计费，与 Suno Credits 分开。</li>
              <li>在 2Captcha 控制台复制 API Key，粘贴到上方输入框并保存。</li>
              <li>点击“检测 Cookie 与配额”，确认 Suno Cookie 正常后再生成歌曲。</li>
            </ol>
            <small>Suno Pro / Premier 订阅只提供歌曲生成额度，不能替代 hCaptcha token。请勿把 2Captcha Key 提交到代码仓库。</small>
          </div>
        </details>
      </section> : null}

      {false ? (
      <section className="panel admin-panel admin-panel--wide">
        <div className="admin-panel-title">
          <h2>
            <Puzzle size={22} />
            采集插件
          </h2>
          <button onClick={() => onTest("plugins")} type="button">
            检测配置
          </button>
        </div>
        <div className="plugin-card-grid">
          <div className="plugin-card">
            <div className="plugin-card__head">
              <span>
                <Newspaper size={24} />
              </span>
              <div>
                <strong>每日早报</strong>
                <small>通过 ALAPI 每日早报接口采集文字内容，再进入节目队列并用通用语音接口播报。</small>
              </div>
            </div>
            <div className="config-grid config-grid--compact">
              <ConfigField label="启用插件">
                <label className="admin-switch">
                  <input
                    checked={config.plugins.dailyBriefing.enabled}
                    onChange={(event) =>
                      onChange("plugins", "dailyBriefing", {
                        ...config.plugins.dailyBriefing,
                        enabled: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <span>{config.plugins.dailyBriefing.enabled ? "已启用" : "已停用"}</span>
                </label>
              </ConfigField>
              <ConfigField label="插件名称">
                <input
                  value={config.plugins.dailyBriefing.name}
                  onChange={(event) =>
                    onChange("plugins", "dailyBriefing", {
                      ...config.plugins.dailyBriefing,
                      name: event.target.value,
                    })
                  }
                />
              </ConfigField>
              <ConfigField label="ALAPI Endpoint">
                <input
                  value={config.plugins.dailyBriefing.apiBaseUrl}
                  onChange={(event) =>
                    onChange("plugins", "dailyBriefing", {
                      ...config.plugins.dailyBriefing,
                      apiBaseUrl: event.target.value,
                    })
                  }
                />
              </ConfigField>
              <ConfigField hint="只保存到本地后台 SQLite，不写入源码。" label="ALAPI Token">
                <input
                  autoComplete="off"
                  type="password"
                  value={config.plugins.dailyBriefing.token}
                  onChange={(event) =>
                    onChange("plugins", "dailyBriefing", {
                      ...config.plugins.dailyBriefing,
                      token: event.target.value,
                    })
                  }
                />
              </ConfigField>
              <ConfigField label="播报主播">
                <select
                  value={config.plugins.dailyBriefing.hostId}
                  onChange={(event) =>
                    onChange("plugins", "dailyBriefing", {
                      ...config.plugins.dailyBriefing,
                      hostId: event.target.value,
                    })
                  }
                >
                  {hosts.map((host) => (
                    <option key={host.id} value={host.id}>
                      {host.name}
                    </option>
                  ))}
                </select>
              </ConfigField>
              <ConfigField label="最多播报条数">
                <input
                  max={30}
                  min={3}
                  type="number"
                  value={config.plugins.dailyBriefing.maxItems}
                  onChange={(event) =>
                    onChange("plugins", "dailyBriefing", {
                      ...config.plugins.dailyBriefing,
                      maxItems: Number(event.target.value),
                    })
                  }
                />
              </ConfigField>
              <ConfigField label="播报速度">
                <input
                  max={2}
                  min={0.5}
                  step={0.05}
                  type="number"
                  value={config.plugins.dailyBriefing.playbackSpeed}
                  onChange={(event) =>
                    onChange("plugins", "dailyBriefing", {
                      ...config.plugins.dailyBriefing,
                      playbackSpeed: clampNumber(event.target.value, 0.5, 2, 1),
                    })
                  }
                />
              </ConfigField>
            </div>
          </div>
          <div className="plugin-card">
            <div className="plugin-card__head">
              <span>
                <ListMusic size={24} />
              </span>
              <div>
                <strong>今日热榜</strong>
                <small>通过 ALAPI 今日热榜接口采集平台热点，先由大模型编排成热榜节目，再进入通用语音接口播报。</small>
              </div>
            </div>
            <div className="config-grid config-grid--compact">
              <ConfigField label="启用插件">
                <label className="admin-switch">
                  <input
                    checked={config.plugins.hotTopics.enabled}
                    onChange={(event) =>
                      onChange("plugins", "hotTopics", {
                        ...config.plugins.hotTopics,
                        enabled: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <span>{config.plugins.hotTopics.enabled ? "已启用" : "已停用"}</span>
                </label>
              </ConfigField>
              <ConfigField label="插件名称">
                <input
                  value={config.plugins.hotTopics.name}
                  onChange={(event) =>
                    onChange("plugins", "hotTopics", {
                      ...config.plugins.hotTopics,
                      name: event.target.value,
                    })
                  }
                />
              </ConfigField>
              <ConfigField label="ALAPI Endpoint">
                <input
                  value={config.plugins.hotTopics.apiBaseUrl}
                  onChange={(event) =>
                    onChange("plugins", "hotTopics", {
                      ...config.plugins.hotTopics,
                      apiBaseUrl: event.target.value,
                    })
                  }
                />
              </ConfigField>
              <ConfigField hint="默认和每日早报使用同一个 token；留空时后台会沿用每日早报 token。" label="ALAPI Token">
                <input
                  autoComplete="off"
                  placeholder="留空沿用每日早报 Token"
                  type="password"
                  value={config.plugins.hotTopics.token}
                  onChange={(event) =>
                    onChange("plugins", "hotTopics", {
                      ...config.plugins.hotTopics,
                      token: event.target.value,
                    })
                  }
                />
              </ConfigField>
              <ConfigField label="热榜类型">
                <input
                  placeholder="weibo"
                  value={config.plugins.hotTopics.type}
                  onChange={(event) =>
                    onChange("plugins", "hotTopics", {
                      ...config.plugins.hotTopics,
                      type: event.target.value,
                    })
                  }
                />
              </ConfigField>
              <ConfigField label="播报主播">
                <select
                  value={config.plugins.hotTopics.hostId}
                  onChange={(event) =>
                    onChange("plugins", "hotTopics", {
                      ...config.plugins.hotTopics,
                      hostId: event.target.value,
                    })
                  }
                >
                  {hosts.map((host) => (
                    <option key={host.id} value={host.id}>
                      {host.name}
                    </option>
                  ))}
                </select>
              </ConfigField>
              <ConfigField label="最多播报条数">
                <input
                  max={30}
                  min={3}
                  type="number"
                  value={config.plugins.hotTopics.maxItems}
                  onChange={(event) =>
                    onChange("plugins", "hotTopics", {
                      ...config.plugins.hotTopics,
                      maxItems: Number(event.target.value),
                    })
                  }
                />
              </ConfigField>
              <ConfigField label="播报速度">
                <input
                  max={2}
                  min={0.5}
                  step={0.05}
                  type="number"
                  value={config.plugins.hotTopics.playbackSpeed}
                  onChange={(event) =>
                    onChange("plugins", "hotTopics", {
                      ...config.plugins.hotTopics,
                      playbackSpeed: clampNumber(event.target.value, 0.5, 2, 1),
                    })
                  }
                />
              </ConfigField>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      <section className="panel admin-panel admin-panel--notes">
        <div className="admin-panel-title">
          <h2>
            <KeyRound size={22} />
            接入说明
          </h2>
        </div>
        <div className="admin-notes">
          <p>配置会写入本地 SQLite 数据库，数据库文件位于项目的 server/storage 目录中。</p>
          <p>大模型用于节目脚本、搜索建议、主播口播文案；通用语音接口用于把文案转成主播语音；SUNO API 用于生成原创音乐和伴奏。</p>
          <p>生产环境仍建议把 API Key 放在真正的服务端环境变量或密钥管理系统中，避免把密钥暴露给公开浏览器。</p>
        </div>
      </section>
    </>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="panel-title">
      <h2>
        {icon}
        {title}
      </h2>
      <button type="button">
        更多
        <ChevronRight size={17} />
      </button>
    </div>
  );
}

function AccountModal({
  modal,
  onAuthSuccess,
  onClose,
  onSwitch,
}: {
  modal: Exclude<ModalType, null>;
  onAuthSuccess: () => void;
  onClose: () => void;
  onSwitch: (modal: Exclude<ModalType, null>) => void;
}) {
  const isRegister = modal === "register";
  const title = isRegister ? "注册星声账号" : "登录星声账号";
  const icon = isRegister ? <UserPlus size={24} /> : <Headphones size={24} />;
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [captchaCode, setCaptchaCode] = useState(() => createCaptchaCode());
  const [authStatus, setAuthStatus] = useState("");
  const captchaChars = captchaCode.split("");

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setCodeInput("");
    setCaptchaCode(createCaptchaCode());
    setAuthStatus("");
  }, [modal]);

  const refreshCaptcha = () => {
    setCaptchaCode(createCaptchaCode());
    setCodeInput("");
    setAuthStatus("");
  };

  const submitAuth = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account.trim() || !password.trim()) {
      setAuthStatus("请填写账号和密码。");
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setAuthStatus("两次输入的密码不一致。");
      return;
    }
    if (codeInput.trim().toUpperCase() !== captchaCode) {
      setAuthStatus("验证码不正确。");
      setCaptchaCode(createCaptchaCode());
      setCodeInput("");
      return;
    }
    window.localStorage.setItem("star-radio.user-account", account.trim());
    onAuthSuccess();
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="account-modal" role="dialog">
        <div className="modal-title">
          <span>{icon}</span>
          <div>
            <h2>{title}</h2>
            <p>{isRegister ? "创建账号后可同步收藏、节目提醒和个性化AI推荐。" : "登录后继续收听你的收藏、提醒和AI推荐。"}</p>
          </div>
          <button onClick={onClose} title="关闭" type="button">
            <X size={18} />
          </button>
        </div>

        <form className="auth-form" onSubmit={submitAuth}>
          <input autoComplete="username" onChange={(event) => setAccount(event.target.value)} placeholder="手机号 / 邮箱" value={account} />
          <input autoComplete={isRegister ? "new-password" : "current-password"} onChange={(event) => setPassword(event.target.value)} placeholder="密码" type="password" value={password} />
          {isRegister ? (
            <input autoComplete="new-password" onChange={(event) => setConfirmPassword(event.target.value)} placeholder="确认密码" type="password" value={confirmPassword} />
          ) : null}
          <div className="auth-code-row">
            <input
              autoComplete="off"
              maxLength={5}
              onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
              placeholder="图形验证码"
              value={codeInput}
            />
            <button aria-label="刷新验证码" className="captcha-image" onClick={refreshCaptcha} title="刷新验证码" type="button">
              <svg aria-hidden="true" viewBox="0 0 128 42">
                <path d="M4 12 C26 2 38 24 60 12 S94 10 124 27" />
                <path d="M9 32 C34 18 52 38 75 24 S104 20 120 8" />
                {captchaChars.map((char, index) => (
                  <text
                    key={`${char}-${index}`}
                    x={15 + index * 22}
                    y={28 + (index % 2 === 0 ? -2 : 3)}
                    transform={`rotate(${index % 2 === 0 ? -8 : 7} ${15 + index * 22} 24)`}
                  >
                    {char}
                  </text>
                ))}
              </svg>
            </button>
          </div>
          {authStatus ? <p className="auth-status">{authStatus}</p> : null}
          <button className="modal-primary" type="submit">
            {isRegister ? "创建账号" : "登录"}
          </button>
        </form>
        <button
          className="modal-secondary"
          onClick={() => onSwitch(isRegister ? "login" : "register")}
          type="button"
        >
          {isRegister ? "已有账号？去登录" : "没有账号？立即注册"}
        </button>
      </section>
    </div>
  );
}
