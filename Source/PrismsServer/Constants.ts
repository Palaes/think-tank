/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="./Types.ts" />

// Default ports
const DEFAULT_SERVER_PORT = 8092;
const DEFAULT_TARGET_PORT = 7860;

// Paths
const resultsPath = SettingsUtil.getLocation("/ThinkTank/Prisms");

// File names
const DEFAULTS_FILE = 'defaults.json';
const SETTINGS_FILE = 'settings.json';
const HISTORY_FILE = 'history.json';
const QUEUE_FILE = 'queue.json';

// Image formatting
const IMAGE_SUFFIX = '.png';
const IMAGE_DIGITS = 5;

// Model paths
const DRAWTHINGS_MODELS_PATH = SettingsUtil.getLocation("/ThinkTank/Prisms/Models/DrawThings");
const ESRGAN_PATH = 'realesrgan-ncnn-vulkan';
const ESRGAN_MODELS_PATH = SettingsUtil.getLocation("/ThinkTank/Prisms/Models/RealESRGAN");