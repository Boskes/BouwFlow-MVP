export const bimProductionTestModels = [
  {
    id: "smoke-wall-window",
    label: "Snelle rooktest",
    detail: "IFC4 · wand, opening en raam · 12 KB",
    fileName: "wall-with-opening-and-window.ifc",
    sourceUrl: "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/main/IFC%204.0.2.1%20(IFC%204)/ISO%20Spec%20-%20ReferenceView_V1.2/wall-with-opening-and-window.ifc",
  },
  {
    id: "building-architecture",
    label: "Architectuurmodel",
    detail: "IFC4 · volledig gebouwmodel · 220 KB",
    fileName: "Building-Architecture.ifc",
    sourceUrl: "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/main/IFC%204.0.2.1%20(IFC%204)/PCERT-Sample-Scene/Building-Architecture.ifc",
  },
  {
    id: "building-structural",
    label: "Constructiemodel",
    detail: "IFC4 · kolommen, balken en platen · 290 KB",
    fileName: "Building-Structural.ifc",
    sourceUrl: "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/main/IFC%204.0.2.1%20(IFC%204)/PCERT-Sample-Scene/Building-Structural.ifc",
  },
  {
    id: "infra-road",
    label: "Inframodel weg",
    detail: "IFC4.3 · weg- en terreingeometrie · 407 KB",
    fileName: "Infra-Road.ifc",
    sourceUrl: "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/main/IFC%204.3.2.0%20(IFC4X3_ADD2)/PCERT-Sample-Scene/Infra-Road.ifc",
  },
] as const;

export type BimProductionTestModel = (typeof bimProductionTestModels)[number];

export function getBimProductionTestModel(id: string) {
  return bimProductionTestModels.find((model) => model.id === id);
}
