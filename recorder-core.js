/**
 * WebRecorder - 网页录制器核心类
 * 功能：屏幕录制、文件管理、视频拼接、质量设置
 */
class WebRecorder {
  constructor() {
    // ==================== 录制相关属性 ====================
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.isRecording = false;
    this.recordingStartTime = null;
    this.sessionId = "";
    this.currentWindowName = "";
    
    // ==================== 数据存储属性 ====================
    this.recordedChunks = [];
    this.allRecordedChunks = []; // 存储所有录制数据块，用于计算真实累计大小
    this.memoryUsage = { chunks: 0, size: 0 };
    this.memoryThreshold = 5; // MB - 默认5MB
    
    // ==================== 沙盒存储属性 ====================
    this.sandboxRoot = null;
    this.sandboxFiles = []; // 存储沙盒中的文件信息
    
    // ==================== 视频质量设置 ====================
    this.videoQuality = 'medium'; // 默认中等质量
    this.qualitySettings = {
      low: { width: 854, height: 480, bitrate: 1000000, label: '480p' },
      medium: { width: 1280, height: 720, bitrate: 2500000, label: '720p' },
      high: { width: 1920, height: 1080, bitrate: 5000000, label: '1080p' },
      ultra: { width: 3840, height: 2160, bitrate: 20000000, label: '4K' } // 提高4K码率到20Mbps
    };
    
    // ==================== 格式和编码设置 ====================
    this.selectedMimeType = null;
    
    // ==================== 录制模式设置 ====================
    this.isSingleFileMode = false; // 默认多文件模式
    this.recordingEndTime = null;
    
    // ==================== UI更新相关 ====================
    this.lastChunkCount = 0;
    this.lastTotalSize = 0;
    this.realtimeUpdateTimer = null;
    
    // ==================== 回调函数 ====================
    this.onStatusUpdate = null;
    this.onFileSaved = null;
    this.onRecordingComplete = null;
  }

  // ==================== 存储管理方法 ====================
  
  /**
   * 初始化沙盒存储
   * @returns {Promise<boolean>} 是否成功初始化
   */
  async initSandbox() {
    try {
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        this.sandboxRoot = await navigator.storage.getDirectory();
        console.log('✅ 沙盒存储已启用');
        return true;
      } else {
        console.log('⚠️ 沙盒存储不可用，使用临时存储');
        return false;
      }
    } catch (error) {
      console.log('⚠️ 沙盒存储初始化失败，使用临时存储:', error.message);
      return false;
    }
  }

  // ==================== 录制控制方法 ====================
  
  /**
   * 开始录制
   * @returns {Promise<boolean>} 是否成功开始录制
   */
  async startRecording() {
    try {
      // 清空所有录制数据，开始新的录制会话
      this.recordedChunks = [];
      this.allRecordedChunks = [];
      this.sandboxFiles = [];
      this.memoryUsage = { chunks: 0, size: 0 };
      
      console.log('🧹 清空所有录制数据，开始新的录制会话');
      
      // 初始化沙盒存储
      const sandboxAvailable = await this.initSandbox();
      
      // 获取当前视频质量设置
      const qualityConfig = this.qualitySettings[this.videoQuality];
      console.log(`🎯 视频质量设置: ${this.videoQuality} (${qualityConfig.label})`);
      console.log(`📐 目标分辨率: ${qualityConfig.width}x${qualityConfig.height}`);
      console.log(`📊 目标码率: ${(qualityConfig.bitrate / 1000000).toFixed(1)} Mbps`);
      
      // 获取屏幕共享 - 根据质量设置动态配置分辨率
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          mediaSource: 'screen',
          width: { ideal: qualityConfig.width, max: qualityConfig.width },
          height: { ideal: qualityConfig.height, max: qualityConfig.height },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('📺 屏幕共享已启动');
      console.log('🎥 视频轨道:', this.mediaStream.getVideoTracks().length);
      console.log('🎵 音频轨道:', this.mediaStream.getAudioTracks().length);
      
      // 检查实际获取的分辨率
      const videoTrack = this.mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log('📐 实际分辨率:', `${settings.width}x${settings.height}`);
        console.log('🎬 实际帧率:', settings.frameRate);
        
        // 检查是否达到目标分辨率
        if (settings.width < qualityConfig.width || settings.height < qualityConfig.height) {
          console.warn(`⚠️ 实际分辨率 ${settings.width}x${settings.height} 低于目标分辨率 ${qualityConfig.width}x${qualityConfig.height}`);
          console.warn('💡 建议：选择较小的屏幕区域或降低质量设置');
        } else {
          console.log('✅ 分辨率设置成功');
        }
      }
      
      // 记录视频轨道详细信息
      const videoTracks = this.mediaStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        const settings = videoTrack.getSettings();
        console.log('📹 视频设置:', {
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          aspectRatio: settings.aspectRatio
        });
      }
      
      // 记录音频轨道详细信息
      const audioTracks = this.mediaStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioTrack = audioTracks[0];
        const settings = audioTrack.getSettings();
        console.log('🎤 音频设置:', {
          sampleRate: settings.sampleRate,
          sampleSize: settings.sampleSize,
          channelCount: settings.channelCount
        });
      }
      
      // 检查支持的MIME类型 - 优先使用MP4提高拼接兼容性
      const supportedTypes = [
        'video/mp4;codecs=h264,aac',   // 优先MP4，拼接兼容性更好
        'video/mp4;codecs=h264,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp8,opus',  // WebM备选
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=h264,opus',
        'video/webm'
      ];
      
      let selectedMimeType = null;
      for (const mimeType of supportedTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          this.selectedMimeType = mimeType; // 存储选择的MIME类型
          console.log(`✅ 选择MIME类型: ${mimeType}`);
          break;
        }
      }
      
      if (!selectedMimeType) {
        console.warn('⚠️ 没有找到支持的MIME类型，使用默认配置');
        this.selectedMimeType = 'video/mp4;codecs=h264,aac';
      }
      
      
      // 创建MediaRecorder配置 - 根据质量设置优化
      const recorderOptions = {
        mimeType: selectedMimeType || 'video/mp4;codecs=h264,aac',
        videoBitsPerSecond: qualityConfig.bitrate, // 根据质量设置码率
        audioBitsPerSecond: 128000   // 128 kbps
      };
      
      console.log('🎥 MediaRecorder 配置:', recorderOptions);
      
      // 创建MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, recorderOptions);
      
      // 检查MediaRecorder状态
      console.log('🎥 MediaRecorder 状态:', this.mediaRecorder.state);
      console.log('🎥 MediaRecorder MIME类型:', this.mediaRecorder.mimeType);
      
      // 生成会话ID
      this.sessionId = this.generateSessionId();
      this.currentWindowName = this.getWindowName();
      
      // 设置事件处理器
      this.setupEventHandlers();
      
      // 记录录制开始时间
      this.recordingStartTime = Date.now();
      
      // 开始录制
      console.log('🚀 启动MediaRecorder，timeslice: 1000ms');
      this.mediaRecorder.start(1000); // 每1秒触发一次
      
      // 测试：如果1秒后没有数据，尝试更短的timeslice
      setTimeout(() => {
        if (this.recordedChunks.length === 0) {
          console.log('⚠️ 1秒后没有收到数据，尝试更短的timeslice');
          this.mediaRecorder.stop();
          this.mediaRecorder.start(100); // 尝试100ms
        }
      }, 1000);
      this.isRecording = true;
      
      // 检查启动后的状态
      console.log('🎥 启动后状态:', this.mediaRecorder.state);
      
      // 启动实时更新定时器，确保UI持续更新
      this.startRealtimeUpdate();
      
      this.updateStatus('录制中...');
      console.log(`🎬 开始录制 - 会话ID: ${this.sessionId}`);
      console.log('⏰ 录制开始时间:', new Date(this.recordingStartTime).toLocaleString());
      
      return true;
    } catch (error) {
      console.error("❌ 录制启动失败:", error);
      this.updateStatus('录制启动失败');
      return false;
    }
  }

  /**
   * 停止录制
   * @returns {Promise<void>}
   */
  async stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      console.log('🛑 停止录制...');
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      // 停止实时更新定时器
      this.stopRealtimeUpdate();
      
      this.updateStatus('录制已停止');
    }
    
    // 停止屏幕共享流
    if (this.mediaStream) {
      console.log('🛑 停止屏幕共享...');
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🔇 停止轨道: ${track.kind} (${track.label})`);
      });
      this.mediaStream = null;
      console.log('✅ 屏幕共享已停止');
    }
  }

  // 设置事件处理器
  setupEventHandlers() {
    console.log('🔧 设置MediaRecorder事件处理器...');
    
    this.mediaRecorder.ondataavailable = (event) => {
      console.log(`🔔 ondataavailable 事件触发: ${event.data ? event.data.size : 'null'} 字节`);
      
      if (event.data && event.data.size > 0) {
        console.log(`🔔 收到数据块: ${event.data.size} 字节 (第${this.recordedChunks.length + 1}个)`);
        
        // 添加到当前缓存
        this.recordedChunks.push(event.data);
        // 同时添加到累计跟踪
        this.allRecordedChunks.push(event.data);
        
        // 立即更新内存使用情况（包含状态更新）
        this.updateMemoryUsage();
        
        // 然后检查是否需要保存
        this.checkMemoryThreshold();
      } else {
        console.log('⚠️ 收到空数据块或无效数据');
      }
    };

    this.mediaRecorder.onstop = async () => {
      console.log('🛑 onstop 事件触发');
      await this.handleRecordingStop();
    };

    this.mediaRecorder.onerror = (error) => {
      console.error("❌ MediaRecorder 错误:", error);
      this.updateStatus('录制错误');
    };
    
    this.mediaRecorder.onstart = () => {
      console.log('✅ MediaRecorder 开始录制');
    };
    
    this.mediaRecorder.onpause = () => {
      console.log('⏸️ MediaRecorder 暂停');
    };
    
    this.mediaRecorder.onresume = () => {
      console.log('▶️ MediaRecorder 恢复');
    };
    
    console.log('✅ 事件处理器设置完成');
  }

  // 更新内存使用情况
  updateMemoryUsage() {
    this.memoryUsage.chunks = this.recordedChunks.length;
    this.memoryUsage.size = this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0);
    
    // 立即触发状态更新，确保UI实时显示
    this.updateStatus('录制中...');
  }

  // 检查内存阈值
  checkMemoryThreshold() {
    // 重新计算当前内存使用情况
    this.memoryUsage.chunks = this.recordedChunks.length;
    this.memoryUsage.size = this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0);
    
    const currentSizeMB = this.memoryUsage.size / 1024 / 1024;
    
    // 检查是否达到内存阈值
    const reachedMemoryThreshold = currentSizeMB >= this.memoryThreshold;
    
    if (reachedMemoryThreshold) {
      console.log(`🚨 达到内存阈值 ${currentSizeMB.toFixed(2)}MB，保存文件...`);
      this.saveCurrentChunks();
    }
  }

  // ==================== 文件保存方法 ====================
  
  /**
   * 保存当前数据块
   * @returns {Promise<void>}
   */
  async saveCurrentChunks() {
    if (this.recordedChunks.length === 0) return;

    console.log(`💾 保存数据块: ${this.recordedChunks.length} 个, ${(this.memoryUsage.size / 1024 / 1024).toFixed(2)} MB`);
    
    // 在清空缓存之前计算累计录制大小
    const currentCacheSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const savedFilesSize = this.sandboxFiles.reduce((sum, file) => sum + file.size, 0);
    const totalRecordedSize = savedFilesSize + currentCacheSize;
    
    console.log(`📊 保存前累计录制: ${(totalRecordedSize / 1024 / 1024).toFixed(2)} MB (已保存: ${(savedFilesSize / 1024 / 1024).toFixed(2)} MB + 当前缓存: ${(currentCacheSize / 1024 / 1024).toFixed(2)} MB)`);
    
    if (this.sandboxRoot) {
      await this.saveToSandbox();
    } else {
      await this.saveToTempStorage();
    }
    
    // 清空当前缓存
    this.recordedChunks = [];
    
    // 更新内存使用情况
    this.updateMemoryUsage();
  }

  // 保存到沙盒
  async saveToSandbox() {
    try {
      const blob = new Blob(this.recordedChunks, { type: "video/webm" });
      const partNumber = String(this.sandboxFiles.length + 1).padStart(3, '0');
      const fileName = `part${partNumber}.webm`;
      
      // 保存到沙盒
      const fileHandle = await this.sandboxRoot.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      // 记录文件信息
      this.sandboxFiles.push({
        fileName: fileName,
        size: blob.size,
        partNumber: partNumber,
        timestamp: Date.now()
      });
      
      console.log(`✅ 沙盒保存成功: ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
      
      if (this.onFileSaved) {
        // 计算已保存文件的总大小（包括刚刚保存的文件）
        const savedFilesSize = this.sandboxFiles.reduce((sum, file) => sum + file.size, 0);
        
        // 计算当前缓存大小（保存后应该为0，因为缓存已被清空）
        const currentCacheSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        
        // 计算真实累计录制大小（所有录制数据块的总和）
        const totalRecordedSize = this.allRecordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        
        console.log(`📊 沙盒保存后累计录制: ${(totalRecordedSize / 1024 / 1024).toFixed(2)} MB (真实累计: ${this.allRecordedChunks.length} 个数据块)`);
        console.log(`📊 详细分解: 已保存: ${(savedFilesSize / 1024 / 1024).toFixed(2)} MB, 当前缓存: ${(currentCacheSize / 1024 / 1024).toFixed(2)} MB`);
        
        this.onFileSaved({
          fileName: fileName,
          size: blob.size,
          totalSize: totalRecordedSize,
          savedFilesSize: savedFilesSize,
          totalFiles: this.sandboxFiles.length,
          filePath: sandboxPath
        });
      }
      
    } catch (error) {
      console.error('❌ 沙盒保存失败:', error);
      // 回退到下载模式
      this.saveToDownloads();
    }
  }

  // 保存到临时存储（回退方案）
  async saveToTempStorage() {
    const blob = new Blob(this.recordedChunks, { type: "video/webm" });
    const partNumber = String(this.sandboxFiles.length + 1).padStart(3, '0');
    const fileName = `part${partNumber}.webm`;
    
    try {
      // 尝试使用 IndexedDB 作为临时存储
      const tempFile = await this.saveToIndexedDB(blob, fileName);
      
      // 记录文件信息
      this.sandboxFiles.push({
        fileName: fileName,
        size: blob.size,
        partNumber: partNumber,
        timestamp: Date.now(),
        isTempStorage: true,
        tempKey: tempFile.key
      });
      
      console.log(`💾 临时存储: ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // 调用回调函数
      if (this.onFileSaved) {
        // 计算已保存文件的总大小（包括刚刚保存的文件）
        const savedFilesSize = this.sandboxFiles.reduce((sum, file) => sum + file.size, 0);
        
        // 计算当前缓存大小（保存后应该为0，因为缓存已被清空）
        const currentCacheSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        
        // 计算真实累计录制大小（所有录制数据块的总和）
        const totalRecordedSize = this.allRecordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        
        console.log(`📊 临时存储保存后累计录制: ${(totalRecordedSize / 1024 / 1024).toFixed(2)} MB (真实累计: ${this.allRecordedChunks.length} 个数据块)`);
        console.log(`📊 详细分解: 已保存: ${(savedFilesSize / 1024 / 1024).toFixed(2)} MB, 当前缓存: ${(currentCacheSize / 1024 / 1024).toFixed(2)} MB`);
        
        this.onFileSaved({
          fileName: fileName,
          size: blob.size,
          totalSize: totalRecordedSize,
          savedFilesSize: savedFilesSize,
          totalFiles: this.sandboxFiles.length,
          filePath: `临时存储/${fileName}`
        });
      }
      
    } catch (error) {
      console.error('❌ 临时存储失败:', error);
      // 最后的回退方案：直接累积在内存中
      await this.saveToMemory(blob, fileName);
    }
  }

  // 保存到 IndexedDB
  async saveToIndexedDB(blob, fileName) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WebRecorderTemp', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['tempFiles'], 'readwrite');
        const store = transaction.objectStore('tempFiles');
        
        const fileData = {
          fileName: fileName,
          data: blob,
          timestamp: Date.now(),
          sessionId: this.sessionId
        };
        
        const addRequest = store.add(fileData);
        addRequest.onsuccess = () => {
          resolve({ key: addRequest.result, fileName: fileName });
        };
        addRequest.onerror = () => reject(addRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('tempFiles')) {
          const store = db.createObjectStore('tempFiles', { autoIncrement: true });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('fileName', 'fileName', { unique: false });
        }
      };
    });
  }

  // 从 IndexedDB 读取
  async readFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WebRecorderTemp', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['tempFiles'], 'readonly');
        const store = transaction.objectStore('tempFiles');
        const getRequest = store.get(key);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            resolve(getRequest.result.data);
          } else {
            reject(new Error('文件未找到'));
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // 保存到内存（最后的回退方案）
  async saveToMemory(blob, fileName) {
    // 将数据转换为 ArrayBuffer 存储在内存中
    const arrayBuffer = await blob.arrayBuffer();
    
    this.sandboxFiles.push({
      fileName: fileName,
      size: blob.size,
      partNumber: String(this.sandboxFiles.length + 1).padStart(3, '0'),
      timestamp: Date.now(),
      isMemoryStorage: true,
      data: arrayBuffer
    });
    
    console.log(`🧠 内存存储: ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
  }

  // 处理录制停止
  async handleRecordingStop() {
    console.log('🛑 录制停止');
    
    // 记录录制结束时间
    this.recordingEndTime = Date.now();
    const totalDuration = this.recordingEndTime - this.recordingStartTime;
    const durationSeconds = Math.round(totalDuration / 1000);
    const durationMinutes = Math.floor(durationSeconds / 60);
    const remainingSeconds = durationSeconds % 60;
    
    console.log('⏰ 录制结束时间:', new Date(this.recordingEndTime).toLocaleString());
    console.log(`⏱️ 总录制时长: ${durationMinutes}分${remainingSeconds}秒 (${durationSeconds}秒)`);
    
    // 保存最后的数据
    if (this.recordedChunks.length > 0) {
      await this.saveCurrentChunks();
    }
    
    // 使用改进的合并策略
    if (this.sandboxFiles.length > 1) {
      await this.autoMergeFilesImproved();
    } else if (this.sandboxFiles.length === 1) {
      // 只有一个文件，直接重命名
      await this.renameSingleFile();
    }
    
    this.updateStatus('录制完成');
    
    if (this.onRecordingComplete) {
      this.onRecordingComplete({
        totalFiles: this.sandboxFiles.length,
        finalFileName: this.getFinalFileName()
      });
    }
  }

  // 改进的自动合并文件方法
  async autoMergeFilesImproved() {
    try {
      console.log(`🔄 使用改进的合并策略处理 ${this.sandboxFiles.length} 个文件...`);
      
      // 如果只有一个文件，直接处理
      if (this.sandboxFiles.length === 1) {
        await this.renameSingleFile();
        return;
      }
      
      // 收集所有数据块
      const allChunks = [];
      
      for (const fileInfo of this.sandboxFiles) {
        try {
          let arrayBuffer;
          
          if (fileInfo.isTempStorage) {
            const blob = await this.readFromIndexedDB(fileInfo.tempKey);
            arrayBuffer = await blob.arrayBuffer();
          } else if (fileInfo.isMemoryStorage) {
            arrayBuffer = fileInfo.data;
          } else {
            const fileHandle = await this.sandboxRoot.getFileHandle(fileInfo.fileName);
            const file = await fileHandle.getFile();
            arrayBuffer = await file.arrayBuffer();
          }
          
          allChunks.push(new Uint8Array(arrayBuffer));
        } catch (error) {
          console.error(`❌ 读取文件失败: ${fileInfo.fileName}`, error);
        }
      }
      
      if (allChunks.length === 0) {
        console.log('❌ 没有可合并的数据');
        return;
      }
      
      console.log(`🔄 开始合并 ${allChunks.length} 个数据块...`);
      
      // 使用智能视频合并方法（支持MP4和WebM）
      const mergedBlob = await this.mergeVideoChunks(allChunks);
      const finalFileName = this.getFinalFileName();
      
      // 验证合并后的文件
      const selectedMimeType = this.getSelectedMimeType() || "video/mp4;codecs=h264,aac";
      const isValid = selectedMimeType.includes('mp4') 
        ? await this.validateMP4File(mergedBlob)
        : await this.validateWebMFile(mergedBlob);
      
      // 下载最终文件
      this.downloadFile(mergedBlob, finalFileName);
      
      // 打印结果
      const downloadPath = this.getDownloadPath();
      console.log(`✅ 改进合并完成: ${finalFileName} (${(mergedBlob.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`📁 文件路径: ${downloadPath}/${finalFileName}`);
      console.log(`🎬 文件验证: ${isValid ? '✅ 通过' : '⚠️ 可能有问题'}`);
      
      // 如果验证失败，提供修复建议
      if (!isValid) {
        console.log('💡 建议: 如果文件无法正常播放，请使用ffmpeg修复:');
        console.log(`ffmpeg -i "${finalFileName}" -c copy -avoid_negative_ts make_zero "fixed_${finalFileName}"`);
      }
      
      // 清理临时文件
      await this.cleanupTempFiles();
      
    } catch (error) {
      console.error('❌ 改进合并失败:', error);
      // 回退到原始合并方法
      await this.autoMergeFiles();
    }
  }

  // 自动合并文件
  async autoMergeFiles() {
    try {
      console.log(`🔄 开始合并 ${this.sandboxFiles.length} 个文件...`);
      
      const allChunks = [];
      const sandboxFiles = [];
      const downloadFiles = [];
      
      // 分类文件：沙盒文件、临时存储文件和内存文件
      for (const fileInfo of this.sandboxFiles) {
        if (fileInfo.isDownload) {
          downloadFiles.push(fileInfo);
          console.log(`📥 发现下载文件: ${fileInfo.fileName} (${(fileInfo.size / 1024 / 1024).toFixed(2)} MB)`);
        } else if (fileInfo.isTempStorage) {
          sandboxFiles.push(fileInfo);
          console.log(`💾 发现临时存储文件: ${fileInfo.fileName} (${(fileInfo.size / 1024 / 1024).toFixed(2)} MB)`);
        } else if (fileInfo.isMemoryStorage) {
          sandboxFiles.push(fileInfo);
          console.log(`🧠 发现内存存储文件: ${fileInfo.fileName} (${(fileInfo.size / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          sandboxFiles.push(fileInfo);
        }
      }
      
      // 处理沙盒文件、临时存储文件和内存文件
      for (const fileInfo of sandboxFiles) {
        try {
          let arrayBuffer;
          
          if (fileInfo.isTempStorage) {
            // 从 IndexedDB 读取
            const blob = await this.readFromIndexedDB(fileInfo.tempKey);
            arrayBuffer = await blob.arrayBuffer();
            console.log(`📖 从临时存储读取: ${fileInfo.fileName}`);
          } else if (fileInfo.isMemoryStorage) {
            // 从内存读取
            arrayBuffer = fileInfo.data;
            console.log(`📖 从内存读取: ${fileInfo.fileName}`);
          } else {
            // 从沙盒读取
            const fileHandle = await this.sandboxRoot.getFileHandle(fileInfo.fileName);
            const file = await fileHandle.getFile();
            arrayBuffer = await file.arrayBuffer();
            console.log(`📖 从沙盒读取: ${fileInfo.fileName}`);
          }
          
          allChunks.push(new Uint8Array(arrayBuffer));
        } catch (error) {
          console.error(`❌ 读取文件失败: ${fileInfo.fileName}`, error);
        }
      }
      
      // 处理下载文件 - 提示用户手动合并
      if (downloadFiles.length > 0) {
        console.log(`⚠️ 发现 ${downloadFiles.length} 个下载文件，需要手动合并`);
        console.log(`📋 下载文件列表:`);
        downloadFiles.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file.fileName} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        });
        
        // 提示用户手动合并
        const confirmMerge = confirm(`发现 ${downloadFiles.length} 个下载文件需要合并。\n\n是否要下载一个合并后的完整文件？\n\n注意：由于浏览器安全限制，无法直接读取已下载的文件进行自动合并。`);
        
        if (confirmMerge) {
          // 创建一个提示文件，告诉用户如何手动合并
          const mergeInstructions = this.generateMergeInstructions(downloadFiles);
          this.downloadFile(mergeInstructions, '合并说明.txt');
          
          console.log(`📄 已生成合并说明文件`);
        }
      }
      
      if (allChunks.length === 0 && downloadFiles.length === 0) {
        console.log('❌ 没有可合并的文件');
        return;
      }
      
      // 如果有沙盒文件，进行合并
      if (allChunks.length > 0) {
        console.log(`🔄 开始合并 ${allChunks.length} 个数据块...`);
        
        // 使用正确的WebM合并方法
        const mergedBlob = await this.mergeWebMChunks(allChunks);
        const finalFileName = this.getFinalFileName();
        
        // 验证合并后的文件
        const isValid = await this.validateWebMFile(mergedBlob);
        if (!isValid) {
          console.warn('⚠️ 合并后的文件可能有问题，尝试重新合并...');
          // 可以尝试其他合并策略
        }
        
        // 下载最终文件
        this.downloadFile(mergedBlob, finalFileName);
        
        // 打印最终文件路径
        const downloadPath = this.getDownloadPath();
        console.log(`✅ 沙盒文件合并完成: ${finalFileName} (${(mergedBlob.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`📁 最终文件路径: ${downloadPath}/${finalFileName}`);
        console.log(`🔍 最终文件绝对路径: ${downloadPath}/${finalFileName}`);
        console.log(`🎬 文件验证: ${isValid ? '✅ 通过' : '⚠️ 可能有问题'}`);
        
        // 清理临时文件
        await this.cleanupTempFiles();
      }
      
    } catch (error) {
      console.error('❌ 合并文件失败:', error);
    }
  }

  // 重命名单个文件
  async renameSingleFile() {
    try {
      const fileInfo = this.sandboxFiles[0];
      if (fileInfo.isDownload) {
        console.log('📥 单个下载文件，无需重命名');
        return;
      }
      
      const fileHandle = await this.sandboxRoot.getFileHandle(fileInfo.fileName);
      const file = await fileHandle.getFile();
      
      const finalFileName = this.getFinalFileName();
      this.downloadFile(file, finalFileName);
      
      // 打印单文件路径
      const downloadPath = this.getDownloadPath();
      console.log(`✅ 单文件重命名: ${finalFileName}`);
      console.log(`📁 单文件路径: ${downloadPath}/${finalFileName}`);
      console.log(`🔍 单文件绝对路径: ${downloadPath}/${finalFileName}`);
      
      // 删除原文件
      await this.sandboxRoot.removeEntry(fileInfo.fileName);
      
    } catch (error) {
      console.error('❌ 重命名文件失败:', error);
    }
  }

  // 清理临时文件
  async cleanupTempFiles() {
    try {
      console.log('🧹 开始清理临时文件...');
      
      for (const fileInfo of this.sandboxFiles) {
        if (fileInfo.isTempStorage) {
          // 清理 IndexedDB 中的临时文件
          try {
            await this.deleteFromIndexedDB(fileInfo.tempKey);
            console.log(`🗑️ 删除临时存储文件: ${fileInfo.fileName}`);
          } catch (error) {
            console.error(`❌ 删除临时文件失败: ${fileInfo.fileName}`, error);
          }
        } else if (fileInfo.isMemoryStorage) {
          // 清理内存中的数据
          fileInfo.data = null;
          console.log(`🗑️ 清理内存文件: ${fileInfo.fileName}`);
        } else if (!fileInfo.isDownload && this.sandboxRoot) {
          // 清理沙盒文件
          try {
            await this.sandboxRoot.removeEntry(fileInfo.fileName);
            console.log(`🗑️ 删除沙盒文件: ${fileInfo.fileName}`);
          } catch (error) {
            console.error(`❌ 删除沙盒文件失败: ${fileInfo.fileName}`, error);
          }
        }
      }
      
      this.sandboxFiles = [];
      console.log('✅ 临时文件清理完成');
      
    } catch (error) {
      console.error('❌ 清理临时文件失败:', error);
    }
  }

  // 从 IndexedDB 删除文件
  async deleteFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WebRecorderTemp', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['tempFiles'], 'readwrite');
        const store = transaction.objectStore('tempFiles');
        const deleteRequest = store.delete(key);
        
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 视频拼接方法 ====================
  
  /**
   * 智能视频合并方法 - 支持MP4和WebM
   * @param {Array} chunks - 视频数据块数组
   * @returns {Promise<Blob>} 合并后的视频Blob
   */
  async mergeVideoChunks(chunks) {
    try {
      console.log(`🔧 使用智能视频合并方法...`);
      
      if (chunks.length === 1) {
        // 只有一个数据块，直接返回
        console.log('📄 只有一个数据块，直接使用');
        const mimeType = this.getSelectedMimeType() || "video/mp4;codecs=h264,aac";
        return new Blob([chunks[0]], { type: mimeType });
      }
      
      const selectedMimeType = this.getSelectedMimeType() || "video/mp4;codecs=h264,aac";
      console.log(`🎬 检测到MIME类型: ${selectedMimeType}`);
      
      // 根据MIME类型选择合并策略
      if (selectedMimeType.includes('mp4')) {
        return await this.mergeMP4Chunks(chunks);
      } else {
        return await this.mergeWebMChunks(chunks);
      }
      
    } catch (error) {
      console.error('❌ 视频合并失败:', error);
      return await this.mergeVideoChunksFallback(chunks);
    }
  }

  // MP4专用合并方法
  async mergeMP4Chunks(chunks) {
    try {
      console.log(`🎬 使用MP4合并方法...`);
      
      // MP4格式的合并相对简单，因为容器结构更标准化
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const mergedArray = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        mergedArray.set(chunk, offset);
        offset += chunk.length;
      }
      
      const mimeType = this.getSelectedMimeType() || "video/mp4;codecs=h264,aac";
      const mergedBlob = new Blob([mergedArray], { type: mimeType });
      
      console.log(`📊 MP4合并完成: ${chunks.length} 个数据块 → ${(mergedBlob.size / 1024 / 1024).toFixed(2)} MB`);
      
      // 验证MP4文件
      const isValid = await this.validateMP4File(mergedBlob);
      if (!isValid) {
        console.warn('⚠️ MP4文件验证失败，尝试修复...');
        return await this.fixMP4Structure(mergedBlob);
      }
      
      return mergedBlob;
      
    } catch (error) {
      console.error('❌ MP4合并失败:', error);
      throw error;
    }
  }

  // 验证MP4文件
  async validateMP4File(blob) {
    try {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.style.display = 'none';
        document.body.appendChild(video);
        
        const timeout = setTimeout(() => {
          document.body.removeChild(video);
          resolve(false);
        }, 5000);
        
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          document.body.removeChild(video);
          console.log(`✅ MP4文件验证成功: 时长 ${video.duration.toFixed(2)}秒`);
          resolve(true);
        };
        
        video.onerror = () => {
          clearTimeout(timeout);
          document.body.removeChild(video);
          console.log('❌ MP4文件验证失败');
          resolve(false);
        };
        
        video.src = URL.createObjectURL(blob);
        video.load();
      });
    } catch (error) {
      console.error('❌ MP4验证过程出错:', error);
      return false;
    }
  }

  // 修复MP4结构
  async fixMP4Structure(blob) {
    try {
      console.log('🔧 尝试修复MP4结构...');
      
      // 对于MP4，简单的二进制连接通常就足够了
      // 如果还有问题，可能需要更复杂的MP4容器修复
      const mimeType = this.getSelectedMimeType() || "video/mp4;codecs=h264,aac";
      const fixedBlob = new Blob([blob], { type: mimeType });
      
      console.log('✅ MP4结构修复完成');
      return fixedBlob;
      
    } catch (error) {
      console.error('❌ MP4结构修复失败:', error);
      return blob; // 返回原始blob作为回退
    }
  }

  // 正确的WebM合并方法
  async mergeWebMChunks(chunks) {
    try {
      console.log(`🔧 使用改进的WebM合并方法...`);
      
      if (chunks.length === 1) {
        // 只有一个数据块，直接返回
        console.log('📄 只有一个数据块，直接使用');
        const mimeType = this.getSelectedMimeType() || "video/webm;codecs=vp8,opus";
        return new Blob([chunks[0]], { type: mimeType });
      }
      
      // 使用更智能的WebM合并策略
      console.log('🔗 使用智能WebM合并策略...');
      
      // 方法1: 尝试使用MediaRecorder重新编码
      try {
        const reencodedBlob = await this.reencodeWebMChunks(chunks);
        if (reencodedBlob) {
          console.log('✅ 重新编码成功');
          return reencodedBlob;
        }
      } catch (error) {
        console.log('⚠️ 重新编码失败，使用直接合并方法:', error.message);
      }
      
      // 方法2: 直接合并所有数据块
      console.log('🔗 使用直接合并方法...');
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const mergedArray = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        mergedArray.set(chunk, offset);
        offset += chunk.length;
      }
      
      const mimeType = this.getSelectedMimeType() || "video/webm;codecs=vp8,opus";
      const mergedBlob = new Blob([mergedArray], { type: mimeType });
      
      console.log(`📊 合并完成: ${chunks.length} 个数据块 → ${(mergedBlob.size / 1024 / 1024).toFixed(2)} MB`);
      
      // 使用改进的WebM结构修复方法
      const fixedBlob = await this.fixWebMStructureImproved(mergedBlob);
      
      return fixedBlob;
      
    } catch (error) {
      console.error('❌ WebM合并失败:', error);
      return await this.mergeWebMChunksFallback(chunks);
    }
  }

  // 重新编码WebM数据块
  async reencodeWebMChunks(chunks) {
    try {
      console.log('🎬 尝试重新编码WebM数据块...');
      
      // 创建一个临时的video元素来播放合并的数据
      const video = document.createElement('video');
      video.style.display = 'none';
      document.body.appendChild(video);
      
      // 合并所有数据块
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const mergedArray = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        mergedArray.set(chunk, offset);
        offset += chunk.length;
      }
      
      const mimeType = this.getSelectedMimeType() || "video/webm;codecs=vp8,opus";
      const tempBlob = new Blob([mergedArray], { type: mimeType });
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          document.body.removeChild(video);
          reject(new Error('重新编码超时'));
        }, 10000);
        
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          document.body.removeChild(video);
          
          // 如果视频可以加载元数据，说明文件结构基本正确
          console.log(`✅ 视频元数据加载成功: 时长 ${video.duration.toFixed(2)}秒`);
          resolve(tempBlob);
        };
        
        video.onerror = () => {
          clearTimeout(timeout);
          document.body.removeChild(video);
          reject(new Error('视频加载失败'));
        };
        
        video.src = URL.createObjectURL(tempBlob);
        video.load();
      });
      
    } catch (error) {
      console.error('❌ 重新编码失败:', error);
      return null;
    }
  }

  // 回退的视频合并方法
  async mergeVideoChunksFallback(chunks) {
    try {
      console.log('🔄 使用回退视频合并方法...');
      
      const selectedMimeType = this.getSelectedMimeType() || "video/mp4;codecs=h264,aac";
      console.log(`🎬 回退方法检测到MIME类型: ${selectedMimeType}`);
      
      // 简单的二进制连接
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const mergedArray = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        mergedArray.set(chunk, offset);
        offset += chunk.length;
      }
      
      const mergedBlob = new Blob([mergedArray], { type: selectedMimeType });
      
      console.log(`📊 回退合并完成: ${chunks.length} 个数据块 → ${(mergedBlob.size / 1024 / 1024).toFixed(2)} MB`);
      
      return mergedBlob;
      
    } catch (error) {
      console.error('❌ 回退合并失败:', error);
      throw error;
    }
  }

  // 回退的WebM合并方法
  async mergeWebMChunksFallback(chunks) {
    try {
      console.log('🔄 使用回退WebM合并方法...');
      
      // 直接合并所有数据块
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const mergedArray = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        mergedArray.set(chunk, offset);
        offset += chunk.length;
      }
      
      const mimeType = this.getSelectedMimeType() || "video/webm;codecs=vp8,opus";
      const mergedBlob = new Blob([mergedArray], { type: mimeType });
      
      console.log(`📊 回退合并完成: ${chunks.length} 个数据块 → ${(mergedBlob.size / 1024 / 1024).toFixed(2)} MB`);
      
      // 尝试修复WebM文件结构
      const fixedBlob = await this.fixWebMStructure(mergedBlob);
      
      return fixedBlob;
      
    } catch (error) {
      console.error('❌ 回退合并也失败:', error);
      
      // 最后的回退方案：简单合并
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const mergedArray = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        mergedArray.set(chunk, offset);
        offset += chunk.length;
      }
      
      return new Blob([mergedArray], { type: "video/webm" });
    }
  }

  // 改进的WebM文件结构修复方法
  async fixWebMStructureImproved(blob) {
    try {
      console.log('🔧 使用改进的WebM结构修复方法...');
      
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 检查是否已经有正确的WebM头
      const hasWebMHeader = uint8Array[0] === 0x1A && uint8Array[1] === 0x45 && 
                           uint8Array[2] === 0xDF && uint8Array[3] === 0xA3;
      
      if (hasWebMHeader) {
        console.log('✅ WebM文件头正确，检查时长信息...');
        
        // 即使有正确的头，也可能缺少时长信息
        // 尝试通过视频元素来验证和修复
        const url = URL.createObjectURL(blob);
        const video = document.createElement('video');
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            console.log('⚠️ 视频验证超时，返回原始文件');
            resolve(blob);
          }, 3000);
          
          video.onloadedmetadata = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            console.log(`✅ 视频验证通过: 时长 ${video.duration.toFixed(2)}秒`);
            resolve(blob);
          };
          
          video.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            console.log('❌ 视频验证失败，尝试修复...');
            this.fixWebMStructure(blob).then(resolve);
          };
          
          video.src = url;
          video.load();
        });
      }
      
      // 如果文件头不正确，使用原始修复方法
      return await this.fixWebMStructure(blob);
      
    } catch (error) {
      console.error('❌ 改进的WebM结构修复失败:', error);
      return await this.fixWebMStructure(blob);
    }
  }

  // 修复WebM文件结构
  async fixWebMStructure(blob) {
    try {
      console.log('🔧 尝试修复WebM文件结构...');
      
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 检查是否已经有正确的WebM头
      const hasWebMHeader = uint8Array[0] === 0x1A && uint8Array[1] === 0x45 && 
                           uint8Array[2] === 0xDF && uint8Array[3] === 0xA3;
      
      if (hasWebMHeader) {
        console.log('✅ WebM文件头正确，无需修复');
        return blob;
      }
      
      // 如果文件头不正确，尝试添加基本的WebM容器结构
      console.log('🔧 添加WebM容器结构...');
      
      // 创建基本的EBML头
      const ebmlHeader = new Uint8Array([
        0x1A, 0x45, 0xDF, 0xA3, // EBML ID
        0x9F, 0x42, 0x86, 0x81, // EBML Size
        0x01, 0x42, 0xF7, 0x81, // EBML Version
        0x01, 0x42, 0xF2, 0x81, // EBML Read Version
        0x01, 0x42, 0xF3, 0x81, // EBML Max ID Length
        0x01, 0x42, 0xF4, 0x81, // EBML Max Size Length
        0x01, 0x42, 0xF9, 0x81, // Doc Type
        0x01, 0x42, 0xFA, 0x81, // Doc Type Version
        0x01, 0x42, 0xFB, 0x81  // Doc Type Read Version
      ]);
      
      // 合并EBML头和原始数据
      const fixedArray = new Uint8Array(ebmlHeader.length + uint8Array.length);
      fixedArray.set(ebmlHeader, 0);
      fixedArray.set(uint8Array, ebmlHeader.length);
      
      console.log('✅ WebM文件结构修复完成');
      const mimeType = this.getSelectedMimeType() || "video/webm;codecs=vp8,opus";
      return new Blob([fixedArray], { type: mimeType });
      
    } catch (error) {
      console.error('❌ WebM结构修复失败:', error);
      return blob; // 返回原始blob
    }
  }

  // 验证WebM文件
  async validateWebMFile(blob) {
    try {
      console.log(`🔍 验证WebM文件...`);
      
      // 检查文件大小
      if (blob.size === 0) {
        console.log('❌ 文件大小为0');
        return false;
      }
      
      // 检查WebM文件头
      const arrayBuffer = await blob.slice(0, 1024).arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // WebM文件应该以EBML标识符开始
      const hasWebMHeader = uint8Array[0] === 0x1A && uint8Array[1] === 0x45 && 
                           uint8Array[2] === 0xDF && uint8Array[3] === 0xA3;
      
      if (!hasWebMHeader) {
        console.log('⚠️ 文件头不是标准WebM格式');
        return false;
      }
      
      // 尝试创建视频元素来验证
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(url);
          console.log('⚠️ 视频验证超时');
          resolve(false);
        }, 5000);
        
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          console.log(`✅ 视频验证通过: 时长 ${video.duration.toFixed(2)}秒, 分辨率 ${video.videoWidth}x${video.videoHeight}`);
          resolve(true);
        };
        
        video.onerror = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          console.log('❌ 视频验证失败');
          resolve(false);
        };
        
        video.src = url;
        video.load();
      });
      
    } catch (error) {
      console.error('❌ 文件验证失败:', error);
      return false;
    }
  }

  // 下载文件
  downloadFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 获取最终文件名
  getFinalFileName() {
    const selectedMimeType = this.getSelectedMimeType() || "video/mp4;codecs=h264,aac";
    const extension = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
    return `${this.currentWindowName}_${this.sessionId}_完整录制.${extension}`;
  }

  // 获取下载目录路径
  getDownloadPath() {
    // 尝试获取用户的实际下载目录
    const userAgent = navigator.userAgent;
    let downloadPath = "浏览器默认下载目录";
    
    if (userAgent.includes("Windows")) {
      downloadPath = "C:\\Users\\[用户名]\\Downloads";
    } else if (userAgent.includes("Mac")) {
      downloadPath = "/Users/[用户名]/Downloads";
    } else if (userAgent.includes("Linux")) {
      downloadPath = "/home/[用户名]/Downloads";
    }
    
    return downloadPath;
  }



  // 生成会话ID
  generateSessionId() {
    const now = new Date();
    return now.getFullYear().toString() +
           (now.getMonth() + 1).toString().padStart(2, '0') +
           now.getDate().toString().padStart(2, '0') + '_' +
           now.getHours().toString().padStart(2, '0') +
           now.getMinutes().toString().padStart(2, '0') +
           now.getSeconds().toString().padStart(2, '0');
  }

  // 获取窗口名称
  getWindowName() {
    return document.title || '浏览器标签页';
  }

  // 获取选择的MIME类型
  getSelectedMimeType() {
    return this.selectedMimeType;
  }

  // ==================== UI更新方法 ====================
  
  /**
   * 更新录制状态
   * @param {string} status - 状态信息
   */
  updateStatus(status) {
    if (this.onStatusUpdate) {
      // 使用已计算的内存使用情况，避免重复计算
      const currentCacheSize = this.memoryUsage.size;
      const currentChunks = this.memoryUsage.chunks;
      
      // 计算已保存文件的总大小
      const savedFilesSize = this.sandboxFiles.reduce((sum, file) => sum + file.size, 0);
      
      // 计算真实累计录制大小（所有录制数据块的总和）
      const totalRecordedSize = this.allRecordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
      
      this.onStatusUpdate({ 
        status,
        totalSize: totalRecordedSize,  // 真实累计录制大小
        savedFilesSize: savedFilesSize, // 已保存文件大小
        sandboxFiles: this.sandboxFiles.length,
        chunks: currentChunks,
        size: currentCacheSize
      });
    }
  }

  // 设置回调函数
  setCallbacks(callbacks) {
    this.onStatusUpdate = callbacks.onStatusUpdate;
    this.onFileSaved = callbacks.onFileSaved;
    this.onRecordingComplete = callbacks.onRecordingComplete;
  }

  // ==================== 视频质量设置方法 ====================
  
  /**
   * 设置视频质量
   * @param {string} quality - 质量等级 ('low', 'medium', 'high', 'ultra')
   * @returns {boolean} 是否设置成功
   */
  setVideoQuality(quality) {
    if (this.qualitySettings[quality]) {
      this.videoQuality = quality;
      const config = this.qualitySettings[quality];
      console.log(`🎯 视频质量已设置为: ${quality} (${config.label})`);
      console.log(`📐 分辨率: ${config.width}x${config.height}`);
      console.log(`📊 码率: ${(config.bitrate / 1000000).toFixed(1)} Mbps`);
      return true;
    } else {
      console.warn(`⚠️ 无效的视频质量设置: ${quality}`);
      return false;
    }
  }

  // 获取当前视频质量设置
  getVideoQuality() {
    return {
      quality: this.videoQuality,
      config: this.qualitySettings[this.videoQuality]
    };
  }

  // 获取所有可用的视频质量选项
  getAvailableQualityOptions() {
    return Object.keys(this.qualitySettings).map(key => ({
      value: key,
      label: this.qualitySettings[key].label,
      resolution: `${this.qualitySettings[key].width}x${this.qualitySettings[key].height}`,
      bitrate: this.qualitySettings[key].bitrate
    }));
  }

  // 清理资源
  cleanup() {
    console.log('🧹 清理录制资源...');
    
    // 停止实时更新定时器
    this.stopRealtimeUpdate();
    
    // 停止屏幕共享
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🔇 停止轨道: ${track.kind}`);
      });
      this.mediaStream = null;
    }
    
    // 清理MediaRecorder
    if (this.mediaRecorder) {
      this.mediaRecorder = null;
    }
    
    // 清理数据
    this.recordedChunks = [];
    this.sandboxFiles = [];
    this.allRecordedChunks = []; // 清理累计跟踪数据
    this.isRecording = false;
    
    console.log('✅ 资源清理完成');
  }

  // 启动实时更新定时器
  startRealtimeUpdate() {
    // 清除之前的定时器
    if (this.realtimeUpdateTimer) {
      clearInterval(this.realtimeUpdateTimer);
    }
    
    // 每500ms更新一次UI，减少频繁更新
    this.realtimeUpdateTimer = setInterval(() => {
      if (this.isRecording) {
        // 只在有数据时才更新，避免无意义的更新
        if (this.recordedChunks.length > 0) {
          this.updateStatus('录制中...');
        }
      }
    }, 500); // 每500ms更新一次，减少阻塞
    
    console.log('🔄 实时更新定时器已启动 (500ms间隔)');
  }

  // 停止实时更新定时器
  stopRealtimeUpdate() {
    if (this.realtimeUpdateTimer) {
      clearInterval(this.realtimeUpdateTimer);
      this.realtimeUpdateTimer = null;
      console.log('🛑 实时更新定时器已停止');
    }
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebRecorder;
} else {
  window.WebRecorder = WebRecorder;
}