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
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeFFmpeg();
    }

    // 初始化DOM元素
    initializeElements() {
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
        this.resetBtn = document.getElementById('resetBtn');
        this.processingStatus = document.getElementById('processingStatus');
        this.progressFill = document.getElementById('progressFill');
        this.timelineRange = document.getElementById('timelineRange');
        this.previewOverlay = document.getElementById('previewOverlay');
        this.previewText = document.getElementById('previewText');
        this.processedFileInfo = document.getElementById('processedFileInfo');
        this.processedFileSize = document.getElementById('processedFileSize');
        this.compressionRatio = document.getElementById('compressionRatio');
        this.fixedEndTime = document.getElementById('fixedEndTime');
        
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

        this.resetBtn.addEventListener('click', () => {
            this.resetEditor();
        });
    }

    // 初始化FFmpeg
    async initializeFFmpeg() {
        try {
            console.log('🔄 正在加载FFmpeg.wasm...');
            this.showProcessingStatus('正在加载FFmpeg.wasm...', 10);
            
            // 等待FFmpeg库加载完成
            await this.waitForFFmpeg();
            
            // 检查FFmpeg是否可用
            if (typeof window.FFmpeg === 'undefined' || typeof window.FFmpegUtil === 'undefined') {
                throw new Error('FFmpeg库未加载');
            }
            
            const { FFmpeg } = window.FFmpeg;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;
            
            this.ffmpeg = new FFmpeg();
            
            // 设置FFmpeg.wasm的路径
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
            await this.ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            
            console.log('✅ FFmpeg.wasm 加载成功');
            this.hideProcessingStatus();
        } catch (error) {
            console.error('❌ FFmpeg.wasm 加载失败:', error);
            this.showProcessingStatus('FFmpeg加载失败，将使用Web API备用方案', 100);
            // 使用简单的Web API作为备用方案
            this.useWebAPI = true;
        }
    }

    // 等待FFmpeg库加载
    async waitForFFmpeg() {
        let attempts = 0;
        const maxAttempts = 50; // 等待5秒
        
        while (attempts < maxAttempts) {
            if (typeof window.FFmpeg !== 'undefined' && typeof window.FFmpegUtil !== 'undefined') {
                return;
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
            this.currentVideo = file;
            
            // 创建视频URL
            const videoURL = URL.createObjectURL(file);
            this.previewVideo.src = videoURL;
            this.previewVideo.style.display = 'block';
            this.noVideoPlaceholder.style.display = 'none';
            
            // 等待视频加载完成获取时长
            await new Promise((resolve) => {
                this.previewVideo.onloadedmetadata = () => {
                    this.videoDuration = this.previewVideo.duration;
                    this.updateTimeline();
                    resolve();
                };
            });
            
            this.processVideoBtn.disabled = false;
            console.log(`✅ 视频加载成功，时长: ${this.formatTime(this.videoDuration)}`);
            
        } catch (error) {
            console.error('❌ 视频加载失败:', error);
            this.showError('视频加载失败，请选择有效的视频文件');
        }
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
        
        try {
            this.isProcessing = true;
            this.processVideoBtn.disabled = true;
            this.showProcessingStatus('正在处理视频...', 0);
            
            console.log(`🎬 开始处理视频: ${this.startTime}s - ${this.endTime}s`);
            
            if (this.useWebAPI) {
                // 使用Web API作为备用方案
                await this.processVideoWithWebAPI();
            } else {
                // 使用FFmpeg.wasm
                await this.processVideoWithFFmpeg();
            }
            
            console.log('✅ 视频处理完成');
            this.showProcessingStatus('视频处理完成！', 100);
            this.downloadBtn.disabled = false;
            this.updateDownloadButton();
            this.showFileSizeInfo();
            
        } catch (error) {
            console.error('❌ 视频处理失败:', error);
            this.showProcessingStatus('视频处理失败，请重试', 100);
            this.showError('视频处理失败: ' + error.message);
        } finally {
            this.isProcessing = false;
            this.processVideoBtn.disabled = false;
        }
    }

    // 使用FFmpeg.wasm处理视频
    async processVideoWithFFmpeg() {
        if (!this.ffmpeg) {
            throw new Error('FFmpeg未初始化');
        }
        
        if (typeof window.FFmpegUtil === 'undefined') {
            throw new Error('FFmpegUtil未加载');
        }
        
        const { fetchFile } = window.FFmpegUtil;
        
        // 写入输入文件
        await this.ffmpeg.writeFile('input.mp4', await fetchFile(this.currentVideo));
        this.updateProgress(20);
        
        // 执行裁剪命令
        await this.ffmpeg.exec([
            '-i', 'input.mp4',
            '-ss', this.startTime.toString(),
            '-t', (this.endTime - this.startTime).toString(),
            '-c', 'copy',
            'output.mp4'
        ]);
        this.updateProgress(80);
        
        // 读取输出文件
        const data = await this.ffmpeg.readFile('output.mp4');
        this.updateProgress(100);
        
        this.processedVideo = new Blob([data.buffer], { type: 'video/mp4' });
        
        // 清理临时文件
        await this.ffmpeg.deleteFile('input.mp4');
        await this.ffmpeg.deleteFile('output.mp4');
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
                    this.updateProgress(100);
                    console.log('✅ Web API视频处理完成');
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
        if (!this.processedVideo) return;
        
        const url = URL.createObjectURL(this.processedVideo);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cropped_video_${Date.now()}.${this.processedVideo.type.includes('webm') ? 'webm' : 'mp4'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📥 视频下载完成');
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
    }

    // 显示错误信息
    showError(message) {
        alert('错误: ' + message);
    }
}