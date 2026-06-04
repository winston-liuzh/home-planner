import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Project, ViewMode, ToolMode, PlacedFurniture, Wall, Point2D, FurnitureModel, Selection } from '../types';
import { saveProject, loadProject, exportProjectFile, importProjectFile, CURRENT_SCHEMA_VERSION } from './projectPersistence';
import type { ProjectFile } from './projectPersistence';

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

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
  pendingFurnitureModelId: string | null;
  wallDrawing: { start: Point2D | null; end: Point2D | null; firstPoint: Point2D | null };
  boxSelectionIds: string[];
  dirty: boolean; // 是否有未保存的变更
  saveStatus: 'idle' | 'saving' | 'saved'; // 保存状态
  lastSavedAt: number | null; // 上次保存时间

  setViewMode: (mode: ViewMode) => void;
  setToolMode: (mode: ToolMode) => void;
  selectItem: (sel: Selection | null) => void;
  setPendingFurnitureModelId: (id: string | null) => void;

  addWall: (start: Point2D, end: Point2D) => void;
  removeWall: (id: string) => void;
  updateWall: (id: string, updates: Partial<Wall>) => void;
  moveWallPoint: (wallId: string, point: 'start' | 'end', pos: Point2D) => void;

  addFurniture: (modelId: string, position: Point2D) => void;
  removeFurniture: (id: string) => void;
  moveFurniture: (id: string, position: Point2D) => void;
  rotateFurniture: (id: string, angle: number) => void;
  resizeFurniture: (id: string, width: number, depth: number) => void;

  setWallDrawingStart: (p: Point2D | null) => void;
  setWallDrawingEnd: (p: Point2D | null) => void;
  setWallDrawingFirstPoint: (p: Point2D | null) => void;
  resetWallDrawing: () => void;

  setBoxSelectionIds: (ids: string[]) => void;
  deleteItems: (ids: string[]) => void;
  deleteSelected: () => void;
  ungroupWalls: (groupId: string) => void;
  autoGroupWalls: () => void;

  loadSavedProject: () => void;
  newProject: () => void;
  exportProject: () => void;
  importProject: (file: File) => Promise<void>;
}

// 启动时尝试加载已保存的项目
const initialProject: Project = loadProject() ?? {
  id: uuid(),
  name: '我的户型',
  rooms: [],
  furniture: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const usePlannerStore = create<PlannerState>((set, get) => ({
  project: initialProject,
  viewMode: '2d',
  toolMode: 'select',
  selection: null,
  pendingFurnitureModelId: null,
  wallDrawing: { start: null, end: null, firstPoint: null },
  boxSelectionIds: [],
  dirty: false,
  saveStatus: 'idle',
  lastSavedAt: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setToolMode: (mode) => set({ toolMode: mode, selection: null, pendingFurnitureModelId: null, wallDrawing: { start: null, end: null, firstPoint: null }, boxSelectionIds: [] }),
  selectItem: (sel) => set({ selection: sel, boxSelectionIds: [] }),
  setPendingFurnitureModelId: (id) => set({ pendingFurnitureModelId: id, toolMode: id ? 'furniture' : 'select' }),

  addWall: (start, end) =>
    set((s) => {
      const allWalls = s.project.rooms.flatMap(r => r.walls);
      const THRESHOLD = 2;
      // 查找与新建墙端点重合的已有墙的 groupId
      let matchedGroupId: string | undefined;
      for (const w of allWalls) {
        if (dist(w.start, start) < THRESHOLD || dist(w.end, start) < THRESHOLD ||
            dist(w.start, end) < THRESHOLD || dist(w.end, end) < THRESHOLD) {
          if (w.groupId) {
            matchedGroupId = w.groupId;
            break;
          }
        }
      }
      const newGroupId = matchedGroupId ?? uuid();
      const newWall: Wall = { id: uuid(), start, end, thickness: 24, height: 280, groupId: newGroupId };

      // 如果新墙有 groupId，把匹配到但还没有 groupId 的墙也归入
      const updatedRooms = s.project.rooms.length === 0
        ? [{ id: uuid(), name: '房间1', walls: [newWall], floorColor: '#F5F0E8', height: 280 }]
        : s.project.rooms.map((r, i) => {
            if (i !== 0) return r;
            const updatedWalls = r.walls.map(w => {
              if (w.groupId) return w;
              if (dist(w.start, start) < THRESHOLD || dist(w.end, start) < THRESHOLD ||
                  dist(w.start, end) < THRESHOLD || dist(w.end, end) < THRESHOLD) {
                return { ...w, groupId: newGroupId };
              }
              return w;
            });
            return { ...r, walls: [...updatedWalls, newWall] };
          });

      return {
        project: { ...s.project, rooms: updatedRooms, updatedAt: Date.now() },
      };
    }),

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
      boxSelectionIds: s.boxSelectionIds.filter((bid) => bid !== id),
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
      boxSelectionIds: s.boxSelectionIds.filter((bid) => bid !== id),
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
  setWallDrawingFirstPoint: (p) => set((s) => ({ wallDrawing: { ...s.wallDrawing, firstPoint: p } })),
  resetWallDrawing: () => set({ wallDrawing: { start: null, end: null, firstPoint: null } }),

  setBoxSelectionIds: (ids) => set({ boxSelectionIds: ids }),

  deleteItems: (ids) => {
    const s = get();
    const wallIds = new Set(ids.filter((id) => s.project.rooms.some((r) => r.walls.some((w) => w.id === id))));
    const furnitureIds = new Set(ids.filter((id) => s.project.furniture.some((f) => f.id === id)));
    set({
      project: {
        ...s.project,
        rooms: s.project.rooms.map((r) => ({
          ...r,
          walls: r.walls.filter((w) => !wallIds.has(w.id)),
        })),
        furniture: s.project.furniture.filter((f) => !furnitureIds.has(f.id)),
        updatedAt: Date.now(),
      },
      selection: s.selection && ids.includes(s.selection.id) ? null : s.selection,
      boxSelectionIds: [],
    });
  },

  deleteSelected: () => {
    const { selection, removeFurniture, removeWall } = get();
    if (!selection) return;
    if (selection.type === 'furniture') removeFurniture(selection.id);
    else if (selection.type === 'wall') removeWall(selection.id);
  },

  ungroupWalls: (groupId) =>
    set((s) => ({
      project: {
        ...s.project,
        rooms: s.project.rooms.map((r) => ({
          ...r,
          walls: r.walls.map((w) =>
            w.groupId === groupId ? { ...w, groupId: undefined } : w
          ),
        })),
        updatedAt: Date.now(),
      },
    })),

  autoGroupWalls: () =>
    set((s) => {
      const THRESHOLD = 2;
      const allWalls = s.project.rooms.flatMap(r => r.walls);
      // Union-Find 简易实现
      const parent = new Map<string, string>();
      const find = (id: string): string => {
        let p = parent.get(id) ?? id;
        if (p !== id) { p = find(p); parent.set(id, p); }
        return p;
      };
      const union = (a: string, b: string) => {
        const pa = find(a), pb = find(b);
        if (pa !== pb) parent.set(pa, pb);
      };
      // 遍历所有墙对，端点重合则合并
      for (let i = 0; i < allWalls.length; i++) {
        for (let j = i + 1; j < allWalls.length; j++) {
          const a = allWalls[i], b = allWalls[j];
          if (dist(a.start, b.start) < THRESHOLD || dist(a.start, b.end) < THRESHOLD ||
              dist(a.end, b.start) < THRESHOLD || dist(a.end, b.end) < THRESHOLD) {
            union(a.id, b.id);
          }
        }
      }
      // 分配 groupId
      const rootToGroup = new Map<string, string>();
      const updatedWallsMap = new Map<string, Wall>();
      for (const w of allWalls) {
        const root = find(w.id);
        let gid = rootToGroup.get(root);
        if (!gid) {
          // 如果这组中已有 groupId，沿用
          const existingGroup = allWalls.find(ww => find(ww.id) === root && ww.groupId);
          gid = existingGroup?.groupId ?? uuid();
          rootToGroup.set(root, gid);
        }
        updatedWallsMap.set(w.id, { ...w, groupId: gid });
      }
      return {
        project: {
          ...s.project,
          rooms: s.project.rooms.map((r) => ({
            ...r,
            walls: r.walls.map((w) => updatedWallsMap.get(w.id) ?? w),
          })),
          updatedAt: Date.now(),
        },
      };
    }),

  loadSavedProject: () => {
    const saved = loadProject();
    if (saved) {
      set({ project: saved, dirty: false, selection: null, boxSelectionIds: [] });
    }
  },

  newProject: () => {
    const fresh: Project = {
      id: uuid(),
      name: '我的户型',
      rooms: [],
      furniture: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set({ project: fresh, dirty: false, selection: null, boxSelectionIds: [] });
  },

  exportProject: () => {
    const { project } = get();
    exportProjectFile(project);
  },

  importProject: async (file: File) => {
    try {
      const project = await importProjectFile(file);
      set({ project, dirty: false, selection: null, boxSelectionIds: [] });
      saveProject(project);
    } catch (e) {
      console.error('导入项目失败:', e);
      alert('导入失败：文件格式不正确');
    }
  },
}));

// ===== 自动保存：project 变更后 500ms 防抖写入 =====
let saveTimer: ReturnType<typeof setTimeout> | null = null;

usePlannerStore.subscribe((state, prevState) => {
  if (state.project !== prevState.project) {
    // 标记为有变更
    if (!state.dirty) {
      usePlannerStore.setState({ dirty: true, saveStatus: 'idle' });
    }
    // 防抖保存
    if (saveTimer) clearTimeout(saveTimer);
    usePlannerStore.setState({ saveStatus: 'saving' });
    saveTimer = setTimeout(() => {
      saveProject(usePlannerStore.getState().project);
      usePlannerStore.setState({ dirty: false, saveStatus: 'saved', lastSavedAt: Date.now() });
    }, 500);
  }
});
