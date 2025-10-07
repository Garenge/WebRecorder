// Electron应用主进程 - 原生FFmpeg集成示例
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
// 获取FFmpeg路径 - 优先使用extraResources中的ffmpeg
let ffmpegPath;

// 在打包后的应用中，优先使用extraResources中的ffmpeg
if (process.resourcesPath) {
    ffmpegPath = path.join(process.resourcesPath, 'ffmpeg');
    console.log('🔍 使用extraResources路径:', ffmpegPath);
} else {
    // 开发环境中使用ffmpeg-static
    try {
        ffmpegPath = require('ffmpeg-static');
        console.log('🔍 使用ffmpeg-static路径:', ffmpegPath);
    } catch (error) {
        console.log('⚠️ ffmpeg-static不可用:', error.message);
        ffmpegPath = path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg');
        console.log('🔍 使用本地ffmpeg-static路径:', ffmpegPath);
    }
}

// 如果主要路径不存在，尝试其他可能的路径
if (!fs.existsSync(ffmpegPath)) {
    console.log('🔍 尝试其他可能的FFmpeg路径...');
    
    const possiblePaths = [
        path.join(process.resourcesPath, 'ffmpeg'),
        path.join(__dirname, '..', 'Resources', 'ffmpeg'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        '/usr/local/bin/ffmpeg',
        '/opt/homebrew/bin/ffmpeg'
    ];
    
    for (const testPath of possiblePaths) {
        console.log('🔍 测试路径:', testPath);
        if (fs.existsSync(testPath)) {
            ffmpegPath = testPath;
            console.log('✅ 找到FFmpeg路径:', ffmpegPath);
            break;
        }
    }
}

// 验证FFmpeg路径
console.log('🔍 FFmpeg路径:', ffmpegPath);
console.log('🔍 文件存在:', fs.existsSync(ffmpegPath));
if (fs.existsSync(ffmpegPath)) {
    const stats = fs.statSync(ffmpegPath);
    console.log('🔍 文件类型:', stats.isFile() ? '文件' : '目录');
    console.log('🔍 文件大小:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
} else {
    console.error('❌ FFmpeg文件不存在！');
}

class ElectronVideoProcessor {
    constructor() {
        this.mainWindow = null;
    }

    // 创建主窗口
    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });

        // 加载Web应用
        this.mainWindow.loadFile('WebRecorder.html');
        
        // 等待页面加载完成后检查API
        this.mainWindow.webContents.once('dom-ready', () => {
            console.log('🔍 检查Electron API是否可用...');
            this.mainWindow.webContents.executeJavaScript(`
                console.log('🔍 window.electronAPI:', typeof window.electronAPI);
                if (window.electronAPI) {
                    console.log('✅ Electron API 可用');
                    window.electronAPI.checkFFmpeg().then(result => {
                        console.log('🔍 FFmpeg检查结果:', result);
                    });
                } else {
                    console.log('❌ Electron API 不可用');
                }
            `);
        });
        
        // 自动打开开发者工具（方便调试）
        this.mainWindow.webContents.openDevTools();
    }

    // 处理视频 - 使用原生FFmpeg
    async processVideoWithNativeFFmpeg(inputPath, outputPath, options) {
        return new Promise((resolve, reject) => {
            const {
                startTime = 0,
                duration,
                format = 'mp4',
                quality = 'medium',
                crf = '23',
                preset = 'faster',
                videoBitrate = null,
                audioBitrate = '128k'
            } = options;

            // 构建FFmpeg命令
            const ffmpegArgs = [
                '-i', inputPath,
                '-ss', startTime.toString(),
                '-t', duration.toString(),
                '-c:v', 'libx264',
                '-preset', preset
            ];

            // 根据质量设置选择码率控制方式
            if (videoBitrate) {
                // 使用固定码率模式
                ffmpegArgs.push('-b:v', videoBitrate);
                ffmpegArgs.push('-maxrate', videoBitrate);
                ffmpegArgs.push('-bufsize', videoBitrate);
            } else {
                // 使用CRF模式（恒定质量）
                ffmpegArgs.push('-crf', crf);
            }

            // 添加其他参数
            ffmpegArgs.push(
                '-c:a', 'aac',
                '-b:a', audioBitrate,
                '-movflags', '+faststart',
                '-threads', '0',  // 使用所有CPU核心
                '-y',  // 覆盖输出文件
                outputPath
            );

            console.log('🚀 执行原生FFmpeg命令:', 'ffmpeg', ffmpegArgs.join(' '));

            // 启动FFmpeg进程前再次验证路径
            if (!fs.existsSync(ffmpegPath)) {
                throw new Error(`FFmpeg文件不存在: ${ffmpegPath}`);
            }
            
            // 检查文件权限
            try {
                fs.accessSync(ffmpegPath, fs.constants.F_OK | fs.constants.R_OK | fs.constants.X_OK);
            } catch (permError) {
                console.error('❌ FFmpeg文件权限错误:', permError.message);
                // 尝试添加执行权限
                try {
                    fs.chmodSync(ffmpegPath, '755');
                    console.log('✅ 已添加FFmpeg执行权限');
                } catch (chmodError) {
                    console.error('❌ 无法添加执行权限:', chmodError.message);
                }
            }
            
            console.log('🚀 启动FFmpeg进程:', ffmpegPath);
            const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

            let stderr = '';
            let progress = 0;

            // 监听FFmpeg输出
            ffmpegProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                
                // 解析进度信息
                const progressMatch = data.toString().match(/time=(\d{2}):(\d{2}):(\d{2})/);
                if (progressMatch) {
                    const [, hours, minutes, seconds] = progressMatch;
                    const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
                    progress = Math.min((currentTime / duration) * 100, 100);
                    
                    // 发送进度更新到渲染进程（检查窗口是否仍然存在）
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        try {
                            this.mainWindow.webContents.send('ffmpeg-progress', {
                                progress: Math.round(progress),
                                time: currentTime,
                                duration: duration
                            });
                        } catch (error) {
                            console.warn('⚠️ 发送进度更新失败:', error.message);
                        }
                    }
                }
            });

            // 处理完成
            ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ 原生FFmpeg处理完成');
                    resolve({
                        success: true,
                        outputPath: outputPath,
                        progress: 100
                    });
                } else {
                    console.error('❌ FFmpeg处理失败:', stderr);
                    reject(new Error(`FFmpeg处理失败: ${stderr}`));
                }
            });

            // 处理错误
            ffmpegProcess.on('error', (error) => {
                console.error('❌ FFmpeg进程错误:', error);
                reject(error);
            });

            // 处理进程退出
            ffmpegProcess.on('exit', (code, signal) => {
                if (signal) {
                    console.log(`🔍 FFmpeg进程被信号终止: ${signal}`);
                }
            });

            // 处理标准输出错误
            ffmpegProcess.stdout.on('error', (error) => {
                if (error.code !== 'EPIPE') {
                    console.warn('⚠️ FFmpeg stdout错误:', error.message);
                }
            });

            ffmpegProcess.stderr.on('error', (error) => {
                if (error.code !== 'EPIPE') {
                    console.warn('⚠️ FFmpeg stderr错误:', error.message);
                }
            });
        });
    }

    // 检查系统FFmpeg
    async checkSystemFFmpeg() {
        return new Promise((resolve) => {
            // 检查FFmpeg路径是否存在
            if (!fs.existsSync(ffmpegPath)) {
                console.error('❌ FFmpeg路径不存在:', ffmpegPath);
                resolve(false);
                return;
            }
            
            console.log('🔍 检查FFmpeg可用性:', ffmpegPath);
            const ffmpegProcess = spawn(ffmpegPath, ['-version']);
            
            ffmpegProcess.on('close', (code) => {
                console.log('🔍 FFmpeg版本检查结果:', code === 0 ? '✅ 可用' : '❌ 不可用');
                resolve(code === 0);
            });
            
            ffmpegProcess.on('error', (error) => {
                console.error('❌ FFmpeg进程错误:', error.message);
                resolve(false);
            });

            // 处理标准输出错误，忽略EPIPE
            ffmpegProcess.stdout.on('error', (error) => {
                if (error.code !== 'EPIPE') {
                    console.warn('⚠️ FFmpeg stdout错误:', error.message);
                }
            });

            ffmpegProcess.stderr.on('error', (error) => {
                if (error.code !== 'EPIPE') {
                    console.warn('⚠️ FFmpeg stderr错误:', error.message);
                }
            });
        });
    }

    // 流式读取文件
    async readFileStream(filePath) {
        return new Promise((resolve, reject) => {
            const fs = require('fs');
            
            // 对于大文件，直接返回文件路径，不读取内容
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            
            if (fileSize > 50 * 1024 * 1024) { // 大于50MB
                console.log(`📦 超大文件检测 (${(fileSize / 1024 / 1024).toFixed(2)} MB)，返回文件路径`);
                resolve({ 
                    isFilePath: true, 
                    filePath: filePath,
                    fileSize: fileSize 
                });
                return;
            }
            
            // 中等大小文件使用流式读取
            const chunks = [];
            const stream = fs.createReadStream(filePath);
            
            stream.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            stream.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log(`📦 流式读取完成: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
                
                // 安全地转换为Array，避免长度错误
                try {
                    const arrayData = Array.from(buffer);
                    resolve(arrayData);
                } catch (arrayError) {
                    console.warn('⚠️ Array转换失败，返回文件路径:', arrayError.message);
                    resolve({ 
                        isFilePath: true, 
                        filePath: filePath,
                        fileSize: buffer.length 
                    });
                }
            });
            
            stream.on('error', (error) => {
                console.error('❌ 流式读取失败:', error);
                reject(error);
            });
        });
    }

    // 设置IPC通信
    setupIPC() {
        // 处理视频处理请求
        ipcMain.handle('process-video', async (event, options) => {
            try {
                // 如果inputPath是虚拟路径，需要先保存文件
                let actualInputPath = options.inputPath;
                if (options.inputPath === 'input.mp4' && options.fileData) {
                    // 保存文件到临时位置
                    const fs = require('fs');
                    const path = require('path');
                    const os = require('os');
                    
                    const tempDir = os.tmpdir();
                    actualInputPath = path.join(tempDir, `temp_input_${Date.now()}.mp4`);
                    
                    // 将ArrayBuffer转换为Buffer并保存
                    const buffer = Buffer.from(options.fileData);
                    fs.writeFileSync(actualInputPath, buffer);
                    
                    console.log(`💾 临时文件已保存: ${actualInputPath}`);
                }
                
                // 确保输出文件也写入到临时目录
                const os = require('os');
                const tempDir = os.tmpdir();
                const actualOutputPath = path.join(tempDir, options.outputPath);
                
                const result = await this.processVideoWithNativeFFmpeg(
                    actualInputPath,
                    actualOutputPath,
                    options
                );
                
                // 读取处理后的视频文件
                if (result.success) {
                    if (fs.existsSync(actualOutputPath)) {
                        const videoData = fs.readFileSync(actualOutputPath);
                        result.fileSize = videoData.length;
                        console.log(`📁 处理后的视频文件大小: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
                        
                        // 对于大文件，使用流式传输而不是一次性转换
                        if (result.fileSize > 100 * 1024 * 1024) { // 大于100MB
                            console.log('📦 大文件检测，使用流式传输');
                            result.videoData = null; // 不传输数据，让前端通过文件路径处理
                            result.outputPath = actualOutputPath; // 传递文件路径
                        } else {
                            // 小文件直接转换
                            try {
                                result.videoData = Array.from(videoData);
                            } catch (arrayError) {
                                console.warn('⚠️ Array转换失败，使用备用方案:', arrayError.message);
                                result.videoData = null;
                                result.outputPath = actualOutputPath;
                            }
                        }
                        
                        // 清理输出文件（如果数据已传输）
                        if (result.videoData) {
                            try {
                                fs.unlinkSync(actualOutputPath);
                                console.log(`🗑️ 输出文件已清理: ${actualOutputPath}`);
                            } catch (cleanupError) {
                                console.warn('⚠️ 清理输出文件失败:', cleanupError);
                            }
                        }
                    }
                }
                
                // 清理临时文件
                if (actualInputPath !== options.inputPath) {
                    const fs = require('fs');
                    try {
                        fs.unlinkSync(actualInputPath);
                        console.log(`🗑️ 临时文件已清理: ${actualInputPath}`);
                    } catch (cleanupError) {
                        console.warn('⚠️ 清理临时文件失败:', cleanupError);
                    }
                }
                
                return result;
            } catch (error) {
                throw error;
            }
        });

        // 检查FFmpeg可用性
        ipcMain.handle('check-ffmpeg', async () => {
            return await this.checkSystemFFmpeg();
        });

        // 获取系统信息
        ipcMain.handle('get-system-info', () => {
            return {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                electronVersion: process.versions.electron
            };
        });

        // 读取文件
        ipcMain.handle('read-file', async (event, filePath) => {
            try {
                if (!fs.existsSync(filePath)) {
                    throw new Error('文件不存在');
                }
                
                const stats = fs.statSync(filePath);
                const fileSize = stats.size;
                console.log(`📖 读取文件: ${filePath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
                
                // 对于大文件，使用流式读取
                if (fileSize > 50 * 1024 * 1024) { // 大于50MB
                    console.log('📦 大文件流式读取');
                    return await this.readFileStream(filePath);
                } else {
                    // 小文件直接读取
                    const fileData = fs.readFileSync(filePath);
                    try {
                        return Array.from(fileData);
                    } catch (arrayError) {
                        console.warn('⚠️ Array转换失败，返回文件路径:', arrayError.message);
                        return { 
                            isFilePath: true, 
                            filePath: filePath,
                            fileSize: fileSize 
                        };
                    }
                }
            } catch (error) {
                console.error('❌ 读取文件失败:', error);
                throw error;
            }
        });

        // 下载文件
        ipcMain.handle('download-file', async (event, filePath, filename) => {
            try {
                if (!fs.existsSync(filePath)) {
                    throw new Error('文件不存在');
                }
                
                const { dialog } = require('electron');
                const os = require('os');
                
                // 获取下载目录
                const downloadsPath = path.join(os.homedir(), 'Downloads');
                const targetPath = path.join(downloadsPath, filename);
                
                console.log(`📥 下载文件: ${filePath} -> ${targetPath}`);
                
                // 复制文件到下载目录
                fs.copyFileSync(filePath, targetPath);
                
                console.log(`✅ 文件下载完成: ${targetPath}`);
                
                // 显示保存对话框
                const result = await dialog.showSaveDialog(this.mainWindow, {
                    defaultPath: targetPath,
                    filters: [
                        { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'avi', 'mkv'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                });
                
                if (!result.canceled) {
                    // 如果用户选择了不同的路径，复制到新位置
                    if (result.filePath !== targetPath) {
                        fs.copyFileSync(targetPath, result.filePath);
                        console.log(`📁 文件已保存到: ${result.filePath}`);
                    }
                }
                
                return { success: true, path: result.filePath || targetPath };
                
            } catch (error) {
                console.error('❌ 下载文件失败:', error);
                throw error;
            }
        });
    }
}

// 创建应用实例
const videoProcessor = new ElectronVideoProcessor();

// 应用事件
app.whenReady().then(async () => {
    videoProcessor.createWindow();
    videoProcessor.setupIPC();
    
    // 检查系统FFmpeg
    const hasFFmpeg = await videoProcessor.checkSystemFFmpeg();
    console.log('🔍 系统FFmpeg检查:', hasFFmpeg ? '✅ 可用' : '❌ 不可用');
    
    if (!hasFFmpeg) {
        console.log('💡 请安装FFmpeg: brew install ffmpeg (macOS) 或 apt install ffmpeg (Ubuntu)');
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        videoProcessor.createWindow();
    }
});