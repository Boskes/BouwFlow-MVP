import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { FamilyHomeBimGeometry, FamilyHomeBimShape } from './family-home-bim'

export type FamilyHomeViewerElement = {
  id:string
  label:string
  category:string
  shape?:FamilyHomeBimShape|string
  geometry?:FamilyHomeBimGeometry
  quantity:number
  unitCost?:number
  costValue?:number
}

type Props = {
  elements:FamilyHomeViewerElement[]
  selectedIds:Set<string>
  dimension:'3D'|'4D'|'5D'
  elementState?:(element:FamilyHomeViewerElement)=>'complete'|'active'|'future'|'timeline-complete'|'timeline-active'|'timeline-future'|''
  onToggle?:(id:string,additive:boolean)=>void
  className?:string
}

const baseColor = (element:FamilyHomeViewerElement) => {
  if(element.shape==='roof')return '#783b32'
  if(element.shape==='window')return '#52b4d1'
  if(element.shape==='door')return '#8b5435'
  if(element.category==='Installaties')return '#e38a42'
  if(element.category==='Vloeren')return '#aaa69c'
  if(element.category==='Kolommen')return '#747f82'
  if(element.category==='Overig')return '#657d57'
  return '#d5c2a2'
}

export default function FamilyHomeBimViewer({elements,selectedIds,dimension,elementState,onToggle,className=''}:Props){
  const hostRef=useRef<HTMLDivElement>(null)
  const sceneRef=useRef<THREE.Scene|undefined>(undefined)
  const groupRef=useRef<THREE.Group|undefined>(undefined)
  const interactiveRef=useRef<THREE.Mesh[]>([])
  const onToggleRef=useRef(onToggle)
  onToggleRef.current=onToggle

  useEffect(()=>{
    const host=hostRef.current
    if(!host)return
    const scene=new THREE.Scene()
    scene.background=new THREE.Color('#172a31')
    scene.fog=new THREE.Fog('#172a31',22,42)
    const camera=new THREE.PerspectiveCamera(38,1,.1,100)
    camera.position.set(14,10.5,15.5)
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false})
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
    renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.shadowMap.enabled=true
    renderer.shadowMap.type=THREE.PCFSoftShadowMap
    renderer.domElement.className='family-home-three-canvas'
    renderer.domElement.setAttribute('aria-label','Interactief 3D BIM-model van een vrijstaande gezinswoning')
    host.appendChild(renderer.domElement)

    const controls=new OrbitControls(camera,renderer.domElement)
    controls.target.set(0,2.6,0)
    controls.enableDamping=true
    controls.minDistance=10
    controls.maxDistance=32
    controls.maxPolarAngle=Math.PI*.48

    scene.add(new THREE.HemisphereLight('#dff5ff','#26342b',2.15))
    const sunlight=new THREE.DirectionalLight('#fff4da',3.1)
    sunlight.position.set(9,16,11)
    sunlight.castShadow=true
    sunlight.shadow.mapSize.set(2048,2048)
    sunlight.shadow.camera.left=-14; sunlight.shadow.camera.right=14; sunlight.shadow.camera.top=14; sunlight.shadow.camera.bottom=-14
    scene.add(sunlight)
    const fill=new THREE.DirectionalLight('#6fa3c1',1.1); fill.position.set(-10,7,-9); scene.add(fill)

    const ground=new THREE.Mesh(new THREE.PlaneGeometry(34,28),new THREE.MeshStandardMaterial({color:'#31483d',roughness:.94,metalness:0}))
    ground.rotation.x=-Math.PI/2; ground.position.y=-.57; ground.receiveShadow=true; scene.add(ground)
    const grid=new THREE.GridHelper(28,28,'#58766b','#3a554c'); grid.position.y=-.555; scene.add(grid)
    const apron=new THREE.Mesh(new THREE.BoxGeometry(5.2,.12,3.8),new THREE.MeshStandardMaterial({color:'#777a76',roughness:1}))
    apron.position.set(2.4,-.48,-5.7); apron.receiveShadow=true; scene.add(apron)

    sceneRef.current=scene
    const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2()
    const pick=(event:PointerEvent)=>{
      const bounds=renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX-bounds.left)/bounds.width)*2-1,-((event.clientY-bounds.top)/bounds.height)*2+1)
      raycaster.setFromCamera(pointer,camera)
      return raycaster.intersectObjects(interactiveRef.current,false)[0]?.object as THREE.Mesh|undefined
    }
    const click=(event:PointerEvent)=>{const mesh=pick(event);const id=mesh?.userData.elementId as string|undefined;if(id)onToggleRef.current?.(id,event.shiftKey||event.ctrlKey||event.metaKey)}
    const move=(event:PointerEvent)=>{renderer.domElement.style.cursor=pick(event)?'pointer':'grab'}
    renderer.domElement.addEventListener('pointerup',click)
    renderer.domElement.addEventListener('pointermove',move)

    const resize=()=>{const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false)}
    const observer=new ResizeObserver(resize);observer.observe(host);resize()
    let frame=0
    const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}
    animate()
    return ()=>{
      cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerup',click);renderer.domElement.removeEventListener('pointermove',move)
      renderer.dispose();host.removeChild(renderer.domElement);sceneRef.current=undefined
    }
  },[])

  useEffect(()=>{
    const scene=sceneRef.current
    if(!scene)return
    if(groupRef.current){scene.remove(groupRef.current);groupRef.current.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose())}if(object instanceof THREE.LineSegments){object.geometry.dispose();const material=object.material as THREE.Material;material.dispose()}})}
    const group=new THREE.Group(), interactive:THREE.Mesh[]=[]
    const maxCost=Math.max(1,...elements.map(element=>element.costValue??element.quantity*(element.unitCost??0)))
    elements.forEach(element=>{
      const geometry=element.geometry
      if(!geometry)return
      const selected=selectedIds.has(element.id)
      const state=(elementState?.(element)??'').replace('timeline-','')
      const color=new THREE.Color(baseColor(element))
      let opacity=element.shape==='window' ? .78 : 1
      if(dimension==='4D'){
        if(state==='complete')color.set('#2f9c82')
        if(state==='active')color.set('#f4a43c')
        if(state==='future'){color.set('#596b6e');opacity=.11}
      }
      if(dimension==='5D'){
        const ratio=(element.costValue??element.quantity*(element.unitCost??0))/maxCost
        color.set('#245f59').lerp(new THREE.Color('#f2b24c'),Math.min(1,Math.sqrt(ratio)))
      }
      if(selected){color.set('#ff9f2e');opacity=1}
      const box=new THREE.BoxGeometry(...geometry.size)
      const material=new THREE.MeshStandardMaterial({color,roughness:element.shape==='window' ? .24 : .78,metalness:element.shape==='window' ? .12 : 0,transparent:opacity<1,opacity,depthWrite:opacity>.2,emissive:selected?'#6a2b00':'#000000',emissiveIntensity:selected ? .48 : 0})
      const mesh=new THREE.Mesh(box,material)
      mesh.position.set(...geometry.position)
      if(geometry.rotation)mesh.rotation.set(...geometry.rotation)
      mesh.castShadow=opacity>.2;mesh.receiveShadow=true;mesh.userData.elementId=element.id;mesh.userData.label=element.label
      const outline=new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineBasicMaterial({color:selected?'#ffe1a9':'#263a3b',transparent:true,opacity:state==='future' ? .12 : .42}))
      mesh.add(outline);group.add(mesh);interactive.push(mesh)
    })
    groupRef.current=group;interactiveRef.current=interactive;scene.add(group)
  },[dimension,elementState,elements,selectedIds])

  return <div className={`family-home-three-viewer ${className}`}>
    <div ref={hostRef} className="family-home-three-host"/>
    <div className="family-home-three-caption"><strong>Vrijstaande gezinswoning · LOD350</strong><span>Slepen = roteren · scrollen = zoomen · klik = BIM-object selecteren</span></div>
    <div className="family-home-three-levels"><span>Dak</span><span>Verdieping 1</span><span>Gelijkvloers</span></div>
  </div>
}
