/**
 * 查询走廊尺寸及防火规范信息 (支持日文命名)
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8999');

ws.on('open', function () {
    console.log('=== 查询走廊尺寸及防火规范信息 ===\n');

    // 获取楼层列表
    const command = {
        CommandName: 'get_all_levels',
        Parameters: {},
        RequestId: 'get_levels_' + Date.now()
    };

    ws.send(JSON.stringify(command));
});

let step = 1;
let levels = [];
let selectedLevel = '1FL';
let corridorIds = [];

ws.on('message', function (data) {
    const response = JSON.parse(data.toString());

    if (step === 1) {
        // 处理楼层列表
        if (response.Success && response.Data) {
            levels = response.Data.Levels || response.Data;
            console.log('楼层列表:');
            levels.forEach(level => {
                console.log(`  ${level.Name} (标高: ${level.Elevation} mm)`);
            });

            step = 2;
            const roomsCommand = {
                CommandName: 'get_rooms_by_level',
                Parameters: {
                    level: selectedLevel,
                    includeUnnamed: true
                },
                RequestId: 'get_rooms_' + Date.now()
            };
            ws.send(JSON.stringify(roomsCommand));
        } else {
            console.log('查询楼层失败:', response.Error);
            ws.close();
        }
    } else if (step === 2) {
        // 处理房间列表
        if (response.Success && response.Data) {
            const rooms = response.Data.Rooms || response.Data;
            console.log(`\n${selectedLevel} 找到 ${rooms.length} 个房间\n`);

            // 筛选走廊 (包含日文命名)
            const corridors = rooms.filter(room =>
                room.Name && (
                    room.Name.includes('走廊') ||
                    room.Name.toLowerCase().includes('corridor') ||
                    room.Name.includes('廊道') ||
                    room.Name.includes('通道') ||
                    room.Name.includes('\u5eca\u4e0b') ||  // 日文: 走廊
                    room.Name.includes('廊')      // 通用
                )
            );

            console.log('=== 走廊列表 ===');
            if (corridors.length > 0) {
                corridors.forEach((room, index) => {
                    console.log(`\n[${index + 1}] ${room.Name}`);
                    console.log(`    ID: ${room.ElementId}`);
                    console.log(`    面积: ${room.Area ? (room.Area / 1e6).toFixed(2) + ' m²' : 'N/A'}`);
                    corridorIds.push(room.ElementId);
                });

                // 查询第一个走廊的详细信息
                step = 3;
                console.log('\n\n=== 查询「' + corridors[0].Name + '」详细信息 ===\n');

                const roomInfoCommand = {
                    CommandName: 'get_room_info',
                    Parameters: {
                        roomId: corridors[0].ElementId
                    },
                    RequestId: 'get_room_info_' + Date.now()
                };
                ws.send(JSON.stringify(roomInfoCommand));
            } else {
                console.log('未找到走廊房间');
                ws.close();
            }
        } else {
            console.log('查询房间失败:', response.Error);
            ws.close();
        }
    } else if (step === 3) {
        // 处理房间详细信息
        if (response.Success && response.Data) {
            const room = response.Data;
            console.log('房间名称:', room.Name);
            console.log('面积:', room.Area ? (room.Area / 1e6).toFixed(2) + ' m²' : 'N/A');

            if (room.BoundingBox) {
                console.log('\n边界盒:');
                console.log(`  Min: (${room.BoundingBox.MinX?.toFixed(0)}, ${room.BoundingBox.MinY?.toFixed(0)})`);
                console.log(`  Max: (${room.BoundingBox.MaxX?.toFixed(0)}, ${room.BoundingBox.MaxY?.toFixed(0)})`);

                const width = Math.abs(room.BoundingBox.MaxY - room.BoundingBox.MinY);
                const length = Math.abs(room.BoundingBox.MaxX - room.BoundingBox.MinX);
                const minDim = Math.min(width, length);
                const maxDim = Math.max(width, length);

                console.log(`\n📐 估算尺寸:`);
                console.log(`   宽度: ${minDim.toFixed(0)} mm (${(minDim / 1000).toFixed(2)} m)`);
                console.log(`   长度: ${maxDim.toFixed(0)} mm (${(maxDim / 1000).toFixed(2)} m)`);

                // 防火规范检查
                console.log('\n\n🔥 === 防火规范检查 ===');
                console.log('\n【建筑技术规则 第93条】走廊净宽规定:');

                if (minDim >= 1600) {
                    console.log(`✅ 净宽 ${(minDim / 1000).toFixed(2)}m >= 1.6m`);
                    console.log('   → 符合医院、疗养院走廊规定');
                } else if (minDim >= 1200) {
                    console.log(`✅ 净宽 ${(minDim / 1000).toFixed(2)}m >= 1.2m`);
                    console.log('   → 符合一般建筑物走廊规定');
                    console.log('   → 不足医院/疗养院规定 (需1.6m)');
                } else {
                    console.log(`❌ 净宽 ${(minDim / 1000).toFixed(2)}m < 1.2m`);
                    console.log('   → 不符合建筑技术规则第93条');
                    console.log('   → 需加宽至少至 1200mm');
                }

                // 查询周围墙体
                step = 4;
                const centerX = (room.BoundingBox.MaxX + room.BoundingBox.MinX) / 2;
                const centerY = (room.BoundingBox.MaxY + room.BoundingBox.MinY) / 2;

                console.log('\n\n=== 查询周围墙体防火信息 ===');
                console.log(`搜索中心: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})\n`);

                const wallCommand = {
                    CommandName: 'query_walls_by_location',
                    Parameters: {
                        x: centerX,
                        y: centerY,
                        searchRadius: 5000,
                        level: selectedLevel
                    },
                    RequestId: 'query_walls_' + Date.now()
                };
                ws.send(JSON.stringify(wallCommand));
            } else {
                // 如果没有边界盒，直接查询墙体
                step = 4;
                const wallCommand = {
                    CommandName: 'query_elements',
                    Parameters: {
                        category: 'Walls',
                        level: selectedLevel
                    },
                    RequestId: 'query_walls_' + Date.now()
                };
                ws.send(JSON.stringify(wallCommand));
            }
        } else {
            console.log('查询房间信息失败:', response.Error);
            // 直接查询墙体参数
            step = 4;
            const wallCommand = {
                CommandName: 'query_elements',
                Parameters: {
                    category: 'Walls'
                },
                RequestId: 'query_walls_' + Date.now()
            };
            ws.send(JSON.stringify(wallCommand));
        }
    } else if (step === 4) {
        // 处理墙体查询结果
        if (response.Success && response.Data) {
            const walls = response.Data.Walls || response.Data.Elements || [];
            console.log('找到', walls.length, '面墙体');

            // 统计防火等级
            const fireRatings = {};

            console.log('\n=== 墙体防火性能分析 ===\n');

            walls.slice(0, 10).forEach((wall, index) => {
                console.log(`[${index + 1}] ${wall.Name || wall.WallType || 'Wall'} (ID: ${wall.ElementId})`);
                console.log(`    厚度: ${wall.Thickness || 'N/A'} mm`);

                // 查找防火相关参数
                let fireRating = null;
                if (wall.Parameters) {
                    for (const param of wall.Parameters) {
                        if (param.Name && (
                            param.Name.includes('防火') ||
                            param.Name.includes('Fire') ||
                            param.Name.includes('防烟') || param.Name.includes('防\u7159') ||
                            param.Name.includes('s_CW_防火')
                        )) {
                            fireRating = param.Value;
                            console.log(`    🔥 ${param.Name}: ${param.Value}`);
                        }
                    }
                }

                if (wall.FireRating) {
                    fireRating = wall.FireRating;
                    console.log(`    🔥 防火时效: ${wall.FireRating}`);
                }

                // 统计
                if (fireRating) {
                    fireRatings[fireRating] = (fireRatings[fireRating] || 0) + 1;
                }
            });

            if (walls.length > 10) {
                console.log(`\n... 还有 ${walls.length - 10} 面墙体 ...`);
            }

            // 显示防火等级统计
            const ratingKeys = Object.keys(fireRatings);
            if (ratingKeys.length > 0) {
                console.log('\n=== 防火等级统计 ===');
                ratingKeys.forEach(rating => {
                    console.log(`  ${rating}: ${fireRatings[rating]} 面墙`);
                });
            }

            // 防火规范说明
            console.log('\n\n📋 === 走廊防火规范参考 ===');
            console.log('\n【建筑技术规则 第79条】防火区划:');
            console.log('  - 走廊与居室之间应以防火门窗区隔');
            console.log('  - 防火时效至少 1 小时');
            console.log('\n【建筑技术规则 第93条】走廊净宽:');
            console.log('  - 一般建筑物: ≥ 1.2m');
            console.log('  - 医院/疗养院: ≥ 1.6m');
            console.log('  - 两侧有居室: ≥ 1.6m');
            console.log('\n【消防法】避难走廊:');
            console.log('  - 应设置紧急照明');
            console.log('  - 应设置避难方向指示');
        } else {
            console.log('查询墙体失败:', response.Error);
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
