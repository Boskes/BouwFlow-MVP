export type RoomPlanElementKind='wall'|'floor'|'door'|'window'|'opening'|'object'

export type RoomPlanPreviewElement={
  id:string
  kind:RoomPlanElementKind
  label:string
  dimensions:[number,number,number]
  transform:number[]
}

export type RoomPlanPreview={elements:RoomPlanPreviewElement[];counts:Partial<Record<RoomPlanElementKind,number>>}

const collections:[string,RoomPlanElementKind][]=[
  ['walls','wall'],['floors','floor'],['doors','door'],['windows','window'],['openings','opening'],['objects','object'],
]

const isRecord=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)

const finiteNumbers=(value:unknown):number[]=>{
  if(Array.isArray(value))return value.flatMap(finiteNumbers)
  if(typeof value==='number'&&Number.isFinite(value))return [value]
  return []
}

const vector3=(value:unknown):[number,number,number]|undefined=>{
  const record=isRecord(value)?value:undefined
  const values=record&&['x','y','z'].every(key=>typeof record[key]==='number')
    ? [record.x,record.y,record.z] as number[]
    : finiteNumbers(value)
  if(values.length<3||values.slice(0,3).some(item=>item<0||item>10_000))return undefined
  return [values[0],values[1],values[2]]
}

const matrix4=(value:unknown):number[]|undefined=>{
  const record=isRecord(value)?value:undefined
  const candidate=record?.columns??record?.matrix??record?.values??value
  const values=finiteNumbers(candidate)
  if(values.length!==16)return undefined
  return values
}

const categoryLabel=(value:unknown)=>{
  if(typeof value==='string')return value
  if(!isRecord(value))return ''
  const key=Object.keys(value)[0]
  return key?key.replaceAll('_',' '):''
}

const collectionRoot=(value:unknown):Record<string,unknown>|undefined=>{
  if(!isRecord(value))return undefined
  if(collections.some(([name])=>Array.isArray(value[name])))return value
  for(const key of ['room','capturedRoom','result']){
    const nested=value[key]
    if(isRecord(nested)&&collections.some(([name])=>Array.isArray(nested[name])))return nested
  }
  return value
}

export function parseRoomPlanPreview(value:unknown):RoomPlanPreview{
  const root=collectionRoot(value)
  if(!root)throw new Error('Het RoomPlan-bestand bevat geen leesbaar object.')
  const elements:RoomPlanPreviewElement[]=[]
  const counts:Partial<Record<RoomPlanElementKind,number>>={}

  for(const [collection,kind] of collections){
    const values=root[collection]
    if(!Array.isArray(values))continue
    values.forEach((entry,index)=>{
      if(!isRecord(entry))return
      const dimensions=vector3(entry.dimensions)
      const transform=matrix4(entry.transform)
      if(!dimensions||!transform)return
      const category=categoryLabel(entry.category)
      elements.push({
        id:typeof entry.identifier==='string'?entry.identifier:`${kind}-${index+1}`,
        kind,
        label:category||`${kind} ${index+1}`,
        dimensions,
        transform,
      })
      counts[kind]=(counts[kind]??0)+1
    })
  }

  if(!elements.length)throw new Error('In dit RoomPlan-bestand zijn geen tekenbare wanden, vloeren of objecten gevonden.')
  return {elements,counts}
}
