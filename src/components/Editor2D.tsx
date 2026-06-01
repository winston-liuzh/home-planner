import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Circle, Group, Text, Ellipse } from 'react-konva';
import { usePlannerStore } from '../store/plannerStore';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { PlacedFurniture, Wall, Point2D } from '../types';

const GRID_SIZE = 20;    // 小网格 20cm
const GRID_MAJOR = 100;  // 大网格 100cm (1m)
const MIN_SCALE = 0.15;
const MAX_SCALE = 4;
const SNAP_RADIUS = 15;  // 端点吸附半径 cm
const WALL_HIT_WIDTH = 16; // 墙体点击热区宽度 cm

export default function Editor2D() {
  const {
    project, toolMode, selection, wallDrawing, pendingFurnitureModelId,
    selectItem, moveFurniture, rotateFurniture, resizeFurniture,
    addWall, removeWall, moveWallPoint,
    setWallDrawingStart, setWallDrawingEnd,
    setPendingFurnitureModelId, addFurniture,
    deleteSelected, updateWall,
  } = usePlannerStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 100, y: 50 });
  const [stageScale, setStageScale] = useState(0.8);
  const [mouseCm, setMouseCm] = useState<Point2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Wall dragging state
  const [wallDragging, setWallDragging] = useState<{
    wallId: string;
    type: 'point' | 'body';  // 拖端点 vs 拖整体
    point?: 'start' | 'end'; // 拖哪个端点
    startWallPos?: { start: Point2D; end: Point2D }; // body拖拽时的初始位置
    dragOffset?: Point2D; // body拖拽时的鼠标偏移
  } | null>(null);

  // Responsive canvas sizing
  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setStageSize({ width: rect.width, height: rect.height });
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === 'r' || e.key === 'R') {
        if (selection?.type === 'furniture') {
          rotateFurniture(selection.id,
            (project.furniture.find(f => f.id === selection.id)?.rotation ?? 0) + 45);
        }
      }
      if (e.key === 'Escape') {
        selectItem(null);
        setPendingFurnitureModelId(null);
        setWallDrawingStart(null);
        setWallDrawingEnd(null);
        setWallDragging(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection, project.furniture, deleteSelected, rotateFurniture, selectItem, setPendingFurnitureModelId, setWallDrawingStart, setWallDrawingEnd]);

  // Convert screen coords to cm world coords
  const screenToCm = useCallback((screenX: number, screenY: number): Point2D => {
    return {
      x: (screenX - stagePos.x) / stageScale,
      y: (screenY - stagePos.y) / stageScale,
    };
  }, [stagePos, stageScale]);

  const snapCm = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  const snapPoint = (p: Point2D): Point2D => ({ x: snapCm(p.x), y: snapCm(p.y) });

  const getPointerCm = useCallback((): Point2D => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return snapPoint(screenToCm(pos.x, pos.y));
  }, [screenToCm]);

  // ===== 查找所有墙端点（用于吸附） =====
  const allWallEndpoints = useMemo(() => {
    const walls = project.rooms.flatMap(r => r.walls);
    const points: Point2D[] = [];
    walls.forEach(w => {
      points.push(w.start, w.end);
    });
    return points;
  }, [project.rooms]);

  // 端点吸附：找到最近的已有端点
  const snapToEndpoint = useCallback((p: Point2D): Point2D => {
    let closest = p;
    let minDist = SNAP_RADIUS;
    for (const ep of allWallEndpoints) {
      const dist = Math.sqrt((ep.x - p.x) ** 2 + (ep.y - p.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = ep;
      }
    }
    return closest;
  }, [allWallEndpoints]);

  // 综合吸附：先网格，再端点（端点优先）
  const smartSnap = useCallback((p: Point2D): Point2D => {
    const gridSnapped = snapPoint(p);
    const epSnapped = snapToEndpoint(gridSnapped);
    return epSnapped;
  }, [snapPoint, snapToEndpoint]);

  // Wheel zoom
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.08;
    const oldScale = stageScale;
    const newScale = e.evt.deltaY < 0
      ? Math.min(oldScale * scaleBy, MAX_SCALE)
      : Math.max(oldScale / scaleBy, MIN_SCALE);

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [stageScale, stagePos]);

  // Middle/right mouse button pan
  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || e.evt.button === 2) {
      e.evt.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.evt.clientX - stagePos.x, y: e.evt.clientY - stagePos.y });
    }
  }, [stagePos]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    // Update mouse position in cm
    const stage = stageRef.current;
    if (stage) {
      const pos = stage.getPointerPosition();
      if (pos) {
        const cm = screenToCm(pos.x, pos.y);
        setMouseCm({ x: Math.round(cm.x), y: Math.round(cm.y) });
      }
    }

    // Pan
    if (isPanning) {
      setStagePos({
        x: e.evt.clientX - panStart.x,
        y: e.evt.clientY - panStart.y,
      });
      return;
    }

    // Wall drawing preview — 实时跟随鼠标，吸附到网格和端点
    if (toolMode === 'wall' && wallDrawing.start) {
      const rawCm = screenToCm(e.evt.clientX - (containerRef.current?.getBoundingClientRect().left ?? 0), e.evt.clientY - (containerRef.current?.getBoundingClientRect().top ?? 0));
      setWallDrawingEnd(smartSnap(rawCm));
    }

    // Wall body drag — 实时移动整面墙
    if (wallDragging?.type === 'body' && wallDragging.startWallPos) {
      const cm = getPointerCm();
      const dx = cm.x - (wallDragging.dragOffset?.x ?? 0) - wallDragging.startWallPos.start.x;
      const dy = cm.y - (wallDragging.dragOffset?.y ?? 0) - wallDragging.startWallPos.start.y;
      const newStart = snapPoint({ x: wallDragging.startWallPos.start.x + dx, y: wallDragging.startWallPos.start.y + dy });
      const newEnd = snapPoint({ x: wallDragging.startWallPos.end.x + dx, y: wallDragging.startWallPos.end.y + dy });
      // 实时更新墙位置
      updateWall(wallDragging.wallId, { start: newStart, end: newEnd });
    }
  }, [isPanning, panStart, screenToCm, toolMode, wallDrawing, getPointerCm, setWallDrawingEnd, smartSnap, wallDragging, updateWall]);

  const handleMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || e.evt.button === 2) {
      setIsPanning(false);
    }
  }, []);

  // ===== Planner 5D 风格画墙：按下拖拽松手 =====
  const handleStageMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    // 只处理左键
    if (e.evt.button !== 0) return;
    // 只在画墙模式下生效
    if (toolMode !== 'wall') return;
    // 忽略点击到图形上的情况
    const clickedOnEmpty = e.target === e.target.getStage();
    if (!clickedOnEmpty) return;

    const rawCm = screenToCm(
      e.evt.clientX - (containerRef.current?.getBoundingClientRect().left ?? 0),
      e.evt.clientY - (containerRef.current?.getBoundingClientRect().top ?? 0)
    );
    const start = smartSnap(rawCm);
    setWallDrawingStart(start);
    setWallDrawingEnd(start); // 初始end = start
  }, [toolMode, screenToCm, smartSnap, setWallDrawingStart, setWallDrawingEnd]);

  const handleStageMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;

    // 画墙模式：松手确认
    if (toolMode === 'wall' && wallDrawing.start && wallDrawing.end) {
      const dx = wallDrawing.end.x - wallDrawing.start.x;
      const dy = wallDrawing.end.y - wallDrawing.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      // 至少 20cm 才算有效墙段
      if (len >= 20) {
        addWall(wallDrawing.start, wallDrawing.end);
        // Planner 5D 风格：连续画墙，终点自动成为下一段起点
        setWallDrawingStart(wallDrawing.end);
      } else {
        setWallDrawingStart(null);
      }
      setWallDrawingEnd(null);
      return;
    }

    // 墙体body拖拽结束
    if (wallDragging?.type === 'body') {
      setWallDragging(null);
    }
  }, [toolMode, wallDrawing, addWall, setWallDrawingStart, setWallDrawingEnd, wallDragging]);

  // Stage click — 工具分发
  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    const clickedOnEmpty = e.target === e.target.getStage();
    if (!clickedOnEmpty) return;

    const cm = getPointerCm();

    // 家具放置
    if (toolMode === 'furniture' && pendingFurnitureModelId) {
      addFurniture(pendingFurnitureModelId, cm);
      return;
    }

    // 选择模式：点空白取消选择
    if (toolMode === 'select') {
      selectItem(null);
    }
  }, [toolMode, pendingFurnitureModelId, getPointerCm, addFurniture, selectItem]);

  // 家具拖拽放置
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const modelId = e.dataTransfer.getData('furniture-model-id');
    if (!modelId) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cm = snapPoint(screenToCm(e.clientX - rect.left, e.clientY - rect.top));
    addFurniture(modelId, cm);
    setPendingFurnitureModelId(null);
  }, [screenToCm, addFurniture, setPendingFurnitureModelId]);

  // 家具拖拽结束
  const handleFurnitureDragEnd = useCallback((id: string, e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const pos = snapPoint({ x: node.x(), y: node.y() });
    moveFurniture(id, pos);
  }, [moveFurniture]);

  // ===== 墙体端点拖拽 =====
  const handleWallPointDragStart = useCallback((wallId: string, point: 'start' | 'end') => {
    setWallDragging({ wallId, type: 'point', point });
    selectItem({ type: 'wall', id: wallId });
  }, [selectItem]);

  const handleWallPointDragMove = useCallback((wallId: string, point: 'start' | 'end', e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const rawPos = { x: node.x(), y: node.y() };
    // 吸附到网格和已有端点
    const snapped = smartSnap(rawPos);
    node.x(snapped.x);
    node.y(snapped.y);
    moveWallPoint(wallId, point, snapped);

    // 联动：查找连接到这个端点的其他墙，也移动它们的端点
    const walls = project.rooms.flatMap(r => r.walls);
    const currentWall = walls.find(w => w.id === wallId);
    if (!currentWall) return;
    const movedPoint = point === 'start' ? currentWall.start : currentWall.end;
    const otherPoint = point === 'start' ? currentWall.end : currentWall.start;

    walls.forEach(w => {
      if (w.id === wallId) return;
      // 检查其他墙的端点是否与被拖端点重合（原始位置接近）
      const threshold = 2; // 2cm阈值
      if (Math.abs(w.start.x - movedPoint.x) < threshold && Math.abs(w.start.y - movedPoint.y) < threshold) {
        // 这个墙的start端点也跟着移动
        moveWallPoint(w.id, 'start', snapped);
      }
      if (Math.abs(w.end.x - movedPoint.x) < threshold && Math.abs(w.end.y - movedPoint.y) < threshold) {
        moveWallPoint(w.id, 'end', snapped);
      }
    });
  }, [smartSnap, moveWallPoint, project.rooms]);

  const handleWallPointDragEnd = useCallback(() => {
    setWallDragging(null);
  }, []);

  // ===== 墙体整体拖拽 =====
  const handleWallBodyDragStart = useCallback((wallId: string, e: KonvaEventObject<DragEvent>) => {
    const walls = project.rooms.flatMap(r => r.walls);
    const wall = walls.find(w => w.id === wallId);
    if (!wall) return;
    const cm = getPointerCm();
    setWallDragging({
      wallId,
      type: 'body',
      startWallPos: { start: { ...wall.start }, end: { ...wall.end } },
      dragOffset: { x: cm.x - wall.start.x, y: cm.y - wall.start.y },
    });
    selectItem({ type: 'wall', id: wallId });
  }, [project.rooms, getPointerCm, selectItem]);

  // Grid rendering
  const gridLayer = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const viewLeft = -stagePos.x / stageScale;
    const viewTop = -stagePos.y / stageScale;
    const viewRight = viewLeft + stageSize.width / stageScale;
    const viewBottom = viewTop + stageSize.height / stageScale;

    const startX = Math.floor(viewLeft / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
    const endX = Math.ceil(viewRight / GRID_SIZE) * GRID_SIZE + GRID_SIZE;
    const startY = Math.floor(viewTop / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
    const endY = Math.ceil(viewBottom / GRID_SIZE) * GRID_SIZE + GRID_SIZE;

    if (stageScale > 0.4) {
      for (let x = startX; x <= endX; x += GRID_SIZE) {
        lines.push(
          <Line key={`gv${x}`} points={[x, startY, x, endY]} stroke="#2A2A4A" strokeWidth={0.5 / stageScale} />
        );
      }
      for (let y = startY; y <= endY; y += GRID_SIZE) {
        lines.push(
          <Line key={`gh${y}`} points={[startX, y, endX, y]} stroke="#2A2A4A" strokeWidth={0.5 / stageScale} />
        );
      }
    }

    const majorStart = Math.floor(viewLeft / GRID_MAJOR) * GRID_MAJOR - GRID_MAJOR;
    const majorEnd = Math.ceil(viewRight / GRID_MAJOR) * GRID_MAJOR + GRID_MAJOR;
    const majorStartY = Math.floor(viewTop / GRID_MAJOR) * GRID_MAJOR - GRID_MAJOR;
    const majorEndY = Math.ceil(viewBottom / GRID_MAJOR) * GRID_MAJOR + GRID_MAJOR;

    for (let x = majorStart; x <= majorEnd; x += GRID_MAJOR) {
      lines.push(
        <Line key={`mgv${x}`} points={[x, startY, x, endY]} stroke="#3A3A5A" strokeWidth={1 / stageScale} />
      );
    }
    for (let y = majorStartY; y <= majorEndY; y += GRID_MAJOR) {
      lines.push(
        <Line key={`mgh${y}`} points={[startX, y, endX, y]} stroke="#3A3A5A" strokeWidth={1 / stageScale} />
      );
    }

    return lines;
  }, [stagePos, stageScale, stageSize]);

  // Scale ruler text
  const rulerLabels = useMemo(() => {
    const labels: React.ReactNode[] = [];
    const viewLeft = -stagePos.x / stageScale;
    const viewTop = -stagePos.y / stageScale;
    const viewRight = viewLeft + stageSize.width / stageScale;
    const viewBottom = viewTop + stageSize.height / stageScale;

    const step = stageScale > 0.5 ? GRID_MAJOR : GRID_MAJOR * 2;
    const startX = Math.floor(viewLeft / step) * step;
    const startY = Math.floor(viewTop / step) * step;

    for (let x = startX; x <= viewRight; x += step) {
      const label = x === 0 ? '0' : `${x / 100}m`;
      labels.push(
        <Text key={`rx${x}`} x={x} y={viewTop + 2 / stageScale} text={label}
          fontSize={10 / stageScale} fill="#8888AA" />
      );
    }
    for (let y = startY; y <= viewBottom; y += step) {
      if (y === 0) continue;
      const label = `${y / 100}m`;
      labels.push(
        <Text key={`ry${y}`} x={viewLeft + 2 / stageScale} y={y} text={label}
          fontSize={10 / stageScale} fill="#8888AA" />
      );
    }
    return labels;
  }, [stagePos, stageScale, stageSize]);

  const walls = project.rooms.flatMap((r) => r.walls);
  const selectedWall = selection?.type === 'wall' ? walls.find(w => w.id === selection.id) : null;
  const selectedFurniture = selection?.type === 'furniture' ? project.furniture.find(f => f.id === selection.id) : null;

  // 墙体模式光标
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (toolMode === 'wall') return 'crosshair';
    if (toolMode === 'furniture') return 'crosshair';
    return 'default';
  };

  return (
    <div
      className="editor-2d"
      ref={containerRef}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onClick={handleStageClick}
        onMouseMove={handleMouseMove}
        onMouseDown={(e) => { handleMouseDown(e); handleStageMouseDown(e); }}
        onMouseUp={(e) => { handleMouseUp(e); handleStageMouseUp(e); }}
        onWheel={handleWheel}
        style={{ cursor: getCursor() }}
      >
        <Layer>
          {/* Grid */}
          {gridLayer}
          {rulerLabels}

          {/* Origin marker */}
          <Line points={[-10, 0, 10, 0]} stroke="#FF6B35" strokeWidth={1 / stageScale} />
          <Line points={[0, -10, 0, 10]} stroke="#FF6B35" strokeWidth={1 / stageScale} />

          {/* Walls */}
          {walls.map((wall) => (
            <WallShape
              key={wall.id}
              wall={wall}
              isSelected={selection?.type === 'wall' && selection.id === wall.id}
              scale={stageScale}
              onSelect={() => selectItem({ type: 'wall', id: wall.id })}
              onPointDragStart={(point) => handleWallPointDragStart(wall.id, point)}
              onPointDragMove={(point, e) => handleWallPointDragMove(wall.id, point, e)}
              onPointDragEnd={handleWallPointDragEnd}
              onBodyDragStart={(e) => handleWallBodyDragStart(wall.id, e)}
              onDelete={() => removeWall(wall.id)}
            />
          ))}

          {/* Wall drawing preview — Planner 5D 风格：按下拖拽实时预览 */}
          {wallDrawing.start && wallDrawing.end && (
            <>
              <Line
                points={[wallDrawing.start.x, wallDrawing.start.y, wallDrawing.end.x, wallDrawing.end.y]}
                stroke="#FF6B35"
                strokeWidth={3 / stageScale}
                dash={[8 / stageScale, 4 / stageScale]}
              />
              <Circle x={wallDrawing.start.x} y={wallDrawing.start.y} radius={6 / stageScale} fill="#FF6B35" stroke="#FFF" strokeWidth={1.5 / stageScale} />
              <Circle x={wallDrawing.end.x} y={wallDrawing.end.y} radius={6 / stageScale} fill="#FF6B35" stroke="#FFF" strokeWidth={1.5 / stageScale} />
              <WallLengthLabel start={wallDrawing.start} end={wallDrawing.end} scale={stageScale} />
            </>
          )}

          {/* Furniture */}
          {project.furniture.map((item) => (
            <FurnitureShape
              key={item.id}
              item={item}
              isSelected={selection?.type === 'furniture' && selection.id === item.id}
              scale={stageScale}
              onSelect={() => selectItem({ type: 'furniture', id: item.id })}
              onDragEnd={(e) => handleFurnitureDragEnd(item.id, e)}
              onRotate={(angle) => rotateFurniture(item.id, angle)}
              onResize={(w, d) => resizeFurniture(item.id, w, d)}
            />
          ))}
        </Layer>
      </Stage>

      {/* Status bar */}
      <div className="editor-status">
        <span>坐标: {mouseCm.x}cm, {mouseCm.y}cm</span>
        <span>缩放: {Math.round(stageScale * 100)}%</span>
        <span>工具: {toolMode === 'wall' ? '画墙' : toolMode === 'furniture' ? '放家具' : '选择'}</span>
        <span className="status-hint">
          {toolMode === 'wall' ? '按住拖拽画墙 | 连续画 | Esc结束' :
           toolMode === 'furniture' ? '点击画布放置家具，Esc取消' :
           '滚轮缩放 | 中键/右键拖拽平移 | Delete删除 | R旋转'}
        </span>
      </div>
    </div>
  );
}

// ===== Wall Length Label =====
function WallLengthLabel({ start, end, scale }: { start: Point2D; end: Point2D; scale: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  // 旋转角度保持在可读范围(-90~90)
  const readableAngle = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;

  return (
    <Group x={midX} y={midY} rotation={readableAngle}>
      <Rect
        x={-25 / scale} y={-12 / scale}
        width={50 / scale} height={14 / scale}
        fill="rgba(0,0,0,0.75)" cornerRadius={3 / scale}
      />
      <Text
        text={`${Math.round(len)}cm`}
        fontSize={10 / scale}
        fill="#FF6B35"
        width={50 / scale}
        height={14 / scale}
        align="center"
        verticalAlign="middle"
        x={-25 / scale} y={-12 / scale}
      />
    </Group>
  );
}

// ===== Wall rendering — Planner 5D 风格 =====
function WallShape({
  wall, isSelected, scale, onSelect,
  onPointDragStart, onPointDragMove, onPointDragEnd,
  onBodyDragStart, onDelete,
}: {
  wall: Wall;
  isSelected: boolean;
  scale: number;
  onSelect: () => void;
  onPointDragStart: (point: 'start' | 'end') => void;
  onPointDragMove: (point: 'start' | 'end', e: KonvaEventObject<DragEvent>) => void;
  onPointDragEnd: () => void;
  onBodyDragStart: (e: KonvaEventObject<DragEvent>) => void;
  onDelete: () => void;
}) {
  const thickness = Math.max(wall.thickness, 4 / scale);
  const midX = (wall.start.x + wall.end.x) / 2;
  const midY = (wall.start.y + wall.end.y) / 2;

  return (
    <Group>
      {/* 墙体主体 — 可拖拽整体移动 */}
      <Line
        points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
        stroke={isSelected ? '#FF6B35' : '#777'}
        strokeWidth={thickness}
        lineCap="square"
        hitStrokeWidth={WALL_HIT_WIDTH}
        onClick={(e) => { e.cancelBubble = true; onSelect(); }}
        onMouseEnter={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'move'; }}
        onMouseLeave={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'default'; }}
      />

      {/* 墙体长度标注 — 始终显示 */}
      <WallLengthLabel start={wall.start} end={wall.end} scale={scale} />

      {/* 选中时显示端点和操作 */}
      {isSelected && (
        <>
          {/* 端点 — 可拖拽，带吸附 */}
          <Circle
            x={wall.start.x} y={wall.start.y}
            radius={7 / scale} fill="#FF6B35" stroke="#FFF" strokeWidth={2 / scale}
            draggable
            onDragStart={() => onPointDragStart('start')}
            onDragMove={(e) => onPointDragMove('start', e)}
            onDragEnd={onPointDragEnd}
            onMouseEnter={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'crosshair'; }}
            onMouseLeave={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'move'; }}
          />
          <Circle
            x={wall.end.x} y={wall.end.y}
            radius={7 / scale} fill="#FF6B35" stroke="#FFF" strokeWidth={2 / scale}
            draggable
            onDragStart={() => onPointDragStart('end')}
            onDragMove={(e) => onPointDragMove('end', e)}
            onDragEnd={onPointDragEnd}
            onMouseEnter={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'crosshair'; }}
            onMouseLeave={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'move'; }}
          />

          {/* 墙体整体拖拽区域提示线（虚线边框） */}
          <Line
            points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
            stroke="rgba(255,107,53,0.3)"
            strokeWidth={thickness + 8 / scale}
            lineCap="square"
            dash={[6 / scale, 4 / scale]}
            onClick={(e) => { e.cancelBubble = true; onSelect(); }}
          />

          {/* 删除按钮 */}
          <Group
            x={midX}
            y={midY - thickness / 2 - 18 / scale}
            onClick={(e) => { e.cancelBubble = true; onDelete(); }}
            onMouseEnter={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'pointer'; }}
            onMouseLeave={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'default'; }}
          >
            <Rect x={-10 / scale} y={-8 / scale} width={20 / scale} height={16 / scale}
              fill="#E94560" cornerRadius={3 / scale} />
            <Text text="✕" fontSize={11 / scale} fill="#FFF"
              x={-5 / scale} y={-7 / scale} />
          </Group>

          {/* 墙体厚度标注 */}
          <Group x={midX} y={midY}>
            <Rect
              x={-20 / scale} y={thickness / 2 + 2 / scale}
              width={40 / scale} height={12 / scale}
              fill="rgba(0,0,0,0.6)" cornerRadius={2 / scale}
            />
            <Text
              text={`${wall.thickness}cm`}
              fontSize={8 / scale} fill="#AAA"
              width={40 / scale} height={12 / scale}
              align="center" verticalAlign="middle"
              x={-20 / scale} y={thickness / 2 + 2 / scale}
            />
          </Group>
        </>
      )}
    </Group>
  );
}

// ===== Furniture rendering with full editing handles =====
function FurnitureShape({
  item, isSelected, scale, onSelect, onDragEnd, onRotate, onResize,
}: {
  item: PlacedFurniture;
  isSelected: boolean;
  scale: number;
  onSelect: () => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onRotate: (angle: number) => void;
  onResize: (width: number, depth: number) => void;
}) {
  const w = item.width;
  const d = item.depth;
  const handleSize = 8 / scale;

  return (
    <Group
      x={item.position.x}
      y={item.position.y}
      rotation={item.rotation}
      offsetX={w / 2}
      offsetY={d / 2}
      draggable
      onClick={(e) => { e.cancelBubble = true; onSelect(); }}
      onTap={onSelect}
      onDragEnd={onDragEnd}
    >
      {/* Main shape */}
      {item.shape === 'circle' ? (
        <Ellipse
          x={w / 2} y={d / 2}
          radiusX={w / 2} radiusY={d / 2}
          fill={item.color}
          stroke={isSelected ? '#FF6B35' : '#666'}
          strokeWidth={isSelected ? 2 / scale : 1 / scale}
          opacity={0.85}
        />
      ) : (
        <Rect
          width={w} height={d}
          fill={item.color}
          stroke={isSelected ? '#FF6B35' : '#666'}
          strokeWidth={isSelected ? 2 / scale : 1 / scale}
          cornerRadius={2 / scale}
          opacity={0.85}
        />
      )}

      {/* Name label */}
      <Text
        text={item.name}
        fontSize={Math.max(10, Math.min(14, Math.min(w, d) * 0.15)) / scale}
        fill="#FFF"
        width={w}
        height={d}
        align="center"
        verticalAlign="middle"
        fontStyle="bold"
        stroke="#000"
        strokeWidth={0.3 / scale}
      />

      {/* Dimension label */}
      {(w * scale > 40 && d * scale > 25) && (
        <Text
          text={`${Math.round(w)}×${Math.round(d)}`}
          fontSize={8 / scale}
          fill="rgba(255,255,255,0.7)"
          width={w}
          y={d - 10 / scale}
          align="center"
        />
      )}

      {/* Selection handles */}
      {isSelected && (
        <>
          {/* Corner resize handles */}
          <Rect x={-handleSize / 2} y={-handleSize / 2} width={handleSize} height={handleSize}
            fill="#FF6B35" stroke="#FFF" strokeWidth={1 / scale}
            draggable
            onDragMove={(e) => {
              const node = e.target;
              const newX = node.x() + handleSize / 2;
              const newW = Math.max(20, w + (newX - 0));
              onResize(newW, d);
              node.x(-handleSize / 2);
              node.y(-handleSize / 2);
            }}
          />
          <Rect x={w - handleSize / 2} y={-handleSize / 2} width={handleSize} height={handleSize}
            fill="#FF6B35" stroke="#FFF" strokeWidth={1 / scale}
            draggable
            onDragMove={(e) => {
              const node = e.target;
              const newW = Math.max(20, node.x() + handleSize / 2);
              onResize(newW, d);
              node.x(w - handleSize / 2);
              node.y(-handleSize / 2);
            }}
          />
          <Rect x={-handleSize / 2} y={d - handleSize / 2} width={handleSize} height={handleSize}
            fill="#FF6B35" stroke="#FFF" strokeWidth={1 / scale}
            draggable
            onDragMove={(e) => {
              const node = e.target;
              const newD = Math.max(20, node.y() + handleSize / 2);
              onResize(w, newD);
              node.x(-handleSize / 2);
              node.y(d - handleSize / 2);
            }}
          />
          <Rect x={w - handleSize / 2} y={d - handleSize / 2} width={handleSize} height={handleSize}
            fill="#FF6B35" stroke="#FFF" strokeWidth={1 / scale}
            draggable
            onDragMove={(e) => {
              const node = e.target;
              const newW = Math.max(20, node.x() + handleSize / 2);
              const newD = Math.max(20, node.y() + handleSize / 2);
              onResize(newW, newD);
              node.x(w - handleSize / 2);
              node.y(d - handleSize / 2);
            }}
          />

          {/* Rotation handle */}
          <Line points={[w / 2, 0, w / 2, -25 / scale]} stroke="#FF6B35" strokeWidth={1.5 / scale} dash={[4 / scale, 2 / scale]} />
          <Circle
            x={w / 2} y={-25 / scale}
            radius={8 / scale}
            fill="#FF6B35"
            stroke="#FFF"
            strokeWidth={1.5 / scale}
            onClick={(e) => {
              e.cancelBubble = true;
              onRotate(item.rotation + 45);
            }}
          />
          <Text text="↻" x={w / 2 - 5 / scale} y={-30 / scale} fontSize={11 / scale} fill="#FFF" />

          {/* Delete button */}
          <Group
            x={w + 5 / scale} y={-5 / scale}
            onClick={(e) => { e.cancelBubble = true; usePlannerStore.getState().removeFurniture(item.id); }}
          >
            <Rect x={0} y={0} width={16 / scale} height={16 / scale}
              fill="#E94560" cornerRadius={3 / scale} />
            <Text text="✕" fontSize={10 / scale} fill="#FFF" x={3 / scale} y={1 / scale} />
          </Group>
        </>
      )}
    </Group>
  );
}
