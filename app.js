// WebRecorder v3 - 应用程序逻辑
class WebRecorderApp {
    constructor() {
        this.recorder = new WebRecorder();
        this.videoEditor = null;
        this.recordingStartTime = null;
        this.durationTimer = null;
        this.currentTab = 'recorder';
        
        // 用于减少日志输出的变量
        this.lastChunkCount = 0;
        this.lastTotalSize = 0;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupRecorderCallbacks();
        this.setupTabNavigation();
        this.initializeApp();
    }

    // 初始化DOM元素
    initializeElements() {
        // 录制相关元素
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.cacheSize = document.getElementById('cacheSize');
        this.savedFiles = document.getElementById('savedFiles');
        this.totalRecorded = document.getElementById('totalRecorded');
        this.recordingDuration = document.getElementById('recordingDuration');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileDetails = document.getElementById('fileDetails');
        this.logContainer = document.getElementById('logContainer');
        this.memoryThresholdSelect = document.getElementById('memoryThreshold');
        this.videoQualitySelect = document.getElementById('videoQuality');
        
        // 标签页相关元素
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
    }

    // 设置事件监听器
    setupEventListeners() {
        // 开始录制
        this.startBtn.onclick = () => this.startRecording();
        
        // 停止录制
        this.stopBtn.onclick = () => this.stopRecording();
        
        // 清理内存
        this.clearBtn.onclick = () => this.clearMemory();
        
        // 监听设置变化
        this.memoryThresholdSelect.addEventListener('change', (e) => {
            this.recorder.memoryThreshold = parseInt(e.target.value);
            this.addLog(`内存阈值已更改为: ${e.target.value} MB`, 'info');
        });
        
        // 监听视频质量变化
        this.videoQualitySelect.addEventListener('change', (e) => {
            const quality = e.target.value;
            const success = this.recorder.setVideoQuality(quality);
            if (success) {
                const qualityInfo = this.recorder.getVideoQuality();
                this.addLog(`视频质量已更改为: ${qualityInfo.config.label} (${qualityInfo.config.width}x${qualityInfo.config.height})`, 'info');
            } else {
                this.addLog(`视频质量设置失败: ${quality}`, 'error');
            }
        });
    }

    // 设置标签页导航
    setupTabNavigation() {
        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    // 切换标签页
    switchTab(tabName) {
        // 更新按钮状态
        this.tabButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            }
        });

        // 更新内容显示
        this.tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            }
        });

        this.currentTab = tabName;

        // 如果切换到编辑器标签页，初始化视频编辑器
        if (tabName === 'editor' && !this.videoEditor) {
            this.initializeVideoEditor();
        }

        this.addLog(`切换到${tabName === 'recorder' ? '录制' : '视频编辑'}模式`, 'info');
    }

    // 初始化视频编辑器
    initializeVideoEditor() {
        try {
            this.videoEditor = new VideoEditor();
            this.addLog('视频编辑器初始化成功', 'success');
        } catch (error) {
            console.error('视频编辑器初始化失败:', error);
            this.addLog('视频编辑器初始化失败', 'error');
        }
    }

    // 设置录制器回调函数
    setupRecorderCallbacks() {
        this.recorder.setCallbacks({
            onStatusUpdate: (data) => this.handleStatusUpdate(data),
            onFileSaved: (data) => this.handleFileSaved(data),
            onRecordingComplete: (data) => this.handleRecordingComplete(data)
        });
    }

    // 处理状态更新
    handleStatusUpdate(data) {
        if (data.status) {
            this.recordingStatus.textContent = data.status;
        }
        
        // 实时更新缓存大小
        if (data.chunks !== undefined) {
            const cacheSizeMB = (data.size / 1024 / 1024).toFixed(2);
            this.cacheSize.textContent = `${cacheSizeMB} MB`;
            // 每次更新都显示，确保能看到变化
            console.log(`🔄 UI更新: 当前缓存 ${cacheSizeMB} MB (${data.chunks} 个数据块)`);
        }
        
        if (data.sandboxFiles !== undefined) {
            this.savedFiles.textContent = `${data.sandboxFiles} 个`;
        }
        
        // 实时更新累计录制大小
        if (data.totalSize !== undefined) {
            const totalSizeMB = (data.totalSize / 1024 / 1024).toFixed(2);
            this.totalRecorded.textContent = `${totalSizeMB} MB`;
            // 每次更新都显示，确保能看到变化
            console.log(`📈 UI更新: 累计录制 ${totalSizeMB} MB`);
        }
    }

    // 处理文件保存
    handleFileSaved(data) {
        this.addLog(`文件已保存: ${data.fileName} (${(data.size / 1024 / 1024).toFixed(2)} MB)`, 'success');
        // 使用累计总大小而不是单个文件大小
        this.totalRecorded.textContent = `${(data.totalSize / 1024 / 1024).toFixed(2)} MB`;
    }

    // 处理录制完成
    handleRecordingComplete(data) {
        this.addLog(`录制完成! 共 ${data.totalFiles} 个文件，最终文件: ${data.finalFileName}`, 'success');
        this.fileInfo.style.display = 'block';
        this.fileDetails.textContent = `最终文件: ${data.finalFileName}`;
    }

    // 开始录制
    async startRecording() {
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        
        this.addLog('开始录制...', 'info');
        this.startDurationTimer();
        
        const success = await this.recorder.startRecording();
        if (!success) {
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.stopDurationTimer();
            this.addLog('录制启动失败', 'error');
        }
    }

    // 停止录制
    async stopRecording() {
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        
        this.addLog('停止录制...', 'info');
        this.stopDurationTimer();
        await this.recorder.stopRecording();
    }

    // 清理内存
    clearMemory() {
        if (confirm('确定要清理内存吗？这将重置所有录制数据。')) {
            this.recorder.cleanup();
            this.stopDurationTimer();
            this.resetUI();
            this.addLog('内存已清理', 'success');
        }
    }

    // 重置UI状态
    resetUI() {
        this.recordingStatus.textContent = '未录制';
        this.cacheSize.textContent = '0.00 MB';
        this.savedFiles.textContent = '0 个';
        this.totalRecorded.textContent = '0.00 MB';
        this.recordingDuration.textContent = '00:00';
        this.fileInfo.style.display = 'none';
    }

    // 开始录制时长计时
    startDurationTimer() {
        this.recordingStartTime = Date.now();
        this.durationTimer = setInterval(() => this.updateRecordingDuration(), 1000);
    }

    // 停止录制时长计时
    stopDurationTimer() {
        if (this.durationTimer) {
            clearInterval(this.durationTimer);
            this.durationTimer = null;
        }
        this.recordingStartTime = null;
        this.recordingDuration.textContent = '00:00';
    }

    // 更新录制时长显示
    updateRecordingDuration() {
        if (this.recordingStartTime) {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            this.recordingDuration.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    // 添加日志
    addLog(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.logContainer.appendChild(logEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    // 初始化应用程序
    initializeApp() {
        // 初始化视频质量设置
        this.initializeVideoQuality();
        this.addLog('WebRecorder v3 初始化完成', 'success');
    }

    // 初始化视频质量设置
    initializeVideoQuality() {
        // 获取当前视频质量设置
        const currentQuality = this.recorder.getVideoQuality();
        this.videoQualitySelect.value = currentQuality.quality;
        
        // 显示当前质量信息
        this.addLog(`当前视频质量: ${currentQuality.config.label} (${currentQuality.config.width}x${currentQuality.config.height})`, 'info');
        
        // 显示所有可用的质量选项
        const availableOptions = this.recorder.getAvailableQualityOptions();
        console.log('📋 可用的视频质量选项:', availableOptions);
    }
}

// 当DOM加载完成后初始化应用程序
document.addEventListener('DOMContentLoaded', () => {
    new WebRecorderApp();
});