/**
 * 视频对比分析助手
 * 封装视频对比功能，提供简单易用的API接口
 */
class VideoComparisonHelper {
    constructor() {
        this.videoComparison = null;
        this.isInitialized = false;
    }

    /**
     * 初始化视频对比功能
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // 直接使用全局变量，避免动态导入的CORS问题
            const VideoComparison = window.VideoComparison;
            
            if (!VideoComparison) {
                throw new Error('VideoComparison 类未找到，请确保 video-comparison.js 已正确加载');
            }
            
            console.log('🔗 使用全局 VideoComparison 类');
            this.videoComparison = new VideoComparison();
            this.isInitialized = true;
            console.log('✅ 视频对比助手初始化成功');
        } catch (error) {
            console.error('❌ 视频对比助手初始化失败:', error);
            throw error;
        }
    }

    /**
     * 对比两个视频文件
     * @param {File|Blob} originalFile - 原始视频文件
     * @param {File|Blob} newFile - 新视频文件
     * @param {Object} options - 选项配置
     * @param {string} options.mode - 对比模式: 'basic' | 'detailed'
     * @returns {Promise<Object>} 对比结果
     */
    async compareVideos(originalFile, newFile, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const { mode = 'detailed' } = options;
            console.log(`🔍 开始${mode === 'basic' ? '普通' : '详细'}视频对比分析...`);
            const results = await this.videoComparison.compareVideos(originalFile, newFile, { mode });
            console.log(`✅ ${mode === 'basic' ? '普通' : '详细'}视频对比分析完成`);
            return results;
        } catch (error) {
            console.error('❌ 视频对比分析失败:', error);
            throw error;
        }
    }

    /**
     * 显示对比结果弹窗
     * @param {Object} results - 对比结果
     * @param {Object} options - 显示选项
     */
    showComparisonModal(results, options = {}) {
        const {
            title = '🎬 视频对比结果',
            showCloseButton = true,
            onClose = null,
            customStyles = null
        } = options;

        // 创建弹窗
        const modal = document.createElement('div');
        modal.className = 'video-comparison-modal';
        modal.innerHTML = this.generateModalHTML(results, title, showCloseButton);

        // 添加样式
        this.addModalStyles(modal, customStyles);

        // 添加到页面
        document.body.appendChild(modal);

        // 绑定关闭事件
        if (showCloseButton) {
            const closeBtn = modal.querySelector('.close-btn');
            closeBtn.addEventListener('click', () => {
                this.closeModal(modal, onClose);
            });
        }

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal, onClose);
            }
        });

        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal, onClose);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        return modal;
    }

    /**
     * 生成弹窗HTML
     * @param {Object} results - 对比结果
     * @param {string} title - 标题
     * @param {boolean} showCloseButton - 是否显示关闭按钮
     * @returns {string} HTML字符串
     */
    generateModalHTML(results, title, showCloseButton) {
        return `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    ${showCloseButton ? '<button class="close-btn">×</button>' : ''}
                </div>
                <div class="modal-body">
                    <div class="comparison-summary">
                        <div class="summary-item">
                            <span class="label">整体趋势:</span>
                            <span class="value ${this.getTrendClass(results.summary.overallTrend)}">
                                ${results.summary.overallTrend}
                            </span>
                        </div>
                    </div>
                    
                    <div class="comparison-details">
                        <div class="detail-row">
                            <span class="label">分辨率:</span>
                            <span class="value">${results.differences.resolutionChange.original} → ${results.differences.resolutionChange.new}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">质量等级:</span>
                            <span class="value">${results.differences.qualityChange.original} → ${results.differences.qualityChange.new}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">文件大小:</span>
                            <span class="value">${(results.original.fileSize / (1024*1024)).toFixed(2)} MB → ${(results.new.fileSize / (1024*1024)).toFixed(2)} MB</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">码率:</span>
                            <span class="value">${(results.original.estimatedBitrate / 1000).toFixed(0)} kbps → ${(results.new.estimatedBitrate / 1000).toFixed(0)} kbps</span>
                        </div>
                    </div>
                    
                    <div class="quality-analysis">
                        <h4>🔬 质量分析</h4>
                        <div class="quality-metrics">
                            <div class="metric">
                                <span class="metric-label">质量保持度:</span>
                                <span class="metric-value">${results.qualityAnalysis.compressionEfficiency.qualityRetention || 0}%</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">视觉质量评分:</span>
                                <span class="metric-value">${results.qualityAnalysis.visualQualityScore.overallScore || 0} (${results.qualityAnalysis.visualQualityScore.grade || '未知'})</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">质量损失:</span>
                                <span class="metric-value">${results.qualityAnalysis.qualityLoss.overallLoss || 0}% (${results.qualityAnalysis.qualityLoss.severity || '未知'})</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="recommendations">
                        <h4>💡 建议</h4>
                        <ul>
                            ${results.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 获取趋势样式类
     * @param {string} trend - 趋势文本
     * @returns {string} CSS类名
     */
    getTrendClass(trend) {
        if (trend.includes('提升')) return 'positive';
        if (trend.includes('下降')) return 'negative';
        return 'neutral';
    }

    /**
     * 添加弹窗样式
     * @param {HTMLElement} modal - 弹窗元素
     * @param {string} customStyles - 自定义样式
     */
    addModalStyles(modal, customStyles) {
        const style = document.createElement('style');
        style.textContent = `
            .video-comparison-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(8px);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn 0.4s ease;
            }
            
            @keyframes fadeIn {
                from { 
                    opacity: 0;
                    backdrop-filter: blur(0px);
                }
                to { 
                    opacity: 1;
                    backdrop-filter: blur(8px);
                }
            }
            
            .modal-content {
                background: white;
                border-radius: 20px;
                max-width: 800px;
                max-height: 90vh;
                overflow: hidden;
                box-shadow: 0 25px 80px rgba(0,0,0,0.4);
                animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                margin: 20px;
                display: flex;
                flex-direction: column;
            }
            
            .modal-body {
                flex: 1;
                overflow-y: auto;
                padding: 0;
            }
            
            /* 美化滚动条 */
            .modal-body::-webkit-scrollbar {
                width: 8px;
            }
            
            .modal-body::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 10px;
            }
            
            .modal-body::-webkit-scrollbar-thumb {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 10px;
                transition: all 0.3s ease;
            }
            
            .modal-body::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
            }
            
            /* Firefox 滚动条样式 */
            .modal-body {
                scrollbar-width: thin;
                scrollbar-color: #667eea #f1f1f1;
            }
            
            @keyframes slideIn {
                from { 
                    opacity: 0;
                    transform: translateY(-50px) scale(0.9);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 25px 30px;
                border-bottom: none;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 20px 20px 0 0;
                position: relative;
                overflow: hidden;
            }
            
            .modal-header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.1) 100%);
                animation: shimmer 3s ease-in-out infinite;
            }
            
            @keyframes shimmer {
                0%, 100% { transform: translateX(-100%); }
                50% { transform: translateX(100%); }
            }
            
            .modal-header h3 {
                margin: 0;
                font-size: 1.5em;
                font-weight: 700;
                position: relative;
                z-index: 1;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            
            .close-btn {
                background: rgba(255,255,255,0.15);
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 8px 12px;
                border-radius: 50%;
                transition: all 0.3s ease;
                position: relative;
                z-index: 1;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
            }
            
            .close-btn:hover {
                background: rgba(255,255,255,0.25);
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            
            .modal-body {
                padding: 30px;
                background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            }
            
            .comparison-summary {
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                padding: 25px;
                border-radius: 15px;
                margin-bottom: 30px;
                border: 1px solid #e9ecef;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                position: relative;
                overflow: hidden;
            }
            
            .comparison-summary::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 4px;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            
            .summary-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
                z-index: 1;
            }
            
            .label {
                font-weight: 600;
                color: #495057;
                font-size: 1.1em;
            }
            
            .value {
                font-weight: 700;
                padding: 8px 16px;
                border-radius: 25px;
                font-size: 1em;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: all 0.3s ease;
            }
            
            .value:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .value.positive {
                background: #d4edda;
                color: #155724;
            }
            
            .value.negative {
                background: #f8d7da;
                color: #721c24;
            }
            
            .value.neutral {
                background: #e2e3e5;
                color: #383d41;
            }
            
            .comparison-details {
                margin-bottom: 30px;
                background: white;
                border-radius: 15px;
                padding: 25px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                border: 1px solid #e9ecef;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 0;
                border-bottom: 1px solid #f8f9fa;
                transition: all 0.3s ease;
            }
            
            .detail-row:hover {
                background: #f8f9fa;
                margin: 0 -15px;
                padding: 15px;
                border-radius: 8px;
            }
            
            .detail-row:last-child {
                border-bottom: none;
            }
            
            .quality-analysis {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 25px;
                border-radius: 15px;
                margin-bottom: 30px;
                position: relative;
                overflow: hidden;
                box-shadow: 0 8px 30px rgba(102, 126, 234, 0.3);
            }
            
            .quality-analysis::before {
                content: '';
                position: absolute;
                top: -50%;
                right: -50%;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: pulse 4s ease-in-out infinite;
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 0.5; }
                50% { transform: scale(1.1); opacity: 0.8; }
            }
            
            .quality-analysis h4 {
                margin: 0 0 20px 0;
                font-size: 1.3em;
                font-weight: 700;
                position: relative;
                z-index: 1;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            
            .quality-metrics {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                position: relative;
                z-index: 1;
            }
            
            .metric {
                background: rgba(255,255,255,0.15);
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            
            .metric:hover {
                transform: translateY(-5px);
                background: rgba(255,255,255,0.2);
                box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            }
            
            .metric-label {
                display: block;
                font-size: 0.95em;
                opacity: 0.9;
                margin-bottom: 8px;
                font-weight: 500;
            }
            
            .metric-value {
                font-size: 1.4em;
                font-weight: 700;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            
            .recommendations {
                background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                border: 1px solid #ffeaa7;
                border-radius: 15px;
                padding: 25px;
                box-shadow: 0 4px 20px rgba(255, 193, 7, 0.2);
                position: relative;
                overflow: hidden;
            }
            
            .recommendations::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 4px;
                height: 100%;
                background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%);
            }
            
            .recommendations h4 {
                margin: 0 0 20px 0;
                color: #856404;
                font-size: 1.3em;
                font-weight: 700;
                position: relative;
                z-index: 1;
            }
            
            .recommendations ul {
                margin: 0;
                padding-left: 0;
                list-style: none;
                position: relative;
                z-index: 1;
            }
            
            .recommendations li {
                margin-bottom: 12px;
                color: #856404;
                line-height: 1.6;
                padding: 12px 16px;
                background: rgba(255,255,255,0.6);
                border-radius: 8px;
                border-left: 3px solid #ffc107;
                transition: all 0.3s ease;
                position: relative;
            }
            
            .recommendations li::before {
                content: '💡';
                margin-right: 8px;
                font-size: 1.1em;
            }
            
            .recommendations li:hover {
                background: rgba(255,255,255,0.8);
                transform: translateX(5px);
                box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
            }
            
            @media (max-width: 768px) {
                .modal-content {
                    margin: 10px;
                    max-height: 90vh;
                }
                
                .modal-header {
                    padding: 15px 20px;
                }
                
                .modal-body {
                    padding: 20px;
                }
                
                .quality-metrics {
                    grid-template-columns: 1fr;
                }
                
                .detail-row {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 5px;
                }
            }
            
            ${customStyles || ''}
        `;
        
        modal.appendChild(style);
    }

    /**
     * 关闭弹窗
     * @param {HTMLElement} modal - 弹窗元素
     * @param {Function} onClose - 关闭回调
     */
    closeModal(modal, onClose) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            modal.remove();
            if (onClose) onClose();
        }, 300);
    }

    /**
     * 快速对比并显示结果
     * @param {File|Blob} originalFile - 原始视频文件
     * @param {File|Blob} newFile - 新视频文件
     * @param {Object} options - 选项配置
     * @param {string} options.mode - 对比模式: 'basic' | 'detailed'
     * @returns {Promise<HTMLElement>} 弹窗元素
     */
    async quickCompare(originalFile, newFile, options = {}) {
        try {
            const results = await this.compareVideos(originalFile, newFile, options);
            return this.showComparisonModal(results, options);
        } catch (error) {
            console.error('❌ 快速对比失败:', error);
            throw error;
        }
    }

    /**
     * 获取对比结果的简化信息
     * @param {Object} results - 对比结果
     * @returns {Object} 简化信息
     */
    getSimplifiedResults(results) {
        return {
            overallTrend: results.summary.overallTrend,
            fileSizeChange: {
                original: (results.original.fileSize / (1024*1024)).toFixed(2),
                new: (results.new.fileSize / (1024*1024)).toFixed(2),
                percentage: results.differences.fileSizeChange.percentage
            },
            qualityChange: {
                original: results.differences.qualityChange.original,
                new: results.differences.qualityChange.new
            },
            bitrateChange: {
                original: (results.original.estimatedBitrate / 1000).toFixed(0),
                new: (results.new.estimatedBitrate / 1000).toFixed(0),
                percentage: results.differences.bitrateChange.percentage
            },
            qualityRetention: results.qualityAnalysis.compressionEfficiency.qualityRetention || 0,
            recommendations: results.summary.recommendations
        };
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoComparisonHelper;
}

// 全局可用
if (typeof window !== 'undefined') {
    window.VideoComparisonHelper = VideoComparisonHelper;
}