// WebRecorder v3 - 视频编辑器
class VideoEditor {
    constructor() {
        this.ffmpeg = null;
        this.currentVideo = null;
        this.videoDuration = 0;
        this.startTime = 0;
        this.endTime = 0;
        this.isProcessing = false;
        this.processedVideo = null;
        
        // 原始视频信息
        this.originalVideoInfo = {
            bitrate: 0,
            estimatedBitrate: 0,
            width: 0,
            height: 0,
            frameRate: 0,
            codec: 'unknown',
            format: 'unknown'
        };
        
        // 视频对比功能
        this.videoComparison = null;
        this.comparisonUI = null;
        this.comparisonHelper = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeFFmpeg();
        // 异步初始化视频对比功能
        this.initializeVideoComparison().catch(error => {
            console.error('❌ 视频对比功能初始化失败:', error);
        });
        
        // 标记初始化状态
        this.comparisonInitialized = false;
        
        // 文件系统权限相关
        this.fileSystemAccessSupported = false;
        this.permissionGranted = false;
        this.selectedFileHandle = null;
        this.permissionChecked = false; // 权限检查状态
        this.permissionCheckPromise = null; // 权限检查Promise
        this.replacementOptionsVisible = false;
    }

    // 初始化DOM元素
    initializeElements() {
        // 检查是否在正确的页面环境中
        const requiredElements = [
            'uploadArea', 'videoFileInput', 'previewVideo', 'noVideoPlaceholder',
            'timelineSlider', 'startHandle', 'endHandle', 'startTimeDisplay',
            'endTimeDisplay', 'cropDuration', 'processVideoBtn', 'downloadBtn',
            'replaceSourceBtn', 'compareBtn', 'resetBtn', 'outputFormat',
            'qualityLevel', 'replacementOptions', 'originalDurationDisplay',
            'processedDurationDisplay', 'processingStatus', 'progressFill',
            'timelineRange', 'previewOverlay', 'previewText', 'processedFileInfo',
            'processedFileSize', 'compressionRatio', 'fixedEndTime'
        ];
        
        // 检查关键元素是否存在
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        if (missingElements.length > 0) {
            console.warn('⚠️ 检测到非完整页面环境，部分DOM元素缺失:', missingElements);
            console.warn('⚠️ VideoEditor将在受限模式下运行');
            this.isLimitedMode = true;
            return;
        }
        
        this.uploadArea = document.getElementById('uploadArea');
        this.videoFileInput = document.getElementById('videoFileInput');
        this.previewVideo = document.getElementById('previewVideo');
        this.noVideoPlaceholder = document.getElementById('noVideoPlaceholder');
        this.timelineSlider = document.getElementById('timelineSlider');
        this.startHandle = document.getElementById('startHandle');
        this.endHandle = document.getElementById('endHandle');
        this.startTimeDisplay = document.getElementById('startTimeDisplay');
        this.endTimeDisplay = document.getElementById('endTimeDisplay');
        this.cropDuration = document.getElementById('cropDuration');
        this.processVideoBtn = document.getElementById('processVideoBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.replaceSourceBtn = document.getElementById('replaceSourceBtn');
        this.compareBtn = document.getElementById('compareBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.outputFormatSelect = document.getElementById('outputFormat');
        this.qualityLevelSelect = document.getElementById('qualityLevel');
        this.replacementOptions = document.getElementById('replacementOptions');
        this.originalDurationDisplay = document.getElementById('originalDurationDisplay');
        this.processedDurationDisplay = document.getElementById('processedDurationDisplay');
        this.processingStatus = document.getElementById('processingStatus');
        this.progressFill = document.getElementById('progressFill');
        this.timelineRange = document.getElementById('timelineRange');
        this.previewOverlay = document.getElementById('previewOverlay');
        this.previewText = document.getElementById('previewText');
        this.processedFileInfo = document.getElementById('processedFileInfo');
        this.processedFileSize = document.getElementById('processedFileSize');
        this.compressionRatio = document.getElementById('compressionRatio');
        this.fixedEndTime = document.getElementById('fixedEndTime');
        
        // 视频对比相关元素
        this.comparisonContainer = document.getElementById('comparisonContainer');
        this.showComparisonBtn = document.getElementById('showComparisonBtn');
        this.hideComparisonBtn = document.getElementById('hideComparisonBtn');
        
        // 检查handle是否正确初始化
        if (!this.startHandle || !this.endHandle || !this.timelineSlider) {
            console.error('❌ 时间轴元素未找到!');
            return;
        }
        
        console.log('✅ 时间轴元素初始化成功');
        console.log('🟢 开始handle:', this.startHandle);
        console.log('🔴 结束handle:', this.endHandle);
        
        // 初始化手柄位置
        this.updateHandlePosition('start');
        this.updateHandlePosition('end');
        
        // 初始化蓝条位置
        this.updateTimelineRange();
    }

    // 设置事件监听器
    setupEventListeners() {
        // 如果在受限模式下，跳过事件监听器设置
        if (this.isLimitedMode) {
            console.log('⚠️ 受限模式下跳过事件监听器设置');
            return;
        }
        
        // 文件上传
        this.uploadArea.addEventListener('click', () => {
            this.videoFileInput.click();
        });

        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = '#1e7e34';
            this.uploadArea.style.backgroundColor = '#f0fff4';
        });

        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = '#28a745';
            this.uploadArea.style.backgroundColor = '#f8fff9';
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = '#28a745';
            this.uploadArea.style.backgroundColor = '#f8fff9';
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('video/')) {
                this.loadVideo(files[0]);
            }
        });

        this.videoFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadVideo(e.target.files[0]);
            }
        });

        // 时间轴handle拖拽事件
        this.setupTimelineHandles();

        // 按钮事件
        this.processVideoBtn.addEventListener('click', () => {
            this.processVideo();
        });

        this.downloadBtn.addEventListener('click', () => {
            this.downloadVideo();
        });
        
        this.replaceSourceBtn.addEventListener('click', () => {
            this.replaceSourceFile();
        });
        
        this.compareBtn.addEventListener('click', () => {
            this.compareOriginalAndProcessed();
        });
        
        this.resetBtn.addEventListener('click', () => {
            this.resetEditor();
        });
        
        // 替换选项对话框事件
        document.getElementById('overwriteOriginalBtn').addEventListener('click', () => {
            this.hideReplacementOptions();
            this.overwriteOriginalFile();
        });
        
        document.getElementById('downloadNewBtn').addEventListener('click', () => {
            this.hideReplacementOptions();
            this.downloadNewFile();
        });
        
        document.getElementById('downloadOverrideBtn').addEventListener('click', () => {
            this.hideReplacementOptions();
            this.downloadWithOriginalName();
        });
        
        document.getElementById('previewOnlyBtn').addEventListener('click', () => {
            this.hideReplacementOptions();
            this.previewReplacement();
        });
        
        document.getElementById('cancelReplaceBtn').addEventListener('click', () => {
            this.hideReplacementOptions();
        });
    }

    // 初始化FFmpeg
    async initializeFFmpeg() {
        try {
            // 检查是否在Electron环境中，如果是则跳过FFmpeg.wasm加载
            if (window.electronAPI) {
                console.log('🚀 检测到Electron环境，跳过FFmpeg.wasm加载');
                this.showProcessingStatus('检测到Electron环境，使用原生FFmpeg', 100);
                this.useWebAPI = false; // 标记为使用原生FFmpeg
                this.ffmpeg = 'electron'; // 设置一个标记，表示使用Electron原生FFmpeg
                return;
            }
            
            console.log('🔄 正在加载FFmpeg.wasm...');
            this.showProcessingStatus('正在加载FFmpeg.wasm...', 10);
            
            // 等待FFmpeg库加载完成
            await this.waitForFFmpeg();
            
            // 检查FFmpeg是否可用 - 使用FFmpegWASM对象
            if (typeof window.FFmpegWASM === 'undefined') {
                throw new Error('FFmpeg库未加载');
            }
            
            const ffmpegWASM = window.FFmpegWASM;
            
            // 检查FFmpegWASM对象是否包含所需的功能
            if (!ffmpegWASM.FFmpeg) {
                throw new Error('FFmpeg类未找到');
            }
            
            // 动态导入util库
            let fetchFile, toBlobURL;
            try {
                const utilModule = await import('https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js');
                fetchFile = utilModule.fetchFile;
                toBlobURL = utilModule.toBlobURL;
            } catch (error) {
                console.error('❌ 无法加载FFmpeg util库:', error);
                console.log('🔄 使用备用实现...');
                
                // 备用实现
                fetchFile = async (file) => {
                    if (typeof file === 'string') {
                        if (file.startsWith('data:')) {
                            // Base64 data URL
                            const base64 = file.split(',')[1];
                            const binaryString = atob(base64);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            return bytes;
                        } else {
                            // URL
                            const response = await fetch(file);
                            const arrayBuffer = await response.arrayBuffer();
                            return new Uint8Array(arrayBuffer);
                        }
                    } else if (file instanceof File || file instanceof Blob) {
                        const arrayBuffer = await file.arrayBuffer();
                        return new Uint8Array(arrayBuffer);
                    }
                    throw new Error('Unsupported file type');
                };
                
                toBlobURL = async (url, mimeType) => {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    return URL.createObjectURL(blob);
                };
            }
            
            const { FFmpeg } = ffmpegWASM;
            
            this.ffmpeg = new FFmpeg();
            
            // 检查是否通过file://协议访问，如果是则直接使用Web API备用方案
            if (window.location.protocol === 'file:') {
                console.log('⚠️ 检测到file://协议访问，FFmpeg.wasm无法正常工作');
                console.log('🔄 自动切换到Web API备用方案');
                this.showProcessingStatus('检测到本地文件访问，使用Web API备用方案', 100);
                this.useWebAPI = true;
                return;
            }
            
            // 设置FFmpeg.wasm的路径，使用测试确认可用的CDN源
            const cdnSources = [
                'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
                'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'
            ];
            
            let loadSuccess = false;
            let lastError = null;
            
            for (const baseURL of cdnSources) {
                try {
                    console.log(`🔄 尝试从 ${baseURL} 加载FFmpeg核心文件...`);
                    await this.ffmpeg.load({
                        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                    });
                    console.log(`✅ 从 ${baseURL} 成功加载FFmpeg核心文件`);
                    loadSuccess = true;
                    break;
                } catch (error) {
                    console.warn(`⚠️ 从 ${baseURL} 加载失败:`, error.message);
                    lastError = error;
                    // 重置FFmpeg实例，准备尝试下一个CDN
                    this.ffmpeg = new FFmpeg();
                }
            }
            
            if (!loadSuccess) {
                throw new Error(`所有CDN源都无法访问FFmpeg核心文件。最后错误: ${lastError?.message}`);
            }
            
            console.log('✅ FFmpeg.wasm 加载成功');
            this.hideProcessingStatus();
        } catch (error) {
            console.error('❌ FFmpeg.wasm 加载失败:', error);
            this.showProcessingStatus('FFmpeg加载失败，将使用Web API备用方案', 100);
            // 使用简单的Web API作为备用方案
            this.useWebAPI = true;
        }
    }

    // 初始化视频对比功能 - 简化版本
    async initializeVideoComparison() {
        try {
            console.log('🔍 正在初始化视频对比功能...');
            
            // 检查FFmpegWASM是否可用（使用测试页面中成功的检查方式）
            if (typeof window.FFmpegWASM === 'undefined') {
                throw new Error('FFmpegWASM未加载');
            }
            
            const ffmpegWASM = window.FFmpegWASM;
            if (!ffmpegWASM.FFmpeg) {
                throw new Error('FFmpeg类未找到');
            }
            
            console.log('✅ FFmpegWASM和FFmpeg类可用');
            
            // 动态导入util库（使用测试页面中成功的导入方式）
            let fetchFile, toBlobURL;
            try {
                const utilModule = await import('https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js');
                fetchFile = utilModule.fetchFile;
                toBlobURL = utilModule.toBlobURL;
                console.log('✅ util库动态导入成功');
            } catch (error) {
                console.log('⚠️ util库动态导入失败，使用备用实现');
                // 使用备用实现（从测试页面复制）
                fetchFile = async (file) => {
                    if (typeof file === 'string') {
                        if (file.startsWith('data:')) {
                            const base64 = file.split(',')[1];
                            const binaryString = atob(base64);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            return bytes;
                        } else {
                            const response = await fetch(file);
                            const arrayBuffer = await response.arrayBuffer();
                            return new Uint8Array(arrayBuffer);
                        }
                    } else if (file instanceof File || file instanceof Blob) {
                        const arrayBuffer = await file.arrayBuffer();
                        return new Uint8Array(arrayBuffer);
                    }
                    throw new Error('Unsupported file type');
                };
                
                toBlobURL = async (url, mimeType) => {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    return URL.createObjectURL(blob);
                };
            }
            
            // 直接使用全局变量，避免动态导入的CORS问题
            console.log('📦 获取 VideoComparison...');
            const VideoComparison = window.VideoComparison;
            
            console.log('📦 获取 VideoComparisonUI...');
            const VideoComparisonUI = window.VideoComparisonUI;
            
            console.log('📦 获取 VideoComparisonHelper...');
            const VideoComparisonHelper = window.VideoComparisonHelper;
            
            if (!VideoComparison) {
                throw new Error('VideoComparison 类未找到');
            }
            
            if (!VideoComparisonUI) {
                throw new Error('VideoComparisonUI 类未找到');
            }
            
            if (!VideoComparisonHelper) {
                throw new Error('VideoComparisonHelper 类未找到');
            }
            
            console.log('🔧 创建实例...');
            this.videoComparison = new VideoComparison();
            this.comparisonUI = new VideoComparisonUI();
            this.comparisonHelper = new VideoComparisonHelper();
            
            // 初始化对比助手
            console.log('🔧 初始化对比助手...');
            await this.comparisonHelper.initialize();
            
            console.log('✅ 视频对比功能初始化成功');
            this.comparisonInitialized = true;
            
        } catch (error) {
            console.error('❌ 视频对比功能初始化失败:', error);
            this.showComparisonError(error);
            this.comparisonInitialized = false;
        }
    }

    // 显示对比功能错误信息
    showComparisonError(error) {
        let errorMessage;
        
        if (error.message.includes('file://协议访问下FFmpeg.wasm无法正常工作')) {
            errorMessage = `视频对比功能需要HTTP服务器支持\n\n当前通过本地文件访问，FFmpeg.wasm无法正常工作\n\n解决方案：\n1. 启动本地HTTP服务器\n2. 在终端运行：python3 -m http.server 8080\n3. 然后访问：http://localhost:8080/WebRecorder.html`;
        } else {
            errorMessage = `视频对比功能初始化失败：${error.message}\n\n请尝试：\n1. 刷新页面重试\n2. 检查网络连接\n3. 确保浏览器支持WebAssembly`;
        }
        
        console.error('用户错误信息:', errorMessage);
        alert(errorMessage);
    }

    // 等待对比功能初始化完成
    async waitForComparisonInitialization() {
        let attempts = 0;
        const maxAttempts = 100; // 等待10秒
        
        while (attempts < maxAttempts) {
            if (this.comparisonInitialized && this.comparisonHelper) {
                console.log('✅ 对比功能初始化完成');
                return;
            }
            
            // 如果还没有开始初始化，启动初始化
            if (!this.comparisonInitialized && !this.comparisonHelper) {
                console.log('🔄 启动对比功能初始化...');
                await this.initializeVideoComparison();
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('对比功能初始化超时');
    }

    // 等待FFmpeg库加载
    async waitForFFmpeg() {
        let attempts = 0;
        const maxAttempts = 50; // 等待5秒
        
        while (attempts < maxAttempts) {
            // 检查FFmpegWASM对象是否加载完成
            if (typeof window.FFmpegWASM !== 'undefined') {
                const ffmpegWASM = window.FFmpegWASM;
                
                // 检查是否包含FFmpeg类
                if (ffmpegWASM.FFmpeg) {
                    console.log('✅ FFmpeg库加载完成');
                    return;
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('FFmpeg库加载超时');
    }

    // 加载视频文件
    async loadVideo(file) {
        try {
            console.log('📁 加载视频文件:', file.name);
            
            // 重置所有状态
            this.resetVideoState();
            
            this.currentVideo = file;
            
            // 创建视频URL
            const videoURL = URL.createObjectURL(file);
            this.previewVideo.src = videoURL;
            this.previewVideo.style.display = 'block';
            this.noVideoPlaceholder.style.display = 'none';
            
            // 等待视频加载完成获取时长和码率信息
            await new Promise((resolve) => {
                this.previewVideo.onloadedmetadata = () => {
                    this.videoDuration = this.previewVideo.duration;
                    
                    // 检测原始视频的码率信息
                    this.detectOriginalVideoInfo();
                    
                    this.updateTimeline();
                    resolve();
                };
            });
            
            // 启用处理按钮
            this.processVideoBtn.disabled = false;
            
            // 在视频加载完成后，提示用户进行权限授权
            await this.promptPermissionOnEdit();
            
            console.log(`✅ 视频加载成功，时长: ${this.formatTime(this.videoDuration)}`);
            
        } catch (error) {
            console.error('❌ 视频加载失败:', error);
            this.showError('视频加载失败，请选择有效的视频文件');
        }
    }

    // 检测原始视频信息
    detectOriginalVideoInfo() {
        if (!this.currentVideo || !this.previewVideo) return;
        
        try {
            // 获取视频基本信息
            this.originalVideoInfo.width = this.previewVideo.videoWidth;
            this.originalVideoInfo.height = this.previewVideo.videoHeight;
            this.originalVideoInfo.format = this.currentVideo.type || 'unknown';
            
            // 更准确的码率估算
            const fileSizeBytes = this.currentVideo.size;
            const durationSeconds = this.videoDuration;
            
            // 估算总码率 (包含视频+音频)
            const totalBitrate = Math.round((fileSizeBytes * 8) / durationSeconds);
            
            // 估算视频码率 (假设视频占80-90%的码率)
            const videoBitrateRatio = 0.85; // 视频码率占总码率的85%
            this.originalVideoInfo.estimatedBitrate = Math.round(totalBitrate * videoBitrateRatio);
            
            // 根据文件大小和时长估算实际码率
            const fileSizeMB = fileSizeBytes / (1024 * 1024);
            const durationMinutes = durationSeconds / 60;
            this.originalVideoInfo.bitrate = Math.round((fileSizeMB * 8) / durationMinutes);
            
            console.log('📊 原始视频信息:');
            console.log(`   分辨率: ${this.originalVideoInfo.width}x${this.originalVideoInfo.height}`);
            console.log(`   格式: ${this.originalVideoInfo.format}`);
            console.log(`   总码率: ${Math.round(totalBitrate / 1000)} kbps`);
            console.log(`   估算视频码率: ${Math.round(this.originalVideoInfo.estimatedBitrate / 1000)} kbps`);
            console.log(`   文件大小: ${fileSizeMB.toFixed(2)} MB`);
            console.log(`   时长: ${durationSeconds.toFixed(2)} 秒`);
            
            // 根据原始码率设置默认质量
            this.setDefaultQualityBasedOnOriginal();
            
        } catch (error) {
            console.error('❌ 检测原始视频信息失败:', error);
        }
    }

    // 根据原始视频信息设置默认质量
    setDefaultQualityBasedOnOriginal() {
        if (!this.qualityLevelSelect) return;
        
        // 默认使用"保持原始质量"选项，这是用户最常用的需求
        const recommendedQuality = 'original';
        
        // 设置默认质量
        this.qualityLevelSelect.value = recommendedQuality;
        
        const estimatedBitrateKbps = Math.round(this.originalVideoInfo.estimatedBitrate / 1000);
        console.log(`🎯 设置默认质量: ${recommendedQuality} (原始码率: ${estimatedBitrateKbps} kbps)`);
        console.log(`💡 提示: 选择"保持原始质量"可以最大程度保持视频质量，避免码率下降`);
    }

    // 获取原始码率
    getOriginalBitrate() {
        if (!this.originalVideoInfo.estimatedBitrate) {
            return '192k'; // 默认码率
        }
        
        // 将码率转换为kbps格式
        const bitrateKbps = Math.round(this.originalVideoInfo.estimatedBitrate / 1000);
        return `${bitrateKbps}k`;
    }

    // 计算视频码率
    calculateVideoBitrate() {
        const quality = this.qualityLevelSelect.value;
        
        // 如果选择保持原始质量，使用原始码率
        if (quality === 'original' && this.originalVideoInfo.estimatedBitrate) {
            const originalBitrateKbps = Math.round(this.originalVideoInfo.estimatedBitrate / 1000);
            console.log(`🎯 保持原始码率: ${originalBitrateKbps}k`);
            return `${originalBitrateKbps}k`;
        }
        
        // 根据分辨率和质量等级动态计算码率
        const resolution = this.originalVideoInfo.width * this.originalVideoInfo.height;
        let baseBitrate;
        
        if (resolution >= 3840 * 2160) { // 4K
            baseBitrate = 15000; // 15 Mbps
        } else if (resolution >= 1920 * 1080) { // 1080p
            baseBitrate = 8000;  // 8 Mbps
        } else if (resolution >= 1280 * 720) { // 720p
            baseBitrate = 4000;  // 4 Mbps
        } else { // 其他分辨率
            baseBitrate = 2000;  // 2 Mbps
        }
        
        // 根据质量等级调整码率
        const qualityMultipliers = {
            'high': 1.0,      // 100% 基础码率
            'medium': 0.7,    // 70% 基础码率
            'low': 0.4        // 40% 基础码率
        };
        
        const multiplier = qualityMultipliers[quality] || 0.7;
        const finalBitrate = Math.round(baseBitrate * multiplier);
        
        console.log(`🎯 动态码率计算: ${this.originalVideoInfo.width}x${this.originalVideoInfo.height} -> ${finalBitrate}k (${quality})`);
        return `${finalBitrate}k`;
    }

    // 计算音频码率
    calculateAudioBitrate() {
        const quality = this.qualityLevelSelect.value;
        
        // 根据质量等级设置音频码率
        const audioBitrates = {
            'original': '192k',   // 保持原始质量
            'high': '192k',       // 高质量
            'medium': '128k',     // 标准质量
            'low': '96k'          // 低质量
        };
        
        return audioBitrates[quality] || '128k';
    }

    // 重置视频状态
    resetVideoState() {
        // 重置处理后的视频
        this.processedVideo = null;
        
        // 重置时间设置
        this.startTime = 0;
        this.endTime = 0;
        
        // 重置按钮状态
        this.processVideoBtn.disabled = true;
        this.downloadBtn.disabled = true;
        this.replaceSourceBtn.disabled = true;
        this.compareBtn.disabled = true;
        
        // 隐藏处理状态和文件信息
        this.hideProcessingStatus();
        this.hideFileSizeInfo();
        
        // 隐藏替换选项对话框
        this.hideReplacementOptions();
        
        // 重置时间轴
        this.timelineRange.style.left = '0%';
        this.timelineRange.style.width = '100%';
        
        console.log('🔄 视频状态已重置');
    }

    // 设置时间轴handle拖拽功能
    setupTimelineHandles() {
        let isDragging = false;
        let dragHandle = null;
        let animationId = null;
        
        // 开始handle拖拽
        this.startHandle.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragHandle = 'start';
            this._currentDragHandle = 'start';
            
            // 预计算所有需要的值，避免拖拽时重复计算
            const trackElement = document.getElementById('timelineTrack');
            if (trackElement) {
                this._trackCache = trackElement.getBoundingClientRect();
                // 预计算轨道宽度，避免重复计算
                this._trackWidth = this._trackCache.width;
                this._trackLeft = this._trackCache.left;
            }
            
            this.showPreview('start');
            e.preventDefault();
            e.stopPropagation();
        });
        
        // 结束handle拖拽
        this.endHandle.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragHandle = 'end';
            this._currentDragHandle = 'end';
            
            // 预计算所有需要的值，避免拖拽时重复计算
            const trackElement = document.getElementById('timelineTrack');
            if (trackElement) {
                this._trackCache = trackElement.getBoundingClientRect();
                // 预计算轨道宽度，避免重复计算
                this._trackWidth = this._trackCache.width;
                this._trackLeft = this._trackCache.left;
            }
            
            this.showPreview('end');
            e.preventDefault();
            e.stopPropagation();
        });
        
        // 重写的点击滑块函数 - 三步逻辑
        this.timelineSlider.addEventListener('click', (e) => {
            if (!this.videoDuration || isDragging) return;
            
            const trackElement = document.getElementById('timelineTrack');
            if (!trackElement) return;
            
            const trackRect = trackElement.getBoundingClientRect();
            const clickX = e.clientX - trackRect.left;
            const trackWidth = trackRect.width;
            
            // 确保点击位置在轨道范围内
            if (clickX < 0 || clickX > trackWidth) return;
            
            const percent = clickX / trackWidth;
            const clickTime = percent * this.videoDuration;
            
            // 1. 计算鼠标所在的位置，然后调整按钮的位置
            const startDistance = Math.abs(clickTime - this.startTime);
            const endDistance = Math.abs(clickTime - this.endTime);
            
            if (startDistance < endDistance) {
                this.startTime = Math.max(0, Math.min(clickTime, this.endTime - 0.1));
                this.startHandle.style.left = `${clickX}px`;
            } else {
                this.endTime = Math.min(this.videoDuration, Math.max(clickTime, this.startTime + 0.1));
                this.endHandle.style.left = `${clickX}px`;
            }
            
            // 2. 计算蓝条的位置和长度
            this.updateBlueBar(trackWidth);
            
            // 3. 刷新预览视图
            this.refreshPreview();
            
            // 更新时间显示
            this.updateTimeDisplays();
        });
        
        // 超高速拖拽函数 - 使用requestAnimationFrame确保流畅
        const handleMouseMove = (e) => {
            if (!isDragging || !this.videoDuration) return;
            
            // 取消之前的动画帧
            if (this._dragAnimationId) {
                cancelAnimationFrame(this._dragAnimationId);
            }
            
            // 使用requestAnimationFrame确保流畅更新
            this._dragAnimationId = requestAnimationFrame(() => {
                // 1. 计算鼠标所在的位置，然后调整按钮的位置
                const mouseX = e.clientX - this._trackLeft;
                const trackWidth = this._trackWidth;
                const clampedMouseX = Math.max(0, Math.min(mouseX, trackWidth));
                const percent = clampedMouseX / trackWidth;
                const time = percent * this.videoDuration;
                
                if (dragHandle === 'start') {
                    this.startTime = Math.max(0, Math.min(time, this.endTime - 0.1));
                    this.startHandle.style.left = `${clampedMouseX}px`;
                } else if (dragHandle === 'end') {
                    this.endTime = Math.min(this.videoDuration, Math.max(time, this.startTime + 0.1));
                    this.endHandle.style.left = `${clampedMouseX}px`;
                }
                
                // 2. 直接更新蓝条位置和长度，不调用方法
                const startPercent = (this.startTime / this.videoDuration) * 100;
                const endPercent = (this.endTime / this.videoDuration) * 100;
                const startPos = (startPercent / 100) * trackWidth;
                const endPos = (endPercent / 100) * trackWidth;
                
                this.timelineRange.style.left = `${startPos}px`;
                this.timelineRange.style.width = `${endPos - startPos}px`;
                
                // 3. 延迟更新预览视图和时间显示，避免频繁更新
                if (!this._previewUpdateTimer) {
                    this._previewUpdateTimer = setTimeout(() => {
                        this.refreshPreview();
                        this._previewUpdateTimer = null;
                    }, 16); // 约60fps
                }
                
                // 4. 实时更新时间显示，但限制频率
                if (!this._timeUpdateTimer) {
                    this._timeUpdateTimer = setTimeout(() => {
                        this.updateTimeDisplays();
                        this._timeUpdateTimer = null;
                    }, 8); // 约120fps，更频繁的时间更新
                }
            });
        };
        
        // 全局鼠标移动事件
        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        
        // 全局鼠标松开事件
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                dragHandle = null;
                this._currentDragHandle = null;
                
                if (animationId) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                }
                
                // 清理拖拽动画帧
                if (this._dragAnimationId) {
                    cancelAnimationFrame(this._dragAnimationId);
                    this._dragAnimationId = null;
                }
                
                // 清理预览更新定时器
                if (this._previewUpdateTimer) {
                    clearTimeout(this._previewUpdateTimer);
                    this._previewUpdateTimer = null;
                }
                
                // 清理时间更新定时器
                if (this._timeUpdateTimer) {
                    clearTimeout(this._timeUpdateTimer);
                    this._timeUpdateTimer = null;
                }
                
                // 清理所有缓存
                this._trackCache = null;
                this._trackWidth = null;
                this._trackLeft = null;
                
                // 拖拽结束后更新时间显示
                this.updateTimeDisplays();
                
                setTimeout(() => this.hidePreview(), 1000);
            }
        });
        
        // 防止拖拽时选中文本
        document.addEventListener('selectstart', (e) => {
            if (isDragging) {
                e.preventDefault();
            }
        });
    }

    // 更新时间轴
    updateTimeline() {
        this.startTime = 0;
        this.endTime = this.videoDuration;
        
        this.updateHandlePosition('start');
        this.updateHandlePosition('end');
        
        this.updateTimeDisplays();
        this.updateTimelineRange();
        this.showPreview('range');
        
        // 更新固定时间显示
        if (this.fixedEndTime) {
            this.fixedEndTime.textContent = this.formatTime(this.videoDuration);
        }
    }

    // 更新手柄位置
    updateHandlePosition(handle) {
        const handleElement = handle === 'start' ? this.startHandle : this.endHandle;
        const trackElement = document.getElementById('timelineTrack');
        
        if (!trackElement) return;
        
        // 获取轨道位置和宽度
        const trackRect = trackElement.getBoundingClientRect();
        const sliderRect = this.timelineSlider.getBoundingClientRect();
        const trackLeft = trackRect.left - sliderRect.left;
        const trackWidth = trackRect.width;
        
        // 如果没有视频时长，设置默认位置
        if (!this.videoDuration) {
            if (handle === 'start') {
                // 开始手柄在轨道开始位置
                handleElement.style.left = `${trackLeft}px`;
            } else {
                // 结束手柄在轨道结束位置
                handleElement.style.left = `${trackLeft + trackWidth}px`;
            }
            return;
        }
        
        const percent = handle === 'start' ? 
            (this.startTime / this.videoDuration) * 100 :
            (this.endTime / this.videoDuration) * 100;
        
        // 计算手柄位置：0-100%映射到轨道范围内
        const position = trackLeft + (percent / 100) * trackWidth;
        
        // 确保手柄不会超出轨道边界
        const clampedPosition = Math.max(trackLeft, Math.min(position, trackLeft + trackWidth));
        
        // 设置手柄位置
        handleElement.style.left = `${clampedPosition}px`;
    }


    // 快速更新手柄位置（拖拽时使用）
    updateHandlePositionFast(handle) {
        const handleElement = handle === 'start' ? this.startHandle : this.endHandle;
        const trackElement = document.getElementById('timelineTrack');
        
        if (!trackElement) return;
        
        // 缓存轨道信息，避免重复查询
        if (!this._trackCache) {
            const trackRect = trackElement.getBoundingClientRect();
            const sliderRect = this.timelineSlider.getBoundingClientRect();
            this._trackCache = {
                left: trackRect.left - sliderRect.left,
                width: trackRect.width
            };
        }
        
        const percent = handle === 'start' ? 
            (this.startTime / this.videoDuration) * 100 :
            (this.endTime / this.videoDuration) * 100;
        
        // 计算手柄位置
        const position = this._trackCache.left + (percent / 100) * this._trackCache.width;
        const clampedPosition = Math.max(this._trackCache.left, Math.min(position, this._trackCache.left + this._trackCache.width));
        
        // 直接设置位置，不更新时间提示
        handleElement.style.left = `${clampedPosition}px`;
    }

    // 极速更新手柄位置（拖拽时使用）
    updateHandlePositionInstant(handle) {
        const handleElement = handle === 'start' ? this.startHandle : this.endHandle;
        
        // 使用缓存的轨道信息
        if (!this._trackCache) return;
        
        const sliderRect = this.timelineSlider.getBoundingClientRect();
        const trackLeft = this._trackCache.left - sliderRect.left;
        const trackWidth = this._trackCache.width;
        
        const percent = handle === 'start' ? 
            (this.startTime / this.videoDuration) * 100 :
            (this.endTime / this.videoDuration) * 100;
        
        const position = trackLeft + (percent / 100) * trackWidth;
        const clampedPosition = Math.max(trackLeft, Math.min(position, trackLeft + trackWidth));
        
        // 直接设置位置，零延迟
        handleElement.style.left = `${clampedPosition}px`;
    }

    // 计算蓝条的位置和长度
    updateBlueBar(trackWidth = null) {
        // 如果没有传入trackWidth，使用缓存的_trackWidth
        const width = trackWidth || this._trackWidth;
        if (!width) return;
        
        const startPercent = (this.startTime / this.videoDuration) * 100;
        const endPercent = (this.endTime / this.videoDuration) * 100;
        
        const startPos = (startPercent / 100) * width;
        const endPos = (endPercent / 100) * width;
        
        this.timelineRange.style.left = `${startPos}px`;
        this.timelineRange.style.width = `${endPos - startPos}px`;
    }

    // 刷新预览视图
    refreshPreview() {
        // 根据当前拖拽状态显示预览
        if (this._currentDragHandle === 'start') {
            this.showPreview('start');
        } else if (this._currentDragHandle === 'end') {
            this.showPreview('end');
        }
    }

    // 极速更新蓝条（拖拽时使用）
    updateTimelineRangeInstant() {
        // 使用缓存的轨道信息
        if (!this._trackCache) return;
        
        const sliderRect = this.timelineSlider.getBoundingClientRect();
        const trackLeft = this._trackCache.left - sliderRect.left;
        const trackWidth = this._trackCache.width;
        
        const startPercent = (this.startTime / this.videoDuration) * 100;
        const endPercent = (this.endTime / this.videoDuration) * 100;
        
        const startPosition = trackLeft + (startPercent / 100) * trackWidth;
        const endPosition = trackLeft + (endPercent / 100) * trackWidth;
        
        // 直接设置位置和宽度，零延迟
        this.timelineRange.style.left = `${startPosition}px`;
        this.timelineRange.style.width = `${endPosition - startPosition}px`;
    }

    // 超高效更新手柄位置（拖拽时使用）
    updateHandlePositionUltraFast(handle, trackRect) {
        const handleElement = handle === 'start' ? this.startHandle : this.endHandle;
        const sliderRect = this.timelineSlider.getBoundingClientRect();
        const trackLeft = trackRect.left - sliderRect.left;
        const trackWidth = trackRect.width;
        
        const percent = handle === 'start' ? 
            (this.startTime / this.videoDuration) * 100 :
            (this.endTime / this.videoDuration) * 100;
        
        const position = trackLeft + (percent / 100) * trackWidth;
        const clampedPosition = Math.max(trackLeft, Math.min(position, trackLeft + trackWidth));
        
        // 直接设置位置，最少的DOM操作
        handleElement.style.left = `${clampedPosition}px`;
    }

    // 超高效更新蓝条（拖拽时使用）
    updateTimelineRangeUltraFast(trackRect) {
        const sliderRect = this.timelineSlider.getBoundingClientRect();
        const trackLeft = trackRect.left - sliderRect.left;
        const trackWidth = trackRect.width;
        
        const startPercent = (this.startTime / this.videoDuration) * 100;
        const endPercent = (this.endTime / this.videoDuration) * 100;
        
        const startPosition = trackLeft + (startPercent / 100) * trackWidth;
        const endPosition = trackLeft + (endPercent / 100) * trackWidth;
        
        // 直接设置位置和宽度，最少的DOM操作
        this.timelineRange.style.left = `${startPosition}px`;
        this.timelineRange.style.width = `${endPosition - startPosition}px`;
    }

    // 快速更新蓝条（拖拽时使用）
    updateTimelineRangeFast() {
        const trackElement = document.getElementById('timelineTrack');
        if (!trackElement || !this._trackCache) return;
        
        const startPercent = (this.startTime / this.videoDuration) * 100;
        const endPercent = (this.endTime / this.videoDuration) * 100;
        
        const startPosition = this._trackCache.left + (startPercent / 100) * this._trackCache.width;
        const endPosition = this._trackCache.left + (endPercent / 100) * this._trackCache.width;
        
        this.timelineRange.style.left = `${startPosition}px`;
        this.timelineRange.style.width = `${endPosition - startPosition}px`;
    }


    // 这些方法现在由handle拖拽系统处理

    // 更新时间显示
    updateTimeDisplays() {
        this.startTimeDisplay.textContent = this.formatTime(this.startTime);
        this.endTimeDisplay.textContent = this.formatTime(this.endTime);
        
        // 计算并显示裁剪时长
        const cropDuration = this.endTime - this.startTime;
        this.cropDuration.textContent = this.formatTime(cropDuration);
    }

    // 更新选中范围显示
    updateTimelineRange() {
        const trackElement = document.getElementById('timelineTrack');
        
        if (!trackElement) return;
        
        // 获取轨道位置和宽度
        const trackRect = trackElement.getBoundingClientRect();
        const sliderRect = this.timelineSlider.getBoundingClientRect();
        const trackLeft = trackRect.left - sliderRect.left;
        const trackWidth = trackRect.width;
        
        if (this.videoDuration > 0) {
            const startPercent = (this.startTime / this.videoDuration) * 100;
            const endPercent = (this.endTime / this.videoDuration) * 100;
            
            // 计算蓝条位置：从开始手柄到结束手柄
            const startPosition = trackLeft + (startPercent / 100) * trackWidth;
            const endPosition = trackLeft + (endPercent / 100) * trackWidth;
            
            // 设置蓝条位置和宽度
            this.timelineRange.style.left = `${startPosition}px`;
            this.timelineRange.style.width = `${endPosition - startPosition}px`;
        } else {
            // 没有视频时，蓝条覆盖整个轨道
            this.timelineRange.style.left = `${trackLeft}px`;
            this.timelineRange.style.width = `${trackWidth}px`;
        }
    }

    // 显示预览
    showPreview(type) {
        if (!this.currentVideo || this.previewVideo.style.display === 'none') return;
        
        this.previewOverlay.style.display = 'block';
        
        if (type === 'start') {
            this.previewOverlay.className = 'preview-overlay start-preview';
            this.previewText.textContent = `开始: ${this.formatTime(this.startTime)}`;
            this.previewVideo.currentTime = this.startTime;
        } else if (type === 'end') {
            this.previewOverlay.className = 'preview-overlay end-preview';
            this.previewText.textContent = `结束: ${this.formatTime(this.endTime)}`;
            this.previewVideo.currentTime = this.endTime;
        } else if (type === 'range') {
            this.previewOverlay.className = 'preview-overlay range-preview';
            const duration = this.endTime - this.startTime;
            this.previewText.textContent = `裁剪区间: ${this.formatTime(duration)} (${this.formatTime(this.startTime)} - ${this.formatTime(this.endTime)})`;
        }
    }

    // 隐藏预览
    hidePreview() {
        this.previewOverlay.style.display = 'none';
    }

    // 格式化时间
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 处理视频
    async processVideo() {
        if (!this.currentVideo || this.isProcessing) return;
        
        // 记录开始时间
        const startTime = Date.now();
        console.log(`🎬 开始处理视频: ${this.startTime}s - ${this.endTime}s`);
        console.log(`⏰ 开始时间: ${new Date().toLocaleTimeString()}`);
        
        try {
            this.isProcessing = true;
            this.processVideoBtn.disabled = true;
            this.showProcessingStatus('正在处理视频...', 0);
            
            // 预估处理时间
            const estimatedTime = this.estimateProcessingTime();
            console.log(`⏱️ 预估处理时间: ${estimatedTime}`);
            this.showProcessingStatus(`正在处理视频... (预估: ${estimatedTime})`, 0);
            
            // 检查是否有原生FFmpeg可用 (Electron环境)
            const hasNativeFFmpeg = await this.checkNativeFFmpeg();
            if (hasNativeFFmpeg) {
                console.log('🚀 检测到原生FFmpeg，使用高性能处理');
                await this.processVideoWithNativeFFmpeg();
            } else if (this.useWebAPI) {
                // 使用Web API作为备用方案
                await this.processVideoWithWebAPI();
            } else {
                // 使用FFmpeg.wasm
                await this.processVideoWithFFmpeg();
            }
            
            // 计算总耗时
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const totalSeconds = (totalTime / 1000).toFixed(2);
            const minutes = Math.floor(totalTime / 60000);
            const seconds = ((totalTime % 60000) / 1000).toFixed(1);
            
            console.log('✅ 视频处理完成');
            console.log(`⏰ 结束时间: ${new Date().toLocaleTimeString()}`);
            console.log(`⏱️ 总耗时: ${totalSeconds}秒 (${minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`})`);
            
            this.showProcessingStatus(`视频处理完成！总耗时: ${totalSeconds}秒`, 100);
            this.downloadBtn.disabled = false;
            this.replaceSourceBtn.disabled = false;
            this.compareBtn.disabled = false;
            this.updateDownloadButton();
            this.showFileSizeInfo();
            
            // 自动显示对比结果
            await this.autoShowComparison();
            
        } catch (error) {
            // 计算失败时的耗时
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const totalSeconds = (totalTime / 1000).toFixed(2);
            
            console.error('❌ 视频处理失败:', error);
            console.log(`⏱️ 失败前耗时: ${totalSeconds}秒`);
            this.showProcessingStatus('视频处理失败，请重试', 100);
            this.showError('视频处理失败: ' + error.message);
        } finally {
            this.isProcessing = false;
            this.processVideoBtn.disabled = false;
        }
    }

    // 使用FFmpeg.wasm处理视频
    async processVideoWithFFmpeg() {
        // 如果在Electron环境中，重定向到原生FFmpeg处理
        if (this.ffmpeg === 'electron') {
            console.log('🚀 检测到Electron环境，重定向到原生FFmpeg处理');
            return await this.processVideoWithNativeFFmpeg();
        }
        
        if (!this.ffmpeg) {
            throw new Error('FFmpeg未初始化');
        }
        
        if (typeof window.FFmpegUtil === 'undefined') {
            throw new Error('FFmpegUtil未加载');
        }
        
        const { fetchFile } = window.FFmpegUtil;
        
        // 检查是否有原生FFmpeg可用 (未来扩展)
        const hasNativeFFmpeg = await this.checkNativeFFmpeg();
        if (hasNativeFFmpeg) {
            console.log('🚀 检测到原生FFmpeg，使用高性能处理');
            return await this.processVideoWithNativeFFmpeg();
        }
        
        console.log('⚠️ 使用FFmpeg.wasm处理 (性能受限)');
        console.log('💡 提示: 考虑使用原生应用获得更好性能');
        
        // 获取输出格式设置
        const outputFormat = this.getOutputFormat();
        const outputFile = `output.${outputFormat.extension}`;
        
        // 写入输入文件 - 添加进度反馈
        this.showProcessingStatus('正在读取视频文件...', 10);
        const inputData = await fetchFile(this.currentVideo);
        this.showProcessingStatus('正在写入临时文件...', 15);
        await this.ffmpeg.writeFile('input.mp4', inputData);
        this.updateProgress(20);
        
        // 清理输入数据引用，释放内存
        inputData = null;
        
        // 构建FFmpeg命令 - 质量保持的速度优化
        const speedOptimizations = [
            '-threads', '0',                    // 使用所有可用线程
            '-movflags', '+faststart',          // 快速启动
            '-avoid_negative_ts', 'make_zero',  // 避免时间戳问题
            '-fflags', '+genpts',               // 生成时间戳
            '-max_muxing_queue_size', '1024',   // 适度的缓冲队列
            '-analyzeduration', '2000000',      // 适度的分析时间，保证质量
            '-probesize', '2000000',            // 适度的探测大小，保证质量
            '-hwaccel', 'auto',                 // 自动硬件加速（如果可用）
            '-strict', 'experimental'           // 允许实验性功能
        ];
        
        const command = [
            '-i', 'input.mp4',
            '-ss', this.startTime.toString(),
            '-t', (this.endTime - this.startTime).toString(),
            ...speedOptimizations,
            ...outputFormat.ffmpegArgs,
            outputFile
        ];
        
        console.log('🎬 FFmpeg命令:', command.join(' '));
        
        // 执行裁剪、压缩和格式转换命令 - 添加详细进度反馈
        this.showProcessingStatus('正在处理视频...', 30);
        const processingStartTime = Date.now();
        
        // 开始性能监控
        const performanceInfo = this.startPerformanceMonitoring();
        
        await this.ffmpeg.exec(command);
        const processingTime = Date.now() - processingStartTime;
        const videoDuration = this.endTime - this.startTime;
        const speedRatio = videoDuration / (processingTime / 1000);
        
        // 停止性能监控
        this.stopPerformanceMonitoring(performanceInfo);
        
        console.log(`✅ FFmpeg.wasm核心处理完成`);
        console.log(`⚡ 核心处理统计:`);
        console.log(`   核心处理耗时: ${(processingTime / 1000).toFixed(2)}秒`);
        console.log(`   视频时长: ${videoDuration.toFixed(2)}秒`);
        console.log(`   处理速度: ${speedRatio.toFixed(2)}x (${speedRatio > 1 ? '实时' : '慢于实时'})`);
        console.log(`   质量模式: ${this.qualityLevelSelect.value}`);
        console.log(`   资源使用: 主要消耗CPU，建议监控活动监视器中的CPU使用率`);
        
        this.updateProgress(80);
        
        // 读取输出文件
        this.showProcessingStatus('正在读取输出文件...', 85);
        const data = await this.ffmpeg.readFile(outputFile);
        this.updateProgress(95);
        
        this.processedVideo = new Blob([data.buffer], { type: outputFormat.mimeType });
        
        // 清理临时文件和内存
        this.showProcessingStatus('正在清理临时文件...', 98);
        await this.ffmpeg.deleteFile('input.mp4');
        await this.ffmpeg.deleteFile(outputFile);
        
        // 清理数据引用，释放内存
        data = null;
        this.updateProgress(100);
    }

    // 获取输出格式配置
    getOutputFormat() {
        const format = this.outputFormatSelect.value;
        const quality = this.qualityLevelSelect.value;
        
        // 质量设置 - 保持质量的前提下优化速度
        const qualitySettings = {
            original: {
                // 保持原始质量设置
                crf: '15',                // 使用更低的CRF值保持高质量
                preset: 'slow',           // 使用slow预设获得最佳质量
                bitrate: this.getOriginalBitrate(), // 使用原始码率
                tune: 'film',             // 针对视频内容优化
                profile: 'high',          // 使用高质量配置文件
                level: '4.1',             // 使用较高的编码级别
                copyOriginal: true        // 标记为保持原始质量
            },
            high: { 
                crf: '18', 
                preset: 'fast',           // 使用fast预设，平衡质量和速度
                bitrate: '192k',
                tune: 'film',             // 针对视频内容优化
                profile: 'high',          // 使用高质量配置文件
                level: '4.1'              // 使用较高的编码级别
            },
            medium: { 
                crf: '23', 
                preset: 'faster',         // 使用faster预设
                bitrate: '128k',
                tune: 'film',
                profile: 'main',          // 使用标准配置文件
                level: '4.0'              // 使用标准编码级别
            },
            low: { 
                crf: '28', 
                preset: 'veryfast',       // 使用veryfast预设
                bitrate: '96k',
                tune: 'film',
                profile: 'baseline',      // 使用基础配置文件
                level: '3.1'              // 使用较低编码级别
            }
        };
        
        const qualityConfig = qualitySettings[quality];
        
        // 格式配置 - 质量保持的速度优化
        const formatConfigs = {
            mp4: {
                extension: 'mp4',
                mimeType: 'video/mp4',
                ffmpegArgs: this.generateFFmpegArgs(format, qualityConfig)
            },
            webm: {
                extension: 'webm',
                mimeType: 'video/webm',
                ffmpegArgs: this.generateFFmpegArgs(format, qualityConfig)
            },
            avi: {
                extension: 'avi',
                mimeType: 'video/avi',
                ffmpegArgs: this.generateFFmpegArgs(format, qualityConfig)
            },
            mov: {
                extension: 'mov',
                mimeType: 'video/quicktime',
                ffmpegArgs: this.generateFFmpegArgs(format, qualityConfig)
            }
        };
        
        const config = formatConfigs[format];
        console.log(`🎬 选择格式: ${format.toUpperCase()}, 质量: ${quality}, CRF: ${qualityConfig.crf}`);
        return config;
    }

    // 生成FFmpeg参数
    generateFFmpegArgs(format, qualityConfig) {
        const baseArgs = [];
        
        // 根据格式选择编码器
        if (format === 'webm') {
            baseArgs.push('-c:v', 'libvpx-vp9');
            baseArgs.push('-crf', qualityConfig.crf);
            baseArgs.push('-b:v', '0');  // VP9使用CRF模式
            baseArgs.push('-c:a', 'libopus');
            baseArgs.push('-b:a', qualityConfig.bitrate);
            
            if (qualityConfig.copyOriginal) {
                // 保持原始质量时使用更保守的设置
                baseArgs.push('-speed', '1');  // 更慢但质量更好
                baseArgs.push('-threads', '0');
                baseArgs.push('-tile-columns', '1');
                baseArgs.push('-frame-parallel', '0');
                baseArgs.push('-lag-in-frames', '25');
                baseArgs.push('-error-resilient', '1');
            } else {
                // 标准设置
                baseArgs.push('-speed', '2');
                baseArgs.push('-threads', '0');
                baseArgs.push('-tile-columns', '2');
                baseArgs.push('-frame-parallel', '1');
                baseArgs.push('-lag-in-frames', '16');
                baseArgs.push('-error-resilient', '1');
            }
        } else {
            // H.264编码器 (MP4, AVI, MOV)
            baseArgs.push('-c:v', 'libx264');
            baseArgs.push('-crf', qualityConfig.crf);
            baseArgs.push('-preset', qualityConfig.preset);
            baseArgs.push('-tune', qualityConfig.tune);
            baseArgs.push('-profile:v', qualityConfig.profile);
            baseArgs.push('-level', qualityConfig.level);
            
            // 音频编码器
            if (format === 'avi') {
                baseArgs.push('-c:a', 'mp3');
            } else {
                baseArgs.push('-c:a', 'aac');
            }
            baseArgs.push('-b:a', qualityConfig.bitrate);
            
            // 格式特定参数
            if (format === 'mp4' || format === 'mov') {
                baseArgs.push('-movflags', '+faststart');
            }
            
            if (qualityConfig.copyOriginal) {
                // 保持原始质量时使用更保守的设置
                baseArgs.push('-threads', '0');
                baseArgs.push('-x264opts', 'me=umh:subme=9:me_range=24:ref=5:bframes=3:b_adapt=2:direct=auto:weightb=1:weightp=2:aq-mode=3:aq-strength=1.0:psy-rd=1.0:0.15:deblock=0:0');
                baseArgs.push('-g', '120');  // 更短的关键帧间隔
                baseArgs.push('-keyint_min', '12');
                baseArgs.push('-bf', '5');   // 更多B帧
                baseArgs.push('-refs', '5'); // 更多参考帧
            } else {
                // 标准设置
                baseArgs.push('-threads', '0');
                baseArgs.push('-x264opts', 'me=hex:subme=6:me_range=16');
                baseArgs.push('-g', '250');
                baseArgs.push('-keyint_min', '25');
                baseArgs.push('-bf', '3');
                baseArgs.push('-refs', '3');
                baseArgs.push('-aq-mode', '2');
                baseArgs.push('-aq-strength', '1.0');
                baseArgs.push('-psy-rd', '1.0:0.15');
                baseArgs.push('-deblock', '0:0');
            }
        }
        
        return baseArgs;
    }

    // 开始性能监控
    startPerformanceMonitoring() {
        const performanceInfo = {
            startTime: performance.now(),
            startMemory: this.getMemoryUsage(),
            monitoringInterval: null
        };
        
        // 每2秒输出一次性能信息
        performanceInfo.monitoringInterval = setInterval(() => {
            const currentMemory = this.getMemoryUsage();
            const elapsed = (performance.now() - performanceInfo.startTime) / 1000;
            
            // 检查FFmpeg状态
            const ffmpegStatus = this.ffmpeg ? '已加载' : '未加载';
            const isProcessing = this.isProcessing ? '处理中' : '空闲';
            
            console.log(`📊 处理状态: ${isProcessing} | 耗时: ${elapsed.toFixed(1)}s | 内存: ${currentMemory.toFixed(1)}MB | FFmpeg: ${ffmpegStatus}`);
            
            // 如果CPU使用率不高，给出诊断建议
            if (elapsed > 10 && currentMemory < 100) {
                console.log(`⚠️ 诊断: 处理时间较长但资源使用率低，可能原因:`);
                console.log(`   1. FFmpeg.wasm性能限制 (WebAssembly比原生慢)`);
                console.log(`   2. 浏览器沙盒限制`);
                console.log(`   3. 单线程处理限制`);
                console.log(`   4. 检查活动监视器中的所有浏览器进程`);
            }
        }, 2000);
        
        console.log(`🔍 开始性能监控 - 主要消耗CPU资源`);
        console.log(`💡 提示: 在活动监视器中监控浏览器进程的CPU使用率`);
        
        // 输出系统诊断信息
        this.outputSystemDiagnostics();
        
        return performanceInfo;
    }
    
    // 停止性能监控
    stopPerformanceMonitoring(performanceInfo) {
        if (performanceInfo.monitoringInterval) {
            clearInterval(performanceInfo.monitoringInterval);
        }
        
        const totalTime = (performance.now() - performanceInfo.startTime) / 1000;
        const endMemory = this.getMemoryUsage();
        const memoryDiff = endMemory - performanceInfo.startMemory;
        
        console.log(`📊 性能监控结束:`);
        console.log(`   总耗时: ${totalTime.toFixed(2)}秒`);
        console.log(`   内存变化: ${memoryDiff > 0 ? '+' : ''}${memoryDiff.toFixed(1)}MB`);
        console.log(`   当前内存: ${endMemory.toFixed(1)}MB`);
    }
    
    // 获取内存使用情况
    getMemoryUsage() {
        if (performance.memory) {
            return performance.memory.usedJSHeapSize / 1024 / 1024; // 转换为MB
        }
        return 0;
    }
    
    // 输出系统诊断信息
    outputSystemDiagnostics() {
        console.log(`🔧 系统诊断信息:`);
        
        // 浏览器信息
        const userAgent = navigator.userAgent;
        const isChrome = userAgent.includes('Chrome');
        const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
        const isFirefox = userAgent.includes('Firefox');
        
        console.log(`   浏览器: ${isChrome ? 'Chrome' : isSafari ? 'Safari' : isFirefox ? 'Firefox' : '其他'}`);
        
        // 硬件信息
        const cores = navigator.hardwareConcurrency || '未知';
        console.log(`   CPU核心数: ${cores}`);
        
        // 内存信息
        const memory = this.getMemoryUsage();
        console.log(`   当前内存使用: ${memory.toFixed(1)}MB`);
        
        // FFmpeg状态
        const ffmpegLoaded = this.ffmpeg ? '已加载' : '未加载';
        console.log(`   FFmpeg状态: ${ffmpegLoaded}`);
        
        // 视频信息
        if (this.currentVideo) {
            const fileSize = (this.currentVideo.size / 1024 / 1024).toFixed(1);
            console.log(`   视频文件大小: ${fileSize}MB`);
        }
        
        console.log(`📋 活动监视器检查清单:`);
        console.log(`   1. 查看所有浏览器进程 (Chrome/Safari/Firefox)`);
        console.log(`   2. 检查渲染进程 (Renderer Process)`);
        console.log(`   3. 查看GPU进程 (如果存在)`);
        console.log(`   4. 按CPU使用率排序，找到最活跃的进程`);
        console.log(`   5. 如果CPU使用率低，可能是FFmpeg.wasm性能限制`);
    }
    
    // 检查是否有原生FFmpeg可用
    async checkNativeFFmpeg() {
        // 检查是否在Electron环境中
        if (window.electronAPI) {
            try {
                const hasFFmpeg = await window.electronAPI.checkFFmpeg();
                if (hasFFmpeg) {
                    console.log('🚀 检测到Electron环境 + 原生FFmpeg');
                    return true;
                }
            } catch (error) {
                console.log('⚠️ Electron环境检测失败:', error);
            }
        }
        
        // 检查WebCodecs API (未来技术)
        if (window.VideoEncoder && window.VideoDecoder) {
            console.log('🔮 检测到WebCodecs API (实验性)');
            // 未来可以实现WebCodecs版本
        }
        
        return false;
    }
    
    // 使用原生FFmpeg处理视频
    async processVideoWithNativeFFmpeg() {
        if (!window.electronAPI) {
            throw new Error('原生FFmpeg需要Electron环境');
        }
        
        // 记录开始时间
        const startTime = Date.now();
        console.log('🚀 使用原生FFmpeg处理视频');
        console.log(`⏰ 开始时间: ${new Date().toLocaleTimeString()}`);
        
        try {
            // 获取输出格式设置
            const outputFormat = this.getOutputFormat();
            const outputFile = `output.${outputFormat.extension}`;
            
            // 计算视频码率
            const videoBitrate = this.calculateVideoBitrate();
            
            // 读取视频文件数据
            const fileData = await this.currentVideo.arrayBuffer();
            
            // 设置处理选项
            const options = {
                inputPath: 'input.mp4',  // 虚拟文件路径
                fileData: fileData,      // 实际文件数据
                outputPath: outputFile,
                startTime: this.startTime,
                duration: this.endTime - this.startTime,
                format: this.outputFormatSelect.value,
                quality: this.qualityLevelSelect.value,
                crf: this.getOutputFormat().ffmpegArgs.find(arg => arg === '-crf')?.next || '23',
                preset: this.getOutputFormat().ffmpegArgs.find(arg => arg === '-preset')?.next || 'faster',
                videoBitrate: videoBitrate,
                audioBitrate: this.calculateAudioBitrate()
            };
            
            console.log(`🎯 码率设置: 视频=${videoBitrate}, 音频=${this.calculateAudioBitrate()}`);
            
            // 设置进度监听
            window.electronAPI.onFFmpegProgress((data) => {
                this.updateProgress(20 + (data.progress * 0.6)); // 20-80%范围
                this.showProcessingStatus(`处理中... ${data.progress}%`, 20 + (data.progress * 0.6));
            });
            
            // 调用原生FFmpeg处理
            const result = await window.electronAPI.processVideo(options);
            
            if (result.success) {
                // 计算总耗时
                const endTime = Date.now();
                const totalTime = endTime - startTime;
                const totalSeconds = (totalTime / 1000).toFixed(2);
                const minutes = Math.floor(totalTime / 60000);
                const seconds = ((totalTime % 60000) / 1000).toFixed(1);
                
                console.log('✅ 原生FFmpeg处理完成');
                console.log(`⏰ 结束时间: ${new Date().toLocaleTimeString()}`);
                console.log(`⏱️ 总耗时: ${totalSeconds}秒 (${minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`})`);
                
                // 处理返回的视频数据
                if (result.videoData) {
                    // 将Array转换为Uint8Array，然后创建Blob
                    const videoArray = new Uint8Array(result.videoData);
                    const outputFormat = this.getOutputFormat();
                    this.processedVideo = new Blob([videoArray], { type: outputFormat.mimeType });
                    
                    console.log(`📁 处理后的视频已创建: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
                } else if (result.outputPath) {
                    // 大文件情况：使用文件路径
                    console.log('📦 大文件处理，使用文件路径:', result.outputPath);
                    
                    // 对于大文件，我们需要通过Electron API读取文件
                    try {
                        const fileData = await window.electronAPI.readFile(result.outputPath);
                        if (fileData) {
                            if (fileData.isFilePath) {
                                // 超大文件，无法读取到内存，使用下载方式
                                console.log('📦 超大文件检测，使用下载方式');
                                this.processedVideo = null; // 标记为需要下载
                                this.processedVideoPath = fileData.filePath;
                                console.log(`📁 超大文件路径: ${fileData.filePath}`);
                            } else {
                                // 正常文件数据
                                const outputFormat = this.getOutputFormat();
                                this.processedVideo = new Blob([fileData], { type: outputFormat.mimeType });
                                console.log(`📁 大文件已读取: ${(result.fileSize / 1024 / 1024).toFixed(2)} MB`);
                            }
                        }
                    } catch (readError) {
                        console.error('❌ 读取大文件失败:', readError);
                        throw new Error('无法读取处理后的视频文件');
                    }
                } else {
                    throw new Error('没有收到处理后的视频数据');
                }
                
                // 显示耗时信息给用户
                this.showProcessingStatus(`处理完成！耗时: ${totalSeconds}秒`, 100);
                
                this.updateProgress(100);
                return result;
            } else {
                throw new Error('原生FFmpeg处理失败');
            }
            
        } catch (error) {
            // 计算失败时的耗时
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const totalSeconds = (totalTime / 1000).toFixed(2);
            
            console.error('❌ 原生FFmpeg处理错误:', error);
            console.log(`⏱️ 失败前耗时: ${totalSeconds}秒`);
            throw error;
        } finally {
            // 清理进度监听器
            window.electronAPI.removeFFmpegProgressListener();
        }
    }
    
    // FFmpeg.wasm处理 (重命名原方法)
    async processVideoWithFFmpegWasm() {
        // 这里是原来的FFmpeg.wasm处理逻辑
        // 为了保持代码结构清晰，将原方法重命名
        console.log('🔄 使用FFmpeg.wasm处理...');
        
        // 继续原有的处理逻辑...
        const { fetchFile } = window.FFmpegUtil;
        
        // 获取输出格式设置
        const outputFormat = this.getOutputFormat();
        const outputFile = `output.${outputFormat.extension}`;
        
        // 写入输入文件 - 添加进度反馈
        this.showProcessingStatus('正在读取视频文件...', 10);
        const inputData = await fetchFile(this.currentVideo);
        this.showProcessingStatus('正在写入临时文件...', 15);
        await this.ffmpeg.writeFile('input.mp4', inputData);
        this.updateProgress(20);
        
        // 清理输入数据引用，释放内存
        inputData = null;
        
        // 构建FFmpeg命令 - 质量保持的速度优化
        const speedOptimizations = [
            '-threads', '0',                    // 使用所有可用线程
            '-movflags', '+faststart',          // 快速启动
            '-avoid_negative_ts', 'make_zero',  // 避免时间戳问题
            '-fflags', '+genpts',               // 生成时间戳
            '-max_muxing_queue_size', '1024',   // 适度的缓冲队列
            '-analyzeduration', '2000000',      // 适度的分析时间，保证质量
            '-probesize', '2000000',            // 适度的探测大小，保证质量
            '-hwaccel', 'auto',                 // 自动硬件加速（如果可用）
            '-strict', 'experimental'           // 允许实验性功能
        ];
        
        const command = [
            '-i', 'input.mp4',
            '-ss', this.startTime.toString(),
            '-t', (this.endTime - this.startTime).toString(),
            ...speedOptimizations,
            ...outputFormat.ffmpegArgs,
            outputFile
        ];
        
        console.log('🎬 FFmpeg命令:', command.join(' '));
        
        // 执行裁剪、压缩和格式转换命令 - 添加详细进度反馈
        this.showProcessingStatus('正在处理视频...', 30);
        const startTime = Date.now();
        
        // 开始性能监控
        const performanceInfo = this.startPerformanceMonitoring();
        
        await this.ffmpeg.exec(command);
        const processingTime = Date.now() - startTime;
        const videoDuration = this.endTime - this.startTime;
        const speedRatio = videoDuration / (processingTime / 1000);
        
        // 停止性能监控
        this.stopPerformanceMonitoring(performanceInfo);
        
        console.log(`⚡ 视频处理统计:`);
        console.log(`   处理耗时: ${(processingTime / 1000).toFixed(2)}秒`);
        console.log(`   视频时长: ${videoDuration.toFixed(2)}秒`);
        console.log(`   处理速度: ${speedRatio.toFixed(2)}x (${speedRatio > 1 ? '实时' : '慢于实时'})`);
        console.log(`   质量模式: ${this.qualityLevelSelect.value} (CRF: ${this.getOutputFormat().ffmpegArgs.find(arg => arg === '-crf')?.next || '23'})`);
        console.log(`   资源使用: 主要消耗CPU，建议监控活动监视器中的CPU使用率`);
        
        this.updateProgress(80);
        
        // 读取输出文件
        this.showProcessingStatus('正在读取输出文件...', 85);
        const data = await this.ffmpeg.readFile(outputFile);
        this.updateProgress(95);
        
        this.processedVideo = new Blob([data.buffer], { type: outputFormat.mimeType });
        
        // 清理临时文件和内存
        this.showProcessingStatus('正在清理临时文件...', 98);
        await this.ffmpeg.deleteFile('input.mp4');
        await this.ffmpeg.deleteFile(outputFile);
        
        // 清理数据引用，释放内存
        data = null;
        this.updateProgress(100);
    }

    // 使用Web API处理视频（备用方案）
    async processVideoWithWebAPI() {
        console.log('🌐 使用Web API备用方案处理视频');
        
        try {
            // 创建一个临时的canvas元素
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 设置canvas尺寸
            canvas.width = this.previewVideo.videoWidth || 1920;
            canvas.height = this.previewVideo.videoHeight || 1080;
            
            // 创建MediaRecorder来录制裁剪后的视频
            const stream = canvas.captureStream(30); // 30fps
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9'
            });
            
            const chunks = [];
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                    this.updateProgress(50 + (chunks.length * 10));
                }
            };
            
            return new Promise((resolve, reject) => {
                mediaRecorder.onstop = () => {
                    this.processedVideo = new Blob(chunks, { type: 'video/webm' });
                    console.log('✅ Web API视频处理完成');
                    this.updateProgress(100);
                    resolve();
                };
                
                mediaRecorder.onerror = (error) => {
                    console.error('❌ MediaRecorder错误:', error);
                    reject(error);
                };
                
                mediaRecorder.start();
                this.updateProgress(20);
                
                // 播放视频并录制指定时间段
                this.previewVideo.currentTime = this.startTime;
                this.previewVideo.play();
                
                const duration = this.endTime - this.startTime;
                const startTime = Date.now();
                
                const drawFrame = () => {
                    if (Date.now() - startTime >= duration * 1000) {
                        mediaRecorder.stop();
                        this.previewVideo.pause();
                        return;
                    }
                    
                    // 绘制当前帧到canvas
                    ctx.drawImage(this.previewVideo, 0, 0, canvas.width, canvas.height);
                    requestAnimationFrame(drawFrame);
                };
                
                // 等待视频可以播放
                if (this.previewVideo.readyState >= 2) {
                    drawFrame();
                } else {
                    this.previewVideo.oncanplay = () => {
                        drawFrame();
                    };
                }
            });
            
        } catch (error) {
            console.error('❌ Web API处理失败:', error);
            throw new Error('Web API处理失败: ' + error.message);
        }
    }

    // 下载视频
    downloadVideo() {
        if (!this.processedVideo && !this.processedVideoPath) return;
        
        // 获取当前选择的格式
        const selectedFormat = this.outputFormatSelect.value;
        const quality = this.qualityLevelSelect.value;
        
        // 生成文件名
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `cropped_video_${selectedFormat.toUpperCase()}_${quality}_${timestamp}.${selectedFormat}`;
        
        if (this.processedVideo) {
            // 正常文件下载
            const url = URL.createObjectURL(this.processedVideo);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log(`📥 视频下载完成: ${selectedFormat.toUpperCase()}格式 (${quality}质量)`);
        } else if (this.processedVideoPath) {
            // 超大文件下载 - 使用Electron API
            console.log('📦 超大文件下载，使用Electron API');
            this.downloadLargeFile(this.processedVideoPath, filename);
        }
    }
    
    // 下载超大文件
    async downloadLargeFile(filePath, filename) {
        try {
            // 使用Electron API下载文件
            if (window.electronAPI && window.electronAPI.downloadFile) {
                await window.electronAPI.downloadFile(filePath, filename);
                console.log(`📥 超大文件下载完成: ${filename}`);
            } else {
                // 降级方案：提示用户手动复制文件
                this.showError(`超大文件无法自动下载，请手动复制文件：\n${filePath}`);
            }
        } catch (error) {
            console.error('❌ 超大文件下载失败:', error);
            this.showError('超大文件下载失败: ' + error.message);
        }
    }

    // 替换源文件
    replaceSourceFile() {
        if (!this.processedVideo) {
            this.showError('没有处理后的视频文件');
            return;
        }
        
        // 显示替换选项
        this.showReplacementOptions();
    }

    // 显示替换选项对话框
    showReplacementOptions() {
        const originalDuration = this.formatTime(this.videoDuration);
        const processedDuration = this.formatTime(this.endTime - this.startTime);
        
        // 更新显示信息
        this.originalDurationDisplay.textContent = originalDuration;
        this.processedDurationDisplay.textContent = processedDuration;
        
        // 检查浏览器兼容性并更新按钮状态
        this.updateOverwriteButtonState();
        
        // 显示对话框
        this.replacementOptions.style.display = 'flex';
    }

    // 更新覆盖按钮状态
    updateOverwriteButtonState() {
        const overwriteBtn = document.getElementById('overwriteOriginalBtn');
        const isSupported = window.showOpenFilePicker && window.showSaveFilePicker;
        
        if (isSupported) {
            overwriteBtn.disabled = false;
            overwriteBtn.textContent = '⚡ 真正覆盖原文件（Chrome/Edge）';
            overwriteBtn.title = '使用 File System Access API 真正覆盖原文件';
        } else {
            overwriteBtn.disabled = true;
            overwriteBtn.textContent = '⚡ 真正覆盖原文件（不支持当前浏览器）';
            overwriteBtn.title = '当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge';
        }
    }

    // 隐藏替换选项对话框
    hideReplacementOptions() {
        this.replacementOptions.style.display = 'none';
    }

    // 权限预检测和提前授权
    async checkFileSystemPermission() {
        // 检查浏览器支持
        if (!window.showOpenFilePicker || !window.showSaveFilePicker) {
            this.fileSystemAccessSupported = false;
            return false;
        }
        
        this.fileSystemAccessSupported = true;
        
        // 如果已经检查过权限，直接返回结果
        if (this.permissionChecked) {
            return this.permissionGranted;
        }
        
        // 如果正在检查权限，返回检查Promise
        if (this.permissionCheckPromise) {
            return await this.permissionCheckPromise;
        }
        
        // 开始权限检查
        this.permissionCheckPromise = this.performPermissionCheck();
        const result = await this.permissionCheckPromise;
        this.permissionChecked = true;
        
        return result;
    }
    
    // 执行权限检查
    async performPermissionCheck() {
        try {
            console.log('🔍 开始文件系统权限预检测...');
            this.showProcessingStatus('正在检查文件系统权限...', 10);
            
            // 让用户选择文件进行权限测试
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Video files',
                    accept: {
                        'video/*': ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.flv']
                    }
                }],
                excludeAcceptAllOption: false,
                multiple: false
            });
            
            this.showProcessingStatus('正在请求文件写入权限...', 30);
            
            // 请求写权限
            const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
            
            if (permission === 'granted') {
                this.permissionGranted = true;
                this.selectedFileHandle = fileHandle;
                this.showProcessingStatus('✅ 文件权限已授权，可以安全覆盖文件', 100);
                console.log('✅ 文件系统权限检查通过');
                
                // 显示权限状态提示
                this.showPermissionStatus(true);
                
                return true;
            } else {
                this.permissionGranted = false;
                this.showProcessingStatus('❌ 文件权限被拒绝，将使用下载模式', 100);
                console.log('❌ 文件系统权限被拒绝');
                
                // 显示权限状态提示
                this.showPermissionStatus(false);
                
                return false;
            }
            
        } catch (error) {
            console.error('❌ 权限检查失败:', error);
            this.permissionGranted = false;
            this.showProcessingStatus('⚠️ 权限检查失败，将使用下载模式', 100);
            
            // 显示权限状态提示
            this.showPermissionStatus(false);
            
            return false;
        }
    }
    
    // 显示权限状态
    showPermissionStatus(granted) {
        const statusElement = document.getElementById('permissionStatus');
        if (!statusElement) return;
        
        if (granted) {
            statusElement.innerHTML = `
                <div style="color: #10b981; font-size: 14px; margin-top: 10px;">
                    ✅ 文件权限已授权 - 可以直接覆盖原文件
                </div>
            `;
        } else {
            statusElement.innerHTML = `
                <div style="color: #f59e0b; font-size: 14px; margin-top: 10px;">
                    ⚠️ 文件权限未授权 - 将使用下载模式
                </div>
            `;
        }
    }
    
    // 在编辑开始时提示权限授权
    async promptPermissionOnEdit() {
        if (!this.fileSystemAccessSupported) {
            return;
        }
        
        if (!this.permissionChecked) {
            const granted = await this.checkFileSystemPermission();
            if (!granted) {
                // 显示权限提示对话框
                this.showPermissionDialog();
            }
        }
    }
    
    // 显示权限提示对话框
    showPermissionDialog() {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        dialog.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 500px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            ">
                <h3 style="margin: 0 0 15px 0; color: #1f2937;">🔐 文件权限授权</h3>
                <p style="margin: 0 0 20px 0; color: #6b7280; line-height: 1.5;">
                    为了能够直接覆盖原文件（而不是下载新文件），需要授权文件写入权限。
                </p>
                <p style="margin: 0 0 20px 0; color: #6b7280; line-height: 1.5;">
                    授权后，处理完成的视频可以直接替换原文件，无需手动删除。
                </p>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="skipPermission" style="
                        padding: 10px 20px;
                        border: 1px solid #d1d5db;
                        background: white;
                        color: #6b7280;
                        border-radius: 6px;
                        cursor: pointer;
                    ">跳过（使用下载模式）</button>
                    <button id="grantPermission" style="
                        padding: 10px 20px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                    ">授权文件权限</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 绑定事件
        document.getElementById('skipPermission').onclick = () => {
            document.body.removeChild(dialog);
        };
        
        document.getElementById('grantPermission').onclick = async () => {
            document.body.removeChild(dialog);
            await this.checkFileSystemPermission();
        };
    }

    // 方式1: 真正覆盖原文件（Chrome/Edge）
    async overwriteOriginalFile() {
        if (!this.processedVideo) {
            this.showError('没有处理后的视频文件');
            return;
        }
        
        // 检查浏览器支持
        if (!window.showOpenFilePicker || !window.showSaveFilePicker) {
            console.warn('⚠️ 当前浏览器不支持 File System Access API，降级为下载模式');
            this.downloadNewFile();
            return;
        }
        
        try {
            // 如果已经有权限，直接使用
            if (this.permissionGranted && this.selectedFileHandle) {
                this.showProcessingStatus('正在覆盖文件...', 60);
                
                // 创建可写流并覆盖文件
                const writable = await this.selectedFileHandle.createWritable();
                await writable.write(this.processedVideo);
                await writable.close();
            } else {
                // 如果没有权限，先进行权限检查
                this.showProcessingStatus('请选择要覆盖的原文件...', 20);
                
                // 让用户选择原文件
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Video files',
                        accept: {
                            'video/*': ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.flv']
                        }
                    }],
                    excludeAcceptAllOption: false,
                    multiple: false
                });
                
                this.showProcessingStatus('正在检查文件权限...', 40);
                
                // 检查写权限
                const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
                if (permission !== 'granted') {
                    throw new Error('没有文件写入权限，请重新选择文件并授权');
                }
                
                // 保存文件句柄供下次使用
                this.selectedFileHandle = fileHandle;
                this.permissionGranted = true;
                
                this.showProcessingStatus('正在覆盖文件...', 60);
                
                // 创建可写流并覆盖文件
                const writable = await fileHandle.createWritable();
                await writable.write(this.processedVideo);
                await writable.close();
            }
            
            this.showProcessingStatus('文件覆盖成功！', 100);
            console.log('✅ 原文件已成功覆盖');
            
            // 更新预览
            this.updatePreviewWithNewVideo();
            
            // 显示成功消息
            setTimeout(() => {
                alert('✅ 文件覆盖成功！\n\n原文件已被处理后的视频完全替换。');
            }, 500);
            
        } catch (error) {
            console.error('❌ 文件覆盖失败:', error);
            
            if (error.name === 'AbortError') {
                this.showProcessingStatus('用户取消了操作', 0);
                console.log('👤 用户取消了文件选择');
            } else {
                this.showError(`文件覆盖失败: ${error.message}`);
                console.log('⚠️ 降级为下载模式');
                // 降级为下载模式
                this.downloadNewFile();
            }
        }
    }

    // 方式2: 下载新文件（推荐）
    downloadNewFile() {
        const originalFileName = this.getOriginalFileName();
        const newFileName = this.generateReplacementFileName(originalFileName);
        
        // 下载新文件
        this.downloadReplacementFile(newFileName);
        
        // 更新预览
        this.updatePreviewWithNewVideo();
        
        this.showProcessingStatus(`新文件已下载: ${newFileName}`, 100);
        console.log(`📥 新文件已下载: ${newFileName}`);
    }

    // 方式2: 覆盖原文件名下载
    downloadWithOriginalName() {
        const originalFileName = this.getOriginalFileName();
        const selectedFormat = this.outputFormatSelect.value;
        
        // 生成覆盖文件名
        const lastDotIndex = originalFileName.lastIndexOf('.');
        const baseName = lastDotIndex > 0 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
        const overrideFileName = `${baseName}.${selectedFormat}`;
        
        // 下载覆盖文件
        this.downloadReplacementFile(overrideFileName);
        
        // 更新预览
        this.updatePreviewWithNewVideo();
        
        this.showProcessingStatus(`覆盖文件已下载: ${overrideFileName}`, 100);
        console.log(`📥 覆盖文件已下载: ${overrideFileName}`);
        console.log(`⚠️ 请手动删除原文件: ${originalFileName}`);
    }

    // 方式3: 仅预览替换（不下载）
    previewReplacement() {
        // 更新预览
        this.updatePreviewWithNewVideo();
        
        this.showProcessingStatus('预览已替换，请手动下载文件', 100);
        console.log(`👁️ 预览已替换，请手动下载文件`);
    }

    // 更新预览窗口
    updatePreviewWithNewVideo() {
        try {
            // 保存原始文件信息
            const originalDuration = this.videoDuration;
            const originalStartTime = this.startTime;
            const originalEndTime = this.endTime;
            
            // 更新预览窗口
            const newVideoUrl = URL.createObjectURL(this.processedVideo);
            this.currentVideo = this.processedVideo;
            this.previewVideo.src = newVideoUrl;
            
            // 重新加载视频以获取新的时长
            this.previewVideo.onloadedmetadata = () => {
                // 更新视频时长
                this.videoDuration = this.previewVideo.duration;
                
                // 重置时间轴为整个视频
                this.startTime = 0;
                this.endTime = this.videoDuration;
                
                // 更新UI - 包括滑块时间
                this.updateHandlePosition('start');
                this.updateHandlePosition('end');
                this.updateTimelineRange();
                this.updateTimeDisplays();
                this.updateFixedEndTime();
                
                // 禁用替换按钮，因为现在没有处理后的文件了
                this.replaceSourceBtn.disabled = true;
                this.downloadBtn.disabled = true;
                
                console.log(`🔄 预览已更新:`);
                console.log(`   原时长: ${this.formatTime(originalDuration)}`);
                console.log(`   新时长: ${this.formatTime(this.videoDuration)}`);
                console.log(`   裁剪范围: ${this.formatTime(originalStartTime)} - ${this.formatTime(originalEndTime)}`);
                
                // 清理处理后的视频引用
                this.processedVideo = null;
            };
            
            // 如果视频已经加载完成
            if (this.previewVideo.readyState >= 1) {
                this.previewVideo.onloadedmetadata();
            }
            
        } catch (error) {
            console.error('❌ 更新预览失败:', error);
            this.showError('更新预览失败: ' + error.message);
        }
    }

    // 获取原始文件名
    getOriginalFileName() {
        if (this.videoFileInput && this.videoFileInput.files && this.videoFileInput.files[0]) {
            return this.videoFileInput.files[0].name;
        }
        return 'video';
    }

    // 生成替换文件名
    generateReplacementFileName(originalFileName) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const selectedFormat = this.outputFormatSelect.value;
        
        // 获取文件扩展名
        const lastDotIndex = originalFileName.lastIndexOf('.');
        const baseName = lastDotIndex > 0 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
        
        // 生成新文件名
        return `${baseName}_processed_${timestamp}.${selectedFormat}`;
    }

    // 下载替换文件
    downloadReplacementFile(fileName) {
        const url = URL.createObjectURL(this.processedVideo);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`📥 替换文件已下载: ${fileName}`);
    }

    // 重置编辑器
    resetEditor() {
        if (confirm('确定要重置编辑器吗？这将清除所有数据。')) {
            this.currentVideo = null;
            this.videoDuration = 0;
            this.startTime = 0;
            this.endTime = 0;
            this.processedVideo = null;
            
            this.previewVideo.src = '';
            this.previewVideo.style.display = 'none';
            this.noVideoPlaceholder.style.display = 'block';
            this.hidePreview();
            
            this.processVideoBtn.disabled = true;
            this.downloadBtn.disabled = true;
            this.replaceSourceBtn.disabled = true;
            this.hideProcessingStatus();
            this.hideFileSizeInfo();
            
            this.videoFileInput.value = '';
            
            // 重置时间轴
            this.timelineRange.style.left = '0%';
            this.timelineRange.style.width = '100%';
            
            console.log('🔄 编辑器已重置');
        }
    }

    // 显示处理状态
    showProcessingStatus(message, progress) {
        this.processingStatus.style.display = 'block';
        this.processingStatus.querySelector('.status-text').textContent = message;
        this.updateProgress(progress);
    }

    // 隐藏处理状态
    hideProcessingStatus() {
        setTimeout(() => {
            this.processingStatus.style.display = 'none';
        }, 2000);
    }

    // 更新进度条
    updateProgress(progress) {
        this.progressFill.style.width = `${progress}%`;
    }

    // 更新下载按钮显示文件大小
    updateDownloadButton() {
        if (this.processedVideo) {
            const formatFileSize = (bytes) => {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            };
            
            const fileSize = formatFileSize(this.processedVideo.size);
            this.downloadBtn.innerHTML = `📥 下载视频 (${fileSize})`;
        }
    }

    // 显示文件大小信息
    showFileSizeInfo() {
        if (!this.processedVideo) return;
        
        const processedSize = this.processedVideo.size;
        const originalSize = this.currentVideo ? this.currentVideo.size : 0;
        
        // 格式化文件大小
        const formatFileSize = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        
        // 计算压缩率
        const compressionRatio = originalSize > 0 ? 
            ((1 - processedSize / originalSize) * 100).toFixed(1) : 0;
        
        // 显示文件信息
        this.processedFileSize.textContent = formatFileSize(processedSize);
        this.compressionRatio.textContent = compressionRatio + '%';
        
        // 显示文件信息面板
        this.processedFileInfo.style.display = 'block';
        
        console.log(`📊 文件大小信息:`);
        console.log(`   原始大小: ${formatFileSize(originalSize)}`);
        console.log(`   处理后大小: ${formatFileSize(processedSize)}`);
        console.log(`   压缩率: ${compressionRatio}%`);
    }

    // 隐藏文件大小信息
    hideFileSizeInfo() {
        this.processedFileInfo.style.display = 'none';
        // 重置文件大小和压缩率显示
        this.processedFileSize.textContent = '-';
        this.compressionRatio.textContent = '-';
    }

    // 预估处理时间
    estimateProcessingTime() {
        if (!this.videoDuration || !this.currentVideo) {
            return '未知';
        }
        
        const cropDuration = this.endTime - this.startTime;
        const fileSizeMB = this.currentVideo.size / (1024 * 1024);
        const quality = this.qualityLevelSelect.value;
        const format = this.outputFormatSelect.value;
        
        // 基础处理速度 (MB/分钟)
        const baseSpeed = {
            original: 15,  // CRF 15, slow - 保持原始质量，处理较慢
            high: 20,      // CRF 18, fast
            medium: 40,    // CRF 23, faster  
            low: 80        // CRF 28, veryfast
        };
        
        // 格式调整系数
        const formatMultiplier = {
            mp4: 1.0,
            webm: 0.8,  // VP9编码较慢
            avi: 1.2,   // 兼容性编码
            mov: 1.1    // QuickTime格式
        };
        
        // 计算预估时间
        const speed = baseSpeed[quality] || baseSpeed.high; // 如果质量选项不存在，使用高质量作为默认值
        const multiplier = formatMultiplier[format] || 1.0; // 如果格式不存在，使用默认值
        
        const baseTime = (fileSizeMB / speed) * (cropDuration / this.videoDuration);
        const adjustedTime = baseTime * multiplier;
        
        // 检查计算结果是否有效
        if (isNaN(adjustedTime) || adjustedTime <= 0) {
            return '计算中...';
        }
        
        // 转换为可读格式
        if (adjustedTime < 1) {
            return `${Math.round(adjustedTime * 60)}秒`;
        } else if (adjustedTime < 60) {
            return `${Math.round(adjustedTime)}分钟`;
        } else {
            const hours = Math.floor(adjustedTime / 60);
            const minutes = Math.round(adjustedTime % 60);
            return `${hours}小时${minutes}分钟`;
        }
    }

    // 显示错误信息
    showError(message) {
        alert('错误: ' + message);
    }

    // 显示/隐藏对比界面
    toggleComparison() {
        if (this.comparisonContainer) {
            const isVisible = this.comparisonContainer.style.display !== 'none';
            this.comparisonContainer.style.display = isVisible ? 'none' : 'block';
            
            if (this.showComparisonBtn) {
                this.showComparisonBtn.style.display = isVisible ? 'block' : 'none';
            }
            if (this.hideComparisonBtn) {
                this.hideComparisonBtn.style.display = isVisible ? 'none' : 'block';
            }
        }
    }

    // 自动显示对比结果
    async autoShowComparison() {
        if (!this.currentVideo || !this.processedVideo) {
            console.log('⚠️ 无法自动显示对比：缺少视频文件');
            return;
        }

        // 如果对比助手未初始化，尝试重新初始化
        if (!this.comparisonHelper) {
            console.log('⚠️ 对比功能未初始化，尝试重新初始化...');
            try {
                await this.initializeVideoComparison();
                // 检查初始化是否成功
                if (!this.comparisonHelper) {
                    console.error('❌ 初始化后 comparisonHelper 仍为 null');
                    return;
                }
            } catch (error) {
                console.error('❌ 重新初始化对比功能失败:', error);
                return;
            }
        }

        try {
            console.log('🔍 自动显示视频对比结果...');
            
            // 延迟一下，让用户看到处理完成的状态
            setTimeout(async () => {
                await this.comparisonHelper.quickCompare(
                    this.currentVideo, 
                    this.processedVideo,
                    {
                        mode: 'detailed', // 自动对比也使用详细模式
                        title: '🎬 裁剪前后对比结果',
                        onClose: () => {
                            console.log('✅ 对比结果已关闭');
                        }
                    }
                );
            }, 1000); // 延迟1秒显示
            
        } catch (error) {
            console.error('❌ 自动对比失败:', error);
            // 不显示错误弹窗，避免打扰用户
        }
    }

    // 对比原视频和处理后的视频
    async compareOriginalAndProcessed() {
        if (!this.currentVideo || !this.processedVideo) {
            alert('请先上传视频并完成处理');
            return;
        }

        // 显示加载状态
        this.compareBtn.disabled = true;
        this.compareBtn.textContent = '🔄 初始化中...';

        try {
            // 如果对比助手未初始化，尝试重新初始化
            if (!this.comparisonHelper) {
                console.log('⚠️ 对比功能未初始化，尝试重新初始化...');
                this.compareBtn.textContent = '🔄 初始化对比功能...';
                
                // 直接重新初始化
                await this.initializeVideoComparison();
                
                // 检查初始化是否成功
                if (!this.comparisonHelper) {
                    console.error('❌ 初始化失败，尝试直接创建助手实例...');
                    console.log('window.VideoComparisonHelper:', typeof window.VideoComparisonHelper);
                    
                    if (typeof window.VideoComparisonHelper === 'undefined') {
                        throw new Error('VideoComparisonHelper 类未加载，请刷新页面重试');
                    }
                    
                    // 尝试直接创建助手实例
                    try {
                        this.comparisonHelper = new window.VideoComparisonHelper();
                        await this.comparisonHelper.initialize();
                        console.log('✅ 直接创建助手实例成功');
                    } catch (createError) {
                        console.error('❌ 直接创建助手实例失败:', createError);
                        throw new Error('无法创建视频对比助手实例: ' + createError.message);
                    }
                }
            }

            console.log('🔍 开始对比原视频和处理后的视频...');
            this.compareBtn.textContent = '🔄 分析中...';
            
            // 使用封装的对比助手（默认使用详细对比模式）
            await this.comparisonHelper.quickCompare(
                this.currentVideo, 
                this.processedVideo,
                {
                    mode: 'detailed', // 默认使用详细对比
                    title: '🎬 裁剪前后对比结果',
                    onClose: () => {
                        console.log('✅ 对比结果已关闭');
                    }
                }
            );
            
        } catch (error) {
            console.error('❌ 视频对比失败:', error);
            
            // 根据错误类型显示不同的错误信息
            let errorMessage = '视频对比失败';
            if (error.message.includes('FFmpeg')) {
                errorMessage = 'FFmpeg库加载失败，请刷新页面重试';
            } else if (error.message.includes('网络') || error.message.includes('fetch')) {
                errorMessage = '网络连接失败，请检查网络后重试';
            } else if (error.message.includes('WebAssembly')) {
                errorMessage = '浏览器不支持WebAssembly，请使用Chrome、Firefox或Edge浏览器';
            } else {
                errorMessage = `视频对比失败: ${error.message}`;
            }
            
            alert(errorMessage);
        } finally {
            // 恢复按钮状态
            this.compareBtn.disabled = false;
            this.compareBtn.textContent = '📊 对比分析';
        }
    }

}

// 全局变量导出
if (typeof window !== 'undefined') {
    window.VideoEditor = VideoEditor;
}