import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, Text } from '@react-three/drei';
import { usePlannerStore } from '../store/plannerStore';
import type { PlacedFurniture, Wall as WallType } from '../types';

const CM_TO_UNIT = 0.01; // 1cm = 0.01 three.js unit

export default function Editor3D() {
  const { project, selectedId, selectItem } = usePlannerStore();
  const walls = project.rooms.flatMap((r) => r.walls);

  return (
    <div className="editor-3d">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[6, 8, 6]} fov={50} />
        <OrbitControls
          makeDefault
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2.1}
          enableDamping
          dampingFactor={0.1}
        />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-5, 8, -5]} intensity={0.3} />

        {/* Ground */}
        <Grid
          args={[20, 20]}
          position={[0, 0, 0]}
          cellSize={0.5}
          cellColor="#CCCCCC"
          sectionSize={2}
          sectionColor="#999999"
          fadeDistance={30}
          infiniteGrid
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#F0EDE5" />
        </mesh>

        {/* Walls */}
        {walls.map((wall) => (
          <Wall3D key={wall.id} wall={wall} />
        ))}

        {/* Furniture */}
        {project.furniture.map((item) => (
          <Furniture3D
            key={item.id}
            item={item}
            isSelected={selectedId === item.id}
            onSelect={() => selectItem(item.id)}
          />
        ))}
      </Canvas>
    </div>
  );
}

function Wall3D({ wall }: { wall: WallType }) {
  const sx = wall.start.x * CM_TO_UNIT;
  const sz = wall.start.y * CM_TO_UNIT;
  const ex = wall.end.x * CM_TO_UNIT;
  const ez = wall.end.y * CM_TO_UNIT;
  const h = wall.height * CM_TO_UNIT;
  const t = wall.thickness * CM_TO_UNIT;

  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const cx = (sx + ex) / 2;
  const cz = (sz + ez) / 2;

  return (
    <group position={[cx, h / 2, cz]} rotation={[0, -angle, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[len, h, t]} />
        <meshStandardMaterial color="#E8E0D0" />
      </mesh>
    </group>
  );
}

function Furniture3D({
  item, isSelected, onSelect,
}: {
  item: PlacedFurniture;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const w = item.width * CM_TO_UNIT * item.scaleX;
  const h = item.height * CM_TO_UNIT;
  const d = item.depth * CM_TO_UNIT * item.scaleZ;
  const x = item.position.x * CM_TO_UNIT;
  const z = item.position.y * CM_TO_UNIT;
  const rot = (item.rotation * Math.PI) / 180;

  return (
    <group
      position={[x, h / 2 + 0.001, z]}
      rotation={[0, -rot, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {item.shape === 'circle' ? (
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[Math.min(w, d) / 2, Math.min(w, d) / 2, h, 24]} />
          <meshStandardMaterial
            color={item.color}
            emissive={isSelected ? '#FF6B35' : '#000'}
            emissiveIntensity={isSelected ? 0.3 : 0}
          />
        </mesh>
      ) : (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color={item.color}
            emissive={isSelected ? '#FF6B35' : '#000'}
            emissiveIntensity={isSelected ? 0.3 : 0}
          />
        </mesh>
      )}
      {/* Name label */}
      <Text
        position={[0, h / 2 + 0.15, 0]}
        fontSize={0.15}
        color="#333"
        anchorX="center"
        anchorY="middle"
      >
        {item.name}
      </Text>
      {/* Selection outline */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[w + 0.04, h + 0.04, d + 0.04]} />
          <meshBasicMaterial color="#FF6B35" wireframe opacity={0.5} transparent />
        </mesh>
      )}
    </group>
  );
}
