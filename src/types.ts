// ===== 核心数据类型 =====
// 坐标系统：所有位置/尺寸统一用 cm（厘米）

export interface Point2D {
  x: number; // cm
  y: number; // cm
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
  opacity?: number;  // 0-1 透明度，默认1
  groupId?: string;  // 墙体组合ID，共享端点的墙体自动归为同组
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
  position: Point2D;  // 中心点位置 cm
  rotation: number;   // 角度
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
export type ToolMode = 'select' | 'wall' | 'furniture';
export type SelectedType = 'furniture' | 'wall';

export interface Selection {
  type: SelectedType;
  id: string;
}
