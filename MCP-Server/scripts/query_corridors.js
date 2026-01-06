/**
 * 查询所有走廊房间及其相关墙体防火信息
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8999');

ws.on('open', function () {
    console.log('=== 查询走廊及防火规范信息 ===\n');

    // 先查询所有房间
    const command = {
        CommandName: 'get_rooms',
        Parameters: {},
        RequestId: 'get_rooms_' + Date.now()
    };

    ws.send(JSON.stringify(command));
});

let step = 1;
let corridors = [];

ws.on('message', function (data) {
    const response = JSON.parse(data.toString());

    if (step === 1) {
        // 处理房间查询结果
        if (response.Success && response.Data && response.Data.Rooms) {
            console.log('找到', response.Data.Rooms.length, '个房间\n');

            // 筛选走廊
            corridors = response.Data.Rooms.filter(room =>
                room.Name && (
                    room.Name.includes('走廊') ||
                    room.Name.toLowerCase().includes('corridor') ||
                    room.Name.includes('廊道')
                )
            );

            console.log('=== 走廊列表 ===');
            if (corridors.length > 0) {
                corridors.forEach((room, index) => {
                    console.log(`\n[${index + 1}] ${room.Name}`);
                    console.log(`    ID: ${room.ElementId}`);
                    console.log(`    楼层: ${room.Level || 'N/A'}`);
                    console.log(`    面积: ${room.Area ? (room.Area / 1000000).toFixed(2) + ' m²' : 'N/A'}`);
                    if (room.BoundingBox) {
                        console.log(`    边界: (${room.BoundingBox.MinX?.toFixed(0)}, ${room.BoundingBox.MinY?.toFixed(0)}) - (${room.BoundingBox.MaxX?.toFixed(0)}, ${room.BoundingBox.MaxY?.toFixed(0)})`);
                    }
                });

                // 查询第一个走廊的边界墙
                step = 2;
                const firstCorridor = corridors[0];
                console.log('\n\n=== 查询「' + firstCorridor.Name + '」周围墙体防火信息 ===\n');

                const wallCommand = {
                    CommandName: 'get_room_boundaries',
                    Parameters: {
                        roomId: firstCorridor.ElementId
                    },
                    RequestId: 'get_boundaries_' + Date.now()
                };
                ws.send(JSON.stringify(wallCommand));
            } else {
                console.log('未找到走廊房间');

                // 列出所有房间名称供参考
                console.log('\n所有房间名称:');
                response.Data.Rooms.forEach(room => {
                    console.log(`  - ${room.Name} (Level: ${room.Level || 'N/A'})`);
                });
                ws.close();
            }
        } else {
            console.log('查询房间失败:', response.Error || '未知错误');
            ws.close();
        }
    } else if (step === 2) {
        // 处理边界墙查询结果
        if (response.Success && response.Data) {
            console.log('找到边界元素:');

            if (response.Data.Boundaries && response.Data.Boundaries.length > 0) {
                console.log('\n=== 边界墙防火信息 ===');
                response.Data.Boundaries.forEach((boundary, index) => {
                    console.log(`\n[${index + 1}] ${boundary.Name || 'Wall'}`);
                    console.log(`    ID: ${boundary.ElementId}`);
                    console.log(`    类型: ${boundary.Category || boundary.WallType || 'N/A'}`);

                    // 防火相关参数
                    if (boundary.FireRating) {
                        console.log(`    🔥 防火时效: ${boundary.FireRating}`);
                    }
                    if (boundary.Parameters) {
                        const fireParam = boundary.Parameters.find(p =>
                            p.Name && (
                                p.Name.includes('防火') ||
                                p.Name.includes('Fire') ||
                                p.Name.includes('防烟') || p.Name.includes('防\u7159')
                            )
                        );
                        if (fireParam) {
                            console.log(`    🔥 ${fireParam.Name}: ${fireParam.Value}`);
                        }
                    }
                });
            }

            if (response.Data.Walls && response.Data.Walls.length > 0) {
                console.log('\n=== 墙体详细信息 ===');
                response.Data.Walls.forEach((wall, index) => {
                    console.log(`\n[${index + 1}] ${wall.Name || wall.WallType || 'Wall'}`);
                    console.log(`    ID: ${wall.ElementId}`);
                    console.log(`    厚度: ${wall.Thickness ? wall.Thickness + ' mm' : 'N/A'}`);
                    console.log(`    长度: ${wall.Length ? wall.Length + ' mm' : 'N/A'}`);
                    if (wall.FireRating) {
                        console.log(`    🔥 防火时效: ${wall.FireRating}`);
                    }
                });
            }
        } else {
            console.log('查询边界失败:', response.Error || '尝试其他方法...');

            // 尝试直接查询墙体
            step = 3;
            const queryCommand = {
                CommandName: 'query_elements',
                Parameters: {
                    category: 'Walls',
                    includeParameters: true
                },
                RequestId: 'query_walls_' + Date.now()
            };
            ws.send(JSON.stringify(queryCommand));
        }
    } else if (step === 3) {
        // 处理墙体查询结果
        if (response.Success && response.Data) {
            console.log('\n=== 所有墙体防火信息 ===');
            const walls = response.Data.Elements || response.Data.Walls || [];

            walls.forEach((wall, index) => {
                // 检查是否有防火相关参数
                let fireInfo = 'N/A';
                if (wall.Parameters) {
                    for (const param of wall.Parameters) {
                        if (param.Name && (
                            param.Name.includes('防火') ||
                            param.Name.includes('Fire') ||
                            param.Name.includes('防烟') || param.Name.includes('防\u7159') ||
                            param.Name.includes('s_CW')
                        )) {
                            fireInfo = `${param.Name}: ${param.Value}`;
                            break;
                        }
                    }
                }

                if (fireInfo !== 'N/A' || index < 10) {
                    console.log(`\n[${wall.ElementId}] ${wall.Name || wall.WallType || 'Wall'}`);
                    console.log(`    🔥 防火信息: ${fireInfo}`);
                }
            });
        }
        ws.close();
    }
});

ws.on('error', function (error) {
    console.error('连接错误:', error.message);
    console.error('\n请确认:');
    console.error('1. Revit 已开启并载入项目');
    console.error('2. 已点击 Add-ins > MCP Tools > 「MCP 服务 (开/关)」启动服务');
});

ws.on('close', function () {
    process.exit(0);
});

setTimeout(() => {
    console.log('\n⏱️  查询超时（30秒）');
    process.exit(1);
}, 30000);
