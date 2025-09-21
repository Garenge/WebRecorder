// 原生FFmpeg处理器 - 不依赖Electron
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class NativeVideoProcessor {
    constructor() {
        this.isProcessing = false;
    }

    // 检查FFmpeg是否可用
    async checkFFmpeg() {
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

    // 处理视频
    async processVideo(inputPath, outputPath, options = {}) {
        if (this.isProcessing) {
            throw new Error('正在处理中，请等待完成');
        }

        this.isProcessing = true;

        try {
            const {
                startTime = 0,
                duration,
                format = 'mp4',
                quality = 'medium',
                crf = '23',
                preset = 'faster'
            } = options;

            console.log('🚀 开始原生FFmpeg处理...');
            console.log(`输入文件: ${inputPath}`);
            console.log(`输出文件: ${outputPath}`);
            console.log(`时间范围: ${startTime}s - ${startTime + duration}s`);

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

            console.log('🎬 FFmpeg命令:', 'ffmpeg', ffmpegArgs.join(' '));

            // 启动FFmpeg进程
            const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

            let stderr = '';
            let progress = 0;
            const processStartTime = Date.now();

            // 监听FFmpeg输出
            ffmpegProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                
                // 解析进度信息
                const progressMatch = data.toString().match(/time=(\d{2}):(\d{2}):(\d{2})/);
                if (progressMatch) {
                    const [, hours, minutes, seconds] = progressMatch;
                    const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
                    progress = Math.min((currentTime / duration) * 100, 100);
                    
                    console.log(`📊 处理进度: ${progress.toFixed(1)}% (${currentTime.toFixed(1)}s/${duration}s)`);
                }
            });

            // 处理完成
            return new Promise((resolve, reject) => {
                ffmpegProcess.on('close', (code) => {
                    this.isProcessing = false;
                    const processingTime = Date.now() - processStartTime;
                    
                    if (code === 0) {
                        console.log('✅ 原生FFmpeg处理完成');
                        console.log(`⚡ 处理耗时: ${(processingTime / 1000).toFixed(2)}秒`);
                        console.log(`📁 输出文件: ${outputPath}`);
                        
                        resolve({
                            success: true,
                            outputPath: outputPath,
                            processingTime: processingTime,
                            progress: 100
                        });
                    } else {
                        console.error('❌ FFmpeg处理失败:', stderr);
                        reject(new Error(`FFmpeg处理失败: ${stderr}`));
                    }
                });

                // 处理错误
                ffmpegProcess.on('error', (error) => {
                    this.isProcessing = false;
                    console.error('❌ FFmpeg进程错误:', error);
                    reject(error);
                });
            });

        } catch (error) {
            this.isProcessing = false;
            throw error;
        }
    }

    // 获取系统信息
    getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            ffmpegAvailable: false // 将在初始化时设置
        };
    }
}

// 如果直接运行此文件
if (require.main === module) {
    const processor = new NativeVideoProcessor();
    
    // 检查FFmpeg
    processor.checkFFmpeg().then(hasFFmpeg => {
        if (hasFFmpeg) {
            console.log('✅ 系统FFmpeg可用');
            console.log('💡 使用方法:');
            console.log('   const processor = new NativeVideoProcessor();');
            console.log('   await processor.processVideo(inputPath, outputPath, options);');
        } else {
            console.log('❌ 系统FFmpeg不可用');
            console.log('💡 请安装FFmpeg: brew install ffmpeg');
        }
    });
}

module.exports = NativeVideoProcessor;