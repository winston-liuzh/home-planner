import { usePlannerStore } from '../store/plannerStore';

export default function PropertyPanel() {
  const project = usePlannerStore((s) => s.project);
  const selection = usePlannerStore((s) => s.selection);
  const boxSelectionIds = usePlannerStore((s) => s.boxSelectionIds);
  const removeFurniture = usePlannerStore((s) => s.removeFurniture);
  const removeWall = usePlannerStore((s) => s.removeWall);
  const rotateFurniture = usePlannerStore((s) => s.rotateFurniture);
  const resizeFurniture = usePlannerStore((s) => s.resizeFurniture);
  const moveFurniture = usePlannerStore((s) => s.moveFurniture);
  const moveWallPoint = usePlannerStore((s) => s.moveWallPoint);
  const deleteItems = usePlannerStore((s) => s.deleteItems);
  const setBoxSelectionIds = usePlannerStore((s) => s.setBoxSelectionIds);

  const walls = project.rooms.flatMap(r => r.walls);

  if (boxSelectionIds.length > 0) {
    const selectedWalls = walls.filter(w => boxSelectionIds.includes(w.id));
    const selectedFurniture = project.furniture.filter(f => boxSelectionIds.includes(f.id));

    return (
      <div className="property-panel">
        <div className="panel-header">多选 ({boxSelectionIds.length} 项)</div>
        <div className="multi-select-summary">
          {selectedWalls.length > 0 && (
            <div className="multi-select-group">
              <div className="multi-select-label">墙体 × {selectedWalls.length}</div>
              {selectedWalls.map(w => {
                const dx = w.end.x - w.start.x;
                const dy = w.end.y - w.start.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                return (
                  <div key={w.id} className="multi-select-item">
                    <span className="multi-item-icon">▐</span>
                    <span>{Math.round(len)}cm</span>
                  </div>
                );
              })}
            </div>
          )}
          {selectedFurniture.length > 0 && (
            <div className="multi-select-group">
              <div className="multi-select-label">家具 × {selectedFurniture.length}</div>
              {selectedFurniture.map(f => (
                <div key={f.id} className="multi-select-item">
                  <span className="multi-item-icon">▪</span>
                  <span>{f.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="prop-actions">
          <button className="btn-danger" onClick={() => deleteItems(boxSelectionIds)}>
            ✕ 删除全部 ({boxSelectionIds.length})
          </button>
          <button onClick={() => setBoxSelectionIds([])}>
            取消选择
          </button>
        </div>
        <div className="empty-hint">
          <span className="hint-small">按 Del 批量删除 · Esc 取消选择</span>
        </div>
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="property-panel">
        <div className="panel-header">属性</div>
        <div className="empty-hint">
          选择物件查看属性<br />
          <span className="hint-small">快捷键: R旋转 · Del删除 · Esc取消</span>
        </div>
      </div>
    );
  }

  if (selection.type === 'furniture') {
    const item = project.furniture.find((f) => f.id === selection.id);
    if (!item) return null;

    return (
      <div className="property-panel">
        <div className="panel-header">家具属性</div>
        <div className="prop-group">
          <label>名称</label>
          <span>{item.name}</span>
        </div>
        <div className="prop-group">
          <label>X (cm)</label>
          <input
            type="number"
            className="prop-input"
            value={Math.round(item.position.x)}
            onChange={(e) => moveFurniture(item.id, { ...item.position, x: +e.target.value })}
          />
        </div>
        <div className="prop-group">
          <label>Y (cm)</label>
          <input
            type="number"
            className="prop-input"
            value={Math.round(item.position.y)}
            onChange={(e) => moveFurniture(item.id, { ...item.position, y: +e.target.value })}
          />
        </div>
        <div className="prop-group">
          <label>宽 (cm)</label>
          <input
            type="number"
            className="prop-input"
            value={Math.round(item.width)}
            onChange={(e) => resizeFurniture(item.id, Math.max(20, +e.target.value), item.depth)}
          />
        </div>
        <div className="prop-group">
          <label>深 (cm)</label>
          <input
            type="number"
            className="prop-input"
            value={Math.round(item.depth)}
            onChange={(e) => resizeFurniture(item.id, item.width, Math.max(20, +e.target.value))}
          />
        </div>
        <div className="prop-group">
          <label>高 (cm)</label>
          <span>{item.height}</span>
        </div>
        <div className="prop-group">
          <label>旋转 (°)</label>
          <input
            type="number"
            className="prop-input"
            value={Math.round(item.rotation)}
            onChange={(e) => rotateFurniture(item.id, +e.target.value)}
          />
        </div>
        <div className="prop-actions">
          <button onClick={() => rotateFurniture(item.id, item.rotation + 45)}>
            ↻ +45°
          </button>
          <button onClick={() => rotateFurniture(item.id, item.rotation + 90)}>
            ↻ +90°
          </button>
          <button onClick={() => rotateFurniture(item.id, 0)}>
            ↺ 0°
          </button>
          <button className="btn-danger" onClick={() => removeFurniture(item.id)}>
            ✕ 删除
          </button>
        </div>
      </div>
    );
  }

  if (selection.type === 'wall') {
    const wall = walls.find((w) => w.id === selection.id);
    if (!wall) return null;
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    return (
      <div className="property-panel">
        <div className="panel-header">墙体属性</div>
        <div className="prop-group">
          <label>长度</label>
          <span>{Math.round(len)} cm</span>
        </div>
        <div className="prop-group">
          <label>起点 X</label>
          <input
            type="number"
            className="prop-input"
            value={Math.round(wall.start.x)}
            onChange={(e) => moveWallPoint(wall.id, 'start', { ...wall.start, x: +e.target.value })}
          />
        </div>
        <div className="prop-group">
          <label>起点 Y</label>
          <input
            type="number"
            className="prop-input"
            value={Math.round(wall.start.y)}
            onChange={(e) => moveWallPoint(wall.id, 'start', { ...wall.start, y: +e.target.value })}
          />
        </div>
        <div className="prop-group">
          <label>终点 X</label>
          <input
            type="number"
            className="prop-input"
            value={Math.round(wall.end.x)}
            onChange={(e) => moveWallPoint(wall.id, 'end', { ...wall.end, x: +e.target.value })}
          />
        </div>
        <div className="prop-group">
          <label>终点 Y</label>
          <input
            type="number"
            className="prop-input"
            value={Math.round(wall.end.y)}
            onChange={(e) => moveWallPoint(wall.id, 'end', { ...wall.end, y: +e.target.value })}
          />
        </div>
        <div className="prop-group">
          <label>墙厚 (cm)</label>
          <span>{wall.thickness}</span>
        </div>
        <div className="prop-actions">
          <button className="btn-danger" onClick={() => removeWall(wall.id)}>
            ✕ 删除墙体
          </button>
        </div>
      </div>
    );
  }

  return null;
}
