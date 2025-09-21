// Electron预加载脚本 - 安全地暴露API到渲染进程
const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 处理视频
    processVideo: (options) => ipcRenderer.invoke('process-video', options),
    
    // 检查FFmpeg
    checkFFmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
    
    // 获取系统信息
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    
    // 监听FFmpeg进度
    onFFmpegProgress: (callback) => {
        ipcRenderer.on('ffmpeg-progress', (event, data) => callback(data));
    },
    
    // 移除监听器
    removeFFmpegProgressListener: () => {
        ipcRenderer.removeAllListeners('ffmpeg-progress');
    }
});