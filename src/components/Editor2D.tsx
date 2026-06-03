import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Circle, Group, Text, Ellipse } from 'react-konva';
import { usePlannerStore } from '../store/plannerStore';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import type { PlacedFurniture, Wall, Point2D } from '../types';

const GRID_SIZE = 20;
const GRID_MAJOR = 100;
const MIN_SCALE = 0.15;
const MAX_SCALE = 4;
const SNAP_RADIUS = 15;
const WALL_HIT_WIDTH = 16;
const ANGLE_SNAP_THRESHOLD = 0.15;
const CLOSE_ROOM_RADIUS = 20;

function snapCm(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

function snapPoint(p: Point2D): Point2D {
  return { x: snapCm(p.x), y: snapCm(p.y) };
}

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function angleSnapPoint(start: Point2D, end: Point2D): Point2D {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > 5 && absDy / absDx < ANGLE_SNAP_THRESHOLD) {
    return { x: end.x, y: start.y };
  }
  if (absDy > 5 && absDx / absDy < ANGLE_SNAP_THRESHOLD) {
    return { x: start.x, y: end.y };
  }
  return end;
}

function pointToSegmentNearest(p: Point2D, a: Point2D, b: Point2D): Point2D {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1) return a;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * abx, y: a.y + t * aby };
}

export default function Editor2D() {
  const project = usePlannerStore((s) => s.project);
  const toolMode = usePlannerStore((s) => s.toolMode);
  const selection = usePlannerStore((s) => s.selection);
  const wallDrawing = usePlannerStore((s) => s.wallDrawing);
  const pendingFurnitureModelId = usePlannerStore((s) => s.pendingFurnitureModelId);
  const boxSelectionIds = usePlannerStore((s) => s.boxSelectionIds);

  const selectItem = usePlannerStore((s) => s.selectItem);
  const moveFurniture = usePlannerStore((s) => s.moveFurniture);
  const rotateFurniture = usePlannerStore((s) => s.rotateFurniture);
  const resizeFurniture = usePlannerStore((s) => s.resizeFurniture);
  const addWall = usePlannerStore((s) => s.addWall);
  const removeWall = usePlannerStore((s) => s.removeWall);
  const moveWallPoint = usePlannerStore((s) => s.moveWallPoint);
  const setWallDrawingStart = usePlannerStore((s) => s.setWallDrawingStart);
  const setWallDrawingEnd = usePlannerStore((s) => s.setWallDrawingEnd);
  const setWallDrawingFirstPoint = usePlannerStore((s) => s.setWallDrawingFirstPoint);
  const resetWallDrawing = usePlannerStore((s) => s.resetWallDrawing);
  const setPendingFurnitureModelId = usePlannerStore((s) => s.setPendingFurnitureModelId);
  const addFurniture = usePlannerStore((s) => s.addFurniture);
  const deleteSelected = usePlannerStore((s) => s.deleteSelected);
  const deleteItems = usePlannerStore((s) => s.deleteItems);
  const updateWall = usePlannerStore((s) => s.updateWall);
  const setBoxSelectionIds = usePlannerStore((s) => s.setBoxSelectionIds);
  const ungroupWalls = usePlannerStore((s) => s.ungroupWalls);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<KonvaStage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 100, y: 50 });
  const [stageScale, setStageScale] = useState(0.8);
  const [mouseCm, setMouseCm] = useState<Point2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [wallDragging, setWallDragging] = useState<{
    wallId: string;
    type: 'point' | 'body';
    point?: 'start' | 'end';
    startWallPos?: { start: Point2D; end: Point2D };
    dragOffset?: Point2D;
    groupStartPos?: Record<string, { start: Point2D; end: Point2D }>;
  } | null>(null);

  const [snapPreview, setSnapPreview] = useState<Point2D | null>(null);
  const [boxSelectRect, setBoxSelectRect] = useState<{ start: Point2D; end: Point2D } | null>(null);
  const [boxSelectStart, setBoxSelectStart] = useState<Point2D | null>(null);
  const [ungroupConfirmId, setUngroupConfirmId] = useState<string | null>(null);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (boxSelectionIds.length > 0) {
          deleteItems(boxSelectionIds);
        } else {
          deleteSelected();
        }
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
        resetWallDrawing();
        setWallDragging(null);
        setBoxSelectionIds([]);
        setBoxSelectRect(null);
        setBoxSelectStart(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection, project.furniture, deleteSelected, deleteItems, rotateFurniture, selectItem, setPendingFurnitureModelId, resetWallDrawing, boxSelectionIds, setBoxSelectionIds]);

  const screenToCm = useCallback((screenX: number, screenY: number): Point2D => {
    return {
      x: (screenX - stagePos.x) / stageScale,
      y: (screenY - stagePos.y) / stageScale,
    };
  }, [stagePos, stageScale]);

  const getPointerCm = useCallback((): Point2D => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return snapPoint(screenToCm(pos.x, pos.y));
  }, [screenToCm]);

  const allWallEndpoints = useMemo(() => {
    const walls = project.rooms.flatMap(r => r.walls);
    const points: Point2D[] = [];
    walls.forEach(w => {
      points.push(w.start, w.end);
    });
    return points;
  }, [project.rooms]);

  const allWalls = useMemo(() => {
    return project.rooms.flatMap(r => r.walls);
  }, [project.rooms]);

  const snapToWalls = useCallback((p: Point2D, excludeWallId?: string): Point2D => {
    let closest = p;
    let minDist = SNAP_RADIUS;

    // 优先吸附端点
    for (const ep of allWallEndpoints) {
      const d = dist(ep, p);
      if (d < minDist) {
        minDist = d;
        closest = ep;
      }
    }

    // 吸附到墙体线段上的最近点（排除当前拖拽的墙，避免端点被吸回自身墙线）
    for (const w of allWalls) {
      if (excludeWallId && w.id === excludeWallId) continue;
      const nearest = pointToSegmentNearest(p, w.start, w.end);
      const d = dist(nearest, p);
      if (d < minDist) {
        minDist = d;
        closest = nearest;
      }
    }

    return closest;
  }, [allWallEndpoints, allWalls]);

  const smartSnap = useCallback((p: Point2D, excludeWallId?: string): Point2D => {
    const gridSnapped = snapPoint(p);
    return snapToWalls(gridSnapped, excludeWallId);
  }, [snapToWalls]);

  const smartSnapWithAngle = useCallback((start: Point2D | null, rawEnd: Point2D): Point2D => {
    const snapped = smartSnap(rawEnd);
    if (!start) return snapped;
    return angleSnapPoint(start, snapped);
  }, [smartSnap]);

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

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || e.evt.button === 2) {
      e.evt.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.evt.clientX - stagePos.x, y: e.evt.clientY - stagePos.y });
    }
  }, [stagePos]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (stage) {
      const pos = stage.getPointerPosition();
      if (pos) {
        const rawCm = screenToCm(pos.x, pos.y);
        setMouseCm({ x: Math.round(rawCm.x), y: Math.round(rawCm.y) });

        if (toolMode === 'wall') {
          const gridSnapped = snapPoint(rawCm);
          const wallSnapped = snapToWalls(gridSnapped);
          if (dist(wallSnapped, gridSnapped) < SNAP_RADIUS) {
            setSnapPreview(wallSnapped);
          } else {
            setSnapPreview(null);
          }
        } else {
          setSnapPreview(null);
        }
      }
    }

    if (isPanning) {
      setStagePos({
        x: e.evt.clientX - panStart.x,
        y: e.evt.clientY - panStart.y,
      });
      return;
    }

    if (toolMode === 'wall' && wallDrawing.start) {
      const stage = stageRef.current;
      if (stage) {
        const pos = stage.getPointerPosition();
        if (pos) {
          const rawCm = screenToCm(pos.x, pos.y);
          const snapped = smartSnapWithAngle(wallDrawing.start, rawCm);
          setWallDrawingEnd(snapped);
        }
      }
    }

    if (toolMode === 'select' && boxSelectStart) {
      const stage = stageRef.current;
      if (stage) {
        const pos = stage.getPointerPosition();
        if (pos) {
          const rawCm = screenToCm(pos.x, pos.y);
          setBoxSelectRect({ start: boxSelectStart, end: rawCm });
        }
      }
    }

    if (wallDragging?.type === 'body' && wallDragging.startWallPos) {
      const cm = getPointerCm();
      const dx = cm.x - (wallDragging.dragOffset?.x ?? 0) - wallDragging.startWallPos.start.x;
      const dy = cm.y - (wallDragging.dragOffset?.y ?? 0) - wallDragging.startWallPos.start.y;
      const newStart = snapPoint({ x: wallDragging.startWallPos.start.x + dx, y: wallDragging.startWallPos.start.y + dy });
      const newEnd = snapPoint({ x: wallDragging.startWallPos.end.x + dx, y: wallDragging.startWallPos.end.y + dy });
      updateWall(wallDragging.wallId, { start: newStart, end: newEnd });
    }
  }, [isPanning, panStart, screenToCm, toolMode, wallDrawing, getPointerCm, setWallDrawingEnd, smartSnapWithAngle, wallDragging, updateWall, boxSelectStart, snapToWalls]);

  const handleMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || e.evt.button === 2) {
      setIsPanning(false);
    }

    if (e.evt.button === 0 && wallDragging?.type === 'body') {
      setWallDragging(null);
    }

    if (e.evt.button === 0 && toolMode === 'select' && boxSelectRect) {
      const walls = project.rooms.flatMap(r => r.walls);
      const furniture = project.furniture;
      const ids: string[] = [];

      const minX = Math.min(boxSelectRect.start.x, boxSelectRect.end.x);
      const maxX = Math.max(boxSelectRect.start.x, boxSelectRect.end.x);
      const minY = Math.min(boxSelectRect.start.y, boxSelectRect.end.y);
      const maxY = Math.max(boxSelectRect.start.y, boxSelectRect.end.y);

      const rectArea = (maxX - minX) * (maxY - minY);
      if (rectArea < 100) {
        setBoxSelectRect(null);
        setBoxSelectStart(null);
        return;
      }

      for (const w of walls) {
        if ((w.start.x >= minX && w.start.x <= maxX && w.start.y >= minY && w.start.y <= maxY) ||
            (w.end.x >= minX && w.end.x <= maxX && w.end.y >= minY && w.end.y <= maxY)) {
          ids.push(w.id);
        }
      }
      for (const f of furniture) {
        if (f.position.x >= minX && f.position.x <= maxX && f.position.y >= minY && f.position.y <= maxY) {
          ids.push(f.id);
        }
      }

      setBoxSelectionIds(ids);
      setBoxSelectRect(null);
      setBoxSelectStart(null);
    }
  }, [wallDragging, toolMode, boxSelectRect, project, setBoxSelectionIds]);

  const handleStageMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    const clickedOnEmpty = e.target === e.target.getStage();
    if (!clickedOnEmpty) return;

    if (toolMode === 'select') {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const rawCm = screenToCm(pos.x, pos.y);
      setBoxSelectStart(rawCm);
    }
  }, [toolMode, screenToCm]);

  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    const clickedOnEmpty = e.target === e.target.getStage();

    if (toolMode === 'wall' && clickedOnEmpty) {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const rawCm = screenToCm(pos.x, pos.y);
      const clickedPt = smartSnap(rawCm);

      if (!wallDrawing.start) {
        setWallDrawingStart(clickedPt);
        setWallDrawingEnd(clickedPt);
        setWallDrawingFirstPoint(clickedPt);
        return;
      }

      const snappedEnd = smartSnapWithAngle(wallDrawing.start, rawCm);
      const len = dist(wallDrawing.start, snappedEnd);
      if (len < 20) return;

      if (wallDrawing.firstPoint && dist(snappedEnd, wallDrawing.firstPoint) < CLOSE_ROOM_RADIUS) {
        addWall(wallDrawing.start, wallDrawing.firstPoint);
        resetWallDrawing();
        return;
      }

      addWall(wallDrawing.start, snappedEnd);
      setWallDrawingStart(snappedEnd);
      setWallDrawingEnd(snappedEnd);
      return;
    }

    if (toolMode === 'furniture' && clickedOnEmpty && pendingFurnitureModelId) {
      const cm = getPointerCm();
      addFurniture(pendingFurnitureModelId, cm);
      return;
    }

    if (toolMode === 'select' && clickedOnEmpty) {
      if (boxSelectionIds.length > 0) {
        setBoxSelectionIds([]);
      } else {
        selectItem(null);
      }
    }
  }, [toolMode, pendingFurnitureModelId, screenToCm, smartSnap, smartSnapWithAngle, wallDrawing, addWall, setWallDrawingStart, setWallDrawingEnd, setWallDrawingFirstPoint, resetWallDrawing, getPointerCm, addFurniture, selectItem, boxSelectionIds, setBoxSelectionIds]);

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

  const handleFurnitureDragEnd = useCallback((id: string, e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const pos = snapPoint({ x: node.x(), y: node.y() });
    moveFurniture(id, pos);
  }, [moveFurniture]);

  const handleWallPointDragStart = useCallback((wallId: string, point: 'start' | 'end') => {
    setWallDragging({ wallId, type: 'point', point });
    selectItem({ type: 'wall', id: wallId });
  }, [selectItem]);

  const handleWallPointDragMove = useCallback((wallId: string, point: 'start' | 'end', e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const rawPos = { x: node.x(), y: node.y() };
    const snapped = smartSnap(rawPos, wallId);
    node.x(snapped.x);
    node.y(snapped.y);
    moveWallPoint(wallId, point, snapped);

    // 联动：如果其他墙的端点与当前拖拽点重合，一起移动
    const walls = project.rooms.flatMap(r => r.walls);
    walls.forEach(w => {
      if (w.id === wallId) return;
      const threshold = 2;
      if (dist(w.start, snapped) < threshold) {
        moveWallPoint(w.id, 'start', snapped);
      }
      if (dist(w.end, snapped) < threshold) {
        moveWallPoint(w.id, 'end', snapped);
      }
    });
  }, [smartSnap, moveWallPoint, project.rooms]);

  const handleWallPointDragEnd = useCallback(() => {
    setWallDragging(null);
  }, []);

  const handleWallBodyDragStart = useCallback((wallId: string) => {
    const allWalls = project.rooms.flatMap(r => r.walls);
    const wall = allWalls.find(w => w.id === wallId);
    if (!wall) return;
    // 记录同组墙体初始位置
    let groupStartPos: Record<string, { start: Point2D; end: Point2D }> | undefined;
    if (wall.groupId) {
      groupStartPos = {};
      allWalls.forEach(w => {
        if (w.groupId === wall.groupId) {
          groupStartPos![w.id] = { start: { ...w.start }, end: { ...w.end } };
        }
      });
    }
    setWallDragging({
      wallId,
      type: 'body',
      startWallPos: { start: { ...wall.start }, end: { ...wall.end } },
      groupStartPos,
    });
    selectItem({ type: 'wall', id: wallId });
  }, [project.rooms, selectItem]);

  const handleWallBodyDragMove = useCallback((wallId: string, e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const rawDx = node.x() - (wallDragging?.startWallPos?.start.x ?? 0);
    const rawDy = node.y() - (wallDragging?.startWallPos?.start.y ?? 0);
    node.x(0);
    node.y(0);

    if (!wallDragging?.startWallPos) return;
    const { startWallPos } = wallDragging;
    const newStart = snapPoint({ x: startWallPos.start.x + rawDx, y: startWallPos.start.y + rawDy });
    const newEnd = snapPoint({ x: startWallPos.end.x + rawDx, y: startWallPos.end.y + rawDy });
    updateWall(wallId, { start: newStart, end: newEnd });

    // 联动同组墙体一起移动
    const allWalls = project.rooms.flatMap(r => r.walls);
    const currentWall = allWalls.find(w => w.id === wallId);
    if (currentWall?.groupId) {
      allWalls.forEach(w => {
        if (w.id === wallId || w.groupId !== currentWall.groupId) return;
        const origStart = wallDragging.groupStartPos?.[w.id];
        if (!origStart) return;
        const gs = snapPoint({ x: origStart.start.x + rawDx, y: origStart.start.y + rawDy });
        const ge = snapPoint({ x: origStart.end.x + rawDx, y: origStart.end.y + rawDy });
        updateWall(w.id, { start: gs, end: ge });
      });
    }
  }, [wallDragging, updateWall, project.rooms]);

  const handleWallBodyDragEnd = useCallback(() => {
    setWallDragging(null);
  }, []);

  const gridLayer = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const MAX_GRID_LINES = 300;
    const viewLeft = -stagePos.x / stageScale;
    const viewTop = -stagePos.y / stageScale;
    const viewRight = viewLeft + stageSize.width / stageScale;
    const viewBottom = viewTop + stageSize.height / stageScale;

    const startX = Math.floor(viewLeft / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
    const endX = Math.ceil(viewRight / GRID_SIZE) * GRID_SIZE + GRID_SIZE;
    const startY = Math.floor(viewTop / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
    const endY = Math.ceil(viewBottom / GRID_SIZE) * GRID_SIZE + GRID_SIZE;

    if (stageScale > 0.4) {
      const minorLineCount = Math.ceil((endX - startX) / GRID_SIZE) + Math.ceil((endY - startY) / GRID_SIZE);
      if (minorLineCount <= MAX_GRID_LINES) {
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
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: getCursor() }}
      >
        <Layer>
          {/* 非交互层：网格、标尺、原点、预览、吸附提示、框选框 */}
          <Group listening={false}>
            {gridLayer}
            {rulerLabels}
            <Line points={[-10, 0, 10, 0]} stroke="#FF6B35" strokeWidth={1 / stageScale} />
            <Line points={[0, -10, 0, 10]} stroke="#FF6B35" strokeWidth={1 / stageScale} />

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
                {wallDrawing.firstPoint && dist(wallDrawing.end, wallDrawing.firstPoint) < CLOSE_ROOM_RADIUS && (
                  <Circle
                    x={wallDrawing.firstPoint.x} y={wallDrawing.firstPoint.y}
                    radius={10 / stageScale}
                    fill="rgba(76,175,80,0.3)"
                    stroke="#4CAF50"
                    strokeWidth={2 / stageScale}
                  />
                )}
              </>
            )}

            {wallDrawing.firstPoint && !wallDrawing.start && (
              <Circle
                x={wallDrawing.firstPoint.x} y={wallDrawing.firstPoint.y}
                radius={4 / stageScale}
                fill="#4CAF50"
                stroke="#FFF"
                strokeWidth={1 / stageScale}
                opacity={0.6}
              />
            )}

            {snapPreview && toolMode === 'wall' && (
              <Circle
                x={snapPreview.x} y={snapPreview.y}
                radius={8 / stageScale}
                fill="rgba(76,175,80,0.3)"
                stroke="#4CAF50"
                strokeWidth={2 / stageScale}
              />
            )}

            {boxSelectRect && (
              <Rect
                x={Math.min(boxSelectRect.start.x, boxSelectRect.end.x)}
                y={Math.min(boxSelectRect.start.y, boxSelectRect.end.y)}
                width={Math.abs(boxSelectRect.end.x - boxSelectRect.start.x)}
                height={Math.abs(boxSelectRect.end.y - boxSelectRect.start.y)}
                fill="rgba(255,107,53,0.1)"
                stroke="#FF6B35"
                strokeWidth={1 / stageScale}
                dash={[6 / stageScale, 3 / stageScale]}
              />
            )}
          </Group>

          {/* 交互层：墙体、家具 */}
          {walls.map((wall) => (
            <WallShape
              key={wall.id}
              wall={wall}
              isSelected={selection?.type === 'wall' && selection.id === wall.id}
              isBoxSelected={boxSelectionIds.includes(wall.id)}
              scale={stageScale}
              onSelect={() => selectItem({ type: 'wall', id: wall.id })}
              onPointDragStart={(point) => handleWallPointDragStart(wall.id, point)}
              onPointDragMove={(point, e) => handleWallPointDragMove(wall.id, point, e)}
              onPointDragEnd={handleWallPointDragEnd}
              onBodyDragStart={() => handleWallBodyDragStart(wall.id)}
              onBodyDragMove={(e) => handleWallBodyDragMove(wall.id, e)}
              onBodyDragEnd={handleWallBodyDragEnd}
              onDelete={() => removeWall(wall.id)}
            />
          ))}

          <WallJoints walls={walls} scale={stageScale} onUngroupClick={(groupId) => setUngroupConfirmId(groupId)} />

          {project.furniture.map((item) => (
            <FurnitureShape
              key={item.id}
              item={item}
              isSelected={selection?.type === 'furniture' && selection.id === item.id}
              isBoxSelected={boxSelectionIds.includes(item.id)}
              scale={stageScale}
              onSelect={() => selectItem({ type: 'furniture', id: item.id })}
              onDragEnd={(e) => handleFurnitureDragEnd(item.id, e)}
              onRotate={(angle) => rotateFurniture(item.id, angle)}
              onResize={(w, d) => resizeFurniture(item.id, w, d)}
            />
          ))}
        </Layer>
      </Stage>

      <div className="editor-status">
        <span>坐标: {mouseCm.x}cm, {mouseCm.y}cm</span>
        <span>缩放: {Math.round(stageScale * 100)}%</span>
        <span>工具: {toolMode === 'wall' ? '画墙' : toolMode === 'furniture' ? '放家具' : '选择'}</span>
        {boxSelectionIds.length > 0 && (
          <span style={{ color: '#FF6B35' }}>已框选 {boxSelectionIds.length} 项 | Del删除</span>
        )}
        <span className="status-hint">
          {toolMode === 'wall' ? '点击画墙 | 连续点击 | 靠近起点自动闭合 | Esc结束' :
           toolMode === 'furniture' ? '点击画布放置家具，Esc取消' :
           '拖拽框选 | 滚轮缩放 | 中键/右键平移 | Del删除 | R旋转'}
        </span>
      </div>

      {ungroupConfirmId && (
        <div className="ungroup-confirm-overlay">
          <div className="ungroup-confirm-dialog">
            <div className="ungroup-confirm-title">解除墙体组合</div>
            <div className="ungroup-confirm-text">
              确定要解除此墙体组合吗？<br />
              解除后各墙体可独立移动。
            </div>
            <div className="ungroup-confirm-actions">
              <button className="btn-confirm" onClick={() => {
                ungroupWalls(ungroupConfirmId);
                setUngroupConfirmId(null);
              }}>确定解除</button>
              <button className="btn-cancel" onClick={() => setUngroupConfirmId(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const JOINT_THRESHOLD = 2;

function WallJoints({ walls, scale, onUngroupClick }: { walls: Wall[]; scale: number; onUngroupClick: (groupId: string) => void }) {
  // 预计算连接点数据
  const jointData = useMemo(() => {
    const result: { key: string; x: number; y: number; groupIds: string[] }[] = [];
    const drawn = new Set<string>();

    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const a = walls[i];
        const b = walls[j];
        const pairs: [Point2D, Point2D, string | undefined, string | undefined][] = [
          [a.start, b.start, a.groupId, b.groupId],
          [a.start, b.end, a.groupId, b.groupId],
          [a.end, b.start, a.groupId, b.groupId],
          [a.end, b.end, a.groupId, b.groupId],
        ];
        for (const [p1, p2, g1, g2] of pairs) {
          const d = dist(p1, p2);
          if (d < JOINT_THRESHOLD) {
            const key = `${Math.round(p1.x)}_${Math.round(p1.y)}`;
            if (drawn.has(key)) continue;
            drawn.add(key);
            const gids: string[] = [];
            if (g1) gids.push(g1);
            if (g2) gids.push(g2);
            result.push({ key, x: p1.x, y: p1.y, groupIds: gids });
          }
        }
      }
    }
    return result;
  }, [walls]);

  return (
    <>
      {jointData.map(({ key, x, y, groupIds }) => {
        const hasGroup = groupIds.length > 0;
        return (
          <Circle
            key={key}
            x={x}
            y={y}
            radius={hasGroup ? 7 / scale : 5 / scale}
            fill={hasGroup ? '#FF6B35' : '#4CAF50'}
            stroke="#FFF"
            strokeWidth={1.5 / scale}
            opacity={0.9}
            listening={hasGroup}
            onClick={(e) => {
              e.cancelBubble = true;
              if (groupIds.length > 0) {
                onUngroupClick(groupIds[0]);
              }
            }}
            onMouseEnter={(e) => {
              if (groupIds.length > 0) {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'pointer';
              }
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'default';
            }}
          />
        );
      })}
    </>
  );
}

function WallLengthLabel({ start, end, scale }: { start: Point2D; end: Point2D; scale: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
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

function WallShape({
  wall, isSelected, isBoxSelected, scale, onSelect,
  onPointDragStart, onPointDragMove, onPointDragEnd,
  onBodyDragStart, onBodyDragMove, onBodyDragEnd,
  onDelete,
}: {
  wall: Wall;
  isSelected: boolean;
  isBoxSelected: boolean;
  scale: number;
  onSelect: () => void;
  onPointDragStart: (point: 'start' | 'end') => void;
  onPointDragMove: (point: 'start' | 'end', e: KonvaEventObject<DragEvent>) => void;
  onPointDragEnd: () => void;
  onBodyDragStart: () => void;
  onBodyDragMove: (e: KonvaEventObject<DragEvent>) => void;
  onBodyDragEnd: () => void;
  onDelete: () => void;
}) {
  const thickness = Math.max(wall.thickness, 4 / scale);
  const midX = (wall.start.x + wall.end.x) / 2;
  const midY = (wall.start.y + wall.end.y) / 2;
  const highlighted = isSelected || isBoxSelected;

  return (
    <Group>
      <Line
        points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
        stroke={highlighted ? '#FF6B35' : '#777'}
        strokeWidth={thickness}
        lineCap="square"
        hitStrokeWidth={WALL_HIT_WIDTH}
        draggable
        onClick={(e) => { e.cancelBubble = true; onSelect(); }}
        onDragStart={(e) => { e.cancelBubble = true; onBodyDragStart(); }}
        onDragMove={(e) => { e.cancelBubble = true; onBodyDragMove(e); }}
        onDragEnd={(e) => { e.cancelBubble = true; onBodyDragEnd(); }}
        onMouseEnter={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'move'; }}
        onMouseLeave={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'default'; }}
      />

      <WallLengthLabel start={wall.start} end={wall.end} scale={scale} />

      {isSelected && (
        <>
          <Line
            points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
            stroke="rgba(255,107,53,0.3)"
            strokeWidth={thickness + 8 / scale}
            lineCap="square"
            dash={[6 / scale, 4 / scale]}
            listening={false}
          />

          <Circle
            x={wall.start.x} y={wall.start.y}
            radius={7 / scale} fill="#FF6B35" stroke="#FFF" strokeWidth={2 / scale}
            draggable
            onDragStart={(e) => { e.cancelBubble = true; onPointDragStart('start'); }}
            onDragMove={(e) => { e.cancelBubble = true; onPointDragMove('start', e); }}
            onDragEnd={(e) => { e.cancelBubble = true; onPointDragEnd(); }}
            onMouseEnter={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'crosshair'; }}
            onMouseLeave={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'move'; }}
          />
          <Circle
            x={wall.end.x} y={wall.end.y}
            radius={7 / scale} fill="#FF6B35" stroke="#FFF" strokeWidth={2 / scale}
            draggable
            onDragStart={(e) => { e.cancelBubble = true; onPointDragStart('end'); }}
            onDragMove={(e) => { e.cancelBubble = true; onPointDragMove('end', e); }}
            onDragEnd={(e) => { e.cancelBubble = true; onPointDragEnd(); }}
            onMouseEnter={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'crosshair'; }}
            onMouseLeave={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = 'move'; }}
          />

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

      {isBoxSelected && !isSelected && (
        <Line
          points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
          stroke="rgba(255,107,53,0.5)"
          strokeWidth={thickness + 6 / scale}
          lineCap="square"
          dash={[6 / scale, 4 / scale]}
        />
      )}
    </Group>
  );
}

function FurnitureShape({
  item, isSelected, isBoxSelected, scale, onSelect, onDragEnd, onRotate, onResize,
}: {
  item: PlacedFurniture;
  isSelected: boolean;
  isBoxSelected: boolean;
  scale: number;
  onSelect: () => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onRotate: (angle: number) => void;
  onResize: (width: number, depth: number) => void;
}) {
  const w = item.width;
  const d = item.depth;
  const handleSize = 8 / scale;
  const highlighted = isSelected || isBoxSelected;

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
      {item.shape === 'circle' ? (
        <Ellipse
          x={w / 2} y={d / 2}
          radiusX={w / 2} radiusY={d / 2}
          fill={item.color}
          stroke={highlighted ? '#FF6B35' : '#666'}
          strokeWidth={highlighted ? 2 / scale : 1 / scale}
          opacity={0.85}
        />
      ) : (
        <Rect
          width={w} height={d}
          fill={item.color}
          stroke={highlighted ? '#FF6B35' : '#666'}
          strokeWidth={highlighted ? 2 / scale : 1 / scale}
          cornerRadius={2 / scale}
          opacity={0.85}
        />
      )}

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

      {isSelected && (
        <>
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

      {isBoxSelected && !isSelected && (
        <Rect
          width={w} height={d}
          stroke="#FF6B35"
          strokeWidth={2 / scale}
          dash={[6 / scale, 3 / scale]}
          cornerRadius={2 / scale}
        />
      )}
    </Group>
  );
}
