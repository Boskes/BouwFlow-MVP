import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Cuboid, Download, Eye, FileJson, LoaderCircle, X } from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js'
import type { LidarArtifact } from './lidar-bim'

type ArtifactDownloader=(scanId:string,artifactId:string)=>Promise<Blob|undefined>
type Props={scanId:string;artifacts:LidarArtifact[];downloadArtifact?:ArtifactDownloader;compact?:boolean}

const sizeLabel=(bytes:number)=>`${new Intl.NumberFormat('nl-BE',{maximumFractionDigits:1}).format(bytes/1_000_000)} MB`
const isPhoto=(artifact:LidarArtifact)=>artifact.kind==='Foto'||artifact.mimeType.startsWith('image/')
const isModel=(artifact:LidarArtifact)=>artifact.kind==='USDZ'||artifact.mimeType.includes('usdz')

function LidarUsdZViewer({url}:{url:string}){
  const hostRef=useRef<HTMLDivElement>(null)
  const [error,setError]=useState('')

  useEffect(()=>{
    const host=hostRef.current
    if(!host)return
    let disposed=false
    let frame=0
    let renderer:THREE.WebGLRenderer
    const scene=new THREE.Scene()
    scene.background=new THREE.Color(0x10272d)
    const camera=new THREE.PerspectiveCamera(42,1,.01,1_000)
    camera.position.set(3,2.2,3)
    try{renderer=new THREE.WebGLRenderer({antialias:true})}catch(reason){setError(reason instanceof Error?reason.message:'3D-weergave is niet beschikbaar');return}
    renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2))
    host.appendChild(renderer.domElement)
    const controls=new OrbitControls(camera,renderer.domElement)
    controls.enableDamping=true
    controls.dampingFactor=.08
    scene.add(new THREE.HemisphereLight(0xeafdf8,0x38525a,2.5))
    const keyLight=new THREE.DirectionalLight(0xffffff,2.2);keyLight.position.set(4,7,5);scene.add(keyLight)
    const floor=new THREE.GridHelper(12,24,0x55b8a4,0x29474d)
    const floorMaterials=Array.isArray(floor.material)?floor.material:[floor.material]
    floorMaterials.forEach(material=>{material.opacity=.35;material.transparent=true})
    scene.add(floor)

    const resize=()=>{
      const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight)
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()
    }
    const observer=new ResizeObserver(resize);observer.observe(host);resize()
    const loader=new USDZLoader()
    loader.load(url,model=>{
      if(disposed)return
      const bounds=new THREE.Box3().setFromObject(model)
      const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3())
      model.position.sub(center);scene.add(model)
      const extent=Math.max(size.x,size.y,size.z,.5)
      floor.position.y=-size.y/2
      camera.near=Math.max(.001,extent/1_000);camera.far=Math.max(100,extent*40)
      camera.position.set(extent*1.25,extent*.9,extent*1.25);camera.updateProjectionMatrix()
      controls.target.set(0,0,0);controls.update()
    },undefined,reason=>{if(!disposed)setError(reason instanceof Error?reason.message:'Het USDZ-model kon niet worden geopend.')})
    const render=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render)};render()
    return()=>{
      disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose()
      scene.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry?.dispose();const materials=Array.isArray(mesh.material)?mesh.material:mesh.material?[mesh.material]:[];materials.forEach(material=>material.dispose())})
      renderer.dispose();renderer.domElement.remove()
    }
  },[url])

  return <div className="lidar-usdz-viewer" ref={hostRef}>{error&&<div className="lidar-artifact-error">{error}</div>}<div className="lidar-viewer-hint">Sleep om te draaien · scroll om te zoomen</div></div>
}

export default function LidarArtifactGallery({scanId,artifacts,downloadArtifact,compact=false}:Props){
  const [urls,setUrls]=useState<Record<string,string>>({})
  const [loading,setLoading]=useState<Set<string>>(new Set())
  const [selectedId,setSelectedId]=useState<string>()
  const [error,setError]=useState('')
  const createdUrls=useRef<string[]>([])
  const photos=useMemo(()=>artifacts.filter(isPhoto),[artifacts])
  const photoKey=photos.map(item=>item.id).join('|')
  const selected=artifacts.find(item=>item.id===selectedId)

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

  const open=async(artifact:LidarArtifact)=>{setSelectedId(artifact.id);if(!urls[artifact.id])await load(artifact)}
  const download=async(artifact:LidarArtifact)=>{const url=urls[artifact.id]??await load(artifact);if(!url)return;const link=document.createElement('a');link.href=url;link.download=artifact.fileName;link.click()}

  if(!artifacts.length)return <section className={`lidar-artifact-gallery ${compact?'is-compact':''}`}><header><div><strong>Scanbewijs</strong><span>Nog geen foto’s of 3D-bestanden ontvangen.</span></div></header></section>
  return <>
    <section className={`lidar-artifact-gallery ${compact?'is-compact':''}`}>
      <header><div><strong>Foto’s en 3D-scan</strong><span>{artifacts.length} bewijsbestand{artifacts.length===1?'':'en'} · beveiligd opgeslagen</span></div></header>
      <div className="lidar-artifact-cards">{artifacts.map(artifact=>{
        const photo=isPhoto(artifact),model=isModel(artifact),url=urls[artifact.id],busy=loading.has(artifact.id)
        return <article key={artifact.id} className={model?'model':''}>
          <button type="button" className="lidar-artifact-preview" onClick={()=>void open(artifact)} aria-label={`${artifact.fileName} bekijken`}>
            {photo&&url?<img src={url} alt={artifact.fileName}/>:busy?<LoaderCircle className="spin" size={24}/>:photo?<Camera size={28}/>:model?<Cuboid size={32}/>:<FileJson size={27}/>}
            <span><Eye size={13}/>{model?'Open interactief 3D':'Bekijken'}</span>
          </button>
          <div><strong>{artifact.kind}</strong><span title={artifact.fileName}>{artifact.fileName}</span><small>{sizeLabel(artifact.sizeBytes)} · {new Date(artifact.capturedAt).toLocaleString('nl-BE')}</small></div>
          <button type="button" className="icon-button" aria-label={`${artifact.fileName} downloaden`} onClick={()=>void download(artifact)}><Download size={14}/></button>
        </article>
      })}</div>
      {error&&<div className="lidar-artifact-error">{error}</div>}
    </section>
    {selected&&<div className="modal-backdrop lidar-artifact-backdrop" role="dialog" aria-modal="true" aria-label={`${selected.fileName} bekijken`}>
      <section className="modal lidar-artifact-dialog">
        <header><div><strong>{selected.kind} · {selected.fileName}</strong><span>{sizeLabel(selected.sizeBytes)} · opgenomen {new Date(selected.capturedAt).toLocaleString('nl-BE')}</span></div><button type="button" className="icon-button" aria-label="Viewer sluiten" onClick={()=>setSelectedId(undefined)}><X size={20}/></button></header>
        <main>{loading.has(selected.id)?<div className="lidar-artifact-loading"><LoaderCircle className="spin" size={30}/>Bewijs laden…</div>:isPhoto(selected)&&urls[selected.id]?<img src={urls[selected.id]} alt={selected.fileName}/>:isModel(selected)&&urls[selected.id]?<LidarUsdZViewer url={urls[selected.id]}/>:<div className="lidar-artifact-loading"><FileJson size={34}/><strong>Voorvertoning niet beschikbaar</strong><span>Download het originele bestand om het lokaal te openen.</span></div>}</main>
        <footer><span>SHA-256: {selected.digest?selected.digest.slice(0,20)+'…':'wordt bij upload geregistreerd'}</span><button type="button" className="secondary" onClick={()=>void download(selected)}><Download size={15}/>Origineel downloaden</button></footer>
      </section>
    </div>}
  </>
}
