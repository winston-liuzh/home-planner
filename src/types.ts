// ===== 核心数据类型 =====

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Wall {
  id: string;
  start: Point2D;
  end: Point2D;
  thickness: number; // cm
  height: number;    // cm
}

export interface Room {
  id: string;
  name: string;
  walls: Wall[];
  floorColor: string;
  height: number; // 层高 cm
}

export interface FurnitureModel {
  id: string;
  name: string;
  category: string;
  width: number;   // cm
  depth: number;   // cm
  height: number;  // cm
  color: string;
  shape: 'rect' | 'circle' | 'l-shape' | 'custom';
}

export interface PlacedFurniture {
  id: string;
  modelId: string;
  name: string;
  position: Point2D;  // 2D编辑中的位置
  rotation: number;   // 角度
  scaleX: number;
  scaleZ: number;
  width: number;      // cm
  depth: number;      // cm
  height: number;     // cm
  color: string;
  shape: 'rect' | 'circle' | 'l-shape' | 'custom';
}

export interface Project {
  id: string;
  name: string;
  rooms: Room[];
  furniture: PlacedFurniture[];
  createdAt: number;
  updatedAt: number;
}

export type ViewMode = '2d' | '3d';
export type ToolMode = 'select' | 'wall' | 'furniture' | 'room';
