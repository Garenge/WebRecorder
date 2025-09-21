// Web应用与原生FFmpeg的桥梁服务器
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const port = 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 文件上传配置
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB限制
    }
});

// 检查FFmpeg是否可用
app.get('/api/check-ffmpeg', async (req, res) => {
    try {
        const ffmpegProcess = spawn('ffmpeg', ['-version']);
        let output = '';
        
        ffmpegProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                res.json({ 
                    available: true, 
                    version: output.split('\n')[0],
                    message: '原生FFmpeg可用'
                });
            } else {
                res.json({ 
                    available: false, 
                    message: 'FFmpeg不可用'
                });
            }
        });
    } catch (error) {
        res.json({ 
            available: false, 
            message: 'FFmpeg检查失败: ' + error.message
        });
    }
});

// 处理视频
app.post('/api/process-video', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传视频文件' });
        }

        const inputPath = req.file.path;
        const outputPath = path.join('outputs', `processed_${Date.now()}.mp4`);
        
        // 确保输出目录存在
        if (!fs.existsSync('outputs')) {
            fs.mkdirSync('outputs');
        }

        // 获取处理参数
        const { startTime, duration, quality, format } = req.body;
        
        // 构建FFmpeg命令
        const ffmpegArgs = [
            '-i', inputPath,
            '-ss', startTime.toString(),
            '-t', duration.toString(),
            '-c:v', 'libx264',
            '-crf', quality === 'high' ? '18' : quality === 'medium' ? '23' : '28',
            '-preset', quality === 'high' ? 'fast' : quality === 'medium' ? 'faster' : 'veryfast',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-threads', '0',
            '-y',
            outputPath
        ];

        console.log('🎬 开始处理视频:', inputPath);
        console.log('📊 参数:', { startTime, duration, quality, format });

        // 启动FFmpeg进程
        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
        
        let stderr = '';
        let progress = 0;
        const startTime = Date.now();

        // 监听FFmpeg输出
        ffmpegProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            
            // 解析进度
            const timeMatch = stderr.match(/time=(\d+):(\d+):(\d+\.\d+)/);
            if (timeMatch) {
                const hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const seconds = parseFloat(timeMatch[3]);
                const currentTime = hours * 3600 + minutes * 60 + seconds;
                progress = Math.min((currentTime / duration) * 100, 100);
            }
        });

        // 处理完成
        ffmpegProcess.on('close', (code) => {
            const processingTime = Date.now() - startTime;
            
            if (code === 0) {
                console.log('✅ 视频处理完成');
                console.log(`⚡ 处理耗时: ${(processingTime / 1000).toFixed(2)}秒`);
                
                // 获取输出文件信息
                const stats = fs.statSync(outputPath);
                const fileSize = (stats.size / (1024 * 1024)).toFixed(2);
                
                res.json({
                    success: true,
                    outputPath: outputPath,
                    processingTime: processingTime,
                    fileSize: fileSize,
                    message: '视频处理完成'
                });
            } else {
                console.error('❌ FFmpeg处理失败:', stderr);
                res.status(500).json({
                    success: false,
                    error: '视频处理失败',
                    details: stderr
                });
            }
            
            // 清理输入文件
            fs.unlinkSync(inputPath);
        });

        // 处理错误
        ffmpegProcess.on('error', (error) => {
            console.error('❌ FFmpeg进程错误:', error);
            res.status(500).json({
                success: false,
                error: 'FFmpeg进程启动失败',
                details: error.message
            });
            
            // 清理文件
            if (fs.existsSync(inputPath)) {
                fs.unlinkSync(inputPath);
            }
        });

    } catch (error) {
        console.error('❌ 处理错误:', error);
        res.status(500).json({
            success: false,
            error: '服务器错误',
            details: error.message
        });
    }
});

// 下载处理后的视频
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join('outputs', filename);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                console.error('下载错误:', err);
                res.status(500).json({ error: '下载失败' });
            } else {
                // 下载完成后删除文件
                setTimeout(() => {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }, 1000);
            }
        });
    } else {
        res.status(404).json({ error: '文件不存在' });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`🚀 Web桥接服务器启动成功!`);
    console.log(`📡 服务地址: http://localhost:${port}`);
    console.log(`🌐 Web应用: http://localhost:${port}/WebRecorder.html`);
    console.log(`🔧 API文档: http://localhost:${port}/api/check-ffmpeg`);
    console.log(`\n💡 现在你可以在Web界面中享受原生FFmpeg的性能了!`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务器...');
    process.exit(0);
});