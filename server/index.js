// 电台面向中文听众（UTC+8），所有“墙上时间”都按亚洲/上海时区解释。
// 必须在任何 Date 调用前设置，确保 getHours / toLocaleDateString 等本地时间方法
// 与前台用户一致，避免服务器时区（如 America/New_York）导致的 12 小时偏移。
const WALL_TIME_ZONE = "Asia/Shanghai";
process.env.TZ = WALL_TIME_ZONE;

import cors from "cors";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import dns from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(projectRoot, ".env") });
const requireCjs = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const storageDir = process.env.AIRADIO_STORAGE_DIR
  ? path.resolve(process.env.AIRADIO_STORAGE_DIR)
  : path.join(__dirname, "storage");
const audioDir = path.join(storageDir, "audio");
const soundEffectsDir = path.join(storageDir, "sound-effects");
const apiTmpDir = path.join(storageDir, "tmp");
const dbPath = path.join(storageDir, "airadio.sqlite");
const clientDistDir = path.join(projectRoot, "dist");
const port = Number(process.env.AIRADIO_API_PORT ?? 4177);
const host = process.env.AIRADIO_API_HOST || process.env.HOST || "0.0.0.0";
const adminUsername = process.env.AIRADIO_ADMIN_USER || "admin";
const adminPassword = process.env.AIRADIO_ADMIN_PASSWORD || "";
const adminSessions = new Map();

fs.mkdirSync(audioDir, { recursive: true });
fs.mkdirSync(soundEffectsDir, { recursive: true });
fs.mkdirSync(apiTmpDir, { recursive: true });
process.env.TMPDIR = apiTmpDir;

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS configs (
    service TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS programs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    host TEXT NOT NULL,
    prompt TEXT NOT NULL,
    script TEXT NOT NULL,
    status TEXT NOT NULL,
    audio_url TEXT,
    audio_path TEXT,
    playlist_json TEXT,
    llm_model TEXT,
    tts_model TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS program_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS program_archives (
    id TEXT PRIMARY KEY,
    archive_date TEXT NOT NULL,
    program_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    host TEXT NOT NULL,
    category_name TEXT,
    script TEXT NOT NULL,
    segments_json TEXT,
    playlist_json TEXT,
    audio_url TEXT,
    source_type TEXT,
    created_at TEXT NOT NULL,
    archived_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sound_effect_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sound_effects (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    audio_path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const programColumns = db.prepare("PRAGMA table_info(programs)").all().map((column) => column.name);
if (!programColumns.includes("segments_json")) {
  db.exec("ALTER TABLE programs ADD COLUMN segments_json TEXT");
}
if (!programColumns.includes("playlist_json")) {
  db.exec("ALTER TABLE programs ADD COLUMN playlist_json TEXT");
}
if (!programColumns.includes("sort_order")) {
  db.exec("ALTER TABLE programs ADD COLUMN sort_order INTEGER");
}
if (!programColumns.includes("scheduled_at")) {
  db.exec("ALTER TABLE programs ADD COLUMN scheduled_at TEXT");
}
if (!programColumns.includes("source_type")) {
  db.exec("ALTER TABLE programs ADD COLUMN source_type TEXT");
}
if (!programColumns.includes("plugin_id")) {
  db.exec("ALTER TABLE programs ADD COLUMN plugin_id TEXT");
}
if (!programColumns.includes("category_id")) {
  db.exec("ALTER TABLE programs ADD COLUMN category_id TEXT");
}
if (!programColumns.includes("playback_speed")) {
  db.exec("ALTER TABLE programs ADD COLUMN playback_speed REAL DEFAULT 1");
}
if (!programColumns.includes("publish_date")) {
  db.exec("ALTER TABLE programs ADD COLUMN publish_date TEXT");
}
if (!programColumns.includes("published_at")) {
  db.exec("ALTER TABLE programs ADD COLUMN published_at TEXT");
}
if (!programColumns.includes("music_playlist_id")) {
  db.exec("ALTER TABLE programs ADD COLUMN music_playlist_id TEXT");
}
if (!programColumns.includes("playback_mode")) {
  db.exec("ALTER TABLE programs ADD COLUMN playback_mode TEXT");
}
if (!programColumns.includes("program_preset_id")) {
  db.exec("ALTER TABLE programs ADD COLUMN program_preset_id TEXT");
}
if (!programColumns.includes("playback_reset_at")) {
  db.exec("ALTER TABLE programs ADD COLUMN playback_reset_at TEXT");
}
if (!programColumns.includes("restart_from_beginning")) {
  db.exec("ALTER TABLE programs ADD COLUMN restart_from_beginning INTEGER DEFAULT 0");
}
if (!programColumns.includes("filler_timeline_json")) {
  db.exec("ALTER TABLE programs ADD COLUMN filler_timeline_json TEXT");
}

const archiveColumns = db.prepare("PRAGMA table_info(program_archives)").all().map((column) => column.name);
if (!archiveColumns.includes("playlist_json")) {
  db.exec("ALTER TABLE program_archives ADD COLUMN playlist_json TEXT");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS flow_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    scheduled_time TEXT,
    enabled INTEGER DEFAULT 1,
    last_run_at TEXT,
    last_run_summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS program_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS music_playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    songs_json TEXT NOT NULL,
    playback_mode TEXT NOT NULL DEFAULT 'sequential' CHECK (playback_mode IN ('sequential', 'shuffle')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const oldDefaultSystemPrompt = "你是星声电台的AI节目策划，负责生成温柔、适合电台播出的节目文案。";
const defaultAudioMix = {
  enabled: false,
  effectIds: [],
  leadSeconds: 0,
  loopMode: "single",
  startMode: "voice-first",
  volume: 0.28,
};
const FLOW_FILLER_TARGET_SONGS = 150;
const FLOW_FILLER_INITIAL_SONGS = 30;
const FLOW_FILLER_TOP_UP_BATCH_SONGS = 30;
const FLOW_FILLER_TOP_UP_THRESHOLD = 10;
const KUGOU_MAX_PROGRAM_SONGS = 500;
const KUGOU_PLAY_URL_CONCURRENCY = 8;
const AI_HOT_SONG_TARGET = 30;
const AI_HOT_SONG_MAX = 300;
const AI_HOT_SONG_BATCH_SIZE = 30;
const DEFAULT_AI_HOT_SONG_PROMPT =
  "生成适合后台音乐连播的歌曲清单，覆盖华语流行、港台金曲、欧美流行、日韩流行、网络热歌和经典高传唱度作品；歌名和歌手要准确，避免重复、纯音乐和白噪音。";

const defaultHostVoices = {
  xingyao: "茉莉",
  yuxuan: "白桦",
  ruoxi: "冰糖",
  mobei: "苏打",
  xiaoya: "冰糖",
};

const defaultVoiceStylePresets = [
  "自然、清晰、亲切，适合电台直播",
  "沉稳、专业、节奏清晰的新闻播报",
  "温柔、治愈、富有陪伴感的深夜电台",
  "轻快、活力、有感染力的音乐节目",
];

const hostProfiles = [
  { id: "xingyao", name: "星遥", voice: "温柔治愈音", tone: "轻松、治愈、陪伴" },
  { id: "yuxuan", name: "宇轩", voice: "磁性暖男音", tone: "低频、稳定、深夜" },
  { id: "ruoxi", name: "若曦", voice: "清澈灵动音", tone: "清透、元气、故事感" },
  { id: "mobei", name: "墨白", voice: "沉稳知性音", tone: "冷静、叙事、爵士感" },
  { id: "xiaoya", name: "小雅", voice: "甜美元气音", tone: "明亮、流行、电子感" },
];

const defaultSystemPrompt =
  "你是星声电台的多主播节目导演和脚本策划。你了解每位AI主播的人设、声线和说话习惯，但正文台词里不要让主播说出自己的名字，也不要出现“星遥：”“墨白：”这类说话人前缀。";

const defaultConfig = {
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
    model: "tts-1-hd",
    provider: "OpenAI / 网关兼容",
    speed: 1,
    defaultStylePrompt: defaultVoiceStylePresets[0],
    stylePresets: defaultVoiceStylePresets,
    voiceId: "alloy",
    hostVoices: defaultHostVoices,
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
  storage: {
    autoCleanupEnabled: false,
    autoCleanupMaxAgeDays: 7,
    autoCleanupKeepProgramAudio: true,
    autoCleanupLastRun: "",
  },
};

const defaultSystemSettings = {
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

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use("/storage", express.static(storageDir));
app.use("/api", (request, response, next) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  next();
});

function createAdminSession(username) {
  const token = randomUUID();
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
  adminSessions.set(token, { expiresAt, username });
  return { expiresAt, token, username };
}

function readAdminSession(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return null;
  }

  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return null;
  }

  return { ...session, token };
}

function requireAdmin(request, response, next) {
  const session = readAdminSession(request);
  if (!session) {
    response.status(401).json({ message: "请先登录后台管理" });
    return;
  }

  request.adminSession = session;
  next();
}

function nowIso() {
  return new Date().toISOString();
}

const defaultProgramCategories = ["常规节目", "每日早报", "今日热榜", "音乐专题"];
const defaultSoundEffectCategories = ["轻柔铺底", "新闻氛围", "热榜节奏"];

function ensureDefaultCategories() {
  const count = db.prepare("SELECT COUNT(*) AS total FROM program_categories").get()?.total ?? 0;
  if (count > 0) {
    return;
  }

  const createdAt = nowIso();
  const insert = db.prepare(`
    INSERT INTO program_categories (id, name, sort_order, created_at, updated_at)
    VALUES (@id, @name, @sortOrder, @createdAt, @updatedAt)
  `);
  const save = db.transaction(() => {
    defaultProgramCategories.forEach((name, index) => {
      insert.run({
        id: `category-${index + 1}`,
        name,
        sortOrder: index + 1,
        createdAt,
        updatedAt: createdAt,
      });
    });
  });
  save();
}

ensureDefaultCategories();

function ensureDefaultSoundEffectCategories() {
  const count = db.prepare("SELECT COUNT(*) AS total FROM sound_effect_categories").get()?.total ?? 0;
  if (count > 0) {
    return;
  }

  const createdAt = nowIso();
  const insert = db.prepare(`
    INSERT INTO sound_effect_categories (id, name, sort_order, created_at, updated_at)
    VALUES (@id, @name, @sortOrder, @createdAt, @updatedAt)
  `);
  const save = db.transaction(() => {
    defaultSoundEffectCategories.forEach((name, index) => {
      insert.run({
        id: `sound-category-${index + 1}`,
        name,
        sortOrder: index + 1,
        createdAt,
        updatedAt: createdAt,
      });
    });
  });
  save();
}

ensureDefaultSoundEffectCategories();

function backfillProgramCategories() {
  const regularId = defaultCategoryIdForName("常规节目");
  const dailyId = defaultCategoryIdForName("每日早报") ?? regularId;
  const hotId = defaultCategoryIdForName("今日热榜") ?? regularId;
  const updatedAt = nowIso();

  db.prepare("UPDATE programs SET category_id = ?, updated_at = ? WHERE category_id IS NULL AND plugin_id = 'daily-briefing'").run(dailyId, updatedAt);
  db.prepare("UPDATE programs SET category_id = ?, updated_at = ? WHERE category_id IS NULL AND plugin_id = 'hot-topics'").run(hotId, updatedAt);
  db.prepare("UPDATE programs SET category_id = ?, updated_at = ? WHERE category_id IS NULL").run(regularId, updatedAt);
}

backfillProgramCategories();

// 后台媒体任务依赖当前 Node 进程中的 yt-dlp/FFmpeg 子进程；服务重启后不能继续。
// 明确标记为失败，避免节目永久停留在“生成中”且无法重试或删除。
db.prepare(`
  UPDATE programs
  SET status = 'failed',
      error_message = '服务在后台生成期间重启，请重新提交后台生成任务',
      updated_at = ?
  WHERE plugin_id = 'remote-media' AND status = 'generating'
`).run(nowIso());

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function normalizeAudioMix(input = {}) {
  const effectIds = Array.isArray(input.effectIds)
    ? [...new Set(input.effectIds.map((id) => String(id ?? "").trim()).filter(Boolean))]
    : [];
  const loopMode = input.loopMode === "sequence" ? "sequence" : "single";
  const startMode = input.startMode === "effect-first" ? "effect-first" : "voice-first";

  return {
    enabled: Boolean(input.enabled || effectIds.length),
    effectIds,
    leadSeconds: clampNumber(input.leadSeconds, 0, 30, defaultAudioMix.leadSeconds),
    loopMode,
    startMode,
    volume: clampNumber(input.volume, 0, 1, defaultAudioMix.volume),
  };
}

function mergeConfig(input = {}) {
  const llm = { ...defaultConfig.llm, ...(input.llm ?? {}) };
  const tts = { ...defaultConfig.tts, ...(input.tts ?? {}) };
  const sunoInput = input.suno ?? {};
  const suno = {
    ...defaultConfig.suno,
    baseUrl: /sunoapi\.org/iu.test(String(sunoInput.baseUrl ?? ""))
      ? defaultConfig.suno.baseUrl
      : String(sunoInput.baseUrl ?? defaultConfig.suno.baseUrl).trim() || defaultConfig.suno.baseUrl,
    captchaKey: String(sunoInput.captchaKey ?? "").trim(),
    cookie: normalizeSunoCookie(sunoInput.cookie),
    defaultPrompt: String(sunoInput.defaultPrompt ?? defaultConfig.suno.defaultPrompt),
    enabled: sunoInput.enabled !== false,
    instrumental: Boolean(sunoInput.instrumental),
    model: normalizeSunoModel(sunoInput.model),
    negativeTags: String(sunoInput.negativeTags ?? defaultConfig.suno.negativeTags),
    style: String(sunoInput.style ?? defaultConfig.suno.style),
  };

  if (!llm.systemPrompt || llm.systemPrompt === oldDefaultSystemPrompt) {
    llm.systemPrompt = defaultSystemPrompt;
  }

  tts.hostVoices = {
    ...defaultHostVoices,
    ...(tts.hostVoices ?? {}),
  };
  if (String(tts.engine ?? "").trim().toLowerCase() === "local") {
    tts.engine = defaultConfig.tts.engine;
    tts.provider = defaultConfig.tts.provider;
    tts.baseUrl = tts.baseUrl || defaultConfig.tts.baseUrl;
    tts.model = tts.model && tts.model !== "linux-system-speech" ? tts.model : defaultConfig.tts.model;
    tts.voiceId = tts.voiceId || defaultConfig.tts.voiceId;
    tts.format = tts.format || defaultConfig.tts.format;
  }
  tts.defaultStylePrompt = String(tts.defaultStylePrompt ?? defaultConfig.tts.defaultStylePrompt).trim() || defaultConfig.tts.defaultStylePrompt;
  tts.stylePresets = Array.from(new Set(
    (Array.isArray(tts.stylePresets) ? tts.stylePresets : defaultVoiceStylePresets)
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
  ));
  if (!tts.stylePresets.length) {
    tts.stylePresets = [...defaultVoiceStylePresets];
  }

  return {
    llm,
    tts,
    suno,
    plugins: {
      dailyBriefing: {
        ...defaultConfig.plugins.dailyBriefing,
        ...(input.plugins?.dailyBriefing ?? {}),
        audioMix: normalizeAudioMix(input.plugins?.dailyBriefing?.audioMix ?? defaultConfig.plugins.dailyBriefing.audioMix),
        playbackSpeed: clampNumber(input.plugins?.dailyBriefing?.playbackSpeed, 0.5, 2, defaultConfig.plugins.dailyBriefing.playbackSpeed),
      },
      hotTopics: {
        ...defaultConfig.plugins.hotTopics,
        ...(input.plugins?.hotTopics ?? {}),
        audioMix: normalizeAudioMix(input.plugins?.hotTopics?.audioMix ?? defaultConfig.plugins.hotTopics.audioMix),
        playbackSpeed: clampNumber(input.plugins?.hotTopics?.playbackSpeed, 0.5, 2, defaultConfig.plugins.hotTopics.playbackSpeed),
        token: input.plugins?.hotTopics?.token || input.plugins?.dailyBriefing?.token || defaultConfig.plugins.hotTopics.token,
      },
      customProgram: {
        ...defaultConfig.plugins.customProgram,
        ...(input.plugins?.customProgram ?? {}),
        audioMix: normalizeAudioMix(input.plugins?.customProgram?.audioMix ?? defaultConfig.plugins.customProgram.audioMix),
      },
      kugouMusic: {
        ...defaultConfig.plugins.kugouMusic,
        ...(input.plugins?.kugouMusic ?? {}),
        provider: ["auto", "kugou", "netease", "qq"].includes(String(input.plugins?.kugouMusic?.provider ?? ""))
          ? String(input.plugins.kugouMusic.provider)
          : defaultConfig.plugins.kugouMusic.provider,
      },
      neteaseMusic: {
        ...defaultConfig.plugins.neteaseMusic,
        ...(input.plugins?.neteaseMusic ?? {}),
      },
      qqMusic: {
        ...defaultConfig.plugins.qqMusic,
        ...(input.plugins?.qqMusic ?? {}),
      },
    },
    storage: {
      autoCleanupEnabled: Boolean(input.storage?.autoCleanupEnabled),
      autoCleanupMaxAgeDays: clampNumber(input.storage?.autoCleanupMaxAgeDays, 1, 365, defaultConfig.storage.autoCleanupMaxAgeDays),
      autoCleanupKeepProgramAudio: input.storage?.autoCleanupKeepProgramAudio !== false,
      autoCleanupLastRun: String(input.storage?.autoCleanupLastRun ?? ""),
    },
  };
}

function readConfig() {
  const rows = db.prepare("SELECT service, payload FROM configs").all();
  const loaded = {};

  for (const row of rows) {
    try {
      loaded[row.service] = JSON.parse(row.payload);
    } catch {
      loaded[row.service] = {};
    }
  }

  return mergeConfig(loaded);
}

function readConfigSavedAt() {
  const row = db.prepare("SELECT MAX(updated_at) AS savedAt FROM configs").get();
  return row?.savedAt ?? "";
}

function normalizeSystemSettings(input = {}) {
  const logoUrl = String(input.logoUrl ?? "").trim();
  const rawFooterText = String(input.footerText ?? defaultSystemSettings.footerText).trim();
  const baseTemplates = defaultSystemSettings.templates;
  const incomingTemplates = Array.isArray(input.templates)
    ? input.templates
        .map((template) => ({
          description: String(template?.description ?? "").trim(),
          id: String(template?.id ?? "").trim(),
          mode: template?.mode === "dark" ? "dark" : "light",
          name: String(template?.name ?? "").trim(),
        }))
        .filter((template) => template.id && template.name)
    : [];
  const templateMap = new Map(baseTemplates.map((template) => [template.id, template]));
  for (const template of incomingTemplates) {
    templateMap.set(template.id, { ...templateMap.get(template.id), ...template });
  }
  const templates = Array.from(templateMap.values());
  const requestedTemplateId = String(input.themeTemplateId ?? defaultSystemSettings.themeTemplateId).trim();
  const themeTemplateId = templates.some((template) => template.id === requestedTemplateId) ? requestedTemplateId : defaultSystemSettings.themeTemplateId;
  return {
    appName: String(input.appName ?? defaultSystemSettings.appName).trim() || defaultSystemSettings.appName,
    autoThemeByTime: Boolean(input.autoThemeByTime),
    footerText: rawFooterText && rawFooterText !== "AI Radio Admin" ? rawFooterText : defaultSystemSettings.footerText,
    logoUrl: logoUrl.startsWith("data:image/") || logoUrl.startsWith("/storage/") || /^https?:\/\//iu.test(logoUrl) ? logoUrl : "",
    subtitle: String(input.subtitle ?? defaultSystemSettings.subtitle).trim() || defaultSystemSettings.subtitle,
    templates,
    themeTemplateId,
  };
}

function readSystemSettings() {
  const row = db.prepare("SELECT payload FROM configs WHERE service = 'system'").get();
  if (!row?.payload) {
    return defaultSystemSettings;
  }
  try {
    return normalizeSystemSettings(JSON.parse(row.payload));
  } catch {
    return defaultSystemSettings;
  }
}

function saveSystemSettings(settings) {
  const next = normalizeSystemSettings(settings);
  const savedAt = nowIso();
  db.prepare(`
    INSERT INTO configs (service, payload, updated_at)
    VALUES ('system', ?, ?)
    ON CONFLICT(service) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).run(JSON.stringify(next), savedAt);
  return next;
}

const upsertConfig = db.transaction((config) => {
  const savedAt = nowIso();
  const statement = db.prepare(`
    INSERT INTO configs (service, payload, updated_at)
    VALUES (@service, @payload, @updatedAt)
    ON CONFLICT(service) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `);

  for (const service of ["llm", "tts", "suno", "plugins", "storage"]) {
    statement.run({
      service,
      payload: JSON.stringify(config[service] ?? {}),
      updatedAt: savedAt,
    });
  }

  return savedAt;
});

function validateServiceConfig(config) {
  const missing = [];
  if (!String(config?.baseUrl ?? "").trim()) {
    missing.push("Endpoint");
  }
  if (!String(config?.apiKey ?? "").trim()) {
    missing.push("API Key");
  }
  if (!String(config?.model ?? "").trim()) {
    missing.push("Model");
  }
  return missing;
}

const sunoCookieAttributeNames = new Set([
  "domain", "expires", "httponly", "max-age", "partitioned", "path",
  "priority", "samesite", "secure",
]);

function normalizeSunoCookie(input) {
  const normalized = String(input ?? "").replace(/\b(?:set-cookie|cookie)\s*:\s*/giu, " ");
  const cookies = new Map();
  const pattern = /([!#$%&'*+\-.^_`|~0-9A-Za-z]+)=([^;\r\n,]*)/gu;
  for (const match of normalized.matchAll(pattern)) {
    const name = match[1].trim();
    if (!name || sunoCookieAttributeNames.has(name.toLowerCase())) {
      continue;
    }
    cookies.set(name, match[2].trim());
  }
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function normalizeSunoModel(input) {
  const value = String(input ?? "").trim().toLowerCase();
  if (!value || ["auto", "chirp-v3-5"].includes(value)) {
    return "auto";
  }
  if (["v5.5", "v5_5", "chirp-v5-5", "chirp-fenix"].includes(value)) {
    return "chirp-fenix";
  }
  if (["v4.5", "v4_5", "chirp-v4-5", "chirp-auk"].includes(value)) {
    return "chirp-auk";
  }
  return String(input).trim();
}

function sunoModelForQuota(quota) {
  const monthlyLimit = Number(quota?.monthly_limit ?? 0);
  return monthlyLimit > 50 ? "chirp-fenix" : "chirp-auk";
}

async function resolveSunoModel(config) {
  const configured = normalizeSunoModel(config?.model);
  if (configured !== "auto") {
    return configured;
  }
  const quota = await callSunoApi(config, "/api/get_limit");
  return sunoModelForQuota(quota);
}

function validateSunoConfig(config) {
  const missing = [];
  if (!String(config?.baseUrl ?? "").trim()) {
    missing.push("本地服务地址");
  }
  if (!String(config?.cookie ?? "").trim()) {
    missing.push("Suno Cookie");
  }
  if (!String(config?.model ?? "").trim()) {
    missing.push("模型版本");
  }
  if (!String(config?.captchaKey ?? "").trim()) {
    missing.push("2Captcha API Key（Suno hCaptcha 必需）");
  }
  return missing;
}

async function callSunoApi(config, pathName, options = {}) {
  const baseUrl = normalizeBaseUrl(config?.baseUrl);
  if (!baseUrl) {
    throw new Error("Suno 本地服务地址未配置");
  }
  const cookie = normalizeSunoCookie(config?.cookie);
  if (!cookie) {
    throw new Error("Suno Cookie 未配置");
  }
  if (!/(?:^|;\s*)__client=/u.test(cookie)) {
    throw new Error("Suno Cookie 缺少 __client；请粘贴 client?... 请求的 Cookie 或完整 Set-Cookie 内容");
  }
  const response = await fetch(`${baseUrl}${pathName.startsWith("/") ? pathName : `/${pathName}`}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Cookie: cookie,
      ...(String(config?.captchaKey ?? "").trim() ? { "X-2Captcha-Key": String(config.captchaKey).trim() } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const reason = payload?.error ?? payload?.message ?? text ?? `HTTP ${response.status}`;
    throw new Error(`Suno API 请求失败：${reason}`);
  }
  return payload;
}

function parseAiMusicPlan(content, fallback = {}) {
  const raw = String(content ?? "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1] ?? raw;
  const candidates = [
    fenced,
    fenced.slice(Math.max(0, fenced.indexOf("{")), fenced.lastIndexOf("}") + 1),
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return {
          title: String(parsed.title ?? fallback.title ?? "AI原创音乐").trim() || "AI原创音乐",
          style: String(parsed.style ?? parsed.tags ?? fallback.style ?? "").trim(),
          lyrics: String(parsed.lyrics ?? parsed.prompt ?? fallback.lyrics ?? "").trim(),
          negativeTags: String(parsed.negativeTags ?? parsed.negative_tags ?? fallback.negativeTags ?? "").trim(),
          voiceGender: ["male", "female"].includes(String(parsed.voiceGender ?? fallback.voiceGender ?? "").toLowerCase())
            ? String(parsed.voiceGender ?? fallback.voiceGender).toLowerCase()
            : "random",
        };
      }
    } catch {
      // Try the next JSON extraction strategy.
    }
  }
  throw new Error("大模型没有返回可解析的歌曲方案");
}

async function generateAiMusicPlan(config, input = {}) {
  const missing = validateServiceConfig(config.llm);
  if (missing.length) {
    throw new Error(`大模型配置缺少：${missing.join("、")}`);
  }
  if (!config.llm.enabled) {
    throw new Error("大模型 API 当前未启用");
  }
  const brief = String(input.brief ?? config.suno.defaultPrompt ?? "").trim();
  const instrumental = Boolean(input.instrumental);
  const requestedGender = ["male", "female"].includes(String(input.voiceGender ?? "").toLowerCase())
    ? String(input.voiceGender).toLowerCase()
    : (Math.random() < 0.5 ? "female" : "male");
  const variationNonce = String(input.variationNonce ?? `${Date.now()}-${randomUUID()}`);
  const endpoint = buildEndpoint(config.llm.baseUrl, "/chat/completions");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: jsonHeaders(config.llm),
    body: JSON.stringify({
      model: config.llm.model,
      messages: [
        {
          role: "system",
          content:
            "你是中文原创音乐制作人，负责为 Suno Custom Mode 设计歌曲。" +
            "只输出严格 JSON，不要 Markdown。格式：" +
            "{\"title\":\"歌名\",\"style\":\"英文或中英混合音乐风格标签\",\"lyrics\":\"带 [Verse] [Chorus] 等结构标记的完整原创歌词\",\"negativeTags\":\"不希望出现的风格\"}。" +
            "歌词必须原创、自然、适合演唱，不得模仿或引用现有歌曲。每次必须随机选择不同题材、叙事视角、曲风、速度和配器，不能复用固定模板。",
        },
        {
          role: "user",
          content:
            `随机创作编号：${variationNonce}\n` +
            `创作需求：${brief || "不限定主题，请自由随机创作一首适合电台播放的原创歌曲"}\n` +
            `暂定标题：${String(input.title ?? "").trim() || "请自动命名"}\n` +
            `默认风格参考：${String(input.style ?? config.suno.style ?? "").trim()}\n` +
            `纯音乐：${instrumental ? "是；lyrics 返回简短的器乐段落结构说明，不写演唱歌词" : "否；需要完整中文歌词"}\n` +
            `主唱性别：${requestedGender === "female" ? "女声" : "男声"}\n` +
            `排除风格：${String(input.negativeTags ?? config.suno.negativeTags ?? "").trim()}`,
        },
      ],
      temperature: Math.max(0.6, Number(config.llm.temperature ?? 0.8)),
      max_tokens: Math.max(1800, Number(config.llm.maxTokens ?? 2400)),
      stream: false,
    }),
  });
  if (!response.ok) {
    throw new Error(`AI 音乐方案生成失败：${await readError(response)}`);
  }
  const data = await response.json();
  return parseAiMusicPlan(chatCompletionText(data), {
    title: input.title,
    style: input.style ?? config.suno.style,
    negativeTags: input.negativeTags ?? config.suno.negativeTags,
    voiceGender: requestedGender,
  });
}

async function waitForSunoAudio(config, clips, timeoutMs = 150_000) {
  const ids = (Array.isArray(clips) ? clips : [])
    .map((clip) => String(clip?.id ?? "").trim())
    .filter(Boolean);
  if (!ids.length) {
    throw new Error("Suno 没有返回生成任务 ID");
  }
  const startedAt = Date.now();
  let latest = clips;
  while (Date.now() - startedAt < timeoutMs) {
    const ready = (Array.isArray(latest) ? latest : []).filter(
      (clip) => ["streaming", "complete"].includes(String(clip?.status ?? "")) && clip?.audio_url,
    );
    const errors = (Array.isArray(latest) ? latest : []).filter((clip) => clip?.status === "error");
    if (ready.length + errors.length >= ids.length) {
      if (!ready.length) {
        throw new Error(errors[0]?.error_message || "Suno 音乐生成失败");
      }
      return { clips: latest, ready };
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
    latest = await callSunoApi(config, `/api/get?ids=${encodeURIComponent(ids.join(","))}`);
  }
  const ready = (Array.isArray(latest) ? latest : []).filter(
    (clip) => ["streaming", "complete"].includes(String(clip?.status ?? "")) && clip?.audio_url,
  );
  if (ready.length) {
    return { clips: latest, ready };
  }
  throw new Error("Suno 音乐仍在生成，等待超时，请稍后重试");
}

function normalizeVoiceGender(value) {
  const gender = String(value ?? "random").toLowerCase();
  return ["male", "female"].includes(gender) ? gender : "random";
}

function styleWithVoiceGender(style, gender) {
  const cleaned = String(style ?? "").trim();
  const vocalStyle = gender === "female" ? "female lead vocals" : "male lead vocals";
  return new RegExp(`\\b${gender}\\b`, "iu").test(cleaned) ? cleaned : [cleaned, vocalStyle].filter(Boolean).join(", ");
}

async function storeSunoAudio(clip, programId) {
  const remoteUrl = String(clip?.audio_url ?? "").trim();
  if (!remoteUrl) {
    throw new Error("Suno 任务没有返回音频地址");
  }
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Suno 音频下载失败：HTTP ${response.status}`);
  }
  const mimeType = response.headers.get("content-type") || "audio/mpeg";
  const extension = audioExtensionFromMime(mimeType, new URL(remoteUrl).pathname) || "mp3";
  const fileName = `${programId}-suno.${extension}`;
  const audioPath = path.join(audioDir, fileName);
  fs.writeFileSync(audioPath, Buffer.from(await response.arrayBuffer()));
  return { audioPath, audioUrl: `/storage/audio/${fileName}` };
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "").trim().replace(/\/+$/, "");
}

function isPrivateMediaAddress(address) {
  const normalized = String(address ?? "").toLowerCase().split("%")[0];
  if (net.isIPv4(normalized)) {
    const parts = normalized.split(".").map(Number);
    return (
      parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] >= 224
    );
  }
  if (net.isIPv6(normalized)) {
    return (
      normalized === "::" || normalized === "::1" ||
      normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb") ||
      normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }
  return true;
}

async function validateRemoteMediaUrl(input) {
  let url;
  try {
    url = new URL(String(input ?? "").trim());
  } catch {
    throw new Error("请输入完整的 http:// 或 https:// 多媒体播放地址");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("媒体地址仅支持 HTTP 或 HTTPS 协议");
  }
  if (url.username || url.password) {
    throw new Error("媒体地址不能包含用户名或密码");
  }
  const addresses = net.isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateMediaAddress(item.address))) {
    throw new Error("为保护服务器安全，媒体地址不能指向本机、局域网或保留网络");
  }
  return url.toString();
}

async function resolveRemoteMediaUrl(input) {
  let current = await validateRemoteMediaUrl(input);
  for (let redirects = 0; redirects < 5; redirects += 1) {
    let response;
    try {
      response = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
        headers: { "User-Agent": "Airadio-Media-Probe/1.0" },
      });
    } catch {
      return current;
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return current;
    }
    const location = response.headers.get("location");
    if (!location) {
      return current;
    }
    current = await validateRemoteMediaUrl(new URL(location, current).toString());
  }
  throw new Error("媒体地址重定向次数过多");
}

function mediaProbeTitle(probe, mediaUrl) {
  const tagged = String(probe?.format?.tags?.title ?? "").trim();
  if (tagged) {
    return tagged.slice(0, 120);
  }
  try {
    const filename = decodeURIComponent(new URL(mediaUrl).pathname.split("/").filter(Boolean).pop() ?? "")
      .replace(/\.(?:aac|flac|m3u8|m4a|mp3|mp4|ogg|opus|wav|webm)$/iu, "")
      .trim();
    return filename.slice(0, 120);
  } catch {
    return "网络媒体节目";
  }
}

function safeMediaRequestHeaders(headers = {}) {
  const allowed = new Set(["accept", "accept-language", "cookie", "origin", "referer", "user-agent"]);
  return Object.fromEntries(Object.entries(headers)
    .map(([name, value]) => [String(name).toLowerCase(), String(value ?? "").replace(/[\r\n]/gu, "").trim()])
    .filter(([name, value]) => allowed.has(name) && value));
}

function ffmpegHeaderArguments(headers = {}) {
  const entries = Object.entries(safeMediaRequestHeaders(headers));
  return entries.length
    ? ["-headers", `${entries.map(([name, value]) => `${name}: ${value}`).join("\r\n")}\r\n`]
    : [];
}

function publicMediaProbe(probe) {
  const { requestHeaders, siteCookie, ...safe } = probe ?? {};
  return safe.resolver && safe.resolver !== "direct"
    ? { ...safe, mediaUrl: safe.originalUrl }
    : safe;
}

function mediaSiteCookieFile(pageUrl, rawCookie) {
  const cookie = cookieToHeader(mergeCookieValues(rawCookie));
  if (!cookie) {
    return null;
  }
  const url = new URL(pageUrl);
  const hostname = url.hostname.toLowerCase();
  const domain = hostname.startsWith("www.") ? `.${hostname.slice(4)}` : hostname;
  const expires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const rows = ["# Netscape HTTP Cookie File"];
  for (const [name, value] of Object.entries(mergeCookieValues(cookie))) {
    rows.push([domain, domain.startsWith(".") ? "TRUE" : "FALSE", "/", url.protocol === "https:" ? "TRUE" : "FALSE", expires, name, value].join("\t"));
  }
  const filePath = path.join(apiTmpDir, `media-cookie-${randomUUID()}.txt`);
  fs.writeFileSync(filePath, `${rows.join("\n")}\n`, { mode: 0o600 });
  return filePath;
}

async function probeMediaStream(mediaUrl, requestHeaders = {}) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-rw_timeout", "30000000",
    ...ffmpegHeaderArguments(requestHeaders),
    "-show_entries", "format=duration,format_name:format_tags=title:stream=codec_type,codec_name",
    "-of", "json",
    mediaUrl,
  ], { maxBuffer: 2 * 1024 * 1024, timeout: 45_000 });
  const probe = JSON.parse(stdout || "{}");
  const audioStream = (Array.isArray(probe.streams) ? probe.streams : []).find((stream) => stream?.codec_type === "audio");
  if (!audioStream) {
    throw new Error("该地址没有检测到音轨");
  }
  const duration = Number(probe?.format?.duration ?? 0);
  return {
    codec: String(audioStream.codec_name ?? "unknown"),
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 10) / 10 : 0,
    format: String(probe?.format?.format_name ?? "unknown"),
    title: mediaProbeTitle(probe, mediaUrl),
  };
}

function bilibiliVideoId(input) {
  return String(input ?? "").match(/(?:bilibili\.com\/video\/)(BV[0-9A-Za-z]+)/iu)?.[1] ?? "";
}

async function resolveBilibiliPage(pageUrl, siteCookie = "") {
  const bvid = bilibiliVideoId(pageUrl);
  if (!bvid) {
    return null;
  }
  const referer = `https://www.bilibili.com/video/${bvid}/`;
  const requestHeaders = safeMediaRequestHeaders({
    Referer: referer,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  });
  const apiHeaders = safeMediaRequestHeaders({
    Cookie: cookieToHeader(mergeCookieValues(siteCookie)),
    ...requestHeaders,
  });
  const viewResponse = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
    headers: apiHeaders,
    signal: AbortSignal.timeout(20_000),
  });
  const view = await viewResponse.json();
  if (!viewResponse.ok || Number(view?.code) !== 0 || !view?.data?.cid) {
    throw new Error(`Bilibili 页面信息解析失败：${view?.message || `HTTP ${viewResponse.status}`}`);
  }
  const cid = view.data.cid;
  const playResponse = await fetch(
    `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}&fnval=16&qn=80&fourk=1`,
    { headers: apiHeaders, signal: AbortSignal.timeout(20_000) },
  );
  const play = await playResponse.json();
  const audios = Array.isArray(play?.data?.dash?.audio)
    ? [...play.data.dash.audio].sort((a, b) => Number(b?.bandwidth ?? 0) - Number(a?.bandwidth ?? 0))
    : [];
  const selected = audios[0] ?? play?.data?.durl?.[0];
  const mediaUrl = String(selected?.baseUrl ?? selected?.base_url ?? selected?.url ?? "").trim();
  if (!playResponse.ok || Number(play?.code) !== 0 || !mediaUrl) {
    throw new Error(`Bilibili 没有返回可用音轨：${play?.message || "可能需要登录 Cookie 或该内容受限"}`);
  }
  await validateRemoteMediaUrl(mediaUrl);
  return {
    codec: String(selected?.codecs ?? "aac").split(".")[0],
    creator: String(view.data.owner?.name ?? "").trim(),
    duration: Math.max(0, Number(view.data.duration ?? play?.data?.dash?.duration ?? 0)),
    format: "bilibili-dash",
    mediaUrl,
    originalUrl: referer,
    requestHeaders,
    resolver: "bilibili-api",
    siteCookie,
    title: String(view.data.title ?? bvid).trim(),
  };
}

async function resolveMediaPageWithYtDlp(pageUrl, siteCookie = "") {
  const cookieFile = mediaSiteCookieFile(pageUrl, siteCookie);
  try {
    const args = [
      "--no-config", "--no-playlist", "--no-warnings", "--skip-download",
      "--dump-single-json", "--socket-timeout", "30", "--impersonate", "chrome",
      "--format", "bestaudio/best",
      ...(cookieFile ? ["--cookies", cookieFile] : []),
      pageUrl,
    ];
    const runYtDlp = () => execFileAsync("yt-dlp", args, { maxBuffer: 16 * 1024 * 1024, timeout: 90_000 });
    let stdout;
    try {
      ({ stdout } = await runYtDlp());
    } catch (firstError) {
      const detail = String(firstError?.stderr ?? firstError?.message ?? "");
      const isYouTubeBotCheck = !cookieFile
        && /youtube/iu.test(pageUrl)
        && /Sign in to confirm|not a bot|Use --cookies/iu.test(detail);
      if (!isYouTubeBotCheck) {
        throw firstError;
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
      ({ stdout } = await runYtDlp());
    }
    const data = JSON.parse(String(stdout ?? "").trim());
    const selected = Array.isArray(data.requested_formats)
      ? data.requested_formats.find((format) => format?.acodec && format.acodec !== "none")
      : data;
    const mediaUrl = String(selected?.url ?? data.url ?? "").trim();
    if (!mediaUrl) {
      throw new Error("yt-dlp 没有返回可用音频流");
    }
    await validateRemoteMediaUrl(mediaUrl);
    return {
      codec: String(selected?.acodec ?? data.acodec ?? "unknown").split(".")[0],
      creator: String(data.uploader ?? data.channel ?? data.creator ?? "").trim(),
      duration: Math.max(0, Number(data.duration ?? 0)),
      format: String(selected?.ext ?? data.ext ?? data.protocol ?? "web-media"),
      mediaUrl,
      originalUrl: String(data.webpage_url ?? pageUrl),
      requestHeaders: safeMediaRequestHeaders({ ...(data.http_headers ?? {}), ...(selected?.http_headers ?? {}) }),
      resolver: `yt-dlp:${String(data.extractor_key ?? data.extractor ?? "generic")}`,
      siteCookie,
      title: String(data.title ?? "网络媒体节目").trim(),
    };
  } finally {
    if (cookieFile && fs.existsSync(cookieFile)) {
      fs.rmSync(cookieFile, { force: true });
    }
  }
}

async function probeRemoteMedia(input, options = {}) {
  const originalUrl = await resolveRemoteMediaUrl(input);
  try {
    const direct = await probeMediaStream(originalUrl);
    return { ...direct, creator: "", mediaUrl: originalUrl, originalUrl, requestHeaders: {}, resolver: "direct", siteCookie: "" };
  } catch (directError) {
    try {
      const resolved = await resolveBilibiliPage(originalUrl, options.siteCookie)
        ?? await resolveMediaPageWithYtDlp(originalUrl, options.siteCookie);
      if (String(resolved.resolver).startsWith("yt-dlp:")) {
        return resolved;
      }
      const detected = await probeMediaStream(resolved.mediaUrl, resolved.requestHeaders);
      return {
        ...resolved,
        codec: detected.codec || resolved.codec,
        duration: resolved.duration || detected.duration,
        format: resolved.format || detected.format,
        title: resolved.title || detected.title,
      };
    } catch (resolverError) {
      if (resolverError?.code === "ENOENT") {
        throw new Error("服务器尚未安装 yt-dlp 或 FFmpeg，无法解析媒体页面");
      }
      const resolverDetail = String(resolverError?.stderr ?? resolverError?.message ?? resolverError).trim();
      if (/Sign in to confirm|not a bot/iu.test(resolverDetail)) {
        throw new Error("YouTube 触发了人机验证。请在节目制作的“站点 Cookie”中填写 YouTube 登录 Cookie 后重试，或稍后再试。");
      }
      const directDetail = String(directError?.stderr ?? directError?.message ?? directError).trim().split("\n").slice(-1)[0];
      const shortDetail = resolverDetail.split("\n").slice(-2).join(" ");
      throw new Error(`页面解析失败：${shortDetail || directDetail || "没有找到可播放音轨"}`);
    }
  }
}

async function storeRemoteMediaAudio(probe, programId, durationLimitSeconds) {
  const outputPath = path.join(audioDir, `${programId}-remote-media.mp3`);
  const limit = Math.round(clampNumber(durationLimitSeconds, 30, 21_600, 21_600));
  const pageResolver = String(probe?.resolver ?? "").startsWith("yt-dlp:");
  const shouldClip = !Number(probe?.duration) || limit < Math.max(1, Number(probe.duration) - 1);
  let cookieFile = null;
  try {
    if (pageResolver) {
      cookieFile = mediaSiteCookieFile(probe.originalUrl, probe.siteCookie);
      const outputTemplate = outputPath.replace(/\.mp3$/u, ".%(ext)s");
      const commonArgs = [
        "--no-config", "--no-playlist", "--no-warnings", "--impersonate", "chrome", "--force-ipv4",
        "--socket-timeout", "30", "--retries", "10", "--fragment-retries", "10",
        "--retry-sleep", "http:linear=2::10", "--retry-sleep", "fragment:linear=1::5",
        "--concurrent-fragments", "4",
        "--extract-audio", "--audio-format", "mp3", "--audio-quality", "192K",
        ...(shouldClip ? ["--download-sections", `*0-${limit}`] : []),
        "--output", outputTemplate,
        ...(cookieFile ? ["--cookies", cookieFile] : []),
      ];
      try {
        await execFileAsync("yt-dlp", [
          ...commonArgs,
          "--format", "bestaudio/best",
          probe.originalUrl,
        ], { maxBuffer: 8 * 1024 * 1024, timeout: 60 * 60_000 });
      } catch (firstError) {
        for (const name of fs.readdirSync(audioDir).filter((name) => name.startsWith(`${programId}-remote-media.`))) {
          fs.rmSync(path.join(audioDir, name), { force: true });
        }
        if (!/youtube/iu.test(String(probe.resolver))) {
          throw firstError;
        }
        await execFileAsync("yt-dlp", [
          ...commonArgs,
          "--extractor-args", "youtube:player_client=web_safari,web_embedded",
          "--format", "bestaudio[protocol*=m3u8]/bestaudio/best",
          probe.originalUrl,
        ], { maxBuffer: 8 * 1024 * 1024, timeout: 60 * 60_000 });
      }
    } else {
      await execFileAsync("ffmpeg", [
        "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-rw_timeout", "30000000",
        ...ffmpegHeaderArguments(probe.requestHeaders),
        "-protocol_whitelist", "http,https,tcp,tls,crypto",
        "-i", probe.mediaUrl,
        "-map", "0:a:0", "-vn", "-t", String(limit),
        "-c:a", "libmp3lame", "-b:a", "192k",
        outputPath,
      ], { maxBuffer: 4 * 1024 * 1024, timeout: 15 * 60_000 });
    }
    const stats = fs.statSync(outputPath);
    if (!stats.size) {
      throw new Error("提取后的音频文件为空");
    }
    return { audioPath: outputPath, audioUrl: `/storage/audio/${path.basename(outputPath)}` };
  } catch (error) {
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { force: true });
    }
    const detail = String(error?.stderr ?? error?.message ?? error).trim().split("\n").slice(-2).join(" ");
    throw new Error(`媒体音轨下载或转换失败${detail ? `：${detail}` : ""}`);
  } finally {
    if (cookieFile && fs.existsSync(cookieFile)) {
      fs.rmSync(cookieFile, { force: true });
    }
  }
}

async function generateMediaIntroduction(config, input) {
  const missing = validateServiceConfig(config);
  if (missing.length) {
    throw new Error(`大模型配置缺少：${missing.join("、")}`);
  }
  if (!config.enabled) {
    throw new Error("大模型 API 当前未启用");
  }
  const endpoint = buildEndpoint(config.baseUrl, "/chat/completions");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: jsonHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "你是中文电台节目主持人。请为即将播放的网络媒体内容写一段原创介绍词，只输出可直接配音的正文，不要 Markdown、标题或说话人前缀。" +
            "长度 80 到 180 个汉字，说明内容名称和来源，语言自然，不能虚构未提供的事实，不要引用受版权保护的原文。",
        },
        {
          role: "user",
          content:
            `节目名称：${input.title}\n` +
            `内容作者或来源：${input.creator || "未填写"}\n` +
            `补充要求：${input.prompt || "简洁介绍并自然引出接下来的内容"}`,
        },
      ],
      temperature: Math.max(0.35, Number(config.temperature ?? 0.7)),
      max_tokens: Math.max(500, Number(config.maxTokens ?? 800)),
      stream: false,
    }),
  });
  if (!response.ok) {
    throw new Error(`媒体介绍词生成失败：${await readError(response)}`);
  }
  const data = await response.json();
  const text = chatCompletionText(data).replace(/^```(?:text)?|```$/giu, "").trim();
  if (!text) {
    throw new Error("大模型没有返回可用的媒体介绍词");
  }
  return text;
}

function buildEndpoint(baseUrl, endpoint) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    return "";
  }
  if (normalized.endsWith(endpoint)) {
    return normalized;
  }
  return `${normalized}${endpoint}`;
}

function speechEndpointForConfig(config) {
  const normalized = normalizeBaseUrl(config?.baseUrl);
  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized);
    const pathname = url.pathname.toLowerCase();
    if (
      pathname.includes("/audio/speech") ||
      pathname.includes("/text-to-speech") ||
      pathname.includes("/text:synthesize") ||
      pathname.includes("/cognitiveservices/v1") ||
      /\/(?:tts|speech|synthesize|voice)(?:\/|$)/u.test(pathname)
    ) {
      return normalized;
    }
    if (pathname === "/v1" || pathname.endsWith("/v1")) {
      return `${normalized}/audio/speech`;
    }
  } catch {
    if (/\/(?:audio\/speech|text-to-speech|text:synthesize|tts|speech|synthesize|voice)(?:[/?#]|$)/iu.test(normalized)) {
      return normalized;
    }
  }

  return normalized;
}

function jsonHeaders(config) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  return headers;
}

function mimoHeaders(config) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    // MiMo 走 OpenAI 兼容的 /chat/completions，标准鉴权是 Authorization: Bearer；
    // 同时保留 api-key 头以兼容 Azure 风格网关。
    headers.Authorization = `Bearer ${config.apiKey}`;
    headers["api-key"] = config.apiKey;
  }

  return headers;
}

function isMimoTts(config) {
  const marker = `${config.engine} ${config.provider} ${config.model} ${config.baseUrl}`.toLowerCase();
  return marker.includes("mimo") || marker.includes("小米");
}

function ttsEngine(config) {
  const marker = `${config.engine} ${config.provider} ${config.model} ${config.baseUrl}`.toLowerCase();
  if (marker.includes("mimo") || marker.includes("小米")) {
    return "mimo";
  }
  if (marker.includes("azure")) {
    return "azure";
  }
  if (marker.includes("google")) {
    return "google";
  }
  if (marker.includes("elevenlabs") || marker.includes("eleven labs")) {
    return "elevenlabs";
  }
  return "openai-compatible";
}

function ttsApiKeyOptional(config) {
  const marker = `${config.engine} ${config.provider} ${config.baseUrl}`.toLowerCase();
  return (
    marker.includes("gateway") ||
    marker.includes("local") ||
    marker.includes("edge") ||
    marker.includes("本地") ||
    marker.includes("通用") ||
    /^https?:\/\/(?:127\.0\.0\.1|localhost|\[?::1\]?)(?::\d+)?/iu.test(String(config?.baseUrl ?? "").trim())
  );
}

function validateTtsConfig(config) {
  const missing = [];
  if (!String(config?.baseUrl ?? "").trim()) {
    missing.push("Endpoint");
  }
  if (!String(config?.apiKey ?? "").trim() && !ttsApiKeyOptional(config)) {
    missing.push("API Key");
  }
  if (!String(config?.model ?? "").trim()) {
    missing.push("Model");
  }
  return missing;
}

function mimoVoiceId(config, hostId) {
  const mapped = hostId ? config.hostVoices?.[hostId] : "";
  const voice = String(mapped || config.voiceId || "").trim();
  return !voice || voice.toLowerCase() === "alloy" ? "mimo_default" : voice;
}

function normalizeAudioExtension(format, fallback = "mp3") {
  const value = String(format ?? fallback).toLowerCase();
  if (value.includes("wav") || value.includes("pcm")) {
    return "wav";
  }
  if (value.includes("aac")) {
    return "aac";
  }
  if (value.includes("opus")) {
    return "opus";
  }
  return "mp3";
}

function audioMimeFromExtension(extension) {
  if (extension === "wav") {
    return "audio/wav";
  }
  if (extension === "aac") {
    return "audio/aac";
  }
  if (extension === "opus") {
    return "audio/ogg";
  }
  return "audio/mpeg";
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function saveAudioBuffer(programId, extension, buffer) {
  const fileName = `${programId}.${extension}`;
  const audioPath = path.join(audioDir, fileName);
  fs.writeFileSync(audioPath, buffer);
  return {
    audioPath,
    audioUrl: `/storage/audio/${fileName}`,
    contentType: audioMimeFromExtension(extension),
  };
}

async function readError(response) {
  const text = await response.text().catch(() => "");
  if (!text) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const parsed = JSON.parse(text);
    return parsed.error?.message ?? parsed.message ?? text.slice(0, 500);
  } catch {
    return text.slice(0, 500);
  }
}

function friendlyNetworkError(label, endpoint, error) {
  const cause = error?.cause?.code || error?.code || "";
  const detail = error instanceof Error ? error.message : String(error);
  const suffix = cause ? `（${cause}）` : detail ? `（${detail}）` : "";
  return new Error(`${label}连接失败：${endpoint || "未配置端点"}${suffix}`);
}

async function fetchOrThrow(endpoint, options, label) {
  try {
    return await fetch(endpoint, options);
  } catch (error) {
    throw friendlyNetworkError(label, endpoint, error);
  }
}

function stripDataUrlPrefix(value) {
  return String(value ?? "").replace(/^data:audio\/[a-z0-9.+-]+;base64,/iu, "");
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

async function audioBufferFromUrl(audioUrl, endpoint) {
  const url = new URL(audioUrl, endpoint).toString();
  const response = await fetchOrThrow(url, {}, "通用语音接口音频下载");
  if (!response.ok) {
    throw new Error(`通用语音接口音频下载失败：${await readError(response)}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const extension = contentType.includes("wav") ? "wav" : contentType.includes("aac") ? "aac" : contentType.includes("opus") || contentType.includes("ogg") ? "opus" : "mp3";
  return { buffer: Buffer.from(await response.arrayBuffer()), extension };
}

async function audioFromGenericJson(data, endpoint, defaultFormat) {
  const audioUrl = firstString(
    data.audio_url,
    data.audioUrl,
    data.url,
    data.data?.audio_url,
    data.data?.audioUrl,
    data.data?.url,
    data.result?.audio_url,
    data.result?.audioUrl,
    data.result?.url,
  );
  if (audioUrl) {
    return audioBufferFromUrl(audioUrl, endpoint);
  }

  const audioBase64 = firstString(
    data.audio?.data,
    data.audio?.base64,
    data.audio,
    data.data?.audio?.data,
    data.data?.audio?.base64,
    data.data?.audio,
    data.data?.audioContent,
    data.audioContent,
    data.b64_json,
    data.choices?.[0]?.message?.audio?.data,
    data.result?.audio,
    data.result?.audioContent,
  );
  if (!audioBase64) {
    throw new Error("通用语音接口返回 JSON，但没有找到音频 base64 或音频 URL");
  }
  const format = data.audio?.format ?? data.data?.audio?.format ?? data.format ?? defaultFormat;
  return {
    buffer: Buffer.from(stripDataUrlPrefix(audioBase64), "base64"),
    extension: normalizeAudioExtension(format, defaultFormat),
  };
}

function wavDurationFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) {
    return null;
  }
  // 标准 RIFF/WAVE：byteRate 在偏移 28-31，data chunk 大小在偏移 40-43（紧凑 44 字节头）。
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }
  const byteRate = buffer.readUInt32LE(28);
  const dataSize = buffer.readUInt32LE(40);
  if (!byteRate || !dataSize) {
    return null;
  }
  return dataSize / byteRate;
}

// 估算口播段落时长（秒），兜底用字数/4.2。
function estimatedSpokenDuration(text) {
  return Math.max(3, Math.round(String(text ?? "").length / 4.2));
}

// 单段口播：优先用真实 WAV 时长，失败回退估算。
function spokenSegmentDuration(buffer, text) {
  const real = wavDurationFromBuffer(buffer);
  return real && Number.isFinite(real) ? Math.round(real) : estimatedSpokenDuration(text);
}

// 音乐串场配音段落：audio 可能为 { segments:[{duration}] } 或直接含字段，统一取真实时长并兜底。
function talkedSegmentDuration(audio, segment) {
  const seg = Array.isArray(audio?.segments) && audio.segments[0] ? audio.segments[0] : audio;
  const real = Number(seg?.duration);
  if (Number.isFinite(real) && real > 0) {
    return Math.max(3, Math.round(real));
  }
  return estimatedSpokenDuration(segment?.text);
}

function concatWav(buffers) {
  const validBuffers = buffers.filter((buffer) => Buffer.isBuffer(buffer) && buffer.length > 44);
  if (!validBuffers.length) {
    throw new Error("没有可合并的音频片段");
  }
  if (validBuffers.length === 1) {
    return validBuffers[0];
  }

  const header = Buffer.from(validBuffers[0].subarray(0, 44));
  const dataBuffers = validBuffers.map((buffer) => buffer.subarray(44));
  const dataSize = dataBuffers.reduce((total, buffer) => total + buffer.length, 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, ...dataBuffers]);
}

function sanitizeSpokenText(text) {
  return String(text ?? "")
    .replace(/^\s*[\[（(【]?[星遥宇轩若曦墨白小雅A-Za-z0-9_\-\s]{1,12}[\]）)】]?\s*[：:]\s*/u, "")
    .replace(/^\s*(?:(?:第\s*)?[一二三四五六七八九十百千万\d]+\s*(?:条|则|名|位|点)\s*[，,、.．：:\-\s]*|[一二三四五六七八九十百千万\d]+\s*[、.．：:]\s*|(?:首先|其次|再次|最后(?:一条|一点)?)[，,、.．：:\-\s]*)/u, "")
    .replace(/^\s*(?:(?:第\s*)?[一二三四五六七八九十百千万\d]+\s*(?:条|则|名|位|点)\s*[，,、.．：:\-\s]*|[一二三四五六七八九十百千万\d]+\s*[、.．：:]\s*)/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeScheduledAt(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  // "YYYY-MM-DDTHH:MM:SS" 形式（无时区后缀）按上海时间（UTC+8）解释，
  // 确保流程编排中 08:00 始终存储为 00:00 UTC，不受服务器时区影响。
  const hasTimezoneDesignator = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw);
  const date = new Date(hasTimezoneDesignator ? raw : `${raw}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function programAirTimeContext(scheduledAt, publishDate = null) {
  const date = scheduledAt ? new Date(scheduledAt) : null;
  const hasTime = date && !Number.isNaN(date.getTime());
  const labelDate = hasTime
    ? date.toLocaleString("zh-CN", { hour12: false, timeZone: WALL_TIME_ZONE })
    : publishDate
      ? `${publishDate}（未设置具体播放时间）`
      : "未设置具体播放时间";

  if (!hasTime) {
    return {
      forbidden: ["早上好", "早安", "上午好", "中午好", "下午好", "傍晚好", "晚上好", "晚安", "夜深了"],
      greeting: "欢迎收听",
      hasTime: false,
      instruction:
        "未设置具体播放时间时，不要使用早上好、晚上好、晚安、夜深了等强时段问候，用“欢迎收听”等中性开场。",
      label: labelDate,
      period: "未设置具体时段",
    };
  }

  const hour = shanghaiParts(date).hoursNum;
  const periods = [
    { end: 5, forbidden: ["早上好", "早安", "上午好", "中午好", "下午好", "傍晚好", "晚上好"], greeting: "夜深了", period: "深夜" },
    { end: 10, forbidden: ["中午好", "下午好", "傍晚好", "晚上好", "晚安", "夜深了"], greeting: "早上好", period: "早间" },
    { end: 12, forbidden: ["早上好", "早安", "中午好", "下午好", "傍晚好", "晚上好", "晚安", "夜深了"], greeting: "上午好", period: "上午" },
    { end: 14, forbidden: ["早上好", "早安", "上午好", "下午好", "傍晚好", "晚上好", "晚安", "夜深了"], greeting: "中午好", period: "中午" },
    { end: 18, forbidden: ["早上好", "早安", "上午好", "中午好", "傍晚好", "晚上好", "晚安", "夜深了"], greeting: "下午好", period: "下午" },
    { end: 22, forbidden: ["早上好", "早安", "上午好", "中午好", "下午好", "晚安", "夜深了"], greeting: "晚上好", period: "晚间" },
    { end: 24, forbidden: ["早上好", "早安", "上午好", "中午好", "下午好", "傍晚好"], greeting: "晚上好", period: "夜间" },
  ];
  const selected = periods.find((item) => hour < item.end) ?? periods[0];
  return {
    ...selected,
    hasTime: true,
    instruction:
      `节目计划在${labelDate}播出，属于${selected.period}时段。开场问候和语气必须匹配该时段；` +
      `可以使用“${selected.greeting}”或中性开场，禁止出现这些冲突表达：${selected.forbidden.join("、")}。`,
    label: labelDate,
  };
}

function airTimeUserPrompt(airTime) {
  return `计划播放时间：${airTime.label}\n时段要求：${airTime.instruction}\n`;
}

function alignTextToAirTime(text, airTime) {
  let next = sanitizeSpokenText(text);
  const neutral = airTime?.hasTime ? airTime.greeting : "欢迎收听";
  for (const forbidden of airTime?.forbidden ?? []) {
    if (forbidden === neutral) {
      continue;
    }
    next = next.replace(new RegExp(forbidden, "gu"), neutral);
  }
  return next.replace(/欢迎收听[，,、\s]*欢迎收听/gu, "欢迎收听");
}

function inferMimoDelivery(segment) {
  const text = sanitizeSpokenText(segment.text);
  const style = `${segment.style ?? ""} ${text}`;
  const tags = [];
  let emotion = "自然";
  let speed = "语速适中";
  let speedTag = "语速适中";

  // 新闻 / 早报 / 热榜类节目：所有段落使用统一语速，避免有的句子明显加速。
  const isNewsContext = /新闻|早报|热榜|快讯/u.test(style);
  if (isNewsContext) {
    return {
      emotion: "清晰",
      speed: "1倍正常语速，停顿自然，吐字清楚",
      speedTag: "语速适中",
      prefix: "(清晰，语速适中)",
    };
  }

  if (/哈哈|笑|有趣|搞笑|俏皮|可爱|开心|快乐|惊喜/u.test(style)) {
    emotion = "开心";
    speed = "语速稍快，停顿轻快";
    speedTag = "语速稍快";
    if (/哈哈|笑/u.test(text)) {
      tags.push("[轻笑]");
    }
  } else if (/雨|夜|晚安|治愈|温柔|陪伴|安静|放松|星夜/u.test(style)) {
    emotion = "温柔";
    speed = "语速稍慢，停顿柔和";
    speedTag = "语速稍慢";
  } else if (/新闻|早报|今日|重点|提醒|关注|数据|发布/u.test(style)) {
    emotion = "清晰";
    speed = "语速适中，吐字清晰";
    speedTag = "语速适中";
  } else if (/沉稳|深夜|叙事|思考|认真/u.test(style)) {
    emotion = "沉稳";
    speed = "语速适中偏慢，重音稳定";
    speedTag = "语速稍慢";
  }

  // 仅对非新闻类节目按内容微调语速；新闻类节目保持统一语速。
  if (!isNewsContext) {
    if (/[0-9０-９%％]|亿元|万人|公里|发布|统计|指数/u.test(text)) {
      speed = "语速适中偏慢，数字和重点信息咬字清楚";
      speedTag = "语速适中";
    } else if (/突发|紧急|提醒|预警|关注/u.test(text)) {
      speed = "语速适中偏快，重点词略加强";
      speedTag = "语速稍快";
    }
  }

  if (/！|!/.test(text) && !tags.includes("[轻笑]")) {
    tags.push("[提气]");
  }
  if (/？|\?/.test(text)) {
    tags.push("[轻声疑问]");
  }

  return {
    emotion,
    speed,
    speedTag,
    prefix: `(${emotion}，${speedTag})${tags.join("")}`,
  };
}

function buildMimoAssistantText(segment) {
  const text = sanitizeSpokenText(segment.text);
  const { prefix } = inferMimoDelivery(segment);
  return `${prefix}${text}`;
}

function normalizeHosts(hosts) {
  const fallback = [hostProfiles[0]];
  if (!Array.isArray(hosts) || hosts.length === 0) {
    return fallback;
  }

  const normalized = hosts
    .map((host) => {
      if (typeof host === "string") {
        return hostProfiles.find((profile) => profile.id === host || profile.name === host);
      }

      const id = String(host?.id ?? "").trim();
      const profile = hostProfiles.find((item) => item.id === id || item.name === host?.name);
      return {
        ...(profile ?? {}),
        id: id || profile?.id || String(host?.name ?? "").trim(),
        name: String(host?.name ?? profile?.name ?? "").trim(),
        voice: String(host?.voice ?? profile?.voice ?? "").trim(),
        tone: String(host?.tone ?? profile?.tone ?? "").trim(),
      };
    })
    .filter((host) => host?.id && host?.name);

  return normalized.length ? normalized : fallback;
}

function parseScriptPayload(content, hosts) {
  const raw = String(content ?? "").trim();
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/i) ?? raw.match(/```\s*([\s\S]*?)```/);
  const jsonText = jsonMatch?.[1] ?? raw;

  try {
    const parsed = JSON.parse(jsonText);
    const title = String(parsed.title ?? "").trim();
    const segments = Array.isArray(parsed.segments)
      ? parsed.segments
          .map((segment, index) => {
            const host =
              hosts.find((item) => item.id === segment.hostId || item.name === segment.hostName || item.name === segment.host) ??
              hosts[index % hosts.length];
            const text = sanitizeSpokenText(segment.text ?? segment.content ?? segment.line);

            return text
              ? {
                  hostId: host.id,
                  hostName: host.name,
                  text,
                  style: String(segment.style ?? host.tone ?? "").trim(),
                }
              : null;
          })
          .filter(Boolean)
      : [];

    if (segments.length) {
      return {
        script: segments.map((segment) => segment.text).join("\n\n"),
        segments,
        title,
      };
    }
  } catch {
    // Fall through to plain-text handling for non-JSON model responses.
  }

  const paragraphs = raw
    .split(/\n{2,}|(?<=。)\s+(?=.{8,})/u)
    .map(sanitizeSpokenText)
    .filter(Boolean);
  const safeParagraphs = paragraphs.length ? paragraphs : [sanitizeSpokenText(raw)];

  return {
    script: safeParagraphs.join("\n\n"),
    segments: safeParagraphs.map((text, index) => {
      const host = hosts[index % hosts.length];
      return {
        hostId: host.id,
        hostName: host.name,
        text,
        style: host.tone,
      };
    }),
    title: "",
  };
}

function directScriptPayload(content, hostsInput) {
  const script = String(content ?? "").trim();
  if (!script) {
    throw new Error("原文直出配音需要填写完整原文");
  }
  const hosts = normalizeHosts(hostsInput);
  const paragraphs = script
    .split(/\n{2,}/u)
    .map((text) => text.trim())
    .filter(Boolean);
  const safeParagraphs = paragraphs.length ? paragraphs : [script];
  return {
    script: safeParagraphs.join("\n\n"),
    segments: safeParagraphs.map((text, index) => {
      const host = hosts[index % hosts.length];
      return {
        hostId: host.id,
        hostName: host.name,
        text,
        style: host.tone,
      };
    }),
    title: "",
  };
}

async function generateScript(config, input) {
  const missing = validateServiceConfig(config);
  if (missing.length) {
    throw new Error(`大模型配置缺少：${missing.join("、")}`);
  }
  if (!config.enabled) {
    throw new Error("大模型 API 当前未启用");
  }

  const endpoint = buildEndpoint(config.baseUrl, "/chat/completions");
  const hosts = normalizeHosts(input.hosts);
  const airTime = programAirTimeContext(input.scheduledAt, input.publishDate);
  const hostBrief = hosts
    .map((host) => `${host.id} / ${host.name}：${host.voice || "AI主播"}；性格与表达：${host.tone || "自然、清晰"}`)
    .join("\n");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: jsonHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            `${config.systemPrompt}\n` +
            "你必须输出严格 JSON，不要输出 Markdown、代码块或后台说明。JSON 结构为：{\"title\":\"节目标题\",\"segments\":[{\"hostId\":\"主播id\",\"hostName\":\"主播名\",\"text\":\"可直接播出的台词\",\"style\":\"播读风格\"}]}。\n" +
            "每个 segments[].text 只能是主播要说的话，绝对不要包含“星遥：”“墨白：”“主持人：”等说话人前缀，也不要包含括号舞台说明。\n" +
            "如果有两个或多个主播，请让他们自然交叉对话，但每段文字仍然只放在对应 segment.text 内。\n" +
            airTime.instruction,
        },
        {
          role: "user",
          content:
            `节目主题：${input.prompt}\n` +
            `节目名称：${input.title}\n` +
            airTimeUserPrompt(airTime) +
            `参与主播：\n${hostBrief}\n` +
            "请生成 2 到 3 分钟的节目文案，开场自然，正文有画面感，结尾引导继续收听星声电台。主播需要知道自己的身份和风格，但不要在台词里自报名字。",
        },
      ],
      temperature: Number(config.temperature ?? 0.7),
      max_tokens: Number(config.maxTokens ?? 1200),
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`大模型请求失败：${await readError(response)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";
  const parsedScript = parseScriptPayload(content, hosts);

  if (!parsedScript.script) {
    throw new Error("大模型没有返回可播出的文案内容");
  }

  return {
    ...parsedScript,
    script: parsedScript.segments.map((segment) => alignTextToAirTime(segment.text, airTime)).join("\n\n"),
    segments: parsedScript.segments.map((segment) => ({
      ...segment,
      text: alignTextToAirTime(segment.text, airTime),
    })),
  };
}

async function synthesizeMimoSegment(config, segment) {
  const endpoint = buildEndpoint(config.baseUrl, "/chat/completions");
  const voice = mimoVoiceId(config, segment.hostId);
  const delivery = inferMimoDelivery(segment);
  const speed = normalizePlaybackSpeed(config.speed ?? 1);
  const response = await fetchOrThrow(
    endpoint,
    {
      method: "POST",
      headers: mimoHeaders(config),
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "user",
            content:
              `${segment.hostName || "AI主播"}的播读风格：${segment.style || "自然、清晰、适合电台播出"}。` +
              `全局语速倍率：${speed.toFixed(2)}。` +
              `语速控制：${delivery.speed}。` +
              "assistant 消息开头已经包含风格和语速控制音频标签，请按标签控制语气，使声音更自然、仿真。只朗读正文，不要额外添加主播名、标题、注释或开场白。",
          },
          {
            role: "assistant",
            content: buildMimoAssistantText(segment),
          },
        ],
        audio: {
          voice,
          format: "wav",
          speed,
        },
        stream: false,
      }),
    },
    `${segment.hostName || "AI主播"} MiMo TTS `,
  );

  if (!response.ok) {
    throw new Error(`${segment.hostName || "AI主播"} MiMo TTS 请求失败：${await readError(response)}`);
  }

  const data = await response.json();
  const audioBase64 =
    data.choices?.[0]?.message?.audio?.data ??
    data.message?.audio?.data ??
    data.audio?.data ??
    data.data?.audio?.data;

  if (!audioBase64) {
    throw new Error(`${segment.hostName || "AI主播"} MiMo TTS 没有返回 audio.data`);
  }

  return Buffer.from(audioBase64, "base64");
}

async function synthesizeWithMimo(config, script, programId, segments = []) {
  const extension = "wav";
  const safeSegments = Array.isArray(segments) && segments.length
    ? segments.map((segment) => ({ ...segment, text: sanitizeSpokenText(segment.text) })).filter((segment) => segment.text)
    : [{ hostId: "", hostName: "", text: sanitizeSpokenText(script), style: "温柔、清晰、适合深夜电台的中文主播语气" }];
  const buffers = [];
  const segmentAudios = [];

  for (const [index, segment] of safeSegments.entries()) {
    const buffer = await synthesizeMimoSegment(config, segment);
    const segmentFileName = `${programId}-segment-${index + 1}.${extension}`;
    const segmentAudioPath = path.join(audioDir, segmentFileName);
    fs.writeFileSync(segmentAudioPath, buffer);
    buffers.push(buffer);
    segmentAudios.push({
      ...segment,
      audioPath: segmentAudioPath,
      audioUrl: `/storage/audio/${segmentFileName}`,
      duration: spokenSegmentDuration(buffer, segment.text),
    });
  }

  const buffer = concatWav(buffers);
  const fileName = `${programId}.${extension}`;
  const audioPath = path.join(audioDir, fileName);
  fs.writeFileSync(audioPath, buffer);

  return {
    audioPath,
    audioUrl: `/storage/audio/${fileName}`,
    contentType: audioMimeFromExtension(extension),
    segments: segmentAudios,
  };
}

async function synthesizeWithSpeechEndpoint(config, script, programId, segments = []) {
  const missing = validateTtsConfig(config);
  if (missing.length) {
    throw new Error(`通用语音接口配置缺少：${missing.join("、")}`);
  }
  if (!config.enabled) {
    throw new Error("通用语音接口当前未启用");
  }

  const endpoint = speechEndpointForConfig(config);
  const response = await fetchOrThrow(
    endpoint,
    {
      method: "POST",
      headers: jsonHeaders(config),
      body: JSON.stringify({
        model: config.model,
        voice: config.voiceId || "alloy",
        input: script,
        response_format: config.format || "mp3",
        speed: Number(config.speed ?? 1),
        ...(
          String(config.stylePrompt ?? segments?.[0]?.style ?? "").trim() && /gpt.*tts|tts.*gpt/iu.test(String(config.model ?? ""))
            ? { instructions: String(config.stylePrompt ?? segments?.[0]?.style).trim() }
            : {}
        ),
      }),
    },
    "通用语音接口",
  );

  if (!response.ok) {
    throw new Error(`通用语音接口请求失败：${await readError(response)}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let buffer;
  let extension = normalizeAudioExtension(config.format);

  if (contentType.includes("application/json") || contentType.includes("text/")) {
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      const parsed = await audioFromGenericJson(data, endpoint, config.format || "mp3");
      buffer = parsed.buffer;
      extension = parsed.extension;
    } catch (error) {
      if (contentType.includes("application/json")) {
        throw error;
      }
      buffer = Buffer.from(stripDataUrlPrefix(text.trim()), "base64");
      extension = normalizeAudioExtension(config.format);
    }
  } else {
    buffer = Buffer.from(await response.arrayBuffer());
    if (contentType.includes("wav")) {
      extension = "wav";
    }
    if (contentType.includes("aac")) {
      extension = "aac";
    }
    if (contentType.includes("opus") || contentType.includes("ogg")) {
      extension = "opus";
    }
  }

  const fileName = `${programId}.${extension}`;
  const audioPath = path.join(audioDir, fileName);
  fs.writeFileSync(audioPath, buffer);

  return {
    audioPath,
    audioUrl: `/storage/audio/${fileName}`,
    contentType: audioMimeFromExtension(extension),
  };
}

async function synthesizeWithAzure(config, script, programId) {
  const missing = validateTtsConfig(config);
  if (missing.length) {
    throw new Error(`Azure Speech 配置缺少：${missing.join("、")}`);
  }
  if (!config.enabled) {
    throw new Error("通用语音接口当前未启用");
  }

  const endpoint = normalizeBaseUrl(config.baseUrl).endsWith("/cognitiveservices/v1")
    ? normalizeBaseUrl(config.baseUrl)
    : buildEndpoint(config.baseUrl, "/cognitiveservices/v1");
  const outputFormat = config.model || "audio-24khz-96kbitrate-mono-mp3";
  const voice = config.voiceId || "zh-CN-XiaoxiaoNeural";
  const speed = Number(config.speed ?? 1);
  const rate = `${Math.round((speed - 1) * 100)}%`;
  const ssml =
    `<speak version='1.0' xml:lang='zh-CN'>` +
    `<voice xml:lang='zh-CN' name='${escapeXml(voice)}'>` +
    `<prosody rate='${rate}'>${escapeXml(script)}</prosody>` +
    `</voice></speak>`;

  const response = await fetchOrThrow(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/ssml+xml",
        "Ocp-Apim-Subscription-Key": config.apiKey,
        "User-Agent": "AIradio",
        "X-Microsoft-OutputFormat": outputFormat,
      },
      body: ssml,
    },
    "Azure Speech ",
  );

  if (!response.ok) {
    throw new Error(`Azure Speech 请求失败：${await readError(response)}`);
  }

  const extension = outputFormat.includes("wav") ? "wav" : "mp3";
  return saveAudioBuffer(programId, extension, Buffer.from(await response.arrayBuffer()));
}

async function synthesizeWithGoogle(config, script, programId) {
  const missing = validateTtsConfig(config);
  if (missing.length) {
    throw new Error(`Google Cloud TTS 配置缺少：${missing.join("、")}`);
  }
  if (!config.enabled) {
    throw new Error("通用语音接口当前未启用");
  }

  const endpoint = normalizeBaseUrl(config.baseUrl).includes("text:synthesize")
    ? normalizeBaseUrl(config.baseUrl)
    : buildEndpoint(config.baseUrl || "https://texttospeech.googleapis.com/v1", "/text:synthesize");
  const url = config.apiKey && !endpoint.includes("key=") ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}key=${encodeURIComponent(config.apiKey)}` : endpoint;
  const audioEncoding = String(config.model || config.format || "MP3").toUpperCase().includes("WAV") ? "LINEAR16" : "MP3";
  const response = await fetchOrThrow(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioConfig: {
          audioEncoding,
          speakingRate: Number(config.speed ?? 1),
        },
        input: { text: script },
        voice: {
          languageCode: String(config.voiceId || "cmn-CN").slice(0, 6),
          name: config.voiceId || "cmn-CN-Wavenet-A",
        },
      }),
    },
    "Google Cloud TTS ",
  );

  if (!response.ok) {
    throw new Error(`Google Cloud TTS 请求失败：${await readError(response)}`);
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error("Google Cloud TTS 没有返回 audioContent");
  }
  return saveAudioBuffer(programId, audioEncoding === "LINEAR16" ? "wav" : "mp3", Buffer.from(data.audioContent, "base64"));
}

async function synthesizeWithElevenLabs(config, script, programId) {
  const missing = validateTtsConfig(config);
  if (missing.length) {
    throw new Error(`ElevenLabs 配置缺少：${missing.join("、")}`);
  }
  if (!config.enabled) {
    throw new Error("通用语音接口当前未启用");
  }

  const base = normalizeBaseUrl(config.baseUrl || "https://api.elevenlabs.io");
  const endpoint = base.includes("/v1/text-to-speech/")
    ? base
    : `${base}/v1/text-to-speech/${encodeURIComponent(config.voiceId || "21m00Tcm4TlvDq8ikWAM")}`;
  const response = await fetchOrThrow(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.apiKey,
      },
      body: JSON.stringify({
        model_id: config.model || "eleven_multilingual_v2",
        output_format: "mp3_44100_128",
        text: script,
        voice_settings: {
          similarity_boost: 0.72,
          stability: 0.48,
          style: Math.max(0, Math.min(1, (Number(config.speed ?? 1) - 0.5) / 1.5)),
          use_speaker_boost: true,
        },
      }),
    },
    "ElevenLabs ",
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs 请求失败：${await readError(response)}`);
  }

  return saveAudioBuffer(programId, "mp3", Buffer.from(await response.arrayBuffer()));
}

async function synthesizeSpeech(config, script, programId, segments) {
  const engine = ttsEngine(config);
  if (engine === "mimo") {
    return await synthesizeWithMimo(config, script, programId, segments);
  }
  if (engine === "azure") {
    return await synthesizeWithAzure(config, script, programId);
  }
  if (engine === "google") {
    return await synthesizeWithGoogle(config, script, programId);
  }
  if (engine === "elevenlabs") {
    return await synthesizeWithElevenLabs(config, script, programId);
  }

  return await synthesizeWithSpeechEndpoint(config, script, programId, segments);
}

function applyVoiceStylePrompt(segments, voicePrompt, fallback = "") {
  const prompt = String(voicePrompt ?? fallback ?? "").trim();
  if (!Array.isArray(segments)) {
    return [];
  }
  return segments.map((segment) => ({
    ...segment,
    style: prompt || String(segment?.style ?? "").trim(),
  }));
}

function synthesizedSegments(originalSegments, audio) {
  return Array.isArray(audio?.segments) && audio.segments.length ? audio.segments : originalSegments;
}

function parseJsonArray(value) {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToProgram(row) {
  if (!row) {
    return null;
  }

  const segments = parseJsonArray(row.segments_json);
  const playlist = parseJsonArray(row.playlist_json);

  return {
    id: row.id,
    title: row.title,
    host: row.host,
    prompt: row.prompt,
    script: row.script,
    segments,
    playlist,
    categoryId: row.category_id,
    categoryName: row.category_name ?? null,
    playbackSpeed: Number(row.playback_speed ?? 1),
    publishDate: row.publish_date,
    publishedAt: row.published_at,
    scheduledAt: row.scheduled_at,
    sortOrder: row.sort_order,
    sourceType: row.source_type ?? "generated",
    pluginId: row.plugin_id,
    programPresetId: row.program_preset_id ?? null,
    musicPlaylistId: row.music_playlist_id ?? null,
    playbackMode: row.playback_mode === "shuffle" || row.playback_mode === "sequential"
      ? row.playback_mode
      : null,
    playbackResetAt: row.playback_reset_at ?? null,
    restartFromBeginning: row.restart_from_beginning === 1,
    fillerTimeline: parseJsonArray(row.filler_timeline_json),
    status: row.status,
    audioUrl: row.audio_url,
    audioPath: row.audio_path,
    llmModel: row.llm_model,
    ttsModel: row.tts_model,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function insertProgram(program) {
  db.prepare(`
    INSERT INTO programs (
      id, title, host, prompt, script, status, audio_url, audio_path,
      segments_json, playlist_json, sort_order, scheduled_at, source_type, plugin_id,
      category_id, playback_speed, publish_date, published_at, music_playlist_id, playback_mode, program_preset_id,
      playback_reset_at, restart_from_beginning, filler_timeline_json,
      llm_model, tts_model, error_message, created_at, updated_at
    )
    VALUES (
      @id, @title, @host, @prompt, @script, @status, @audioUrl, @audioPath,
      @segmentsJson, @playlistJson, @sortOrder, @scheduledAt, @sourceType, @pluginId,
      @categoryId, @playbackSpeed, @publishDate, @publishedAt, @musicPlaylistId, @playbackMode, @programPresetId,
      @playbackResetAt, @restartFromBeginning, @fillerTimelineJson,
      @llmModel, @ttsModel, @errorMessage, @createdAt, @updatedAt
    )
  `).run({
    ...program,
    categoryId: program.categoryId ?? defaultCategoryIdForProgram(program),
    playlistJson: program.playlistJson ?? JSON.stringify(program.playlist ?? []),
    playbackSpeed: normalizePlaybackSpeed(program.playbackSpeed),
    publishDate: program.publishDate ?? null,
    publishedAt: program.publishedAt ?? null,
    musicPlaylistId: String(program.musicPlaylistId ?? "").trim() || null,
    playbackMode: program.playbackMode ? normalizeMusicPlaybackMode(program.playbackMode) : null,
    playbackResetAt: program.playbackResetAt ?? null,
    restartFromBeginning: program.restartFromBeginning ? 1 : 0,
    fillerTimelineJson: program.fillerTimelineJson ?? JSON.stringify(program.fillerTimeline ?? []),
    programPresetId: String(program.programPresetId ?? "").trim() || null,
  });
}

function updateProgram(id, patch) {
  const current = readProgramById(id);
  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...patch,
    segmentsJson: patch.segmentsJson ?? JSON.stringify(patch.segments ?? current.segments ?? []),
    playlistJson: patch.playlistJson ?? JSON.stringify(patch.playlist ?? current.playlist ?? []),
    fillerTimelineJson: patch.fillerTimelineJson ?? JSON.stringify(patch.fillerTimeline ?? current.fillerTimeline ?? []),
    playbackSpeed: normalizePlaybackSpeed(patch.playbackSpeed ?? current.playbackSpeed),
    restartFromBeginning: (patch.restartFromBeginning ?? current.restartFromBeginning) ? 1 : 0,
    updatedAt: nowIso(),
  };

  db.prepare(`
    UPDATE programs
    SET title = @title,
        host = @host,
        prompt = @prompt,
        script = @script,
        status = @status,
        audio_url = @audioUrl,
        audio_path = @audioPath,
        segments_json = @segmentsJson,
        playlist_json = @playlistJson,
        source_type = @sourceType,
        plugin_id = @pluginId,
        category_id = @categoryId,
        playback_speed = @playbackSpeed,
        publish_date = @publishDate,
        published_at = @publishedAt,
        music_playlist_id = @musicPlaylistId,
        playback_mode = @playbackMode,
        program_preset_id = @programPresetId,
        playback_reset_at = @playbackResetAt,
        restart_from_beginning = @restartFromBeginning,
        filler_timeline_json = @fillerTimelineJson,
        scheduled_at = @scheduledAt,
        sort_order = @sortOrder,
        llm_model = @llmModel,
        tts_model = @ttsModel,
        error_message = @errorMessage,
        updated_at = @updatedAt
    WHERE id = @id
  `).run(next);

  return readProgramById(id);
}

function normalizePlaybackSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) {
    return 1;
  }
  return Math.min(2, Math.max(0.5, speed));
}

function readCategories() {
  return db
    .prepare("SELECT id, name, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt FROM program_categories ORDER BY COALESCE(sort_order, 999999), created_at")
    .all();
}

function rowToSoundEffect(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name ?? null,
    name: row.name,
    fileName: row.file_name,
    audioUrl: row.audio_url,
    audioPath: row.audio_path,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readSoundEffectCategories() {
  const categories = db
    .prepare(`
      SELECT id, name, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt
      FROM sound_effect_categories
      ORDER BY COALESCE(sort_order, 999999), created_at
    `)
    .all()
    .map((category) => ({ ...category, effects: [] }));

  const effects = db
    .prepare(`
      SELECT e.*, c.name AS category_name
      FROM sound_effects e
      LEFT JOIN sound_effect_categories c ON c.id = e.category_id
      ORDER BY c.sort_order, e.created_at DESC
    `)
    .all()
    .map(rowToSoundEffect);

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  for (const effect of effects) {
    const category = categoryById.get(effect.categoryId);
    if (category) {
      category.effects.push(effect);
    }
  }

  return categories;
}

function readSoundEffectsByIds(ids = []) {
  const safeIds = [...new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (!safeIds.length) {
    return [];
  }
  const placeholders = safeIds.map(() => "?").join(", ");
  const rows = db
    .prepare(`
      SELECT e.*, c.name AS category_name
      FROM sound_effects e
      LEFT JOIN sound_effect_categories c ON c.id = e.category_id
      WHERE e.id IN (${placeholders})
    `)
    .all(...safeIds)
    .map(rowToSoundEffect);
  const byId = new Map(rows.map((effect) => [effect.id, effect]));
  return safeIds.map((id) => byId.get(id)).filter(Boolean);
}

function buildBackgroundPlaylist(audioMix) {
  const mix = normalizeAudioMix(audioMix);
  if (!mix.enabled || !mix.effectIds.length) {
    return [];
  }

  const effects = readSoundEffectsByIds(mix.effectIds);
  if (!effects.length) {
    return [];
  }

  return [
    {
      effectIds: effects.map((effect) => effect.id),
      items: effects.map((effect) => ({
        audioUrl: effect.audioUrl,
        categoryName: effect.categoryName,
        id: effect.id,
        name: effect.name,
      })),
      leadSeconds: mix.leadSeconds,
      loopMode: mix.loopMode,
      role: "background",
      startMode: mix.startMode,
      title: "背景音效",
      type: "background",
      volume: mix.volume,
    },
  ];
}

function isAudioMixConfigured(audioMix) {
  const mix = normalizeAudioMix(audioMix);
  return mix.enabled && mix.effectIds.length > 0;
}

function configuredAudioMixForProgram(program, config = readConfig()) {
  if (program?.pluginId === "daily-briefing") {
    return config.plugins.dailyBriefing.audioMix;
  }
  if (program?.pluginId === "hot-topics") {
    return isAudioMixConfigured(config.plugins.hotTopics.audioMix)
      ? config.plugins.hotTopics.audioMix
      : config.plugins.dailyBriefing.audioMix;
  }
  if (
    !program?.pluginId &&
    ["generated", "flow-preset"].includes(String(program?.sourceType ?? "generated"))
  ) {
    return config.plugins.customProgram?.audioMix ?? null;
  }
  return null;
}

function buildConfiguredBackgroundPlaylist(programOrPluginId, config = readConfig()) {
  const program = typeof programOrPluginId === "string" ? { pluginId: programOrPluginId } : programOrPluginId;
  const audioMix = configuredAudioMixForProgram(program, config);
  return audioMix ? buildBackgroundPlaylist(audioMix) : [];
}

function programHasBackgroundPlaylist(program) {
  return Array.isArray(program?.playlist) && program.playlist.some((item) => item?.type === "background" || item?.role === "background");
}

function applyConfiguredBackgroundPlaylist(program) {
  if (!program || programHasBackgroundPlaylist(program)) {
    return program;
  }

  const backgroundPlaylist = buildConfiguredBackgroundPlaylist(program);
  if (!backgroundPlaylist.length) {
    return program;
  }

  return {
    ...program,
    playlist: [...(program.playlist ?? []), ...backgroundPlaylist],
  };
}

function safeFileStem(value) {
  return String(value ?? "")
    .trim()
    .replace(/\.[a-z0-9]+$/iu, "")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "sound-effect";
}

function audioExtensionFromMime(mimeType, fallbackName = "") {
  const name = String(fallbackName).toLowerCase();
  if (mimeType === "audio/wav" || name.endsWith(".wav")) {
    return "wav";
  }
  if (mimeType === "audio/ogg" || name.endsWith(".ogg")) {
    return "ogg";
  }
  if (mimeType === "audio/aac" || name.endsWith(".aac")) {
    return "aac";
  }
  if (mimeType === "audio/flac" || name.endsWith(".flac")) {
    return "flac";
  }
  if (mimeType === "audio/mp4" || name.endsWith(".m4a")) {
    return "m4a";
  }
  return "mp3";
}

function parseAudioDataUrl(value) {
  const raw = String(value ?? "");
  const match = raw.match(/^data:(audio\/[a-z0-9.+-]+);base64,(.+)$/iu);
  if (!match) {
    return {
      buffer: Buffer.from(stripDataUrlPrefix(raw), "base64"),
      mimeType: "",
    };
  }
  return {
    buffer: Buffer.from(match[2], "base64"),
    mimeType: match[1].toLowerCase(),
  };
}

function removeStoredFile(filePath, rootDir) {
  const resolved = path.resolve(filePath ?? "");
  const root = path.resolve(rootDir);
  if (!resolved.startsWith(root + path.sep)) {
    return;
  }
  fs.rmSync(resolved, { force: true });
}

function defaultCategoryIdForName(name) {
  const row = db.prepare("SELECT id FROM program_categories WHERE name = ?").get(name);
  return row?.id ?? db.prepare("SELECT id FROM program_categories ORDER BY COALESCE(sort_order, 999999), created_at LIMIT 1").get()?.id ?? null;
}

function defaultCategoryIdForProgram(program) {
  if (program.categoryId) {
    return program.categoryId;
  }
  if (program.pluginId === "daily-briefing") {
    return defaultCategoryIdForName("每日早报");
  }
  if (program.pluginId === "hot-topics") {
    return defaultCategoryIdForName("今日热榜");
  }
  if (program.pluginId === "kugou-music") {
    return defaultCategoryIdForName("音乐专题");
  }
  return defaultCategoryIdForName("常规节目");
}

function readProgramById(id) {
  const program = rowToProgram(
    db
      .prepare(`
        SELECT p.*, c.name AS category_name
        FROM programs p
        LEFT JOIN program_categories c ON c.id = p.category_id
        WHERE p.id = ?
      `)
      .get(id),
  );
  return applyConfiguredBackgroundPlaylist(program);
}

function readProgramList() {
  return db
    .prepare(`
      SELECT p.*, c.name AS category_name
      FROM programs p
      LEFT JOIN program_categories c ON c.id = p.category_id
      ORDER BY
        CASE WHEN p.publish_date IS NULL OR p.publish_date = '' THEN 1 ELSE 0 END ASC,
        p.publish_date DESC,
        CASE WHEN p.scheduled_at IS NULL OR p.scheduled_at = '' THEN 1 ELSE 0 END ASC,
        p.scheduled_at ASC,
        COALESCE(p.sort_order, 999999) ASC,
        p.created_at DESC
      LIMIT 50
    `)
    .all()
    .map(rowToProgram)
    .map(applyConfiguredBackgroundPlaylist);
}

function readAllProgramsForArchive() {
  return db
    .prepare(`
      SELECT p.*, c.name AS category_name
      FROM programs p
      LEFT JOIN program_categories c ON c.id = p.category_id
      ORDER BY
        COALESCE(p.publish_date, '') DESC,
        COALESCE(p.sort_order, 999999) ASC,
        p.created_at ASC
    `)
    .all()
    .map(rowToProgram)
    .map(applyConfiguredBackgroundPlaylist);
}

function archiveDateForProgram(program) {
  const publishDate = String(program?.publishDate ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(publishDate)) {
    return publishDate;
  }

  const rawDate = program?.publishedAt || program?.scheduledAt || program?.createdAt;
  const date = rawDate ? new Date(rawDate) : new Date();
  return Number.isNaN(date.getTime()) ? localDateString() : localDateString(date);
}

function archiveProgram(program, archiveDate = archiveDateForProgram(program)) {
  const hasMusic = Array.isArray(program?.playlist)
    && program.playlist.some((item) => item?.type === "song" && item?.audioUrl);
  if (!program?.id || (!String(program.script ?? "").trim() && !hasMusic)) {
    return null;
  }

  const archivedAt = nowIso();
  const archive = {
    id: `archive-${program.id}`,
    archiveDate,
    programId: program.id,
    title: program.title,
    host: program.host,
    categoryName: program.categoryName ?? null,
    script: program.script,
    segmentsJson: JSON.stringify(program.segments ?? []),
    playlistJson: JSON.stringify(program.playlist ?? []),
    audioUrl: program.audioUrl ?? null,
    sourceType: program.sourceType ?? null,
    createdAt: program.createdAt ?? archivedAt,
    archivedAt,
  };

  db.prepare(`
    INSERT INTO program_archives (
      id, archive_date, program_id, title, host, category_name, script,
      segments_json, playlist_json, audio_url, source_type, created_at, archived_at
    )
    VALUES (
      @id, @archiveDate, @programId, @title, @host, @categoryName, @script,
      @segmentsJson, @playlistJson, @audioUrl, @sourceType, @createdAt, @archivedAt
    )
    ON CONFLICT(program_id) DO UPDATE SET
      archive_date = excluded.archive_date,
      title = excluded.title,
      host = excluded.host,
      category_name = excluded.category_name,
      script = excluded.script,
      segments_json = excluded.segments_json,
      playlist_json = excluded.playlist_json,
      audio_url = excluded.audio_url,
      source_type = excluded.source_type,
      archived_at = excluded.archived_at
  `).run(archive);

  return archive;
}

function syncProgramArchives() {
  const programs = readAllProgramsForArchive();
  programs.forEach((program) => archiveProgram(program));
  return readProgramArchives();
}

function rowToArchiveProgram(row) {
  const segments = parseJsonArray(row.segments_json);
  const playlist = parseJsonArray(row.playlist_json);

  return {
    id: row.id,
    archiveDate: row.archive_date,
    archivedAt: row.archived_at,
    programId: row.program_id,
    title: row.title,
    host: row.host,
    categoryName: row.category_name,
    script: row.script,
    segments,
    playlist,
    audioUrl: row.audio_url,
  };
}

function readProgramArchives() {
  const rows = db
    .prepare(`
      SELECT *
      FROM program_archives
      ORDER BY archive_date DESC, created_at ASC
    `)
    .all();
  const groups = [];

  for (const row of rows) {
    const date = row.archive_date;
    let group = groups.find((item) => item.date === date);
    if (!group) {
      group = { date, programs: [] };
      groups.push(group);
    }
    group.programs.push(rowToArchiveProgram(row));
  }

  return groups;
}

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

function localDateString(date = new Date()) {
  const parts = shanghaiParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localHourMinute(date = new Date()) {
  const parts = shanghaiParts(date);
  return `${parts.hours}:${parts.minutes}`;
}

function localMinuteKey(date = new Date()) {
  return `${localDateString(date)} ${localHourMinute(date)}`;
}

function normalizePublishDate(value, fallback = null) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    return text;
  }
  return fallback;
}

function splitScriptToSegments(script, program) {
  const hostNames = String(program.host ?? "")
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);
  const candidateHosts = hostNames
    .map((name) => hostProfiles.find((host) => host.name === name))
    .filter(Boolean);
  const hosts = candidateHosts.length ? candidateHosts : [hostProfiles[0]];
  const paragraphs = String(script ?? "")
    .split(/\n{2,}/)
    .map(sanitizeSpokenText)
    .filter(Boolean);

  return paragraphs.map((text, index) => {
    const host = hosts[index % hosts.length];
    return {
      hostId: host.id,
      hostName: host.name,
      text,
      style: program.sourceType === "plugin" ? "每日早报，清晰自然，有真人新闻播报感" : host.tone,
    };
  });
}

function updateProgramContent(id, script, segments) {
  const current = readProgramById(id);
  if (!current) {
    return null;
  }
  deleteAudioFile(current);
  const safeScript = String(script ?? "").trim();
  const nextSegments = Array.isArray(segments) && segments.length
    ? segments
        .map((segment, index) => {
          const host = hostProfiles.find((item) => item.id === segment.hostId || item.name === segment.hostName) ?? hostProfiles[index % hostProfiles.length];
          const text = sanitizeSpokenText(segment.text);
          return text
            ? {
                hostId: host.id,
                hostName: host.name,
                text,
                style: String(segment.style ?? host.tone ?? "").trim(),
              }
            : null;
        })
        .filter(Boolean)
    : splitScriptToSegments(safeScript, current);
  const nextScript = nextSegments.length ? nextSegments.map((segment) => segment.text).join("\n\n") : safeScript;
  const nextHost = Array.from(new Set(nextSegments.map((segment) => segment.hostName).filter(Boolean))).join(" / ") || current.host;

  db.prepare(`
    UPDATE programs
    SET host = @host,
        script = @script,
        segments_json = @segmentsJson,
        status = @status,
        audio_url = NULL,
        audio_path = NULL,
        error_message = NULL,
        updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    host: nextHost,
    script: nextScript,
    segmentsJson: JSON.stringify(nextSegments),
    status: "script_saved",
    updatedAt: nowIso(),
  });

  return readProgramById(id);
}

async function regenerateProgramAudio(programId, options = {}) {
  const config = readConfig();
  const existing = readProgramById(programId);
  if (!existing) {
    return null;
  }
  const voicePrompt = String(options.voicePrompt ?? "").trim();
  const segments = applyVoiceStylePrompt(existing.segments, voicePrompt, config.tts.defaultStylePrompt);
  deleteAudioFile(existing);
  try {
    const audio = await synthesizeSpeech(
      {
        ...config.tts,
        speed: normalizePlaybackSpeed(existing.playbackSpeed ?? config.tts.speed),
        stylePrompt: voicePrompt || config.tts.defaultStylePrompt,
      },
      existing.script,
      existing.id,
      segments,
    );
    const nextSegments = synthesizedSegments(segments, audio);
    const program = updateProgram(existing.id, {
      status: "ready",
      audioUrl: `${audio.audioUrl}?v=${Date.now()}`,
      audioPath: audio.audioPath,
      segmentsJson: JSON.stringify(nextSegments),
      errorMessage: null,
    });
    archiveProgram(program);
    return program;
  } catch (error) {
    const program = updateProgram(existing.id, {
      status: "script_saved",
      audioUrl: null,
      audioPath: null,
      segmentsJson: JSON.stringify(segments),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    archiveProgram(program);
    if (error && typeof error === "object") {
      error.program = program;
    }
    throw error;
  }
}

function deleteAudioFile(program) {
  const audioPath = program?.audioPath || program?.audio_path;
  const audioPaths = new Set(
    [
      audioPath,
      ...(program?.playlist ?? []).map((item) => item?.audioPath),
      ...(program?.segments ?? []).map((item) => item?.audioPath),
    ].filter((item) => typeof item === "string" && item.trim()),
  );
  if (!audioPaths.size) {
    return;
  }

  for (const itemPath of audioPaths) {
    const resolved = path.resolve(itemPath);
    if (resolved.startsWith(path.resolve(audioDir)) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
  }
}

function programBelongsToDate(program, date) {
  if (program.publishDate === date) {
    return true;
  }
  if (!program.publishDate && program.scheduledAt) {
    return localDateString(new Date(program.scheduledAt)) === date;
  }
  return !program.publishDate && !program.scheduledAt && localDateString(new Date(program.createdAt)) === date;
}

function nextProgramSortOrder() {
  const row = db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM programs").get();
  return row?.nextOrder ?? 1;
}

function buildAlapiUrl(pluginConfig) {
  const url = new URL(pluginConfig.apiBaseUrl || defaultConfig.plugins.dailyBriefing.apiBaseUrl);
  url.searchParams.set("token", pluginConfig.token);
  url.searchParams.set("format", "json");
  return url;
}

function normalizeHotTopicEndpoint(pluginConfig) {
  const base = String(pluginConfig.apiBaseUrl || defaultConfig.plugins.hotTopics.apiBaseUrl).trim();
  if (!base) {
    return defaultConfig.plugins.hotTopics.apiBaseUrl;
  }
  if (/\/api\/tophub\/?$/u.test(base)) {
    return base.replace(/\/+$/u, "");
  }
  return `${base.replace(/\/+$/u, "")}/api/tophub`;
}

function alapiV3Headers(pluginConfig) {
  return {
    "Content-Type": "application/json",
    token: pluginConfig.token,
  };
}

function parseDailyBriefingPayload(payload, maxItems) {
  const data = payload?.data ?? payload?.result ?? payload ?? {};
  const candidates = data.news ?? data.list ?? data.items ?? data.content ?? [];
  const news = Array.isArray(candidates)
    ? candidates
        .map((item) => (typeof item === "string" ? item : item?.title ?? item?.content ?? item?.text ?? ""))
        .map((item) => String(item).trim())
        .map(sanitizeSpokenText)
        .filter(Boolean)
        .slice(0, maxItems)
    : String(candidates)
        .split(/\n+/)
        .map(sanitizeSpokenText)
        .filter(Boolean)
        .slice(0, maxItems);
  const date = data.date ?? data.day ?? new Date().toLocaleDateString("zh-CN");
  const zhishiyu = data.zhishiyu ?? data.weiyu ?? data.tip ?? "";

  if (!news.length) {
    throw new Error("每日早报接口没有返回可播报的新闻列表");
  }

  return {
    date,
    news,
    zhishiyu: String(zhishiyu).trim(),
  };
}

function buildFallbackDailyBriefingSegments(briefing, host, airTime = programAirTimeContext(null)) {
  const grouped = briefing.news
    .map((item) => sanitizeSpokenText(item))
    .filter(Boolean)
    .join("。另外，");
  const outro = briefing.zhishiyu ? `收尾前，也把这句话送给你：${briefing.zhishiyu}` : "以上就是今天值得关注的消息。";

  return [
    {
      hostId: host.id,
      hostName: host.name,
      text: `${airTime.hasTime ? `${airTime.greeting}，` : ""}欢迎收听星声电台每日早报。今天是${briefing.date}，先带你快速了解今天值得关注的消息。`,
      style: "每日早报开场，清晰亲切，1倍正常语速，停顿自然",
    },
    {
      hostId: host.id,
      hostName: host.name,
      text: grouped,
      style: "每日早报正文，清晰平稳，1倍正常语速，停顿自然",
    },
    {
      hostId: host.id,
      hostName: host.name,
      text: outro,
      style: "每日早报结尾，温和自然，1倍正常语速",
    },
  ];
}

function parseHotTopicsPayload(payload, maxItems) {
  const data = payload?.data ?? payload?.result ?? payload ?? {};
  const list = Array.isArray(data.list)
    ? data.list
    : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.news)
        ? data.news
        : [];
  const topics = list
    .map((item) => {
      if (typeof item === "string") {
        return { title: item.trim(), heat: "", link: "" };
      }
      return {
        title: String(item?.title ?? item?.name ?? item?.content ?? item?.text ?? "").trim(),
        heat: String(item?.other ?? item?.hot ?? item?.heat ?? item?.desc ?? item?.summary ?? "").trim(),
        link: String(item?.link ?? item?.url ?? "").trim(),
      };
    })
    .filter((item) => item.title)
    .slice(0, maxItems);

  if (!topics.length) {
    throw new Error("今日热榜接口没有返回可播报的榜单内容");
  }

  return {
    date: data.date ?? data.day ?? new Date().toLocaleDateString("zh-CN"),
    lastUpdate: data.last_update ?? data.last_time ?? data.update_time ?? "",
    name: String(data.name ?? data.title ?? "今日热榜").trim(),
    topics,
  };
}

function buildFallbackHotTopicSegments(hotTopics, host, airTime = programAirTimeContext(null)) {
  const highlights = hotTopics.topics
    .map((item) => `${sanitizeSpokenText(item.title)}${item.heat ? `，热度信息是${sanitizeSpokenText(item.heat)}` : ""}`)
    .filter(Boolean)
    .join("。与此同时，");

  return [
    {
      hostId: host.id,
      hostName: host.name,
      text: `${airTime.hasTime ? `${airTime.greeting}，` : ""}欢迎收听星声电台今日热榜。${hotTopics.lastUpdate ? `这份榜单更新于${hotTopics.lastUpdate}。` : ""}接下来带你快速了解${hotTopics.name}里正在升温的话题。`,
      style: "今日热榜开场，清晰自然，1倍正常语速，停顿自然",
    },
    {
      hostId: host.id,
      hostName: host.name,
      text: highlights,
      style: "今日热榜正文，清晰平稳，1倍正常语速，像真人资讯主播一样自然串联",
    },
    {
      hostId: host.id,
      hostName: host.name,
      text: "以上就是当前值得关注的热榜动态。更多话题，我们稍后继续更新。",
      style: "今日热榜结尾，清爽自然，1倍正常语速",
    },
  ];
}

async function editHotTopicsWithLlm(config, hotTopics, host, options = {}) {
  const airTime = programAirTimeContext(options.scheduledAt, options.publishDate);
  const missing = validateServiceConfig(config);
  if (missing.length || !config.enabled) {
    return buildFallbackHotTopicSegments(hotTopics, host, airTime).map((segment) => ({
      ...segment,
      text: alignTextToAirTime(segment.text, airTime),
    }));
  }

  const endpoint = buildEndpoint(config.baseUrl, "/chat/completions");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: jsonHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "你是星声电台的热榜资讯编辑和播音导播。你要把原始热榜改写成自然、连贯、像真人主播说出来的中文热榜节目稿。" +
            "必须输出严格 JSON：{\"title\":\"节目标题\",\"segments\":[{\"hostId\":\"主播id\",\"hostName\":\"主播名\",\"text\":\"播报正文\",\"style\":\"播读风格\"}]}。" +
            "不要输出 Markdown。segments[].text 不要读榜单序号，不要说“第一名、第二名、第一条、首先、其次、最后一条”等机械话术，也不要出现主播名冒号前缀。style 必须要求清晰、平稳、1倍正常语速，不要写节奏轻快、加速、提气。" +
            airTime.instruction,
        },
        {
          role: "user",
          content:
            `热榜名称：${hotTopics.name}\n` +
            `更新信息：${hotTopics.lastUpdate || hotTopics.date}\n` +
            airTimeUserPrompt(airTime) +
            `播报主播：${host.id} / ${host.name} / ${host.tone}\n` +
            `原始热榜：\n${hotTopics.topics.map((item) => `- ${item.title}${item.heat ? `｜${item.heat}` : ""}`).join("\n")}\n` +
            "请重编成 4 到 7 个自然段：开场要有电台热榜感，正文按话题相关性分组串联，不读任何序号，结尾自然收束并提示稍后更新。播报节奏必须稳定，按 1 倍正常语速。",
        },
      ],
      temperature: Math.max(0.25, Number(config.temperature ?? 0.7)),
      max_tokens: Math.max(900, Number(config.maxTokens ?? 1200)),
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`热榜大模型编辑失败：${await readError(response)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";
  const parsed = parseScriptPayload(content, [host]);
  const segments = parsed.segments.length ? parsed.segments : buildFallbackHotTopicSegments(hotTopics, host, airTime);

  return segments.map((segment) => ({
    ...segment,
    text: alignTextToAirTime(segment.text, airTime),
    style: segment.style || "今日热榜，清晰、平稳、1倍正常语速、有真人资讯播报感",
  })).filter((segment) => segment.text);
}

async function editDailyBriefingWithLlm(config, briefing, host, options = {}) {
  const airTime = programAirTimeContext(options.scheduledAt, options.publishDate);
  const missing = validateServiceConfig(config);
  if (missing.length || !config.enabled) {
    return buildFallbackDailyBriefingSegments(briefing, host, airTime).map((segment) => ({
      ...segment,
      text: alignTextToAirTime(segment.text, airTime),
    }));
  }

  const endpoint = buildEndpoint(config.baseUrl, "/chat/completions");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: jsonHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "你是星声电台的早报新闻编辑和播音导播。你要把原始新闻列表改写成自然、连贯、像真人主播播报的中文早报稿。" +
            "必须输出严格 JSON：{\"title\":\"节目标题\",\"segments\":[{\"hostId\":\"主播id\",\"hostName\":\"主播名\",\"text\":\"播报正文\",\"style\":\"播读风格\"}]}。" +
            "不要输出 Markdown。segments[].text 不要包含序号，不要说“第一条、第二条、首先、其次、最后一条”等机械话术，也不要出现主播名冒号前缀。style 必须要求清晰、平稳、1倍正常语速，不要写加速、提气。" +
            airTime.instruction,
        },
        {
          role: "user",
          content:
            `日期：${briefing.date}\n` +
            airTimeUserPrompt(airTime) +
            `播报主播：${host.id} / ${host.name} / ${host.tone}\n` +
            `原始新闻：\n${briefing.news.map((item) => `- ${item}`).join("\n")}\n` +
            (briefing.zhishiyu ? `结尾一句话素材：${briefing.zhishiyu}\n` : "") +
            "请把这些消息按新闻播报节奏重新编排成 4 到 8 个自然段：开场要像真人早间电台，正文要有转场，不读序号，结尾自然收束。播报节奏必须稳定，按 1 倍正常语速。",
        },
      ],
      temperature: Math.max(0.2, Number(config.temperature ?? 0.7)),
      max_tokens: Math.max(900, Number(config.maxTokens ?? 1200)),
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`早报大模型编辑失败：${await readError(response)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";
  const parsed = parseScriptPayload(content, [host]);
  const segments = parsed.segments.length ? parsed.segments : buildFallbackDailyBriefingSegments(briefing, host, airTime);

  return segments.map((segment) => ({
    ...segment,
    text: alignTextToAirTime(segment.text, airTime),
    style: segment.style || "每日早报，清晰、平稳、1倍正常语速、可靠、有真人播报感",
  })).filter((segment) => segment.text);
}

async function rewriteProgramScriptWithLlm(config, program) {
  const missing = validateServiceConfig(config);
  if (missing.length) {
    throw new Error(`大模型配置缺少：${missing.join("、")}`);
  }
  if (!config.enabled) {
    throw new Error("大模型 API 当前未启用");
  }

  const endpoint = buildEndpoint(config.baseUrl, "/chat/completions");
  const hosts = normalizeHosts(
    String(program.host ?? "")
      .split("/")
      .map((name) => ({ name: name.trim() }))
      .filter((host) => host.name),
  );
  const hostBrief = hosts
    .map((host) => `${host.id} / ${host.name}：${host.voice || "AI主播"}；性格与表达：${host.tone || "自然、清晰"}`)
    .join("\n");
  const airTime = programAirTimeContext(program.scheduledAt, program.publishDate);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: jsonHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "你是星声电台的新闻编辑和播音导播。你要把已有节目稿重新整理成自然、连贯、像真人播报的中文稿件。" +
            "必须输出严格 JSON：{\"title\":\"节目标题\",\"segments\":[{\"hostId\":\"主播id\",\"hostName\":\"主播名\",\"text\":\"播报正文\",\"style\":\"播读风格\"}]}。" +
            "不要输出 Markdown。segments[].text 不要包含序号，不要说“第一条、第二条、首先、其次、最后一条”等机械话术，也不要出现主播名冒号前缀。" +
            airTime.instruction,
        },
        {
          role: "user",
          content:
            `原节目标题：${program.title}\n` +
            airTimeUserPrompt(airTime) +
            `参与主播：\n${hostBrief}\n` +
            `原始稿件：\n${program.script}\n\n` +
            "请保留事实信息，去掉机械序号，把内容改写为 4 到 8 个自然段。开场像真人电台，正文有新闻转场，结尾自然收束。",
        },
      ],
      temperature: Math.max(0.2, Number(config.temperature ?? 0.7)),
      max_tokens: Math.max(900, Number(config.maxTokens ?? 1200)),
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`节目文稿重编失败：${await readError(response)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";
  const parsed = parseScriptPayload(content, hosts);
  if (!parsed.segments.length) {
    throw new Error("大模型没有返回可保存的节目文稿");
  }

  const nextSegments = parsed.segments.map((segment) => ({
      ...segment,
      text: alignTextToAirTime(segment.text, airTime),
      style: segment.style || "新闻播报，清晰、自然、有真人播报感",
    })).filter((segment) => segment.text);

  return {
    script: nextSegments.map((segment) => segment.text).join("\n\n"),
    segments: nextSegments,
  };
}

function loadKugouApi() {
  const apiPath = path.join(projectRoot, "KuGouMusicApi", "main.js");
  if (!fs.existsSync(apiPath)) {
    throw new Error("未找到 KuGouMusicApi/main.js");
  }
  return requireCjs(apiPath);
}

function loadNeteaseApi() {
  const apiPath = path.join(projectRoot, "NeteaseCloudMusicApi", "main.js");
  if (!fs.existsSync(apiPath)) {
    throw new Error("未找到 NeteaseCloudMusicApi/main.js");
  }
  return requireCjs(apiPath);
}

function loadQQMusicApi() {
  const apiPath = path.join(projectRoot, "QQMusicApi", "node", "index.js");
  if (!fs.existsSync(apiPath)) {
    throw new Error("未找到 QQMusicApi/node/index.js");
  }
  return requireCjs(apiPath);
}

const MUSIC_PROVIDER_LABELS = {
  kugou: "酷狗音乐",
  netease: "网易云音乐",
  qq: "QQ 音乐",
};

const qqQrSessions = new Map();

function hash33(value, seed = 0) {
  let hash = seed;
  for (const character of String(value ?? "")) {
    hash += (hash << 5) + character.charCodeAt(0);
    hash &= 0x7fffffff;
  }
  return hash & 0x7fffffff;
}

function responseSetCookies(response) {
  if (typeof response?.headers?.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const value = response?.headers?.get?.("set-cookie");
  return value ? [value] : [];
}

function cookieHeaderFromResponse(response, seed = "") {
  return cookieToHeader(mergeCookieValues(seed, responseSetCookies(response)));
}

async function createQQLoginQr(loginType = "wx") {
  if (loginType === "wx") {
    const authorizeResponse = await fetch("https://open.weixin.qq.com/connect/qrconnect?" + new URLSearchParams({
      appid: "wx48db31d50e334801",
      redirect_uri: "https://y.qq.com/portal/wx_redirect.html?login_type=2&surl=https://y.qq.com/",
      response_type: "code",
      scope: "snsapi_login",
      state: "STATE",
      href: "https://y.qq.com/mediastyle/music_v17/src/css/popup_wechat.css#wechat_redirect",
    }));
    if (!authorizeResponse.ok) {
      throw new Error(`QQ 音乐微信二维码请求失败：HTTP ${authorizeResponse.status}`);
    }
    const uuid = String(await authorizeResponse.text()).match(/uuid=(.+?)"/u)?.[1];
    if (!uuid) {
      throw new Error("QQ 音乐微信二维码未返回 uuid");
    }
    const qrResponse = await fetch(`https://open.weixin.qq.com/connect/qrcode/${encodeURIComponent(uuid)}`, {
      headers: { Referer: "https://open.weixin.qq.com/connect/qrconnect" },
    });
    if (!qrResponse.ok) {
      throw new Error(`QQ 音乐微信二维码图片请求失败：HTTP ${qrResponse.status}`);
    }
    const key = randomUUID();
    qqQrSessions.set(key, { createdAt: Date.now(), loginType: "wx", uuid });
    return {
      key,
      loginType: "wx",
      qrImage: `data:image/jpeg;base64,${Buffer.from(await qrResponse.arrayBuffer()).toString("base64")}`,
      qrUrl: "",
    };
  }
  const qrResponse = await fetch("https://ssl.ptlogin2.qq.com/ptqrshow?" + new URLSearchParams({
    appid: "716027609",
    e: "2",
    l: "M",
    s: "3",
    d: "72",
    v: "4",
    t: String(Math.random()),
    daid: "383",
    pt_3rd_aid: "100497308",
  }), {
    headers: { Referer: "https://xui.ptlogin2.qq.com/" },
  });
  if (!qrResponse.ok) {
    throw new Error(`QQ 登录二维码请求失败：HTTP ${qrResponse.status}`);
  }
  const responseCookies = mergeCookieValues(responseSetCookies(qrResponse));
  const qrsig = String(responseCookies.qrsig ?? "").trim();
  if (!qrsig) {
    throw new Error("QQ 登录二维码未返回 qrsig");
  }
  const key = randomUUID();
  qqQrSessions.set(key, { createdAt: Date.now(), loginType: "qq", qrsig });
  return {
    key,
    loginType: "qq",
    qrImage: `data:image/png;base64,${Buffer.from(await qrResponse.arrayBuffer()).toString("base64")}`,
    qrUrl: "",
  };
}

function saveQQMusicCredential(credential, fallbackLoginType) {
  const musicId = credential.musicid ?? credential.str_musicid;
  const musicKey = credential.musickey;
  if (!musicId || !musicKey) {
    throw new Error("QQ 音乐登录响应缺少 musicid 或 musickey");
  }
  const cookie = cookieToHeader({
    uin: String(musicId),
    qqmusic_key: String(musicKey),
    qm_keyst: String(musicKey),
    login_type: String(credential.loginType ?? fallbackLoginType),
  });
  loadQQMusicApi().setCookie(cookie);
  return cookie;
}

async function requestQQMusicLogin({ comm, method, module, param }) {
  const payload = {
    comm: {
      ct: 24,
      cv: 4747474,
      platform: "yqq.json",
      chid: "0",
      uin: 0,
      g_tk: 5381,
      g_tk_new_20200303: 5381,
      format: "json",
      inCharset: "utf-8",
      outCharset: "utf-8",
      notice: 0,
      needNewCode: 1,
      ...comm,
    },
    req_0: { module, method, param },
  };
  const response = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const body = await response.json();
  const result = body?.req_0;
  if (!response.ok || Number(result?.code ?? -1) !== 0) {
    throw new Error(result?.message || result?.msg || `QQ 音乐登录失败：${result?.code ?? response.status}`);
  }
  return result?.data ?? {};
}

function parseQQLoginStatus(text) {
  const callback = String(text ?? "").match(/ptuiCB\((.*?)\)/u);
  if (!callback) {
    throw new Error("QQ 登录状态响应无法解析");
  }
  const args = Array.from(callback[1].matchAll(/'((?:\\.|[^'])*)'/gu), (match) => match[1]);
  const code = Number(args[0]);
  const statusMap = {
    0: { status: 4, message: "QQ 音乐登录成功" },
    65: { status: 0, message: "QQ 登录二维码已过期" },
    66: { status: 1, message: "等待使用 QQ 扫码" },
    67: { status: 2, message: "已扫码，等待手机确认" },
    68: { status: 0, message: "已在手机端取消登录" },
  };
  return { args, ...(statusMap[code] ?? { status: 1, message: args[4] || `QQ 登录状态 ${code}` }) };
}

async function authorizeQQMusicLogin(session, loginArgs) {
  const redirectUrl = String(loginArgs[2] ?? "");
  const parsedRedirect = new URL(redirectUrl);
  const uin = parsedRedirect.searchParams.get("uin");
  const sigx = parsedRedirect.searchParams.get("ptsigx");
  if (!uin || !sigx) {
    throw new Error("QQ 扫码成功，但缺少授权参数");
  }
  const checkSigResponse = await fetch("https://ssl.ptlogin2.graph.qq.com/check_sig?" + new URLSearchParams({
    uin,
    pttype: "1",
    service: "ptqrlogin",
    nodirect: "0",
    ptsigx: sigx,
    s_url: "https://graph.qq.com/oauth2.0/login_jump",
    ptlang: "2052",
    ptredirect: "100",
    aid: "716027609",
    daid: "383",
    j_later: "0",
    low_login_hour: "0",
    regmaster: "0",
    pt_login_type: "3",
    pt_aid: "0",
    pt_aaid: "16",
    pt_light: "0",
    pt_3rd_aid: "100497308",
  }), {
    headers: {
      Cookie: `qrsig=${session.qrsig}`,
      Referer: "https://xui.ptlogin2.qq.com/",
    },
    redirect: "manual",
  });
  const authorizationCookie = cookieHeaderFromResponse(checkSigResponse, `qrsig=${session.qrsig}`);
  const pSkey = mergeCookieValues(authorizationCookie).p_skey;
  if (!pSkey) {
    throw new Error("QQ 扫码成功，但未获取到 p_skey");
  }
  const authorizeBody = new URLSearchParams({
    response_type: "code",
    client_id: "100497308",
    redirect_uri: "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/",
    scope: "get_user_info,get_app_friends",
    state: "state",
    switch: "",
    from_ptlogin: "1",
    src: "1",
    update_auth: "1",
    openapi: "1010_1030",
    g_tk: String(hash33(pSkey, 5381)),
    auth_time: String(Date.now()),
    ui: randomUUID(),
  });
  const authorizeResponse = await fetch("https://graph.qq.com/oauth2.0/authorize", {
    body: authorizeBody,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: authorizationCookie,
    },
    method: "POST",
    redirect: "manual",
  });
  const location = authorizeResponse.headers.get("location") || "";
  const code = new URL(location, "https://y.qq.com/").searchParams.get("code");
  if (!code) {
    throw new Error("QQ 授权成功，但未获取到 QQ 音乐 code");
  }
  const credential = await requestQQMusicLogin({
    comm: { tmeLoginType: 2 },
    method: "QQLogin",
    module: "QQConnectLogin.LoginServer",
    param: { code },
  });
  return saveQQMusicCredential(credential, 2);
}

async function authorizeQQMusicWechat(code) {
  const credential = await requestQQMusicLogin({
    comm: { tmeLoginType: 1 },
    method: "Login",
    module: "music.login.LoginServer",
    param: { code, strAppid: "wx48db31d50e334801" },
  });
  return saveQQMusicCredential(credential, 1);
}

async function checkQQLoginQr(key) {
  const session = qqQrSessions.get(key);
  if (!session || Date.now() - session.createdAt > 5 * 60 * 1000) {
    qqQrSessions.delete(key);
    return { status: 0, message: "QQ 登录二维码已过期" };
  }
  if (session.loginType === "wx") {
    const checkResponse = await fetch("https://lp.open.weixin.qq.com/connect/l/qrconnect?" + new URLSearchParams({
      uuid: session.uuid,
      _: String(Date.now()),
      ...(session.lastStatus ? { last: String(session.lastStatus) } : {}),
    }), {
      headers: { Referer: "https://open.weixin.qq.com/" },
    });
    const match = String(await checkResponse.text()).match(/window\.wx_errcode=(\d+);window\.wx_code='([^']*)'/u);
    if (!match) {
      throw new Error("QQ 音乐微信扫码状态响应无法解析");
    }
    const code = Number(match[1]);
    session.lastStatus = code;
    if (code === 405) {
      const cookie = await authorizeQQMusicWechat(match[2]);
      qqQrSessions.delete(key);
      return { status: 4, message: "QQ 音乐登录成功，Cookie 已自动填入并保存", cookie };
    }
    if (code === 404) {
      return { status: 2, message: "微信已扫码，等待手机确认" };
    }
    if ([402, 403].includes(code)) {
      qqQrSessions.delete(key);
      return { status: 0, message: code === 403 ? "已在手机端取消登录" : "微信登录二维码已过期" };
    }
    return { status: 1, message: "等待使用微信扫码" };
  }
  const checkResponse = await fetch("https://ssl.ptlogin2.qq.com/ptqrlogin?" + new URLSearchParams({
    u1: "https://graph.qq.com/oauth2.0/login_jump",
    ptqrtoken: String(hash33(session.qrsig)),
    ptredirect: "0",
    h: "1",
    t: "1",
    g: "1",
    from_ui: "1",
    ptlang: "2052",
    action: `0-0-${Date.now()}`,
    js_ver: "20102616",
    js_type: "1",
    pt_uistyle: "40",
    aid: "716027609",
    daid: "383",
    pt_3rd_aid: "100497308",
    has_onekey: "1",
  }), {
    headers: {
      Cookie: `qrsig=${session.qrsig}`,
      Referer: "https://xui.ptlogin2.qq.com/",
    },
  });
  const status = parseQQLoginStatus(await checkResponse.text());
  if (status.status !== 4) {
    if (status.status === 0) {
      qqQrSessions.delete(key);
    }
    return status;
  }
  const cookie = await authorizeQQMusicLogin(session, status.args);
  qqQrSessions.delete(key);
  return { status: 4, message: "QQ 音乐登录成功，Cookie 已自动填入并保存", cookie };
}

function normalizeMusicProvider(value, fallback = "auto") {
  const provider = String(value ?? "").trim().toLowerCase();
  return ["auto", "kugou", "netease", "qq"].includes(provider) ? provider : fallback;
}

function configForMusicProvider(config, provider) {
  const normalizedProvider = normalizeMusicProvider(provider, config.plugins.kugouMusic.provider);
  return {
    ...config,
    plugins: {
      ...config.plugins,
      kugouMusic: {
        ...config.plugins.kugouMusic,
        provider: normalizedProvider,
      },
    },
  };
}

function enabledMusicProviders(config, requestedProvider = "auto") {
  const requested = normalizeMusicProvider(requestedProvider);
  const enabled = [
    config.plugins.kugouMusic?.apiEnabled !== false ? "kugou" : "",
    config.plugins.neteaseMusic?.enabled !== false ? "netease" : "",
    config.plugins.qqMusic?.enabled !== false ? "qq" : "",
  ].filter(Boolean);
  if (!enabled.length) {
    throw new Error("没有启用任何音乐 API，请先在接口 API 页面启用至少一个音乐源");
  }
  if (requested === "auto") {
    return enabled;
  }
  if (!enabled.includes(requested)) {
    throw new Error(`${MUSIC_PROVIDER_LABELS[requested] ?? requested} API 未启用`);
  }
  return [requested];
}

async function callNeteaseApi(name, params = {}, options = {}) {
  const api = loadNeteaseApi();
  if (typeof api[name] !== "function") {
    throw new Error(`NeteaseCloudMusicApi 不存在模块：${name}`);
  }
  const config = options.config ?? readConfig();
  const cookie = options.useStoredCookie === false ? "" : String(config.plugins.neteaseMusic?.cookie ?? "");
  const payload = await api[name]({ ...params, ...(cookie ? { cookie } : {}) });
  return {
    body: responseBody(payload),
    cookie: cookieToHeader(mergeCookieValues(cookie, payload?.cookie, payload?.body?.cookie)),
    raw: payload,
  };
}

async function callQQMusicApi(name, params = {}, options = {}) {
  const api = loadQQMusicApi();
  const config = options.config ?? readConfig();
  const cookie = options.useStoredCookie === false ? "" : String(config.plugins.qqMusic?.cookie ?? "");
  api.setCookie(cookieToHeader(mergeCookieValues(cookie)));
  const body = await api.api(String(name).replace(/_/gu, "/"), params);
  return {
    body,
    cookie: cookieToHeader(mergeCookieValues(cookie, api.cookie)),
    raw: body,
  };
}

function readKugouModules() {
  const moduleDir = path.join(projectRoot, "KuGouMusicApi", "module");
  if (!fs.existsSync(moduleDir)) {
    return [];
  }

  return fs
    .readdirSync(moduleDir)
    .filter((file) => file.endsWith(".js") && !file.startsWith("_"))
    .map((file) => {
      const name = file.replace(/\.js$/u, "");
      return {
        name,
        route: `/${name.replace(/_/g, "/")}`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mergeCookieValues(...values) {
  const cookie = {};
  const ignored = new Set(["path", "expires", "max-age", "samesite", "secure", "httponly"]);
  const ingestPair = (pair) => {
    const text = String(pair ?? "").trim();
    if (!text || !text.includes("=")) {
      return;
    }
    const index = text.indexOf("=");
    const key = text.slice(0, index).trim();
    const value = text.slice(index + 1).trim();
    if (!key || ignored.has(key.toLowerCase())) {
      return;
    }
    cookie[key] = value;
  };

  for (const value of values) {
    if (!value) {
      continue;
    }
    if (typeof value === "string") {
      value.split(";").forEach(ingestPair);
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => String(item).split(";").forEach(ingestPair));
      continue;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => {
        if (item !== undefined && item !== null && !ignored.has(key.toLowerCase())) {
          cookie[key] = String(item);
        }
      });
    }
  }

  return cookie;
}

function cookieToHeader(cookie) {
  return Object.entries(cookie ?? {})
    .filter(([key, value]) => key && value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function responseBody(payload) {
  return payload?.body ?? payload ?? {};
}

function findFirstDeep(value, predicate) {
  if (predicate(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstDeep(item, predicate);
      if (found !== undefined) {
        return found;
      }
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = findFirstDeep(item, predicate);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

function extractKugouQrKey(payload) {
  const body = responseBody(payload);
  const direct =
    body?.data?.qrcode ??
    body?.data?.qr_code ??
    body?.data?.qrCode ??
    body?.data?.key ??
    body?.qrcode ??
    body?.key;
  if (direct) {
    return String(direct);
  }

  const found = findFirstDeep(body, (value) => typeof value === "string" && /^[A-Za-z0-9_-]{16,}$/u.test(value));
  return found ? String(found) : "";
}

function extractKugouQrStatus(payload) {
  const body = responseBody(payload);
  const data = body?.data ?? body;
  const status = Number(data?.status ?? data?.qrstatus ?? data?.qr_status ?? body?.status ?? 0);
  const messages = {
    0: "二维码已过期",
    1: "等待扫码",
    2: "已扫码，等待手机确认",
    4: "酷狗登录成功",
  };
  return {
    status,
    message: data?.msg ?? data?.message ?? messages[status] ?? "已获取扫码状态",
  };
}

async function callKugouApi(name, params = {}, options = {}) {
  const api = loadKugouApi();
  if (typeof api[name] !== "function") {
    throw new Error(`KuGouMusicApi 不存在模块：${name}`);
  }

  const config = options.config ?? readConfig();
  const storedCookie = options.useStoredCookie === false ? "" : config.plugins?.kugouMusic?.cookie;
  const cookie = mergeCookieValues(storedCookie, params.cookie);
  const cleanParams = { ...params, cookie };
  const payload = await api[name](cleanParams);
  const mergedCookie = mergeCookieValues(cookie, payload?.cookie);

  return {
    body: responseBody(payload),
    cookie: cookieToHeader(mergedCookie),
    raw: payload,
  };
}

function saveKugouCookie(cookie) {
  const current = readConfig();
  const next = mergeConfig({
    ...current,
    plugins: {
      ...current.plugins,
      kugouMusic: {
        ...current.plugins.kugouMusic,
        cookie,
      },
    },
  });
  const savedAt = upsertConfig(next);
  return { config: next, savedAt };
}

function saveMusicProviderCookie(provider, cookie) {
  const normalizedProvider = normalizeMusicProvider(provider, "kugou");
  if (normalizedProvider === "kugou") {
    return saveKugouCookie(cookie);
  }
  const configKey = normalizedProvider === "netease" ? "neteaseMusic" : "qqMusic";
  const current = readConfig();
  const next = mergeConfig({
    ...current,
    plugins: {
      ...current.plugins,
      [configKey]: {
        ...current.plugins[configKey],
        cookie,
      },
    },
  });
  const savedAt = upsertConfig(next);
  return { config: next, savedAt };
}

function pickString(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function pickNumber(item, keys) {
  for (const key of keys) {
    const value = Number(item?.[key]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 0;
}

function normalizeKugouImage(value) {
  const image = String(value ?? "").trim();
  if (!image) {
    return "";
  }
  return image.replace(/\{size\}/gu, "240").replace(/^(\/\/)/u, "https://");
}

function looksLikeKugouSong(item) {
  if (!item || typeof item !== "object") {
    return false;
  }
  const title = pickString(item, ["songname", "song_name", "SongName", "name", "title", "filename", "FileName", "audio_name"]);
  const hash = pickString(item, ["hash", "Hash", "filehash", "FileHash", "audio_hash", "song_hash"]);
  const mixsongid = pickNumber(item, ["mixsongid", "MixSongID", "EMixSongID", "album_audio_id", "audio_id", "songid"]);
  return Boolean(title && (hash || mixsongid));
}

function collectKugouSongCandidates(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKugouSongCandidates(item, output));
    return output;
  }
  if (!value || typeof value !== "object") {
    return output;
  }
  if (looksLikeKugouSong(value)) {
    output.push(value);
  }
  Object.values(value).forEach((item) => {
    if (item && (Array.isArray(item) || typeof item === "object")) {
      collectKugouSongCandidates(item, output);
    }
  });
  return output;
}

function normalizeKugouSong(item) {
  const merged = {
    ...(item?.base ?? {}),
    ...(item?.audio_info ?? {}),
    ...(item?.info ?? {}),
    ...item,
  };
  let title = pickString(merged, ["songname", "song_name", "SongName", "name", "title", "filename", "FileName", "audio_name"]);
  let artist = pickString(merged, ["singername", "singer_name", "SingerName", "author_name", "artist", "singer", "username"]);
  if (!artist && Array.isArray(merged.singers)) {
    artist = merged.singers.map((singer) => singer?.name ?? singer?.singername).filter(Boolean).join(" / ");
  }
  if (title.includes(" - ") && !artist) {
    const [maybeArtist, maybeTitle] = title.split(" - ");
    artist = maybeArtist.trim();
    title = maybeTitle.trim();
  }

  const durationValue = pickNumber(merged, ["duration", "Duration", "timelen", "time_length", "audio_time"]);
  const duration = durationValue > 1000 ? Math.round(durationValue / 1000) : durationValue;
  const audioUrl = pickString(merged, ["audioUrl", "audio_url", "playUrl", "play_url", "url"]);
  const lyrics = pickString(merged, ["lyrics", "lyric", "lrc"]);
  return {
    title: title || "未命名歌曲",
    artist: artist || "音乐人",
    hash: pickString(merged, ["hash", "Hash", "filehash", "FileHash", "audio_hash", "song_hash"]),
    albumId: pickNumber(merged, ["album_id", "albumid", "AlbumID"]),
    albumAudioId: pickNumber(merged, ["album_audio_id", "mixsongid", "MixSongID", "EMixSongID", "audio_id", "songid"]),
    duration: duration || 240,
    coverUrl: normalizeKugouImage(pickString(merged, ["image", "img", "cover", "cover_url", "album_img", "Image"])),
    source: "kugou",
    sourceId: pickString(merged, ["sourceId", "hash", "Hash", "filehash", "FileHash", "audio_hash", "song_hash"]),
    ...(audioUrl ? { audioUrl } : {}),
    ...(lyrics ? { lyrics } : {}),
    raw: merged,
  };
}

function normalizeNeteaseSong(item) {
  const artists = Array.isArray(item?.ar) ? item.ar : Array.isArray(item?.artists) ? item.artists : [];
  const album = item?.al ?? item?.album ?? {};
  const durationValue = pickNumber(item, ["dt", "duration"]);
  const sourceId = pickString(item, ["sourceId", "id"]);
  return {
    title: pickString(item, ["name", "title"]) || "未命名歌曲",
    artist: artists.map((artist) => artist?.name).filter(Boolean).join(" / ") || pickString(item, ["artist"]) || "音乐人",
    albumId: pickNumber(album, ["id"]),
    duration: durationValue > 1000 ? Math.round(durationValue / 1000) : (durationValue || 240),
    coverUrl: normalizeKugouImage(pickString(album, ["picUrl", "blurPicUrl"])),
    source: "netease",
    sourceId,
    ...(pickString(item, ["audioUrl", "url"]) ? { audioUrl: pickString(item, ["audioUrl", "url"]) } : {}),
    ...(pickString(item, ["lyrics", "lyric"]) ? { lyrics: pickString(item, ["lyrics", "lyric"]) } : {}),
    raw: item,
  };
}

function normalizeQQMusicSong(item) {
  const track = item?.track_info ?? item;
  const singers = Array.isArray(track?.singer) ? track.singer : [];
  const album = track?.album ?? {};
  const sourceId = pickString(track, ["sourceId", "mid", "songmid"]);
  const mediaId = pickString(track?.file ?? track, ["media_mid", "mediaId"]);
  const albumMid = pickString(album, ["mid", "pmid"]);
  return {
    title: pickString(track, ["title", "name"]) || "未命名歌曲",
    artist: singers.map((singer) => singer?.name).filter(Boolean).join(" / ") || pickString(track, ["singer", "artist"]) || "音乐人",
    albumId: pickNumber(album, ["id"]),
    duration: pickNumber(track, ["interval", "duration"]) || 240,
    coverUrl: normalizeKugouImage(
      pickString(track, ["pic", "coverUrl"]) || (albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid.replace(/_\d+$/u, "")}.jpg` : ""),
    ),
    mediaId,
    source: "qq",
    sourceId,
    ...(pickString(track, ["audioUrl", "url"]) ? { audioUrl: pickString(track, ["audioUrl", "url"]) } : {}),
    ...(pickString(track, ["lyrics", "lyric"]) ? { lyrics: pickString(track, ["lyrics", "lyric"]) } : {}),
    raw: track,
  };
}

function normalizeMusicSong(item) {
  const provider = normalizeMusicProvider(item?.source, "kugou");
  if (provider === "netease") {
    return normalizeNeteaseSong(item);
  }
  if (provider === "qq") {
    return normalizeQQMusicSong(item);
  }
  return normalizeKugouSong(item);
}

function dedupeKugouSongs(songs) {
  const seen = new Set();
  return songs.filter((song) => {
    const key = `${song.source ?? "kugou"}:${song.sourceId || song.hash || song.albumAudioId || `${song.title}-${song.artist}`}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeMusicPlaybackMode(value, fallback = "sequential") {
  const mode = String(value ?? "").trim().toLowerCase();
  if (mode === "shuffle" || mode === "sequential") {
    return mode;
  }
  return fallback === "shuffle" ? "shuffle" : "sequential";
}

function normalizeMusicPlaylistSongs(songs) {
  return dedupeKugouSongs(
    (Array.isArray(songs) ? songs : [])
      .filter((song) => song && typeof song === "object")
      .map(normalizeMusicSong)
      .filter((song) => (
        song.hash ||
        song.sourceId ||
        song.albumAudioId ||
        song.audioUrl ||
        song.title !== "未命名歌曲" ||
        song.artist !== "音乐人"
      )),
  );
}

function rowToMusicPlaylist(row) {
  if (!row) {
    return null;
  }
  const songs = normalizeMusicPlaylistSongs(parseJsonArray(row.songs_json));
  return {
    id: row.id,
    name: row.name,
    songs,
    songCount: songs.length,
    playbackMode: normalizeMusicPlaybackMode(row.playback_mode),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readMusicPlaylistById(id) {
  const playlistId = String(id ?? "").trim();
  if (!playlistId) {
    return null;
  }
  return rowToMusicPlaylist(db.prepare("SELECT * FROM music_playlists WHERE id = ?").get(playlistId));
}

function extractAudioUrl(payload) {
  const urls = [];
  const visit = (value) => {
    if (typeof value === "string") {
      const text = value.trim().replace(/^(\/\/)/u, "https://");
      if (/^https?:\/\//u.test(text)) {
        urls.push(text);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  visit(responseBody(payload));
  return (
    urls.find((url) => /\.(mp3|m4a|aac|flac|ogg)(\?|$)/iu.test(url)) ??
    urls.find((url) => /kugou|kgcdn|trackercdn|music/iu.test(url)) ??
    ""
  );
}

function looksLikeLyricCandidate(item) {
  if (!item || typeof item !== "object") {
    return false;
  }
  const id = pickNumber(item, ["id", "lyricsid", "lyricid"]);
  const accesskey = pickString(item, ["accesskey", "access_key", "key"]);
  return Boolean(id && accesskey);
}

function collectLyricCandidates(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectLyricCandidates(item, output));
    return output;
  }
  if (!value || typeof value !== "object") {
    return output;
  }
  if (looksLikeLyricCandidate(value)) {
    output.push(value);
  }
  Object.values(value).forEach((item) => {
    if (item && (Array.isArray(item) || typeof item === "object")) {
      collectLyricCandidates(item, output);
    }
  });
  return output;
}

function normalizeLyricText(text) {
  return String(text ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[(?:ar|ti|al|by|offset|id|hash|sign):/iu.test(line))
    .join("\n");
}

async function fetchKugouLyrics(config, song) {
  try {
    const search = await callKugouApi(
      "search_lyric",
      {
        album_audio_id: song.albumAudioId,
        duration: song.duration,
        hash: song.hash,
        keywords: `${song.artist} ${song.title}`.trim(),
      },
      { config },
    );
    const candidate = collectLyricCandidates(search.body)[0];
    if (!candidate) {
      return "";
    }
    const result = await callKugouApi(
      "lyric",
      {
        accesskey: pickString(candidate, ["accesskey", "access_key", "key"]),
        decode: true,
        fmt: "lrc",
        id: pickNumber(candidate, ["id", "lyricsid", "lyricid"]),
      },
      { config },
    );
    const body = responseBody(result.body);
    return normalizeLyricText(body?.decodeContent ?? body?.content ?? "");
  } catch {
    return "";
  }
}

async function fetchNeteaseLyrics(config, song) {
  if (!song.sourceId) {
    return "";
  }
  try {
    const result = await callNeteaseApi("lyric", { id: song.sourceId }, { config });
    return normalizeLyricText(result.body?.lrc?.lyric ?? result.body?.klyric?.lyric ?? "");
  } catch {
    return "";
  }
}

async function fetchQQMusicLyrics(config, song) {
  if (!song.sourceId) {
    return "";
  }
  try {
    const result = await callQQMusicApi("lyric", { songmid: song.sourceId }, { config });
    return normalizeLyricText(result.body?.lyric ?? "");
  } catch {
    return "";
  }
}

async function fetchMusicLyrics(config, song) {
  const normalized = normalizeMusicSong(song);
  if (normalized.source === "netease") {
    return fetchNeteaseLyrics(config, normalized);
  }
  if (normalized.source === "qq") {
    return fetchQQMusicLyrics(config, normalized);
  }
  return fetchKugouLyrics(config, normalized);
}

async function attachLyricsToSongs(config, songs) {
  const withLyrics = [];
  for (const song of songs) {
    const lyrics = await fetchMusicLyrics(config, song);
    withLyrics.push({
      ...song,
      lyrics,
    });
  }
  return withLyrics;
}

async function searchMusicProvider(config, provider, keywords, limit = 20) {
  const normalizedProvider = normalizeMusicProvider(provider, "kugou");
  const target = Math.max(1, Math.min(100, Number(limit) || 20));
  if (normalizedProvider === "netease") {
    const result = await callNeteaseApi("search", { keywords, limit: target, offset: 0, type: 1 }, { config });
    return dedupeKugouSongs((result.body?.result?.songs ?? []).map(normalizeNeteaseSong)).slice(0, target);
  }
  if (normalizedProvider === "qq") {
    const result = await callQQMusicApi("search/quick", { key: keywords }, { config });
    const quickSongs = Array.isArray(result.body?.song?.itemlist) ? result.body.song.itemlist : [];
    const details = await Promise.all(quickSongs.slice(0, target).map(async (song) => {
      try {
        const detail = await callQQMusicApi("song", { songmid: song.mid }, { config });
        return normalizeQQMusicSong(detail.body?.track_info ?? song);
      } catch {
        return normalizeQQMusicSong(song);
      }
    }));
    return dedupeKugouSongs(details).slice(0, target);
  }
  const result = await callKugouApi("search", { keywords, page: 1, pagesize: target }, { config });
  if (result.cookie && result.cookie !== config.plugins.kugouMusic.cookie) {
    config.plugins.kugouMusic.cookie = result.cookie;
  }
  return dedupeKugouSongs(collectKugouSongCandidates(result.body).map(normalizeKugouSong)).slice(0, target);
}

async function searchMusicSources(config, provider, keywords, limit = 20) {
  const requestedProvider = normalizeMusicProvider(provider);
  const providers = enabledMusicProviders(config, requestedProvider);
  const perProvider = requestedProvider === "auto" ? Math.max(4, Math.ceil(Number(limit || 20) / providers.length)) : Number(limit || 20);
  const settled = await Promise.allSettled(
    providers.map((item) => searchMusicProvider(config, item, keywords, perProvider)),
  );
  const songs = [];
  const errors = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      songs.push(...result.value);
    } else {
      errors.push(`${MUSIC_PROVIDER_LABELS[providers[index]]}：${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  });
  return {
    errors,
    providers,
    songs: dedupeKugouSongs(songs).slice(0, Math.max(1, Number(limit) || 20)),
  };
}

async function fetchNeteaseSongsBySource(config, plugin) {
  const source = String(plugin.source ?? "new");
  const keywordMap = {
    classic: "经典老歌",
    hot: "热门歌曲",
    new: "新歌",
    treasure: "小众宝藏",
  };
  return searchMusicProvider(
    config,
    "netease",
    source === "search" ? plugin.searchKeywords || "华语流行" : keywordMap[source] || plugin.searchKeywords || "新歌",
    Math.max(12, Number(plugin.maxSongs ?? 5) * 3),
  );
}

async function fetchQQMusicSongsBySource(config, plugin) {
  if (String(plugin.source ?? "new") === "search") {
    return searchMusicProvider(config, "qq", plugin.searchKeywords || "华语流行", Math.max(4, Number(plugin.maxSongs ?? 5) * 2));
  }
  const typeMap = { classic: 2, hot: 0, new: 0, treasure: 1 };
  const result = await callQQMusicApi("new/songs", { type: typeMap[plugin.source] ?? 0 }, { config });
  return dedupeKugouSongs((result.body?.list ?? []).map(normalizeQQMusicSong));
}

async function fetchKugouSongsBySource(config, plugin) {
  const maxSongs = Math.max(1, Math.min(KUGOU_MAX_PROGRAM_SONGS, Number(plugin.maxSongs ?? 5)));
  const pagesize = Math.max(12, Math.min(100, Math.max(30, Math.ceil(maxSongs / 5))));
  const candidateTarget = Math.max(maxSongs * 3, maxSongs + 20);
  const source = String(plugin.source ?? "new");
  const seed = String(plugin.seed ?? "").trim();
  const calls = [];

  if (source === "search") {
    calls.push(["search", { keywords: plugin.searchKeywords || "华语流行", pagesize, page: 1 }]);
  } else if (source === "classic") {
    calls.push(["top_card", { card_id: Number(plugin.cardId || 2) || 2, pagesize }]);
    calls.push(["search", { keywords: plugin.searchKeywords || "经典老歌", pagesize, page: 1 }]);
  } else if (source === "hot") {
    calls.push(["top_card", { card_id: 3, pagesize }]);
    calls.push(["top_song", { type: plugin.rankType || 21608, pagesize, page: 1 }]);
  } else if (source === "treasure") {
    calls.push(["top_card", { card_id: 4, pagesize }]);
    calls.push(["search", { keywords: plugin.searchKeywords || "小众 宝藏", pagesize, page: 1 }]);
  } else {
    calls.push(["top_song", { type: plugin.rankType || 21608, pagesize, page: 1 }]);
    calls.push(["search", { keywords: plugin.searchKeywords || "新歌", pagesize, page: 1 }]);
  }

  const collected = [];
  for (const [name, params] of calls) {
    const supportsPaging = ["search", "top_song"].includes(name);
    const maxPages = supportsPaging ? Math.max(1, Math.ceil(candidateTarget / pagesize)) : 1;
    const pageOffset = seed && supportsPaging
      ? stableHashNumber(`${seed}:${name}:${JSON.stringify(params)}`) % 5
      : 0;
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const page = pageIndex + 1 + pageOffset;
      try {
        const result = await callKugouApi(name, {
          ...params,
          ...(supportsPaging ? { page } : {}),
          pagesize,
        }, { config });
        if (result.cookie && result.cookie !== config.plugins.kugouMusic.cookie) {
          config.plugins.kugouMusic.cookie = result.cookie;
        }
        const before = dedupeKugouSongs(collected).length;
        const pageSongs = collectKugouSongCandidates(result.body).map(normalizeKugouSong);
        collected.push(...pageSongs);
        const after = dedupeKugouSongs(collected).length;
        if (after >= candidateTarget || (page > 1 && after === before)) {
          break;
        }
      } catch {
        // Try the next page/source fallback; upstream KuGou endpoints are not equally stable.
        break;
      }
    }
    if (dedupeKugouSongs(collected).length >= candidateTarget) {
      break;
    }
  }

  const songs = (seed
    ? seededShuffle(dedupeKugouSongs(collected), `${seed}:${source}:${plugin.searchKeywords ?? ""}`, kugouSongKey)
    : dedupeKugouSongs(collected)).slice(0, candidateTarget);
  if (!songs.length) {
    throw new Error("酷狗没有返回可用于节目编排的歌曲");
  }
  return songs;
}

async function resolvePlayableKugouSongs(config, songs, quality, targetCount = Number.POSITIVE_INFINITY) {
  const playable = [];
  const candidates = dedupeKugouSongs(songs)
    .map(normalizeMusicSong)
    .filter((song) => song.audioUrl || song.hash || song.sourceId);
  for (let index = 0; index < candidates.length && playable.length < targetCount; index += KUGOU_PLAY_URL_CONCURRENCY) {
    const batch = candidates.slice(index, index + KUGOU_PLAY_URL_CONCURRENCY);
    const results = await Promise.all(batch.map(async (song) => {
      if (song.audioUrl) {
        return song;
      }
      try {
        if (song.source === "netease") {
          if (!song.sourceId) {
            return null;
          }
          const level = quality === "flac" ? "lossless" : quality === "320" ? "exhigh" : "standard";
          const result = await callNeteaseApi("song_url_v1", { id: song.sourceId, level }, { config });
          const audioUrl = pickString(result.body?.data?.[0] ?? {}, ["url"]);
          return audioUrl ? { ...song, audioUrl: audioUrl.replace(/^http:/u, "https:") } : null;
        }
        if (song.source === "qq") {
          if (!song.sourceId) {
            return null;
          }
          let resolvedSong = song;
          if (!resolvedSong.mediaId) {
            const detail = await callQQMusicApi("song", { songmid: song.sourceId }, { config });
            resolvedSong = normalizeQQMusicSong(detail.body?.track_info ?? song);
          }
          const result = await callQQMusicApi("song/url", {
            id: resolvedSong.sourceId,
            mediaId: resolvedSong.mediaId || resolvedSong.sourceId,
            type: ["128", "320", "flac"].includes(String(quality)) ? String(quality) : "128",
          }, { config });
          const audioUrl = typeof result.body === "string" ? result.body : pickString(result.body, ["url", "data"]);
          return audioUrl ? { ...resolvedSong, audioUrl: audioUrl.replace(/^http:/u, "https:") } : null;
        }
        if (!song.hash) {
          return null;
        }
        const result = await callKugouApi(
          "song_url",
          {
            album_audio_id: song.albumAudioId,
            album_id: song.albumId,
            hash: song.hash,
            quality: quality || "128",
          },
          { config },
        );
        const audioUrl = extractAudioUrl(result.body);
        if (result.cookie && result.cookie !== config.plugins.kugouMusic.cookie) {
          config.plugins.kugouMusic.cookie = result.cookie;
        }
        return audioUrl ? { ...song, audioUrl } : null;
      } catch {
        return null;
      }
    }));
    for (const song of results) {
      if (song?.audioUrl) {
        playable.push(song);
        if (playable.length >= targetCount) {
          break;
        }
      }
    }
  }
  return playable;
}

function mergeUniqueKugouSongs(...songGroups) {
  return dedupeKugouSongs(songGroups.flat().filter(Boolean).map(normalizeMusicSong));
}

async function fetchPlayableKugouSongsOnly(config, plugin, targetCount, manualSongs = [], options = {}) {
  const songLimit = Math.max(1, Math.min(KUGOU_MAX_PROGRAM_SONGS, Number(targetCount || plugin.maxSongs || 5)));
  const seed = String(options.seed ?? plugin.seed ?? "").trim();
  let candidateSongs = [];
  let manualPlayable = [];
  if (manualSongs.length) {
    manualPlayable = (await resolvePlayableKugouSongs(config, manualSongs, plugin.quality, songLimit)).slice(0, songLimit);
    if (!options.topUpManual || (manualPlayable.length >= songLimit && !options.refreshManualPool)) {
      return options.shuffleManual && seed
        ? seededShuffle(manualPlayable, `${seed}:manual`, kugouSongKey).slice(0, songLimit)
        : manualPlayable;
    }
    candidateSongs = mergeUniqueKugouSongs(manualPlayable);
  }

  const fallbackKeywords = [
    plugin.searchKeywords,
    "华语流行",
    "热门歌曲",
    "新歌",
    "经典老歌",
    "粤语流行",
    "欧美流行",
    "日韩流行",
    "民谣",
    "轻音乐",
    "影视原声",
    "网络歌曲",
    "治愈",
    "夜晚",
  ].map((keyword) => String(keyword ?? "").trim()).filter(Boolean);
  const rotatedFallbackKeywords = seed ? rotateBySeed(fallbackKeywords, `${seed}:fallback-keywords`) : fallbackKeywords;
  const sourcePlans = [
    plugin,
    { ...plugin, source: "new", searchKeywords: plugin.searchKeywords || "新歌" },
    { ...plugin, source: "hot", searchKeywords: plugin.searchKeywords || "热歌" },
    { ...plugin, source: "classic", searchKeywords: plugin.searchKeywords || "经典老歌" },
    ...rotatedFallbackKeywords.map((keyword) => ({ ...plugin, source: "search", searchKeywords: keyword })),
  ];
  const seenPlan = new Set();

  for (const plan of sourcePlans) {
    const planKey = `${plan.source}:${plan.searchKeywords ?? ""}:${plan.rankType ?? ""}:${plan.cardId ?? ""}`;
    if (seenPlan.has(planKey)) {
      continue;
    }
    seenPlan.add(planKey);
    try {
      const songs = await fetchKugouSongsBySource(config, {
        ...plan,
        maxSongs: songLimit,
        seed: seed ? `${seed}:${planKey}` : "",
      });
      candidateSongs = mergeUniqueKugouSongs(candidateSongs, songs);
      const orderedCandidates = seed
        ? seededShuffle(candidateSongs, `${seed}:${planKey}:candidates`, kugouSongKey)
        : candidateSongs;
      const resolvedPlayable = await resolvePlayableKugouSongs(config, orderedCandidates, plugin.quality, songLimit);
      const playable = manualPlayable.length && !options.refreshManualPool
        ? mergeUniqueKugouSongs(manualPlayable, resolvedPlayable)
        : resolvedPlayable;
      if (playable.length >= songLimit || plan === sourcePlans[sourcePlans.length - 1]) {
        return playable.slice(0, songLimit);
      }
      candidateSongs = mergeUniqueKugouSongs(playable, candidateSongs);
    } catch {
      // Continue with the next source plan.
    }
  }

  const finalCandidates = seed
    ? seededShuffle(candidateSongs, `${seed}:final-candidates`, kugouSongKey)
    : candidateSongs;
  const finalPlayable = await resolvePlayableKugouSongs(config, finalCandidates, plugin.quality, songLimit);
  return manualPlayable.length && !options.refreshManualPool
    ? mergeUniqueKugouSongs(manualPlayable, finalPlayable).slice(0, songLimit)
    : finalPlayable;
}

async function fetchPlayableKugouSongs(config, plugin, targetCount, manualSongs = [], options = {}) {
  const songLimit = Math.max(1, Math.min(KUGOU_MAX_PROGRAM_SONGS, Number(targetCount || plugin.maxSongs || 5)));
  const provider = normalizeMusicProvider(plugin.provider ?? config.plugins.kugouMusic.provider);
  const providers = enabledMusicProviders(config, provider);
  const seed = String(options.seed ?? plugin.seed ?? "").trim();
  let playable = manualSongs.length
    ? await resolvePlayableKugouSongs(config, manualSongs, plugin.quality, songLimit)
    : [];
  if (playable.length >= songLimit && !options.refreshManualPool) {
    return options.shuffleManual && seed
      ? seededShuffle(playable, `${seed}:manual`, kugouSongKey).slice(0, songLimit)
      : playable.slice(0, songLimit);
  }

  if (providers.length === 1 && providers[0] === "kugou") {
    return fetchPlayableKugouSongsOnly(config, { ...plugin, provider: "kugou" }, songLimit, playable, options);
  }

  const allCandidates = [];
  for (const [index, sourceProvider] of providers.entries()) {
    const remaining = Math.max(1, songLimit - playable.length);
    const providerTarget = provider === "auto"
      ? Math.max(1, Math.ceil(remaining / Math.max(1, providers.length - index)))
      : remaining;
    try {
      let candidates;
      if (sourceProvider === "kugou") {
        candidates = await fetchKugouSongsBySource(config, {
          ...plugin,
          maxSongs: Math.max(providerTarget, Number(plugin.maxSongs ?? providerTarget)),
          seed: seed ? `${seed}:kugou` : "",
        });
      } else if (sourceProvider === "netease") {
        candidates = await fetchNeteaseSongsBySource(config, { ...plugin, maxSongs: providerTarget });
      } else {
        candidates = await fetchQQMusicSongsBySource(config, { ...plugin, maxSongs: providerTarget });
      }
      allCandidates.push(...candidates);
      const ordered = seed
        ? seededShuffle(candidates, `${seed}:${sourceProvider}`, kugouSongKey)
        : candidates;
      const resolved = await resolvePlayableKugouSongs(config, ordered, plugin.quality, providerTarget);
      playable = mergeUniqueKugouSongs(playable, resolved).slice(0, songLimit);
    } catch {
      // A mixed-source request keeps working when one upstream API is unavailable.
    }
  }

  if (playable.length < songLimit && allCandidates.length) {
    const ordered = seed
      ? seededShuffle(allCandidates, `${seed}:all-providers`, kugouSongKey)
      : allCandidates;
    const resolved = await resolvePlayableKugouSongs(config, ordered, plugin.quality, songLimit);
    playable = mergeUniqueKugouSongs(playable, resolved).slice(0, songLimit);
  }
  return playable;
}

function parseAiSongListPayload(content) {
  const raw = String(content ?? "").trim();
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/i) ?? raw.match(/```\s*([\s\S]*?)```/);
  const jsonText = jsonMatch?.[1] ?? raw;
  const jsonCandidates = [
    jsonText,
    jsonText.slice(Math.max(0, jsonText.indexOf("[")), jsonText.lastIndexOf("]") + 1),
    jsonText.slice(Math.max(0, jsonText.indexOf("{")), jsonText.lastIndexOf("}") + 1),
  ].filter((text) => text && text.length > 1);

  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      const songs = Array.isArray(parsed) ? parsed : Array.isArray(parsed.songs) ? parsed.songs : [];
      const normalized = songs.map(normalizeAiSongCandidate).filter(Boolean);
      if (normalized.length) {
        return normalized;
      }
    } catch {
      // Try the next parse strategy.
    }
  }

  return raw
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)、])\s*/u, "").trim())
    .map(normalizeAiSongCandidate)
    .filter(Boolean);
}

function normalizeAiSongCandidate(item) {
  if (!item) {
    return null;
  }
  if (typeof item === "string") {
    const text = item.replace(/[《》"]/gu, "").trim();
    if (!text) {
      return null;
    }
    const parts = text.split(/\s+[-–—]\s+| - | — | – | \/ /u).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { artist: parts[0], title: parts.slice(1).join(" - ") };
    }
    return { artist: "", title: text };
  }

  if (typeof item !== "object") {
    return null;
  }

  const title = pickString(item, ["title", "song", "songName", "name", "歌曲", "歌名"]);
  const artist = pickString(item, ["artist", "singer", "singerName", "author", "歌手", "艺人"]);
  return title ? { artist, title } : null;
}

function canonicalSongText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[《》"'“”‘’\s·・.,，。:：;；!！?？()[\]（）【】_-]/gu, "");
}

function scoreKugouSongMatch(candidate, song) {
  const candidateTitle = canonicalSongText(candidate.title);
  const candidateArtist = canonicalSongText(candidate.artist);
  const songTitle = canonicalSongText(song.title);
  const songArtist = canonicalSongText(song.artist);
  let score = 0;
  if (candidateTitle && songTitle === candidateTitle) {
    score += 6;
  } else if (candidateTitle && (songTitle.includes(candidateTitle) || candidateTitle.includes(songTitle))) {
    score += 3;
  }
  if (candidateArtist && songArtist === candidateArtist) {
    score += 4;
  } else if (candidateArtist && (songArtist.includes(candidateArtist) || candidateArtist.includes(songArtist))) {
    score += 2;
  }
  if (song.hash || song.sourceId) {
    score += 1;
  }
  return score;
}

function chatCompletionText(data) {
  const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === "string" ? part : part?.text ?? part?.content ?? "")
      .filter(Boolean)
      .join("\n");
  }
  return String(content ?? "");
}

async function generateAiHotSongBatch(config, batchIndex, batchSize, existingSongs, prompt) {
  const endpoint = buildEndpoint(config.baseUrl, "/chat/completions");
  const promptText = String(prompt ?? DEFAULT_AI_HOT_SONG_PROMPT).trim() || DEFAULT_AI_HOT_SONG_PROMPT;
  const existingText = existingSongs
    .slice(-80)
    .map((song) => `${song.artist || "未知歌手"}《${song.title}》`)
    .join("、");
  const response = await fetchOrThrow(endpoint, {
    method: "POST",
    headers: jsonHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "你是中文电台音乐总监，熟悉华语、港台、欧美、日韩和网络热门歌曲。" +
            "只输出严格 JSON，不要 Markdown，不要解释。JSON 格式为 {\"songs\":[{\"title\":\"歌名\",\"artist\":\"歌手\"}]}。",
        },
        {
          role: "user",
          content:
            `${promptText}\n\n` +
            `请生成第 ${batchIndex + 1} 批 ${batchSize} 首适合音乐连播的热门歌曲。` +
            "歌曲必须符合上面的内容要求，歌名和歌手尽量准确。" +
            "不要虚构歌曲，不要重复。" +
            (existingText ? ` 已有歌曲请避开：${existingText}` : "") +
            ` 尽量返回 ${batchSize} 条 songs。`,
        },
      ],
      temperature: Math.max(0.35, Number(config.temperature ?? 0.7)),
      max_tokens: Math.min(3000, Math.max(1800, Number(config.maxTokens ?? 2400))),
      stream: false,
    }),
  }, "大模型");

  if (!response.ok) {
    throw new Error(`大模型热门歌单生成失败：${await readError(response)}`);
  }
  const data = await response.json();
  return parseAiSongListPayload(chatCompletionText(data));
}

async function generateAiHotSongCandidates(config, targetCount = AI_HOT_SONG_TARGET, prompt = DEFAULT_AI_HOT_SONG_PROMPT, avoidSongs = []) {
  const missing = validateServiceConfig(config);
  if (missing.length) {
    throw new Error(`大模型配置缺少：${missing.join("、")}`);
  }
  if (!config.enabled) {
    throw new Error("大模型 API 当前未启用");
  }

  const collected = [];
  const seen = new Set();
  const avoided = Array.isArray(avoidSongs)
    ? avoidSongs.map(normalizeMusicSong).filter((song) => song.title || song.artist)
    : [];
  for (const song of avoided) {
    const key = canonicalSongText(`${song.artist}-${song.title}`);
    if (key) {
      seen.add(key);
    }
  }
  const maxBatches = Math.ceil(targetCount / AI_HOT_SONG_BATCH_SIZE) + 2;
  for (let batchIndex = 0; batchIndex < maxBatches && collected.length < targetCount; batchIndex += 1) {
    let batch = [];
    try {
      batch = await generateAiHotSongBatch(config, batchIndex, AI_HOT_SONG_BATCH_SIZE, [...avoided, ...collected], prompt);
    } catch (error) {
      if (!collected.length) {
        throw error;
      }
      break;
    }
    for (const song of batch) {
      const key = canonicalSongText(`${song.artist}-${song.title}`);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      collected.push(song);
      if (collected.length >= targetCount) {
        break;
      }
    }
  }

  if (!collected.length) {
    throw new Error("大模型没有返回可用的热门歌曲列表");
  }
  return collected.slice(0, targetCount);
}

async function hydrateKugouSongsBySearch(config, songs, targetCount = AI_HOT_SONG_TARGET) {
  const hydrated = [];
  const normalized = songs.map(normalizeMusicSong).filter((song) => song.title || song.hash || song.sourceId || song.albumAudioId || song.audioUrl);

  for (let index = 0; index < normalized.length && hydrated.length < targetCount; index += KUGOU_PLAY_URL_CONCURRENCY) {
    const batch = normalized.slice(index, index + KUGOU_PLAY_URL_CONCURRENCY);
    const results = await Promise.all(batch.map(async (song) => {
      if (song.audioUrl || song.hash || song.sourceId) {
        return song;
      }
      const found = await searchKugouSongForAiCandidate(config, song);
      return found ?? song;
    }));
    hydrated.push(...results.filter(Boolean));
  }

  return mergeUniqueKugouSongs(hydrated).slice(0, targetCount);
}

async function searchKugouSongForAiCandidate(config, candidate) {
  const keywords = `${candidate.artist ?? ""} ${candidate.title ?? ""}`.trim();
  if (!keywords) {
    return null;
  }
  try {
    const result = await searchMusicSources(config, config.plugins.kugouMusic.provider, keywords, 9);
    const songs = result.songs;
    return songs
      .sort((a, b) => scoreKugouSongMatch(candidate, b) - scoreKugouSongMatch(candidate, a))[0] ?? null;
  } catch {
    return null;
  }
}

async function resolveAiGeneratedHotSongs(config, candidates, targetCount = AI_HOT_SONG_TARGET, provider) {
  config = configForMusicProvider(config, provider);
  const plugin = {
    ...config.plugins.kugouMusic,
    maxSongs: targetCount,
    useAiScript: false,
  };
  const found = [];

  for (let index = 0; index < candidates.length && found.length < targetCount; index += KUGOU_PLAY_URL_CONCURRENCY) {
    const batch = candidates.slice(index, index + KUGOU_PLAY_URL_CONCURRENCY);
    const results = await Promise.all(batch.map((song) => searchKugouSongForAiCandidate(config, song)));
    found.push(...results.filter(Boolean));
  }

  let playable = await resolvePlayableKugouSongs(config, mergeUniqueKugouSongs(found), plugin.quality, targetCount);
  if (playable.length < targetCount) {
    const fallback = await fetchPlayableKugouSongs(
      config,
      { ...plugin, source: "hot" },
      targetCount,
      playable,
      {
        seed: `ai-hot-songs:${new Date().toISOString().slice(0, 10)}`,
        topUpManual: true,
      },
    );
    playable = mergeUniqueKugouSongs(playable, fallback).slice(0, targetCount);
  }

  if (!playable.length) {
    throw new Error("热门歌曲已生成，但音乐接口未解析到可播放地址，请检查所选音乐源登录态");
  }
  return playable.slice(0, targetCount);
}

function buildFallbackMusicSegments(songs, host, title, airTime = programAirTimeContext(null)) {
  return songs.map((song, index) => ({
    hostId: host.id,
    hostName: host.name,
    songIndex: index,
    style: "音乐节目串场，明亮、自然、像真人电台 DJ",
    text: alignTextToAirTime(
      index === 0
        ? `${airTime.hasTime ? `${airTime.greeting}，` : ""}欢迎收听${title}。开场这首歌来自${song.artist}，叫做《${song.title}》。把音量调到舒服的位置，我们一起进入这段音乐时间。`
        : `刚才的旋律慢慢落下，下一首换个气口。接下来听${song.artist}的《${song.title}》，让这一段节目的情绪继续往前走。`,
      airTime,
    ),
  }));
}

async function generateMusicShowSegments(config, songs, host, title, useAiScript, options = {}) {
  const airTime = programAirTimeContext(options.scheduledAt, options.publishDate);
  const missing = validateServiceConfig(config);
  if (!useAiScript || missing.length || !config.enabled) {
    return buildFallbackMusicSegments(songs, host, title, airTime);
  }

  const endpoint = buildEndpoint(config.baseUrl, "/chat/completions");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: jsonHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "你是星声电台的音乐节目导演和中文电台 DJ。你只写原创推荐串场，不引用歌词，不输出 Markdown。" +
            "必须输出严格 JSON：{\"title\":\"节目标题\",\"segments\":[{\"songIndex\":0,\"text\":\"播放前推荐词\",\"style\":\"播读风格\"}]}。" +
            "segments 数量必须和歌曲数量一致，每段 40 到 90 个汉字，声音自然，有音乐节目感，不能机械读序号。" +
            airTime.instruction,
        },
        {
          role: "user",
          content:
            `节目标题：${title}\n` +
            airTimeUserPrompt(airTime) +
            `主播：${host.id} / ${host.name} / ${host.tone}\n` +
            `歌曲清单：\n${songs.map((song, index) => `- ${index}: ${song.artist}《${song.title}》`).join("\n")}\n` +
            "请为每首歌写一段播放前串场。第一段要包含开场感，后续段落要承接上一首歌，不要引用歌词。",
        },
      ],
      temperature: Math.max(0.35, Number(config.temperature ?? 0.7)),
      max_tokens: Math.max(900, Number(config.maxTokens ?? 1200)),
      stream: false,
    }),
  });

  if (!response.ok) {
    return buildFallbackMusicSegments(songs, host, title, airTime);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";
  try {
    const jsonMatch = String(content).match(/```json\s*([\s\S]*?)```/i) ?? String(content).match(/```\s*([\s\S]*?)```/);
    const parsed = JSON.parse(jsonMatch?.[1] ?? content);
    const segments = Array.isArray(parsed.segments) ? parsed.segments : [];
    const normalized = songs.map((song, index) => {
      const segment = segments.find((item) => Number(item?.songIndex) === index) ?? segments[index];
      const text = alignTextToAirTime(segment?.text, airTime);
      return text
        ? {
            hostId: host.id,
            hostName: host.name,
            songIndex: index,
            style: String(segment?.style ?? "音乐节目串场，明亮、自然、像真人电台 DJ").trim(),
            text,
          }
        : buildFallbackMusicSegments([song], host, title, airTime)[0];
    });
    return normalized.filter((segment) => segment.text);
  } catch {
    return buildFallbackMusicSegments(songs, host, title, airTime);
  }
}

async function buildKugouProgram(config, options = {}) {
  const plugin = {
    ...config.plugins.kugouMusic,
    ...(options.plugin ?? {}),
  };
  if (!plugin.enabled) {
    throw new Error("音乐联播插件未启用");
  }

  const host = hostProfiles.find((item) => item.id === (options.hostId || plugin.hostId)) ?? hostProfiles[4] ?? hostProfiles[0];
  const playbackSpeed = normalizePlaybackSpeed(options.playbackSpeed ?? config.tts.speed);
  const scheduledAt = normalizeScheduledAt(options.scheduledAt);
  const publishDate = normalizePublishDate(options.publishDate);
  const musicPlaylistId = String(options.musicPlaylistId ?? "").trim() || null;
  const playbackMode = normalizeMusicPlaybackMode(options.playbackMode);
  const id = randomUUID();
  const createdAt = nowIso();
  const title =
    String(options.title ?? "").trim() ||
    (plugin.source === "classic"
      ? "经典老歌 · 歌单连播"
      : plugin.source === "hot"
        ? "热门好歌 · 歌单连播"
        : plugin.source === "treasure"
          ? "小众宝藏 · 歌单连播"
          : "新歌速递 · 歌单连播");

  const normalizedManualSongs = normalizeMusicPlaylistSongs(options.songs);
  const orderedManualSongs = orderMusicPlaylistSongs(
    normalizedManualSongs,
    playbackMode,
    publishDate,
    musicPlaylistId,
  );
  const manualSongs = orderedManualSongs.length
    ? await hydrateKugouSongsBySearch(config, orderedManualSongs, orderedManualSongs.length)
    : [];
  const configuredSongLimit = Math.max(1, Math.min(KUGOU_MAX_PROGRAM_SONGS, Number(plugin.maxSongs ?? 5)));
  const songLimit = options.topUpManualSongs
    ? Math.max(configuredSongLimit, manualSongs.length || 0)
    : manualSongs.length || configuredSongLimit;
  const useAiScript = Boolean(plugin.useAiScript);
  const songSeed = String(options.songSeed ?? (publishDate ? `kugou:${publishDate}:${title}:${plugin.searchKeywords ?? ""}` : "")).trim();
  const generationWarnings = [];
  // 取歌 + 解析可播放 URL：若所选来源（如小众宝藏）取不到任何可播歌曲，自动降级到“新歌速递”重试一次，保证能出节目。
  let playableSongs = await fetchPlayableKugouSongs(config, plugin, songLimit, manualSongs, {
    refreshManualPool: Boolean(options.refreshManualPool),
    seed: songSeed,
    shuffleManual: Boolean(options.shuffleManualSongs),
    topUpManual: Boolean(options.topUpManualSongs),
  });
  let fallbackSource = null;
  if (!playableSongs.length && !manualSongs.length && plugin.source !== "new") {
    fallbackSource = "new";
    playableSongs = await fetchPlayableKugouSongs(config, { ...plugin, source: "new" }, songLimit, [], {
      seed: songSeed,
    });
  }
  if (!playableSongs.length && !musicPlaylistId && (useAiScript || options.allowAiSongFallback)) {
    try {
      const candidates = await generateAiHotSongCandidates(
        config.llm,
        songLimit,
        options.aiSongPrompt || DEFAULT_AI_HOT_SONG_PROMPT,
      );
      playableSongs = await resolveAiGeneratedHotSongs(config, candidates, songLimit);
      if (playableSongs.length) {
        generationWarnings.push("所选音乐来源未取得可播放歌曲，已改用 AI 生成歌单。");
      }
    } catch (error) {
      generationWarnings.push(`AI 歌单兜底失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!playableSongs.length) {
    throw new Error("所选音乐接口未返回可播放歌曲，请检查登录态或更换音乐源/关键词");
  }
  const playlistSongs = useAiScript || options.attachLyrics ? await attachLyricsToSongs(config, playableSongs) : playableSongs;

  if (config.plugins.kugouMusic.cookie) {
    saveKugouCookie(config.plugins.kugouMusic.cookie);
  }

  // useAiScript 同时控制是否生成串场：取消勾选时生成纯音乐节目，不添加任何 AI 串场与配音。
  const segments = applyVoiceStylePrompt(useAiScript
    ? await generateMusicShowSegments(config.llm, playlistSongs, host, title, useAiScript, { publishDate, scheduledAt })
    : [], options.voicePrompt, config.tts.defaultStylePrompt);
  const playlist = [];
  const ttsErrors = [];
  if (fallbackSource) {
    generationWarnings.push("所选来源未取得可播放歌曲，已自动降级为“新歌速递”来源。");
  }
  const ttsReady = !validateTtsConfig(config.tts).length && config.tts.enabled;

  for (const [index, song] of playlistSongs.entries()) {
    const segment = segments[index];
    if (useAiScript && segment?.text && ttsReady) {
      try {
        const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, segment.text, `${id}-talk-${index + 1}`, [segment]);
        playlist.push({
          type: "talk",
          title: `${host.name}推荐`,
          host: host.name,
          text: segment.text,
          audioUrl: audio.audioUrl,
          audioPath: audio.audioPath,
          duration: talkedSegmentDuration(audio, segment),
        });
      } catch (error) {
        ttsErrors.push(error instanceof Error ? error.message : String(error));
      }
    }

    playlist.push({
      type: "song",
      title: song.title,
      artist: song.artist,
      audioUrl: song.audioUrl,
      coverUrl: song.coverUrl,
      duration: song.duration,
      hash: song.hash,
      lyrics: song.lyrics,
      mediaId: song.mediaId,
      albumId: song.albumId,
      albumAudioId: song.albumAudioId,
      source: song.source || "kugou",
      sourceId: song.sourceId,
    });
  }

  const firstAudio = playlist.find((item) => item.audioUrl);
  const script = segments.map((segment) => segment.text).join("\n\n");
  const errorMessages = [
    ...generationWarnings,
    ...(ttsErrors.length ? [`部分语音串场未生成：${ttsErrors[0]}`] : []),
  ];
  insertProgram({
    id,
    title,
    host: host.name,
    prompt: options.prompt || `音乐歌单节目：${plugin.source} / ${plugin.searchKeywords || "自动推荐"}`,
    script,
    segmentsJson: JSON.stringify(segments),
    playlistJson: JSON.stringify(playlist),
    status: firstAudio ? "ready" : "script_saved",
    audioUrl: firstAudio?.audioUrl ?? null,
    audioPath: firstAudio?.audioPath ?? null,
    sortOrder: nextProgramSortOrder(),
    scheduledAt,
    categoryId: options.categoryId || defaultCategoryIdForName("音乐专题"),
    playbackSpeed,
    publishDate,
    publishedAt: publishDate ? createdAt : null,
    sourceType: options.sourceType || "plugin",
    pluginId: options.pluginId || "kugou-music",
    programPresetId: options.programPresetId,
    musicPlaylistId,
    playbackMode: options.playbackMode ? playbackMode : null,
    playbackResetAt: options.restartFromBeginning && playbackMode === "sequential" ? createdAt : null,
    restartFromBeginning: Boolean(options.restartFromBeginning && playbackMode === "sequential"),
    llmModel: plugin.useAiScript ? config.llm.model : "规则编排",
    ttsModel: plugin.useAiScript ? config.tts.model : null,
    errorMessage: errorMessages.length ? errorMessages[0] : null,
    createdAt,
    updatedAt: createdAt,
  });

  const program = readProgramById(id);
  archiveProgram(program);
  return {
    program,
    ttsErrors,
  };
}

app.get("/api/health", (request, response) => {
  response.json({
    ok: true,
    dbPath,
    audioDir,
  });
});

app.post("/api/hosts/:id/voice-preview", async (request, response) => {
  const host = hostProfiles.find((item) => item.id === request.params.id);
  if (!host) {
    response.status(404).json({ message: "主播不存在" });
    return;
  }

  try {
    const config = readConfig();
    const text = `你好，我是${host.name}。这里是星声电台，愿今天的声音陪你慢慢抵达好心情。`;
    const segment = {
      hostId: host.id,
      hostName: host.name,
      style: `${host.voice}，${host.tone}`,
      text,
    };
    const audio = await synthesizeSpeech(
      {
        ...config.tts,
        speed: normalizePlaybackSpeed(config.tts.speed),
      },
      text,
      `host-preview-${host.id}-${Date.now()}`,
      [segment],
    );
    response.json({
      audioUrl: audio.audioUrl,
      message: `${host.name} 音色试听已生成`,
    });
  } catch (error) {
    response.status(502).json({
      message: "主播音色试听生成失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/music/lyrics", async (request, response) => {
  const hash = String(request.query?.hash ?? "").trim();
  const sourceId = String(request.query?.sourceId ?? "").trim();
  const title = String(request.query?.title ?? "").trim();
  if (!hash && !sourceId && !title) {
    response.status(400).json({ message: "缺少歌曲标识或标题" });
    return;
  }

  try {
    const config = readConfig();
    const lyrics = await fetchMusicLyrics(config, {
      albumAudioId: Number(request.query?.albumAudioId ?? 0),
      artist: String(request.query?.artist ?? "").trim(),
      duration: Number(request.query?.duration ?? 0),
      hash,
      mediaId: String(request.query?.mediaId ?? "").trim(),
      source: normalizeMusicProvider(request.query?.source, "kugou"),
      sourceId,
      title,
    });
    response.json({
      lyrics,
      message: lyrics ? "歌词已获取" : "暂未找到歌词",
    });
  } catch (error) {
    response.status(502).json({
      message: "歌词获取失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/programs/:id/playlist/:queueIndex/resolve-audio", async (request, response) => {
  const program = readProgramById(request.params.id);
  if (!program) {
    response.status(404).json({ message: "节目不存在" });
    return;
  }
  const queue = (program.playlist ?? []).filter(
    (item) => item?.type !== "background" && item?.role !== "background",
  );
  const queueIndex = Number(request.params.queueIndex);
  const item = Number.isInteger(queueIndex) ? queue[queueIndex] : null;
  if (!item || item.type !== "song") {
    response.status(400).json({ message: "当前播放项不是可刷新地址的歌曲" });
    return;
  }
  const expectedSource = String(request.body?.expectedSource ?? "").trim();
  const expectedSourceId = String(request.body?.expectedSourceId ?? "").trim();
  const expectedTitle = String(request.body?.expectedTitle ?? "").trim();
  const actualSource = String(item.source ?? "kugou").trim();
  const actualSourceId = String(item.sourceId ?? item.hash ?? "").trim();
  if (
    (expectedSource && expectedSource !== actualSource) ||
    (expectedSourceId && expectedSourceId !== actualSourceId) ||
    (!expectedSourceId && expectedTitle && expectedTitle !== item.title)
  ) {
    response.status(409).json({ message: "歌单已经更新，请同步最新节目后重试" });
    return;
  }

  try {
    const config = readConfig();
    const candidate = { ...item };
    delete candidate.audioUrl;
    delete candidate.url;
    const [resolved] = await resolvePlayableKugouSongs(
      config,
      [candidate],
      config.plugins.kugouMusic.quality,
      1,
    );
    if (!resolved?.audioUrl) {
      throw new Error(`${MUSIC_PROVIDER_LABELS[normalizeMusicProvider(item.source, "kugou")]}未返回可播放地址`);
    }
    response.json({
      audioUrl: resolved.audioUrl,
      source: resolved.source,
      sourceId: resolved.sourceId,
      title: item.title,
      message: "歌曲播放地址已刷新",
    });
  } catch (error) {
    response.status(502).json({
      message: "歌曲播放地址刷新失败，请检查音乐源登录态或歌曲权限",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/admin/login", (request, response) => {
  if (!adminPassword) {
    response.status(503).json({ message: "后台管理员密码未配置，请设置 AIRADIO_ADMIN_PASSWORD 环境变量" });
    return;
  }

  const username = String(request.body?.username ?? "").trim();
  const password = String(request.body?.password ?? "");

  if (username !== adminUsername || password !== adminPassword) {
    response.status(401).json({ message: "后台账号或密码错误" });
    return;
  }

  const session = createAdminSession(username);
  response.json({
    expiresAt: new Date(session.expiresAt).toISOString(),
    token: session.token,
    user: { username: session.username },
  });
});

app.get("/api/admin/session", requireAdmin, (request, response) => {
  response.json({
    ok: true,
    user: { username: request.adminSession.username },
  });
});

app.post("/api/admin/logout", requireAdmin, (request, response) => {
  adminSessions.delete(request.adminSession.token);
  response.json({ message: "已退出后台管理" });
});

app.get("/api/config", requireAdmin, (request, response) => {
  response.json({
    config: readConfig(),
    savedAt: readConfigSavedAt(),
  });
});

app.get("/api/system-settings", (request, response) => {
  response.json({ settings: readSystemSettings() });
});

app.put("/api/system-settings", requireAdmin, (request, response) => {
  const settings = saveSystemSettings(request.body?.settings ?? request.body ?? {});
  response.json({ settings, message: "系统设置已保存" });
});

app.post("/api/config", requireAdmin, (request, response) => {
  const config = mergeConfig(request.body?.config ?? request.body ?? {});
  const savedAt = upsertConfig(config);
  response.json({
    config,
    message: "配置已保存到后台数据库",
    savedAt,
  });
});

app.post("/api/config/:service/test", requireAdmin, async (request, response) => {
  const service = request.params.service;
  const incomingConfig = request.body?.config;
  const config = incomingConfig ?? readConfig()[service];

  if (!["llm", "tts", "suno"].includes(service) || !config) {
    response.status(404).json({ message: "未知服务" });
    return;
  }

  const missing = service === "tts"
    ? validateTtsConfig(config)
    : service === "suno"
      ? validateSunoConfig(config)
      : validateServiceConfig(config);
  if (service === "suno" && missing.length === 0) {
    try {
      const quota = await callSunoApi(config, "/api/get_limit");
      const resolvedModel = normalizeSunoModel(config.model) === "auto"
        ? sunoModelForQuota(quota)
        : normalizeSunoModel(config.model);
      response.json({
        ready: true,
        quota,
        resolvedModel,
        message: `本地 suno-api 连接成功${Number.isFinite(Number(quota?.credits_left)) ? `，剩余 ${quota.credits_left} Credits` : ""}，当前使用 ${resolvedModel === "chirp-fenix" ? "v5.5" : "v4.5"}`,
      });
      return;
    } catch (error) {
      response.status(502).json({
        ready: false,
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }
  response.json({
    ready: missing.length === 0,
    message: missing.length === 0 ? "配置已写入后台数据库，可用于生成流程" : `缺少 ${missing.join("、")}`,
  });
});

app.get("/api/programs", (request, response) => {
  response.json({ programs: readProgramList() });
});

app.get("/api/program-categories", (request, response) => {
  response.json({ categories: readCategories() });
});

app.get("/api/sound-effects", requireAdmin, (request, response) => {
  response.json({ categories: readSoundEffectCategories() });
});

app.get("/api/program-archives", requireAdmin, (request, response) => {
  response.json({ archives: readProgramArchives(), message: "节目归档已读取" });
});

app.post("/api/program-archives/sync", requireAdmin, (request, response) => {
  const archives = syncProgramArchives();
  response.json({ archives, message: "节目归档已同步" });
});

app.delete("/api/program-archives/by-date/:date", requireAdmin, (request, response) => {
  const archiveDate = normalizePublishDate(request.params.date);
  if (!archiveDate) {
    response.status(400).json({ message: "日期格式无效" });
    return;
  }
  const result = db.prepare("DELETE FROM program_archives WHERE archive_date = ?").run(archiveDate);
  response.json({
    archives: readProgramArchives(),
    message: `已清理 ${archiveDate} 的 ${result.changes ?? 0} 条归档节目`,
  });
});

app.delete("/api/program-archives/:id", requireAdmin, (request, response) => {
  const archive = db.prepare("SELECT id FROM program_archives WHERE id = ?").get(request.params.id);
  if (!archive) {
    response.status(404).json({ message: "归档节目不存在" });
    return;
  }

  db.prepare("DELETE FROM program_archives WHERE id = ?").run(request.params.id);
  response.json({ archives: readProgramArchives(), message: "归档节目已删除" });
});

app.post("/api/sound-effect-categories", requireAdmin, (request, response) => {
  const name = String(request.body?.name ?? "").trim();
  if (!name) {
    response.status(400).json({ message: "音效分类名称不能为空" });
    return;
  }

  const createdAt = nowIso();
  try {
    db.prepare(`
      INSERT INTO sound_effect_categories (id, name, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(randomUUID(), name, Number(request.body?.sortOrder ?? 999), createdAt, createdAt);
    response.json({ categories: readSoundEffectCategories(), message: "音效分类已新增" });
  } catch (error) {
    response.status(400).json({ message: `音效分类新增失败：${error instanceof Error ? error.message : String(error)}` });
  }
});

app.patch("/api/sound-effect-categories/:id", requireAdmin, (request, response) => {
  const name = String(request.body?.name ?? "").trim();
  if (!name) {
    response.status(400).json({ message: "音效分类名称不能为空" });
    return;
  }

  const existing = db.prepare("SELECT id FROM sound_effect_categories WHERE id = ?").get(request.params.id);
  if (!existing) {
    response.status(404).json({ message: "音效分类不存在" });
    return;
  }

  try {
    db.prepare("UPDATE sound_effect_categories SET name = ?, updated_at = ? WHERE id = ?").run(name, nowIso(), request.params.id);
    response.json({ categories: readSoundEffectCategories(), message: "音效分类已更新" });
  } catch (error) {
    response.status(400).json({ message: `音效分类更新失败：${error instanceof Error ? error.message : String(error)}` });
  }
});

app.delete("/api/sound-effect-categories/:id", requireAdmin, (request, response) => {
  const existing = db.prepare("SELECT id FROM sound_effect_categories WHERE id = ?").get(request.params.id);
  if (!existing) {
    response.status(404).json({ message: "音效分类不存在" });
    return;
  }

  const fallback = db
    .prepare("SELECT id FROM sound_effect_categories WHERE id <> ? ORDER BY COALESCE(sort_order, 999999), created_at LIMIT 1")
    .get(request.params.id);
  const effectCount = db.prepare("SELECT COUNT(*) AS total FROM sound_effects WHERE category_id = ?").get(request.params.id)?.total ?? 0;
  if (effectCount > 0 && !fallback) {
    response.status(400).json({ message: "请先删除分类下的音效，或先创建一个新的音效分类" });
    return;
  }

  const removeCategory = db.transaction(() => {
    if (fallback) {
      db.prepare("UPDATE sound_effects SET category_id = ?, updated_at = ? WHERE category_id = ?").run(fallback.id, nowIso(), request.params.id);
    }
    db.prepare("DELETE FROM sound_effect_categories WHERE id = ?").run(request.params.id);
  });
  removeCategory();
  response.json({ categories: readSoundEffectCategories(), message: "音效分类已删除" });
});

app.post("/api/sound-effects", requireAdmin, (request, response) => {
  const categoryId = String(request.body?.categoryId ?? "").trim();
  const name = String(request.body?.name ?? request.body?.fileName ?? "").trim();
  const dataUrl = String(request.body?.dataUrl ?? request.body?.audioData ?? "").trim();
  const category = db.prepare("SELECT id FROM sound_effect_categories WHERE id = ?").get(categoryId);
  if (!category) {
    response.status(400).json({ message: "请选择有效的音效分类" });
    return;
  }
  if (!name) {
    response.status(400).json({ message: "音效名称不能为空" });
    return;
  }
  if (!dataUrl) {
    response.status(400).json({ message: "缺少音效文件数据" });
    return;
  }

  try {
    const { buffer, mimeType } = parseAudioDataUrl(dataUrl);
    if (!buffer.length) {
      throw new Error("音效文件为空");
    }
    const extension = audioExtensionFromMime(mimeType, request.body?.fileName);
    const id = randomUUID();
    const fileName = `${id}-${safeFileStem(name)}.${extension}`;
    const audioPath = path.join(soundEffectsDir, fileName);
    fs.writeFileSync(audioPath, buffer);
    const createdAt = nowIso();
    db.prepare(`
      INSERT INTO sound_effects (
        id, category_id, name, file_name, audio_url, audio_path, mime_type, size_bytes, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      categoryId,
      name,
      fileName,
      `/storage/sound-effects/${fileName}`,
      audioPath,
      mimeType || audioMimeFromExtension(extension),
      buffer.length,
      createdAt,
      createdAt,
    );
    response.json({ categories: readSoundEffectCategories(), message: "音效已上传" });
  } catch (error) {
    response.status(400).json({ message: `音效上传失败：${error instanceof Error ? error.message : String(error)}` });
  }
});

app.delete("/api/sound-effects/:id", requireAdmin, (request, response) => {
  const existing = db.prepare("SELECT * FROM sound_effects WHERE id = ?").get(request.params.id);
  if (!existing) {
    response.status(404).json({ message: "音效不存在" });
    return;
  }

  db.prepare("DELETE FROM sound_effects WHERE id = ?").run(request.params.id);
  removeStoredFile(existing.audio_path, soundEffectsDir);
  response.json({ categories: readSoundEffectCategories(), message: "音效已删除" });
});

app.post("/api/program-categories", requireAdmin, (request, response) => {
  const name = String(request.body?.name ?? "").trim();
  if (!name) {
    response.status(400).json({ message: "分类名称不能为空" });
    return;
  }

  const createdAt = nowIso();
  const nextOrder = db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM program_categories").get()?.nextOrder ?? 1;
  try {
    db.prepare(`
      INSERT INTO program_categories (id, name, sort_order, created_at, updated_at)
      VALUES (@id, @name, @sortOrder, @createdAt, @updatedAt)
    `).run({
      id: randomUUID(),
      name,
      sortOrder: nextOrder,
      createdAt,
      updatedAt: createdAt,
    });
    response.json({ categories: readCategories(), message: "节目分类已新增" });
  } catch (error) {
    response.status(400).json({ message: "节目分类新增失败", error: error instanceof Error ? error.message : String(error) });
  }
});

app.patch("/api/program-categories/:id", requireAdmin, (request, response) => {
  const name = String(request.body?.name ?? "").trim();
  if (!name) {
    response.status(400).json({ message: "分类名称不能为空" });
    return;
  }
  const result = db.prepare("UPDATE program_categories SET name = ?, updated_at = ? WHERE id = ?").run(name, nowIso(), request.params.id);
  if (!result.changes) {
    response.status(404).json({ message: "节目分类不存在" });
    return;
  }
  response.json({ categories: readCategories(), message: "节目分类已更新" });
});

app.delete("/api/program-categories/:id", requireAdmin, (request, response) => {
  const category = db.prepare("SELECT * FROM program_categories WHERE id = ?").get(request.params.id);
  if (!category) {
    response.status(404).json({ message: "节目分类不存在" });
    return;
  }
  const fallbackId = db.prepare("SELECT id FROM program_categories WHERE id <> ? ORDER BY COALESCE(sort_order, 999999), created_at LIMIT 1").get(request.params.id)?.id ?? null;
  const removeCategory = db.transaction(() => {
    db.prepare("UPDATE programs SET category_id = ?, updated_at = ? WHERE category_id = ?").run(fallbackId, nowIso(), request.params.id);
    db.prepare("DELETE FROM program_categories WHERE id = ?").run(request.params.id);
  });
  removeCategory();
  response.json({ categories: readCategories(), message: "节目分类已删除" });
});

app.post("/api/programs/reorder", requireAdmin, (request, response) => {
  const ids = Array.isArray(request.body?.ids) ? request.body.ids.filter((id) => typeof id === "string") : [];
  if (!ids.length) {
    response.status(400).json({ message: "缺少节目排序 ID" });
    return;
  }

  const update = db.prepare("UPDATE programs SET sort_order = ?, updated_at = ? WHERE id = ?");
  const saveOrder = db.transaction(() => {
    ids.forEach((id, index) => update.run(index + 1, nowIso(), id));
  });
  saveOrder();

  response.json({ programs: readProgramList(), message: "节目排序已保存" });
});

app.post("/api/programs/publish-next-day", requireAdmin, (request, response) => {
  const ids = Array.isArray(request.body?.ids) ? request.body.ids.filter((id) => typeof id === "string") : [];
  const publishDate = String(request.body?.publishDate ?? "").trim() || localDateString();
  const publishedAt = nowIso();
  const orderedIds = ids.length
    ? ids
    : db
        .prepare(`
          SELECT id
          FROM programs
          ORDER BY
            CASE WHEN scheduled_at IS NULL OR scheduled_at = '' THEN 1 ELSE 0 END ASC,
            scheduled_at ASC,
            COALESCE(sort_order, 999999) ASC,
            created_at DESC
        `)
        .all()
        .map((row) => row.id);

  if (!orderedIds.length) {
    response.status(400).json({ message: "没有可发布的节目" });
    return;
  }

  const update = db.prepare("UPDATE programs SET publish_date = ?, published_at = ?, sort_order = ?, updated_at = ? WHERE id = ?");
  const publishPrograms = db.transaction(() => {
    orderedIds.forEach((id, index) => update.run(publishDate, publishedAt, index + 1, publishedAt, id));
  });
  publishPrograms();
  orderedIds.forEach((id) => {
    const program = readProgramById(id);
    if (program) {
      archiveProgram(program, publishDate);
    }
  });

  response.json({ programs: readProgramList(), publishDate, message: `${publishDate} 节目已发布` });
});

app.post("/api/programs/:id/push-home", requireAdmin, async (request, response) => {
  let existing = readProgramById(request.params.id);
  if (!existing) {
    response.status(404).json({ message: "节目不存在" });
    return;
  }

  try {
    if (Object.prototype.hasOwnProperty.call(request.body ?? {}, "script")) {
      const styledSegments = applyVoiceStylePrompt(
        request.body?.segments,
        request.body?.voicePrompt,
        readConfig().tts.defaultStylePrompt,
      );
      existing = updateProgramContent(existing.id, request.body?.script, styledSegments) ?? existing;
    }
    if (Object.prototype.hasOwnProperty.call(request.body ?? {}, "playbackSpeed")) {
      existing = updateProgram(existing.id, {
        playbackSpeed: normalizePlaybackSpeed(request.body?.playbackSpeed),
      }) ?? existing;
    }
    if (existing.status !== "ready" || !existing.audioUrl) {
      existing = await regenerateProgramAudio(existing.id, { voicePrompt: request.body?.voicePrompt });
    }
  } catch (error) {
    response.status(502).json({
      message: "最新节目内容保存成功，但重新配音失败",
      program: error?.program ?? readProgramById(request.params.id),
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const publishDate = String(existing.publishDate ?? request.body?.publishDate ?? "").trim() || localDateString();
  const publishedAt = nowIso();
  const restartPlaylist = Boolean(
    isFlowFillerProgram(existing) &&
    existing.playbackMode === "sequential" &&
    existing.restartFromBeginning,
  );
  db.prepare(`
    UPDATE programs
    SET publish_date = ?,
        published_at = ?,
        playback_reset_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(publishDate, publishedAt, restartPlaylist ? publishedAt : existing.playbackResetAt, publishedAt, existing.id);

  const program = readProgramById(existing.id);
  archiveProgram(program, publishDate);
  response.json({
    program,
    programs: readProgramList(),
    publishDate,
    resetPlayback: restartPlaylist,
    message: restartPlaylist
      ? `${program.title} 内容已更新并保持原排期，顺序歌单将从第一首开始播放`
      : `${program.title} 内容已更新并保持原播出时间与排序`,
  });
});

app.patch("/api/programs/:id", requireAdmin, (request, response) => {
  const existing = readProgramById(request.params.id);
  if (!existing) {
    response.status(404).json({ message: "节目不存在" });
    return;
  }

  const title = String(request.body?.title ?? existing.title).trim();
  if (!title) {
    response.status(400).json({ message: "节目名称不能为空" });
    return;
  }

  const categoryId = String(request.body?.categoryId ?? "").trim() || null;
  if (categoryId && !db.prepare("SELECT id FROM program_categories WHERE id = ?").get(categoryId)) {
    response.status(400).json({ message: "节目分类不存在" });
    return;
  }

  const scheduledAt = "scheduledAt" in (request.body ?? {}) ? String(request.body?.scheduledAt ?? "").trim() || null : existing.scheduledAt;
  const playbackSpeed = normalizePlaybackSpeed(request.body?.playbackSpeed ?? existing.playbackSpeed);

  db.prepare(`
    UPDATE programs
    SET title = @title,
        category_id = @categoryId,
        scheduled_at = @scheduledAt,
        playback_speed = @playbackSpeed,
        updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id: existing.id,
    title,
    categoryId: categoryId ?? existing.categoryId,
    scheduledAt,
    playbackSpeed,
    updatedAt: nowIso(),
  });

  const program = readProgramById(existing.id);
  archiveProgram(program);
  response.json({ message: "节目管理信息已保存", program });
});

app.post("/api/programs/:id/schedule", requireAdmin, (request, response) => {
  const scheduledAt = String(request.body?.scheduledAt ?? "").trim() || null;
  const row = db.prepare("SELECT * FROM programs WHERE id = ?").get(request.params.id);
  if (!row) {
    response.status(404).json({ message: "节目不存在" });
    return;
  }

  db.prepare("UPDATE programs SET scheduled_at = ?, updated_at = ? WHERE id = ?").run(scheduledAt, nowIso(), request.params.id);
  response.json({
    message: scheduledAt ? "定时播放时间已保存" : "已取消定时播放",
    program: readProgramById(request.params.id),
  });
});

app.post("/api/programs/:id/script", requireAdmin, (request, response) => {
  const program = updateProgramContent(request.params.id, request.body?.script, request.body?.segments);
  if (!program) {
    response.status(404).json({ message: "节目不存在" });
    return;
  }

  archiveProgram(program);
  response.json({ message: "节目文稿已保存，请重新生成语音", program });
});

app.post("/api/programs/:id/rewrite-script", requireAdmin, async (request, response) => {
  const config = readConfig();
  const existing = readProgramById(request.params.id);
  if (!existing) {
    response.status(404).json({ message: "节目不存在" });
    return;
  }

  try {
    const rewritten = await rewriteProgramScriptWithLlm(config.llm, existing);
    const program = updateProgramContent(existing.id, rewritten.script, rewritten.segments);
    response.json({ message: "节目文稿已由 AI 重新编排，请确认后重新生成语音", program });
  } catch (error) {
    response.status(502).json({
      message: "AI 重编节目文稿失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/programs/:id/regenerate-tts", requireAdmin, async (request, response) => {
  const existing = readProgramById(request.params.id);
  if (!existing) {
    response.status(404).json({ message: "节目不存在" });
    return;
  }

  try {
    const program = await regenerateProgramAudio(existing.id, { voicePrompt: request.body?.voicePrompt });
    response.json({ message: "语音已根据最新文稿重新生成", program });
  } catch (error) {
    response.status(502).json({
      message: "重新生成语音失败",
      program: error?.program ?? readProgramById(existing.id),
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.delete("/api/programs/by-date/:date", requireAdmin, (request, response) => {
  const date = normalizePublishDate(request.params.date);
  if (!date) {
    response.status(400).json({ message: "日期格式无效" });
    return;
  }
  const pluginId = String(request.query.pluginId ?? request.body?.pluginId ?? "").trim();
  const programs = readProgramList().filter((program) => {
    if (pluginId && program.pluginId !== pluginId) {
      return false;
    }
    return programBelongsToDate(program, date);
  });

  for (const program of programs) {
    deleteAudioFile(program);
    db.prepare("DELETE FROM programs WHERE id = ?").run(program.id);
  }

  response.json({
    message: `已清理 ${date} 的 ${programs.length} 条节目`,
    programs: readProgramList(),
  });
});

app.delete("/api/programs/:id", requireAdmin, (request, response) => {
  const existing = readProgramById(request.params.id);
  if (!existing) {
    response.status(404).json({ message: "节目不存在" });
    return;
  }

  deleteAudioFile(existing);
  db.prepare("DELETE FROM programs WHERE id = ?").run(request.params.id);
  response.json({ message: "节目已删除" });
});

app.get("/api/kugou/modules", requireAdmin, (request, response) => {
  response.json({
    modules: readKugouModules(),
    message: "KuGouMusicApi 模块列表已读取",
  });
});

app.post("/api/kugou/call/:name", requireAdmin, async (request, response) => {
  try {
    const result = await callKugouApi(request.params.name, request.body?.params ?? request.body ?? {});
    if (result.cookie) {
      saveKugouCookie(result.cookie);
    }
    response.json({
      body: result.body,
      cookie: result.cookie,
      message: `KuGouMusicApi.${request.params.name} 调用完成`,
    });
  } catch (error) {
    response.status(502).json({
      message: "KuGouMusicApi 调用失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/music/call/:provider/:name", requireAdmin, async (request, response) => {
  const provider = normalizeMusicProvider(request.params.provider, "kugou");
  const params = request.body?.params ?? request.body ?? {};
  try {
    const result = provider === "netease"
      ? await callNeteaseApi(request.params.name, params)
      : provider === "qq"
        ? await callQQMusicApi(request.params.name, params)
        : await callKugouApi(request.params.name, params);
    if (result.cookie) {
      saveMusicProviderCookie(provider, result.cookie);
    }
    response.json({
      body: result.body,
      cookie: result.cookie,
      message: `${MUSIC_PROVIDER_LABELS[provider]} API 调用完成`,
    });
  } catch (error) {
    response.status(502).json({
      message: `${MUSIC_PROVIDER_LABELS[provider]} API 调用失败`,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/plugins/kugou/status", requireAdmin, (request, response) => {
  try {
    const config = readConfig();
    const cookie = mergeCookieValues(config.plugins.kugouMusic.cookie);
    const modules = readKugouModules();
    response.json({
      loggedIn: Boolean(cookie.token && cookie.userid),
      moduleCount: modules.length,
      userId: cookie.userid ?? "",
      message: cookie.token && cookie.userid ? "酷狗登录态已保存" : "酷狗尚未扫码登录",
    });
  } catch (error) {
    response.status(500).json({
      loggedIn: false,
      message: "酷狗状态读取失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/plugins/kugou/login/qr", requireAdmin, async (request, response) => {
  try {
    const keyResult = await callKugouApi("login_qr_key", { type: request.body?.type ?? "web" });
    const key = extractKugouQrKey(keyResult.body);
    if (!key) {
      throw new Error("酷狗未返回二维码 key");
    }
    const qrResult = await callKugouApi("login_qr_create", { key, qrimg: 1 }, { useStoredCookie: false });
    const body = responseBody(qrResult.body);
    response.json({
      key,
      qrImage: body?.data?.base64 ?? "",
      qrUrl: body?.data?.url ?? "",
      message: "酷狗扫码二维码已生成",
    });
  } catch (error) {
    response.status(502).json({
      message: "酷狗二维码生成失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/plugins/kugou/login/check", requireAdmin, async (request, response) => {
  const key = String(request.body?.key ?? "").trim();
  if (!key) {
    response.status(400).json({ message: "缺少二维码 key" });
    return;
  }

  try {
    const result = await callKugouApi("login_qr_check", { key });
    const status = extractKugouQrStatus(result.body);
    let cookie = result.cookie;
    if (status.status === 4 && cookie) {
      try {
        const refreshed = await callKugouApi("login_token", { cookie }, { useStoredCookie: false });
        cookie = refreshed.cookie || cookie;
      } catch {
        // The QR token is still useful even when token refresh is temporarily unavailable.
      }
      const saved = saveKugouCookie(cookie);
      response.json({
        ...status,
        cookie,
        config: saved.config,
        savedAt: saved.savedAt,
      });
      return;
    }

    response.json({
      ...status,
      cookie,
    });
  } catch (error) {
    response.status(502).json({
      message: "酷狗扫码状态检查失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/plugins/music/:provider/login/qr", requireAdmin, async (request, response) => {
  const provider = normalizeMusicProvider(request.params.provider, "");
  if (!['netease', 'qq'].includes(provider)) {
    response.status(400).json({ message: "该音乐源不支持此扫码入口" });
    return;
  }
  try {
    if (provider === "qq") {
      const loginType = request.body?.type === "qq" ? "qq" : "wx";
      const qr = await createQQLoginQr(loginType);
      response.json({
        ...qr,
        message: loginType === "wx"
          ? "QQ 音乐微信二维码已生成，请使用微信扫码并确认"
          : "QQ 音乐 QQ 二维码已生成，请使用 QQ App 内置扫一扫并确认",
      });
      return;
    }
    const keyResult = await callNeteaseApi("login_qr_key", {}, { useStoredCookie: false });
    const key = String(keyResult.body?.data?.unikey ?? keyResult.body?.unikey ?? "").trim();
    if (!key) {
      throw new Error("网易云音乐未返回二维码 key");
    }
    const qrResult = await callNeteaseApi("login_qr_create", { key, qrimg: 1 }, { useStoredCookie: false });
    const data = qrResult.body?.data ?? qrResult.body ?? {};
    response.json({
      key,
      qrImage: String(data.qrimg ?? ""),
      qrUrl: String(data.qrurl ?? ""),
      message: "网易云音乐扫码二维码已生成，请使用网易云音乐 App 扫码",
    });
  } catch (error) {
    response.status(502).json({
      message: `${MUSIC_PROVIDER_LABELS[provider]}二维码生成失败`,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/plugins/music/:provider/login/check", requireAdmin, async (request, response) => {
  const provider = normalizeMusicProvider(request.params.provider, "");
  const key = String(request.body?.key ?? "").trim();
  if (!['netease', 'qq'].includes(provider) || !key) {
    response.status(400).json({ message: "音乐源或二维码 key 无效" });
    return;
  }
  try {
    let status;
    if (provider === "qq") {
      status = await checkQQLoginQr(key);
    } else {
      const result = await callNeteaseApi("login_qr_check", { key }, { useStoredCookie: false });
      const code = Number(result.body?.code ?? 0);
      const mapped = {
        800: { status: 0, message: "网易云音乐二维码已过期" },
        801: { status: 1, message: "等待使用网易云音乐 App 扫码" },
        802: { status: 2, message: "已扫码，等待手机确认" },
        803: { status: 4, message: "网易云音乐登录成功，Cookie 已自动填入并保存" },
      };
      status = {
        ...(mapped[code] ?? { status: 1, message: result.body?.message || `网易云登录状态 ${code}` }),
        cookie: result.body?.cookie || result.cookie,
      };
    }
    if (status.status === 4 && status.cookie) {
      const saved = saveMusicProviderCookie(provider, status.cookie);
      response.json({
        ...status,
        config: saved.config,
        savedAt: saved.savedAt,
      });
      return;
    }
    response.json(status);
  } catch (error) {
    response.status(502).json({
      message: `${MUSIC_PROVIDER_LABELS[provider]}扫码状态检查失败`,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/plugins/kugou/search", requireAdmin, async (request, response) => {
  const config = readConfig();
  const keywords = String(request.body?.keywords ?? config.plugins.kugouMusic.searchKeywords ?? "").trim();
  if (!keywords) {
    response.status(400).json({ message: "请输入酷狗搜索关键词" });
    return;
  }

  try {
    const result = await callKugouApi("search", {
      keywords,
      page: Number(request.body?.page ?? 1),
      pagesize: Number(request.body?.limit ?? 10),
    }, { config });
    if (result.cookie) {
      saveKugouCookie(result.cookie);
    }
    const songs = dedupeKugouSongs(collectKugouSongCandidates(result.body).map(normalizeKugouSong)).slice(0, Number(request.body?.limit ?? 10));
    response.json({
      songs,
      message: songs.length ? "酷狗搜索完成" : "酷狗搜索未返回歌曲",
    });
  } catch (error) {
    response.status(502).json({
      message: "酷狗搜索失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/plugins/music/status", requireAdmin, (request, response) => {
  const config = readConfig();
  const sources = [
    { id: "kugou", config: config.plugins.kugouMusic, load: loadKugouApi },
    { id: "netease", config: config.plugins.neteaseMusic, load: loadNeteaseApi },
    { id: "qq", config: config.plugins.qqMusic, load: loadQQMusicApi },
  ].map((source) => {
    try {
      source.load();
      return {
        id: source.id,
        name: MUSIC_PROVIDER_LABELS[source.id],
        enabled: source.id === "kugou" ? source.config?.apiEnabled !== false : source.config?.enabled !== false,
        installed: true,
        authenticated: Boolean(String(source.config?.cookie ?? "").trim()),
        message: (source.id === "kugou" ? source.config?.apiEnabled === false : source.config?.enabled === false) ? "已停用" : "本地 API 已加载",
      };
    } catch (error) {
      return {
        id: source.id,
        name: MUSIC_PROVIDER_LABELS[source.id],
        enabled: source.id === "kugou" ? source.config?.apiEnabled !== false : source.config?.enabled !== false,
        installed: false,
        authenticated: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
  response.json({
    provider: normalizeMusicProvider(config.plugins.kugouMusic.provider),
    sources,
    message: `${sources.filter((source) => source.installed && source.enabled).length} 个音乐 API 可用`,
  });
});

app.post("/api/plugins/music/search", requireAdmin, async (request, response) => {
  const config = readConfig();
  const keywords = String(request.body?.keywords ?? config.plugins.kugouMusic.searchKeywords ?? "").trim();
  const provider = normalizeMusicProvider(request.body?.provider ?? config.plugins.kugouMusic.provider);
  const limit = Math.max(1, Math.min(100, Number(request.body?.limit ?? 20)));
  if (!keywords) {
    response.status(400).json({ message: "请输入歌曲或歌手关键词" });
    return;
  }
  try {
    const result = await searchMusicSources(config, provider, keywords, limit);
    if (!result.songs.length && result.errors.length) {
      throw new Error(result.errors.join("；"));
    }
    response.json({
      errors: result.errors,
      provider,
      providers: result.providers,
      songs: result.songs,
      message: result.songs.length
        ? `已从 ${[...new Set(result.songs.map((song) => MUSIC_PROVIDER_LABELS[song.source]))].filter(Boolean).join("、")} 找到 ${result.songs.length} 首歌曲`
        : "音乐搜索未返回歌曲",
    });
  } catch (error) {
    response.status(502).json({
      message: "多音乐源搜索失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/plugins/kugou/ai-hot-songs", requireAdmin, async (request, response) => {
  const config = readConfig();
  const provider = normalizeMusicProvider(request.body?.provider ?? config.plugins.kugouMusic.provider);
  const requestedLimit = Number(request.body?.limit ?? AI_HOT_SONG_TARGET);
  const targetCount = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(AI_HOT_SONG_MAX, requestedLimit))
    : AI_HOT_SONG_TARGET;
  const prompt = String(request.body?.prompt ?? DEFAULT_AI_HOT_SONG_PROMPT).trim() || DEFAULT_AI_HOT_SONG_PROMPT;
  if (!config.plugins.kugouMusic.enabled) {
    response.status(400).json({ message: "音乐连播插件未启用，无法解析歌曲播放地址" });
    return;
  }

  try {
    const candidates = await generateAiHotSongCandidates(config.llm, targetCount, prompt);
    const shouldResolvePlayable = request.body?.resolve === true;
    const songs = shouldResolvePlayable
      ? await resolveAiGeneratedHotSongs(config, candidates, targetCount, provider)
      : candidates.map((song) => ({
          artist: song.artist || "音乐人",
          duration: 240,
          title: song.title,
        }));
    if (shouldResolvePlayable && config.plugins.kugouMusic.cookie) {
      saveKugouCookie(config.plugins.kugouMusic.cookie);
    }
    response.json({
      candidates,
      provider,
      prompt,
      songs,
      message: shouldResolvePlayable
        ? `AI 已生成 ${candidates.length} 首歌曲候选，解析到 ${songs.length} 首可播放歌曲`
        : `AI 已生成 ${songs.length} 首歌曲，保存并应用时会解析播放地址`,
    });
  } catch (error) {
    response.status(502).json({
      message: "AI 热门歌曲列表生成失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

async function handleMusicProgramGenerate(request, response) {
  const config = readConfig();
  try {
    const { program, ttsErrors } = await buildKugouProgram(config, {
      categoryId: request.body?.categoryId,
      playbackSpeed: request.body?.playbackSpeed,
      plugin: request.body?.plugin,
      publishDate: request.body?.publishDate,
      scheduledAt: request.body?.scheduledAt,
      songs: request.body?.songs,
      title: request.body?.title,
      voicePrompt: request.body?.voicePrompt,
    });
    response.json({
      program,
      message: ttsErrors.length ? "音乐联播节目已生成，部分串场语音失败，歌曲可继续联播" : "音乐联播节目已生成",
    });
  } catch (error) {
    response.status(502).json({
      message: "音乐联播节目生成失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

app.post("/api/plugins/music/generate", requireAdmin, handleMusicProgramGenerate);
app.post("/api/plugins/kugou/generate", requireAdmin, handleMusicProgramGenerate);

app.post("/api/plugins/daily-briefing/generate", requireAdmin, async (request, response) => {
  const config = readConfig();
  const plugin = config.plugins.dailyBriefing;

  if (!plugin.enabled) {
    response.status(400).json({ message: "每日早报插件未启用" });
    return;
  }
  if (!String(plugin.token ?? "").trim()) {
    response.status(400).json({ message: "每日早报插件缺少 ALAPI Token" });
    return;
  }

  const host = hostProfiles.find((item) => item.id === plugin.hostId) ?? hostProfiles[0];
  const playbackSpeed = normalizePlaybackSpeed(request.body?.playbackSpeed ?? plugin.playbackSpeed ?? 1);
  const categoryId = String(request.body?.categoryId ?? "").trim() || defaultCategoryIdForName("常规节目");
  const publishDate = normalizePublishDate(request.body?.publishDate);
  const scheduledAt = normalizeScheduledAt(request.body?.scheduledAt);
  const id = randomUUID();
  const createdAt = nowIso();

  try {
    const alapiResponse = await fetch(buildAlapiUrl(plugin));
    if (!alapiResponse.ok) {
      throw new Error(`ALAPI 请求失败：${await readError(alapiResponse)}`);
    }

    const payload = await alapiResponse.json();
    if (payload?.code && Number(payload.code) !== 200) {
      throw new Error(payload.msg ?? payload.message ?? "ALAPI 返回异常");
    }

    const briefing = parseDailyBriefingPayload(payload, Number(plugin.maxItems ?? 12));
    const segments = applyVoiceStylePrompt(
      await editDailyBriefingWithLlm(config.llm, briefing, host, { publishDate, scheduledAt }),
      request.body?.voicePrompt,
      config.tts.defaultStylePrompt,
    );
    const script = segments.map((segment) => segment.text).join("\n\n");
    const title = `${String(request.body?.title ?? plugin.name ?? "每日早报").trim() || "每日早报"} · ${briefing.date}`;

    insertProgram({
      id,
      title,
      host: host.name,
      prompt: "ALAPI 每日早报插件采集",
      script,
      segmentsJson: JSON.stringify(segments),
      status: "script_saved",
      audioUrl: null,
      audioPath: null,
      sortOrder: nextProgramSortOrder(),
      scheduledAt,
      sourceType: "plugin",
      pluginId: "daily-briefing",
      categoryId,
      playbackSpeed,
      publishDate,
      publishedAt: publishDate ? createdAt : null,
      llmModel: "ALAPI",
      ttsModel: config.tts.model,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt,
    });
    archiveProgram(readProgramById(id));

    try {
      const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, script, id, segments);
      const nextSegments = synthesizedSegments(segments, audio);
      const backgroundPlaylist = buildConfiguredBackgroundPlaylist("daily-briefing", config);
      const program = updateProgram(id, {
        status: "ready",
        audioUrl: audio.audioUrl,
        audioPath: audio.audioPath,
        playlistJson: JSON.stringify(backgroundPlaylist),
        segmentsJson: JSON.stringify(nextSegments),
        errorMessage: null,
      });
      archiveProgram(program);
      response.json({ program, message: "每日早报已采集并生成语音" });
    } catch (error) {
      const program = updateProgram(id, {
        status: "script_saved",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      archiveProgram(program);
      response.status(502).json({
        program,
        message: "每日早报已入库，但语音合成失败",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    response.status(502).json({
      message: "每日早报采集失败，未写入节目记录",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/plugins/hot-topics/generate", requireAdmin, async (request, response) => {
  const config = readConfig();
  const plugin = config.plugins.hotTopics;

  if (!plugin.enabled) {
    response.status(400).json({ message: "今日热榜插件未启用" });
    return;
  }
  if (!String(plugin.token ?? "").trim()) {
    response.status(400).json({ message: "今日热榜插件缺少 ALAPI Token" });
    return;
  }

  const host = hostProfiles.find((item) => item.id === plugin.hostId) ?? hostProfiles[0];
  const playbackSpeed = normalizePlaybackSpeed(request.body?.playbackSpeed ?? plugin.playbackSpeed ?? 1);
  const categoryId = String(request.body?.categoryId ?? "").trim() || defaultCategoryIdForName("常规节目");
  const publishDate = normalizePublishDate(request.body?.publishDate);
  const scheduledAt = normalizeScheduledAt(request.body?.scheduledAt);
  const id = randomUUID();
  const createdAt = nowIso();

  try {
    const alapiResponse = await fetch(normalizeHotTopicEndpoint(plugin), {
      method: "POST",
      headers: alapiV3Headers(plugin),
      body: JSON.stringify({
        type: String(plugin.type ?? "weibo").trim() || "weibo",
      }),
    });
    if (!alapiResponse.ok) {
      throw new Error(`ALAPI 热榜请求失败：${await readError(alapiResponse)}`);
    }

    const payload = await alapiResponse.json();
    if (payload?.code && Number(payload.code) !== 200) {
      throw new Error(payload.msg ?? payload.message ?? "ALAPI 今日热榜返回异常");
    }

    const hotTopics = parseHotTopicsPayload(payload, Number(plugin.maxItems ?? 10));
    const segments = applyVoiceStylePrompt(
      await editHotTopicsWithLlm(config.llm, hotTopics, host, { publishDate, scheduledAt }),
      request.body?.voicePrompt,
      config.tts.defaultStylePrompt,
    );
    const script = segments.map((segment) => segment.text).join("\n\n");
    const title = `${String(request.body?.title ?? plugin.name ?? "今日热榜").trim() || "今日热榜"} · ${hotTopics.name}`;

    insertProgram({
      id,
      title,
      host: host.name,
      prompt: `ALAPI 今日热榜插件采集：${hotTopics.name}`,
      script,
      segmentsJson: JSON.stringify(segments),
      status: "script_saved",
      audioUrl: null,
      audioPath: null,
      sortOrder: nextProgramSortOrder(),
      scheduledAt,
      sourceType: "plugin",
      pluginId: "hot-topics",
      categoryId,
      playbackSpeed,
      publishDate,
      publishedAt: publishDate ? createdAt : null,
      llmModel: "ALAPI",
      ttsModel: config.tts.model,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt,
    });
    archiveProgram(readProgramById(id));

    try {
      const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, script, id, segments);
      const nextSegments = synthesizedSegments(segments, audio);
      const backgroundPlaylist = buildConfiguredBackgroundPlaylist("hot-topics", config);
      const program = updateProgram(id, {
        status: "ready",
        audioUrl: audio.audioUrl,
        audioPath: audio.audioPath,
        playlistJson: JSON.stringify(backgroundPlaylist),
        segmentsJson: JSON.stringify(nextSegments),
        errorMessage: null,
      });
      archiveProgram(program);
      response.json({ program, message: "今日热榜已采集并生成语音" });
    } catch (error) {
      const program = updateProgram(id, {
        status: "script_saved",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      archiveProgram(program);
      response.status(502).json({
        program,
        message: "今日热榜已入库，但语音合成失败",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    response.status(502).json({
      message: "今日热榜采集失败，未写入节目记录",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/media-programs/probe", requireAdmin, async (request, response) => {
  try {
    const probe = await probeRemoteMedia(request.body?.mediaUrl, { siteCookie: request.body?.siteCookie });
    response.json({
      probe: publicMediaProbe(probe),
      message: `${probe.resolver === "direct" ? "已检测到" : `已通过 ${probe.resolver.startsWith("yt-dlp:") ? "yt-dlp" : "Bilibili 页面解析"}找到`} ${probe.codec} 音轨${probe.duration ? `，时长约 ${Math.round(probe.duration / 60)} 分钟` : ""}`,
    });
  } catch (error) {
    response.status(400).json({
      message: "媒体链接检测失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

async function generateMediaProgramRecord(input, options = {}) {
  const config = readConfig();
  const probe = await probeRemoteMedia(input?.mediaUrl, { siteCookie: input?.siteCookie });
  const title = String(input?.title ?? "").trim() || String(probe.title ?? "").trim() || "网络媒体节目";
  const creator = String(input?.creator ?? "").trim() || String(probe.creator ?? "").trim();
  const introMode = ["ai", "direct"].includes(String(input?.introMode)) ? String(input.introMode) : "none";
  const requestedDuration = clampNumber(input?.durationMinutes, 0.5, 360, 30) * 60;
  const duration = Math.max(1, Math.round(probe.duration > 0 ? Math.min(probe.duration, requestedDuration) : requestedDuration));
  const localCopy = probe.resolver !== "direct" || input?.localCopy !== false;
  const selectedHosts = normalizeHosts(input?.hosts ?? input?.host);
  const selectedHost = selectedHosts[0] ?? hostProfiles[0];
  const playbackSpeed = normalizePlaybackSpeed(input?.playbackSpeed ?? config.tts.speed);
  const publishDate = normalizePublishDate(input?.publishDate);
  const scheduledAt = normalizeScheduledAt(input?.scheduledAt);
  const categoryId = String(input?.categoryId ?? "").trim() || defaultCategoryIdForName("音乐专题");
  const id = String(options.id ?? "").trim() || randomUUID();
  const createdAt = options.createdAt ?? nowIso();

  let script = "";
  if (introMode === "ai") {
    script = await generateMediaIntroduction(config.llm, {
      creator,
      prompt: String(input?.introPrompt ?? "").trim(),
      title,
    });
  } else if (introMode === "direct") {
    script = String(input?.introText ?? "").trim();
    if (!script) {
      throw new Error("原文介绍模式需要填写介绍词");
    }
  }

  const mediaAudio = localCopy
    ? await storeRemoteMediaAudio(probe, id, duration)
    : { audioPath: null, audioUrl: probe.mediaUrl };
  const playlist = [];
  const segments = script ? applyVoiceStylePrompt([{
    hostId: selectedHost.id,
    hostName: selectedHost.name,
    style: String(input?.voicePrompt ?? config.tts.defaultStylePrompt ?? selectedHost.tone).trim(),
    text: script,
  }], input?.voicePrompt, config.tts.defaultStylePrompt) : [];
  let ttsError = "";
  if (script) {
    try {
      const narration = await synthesizeSpeech(
        { ...config.tts, speed: playbackSpeed },
        script,
        `${id}-intro`,
        segments,
      );
      playlist.push({
        type: "talk",
        title: `${selectedHost.name}介绍`,
        host: selectedHost.name,
        text: script,
        audioUrl: narration.audioUrl,
        audioPath: narration.audioPath,
        duration: talkedSegmentDuration(narration, segments[0]),
      });
    } catch (error) {
      ttsError = error instanceof Error ? error.message : String(error);
    }
  }
  playlist.push({
    type: "song",
    title,
    artist: creator || "网络媒体",
    audioUrl: mediaAudio.audioUrl,
    audioPath: mediaAudio.audioPath,
    duration,
    source: "remote-media",
    sourceId: createHash("sha256").update(probe.originalUrl).digest("hex").slice(0, 24),
    originalUrl: probe.originalUrl,
  });
  const firstAudio = playlist.find((item) => item.audioUrl);
  const record = {
    id,
    title,
    host: script ? selectedHost.name : (creator || "网络媒体"),
    prompt: `网络媒体：${probe.originalUrl}${creator ? ` · 来源：${creator}` : ""}`,
    script,
    segmentsJson: JSON.stringify(segments),
    playlistJson: JSON.stringify(playlist),
    status: "ready",
    audioUrl: firstAudio?.audioUrl ?? mediaAudio.audioUrl,
    audioPath: firstAudio?.audioPath ?? mediaAudio.audioPath,
    sortOrder: options.sortOrder ?? nextProgramSortOrder(),
    scheduledAt,
    sourceType: "media-link",
    pluginId: "remote-media",
    categoryId,
    playbackSpeed,
    publishDate,
    publishedAt: publishDate ? createdAt : null,
    llmModel: introMode === "ai" ? config.llm.model : introMode === "direct" ? "原文介绍" : null,
    ttsModel: script ? config.tts.model : null,
    errorMessage: ttsError ? `介绍词已保存，但配音失败：${ttsError}` : null,
    createdAt,
    updatedAt: nowIso(),
  };
  if (options.updateExisting) {
    updateProgram(id, record);
  } else {
    insertProgram(record);
  }
  const program = readProgramById(id);
  archiveProgram(program);
  return {
    probe: publicMediaProbe(probe),
    program,
    message: ttsError
      ? `媒体节目已生成，介绍词配音失败，播放时将直接进入媒体内容：${ttsError}`
      : `媒体节目《${title}》已生成${localCopy ? "，音轨已保存到本地" : "，将使用原始链接播放"}`,
  };
}

const mediaProgramBackgroundJobs = new Set();

function createPendingMediaProgram(input) {
  const mediaUrl = String(input?.mediaUrl ?? "").trim();
  let parsed;
  try {
    parsed = new URL(mediaUrl);
  } catch {
    throw new Error("请输入有效的 HTTP 或 HTTPS 媒体页面地址");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("媒体地址只支持 HTTP 或 HTTPS");
  }
  const introMode = ["ai", "direct"].includes(String(input?.introMode)) ? String(input.introMode) : "none";
  if (introMode === "direct" && !String(input?.introText ?? "").trim()) {
    throw new Error("原文介绍模式需要填写介绍词");
  }
  const config = readConfig();
  const selectedHost = normalizeHosts(input?.hosts ?? input?.host)[0] ?? hostProfiles[0];
  const publishDate = normalizePublishDate(input?.publishDate);
  const createdAt = nowIso();
  const id = randomUUID();
  const title = String(input?.title ?? "").trim() || "网络媒体节目（后台生成中）";
  const sortOrder = nextProgramSortOrder();
  insertProgram({
    id,
    title,
    host: selectedHost.name,
    prompt: `网络媒体后台任务：${mediaUrl}`,
    script: introMode === "direct" ? String(input.introText).trim() : "",
    segmentsJson: "[]",
    playlistJson: "[]",
    status: "generating",
    audioUrl: null,
    audioPath: null,
    sortOrder,
    scheduledAt: normalizeScheduledAt(input?.scheduledAt),
    sourceType: "media-link",
    pluginId: "remote-media",
    categoryId: String(input?.categoryId ?? "").trim() || defaultCategoryIdForName("音乐专题"),
    playbackSpeed: normalizePlaybackSpeed(input?.playbackSpeed ?? config.tts.speed),
    publishDate,
    publishedAt: publishDate ? createdAt : null,
    llmModel: introMode === "ai" ? config.llm.model : introMode === "direct" ? "原文介绍" : null,
    ttsModel: introMode === "none" ? null : config.tts.model,
    errorMessage: "后台正在解析媒体页面并提取音轨",
    createdAt,
    updatedAt: createdAt,
  });
  return { createdAt, id, sortOrder };
}

function runMediaProgramInBackground(input, pending) {
  mediaProgramBackgroundJobs.add(pending.id);
  void generateMediaProgramRecord(input, {
    createdAt: pending.createdAt,
    id: pending.id,
    sortOrder: pending.sortOrder,
    updateExisting: true,
  }).catch((error) => {
    updateProgram(pending.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }).finally(() => {
    mediaProgramBackgroundJobs.delete(pending.id);
  });
}

app.post("/api/media-programs/generate", requireAdmin, async (request, response) => {
  try {
    const result = await generateMediaProgramRecord(request.body);
    response.json({ ...result, programs: readProgramList() });
  } catch (error) {
    response.status(502).json({
      message: "网络媒体节目生成失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/media-programs/generate-background", requireAdmin, (request, response) => {
  try {
    const pending = createPendingMediaProgram(request.body);
    const program = readProgramById(pending.id);
    runMediaProgramInBackground({ ...request.body, siteCookie: String(request.body?.siteCookie ?? "") }, pending);
    response.status(202).json({
      jobId: pending.id,
      program,
      programs: readProgramList(),
      message: `节目《${program.title}》已保存，正在后台解析和生成，可离开本页面`,
    });
  } catch (error) {
    response.status(400).json({
      message: "网络媒体后台任务保存失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/media-programs/jobs/:id", requireAdmin, (request, response) => {
  const program = readProgramById(request.params.id);
  if (!program || program.pluginId !== "remote-media") {
    response.status(404).json({ message: "网络媒体后台任务不存在" });
    return;
  }
  response.json({
    active: mediaProgramBackgroundJobs.has(program.id),
    program,
    message: program.status === "ready"
      ? "网络媒体节目后台生成完成"
      : program.status === "failed"
        ? `网络媒体节目后台生成失败：${program.errorMessage || "未知错误"}`
        : "网络媒体节目正在后台生成",
  });
});

app.post("/api/programs/generate", requireAdmin, async (request, response) => {
  const config = readConfig();
  const contentMode = request.body?.contentMode === "direct" ? "direct" : "ai";
  const requestedContent = String(request.body?.prompt ?? "").trim();
  if (contentMode === "direct" && !requestedContent) {
    response.status(400).json({ message: "原文直出配音需要填写完整原文" });
    return;
  }
  const prompt = requestedContent || config.suno.defaultPrompt || "星夜、城市、柔和人声、治愈氛围";
  const title = String(request.body?.title ?? "").trim() || `星声节目 ${new Date().toLocaleString("zh-CN", { hour12: false })}`;
  const selectedHosts = normalizeHosts(request.body?.hosts ?? request.body?.host);
  const categoryId = String(request.body?.categoryId ?? "").trim() || defaultCategoryIdForName("常规节目");
  const playbackSpeed = normalizePlaybackSpeed(request.body?.playbackSpeed ?? config.tts.speed);
  const publishDate = normalizePublishDate(request.body?.publishDate);
  const scheduledAt = normalizeScheduledAt(request.body?.scheduledAt);
  const host = selectedHosts.map((item) => item.name).join(" / ");
  const id = randomUUID();
  const createdAt = nowIso();

  try {
    const generated = contentMode === "direct"
      ? directScriptPayload(prompt, selectedHosts)
      : await generateScript(config.llm, { hosts: selectedHosts, prompt, publishDate, scheduledAt, title });
    const segments = applyVoiceStylePrompt(generated.segments, request.body?.voicePrompt, config.tts.defaultStylePrompt);
    const script = segments.map((segment) => segment.text).join("\n\n") || generated.script;
    insertProgram({
      id,
      title,
      host,
      prompt,
      script,
      segmentsJson: JSON.stringify(segments),
      status: "script_saved",
      audioUrl: null,
      audioPath: null,
      sortOrder: nextProgramSortOrder(),
      scheduledAt,
      sourceType: "generated",
      pluginId: null,
      categoryId,
      playbackSpeed,
      publishDate,
      publishedAt: publishDate ? createdAt : null,
      llmModel: contentMode === "direct" ? "原文直出" : config.llm.model,
      ttsModel: config.tts.model,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt,
    });
    archiveProgram(readProgramById(id));

    try {
      const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, script, id, segments);
      const nextSegments = synthesizedSegments(segments, audio);
      const program = updateProgram(id, {
        status: "ready",
        audioUrl: audio.audioUrl,
        audioPath: audio.audioPath,
        segmentsJson: JSON.stringify(nextSegments),
        errorMessage: null,
      });
      archiveProgram(program);

      response.json({
        program,
        message: contentMode === "direct" ? "原文已入库，配音已生成" : "节目文案已入库，语音已生成",
      });
    } catch (error) {
      const program = updateProgram(id, {
        status: "script_saved",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      archiveProgram(program);

      response.status(502).json({
        program,
        message: contentMode === "direct" ? "原文已入库，但语音合成失败" : "文案已入库，但语音合成失败",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    response.status(502).json({
      message: contentMode === "direct" ? "原文处理失败，未写入节目记录" : "节目文案生成失败，未写入节目记录",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/suno/plan", requireAdmin, async (request, response) => {
  try {
    const config = readConfig();
    const plan = await generateAiMusicPlan(config, request.body ?? {});
    response.json({ plan, message: "大模型已生成并填入 Suno 歌曲方案" });
  } catch (error) {
    response.status(502).json({
      message: "AI 音乐方案生成失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/suno/generate", requireAdmin, async (request, response) => {
  const config = readConfig();
  const missing = validateSunoConfig(config.suno);
  if (missing.length) {
    response.status(400).json({ message: `Suno 配置缺少：${missing.join("、")}` });
    return;
  }
  if (!config.suno.enabled) {
    response.status(400).json({ message: "Suno 本地 API 当前未启用" });
    return;
  }

  try {
    const mode = request.body?.mode === "manual" ? "manual" : "auto";
    const quantity = mode === "auto" ? Math.round(clampNumber(request.body?.quantity, 1, 5, 1)) : 1;
    const requestedGender = normalizeVoiceGender(request.body?.voiceGender);
    const plans = [];
    if (mode === "auto") {
      for (let index = 0; index < quantity; index += 1) {
        plans.push(await generateAiMusicPlan(config, {
          ...request.body,
          brief: "",
          instrumental: false,
          style: "",
          title: "",
          variationNonce: `${Date.now()}-${index + 1}-${randomUUID()}`,
          voiceGender: requestedGender,
        }));
      }
    } else {
      plans.push({
          title: String(request.body?.title ?? "AI原创音乐").trim() || "AI原创音乐",
          style: String(request.body?.style ?? config.suno.style ?? "").trim(),
          lyrics: String(request.body?.lyrics ?? "").trim(),
          negativeTags: "",
          voiceGender: requestedGender === "random" ? (Math.random() < 0.5 ? "female" : "male") : requestedGender,
      });
    }
    for (const plan of plans) {
      if (!plan.style) {
        throw new Error("请填写 Suno Styles");
      }
      if (!plan.lyrics) {
        throw new Error("请填写 Suno Lyrics");
      }
      plan.style = styleWithVoiceGender(plan.style, plan.voiceGender);
    }

    const resolvedModel = await resolveSunoModel(config.suno);
    const submittedGroups = [];
    for (const plan of plans) {
      const clips = await callSunoApi(config.suno, "/api/custom_generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: plan.lyrics,
          tags: plan.style,
          title: plan.title,
          make_instrumental: false,
          model: resolvedModel,
          wait_audio: false,
        }),
      });
      submittedGroups.push({ clips: Array.isArray(clips) ? clips : [], plan });
    }
    const completed = await waitForSunoAudio(config.suno, submittedGroups.flatMap((group) => group.clips), 240_000);
    const readyById = new Map(completed.ready.map((clip) => [String(clip.id), clip]));
    const completedGroups = submittedGroups.map((group, slotIndex) => ({
      plan: group.plan,
      slotIndex,
      ready: group.clips.map((clip) => readyById.get(String(clip.id))).filter(Boolean),
    })).filter((group) => group.ready.length);
    if (!completedGroups.length) {
      throw new Error("Suno 没有返回可播放歌曲");
    }

    const id = randomUUID();
    const createdAt = nowIso();
    const selectedSongs = [];
    for (const group of completedGroups) {
      const selected = group.ready[0];
      const stored = await storeSunoAudio(selected, `${id}-${group.slotIndex + 1}`);
      selectedSongs.push({ ...group, selected, stored });
    }
    const publishDate = normalizePublishDate(request.body?.publishDate);
    const scheduledAt = normalizeScheduledAt(request.body?.scheduledAt);
    const playlist = selectedSongs.map(({ plan, selected, stored }) => ({
      type: "song",
      title: String(plan.title || selected.title || "AI原创音乐").trim(),
      artist: "Suno AI",
      audioUrl: stored.audioUrl,
      audioPath: stored.audioPath,
      coverUrl: selected.image_url || "",
      duration: Math.max(1, Number(selected.duration ?? 0) || 240),
      lyrics: plan.lyrics,
      source: "suno",
      sourceId: selected.id,
    }));
    const title = playlist.length === 1 ? playlist[0].title : `AI原创音乐 · ${playlist.length}首`;
    const script = selectedSongs.map(({ plan }, index) => `《${plan.title}》\n${plan.lyrics}${index < selectedSongs.length - 1 ? "\n\n" : ""}`).join("");
    insertProgram({
      id,
      title,
      host: "Suno AI",
      prompt: mode === "auto" ? `全自动随机创作 ${playlist.length} 首` : String(request.body?.brief ?? "手动歌词与 Styles").trim(),
      script,
      segmentsJson: "[]",
      playlistJson: JSON.stringify(playlist),
      status: "ready",
      audioUrl: playlist[0].audioUrl,
      audioPath: playlist[0].audioPath,
      sortOrder: nextProgramSortOrder(),
      scheduledAt,
      sourceType: "suno",
      pluginId: "suno-ai",
      categoryId: String(request.body?.categoryId ?? "").trim() || defaultCategoryIdForName("音乐专题"),
      playbackSpeed: 1,
      publishDate,
      publishedAt: publishDate ? createdAt : null,
      llmModel: mode === "auto" ? config.llm.model : "手动歌词与提示词",
      ttsModel: resolvedModel,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt,
    });
    const program = readProgramById(id);
    archiveProgram(program);
    response.json({
      program,
      programs: readProgramList(),
      plan: plans[0],
      plans,
      alternatives: completedGroups.flatMap((group) => group.ready.map((clip, variantIndex) => ({
        id: clip.id,
        slotIndex: group.slotIndex,
        variantIndex,
        selected: variantIndex === 0,
        title: group.plan.title || clip.title,
        audioUrl: clip.audio_url,
        imageUrl: clip.image_url,
        status: clip.status,
      }))),
      message: `${playlist.length} 首 AI 音乐已生成；每组已默认选用第一版，可试听后更换`,
    });
  } catch (error) {
    response.status(502).json({
      message: "Suno AI 音乐生成失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/suno/select", requireAdmin, async (request, response) => {
  try {
    const programId = String(request.body?.programId ?? "").trim();
    const clipId = String(request.body?.clipId ?? "").trim();
    const slotIndex = Math.max(0, Math.floor(Number(request.body?.slotIndex ?? 0)));
    const program = readProgramById(programId);
    if (!program || program.sourceType !== "suno") {
      response.status(404).json({ message: "没有找到对应的 Suno AI 音乐节目" });
      return;
    }
    if (!clipId) {
      response.status(400).json({ message: "缺少 Suno 歌曲版本 ID" });
      return;
    }
    const config = readConfig();
    const clips = await callSunoApi(config.suno, `/api/get?ids=${encodeURIComponent(clipId)}`);
    const clip = (Array.isArray(clips) ? clips : []).find(
      (item) => String(item?.id ?? "") === clipId && item?.audio_url,
    );
    if (!clip) {
      throw new Error("所选 Suno 版本尚未生成完成或已失效");
    }
    const playlist = [...(program.playlist ?? [])];
    const songIndexes = playlist.map((item, index) => item?.type === "song" ? index : -1).filter((index) => index >= 0);
    const playlistIndex = songIndexes[slotIndex];
    if (!Number.isInteger(playlistIndex)) {
      response.status(400).json({ message: "歌曲位置无效" });
      return;
    }
    const stored = await storeSunoAudio(clip, `${program.id}-${slotIndex + 1}-${clip.id}`);
    const currentSong = playlist[playlistIndex];
    playlist[playlistIndex] = {
      ...currentSong,
      audioUrl: stored.audioUrl,
      audioPath: stored.audioPath,
      coverUrl: clip.image_url || currentSong.coverUrl || "",
      duration: Math.max(1, Number(clip.duration ?? 0) || Number(currentSong.duration ?? 0) || 240),
      source: "suno",
      sourceId: clip.id,
    };
    const updated = updateProgram(program.id, {
      playlistJson: JSON.stringify(playlist),
      ...(slotIndex === 0 ? { audioUrl: stored.audioUrl, audioPath: stored.audioPath } : {}),
    });
    archiveProgram(updated);
    response.json({
      program: updated,
      programs: readProgramList(),
      message: `已为第 ${slotIndex + 1} 首歌曲选用当前版本`,
    });
  } catch (error) {
    response.status(502).json({
      message: "切换 Suno 歌曲版本失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ===== 流程编排 (Flow Orchestration) =====
// 将流程节点中的转场音效写入节目 playlist，作为前置过渡项。
function buildTransitionPlaylistItem(transition) {
  if (!transition || !transition.effectId) {
    return null;
  }
  const effects = readSoundEffectsByIds([transition.effectId]);
  const effect = effects[0];
  if (!effect) {
    return null;
  }
  return {
    type: "transition",
    role: "transition",
    title: transition.effectName || effect.name,
    audioUrl: effect.audioUrl,
    audioPath: effect.audioPath,
    duration: undefined,
    volume: typeof transition.volume === "number" ? transition.volume : 1,
  };
}

function attachTransition(program, node) {
  if (!program) {
    return program;
  }
  const transition = node.transitionBefore ? buildTransitionPlaylistItem(node.transitionBefore) : null;
  const basePlaylist = Array.isArray(program.playlist) ? [...program.playlist] : [];
  const hasPrimaryContent = basePlaylist.some(
    (item) => item?.audioUrl && item?.type !== "background" && item?.role !== "background" && item?.type !== "transition" && item?.role !== "transition",
  );
  const mainProgramItem = !hasPrimaryContent && program.audioUrl
    ? {
        type: "talk",
        title: program.title,
        host: program.host,
        text: program.script,
        audioUrl: program.audioUrl,
        audioPath: program.audioPath,
      }
    : null;
  const playlist = transition
    ? [transition, ...basePlaylist, ...(mainProgramItem ? [mainProgramItem] : [])]
    : basePlaylist;
  const updated = updateProgram(program.id, { playlistJson: JSON.stringify(playlist) });
  if (updated) {
    archiveProgram(updated);
  }
  return updated ?? program;
}

// 将一个流程节点生成为节目记录。返回 { program, message, error? }
async function generateProgramFromNode(config, node, ctx) {
  const publishDate = ctx.publishDate;
  const dateBase = publishDate || localDateString();
  // startTime: "HH:MM" → 当日 ISO 时间。
  const scheduledAt = node.startTime
    ? normalizeScheduledAt(`${dateBase}T${String(node.startTime).padStart(5, "0")}:00`)
    : null;

  if (node.type === "filler") {
    // 自动兜底节点：用于定时节目空档的音乐联播或自定义音频补位。
    if (node.kind === "custom-audio" && node.audioUrl) {
      const id = randomUUID();
      const createdAt = nowIso();
      const hostName = hostProfiles[0].name;
      const playlist = [
        {
          type: "song",
          title: node.title || "自定义音频",
          audioUrl: node.audioUrl,
          duration: undefined,
        },
      ];
      const transition = node.transitionBefore ? buildTransitionPlaylistItem(node.transitionBefore) : null;
      insertProgram({
        id,
        title: node.title || "自定义音频时段",
        host: hostName,
        prompt: "流程编排 · 自定义音频",
        script: "",
        segmentsJson: "[]",
        status: "ready",
        audioUrl: node.audioUrl,
        audioPath: null,
        sortOrder: ctx.nextSort(),
        scheduledAt,
        sourceType: "flow-filler",
        pluginId: null,
        categoryId: defaultCategoryIdForName("音乐专题"),
        playbackSpeed: 1,
        publishDate,
        publishedAt: publishDate ? createdAt : null,
        llmModel: null,
        ttsModel: null,
        errorMessage: null,
        createdAt,
        updatedAt: createdAt,
        playlistJson: JSON.stringify(transition ? [transition, ...playlist] : playlist),
      });
      const program = readProgramById(id);
      archiveProgram(program);
      return { program, message: `已生成自定义音频：${node.title || "自定义音频"}` };
    }
    if (node.kind === "silence") {
      return {
        program: null,
        message: `空闲时段「${node.title || ""}」已设为静音留白，跳过生成`,
        skipped: true,
      };
    }
    // kugou-random：兼容旧流程节点名称，实际会按当前多音乐源设置自动取歌。
    if (node.kind === "kugou-random") {
      const basePlugin = config.plugins.kugouMusic;
      if (!basePlugin.enabled) {
        return { program: null, message: "音乐节目功能未启用，空闲时段已跳过", skipped: true };
      }
      const aiSongMessage = String(node.aiSongMessage ?? "").trim();
      const keywords = String(node.keywords ?? "").trim();
      const musicPlaylistId = String(node.musicPlaylistId ?? "").trim() || null;
      const playbackMode = normalizeMusicPlaybackMode(node.playbackMode);
      const songs = normalizeMusicPlaylistSongs(node.songs);
      const hasPresetSongs = songs.length > 0;
      const fillerSongLimit = songs.length || FLOW_FILLER_INITIAL_SONGS;
      const pluginOverride = keywords
        ? { maxSongs: fillerSongLimit, provider: node.provider, source: "search", searchKeywords: keywords, useAiScript: false }
        : { maxSongs: fillerSongLimit, provider: node.provider, useAiScript: false };
      try {
        const { program } = await buildKugouProgram(config, {
          allowAiSongFallback: !hasPresetSongs,
          publishDate,
          scheduledAt,
          playbackSpeed: 1,
          playbackMode,
          restartFromBeginning: Boolean(node.restartFromBeginning),
          musicPlaylistId,
          songs,
          title: node.title || (keywords ? `音乐连播 · ${keywords}` : "音乐连播"),
          prompt: "流程编排 · 音乐连播",
          sourceType: "flow-filler",
          pluginId: "kugou-music",
          refreshManualPool: false,
          songSeed: musicPlaylistId
            ? `${publishDate || localDateString()}:${musicPlaylistId}`
            : (publishDate ? `flow-filler:${publishDate}:${keywords || basePlugin.searchKeywords || "auto"}` : ""),
          topUpManualSongs: !hasPresetSongs,
          plugin: pluginOverride,
        });
        return {
          program: attachTransition(program, node),
          message: [
            aiSongMessage,
            `已生成音乐连播：${songs.length ? `${songs.length} 首歌曲` : node.title || keywords || "默认歌单"}` +
              (musicPlaylistId ? `（${playbackMode === "shuffle" ? "随机播放" : "顺序播放"}）` : ""),
          ].filter(Boolean).join("；"),
        };
      } catch (error) {
        return { program: null, message: `音乐连播失败：${error instanceof Error ? error.message : String(error)}` };
      }
    }
    return {
      program: null,
      message: `空闲时段「${node.title || ""}」类型未知，已跳过`,
      skipped: true,
    };
  }

  // 定时节目节点
  if (node.kind === "daily-briefing") {
    const plugin = config.plugins.dailyBriefing;
    if (!plugin.enabled || !String(plugin.token ?? "").trim()) {
      return { program: null, message: "每日早报插件未启用或缺少 Token，已跳过", skipped: true };
    }
    const host = hostProfiles.find((item) => item.id === plugin.hostId) ?? hostProfiles[0];
    const playbackSpeed = normalizePlaybackSpeed(plugin.playbackSpeed ?? 1);
    const id = randomUUID();
    const createdAt = nowIso();
    const briefing = parseDailyBriefingPayload(await (await fetch(buildAlapiUrl(plugin))).json().catch(() => ({})), Number(plugin.maxItems ?? 12));
    const segments = await editDailyBriefingWithLlm(config.llm, briefing, host, { publishDate, scheduledAt });
    const script = segments.map((segment) => segment.text).join("\n\n");
    const title = node.title || `每日早报 · ${briefing.date || dateBase}`;
    insertProgram({
      id, title, host: host.name, prompt: "ALAPI 每日早报插件采集", script,
      segmentsJson: JSON.stringify(segments), status: "script_saved", audioUrl: null, audioPath: null,
      sortOrder: ctx.nextSort(), scheduledAt, sourceType: "plugin", pluginId: "daily-briefing",
      playbackSpeed, publishDate, publishedAt: publishDate ? createdAt : null,
      llmModel: "ALAPI", ttsModel: config.tts.model, errorMessage: null, createdAt, updatedAt: createdAt,
    });
    archiveProgram(readProgramById(id));
    try {
      const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, script, id, segments);
      const nextSegments = synthesizedSegments(segments, audio);
      const program = updateProgram(id, {
        status: "ready", audioUrl: audio.audioUrl, audioPath: audio.audioPath,
        segmentsJson: JSON.stringify(nextSegments), playlistJson: JSON.stringify(buildConfiguredBackgroundPlaylist("daily-briefing", config)), errorMessage: null,
      });
      archiveProgram(program);
      return { program: attachTransition(program, node), message: "每日早报已生成" };
    } catch (error) {
      const program = updateProgram(id, { status: "script_saved", errorMessage: error instanceof Error ? error.message : String(error) });
      archiveProgram(program);
      return { program, message: `每日早报文案已入库，语音合成失败：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  if (node.kind === "hot-topics") {
    const plugin = config.plugins.hotTopics;
    if (!plugin.enabled || !String(plugin.token ?? "").trim()) {
      return { program: null, message: "今日热榜插件未启用或缺少 Token，已跳过", skipped: true };
    }
    const host = hostProfiles.find((item) => item.id === plugin.hostId) ?? hostProfiles[0];
    const playbackSpeed = normalizePlaybackSpeed(plugin.playbackSpeed ?? 1);
    const id = randomUUID();
    const createdAt = nowIso();
    const alapiResponse = await fetch(normalizeHotTopicEndpoint(plugin), {
      method: "POST", headers: alapiV3Headers(plugin),
      body: JSON.stringify({ type: String(plugin.type ?? "weibo").trim() || "weibo" }),
    });
    const payload = await alapiResponse.json().catch(() => ({}));
    const hotTopics = parseHotTopicsPayload(payload, Number(plugin.maxItems ?? 10));
    const segments = await editHotTopicsWithLlm(config.llm, hotTopics, host, { publishDate, scheduledAt });
    const script = segments.map((segment) => segment.text).join("\n\n");
    const title = node.title || `${plugin.name || "今日热榜"} · ${hotTopics.name || dateBase}`;
    insertProgram({
      id, title, host: host.name, prompt: `ALAPI 今日热榜插件采集：${hotTopics.name}`, script,
      segmentsJson: JSON.stringify(segments), status: "script_saved", audioUrl: null, audioPath: null,
      sortOrder: ctx.nextSort(), scheduledAt, sourceType: "plugin", pluginId: "hot-topics",
      playbackSpeed, publishDate, publishedAt: publishDate ? createdAt : null,
      llmModel: "ALAPI", ttsModel: config.tts.model, errorMessage: null, createdAt, updatedAt: createdAt,
    });
    archiveProgram(readProgramById(id));
    try {
      const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, script, id, segments);
      const nextSegments = synthesizedSegments(segments, audio);
      const program = updateProgram(id, {
        status: "ready", audioUrl: audio.audioUrl, audioPath: audio.audioPath,
        segmentsJson: JSON.stringify(nextSegments), playlistJson: JSON.stringify(buildConfiguredBackgroundPlaylist("hot-topics", config)), errorMessage: null,
      });
      archiveProgram(program);
      return { program: attachTransition(program, node), message: "今日热榜已生成" };
    } catch (error) {
      const program = updateProgram(id, { status: "script_saved", errorMessage: error instanceof Error ? error.message : String(error) });
      archiveProgram(program);
      return { program, message: `今日热榜文案已入库，语音合成失败：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  if (node.kind === "kugou") {
    try {
      const { program } = await buildKugouProgram(config, {
        allowAiSongFallback: true,
        publishDate, scheduledAt,
        playbackSpeed: config.tts.speed,
        title: node.title,
        plugin: node.pluginId ? undefined : undefined,
      });
      return { program: attachTransition(program, node), message: "音乐联播节目已生成" };
    } catch (error) {
      return { program: null, message: `音乐联播生成失败：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // 引用已有节目：复用其配置（提示词/主播/分类/播放速度），重新生成当天新内容。
  if (node.kind === "existing") {
    const sourceId = String(node.programId ?? "").trim();
    if (!sourceId) {
      return { program: null, message: "未选择引用的节目，已跳过", skipped: true };
    }
    const source = readProgramById(sourceId);
    if (!source) {
      return { program: null, message: `引用的节目 ${sourceId} 已不存在，已跳过`, skipped: true };
    }
    // 从源节目的 host 名字字符串（如 "星遥 / 墨白"）解析回 host 数组。
    const sourceHostNames = String(source.host ?? "")
      .split("/")
      .map((name) => name.trim())
      .filter(Boolean);
    const selectedHosts = normalizeHosts(sourceHostNames);
    const prompt = String(source.prompt ?? "").trim() || "星夜、城市、柔和人声、治愈氛围";
    const title = node.title || source.title || `星声节目 ${dateBase}`;
    const playbackSpeed = normalizePlaybackSpeed(source.playbackSpeed ?? config.tts.speed);
    const categoryId = source.categoryId || defaultCategoryIdForName("常规节目");
    const id = randomUUID();
    const createdAt = nowIso();
    try {
      const generated = await generateScript(config.llm, { hosts: selectedHosts, prompt, publishDate, scheduledAt, title });
      insertProgram({
        id, title, host: source.host || selectedHosts.map((item) => item.name).join(" / "),
        prompt, script: generated.script, segmentsJson: JSON.stringify(generated.segments),
        status: "script_saved", audioUrl: null, audioPath: null, sortOrder: ctx.nextSort(),
        scheduledAt, sourceType: "flow-existing", pluginId: null,
        categoryId, playbackSpeed, publishDate, publishedAt: publishDate ? createdAt : null,
        llmModel: config.llm.model, ttsModel: config.tts.model, errorMessage: null, createdAt, updatedAt: createdAt,
      });
      archiveProgram(readProgramById(id));
      try {
        const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, generated.script, id, generated.segments);
        const program = updateProgram(id, {
          status: "ready", audioUrl: audio.audioUrl, audioPath: audio.audioPath,
          segmentsJson: JSON.stringify(synthesizedSegments(generated.segments, audio)), errorMessage: null,
        });
        archiveProgram(program);
        return { program: attachTransition(program, node), message: `已引用「${source.title}」重新生成节目` };
      } catch (error) {
        const program = updateProgram(id, { status: "script_saved", errorMessage: error instanceof Error ? error.message : String(error) });
        archiveProgram(program);
        return { program, message: `文案已入库，语音失败：${error instanceof Error ? error.message : String(error)}` };
      }
    } catch (error) {
      return { program: null, message: `引用节目生成失败：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // 引用预设节目模板：按模板里的类型/配置生成（无音频模板→重新生成）。
  if (node.kind === "preset") {
    const sourceId = String(node.programId ?? "").trim();
    if (!sourceId) {
      return { program: null, message: "未选择预设节目，已跳过", skipped: true };
    }
    const row = db.prepare("SELECT * FROM program_presets WHERE id = ?").get(sourceId);
    if (!row) {
      return { program: null, message: `预设节目 ${sourceId} 已不存在，已跳过`, skipped: true };
    }
    const template = rowToProgramPreset(row);
    const pluginKind = template.pluginKind || template.type;
    // 若模板绑定的是采集插件类型，直接转发到对应生成逻辑。
    if (pluginKind === "daily-briefing") {
      const plugin = config.plugins.dailyBriefing;
      if (!plugin.enabled || !String(plugin.token ?? "").trim()) {
        return { program: null, message: "每日早报插件未启用或缺少 Token，已跳过", skipped: true };
      }
      const host = hostProfiles.find((item) => item.id === (template.hostId || plugin.hostId)) ?? hostProfiles[0];
      const playbackSpeed = normalizePlaybackSpeed(template.playbackSpeed ?? plugin.playbackSpeed ?? 1);
      const id = randomUUID();
      const createdAt = nowIso();
      const briefing = parseDailyBriefingPayload(await (await fetch(buildAlapiUrl(plugin))).json().catch(() => ({})), Number(plugin.maxItems ?? 12));
      const segments = await editDailyBriefingWithLlm(config.llm, briefing, host, { publishDate, scheduledAt });
      const script = segments.map((segment) => segment.text).join("\n\n");
      const title = node.title || template.title || `每日早报 · ${briefing.date || dateBase}`;
      insertProgram({ id, title, host: host.name, prompt: "ALAPI 每日早报插件采集", script, segmentsJson: JSON.stringify(segments), status: "script_saved", audioUrl: null, audioPath: null, sortOrder: ctx.nextSort(), scheduledAt, sourceType: "plugin", pluginId: "daily-briefing", programPresetId: template.id, categoryId: template.categoryId || defaultCategoryIdForName("常规节目"), playbackSpeed, publishDate, publishedAt: publishDate ? createdAt : null, llmModel: "ALAPI", ttsModel: config.tts.model, errorMessage: null, createdAt, updatedAt: createdAt });
      archiveProgram(readProgramById(id));
      try {
        const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, script, id, segments);
        const program = updateProgram(id, { status: "ready", audioUrl: audio.audioUrl, audioPath: audio.audioPath, segmentsJson: JSON.stringify(synthesizedSegments(segments, audio)), playlistJson: JSON.stringify(buildConfiguredBackgroundPlaylist("daily-briefing", config)), errorMessage: null });
        archiveProgram(program);
        return { program: attachTransition(program, node), message: `已按预设「${template.name}」生成每日早报` };
      } catch (error) {
        const program = updateProgram(id, { status: "script_saved", errorMessage: error instanceof Error ? error.message : String(error) });
        archiveProgram(program);
        return { program, message: `早报文案已入库，语音失败：${error instanceof Error ? error.message : String(error)}` };
      }
    }
    if (pluginKind === "hot-topics") {
      const plugin = config.plugins.hotTopics;
      if (!plugin.enabled || !String(plugin.token ?? "").trim()) {
        return { program: null, message: "今日热榜插件未启用或缺少 Token，已跳过", skipped: true };
      }
      const host = hostProfiles.find((item) => item.id === (template.hostId || plugin.hostId)) ?? hostProfiles[0];
      const playbackSpeed = normalizePlaybackSpeed(template.playbackSpeed ?? plugin.playbackSpeed ?? 1);
      const id = randomUUID();
      const createdAt = nowIso();
      const alapiResponse = await fetch(normalizeHotTopicEndpoint(plugin), { method: "POST", headers: alapiV3Headers(plugin), body: JSON.stringify({ type: String(plugin.type ?? "weibo").trim() || "weibo" }) });
      const payload = await alapiResponse.json().catch(() => ({}));
      const hotTopics = parseHotTopicsPayload(payload, Number(plugin.maxItems ?? 10));
      const segments = await editHotTopicsWithLlm(config.llm, hotTopics, host, { publishDate, scheduledAt });
      const script = segments.map((segment) => segment.text).join("\n\n");
      const title = node.title || template.title || `${plugin.name || "今日热榜"} · ${hotTopics.name || dateBase}`;
      insertProgram({ id, title, host: host.name, prompt: `ALAPI 今日热榜插件采集：${hotTopics.name}`, script, segmentsJson: JSON.stringify(segments), status: "script_saved", audioUrl: null, audioPath: null, sortOrder: ctx.nextSort(), scheduledAt, sourceType: "plugin", pluginId: "hot-topics", programPresetId: template.id, categoryId: template.categoryId || defaultCategoryIdForName("常规节目"), playbackSpeed, publishDate, publishedAt: publishDate ? createdAt : null, llmModel: "ALAPI", ttsModel: config.tts.model, errorMessage: null, createdAt, updatedAt: createdAt });
      archiveProgram(readProgramById(id));
      try {
        const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, script, id, segments);
        const program = updateProgram(id, { status: "ready", audioUrl: audio.audioUrl, audioPath: audio.audioPath, segmentsJson: JSON.stringify(synthesizedSegments(segments, audio)), playlistJson: JSON.stringify(buildConfiguredBackgroundPlaylist("hot-topics", config)), errorMessage: null });
        archiveProgram(program);
        return { program: attachTransition(program, node), message: `已按预设「${template.name}」生成今日热榜` };
      } catch (error) {
        const program = updateProgram(id, { status: "script_saved", errorMessage: error instanceof Error ? error.message : String(error) });
        archiveProgram(program);
        return { program, message: `热榜文案已入库，语音失败：${error instanceof Error ? error.message : String(error)}` };
      }
    }
    if (pluginKind === "kugou") {
      try {
        const { program } = await buildKugouProgram(config, {
          allowAiSongFallback: true,
          categoryId: template.categoryId,
          hostId: template.hostId,
          plugin: template.kugou ?? undefined,
          programPresetId: template.id,
          publishDate,
          scheduledAt,
          playbackSpeed: template.playbackSpeed ?? config.tts.speed,
          songs: template.songs ?? [],
          title: node.title || template.title,
        });
        return { program: attachTransition(program, node), message: `已按预设「${template.name}」生成音乐联播` };
      } catch (error) {
        return { program: null, message: `音乐联播失败：${error instanceof Error ? error.message : String(error)}` };
      }
    }
    // 默认：按自定义 AI 节目生成（复用模板的 prompt/host/category）。
    const selectedHosts = normalizeHosts(template.hostIds?.length ? template.hostIds : (template.hostId ? [template.hostId] : null));
    const requestedContent = String(template.prompt ?? "").trim();
    if (template.contentMode === "direct" && !requestedContent) {
      return { program: null, message: `预设「${template.name}」缺少直出配音原文，已跳过`, skipped: true };
    }
    const prompt = requestedContent || "星夜、城市、柔和人声、治愈氛围";
    const title = node.title || template.title || `星声节目 ${dateBase}`;
    const playbackSpeed = normalizePlaybackSpeed(template.playbackSpeed ?? config.tts.speed);
    const id = randomUUID();
    const createdAt = nowIso();
    try {
      const generated = template.contentMode === "direct"
        ? directScriptPayload(prompt, selectedHosts)
        : await generateScript(config.llm, { hosts: selectedHosts, prompt, publishDate, scheduledAt, title });
      insertProgram({ id, title, host: selectedHosts.map((item) => item.name).join(" / "), prompt, script: generated.script, segmentsJson: JSON.stringify(generated.segments), status: "script_saved", audioUrl: null, audioPath: null, sortOrder: ctx.nextSort(), scheduledAt, sourceType: "flow-preset", pluginId: null, programPresetId: template.id, categoryId: template.categoryId || defaultCategoryIdForName("常规节目"), playbackSpeed, publishDate, publishedAt: publishDate ? createdAt : null, llmModel: template.contentMode === "direct" ? "原文直出" : config.llm.model, ttsModel: config.tts.model, errorMessage: null, createdAt, updatedAt: createdAt });
      archiveProgram(readProgramById(id));
      try {
        const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, generated.script, id, generated.segments);
        const program = updateProgram(id, { status: "ready", audioUrl: audio.audioUrl, audioPath: audio.audioPath, segmentsJson: JSON.stringify(synthesizedSegments(generated.segments, audio)), errorMessage: null });
        archiveProgram(program);
        return { program: attachTransition(program, node), message: `已按预设「${template.name}」生成节目` };
      } catch (error) {
        const program = updateProgram(id, { status: "script_saved", errorMessage: error instanceof Error ? error.message : String(error) });
        archiveProgram(program);
        return { program, message: `文案已入库，语音失败：${error instanceof Error ? error.message : String(error)}` };
      }
    } catch (error) {
      return { program: null, message: `预设节目生成失败：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // 默认：普通 AI 节目
  const selectedHosts = normalizeHosts(node.hostId ? [{ id: node.hostId }] : null);
  const host = selectedHosts.map((item) => item.name).join(" / ");
  const prompt = String(node.prompt ?? "").trim() || "星夜、城市、柔和人声、治愈氛围";
  const title = node.title || `星声节目 ${dateBase}`;
  const playbackSpeed = normalizePlaybackSpeed(config.tts.speed);
  const id = randomUUID();
  const createdAt = nowIso();
  try {
    const generated = await generateScript(config.llm, { hosts: selectedHosts, prompt, publishDate, scheduledAt, title });
    insertProgram({
      id, title, host, prompt, script: generated.script, segmentsJson: JSON.stringify(generated.segments),
      status: "script_saved", audioUrl: null, audioPath: null, sortOrder: ctx.nextSort(),
      scheduledAt, sourceType: "generated", pluginId: null,
      categoryId: node.categoryId || defaultCategoryIdForName("常规节目"),
      playbackSpeed, publishDate, publishedAt: publishDate ? createdAt : null,
      llmModel: config.llm.model, ttsModel: config.tts.model, errorMessage: null, createdAt, updatedAt: createdAt,
    });
    archiveProgram(readProgramById(id));
    try {
      const audio = await synthesizeSpeech({ ...config.tts, speed: playbackSpeed }, generated.script, id, generated.segments);
      const program = updateProgram(id, {
        status: "ready", audioUrl: audio.audioUrl, audioPath: audio.audioPath,
        segmentsJson: JSON.stringify(synthesizedSegments(generated.segments, audio)), errorMessage: null,
      });
      archiveProgram(program);
      return { program: attachTransition(program, node), message: "节目已生成" };
    } catch (error) {
      const program = updateProgram(id, { status: "script_saved", errorMessage: error instanceof Error ? error.message : String(error) });
      archiveProgram(program);
      return { program, message: `文案已入库，语音失败：${error instanceof Error ? error.message : String(error)}` };
    }
  } catch (error) {
    return { program: null, message: `节目生成失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

function rowToFlowPreset(row) {
  if (!row) {
    return null;
  }
  let payload = { nodes: [] };
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = { nodes: [] };
  }
  const autoFillPlaylistId = String(payload.autoFillPlaylistId ?? "").trim() || null;
  const musicPlaylist = autoFillPlaylistId ? readMusicPlaylistById(autoFillPlaylistId) : null;
  const payloadSongs = normalizeMusicPlaylistSongs(payload.autoFillSongs);
  return {
    autoFillEnabled: payload.autoFillEnabled !== false,
    autoFillKeywords: String(payload.autoFillKeywords ?? "").trim(),
    autoFillProvider: normalizeMusicProvider(payload.autoFillProvider, "auto"),
    autoFillRestartFromBeginning: Boolean(payload.autoFillRestartFromBeginning),
    autoFillSongs: musicPlaylist ? musicPlaylist.songs : payloadSongs,
    autoFillPlaybackMode: normalizeMusicPlaybackMode(
      payload.autoFillPlaybackMode,
      musicPlaylist?.playbackMode ?? "sequential",
    ),
    autoFillPlaylistId,
    autoFillPlaylistName: musicPlaylist?.name ?? null,
    id: row.id,
    name: row.name,
    nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
    publishDate: payload.publishDate ?? null,
    scheduledTime: row.scheduled_time ?? null,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at ?? null,
    lastRunSummary: row.last_run_summary ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function kugouSongKey(song) {
  return String(`${song?.source ?? "kugou"}:${song?.sourceId || song?.hash || song?.albumAudioId || `${song?.artist ?? ""}-${song?.title ?? ""}`}`)
    .trim()
    .toLowerCase();
}

function stableHashNumber(value) {
  const digest = createHash("sha256").update(String(value)).digest();
  return digest.readUInt32BE(0);
}

function seededShuffle(items, seed, keyFn = (item, index) => `${index}:${JSON.stringify(item)}`) {
  if (!seed || !Array.isArray(items) || items.length <= 1) {
    return [...items];
  }
  return [...items]
    .map((item, index) => ({
      item,
      score: stableHashNumber(`${seed}:${keyFn(item, index)}:${index}`),
    }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);
}

function resolveAutoFillPlaylistState({
  autoFillPlaybackMode,
  autoFillPlaylistId,
  autoFillSongs,
} = {}) {
  const playlistId = String(autoFillPlaylistId ?? "").trim() || null;
  const playlist = playlistId ? readMusicPlaylistById(playlistId) : null;
  return {
    playlist,
    playlistId,
    playbackMode: normalizeMusicPlaybackMode(
      autoFillPlaybackMode,
      playlist?.playbackMode ?? "sequential",
    ),
    songs: playlist ? playlist.songs : normalizeMusicPlaylistSongs(autoFillSongs),
  };
}

function orderMusicPlaylistSongs(songs, playbackMode, publishDate, playlistId) {
  const normalized = normalizeMusicPlaylistSongs(songs);
  if (normalizeMusicPlaybackMode(playbackMode) !== "shuffle") {
    return normalized;
  }
  const dateSeed = normalizePublishDate(publishDate) || localDateString();
  const playlistSeed = String(playlistId ?? "").trim() || "auto-fill";
  return seededShuffle(normalized, `${dateSeed}:${playlistSeed}`, kugouSongKey);
}

function rotateBySeed(items, seed) {
  if (!seed || !Array.isArray(items) || items.length <= 1) {
    return [...items];
  }
  const offset = stableHashNumber(seed) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function isFlowFillerProgram(program) {
  const title = String(program?.title ?? "");
  const prompt = String(program?.prompt ?? "");
  return (
    String(program?.sourceType ?? "") === "flow-filler" ||
    (
      program?.pluginId === "kugou-music" &&
      !program?.scheduledAt &&
      (/音乐[联连]播兜底/u.test(title) || prompt === "流程编排 · 音乐连播")
    )
  );
}

function readFlowFillerProgramForDate(publishDate) {
  const rows = db
    .prepare(`
      SELECT p.*, c.name AS category_name
      FROM programs p
      LEFT JOIN program_categories c ON c.id = p.category_id
      WHERE p.publish_date = ?
        AND (p.scheduled_at IS NULL OR p.scheduled_at = '')
      ORDER BY p.updated_at DESC, p.created_at DESC
    `)
    .all(publishDate)
    .map(rowToProgram)
    .map(applyConfiguredBackgroundPlaylist);
  return rows.find(isFlowFillerProgram) ?? null;
}

async function resolveFlowFillerSongs(config, inputSongs, keywords, publishDate, options = {}) {
  config = configForMusicProvider(config, options.provider);
  const playlistId = String(options.playlistId ?? "").trim() || null;
  const playbackMode = normalizeMusicPlaybackMode(options.playbackMode);
  const normalizedInput = orderMusicPlaylistSongs(inputSongs, playbackMode, publishDate, playlistId);
  if (playlistId && !normalizedInput.length) {
    throw new Error("保存的自定义歌单为空，请先添加歌曲");
  }
  const targetSongCount = normalizedInput.length
    ? Math.max(1, Math.min(KUGOU_MAX_PROGRAM_SONGS, normalizedInput.length))
    : FLOW_FILLER_INITIAL_SONGS;
  const basePlugin = {
    ...config.plugins.kugouMusic,
    provider: normalizeMusicProvider(options.provider, config.plugins.kugouMusic.provider),
    maxSongs: targetSongCount,
    useAiScript: false,
  };
  const hydratedInput = normalizedInput.length
    ? await hydrateKugouSongsBySearch(config, normalizedInput, targetSongCount)
    : [];
  const plugin = keywords
    ? { ...basePlugin, source: "search", searchKeywords: keywords }
    : basePlugin;
  const seed = publishDate ? `flow-filler:${publishDate}:${keywords || plugin.searchKeywords || "auto"}` : "";
  const playable = await fetchPlayableKugouSongs(
    config,
    plugin,
    Math.max(targetSongCount, hydratedInput.length, Number(plugin.maxSongs ?? targetSongCount)),
    hydratedInput,
    {
      refreshManualPool: false,
      seed,
      topUpManual: !normalizedInput.length,
    },
  );

  if (!playable.length) {
    throw new Error("音乐连播清单中没有可播放歌曲，请重新搜索或检查所选音乐源登录态");
  }

  return playable;
}

async function buildFlowFillerPlaylist(config, songs, keywords, publishDate, options = {}) {
  const playableSongs = await resolveFlowFillerSongs(config, songs, keywords, publishDate, options);
  if (config.plugins.kugouMusic.cookie) {
    saveKugouCookie(config.plugins.kugouMusic.cookie);
  }
  return {
    songs: playableSongs,
    playlist: playableSongs.map(kugouSongToPlaylistItem),
  };
}

function kugouSongToPlaylistItem(song) {
  return {
    type: "song",
    title: song.title,
    artist: song.artist,
    audioUrl: song.audioUrl,
    coverUrl: song.coverUrl,
    duration: song.duration,
    hash: song.hash,
    lyrics: song.lyrics,
    mediaId: song.mediaId,
    albumId: song.albumId,
    albumAudioId: song.albumAudioId,
    source: song.source || "kugou",
    sourceId: song.sourceId,
  };
}

function programPlaylistSongs(program) {
  return Array.isArray(program?.playlist)
    ? program.playlist
        .filter((item) => item?.type === "song" && item.audioUrl)
        .map(normalizeMusicSong)
    : [];
}

const fillerTopUpRunning = new Set();

async function topUpFlowFillerProgram(programId, options = {}) {
  const program = readProgramById(programId);
  if (!program || !isFlowFillerProgram(program)) {
    throw new Error("指定节目不是音乐连播节目");
  }

  const existingSongs = programPlaylistSongs(program);
  if (program.musicPlaylistId) {
    return {
      addedSongs: [],
      program,
      skipped: true,
      totalSongs: existingSongs.length,
      message: `当前音乐连播由保存歌单托管（${program.playbackMode === "shuffle" ? "随机播放" : "顺序播放"}），不会追加 AI 歌曲`,
    };
  }
  const maxSongs = Math.max(FLOW_FILLER_INITIAL_SONGS, Math.min(FLOW_FILLER_TARGET_SONGS, Number(options.maxSongs ?? FLOW_FILLER_TARGET_SONGS)));
  const batchSize = Math.max(1, Math.min(FLOW_FILLER_TOP_UP_BATCH_SONGS, Number(options.batchSize ?? FLOW_FILLER_TOP_UP_BATCH_SONGS)));
  const remainingCapacity = Math.max(0, maxSongs - existingSongs.length);
  if (!remainingCapacity) {
    return {
      addedSongs: [],
      program,
      skipped: true,
      totalSongs: existingSongs.length,
      message: `音乐连播已达到 ${maxSongs} 首上限，无需续批`,
    };
  }

  const targetCount = Math.min(batchSize, remainingCapacity);
  const config = readConfig();
  const existingProviders = [...new Set(existingSongs.map((song) => normalizeMusicProvider(song.source, "")).filter(Boolean))];
  const provider = existingProviders.length === 1 ? existingProviders[0] : config.plugins.kugouMusic.provider;
  const candidates = await generateAiHotSongCandidates(config.llm, targetCount, DEFAULT_AI_HOT_SONG_PROMPT, existingSongs);
  const playable = await resolveAiGeneratedHotSongs(config, candidates, targetCount, provider);
  const seen = new Set(existingSongs.map(kugouSongKey));
  const addedSongs = [];
  for (const song of playable.map(normalizeMusicSong)) {
    const key = kugouSongKey(song);
    if (!key || seen.has(key) || !song.audioUrl) {
      continue;
    }
    seen.add(key);
    addedSongs.push(song);
    if (addedSongs.length >= targetCount) {
      break;
    }
  }

  if (!addedSongs.length) {
    return {
      addedSongs: [],
      program,
      skipped: true,
      totalSongs: existingSongs.length,
      message: "AI 已尝试续批，但没有解析到新的可播放歌曲",
    };
  }

  const nextPlaylist = [
    ...(Array.isArray(program.playlist) ? program.playlist : []),
    ...addedSongs.map(kugouSongToPlaylistItem),
  ];
  const effectiveFillerElapsed = Number(options.effectiveFillerElapsed);
  const revision = Number.isFinite(effectiveFillerElapsed) && effectiveFillerElapsed > 0
    ? {
        effectiveFillerElapsed: Math.round(effectiveFillerElapsed),
        previousSongCount: existingSongs.length,
        publishDate: program.publishDate || localDateString(),
        songCount: existingSongs.length + addedSongs.length,
      }
    : null;
  const fillerTimeline = [
    ...(Array.isArray(program.fillerTimeline) ? program.fillerTimeline : []),
    ...(revision ? [revision] : []),
  ].slice(-20);
  const firstAudio = nextPlaylist.find((item) => item.audioUrl);
  const updated = updateProgram(program.id, {
    playlistJson: JSON.stringify(nextPlaylist),
    fillerTimeline,
    audioUrl: firstAudio?.audioUrl ?? program.audioUrl,
    audioPath: firstAudio?.audioPath ?? program.audioPath,
    status: firstAudio ? "ready" : program.status,
    errorMessage: null,
  }) ?? program;

  return {
    addedSongs,
    program: updated,
    skipped: false,
    totalSongs: programPlaylistSongs(updated).length,
    message: `音乐连播已续批 ${addedSongs.length} 首，当前 ${programPlaylistSongs(updated).length} 首`,
  };
}

function updateFlowPresetAutoFill(row, patch) {
  let payload = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }
  const hasPlaylistId = Object.prototype.hasOwnProperty.call(patch, "autoFillPlaylistId");
  const autoFillPlaylistId = hasPlaylistId
    ? (String(patch.autoFillPlaylistId ?? "").trim() || null)
    : (String(payload.autoFillPlaylistId ?? "").trim() || null);
  const musicPlaylist = autoFillPlaylistId ? readMusicPlaylistById(autoFillPlaylistId) : null;
  const autoFillSongs = musicPlaylist
    ? musicPlaylist.songs
    : normalizeMusicPlaylistSongs(
        Array.isArray(patch.autoFillSongs) ? patch.autoFillSongs : payload.autoFillSongs,
      );
  const playbackModeInput = Object.prototype.hasOwnProperty.call(patch, "autoFillPlaybackMode")
    ? patch.autoFillPlaybackMode
    : payload.autoFillPlaybackMode;
  const nextPayload = {
    ...payload,
    autoFillEnabled: patch.autoFillEnabled !== false,
    autoFillKeywords: String(patch.autoFillKeywords ?? "").trim(),
    autoFillProvider: normalizeMusicProvider(
      Object.prototype.hasOwnProperty.call(patch, "autoFillProvider") ? patch.autoFillProvider : payload.autoFillProvider,
      "auto",
    ),
    autoFillRestartFromBeginning: Object.prototype.hasOwnProperty.call(patch, "autoFillRestartFromBeginning")
      ? Boolean(patch.autoFillRestartFromBeginning)
      : Boolean(payload.autoFillRestartFromBeginning),
    autoFillPlaybackMode: normalizeMusicPlaybackMode(
      playbackModeInput,
      musicPlaylist?.playbackMode ?? "sequential",
    ),
    autoFillPlaylistId,
    autoFillSongs,
    nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
    publishDate: normalizePublishDate(patch.publishDate) || payload.publishDate || null,
  };
  db.prepare("UPDATE flow_presets SET payload = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(nextPayload), nowIso(), row.id);
  return rowToFlowPreset(db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(row.id));
}

function saveFlowPresetAutoFillSongs(presetId, songs, publishDate, options = {}) {
  const row = db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(presetId);
  if (!row) {
    return null;
  }
  let payload = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }
  const hasPlaylistId = Object.prototype.hasOwnProperty.call(options, "autoFillPlaylistId");
  const autoFillPlaylistId = hasPlaylistId
    ? (String(options.autoFillPlaylistId ?? "").trim() || null)
    : (String(payload.autoFillPlaylistId ?? "").trim() || null);
  const musicPlaylist = autoFillPlaylistId ? readMusicPlaylistById(autoFillPlaylistId) : null;
  const autoFillSongs = musicPlaylist ? musicPlaylist.songs : normalizeMusicPlaylistSongs(songs);
  const nextPayload = {
    ...payload,
    autoFillProvider: normalizeMusicProvider(options.autoFillProvider ?? payload.autoFillProvider, "auto"),
    autoFillRestartFromBeginning: Object.prototype.hasOwnProperty.call(options, "autoFillRestartFromBeginning")
      ? Boolean(options.autoFillRestartFromBeginning)
      : Boolean(payload.autoFillRestartFromBeginning),
    autoFillPlaybackMode: normalizeMusicPlaybackMode(
      options.autoFillPlaybackMode ?? payload.autoFillPlaybackMode,
      musicPlaylist?.playbackMode ?? "sequential",
    ),
    autoFillPlaylistId,
    autoFillSongs,
    nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
    publishDate: normalizePublishDate(publishDate) || payload.publishDate || null,
  };
  db.prepare("UPDATE flow_presets SET payload = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(nextPayload), nowIso(), row.id);
  return rowToFlowPreset(db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(row.id));
}

async function refreshFlowAutoFillSongsForRun(config, preset, publishDate) {
  const existingSongs = normalizeMusicPlaylistSongs(preset.autoFillSongs);

  if (preset.autoFillPlaylistId) {
    return {
      songs: existingSongs,
      message: `沿用保存的自定义歌单：${existingSongs.length} 首（${preset.autoFillPlaybackMode === "shuffle" ? "随机播放" : "顺序播放"}）`,
      preset,
    };
  }

  if (!config.plugins.kugouMusic.enabled) {
    return {
      songs: existingSongs,
      message: existingSongs.length
        ? `音乐连播插件未启用，沿用已有 ${existingSongs.length} 首歌曲`
        : "音乐连播插件未启用，改用规则取歌",
      preset,
    };
  }

  try {
    const candidates = await generateAiHotSongCandidates(config.llm, FLOW_FILLER_INITIAL_SONGS, DEFAULT_AI_HOT_SONG_PROMPT);
    const songs = await resolveAiGeneratedHotSongs(config, candidates, FLOW_FILLER_INITIAL_SONGS, preset.autoFillProvider);
    if (!songs.length) {
      throw new Error("大模型生成的歌曲未解析到可播放地址");
    }
    const savedPreset = saveFlowPresetAutoFillSongs(preset.id, songs, publishDate, {
      autoFillPlaybackMode: preset.autoFillPlaybackMode,
      autoFillPlaylistId: preset.autoFillPlaylistId,
      autoFillProvider: preset.autoFillProvider,
      autoFillRestartFromBeginning: preset.autoFillRestartFromBeginning,
    });
    return {
      songs,
      message: `AI 已刷新音乐连播歌单：${songs.length} 首`,
      preset: savedPreset ?? { ...preset, autoFillSongs: songs },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      songs: existingSongs,
      message: existingSongs.length
        ? `AI 歌单刷新失败，沿用已有 ${existingSongs.length} 首歌曲：${reason}`
        : `AI 歌单刷新失败，改用规则取歌：${reason}`,
      preset,
    };
  }
}

// ===== 预设节目 (Program Presets) =====
// 预设节目是纯配置模板（不生成音频），供流程编排引用。
function rowToProgramPreset(row) {
  if (!row) {
    return null;
  }
  let payload = {};
  try {
    payload = JSON.parse(row.payload ?? "{}");
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    name: row.name,
    type: payload.type ?? "custom",
    contentMode: payload.contentMode === "direct" ? "direct" : "ai",
    title: payload.title ?? row.name,
    categoryId: payload.categoryId ?? null,
    prompt: payload.prompt ?? "",
    hostId: payload.hostId ?? null,
    hostIds: Array.isArray(payload.hostIds) ? payload.hostIds : [],
    pluginKind: payload.pluginKind ?? null, // daily-briefing / hot-topics / kugou
    playbackSpeed: typeof payload.playbackSpeed === "number" ? payload.playbackSpeed : null,
    kugou: payload.kugou && typeof payload.kugou === "object" ? payload.kugou : null,
    songs: Array.isArray(payload.songs) ? payload.songs : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

app.get("/api/program-presets", requireAdmin, (request, response) => {
  const rows = db
    .prepare("SELECT * FROM program_presets ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC")
    .all()
    .map(rowToProgramPreset);
  response.json({ presets: rows });
});

app.post("/api/program-presets", requireAdmin, (request, response) => {
  const id = String(request.body?.id ?? "").trim() || randomUUID();
  const name = String(request.body?.name ?? "").trim() || "未命名预设";
  const payload = JSON.stringify({
    type: request.body?.type ?? "custom",
    contentMode: request.body?.contentMode === "direct" ? "direct" : "ai",
    title: request.body?.title ?? name,
    categoryId: request.body?.categoryId ?? null,
    prompt: request.body?.prompt ?? "",
    hostId: request.body?.hostId ?? null,
    hostIds: Array.isArray(request.body?.hostIds) ? request.body.hostIds : [],
    pluginKind: request.body?.pluginKind ?? null,
    playbackSpeed: normalizePlaybackSpeed(request.body?.playbackSpeed ?? readConfig().tts.speed),
    kugou: request.body?.kugou && typeof request.body.kugou === "object"
      ? {
          cardId: Number(request.body.kugou.cardId ?? 0),
          enabled: request.body.kugou.enabled !== false,
          hostId: String(request.body.kugou.hostId ?? "").trim() || null,
          maxSongs: Number(request.body.kugou.maxSongs ?? 5),
          name: String(request.body.kugou.name ?? "").trim(),
          provider: normalizeMusicProvider(request.body.kugou.provider),
          quality: String(request.body.kugou.quality ?? "128").trim(),
          rankType: Number(request.body.kugou.rankType ?? 0),
          searchKeywords: String(request.body.kugou.searchKeywords ?? "").trim(),
          source: String(request.body.kugou.source ?? "new").trim(),
          useAiScript: request.body.kugou.useAiScript !== false,
        }
      : null,
    songs: Array.isArray(request.body?.songs)
      ? request.body.songs.map(normalizeMusicSong).filter((song) => song.title || song.hash || song.sourceId || song.albumAudioId)
      : [],
  });
  const now = nowIso();
  const existing = db.prepare("SELECT id FROM program_presets WHERE id = ?").get(id);
  if (existing) {
    db.prepare("UPDATE program_presets SET name = ?, payload = ?, updated_at = ? WHERE id = ?").run(name, payload, now, id);
  } else {
    db.prepare("INSERT INTO program_presets (id, name, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, name, payload, now, now);
  }
  const preset = rowToProgramPreset(db.prepare("SELECT * FROM program_presets WHERE id = ?").get(id));
  response.json({ preset, message: "预设节目已保存" });
});

app.delete("/api/program-presets/:id", requireAdmin, (request, response) => {
  const result = db.prepare("DELETE FROM program_presets WHERE id = ?").run(request.params.id);
  if (!result.changes) {
    response.status(404).json({ message: "预设节目不存在" });
    return;
  }
  response.json({ message: "预设节目已删除" });
});

app.get("/api/music-playlists", requireAdmin, (request, response) => {
  const playlists = db
    .prepare("SELECT * FROM music_playlists ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC")
    .all()
    .map(rowToMusicPlaylist);
  response.json({ playlists, total: playlists.length });
});

app.post("/api/music-playlists", requireAdmin, (request, response) => {
  const requestedId = String(request.body?.id ?? "").trim();
  const id = requestedId || randomUUID();
  const existingRow = db.prepare("SELECT * FROM music_playlists WHERE id = ?").get(id);
  const existing = rowToMusicPlaylist(existingRow);
  const requestedMode = request.body?.playbackMode;
  if (
    requestedMode !== undefined &&
    !["sequential", "shuffle"].includes(String(requestedMode).trim().toLowerCase())
  ) {
    response.status(400).json({
      message: "播放模式无效",
      error: "playbackMode 仅支持 sequential 或 shuffle",
    });
    return;
  }

  const name = String(request.body?.name ?? existing?.name ?? "").trim() || "未命名歌单";
  const songs = Array.isArray(request.body?.songs)
    ? normalizeMusicPlaylistSongs(request.body.songs)
    : (existing?.songs ?? []);
  const playbackMode = normalizeMusicPlaybackMode(requestedMode ?? existing?.playbackMode);
  const timestamp = nowIso();
  if (existingRow) {
    db.prepare(`
      UPDATE music_playlists
      SET name = ?, songs_json = ?, playback_mode = ?, updated_at = ?
      WHERE id = ?
    `).run(name, JSON.stringify(songs), playbackMode, timestamp, id);
  } else {
    db.prepare(`
      INSERT INTO music_playlists (id, name, songs_json, playback_mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, JSON.stringify(songs), playbackMode, timestamp, timestamp);
  }

  const playlist = readMusicPlaylistById(id);
  response.json({
    playlist,
    message: `自定义歌单已保存：${playlist.songCount} 首，${playbackMode === "shuffle" ? "随机播放" : "顺序播放"}`,
  });
});

app.delete("/api/music-playlists/:id", requireAdmin, (request, response) => {
  const playlistId = String(request.params.id ?? "").trim();
  const playlist = readMusicPlaylistById(playlistId);
  const result = db.transaction(() => {
    const deleted = db.prepare("DELETE FROM music_playlists WHERE id = ?").run(playlistId);
    if (!deleted.changes) {
      return deleted;
    }
    const flowRows = db.prepare("SELECT id, payload FROM flow_presets").all();
    const updateFlow = db.prepare("UPDATE flow_presets SET payload = ?, updated_at = ? WHERE id = ?");
    for (const row of flowRows) {
      try {
        const payload = JSON.parse(row.payload ?? "{}");
        if (String(payload.autoFillPlaylistId ?? "").trim() !== playlistId) {
          continue;
        }
        updateFlow.run(JSON.stringify({
          ...payload,
          autoFillPlaylistId: null,
          autoFillPlaybackMode: normalizeMusicPlaybackMode(
            payload.autoFillPlaybackMode,
            playlist?.playbackMode ?? "sequential",
          ),
          autoFillSongs: normalizeMusicPlaylistSongs(payload.autoFillSongs?.length ? payload.autoFillSongs : playlist?.songs),
        }), nowIso(), row.id);
      } catch {
        // Keep malformed legacy flow payloads untouched; deleting the playlist must still succeed.
      }
    }
    return deleted;
  })();
  if (!result.changes) {
    response.status(404).json({ message: "自定义歌单不存在" });
    return;
  }
  response.json({ id: playlistId, message: "自定义歌单已删除，引用它的流程已保留歌曲并解除关联" });
});

app.get("/api/flow-presets", requireAdmin, (request, response) => {
  const rows = db
    .prepare("SELECT * FROM flow_presets ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC")
    .all()
    .map(rowToFlowPreset);
  response.json({ presets: rows });
});

app.post("/api/flow-presets", requireAdmin, (request, response) => {
  const id = String(request.body?.id ?? "").trim() || randomUUID();
  const existingRow = db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(id);
  const existingPreset = rowToFlowPreset(existingRow);
  const name = String(request.body?.name ?? "").trim() || "未命名流程";
  const nodes = Array.isArray(request.body?.nodes) ? request.body.nodes : [];
  const publishDate = normalizePublishDate(request.body?.publishDate);
  const scheduledTime = /^\d{2}:\d{2}$/u.test(String(request.body?.scheduledTime ?? "").trim())
    ? String(request.body?.scheduledTime).trim()
    : null;
  const enabled = request.body?.enabled === false ? 0 : 1;
  const autoFillEnabled = request.body?.autoFillEnabled !== false;
  const autoFillKeywords = String(request.body?.autoFillKeywords ?? "").trim();
  const autoFillProvider = normalizeMusicProvider(request.body?.autoFillProvider ?? existingPreset?.autoFillProvider, "auto");
  const autoFillRestartFromBeginning = Object.prototype.hasOwnProperty.call(request.body ?? {}, "autoFillRestartFromBeginning")
    ? Boolean(request.body.autoFillRestartFromBeginning)
    : Boolean(existingPreset?.autoFillRestartFromBeginning);
  const hasPlaylistId = Object.prototype.hasOwnProperty.call(request.body ?? {}, "autoFillPlaylistId");
  const autoFillPlaylistId = hasPlaylistId
    ? request.body.autoFillPlaylistId
    : existingPreset?.autoFillPlaylistId;
  const hasPlaybackMode = Object.prototype.hasOwnProperty.call(request.body ?? {}, "autoFillPlaybackMode");
  const autoFillPlaybackMode = hasPlaybackMode
    ? request.body.autoFillPlaybackMode
    : (hasPlaylistId ? undefined : existingPreset?.autoFillPlaybackMode);
  const selection = resolveAutoFillPlaylistState({
    autoFillPlaybackMode,
    autoFillPlaylistId,
    autoFillSongs: Array.isArray(request.body?.autoFillSongs)
      ? request.body.autoFillSongs
      : existingPreset?.autoFillSongs,
  });
  if (selection.playlistId && !selection.playlist) {
    response.status(404).json({ message: "选择的自定义歌单不存在", playlistId: selection.playlistId });
    return;
  }
  const payload = JSON.stringify({
    autoFillEnabled,
    autoFillKeywords,
    autoFillProvider,
    autoFillRestartFromBeginning,
    autoFillPlaybackMode: selection.playbackMode,
    autoFillPlaylistId: selection.playlistId,
    autoFillSongs: selection.songs,
    nodes,
    publishDate,
  });
  const now = nowIso();

  if (existingRow) {
    db.prepare(`
      UPDATE flow_presets
      SET name = ?, payload = ?, scheduled_time = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(name, payload, scheduledTime, enabled, now, id);
  } else {
    db.prepare(`
      INSERT INTO flow_presets (id, name, payload, scheduled_time, enabled, last_run_at, last_run_summary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)
    `).run(id, name, payload, scheduledTime, enabled, now, now);
  }

  const preset = rowToFlowPreset(db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(id));
  response.json({ preset, message: "流程预设已保存" });
});

app.post("/api/flow-presets/:id/auto-fill/apply", requireAdmin, async (request, response) => {
  const row = db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(request.params.id);
  if (!row) {
    response.status(404).json({ message: "流程预设不存在" });
    return;
  }

  const publishDate = normalizePublishDate(request.body?.publishDate) || localDateString();
  const autoFillEnabled = request.body?.autoFillEnabled !== false;
  const autoFillKeywords = String(request.body?.autoFillKeywords ?? "").trim();
  const currentPreset = rowToFlowPreset(row);
  const autoFillProvider = normalizeMusicProvider(request.body?.autoFillProvider ?? currentPreset.autoFillProvider, "auto");
  const autoFillRestartFromBeginning = Object.prototype.hasOwnProperty.call(request.body ?? {}, "autoFillRestartFromBeginning")
    ? Boolean(request.body.autoFillRestartFromBeginning)
    : Boolean(currentPreset.autoFillRestartFromBeginning);
  const hasPlaylistId = Object.prototype.hasOwnProperty.call(request.body ?? {}, "autoFillPlaylistId");
  const autoFillPlaylistId = hasPlaylistId
    ? request.body.autoFillPlaylistId
    : currentPreset.autoFillPlaylistId;
  const hasPlaybackMode = Object.prototype.hasOwnProperty.call(request.body ?? {}, "autoFillPlaybackMode");
  const autoFillPlaybackMode = hasPlaybackMode
    ? request.body.autoFillPlaybackMode
    : (hasPlaylistId ? undefined : currentPreset.autoFillPlaybackMode);
  const selection = resolveAutoFillPlaylistState({
    autoFillPlaybackMode,
    autoFillPlaylistId,
    autoFillSongs: Array.isArray(request.body?.autoFillSongs)
      ? request.body.autoFillSongs
      : currentPreset.autoFillSongs,
  });
  if (selection.playlistId && !selection.playlist) {
    response.status(404).json({ message: "选择的自定义歌单不存在", playlistId: selection.playlistId });
    return;
  }
  const incomingSongs = selection.songs;
  let preset = updateFlowPresetAutoFill(row, {
    autoFillEnabled,
    autoFillKeywords,
    autoFillProvider,
    autoFillRestartFromBeginning,
    autoFillPlaybackMode: selection.playbackMode,
    autoFillPlaylistId: selection.playlistId,
    autoFillSongs: incomingSongs,
    publishDate,
  });

  if (!autoFillEnabled) {
    response.json({
      preset,
      program: null,
      programs: readProgramList(),
      songs: [],
      musicPlaylist: selection.playlist,
      playbackMode: selection.playbackMode,
      message: "音乐连播已在流程中关闭；已保存流程设置",
    });
    return;
  }

  try {
    const config = readConfig();
    const { playlist, songs } = await buildFlowFillerPlaylist(
      config,
      incomingSongs,
      autoFillKeywords,
      publishDate,
      { playbackMode: selection.playbackMode, playlistId: selection.playlistId, provider: autoFillProvider },
    );
    const latestPresetRow = db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(request.params.id);
    if (latestPresetRow) {
      preset = updateFlowPresetAutoFill(latestPresetRow, {
        autoFillEnabled,
        autoFillKeywords,
        autoFillProvider,
        autoFillRestartFromBeginning,
        autoFillPlaybackMode: selection.playbackMode,
        autoFillPlaylistId: selection.playlistId,
        autoFillSongs: songs,
        publishDate,
      });
    }
    const firstAudio = playlist.find((item) => item.audioUrl);
    const existing = readFlowFillerProgramForDate(publishDate);
    const timestamp = nowIso();
    const commonPatch = {
      title: "音乐连播",
      host: hostProfiles[4]?.name ?? hostProfiles[0].name,
      prompt: "流程编排 · 音乐连播",
      script: "",
      segmentsJson: "[]",
      playlistJson: JSON.stringify(playlist),
      status: firstAudio ? "ready" : "script_saved",
      audioUrl: firstAudio?.audioUrl ?? null,
      audioPath: firstAudio?.audioPath ?? null,
      sortOrder: existing?.sortOrder ?? nextProgramSortOrder(),
      scheduledAt: null,
      sourceType: "flow-filler",
      pluginId: "kugou-music",
      musicPlaylistId: selection.playlistId,
      playbackMode: selection.playbackMode,
      playbackResetAt: selection.playbackMode === "sequential" && autoFillRestartFromBeginning ? timestamp : existing?.playbackResetAt ?? null,
      restartFromBeginning: selection.playbackMode === "sequential" && autoFillRestartFromBeginning,
      fillerTimeline: [],
      categoryId: defaultCategoryIdForName("音乐专题"),
      playbackSpeed: 1,
      publishDate,
      publishedAt: existing?.publishedAt || timestamp,
      llmModel: "规则编排",
      ttsModel: null,
      errorMessage: null,
    };

    let program;
    if (existing) {
      program = updateProgram(existing.id, commonPatch);
    } else {
      const id = randomUUID();
      insertProgram({
        id,
        ...commonPatch,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      program = readProgramById(id);
    }

    response.json({
      preset,
      program,
      programs: readProgramList(),
      songs,
      musicPlaylist: selection.playlist,
      playbackMode: selection.playbackMode,
      message: `音乐连播已立即应用：${playlist.length} 首歌曲（${selection.playbackMode === "shuffle" ? "随机播放" : autoFillRestartFromBeginning ? "从第一首开始顺序播放" : "顺序播放"}）`,
    });
  } catch (error) {
    response.status(502).json({
      preset,
      program: null,
      programs: readProgramList(),
      songs: [],
      message: "音乐连播应用失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/programs/:id/filler/top-up", async (request, response) => {
  const programId = String(request.params.id ?? "").trim();
  if (!programId) {
    response.status(400).json({ message: "缺少音乐连播节目 ID" });
    return;
  }
  const effectiveFillerElapsed = Number(request.body?.effectiveFillerElapsed);
  if (!Number.isFinite(effectiveFillerElapsed) || effectiveFillerElapsed <= 0) {
    response.status(400).json({ message: "续批缺少有效的时间轴生效位置" });
    return;
  }

  if (fillerTopUpRunning.has(programId)) {
    const program = readProgramById(programId);
    response.status(202).json({
      program,
      programs: readProgramList(),
      addedSongs: [],
      running: true,
      totalSongs: programPlaylistSongs(program).length,
      message: "音乐连播正在续批，请稍后刷新",
    });
    return;
  }

  fillerTopUpRunning.add(programId);
  try {
    const result = await topUpFlowFillerProgram(programId, {
      batchSize: Number(request.body?.batchSize ?? FLOW_FILLER_TOP_UP_BATCH_SONGS),
      effectiveFillerElapsed,
      maxSongs: Number(request.body?.maxSongs ?? FLOW_FILLER_TARGET_SONGS),
    });
    response.json({
      ...result,
      programs: readProgramList(),
      batchSize: FLOW_FILLER_TOP_UP_BATCH_SONGS,
      threshold: FLOW_FILLER_TOP_UP_THRESHOLD,
    });
  } catch (error) {
    response.status(502).json({
      program: readProgramById(programId),
      programs: readProgramList(),
      addedSongs: [],
      message: "音乐连播续批失败",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    fillerTopUpRunning.delete(programId);
  }
});

app.delete("/api/flow-presets/:id", requireAdmin, (request, response) => {
  const result = db.prepare("DELETE FROM flow_presets WHERE id = ?").run(request.params.id);
  if (!result.changes) {
    response.status(404).json({ message: "流程预设不存在" });
    return;
  }
  response.json({ message: "流程预设已删除" });
});

app.patch("/api/flow-presets/:id/schedule", requireAdmin, (request, response) => {
  const existing = db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(request.params.id);
  if (!existing) {
    response.status(404).json({ message: "流程预设不存在" });
    return;
  }
  const scheduledTime = request.body?.scheduledTime === null || request.body?.scheduledTime === ""
    ? null
    : (/^\d{2}:\d{2}$/u.test(String(request.body?.scheduledTime ?? "").trim()) ? String(request.body.scheduledTime).trim() : existing.scheduled_time);
  const enabled = typeof request.body?.enabled === "boolean" ? (request.body.enabled ? 1 : 0) : existing.enabled;
  db.prepare("UPDATE flow_presets SET scheduled_time = ?, enabled = ?, updated_at = ? WHERE id = ?")
    .run(scheduledTime, enabled, nowIso(), request.params.id);
  const preset = rowToFlowPreset(db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(request.params.id));
  response.json({ preset, message: "定时设置已更新" });
});

const flowSchedulerRunning = new Set(); // 正在运行的预设 id，防止并发重复

function flowElapsedSeconds(startedAt) {
  const start = new Date(startedAt).getTime();
  return Number.isNaN(start) ? 0 : Math.max(0, Math.round((Date.now() - start) / 1000));
}

function flowResultStats(results) {
  return {
    ready: results.filter((r) => r.status === "ready").length,
    partial: results.filter((r) => r.status === "partial").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
  };
}

function buildFlowRunSummary({
  currentMessage = "",
  currentNode = null,
  currentStage = "",
  finishedAt = null,
  items = [],
  publishDate,
  runAt,
  status = "running",
  total = 0,
}) {
  const stats = flowResultStats(items);
  const updatedAt = nowIso();
  return {
    runAt,
    startedAt: runAt,
    updatedAt,
    finishedAt,
    publishDate,
    status,
    total,
    ...stats,
    done: items.length,
    elapsedSeconds: flowElapsedSeconds(runAt),
    currentStage,
    currentMessage,
    currentNode,
    items,
  };
}

function currentFlowRunSummary(id) {
  const row = db.prepare("SELECT last_run_summary FROM flow_presets WHERE id = ?").get(id);
  if (!row?.last_run_summary) {
    return null;
  }
  try {
    return JSON.parse(row.last_run_summary);
  } catch {
    return null;
  }
}

function normalizeFlowRunSummaryForStatus(preset) {
  let summary = null;
  try {
    summary = preset.lastRunSummary ? JSON.parse(preset.lastRunSummary) : null;
  } catch {
    summary = null;
  }

  if (summary?.status === "running" && !flowSchedulerRunning.has(preset.id)) {
    const finishedAt = nowIso();
    const items = Array.isArray(summary.items) ? summary.items : [];
    summary = {
      ...summary,
      updatedAt: finishedAt,
      finishedAt,
      status: "failed",
      failed: Math.max(Number(summary.failed ?? 0), 1),
      elapsedSeconds: flowElapsedSeconds(summary.startedAt || summary.runAt),
      currentStage: "生成已中断",
      currentMessage: "上次生成任务没有运行进程，可能是服务重启或后台任务异常退出。",
      items,
    };
    db.prepare("UPDATE flow_presets SET last_run_summary = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(summary), finishedAt, preset.id);
  }

  return summary;
}

function markInterruptedFlowRunsOnStartup() {
  const presets = db
    .prepare("SELECT * FROM flow_presets WHERE last_run_summary LIKE ?")
    .all('%"status":"running"%')
    .map(rowToFlowPreset);
  for (const preset of presets) {
    normalizeFlowRunSummaryForStatus(preset);
  }
}

markInterruptedFlowRunsOnStartup();

function markFlowRunFailed(preset, publishDate, error) {
  const runAt = nowIso();
  const message = error instanceof Error ? error.message : String(error);
  const summary = buildFlowRunSummary({
    currentMessage: message,
    currentNode: null,
    currentStage: "生成失败",
    finishedAt: runAt,
    items: [{
      title: preset.name,
      kind: "flow",
      startTime: null,
      status: "failed",
      message,
      programId: null,
    }],
    publishDate,
    runAt,
    status: "failed",
    total: 1,
  });
  db.prepare("UPDATE flow_presets SET last_run_at = ?, last_run_summary = ?, updated_at = ? WHERE id = ?")
    .run(runAt, JSON.stringify(summary), runAt, preset.id);
  return summary;
}

// 执行流程预设的核心逻辑（端点与定时任务共用）。
async function runFlowPreset(preset, publishDate, options = {}) {
  const config = readConfig();
  let workingPreset = preset;
  const resolvedPublishDate = normalizePublishDate(publishDate) || normalizePublishDate(workingPreset.publishDate) || localDateString();
  const startedAt = nowIso();

  const orderedNodes = workingPreset.nodes
    .filter((node) => node && node.type === "scheduled")
    .map((node, idx) => ({ node, sortKey: String(node.startTime ?? ""), idx }))
    .sort((a, b) => {
      const timeDiff = a.sortKey.localeCompare(b.sortKey);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.idx - b.idx;
    })
    .map((entry) => entry.node);
  const plannedTotal = orderedNodes.length + (workingPreset.autoFillEnabled === false ? 0 : 1);
  const results = [];
  const saveSummary = (patch = {}) => {
    const summary = buildFlowRunSummary({
      currentMessage: patch.currentMessage ?? "",
      currentNode: patch.currentNode ?? null,
      currentStage: patch.currentStage ?? "准备生成",
      finishedAt: patch.finishedAt ?? null,
      items: results,
      publishDate: resolvedPublishDate,
      runAt: startedAt,
      status: patch.status ?? "running",
      total: plannedTotal,
    });
    db.prepare("UPDATE flow_presets SET last_run_summary = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(summary), summary.updatedAt, preset.id);
    return summary;
  };

  db.prepare("UPDATE flow_presets SET last_run_at = ?, last_run_summary = ?, updated_at = ? WHERE id = ?")
    .run(
      startedAt,
      JSON.stringify(buildFlowRunSummary({
        currentMessage: `计划处理 ${plannedTotal} 个节点`,
        currentStage: "启动生成任务",
        items: [],
        publishDate: resolvedPublishDate,
        runAt: startedAt,
        status: "running",
        total: plannedTotal,
      })),
      startedAt,
      preset.id,
    );
  const savedPlaylistState = resolveAutoFillPlaylistState({
    autoFillPlaybackMode: workingPreset.autoFillPlaybackMode,
    autoFillPlaylistId: workingPreset.autoFillPlaylistId,
    autoFillSongs: workingPreset.autoFillSongs,
  });
  if (savedPlaylistState.playlist) {
    workingPreset = {
      ...workingPreset,
      autoFillPlaylistName: savedPlaylistState.playlist.name,
      autoFillSongs: savedPlaylistState.songs,
    };
  }
  let autoFillSongs = savedPlaylistState.songs;
  let autoFillMessage = workingPreset.autoFillPlaylistId
    ? `沿用保存的自定义歌单：${autoFillSongs.length} 首（${workingPreset.autoFillPlaybackMode === "shuffle" ? "随机播放" : "顺序播放"}）`
    : (autoFillSongs.length ? `沿用已有音乐连播歌单：${autoFillSongs.length} 首` : "");
  if (
    workingPreset.autoFillEnabled !== false &&
    options.refreshAutoFillSongs !== false &&
    !workingPreset.autoFillPlaylistId
  ) {
    saveSummary({
      currentMessage: "正在调用大模型生成音乐连播歌曲候选，并解析可播放地址。",
      currentNode: {
        index: orderedNodes.length + 1,
        kind: "kugou-random",
        startTime: null,
        title: "音乐连播",
        total: plannedTotal,
      },
      currentStage: "刷新音乐连播歌单",
    });
    const refreshed = await refreshFlowAutoFillSongsForRun(config, workingPreset, resolvedPublishDate);
    autoFillSongs = refreshed.songs;
    autoFillMessage = refreshed.message;
    workingPreset = refreshed.preset ?? { ...workingPreset, autoFillSongs };
    saveSummary({
      currentMessage: autoFillMessage,
      currentStage: "音乐连播歌单已准备",
    });
  }
  // 新版流程只生成定时节目；空闲时段由流程级“音乐连播”补齐。
  const autoFillNode = workingPreset.autoFillEnabled === false
    ? null
      : {
        id: "auto-filler-music",
        type: "filler",
        kind: "kugou-random",
        title: "音乐连播",
        keywords: workingPreset.autoFillKeywords ?? "",
        musicPlaylistId: workingPreset.autoFillPlaylistId ?? null,
        playbackMode: normalizeMusicPlaybackMode(workingPreset.autoFillPlaybackMode),
        provider: workingPreset.autoFillProvider,
        restartFromBeginning: Boolean(workingPreset.autoFillRestartFromBeginning),
        songs: autoFillSongs,
        aiSongMessage: autoFillMessage,
        transitionBefore: null,
      };
  const runNodes = autoFillNode ? [...orderedNodes, autoFillNode] : orderedNodes;

  let counter = 0;
  const ctx = { publishDate: resolvedPublishDate, nextSort: () => ++counter };
  saveSummary({
    currentMessage: runNodes.length ? `即将处理：${runNodes[0].title || runNodes[0].kind || runNodes[0].type}` : "没有可处理节点",
    currentStage: runNodes.length ? "开始处理节目节点" : "没有节点",
  });
  for (const [index, node] of runNodes.entries()) {
    const title = node.title || node.kind || node.type;
    saveSummary({
      currentMessage: `正在处理第 ${index + 1}/${plannedTotal} 个节点：${title}`,
      currentNode: {
        index: index + 1,
        kind: node.kind,
        startTime: node.startTime || null,
        title,
        total: plannedTotal,
      },
      currentStage: "正在处理节点",
    });
    try {
      const result = await generateProgramFromNode(config, node, ctx);
      results.push({
        title,
        kind: node.kind,
        startTime: node.startTime || null,
        status: result.skipped ? "skipped" : result.program ? (result.program.status === "ready" ? "ready" : "partial") : "failed",
        message: result.message,
        programId: result.program?.id ?? null,
      });
    } catch (error) {
      results.push({
        title,
        kind: node.kind,
        startTime: node.startTime || null,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
        programId: null,
      });
    }
    saveSummary({
      currentMessage: `${title} 已处理完成`,
      currentStage: "节点完成",
    });
  }

  const finishedAt = nowIso();
  const summary = buildFlowRunSummary({
    currentMessage: `生成完成：成功 ${flowResultStats(results).ready}，部分 ${flowResultStats(results).partial}，跳过 ${flowResultStats(results).skipped}，失败 ${flowResultStats(results).failed}`,
    currentNode: null,
    currentStage: "生成完成",
    finishedAt,
    items: results,
    publishDate: resolvedPublishDate,
    runAt: startedAt,
    status: "complete",
    total: plannedTotal,
  });
  db.prepare("UPDATE flow_presets SET last_run_at = ?, last_run_summary = ?, updated_at = ? WHERE id = ?")
    .run(summary.finishedAt, JSON.stringify(summary), summary.updatedAt, preset.id);
  return summary;
}

app.post("/api/flow-presets/:id/run", requireAdmin, async (request, response) => {
  try {
    const preset = rowToFlowPreset(db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(request.params.id));
    if (!preset) {
      response.status(404).json({ message: "流程预设不存在" });
      return;
    }

    if (flowSchedulerRunning.has(preset.id)) {
      response.status(202).json({
        summary: currentFlowRunSummary(preset.id),
        running: true,
        programs: readProgramList(),
        message: "流程正在生成中，请稍候刷新运行结果",
      });
      return;
    }

    const resolvedPublishDate = normalizePublishDate(request.body?.publishDate) || normalizePublishDate(preset.publishDate) || localDateString();
    flowSchedulerRunning.add(preset.id);
    const refreshAutoFillSongs = request.body?.refreshAutoFillSongs !== false;
    runFlowPreset(preset, resolvedPublishDate, { refreshAutoFillSongs })
      .catch((error) => {
        markFlowRunFailed(preset, resolvedPublishDate, error);
        console.error(`[flow] 预设「${preset.name}」手动生成失败：`, error instanceof Error ? error.message : error);
      })
      .finally(() => {
        flowSchedulerRunning.delete(preset.id);
      });

    response.status(202).json({
      summary: currentFlowRunSummary(preset.id),
      running: true,
      programs: readProgramList(),
      message: "流程已开始生成，页面会自动刷新运行结果",
    });
  } catch (error) {
    response.status(500).json({
      message: "流程执行失败",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/flow-presets/:id/runs", requireAdmin, (request, response) => {
  const preset = rowToFlowPreset(db.prepare("SELECT * FROM flow_presets WHERE id = ?").get(request.params.id));
  if (!preset) {
    response.status(404).json({ message: "流程预设不存在" });
    return;
  }
  const summary = normalizeFlowRunSummaryForStatus(preset);
  response.json({ lastRunAt: preset.lastRunAt, running: flowSchedulerRunning.has(preset.id), summary });
});

// ===== 附件管理：音频文件列表、多选删除、一键清理、定时清理 =====

function classifyAudioFile(fileName) {
  if (/^host-preview-/u.test(fileName)) {
    return "host-preview";
  }
  if (/-segment-\d+/u.test(fileName) || /-local-\d+/u.test(fileName) || /-talk-\d+-segment-/u.test(fileName)) {
    return "segment";
  }
  if (/-talk-\d+/u.test(fileName)) {
    return "segment";
  }
  return "program";
}

function addReferencedAudioName(referenced, value) {
  if (!value) {
    return;
  }
  const name = String(value).split("/").pop();
  if (name) {
    referenced.add(name);
  }
}

function collectAudioNamesFromJson(referenced, value) {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectAudioNamesFromJson(referenced, item);
    }
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (["audioUrl", "audioPath", "audio_url", "audio_path"].includes(key)) {
      addReferencedAudioName(referenced, child);
      continue;
    }
    collectAudioNamesFromJson(referenced, child);
  }
}

function collectReferencedAudioNames() {
  const referenced = new Set();
  const rows = [
    ...db.prepare("SELECT audio_url, audio_path, segments_json, playlist_json FROM programs").all(),
    ...db.prepare("SELECT audio_url, NULL AS audio_path, segments_json, playlist_json FROM program_archives").all(),
  ];
  for (const row of rows) {
    for (const field of [row.audio_url, row.audio_path]) {
      addReferencedAudioName(referenced, field);
    }
    for (const jsonField of [row.segments_json, row.playlist_json]) {
      if (!jsonField) {
        continue;
      }
      try {
        collectAudioNamesFromJson(referenced, JSON.parse(jsonField));
      } catch {
        // ignore parse errors
      }
    }
  }
  return referenced;
}

function collectAudioFiles() {
  const referenced = collectReferencedAudioNames();
  let entries = [];
  try {
    entries = fs.readdirSync(audioDir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => /\.(wav|mp3|aac|opus|ogg|m4a)$/iu.test(name))
    .map((name) => {
      let stat;
      try {
        stat = fs.statSync(path.join(audioDir, name));
      } catch {
        return null;
      }
      return {
        name,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        type: classifyAudioFile(name),
        referenced: referenced.has(name),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

function deleteAudioFilesByName(names, options = {}) {
  const valid = new Set(
    fs.existsSync(audioDir) ? fs.readdirSync(audioDir) : [],
  );
  const referenced = options.force ? new Set() : collectReferencedAudioNames();
  const deleted = [];
  const failed = [];
  for (const name of names) {
    // 安全检查：只删除 audioDir 内的文件，拒绝路径穿越。
    if (!name || name.includes("/") || name.includes("..") || name.includes("\\")) {
      failed.push(name);
      continue;
    }
    if (!valid.has(name)) {
      continue;
    }
    if (referenced.has(name)) {
      failed.push(name);
      continue;
    }
    try {
      fs.unlinkSync(path.join(audioDir, name));
      deleted.push(name);
    } catch {
      failed.push(name);
    }
  }
  return { deleted, failed };
}

function runStorageCleanup(mode, options = {}) {
  const files = collectAudioFiles();
  const now = Date.now();
  const maxAgeMs = Number.isFinite(options.maxAgeDays) && options.maxAgeDays > 0
    ? options.maxAgeDays * 24 * 3600 * 1000
    : 0;
  const keepProgramAudio = options.keepProgramAudio !== false;

  let targets = [];
  switch (mode) {
    case "orphaned":
      targets = files.filter((f) => !f.referenced);
      break;
    case "previews":
      targets = files.filter((f) => f.type === "host-preview");
      break;
    case "old":
      targets = files.filter((f) => {
        if (keepProgramAudio && f.referenced) {
          return false;
        }
        if (!maxAgeMs) {
          return false;
        }
        return now - new Date(f.mtime).getTime() > maxAgeMs;
      });
      break;
    case "all-unlinked":
      targets = files.filter((f) => !f.referenced);
      break;
    default:
      return { deleted: [], failed: [], totalSize: 0 };
  }

  const names = targets.map((f) => f.name);
  const totalSize = targets.reduce((sum, f) => sum + f.size, 0);
  const result = deleteAudioFilesByName(names);
  return { ...result, totalSize };
}

app.get("/api/storage/audio-files", requireAdmin, (request, response) => {
  const files = collectAudioFiles();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const byType = {};
  for (const f of files) {
    byType[f.type] = (byType[f.type] ?? 0) + 1;
  }
  response.json({ files, totalSize, count: files.length, byType });
});

app.delete("/api/storage/audio-files", requireAdmin, (request, response) => {
  const names = Array.isArray(request.body?.files) ? request.body.files.map(String).filter(Boolean) : [];
  if (!names.length) {
    response.status(400).json({ message: "未选择任何文件" });
    return;
  }
  const result = deleteAudioFilesByName(names);
  const files = collectAudioFiles();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  response.json({
    ...result,
    files,
    totalSize,
    count: files.length,
    message: `已删除 ${result.deleted.length} 个文件${result.failed.length ? `，${result.failed.length} 个失败` : ""}`,
  });
});

app.post("/api/storage/cleanup", requireAdmin, (request, response) => {
  const mode = String(request.body?.mode ?? "").trim();
  const validModes = ["orphaned", "previews", "old", "all-unlinked"];
  if (!validModes.includes(mode)) {
    response.status(400).json({ message: `无效的清理模式：${mode}` });
    return;
  }
  const config = readConfig();
  const result = runStorageCleanup(mode, {
    maxAgeDays: Number(request.body?.maxAgeDays ?? config.storage.autoCleanupMaxAgeDays),
    keepProgramAudio: request.body?.keepProgramAudio !== false,
  });
  const files = collectAudioFiles();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const modeLabel = { orphaned: "孤立文件", previews: "主播试听", old: "过期文件", "all-unlinked": "未引用文件" }[mode];
  response.json({
    ...result,
    files,
    totalSize,
    count: files.length,
    message: `「${modeLabel}」清理完成：删除 ${result.deleted.length} 个文件，释放 ${(result.totalSize / 1024 / 1024).toFixed(1)} MB`,
  });
});

app.get("/api/storage/config", requireAdmin, (request, response) => {
  response.json({ storage: readConfig().storage });
});

app.put("/api/storage/config", requireAdmin, (request, response) => {
  const config = readConfig();
  const next = {
    ...config.storage,
    autoCleanupEnabled: Boolean(request.body?.autoCleanupEnabled),
    autoCleanupMaxAgeDays: clampNumber(request.body?.autoCleanupMaxAgeDays, 1, 365, 7),
    autoCleanupKeepProgramAudio: request.body?.autoCleanupKeepProgramAudio !== false,
  };
  const savedAt = nowIso();
  db.prepare(`
    INSERT INTO configs (service, payload, updated_at)
    VALUES ('storage', ?, ?)
    ON CONFLICT(service) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).run(JSON.stringify(next), savedAt);
  response.json({ storage: next, message: "自动清理配置已保存" });
});

if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.use((request, response, next) => {
    const wantsHtml = request.method === "GET" && String(request.headers.accept ?? "").includes("text/html");
    if (!wantsHtml || request.path.startsWith("/api/") || request.path.startsWith("/storage/")) {
      next();
      return;
    }
    response.sendFile(path.join(clientDistDir, "index.html"));
  });
}

app.listen(port, host, () => {
  console.log(`星声电台后台已启动：http://${host}:${port}`);
  console.log(`SQLite 数据库：${dbPath}`);
  if (fs.existsSync(clientDistDir)) {
    console.log(`前端静态文件：${clientDistDir}`);
  }
});

// ===== 流程编排：服务端定时生成（cron）=====
// 每分钟检查启用的流程预设，到目标时刻触发自动生成。避免引入额外依赖。
let flowLastRunMinute = ""; // 上次触发的 "YYYY-MM-DD HH:MM"，防止同一分钟多次触发

function tickFlowScheduler() {
  const now = new Date();
  const currentHM = localHourMinute(now);
  const minuteKey = localMinuteKey(now);
  if (minuteKey === flowLastRunMinute) {
    return; // 本分钟已处理过
  }

  const presets = db
    .prepare("SELECT * FROM flow_presets WHERE enabled = 1 AND scheduled_time = ?")
    .all(currentHM)
    .map(rowToFlowPreset)
    .filter((preset) => {
      if (!Array.isArray(preset.nodes) || !preset.nodes.length) {
        return false;
      }
      if (!preset.lastRunAt) {
        return true;
      }
      return localMinuteKey(new Date(preset.lastRunAt)) !== minuteKey;
    });

  if (!presets.length) {
    return;
  }
  flowLastRunMinute = minuteKey;

  for (const preset of presets) {
    if (flowSchedulerRunning.has(preset.id)) {
      continue;
    }
    flowSchedulerRunning.add(preset.id);
    // 每日定时任务按北京时间当天生成，避免保存流程时的固定日期导致每天重复生成同一天。
    const publishDate = localDateString(now);
    runFlowPreset(preset, publishDate, { refreshAutoFillSongs: true })
      .catch((error) => {
        console.error(`[flow] 预设「${preset.name}」定时生成失败：`, error instanceof Error ? error.message : error);
      })
      .finally(() => {
        flowSchedulerRunning.delete(preset.id);
      });
  }
}

setInterval(tickFlowScheduler, 30_000);
tickFlowScheduler();

// ===== 附件自动清理调度器 =====
// 每小时检查一次，当 autoCleanupEnabled 且距离上次清理超过 20 小时时，自动清理过期文件。
let storageCleanupLastCheckHour = "";

function tickStorageAutoCleanup() {
  const config = readConfig();
  if (!config.storage.autoCleanupEnabled) {
    return;
  }
  const now = new Date();
  const hourKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
  if (hourKey === storageCleanupLastCheckHour) {
    return;
  }
  storageCleanupLastCheckHour = hourKey;

  // 每天只跑一次：检查上次运行时间，24 小时内不重复。
  const lastRun = config.storage.autoCleanupLastRun;
  if (lastRun) {
    const lastDate = new Date(lastRun);
    if (!Number.isNaN(lastDate.getTime()) && now.getTime() - lastDate.getTime() < 20 * 3600 * 1000) {
      return;
    }
  }

  try {
    const result = runStorageCleanup("old", {
      maxAgeDays: config.storage.autoCleanupMaxAgeDays,
      keepProgramAudio: config.storage.autoCleanupKeepProgramAudio,
    });
    const savedAt = nowIso();
    const updated = { ...config.storage, autoCleanupLastRun: savedAt };
    db.prepare(`
      INSERT INTO configs (service, payload, updated_at)
      VALUES ('storage', ?, ?)
      ON CONFLICT(service) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `).run(JSON.stringify(updated), savedAt);
    if (result.deleted.length) {
      console.log(`[storage] 自动清理：删除 ${result.deleted.length} 个过期文件，释放 ${(result.totalSize / 1024 / 1024).toFixed(1)} MB`);
    }
  } catch (error) {
    console.error("[storage] 自动清理失败：", error instanceof Error ? error.message : error);
  }
}

setInterval(tickStorageAutoCleanup, 60 * 60 * 1000);
