import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Project, ViewMode, ToolMode, PlacedFurniture, Wall, Point2D, FurnitureModel, Selection } from '../types';

// ===== 家具模型库 =====
export const FURNITURE_LIBRARY: FurnitureModel[] = [
  { id: 'sofa-3', name: '三人沙发', category: '客厅', width: 220, depth: 90, height: 85, color: '#6B8E7B', shape: 'rect' },
  { id: 'sofa-2', name: '双人沙发', category: '客厅', width: 160, depth: 85, height: 85, color: '#7B9E8B', shape: 'rect' },
  { id: 'sofa-1', name: '单人沙发', category: '客厅', width: 90, depth: 85, height: 85, color: '#8BAE9B', shape: 'rect' },
  { id: 'coffee-table', name: '茶几', category: '客厅', width: 120, depth: 60, height: 45, color: '#A0522D', shape: 'rect' },
  { id: 'tv-stand', name: '电视柜', category: '客厅', width: 180, depth: 45, height: 50, color: '#8B7355', shape: 'rect' },
  { id: 'dining-table', name: '餐桌', category: '餐厅', width: 140, depth: 80, height: 75, color: '#A0522D', shape: 'rect' },
  { id: 'dining-chair', name: '餐椅', category: '餐厅', width: 45, depth: 45, height: 85, color: '#8B7355', shape: 'rect' },
  { id: 'bed-double', name: '双人床', category: '卧室', width: 200, depth: 180, height: 50, color: '#B8860B', shape: 'rect' },
  { id: 'bed-single', name: '单人床', category: '卧室', width: 200, depth: 100, height: 50, color: '#C8960B', shape: 'rect' },
  { id: 'wardrobe', name: '衣柜', category: '卧室', width: 180, depth: 60, height: 220, color: '#8B7355', shape: 'rect' },
  { id: 'nightstand', name: '床头柜', category: '卧室', width: 50, depth: 45, height: 55, color: '#A0826D', shape: 'rect' },
  { id: 'desk', name: '书桌', category: '书房', width: 140, depth: 70, height: 75, color: '#A0522D', shape: 'rect' },
  { id: 'office-chair', name: '办公椅', category: '书房', width: 55, depth: 55, height: 100, color: '#333', shape: 'circle' },
  { id: 'bookshelf', name: '书架', category: '书房', width: 120, depth: 35, height: 180, color: '#8B7355', shape: 'rect' },
  { id: 'bathtub', name: '浴缸', category: '卫浴', width: 170, depth: 75, height: 60, color: '#EEE', shape: 'rect' },
  { id: 'toilet', name: '马桶', category: '卫浴', width: 40, depth: 65, height: 40, color: '#EEE', shape: 'rect' },
  { id: 'washbasin', name: '洗手台', category: '卫浴', width: 80, depth: 50, height: 85, color: '#EEE', shape: 'rect' },
  { id: 'kitchen-counter', name: '橱柜台面', category: '厨房', width: 240, depth: 60, height: 85, color: '#999', shape: 'rect' },
  { id: 'fridge', name: '冰箱', category: '厨房', width: 65, depth: 65, height: 180, color: '#CCC', shape: 'rect' },
  { id: 'round-table', name: '圆桌', category: '餐厅', width: 100, depth: 100, height: 75, color: '#A0522D', shape: 'circle' },
];

// ===== Store =====
interface PlannerState {
  project: Project;
  viewMode: ViewMode;
  toolMode: ToolMode;
  selection: Selection | null;
  pendingFurnitureModelId: string | null; // 待放置的家具模型ID
  wallDrawing: { start: Point2D | null; end: Point2D | null };

  setViewMode: (mode: ViewMode) => void;
  setToolMode: (mode: ToolMode) => void;
  selectItem: (sel: Selection | null) => void;
  setPendingFurnitureModelId: (id: string | null) => void;

  // Wall
  addWall: (start: Point2D, end: Point2D) => void;
  removeWall: (id: string) => void;
  updateWall: (id: string, updates: Partial<Wall>) => void;
  moveWallPoint: (wallId: string, point: 'start' | 'end', pos: Point2D) => void;

  // Furniture
  addFurniture: (modelId: string, position: Point2D) => void;
  removeFurniture: (id: string) => void;
  moveFurniture: (id: string, position: Point2D) => void;
  rotateFurniture: (id: string, angle: number) => void;
  resizeFurniture: (id: string, width: number, depth: number) => void;

  // Wall drawing
  setWallDrawingStart: (p: Point2D | null) => void;
  setWallDrawingEnd: (p: Point2D | null) => void;

  // Delete selected
  deleteSelected: () => void;
}

const defaultProject: Project = {
  id: uuid(),
  name: '我的户型',
  rooms: [],
  furniture: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const usePlannerStore = create<PlannerState>((set, get) => ({
  project: defaultProject,
  viewMode: '2d',
  toolMode: 'select',
  selection: null,
  pendingFurnitureModelId: null,
  wallDrawing: { start: null, end: null },

  setViewMode: (mode) => set({ viewMode: mode }),
  setToolMode: (mode) => set({ toolMode: mode, selection: null, pendingFurnitureModelId: null, wallDrawing: { start: null, end: null } }),
  selectItem: (sel) => set({ selection: sel }),
  setPendingFurnitureModelId: (id) => set({ pendingFurnitureModelId: id, toolMode: id ? 'furniture' : 'select' }),

  addWall: (start, end) =>
    set((s) => ({
      project: {
        ...s.project,
        rooms: s.project.rooms.length === 0
          ? [{ id: uuid(), name: '房间1', walls: [{ id: uuid(), start, end, thickness: 24, height: 280 }], floorColor: '#F5F0E8', height: 280 }]
          : s.project.rooms.map((r, i) =>
              i === 0
                ? { ...r, walls: [...r.walls, { id: uuid(), start, end, thickness: 24, height: 280 }] }
                : r
            ),
        updatedAt: Date.now(),
      },
    })),

  removeWall: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        rooms: s.project.rooms.map((r) => ({
          ...r,
          walls: r.walls.filter((w) => w.id !== id),
        })),
        updatedAt: Date.now(),
      },
      selection: s.selection?.id === id ? null : s.selection,
    })),

  updateWall: (id, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        rooms: s.project.rooms.map((r) => ({
          ...r,
          walls: r.walls.map((w) => (w.id === id ? { ...w, ...updates } : w)),
        })),
        updatedAt: Date.now(),
      },
    })),

  moveWallPoint: (wallId, point, pos) =>
    set((s) => ({
      project: {
        ...s.project,
        rooms: s.project.rooms.map((r) => ({
          ...r,
          walls: r.walls.map((w) =>
            w.id === wallId
              ? point === 'start'
                ? { ...w, start: pos }
                : { ...w, end: pos }
              : w
          ),
        })),
        updatedAt: Date.now(),
      },
    })),

  addFurniture: (modelId, position) => {
    const model = FURNITURE_LIBRARY.find((m) => m.id === modelId);
    if (!model) return;
    const item: PlacedFurniture = {
      id: uuid(),
      modelId: model.id,
      name: model.name,
      position,
      rotation: 0,
      width: model.width,
      depth: model.depth,
      height: model.height,
      color: model.color,
      shape: model.shape,
    };
    set((s) => ({
      project: {
        ...s.project,
        furniture: [...s.project.furniture, item],
        updatedAt: Date.now(),
      },
      selection: { type: 'furniture', id: item.id },
    }));
  },

  removeFurniture: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        furniture: s.project.furniture.filter((f) => f.id !== id),
        updatedAt: Date.now(),
      },
      selection: s.selection?.id === id ? null : s.selection,
    })),

  moveFurniture: (id, position) =>
    set((s) => ({
      project: {
        ...s.project,
        furniture: s.project.furniture.map((f) =>
          f.id === id ? { ...f, position } : f
        ),
        updatedAt: Date.now(),
      },
    })),

  rotateFurniture: (id, angle) =>
    set((s) => ({
      project: {
        ...s.project,
        furniture: s.project.furniture.map((f) =>
          f.id === id ? { ...f, rotation: ((angle % 360) + 360) % 360 } : f
        ),
        updatedAt: Date.now(),
      },
    })),

  resizeFurniture: (id, width, depth) =>
    set((s) => ({
      project: {
        ...s.project,
        furniture: s.project.furniture.map((f) =>
          f.id === id ? { ...f, width, depth } : f
        ),
        updatedAt: Date.now(),
      },
    })),

  setWallDrawingStart: (p) => set((s) => ({ wallDrawing: { ...s.wallDrawing, start: p } })),
  setWallDrawingEnd: (p) => set((s) => ({ wallDrawing: { ...s.wallDrawing, end: p } })),

  deleteSelected: () => {
    const { selection, removeFurniture, removeWall } = get();
    if (!selection) return;
    if (selection.type === 'furniture') removeFurniture(selection.id);
    else if (selection.type === 'wall') removeWall(selection.id);
  },
}));
