// ===== 项目持久化：自动保存 / 加载 / 退出提示 =====
//
// 配置文件格式设计原则：
// 1. schemaVersion 标识数据版本，加载时按版本号逐步迁移，保证前向兼容
// 2. 只持久化 project 数据（墙体、家具），UI 状态不保存
// 3. 新版本新增字段均为 optional，旧数据缺失时用默认值填充
// 4. Web 端存 localStorage，Electron 端可扩展为文件系统

import type { Project, Wall, PlacedFurniture, Room, Point2D } from '../types';

// ===== 配置文件格式 =====
export interface ProjectFile {
  /** 数据格式版本号，每次 schema 变更递增 */
  schemaVersion: number;
  /** 项目数据 */
  project: Project;
  /** 保存时间戳 */
  savedAt: number;
}

// 当前最新版本号
export const CURRENT_SCHEMA_VERSION = 1;

const STORAGE_KEY = 'home-planner-project';

// ===== 版本迁移 =====
// 每个迁移函数接收旧版本数据，返回新版本数据
// 新版本只需在 migrations 数组末尾追加迁移函数

const migrations: Record<number, (data: any) => any> = {
  // v0 -> v1: 初始版本，无迁移需要
  // 0: (data) => data,
};

function migrateProjectFile(data: any): ProjectFile {
  let version = data.schemaVersion ?? 0;
  let current = data;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrator = migrations[version];
    if (migrator) {
      current = migrator(current);
    }
    version++;
    current.schemaVersion = version;
  }

  // 确保最终数据结构完整
  return fillDefaults(current);
}

/** 为缺失字段填充默认值，保证前向兼容 */
function fillDefaults(data: any): ProjectFile {
  const project = data.project ?? {};

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: {
      id: project.id ?? crypto.randomUUID(),
      name: project.name ?? '我的户型',
      rooms: (project.rooms ?? []).map(fillRoomDefaults),
      furniture: (project.furniture ?? []).map(fillFurnitureDefaults),
      createdAt: project.createdAt ?? Date.now(),
      updatedAt: project.updatedAt ?? Date.now(),
    },
    savedAt: data.savedAt ?? Date.now(),
  };
}

function fillRoomDefaults(room: any): Room {
  return {
    id: room.id ?? crypto.randomUUID(),
    name: room.name ?? '房间',
    walls: (room.walls ?? []).map(fillWallDefaults),
    floorColor: room.floorColor ?? '#F5F0E8',
    height: room.height ?? 280,
  };
}

function fillWallDefaults(wall: any): Wall {
  return {
    id: wall.id ?? crypto.randomUUID(),
    start: fillPointDefaults(wall.start),
    end: fillPointDefaults(wall.end),
    thickness: wall.thickness ?? 24,
    height: wall.height ?? 280,
    opacity: wall.opacity ?? 1,
    groupId: wall.groupId,
  };
}

function fillFurnitureDefaults(f: any): PlacedFurniture {
  return {
    id: f.id ?? crypto.randomUUID(),
    modelId: f.modelId ?? '',
    name: f.name ?? '家具',
    position: fillPointDefaults(f.position),
    rotation: f.rotation ?? 0,
    width: f.width ?? 60,
    depth: f.depth ?? 60,
    height: f.height ?? 75,
    color: f.color ?? '#999',
    shape: f.shape ?? 'rect',
  };
}

function fillPointDefaults(p: any): Point2D {
  return { x: p?.x ?? 0, y: p?.y ?? 0 };
}

// ===== 保存 / 加载 =====

export function saveProject(project: Project): void {
  const file: ProjectFile = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  } catch (e) {
    console.error('保存项目失败:', e);
  }
}

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const file = migrateProjectFile(data);
    return file.project;
  } catch (e) {
    console.error('加载项目失败:', e);
    return null;
  }
}

export function clearProject(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasSavedProject(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
