import { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Line, Circle, Group, Text } from 'react-konva';
import { usePlannerStore } from '../store/plannerStore';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { PlacedFurniture, Wall, Point2D } from '../types';

const GRID_SIZE = 20; // px per grid cell
const SCALE = 1;      // 1px = 1cm at scale 1
const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 600;

export default function Editor2D() {
  const {
    project, toolMode, selectedId, wallDrawing,
    selectItem, moveFurniture, rotateFurniture,
    addWall, setWallDrawingStart, setWallDrawingEnd,
  } = usePlannerStore();

  const stageRef = useRef<any>(null);
  const [mousePos, setMousePos] = useState<Point2D>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState<Point2D>({ x: 0, y: 0 });

  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  const getStagePoint = useCallback((e: KonvaEventObject<MouseEvent>): Point2D => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    return { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
  }, []);

  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const point = getStagePoint(e);

    if (toolMode === 'wall') {
      if (!wallDrawing.start) {
        setWallDrawingStart(point);
      } else {
        addWall(wallDrawing.start, point);
        setWallDrawingStart(null);
        setWallDrawingEnd(null);
      }
      return;
    }

    if (toolMode === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) selectItem(null);
    }
  }, [toolMode, wallDrawing, getStagePoint, addWall, setWallDrawingStart, setWallDrawingEnd, selectItem]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const point = getStagePoint(e);
    setMousePos(point);
    if (toolMode === 'wall' && wallDrawing.start) {
      setWallDrawingEnd(point);
    }
  }, [toolMode, wallDrawing, getStagePoint, setWallDrawingEnd]);

  // Drop furniture from panel
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const modelId = e.dataTransfer.getData('furniture-model-id');
    if (!modelId) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = snapToGrid(e.clientX - rect.left);
    const y = snapToGrid(e.clientY - rect.top);
    usePlannerStore.getState().addFurniture(modelId, { x, y });
    usePlannerStore.getState().setToolMode('select');
  }, []);

  const handleDragEnd = useCallback((id: string, e: KonvaEventObject<DragEvent>) => {
    const pos = { x: snapToGrid(e.target.x()), y: snapToGrid(e.target.y()) };
    moveFurniture(id, pos);
  }, [moveFurniture]);

  // Render grid
  const gridLines = [];
  for (let i = 0; i <= STAGE_WIDTH; i += GRID_SIZE) {
    gridLines.push(
      <Line key={`gv${i}`} points={[i, 0, i, STAGE_HEIGHT]} stroke="#E8E8E8" strokeWidth={0.5} />
    );
  }
  for (let j = 0; j <= STAGE_HEIGHT; j += GRID_SIZE) {
    gridLines.push(
      <Line key={`gh${j}`} points={[0, j, STAGE_WIDTH, j]} stroke="#E8E8E8" strokeWidth={0.5} />
    );
  }

  return (
    <div
      className="editor-2d"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        onClick={handleStageClick}
        onMouseMove={handleMouseMove}
        style={{ background: '#FAFAFA', cursor: toolMode === 'wall' ? 'crosshair' : 'default' }}
      >
        <Layer>
          {/* Grid */}
          {gridLines}

          {/* Walls */}
          {project.rooms.flatMap((room) =>
            room.walls.map((wall) => (
              <WallLine key={wall.id} wall={wall} />
            ))
          )}

          {/* Wall drawing preview */}
          {wallDrawing.start && wallDrawing.end && (
            <Line
              points={[wallDrawing.start.x, wallDrawing.start.y, wallDrawing.end.x, wallDrawing.end.y]}
              stroke="#FF6B35"
              strokeWidth={4}
              dash={[8, 4]}
            />
          )}

          {/* Furniture */}
          {project.furniture.map((item) => (
            <FurnitureShape
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              onSelect={() => selectItem(item.id)}
              onDragEnd={(e) => handleDragEnd(item.id, e)}
              onRotate={(angle) => rotateFurniture(item.id, angle)}
            />
          ))}

          {/* Cursor position indicator */}
          {toolMode === 'wall' && (
            <Circle x={mousePos.x} y={mousePos.y} radius={4} fill="#FF6B35" />
          )}
        </Layer>
      </Stage>
      <div className="editor-status">
        坐标: ({mousePos.x}, {mousePos.y}) | 网格: {GRID_SIZE}px | 工具: {toolMode === 'wall' ? '画墙' : toolMode === 'furniture' ? '放家具' : '选择'}
      </div>
    </div>
  );
}

// ===== Wall rendering =====
function WallLine({ wall }: { wall: Wall }) {
  return (
    <Line
      points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
      stroke="#333"
      strokeWidth={wall.thickness / 3}
      lineCap="square"
      hitStrokeWidth={20}
    />
  );
}

// ===== Furniture rendering =====
function FurnitureShape({
  item, isSelected, onSelect, onDragEnd, onRotate,
}: {
  item: PlacedFurniture;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onRotate: (angle: number) => void;
}) {
  const w = item.width;
  const d = item.depth;

  return (
    <Group
      x={item.position.x}
      y={item.position.y}
      rotation={item.rotation}
      offsetX={w / 2}
      offsetY={d / 2}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
    >
      {item.shape === 'circle' ? (
        <Ellipse
          x={w / 2}
          y={d / 2}
          radiusX={w / 2}
          radiusY={d / 2}
          fill={item.color}
          stroke={isSelected ? '#FF6B35' : '#666'}
          strokeWidth={isSelected ? 2 : 1}
          opacity={0.85}
        />
      ) : (
        <Rect
          width={w}
          height={d}
          fill={item.color}
          stroke={isSelected ? '#FF6B35' : '#666'}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={3}
          opacity={0.85}
        />
      )}
      <Text
        text={item.name}
        fontSize={11}
        fill="#FFF"
        width={w}
        height={d}
        align="center"
        verticalAlign="middle"
        fontStyle="bold"
      />
      {/* Selection handles */}
      {isSelected && (
        <>
          <Rect x={-4} y={-4} width={8} height={8} fill="#FF6B35" />
          <Rect x={w - 4} y={-4} width={8} height={8} fill="#FF6B35" />
          <Rect x={-4} y={d - 4} width={8} height={8} fill="#FF6B35" />
          <Rect x={w - 4} y={d - 4} width={8} height={8} fill="#FF6B35" />
          {/* Rotation handle */}
          <Circle
            x={w / 2}
            y={-18}
            radius={7}
            fill="#FF6B35"
            stroke="#FFF"
            strokeWidth={1}
            onClick={(e) => {
              e.cancelBubble = true;
              onRotate(item.rotation + 45);
            }}
          />
          <Text text="↻" x={w / 2 - 6} y={-24} fontSize={12} fill="#FFF" />
        </>
      )}
    </Group>
  );
}
