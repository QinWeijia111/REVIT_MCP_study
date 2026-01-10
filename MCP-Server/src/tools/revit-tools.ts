/**
 * Revit MCP 工具定义
 * 定义可供 AI 调用的 Revit 操作工具
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { RevitSocketClient } from "../socket.js";

/**
 * 注册所有 Revit 工具
 */
export function registerRevitTools(): Tool[] {
    return [
        // 1. 创建墙元素
        {
            name: "create_wall",
            description: "在 Revit 中创建一面墙。需要指定起点、终点坐标和高度。",
            inputSchema: {
                type: "object",
                properties: {
                    startX: {
                        type: "number",
                        description: "起点 X 坐标（毫米）",
                    },
                    startY: {
                        type: "number",
                        description: "起点 Y 坐标（毫米）",
                    },
                    endX: {
                        type: "number",
                        description: "终点 X 坐标（毫米）",
                    },
                    endY: {
                        type: "number",
                        description: "终点 Y 坐标（毫米）",
                    },
                    height: {
                        type: "number",
                        description: "墙高度（毫米）",
                        default: 3000,
                    },
                    wallType: {
                        type: "string",
                        description: "墙类型名称（选填）",
                    },
                },
                required: ["startX", "startY", "endX", "endY"],
            },
        },

        // 2. 查询项目信息
        {
            name: "get_project_info",
            description: "获取当前打开的 Revit 项目基本信息，包括项目名称、建筑物名称、业主等。",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },

        {
            name: "get_categories",
            description:
                "获取当前视图中出现过的元素类别清单，并给出可用于 query_elements 的 QueryName。",
            inputSchema: {
                type: "object",
                properties: {
                    viewId: {
                        type: "number",
                        description: "视图 ID（若不指定则使用当前视图）",
                    },
                    sampleLimit: {
                        type: "number",
                        description: "采样元素数量上限（默认 5000）",
                        default: 5000,
                    },
                    maxCount: {
                        type: "number",
                        description: "返回类别数量上限（默认 200）",
                        default: 200,
                    },
                },
            },
        },

        // 3. 查询元素
        {
            name: "query_elements",
            description:
                "查询 Revit 项目中的元素（默认在当前视图内）。category 推荐使用 get_categories 返回的 QueryName（如 Walls/Doors/Windows/Floors/Rooms/Dimensions/AllColumns），也支持中文别名（如 墙/门/窗/楼板/房间/标注/柱）。",
            inputSchema: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        description:
                            "元素类别（推荐 QueryName，例如 Walls/Doors/Windows/Floors/Rooms/Dimensions/AllColumns）",
                    },
                    viewId: {
                        type: "number",
                        description: "视图 ID（若不指定则使用当前视图）",
                    },
                    maxCount: {
                        type: "number",
                        description: "返回数量上限（默认 100）",
                        default: 100,
                    },
                    family: {
                        type: "string",
                        description:
                            "族群名称（选填，部分实现可能忽略此字段）",
                    },
                    type: {
                        type: "string",
                        description: "类型名称（选填，部分实现可能忽略此字段）",
                    },
                    level: {
                        type: "string",
                        description: "楼层名称（选填，部分实现可能忽略此字段）",
                    },
                },
                required: ["category"],
            },
        },

        {
            name: "create_room",
            description:
                "在指定楼层的平面位置创建房间（位置需在封闭边界内）。坐标单位毫米（mm）。",
            inputSchema: {
                type: "object",
                properties: {
                    level: {
                        type: "string",
                        description: "楼层名称（也支持 levelName）",
                        default: "Level 1",
                    },
                    levelName: {
                        type: "string",
                        description: "楼层名称（可选，与 level 等价）",
                    },
                    x: {
                        type: "number",
                        description: "放置点 X 坐标（毫米）",
                    },
                    y: {
                        type: "number",
                        description: "放置点 Y 坐标（毫米）",
                    },
                    name: {
                        type: "string",
                        description: "房间名称（可选）",
                    },
                    number: {
                        type: "string",
                        description: "房间编号（可选）",
                    },
                },
                required: ["x", "y"],
            },
        },

        // 4. 创建楼板
        {
            name: "create_floor",
            description: "在 Revit 中创建楼板。需要指定矩形范围的四个角点坐标。",
            inputSchema: {
                type: "object",
                properties: {
                    points: {
                        type: "array",
                        description: "楼板边界点数组，每个点包含 x, y 坐标（毫米）",
                        items: {
                            type: "object",
                            properties: {
                                x: { type: "number" },
                                y: { type: "number" },
                            },
                        },
                    },
                    levelName: {
                        type: "string",
                        description: "楼层名称",
                        default: "Level 1",
                    },
                    floorType: {
                        type: "string",
                        description: "楼板类型名称（选填）",
                    },
                },
                required: ["points"],
            },
        },

        // 5. 删除元素
        {
            name: "delete_element",
            description: "按 Element ID 删除 Revit 元素。",
            inputSchema: {
                type: "object",
                properties: {
                    elementId: {
                        type: "number",
                        description: "要删除的元素 ID",
                    },
                },
                required: ["elementId"],
            },
        },

        // 6. 获取元素信息
        {
            name: "get_element_info",
            description: "获取指定元素的详细信息，包括参数、几何信息等。",
            inputSchema: {
                type: "object",
                properties: {
                    elementId: {
                        type: "number",
                        description: "元素 ID",
                    },
                },
                required: ["elementId"],
            },
        },

        // 7. 修改元素参数
        {
            name: "modify_element_parameter",
            description: "修改 Revit 元素的参数值。",
            inputSchema: {
                type: "object",
                properties: {
                    elementId: {
                        type: "number",
                        description: "元素 ID",
                    },
                    parameterName: {
                        type: "string",
                        description: "参数名称",
                    },
                    value: {
                        type: "string",
                        description: "新的参数值",
                    },
                },
                required: ["elementId", "parameterName", "value"],
            },
        },

        // 8. 获取所有楼层
        {
            name: "get_all_levels",
            description: "获取项目中所有楼层的清单，包括楼层名称和标高。",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },

        // 9. 创建门
        {
            name: "create_door",
            description: "在指定的墙上创建门。",
            inputSchema: {
                type: "object",
                properties: {
                    wallId: {
                        type: "number",
                        description: "要放置门的墙 ID",
                    },
                    locationX: {
                        type: "number",
                        description: "门在墙上的位置 X 坐标（毫米）",
                    },
                    locationY: {
                        type: "number",
                        description: "门在墙上的位置 Y 坐标（毫米）",
                    },
                    doorType: {
                        type: "string",
                        description: "门类型名称（选填）",
                    },
                },
                required: ["wallId", "locationX", "locationY"],
            },
        },

        // 10. 创建窗
        {
            name: "create_window",
            description: "在指定的墙上创建窗。",
            inputSchema: {
                type: "object",
                properties: {
                    wallId: {
                        type: "number",
                        description: "要放置窗的墙 ID",
                    },
                    locationX: {
                        type: "number",
                        description: "窗在墙上的位置 X 坐标（毫米）",
                    },
                    locationY: {
                        type: "number",
                        description: "窗在墙上的位置 Y 坐标（毫米）",
                    },
                    windowType: {
                        type: "string",
                        description: "窗类型名称（选填）",
                    },
                },
                required: ["wallId", "locationX", "locationY"],
            },
        },

        // 11. 获取所有网格线
        {
            name: "get_all_grids",
            description:
                "获取项目中所有网格线（Grid）的信息，包含名称、方向、起点和终点坐标。可用于计算网格交点。",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },

        // 12. 获取柱类型
        {
            name: "get_column_types",
            description: "获取项目中所有可用的柱类型，包含名称、尺寸和族群信息。",
            inputSchema: {
                type: "object",
                properties: {
                    material: {
                        type: "string",
                        description: "筛选材质（如：混凝土、钢），选填",
                    },
                },
            },
        },

        // 13. 创建柱子
        {
            name: "create_column",
            description: "在指定位置创建柱子。需要指定坐标和底部楼层。",
            inputSchema: {
                type: "object",
                properties: {
                    x: {
                        type: "number",
                        description: "柱子位置 X 坐标（毫米）",
                    },
                    y: {
                        type: "number",
                        description: "柱子位置 Y 坐标（毫米）",
                    },
                    bottomLevel: {
                        type: "string",
                        description: "底部楼层名称",
                        default: "Level 1",
                    },
                    topLevel: {
                        type: "string",
                        description:
                            "顶部楼层名称（选填，如不指定则使用非约束高度）",
                    },
                    columnType: {
                        type: "string",
                        description:
                            "柱类型名称（选填，如不指定则使用默认类型）",
                    },
                },
                required: ["x", "y"],
            },
        },

        // 14. 获取家具类型
        {
            name: "get_furniture_types",
            description: "获取项目中已载入的家具类型清单，包含名称和族群信息。",
            inputSchema: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        description: "家具类别筛选（如：椅子、桌子、床），选填",
                    },
                },
            },
        },

        // 15. 放置家具
        {
            name: "place_furniture",
            description: "在指定位置放置家具实例。",
            inputSchema: {
                type: "object",
                properties: {
                    x: {
                        type: "number",
                        description: "X 坐标（毫米）",
                    },
                    y: {
                        type: "number",
                        description: "Y 坐标（毫米）",
                    },
                    furnitureType: {
                        type: "string",
                        description:
                            "家具类型名称（需与 get_furniture_types 返回的名称一致）",
                    },
                    level: {
                        type: "string",
                        description: "楼层名称",
                        default: "Level 1",
                    },
                    rotation: {
                        type: "number",
                        description: "旋转角度（度），默认 0",
                        default: 0,
                    },
                },
                required: ["x", "y", "furnitureType"],
            },
        },

        // 16. 获取房间信息
        {
            name: "get_room_info",
            description:
                "获取房间详细信息，包含中心点坐标和边界范围。可用于智能放置家具。",
            inputSchema: {
                type: "object",
                properties: {
                    roomId: {
                        type: "number",
                        description: "房间 Element ID（选填，如果知道的话）",
                    },
                    roomName: {
                        type: "string",
                        description: "房间名称（选填，用于搜索）",
                    },
                },
            },
        },

        // 17. 获取楼层房间清单
        {
            name: "get_rooms_by_level",
            description:
                "获取指定楼层的所有房间清单，包含名称、编号、面积、用途等信息。可用于容积检讨。",
            inputSchema: {
                type: "object",
                properties: {
                    level: {
                        type: "string",
                        description: "楼层名称（如：1F、Level 1）",
                    },
                    includeUnnamed: {
                        type: "boolean",
                        description: "是否包含未命名的房间，默认 true",
                        default: true,
                    },
                },
                required: ["level"],
            },
        },

        // 18. 获取所有视图
        {
            name: "get_all_views",
            description:
                "获取项目中所有视图的清单，包含平面图、天花图、3D 视图、剖面图等。可用于选择要标注的视图。",
            inputSchema: {
                type: "object",
                properties: {
                    viewType: {
                        type: "string",
                        description:
                            "视图类型筛选：FloorPlan（平面图）、CeilingPlan（天花图）、ThreeD（3D 视图）、Section（剖面图）、Elevation（立面图）",
                    },
                    levelName: {
                        type: "string",
                        description: "楼层名称筛选（选填）",
                    },
                },
            },
        },

        // 19. 获取当前视图
        {
            name: "get_active_view",
            description:
                "获取当前打开的视图信息，包含视图名称、类型、楼层等。",
            inputSchema: {
                type: "object",
                properties: {},
            },
        },

        // 20. 切换视图
        {
            name: "set_active_view",
            description: "切换至指定的视图。",
            inputSchema: {
                type: "object",
                properties: {
                    viewId: {
                        type: "number",
                        description: "要切换的视图 Element ID",
                    },
                },
                required: ["viewId"],
            },
        },

        // 21. 选择元素
        {
            name: "select_element",
            description:
                "在 Revit 中选择指定的元素，让用户可以可视化确认目标元素。",
            inputSchema: {
                type: "object",
                properties: {
                    elementId: {
                        type: "number",
                        description: "要选择的元素 ID (单选)",
                    },
                    elementIds: {
                        type: "array",
                        items: { type: "number" },
                        description: "要选择的元素 ID 列表 (多选)",
                    },
                },
                // required: ["elementId"], // 让后端验证
            },
        },

        // 22. 缩放至元素
        {
            name: "zoom_to_element",
            description: "将视图缩放至指定元素，让用户可以快速定位。",
            inputSchema: {
                type: "object",
                properties: {
                    elementId: {
                        type: "number",
                        description: "要缩放至的元素 ID",
                    },
                },
                required: ["elementId"],
            },
        },

        // 23. 测量距离
        {
            name: "measure_distance",
            description: "测量两个点之间的距离。返回距离（毫米）。",
            inputSchema: {
                type: "object",
                properties: {
                    point1X: {
                        type: "number",
                        description: "第一点 X 坐标（毫米）",
                    },
                    point1Y: {
                        type: "number",
                        description: "第一点 Y 坐标（毫米）",
                    },
                    point1Z: {
                        type: "number",
                        description: "第一点 Z 坐标（毫米），默认 0",
                        default: 0,
                    },
                    point2X: {
                        type: "number",
                        description: "第二点 X 坐标（毫米）",
                    },
                    point2Y: {
                        type: "number",
                        description: "第二点 Y 坐标（毫米）",
                    },
                    point2Z: {
                        type: "number",
                        description: "第二点 Z 坐标（毫米），默认 0",
                        default: 0,
                    },
                },
                required: ["point1X", "point1Y", "point2X", "point2Y"],
            },
        },

        // 24. 获取墙信息
        {
            name: "get_wall_info",
            description:
                "获取墙的详细信息，包含厚度、长度、高度、位置线坐标等。用于计算走廊净宽。",
            inputSchema: {
                type: "object",
                properties: {
                    wallId: {
                        type: "number",
                        description: "墙的 Element ID",
                    },
                },
                required: ["wallId"],
            },
        },

        // 25. 创建尺寸标注
        {
            name: "create_dimension",
            description:
                "在指定视图中创建尺寸标注。需要指定视图和两个参考点。",
            inputSchema: {
                type: "object",
                properties: {
                    viewId: {
                        type: "number",
                        description:
                            "要创建标注的视图 ID（使用 get_active_view 或 get_all_views 获取）",
                    },
                    startX: {
                        type: "number",
                        description: "起点 X 坐标（毫米）",
                    },
                    startY: {
                        type: "number",
                        description: "起点 Y 坐标（毫米）",
                    },
                    endX: {
                        type: "number",
                        description: "终点 X 坐标（毫米）",
                    },
                    endY: {
                        type: "number",
                        description: "终点 Y 坐标（毫米）",
                    },
                    offset: {
                        type: "number",
                        description: "标注线偏移距离（毫米），默认 500",
                        default: 500,
                    },
                },
                required: ["viewId", "startX", "startY", "endX", "endY"],
            },
        },

        // 25. 根据位置查询墙体
        {
            name: "query_walls_by_location",
            description:
                "查询指定坐标附近的墙体，返回墙厚度、位置线与墙面坐标。",
            inputSchema: {
                type: "object",
                properties: {
                    x: {
                        type: "number",
                        description: "搜索中心 X 坐标",
                    },
                    y: {
                        type: "number",
                        description: "搜索中心 Y 坐标",
                    },
                    searchRadius: {
                        type: "number",
                        description: "搜索半径 (mm)",
                    },
                    level: {
                        type: "string",
                        description: "楼层名称 (选填，例如 '2FL')",
                    },
                },
                required: ["x", "y", "searchRadius"],
            },
        },

        // 26. 通用元素查询
        {
            name: "query_elements",
            description: "查询视图中的元素，可按照类别 (Category) 过滤。",
            inputSchema: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        description:
                            "元素类别 (例如 'Dimensions', 'Walls', 'Rooms', 'Windows')",
                    },
                    viewId: {
                        type: "number",
                        description:
                            "视图 ID (选填，若未提供则查询当前视图)",
                    },
                    maxCount: {
                        type: "number",
                        description: "最大返回数量 (默认 100)",
                    },
                },
                required: ["category"],
            },
        },

        // 27. 覆盖元素图形显示
        {
            name: "override_element_graphics",
            description:
                "在指定视图中覆盖元素的图形显示（填充颜色、图样、线条颜色等）。适用于平面图中标记不同状态的墙体或其他元素。",
            inputSchema: {
                type: "object",
                properties: {
                    elementId: {
                        type: "number",
                        description: "要覆盖的元素 ID",
                    },
                    viewId: {
                        type: "number",
                        description: "视图 ID（若不指定则使用当前视图）",
                    },
                    surfaceFillColor: {
                        type: "object",
                        description: "表面填充颜色 RGB (0-255)",
                        properties: {
                            r: { type: "number", minimum: 0, maximum: 255 },
                            g: { type: "number", minimum: 0, maximum: 255 },
                            b: { type: "number", minimum: 0, maximum: 255 },
                        },
                    },
                    surfacePatternId: {
                        type: "number",
                        description:
                            "表面填充图样 ID（-1 表示使用实心填充，0 表示不设置图样）",
                        default: -1,
                    },
                    lineColor: {
                        type: "object",
                        description: "线条颜色 RGB（可选）",
                        properties: {
                            r: { type: "number", minimum: 0, maximum: 255 },
                            g: { type: "number", minimum: 0, maximum: 255 },
                            b: { type: "number", minimum: 0, maximum: 255 },
                        },
                    },
                    transparency: {
                        type: "number",
                        description: "透明度 (0-100)，0 为不透明",
                        minimum: 0,
                        maximum: 100,
                        default: 0,
                    },
                },
                required: ["elementId"],
            },
        },

        // 28. 清除元素图形覆盖
        {
            name: "clear_element_override",
            description: "清除元素在指定视图中的图形覆盖，恢复为默认显示。",
            inputSchema: {
                type: "object",
                properties: {
                    elementId: {
                        type: "number",
                        description: "要清除覆盖的元素 ID",
                    },
                    elementIds: {
                        type: "array",
                        items: { type: "number" },
                        description: "要清除覆盖的元素 ID 列表（批量操作）",
                    },
                    viewId: {
                        type: "number",
                        description: "视图 ID（若不指定则使用当前视图）",
                    },
                },
            },
        },
    ];
}

/**
 * 执行 Revit 工具
 */
export async function executeRevitTool(
    toolName: string,
    args: Record<string, any>,
    client: RevitSocketClient
): Promise<any> {
    // 将工具名称转换为 Revit 命令名称
    const commandName = toolName;

    // 发送命令到 Revit
    const response = await client.sendCommand(commandName, args);

    if (!response.success) {
        throw new Error(response.error || "命令执行失败");
    }

    return response.data;
}
