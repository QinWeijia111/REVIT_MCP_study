/**
 * 正确的走廊尺寸标注流程
 * 展示正确的工具调用优先级
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8999');

let currentStep = 0;
let viewId, roomCenter, walls;

ws.on('open', function () {
    console.log('=== 正确的走廊尺寸标注流程 ===\n');
    executeStep1();
});

// Step 1: 获取视图（用于标注）
function executeStep1() {
    currentStep = 1;
    console.log('[Step 1] 获取当前视图...');
    
    ws.send(JSON.stringify({
        CommandName: 'get_active_view',
        Parameters: {},
        RequestId: 'step1_' + Date.now()
    }));
}

// Step 2: 获取走廊房间信息（只为了中心点）
function executeStep2() {
    currentStep = 2;
    console.log('[Step 2] 获取走廊房间中心点（房间ID: 52842719）...');
    console.log('   ⚠️  注意: BoundingBox 不用于尺寸标注！');
    
    ws.send(JSON.stringify({
        CommandName: 'get_room_info',
        Parameters: {
            roomId: 52842719  // 2FL 走廊
        },
        RequestId: 'step2_' + Date.now()
    }));
}

// Step 3: 查询实际墙体（这是关键步骤）
function executeStep3() {
    currentStep = 3;
    console.log('[Step 3] 🎯 查询实际墙体坐标（这是尺寸标注的依据）...');
    console.log(`   搜索中心: (${roomCenter.x}, ${roomCenter.y})`);
    
    ws.send(JSON.stringify({
        CommandName: 'query_walls_by_location',
        Parameters: {
            x: roomCenter.x,
            y: roomCenter.y,
            searchRadius: 3000,
            level: '2FL'
        },
        RequestId: 'step3_' + Date.now()
    }));
}

// Step 4: 用墙体面坐标建立尺寸标注
function executeStep4() {
    currentStep = 4;
    
    // 找出垂直墙（平行于走廊长度）
    const verticalWalls = walls.filter(w => w.Orientation === 'Vertical');
    
    if (verticalWalls.length < 2) {
        console.error('❌ 找不到足够的垂直墙体');
        ws.close();
        return;
    }
    
    // 按距离排序，取最近的两面
    verticalWalls.sort((a, b) => a.DistanceToCenter - b.DistanceToCenter);
    
    const wall1 = verticalWalls[0];
    const wall2 = verticalWalls[1];
    
    // 判断哪个面朝向走廊（选择较接近走廊中心的面）
    const centerY = roomCenter.y;
    const wall1FaceY = Math.abs(wall1.Face1.Y - centerY) < Math.abs(wall1.Face2.Y - centerY) 
        ? wall1.Face1.Y : wall1.Face2.Y;
    const wall2FaceY = Math.abs(wall2.Face1.Y - centerY) < Math.abs(wall2.Face2.Y - centerY) 
        ? wall2.Face1.Y : wall2.Face2.Y;
    
    const corridorWidth = Math.abs(wall1FaceY - wall2FaceY);
    
    console.log('[Step 4] 建立尺寸标注（使用墙体内表面）...');
    console.log(`   墙1 内表面 Y: ${wall1FaceY.toFixed(2)} mm`);
    console.log(`   墙2 内表面 Y: ${wall2FaceY.toFixed(2)} mm`);
    console.log(`   📏 走廊净宽: ${corridorWidth.toFixed(2)} mm`);
    console.log('');
    console.log('   ✅ 使用 Wall Face (正确)');
    console.log('   ❌ 不使用 BoundingBox (错误)');
    
    // 建立尺寸标注（净宽）
    ws.send(JSON.stringify({
        CommandName: 'create_dimension',
        Parameters: {
            viewId: viewId,
            startX: roomCenter.x,
            startY: Math.min(wall1FaceY, wall2FaceY),
            endX: roomCenter.x,
            endY: Math.max(wall1FaceY, wall2FaceY),
            offset: 1200  // 较近的标注线（净宽）
        },
        RequestId: 'step4_' + Date.now()
    }));
}

// Step 5: 建立结构中心线尺寸标注（参考用）
function executeStep5() {
    currentStep = 5;
    
    const verticalWalls = walls.filter(w => w.Orientation === 'Vertical');
    verticalWalls.sort((a, b) => a.DistanceToCenter - b.DistanceToCenter);
    
    const wall1 = verticalWalls[0];
    const wall2 = verticalWalls[1];
    
    // 使用位置线（中心线）
    const wall1CenterY = wall1.ClosestPoint.Y;  // 或 LocationLine 的 Y
    const wall2CenterY = wall2.ClosestPoint.Y;
    
    console.log('[Step 5] 建立参考尺寸标注（结构中心线）...');
    console.log(`   墙1 中心线 Y: ${wall1CenterY.toFixed(2)} mm`);
    console.log(`   墙2 中心线 Y: ${wall2CenterY.toFixed(2)} mm`);
    
    ws.send(JSON.stringify({
        CommandName: 'create_dimension',
        Parameters: {
            viewId: viewId,
            startX: roomCenter.x,
            startY: Math.min(wall1CenterY, wall2CenterY),
            endX: roomCenter.x,
            endY: Math.max(wall1CenterY, wall2CenterY),
            offset: 2000  // 较远的标注线（结构尺寸）
        },
        RequestId: 'step5_' + Date.now()
    }));
}

ws.on('message', function (data) {
    const response = JSON.parse(data.toString());
    
    if (!response.Success) {
        console.error(`❌ Step ${currentStep} 失败:`, response.Error);
        ws.close();
        return;
    }
    
    switch (currentStep) {
        case 1:
            viewId = response.Data.ElementId;
            console.log(`   ✓ 视图: ${response.Data.Name} (ID: ${viewId})\n`);
            executeStep2();
            break;
            
        case 2:
    roomCenter = {
        x: response.Data.CenterX,
        y: response.Data.CenterY
    };
    console.log(`   ✓ 中心点: (${roomCenter.x}, ${roomCenter.y})`);
    console.log(`   ℹ️  BoundingBox: MinY=${response.Data.BoundingBox.MinY}, MaxY=${response.Data.BoundingBox.MaxY}`);
    console.log(`   ℹ️  BoundingBox 宽度: ${response.Data.BoundingBox.MaxY - response.Data.BoundingBox.MinY} mm`);
    console.log(`   ⚠️  注意: 这个宽度不精确，仅供参考！\n`);
            executeStep3();
            break;
            
        case 3:
            walls = response.Data.Walls;
            console.log(`   ✓ 找到 ${walls.length} 面墙体`);
            
            // 显示墙体信息
            walls.forEach((wall, i) => {
                if (i < 3) {  // 只显示前 3 面
                    console.log(`   - 墙 ${i+1}: ${wall.Name}, 距离=${wall.DistanceToCenter.toFixed(0)}mm, 方向=${wall.Orientation}`);
                }
            });
            console.log('');
            executeStep4();
            break;
            
        case 4:
            console.log(`   ✓ 净宽标注已建立 (ID: ${response.Data.DimensionId})`);
            console.log(`   测量值: ${response.Data.Value} mm\n`);
            executeStep5();
            break;
            
        case 5:
    console.log(`   ✓ 结构中心线标注已建立 (ID: ${response.Data.DimensionId})`);
    console.log(`   测量值: ${response.Data.Value} mm\n`);
    
    console.log('=================================');
    console.log('✅ 所有步骤完成！');
    console.log('=================================');
    console.log('\n📌 重点总结:');
    console.log('1. BoundingBox 只用来找中心点，不用于尺寸');
    console.log('2. query_walls_by_location 是尺寸标注的关键');
    console.log('3. 使用 Wall Face 坐标才是正确的净宽');
    console.log('4. 两条标注线：净宽（法规）+ 中心线（参考）');
    
    ws.close();
    break;
    }
});

ws.on('error', function (error) {
    console.error('连接错误:', error.message);
    console.error('\n请确认:');
    console.error('1. Revit 已开启 2FL 平面图');
    console.error('2. MCP Plugin 服务已启动');
});

ws.on('close', function () {
    process.exit(currentStep === 5 ? 0 : 1);
});

setTimeout(() => {
    console.log('\n⏱️  执行超时（30秒）');
    process.exit(1);
}, 30000);
