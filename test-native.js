// 测试原生FFmpeg性能
const NativeVideoProcessor = require('./native-processor');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function testNativePerformance() {
    console.log('🧪 开始测试原生FFmpeg性能...\n');
    
    const processor = new NativeVideoProcessor();
    
    // 检查FFmpeg
    const hasFFmpeg = await processor.checkFFmpeg();
    if (!hasFFmpeg) {
        console.log('❌ FFmpeg不可用，请先安装FFmpeg');
        return;
    }
    
    console.log('✅ FFmpeg可用，开始性能测试\n');
    
    // 创建一个测试视频文件（如果不存在）
    const testVideoPath = './test-video.mp4';
    const outputPath = './test-output.mp4';
    
    if (!fs.existsSync(testVideoPath)) {
        console.log('📹 创建测试视频文件...');
        // 使用FFmpeg创建一个简单的测试视频
        const createTestVideo = spawn('ffmpeg', [
            '-f', 'lavfi',
            '-i', 'testsrc=duration=10:size=1280x720:rate=30',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-y',
            testVideoPath
        ]);
        
        await new Promise((resolve, reject) => {
            createTestVideo.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ 测试视频创建完成\n');
                    resolve();
                } else {
                    reject(new Error('创建测试视频失败'));
                }
            });
        });
    }
    
    // 测试不同质量设置的处理速度
    const testCases = [
        { quality: 'high', crf: '18', preset: 'fast' },
        { quality: 'medium', crf: '23', preset: 'faster' },
        { quality: 'low', crf: '28', preset: 'veryfast' }
    ];
    
    console.log('🚀 开始性能测试...\n');
    
    for (const testCase of testCases) {
        console.log(`📊 测试 ${testCase.quality} 质量 (CRF: ${testCase.crf}, Preset: ${testCase.preset})`);
        
        const startTime = Date.now();
        
        try {
            const result = await processor.processVideo(testVideoPath, outputPath, {
                startTime: 2,
                duration: 5,
                crf: testCase.crf,
                preset: testCase.preset
            });
            
            const totalTime = Date.now() - startTime;
            const speedRatio = 5 / (totalTime / 1000); // 5秒视频的处理速度
            
            console.log(`✅ 处理完成:`);
            console.log(`   耗时: ${(totalTime / 1000).toFixed(2)}秒`);
            console.log(`   速度: ${speedRatio.toFixed(2)}x (${speedRatio > 1 ? '实时' : '慢于实时'})`);
            console.log(`   输出文件: ${result.outputPath}\n`);
            
            // 清理输出文件
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            
        } catch (error) {
            console.error(`❌ 测试失败: ${error.message}\n`);
        }
    }
    
    // 清理测试视频
    if (fs.existsSync(testVideoPath)) {
        fs.unlinkSync(testVideoPath);
        console.log('🧹 清理测试文件完成');
    }
    
    console.log('\n🎉 性能测试完成！');
    console.log('💡 原生FFmpeg通常比FFmpeg.wasm快5-10倍');
}

// 运行测试
testNativePerformance().catch(console.error);