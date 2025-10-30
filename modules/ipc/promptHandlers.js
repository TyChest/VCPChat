// modules/ipc/promptHandlers.js
// 提示词模块的IPC处理器

const { ipcMain, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');

let AGENT_DIR = null;
let APP_DATA_ROOT = null;

/**
 * 初始化提示词处理器
 */
function initialize(options) {
    AGENT_DIR = options.AGENT_DIR;
    APP_DATA_ROOT = options.APP_DATA_ROOT_IN_PROJECT;

    // 确保预设目录存在
    const defaultPresetDir = path.join(APP_DATA_ROOT, 'systemPromptPresets');
    fs.ensureDirSync(defaultPresetDir);

    setupHandlers();
}

/**
 * 设置IPC处理器
 */
function setupHandlers() {
    // 加载预设列表
    ipcMain.handle('load-preset-prompts', async (event, presetPath) => {
        try {
            // 解析路径：支持相对路径（相对于项目根目录）和绝对路径
            let absolutePath = presetPath;
            if (!path.isAbsolute(presetPath)) {
                // 移除开头的 ./ 或 .\
                const cleanPath = presetPath.replace(/^\.[\/\\]/, '');
                // 如果路径以 AppData 开头，相对于 APP_DATA_ROOT
                if (cleanPath.startsWith('AppData')) {
                    absolutePath = path.join(APP_DATA_ROOT, cleanPath.substring('AppData'.length).replace(/^[\/\\]/, ''));
                } else {
                    // 否则相对于项目根目录（APP_DATA_ROOT 的父目录）
                    const projectRoot = path.dirname(APP_DATA_ROOT);
                    absolutePath = path.join(projectRoot, cleanPath);
                }
            }

            // 规范化路径
            absolutePath = path.resolve(absolutePath);

            console.log('[PromptHandlers] Loading presets from:', absolutePath);

            // 确保目录存在
            if (!await fs.pathExists(absolutePath)) {
                await fs.ensureDir(absolutePath);
                return { success: true, presets: [] };
            }

            // 读取目录中的所有文件
            const files = await fs.readdir(absolutePath);
            
            // 过滤出 .md 和 .txt 文件
            const presets = [];
            for (const file of files) {
                const ext = path.extname(file).toLowerCase();
                if (ext === '.md' || ext === '.txt') {
                    const filePath = path.join(absolutePath, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.isFile()) {
                        presets.push({
                            name: path.basename(file, ext),
                            path: filePath,
                            extension: ext,
                            size: stats.size,
                            modified: stats.mtime
                        });
                    }
                }
            }

            // 按修改时间排序（最新的在前）
            presets.sort((a, b) => b.modified - a.modified);

            return { success: true, presets };
        } catch (error) {
            console.error('[PromptHandlers] Error loading presets:', error);
            return { success: false, error: error.message };
        }
    });

    // 加载预设内容
    ipcMain.handle('load-preset-content', async (event, filePath) => {
        try {
            if (!await fs.pathExists(filePath)) {
                return { success: false, error: '文件不存在' };
            }

            const content = await fs.readFile(filePath, 'utf-8');
            return { success: true, content };
        } catch (error) {
            console.error('[PromptHandlers] Error loading preset content:', error);
            return { success: false, error: error.message };
        }
    });

    // 选择目录
    ipcMain.handle('select-directory', async (event) => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory', 'createDirectory'],
                title: '选择预设文件夹',
                buttonLabel: '选择'
            });

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return { success: false, canceled: true };
            }

            return { success: true, path: result.filePaths[0] };
        } catch (error) {
            console.error('[PromptHandlers] Error selecting directory:', error);
            return { success: false, error: error.message };
        }
    });

    // 获取当前激活的系统提示词（用于发送消息时）
    ipcMain.handle('get-active-system-prompt', async (event, agentId) => {
        try {
            const configPath = path.join(AGENT_DIR, `${agentId}.json`);
            
            if (!await fs.pathExists(configPath)) {
                return { success: false, error: 'Agent配置不存在' };
            }

            const config = await fs.readJson(configPath);
            const promptMode = config.promptMode || 'original';

            let systemPrompt = '';

            switch (promptMode) {
                case 'original':
                    systemPrompt = config.originalSystemPrompt || config.systemPrompt || '';
                    break;
                
                case 'modular':
                    // 格式化积木块
                    if (config.advancedSystemPrompt && typeof config.advancedSystemPrompt === 'object') {
                        const blocks = config.advancedSystemPrompt.blocks || [];
                        systemPrompt = blocks
                            .filter(block => !block.disabled)
                            .map(block => {
                                if (block.type === 'newline') {
                                    return '\n';
                                } else {
                                    let content = block.content || '';
                                    // 如果有轮换文本，使用选中的版本
                                    if (block.variants && block.variants.length > 0) {
                                        const selectedIndex = block.selectedVariant || 0;
                                        content = block.variants[selectedIndex] || content;
                                    }
                                    return content;
                                }
                            })
                            .join('');
                    } else if (typeof config.advancedSystemPrompt === 'string') {
                        systemPrompt = config.advancedSystemPrompt;
                    }
                    break;
                
                case 'preset':
                    systemPrompt = config.presetSystemPrompt || '';
                    break;
                
                default:
                    systemPrompt = config.systemPrompt || '';
            }

            return { success: true, systemPrompt, mode: promptMode };
        } catch (error) {
            console.error('[PromptHandlers] Error getting active system prompt:', error);
            return { success: false, error: error.message };
        }
    });

    // 程序化切换提示词模式（用于插件调用）
    ipcMain.handle('programmatic-set-prompt-mode', async (event, agentId, mode) => {
        try {
            if (!['original', 'modular', 'preset'].includes(mode)) {
                return { success: false, error: `Invalid mode: ${mode}` };
            }

            const configPath = path.join(AGENT_DIR, `${agentId}.json`);
            
            if (!await fs.pathExists(configPath)) {
                return { success: false, error: 'Agent配置不存在' };
            }

            const config = await fs.readJson(configPath);
            config.promptMode = mode;
            
            // 更新 systemPrompt 字段
            let systemPrompt = '';
            switch (mode) {
                case 'original':
                    systemPrompt = config.originalSystemPrompt || config.systemPrompt || '';
                    break;
                case 'modular':
                    if (config.advancedSystemPrompt && typeof config.advancedSystemPrompt === 'object') {
                        const blocks = config.advancedSystemPrompt.blocks || [];
                        systemPrompt = blocks
                            .filter(block => !block.disabled)
                            .map(block => {
                                if (block.type === 'newline') {
                                    return '\n';
                                } else {
                                    let content = block.content || '';
                                    if (block.variants && block.variants.length > 0) {
                                        const selectedIndex = block.selectedVariant || 0;
                                        content = block.variants[selectedIndex] || content;
                                    }
                                    return content;
                                }
                            })
                            .join('');
                    }
                    break;
                case 'preset':
                    systemPrompt = config.presetSystemPrompt || '';
                    break;
            }
            
            config.systemPrompt = systemPrompt;
            await fs.writeJson(configPath, config, { spaces: 2 });

            console.log(`[PromptHandlers] Programmatically switched agent ${agentId} to mode: ${mode}`);
            
            // 触发渲染进程的设置界面刷新
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('reload-agent-settings', { agentId });
                console.log(`[PromptHandlers] Sent reload-agent-settings event to renderer for agent: ${agentId}`);
            }
            
            return {
                success: true,
                mode,
                systemPrompt,
                message: `模式已切换到: ${mode}`
            };
        } catch (error) {
            console.error('[PromptHandlers] Error in programmatic-set-prompt-mode:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    initialize
};