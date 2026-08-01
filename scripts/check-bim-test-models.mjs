import { fileURLToPath } from "node:url";
import { IfcAPI } from "web-ifc";

const models = [
  ["Snelle rooktest", "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/main/IFC%204.0.2.1%20(IFC%204)/ISO%20Spec%20-%20ReferenceView_V1.2/wall-with-opening-and-window.ifc"],
  ["Architectuurmodel", "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/main/IFC%204.0.2.1%20(IFC%204)/PCERT-Sample-Scene/Building-Architecture.ifc"],
  ["Constructiemodel", "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/main/IFC%204.0.2.1%20(IFC%204)/PCERT-Sample-Scene/Building-Structural.ifc"],
  ["Inframodel weg", "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/main/IFC%204.3.2.0%20(IFC4X3_ADD2)/PCERT-Sample-Scene/Infra-Road.ifc"],
];

const ifcApi = new IfcAPI();
const wasmDirectory = fileURLToPath(new URL("../node_modules/web-ifc/", import.meta.url)).replaceAll("\\", "/");
ifcApi.SetWasmPath(`${wasmDirectory}/`, true);
await ifcApi.Init();

try {
  for (const [label, url] of models) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${label}: download gaf HTTP ${response.status}`);

    const bytes = new Uint8Array(await response.arrayBuffer());
    const modelId = ifcApi.OpenModel(bytes, { COORDINATE_TO_ORIGIN:true, CIRCLE_SEGMENTS:16 });
    if (modelId < 0) throw new Error(`${label}: WebIFC kon het model niet openen`);

    let meshes = 0;
    let geometries = 0;
    ifcApi.StreamAllMeshes(modelId, flatMesh => {
      meshes += 1;
      geometries += flatMesh.geometries.size();
    });

    const schema = ifcApi.GetModelSchema(modelId);
    if (!schema || meshes === 0 || geometries === 0) {
      throw new Error(`${label}: geen bruikbare geometrie (${schema || "onbekend schema"}, ${meshes} meshes, ${geometries} geometrieën)`);
    }

    console.log(`✓ ${label}: ${schema}, ${bytes.byteLength} bytes, ${meshes} meshes, ${geometries} geometrieën`);
    ifcApi.CloseModel(modelId);
  }
} finally {
  ifcApi.Dispose();
}
