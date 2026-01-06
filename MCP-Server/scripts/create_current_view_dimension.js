/**
 * 在当前视图建立走廊尺寸标注
 * 自动侦测当前视图的楼层，查询走廊并建立标注
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8999');

let step = 1;
let activeViewId = null;
let currentLevel = null;
let corridors = [];

ws.on('open', function () {
    console.log('=== 在当前视图建立走廊尺寸标注 ===\n');

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
            currentLevel = response.Data.LevelName || response.Data.Level || '3FL';

            console.log(`📍 当前视图: ${response.Data.Name}`);
            console.log(`   视图 ID: ${activeViewId}`);
            console.log(`   视图类型: ${response.Data.ViewType}`);
            console.log(`   楼层: ${currentLevel}`);

            // Step 2: 查询该楼层的房间
            step = 2;
            console.log(`\n--- 查询 ${currentLevel} 楼层的走廊 ---\n`);

            const roomsCommand = {
                CommandName: 'get_rooms_by_level',
                Parameters: {
                    level: currentLevel,
                    includeUnnamed: true
                },
                RequestId: 'get_rooms_' + Date.now()
            };
            ws.send(JSON.stringify(roomsCommand));
        } else {
            console.log('获取视图失败:', response.Error);
            ws.close();
        }
    } else if (step === 2) {
        // 处理房间列表
        if (response.Success && response.Data) {
            const rooms = response.Data.Rooms || response.Data;
            console.log(`找到 ${rooms.length} 个房间`);

            // 筛选走廊
            corridors = rooms.filter(room =>
                room.Name && (
                    room.Name.includes('走廊') ||
                    room.Name.toLowerCase().includes('corridor') ||
                    room.Name.includes('\u5eca\u4e0b') ||
                    room.Name.includes('廊')
                )
            );

            if (corridors.length > 0) {
                console.log(`\n找到 ${corridors.length} 个走廊:`);
                corridors.forEach((c, i) => {
                    console.log(`  [${i + 1}] ${c.Name} (ID: ${c.ElementId})`);
                });

                // 查询第一个走廊的详细信息
                step = 3;
                console.log(`\n--- 获取「${corridors[0].Name}」详细信息 ---`);

                const roomInfoCommand = {
                    CommandName: 'get_room_info',
                    Parameters: {
                        roomId: corridors[0].ElementId
                    },
                    RequestId: 'get_room_' + Date.now()
                };
                ws.send(JSON.stringify(roomInfoCommand));
            } else {
                console.log('\n❌ 该楼层没有找到走廊');
                console.log('所有房间:');
                rooms.forEach(r => console.log(`  - ${r.Name || '(未命名)'}`));
                ws.close();
            }
        } else {
            console.log('查询房间失败:', response.Error);
            ws.close();
        }
    } else if (step === 3) {
        // 处理房间详细信息
        let boundingBox = null;

        if (response.Success && response.Data && response.Data.BoundingBox) {
            boundingBox = response.Data.BoundingBox;
            console.log(`\n边界盒:`);
            console.log(`  Min: (${boundingBox.MinX?.toFixed(0)}, ${boundingBox.MinY?.toFixed(0)})`);
            console.log(`  Max: (${boundingBox.MaxX?.toFixed(0)}, ${boundingBox.MaxY?.toFixed(0)})`);
        } else {
            // 如果没有边界盒，使用默认坐标
            console.log('⚠️ 无法取得边界盒，尝试使用查询墙体...');
            step = 4;
            const wallCommand = {
                CommandName: 'query_walls_by_location',
                Parameters: {
                    x: 0,
                    y: 15000,
                    searchRadius: 10000,
                    level: currentLevel
                },
                RequestId: 'query_walls_' + Date.now()
            };
            ws.send(JSON.stringify(wallCommand));
            return;
        }

        // 建立尺寸标注
        if (boundingBox) {
            const width = Math.abs(boundingBox.MaxY - boundingBox.MinY);
            const length = Math.abs(boundingBox.MaxX - boundingBox.MinX);

            console.log(`\n📐 走廊尺寸:`);
            console.log(`   宽度: ${width.toFixed(0)} mm (${(width / 1000).toFixed(2)} m)`);
            console.log(`   长度: ${length.toFixed(0)} mm (${(length / 1000).toFixed(2)} m)`);

            // Step 4: 建立宽度标注
            step = 4;
            console.log('\n--- 建立宽度标注 ---');

            const widthDimCommand = {
                CommandName: 'create_dimension',
                Parameters: {
                    viewId: activeViewId,
                    startX: boundingBox.MinX - 500,
                    startY: boundingBox.MinY,
                    endX: boundingBox.MinX - 500,
                    endY: boundingBox.MaxY,
                    offset: 1000
                },
                RequestId: 'dim_width_' + Date.now()
            };

            // 保存边界盒供后续使用
            ws.boundingBox = boundingBox;
            ws.send(JSON.stringify(widthDimCommand));
        }
    } else if (step === 4) {
        // 处理宽度标注结果
        if (response.Success) {
            console.log('✅ 宽度标注建立成功！', response.Data?.DimensionId ? `ID: ${response.Data.DimensionId}` : '');
        } else {
            console.log('❌ 宽度标注失败:', response.Error);
        }

        // Step 5: 建立长度标注
        if (ws.boundingBox) {
            step = 5;
            console.log('\n--- 建立长度标注 ---');

            const lengthDimCommand = {
                CommandName: 'create_dimension',
                Parameters: {
                    viewId: activeViewId,
                    startX: ws.boundingBox.MinX,
                    startY: ws.boundingBox.MinY - 500,
                    endX: ws.boundingBox.MaxX,
                    endY: ws.boundingBox.MinY - 500,
                    offset: 1000
                },
                RequestId: 'dim_length_' + Date.now()
            };
            ws.send(JSON.stringify(lengthDimCommand));
        } else {
            ws.close();
        }
    } else if (step === 5) {
        // 处理长度标注结果
        if (response.Success) {
            console.log('✅ 长度标注建立成功！', response.Data?.DimensionId ? `ID: ${response.Data.DimensionId}` : '');
        } else {
            console.log('❌ 长度标注失败:', response.Error);
        }

        // 完成
        console.log('\n=== 标注完成 ===');
        console.log('\n💡 请在 Revit 视图中查看新建立的尺寸标注');

        // 防火规范提醒
        const width = Math.abs(ws.boundingBox.MaxY - ws.boundingBox.MinY);
        console.log('\n🔥 防火规范检查:');
        if (width >= 1600) {
            console.log(`   ✅ 走廊净宽 ${(width / 1000).toFixed(2)}m ≥ 1.6m (符合医院/疗养院规定)`);
        } else if (width >= 1200) {
            console.log(`   ✅ 走廊净宽 ${(width / 1000).toFixed(2)}m ≥ 1.2m (符合一般建筑物规定)`);
        } else {
            console.log(`   ❌ 走廊净宽 ${(width / 1000).toFixed(2)}m < 1.2m (不符合规定)`);
        }

        ws.close();
    }
});

ws.on('error', function (error) {
    console.error('连接错误:', error.message);
    console.error('\n请确认 Revit MCP 服务已启动');
});

ws.on('close', function () {
    process.exit(0);
});

setTimeout(() => {
    console.log('\n⏱️  操作超时（30秒）');
    process.exit(1);
}, 30000);
