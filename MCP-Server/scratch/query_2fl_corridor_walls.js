/**
 * 查询 2FL 走廊附近的墙体
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8999');

ws.on('open', function () {
    console.log('=== 查询 2FL 走廊周围墙体 ===');

    // 走廊中心点: (16394.8, 14334.22)
    const command = {
        CommandName: 'query_walls_by_location',
        Parameters: {
            x: 16394.8,
            y: 14334.22,
            searchRadius: 3000,  // 3 米搜索半径
            level: '2FL'
        },
        RequestId: 'query_corridor_walls_' + Date.now()
    };

    ws.send(JSON.stringify(command));
});

ws.on('message', function (data) {
    const response = JSON.parse(data.toString());

    if (response.Success) {
        console.log('\n找到', response.Data.Count, '面墙体');
        console.log('搜索中心:', response.Data.SearchCenter);
        console.log('搜索半径:', response.Data.SearchRadius, 'mm');

        console.log('\n墙体列表:');
        response.Data.Walls.forEach((wall, index) => {
            console.log(`\n[${index + 1}] 墙 ID: ${wall.ElementId}`);
            console.log(`    名称: ${wall.Name}`);
            console.log(`    类型: ${wall.WallType}`);
            console.log(`    厚度: ${wall.Thickness} mm`);
            console.log(`    长度: ${wall.Length} mm`);
            console.log(`    距离中心: ${wall.DistanceToCenter} mm`);
            console.log(`    方向: ${wall.Orientation}`);
            console.log(`    位置线: (${wall.LocationLine.StartX}, ${wall.LocationLine.StartY}) → (${wall.LocationLine.EndX}, ${wall.LocationLine.EndY})`);
            console.log(`    内侧面1: (${wall.Face1.X}, ${wall.Face1.Y})`);
            console.log(`    内侧面2: (${wall.Face2.X}, ${wall.Face2.Y})`);
        });

        // 找出垂直方向（与走廊长度平行的墙）
        const verticalWalls = response.Data.Walls.filter(w => w.Orientation === 'Vertical');
        console.log('\n=== 走廊两侧的垂直墙（可能） ===');
        
        if (verticalWalls.length >= 2) {
            // 按距离排序，取最近的两面
            verticalWalls.sort((a, b) => a.DistanceToCenter - b.DistanceToCenter);
            
            console.log('\n最接近的两面墙:');
            verticalWalls.slice(0, 2).forEach((wall, i) => {
                console.log(`\n墙 ${i + 1}: ID ${wall.ElementId}`);
                console.log(`  内侧面1 Y坐标: ${wall.Face1.Y}`);
                console.log(`  内侧面2 Y坐标: ${wall.Face2.Y}`);
            });

            // 计算净宽（使用面向走廊的面）
            const wall1 = verticalWalls[0];
            const wall2 = verticalWalls[1];
            
            // 判断哪个面朝向走廊
            const centerY = 14334.22;
            const wall1Face = Math.abs(wall1.Face1.Y - centerY) < Math.abs(wall1.Face2.Y - centerY) ? wall1.Face1.Y : wall1.Face2.Y;
            const wall2Face = Math.abs(wall2.Face1.Y - centerY) < Math.abs(wall2.Face2.Y - centerY) ? wall2.Face1.Y : wall2.Face2.Y;
            
            const corridorWidth = Math.abs(wall1Face - wall2Face);
            console.log(`\n\n🎯 计算的走廊净宽: ${corridorWidth.toFixed(2)} mm`);
            console.log(`   墙1 内表面 Y: ${wall1Face.toFixed(2)}`);
            console.log(`   墙2 内表面 Y: ${wall2Face.toFixed(2)}`);
        }

    } else {
        console.log('查询失败:', response.Error);
    }

    ws.close();
});

ws.on('error', function (error) {
    console.error('连接错误:', error.message);
    console.error('请确认:');
    console.error('1. Revit 已开启');
    console.error('2. MCP Plugin 已启动服务（点击「MCP 服务 开/关」按钮）');
});

ws.on('close', function () {
    process.exit(0);
});

setTimeout(() => {
    console.log('\n⏱️  查询超时（15秒）');
    process.exit(1);
}, 15000);
