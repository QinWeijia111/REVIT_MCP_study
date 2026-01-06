/**
 * 为走廊建立尺寸标注
 * 根据走廊边界盒坐标建立宽度和长度的尺寸标注
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8999');

// 走廊1 的边界盒信息（从上次查询结果）
const corridor = {
    name: '走廊1',
    elementId: 52936651,
    boundingBox: {
        minX: -970,
        minY: 13675,
        maxX: 4425,
        maxY: 18925
    }
};

let step = 1;
let activeViewId = null;

ws.on('open', function () {
    console.log('=== 为走廊建立尺寸标注 ===\n');
    console.log(`目标走廊: ${corridor.name} (ID: ${corridor.elementId})`);
    console.log(`边界盒: (${corridor.boundingBox.minX}, ${corridor.boundingBox.minY}) - (${corridor.boundingBox.maxX}, ${corridor.boundingBox.maxY})`);

    // Step 1: 获取当前视图
    const command = {
        CommandName: 'get_active_view',
        Parameters: {},
        RequestId: 'get_view_' + Date.now()
    };
    ws.send(JSON.stringify(command));
});

ws.on('message', function (data) {
    const response = JSON.parse(data.toString());

    if (step === 1) {
        // 处理视图信息
        if (response.Success && response.Data) {
            activeViewId = response.Data.ViewId || response.Data.ElementId;
            console.log(`\n当前视图: ${response.Data.Name} (ID: ${activeViewId})`);
            console.log(`视图类型: ${response.Data.ViewType}`);

            // Step 2: 建立宽度标注 (Y 方向)
            step = 2;
            console.log('\n--- 建立宽度标注 (Y 方向) ---');

            // 在走廊左侧建立宽度标注
            const widthDimCommand = {
                CommandName: 'create_dimension',
                Parameters: {
                    viewId: activeViewId,
                    startX: corridor.boundingBox.minX - 500,  // 偏移到走廊左边
                    startY: corridor.boundingBox.minY,
                    endX: corridor.boundingBox.minX - 500,
                    endY: corridor.boundingBox.maxY,
                    offset: 800  // 标注线偏移量
                },
                RequestId: 'dim_width_' + Date.now()
            };

            console.log(`起点: (${widthDimCommand.Parameters.startX}, ${widthDimCommand.Parameters.startY})`);
            console.log(`终点: (${widthDimCommand.Parameters.endX}, ${widthDimCommand.Parameters.endY})`);
            console.log(`预期尺寸: ${Math.abs(corridor.boundingBox.maxY - corridor.boundingBox.minY)} mm`);

            ws.send(JSON.stringify(widthDimCommand));
        } else {
            console.log('获取视图失败:', response.Error);
            ws.close();
        }
    } else if (step === 2) {
        // 处理宽度标注结果
        if (response.Success) {
            console.log('✅ 宽度标注建立成功！', response.Data?.DimensionId ? `ID: ${response.Data.DimensionId}` : '');
        } else {
            console.log('❌ 宽度标注建立失败:', response.Error);
        }

        // Step 3: 建立长度标注 (X 方向)
        step = 3;
        console.log('\n--- 建立长度标注 (X 方向) ---');

        // 在走廊的下侧建立长度标注
        const lengthDimCommand = {
            CommandName: 'create_dimension',
            Parameters: {
                viewId: activeViewId,
                startX: corridor.boundingBox.minX,
                startY: corridor.boundingBox.minY - 500,  // 偏移到走廊的下侧
                endX: corridor.boundingBox.maxX,
                endY: corridor.boundingBox.minY - 500,
                offset: 800
            },
            RequestId: 'dim_length_' + Date.now()
        };

        console.log(`起点: (${lengthDimCommand.Parameters.startX}, ${lengthDimCommand.Parameters.startY})`);
        console.log(`终点: (${lengthDimCommand.Parameters.endX}, ${lengthDimCommand.Parameters.endY})`);
        console.log(`预期尺寸: ${Math.abs(corridor.boundingBox.maxX - corridor.boundingBox.minX)} mm`);

        ws.send(JSON.stringify(lengthDimCommand));
    } else if (step === 3) {
        // 处理长度标注结果
        if (response.Success) {
            console.log('✅ 长度标注建立成功！', response.Data?.DimensionId ? `ID: ${response.Data.DimensionId}` : '');
        } else {
            console.log('❌ 长度标注建立失败:', response.Error);
        }

        // Step 4: 选择走廊元素以便检视
        step = 4;
        console.log('\n--- 选择并缩放至走廊 ---');

        const zoomCommand = {
            CommandName: 'zoom_to_element',
            Parameters: {
                elementId: corridor.elementId
            },
            RequestId: 'zoom_' + Date.now()
        };
        ws.send(JSON.stringify(zoomCommand));
    } else if (step === 4) {
        // 处理缩放结果
        if (response.Success) {
            console.log('✅ 已缩放至走廊位置');
        } else {
            console.log('⚠️ 缩放失败:', response.Error);
        }

        console.log('\n=== 标注完成 ===');
        console.log('\n📐 走廊尺寸摘要:');
        console.log(`   宽度: ${Math.abs(corridor.boundingBox.maxY - corridor.boundingBox.minY)} mm (${(Math.abs(corridor.boundingBox.maxY - corridor.boundingBox.minY) / 1000).toFixed(2)} m)`);
        console.log(`   长度: ${Math.abs(corridor.boundingBox.maxX - corridor.boundingBox.minX)} mm (${(Math.abs(corridor.boundingBox.maxX - corridor.boundingBox.minX) / 1000).toFixed(2)} m)`);
        console.log('\n💡 请在 Revit 中查看新建立的尺寸标注');

        ws.close();
    }
});

ws.on('error', function (error) {
    console.error('连接错误:', error.message);
    console.error('\n请确认:');
    console.error('1. Revit 已开启并载入项目');
    console.error('2. 已点击 Add-ins > MCP Tools > 「MCP 服务 (开/关)」启动服务');
    console.error('3. 当前视图为 1FL 平面图');
});

ws.on('close', function () {
    process.exit(0);
});

setTimeout(() => {
    console.log('\n⏱️  操作超时（30秒）');
    process.exit(1);
}, 30000);
