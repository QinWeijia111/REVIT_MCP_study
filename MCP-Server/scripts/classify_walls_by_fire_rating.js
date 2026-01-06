/**
 * 墙体防火防烟性能可视化脚本
 * 
 * 此脚本会：
 * 1. 获取当前视图
 * 2. 查询所有墙体
 * 3. 分析防火防烟性能参数
 * 4. 根据参数值应用不同颜色
 * 5. 产生统计报告
 */

// ============================================================================
// 颜色映射配置
// ============================================================================

const COLOR_MAP = {
    "2小时": { color: { r: 0, g: 180, b: 0 }, transparency: 20, label: "🟢 2小时防火" },
    "1.5小时": { color: { r: 100, g: 220, b: 100 }, transparency: 30, label: "🟢 1.5小时防火" },
    "1小时": { color: { r: 255, g: 255, b: 0 }, transparency: 30, label: "🟡 1小时防火" },
    "0.5小时": { color: { r: 255, g: 165, b: 0 }, transparency: 30, label: "🟠 0.5小时防火" },
    "无防火": { color: { r: 100, g: 150, b: 255 }, transparency: 40, label: "🔵 无防火" },
    "未设置": { color: { r: 200, g: 0, b: 200 }, transparency: 50, label: "🟣 未设置" }
};

function normalizeText(value) {
    if (!value) return "";
    return String(value)
        .replace(/\u7159/g, "烟")
        .replace(/\u6642/g, "时")
        .replace(/\u8a2d/g, "设")
        .replace(/\u7121/g, "无");
}

function getColorConfigForValue(value) {
    const normalizedValue = normalizeText(value);
    if (COLOR_MAP[normalizedValue]) return COLOR_MAP[normalizedValue];
    return {
        color: { r: 150, g: 150, b: 150 },
        transparency: 40,
        label: `⚪ ${value}`
    };
}

// 可能的参数名称（按优先顺序）
const PARAMETER_NAMES = [
    "防火防烟性能",
    "防火时效",
    "Fire Rating",
    "FireRating",
    "防火性能"
];

// ============================================================================
// 步骤 1: 获取当前视图
// ============================================================================

console.log("步骤 1: 获取当前视图...");
const currentView = await get_active_view();
console.log(`✓ 当前视图: ${currentView.Name} (ID: ${currentView.Id})`);

// ============================================================================
// 步骤 2: 查询所有墙体
// ============================================================================

console.log("\n步骤 2: 查询视图中的所有墙体...");
const wallsResult = await query_elements({
    category: "Walls",
    viewId: currentView.Id
});

console.log(`✓ 找到 ${wallsResult.TotalFound} 面墙`);

if (wallsResult.TotalFound === 0) {
    console.log("❌ 当前视图中没有墙体元素");
    throw new Error("没有找到墙体");
}

// ============================================================================
// 步骤 3: 分析防火防烟性能参数
// ============================================================================

console.log("\n步骤 3: 分析防火防烟性能参数...");

const wallData = [];
const parameterValueDistribution = {};

for (const wall of wallsResult.Elements) {
    console.log(`  分析墙体 ID: ${wall.ElementId}...`);

    // 获取墙体详细信息
    const wallInfo = await get_element_info({ elementId: wall.ElementId });

    // 尝试找到防火防烟性能参数
    let fireRatingParam = null;
    let fireRatingValue = "未设置";

    for (const paramName of PARAMETER_NAMES) {
        fireRatingParam = wallInfo.Parameters.find(p => normalizeText(p.Name) === paramName);
        if (fireRatingParam && fireRatingParam.Value) {
            fireRatingValue = fireRatingParam.Value.trim();
            break;
        }
    }

    // 记录资料
    wallData.push({
        elementId: wall.ElementId,
        name: wallInfo.Name || "未命名",
        fireRating: fireRatingValue,
        parameterName: fireRatingParam ? fireRatingParam.Name : "未找到"
    });

    // 统计分布
    if (!parameterValueDistribution[fireRatingValue]) {
        parameterValueDistribution[fireRatingValue] = 0;
    }
    parameterValueDistribution[fireRatingValue]++;
}

console.log("\n✓ 参数分析完成");
console.log("参数值分布:");
for (const [value, count] of Object.entries(parameterValueDistribution)) {
    console.log(`  - ${value}: ${count} 面墙`);
}

// ============================================================================
// 步骤 4: 动态建立颜色映射（如果需要）
// ============================================================================

console.log("\n步骤 4: 准备颜色映射...");

// 获取所有唯一的参数值
const uniqueValues = Object.keys(parameterValueDistribution);
const finalColorMap = {};

// 使用预定义的颜色映射
for (const value of uniqueValues) {
    finalColorMap[value] = getColorConfigForValue(value);
}

console.log("✓ 颜色映射表:");
for (const [value, config] of Object.entries(finalColorMap)) {
    console.log(`  ${config.label}: RGB(${config.color.r}, ${config.color.g}, ${config.color.b})`);
}

// ============================================================================
// 步骤 5: 应用图形覆盖
// ============================================================================

console.log("\n步骤 5: 应用颜色覆盖...");

let successCount = 0;
let failedCount = 0;

for (const wall of wallData) {
    try {
        const colorConfig = finalColorMap[wall.fireRating];

        await override_element_graphics({
            elementId: wall.elementId,
            viewId: currentView.Id,
            surfaceFillColor: colorConfig.color,
            transparency: colorConfig.transparency
        });

        successCount++;
        console.log(`  ✓ 已覆盖 ID ${wall.elementId} (${wall.fireRating})`);
    } catch (error) {
        failedCount++;
        console.log(`  ❌ 失败 ID ${wall.elementId}: ${error.message}`);
    }
}

console.log(`\n✓ 覆盖完成: ${successCount} 成功, ${failedCount} 失败`);

// ============================================================================
// 步骤 6: 产生最终报告
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("墙体防火防烟性能可视化报告");
console.log("=".repeat(70));

console.log(`\n视图: ${currentView.Name} (ID: ${currentView.Id})`);
console.log(`总墙体数量: ${wallsResult.TotalFound} 面`);

console.log("\n防火性能分布:");
for (const [value, count] of Object.entries(parameterValueDistribution)) {
    const config = finalColorMap[value];
    const percentage = ((count / wallsResult.TotalFound) * 100).toFixed(1);
    console.log(`  ${config.label}: ${count} 面 (${percentage}%)`);
}

console.log("\n颜色映射表:");
for (const [value, config] of Object.entries(finalColorMap)) {
    console.log(`  ${config.label}`);
    console.log(`    RGB: (${config.color.r}, ${config.color.g}, ${config.color.b})`);
    console.log(`    透明度: ${config.transparency}%`);
}

console.log("\n清除颜色覆盖指令:");
const allWallIds = wallData.map(w => w.elementId);
console.log(`clear_element_override({ elementIds: [${allWallIds.join(', ')}], viewId: ${currentView.Id} })`);

console.log("\n" + "=".repeat(70));
console.log("✓ 执行完成！请检查 Revit 视图中的颜色标记。");
console.log("=".repeat(70));

// 回传完整资料供参考
return {
    view: currentView,
    totalWalls: wallsResult.TotalFound,
    distribution: parameterValueDistribution,
    colorMap: finalColorMap,
    wallData: wallData,
    successCount: successCount,
    failedCount: failedCount,
    clearCommand: `clear_element_override({ elementIds: [${allWallIds.join(', ')}], viewId: ${currentView.Id} })`
};
