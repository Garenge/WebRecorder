/**
 * 视频对比分析UI组件
 * 提供用户友好的界面来对比两个视频文件
 */
class VideoComparisonUI {
    constructor() {
        this.comparison = new VideoComparison();
        this.container = null;
        this.originalFile = null;
        this.newFile = null;
    }

    /**
     * 创建对比界面
     * @param {string} containerId - 容器元素ID
     */
    createUI(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('找不到容器元素:', containerId);
            return;
        }

        this.container.innerHTML = `
            <div class="video-comparison-container">
                <div class="comparison-header">
                    <h2>🎬 视频文件对比分析</h2>
                    <p>上传两个视频文件进行详细对比，分析清晰度、质量等参数变化</p>
                </div>
                
                <div class="file-upload-section">
                    <div class="upload-group">
                        <h3>📁 原文件</h3>
                        <div class="file-input-wrapper">
                            <input type="file" id="originalFile" accept="video/*" class="file-input">
                            <label for="originalFile" class="file-label">
                                <span class="file-icon">📹</span>
                                <span class="file-text">选择原视频文件</span>
                            </label>
                        </div>
                        <div id="originalFileInfo" class="file-info"></div>
                    </div>
                    
                    <div class="upload-group">
                        <h3>🆕 新文件</h3>
                        <div class="file-input-wrapper">
                            <input type="file" id="newFile" accept="video/*" class="file-input">
                            <label for="newFile" class="file-label">
                                <span class="file-icon">🎥</span>
                                <span class="file-text">选择新视频文件</span>
                            </label>
                        </div>
                        <div id="newFileInfo" class="file-info"></div>
                    </div>
                </div>
                
                <div class="comparison-mode-selection">
                    <h3>🎯 对比模式选择</h3>
                    <div class="mode-options">
                        <label class="mode-option">
                            <input type="radio" name="comparisonMode" value="basic" checked>
                            <span class="mode-info">
                                <span class="mode-title">📊 普通对比</span>
                                <span class="mode-desc">快速对比基础参数（分辨率、文件大小、码率、时长）</span>
                            </span>
                        </label>
                        <label class="mode-option">
                            <input type="radio" name="comparisonMode" value="detailed">
                            <span class="mode-info">
                                <span class="mode-title">🔬 详细对比</span>
                                <span class="mode-desc">完整分析质量指标、压缩效率、视觉评分等</span>
                            </span>
                        </label>
                    </div>
                </div>
                
                <div class="comparison-controls">
                    <button id="compareButton" class="compare-btn" disabled>
                        <span class="btn-icon">🔍</span>
                        <span class="btn-text">开始对比分析</span>
                    </button>
                    <button id="clearButton" class="clear-btn">
                        <span class="btn-icon">🗑️</span>
                        <span class="btn-text">清空文件</span>
                    </button>
                </div>
                
                <div id="comparisonResults" class="comparison-results" style="display: none;">
                    <div class="results-header">
                        <h3>📊 对比结果</h3>
                        <div id="overallTrend" class="overall-trend"></div>
                    </div>
                    
                    <div class="results-content">
                        <div class="results-grid">
                            <div class="result-card">
                                <h4>📐 分辨率对比</h4>
                                <div id="resolutionComparison"></div>
                            </div>
                            
                            <div class="result-card">
                                <h4>🎯 质量等级对比</h4>
                                <div id="qualityComparison"></div>
                            </div>
                            
                            <div class="result-card">
                                <h4>📊 文件大小对比</h4>
                                <div id="fileSizeComparison"></div>
                            </div>
                            
                            <div class="result-card">
                                <h4>⚡ 码率对比</h4>
                                <div id="bitrateComparison"></div>
                            </div>
                        </div>
                        
                        <div class="quality-analysis">
                            <h4>🔬 质量分析</h4>
                            <div id="qualityAnalysisResults"></div>
                        </div>
                        
                        <div class="key-changes">
                            <h4>🔍 关键变化</h4>
                            <div id="keyChangesList"></div>
                        </div>
                        
                        <div class="recommendations">
                            <h4>💡 建议</h4>
                            <div id="recommendationsList"></div>
                        </div>
                    </div>
                </div>
                
                <div id="loadingIndicator" class="loading-indicator" style="display: none;">
                    <div class="loading-spinner"></div>
                    <p>正在分析视频文件...</p>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.addStyles();
    }

    /**
     * 添加事件监听器
     */
    attachEventListeners() {
        const originalFileInput = document.getElementById('originalFile');
        const newFileInput = document.getElementById('newFile');
        const compareButton = document.getElementById('compareButton');
        const clearButton = document.getElementById('clearButton');

        originalFileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e, 'original');
        });

        newFileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e, 'new');
        });

        compareButton.addEventListener('click', () => {
            this.performComparison();
        });

        clearButton.addEventListener('click', () => {
            this.clearFiles();
        });
    }

    /**
     * 处理文件选择
     * @param {Event} event - 文件选择事件
     * @param {string} type - 文件类型 ('original' 或 'new')
     */
    async handleFileSelect(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        if (type === 'original') {
            this.originalFile = file;
        } else {
            this.newFile = file;
        }

        // 显示文件信息
        this.displayFileInfo(file, type);

        // 检查是否可以开始对比
        this.updateCompareButton();
    }

    /**
     * 显示文件信息
     * @param {File} file - 文件对象
     * @param {string} type - 文件类型
     */
    displayFileInfo(file, type) {
        const infoContainer = document.getElementById(`${type}FileInfo`);
        const fileSize = (file.size / (1024 * 1024)).toFixed(2);
        
        infoContainer.innerHTML = `
            <div class="file-details">
                <div class="file-name">📄 ${file.name}</div>
                <div class="file-size">💾 ${fileSize} MB</div>
                <div class="file-type">🎬 ${file.type || '未知格式'}</div>
            </div>
        `;
    }

    /**
     * 更新对比按钮状态
     */
    updateCompareButton() {
        const compareButton = document.getElementById('compareButton');
        const isReady = this.originalFile && this.newFile;
        
        compareButton.disabled = !isReady;
        if (isReady) {
            compareButton.classList.add('ready');
        } else {
            compareButton.classList.remove('ready');
        }
    }

    /**
     * 执行对比分析
     */
    async performComparison() {
        if (!this.originalFile || !this.newFile) {
            alert('请先选择两个视频文件');
            return;
        }

        const loadingIndicator = document.getElementById('loadingIndicator');
        const resultsContainer = document.getElementById('comparisonResults');
        const compareButton = document.getElementById('compareButton');

        // 获取选择的对比模式
        const selectedMode = document.querySelector('input[name="comparisonMode"]:checked').value;
        const modeText = selectedMode === 'basic' ? '普通' : '详细';

        // 显示加载状态
        loadingIndicator.style.display = 'block';
        loadingIndicator.querySelector('p').textContent = `正在执行${modeText}对比分析...`;
        resultsContainer.style.display = 'none';
        compareButton.disabled = true;

        try {
            // 执行对比分析
            const results = await this.comparison.compareVideos(this.originalFile, this.newFile, { mode: selectedMode });
            
            // 显示结果
            this.displayResults(results);
            
        } catch (error) {
            console.error('对比分析失败:', error);
            alert('对比分析失败: ' + error.message);
        } finally {
            // 隐藏加载状态
            loadingIndicator.style.display = 'none';
            compareButton.disabled = false;
        }
    }

    /**
     * 显示对比结果
     * @param {Object} results - 对比结果
     */
    displayResults(results) {
        const resultsContainer = document.getElementById('comparisonResults');
        resultsContainer.style.display = 'block';

        // 更新结果标题
        const resultsHeader = resultsContainer.querySelector('.results-header h3');
        const modeText = results.mode === 'basic' ? '普通' : '详细';
        resultsHeader.textContent = `📊 ${modeText}对比结果`;

        // 显示整体趋势
        this.displayOverallTrend(results.summary.overallTrend);

        // 显示各项对比
        this.displayResolutionComparison(results.differences.resolutionChange);
        this.displayQualityComparison(results.differences.qualityChange);
        this.displayFileSizeComparison(results.differences.fileSizeChange);
        this.displayBitrateComparison(results.differences.bitrateChange);

        // 根据模式显示不同的内容
        if (results.mode === 'detailed') {
            // 详细模式：显示质量分析
            this.displayQualityAnalysis(results.qualityAnalysis);
            this.showQualityAnalysis();
        } else {
            // 普通模式：隐藏质量分析部分
            this.hideQualityAnalysis();
        }

        // 显示关键变化
        this.displayKeyChanges(results.summary.keyChanges);

        // 显示建议
        this.displayRecommendations(results.summary.recommendations);
        
        // 显示模式特定的额外信息
        if (results.mode === 'detailed') {
            this.displayDetailedAnalysis(results);
        }
    }

    /**
     * 显示整体趋势
     * @param {string} trend - 整体趋势
     */
    displayOverallTrend(trend) {
        const trendContainer = document.getElementById('overallTrend');
        let trendClass = 'neutral';
        let trendIcon = '➡️';

        if (trend.includes('提升')) {
            trendClass = 'positive';
            trendIcon = '📈';
        } else if (trend.includes('下降')) {
            trendClass = 'negative';
            trendIcon = '📉';
        }

        trendContainer.innerHTML = `
            <div class="trend-indicator ${trendClass}">
                <span class="trend-icon">${trendIcon}</span>
                <span class="trend-text">${trend}</span>
            </div>
        `;
    }

    /**
     * 显示分辨率对比
     * @param {Object} resolutionChange - 分辨率变化信息
     */
    displayResolutionComparison(resolutionChange) {
        const container = document.getElementById('resolutionComparison');
        const isChanged = resolutionChange.changed;
        const trendClass = resolutionChange.trend.includes('提升') ? 'positive' : 
                          resolutionChange.trend.includes('降低') ? 'negative' : 'neutral';

        container.innerHTML = `
            <div class="comparison-item">
                <div class="comparison-values">
                    <div class="value original">
                        <span class="label">原文件:</span>
                        <span class="value-text">${resolutionChange.original}</span>
                    </div>
                    <div class="arrow">→</div>
                    <div class="value new">
                        <span class="label">新文件:</span>
                        <span class="value-text">${resolutionChange.new}</span>
                    </div>
                </div>
                <div class="change-indicator ${trendClass}">
                    ${isChanged ? resolutionChange.trend : '无变化'}
                </div>
            </div>
        `;
    }

    /**
     * 显示质量对比
     * @param {Object} qualityChange - 质量变化信息
     */
    displayQualityComparison(qualityChange) {
        const container = document.getElementById('qualityComparison');
        const isChanged = qualityChange.changed;
        const trendClass = qualityChange.trend.includes('提升') ? 'positive' : 
                          qualityChange.trend.includes('降低') ? 'negative' : 'neutral';

        container.innerHTML = `
            <div class="comparison-item">
                <div class="comparison-values">
                    <div class="value original">
                        <span class="label">原文件:</span>
                        <span class="value-text">${qualityChange.original}</span>
                    </div>
                    <div class="arrow">→</div>
                    <div class="value new">
                        <span class="label">新文件:</span>
                        <span class="value-text">${qualityChange.new}</span>
                    </div>
                </div>
                <div class="change-indicator ${trendClass}">
                    ${isChanged ? qualityChange.trend : '无变化'}
                </div>
            </div>
        `;
    }

    /**
     * 显示文件大小对比
     * @param {Object} fileSizeChange - 文件大小变化信息
     */
    displayFileSizeComparison(fileSizeChange) {
        const container = document.getElementById('fileSizeComparison');
        const trendClass = fileSizeChange.trend === '增加' ? 'negative' : 
                          fileSizeChange.trend === '减少' ? 'positive' : 'neutral';

        container.innerHTML = `
            <div class="comparison-item">
                <div class="comparison-values">
                    <div class="value original">
                        <span class="label">原文件:</span>
                        <span class="value-text">${fileSizeChange.original}</span>
                    </div>
                    <div class="arrow">→</div>
                    <div class="value new">
                        <span class="label">新文件:</span>
                        <span class="value-text">${fileSizeChange.new}</span>
                    </div>
                </div>
                <div class="change-indicator ${trendClass}">
                    ${fileSizeChange.percentage}% (${fileSizeChange.trend})
                </div>
            </div>
        `;
    }

    /**
     * 显示码率对比
     * @param {Object} bitrateChange - 码率变化信息
     */
    displayBitrateComparison(bitrateChange) {
        const container = document.getElementById('bitrateComparison');
        const trendClass = bitrateChange.trend === '提高' ? 'positive' : 
                          bitrateChange.trend === '降低' ? 'negative' : 'neutral';

        container.innerHTML = `
            <div class="comparison-item">
                <div class="comparison-values">
                    <div class="value original">
                        <span class="label">原文件:</span>
                        <span class="value-text">${bitrateChange.original}</span>
                    </div>
                    <div class="arrow">→</div>
                    <div class="value new">
                        <span class="label">新文件:</span>
                        <span class="value-text">${bitrateChange.new}</span>
                    </div>
                </div>
                <div class="change-indicator ${trendClass}">
                    ${bitrateChange.percentage}% (${bitrateChange.trend})
                </div>
            </div>
        `;
    }

    /**
     * 显示关键变化
     * @param {Array} keyChanges - 关键变化列表
     */
    displayKeyChanges(keyChanges) {
        const container = document.getElementById('keyChangesList');
        
        if (keyChanges.length === 0) {
            container.innerHTML = '<div class="no-changes">✅ 无明显变化</div>';
            return;
        }

        container.innerHTML = keyChanges.map(change => `
            <div class="change-item">
                <span class="change-icon">🔄</span>
                <span class="change-text">${change}</span>
            </div>
        `).join('');
    }

    /**
     * 显示质量分析
     * @param {Object} qualityAnalysis - 质量分析结果
     */
    displayQualityAnalysis(qualityAnalysis) {
        const container = document.getElementById('qualityAnalysisResults');
        
        if (!qualityAnalysis) {
            container.innerHTML = '<div class="no-data">质量分析数据不可用</div>';
            return;
        }

        const { basicMetrics, compressionEfficiency, qualityLoss, visualQualityScore } = qualityAnalysis;

        container.innerHTML = `
            <div class="quality-metrics-grid">
                <div class="quality-metric">
                    <div class="metric-header">
                        <span class="metric-icon">📊</span>
                        <span class="metric-title">质量保持度</span>
                    </div>
                    <div class="metric-value">
                        <span class="value-number">${compressionEfficiency.qualityRetention || 0}%</span>
                        <span class="value-label">保持</span>
                    </div>
                </div>
                
                <div class="quality-metric">
                    <div class="metric-header">
                        <span class="metric-icon">🎯</span>
                        <span class="metric-title">视觉质量评分</span>
                    </div>
                    <div class="metric-value">
                        <span class="value-number">${visualQualityScore.overallScore || 0}</span>
                        <span class="value-label">${visualQualityScore.grade || '未知'}</span>
                    </div>
                </div>
                
                <div class="quality-metric">
                    <div class="metric-header">
                        <span class="metric-icon">📉</span>
                        <span class="metric-title">质量损失</span>
                    </div>
                    <div class="metric-value">
                        <span class="value-number">${qualityLoss.overallLoss || 0}%</span>
                        <span class="value-label">${qualityLoss.severity || '未知'}</span>
                    </div>
                </div>
                
                <div class="quality-metric">
                    <div class="metric-header">
                        <span class="metric-icon">⚡</span>
                        <span class="metric-title">压缩评分</span>
                    </div>
                    <div class="metric-value">
                        <span class="value-number">${compressionEfficiency.compressionScore || 0}</span>
                        <span class="value-label">分</span>
                    </div>
                </div>
            </div>
            
            <div class="quality-details">
                <div class="detail-section">
                    <h5>📈 压缩效率</h5>
                    <p class="detail-text">${compressionEfficiency.recommendation || '无法分析'}</p>
                </div>
                
                <div class="detail-section">
                    <h5>🔍 详细指标</h5>
                    <div class="detail-metrics">
                        <div class="detail-metric">
                            <span class="metric-name">分辨率评分:</span>
                            <span class="metric-value">${visualQualityScore.resolutionScore || 0}/100</span>
                        </div>
                        <div class="detail-metric">
                            <span class="metric-name">码率评分:</span>
                            <span class="metric-value">${visualQualityScore.bitrateScore || 0}/100</span>
                        </div>
                        <div class="detail-metric">
                            <span class="metric-name">压缩评分:</span>
                            <span class="metric-value">${visualQualityScore.compressionScore || 0}/100</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 显示建议
     * @param {Array} recommendations - 建议列表
     */
    displayRecommendations(recommendations) {
        const container = document.getElementById('recommendationsList');
        
        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item">
                <span class="rec-text">${rec}</span>
            </div>
        `).join('');
    }

    /**
     * 清空文件
     */
    clearFiles() {
        this.originalFile = null;
        this.newFile = null;

        // 清空文件输入
        document.getElementById('originalFile').value = '';
        document.getElementById('newFile').value = '';

        // 清空文件信息显示
        document.getElementById('originalFileInfo').innerHTML = '';
        document.getElementById('newFileInfo').innerHTML = '';

        // 隐藏结果
        document.getElementById('comparisonResults').style.display = 'none';

        // 更新按钮状态
        this.updateCompareButton();
    }

    /**
     * 添加样式
     */
    addStyles() {
        if (document.getElementById('videoComparisonStyles')) return;

        const style = document.createElement('style');
        style.id = 'videoComparisonStyles';
        style.textContent = `
            .video-comparison-container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .comparison-header {
                text-align: center;
                margin-bottom: 30px;
            }

            .comparison-header h2 {
                color: #333;
                margin-bottom: 10px;
            }

            .comparison-header p {
                color: #666;
                font-size: 14px;
            }

            .file-upload-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
                margin-bottom: 30px;
            }

            .upload-group h3 {
                margin-bottom: 15px;
                color: #333;
            }

            .file-input-wrapper {
                position: relative;
            }

            .file-input {
                display: none;
            }

            .file-label {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                border: 2px dashed #ddd;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                background: #fafafa;
            }

            .file-label:hover {
                border-color: #007bff;
                background: #f0f8ff;
            }

            .file-icon {
                font-size: 24px;
                margin-right: 10px;
            }

            .file-text {
                font-size: 16px;
                color: #666;
            }

            .file-info {
                margin-top: 15px;
            }

            .file-details {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 6px;
                border-left: 4px solid #007bff;
            }

            .file-name, .file-size, .file-type {
                margin-bottom: 5px;
                font-size: 14px;
            }

            .comparison-controls {
                display: flex;
                justify-content: center;
                gap: 15px;
                margin-bottom: 30px;
            }

            .compare-btn, .clear-btn {
                display: flex;
                align-items: center;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .compare-btn {
                background: #007bff;
                color: white;
            }

            .compare-btn:hover:not(:disabled) {
                background: #0056b3;
            }

            .compare-btn:disabled {
                background: #ccc;
                cursor: not-allowed;
            }

            .compare-btn.ready {
                background: #28a745;
            }

            .compare-btn.ready:hover {
                background: #1e7e34;
            }

            .clear-btn {
                background: #6c757d;
                color: white;
            }

            .clear-btn:hover {
                background: #545b62;
            }

            .btn-icon {
                margin-right: 8px;
            }

            .loading-indicator {
                text-align: center;
                padding: 40px;
            }

            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .comparison-results {
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                overflow: hidden;
            }

            .results-header {
                background: #f8f9fa;
                padding: 20px;
                border-bottom: 1px solid #dee2e6;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .results-header h3 {
                margin: 0;
                color: #333;
            }

            .overall-trend {
                font-size: 18px;
                font-weight: bold;
            }

            .trend-indicator {
                display: flex;
                align-items: center;
                padding: 8px 16px;
                border-radius: 20px;
            }

            .trend-indicator.positive {
                background: #d4edda;
                color: #155724;
            }

            .trend-indicator.negative {
                background: #f8d7da;
                color: #721c24;
            }

            .trend-indicator.neutral {
                background: #e2e3e5;
                color: #383d41;
            }

            .trend-icon {
                margin-right: 8px;
            }

            .results-content {
                padding: 20px;
            }

            .results-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }

            .result-card {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #007bff;
            }

            .result-card h4 {
                margin: 0 0 15px 0;
                color: #333;
            }

            .comparison-item {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .comparison-values {
                display: flex;
                align-items: center;
                gap: 15px;
            }

            .value {
                flex: 1;
                text-align: center;
            }

            .value .label {
                display: block;
                font-size: 12px;
                color: #666;
                margin-bottom: 5px;
            }

            .value-text {
                font-weight: bold;
                color: #333;
            }

            .arrow {
                font-size: 20px;
                color: #666;
            }

            .change-indicator {
                text-align: center;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
            }

            .change-indicator.positive {
                background: #d4edda;
                color: #155724;
            }

            .change-indicator.negative {
                background: #f8d7da;
                color: #721c24;
            }

            .change-indicator.neutral {
                background: #e2e3e5;
                color: #383d41;
            }

            .key-changes, .recommendations {
                margin-top: 30px;
            }

            .key-changes h4, .recommendations h4 {
                margin-bottom: 15px;
                color: #333;
            }

            .change-item, .recommendation-item {
                display: flex;
                align-items: center;
                padding: 10px;
                margin-bottom: 8px;
                background: #f8f9fa;
                border-radius: 4px;
            }

            .change-icon {
                margin-right: 10px;
                font-size: 16px;
            }

            .change-text, .rec-text {
                flex: 1;
                font-size: 14px;
            }

            .no-changes {
                text-align: center;
                color: #28a745;
                font-style: italic;
                padding: 20px;
            }

            .quality-analysis {
                margin-top: 30px;
            }

            .quality-analysis h4 {
                margin-bottom: 20px;
                color: #333;
            }

            .quality-metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-bottom: 25px;
            }

            .quality-metric {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            }

            .metric-header {
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 10px;
            }

            .metric-icon {
                font-size: 20px;
                margin-right: 8px;
            }

            .metric-title {
                font-size: 14px;
                font-weight: 500;
            }

            .metric-value {
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .value-number {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
            }

            .value-label {
                font-size: 12px;
                opacity: 0.9;
            }

            .quality-details {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #667eea;
            }

            .detail-section {
                margin-bottom: 20px;
            }

            .detail-section:last-child {
                margin-bottom: 0;
            }

            .detail-section h5 {
                margin: 0 0 10px 0;
                color: #333;
                font-size: 16px;
            }

            .detail-text {
                color: #666;
                margin: 0;
                line-height: 1.5;
            }

            .detail-metrics {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
            }

            .detail-metric {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: white;
                border-radius: 4px;
                border: 1px solid #e9ecef;
            }

            .metric-name {
                font-size: 14px;
                color: #666;
            }

            .metric-value {
                font-weight: bold;
                color: #333;
            }

            .no-data {
                text-align: center;
                color: #999;
                font-style: italic;
                padding: 20px;
            }

            /* 对比模式选择样式 */
            .comparison-mode-selection {
                margin: 20px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #e9ecef;
            }

            .comparison-mode-selection h3 {
                margin: 0 0 15px 0;
                color: #333;
                font-size: 18px;
            }

            .mode-options {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
            }

            .mode-option {
                display: flex;
                align-items: center;
                cursor: pointer;
                padding: 15px;
                background: white;
                border: 2px solid #e9ecef;
                border-radius: 8px;
                transition: all 0.3s ease;
                flex: 1;
                min-width: 250px;
            }

            .mode-option:hover {
                border-color: #007bff;
                box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1);
            }

            .mode-option input[type="radio"] {
                margin: 0 12px 0 0;
                transform: scale(1.2);
            }

            .mode-option input[type="radio"]:checked + .mode-info {
                color: #007bff;
            }

            .mode-option:has(input[type="radio"]:checked) {
                border-color: #007bff;
                background: #f8f9ff;
            }

            .mode-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .mode-title {
                font-weight: bold;
                font-size: 16px;
                color: #333;
            }

            .mode-desc {
                font-size: 14px;
                color: #666;
                line-height: 1.4;
            }

            /* 详细分析样式 */
            .detailed-analysis {
                margin: 20px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #e9ecef;
            }

            .detailed-analysis h4 {
                margin: 0 0 15px 0;
                color: #333;
                font-size: 18px;
            }

            .detailed-metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
            }

            .detailed-metric {
                background: white;
                padding: 15px;
                border-radius: 6px;
                border: 1px solid #e9ecef;
            }

            .detailed-metric h5 {
                margin: 0 0 10px 0;
                color: #333;
                font-size: 16px;
            }

            .detailed-metric p {
                margin: 5px 0;
                color: #666;
                font-size: 14px;
            }

            @media (max-width: 768px) {
                .file-upload-section {
                    grid-template-columns: 1fr;
                }
                
                .results-grid {
                    grid-template-columns: 1fr;
                }
                
                .comparison-values {
                    flex-direction: column;
                    gap: 10px;
                }
                
                .arrow {
                    transform: rotate(90deg);
                }
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * 隐藏质量分析部分（普通对比模式）
     */
    hideQualityAnalysis() {
        const qualityAnalysisSection = document.querySelector('.quality-analysis');
        if (qualityAnalysisSection) {
            qualityAnalysisSection.style.display = 'none';
        }
    }

    /**
     * 显示质量分析部分（详细对比模式）
     */
    showQualityAnalysis() {
        const qualityAnalysisSection = document.querySelector('.quality-analysis');
        if (qualityAnalysisSection) {
            qualityAnalysisSection.style.display = 'block';
        }
    }

    /**
     * 显示详细分析的额外信息
     * @param {Object} results - 详细对比结果
     */
    displayDetailedAnalysis(results) {
        // 在结果容器中添加详细分析部分
        let detailedSection = document.getElementById('detailedAnalysis');
        if (!detailedSection) {
            detailedSection = document.createElement('div');
            detailedSection.id = 'detailedAnalysis';
            detailedSection.className = 'detailed-analysis';
            detailedSection.innerHTML = `
                <h4>🔬 详细技术分析</h4>
                <div id="detailedMetrics"></div>
            `;
            
            // 插入到质量分析之前
            const qualityAnalysis = document.querySelector('.quality-analysis');
            if (qualityAnalysis) {
                qualityAnalysis.parentNode.insertBefore(detailedSection, qualityAnalysis);
            } else {
                // 如果没有质量分析部分，添加到结果容器末尾
                const resultsContainer = document.getElementById('comparisonResults');
                resultsContainer.appendChild(detailedSection);
            }
        }

        const detailedMetrics = document.getElementById('detailedMetrics');
        if (results.qualityAnalysis) {
            const { basicMetrics, compressionEfficiency } = results.qualityAnalysis;
            
            detailedMetrics.innerHTML = `
                <div class="detailed-metrics-grid">
                    <div class="detailed-metric">
                        <h5>📊 像素密度对比</h5>
                        <p>原视频: ${basicMetrics.pixelDensity.original.toLocaleString()} 像素</p>
                        <p>新视频: ${basicMetrics.pixelDensity.new.toLocaleString()} 像素</p>
                        <p>变化: ${basicMetrics.pixelDensity.change}</p>
                    </div>
                    
                    <div class="detailed-metric">
                        <h5>⚡ 码率效率对比</h5>
                        <p>原视频: ${(basicMetrics.bitrateEfficiency.original * 1000).toFixed(2)} bpp</p>
                        <p>新视频: ${(basicMetrics.bitrateEfficiency.new * 1000).toFixed(2)} bpp</p>
                        <p>效率: ${basicMetrics.bitrateEfficiency.efficiency}</p>
                    </div>
                    
                    <div class="detailed-metric">
                        <h5>📦 文件大小效率对比</h5>
                        <p>原视频: ${(basicMetrics.sizeEfficiency.original * 1000).toFixed(2)} bpp</p>
                        <p>新视频: ${(basicMetrics.sizeEfficiency.new * 1000).toFixed(2)} bpp</p>
                        <p>效率: ${basicMetrics.sizeEfficiency.efficiency}</p>
                    </div>
                    
                    <div class="detailed-metric">
                        <h5>🎯 压缩效率评分</h5>
                        <p>评分: ${compressionEfficiency.compressionScore}/100</p>
                        <p>建议: ${compressionEfficiency.recommendation}</p>
                    </div>
                </div>
            `;
        } else {
            detailedMetrics.innerHTML = '<div class="no-data">详细分析数据不可用</div>';
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoComparisonUI;
}

// 全局变量导出
if (typeof window !== 'undefined') {
    window.VideoComparisonUI = VideoComparisonUI;
}