/**
 * 墙体防火防烟性能可视化
 * 通过 WebSocket 直接连接 Revit MCP Server
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8999');

// 颜色映射配置
const COLOR_MAP = {
    "2小时": { r: 0, g: 180, b: 0, transparency: 20, label: "🟢 2小时防火" },
    "1.5小时": { r: 100, g: 220, b: 100, transparency: 30, label: "🟢 1.5小时防火" },
    "1小时": { r: 255, g: 255, b: 0, transparency: 30, label: "🟡 1小时防火" },
    "0.5小时": { r: 255, g: 165, b: 0, transparency: 30, label: "🟠 0.5小时防火" },
    "无防火": { r: 100, g: 150, b: 255, transparency: 40, label: "🔵 无防火" },
    "未设置": { r: 200, g: 0, b: 200, transparency: 50, label: "🟣 未设置" }
};

function normalizeText(value) {
    if (!value) return "";
    return String(value)
        .replace(/\u7159/g, "烟")
        .replace(/\u6642/g, "时")
        .replace(/\u8a2d/g, "设")
        .replace(/\u7121/g, "无");
}

const PARAMETER_NAMES = ["防火防烟性能", "防火时效", "Fire Rating", "FireRating", "防火性能"];

let currentView = null;
let allWalls = [];
let wallDataList = [];
let currentWallIndex = 0;
let distribution = {};
let stage = 'get_view';

function sendCommand(commandName, parameters) {
    const command = {
        CommandName: commandName,
        Parameters: parameters,
        RequestId: `${commandName}_${Date.now()}`
    };
    console.log(`[发送] ${commandName}`);
    ws.send(JSON.stringify(command));
}

function getColorForValue(value) {
    const normalizedValue = normalizeText(value);
    for (const [key, config] of Object.entries(COLOR_MAP)) {
        if (normalizedValue && normalizedValue.includes(key)) {
            return config;
        }
    }
    return COLOR_MAP["未设置"];
}

ws.on('open', function () {
    console.log('='.repeat(60));
    console.log('墙体防火防烟性能可视化');
    console.log('='.repeat(60));
    console.log('\n步骤 1: 获取当前视图...');
    sendCommand('get_active_view', {});
});

ws.on('message', function (data) {
    const response = JSON.parse(data.toString());

    if (!response.Success) {
        console.log('❌ 错误:', response.Error);
        ws.close();
        return;
    }

    switch (stage) {
        case 'get_view':
            currentView = response.Data;
            console.log(`✓ 当前视图: ${currentView.Name} (ID: ${currentView.Id})`);

            console.log('\n步骤 2: 查询所有墙体...');
            stage = 'get_walls';
            sendCommand('query_elements', { category: 'Walls', viewId: currentView.Id });
            break;

        case 'get_walls':
            allWalls = response.Data.Elements || [];
            console.log(`✓ 找到 ${allWalls.length} 面墙`);

            if (allWalls.length === 0) {
                console.log('❌ 当前视图中没有墙体');
                ws.close();
                return;
            }

            console.log('\n步骤 3: 分析防火防烟性能参数...');
            stage = 'get_wall_info';
            currentWallIndex = 0;
            sendCommand('get_element_info', { elementId: allWalls[currentWallIndex].ElementId });
            break;

        case 'get_wall_info':
            const wallInfo = response.Data;
            let fireRatingValue = "未设置";

            // 查找防火参数
            if (wallInfo.Parameters) {
                for (const paramName of PARAMETER_NAMES) {
                    const param = wallInfo.Parameters.find(p => normalizeText(p.Name) === paramName);
                    if (param && param.Value) {
                        fireRatingValue = param.Value.trim();
                        break;
                    }
                }
            }

            wallDataList.push({
                elementId: allWalls[currentWallIndex].ElementId,
                name: wallInfo.Name || "未命名",
                fireRating: fireRatingValue
            });

            // 统计分布
            if (!distribution[fireRatingValue]) {
                distribution[fireRatingValue] = 0;
            }
            distribution[fireRatingValue]++;

            currentWallIndex++;
            if (currentWallIndex < allWalls.length) {
                // 继续处理下一面墙
                if (currentWallIndex % 10 === 0) {
                    console.log(`  处理中... ${currentWallIndex}/${allWalls.length}`);
                }
                sendCommand('get_element_info', { elementId: allWalls[currentWallIndex].ElementId });
            } else {
                // 所有墙体分析完成
                console.log(`✓ 分析完成 ${allWalls.length} 面墙`);
                console.log('\n参数值分布:');
                for (const [value, count] of Object.entries(distribution)) {
                    const config = getColorForValue(value);
                    console.log(`  ${config.label}: ${count} 面`);
                }

                console.log('\n步骤 4: 应用颜色覆盖...');
                stage = 'apply_override';
                currentWallIndex = 0;
                applyNextOverride();
            }
            break;

        case 'apply_override':
            currentWallIndex++;
            if (currentWallIndex < wallDataList.length) {
                if (currentWallIndex % 10 === 0) {
                    console.log(`  覆盖中... ${currentWallIndex}/${wallDataList.length}`);
                }
                applyNextOverride();
            } else {
                // 所有覆盖完成
                console.log(`✓ 覆盖完成 ${wallDataList.length} 面墙`);
                printFinalReport();
                ws.close();
            }
            break;
    }
});

function applyNextOverride() {
    const wall = wallDataList[currentWallIndex];
    const colorConfig = getColorForValue(wall.fireRating);

    sendCommand('override_element_graphics', {
        elementId: wall.elementId,
        viewId: currentView.Id,
        surfaceFillColor: { r: colorConfig.r, g: colorConfig.g, b: colorConfig.b },
        transparency: colorConfig.transparency
    });
}

function printFinalReport() {
    console.log('\n' + '='.repeat(60));
    console.log('墙体防火防烟性能可视化报告');
    console.log('='.repeat(60));

    console.log(`\n视图: ${currentView.Name} (ID: ${currentView.Id})`);
    console.log(`总墙体数量: ${wallDataList.length} 面`);

    console.log('\n防火性能分布:');
    for (const [value, count] of Object.entries(distribution)) {
        const config = getColorForValue(value);
        const percentage = ((count / wallDataList.length) * 100).toFixed(1);
        console.log(`  ${config.label}: ${count} 面 (${percentage}%)`);
    }

    console.log('\n颜色映射表:');
    for (const [value, config] of Object.entries(COLOR_MAP)) {
        console.log(`  ${config.label}: RGB(${config.r}, ${config.g}, ${config.b}) 透明度 ${config.transparency}%`);
    }

    const allIds = wallDataList.map(w => w.elementId);
    console.log('\n清除颜色覆盖指令:');
    console.log(`node -e "...clear_element_override({ elementIds: [${allIds.slice(0, 5).join(', ')}...], viewId: ${currentView.Id} })"`);

    console.log('\n' + '='.repeat(60));
    console.log('✓ 执行完成！请检查 Revit 视图中的颜色标记。');
    console.log('='.repeat(60));
}

ws.on('error', function (error) {
    console.error('❌ 连接错误:', error.message);
    console.log('请确认 Revit 已启动且 MCP 服务已开启');
});

ws.on('close', function () {
    process.exit(0);
});

setTimeout(() => {
    console.log('⚠️ 执行超时');
    ws.close();
    process.exit(1);
}, 120000);
