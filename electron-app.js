// Electron应用主进程 - 原生FFmpeg集成示例
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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
        
        // 开发模式下打开开发者工具
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.webContents.openDevTools();
        }
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
                preset = 'faster'
            } = options;

            // 构建FFmpeg命令
            const ffmpegArgs = [
                '-i', inputPath,
                '-ss', startTime.toString(),
                '-t', duration.toString(),
                '-c:v', 'libx264',
                '-crf', crf,
                '-preset', preset,
                '-c:a', 'aac',
                '-b:a', '128k',
                '-movflags', '+faststart',
                '-threads', '0',  // 使用所有CPU核心
                '-y',  // 覆盖输出文件
                outputPath
            ];

            console.log('🚀 执行原生FFmpeg命令:', 'ffmpeg', ffmpegArgs.join(' '));

            // 启动FFmpeg进程
            const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

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
                    
                    // 发送进度更新到渲染进程
                    this.mainWindow.webContents.send('ffmpeg-progress', {
                        progress: Math.round(progress),
                        time: currentTime,
                        duration: duration
                    });
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
        });
    }

    // 检查系统FFmpeg
    async checkSystemFFmpeg() {
        return new Promise((resolve) => {
            const ffmpegProcess = spawn('ffmpeg', ['-version']);
            
            ffmpegProcess.on('close', (code) => {
                resolve(code === 0);
            });
            
            ffmpegProcess.on('error', () => {
                resolve(false);
            });
        });
    }

    // 设置IPC通信
    setupIPC() {
        // 处理视频处理请求
        ipcMain.handle('process-video', async (event, options) => {
            try {
                const result = await this.processVideoWithNativeFFmpeg(
                    options.inputPath,
                    options.outputPath,
                    options
                );
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