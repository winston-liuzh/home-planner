import { useRef } from 'react';
import { usePlannerStore } from '../store/plannerStore';
import type { ToolMode, ViewMode } from '../types';
import { version } from '../../package.json';

const tools: { mode: ToolMode; icon: string; label: string }[] = [
  { mode: 'select', icon: '⬚', label: '选择' },
  { mode: 'wall', icon: '▬', label: '画墙' },
  { mode: 'furniture', icon: '⊞', label: '家具' },
];

const views: { mode: ViewMode; icon: string; label: string }[] = [
  { mode: '2d', icon: '⊟', label: '2D' },
  { mode: '3d', icon: '⊡', label: '3D' },
];

export default function Toolbar() {
  const toolMode = usePlannerStore((s) => s.toolMode);
  const viewMode = usePlannerStore((s) => s.viewMode);
  const setToolMode = usePlannerStore((s) => s.setToolMode);
  const setViewMode = usePlannerStore((s) => s.setViewMode);
  const newProject = usePlannerStore((s) => s.newProject);
  const exportProject = usePlannerStore((s) => s.exportProject);
  const importProject = usePlannerStore((s) => s.importProject);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewProject = () => {
    if (window.confirm('确定要新建项目吗？当前项目已自动保存。')) {
      newProject();
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (window.confirm('导入将替换当前项目，确定继续吗？')) {
      await importProject(file);
    }
    // 重置 input 以便重复选择同一文件
    e.target.value = '';
  };

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <span className="toolbar-title">🏠 Home Planner <small style={{ fontSize: 9, opacity: 0.5, fontWeight: 400 }}>v{version}</small></span>
      </div>
      <div className="toolbar-section">
        <span className="section-label">文件</span>
        <button className="tool-btn" onClick={handleNewProject} title="新建项目">
          📄
          <span className="btn-label">新建</span>
        </button>
        <button className="tool-btn" onClick={exportProject} title="另存为文件">
          💾
          <span className="btn-label">另存为</span>
        </button>
        <button className="tool-btn" onClick={() => fileInputRef.current?.click()} title="加载项目文件">
          📂
          <span className="btn-label">加载</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.hp.json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-section">
        <span className="section-label">视图</span>
        {views.map((v) => (
          <button
            key={v.mode}
            className={`tool-btn ${viewMode === v.mode ? 'active' : ''}`}
            onClick={() => setViewMode(v.mode)}
            title={v.label}
          >
            {v.icon}
            <span className="btn-label">{v.label}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-section">
        <span className="section-label">工具</span>
        {tools.map((t) => (
          <button
            key={t.mode}
            className={`tool-btn ${toolMode === t.mode ? 'active' : ''}`}
            onClick={() => setToolMode(t.mode)}
            title={t.label}
          >
            {t.icon}
            <span className="btn-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-section toolbar-hints">
        <span>滚轮缩放</span>
        <span>中键平移</span>
        <span>R旋转</span>
        <span>Del删除</span>
      </div>
    </div>
  );
}
