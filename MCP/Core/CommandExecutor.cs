using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCP.Models;

namespace RevitMCP.Core
{
    /// <summary>
    /// 命令执行器 - 执行各种 Revit 操作
    /// </summary>
    public class CommandExecutor
    {
        private readonly UIApplication _uiApp;

        public CommandExecutor(UIApplication uiApp)
        {
            _uiApp = uiApp ?? throw new ArgumentNullException(nameof(uiApp));
        }

        /// <summary>
        /// 共用方法：查找楼层
        /// </summary>
        private Level FindLevel(Document doc, string levelName, bool useFirstIfNotFound = true)
        {
            var level = new FilteredElementCollector(doc)
                .OfClass(typeof(Level))
                .Cast<Level>()
                .FirstOrDefault(l => l.Name == levelName || l.Name.Contains(levelName) || levelName.Contains(l.Name));

            if (level == null && useFirstIfNotFound)
            {
                level = new FilteredElementCollector(doc)
                    .OfClass(typeof(Level))
                    .Cast<Level>()
                    .OrderBy(l => l.Elevation)
                    .FirstOrDefault();
            }

            if (level == null)
            {
                throw new Exception($"找不到楼层: {levelName}");
            }

            return level;
        }

        /// <summary>
        /// 执行命令
        /// </summary>
        public RevitCommandResponse ExecuteCommand(RevitCommandRequest request)
        {
            try
            {
                var parameters = request.Parameters as JObject ?? new JObject();
                object result = null;

                switch (request.CommandName.ToLower())
                {
                    case "create_wall":
                        result = CreateWall(parameters);
                        break;
                    
                    case "get_project_info":
                        result = GetProjectInfo();
                        break;

                    case "get_categories":
                        result = GetCategories(parameters);
                        break;

                    
                    case "create_floor":
                        result = CreateFloor(parameters);
                        break;
                    
                    case "get_all_levels":
                        result = GetAllLevels();
                        break;
                    
                    case "get_element_info":
                        result = GetElementInfo(parameters);
                        break;
                    
                    case "delete_element":
                        result = DeleteElement(parameters);
                        break;
                    
                    case "modify_element_parameter":
                        result = ModifyElementParameter(parameters);
                        break;
                    
                    case "create_door":
                        result = CreateDoor(parameters);
                        break;
                    
                    case "create_window":
                        result = CreateWindow(parameters);
                        break;
                    
                    case "get_all_grids":
                        result = GetAllGrids();
                        break;
                    
                    case "get_column_types":
                        result = GetColumnTypes(parameters);
                        break;
                    
                    case "create_column":
                        result = CreateColumn(parameters);
                        break;
                    
                    case "get_furniture_types":
                        result = GetFurnitureTypes(parameters);
                        break;
                    
                    case "place_furniture":
                        result = PlaceFurniture(parameters);
                        break;
                    
                    case "get_room_info":
                        result = GetRoomInfo(parameters);
                        break;
                    
                    case "get_rooms_by_level":
                        result = GetRoomsByLevel(parameters);
                        break;

                    case "create_room":
                        result = CreateRoom(parameters);
                        break;
                    
                    case "get_all_views":
                        result = GetAllViews(parameters);
                        break;
                    
                    case "get_active_view":
                        result = GetActiveView();
                        break;
                    
                    case "set_active_view":
                        result = SetActiveView(parameters);
                        break;
                    
                    case "select_element":
                        result = SelectElement(parameters);
                        break;
                    
                    case "zoom_to_element":
                        result = ZoomToElement(parameters);
                        break;
                    
                    case "measure_distance":
                        result = MeasureDistance(parameters);
                        break;
                    
                    case "get_wall_info":
                        result = GetWallInfo(parameters);
                        break;
                    
                    case "create_dimension":
                        result = CreateDimension(parameters);
                        break;
                    
                    case "query_walls_by_location":
                        result = QueryWallsByLocation(parameters);
                        break;
                    
                    case "query_elements":
                        result = QueryElements(parameters);
                        break;
                    
                    case "override_element_graphics":
                        result = OverrideElementGraphics(parameters);
                        break;
                    
                    case "clear_element_override":
                        result = ClearElementOverride(parameters);
                        break;
                    
                    case "unjoin_wall_joins":
                        result = UnjoinWallJoins(parameters);
                        break;
                    
                    case "rejoin_wall_joins":
                        result = RejoinWallJoins(parameters);
                        break;
                    
                    default:
                        throw new NotImplementedException($"未实现的命令: {request.CommandName}");
                }

                return new RevitCommandResponse
                {
                    Success = true,
                    Data = result,
                    RequestId = request.RequestId
                };
            }
            catch (Exception ex)
            {
                return new RevitCommandResponse
                {
                    Success = false,
                    Error = ex.Message,
                    RequestId = request.RequestId
                };
            }
        }

        #region 命令实现

        /// <summary>
        /// 创建墙
        /// </summary>
        private object CreateWall(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            double startX = parameters["startX"]?.Value<double>() ?? 0;
            double startY = parameters["startY"]?.Value<double>() ?? 0;
            double endX = parameters["endX"]?.Value<double>() ?? 0;
            double endY = parameters["endY"]?.Value<double>() ?? 0;
            double height = parameters["height"]?.Value<double>() ?? 3000;

            // 转换为英尺 (Revit 内部单位)
            XYZ start = new XYZ(startX / 304.8, startY / 304.8, 0);
            XYZ end = new XYZ(endX / 304.8, endY / 304.8, 0);

            using (Transaction trans = new Transaction(doc, "创建墙"))
            {
                trans.Start();

                // 创建线
                Line line = Line.CreateBound(start, end);

                // 获取默认楼层
                Level level = new FilteredElementCollector(doc)
                    .OfClass(typeof(Level))
                    .Cast<Level>()
                    .FirstOrDefault();

                if (level == null)
                {
                    throw new Exception("找不到楼层");
                }

                // 创建墙
                Wall wall = Wall.Create(doc, line, level.Id, false);
                
                // 设置高度
                Parameter heightParam = wall.get_Parameter(BuiltInParameter.WALL_USER_HEIGHT_PARAM);
                if (heightParam != null && !heightParam.IsReadOnly)
                {
                    heightParam.Set(height / 304.8);
                }

                trans.Commit();

                return new
                {
                    ElementId = wall.Id.IntegerValue,
                    Message = $"成功创建墙，ID: {wall.Id.IntegerValue}"
                };
            }
        }

        /// <summary>
        /// 获取项目信息
        /// </summary>
        private object GetProjectInfo()
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            ProjectInfo projInfo = doc.ProjectInformation;

            return new
            {
                ProjectName = doc.Title,
                BuildingName = projInfo.BuildingName,
                OrganizationName = projInfo.OrganizationName,
                Author = projInfo.Author,
                Address = projInfo.Address,
                ClientName = projInfo.ClientName,
                ProjectNumber = projInfo.Number,
                ProjectStatus = projInfo.Status
            };
        }

        /// <summary>
        /// 获取所有楼层
        /// </summary>
        private object GetAllLevels()
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            var levels = new FilteredElementCollector(doc)
                .OfClass(typeof(Level))
                .Cast<Level>()
                .OrderBy(l => l.Elevation)
                .Select(l => new
                {
                    ElementId = l.Id.IntegerValue,
                    Name = l.Name,
                    Elevation = Math.Round(l.Elevation * 304.8, 2) // 转换为毫米
                })
                .ToList();

            return new
            {
                Count = levels.Count,
                Levels = levels
            };
        }

        /// <summary>
        /// 获取元素信息
        /// </summary>
        private object GetElementInfo(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            int elementId = parameters["elementId"]?.Value<int>() ?? 0;

            Element element = doc.GetElement(new ElementId(elementId));
            if (element == null)
            {
                throw new Exception($"找不到元素 ID: {elementId}");
            }

            var parameterList = new List<object>();
            foreach (Parameter param in element.Parameters)
            {
                if (param.HasValue)
                {
                    parameterList.Add(new
                    {
                        Name = param.Definition.Name,
                        Value = param.AsValueString() ?? param.AsString(),
                        Type = param.StorageType.ToString()
                    });
                }
            }

            return new
            {
                ElementId = element.Id.IntegerValue,
                Name = element.Name,
                Category = element.Category?.Name,
                Type = doc.GetElement(element.GetTypeId())?.Name,
                Level = doc.GetElement(element.LevelId)?.Name,
                Parameters = parameterList
            };
        }

        /// <summary>
        /// 删除元素
        /// </summary>
        private object DeleteElement(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            int elementId = parameters["elementId"]?.Value<int>() ?? 0;

            using (Transaction trans = new Transaction(doc, "删除元素"))
            {
                trans.Start();

                Element element = doc.GetElement(new ElementId(elementId));
                if (element == null)
                {
                    throw new Exception($"找不到元素 ID: {elementId}");
                }

                doc.Delete(new ElementId(elementId));
                trans.Commit();

                return new
                {
                    Message = $"成功删除元素 ID: {elementId}"
                };
            }
        }

        /// <summary>
        /// 创建楼板
        /// </summary>
        private object CreateFloor(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            
            var pointsArray = parameters["points"] as JArray;
            string levelName = parameters["levelName"]?.Value<string>() ?? "Level 1";
            
            if (pointsArray == null || pointsArray.Count < 3)
            {
                throw new Exception("需要至少 3 个点来创建楼板");
            }

            using (Transaction trans = new Transaction(doc, "创建楼板"))
            {
                trans.Start();

                // 获取楼层
                Level level = FindLevel(doc, levelName, true);

                // 创建边界曲线
                var points = pointsArray.Select(p => new XYZ(
                    p["x"]?.Value<double>() / 304.8 ?? 0,
                    p["y"]?.Value<double>() / 304.8 ?? 0,
                    0
                )).ToList();

                // 获取默认楼板类型
                FloorType floorType = new FilteredElementCollector(doc)
                    .OfClass(typeof(FloorType))
                    .Cast<FloorType>()
                    .FirstOrDefault();

                if (floorType == null)
                {
                    throw new Exception("找不到楼板类型");
                }

                // 创建 CurveLoop (Revit 2022+ 使用)
                CurveLoop curveLoop = new CurveLoop();
                for (int i = 0; i < points.Count; i++)
                {
                    XYZ start = points[i];
                    XYZ end = points[(i + 1) % points.Count];
                    curveLoop.Append(Line.CreateBound(start, end));
                }

                // 使用 Floor.Create (适用于 Revit 2022+)
                Floor floor = Floor.Create(doc, new List<CurveLoop> { curveLoop }, floorType.Id, level.Id);

                trans.Commit();

                return new
                {
                    ElementId = floor.Id.IntegerValue,
                    Level = level.Name,
                    Message = $"成功创建楼板，ID: {floor.Id.IntegerValue}"
                };
            }
        }


        /// <summary>
        /// 修改元素参数
        /// </summary>
        private object ModifyElementParameter(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            int elementId = parameters["elementId"]?.Value<int>() ?? 0;
            string parameterName = parameters["parameterName"]?.Value<string>();
            string value = parameters["value"]?.Value<string>();

            if (string.IsNullOrEmpty(parameterName))
            {
                throw new Exception("请指定参数名称");
            }

            Element element = doc.GetElement(new ElementId(elementId));
            if (element == null)
            {
                throw new Exception($"找不到元素 ID: {elementId}");
            }

            using (Transaction trans = new Transaction(doc, "修改参数"))
            {
                trans.Start();

                Parameter param = element.LookupParameter(parameterName);
                if (param == null)
                {
                    throw new Exception($"找不到参数: {parameterName}");
                }

                if (param.IsReadOnly)
                {
                    throw new Exception($"参数 {parameterName} 是只读的");
                }

                bool success = false;
                switch (param.StorageType)
                {
                    case StorageType.String:
                        success = param.Set(value);
                        break;
                    case StorageType.Double:
                        if (double.TryParse(value, out double dVal))
                            success = param.Set(dVal);
                        break;
                    case StorageType.Integer:
                        if (int.TryParse(value, out int iVal))
                            success = param.Set(iVal);
                        break;
                    default:
                        throw new Exception($"不支持的参数类型: {param.StorageType}");
                }

                if (!success)
                {
                    throw new Exception("设置参数失败");
                }

                trans.Commit();

                return new
                {
                    ElementId = elementId,
                    ParameterName = parameterName,
                    NewValue = value,
                    Message = $"成功修改参数 {parameterName}"
                };
            }
        }

        /// <summary>
        /// 创建门
        /// </summary>
        private object CreateDoor(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            int wallId = parameters["wallId"]?.Value<int>() ?? 0;
            double locationX = parameters["locationX"]?.Value<double>() ?? 0;
            double locationY = parameters["locationY"]?.Value<double>() ?? 0;

            Wall wall = doc.GetElement(new ElementId(wallId)) as Wall;
            if (wall == null)
            {
                throw new Exception($"找不到墙 ID: {wallId}");
            }

            using (Transaction trans = new Transaction(doc, "创建门"))
            {
                trans.Start();

                // 获取门类型
                FamilySymbol doorSymbol = new FilteredElementCollector(doc)
                    .OfClass(typeof(FamilySymbol))
                    .OfCategory(BuiltInCategory.OST_Doors)
                    .Cast<FamilySymbol>()
                    .FirstOrDefault();

                if (doorSymbol == null)
                {
                    throw new Exception("找不到门类型");
                }

                if (!doorSymbol.IsActive)
                {
                    doorSymbol.Activate();
                    doc.Regenerate();
                }

                // 获取墙的楼层
                Level level = doc.GetElement(wall.LevelId) as Level;
                XYZ location = new XYZ(locationX / 304.8, locationY / 304.8, level?.Elevation ?? 0);

                FamilyInstance door = doc.Create.NewFamilyInstance(
                    location, doorSymbol, wall, level, 
                    Autodesk.Revit.DB.Structure.StructuralType.NonStructural);

                trans.Commit();

                return new
                {
                    ElementId = door.Id.IntegerValue,
                    DoorType = doorSymbol.Name,
                    WallId = wallId,
                    Message = $"成功创建门，ID: {door.Id.IntegerValue}"
                };
            }
        }

        /// <summary>
        /// 创建窗
        /// </summary>
        private object CreateWindow(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            int wallId = parameters["wallId"]?.Value<int>() ?? 0;
            double locationX = parameters["locationX"]?.Value<double>() ?? 0;
            double locationY = parameters["locationY"]?.Value<double>() ?? 0;

            Wall wall = doc.GetElement(new ElementId(wallId)) as Wall;
            if (wall == null)
            {
                throw new Exception($"找不到墙 ID: {wallId}");
            }

            using (Transaction trans = new Transaction(doc, "创建窗"))
            {
                trans.Start();

                // 获取窗类型
                FamilySymbol windowSymbol = new FilteredElementCollector(doc)
                    .OfClass(typeof(FamilySymbol))
                    .OfCategory(BuiltInCategory.OST_Windows)
                    .Cast<FamilySymbol>()
                    .FirstOrDefault();

                if (windowSymbol == null)
                {
                    throw new Exception("找不到窗类型");
                }

                if (!windowSymbol.IsActive)
                {
                    windowSymbol.Activate();
                    doc.Regenerate();
                }

                // 获取墙的楼层
                Level level = doc.GetElement(wall.LevelId) as Level;
                XYZ location = new XYZ(locationX / 304.8, locationY / 304.8, (level?.Elevation ?? 0) + 3); // 窗户高度 3 英尺

                FamilyInstance window = doc.Create.NewFamilyInstance(
                    location, windowSymbol, wall, level,
                    Autodesk.Revit.DB.Structure.StructuralType.NonStructural);

                trans.Commit();

                return new
                {
                    ElementId = window.Id.IntegerValue,
                    WindowType = windowSymbol.Name,
                    WallId = wallId,
                    Message = $"成功创建窗，ID: {window.Id.IntegerValue}"
                };
            }
        }

        /// <summary>
        /// 获取所有网格线
        /// </summary>
        private object GetAllGrids()
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            var grids = new FilteredElementCollector(doc)
                .OfClass(typeof(Grid))
                .Cast<Grid>()
                .Select(g =>
                {
                    // 获取 Grid 的曲线（通常是直线）
                    Curve curve = g.Curve;
                    XYZ startPoint = curve.GetEndPoint(0);
                    XYZ endPoint = curve.GetEndPoint(1);

                    // 判断方向（水平或垂直）
                    double dx = Math.Abs(endPoint.X - startPoint.X);
                    double dy = Math.Abs(endPoint.Y - startPoint.Y);
                    string direction = dx > dy ? "水平" : "垂直";

                    return new
                    {
                        ElementId = g.Id.IntegerValue,
                        Name = g.Name,
                        Direction = direction,
                        StartX = Math.Round(startPoint.X * 304.8, 2),  // 英尺 → 毫米
                        StartY = Math.Round(startPoint.Y * 304.8, 2),
                        EndX = Math.Round(endPoint.X * 304.8, 2),
                        EndY = Math.Round(endPoint.Y * 304.8, 2)
                    };
                })
                .OrderBy(g => g.Name)
                .ToList();

            return new
            {
                Count = grids.Count,
                Grids = grids
            };
        }

        /// <summary>
        /// 获取柱类型
        /// </summary>
        private object GetColumnTypes(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            string materialFilter = parameters["material"]?.Value<string>();

            // 查询结构柱和建筑柱的 FamilySymbol
            var columnTypes = new FilteredElementCollector(doc)
                .OfClass(typeof(FamilySymbol))
                .Cast<FamilySymbol>()
                .Where(fs => fs.Category != null && 
                    (fs.Category.Id.IntegerValue == (int)BuiltInCategory.OST_Columns ||
                     fs.Category.Id.IntegerValue == (int)BuiltInCategory.OST_StructuralColumns))
                .Select(fs =>
                {
                    // 尝试获取尺寸参数
                    double width = 0, depth = 0;
                    
                    // 常见的柱尺寸参数名称
                    Parameter widthParam = fs.LookupParameter("宽度") ?? 
                                          fs.LookupParameter("Width") ?? 
                                          fs.LookupParameter("b");
                    Parameter depthParam = fs.LookupParameter("深度") ?? 
                                          fs.LookupParameter("Depth") ?? 
                                          fs.LookupParameter("h");
                    
                    if (widthParam != null && widthParam.HasValue)
                        width = Math.Round(widthParam.AsDouble() * 304.8, 0);  // 转毫米
                    if (depthParam != null && depthParam.HasValue)
                        depth = Math.Round(depthParam.AsDouble() * 304.8, 0);

                    return new
                    {
                        ElementId = fs.Id.IntegerValue,
                        TypeName = fs.Name,
                        FamilyName = fs.FamilyName,
                        Category = fs.Category?.Name,
                        Width = width,
                        Depth = depth,
                        SizeDescription = width > 0 && depth > 0 ? $"{width}x{depth}" : "未知尺寸"
                    };
                })
                .Where(ct => string.IsNullOrEmpty(materialFilter) || 
                             ct.FamilyName.Contains(materialFilter) || 
                             ct.TypeName.Contains(materialFilter))
                .OrderBy(ct => ct.FamilyName)
                .ThenBy(ct => ct.TypeName)
                .ToList();

            return new
            {
                Count = columnTypes.Count,
                ColumnTypes = columnTypes
            };
        }

        /// <summary>
        /// 创建柱子
        /// </summary>
        private object CreateColumn(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            // 解析参数
            double x = parameters["x"]?.Value<double>() ?? 0;
            double y = parameters["y"]?.Value<double>() ?? 0;
            string bottomLevelName = parameters["bottomLevel"]?.Value<string>() ?? "Level 1";
            string topLevelName = parameters["topLevel"]?.Value<string>();
            string columnTypeName = parameters["columnType"]?.Value<string>();

            // 转换坐标（毫米 → 英尺）
            XYZ location = new XYZ(x / 304.8, y / 304.8, 0);

            using (Transaction trans = new Transaction(doc, "创建柱子"))
            {
                trans.Start();

                // 获取底部楼层
                Level bottomLevel = FindLevel(doc, bottomLevelName, true);

                // 获取柱类型（FamilySymbol）
                FamilySymbol columnSymbol = new FilteredElementCollector(doc)
                    .OfClass(typeof(FamilySymbol))
                    .Cast<FamilySymbol>()
                    .Where(fs => fs.Category != null &&
                        (fs.Category.Id.IntegerValue == (int)BuiltInCategory.OST_Columns ||
                         fs.Category.Id.IntegerValue == (int)BuiltInCategory.OST_StructuralColumns))
                    .FirstOrDefault(fs => string.IsNullOrEmpty(columnTypeName) || 
                                          fs.Name == columnTypeName ||
                                          fs.FamilyName.Contains(columnTypeName));

                if (columnSymbol == null)
                {
                    throw new Exception(string.IsNullOrEmpty(columnTypeName) 
                        ? "项目中没有可用的柱类型" 
                        : $"找不到柱类型: {columnTypeName}");
                }

                // 确保 FamilySymbol 已启用
                if (!columnSymbol.IsActive)
                {
                    columnSymbol.Activate();
                    doc.Regenerate();
                }

                // 创建柱子
                FamilyInstance column = doc.Create.NewFamilyInstance(
                    location,
                    columnSymbol,
                    bottomLevel,
                    Autodesk.Revit.DB.Structure.StructuralType.Column
                );

                // 设置顶部楼层（如果有指定）
                if (!string.IsNullOrEmpty(topLevelName))
                {
                    Level topLevel = new FilteredElementCollector(doc)
                        .OfClass(typeof(Level))
                        .Cast<Level>()
                        .FirstOrDefault(l => l.Name == topLevelName);

                    if (topLevel != null)
                    {
                        Parameter topLevelParam = column.get_Parameter(BuiltInParameter.FAMILY_TOP_LEVEL_PARAM);
                        if (topLevelParam != null && !topLevelParam.IsReadOnly)
                        {
                            topLevelParam.Set(topLevel.Id);
                        }
                    }
                }

                trans.Commit();

                return new
                {
                    ElementId = column.Id.IntegerValue,
                    ColumnType = columnSymbol.Name,
                    FamilyName = columnSymbol.FamilyName,
                    Level = bottomLevel.Name,
                    LocationX = x,
                    LocationY = y,
                    Message = $"成功创建柱子，ID: {column.Id.IntegerValue}"
                };
            }
        }

        /// <summary>
        /// 获取家具类型
        /// </summary>
        private object GetFurnitureTypes(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            string categoryFilter = parameters["category"]?.Value<string>();

            var furnitureTypes = new FilteredElementCollector(doc)
                .OfClass(typeof(FamilySymbol))
                .OfCategory(BuiltInCategory.OST_Furniture)
                .Cast<FamilySymbol>()
                .Select(fs => new
                {
                    ElementId = fs.Id.IntegerValue,
                    TypeName = fs.Name,
                    FamilyName = fs.FamilyName,
                    IsActive = fs.IsActive
                })
                .Where(ft => string.IsNullOrEmpty(categoryFilter) ||
                             ft.FamilyName.Contains(categoryFilter) ||
                             ft.TypeName.Contains(categoryFilter))
                .OrderBy(ft => ft.FamilyName)
                .ThenBy(ft => ft.TypeName)
                .ToList();

            return new
            {
                Count = furnitureTypes.Count,
                FurnitureTypes = furnitureTypes
            };
        }

        /// <summary>
        /// 放置家具
        /// </summary>
        private object PlaceFurniture(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            double x = parameters["x"]?.Value<double>() ?? 0;
            double y = parameters["y"]?.Value<double>() ?? 0;
            string furnitureTypeName = parameters["furnitureType"]?.Value<string>();
            string levelName = parameters["level"]?.Value<string>() ?? "Level 1";
            double rotation = parameters["rotation"]?.Value<double>() ?? 0;

            // 转换坐标（毫米 → 英尺）
            XYZ location = new XYZ(x / 304.8, y / 304.8, 0);

            using (Transaction trans = new Transaction(doc, "放置家具"))
            {
                trans.Start();

                // 获取楼层
                Level level = FindLevel(doc, levelName, true);

                // 获取家具类型
                FamilySymbol furnitureSymbol = new FilteredElementCollector(doc)
                    .OfClass(typeof(FamilySymbol))
                    .OfCategory(BuiltInCategory.OST_Furniture)
                    .Cast<FamilySymbol>()
                    .FirstOrDefault(fs => fs.Name == furnitureTypeName ||
                                          fs.FamilyName.Contains(furnitureTypeName));

                if (furnitureSymbol == null)
                {
                    throw new Exception($"找不到家具类型: {furnitureTypeName}");
                }

                // 确保 FamilySymbol 已启用
                if (!furnitureSymbol.IsActive)
                {
                    furnitureSymbol.Activate();
                    doc.Regenerate();
                }

                // 放置家具
                FamilyInstance furniture = doc.Create.NewFamilyInstance(
                    location,
                    furnitureSymbol,
                    level,
                    Autodesk.Revit.DB.Structure.StructuralType.NonStructural
                );

                // 旋转
                if (Math.Abs(rotation) > 0.001)
                {
                    Line axis = Line.CreateBound(location, location + XYZ.BasisZ);
                    ElementTransformUtils.RotateElement(doc, furniture.Id, axis, rotation * Math.PI / 180);
                }

                trans.Commit();

                return new
                {
                    ElementId = furniture.Id.IntegerValue,
                    FurnitureType = furnitureSymbol.Name,
                    FamilyName = furnitureSymbol.FamilyName,
                    Level = level.Name,
                    LocationX = x,
                    LocationY = y,
                    Rotation = rotation,
                    Message = $"成功放置家具，ID: {furniture.Id.IntegerValue}"
                };
            }
        }

        /// <summary>
        /// 获取房间信息
        /// </summary>
        private object GetRoomInfo(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            int? roomId = parameters["roomId"]?.Value<int>();
            string roomName = parameters["roomName"]?.Value<string>();

            Room room = null;

            if (roomId.HasValue)
            {
                room = doc.GetElement(new ElementId(roomId.Value)) as Room;
            }
            else if (!string.IsNullOrEmpty(roomName))
            {
                room = new FilteredElementCollector(doc)
                    .OfCategory(BuiltInCategory.OST_Rooms)
                    .WhereElementIsNotElementType()
                    .Cast<Room>()
                    .FirstOrDefault(r => r.Name.Contains(roomName) || 
                                         r.get_Parameter(BuiltInParameter.ROOM_NAME)?.AsString()?.Contains(roomName) == true);
            }

            if (room == null)
            {
                throw new Exception(roomId.HasValue 
                    ? $"找不到房间 ID: {roomId}" 
                    : $"找不到房间名称包含: {roomName}");
            }

            // 获取房间位置点
            LocationPoint locPoint = room.Location as LocationPoint;
            XYZ center = locPoint?.Point ?? XYZ.Zero;

            // 获取 BoundingBox
            BoundingBoxXYZ bbox = room.get_BoundingBox(null);
            
            // 获取面积
            double area = room.Area * 0.092903; // 平方英尺 → 平方米

            return new
            {
                ElementId = room.Id.IntegerValue,
                Name = room.get_Parameter(BuiltInParameter.ROOM_NAME)?.AsString(),
                Number = room.Number,
                Level = doc.GetElement(room.LevelId)?.Name,
                Area = Math.Round(area, 2),
                CenterX = Math.Round(center.X * 304.8, 2),
                CenterY = Math.Round(center.Y * 304.8, 2),
                BoundingBox = bbox != null ? new
                {
                    MinX = Math.Round(bbox.Min.X * 304.8, 2),
                    MinY = Math.Round(bbox.Min.Y * 304.8, 2),
                    MaxX = Math.Round(bbox.Max.X * 304.8, 2),
                    MaxY = Math.Round(bbox.Max.Y * 304.8, 2)
                } : null
            };
        }

        /// <summary>
        /// 获取楼层房间列表
        /// </summary>
        private object GetRoomsByLevel(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            string levelName = parameters["level"]?.Value<string>();
            bool includeUnnamed = parameters["includeUnnamed"]?.Value<bool>() ?? true;

            if (string.IsNullOrEmpty(levelName))
            {
                throw new Exception("请指定楼层名称");
            }

            // 获取指定楼层
            Level targetLevel = FindLevel(doc, levelName, false);

            // 获取该楼层的所有房间
            var rooms = new FilteredElementCollector(doc)
                .OfCategory(BuiltInCategory.OST_Rooms)
                .WhereElementIsNotElementType()
                .Cast<Room>()
                .Where(r => r.LevelId == targetLevel.Id)
                .Where(r => r.Area > 0) // 排除面积为 0 的房间（未封闭）
                .Select(r => 
                {
                    string roomName = r.get_Parameter(BuiltInParameter.ROOM_NAME)?.AsString();
                    bool hasName = !string.IsNullOrEmpty(roomName) && roomName != "房间";
                    
                    // 获取房间中心点
                    LocationPoint locPoint = r.Location as LocationPoint;
                    XYZ center = locPoint?.Point ?? XYZ.Zero;
                    
                    // 获取面积（平方英尺 → 平方平方米）
                    double areaM2 = r.Area * 0.092903;
                    
                    return new
                    {
                        ElementId = r.Id.IntegerValue,
                    Name = roomName ?? "未命名",
                        Number = r.Number,
                        Area = Math.Round(areaM2, 2),
                        HasName = hasName,
                        CenterX = Math.Round(center.X * 304.8, 2),
                        CenterY = Math.Round(center.Y * 304.8, 2)
                    };
                })
                .Where(r => includeUnnamed || r.HasName)
                .OrderBy(r => r.Number)
                .ToList();

            // 计算统计
            double totalArea = rooms.Sum(r => r.Area);
            int roomsWithName = rooms.Count(r => r.HasName);
            int roomsWithoutName = rooms.Count(r => !r.HasName);

            return new
            {
                Level = targetLevel.Name,
                LevelId = targetLevel.Id.IntegerValue,
                TotalRooms = rooms.Count,
                TotalArea = Math.Round(totalArea, 2),
                RoomsWithName = roomsWithName,
                RoomsWithoutName = roomsWithoutName,
                DataCompleteness = rooms.Count > 0 
                    ? $"{Math.Round((double)roomsWithName / rooms.Count * 100, 1)}%" 
                    : "N/A",
                Rooms = rooms
            };
        }

        private static Dictionary<int, string> _builtInCategoryNameById;

        private static Dictionary<int, string> GetBuiltInCategoryNameById()
        {
            if (_builtInCategoryNameById != null)
            {
                return _builtInCategoryNameById;
            }

            var map = new Dictionary<int, string>();
            foreach (BuiltInCategory bic in Enum.GetValues(typeof(BuiltInCategory)))
            {
                var id = (int)bic;
                if (!map.ContainsKey(id))
                {
                    map[id] = bic.ToString();
                }
            }

            _builtInCategoryNameById = map;
            return _builtInCategoryNameById;
        }

        private object GetCategories(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            int? viewId = parameters["viewId"]?.Value<int>();
            int sampleLimit = parameters["sampleLimit"]?.Value<int>() ?? 5000;
            int maxCount = parameters["maxCount"]?.Value<int>() ?? 200;

            ElementId targetViewId = viewId.HasValue ? new ElementId(viewId.Value) : doc.ActiveView.Id;
            var collector = new FilteredElementCollector(doc, targetViewId).WhereElementIsNotElementType();

            var builtInNameById = GetBuiltInCategoryNameById();
            var categoriesById = new Dictionary<int, Category>();

            int scanned = 0;
            foreach (var elem in collector)
            {
                scanned++;
                if (scanned > sampleLimit)
                {
                    break;
                }

                var cat = elem.Category;
                if (cat == null)
                {
                    continue;
                }

                var id = cat.Id.IntegerValue;
                if (!categoriesById.ContainsKey(id))
                {
                    categoriesById[id] = cat;
                }
            }

            var categories = categoriesById
                .Select(kvp =>
                {
                    var id = kvp.Key;
                    var cat = kvp.Value;
                    builtInNameById.TryGetValue(id, out var builtInName);
                    string queryName = null;
                    if (!string.IsNullOrEmpty(builtInName))
                    {
                        queryName = builtInName.StartsWith("OST_") ? builtInName.Substring(4) : builtInName;
                    }

                    return new
                    {
                        CategoryId = id,
                        CategoryName = cat.Name,
                        BuiltInCategory = builtInName,
                        QueryName = queryName
                    };
                })
                .OrderBy(c => c.QueryName ?? c.CategoryName)
                .Take(maxCount)
                .ToList();

            var commonAliases = new List<object>
            {
                new { Input = "柱", Category = "AllColumns" },
                new { Input = "结构柱", Category = "StructuralColumns" },
                new { Input = "墙", Category = "Walls" },
                new { Input = "门", Category = "Doors" },
                new { Input = "窗", Category = "Windows" },
                new { Input = "楼板", Category = "Floors" },
                new { Input = "房间", Category = "Rooms" },
                new { Input = "标注", Category = "Dimensions" }
            };

            return new
            {
                Success = true,
                ViewId = targetViewId.IntegerValue,
                ScannedElements = scanned,
                Count = categories.Count,
                Categories = categories,
                CommonAliases = commonAliases
            };
        }

        private object CreateRoom(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;

            string levelName = parameters["level"]?.Value<string>() ?? parameters["levelName"]?.Value<string>();
            if (string.IsNullOrEmpty(levelName))
            {
                throw new Exception("请指定 level 或 levelName");
            }

            double xMm = parameters["x"]?.Value<double>() ?? parameters["locationX"]?.Value<double>() ?? 0;
            double yMm = parameters["y"]?.Value<double>() ?? parameters["locationY"]?.Value<double>() ?? 0;
            string roomName = parameters["name"]?.Value<string>();
            string roomNumber = parameters["number"]?.Value<string>();

            Level targetLevel = FindLevel(doc, levelName, false);

            Room room;
            using (Transaction trans = new Transaction(doc, "Create Room"))
            {
                trans.Start();

                room = doc.Create.NewRoom(targetLevel, new UV(xMm / 304.8, yMm / 304.8));
                if (room == null)
                {
                    throw new Exception("创建房间失败（可能位置未封闭或视图/楼层不支持）");
                }

                if (!string.IsNullOrEmpty(roomName))
                {
                    var p = room.get_Parameter(BuiltInParameter.ROOM_NAME);
                    if (p != null && !p.IsReadOnly)
                    {
                        p.Set(roomName);
                    }
                }

                if (!string.IsNullOrEmpty(roomNumber))
                {
                    var p = room.get_Parameter(BuiltInParameter.ROOM_NUMBER);
                    if (p != null && !p.IsReadOnly)
                    {
                        p.Set(roomNumber);
                    }
                }

                trans.Commit();
            }

            LocationPoint locPoint = room.Location as LocationPoint;
            XYZ center = locPoint?.Point ?? XYZ.Zero;
            double areaM2 = room.Area * 0.092903;

            return new
            {
                Success = true,
                ElementId = room.Id.IntegerValue,
                Level = targetLevel.Name,
                Name = room.get_Parameter(BuiltInParameter.ROOM_NAME)?.AsString(),
                Number = room.Number,
                Area = Math.Round(areaM2, 2),
                CenterX = Math.Round(center.X * 304.8, 2),
                CenterY = Math.Round(center.Y * 304.8, 2)
            };
        }

        /// <summary>
        /// 获取所有视图
        /// </summary>
        private object GetAllViews(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            string viewTypeFilter = parameters["viewType"]?.Value<string>();
            string levelNameFilter = parameters["levelName"]?.Value<string>();

            var views = new FilteredElementCollector(doc)
                .OfClass(typeof(View))
                .Cast<View>()
                .Where(v => !v.IsTemplate && v.CanBePrinted)
                .Select(v =>
                {
                    string levelName = "";
                    if (v.GenLevel != null)
                    {
                        levelName = v.GenLevel.Name;
                    }

                    return new
                    {
                        ElementId = v.Id.IntegerValue,
                        Name = v.Name,
                        ViewType = v.ViewType.ToString(),
                        LevelName = levelName,
                        Scale = v.Scale
                    };
                })
                .Where(v => string.IsNullOrEmpty(viewTypeFilter) || 
                            v.ViewType.ToLower().Contains(viewTypeFilter.ToLower()))
                .Where(v => string.IsNullOrEmpty(levelNameFilter) || 
                            v.LevelName.Contains(levelNameFilter))
                .OrderBy(v => v.ViewType)
                .ThenBy(v => v.Name)
                .ToList();

            return new
            {
                Count = views.Count,
                Views = views
            };
        }

        /// <summary>
        /// 获取当前视图
        /// </summary>
        private object GetActiveView()
        {
            View activeView = _uiApp.ActiveUIDocument.ActiveView;
            Document doc = _uiApp.ActiveUIDocument.Document;

            string levelName = "";
            if (activeView.GenLevel != null)
            {
                levelName = activeView.GenLevel.Name;
            }

            return new
            {
                ElementId = activeView.Id.IntegerValue,
                Name = activeView.Name,
                ViewType = activeView.ViewType.ToString(),
                LevelName = levelName,
                Scale = activeView.Scale
            };
        }

        /// <summary>
        /// 切换视图
        /// </summary>
        private object SetActiveView(JObject parameters)
        {
            int viewId = parameters["viewId"]?.Value<int>() ?? 0;
            Document doc = _uiApp.ActiveUIDocument.Document;

            View view = doc.GetElement(new ElementId(viewId)) as View;
            if (view == null)
            {
                throw new Exception($"找不到视图 ID: {viewId}");
            }

            _uiApp.ActiveUIDocument.ActiveView = view;

            return new
            {
                Success = true,
                ViewId = viewId,
                ViewName = view.Name,
                Message = $"已切换至视图: {view.Name}"
            };
        }

        /// <summary>
        /// 选取元素
        /// </summary>
        private object SelectElement(JObject parameters)
        {
            var elementIds = new List<ElementId>();
            
            // 支持单一 ID
            if (parameters.ContainsKey("elementId"))
            {
                int id = parameters["elementId"].Value<int>();
                if (id > 0) elementIds.Add(new ElementId(id));
            }

            // 支持多个 ID
            if (parameters.ContainsKey("elementIds"))
            {
                var ids = parameters["elementIds"].Values<int>();
                foreach (var id in ids)
                {
                    if (id > 0) elementIds.Add(new ElementId(id));
                }
            }

            if (elementIds.Count == 0)
            {
                throw new Exception("未提供有效的 elementId 或 elementIds");
            }

            Document doc = _uiApp.ActiveUIDocument.Document;
            
            // 选取元素
            _uiApp.ActiveUIDocument.Selection.SetElementIds(elementIds);

            return new
            {
                Success = true,
                Count = elementIds.Count,
                Message = $"已选取 {elementIds.Count} 个元素"
            };
        }

        /// <summary>
        /// 缩放至元素
        /// </summary>
        private object ZoomToElement(JObject parameters)
        {
            int elementId = parameters["elementId"]?.Value<int>() ?? 0;
            Document doc = _uiApp.ActiveUIDocument.Document;

            Element element = doc.GetElement(new ElementId(elementId));
            if (element == null)
            {
                throw new Exception($"找不到元素 ID: {elementId}");
            }

            // 显示元素（会自动缩放）
            var elementIds = new List<ElementId> { new ElementId(elementId) };
            _uiApp.ActiveUIDocument.ShowElements(elementIds);

            return new
            {
                Success = true,
                ElementId = elementId,
                ElementName = element.Name,
                Message = $"已缩放至元素: {element.Name}"
            };
        }

        /// <summary>
        /// 测量距离
        /// </summary>
        private object MeasureDistance(JObject parameters)
        {
            double p1x = parameters["point1X"]?.Value<double>() ?? 0;
            double p1y = parameters["point1Y"]?.Value<double>() ?? 0;
            double p1z = parameters["point1Z"]?.Value<double>() ?? 0;
            double p2x = parameters["point2X"]?.Value<double>() ?? 0;
            double p2y = parameters["point2Y"]?.Value<double>() ?? 0;
            double p2z = parameters["point2Z"]?.Value<double>() ?? 0;

            // 转换为英尺
            XYZ point1 = new XYZ(p1x / 304.8, p1y / 304.8, p1z / 304.8);
            XYZ point2 = new XYZ(p2x / 304.8, p2y / 304.8, p2z / 304.8);

            double distanceFeet = point1.DistanceTo(point2);
            double distanceMm = distanceFeet * 304.8;

            return new
            {
                Distance = Math.Round(distanceMm, 2),
                Unit = "mm",
                Point1 = new { X = p1x, Y = p1y, Z = p1z },
                Point2 = new { X = p2x, Y = p2y, Z = p2z }
            };
        }

        /// <summary>
        /// 获取墙信息
        /// </summary>
        private object GetWallInfo(JObject parameters)
        {
            int wallId = parameters["wallId"]?.Value<int>() ?? 0;
            Document doc = _uiApp.ActiveUIDocument.Document;

            Wall wall = doc.GetElement(new ElementId(wallId)) as Wall;
            if (wall == null)
            {
                throw new Exception($"找不到墙 ID: {wallId}");
            }

            // 获取墙的位置曲线
            LocationCurve locCurve = wall.Location as LocationCurve;
            Curve curve = locCurve?.Curve;

            XYZ startPoint = curve?.GetEndPoint(0) ?? XYZ.Zero;
            XYZ endPoint = curve?.GetEndPoint(1) ?? XYZ.Zero;

            // 获取墙厚度
            double thickness = wall.Width * 304.8; // 英尺 → 毫米

            // 获取墙长度
            double length = curve != null ? curve.Length * 304.8 : 0;

            // 获取墙高度
            Parameter heightParam = wall.get_Parameter(BuiltInParameter.WALL_USER_HEIGHT_PARAM);
            double height = heightParam != null ? heightParam.AsDouble() * 304.8 : 0;

            return new
            {
                ElementId = wallId,
                Name = wall.Name,
                WallType = wall.WallType.Name,
                Thickness = Math.Round(thickness, 2),
                Length = Math.Round(length, 2),
                Height = Math.Round(height, 2),
                StartX = Math.Round(startPoint.X * 304.8, 2),
                StartY = Math.Round(startPoint.Y * 304.8, 2),
                EndX = Math.Round(endPoint.X * 304.8, 2),
                EndY = Math.Round(endPoint.Y * 304.8, 2),
                Level = doc.GetElement(wall.LevelId)?.Name
            };
        }

        /// <summary>
        /// 创建尺寸标注
        /// </summary>
        private object CreateDimension(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            
            int viewId = parameters["viewId"]?.Value<int>() ?? 0;
            double startX = parameters["startX"]?.Value<double>() ?? 0;
            double startY = parameters["startY"]?.Value<double>() ?? 0;
            double endX = parameters["endX"]?.Value<double>() ?? 0;
            double endY = parameters["endY"]?.Value<double>() ?? 0;
            double offset = parameters["offset"]?.Value<double>() ?? 500;

            View view = doc.GetElement(new ElementId(viewId)) as View;
            if (view == null)
            {
                throw new Exception($"找不到视图 ID: {viewId}");
            }

            using (Transaction trans = new Transaction(doc, "创建尺寸标注"))
            {
                trans.Start();

                // 转换坐标
                XYZ start = new XYZ(startX / 304.8, startY / 304.8, 0);
                XYZ end = new XYZ(endX / 304.8, endY / 304.8, 0);

                // 创建参考线
                Line line = Line.CreateBound(start, end);

                // 创建尺寸标注用的参考数组
                ReferenceArray refArray = new ReferenceArray();

                // 使用 DetailCurve 作为参考
                // 先创建两个详图线作为参考点
                XYZ perpDir = new XYZ(-(end.Y - start.Y), end.X - start.X, 0).Normalize();
                double offsetFeet = offset / 304.8;

                // 偏移后的标注线位置
                XYZ dimLinePoint = start.Add(perpDir.Multiply(offsetFeet));
                Line dimLine = Line.CreateBound(
                    start.Add(perpDir.Multiply(offsetFeet)),
                    end.Add(perpDir.Multiply(offsetFeet))
                );

                // 使用 NewDetailCurve 创建参考（创建足够长的线段）
                // 详图线应垂直于标注方向，作为标注的参考点
                double lineLength = 1.0; // 1 英尺 = 約 305mm

                // 使用 perpDir（垂直方向）来创建详图线
                DetailCurve dc1 = doc.Create.NewDetailCurve(view, Line.CreateBound(
                    start.Subtract(perpDir.Multiply(lineLength / 2)), 
                    start.Add(perpDir.Multiply(lineLength / 2))));
                DetailCurve dc2 = doc.Create.NewDetailCurve(view, Line.CreateBound(
                    end.Subtract(perpDir.Multiply(lineLength / 2)), 
                    end.Add(perpDir.Multiply(lineLength / 2))));

                refArray.Append(dc1.GeometryCurve.Reference);
                refArray.Append(dc2.GeometryCurve.Reference);

                // 创建尺寸标注
                Dimension dim = doc.Create.NewDimension(view, dimLine, refArray);

                // 注意：保留详图线作为标注参考点（如需删除请手动处理）

                trans.Commit();

                double dimValue = dim.Value.HasValue ? dim.Value.Value * 304.8 : 0;

                return new
                {
                    DimensionId = dim.Id.IntegerValue,
                    Value = Math.Round(dimValue, 2),
                    Unit = "mm",
                    ViewId = viewId,
                    ViewName = view.Name,
                    Message = $"成功创建尺寸标注: {Math.Round(dimValue, 0)} mm"
                };
            }
        }

        /// <summary>
        /// 查询指定位置附近的墙体
        /// </summary>
        private object QueryWallsByLocation(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            
            double centerX = parameters["x"]?.Value<double>() ?? 0;
            double centerY = parameters["y"]?.Value<double>() ?? 0;
            double searchRadius = parameters["searchRadius"]?.Value<double>() ?? 5000;
            string levelName = parameters["level"]?.Value<string>();

            // 转换为英尺
            XYZ center = new XYZ(centerX / 304.8, centerY / 304.8, 0);
            double radiusFeet = searchRadius / 304.8;

            // 获取所有墙
            var wallCollector = new FilteredElementCollector(doc)
                .OfClass(typeof(Wall))
                .WhereElementIsNotElementType()
                .Cast<Wall>();

            // 如果指定楼层，过滤楼层
            if (!string.IsNullOrEmpty(levelName))
            {
                var level = new FilteredElementCollector(doc)
                    .OfClass(typeof(Level))
                    .Cast<Level>()
                    .FirstOrDefault(l => l.Name.Contains(levelName));

                if (level != null)
                {
                    wallCollector = wallCollector.Where(w => w.LevelId == level.Id);
                }
            }

            var nearbyWalls = new List<object>();

            foreach (var wall in wallCollector)
            {
                LocationCurve locCurve = wall.Location as LocationCurve;
                if (locCurve == null) continue;

                Curve curve = locCurve.Curve;
                XYZ startPoint = curve.GetEndPoint(0);
                XYZ endPoint = curve.GetEndPoint(1);
                
                // 计算点到线段的最近距离
                XYZ wallDir = (endPoint - startPoint).Normalize();
                XYZ toCenter = center - startPoint;
                double proj = toCenter.DotProduct(wallDir);
                double wallLength = curve.Length;
                
                XYZ closestPoint;
                if (proj < 0)
                    closestPoint = startPoint;
                else if (proj > wallLength)
                    closestPoint = endPoint;
                else
                    closestPoint = startPoint + wallDir * proj;
                
                double distToWall = center.DistanceTo(closestPoint) * 304.8;

                if (distToWall <= searchRadius)
                {
                    // 获取墙厚度
                    double thickness = wall.Width * 304.8;
                    
                    // 计算墙的方向向量（垂直于位置线）
                    XYZ perpendicular = new XYZ(-wallDir.Y, wallDir.X, 0);
                    double halfThickness = wall.Width / 2;
                    
                    // 墙的两个面
                    XYZ face1Point = closestPoint + perpendicular * halfThickness;
                    XYZ face2Point = closestPoint - perpendicular * halfThickness;

                    nearbyWalls.Add(new
                    {
                        ElementId = wall.Id.IntegerValue,
                        Name = wall.Name,
                        WallType = wall.WallType.Name,
                        Thickness = Math.Round(thickness, 2),
                        Length = Math.Round(curve.Length * 304.8, 2),
                        DistanceToCenter = Math.Round(distToWall, 2),
                        // 位置线坐标
                        LocationLine = new
                        {
                            StartX = Math.Round(startPoint.X * 304.8, 2),
                            StartY = Math.Round(startPoint.Y * 304.8, 2),
                            EndX = Math.Round(endPoint.X * 304.8, 2),
                            EndY = Math.Round(endPoint.Y * 304.8, 2)
                        },
                        // 最近点位置
                        ClosestPoint = new
                        {
                            X = Math.Round(closestPoint.X * 304.8, 2),
                            Y = Math.Round(closestPoint.Y * 304.8, 2)
                        },
                        // 两侧面坐标（在最近点处）
                        Face1 = new
                        {
                            X = Math.Round(face1Point.X * 304.8, 2),
                            Y = Math.Round(face1Point.Y * 304.8, 2)
                        },
                        Face2 = new
                        {
                            X = Math.Round(face2Point.X * 304.8, 2),
                            Y = Math.Round(face2Point.Y * 304.8, 2)
                        },
                        // 判断墙是水平还是垂直
                        Orientation = Math.Abs(wallDir.X) > Math.Abs(wallDir.Y) ? "Horizontal" : "Vertical"
                    });
                }
            }

            // 直接返回列表（已在搜索时过滤距离）

            return new
            {
                Count = nearbyWalls.Count,
                SearchCenter = new { X = centerX, Y = centerY },
                SearchRadius = searchRadius,
                Walls = nearbyWalls
            };
        }


        /// <summary>
        /// 查询视图中的元素
        /// </summary>
        private object QueryElements(JObject parameters)
        {
            try
            {
                string categoryName = parameters["category"]?.Value<string>();
                int? viewId = parameters["viewId"]?.Value<int>();
                int maxCount = parameters["maxCount"]?.Value<int>() ?? 100;
                
                Document doc = _uiApp.ActiveUIDocument.Document;
                
                if (string.IsNullOrEmpty(categoryName))
                {
                    throw new Exception("必须提供 category 参数");
                }

                categoryName = categoryName.Trim();
                var aliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "柱", "AllColumns" },
                    { "柱子", "AllColumns" },
                    { "结构柱", "StructuralColumns" },
                    { "墙", "Walls" },
                    { "墙体", "Walls" },
                    { "门", "Doors" },
                    { "窗", "Windows" },
                    { "楼板", "Floors" },
                    { "地板", "Floors" },
                    { "房间", "Rooms" },
                    { "标注", "Dimensions" },
                    { "尺寸", "Dimensions" },
                    { "尺寸标注", "Dimensions" }
                };
                if (aliases.TryGetValue(categoryName, out var mappedCategory))
                {
                    categoryName = mappedCategory;
                }
                
                // 决定查询范围: 指定视图 或 当前视图
                ElementId targetViewId = viewId.HasValue ? new ElementId(viewId.Value) : doc.ActiveView.Id;
                
                FilteredElementCollector collector = new FilteredElementCollector(doc, targetViewId);
                
                // 尝试解析 BuiltInCategory
                BuiltInCategory category = BuiltInCategory.INVALID;
                bool isBuiltIn = Enum.TryParse("OST_" + categoryName, true, out category) || 
                                 Enum.TryParse(categoryName, true, out category);
                
                List<Element> elements = new List<Element>();
                
                if (isBuiltIn && category != BuiltInCategory.INVALID)
                {
                    elements = collector.OfCategory(category).ToElements().ToList();
                }
                else
                {
                    // 尝试用 Class 查询
                    if (categoryName.Equals("Dimensions", StringComparison.OrdinalIgnoreCase))
                    {
                        elements = collector.OfClass(typeof(Dimension)).ToElements().ToList();
                    }
                    else if (categoryName.Equals("Walls", StringComparison.OrdinalIgnoreCase))
                    {
                        elements = collector.OfClass(typeof(Wall)).ToElements().ToList();
                    }
                    else if (categoryName.Equals("Rooms", StringComparison.OrdinalIgnoreCase))
                    {
                        elements = collector.OfCategory(BuiltInCategory.OST_Rooms).ToElements().ToList();
                    }
                    else if (categoryName.Equals("StructuralColumns", StringComparison.OrdinalIgnoreCase))
                    {
                        elements = collector.OfCategory(BuiltInCategory.OST_StructuralColumns).ToElements().ToList();
                    }
                    else if (categoryName.Equals("Columns", StringComparison.OrdinalIgnoreCase))
                    {
                        elements = collector.OfCategory(BuiltInCategory.OST_Columns).ToElements().ToList();
                    }
                    else if (categoryName.Equals("AllColumns", StringComparison.OrdinalIgnoreCase))
                    {
                        var cols = collector.OfCategory(BuiltInCategory.OST_Columns).ToElements();
                        var structCols = collector.OfCategory(BuiltInCategory.OST_StructuralColumns).ToElements();
                        elements = cols.Concat(structCols)
                            .GroupBy(e => e.Id.IntegerValue)
                            .Select(g => g.First())
                            .ToList();
                    }
                    else
                    {
                        throw new Exception($"不支持的类别: {categoryName}。可先调用 get_categories 获取当前视图实际出现的类别；常用值示例: Walls, Doors, Windows, Floors, Rooms, Columns, StructuralColumns, Dimensions");
                    }
                }
                
                // 提取基本信息
                var resultList = elements.Take(maxCount).Select(elem =>
                {
                    var item = new Dictionary<string, object>
                    {
                        { "ElementId", elem.Id.IntegerValue },
                        { "Name", elem.Name ?? "" },
                        { "Category", elem.Category?.Name ?? "" }
                    };
                    
                    // 特殊处理 Dimension
                    if (elem is Dimension dim)
                    {
                        if (dim.Value.HasValue)
                            item.Add("Value", Math.Round(dim.Value.Value * 304.8, 2)); // 转 mm
                        if (dim.DimensionType != null)
                            item.Add("DimensionType", dim.DimensionType.Name);
                    }
                    
                    return item;
                }).ToList();
                
                return new
                {
                    Success = true,
                    Count = resultList.Count,
                    TotalFound = elements.Count,
                    ViewId = targetViewId.IntegerValue,
                    Category = categoryName,
                    Elements = resultList
                };
            }
            catch (Exception ex)
            {
                 throw new Exception($"查询元素失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 覆写元素图形显示
        /// 支持平面图（切割样式）和立面图/剖面图（表面样式）
        /// </summary>
        private object OverrideElementGraphics(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            int elementId = parameters["elementId"].Value<int>();
            int? viewId = parameters["viewId"]?.Value<int>();

            // 获取视图
            View view;
            if (viewId.HasValue)
            {
                view = doc.GetElement(new ElementId(viewId.Value)) as View;
                if (view == null)
                    throw new Exception($"找不到视图 ID: {viewId}");
            }
            else
            {
                view = _uiApp.ActiveUIDocument.ActiveView;
            }

            // 获取元素
            Element element = doc.GetElement(new ElementId(elementId));
            if (element == null)
                throw new Exception($"找不到元素 ID: {elementId}");

            // 判断使用切割样式或表面样式
            // patternMode: "auto" (自动根据视图类型), "cut" (切割), "surface" (表面)
            string patternMode = parameters["patternMode"]?.Value<string>() ?? "auto";
            
            bool useCutPattern = false;
            if (patternMode == "cut")
            {
                useCutPattern = true;
            }
            else if (patternMode == "surface")
            {
                useCutPattern = false;
            }
            else // auto
            {
                // 平面图、天花板平面图使用切割样式
                // 立面图、剖面图、3D 视图使用表面样式
                useCutPattern = (view.ViewType == ViewType.FloorPlan || 
                                 view.ViewType == ViewType.CeilingPlan ||
                                 view.ViewType == ViewType.AreaPlan ||
                                 view.ViewType == ViewType.EngineeringPlan);
            }

            using (Transaction trans = new Transaction(doc, "Override Element Graphics"))
            {
                trans.Start();

                // 创建覆写设置
                OverrideGraphicSettings overrideSettings = new OverrideGraphicSettings();

                // 获取实心填充图样 ID
                ElementId solidPatternId = GetSolidFillPatternId(doc);

                // 设置填充颜色
                if (parameters["surfaceFillColor"] != null)
                {
                    var colorObj = parameters["surfaceFillColor"];
                    byte r = (byte)colorObj["r"].Value<int>();
                    byte g = (byte)colorObj["g"].Value<int>();
                    byte b = (byte)colorObj["b"].Value<int>();
                    Color fillColor = new Color(r, g, b);

                    if (useCutPattern)
                    {
                        // 平面图：使用切割样式（前景）
                        overrideSettings.SetCutForegroundPatternColor(fillColor);
                        if (solidPatternId != null && solidPatternId != ElementId.InvalidElementId)
                        {
                            overrideSettings.SetCutForegroundPatternId(solidPatternId);
                            overrideSettings.SetCutForegroundPatternVisible(true);
                        }
                    }
                    else
                    {
                        // 立面图/剖面图：使用表面样式
                        overrideSettings.SetSurfaceForegroundPatternColor(fillColor);
                        if (solidPatternId != null && solidPatternId != ElementId.InvalidElementId)
                        {
                            overrideSettings.SetSurfaceForegroundPatternId(solidPatternId);
                            overrideSettings.SetSurfaceForegroundPatternVisible(true);
                        }
                    }
                }

                // 设置线条颜色（可选）
                if (parameters["lineColor"] != null)
                {
                    var lineColorObj = parameters["lineColor"];
                    byte r = (byte)lineColorObj["r"].Value<int>();
                    byte g = (byte)lineColorObj["g"].Value<int>();
                    byte b = (byte)lineColorObj["b"].Value<int>();
                    Color lineColor = new Color(r, g, b);
                    
                    if (useCutPattern)
                    {
                        overrideSettings.SetCutLineColor(lineColor);
                    }
                    else
                    {
                        overrideSettings.SetProjectionLineColor(lineColor);
                    }
                }

                // 设置透明度
                int transparency = parameters["transparency"]?.Value<int>() ?? 0;
                if (transparency > 0)
                {
                    overrideSettings.SetSurfaceTransparency(transparency);
                }

                // 应用覆写
                view.SetElementOverrides(new ElementId(elementId), overrideSettings);

                trans.Commit();

                return new
                {
                    Success = true,
                    ElementId = elementId,
                    ViewId = view.Id.IntegerValue,
                    ViewType = view.ViewType.ToString(),
                    PatternMode = useCutPattern ? "Cut" : "Surface",
                    ViewName = view.Name,
                    Message = $"已成功覆写元素 {elementId} 在视图 '{view.Name}' 的图形显示"
                };
            }
        }

        /// <summary>
        /// 清除元素图形覆写
        /// </summary>
        private object ClearElementOverride(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            int? singleElementId = parameters["elementId"]?.Value<int>();
            var elementIdsArray = parameters["elementIds"] as JArray;
            int? viewId = parameters["viewId"]?.Value<int>();

            // 获取视图
            View view;
            if (viewId.HasValue)
            {
                view = doc.GetElement(new ElementId(viewId.Value)) as View;
                if (view == null)
                    throw new Exception($"找不到视图 ID: {viewId}");
            }
            else
            {
                view = _uiApp.ActiveUIDocument.ActiveView;
            }

            // 收集要清除的元素 ID
            List<int> elementIds = new List<int>();
            if (singleElementId.HasValue)
            {
                elementIds.Add(singleElementId.Value);
            }
            if (elementIdsArray != null)
            {
                elementIds.AddRange(elementIdsArray.Select(id => id.Value<int>()));
            }

            if (elementIds.Count == 0)
            {
                throw new Exception("请提供至少一个元素 ID");
            }

            using (Transaction trans = new Transaction(doc, "Clear Element Override"))
            {
                trans.Start();

                int successCount = 0;
                foreach (int elemId in elementIds)
                {
                    Element element = doc.GetElement(new ElementId(elemId));
                    if (element != null)
                    {
                        // 设置空的覆写设置 = 重置为默认
                        view.SetElementOverrides(new ElementId(elemId), new OverrideGraphicSettings());
                        successCount++;
                    }
                }

                trans.Commit();

                return new
                {
                    Success = true,
                    ClearedCount = successCount,
                    ViewId = view.Id.IntegerValue,
                    ViewName = view.Name,
                    Message = $"已清除 {successCount} 个元素在视图 '{view.Name}' 的图形覆写"
                };
            }
        }

        /// <summary>
        /// 获取实心填充图样 ID
        /// </summary>
        private ElementId GetSolidFillPatternId(Document doc)
        {
            // 尝试找到实心填充图样
            FilteredElementCollector collector = new FilteredElementCollector(doc);
            var fillPatterns = collector
                .OfClass(typeof(FillPatternElement))
                .Cast<FillPatternElement>()
                .Where(fp => fp.GetFillPattern().IsSolidFill)
                .ToList();

            if (fillPatterns.Any())
            {
                return fillPatterns.First().Id;
            }

            return ElementId.InvalidElementId;
        }

        // 静态变量：保存取消接合的元素对
        private static List<Tuple<ElementId, ElementId>> _unjoinedPairs = new List<Tuple<ElementId, ElementId>>();

        /// <summary>
        /// 取消墙体与其他元素（柱子等）的接合关系
        /// </summary>
        private object UnjoinWallJoins(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            
            // 获取墙体 ID 列表
            var wallIdsArray = parameters["wallIds"] as JArray;
            int? viewId = parameters["viewId"]?.Value<int>();
            
            List<int> wallIds = new List<int>();
            if (wallIdsArray != null)
            {
                wallIds.AddRange(wallIdsArray.Select(id => id.Value<int>()));
            }
            
            // 如果没有提供 wallIds，则查询视图中所有墙体
            if (wallIds.Count == 0 && viewId.HasValue)
            {
                var collector = new FilteredElementCollector(doc, new ElementId(viewId.Value));
                var walls = collector.OfClass(typeof(Wall)).ToElements();
                wallIds = walls.Select(w => w.Id.IntegerValue).ToList();
            }
            
            if (wallIds.Count == 0)
            {
                throw new Exception("请提供 wallIds 或 viewId 参数");
            }

            int unjoinedCount = 0;
            _unjoinedPairs.Clear();

            using (Transaction trans = new Transaction(doc, "Unjoin Wall Geometry"))
            {
                trans.Start();

                foreach (int wallId in wallIds)
                {
                    Wall wall = doc.GetElement(new ElementId(wallId)) as Wall;
                    if (wall == null) continue;

                    // 获取墙体的 BoundingBox 来找附近的柱子
                    BoundingBoxXYZ bbox = wall.get_BoundingBox(null);
                    if (bbox == null) continue;

                    // 扩大搜索范围
                    XYZ min = bbox.Min - new XYZ(1, 1, 1);
                    XYZ max = bbox.Max + new XYZ(1, 1, 1);
                    Outline outline = new Outline(min, max);

                    // 查询附近的柱子
                    var columnCollector = new FilteredElementCollector(doc)
                        .OfCategory(BuiltInCategory.OST_Columns)
                        .WherePasses(new BoundingBoxIntersectsFilter(outline));
                    
                    var structColumnCollector = new FilteredElementCollector(doc)
                        .OfCategory(BuiltInCategory.OST_StructuralColumns)
                        .WherePasses(new BoundingBoxIntersectsFilter(outline));

                    var columns = columnCollector.ToElements().Concat(structColumnCollector.ToElements());

                    foreach (Element column in columns)
                    {
                        try
                        {
                            if (JoinGeometryUtils.AreElementsJoined(doc, wall, column))
                            {
                                JoinGeometryUtils.UnjoinGeometry(doc, wall, column);
                                _unjoinedPairs.Add(new Tuple<ElementId, ElementId>(wall.Id, column.Id));
                                unjoinedCount++;
                            }
                        }
                        catch
                        {
                            // 忽略无法取消接合的元素
                        }
                    }
                }

                trans.Commit();
            }

            return new
            {
                Success = true,
                UnjoinedCount = unjoinedCount,
                WallCount = wallIds.Count,
                StoredPairs = _unjoinedPairs.Count,
                Message = $"已取消 {unjoinedCount} 个接合关系"
            };
        }

        /// <summary>
        /// 恢复之前取消的接合关系
        /// </summary>
        private object RejoinWallJoins(JObject parameters)
        {
            Document doc = _uiApp.ActiveUIDocument.Document;
            
            if (_unjoinedPairs.Count == 0)
            {
                return new
                {
                    Success = true,
                    RejoinedCount = 0,
                    Message = "没有需要恢复的接合关系"
                };
            }

            int rejoinedCount = 0;

            using (Transaction trans = new Transaction(doc, "Rejoin Wall Geometry"))
            {
                trans.Start();

                foreach (var pair in _unjoinedPairs)
                {
                    try
                    {
                        Element elem1 = doc.GetElement(pair.Item1);
                        Element elem2 = doc.GetElement(pair.Item2);
                        
                        if (elem1 != null && elem2 != null)
                        {
                            if (!JoinGeometryUtils.AreElementsJoined(doc, elem1, elem2))
                            {
                                JoinGeometryUtils.JoinGeometry(doc, elem1, elem2);
                                rejoinedCount++;
                            }
                        }
                    }
                    catch
                    {
                        // 忽略无法恢复接合的元素
                    }
                }

                trans.Commit();
            }

            int storedCount = _unjoinedPairs.Count;
            _unjoinedPairs.Clear();

            return new
            {
                Success = true,
                RejoinedCount = rejoinedCount,
                TotalPairs = storedCount,
                Message = $"已恢复 {rejoinedCount} 个接合关系"
            };
        }

        #endregion
    }
}



