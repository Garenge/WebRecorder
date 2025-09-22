# WebRecorder v4

一个功能强大的跨平台视频录制和编辑工具，支持Web端和Electron桌面端，提供高性能的原生FFmpeg处理和智能视频对比分析。

## ✨ 主要功能

### 🎥 屏幕录制
- **全屏录制**：支持录制整个屏幕
- **窗口录制**：支持录制特定应用程序窗口
- **实时预览**：录制过程中实时显示录制内容
- **录制控制**：开始/暂停/停止录制功能

### ✂️ 视频编辑
- **时间轴裁剪**：直观的时间轴界面，支持精确裁剪
- **拖拽操作**：流畅的滑块拖拽，实时调整开始和结束时间
- **实时预览**：拖拽时实时显示时间变化
- **精确控制**：支持点击时间轴快速定位
- **多质量等级**：原始/高/中/低质量选择，智能码率控制
- **动态码率计算**：根据分辨率自动调整最佳码率
- **多处理引擎**：原生FFmpeg（Electron）+ FFmpeg.wasm（Web）+ Web API（备用）

### 📊 视频对比分析
- **自动对比**：一键对比原视频和处理后的视频
- **详细分析**：分辨率、码率、文件大小等参数对比
- **质量评估**：智能质量评分和优化建议
- **美化弹窗**：现代化UI设计，毛玻璃效果，自定义滚动条
- **性能监控**：完整的处理耗时统计和性能分析

### 📱 用户体验
- **跨平台支持**：Web浏览器 + Electron桌面应用
- **响应式设计**：完美适配桌面端和移动端
- **现代化UI**：简洁美观的界面设计，毛玻璃效果
- **流畅动画**：优化的拖拽体验，60fps流畅更新
- **实时反馈**：拖拽时实时显示时间变化
- **性能监控**：实时显示处理进度和耗时统计

## 🚀 技术特点

### 性能优化
- **高效拖拽**：使用requestAnimationFrame确保流畅拖拽
- **智能缓存**：预计算轨道信息，避免重复DOM查询
- **节流更新**：预览和时间显示分别优化更新频率
- **资源管理**：自动清理定时器和动画帧

### 技术栈
- **原生JavaScript**：无框架依赖，轻量级实现
- **Electron**：跨平台桌面应用框架
- **Web APIs**：使用Screen Capture API进行屏幕录制
- **原生FFmpeg**：Electron环境下的高性能视频处理
- **FFmpeg.wasm**：Web环境下的客户端视频处理
- **现代CSS**：Flexbox和Grid布局，毛玻璃效果，自定义滚动条
- **模块化架构**：组件化设计，易于维护和扩展

## 📁 项目结构

```
WebRecorder/
├── WebRecorder.html              # 主页面（Web版）
├── WebRecorder-v1.html           # 早期版本
├── video-comparison-demo.html    # 视频对比分析器演示页面
├── electron-app.js              # Electron主进程
├── preload.js                   # Electron预加载脚本
├── native-processor.js          # 原生FFmpeg处理器
├── app.js                       # 应用程序逻辑
├── recorder-core.js             # 录制核心功能
├── video-editor.js              # 视频编辑器
├── video-comparison.js          # 视频对比核心逻辑
├── video-comparison-ui.js       # 视频对比UI组件
├── video-comparison-helper.js   # 视频对比助手类
├── web-bridge.js                # Web桥接模块
├── styles.css                   # 样式文件
├── package.json                 # Node.js依赖配置
├── ELECTRON_SETUP.md            # Electron打包说明
└── README.md                    # 项目说明
```

## 🎯 核心功能模块

### 1. 录制模块 (recorder-core.js)
- 屏幕捕获API集成
- 录制状态管理
- 媒体流处理
- 录制文件生成

### 2. 视频编辑器 (video-editor.js)
- 时间轴滑块实现
- 拖拽事件处理
- 视频裁剪逻辑
- 实时预览功能
- 多处理引擎支持（原生FFmpeg + FFmpeg.wasm + Web API）
- 智能码率控制和动态计算
- 统一耗时统计和性能监控
- 视频对比功能集成

### 3. 视频对比模块
- **video-comparison.js**: 核心对比逻辑，支持FFmpeg分析
- **video-comparison-ui.js**: UI组件，提供用户友好的界面
- **video-comparison-helper.js**: 助手类，简化API使用，美化弹窗UI

### 4. Electron桌面应用
- **electron-app.js**: Electron主进程，原生FFmpeg集成
- **preload.js**: 安全桥接，暴露API给渲染进程
- **native-processor.js**: 独立FFmpeg处理器，支持高性能视频处理

### 5. 应用程序 (app.js)
- 用户界面控制
- 录制流程管理
- 文件下载处理
- 状态同步

## 🎮 使用方法

### Web版本
1. **启动应用**
   - 使用HTTP服务器运行（不能直接打开HTML文件）
   - 推荐使用Live Server或Python SimpleHTTPServer

2. **录制视频**
   - 点击"开始录制"按钮
   - 选择录制类型（全屏/窗口）
   - 授权屏幕录制权限

3. **编辑视频**
   - 录制完成后进入编辑模式
   - 拖拽时间轴滑块调整裁剪范围
   - 选择质量等级（原始/高/中/低）
   - 实时预览裁剪效果

4. **处理视频**
   - 点击"开始处理"按钮
   - 系统自动选择最佳处理引擎
   - 实时显示处理进度和耗时统计

5. **下载和对比**
   - 点击"下载视频"获取处理后的文件
   - 点击"📊 对比分析"查看质量分析
   - 查看美化的对比结果弹窗

### Electron桌面版
1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动应用**
   ```bash
   npm start
   # 或
   npx electron .
   ```

3. **使用功能**
   - 享受原生FFmpeg的高性能处理
   - 支持更大的视频文件
   - 更快的处理速度
   - 完整的桌面应用体验

## 🔧 FFmpeg.wasm 使用说明

### 为什么需要FFmpeg.wasm？

FFmpeg.wasm提供了强大的客户端视频处理能力，支持：
- 高质量视频编码/解码
- 精确的时间轴裁剪
- 多种视频格式支持
- 专业的视频处理算法

### FFmpeg使用失败的原因

#### 1. 协议限制问题
**问题**：通过`file://`协议直接打开HTML文件时，FFmpeg.wasm无法正常工作
**原因**：浏览器安全限制，不允许在`file://`协议下创建Web Worker
**错误信息**：`Failed to construct 'Worker': Script cannot be accessed from origin 'null'`

#### 2. CORS跨域问题
**问题**：动态导入本地模块时出现CORS错误
**原因**：当脚本从CDN加载时，相对路径的动态导入会失败
**错误信息**：`Failed to resolve module specifier './video-comparison.js'. The base URL is about:blank`

#### 3. CDN网络问题
**问题**：FFmpeg核心文件加载失败
**原因**：网络连接问题或CDN不可用
**错误信息**：`网络连接失败，请检查网络后重试`

### 正确的使用方法

#### 方法一：HTTP服务器（推荐）
```bash
# 启动本地HTTP服务器
cd /path/to/WebRecorder
python3 -m http.server 8080

# 然后访问
http://localhost:8080/WebRecorder.html
```

#### 方法二：直接文件访问（受限功能）
- 直接拖拽HTML文件到浏览器
- FFmpeg功能不可用，自动切换到Web API备用方案
- 基本视频编辑功能仍然可用

### FFmpeg功能状态检测

系统会自动检测FFmpeg可用性：
- ✅ **HTTP访问**：FFmpeg.wasm完全可用，支持高质量视频处理
- ⚠️ **文件访问**：自动切换到Web API备用方案，基本功能可用

## 📊 视频对比功能

### 功能特点
- **自动对比**：一键对比原视频和处理后的视频
- **详细分析**：分辨率、码率、文件大小等参数对比
- **质量评估**：智能质量评分和优化建议
- **可视化结果**：直观的对比结果展示

### 使用方法

#### 在WebRecorder中使用
1. 上传视频并完成处理
2. 点击"📊 对比分析"按钮
3. 系统自动对比两个文件
4. 查看详细的分析报告

#### 独立使用对比功能
1. 打开 `video-comparison-demo.html`
2. 分别选择原视频和新视频文件
3. 点击"开始对比分析"
4. 查看详细的分析结果

### 对比分析指标
- **基础指标**：分辨率、文件大小、码率
- **质量指标**：质量保持度、视觉质量评分
- **效率指标**：压缩效率、质量损失评估
- **智能建议**：基于分析结果的优化建议

## 🔧 开发说明

### 本地运行
1. 克隆项目到本地
2. **必须使用HTTP服务器运行**（不能直接打开HTML文件）
3. 推荐使用Live Server或Python SimpleHTTPServer

```bash
# 使用Python启动HTTP服务器
python3 -m http.server 8080

# 使用Node.js启动HTTP服务器
npx http-server -p 8080

# 使用Live Server（VS Code扩展）
# 右键HTML文件 -> "Open with Live Server"
```

### 浏览器兼容性
- Chrome 72+
- Firefox 66+
- Safari 13+
- Edge 79+

### 注意事项
- **必须使用HTTP服务器**：直接打开HTML文件会导致FFmpeg.wasm无法工作
- **HTTPS环境**：生产环境需要HTTPS才能使用屏幕录制API
- **权限授权**：某些浏览器可能需要用户手动授权屏幕录制权限
- **网络连接**：需要网络连接来加载FFmpeg.wasm核心文件

## 📝 更新日志

### v4.0.0 (当前版本)
- ✅ **Electron桌面应用**：跨平台桌面应用支持
- ✅ **原生FFmpeg集成**：高性能视频处理，支持大文件
- ✅ **智能码率控制**：根据分辨率动态计算最佳码率
- ✅ **多质量等级**：原始/高/中/低质量选择
- ✅ **统一耗时统计**：完整的性能监控和耗时分析
- ✅ **美化对比弹窗**：现代化UI设计，毛玻璃效果
- ✅ **自定义滚动条**：美化的滚动条样式
- ✅ **多处理引擎**：原生FFmpeg + FFmpeg.wasm + Web API
- ✅ **智能降级**：自动选择最佳处理方案
- ✅ **性能优化**：临时文件管理，内存优化

### v3.0.0
- ✅ 集成FFmpeg.wasm视频处理
- ✅ 添加视频对比分析功能
- ✅ 实现智能协议检测和优雅降级
- ✅ 解决CORS动态导入问题
- ✅ 优化错误处理和用户提示
- ✅ 完善模块化架构

### v2.0.0
- ✅ 优化拖拽性能
- ✅ 添加响应式设计
- ✅ 完善用户体验

### v1.0.0
- ✅ 完成屏幕录制功能
- ✅ 实现视频编辑器
- ✅ 基础功能实现

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 📄 许可证

MIT License

---

**WebRecorder** - 让屏幕录制和视频编辑变得简单高效！