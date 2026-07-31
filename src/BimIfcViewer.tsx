import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { IfcAPI, LogLevel, type FlatMesh } from "web-ifc";
import webIfcWasmUrl from "web-ifc/web-ifc.wasm?url";

export type IfcViewerElement = {
  expressId: number;
  globalId: string;
  name: string;
  typeName: string;
  storey: string;
  category: string;
  quantity: number;
  unit: "m²" | "m³" | "st";
  quantitySource: "IFC-geometrie";
  warning?: string;
};

export type IfcModelReport = {
  schema: string;
  elementCount: number;
  triangleCount: number;
  elements: IfcViewerElement[];
};

export type IfcViewerCommand = { sequence: number; type: "fit" | "top" | "front" | "right" };

type Props = {
  file: File;
  selectedExpressIds: Set<number>;
  visibleExpressIds?: Set<number>;
  command?: IfcViewerCommand;
  onSelectionChange: (ids: Set<number>) => void;
  onModelLoaded: (report: IfcModelReport) => void;
  onProgress: (progress: number, message: string) => void;
  onError: (message: string) => void;
};

type StoredMaterial = THREE.MeshStandardMaterial & {
  userData: { baseColor?: number; baseOpacity?: number };
};

const categoryForType = (typeName: string) => {
  const type = typeName.toLocaleUpperCase();
  if (type.includes("CURTAINWALL") || type.includes("WALL")) return "Wanden";
  if (type.includes("SLAB") || type.includes("COVERING")) return "Vloeren";
  if (type.includes("COLUMN") || type.includes("PILE") || type.includes("FOOTING")) return "Kolommen";
  if (type.includes("BEAM") || type.includes("MEMBER")) return "Balken";
  if (type.includes("WINDOW")) return "Ramen";
  if (type.includes("DOOR")) return "Deuren";
  if (type.includes("ROOF")) return "Daken";
  if (type.includes("STAIR") || type.includes("RAMP")) return "Trappen";
  if (/DISTRIBUTION|FLOW|DUCT|PIPE|CABLE|TERMINAL|VALVE|PUMP|BOILER|CHILLER/.test(type)) return "Installaties";
  return "Overig";
};

const quantityFromBounds = (category: string, bounds: THREE.Box3) => {
  const size = bounds.getSize(new THREE.Vector3());
  const dimensions = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)].sort((left, right) => right - left);
  if (["Wanden", "Vloeren", "Daken"].includes(category)) {
    return { quantity: Math.max(0.01, dimensions[0] * dimensions[1]), unit: "m²" as const };
  }
  if (["Kolommen", "Balken"].includes(category)) {
    return { quantity: Math.max(0.001, dimensions[0] * dimensions[1] * dimensions[2]), unit: "m³" as const };
  }
  return { quantity: 1, unit: "st" as const };
};

const valueOf = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) return String((value as { value?: unknown }).value ?? "");
  return "";
};

const disposeObject = (object: THREE.Object3D) => {
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(material => material.dispose());
  });
};

export default function BimIfcViewer({ file, selectedExpressIds, visibleExpressIds, command, onSelectionChange, onModelLoaded, onProgress, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    modelRoot: THREE.Group;
    groups: Map<number, THREE.Group>;
    fit: (view?: IfcViewerCommand["type"]) => void;
  } | undefined>(undefined);
  const pointerStartRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const selectionRef = useRef(selectedExpressIds);
  selectionRef.current = selectedExpressIds;
  const callbacksRef = useRef({ onSelectionChange, onModelLoaded, onProgress, onError });
  callbacksRef.current = { onSelectionChange, onModelLoaded, onProgress, onError };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let frame = 0;
    let ifcApi: IfcAPI | undefined;
    let modelId = -1;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x18272e);
    scene.fog = new THREE.FogExp2(0x18272e, 0.0022);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
    camera.position.set(18, 18, 18);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "bim-ifc-canvas";
    renderer.domElement.setAttribute("aria-label", "Interactief IFC-model");
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.05;
    controls.maxDistance = 100000;
    const ambient = new THREE.HemisphereLight(0xdff8ff, 0x203238, 2.25);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.position.set(30, 55, 25);
    sun.castShadow = true;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x7fc8be, 1.1);
    fill.position.set(-25, 18, -30);
    scene.add(fill);
    const grid = new THREE.GridHelper(200, 80, 0x527178, 0x30484e);
    grid.material.opacity = 0.32;
    grid.material.transparent = true;
    scene.add(grid);

    const modelRoot = new THREE.Group();
    modelRoot.name = "IFC model";
    modelRoot.rotation.x = -Math.PI / 2;
    scene.add(modelRoot);
    const groups = new Map<number, THREE.Group>();

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const fit = (view: IfcViewerCommand["type"] = "fit") => {
      const bounds = new THREE.Box3().setFromObject(modelRoot);
      if (bounds.isEmpty()) return;
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const distance = Math.max(size.x, size.y, size.z, 1) * 1.55;
      const directions: Record<IfcViewerCommand["type"], THREE.Vector3> = {
        fit: new THREE.Vector3(1, .8, 1), top: new THREE.Vector3(0, 1, .001), front: new THREE.Vector3(0, .18, 1), right: new THREE.Vector3(1, .18, 0),
      };
      camera.position.copy(center).add(directions[view].normalize().multiplyScalar(distance));
      camera.near = Math.max(distance / 10000, 0.01);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.update();
      grid.position.y = bounds.min.y - Math.max(size.y * .015, .01);
      grid.scale.setScalar(Math.max(size.x, size.z, 1) / 100);
    };
    engineRef.current = { renderer, scene, camera, controls, modelRoot, groups, fit };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const selectAt = (event: PointerEvent) => {
      const start = pointerStartRef.current;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(modelRoot, true).find(intersection => intersection.object.visible);
      const expressId = hit?.object.userData.expressId as number | undefined;
      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      const next = additive ? new Set(selectionRef.current) : new Set<number>();
      if (expressId !== undefined) {
        if (additive && next.has(expressId)) next.delete(expressId); else next.add(expressId);
      }
      callbacksRef.current.onSelectionChange(next);
    };
    const pointerDown = (event: PointerEvent) => { pointerStartRef.current = { x:event.clientX, y:event.clientY }; };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", selectAt);

    const animate = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    const load = async () => {
      try {
        callbacksRef.current.onProgress(2, "WebIFC-engine starten…");
        ifcApi = new IfcAPI();
        ifcApi.SetLogLevel(LogLevel.LOG_LEVEL_ERROR);
        await ifcApi.Init(path => path.endsWith(".wasm") ? webIfcWasmUrl : path, true);
        if (disposed) return;
        callbacksRef.current.onProgress(8, "IFC-bestand openen…");
        const data = new Uint8Array(await file.arrayBuffer());
        modelId = ifcApi.OpenModel(data, { COORDINATE_TO_ORIGIN:true, CIRCLE_SEGMENTS:16, MEMORY_LIMIT:1_073_741_824 });
        if (modelId < 0) throw new Error("WebIFC kon dit model niet openen.");
        const schema = ifcApi.GetModelSchema(modelId);
        const typeNames = new Map(ifcApi.GetAllTypesOfModel(modelId).map(type => [type.typeID, type.typeName]));
        const storeyByElement = new Map<number,string>();
        try {
          const spatial = await ifcApi.properties.getSpatialStructure(modelId, false);
          const walk = (node: { expressID:number; type:string; children?:unknown[] }, storey = "Niet toegewezen") => {
            let current = storey;
            if (node.type === "IFCBUILDINGSTOREY") {
              const line = ifcApi?.GetLine(modelId,node.expressID);
              current = valueOf(line?.LongName) || valueOf(line?.Name) || `Bouwlaag #${node.expressID}`;
            }
            if (node.type.startsWith("IFC") && node.type !== "IFCPROJECT") storeyByElement.set(node.expressID,current);
            (node.children ?? []).forEach(child => walk(child as typeof node,current));
          };
          walk(spatial);
        } catch { /* Ruimtelijke structuur is optioneel in onvolledige IFC-bestanden. */ }
        let triangleCount = 0;
        let streamed = 0;
        const totalHint = Math.max(1, ifcApi.GetMaxExpressID(modelId));
        ifcApi.StreamAllMeshes(modelId,(flatMesh:FlatMesh,index,total) => {
          if (disposed || !ifcApi) { flatMesh.delete(); return; }
          const group = new THREE.Group();
          group.userData.expressId = flatMesh.expressID;
          group.name = `IFC #${flatMesh.expressID}`;
          for (let geometryIndex=0;geometryIndex<flatMesh.geometries.size();geometryIndex+=1) {
            const placed = flatMesh.geometries.get(geometryIndex);
            const raw = ifcApi.GetGeometry(modelId,placed.geometryExpressID);
            const vertices = new Float32Array(ifcApi.GetVertexArray(raw.GetVertexData(),raw.GetVertexDataSize()));
            const indices = new Uint32Array(ifcApi.GetIndexArray(raw.GetIndexData(),raw.GetIndexDataSize()));
            raw.delete();
            const positions = new Float32Array((vertices.length/6)*3);
            const normals = new Float32Array((vertices.length/6)*3);
            for (let source=0,target=0;source<vertices.length;source+=6,target+=3) {
              positions[target]=vertices[source]; positions[target+1]=vertices[source+1]; positions[target+2]=vertices[source+2];
              normals[target]=vertices[source+3]; normals[target+1]=vertices[source+4]; normals[target+2]=vertices[source+5];
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
            geometry.setAttribute("normal",new THREE.BufferAttribute(normals,3));
            geometry.setIndex(new THREE.BufferAttribute(indices,1));
            geometry.computeBoundingSphere();
            const color = new THREE.Color(placed.color.x,placed.color.y,placed.color.z);
            const opacity = Math.min(1,Math.max(.08,placed.color.w));
            const material = new THREE.MeshStandardMaterial({ color, roughness:.78, metalness:.02, transparent:opacity<.995, opacity, side:THREE.DoubleSide }) as StoredMaterial;
            material.userData.baseColor = color.getHex();
            material.userData.baseOpacity = opacity;
            const mesh = new THREE.Mesh(geometry,material);
            mesh.applyMatrix4(new THREE.Matrix4().fromArray(placed.flatTransformation));
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            mesh.userData.expressId = flatMesh.expressID;
            group.add(mesh);
            triangleCount += Math.floor(indices.length/3);
          }
          flatMesh.delete();
          if (group.children.length) {
            modelRoot.add(group);
            groups.set(group.userData.expressId as number,group);
          }
          streamed += 1;
          if (index % 25 === 0 || index === total-1) callbacksRef.current.onProgress(10+Math.round((index/Math.max(total-1,1))*73),`Geometrie opbouwen · ${index+1}/${total}`);
          void totalHint;
        });
        if (disposed || !ifcApi) return;
        modelRoot.updateMatrixWorld(true);
        callbacksRef.current.onProgress(86,"Objecteigenschappen koppelen…");
        const elements: IfcViewerElement[] = [];
        groups.forEach((group,expressId) => {
          let typeName = "IFCBUILDINGELEMENTPROXY";
          let line: Record<string,unknown> | undefined;
          try {
            const typeCode = ifcApi?.GetLineType(modelId,expressId);
            typeName = typeNames.get(typeCode) ?? ifcApi?.GetNameFromTypeCode(typeCode) ?? typeName;
            line = ifcApi?.GetLine(modelId,expressId,false,false) as Record<string,unknown>;
          } catch { /* Geometrie blijft selecteerbaar wanneer eigenschappen ontbreken. */ }
          const category = categoryForType(typeName);
          const measured = quantityFromBounds(category,new THREE.Box3().setFromObject(group));
          elements.push({
            expressId,
            globalId:valueOf(line?.GlobalId) || `EXP-${expressId}`,
            name:valueOf(line?.Name) || valueOf(line?.ObjectType) || `${typeName} #${expressId}`,
            typeName,
            storey:storeyByElement.get(expressId) ?? "Niet toegewezen",
            category,
            quantity:Number(measured.quantity.toFixed(3)),
            unit:measured.unit,
            quantitySource:"IFC-geometrie",
            warning:["Wanden","Vloeren","Daken","Kolommen","Balken"].includes(category) ? "Hoeveelheid geometrisch afgeleid; controleer officiële QTO-eigenschappen." : undefined,
          });
        });
        fit("fit");
        callbacksRef.current.onProgress(100,`${streamed} IFC-objecten geladen`);
        callbacksRef.current.onModelLoaded({ schema,elementCount:elements.length,triangleCount,elements });
      } catch (error) {
        callbacksRef.current.onError(error instanceof Error ? error.message : "Het IFC-model kon niet worden geladen.");
      }
    };
    const timer = window.setTimeout(()=>void load(),20);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown",pointerDown);
      renderer.domElement.removeEventListener("pointerup",selectAt);
      controls.dispose();
      disposeObject(modelRoot);
      if (ifcApi && modelId >= 0 && ifcApi.IsModelOpen(modelId)) ifcApi.CloseModel(modelId);
      ifcApi?.Dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      engineRef.current = undefined;
    };
  }, [file]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.groups.forEach((group,expressId) => {
      group.visible = visibleExpressIds ? visibleExpressIds.has(expressId) : true;
      group.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const material = child.material as StoredMaterial;
        const selected = selectedExpressIds.has(expressId);
        material.color.setHex(selected ? 0xffa43b : material.userData.baseColor ?? 0x78908e);
        material.emissive.setHex(selected ? 0x9d4300 : 0x000000);
        material.emissiveIntensity = selected ? .34 : 0;
        material.opacity = selected ? 1 : (selectedExpressIds.size ? Math.min(material.userData.baseOpacity ?? 1,.34) : material.userData.baseOpacity ?? 1);
        material.transparent = material.opacity < .995;
        material.depthWrite = material.opacity > .5;
      });
    });
  }, [selectedExpressIds,visibleExpressIds]);

  useEffect(() => { if (command) engineRef.current?.fit(command.type); }, [command]);

  return <div ref={containerRef} className="bim-ifc-engine" onPointerDown={(_event:ReactPointerEvent)=>containerRef.current?.focus()} tabIndex={0}/>;
}
