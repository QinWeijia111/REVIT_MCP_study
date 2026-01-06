/**
 * 1FL 走廊法规检讨与自动标注脚本
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8999');
let step = 0;
let activeViewId = null;

// 待处理的走廊清单 (从之前的查询结果得知)
const corridors = [
    { name: '走廊1', number: '121' },
    { name: '走廊2', number: '29' }
];

let currentCorridorIndex = 0;

ws.on('open', function () {
    console.log('=== 1FL 走廊法规检讨与自动标注 ===\n');
    nextStep();
});

function nextStep() {
    step++;

    // 步骤 1: 获取当前视图
    if (step === 1) {
        console.log('1. 确认当前视图...');
        ws.send(JSON.stringify({ CommandName: 'get_active_view', Parameters: {}, RequestId: 'step1' }));
    }
    // 步骤 2: 查询当前走廊信息
    else if (step === 2) {
        if (currentCorridorIndex >= corridors.length) {
            console.log('\n=== 所有走廊处理完成 ===');
            ws.close();
            return;
        }

        const corridor = corridors[currentCorridorIndex];
        console.log(`\n=== 处理走廊: ${corridor.name} [${corridor.number}] ===`);

        // 先用 query_elements 找房间 ID (因为之前的 ID 可能是动态的或需要确认)
        // 这里直接用名字找比较保险，或者如果之前 ID 是固定的话...
        // 为了保险，先 query 所有 1FL 房间再 filter
        ws.send(JSON.stringify({
            CommandName: 'get_rooms_by_level',
            Parameters: { level: '1FL' },
            RequestId: 'step2_find_room'
        }));
    }
}

ws.on('message', function (data) {
    const response = JSON.parse(data.toString());

    // 处理视图响应
    if (response.RequestId === 'step1') {
        if (response.Success) {
            activeViewId = response.Data.ElementId;
            console.log(`   使用视图: ${response.Data.Name} (ID: ${activeViewId})`);
            // 检查视图名称是否包含 1F 或 level 1 (非强制，仅提示)
            if (!response.Data.Name.includes('1') && !response.Data.LevelName?.includes('1')) {
                console.log('   ⚠️ 警告: 当前视图似乎不是一楼平面图，标注可能无法显示。');
            }
            nextStep();
        } else {
            console.log('无法获取视图，终止。');
            ws.close();
        }
    }

    // 处理房间搜索
    else if (response.RequestId === 'step2_find_room') {
        if (response.Success) {
            const targetName = corridors[currentCorridorIndex].name;
            const room = response.Data.Rooms.find(r => r.Name === targetName);

            if (room) {
                console.log(`   找到房间: ID ${room.ElementId}, 面积 ${room.Area} m²`);
                console.log(`   中心点: (${room.CenterX}, ${room.CenterY})`);

                // 保存房间信息供后续使用
                corridors[currentCorridorIndex].info = room;

                // 下一步: 查询墙体
                queryWalls(room);
            } else {
                console.log(`   ❌ 找不到房间 ${targetName}`);
                currentCorridorIndex++;
                step = 1; // 重置步骤标记以继续循环
                nextStep();
            }
        }
    }

    // 处理墙体查询
    else if (response.RequestId.startsWith('step3_walls')) {
        const index = parseInt(response.RequestId.split('_')[2]);
        processWallsAndDimension(response.Data, index);
    }

    // 处理标注创建
    else if (response.RequestId.startsWith('step4_dim')) {
        if (response.Success) {
            console.log(`   ✅ 标注创建成功 (${response.Data.Value} mm)`);
        } else {
            console.log(`   ❌ 标注创建失败: ${response.Error}`);
        }

        // 检查是否还有待处理的标注 (例如每个走廊有 2 个标注)
        // 这里简化流程：收到标注响应后，继续下一个走廊
        // 但我们发送了两个标注请求，所以需要计数器或等待机制
        // 简单起见，我们假设这是一个异步操作，继续处理下一个
        // 更好的方式是用 Promise chain，但这里用 ws callback 结构
    }
});

function queryWalls(room) {
    console.log('   查询周边墙体...');
    const radius = 5000; // 5m 搜索半径

    ws.send(JSON.stringify({
        CommandName: 'query_walls_by_location',
        Parameters: {
            x: room.CenterX,
            y: room.CenterY,
            searchRadius: radius,
            level: '1FL'
        },
        RequestId: `step3_walls_${currentCorridorIndex}`
    }));
}

function processWallsAndDimension(wallData, index) {
    if (!wallData || wallData.Count === 0) {
        console.log('   ❌ 找不到墙体，无法标注。');
        finishCorridor();
        return;
    }

    // 判断走廊方向 (水平或垂直)
    // 简单逻辑：看最近的两面墙是平行于 X 还是 Y
    // 或者看 BoundingBox 比例，但这里我们只有中心点和墙
    // 我们分析墙的 Orientation 分布

    const hWalls = wallData.Walls.filter(w => w.Orientation === 'Horizontal');
    const vWalls = wallData.Walls.filter(w => w.Orientation === 'Vertical');

    let boundaryWalls = [];
    let direction = ''; // 标注线的方向 (Horizontal: 标注 X 轴, Vertical: 标注 Y 轴... 等等，需厘清)

    // 如果水平墙比较近且成对，则走廊是东西向(水平)，宽度在 Y 方向 --> 需要 Vertical 标注线 (测量 Y 距)
    // 修正：走廊是水平长条 -> 墙在上下侧 -> 墙是 Horizontal -> 测量 Y 距离

    // 找出最近的墙
    const nearestWall = wallData.Walls[0];
    const orientation = nearestWall.Orientation; // Horizontal or Vertical

    if (orientation === 'Horizontal') {
        console.log('   判定走廊为东西向 (水平)，测量南北 (Y) 宽度');
        boundaryWalls = hWalls;
        // 找最近的两面墙 (一个在中心上方，一个在下方)
    } else {
        console.log('   判定走廊为南北向 (垂直)，测量东西 (X) 宽度');
        boundaryWalls = vWalls;
    }

    // 寻找两侧面墙
    const center = corridors[index].info;
    const centerCoordinate = orientation === 'Horizontal' ? center.CenterY : center.CenterX;

    // 分类：大于中心与小于中心
    // 对于 Horizontal 墙，比较 Y 坐标 (Face1.Y)
    // 对于 Vertical 墙，比较 X 坐标 (Face1.X)

    let side1Walls = [];
    let side2Walls = [];

    boundaryWalls.forEach(w => {
        // 取墙面坐标的平均值或 Face1 作为判断
        const wallCoord = orientation === 'Horizontal' ? w.Face1.Y : w.Face1.X;
        if (wallCoord > centerCoordinate) side2Walls.push(w);
        else side1Walls.push(w);
    });

    if (side1Walls.length === 0 || side2Walls.length === 0) {
        console.log('   ❌ 无法找到两侧边界墙 (可能单侧是开放或柱列)');
        finishCorridor();
        return;
    }

    // 取最近的墙
    side1Walls.sort((a, b) => b.DistanceToCenter - a.DistanceToCenter); // 错误：Distance 是正数，应该找最小的 DistanceToCenter
    // 其实 query_walls 已经按距离排序了。
    // 所以 side1Walls 的最后一个可能不是最近的? 不，原始列表是 sorted by distance.
    // 所以我们只需要在原始 sorted list 中找到第一个 side1 和第一个 side2

    const wall1 = side1Walls.find(w => true); // 在 sorted list 中找第一個 side1 (已是最接近的)
    const wall2 = side2Walls.find(w => true); // 在 sorted list 中找第一個 side2 (已是最接近的)

    // 为了安全，重新在 boundaryWalls (已排序) 中找
    const w1 = boundaryWalls.find(w => (orientation === 'Horizontal' ? w.Face1.Y : w.Face1.X) < centerCoordinate);
    const w2 = boundaryWalls.find(w => (orientation === 'Horizontal' ? w.Face1.Y : w.Face1.X) > centerCoordinate);

    if (!w1 || !w2) {
        console.log('   ❌ 边界墙判定失败');
        finishCorridor();
        return;
    }

    // 计算坐标
    let dimStart, dimEnd, centerStart, centerEnd;

    if (orientation === 'Horizontal') {
        // 墙是水平的 -> 测量 Y
        // 墙内缘 (Net)
        // w1 在下方 (Y小), w2 在上方 (Y大)
        // w1 的 Face 应该是 Y 较大的那个? (Face1/Face2 哪个大?)
        // 让我们假设 Face1, Face2 是墙的两个面。
        // 下方墙(w1)需取上方由 (Max Y among faces)
        const w1MaxY = Math.max(w1.Face1.Y, w1.Face2.Y); // 下墙的上缘
        const w2MinY = Math.min(w2.Face1.Y, w2.Face2.Y); // 上墙的下缘

        dimStart = { x: center.CenterX, y: w1MaxY };
        dimEnd = { x: center.CenterX, y: w2MinY };

        // 中心线
        centerStart = { x: center.CenterX, y: w1.LocationLine.StartY };
        centerEnd = { x: center.CenterX, y: w2.LocationLine.StartY };

    } else {
        // 墙是垂直的 -> 测量 X
        // w1 在左方 (X小), w2 在右方 (X大)
        const w1MaxX = Math.max(w1.Face1.X, w1.Face2.X); // 左墙的右缘
        const w2MinX = Math.min(w2.Face1.X, w2.Face2.X); // 右墙的左缘

        dimStart = { x: w1MaxX, y: center.CenterY };
        dimEnd = { x: w2MinX, y: center.CenterY };

        // 中心线
        centerStart = { x: w1.LocationLine.StartX, y: center.CenterY };
        centerEnd = { x: w2.LocationLine.StartX, y: center.CenterY };
    }

    const netWidth = orientation === 'Horizontal'
        ? Math.abs(dimEnd.y - dimStart.y)
        : Math.abs(dimEnd.x - dimStart.x);

    console.log(`   净宽: ${netWidth.toFixed(1)} mm`);

    // 法规检讨
    checkCompliance(netWidth);

    // 创建标注
    createDimensions(dimStart, dimEnd, centerStart, centerEnd, orientation);

    // 这里我们需要一个延迟，确保标注命令发送后再进下一走廊
    setTimeout(finishCorridor, 1000);
}

function checkCompliance(width) {
    console.log('   [法规检讨]');
    const w = width; // mm

    // 台湾法规
    if (w >= 1600) console.log('   ✅ 符合双侧居室标准 (>=1.6m)');
    else if (w >= 1200) console.log('   ⚠️ 符合单侧居室标准 (>=1.2m), 但不符双侧要求');
    else console.log('   ❌ 不符合走廊宽度标准 (<1.2m)');
}

function createDimensions(p1, p2, c1, c2, orientation) {
    // 内缘标注
    ws.send(JSON.stringify({
        CommandName: 'create_dimension',
        Parameters: {
            viewId: activeViewId,
            startX: p1.x, startY: p1.y,
            endX: p2.x, endY: p2.y,
            offset: 1200 // 内侧
        },
        RequestId: `step4_dim_net_${currentCorridorIndex}`
    }));

    // 中心标注
    ws.send(JSON.stringify({
        CommandName: 'create_dimension',
        Parameters: {
            viewId: activeViewId,
            startX: c1.x, startY: c1.y,
            endX: c2.x, endY: c2.y,
            offset: 2000 // 外侧
        },
        RequestId: `step4_dim_center_${currentCorridorIndex}`
    }));
}

function finishCorridor() {
    currentCorridorIndex++;
    step = 1; // 重置步骤
    nextStep();
}

ws.on('error', function (error) {
    console.error('连接错误:', error.message);
});

ws.on('close', function () {
    process.exit(0);
});
