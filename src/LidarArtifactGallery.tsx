import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Cuboid, Download, Eye, FileJson, LoaderCircle, X } from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LidarArtifact } from './lidar-bim'
import { parseRoomPlanPreview, type RoomPlanElementKind } from './roomplan-preview'

type ArtifactDownloader=(scanId:string,artifactId:string)=>Promise<Blob|undefined>
type Props={scanId:string;artifacts:LidarArtifact[];downloadArtifact?:ArtifactDownloader;compact?:boolean}

const sizeLabel=(bytes:number)=>bytes<1_000_000
  ? `${Math.max(1,Math.round(bytes/1_000))} kB`
  : `${new Intl.NumberFormat('nl-BE',{maximumFractionDigits:1}).format(bytes/1_000_000)} MB`
const isPhoto=(artifact:LidarArtifact)=>artifact.kind==='Foto'||artifact.mimeType.startsWith('image/')
const isModel=(artifact:LidarArtifact)=>artifact.kind==='USDZ'||artifact.mimeType.includes('usdz')
const isRoomPlan=(artifact:LidarArtifact)=>artifact.kind==='RoomPlan JSON'||(artifact.mimeType.includes('json')&&artifact.fileName.toLowerCase().includes('roomplan'))
const isInteractive=(artifact:LidarArtifact)=>isModel(artifact)||isRoomPlan(artifact)

const materialOptions:Record<RoomPlanElementKind,{color:number;opacity:number}>={
  wall:{color:0x55b8a4,opacity:.72},
  floor:{color:0x79928f,opacity:.55},
  door:{color:0xf5a623,opacity:.82},
  window:{color:0x67b7df,opacity:.48},
  opening:{color:0xd6eee9,opacity:.25},
  object:{color:0xb9d46a,opacity:.72},
}

const elementLabel:Record<RoomPlanElementKind,string>={wall:'wanden',floor:'vloeren',door:'deuren',window:'ramen',opening:'openingen',object:'objecten'}

function LidarRoomPlanViewer({url}:{url:string}){
  const hostRef=useRef<HTMLDivElement>(null)
  const [error,setError]=useState('')
  const [status,setStatus]=useState('RoomPlan-model laden…')

  useEffect(()=>{
    const host=hostRef.current
    if(!host)return
    let disposed=false
    let frame=0
    let renderer:THREE.WebGLRenderer
    const scene=new THREE.Scene()
    scene.background=new THREE.Color(0x10272d)
    const camera=new THREE.PerspectiveCamera(42,1,.01,1_000)
    camera.position.set(5,4,5)
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false})}catch(reason){setError(reason instanceof Error?reason.message:'3D-weergave is niet beschikbaar');return}
    renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2))
    host.appendChild(renderer.domElement)
    const controls=new OrbitControls(camera,renderer.domElement)
    controls.enableDamping=true
    controls.dampingFactor=.08
    controls.screenSpacePanning=true
    scene.add(new THREE.HemisphereLight(0xeafdf8,0x38525a,2.7))
    const keyLight=new THREE.DirectionalLight(0xffffff,2.1);keyLight.position.set(5,8,4);scene.add(keyLight)

    const resize=()=>{
      const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight)
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()
    }
    const observer=new ResizeObserver(resize);observer.observe(host);resize()

    void fetch(url).then(response=>{
      if(!response.ok)throw new Error(`RoomPlan-bestand laden mislukt (${response.status}).`)
      return response.json() as Promise<unknown>
    }).then(value=>{
      if(disposed)return
      const preview=parseRoomPlanPreview(value)
      const model=new THREE.Group()
      preview.elements.forEach(element=>{
        const [width,height,depth]=element.dimensions
        const surface=element.kind!=='object'
        const geometry=new THREE.BoxGeometry(Math.max(width,.025),Math.max(height,.025),surface?Math.max(depth,.045):Math.max(depth,.025))
        const options=materialOptions[element.kind]
        const material=new THREE.MeshStandardMaterial({color:options.color,transparent:options.opacity<1,opacity:options.opacity,roughness:.72,metalness:.02,side:THREE.DoubleSide,depthWrite:options.opacity>.35})
        const mesh=new THREE.Mesh(geometry,material)
        mesh.name=element.label
        mesh.matrix.fromArray(element.transform)
        mesh.matrixAutoUpdate=false
        const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:0xd8f1ec,transparent:true,opacity:.52}))
        mesh.add(edges)
        model.add(mesh)
      })
      scene.add(model)
      const bounds=new THREE.Box3().setFromObject(model)
      if(bounds.isEmpty())throw new Error('Het RoomPlan-model bevat geen zichtbare geometrie.')
      const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3())
      model.position.sub(center)
      const gridSize=Math.max(12,Math.ceil(Math.max(size.x,size.z)*1.6))
      const grid=new THREE.GridHelper(gridSize,Math.max(12,gridSize*2),0x55b8a4,0x29474d)
      const gridMaterials=Array.isArray(grid.material)?grid.material:[grid.material]
      gridMaterials.forEach(material=>{material.opacity=.38;material.transparent=true})
      grid.position.y=bounds.min.y-center.y-.03
      scene.add(grid)
      const extent=Math.max(size.x,size.y,size.z,.75)
      camera.near=Math.max(.005,extent/1_000);camera.far=Math.max(100,extent*50)
      camera.position.set(extent*1.25,extent*.9,extent*1.25);camera.updateProjectionMatrix()
      controls.target.set(0,0,0);controls.minDistance=extent*.08;controls.maxDistance=extent*12;controls.update()
      const summary=Object.entries(preview.counts).map(([kind,count])=>`${count} ${elementLabel[kind as RoomPlanElementKind]}`).join(' · ')
      setStatus(`${preview.elements.length} elementen · ${summary}`)
    }).catch(reason=>{if(!disposed){setStatus('');setError(reason instanceof Error?reason.message:'Het RoomPlan-model kon niet worden geopend.')}})

    const render=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render)};render()
    return()=>{
      disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose()
      scene.traverse(object=>{
        const mesh=object as THREE.Mesh
        mesh.geometry?.dispose()
        const materials=Array.isArray(mesh.material)?mesh.material:mesh.material?[mesh.material]:[]
        materials.forEach(material=>material.dispose())
      })
      renderer.dispose();renderer.domElement.remove()
    }
  },[url])

  return <div className="lidar-usdz-viewer" ref={hostRef}>
    {error&&<div className="lidar-artifact-error lidar-viewer-status">{error}</div>}
    {!error&&status&&<div className="lidar-viewer-status">{status}</div>}
    <div className="lidar-viewer-legend"><span className="wall">Wanden</span><span className="floor">Vloeren</span><span className="door">Deuren</span><span className="window">Ramen</span><span className="object">Objecten</span></div>
    <div className="lidar-viewer-hint">Sleep om te draaien · scroll om te zoomen</div>
  </div>
}

export default function LidarArtifactGallery({scanId,artifacts,downloadArtifact,compact=false}:Props){
  const [urls,setUrls]=useState<Record<string,string>>({})
  const [loading,setLoading]=useState<Set<string>>(new Set())
  const [selectedId,setSelectedId]=useState<string>()
  const [error,setError]=useState('')
  const createdUrls=useRef<string[]>([])
  const photos=useMemo(()=>artifacts.filter(isPhoto),[artifacts])
  const roomPlan=useMemo(()=>artifacts.find(isRoomPlan),[artifacts])
  const photoKey=photos.map(item=>item.id).join('|')
  const selected=artifacts.find(item=>item.id===selectedId)
  const previewArtifact=selected&&isInteractive(selected)?roomPlan:undefined

  const load=async(artifact:LidarArtifact)=>{
    if(urls[artifact.id])return urls[artifact.id]
    if(!downloadArtifact){setError('Dit voorbeeldbestand heeft nog geen opgeslagen downloadbron.');return undefined}
    setLoading(current=>new Set(current).add(artifact.id));setError('')
    try{
      const blob=await downloadArtifact(scanId,artifact.id)
      if(!blob)throw new Error('Het bewijsbestand is niet beschikbaar.')
      const url=URL.createObjectURL(blob);createdUrls.current.push(url);setUrls(current=>({...current,[artifact.id]:url}));return url
    }catch(reason){setError(reason instanceof Error?reason.message:'Het bewijsbestand kon niet worden geladen.');return undefined}
    finally{setLoading(current=>{const next=new Set(current);next.delete(artifact.id);return next})}
  }

  useEffect(()=>{
    if(!downloadArtifact)return
    let active=true
    // Laad alleen de eerste zichtbare reeks automatisch; overige foto's laden bij openen.
    // Zo kan een grote werfopname nooit opnieuw een requestpiek veroorzaken.
    void Promise.all(photos.slice(0,6).map(async artifact=>{
      if(urls[artifact.id])return
      try{const blob=await downloadArtifact(scanId,artifact.id);if(!blob)return;const url=URL.createObjectURL(blob);if(!active){URL.revokeObjectURL(url);return}createdUrls.current.push(url);setUrls(current=>({...current,[artifact.id]:url}))}catch{/* Een kaart kan later handmatig opnieuw worden geopend. */}
    }))
    return()=>{active=false}
    // photoKey voorkomt opnieuw ophalen wanneer alleen de bovenliggende status wijzigt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[downloadArtifact,photoKey,scanId])

  useEffect(()=>()=>{createdUrls.current.forEach(url=>URL.revokeObjectURL(url))},[])

  const open=async(artifact:LidarArtifact)=>{
    setSelectedId(artifact.id);setError('')
    if(isInteractive(artifact)){
      if(roomPlan&&!urls[roomPlan.id])await load(roomPlan)
      else if(!roomPlan)setError('Bij deze opname ontbreekt het RoomPlan-JSON dat nodig is voor de interactieve browserweergave. Het originele USDZ-bestand blijft downloadbaar.')
      return
    }
    if(!urls[artifact.id])await load(artifact)
  }
  const download=async(artifact:LidarArtifact)=>{const url=urls[artifact.id]??await load(artifact);if(!url)return;const link=document.createElement('a');link.href=url;link.download=artifact.fileName;link.click()}

  if(!artifacts.length)return <section className={`lidar-artifact-gallery ${compact?'is-compact':''}`}><header><div><strong>Scanbewijs</strong><span>Nog geen foto’s of 3D-bestanden ontvangen.</span></div></header></section>
  return <>
    <section className={`lidar-artifact-gallery ${compact?'is-compact':''}`}>
      <header><div><strong>Foto’s en 3D-scan</strong><span>{artifacts.length} bewijsbestand{artifacts.length===1?'':'en'} · beveiligd opgeslagen</span></div></header>
      <div className="lidar-artifact-cards">{artifacts.map(artifact=>{
        const photo=isPhoto(artifact),interactive=isInteractive(artifact),url=urls[artifact.id],busy=loading.has(artifact.id)||(interactive&&roomPlan?loading.has(roomPlan.id):false)
        return <article key={artifact.id} className={interactive?'model':''}>
          <button type="button" className="lidar-artifact-preview" onClick={()=>void open(artifact)} aria-label={`${artifact.fileName} bekijken`}>
            {photo&&url?<img src={url} alt={artifact.fileName}/>:busy?<LoaderCircle className="spin" size={24}/>:photo?<Camera size={28}/>:interactive?<Cuboid size={32}/>:<FileJson size={27}/>}
            <span><Eye size={13}/>{interactive?'Open interactief 3D':'Bekijken'}</span>
          </button>
          <div><strong>{artifact.kind}</strong><span title={artifact.fileName}>{artifact.fileName}</span><small>{sizeLabel(artifact.sizeBytes)} · {new Date(artifact.capturedAt).toLocaleString('nl-BE')}</small></div>
          <button type="button" className="icon-button" aria-label={`${artifact.fileName} downloaden`} onClick={()=>void download(artifact)}><Download size={14}/></button>
        </article>
      })}</div>
      {error&&<div className="lidar-artifact-error">{error}</div>}
    </section>
    {selected&&<div className="modal-backdrop lidar-artifact-backdrop" role="dialog" aria-modal="true" aria-label={`${selected.fileName} bekijken`}>
      <section className="modal lidar-artifact-dialog">
        <header><div><strong>{isInteractive(selected)?'Interactief RoomPlan-model':selected.kind} · {selected.fileName}</strong><span>{sizeLabel(selected.sizeBytes)} · opgenomen {new Date(selected.capturedAt).toLocaleString('nl-BE')}</span></div><button type="button" className="icon-button" aria-label="Viewer sluiten" onClick={()=>setSelectedId(undefined)}><X size={20}/></button></header>
        <main>{previewArtifact&&loading.has(previewArtifact.id)?<div className="lidar-artifact-loading"><LoaderCircle className="spin" size={30}/>3D-model opbouwen…</div>:isPhoto(selected)&&urls[selected.id]?<img src={urls[selected.id]} alt={selected.fileName}/>:previewArtifact&&urls[previewArtifact.id]?<LidarRoomPlanViewer url={urls[previewArtifact.id]}/>:<div className="lidar-artifact-loading"><FileJson size={34}/><strong>Interactieve weergave niet beschikbaar</strong><span>{error||'Bij deze opname ontbreekt een leesbaar RoomPlan-bestand. Download het originele bewijsbestand om het lokaal te openen.'}</span></div>}</main>
        <footer><span>{isInteractive(selected)&&roomPlan?'3D opgebouwd uit het originele Apple RoomPlan-bewijs · ':''}SHA-256: {selected.digest?selected.digest.slice(0,20)+'…':'wordt bij upload geregistreerd'}</span><button type="button" className="secondary" onClick={()=>void download(selected)}><Download size={15}/>Origineel downloaden</button></footer>
      </section>
    </div>}
  </>
}
