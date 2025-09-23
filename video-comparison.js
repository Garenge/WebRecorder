/**
 * 视频文件对比分析器
 * 功能：对比两个视频文件的参数，分析清晰度、质量等指标
 */
class VideoComparison {
    constructor() {
        this.ffmpeg = null;
        this.isInitialized = false;
    }

    /**
     * 初始化FFmpeg
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // 等待全局FFmpeg库加载完成
            await this.waitForGlobalFFmpeg();
            
            // 使用全局FFmpeg实例，避免版本冲突 - 使用FFmpegWASM对象
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
            
            // 检查是否通过file://协议访问，如果是则抛出错误
            if (window.location.protocol === 'file:') {
                throw new Error('file://协议访问下FFmpeg.wasm无法正常工作，请通过HTTP服务器访问');
            }
            
            // 设置FFmpeg的baseURL，使用测试确认可用的CDN源
            const cdnSources = [
                'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
                'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'
            ];
            
            this.ffmpeg.on('log', ({ message }) => {
                console.log('FFmpeg:', message);
            });
            
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
                    this.ffmpeg.on('log', ({ message }) => {
                        console.log('FFmpeg:', message);
                    });
                }
            }
            
            if (!loadSuccess) {
                throw new Error(`所有CDN源都无法访问FFmpeg核心文件。最后错误: ${lastError?.message}`);
            }
            
            this.isInitialized = true;
            console.log('✅ 视频对比分析器初始化成功');
        } catch (error) {
            console.error('❌ 视频对比分析器初始化失败:', error);
            throw error;
        }
    }

    // 等待全局FFmpeg库加载
    async waitForGlobalFFmpeg() {
        let attempts = 0;
        const maxAttempts = 50; // 等待5秒
        
        while (attempts < maxAttempts) {
            // 检查FFmpegWASM对象是否加载完成
            if (typeof window.FFmpegWASM !== 'undefined') {
                const ffmpegWASM = window.FFmpegWASM;
                
                // 检查是否包含FFmpeg类
                if (ffmpegWASM.FFmpeg) {
                    return;
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('全局FFmpeg库加载超时');
    }

    /**
     * 获取视频文件的详细信息
     * @param {File|string} videoFile - 视频文件或文件路径
     * @returns {Promise<Object>} 视频信息对象
     */
    async getVideoInfo(videoFile) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            let inputData;
            let fileName;

            if (videoFile instanceof File) {
                inputData = await videoFile.arrayBuffer();
                fileName = videoFile.name;
            } else {
                // 假设是文件路径
                const response = await fetch(videoFile);
                inputData = await response.arrayBuffer();
                fileName = videoFile.split('/').pop();
            }

            // 写入FFmpeg虚拟文件系统
            await this.ffmpeg.writeFile('input.mp4', new Uint8Array(inputData));

            // 使用ffprobe获取视频信息
            const command = [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                'input.mp4'
            ];

            await this.ffmpeg.exec(['-f', 'ffprobe', ...command]);
            
            // 获取输出结果
            const output = await this.ffmpeg.readFile('input.mp4');
            
            // 清理文件
            await this.ffmpeg.deleteFile('input.mp4');

            // 解析视频信息
            const videoInfo = this.parseVideoInfo(output);
            videoInfo.fileName = fileName;
            videoInfo.fileSize = inputData.byteLength;

            return videoInfo;
        } catch (error) {
            console.error('❌ 获取视频信息失败:', error);
            throw error;
        }
    }

    /**
     * 解析视频信息
     * @param {Uint8Array} ffprobeOutput - FFprobe输出
     * @returns {Object} 解析后的视频信息
     */
    parseVideoInfo(ffprobeOutput) {
        try {
            // 这里需要根据实际的ffprobe输出格式来解析
            // 由于FFmpeg.wasm的限制，我们使用另一种方法
            return this.getBasicVideoInfo();
        } catch (error) {
            console.error('解析视频信息失败:', error);
            return this.getBasicVideoInfo();
        }
    }

    /**
     * 获取基本视频信息（备用方法）
     * @returns {Object} 基本视频信息
     */
    getBasicVideoInfo() {
        return {
            duration: 0,
            bitrate: 0,
            width: 0,
            height: 0,
            frameRate: 0,
            codec: 'unknown',
            format: 'unknown',
            audioCodec: 'unknown',
            audioBitrate: 0,
            audioChannels: 0,
            audioSampleRate: 0
        };
    }

    /**
     * 使用HTML5 Video API获取视频信息（更可靠的方法）
     * @param {File} videoFile - 视频文件
     * @returns {Promise<Object>} 视频信息
     */
    async getVideoInfoWithHTML5(videoFile) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const url = URL.createObjectURL(videoFile);
            
            video.addEventListener('loadedmetadata', () => {
                // 确保 duration 是有效数值
                const duration = video.duration && !isNaN(video.duration) && isFinite(video.duration) ? video.duration : 0;
                
                // 确保 fileSize 是有效数值
                const fileSize = videoFile.size && !isNaN(videoFile.size) && isFinite(videoFile.size) ? videoFile.size : 0;
                
                // 计算码率 - 添加更多验证
                let estimatedBitrate = 0;
                if (duration > 0 && fileSize > 0) {
                    estimatedBitrate = Math.round((fileSize * 8) / duration);
                    // 确保计算结果有效
                    if (isNaN(estimatedBitrate) || !isFinite(estimatedBitrate)) {
                        estimatedBitrate = 0;
                    }
                }
                
                const info = {
                    fileName: videoFile.name,
                    fileSize: fileSize,
                    duration: duration,
                    width: video.videoWidth,
                    height: video.videoHeight,
                    aspectRatio: video.videoWidth / video.videoHeight,
                    // 估算码率
                    estimatedBitrate: estimatedBitrate,
                    // 文件格式
                    format: videoFile.type || 'unknown',
                    // 质量等级估算
                    qualityLevel: this.estimateQualityLevel(video.videoWidth, video.videoHeight),
                    // 文件大小等级
                    sizeLevel: this.getFileSizeLevel(fileSize),
                    // 视频对象引用（用于质量分析）
                    videoElement: video,
                    videoUrl: url
                };
                
                console.log('📹 视频信息获取:', {
                    fileName: info.fileName,
                    fileSize: info.fileSize,
                    duration: info.duration,
                    estimatedBitrate: info.estimatedBitrate,
                    width: info.width,
                    height: info.height,
                    calculation: `(${fileSize} * 8) / ${duration} = ${estimatedBitrate}`
                });
                
                resolve(info);
            });
            
            video.addEventListener('error', (e) => {
                URL.revokeObjectURL(url);
                reject(new Error('无法加载视频文件: ' + e.message));
            });
            
            video.src = url;
        });
    }

    /**
     * 估算质量等级
     * @param {number} width - 视频宽度
     * @param {number} height - 视频高度
     * @returns {string} 质量等级
     */
    estimateQualityLevel(width, height) {
        const pixels = width * height;
        
        if (pixels >= 3840 * 2160) return '4K (超高清)';
        if (pixels >= 1920 * 1080) return '1080p (全高清)';
        if (pixels >= 1280 * 720) return '720p (高清)';
        if (pixels >= 854 * 480) return '480p (标清)';
        if (pixels >= 640 * 360) return '360p (低清)';
        return '240p (极低清)';
    }

    /**
     * 获取文件大小等级
     * @param {number} sizeInBytes - 文件大小（字节）
     * @returns {string} 大小等级
     */
    getFileSizeLevel(sizeInBytes) {
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        if (sizeInMB >= 1000) return '超大 (>1GB)';
        if (sizeInMB >= 500) return '很大 (500MB-1GB)';
        if (sizeInMB >= 100) return '大 (100-500MB)';
        if (sizeInMB >= 50) return '中等 (50-100MB)';
        if (sizeInMB >= 10) return '小 (10-50MB)';
        return '很小 (<10MB)';
    }

    /**
     * 对比两个视频文件
     * @param {File} originalFile - 原文件
     * @param {File} newFile - 新文件
     * @param {Object} options - 对比选项
     * @param {string} options.mode - 对比模式: 'basic' | 'detailed'
     * @returns {Promise<Object>} 对比结果
     */
    async compareVideos(originalFile, newFile, options = {}) {
        const { mode = 'detailed' } = options;
        
        try {
            console.log(`🔍 开始${mode === 'basic' ? '普通' : '详细'}对比视频文件...`);
            
            // 获取两个视频的信息
            const [originalInfo, newInfo] = await Promise.all([
                this.getVideoInfoWithHTML5(originalFile),
                this.getVideoInfoWithHTML5(newFile)
            ]);

            let comparison;
            
            if (mode === 'basic') {
                // 普通对比模式
                comparison = await this.performBasicComparison(originalInfo, newInfo);
            } else {
                // 详细对比模式
                comparison = await this.performDetailedComparison(originalInfo, newInfo);
            }

            // 清理视频对象引用
            URL.revokeObjectURL(originalInfo.videoUrl);
            URL.revokeObjectURL(newInfo.videoUrl);

            console.log(`✅ ${mode === 'basic' ? '普通' : '详细'}视频对比完成`);
            return comparison;
        } catch (error) {
            console.error('❌ 视频对比失败:', error);
            throw error;
        }
    }

    /**
     * 执行普通对比（基础参数对比）
     * @param {Object} originalInfo - 原视频信息
     * @param {Object} newInfo - 新视频信息
     * @returns {Promise<Object>} 普通对比结果
     */
    async performBasicComparison(originalInfo, newInfo) {
        console.log('📊 执行普通对比分析...');
        
        // 计算基础差异
        const basicDifferences = this.calculateBasicDifferences(originalInfo, newInfo);
        
        // 生成基础摘要
        const basicSummary = this.generateBasicSummary(originalInfo, newInfo, basicDifferences);
        
        return {
            mode: 'basic',
            original: originalInfo,
            new: newInfo,
            differences: basicDifferences,
            summary: basicSummary,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 执行详细对比（完整分析）
     * @param {Object} originalInfo - 原视频信息
     * @param {Object} newInfo - 新视频信息
     * @returns {Promise<Object>} 详细对比结果
     */
    async performDetailedComparison(originalInfo, newInfo) {
        console.log('🔬 执行详细对比分析...');
        
        // 进行高级质量分析
        const qualityAnalysis = await this.performQualityAnalysis(originalInfo, newInfo);
        
        // 计算完整差异
        const differences = this.calculateDifferences(originalInfo, newInfo);
        
        // 生成详细摘要
        const summary = this.generateSummary(originalInfo, newInfo, qualityAnalysis);
        
        return {
            mode: 'detailed',
            original: originalInfo,
            new: newInfo,
            differences: differences,
            qualityAnalysis: qualityAnalysis,
            summary: summary,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 执行高级质量分析
     * @param {Object} originalInfo - 原视频信息
     * @param {Object} newInfo - 新视频信息
     * @returns {Promise<Object>} 质量分析结果
     */
    async performQualityAnalysis(originalInfo, newInfo) {
        try {
            console.log('🔬 开始质量分析...');
            
            const analysis = {
                // 基础质量指标
                basicMetrics: this.calculateBasicQualityMetrics(originalInfo, newInfo),
                // 压缩效率分析
                compressionEfficiency: this.analyzeCompressionEfficiency(originalInfo, newInfo),
                // 质量损失评估
                qualityLoss: this.assessQualityLoss(originalInfo, newInfo),
                // 视觉质量评分
                visualQualityScore: this.calculateVisualQualityScore(originalInfo, newInfo)
            };

            console.log('✅ 质量分析完成');
            return analysis;
        } catch (error) {
            console.error('❌ 质量分析失败:', error);
            return this.getDefaultQualityAnalysis();
        }
    }

    /**
     * 计算基础质量指标
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {Object} 基础质量指标
     */
    calculateBasicQualityMetrics(original, newVideo) {
        // 像素密度对比
        const originalPixels = original.width * original.height;
        const newPixels = newVideo.width * newVideo.height;
        const pixelRatio = newPixels / originalPixels;

        // 码率效率对比
        const originalBitratePerPixel = original.estimatedBitrate / originalPixels;
        const newBitratePerPixel = newVideo.estimatedBitrate / newPixels;
        const bitrateEfficiency = newBitratePerPixel / originalBitratePerPixel;

        // 文件大小效率对比
        const originalSizePerPixel = original.fileSize / originalPixels;
        const newSizePerPixel = newVideo.fileSize / newPixels;
        const sizeEfficiency = newSizePerPixel / originalSizePerPixel;

        return {
            pixelDensity: {
                original: originalPixels,
                new: newPixels,
                ratio: pixelRatio,
                change: pixelRatio > 1 ? '增加' : pixelRatio < 1 ? '减少' : '不变'
            },
            bitrateEfficiency: {
                original: originalBitratePerPixel,
                new: newBitratePerPixel,
                ratio: bitrateEfficiency,
                efficiency: bitrateEfficiency > 1 ? '降低' : '提高'
            },
            sizeEfficiency: {
                original: originalSizePerPixel,
                new: newSizePerPixel,
                ratio: sizeEfficiency,
                efficiency: sizeEfficiency > 1 ? '降低' : '提高'
            }
        };
    }

    /**
     * 分析压缩效率
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {Object} 压缩效率分析
     */
    analyzeCompressionEfficiency(original, newVideo) {
        // 压缩比计算
        const originalCompressionRatio = original.fileSize / (original.width * original.height * original.duration * 0.1); // 估算
        const newCompressionRatio = newVideo.fileSize / (newVideo.width * newVideo.height * newVideo.duration * 0.1);
        
        // 质量保持度
        const qualityRetention = this.calculateQualityRetention(original, newVideo);
        
        // 压缩效率评分
        const compressionScore = this.calculateCompressionScore(original, newVideo);

        return {
            compressionRatio: {
                original: originalCompressionRatio,
                new: newCompressionRatio,
                improvement: newCompressionRatio < originalCompressionRatio ? '提升' : '下降'
            },
            qualityRetention: qualityRetention,
            compressionScore: compressionScore,
            recommendation: this.getCompressionRecommendation(compressionScore, qualityRetention)
        };
    }

    /**
     * 计算质量保持度
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {number} 质量保持度百分比
     */
    calculateQualityRetention(original, newVideo) {
        // 基于分辨率、码率等因素计算质量保持度
        const resolutionFactor = Math.min(newVideo.width * newVideo.height / (original.width * original.height), 1);
        const bitrateFactor = Math.min(newVideo.estimatedBitrate / original.estimatedBitrate, 1);
        
        // 综合评分
        const retention = (resolutionFactor * 0.6 + bitrateFactor * 0.4) * 100;
        return Math.round(retention);
    }

    /**
     * 计算压缩评分
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {number} 压缩评分 (0-100)
     */
    calculateCompressionScore(original, newVideo) {
        const sizeReduction = (original.fileSize - newVideo.fileSize) / original.fileSize;
        const qualityRetention = this.calculateQualityRetention(original, newVideo) / 100;
        
        // 平衡文件大小减少和质量保持
        const score = (sizeReduction * 0.4 + qualityRetention * 0.6) * 100;
        return Math.round(Math.max(0, Math.min(100, score)));
    }

    /**
     * 评估质量损失
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {Object} 质量损失评估
     */
    assessQualityLoss(original, newVideo) {
        const resolutionLoss = this.calculateResolutionLoss(original, newVideo);
        const bitrateLoss = this.calculateBitrateLoss(original, newVideo);
        const overallLoss = (resolutionLoss + bitrateLoss) / 2;

        return {
            resolutionLoss: resolutionLoss,
            bitrateLoss: bitrateLoss,
            overallLoss: overallLoss,
            severity: this.getLossSeverity(overallLoss)
        };
    }

    /**
     * 计算分辨率损失
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {number} 分辨率损失百分比
     */
    calculateResolutionLoss(original, newVideo) {
        const originalPixels = original.width * original.height;
        const newPixels = newVideo.width * newVideo.height;
        const loss = Math.max(0, (originalPixels - newPixels) / originalPixels * 100);
        return Math.round(loss);
    }

    /**
     * 计算码率损失
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {number} 码率损失百分比
     */
    calculateBitrateLoss(original, newVideo) {
        const loss = Math.max(0, (original.estimatedBitrate - newVideo.estimatedBitrate) / original.estimatedBitrate * 100);
        return Math.round(loss);
    }

    /**
     * 获取损失严重程度
     * @param {number} loss - 损失百分比
     * @returns {string} 严重程度描述
     */
    getLossSeverity(loss) {
        if (loss < 5) return '轻微';
        if (loss < 15) return '中等';
        if (loss < 30) return '明显';
        return '严重';
    }

    /**
     * 计算视觉质量评分
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {Object} 视觉质量评分
     */
    calculateVisualQualityScore(original, newVideo) {
        // 基于多个因素计算综合质量评分
        const resolutionScore = this.getResolutionScore(newVideo.width, newVideo.height);
        const bitrateScore = this.getBitrateScore(newVideo.estimatedBitrate, newVideo.width * newVideo.height);
        const compressionScore = this.calculateCompressionScore(original, newVideo);
        
        const overallScore = (resolutionScore * 0.4 + bitrateScore * 0.4 + compressionScore * 0.2);
        
        return {
            resolutionScore: resolutionScore,
            bitrateScore: bitrateScore,
            compressionScore: compressionScore,
            overallScore: Math.round(overallScore),
            grade: this.getQualityGrade(overallScore)
        };
    }

    /**
     * 获取分辨率评分
     * @param {number} width - 视频宽度
     * @param {number} height - 视频高度
     * @returns {number} 分辨率评分 (0-100)
     */
    getResolutionScore(width, height) {
        const pixels = width * height;
        if (pixels >= 3840 * 2160) return 100; // 4K
        if (pixels >= 1920 * 1080) return 90;  // 1080p
        if (pixels >= 1280 * 720) return 75;   // 720p
        if (pixels >= 854 * 480) return 60;    // 480p
        if (pixels >= 640 * 360) return 40;    // 360p
        return 20; // 240p
    }

    /**
     * 获取码率评分
     * @param {number} bitrate - 码率
     * @param {number} pixels - 像素数
     * @returns {number} 码率评分 (0-100)
     */
    getBitrateScore(bitrate, pixels) {
        const bitratePerPixel = bitrate / pixels;
        if (bitratePerPixel > 0.01) return 100;
        if (bitratePerPixel > 0.005) return 80;
        if (bitratePerPixel > 0.002) return 60;
        if (bitratePerPixel > 0.001) return 40;
        return 20;
    }

    /**
     * 获取质量等级
     * @param {number} score - 质量评分
     * @returns {string} 质量等级
     */
    getQualityGrade(score) {
        if (score >= 90) return '优秀';
        if (score >= 80) return '良好';
        if (score >= 70) return '中等';
        if (score >= 60) return '一般';
        return '较差';
    }

    /**
     * 获取压缩建议
     * @param {number} compressionScore - 压缩评分
     * @param {number} qualityRetention - 质量保持度
     * @returns {string} 建议
     */
    getCompressionRecommendation(compressionScore, qualityRetention) {
        if (compressionScore >= 80 && qualityRetention >= 80) {
            return '压缩效果优秀，质量保持良好';
        } else if (compressionScore >= 60 && qualityRetention >= 60) {
            return '压缩效果良好，质量基本保持';
        } else if (qualityRetention < 50) {
            return '质量损失较大，建议调整压缩参数';
        } else {
            return '压缩效果一般，可考虑优化设置';
        }
    }

    /**
     * 获取默认质量分析结果
     * @returns {Object} 默认分析结果
     */
    getDefaultQualityAnalysis() {
        return {
            basicMetrics: {
                pixelDensity: { change: '未知' },
                bitrateEfficiency: { efficiency: '未知' },
                sizeEfficiency: { efficiency: '未知' }
            },
            compressionEfficiency: {
                recommendation: '无法分析'
            },
            qualityLoss: {
                severity: '未知'
            },
            visualQualityScore: {
                grade: '未知'
            }
        };
    }

    /**
     * 计算基础差异（普通对比模式）
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {Object} 基础差异信息
     */
    calculateBasicDifferences(original, newVideo) {
        return {
            // 文件大小变化
            fileSizeChange: {
                original: this.formatFileSize(original.fileSize),
                new: this.formatFileSize(newVideo.fileSize),
                absolute: newVideo.fileSize - original.fileSize,
                percentage: ((newVideo.fileSize - original.fileSize) / original.fileSize * 100).toFixed(2),
                trend: newVideo.fileSize > original.fileSize ? '增加' : '减少'
            },
            
            // 分辨率变化
            resolutionChange: {
                original: `${original.width}x${original.height}`,
                new: `${newVideo.width}x${newVideo.height}`,
                changed: original.width !== newVideo.width || original.height !== newVideo.height,
                trend: this.getResolutionTrend(original, newVideo)
            },
            
            // 质量等级变化
            qualityChange: {
                original: original.qualityLevel,
                new: newVideo.qualityLevel,
                changed: original.qualityLevel !== newVideo.qualityLevel,
                trend: this.getQualityTrend(original, newVideo)
            },
            
            // 时长变化
            durationChange: {
                original: this.formatDuration(original.duration),
                new: this.formatDuration(newVideo.duration),
                absolute: newVideo.duration - original.duration,
                percentage: original.duration > 0 ? ((newVideo.duration - original.duration) / original.duration * 100).toFixed(2) : 0,
                trend: newVideo.duration > original.duration ? '增加' : '减少'
            },
            
            // 估算码率变化
            bitrateChange: {
                original: this.formatBitrate(original.estimatedBitrate),
                new: this.formatBitrate(newVideo.estimatedBitrate),
                absolute: newVideo.estimatedBitrate - original.estimatedBitrate,
                percentage: original.estimatedBitrate > 0 ? ((newVideo.estimatedBitrate - original.estimatedBitrate) / original.estimatedBitrate * 100).toFixed(2) : '无法计算',
                trend: original.estimatedBitrate > 0 ? (newVideo.estimatedBitrate > original.estimatedBitrate ? '提高' : '降低') : '无法比较'
            }
        };
    }

    /**
     * 生成基础摘要（普通对比模式）
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @param {Object} differences - 差异信息
     * @returns {Object} 基础摘要
     */
    generateBasicSummary(original, newVideo, differences) {
        const keyChanges = [];
        const recommendations = [];
        
        // 收集关键变化
        if (differences.resolutionChange.changed) {
            keyChanges.push(`分辨率: ${differences.resolutionChange.original} → ${differences.resolutionChange.new}`);
        }
        
        if (differences.qualityChange.changed) {
            keyChanges.push(`质量等级: ${differences.qualityChange.original} → ${differences.qualityChange.new}`);
        }
        
        if (Math.abs(parseFloat(differences.fileSizeChange.percentage)) > 10) {
            keyChanges.push(`文件大小: ${differences.fileSizeChange.percentage}% (${differences.fileSizeChange.trend})`);
        }
        
        if (Math.abs(parseFloat(differences.bitrateChange.percentage)) > 10) {
            keyChanges.push(`码率: ${differences.bitrateChange.percentage}% (${differences.bitrateChange.trend})`);
        }
        
        if (Math.abs(parseFloat(differences.durationChange.percentage)) > 5) {
            keyChanges.push(`时长: ${differences.durationChange.original} → ${differences.durationChange.new} (${differences.durationChange.percentage}%)`);
        }
        
        // 生成基础建议
        if (differences.qualityChange.trend === '质量降低') {
            recommendations.push('⚠️ 视频质量有所下降，建议检查编码设置');
        }
        
        if (differences.fileSizeChange.trend === '增加' && parseFloat(differences.fileSizeChange.percentage) > 50) {
            recommendations.push('📈 文件大小显著增加，可能需要优化压缩设置');
        }
        
        if (differences.bitrateChange.trend === '降低' && parseFloat(differences.bitrateChange.percentage) < -30) {
            recommendations.push('📉 码率大幅降低，可能影响视频清晰度');
        }
        
        if (differences.resolutionChange.trend === '分辨率提升') {
            recommendations.push('✅ 分辨率提升，视频清晰度应该更好');
        }
        
        if (differences.durationChange.trend === '增加' && parseFloat(differences.durationChange.percentage) > 20) {
            recommendations.push('⏱️ 视频时长显著增加，可能是添加了内容或调整了播放速度');
        } else if (differences.durationChange.trend === '减少' && parseFloat(differences.durationChange.percentage) < -20) {
            recommendations.push('⏱️ 视频时长显著减少，可能是裁剪了内容或提高了播放速度');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('✅ 视频参数变化较小，质量基本保持');
        }
        
        // 计算整体趋势
        const improvements = [];
        const degradations = [];
        
        if (differences.qualityChange.trend === '质量提升') improvements.push('质量');
        else if (differences.qualityChange.trend === '质量降低') degradations.push('质量');
        
        if (differences.resolutionChange.trend === '分辨率提升') improvements.push('分辨率');
        else if (differences.resolutionChange.trend === '分辨率降低') degradations.push('分辨率');
        
        if (differences.bitrateChange.trend === '提高') improvements.push('码率');
        else if (differences.bitrateChange.trend === '降低') degradations.push('码率');
        
        // 时长变化通常不影响质量，但可以作为参考信息
        // 这里不将时长变化计入整体质量趋势
        
        let overallTrend = '质量基本保持';
        if (improvements.length > degradations.length) overallTrend = '整体质量提升';
        else if (degradations.length > improvements.length) overallTrend = '整体质量下降';
        
        return {
            overallTrend: overallTrend,
            keyChanges: keyChanges,
            recommendations: recommendations
        };
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小
     */
    formatFileSize(bytes) {
        // 处理 undefined、null 或 NaN 的情况
        if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) {
            return '未知';
        }
        
        if (bytes >= 1024 * 1024 * 1024) {
            return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
        } else if (bytes >= 1024 * 1024) {
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        } else if (bytes >= 1024) {
            return (bytes / 1024).toFixed(2) + ' KB';
        }
        return bytes + ' B';
    }

    /**
     * 格式化时长
     * @param {number} seconds - 秒数
     * @returns {string} 格式化后的时长
     */
    formatDuration(seconds) {
        // 处理 undefined、null 或 NaN 的情况
        if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
            return '未知';
        }
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    /**
     * 格式化码率
     * @param {number} bitrate - 码率（bps）
     * @returns {string} 格式化后的码率
     */
    formatBitrate(bitrate) {
        // 处理 undefined、null 或 NaN 的情况
        if (bitrate === undefined || bitrate === null || isNaN(bitrate) || !isFinite(bitrate) || bitrate < 0) {
            return '未知';
        }
        
        // 处理码率为 0 的情况
        if (bitrate === 0) {
            return '无法计算';
        }
        
        if (bitrate >= 1000000) {
            return (bitrate / 1000000).toFixed(2) + ' Mbps';
        } else if (bitrate >= 1000) {
            return (bitrate / 1000).toFixed(2) + ' Kbps';
        }
        return bitrate + ' bps';
    }

    /**
     * 计算两个视频的差异
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {Object} 差异信息
     */
    calculateDifferences(original, newVideo) {
        return {
            // 文件大小变化
            fileSizeChange: {
                original: this.formatFileSize(original.fileSize),
                new: this.formatFileSize(newVideo.fileSize),
                absolute: newVideo.fileSize - original.fileSize,
                percentage: ((newVideo.fileSize - original.fileSize) / original.fileSize * 100).toFixed(2),
                trend: newVideo.fileSize > original.fileSize ? '增加' : '减少'
            },
            
            // 分辨率变化
            resolutionChange: {
                original: `${original.width}x${original.height}`,
                new: `${newVideo.width}x${newVideo.height}`,
                changed: original.width !== newVideo.width || original.height !== newVideo.height,
                trend: this.getResolutionTrend(original, newVideo)
            },
            
            // 质量等级变化
            qualityChange: {
                original: original.qualityLevel,
                new: newVideo.qualityLevel,
                changed: original.qualityLevel !== newVideo.qualityLevel,
                trend: this.getQualityTrend(original, newVideo)
            },
            
            // 时长变化
            durationChange: {
                original: this.formatDuration(original.duration),
                new: this.formatDuration(newVideo.duration),
                absolute: newVideo.duration - original.duration,
                percentage: original.duration > 0 ? ((newVideo.duration - original.duration) / original.duration * 100).toFixed(2) : 0,
                trend: newVideo.duration > original.duration ? '增加' : '减少'
            },
            
            // 估算码率变化
            bitrateChange: {
                original: this.formatBitrate(original.estimatedBitrate),
                new: this.formatBitrate(newVideo.estimatedBitrate),
                absolute: newVideo.estimatedBitrate - original.estimatedBitrate,
                percentage: original.estimatedBitrate > 0 ? ((newVideo.estimatedBitrate - original.estimatedBitrate) / original.estimatedBitrate * 100).toFixed(2) : '无法计算',
                trend: original.estimatedBitrate > 0 ? (newVideo.estimatedBitrate > original.estimatedBitrate ? '提高' : '降低') : '无法比较'
            }
        };
    }

    /**
     * 获取分辨率变化趋势
     * @param {Object} original - 原视频
     * @param {Object} newVideo - 新视频
     * @returns {string} 趋势描述
     */
    getResolutionTrend(original, newVideo) {
        const originalPixels = original.width * original.height;
        const newPixels = newVideo.width * newVideo.height;
        
        if (newPixels > originalPixels) return '分辨率提升';
        if (newPixels < originalPixels) return '分辨率降低';
        return '分辨率不变';
    }

    /**
     * 获取质量变化趋势
     * @param {Object} original - 原视频
     * @param {Object} newVideo - 新视频
     * @returns {string} 趋势描述
     */
    getQualityTrend(original, newVideo) {
        const qualityOrder = ['240p (极低清)', '360p (低清)', '480p (标清)', '720p (高清)', '1080p (全高清)', '4K (超高清)'];
        const originalIndex = qualityOrder.indexOf(original.qualityLevel);
        const newIndex = qualityOrder.indexOf(newVideo.qualityLevel);
        
        if (newIndex > originalIndex) return '质量提升';
        if (newIndex < originalIndex) return '质量降低';
        return '质量不变';
    }

    /**
     * 生成对比摘要
     * @param {Object} original - 原视频信息
     * @param {Object} newVideo - 新视频信息
     * @returns {Object} 摘要信息
     */
    generateSummary(original, newVideo) {
        const differences = this.calculateDifferences(original, newVideo);
        
        return {
            overallTrend: this.getOverallTrend(differences),
            keyChanges: this.getKeyChanges(differences),
            recommendations: this.generateRecommendations(differences)
        };
    }

    /**
     * 获取整体趋势
     * @param {Object} differences - 差异信息
     * @returns {string} 整体趋势
     */
    getOverallTrend(differences) {
        const improvements = [];
        const degradations = [];
        
        if (differences.qualityChange.trend === '质量提升') improvements.push('质量');
        else if (differences.qualityChange.trend === '质量降低') degradations.push('质量');
        
        if (differences.resolutionChange.trend === '分辨率提升') improvements.push('分辨率');
        else if (differences.resolutionChange.trend === '分辨率降低') degradations.push('分辨率');
        
        if (differences.bitrateChange.trend === '提高') improvements.push('码率');
        else if (differences.bitrateChange.trend === '降低') degradations.push('码率');
        
        if (improvements.length > degradations.length) return '整体质量提升';
        if (degradations.length > improvements.length) return '整体质量下降';
        return '质量基本保持';
    }

    /**
     * 获取关键变化
     * @param {Object} differences - 差异信息
     * @returns {Array} 关键变化列表
     */
    getKeyChanges(differences) {
        const changes = [];
        
        if (differences.resolutionChange.changed) {
            changes.push(`分辨率: ${differences.resolutionChange.original} → ${differences.resolutionChange.new}`);
        }
        
        if (differences.qualityChange.changed) {
            changes.push(`质量等级: ${differences.qualityChange.original} → ${differences.qualityChange.new}`);
        }
        
        if (Math.abs(parseFloat(differences.fileSizeChange.percentage)) > 10) {
            changes.push(`文件大小: ${differences.fileSizeChange.percentage}% (${differences.fileSizeChange.trend})`);
        }
        
        if (Math.abs(parseFloat(differences.bitrateChange.percentage)) > 10) {
            changes.push(`码率: ${differences.bitrateChange.percentage}% (${differences.bitrateChange.trend})`);
        }
        
        return changes;
    }

    /**
     * 生成建议
     * @param {Object} differences - 差异信息
     * @returns {Array} 建议列表
     */
    generateRecommendations(differences) {
        const recommendations = [];
        
        if (differences.qualityChange.trend === '质量降低') {
            recommendations.push('⚠️ 视频质量有所下降，建议检查编码设置');
        }
        
        if (differences.fileSizeChange.trend === '增加' && parseFloat(differences.fileSizeChange.percentage) > 50) {
            recommendations.push('📈 文件大小显著增加，可能需要优化压缩设置');
        }
        
        if (differences.bitrateChange.trend === '降低' && parseFloat(differences.bitrateChange.percentage) < -30) {
            recommendations.push('📉 码率大幅降低，可能影响视频清晰度');
        }
        
        if (differences.resolutionChange.trend === '分辨率提升') {
            recommendations.push('✅ 分辨率提升，视频清晰度应该更好');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('✅ 视频参数变化较小，质量基本保持');
        }
        
        return recommendations;
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoComparison;
}

// 全局变量导出
if (typeof window !== 'undefined') {
    window.VideoComparison = VideoComparison;
}