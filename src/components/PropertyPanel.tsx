import { usePlannerStore } from '../store/plannerStore';

export default function PropertyPanel() {
  const { project, selectedId, removeFurniture, rotateFurniture } = usePlannerStore();
  const selected = project.furniture.find((f) => f.id === selectedId);

  if (!selected) {
    return (
      <div className="property-panel">
        <div className="panel-header">属性</div>
        <div className="empty-hint">选择家具查看属性</div>
      </div>
    );
  }

  return (
    <div className="property-panel">
      <div className="panel-header">属性</div>
      <div className="prop-group">
        <label>名称</label>
        <span>{selected.name}</span>
      </div>
      <div className="prop-group">
        <label>位置</label>
        <span>({Math.round(selected.position.x)}, {Math.round(selected.position.y)})</span>
      </div>
      <div className="prop-group">
        <label>尺寸</label>
        <span>{Math.round(selected.width)}×{Math.round(selected.depth)}×{selected.height} cm</span>
      </div>
      <div className="prop-group">
        <label>旋转</label>
        <span>{Math.round(selected.rotation)}°</span>
      </div>
      <div className="prop-actions">
        <button onClick={() => rotateFurniture(selected.id, selected.rotation + 45)}>
          ↻ 旋转45°
        </button>
        <button onClick={() => rotateFurniture(selected.id, selected.rotation + 90)}>
          ↻ 旋转90°
        </button>
        <button className="btn-danger" onClick={() => removeFurniture(selected.id)}>
          ✕ 删除
        </button>
      </div>
    </div>
  );
}
